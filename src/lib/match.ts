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
  soldAsForms?: Form[]; // not sold in the form asked for, but sold in these (e.g. acetaminophen: not inhaled, but oral)
  alternatives?: { name: string; brand?: string; why: string }[]; // same drug family, OTC in the US; "ask a pharmacist"
};

// Instructor feedback: "not sold in the US" was a dead end. For drugs the US doesn't sell (or sells only on prescription),
// name an over-the-counter medicine from the same drug family, always with "ask a pharmacist if it's right for you".
const NSAID = "Same drug family (NSAID pain reliever), sold over the counter";
const PPI = "Same drug family (acid reducer, PPI), sold over the counter";
const ALTERNATIVES: Record<string, { name: string; brand?: string; why: string }[]> = {
  aceclofenac: [{ name: "ibuprofen", brand: "Advil", why: NSAID }, { name: "naproxen", brand: "Aleve", why: NSAID }],
  nimesulide: [{ name: "ibuprofen", brand: "Advil", why: NSAID }, { name: "naproxen", brand: "Aleve", why: NSAID }],
  propyphenazone: [{ name: "acetaminophen", brand: "Tylenol", why: "Also a pain and fever reliever, sold over the counter" }],
  pheniramine: [{ name: "chlorpheniramine", brand: "Chlor-Trimeton", why: "Same drug family (older antihistamine, causes drowsiness), sold over the counter" }],
  ranitidine: [{ name: "famotidine", brand: "Pepcid", why: "Same drug family (H2 acid reducer), sold over the counter" }],
  pantoprazole: [{ name: "omeprazole", brand: "Prilosec", why: PPI }, { name: "esomeprazole", brand: "Nexium", why: PPI }],
  rabeprazole: [{ name: "omeprazole", brand: "Prilosec", why: PPI }, { name: "esomeprazole", brand: "Nexium", why: PPI }],
};

