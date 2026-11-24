// Hand-checked list of common Indian brands → ingredients and strength per tablet.
// Used for type-ahead (instant, no AI call) and as a fast path in /api/read.
// Only brands whose label ingredients we are sure of. Anything else goes to the AI, then the user checks the strip.

export const slugOf = (brand: string) => brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const DESC_WORD = /^(tablets?|capsules?|syrup|suspension|oral|drops?|cream|gel|ointment|lotion|inhaler|rotacaps?|respules|solution|powder|sachet|granules|spray|dt|md|sr|er|xr|cr|pr|mr|od|kid|kids|chewable|dispersible|effervescent|soft|gelatin|film|coated|new|paediatric|pediatric|junior|infant|\(paediatric\)|liquid|elixir|sugar|free)$/;
// "Allegra 120mg Tablet" and "allegra 120" share a key: drop trailing form words and "mg", keep letters and digits.
export function baseKey(name: string) {
  const words = name.toLowerCase().replace(/(\d)\s*mg\b/g, "$1").split(/\s+/);
  while (words.length > 1 && DESC_WORD.test(words[words.length - 1])) words.pop();
  return words.join("").replace(/[^a-z0-9]/g, "");
}

export type KnownBrand = { brand: string; salts: { name: string; mg: number }[] };

export const BRANDS: KnownBrand[] = [
  { brand: "Dolo 650", salts: [{ name: "paracetamol", mg: 650 }] },
  { brand: "Crocin Advance", salts: [{ name: "paracetamol", mg: 500 }] },
  { brand: "Calpol 500", salts: [{ name: "paracetamol", mg: 500 }] },
  { brand: "Calpol 650", salts: [{ name: "paracetamol", mg: 650 }] },
  { brand: "Combiflam", salts: [{ name: "ibuprofen", mg: 400 }, { name: "paracetamol", mg: 325 }] },
  { brand: "Brufen 400", salts: [{ name: "ibuprofen", mg: 400 }] },
  { brand: "Saridon", salts: [{ name: "paracetamol", mg: 250 }, { name: "propyphenazone", mg: 150 }, { name: "caffeine", mg: 50 }] },
  { brand: "Zerodol-P", salts: [{ name: "aceclofenac", mg: 100 }, { name: "paracetamol", mg: 325 }] },
  { brand: "Nise 100", salts: [{ name: "nimesulide", mg: 100 }] },
  { brand: "Meftal 500", salts: [{ name: "mefenamic acid", mg: 500 }] },
  { brand: "Meftal Spas", salts: [{ name: "mefenamic acid", mg: 250 }, { name: "dicyclomine", mg: 10 }] },
  { brand: "Drotin 40", salts: [{ name: "drotaverine", mg: 40 }] },
  { brand: "Ecosprin 75", salts: [{ name: "aspirin", mg: 75 }] },
  { brand: "Pan 40", salts: [{ name: "pantoprazole", mg: 40 }] },
  { brand: "Pantocid 40", salts: [{ name: "pantoprazole", mg: 40 }] },
  { brand: "Pan-D", salts: [{ name: "pantoprazole", mg: 40 }, { name: "domperidone", mg: 30 }] },
  { brand: "Omez 20", salts: [{ name: "omeprazole", mg: 20 }] },
  { brand: "Razo 20", salts: [{ name: "rabeprazole", mg: 20 }] },
  { brand: "Nexpro 40", salts: [{ name: "esomeprazole", mg: 40 }] },
  { brand: "Rantac 150", salts: [{ name: "ranitidine", mg: 150 }] },
  { brand: "Aciloc 150", salts: [{ name: "ranitidine", mg: 150 }] },
  { brand: "Famocid 20", salts: [{ name: "famotidine", mg: 20 }] },
  { brand: "Emeset 4", salts: [{ name: "ondansetron", mg: 4 }] },
  { brand: "Ondem 4", salts: [{ name: "ondansetron", mg: 4 }] },
  { brand: "Eldoper", salts: [{ name: "loperamide", mg: 2 }] },
  { brand: "Allegra 120", salts: [{ name: "fexofenadine", mg: 120 }] },
  { brand: "Allegra 180", salts: [{ name: "fexofenadine", mg: 180 }] },
  { brand: "Cetzine", salts: [{ name: "cetirizine", mg: 10 }] },
  { brand: "Okacet", salts: [{ name: "cetirizine", mg: 10 }] },
  { brand: "Avil 25", salts: [{ name: "pheniramine", mg: 25 }] },
  { brand: "Montair 10", salts: [{ name: "montelukast", mg: 10 }] },
  { brand: "Montair LC", salts: [{ name: "montelukast", mg: 10 }, { name: "levocetirizine", mg: 5 }] },
  { brand: "Azithral 500", salts: [{ name: "azithromycin", mg: 500 }] },
  { brand: "Azee 500", salts: [{ name: "azithromycin", mg: 500 }] },
  { brand: "Augmentin 625 Duo", salts: [{ name: "amoxicillin", mg: 500 }, { name: "clavulanic acid", mg: 125 }] },
  { brand: "Mox 500", salts: [{ name: "amoxicillin", mg: 500 }] },
  { brand: "Novamox 500", salts: [{ name: "amoxicillin", mg: 500 }] },
  { brand: "Taxim-O 200", salts: [{ name: "cefixime", mg: 200 }] },
  { brand: "Zifi 200", salts: [{ name: "cefixime", mg: 200 }] },
  { brand: "Ciplox 500", salts: [{ name: "ciprofloxacin", mg: 500 }] },
  { brand: "Norflox 400", salts: [{ name: "norfloxacin", mg: 400 }] },
  { brand: "Flagyl 400", salts: [{ name: "metronidazole", mg: 400 }] },
  { brand: "Metrogyl 400", salts: [{ name: "metronidazole", mg: 400 }] },
  { brand: "Glycomet 500", salts: [{ name: "metformin", mg: 500 }] },
  { brand: "Telma 40", salts: [{ name: "telmisartan", mg: 40 }] },
  { brand: "Amlong 5", salts: [{ name: "amlodipine", mg: 5 }] },
  { brand: "Lasix 40", salts: [{ name: "furosemide", mg: 40 }] },
];

