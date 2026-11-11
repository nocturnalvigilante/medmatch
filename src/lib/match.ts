// Deterministic matcher: one active ingredient ("salt") → US facts.
// The AI never decides matches; only RxNorm (names) and openFDA (sold / OTC / Rx) do.
// Rule: if we can't verify, say so. Never guess.

const RXNAV = "https://rxnav.nlm.nih.gov/REST";
const OPENFDA = "https://api.fda.gov/drug/ndc.json";

export type SaleStatus =
  | "otc" // sold over the counter (maybe some forms need Rx)
  | "rx" // prescription only
  | "not_sold" // no human drug listing in the US
  | "unknown"; // a source failed; don't guess

export type Form = "oral" | "inhaled" | "topical" | "eye" | "any";

const FORM_RE: Record<Form, RegExp> = {
  oral: /\b(Oral|Chewable|Sublingual|Buccal)\b/i,
  inhaled: /Inhal/i,
  topical: /\b(Topical|Cream|Ointment|Gel|Transdermal)\b/i,
  eye: /Ophthalmic/i,
  any: /./,
};

// openFDA keeps listings for some drugs FDA pulled from the market. Cited, hand-kept.
const WITHDRAWN: Record<string, string> = {
  ranitidine: "FDA asked makers to pull all ranitidine (Zantac) in April 2020 (NDMA). Not sold in the US.",
  nizatidine: "Nizatidine was largely recalled in the US after 2020 (NDMA). Ask a pharmacist.",
  phenylpropanolamine: "FDA removed phenylpropanolamine in 2000.",
};

const SALT_SUFFIX = /\s+(sodium|potassium|calcium|magnesium|hydrochloride|hcl|hydrobromide|maleate|mesylate|besylate|succinate|tartrate|citrate|sulphate|sulfate|phosphate|acetate|fumarate|bromide|trihydrate|dihydrate|monohydrate)$/i;

export type DrugMatch = {
  query: string; // what the user confirmed, e.g. "paracetamol"
  strengthMg?: number;
  form: Form;
  result: "matched" | "suggestion" | "not_found" | "error";
  usName?: string; // US generic, e.g. "acetaminophen"
  rxcui?: string;
  suggestion?: string; // fuzzy guess: show "did you mean?", never auto-accept
  status: SaleStatus;
  someFormsRx?: boolean; // OTC but some strengths/forms are Rx
  combinationOnly?: boolean; // only sold in the US mixed with other drugs
  brands: string[]; // US box names, common ones first
  usStrengths: string[]; // e.g. ["81 MG Oral Tablet", ...]
  sameStrengthInUS?: boolean;
  note?: string;
};

// Shelf brands people actually see. Shown first ONLY if RxNorm also lists them.
const COMMON_BRANDS: Record<string, string[]> = {
  acetaminophen: ["Tylenol"],
  ibuprofen: ["Advil", "Motrin"],
  naproxen: ["Aleve"],
  aspirin: ["Bayer", "Ecotrin"],
  cetirizine: ["Zyrtec"],
  levocetirizine: ["Xyzal"],
  fexofenadine: ["Allegra"],
  loratadine: ["Claritin"],
  diphenhydramine: ["Benadryl"],
  chlorpheniramine: ["Chlor-Trimeton"],
  phenylephrine: ["Sudafed PE"],
  omeprazole: ["Prilosec"],
  esomeprazole: ["Nexium"],
  famotidine: ["Pepcid"],
  loperamide: ["Imodium"],
  albuterol: ["ProAir", "Ventolin", "Proventil"],
  montelukast: ["Singulair"],
  pantoprazole: ["Protonix"],
  azithromycin: ["Zithromax"],
  amoxicillin: ["Amoxil"],
  ondansetron: ["Zofran"],
  metformin: ["Glucophage"],
  levothyroxine: ["Synthroid", "Levoxyl"],
  furosemide: ["Lasix"],
  ciprofloxacin: ["Cipro"],
  metronidazole: ["Flagyl"],
  telmisartan: ["Micardis"],
  cefixime: ["Suprax"],
  tinidazole: ["Tindamax"],
  dicyclomine: ["Bentyl"],
  "mefenamic acid": ["Ponstel"],
  prochlorperazine: ["Compazine"],
};