const FORM_WORDS: Record<Form, string> = { oral: "a tablet, capsule or syrup", inhaled: "an inhaler", topical: "a cream or gel", eye: "eye drops", any: "" };

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
  // Speed (instructor feedback: 1-2 min waits): Next's data cache keeps RxNorm/openFDA answers for a day across requests and instances.
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
  if (res.status === 404) throw new NotFound(url);
  if (!res.ok) throw new Error(String(res.status)); // never put the URL (may hold api_key) in an error
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
  const none = { results: [] };
  const soft = (e: unknown) => {
    if (e instanceof NotFound) return none; // 404 = no listings; anything else = unknown
    throw e;
  };
  // All chunks and both counts in parallel (was one request after another).
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(`openfda.rxcui:(${ids.slice(i, i + 50).join("+OR+")})`);
  const answers = await Promise.all(
    chunks.map((q) =>
      Promise.all([
        getJSON(`${OPENFDA}?search=${q}&count=product_type.exact${key}`).catch(soft),
        getJSON(`${OPENFDA}?search=${q}&count=brand_name.exact&limit=200${key}`).catch(soft),
      ]),
    ),
  );
  for (const [j, b] of answers) {
    for (const t of j.results ?? []) {
      if (t.term === "HUMAN OTC DRUG") otc += t.count;
      if (t.term === "HUMAN PRESCRIPTION DRUG") rx += t.count;
    }
    for (const t of b.results ?? []) {
      const k = String(t.term).toLowerCase();
      brandCounts.set(k, (brandCounts.get(k) ?? 0) + t.count);
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
  // Keep it short: shelf names plus one runner-up, else the top 3 (avoids regional/odd brands like "Bactimicina").
  const pick = commonKeys.length ? [...commonKeys, ...rest.slice(0, 1)] : rest.slice(0, 3);
  // A brand sold only as extended-release is a different product from a plain tablet (e.g. Glumetza vs metformin 500).
  const isER = (n: string) => /Extended Release|\b(12|24) HR\b/i.test(n);
  const anyPlain = prods.some((p) => !isER(p.name));
  const erOnly = (k: string) => {
    const mine = prods.filter((p) => p.tty === "SBD" && p.name.toLowerCase().endsWith(`[${k}]`));
    return anyPlain && mine.length > 0 && mine.every((p) => isER(p.name));
  };
  return [...new Set(pick)].map((k) => byKey.get(k)! + (erOnly(k) ? " (extended-release)" : ""));
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

    const alternatives = ALTERNATIVES[ing.name];
    if (WITHDRAWN[ing.name]) return { ...matched, status: "not_sold", note: WITHDRAWN[ing.name], alternatives };

    const everything = await products(ing.name);
    const all = everything.filter((p) => FORM_RE[form].test(p.name));
    const single = all.filter((p) => !p.name.includes(" / "));
    const combinationOnly = single.length === 0 && all.length > 0;
    const pool = combinationOnly ? all : single;
    const { otc, rx, brandCounts } = pool.length ? await fda(pool.map((p) => p.rxcui)) : { otc: 0, rx: 0, brandCounts: new Map() };

    const status: SaleStatus = otc > 0 ? "otc" : rx > 0 ? "rx" : "not_sold";
    if (status === "not_sold") {
      // Sold in another form? Then it's not a dead end, just the wrong type (e.g. acetaminophen picked as "inhaler").
      const others = (["oral", "inhaled", "topical", "eye"] as Form[]).filter((f) => f !== form);
      const soldAsForms: Form[] = [];
      await Promise.all(
        others.map(async (f) => {
          const ids = everything.filter((p) => FORM_RE[f].test(p.name)).map((p) => p.rxcui);
          if (!ids.length) return;
          const r = await fda(ids);
          if (r.otc + r.rx > 0) soldAsForms.push(f);
        }),
      );
      if (soldAsForms.length) {
        return { ...matched, status, soldAsForms, note: `${ing.label[0].toUpperCase()}${ing.label.slice(1)} is sold in the US, but not as ${FORM_WORDS[form]}. It is sold as ${soldAsForms.map((f) => FORM_WORDS[f]).join(" or ")}.` };
      }
      return {
        ...matched,
        status,
        alternatives,
        note: `We found ${query} in the drug database, so it's not a spelling mistake. The US just doesn't sell any medicine with ${ing.label} in it.`,
      };
    }
    const usStrengths = [...new Set(single.filter((p) => p.tty === "SCD").map((p) => p.name.replace(/^.*?(?=\d)/, "")))].sort();
    // RxNorm keeps concepts nobody sells (e.g. aspirin 75 MG). Count a strength only if openFDA lists it.
    let sameStrengthInUS: boolean | undefined;
    if (strengthMg != null && single.length) {
      const re = new RegExp(`(^|\\s)${strengthMg} MG\\b`);
      const ids = single.filter((p) => re.test(p.name.replace(/^.*?(?=\d)/, ""))).map((p) => p.rxcui);
      const listed = ids.length ? await fda(ids) : { otc: 0, rx: 0 };
      sameStrengthInUS = listed.otc + listed.rx > 0;
    }

    return {
      ...matched,
      status,
      someFormsRx: status === "otc" && rx > 0,
      combinationOnly,
      brands: rankBrands([ing.name, ing.label], pool, brandCounts),
      usStrengths,
      sameStrengthInUS,
      alternatives: status === "rx" ? alternatives : undefined,
      note: combinationOnly ? "In the US this is only sold mixed with other drugs." : undefined,
    };
  } catch (e) {
    console.error("match lookup failed:", (e as Error).message);
    return { ...base, result: "error", status: "unknown", note: "Lookup failed. Try again; we won't guess." };
  }
}

// ---------- Tools the AI can call (v2, issue #6). Each returns only facts from RxNorm / openFDA. ----------

async function usIngredient(name: string): Promise<string | undefined> {
  const q = name.trim().toLowerCase();
  const id = (await findRxcui(q)) ?? (SALT_SUFFIX.test(q) ? await findRxcui(q.replace(SALT_SUFFIX, "")) : undefined);
  if (!id) return undefined;
  return (await toIngredient(id))?.name;
}

