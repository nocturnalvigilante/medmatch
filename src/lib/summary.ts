// Deterministic "what to ask for" for a known brand, built only from RxNorm/openFDA facts (no AI).
// Used by the SEO brand pages (/medicine/[slug]) and the pharmacist card.
import { matchDrug, findCombination, type DrugMatch } from "@/lib/match";
import { BRANDS, slugOf, type KnownBrand } from "@/lib/brands";

export { slugOf };
export const brandBySlug = (slug: string) => BRANDS.find((b) => slugOf(b.brand) === slug);

export type BrandSummary = {
  brand: KnownBrand;
  matches: DrugMatch[];
  combo?: Awaited<ReturnType<typeof findCombination>>;
  askFor: string; // one line for the pharmacist
  status: "otc" | "rx" | "not_sold" | "mixed" | "unknown";
  warnings: string[];
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function summarize(brand: KnownBrand): Promise<BrandSummary> {
  const matches = await Promise.all(brand.salts.map((s) => matchDrug(s.name, s.mg, "oral")));
  const multi = brand.salts.length > 1;
  const combo = multi ? await findCombination(brand.salts.map((s) => s.name), brand.salts.map((s) => s.mg)) : undefined;

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

  return { brand, matches, combo, askFor, status, warnings };
}

export function relatedBrands(brand: KnownBrand, limit = 6) {
  const mine = new Set(brand.salts.map((s) => s.name));
  return BRANDS.filter((b) => b !== brand && b.salts.some((s) => mine.has(s.name))).slice(0, limit);
}