// External API JSON; shapes are checked field by field with optional chaining.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

const cache = new Map<string, unknown>();

class NotFound extends Error {}

async function getJSON(url: string): Promise<J> {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 404) throw new NotFound(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  cache.set(url, json);
  return json;
}

const enc = encodeURIComponent;

// Exact (normalized) lookup only. Handles INN names: paracetamol, salbutamol, frusemide.
async function findRxcui(name: string): Promise<string | undefined> {
  const j = await getJSON(`${RXNAV}/rxcui.json?name=${enc(name)}&search=2`);
  return j.idGroup?.rxnormId?.[0];
}

async function fuzzyGuess(name: string): Promise<string | undefined> {
  const j = await getJSON(`${RXNAV}/approximateTerm.json?term=${enc(name)}&maxEntries=1`);
  const c = j.approximateGroup?.candidate?.[0];
  if (!c) return undefined;
  const ing = await toIngredient(c.rxcui).catch(() => undefined);
  return ing?.name;
}

// Salt forms ("pantoprazole sodium") → base ingredient ("pantoprazole").
// Display name = what a US label says. Usually the IN ("pantoprazole"), but when the
// salt name differs from the IN stem ("mefenamic acid" vs IN "mefenamate") keep the label name.
async function toIngredient(rxcui: string): Promise<{ rxcui: string; name: string; label: string } | undefined> {
  const p = await getJSON(`${RXNAV}/rxcui/${rxcui}/properties.json`);
  if (p.properties?.tty === "IN") return { rxcui, name: p.properties.name, label: p.properties.name };
  const r = await getJSON(`${RXNAV}/rxcui/${rxcui}/related.json?tty=IN`);
  const ins = (r.relatedGroup?.conceptGroup ?? []).flatMap((g: J) => g.conceptProperties ?? []);
  if (ins.length !== 1) return undefined; // 0 or a multi-ingredient concept: don't guess
  const own = String(p.properties?.name ?? "");
  const label = own && !own.toLowerCase().startsWith(ins[0].name.toLowerCase()) ? own.toLowerCase() : ins[0].name;
  return { rxcui: ins[0].rxcui, name: ins[0].name, label };
}

type Product = { rxcui: string; name: string; tty: string };

async function products(ingredient: string): Promise<Product[]> {
  const j = await getJSON(`${RXNAV}/drugs.json?name=${enc(ingredient)}`);
  return (j.drugGroup?.conceptGroup ?? [])
    .filter((g: J) => g.tty === "SCD" || g.tty === "SBD")
    .flatMap((g: J) => (g.conceptProperties ?? []).map((p: J) => ({ rxcui: p.rxcui, name: p.name, tty: g.tty })));
}

// Human OTC / Rx listing counts and brand-name counts in openFDA for these RxNorm product ids.
async function fda(ids: string[]): Promise<{ otc: number; rx: number; brandCounts: Map<string, number> }> {
  let otc = 0,
    rx = 0;
  const brandCounts = new Map<string, number>();
  const key = process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : "";
  for (let i = 0; i < ids.length; i += 50) {
    const q = `openfda.rxcui:(${ids.slice(i, i + 50).join("+OR+")})`;
    try {
      const j = await getJSON(`${OPENFDA}?search=${q}&count=product_type.exact${key}`);
      for (const t of j.results ?? []) {
        if (t.term === "HUMAN OTC DRUG") otc += t.count;
        if (t.term === "HUMAN PRESCRIPTION DRUG") rx += t.count;
      }
      const b = await getJSON(`${OPENFDA}?search=${q}&count=brand_name.exact&limit=200${key}`);
      for (const t of b.results ?? []) {
        const k = String(t.term).toLowerCase();
        brandCounts.set(k, (brandCounts.get(k) ?? 0) + t.count);
      }
    } catch (e) {
      if (!(e instanceof NotFound)) throw e; // 404 = no listings; anything else = unknown
    }
  }
  return { otc, rx, brandCounts };
}