// Ingredient names people type: Indian (INN) names plus common US names.
export const INGREDIENTS = [
  "paracetamol", "acetaminophen", "ibuprofen", "aceclofenac", "nimesulide", "diclofenac", "naproxen", "aspirin",
  "mefenamic acid", "dicyclomine", "drotaverine", "propyphenazone", "caffeine",
  "pantoprazole", "omeprazole", "rabeprazole", "esomeprazole", "domperidone", "ranitidine", "famotidine",
  "ondansetron", "prochlorperazine", "loperamide",
  "cetirizine", "levocetirizine", "fexofenadine", "loratadine", "pheniramine", "chlorpheniramine", "diphenhydramine",
  "montelukast", "salbutamol", "albuterol", "phenylephrine", "ambroxol", "guaifenesin", "dextromethorphan",
  "amoxicillin", "clavulanic acid", "azithromycin", "cefixime", "ciprofloxacin", "norfloxacin", "ofloxacin", "metronidazole", "tinidazole",
  "metformin", "telmisartan", "amlodipine", "furosemide", "levothyroxine",
];

export type Suggestion = { label: string; kind: "brand" | "ingredient"; detail?: string; brand?: KnownBrand };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Score: 0 = starts with, 1 = a word starts with, 2 = close misspelling of the start. Lower is better.
function score(q: string, label: string): number | undefined {
  const n = norm(label);
  if (n.startsWith(q)) return 0;
  if (label.toLowerCase().split(/[\s-]+/).some((w) => norm(w).startsWith(q))) return 1;
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    // Compare against the same-length start, and the whole word (catches "combiflame", "acetominophen").
    const best = Math.min(editDistance(q, n.slice(0, q.length)), editDistance(q, n));
    if (best <= allowed) return 2;
  }
  return undefined;
}

export function findBrand(text: string): KnownBrand | undefined {
  const q = norm(text);
  return BRANDS.find((b) => norm(b.brand) === q);
}

export function suggest(text: string, limit = 6): Suggestion[] {
  const q = norm(text);
  if (!q) return [];
  const out: { s: Suggestion; score: number }[] = [];
  for (const b of BRANDS) {
    const sc = score(q, b.brand);
    if (sc != null) out.push({ score: sc, s: { label: b.brand, kind: "brand", brand: b, detail: b.salts.map((x) => `${x.name} ${x.mg} mg`).join(" + ") } });
  }
  for (const i of INGREDIENTS) {
    const sc = score(q, i);
    if (sc != null) out.push({ score: sc + 0.5, s: { label: i, kind: "ingredient", detail: "ingredient" } });
  }
  return out.sort((a, b) => a.score - b.score || a.s.label.length - b.s.label.length).slice(0, limit).map((x) => x.s);
}

export function suggestIngredient(text: string, limit = 5): string[] {
  const q = norm(text);
  if (!q) return [];
  return INGREDIENTS.map((i) => ({ i, sc: score(q, i) }))
    .filter((x) => x.sc != null && norm(x.i) !== q)
    .sort((a, b) => a.sc! - b.sc!)
    .slice(0, limit)
    .map((x) => x.i);
}
