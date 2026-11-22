// Server-only index of ~209k Indian medicines (still sold; oral, inhaled, topical, eye) with their ingredients.
// Source: Indian Medicine Dataset (MIT), https://github.com/junioralive/Indian-Medicine-Dataset, built by scripts/build-india.py.
// Cross-check: on our hand-checked brands, the dataset's ingredients agreed 52/53 times (eval/dataset-check.json).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Form } from "@/lib/match";
import { baseKey, slugOf } from "@/lib/brands";

export { baseKey };
export const slugify = slugOf;

// [name, form code, [[ingredient, strength]], manufacturer, full (1 = complete list, 0 = may miss a 3rd ingredient), rank]
type Row = [string, "o" | "i" | "t" | "e" | "a", [string, string][], string, 0 | 1, number];

export type IndiaMed = {
  name: string;
  form: Form;
  salts: { name: string; mg?: number; strength: string }[];
  maker: string;
  complete: boolean; // false: the source only lists two ingredients; the strip may have more
  rank: number; // lower = more popular (within its first letter)
  slug: string;
};

const FORM: Record<Row[1], Form> = { o: "oral", i: "inhaled", t: "topical", e: "eye", a: "any" };
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function toMed(r: Row): IndiaMed {
  return {
    name: r[0],
    form: FORM[r[1]],
    salts: r[2].map(([n, st]) => {
      const m = st.match(/^([\d.]+)mg$/);
      return { name: n, strength: st, mg: m ? Number(m[1]) : undefined };
    }),
    maker: r[3],
    complete: r[4] === 1,
    rank: r[5],
    slug: slugify(r[0]),
  };
}

type Index = { rows: Row[]; byKey: Map<string, number[]>; bySlug: Map<string, number>; sorted: { k: string; i: number }[] };
let idx: Index | undefined;
function load(): Index {
  if (idx) return idx;
  const rows: Row[] = JSON.parse(readFileSync(path.join(process.cwd(), "data/india.json"), "utf8"));
  const byKey = new Map<string, number[]>();
  const bySlug = new Map<string, number>();
  const sorted: { k: string; i: number }[] = [];
  rows.forEach((r, i) => {
    const k = baseKey(r[0]);
    const list = byKey.get(k);
    if (list) list.push(i);
    else byKey.set(k, [i]);
    bySlug.set(slugify(r[0]), i);
    sorted.push({ k: flat(r[0]), i });
  });
  sorted.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  idx = { rows, byKey, bySlug, sorted };
  return idx;
}

/** Every variant whose name matches what was typed ("montair lc" → Tablet, Kid Tablet DT, Kid Syrup). Most popular first. */
export function findVariants(text: string, wide = false): IndiaMed[] {
  const { rows, byKey, sorted } = load();
  const k = baseKey(text);
  if (!k) return [];
  let hits = byKey.get(k) ?? [];
  if (wide) hits = [...new Set([...hits, ...prefix(sorted, k, 20)])];
  if (!hits.length) {
    // Same brand with extra words on the strip name ("montairlc" → "montairlckidsyrup"): names that start with it.
    hits = prefix(sorted, k, 12);
  }
  return hits.map((i) => toMed(rows[i])).sort((a, b) => a.rank - b.rank);
}

export function bySlug(slug: string): IndiaMed | undefined {
  const { rows, bySlug } = load();
  const i = bySlug.get(slug);
  return i == null ? undefined : toMed(rows[i]);
}

function prefix(sorted: { k: string; i: number }[], q: string, limit: number): number[] {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].k < q) lo = mid + 1;
    else hi = mid;
  }
  const out: number[] = [];
  for (let j = lo; j < sorted.length && sorted[j].k.startsWith(q) && out.length < 400; j++) out.push(sorted[j].i);
  return out.slice(0, 400).sort((a, b) => a - b).slice(0, limit); // index order = popularity rank
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Type-ahead over the whole dataset: prefix matches by popularity, then close misspellings ("combiflme"). */
export function search(text: string, limit = 8): IndiaMed[] {
  const { rows, sorted } = load();
  const q = flat(text);
  if (q.length < 2) return [];
  const hits = prefix(sorted, q, limit);
  if (hits.length < 3 && q.length >= 4) {
    // Misspelling: compare against the start of names beginning with the same letter.
    const allowed = q.length >= 7 ? 2 : 1;
    const seen = new Set(hits);
    const fuzzy: { i: number; d: number }[] = [];
    const first = prefixRange(sorted, q[0]);
    for (let j = first[0]; j < first[1]; j++) {
      const { k, i } = sorted[j];
      if (seen.has(i)) continue;
      const d = editDistance(q, k.slice(0, q.length));
      if (d <= allowed) fuzzy.push({ i, d });
    }
    fuzzy.sort((a, b) => a.d - b.d || a.i - b.i);
    for (const f of fuzzy) {
      if (hits.length >= limit) break;
      hits.push(f.i);
    }
  }
  return hits.map((i) => toMed(rows[i]));
}

function prefixRange(sorted: { k: string }[], c: string): [number, number] {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].k < c) lo = mid + 1;
    else hi = mid;
  }
  let end = lo;
  while (end < sorted.length && sorted[end].k.startsWith(c)) end++;
  return [lo, end];
}

/** The most popular medicines per starting letter, for the sitemap. */
export function topMedicines(perLetter = 150): IndiaMed[] {
  const { rows } = load();
  const count = new Map<string, number>();
  const out: IndiaMed[] = [];
  for (const r of rows) {
    if (r[1] !== "o") continue;
    const c = r[0][0].toLowerCase();
    const n = count.get(c) ?? 0;
    if (n >= perLetter) continue;
    count.set(c, n + 1);
    out.push(toMed(r));
  }
  return out;
}

/** Same ingredients, other Indian brands (for "similar medicines" links). */
export function sameIngredients(med: IndiaMed, limit = 6): IndiaMed[] {
  const { rows } = load();
  const key = med.salts.map((s) => s.name).sort().join("+");
  const out: IndiaMed[] = [];
  for (const r of rows) {
    if (r[0] === med.name || r[1] !== "o") continue;
    if (r[2].map((s) => s[0]).sort().join("+") === key) {
      out.push(toMed(r));
      if (out.length >= limit) break;
    }
  }
  return out;
}
