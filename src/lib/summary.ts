// Deterministic "what to ask for" for a known brand, built only from RxNorm/openFDA facts (no AI).
// Used by the SEO brand pages (/medicine/[slug]) and the pharmacist card.
import { matchDrug, findCombination, usBrandIngredients, type DrugMatch, type Form } from "@/lib/match";
import { BRANDS, slugOf } from "@/lib/brands";
import { bySlug, sameIngredients } from "@/lib/india";
import { symptomPlan, type SymptomPlan } from "@/lib/symptoms";

export { slugOf };

// A medicine page can come from our hand-checked list (verified) or the 209k-item Indian dataset.
export type Med = { brand: string; slug: string; salts: { name: string; mg?: number; strength?: string }[]; form: Form; source: "checked" | "dataset"; complete: boolean; maker?: string };

export function brandBySlug(slug: string): Med | undefined {
  const k = BRANDS.find((b) => slugOf(b.brand) === slug);
  if (k) return { brand: k.brand, slug, salts: k.salts.map((s) => ({ ...s, strength: `${s.mg}mg` })), form: "oral", source: "checked", complete: true };
  const d = bySlug(slug);
  if (d) return { brand: d.name, slug, salts: d.salts, form: d.form, source: "dataset", complete: d.complete, maker: d.maker };
  return undefined;
}

export const describe = (m: Med) => m.salts.map((s) => `${s.name}${s.strength ? ` ${s.strength}` : ""}`).join(" + ");

export type BrandSummary = {
  brand: Med;
  matches: DrugMatch[];
  combo?: Awaited<ReturnType<typeof findCombination>>;
  askFor: string; // one line for the pharmacist
  status: "otc" | "rx" | "not_sold" | "mixed" | "unknown";
  warnings: string[];
  symptoms?: SymptomPlan;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function summarize(brand: Med): Promise<BrandSummary> {
  const matches = await Promise.all(brand.salts.map((s) => matchDrug(s.name, s.mg, brand.form)));
  const multi = brand.salts.length > 1;
  const combo = multi && brand.form === "oral" ? await findCombination(brand.salts.map((s) => s.name), brand.salts.map((s) => s.mg)) : undefined;

  const statuses = new Set(matches.map((m) => m.status));
  const status: BrandSummary["status"] = statuses.size === 1 ? [...statuses][0] : statuses.has("unknown") ? "unknown" : "mixed";

  const warnings: string[] = [];
  let askFor: string;
  const usLine = (m: DrugMatch) => `${m.usName ?? m.query}${m.strengthMg ? ` ${m.strengthMg} mg` : ""}`;
  const statusWord = (m: DrugMatch) => (m.status === "otc" ? "over the counter" : m.status === "rx" ? "needs a prescription" : m.status === "not_sold" ? "not sold" : "couldn't check");

  if (!multi) {
    const m = matches[0];
    if (m.status === "not_sold") askFor = `No US version of ${m.usName ?? m.query}. Ask a pharmacist what to use instead.`;
    else if (m.status === "unknown") askFor = `${cap(m.usName ?? m.query)}. We couldn't confirm US availability right now.`;
    else askFor = `${cap(usLine(m))}${m.brands[0] ? ` (for example ${m.brands[0]})` : ""}, ${m.status === "otc" ? "over the counter" : "needs a prescription"}.`;
  } else if (combo && "found" in combo && combo.found) {
    const names = (combo.usIngredients ?? []).join(" + ");
    askFor = `${names}${combo.brands?.[0] ? ` (for example ${combo.brands[0]})` : ""}, sold as one combined product, ${combo.status === "otc" ? "over the counter" : "needs a prescription"}.`;
    if (combo.sameStrengthInUS === false) warnings.push("The US combination comes in different strengths from the Indian one. Ask the pharmacist which is closest.");
  } else {
    const missing = matches.filter((m) => m.status === "not_sold");
    const sold = matches.filter((m) => m.status === "otc" || m.status === "rx");
    askFor = missing.length
      ? `No exact US version: ${missing.map((m) => m.usName ?? m.query).join(" and ")} ${missing.length > 1 ? "aren't" : "isn't"} sold in the US.${sold.length ? ` ${sold.map((m) => `${cap(usLine(m))} is sold (${statusWord(m)})`).join("; ")}.` : ""} Ask a pharmacist what to use instead.`
      : `No single US product has all of these. The parts are sold separately as ${matches.map((m) => m.usName ?? m.query).join(" and ")}. Ask a pharmacist before combining them.`;
  }

  for (const m of matches) {
    if (m.sameStrengthInUS === false && m.strengthMg) warnings.push(`${cap(m.usName ?? m.query)} ${m.strengthMg} mg isn't a standard US strength. Don't split or double tablets to match it without asking a pharmacist.`);
    if (m.status === "rx") warnings.push(`${cap(m.usName ?? m.query)} needs a US prescription. Student health clinics, urgent care and telehealth can prescribe it.`);
    if (m.status === "not_sold") warnings.push(`${cap(m.usName ?? m.query)} isn't sold in the US.`);
  }
  if (matches.some((m) => m.usName === "acetaminophen"))
    warnings.push("Contains acetaminophen (paracetamol). Many US cold and flu products also contain it, so check labels to avoid taking a double dose.");

  if (!brand.complete) warnings.push("Our source lists two ingredients for this medicine; some versions have a third. Check the back of your strip.");
  const clash = await brandClash(brand.brand, brand.salts.map((x) => x.name));
  if (clash) warnings.unshift(clash);

  const symptoms = await symptomPlan(brand.salts.map((x) => x.name), /syrup|suspension|drops?\b|liquid|linctus|elixir/i.test(brand.brand) || brand.salts.some((x) => /\/\s*\d*\s*ml/i.test(x.strength ?? "")));
  return { brand, matches, combo, askFor, status, warnings, symptoms };
}

// "Benadryl" in India is a 3-ingredient cough syrup; US Benadryl is diphenhydramine alone. Same box name, different medicine.
export async function brandClash(brandName: string, indianSalts: string[]): Promise<string | undefined> {
  const word = brandName.split(/[\s-]/)[0];
  if (word.length < 4) return undefined;
  const us = await usBrandIngredients(word);
  if (!us.length) return undefined;
  const norm = (x: string) => x.toLowerCase().replace(/amoxycillin/, "amoxicillin").replace(/paracetamol/, "acetaminophen").slice(0, 5);
  const mine = indianSalts.map(norm).sort().join("+");
  if (us.some((set) => set.map(norm).sort().join("+") === mine)) return undefined;
  const usText = [...new Set(us.map((set) => set.join(" + ")))].slice(0, 2).join(", or ");
  return `Same name, different medicine: In the US, ${word} means ${usText}. Ask for the ingredients, not the brand name.`;
}

export function relatedBrands(brand: Med, limit = 6): { brand: string; slug: string }[] {
  const mine = new Set(brand.salts.map((s) => s.name));
  const checked = BRANDS.filter((b) => b.brand !== brand.brand && b.salts.some((s) => mine.has(s.name))).map((b) => ({ brand: b.brand, slug: slugOf(b.brand) }));
  const fromData = sameIngredients({ name: brand.brand, salts: brand.salts }, limit).map((d) => ({ brand: d.name, slug: d.slug }));
  return [...checked, ...fromData].slice(0, limit);
}