// Brands = RxNorm brand names that also have human US listings (drops vet brands),
// curated shelf names first, then by number of listings.
function rankBrands(names: string[], prods: Product[], counts: Map<string, number>): string[] {
  const byKey = new Map<string, string>(); // dedupe case-insensitively, keep first spelling
  for (const p of prods) {
    const b = p.tty === "SBD" ? p.name.match(/\[(.+)\]$/)?.[1]?.trim() : undefined;
    if (b && !byKey.has(b.toLowerCase())) byKey.set(b.toLowerCase(), b);
  }
  // openFDA writes "TYLENOL Extra Strength"; count it toward "Tylenol".
  const score = (k: string) => {
    let n = 0;
    for (const [fda, c] of counts) if (fda === k || fda.startsWith(k + " ")) n += c;
    return n;
  };
  const listed = [...byKey.keys()].filter((k) => score(k) > 0);
  const commonKeys = names.flatMap((n) => COMMON_BRANDS[n] ?? []).map((b) => b.toLowerCase()).filter((k) => listed.includes(k));
  const rest = listed.filter((k) => !commonKeys.includes(k)).sort((a, b) => score(b) - score(a));
  return [...new Set([...commonKeys, ...rest])].slice(0, 5).map((k) => byKey.get(k)!);
}

export async function matchDrug(query: string, strengthMg?: number, form: Form = "oral"): Promise<DrugMatch> {
  const base: DrugMatch = { query, strengthMg, form, result: "not_found", status: "unknown", brands: [], usStrengths: [] };
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  try {
    // Exact first; then without the salt suffix ("thyroxine sodium" -> "thyroxine"). Never fuzzy.
    const id = (await findRxcui(q)) ?? (SALT_SUFFIX.test(q) ? await findRxcui(q.replace(SALT_SUFFIX, "")) : undefined);
    if (!id) {
      const suggestion = await fuzzyGuess(q);
      return suggestion
        ? { ...base, result: "suggestion", suggestion, note: `Not found exactly. Did you mean "${suggestion}"? Check the strip.` }
        : { ...base, note: "Not in RxNorm. Ask a pharmacist." };
    }
    const ing = await toIngredient(id);
    if (!ing) return { ...base, note: "Couldn't resolve to a single ingredient. Enter each salt separately." };
    const matched = { ...base, result: "matched" as const, usName: ing.label, rxcui: ing.rxcui };

    if (WITHDRAWN[ing.name]) return { ...matched, status: "not_sold", note: WITHDRAWN[ing.name] };

    const all = (await products(ing.name)).filter((p) => FORM_RE[form].test(p.name));
    const single = all.filter((p) => !p.name.includes(" / "));
    const combinationOnly = single.length === 0 && all.length > 0;
    const pool = combinationOnly ? all : single;
    const { otc, rx, brandCounts } = pool.length ? await fda(pool.map((p) => p.rxcui)) : { otc: 0, rx: 0, brandCounts: new Map() };

    const status: SaleStatus = otc > 0 ? "otc" : rx > 0 ? "rx" : "not_sold";
    if (status === "not_sold") {
      const where = form === "any" ? "" : ` as ${form === "oral" ? "a tablet/capsule/syrup" : form}`;
      return { ...matched, status, note: `Not sold in the US${where}. There is no US box for this. Ask a pharmacist or doctor.` };
    }
    const usStrengths = [...new Set(single.filter((p) => p.tty === "SCD").map((p) => p.name.replace(/^.*?(?=\d)/, "")))].sort();
    const sameStrengthInUS = strengthMg != null && single.length ? usStrengths.some((s) => new RegExp(`(^|\\s)${strengthMg} MG\\b`).test(s)) : undefined;

    return {
      ...matched,
      status,
      someFormsRx: status === "otc" && rx > 0,
      combinationOnly,
      brands: rankBrands([ing.name, ing.label], pool, brandCounts),
      usStrengths,
      sameStrengthInUS,
      note: combinationOnly ? "In the US this is only sold mixed with other drugs." : undefined,
    };
  } catch (e) {
    return { ...base, result: "error", status: "unknown", note: `Lookup failed (${(e as Error).message}). Try again; we won't guess.` };
  }
}