const brandOf = (p: Product) => (p.tty === "SBD" ? p.name.match(/\[(.+)\]$/)?.[1]?.trim() : undefined);

// Is there one US product that contains exactly these ingredients? (e.g. amoxicillin + clavulanate → Augmentin)
export async function findCombination(names: string[], mgs: (number | undefined)[] = []) {
  try {
    const us = await Promise.all(names.map(usIngredient));
    if (us.some((u) => !u)) return { found: false, reason: `No US ingredient for: ${names.filter((_, i) => !us[i]).join(", ")}` };
    const ings = us as string[];
    const j = await getJSON(`${RXNAV}/drugs.json?name=${enc([...ings].sort().join(" / "))}`); // RxNorm names combos alphabetically
    const all: Product[] = (j.drugGroup?.conceptGroup ?? [])
      .filter((g: J) => g.tty === "SCD" || g.tty === "SBD")
      .flatMap((g: J) => (g.conceptProperties ?? []).map((p: J) => ({ rxcui: p.rxcui, name: p.name, tty: g.tty })))
      .filter((p: Product) => FORM_RE.oral.test(p.name) && p.name.split(" / ").length === ings.length && ings.every((i) => p.name.toLowerCase().includes(i)));
    if (!all.length) return { found: false, usIngredients: ings, reason: "The US has no single product with exactly these ingredients." };
    const { otc, rx, brandCounts } = await fda(all.map((p) => p.rxcui));
    if (otc + rx === 0) return { found: false, usIngredients: ings, reason: "Combination exists in RxNorm but no human US listing (not sold)." };
    // Same strength as the Indian product? Check each ingredient's mg appears in one listed product.
    const want = ings.map((ing, i) => (mgs[i] ? `${ing} ${mgs[i]} MG` : undefined));
    const match = want.every((w) => !w) ? undefined : all.find((p) => p.tty === "SCD" && want.every((w) => !w || p.name.toLowerCase().includes(w.toLowerCase())));
    const mf = match ? await fda([match.rxcui]) : undefined;
    const matchListed = !!mf && mf.otc + mf.rx > 0;
    return {
      found: true,
      usIngredients: ings,
      status: otc > 0 ? "otc" : "rx",
      brands: rankBrands(ings, all, brandCounts),
      sameStrengthInUS: want.every((w) => !w) ? undefined : matchListed,
      sameStrengthProduct: matchListed ? match!.name : undefined,
    };
  } catch (e) {
    console.error("findCombination failed:", (e as Error).message);
    return { found: false, reason: "Lookup failed; don't guess." };
  }
}

// Which US products have this ingredient at this strength, and are they actually listed? (e.g. acetaminophen 650 → Tylenol 8 HR)
export async function productsAtStrength(name: string, mg: number) {
  try {
    const ing = await usIngredient(name);
    if (!ing) return { found: false, reason: "No US ingredient for this name." };
    const re = new RegExp(`(^|\\s)${mg} MG\\b`);
    const cands = (await products(ing)).filter((p) => FORM_RE.oral.test(p.name) && !p.name.includes(" / ") && re.test(p.name)).slice(0, 12);
    // In parallel (was 12 lookups one after another, the slowest part of the AI summary).
    const checked = await Promise.all(cands.map(async (p) => ({ p, f: await fda([p.rxcui]) })));
    const listed = checked
      .filter(({ f }) => f.otc + f.rx > 0)
      .map(({ p, f }) => ({ product: p.name, brand: brandOf(p), status: f.otc > 0 ? "otc" : "rx", extendedRelease: /Extended Release|\b\d+ HR\b/i.test(p.name) }));
    return listed.length ? { found: true, usIngredient: ing, products: listed } : { found: false, usIngredient: ing, reason: `No listed US oral product at ${mg} mg.` };
  } catch (e) {
    console.error("productsAtStrength failed:", (e as Error).message);
    return { found: false, reason: "Lookup failed; don't guess." };
  }
}
