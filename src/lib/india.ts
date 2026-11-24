// Server-only index of ~209k Indian medicines (still sold; oral, inhaled, topical, eye) with their ingredients.
// Source: Indian Medicine Dataset (MIT), https://github.com/junioralive/Indian-Medicine-Dataset, built by scripts/build-india.py.
// Cross-check: on our hand-checked brands, the dataset's ingredients agreed 52/53 times (eval/dataset-check.json).
//
// Cold-start speed: data/india/<letter>.json files, each pre-sorted by letters-and-digits key with the base key precomputed,
// so a search for "dolo" parses only d.json (~1/20 of the data) and builds nothing.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Form } from "@/lib/match";
import { baseKey, slugOf } from "@/lib/brands";
import { parseDose } from "@/lib/dose";

export { baseKey };
export const slugify = slugOf;

// [name, form code, [[ingredient, strength]], maker, full (1 = complete list, 0 = may miss a 3rd ingredient), rank, base key]
type Row = [string, "o" | "i" | "t" | "e" | "a", [string, string][], string, 0 | 1, number, string];

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
const DIR = path.join(process.cwd(), "data/india");
// User test: 436 names in the source are in capitals ("PARACETANAL 170MG SUPPOSITORY"). Show them like the rest.
const tidy = (name: string) => (/[a-z]/.test(name) ? name : name.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, p, c) => p + c.toUpperCase()));

function toMed(r: Row): IndiaMed {
  return {
    form: FORM[r[1]],
    name: tidy(r[0]),
    salts: r[2].map(([n, st]) => ({ name: n, strength: st, mg: parseDose(st) })), // "50mcg" → 0.05 mg (was dropped)
    maker: r[3],
    complete: r[4] === 1,
    rank: r[5],
    slug: slugify(r[0]),
  };
}

type Shard = { rows: Row[]; keys: string[]; byBase?: Map<string, number[]> };
const shards = new Map<string, Shard>();
function shard(c: string): Shard {
  const id = /[a-z]/.test(c) ? c : "0";
  let s = shards.get(id);
  if (!s) {
    let rows: Row[] = [];
    try {
      rows = JSON.parse(readFileSync(path.join(DIR, `${id}.json`), "utf8"));
    } catch {}
    s = { rows, keys: rows.map((r) => flat(r[0])) };
    shards.set(id, s);
  }
  return s;
}

function lowerBound(keys: string[], q: string) {
  let lo = 0, hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Rows whose key starts with q, most popular first.
function prefix(s: Shard, q: string, limit: number): Row[] {
  const out: Row[] = [];
  for (let j = lowerBound(s.keys, q); j < s.keys.length && s.keys[j].startsWith(q) && out.length < 400; j++) out.push(s.rows[j]);
  return out.sort((a, b) => a[5] - b[5]).slice(0, limit);
}

/** Every variant whose name matches what was typed ("montair lc" → Tablet, Kid Tablet DT, Kid Syrup). Most popular first. */
export function findVariants(text: string, wide = false): IndiaMed[] {
  const k = baseKey(text);
  if (!k) return [];
  const s = shard(k[0]);
  if (!s.byBase) {
    const m = new Map<string, number[]>();
    s.rows.forEach((r, i) => {
      const list = m.get(r[6]);
      if (list) list.push(i);
      else m.set(r[6], [i]);
    });
    s.byBase = m;
  }
  let hits = (s.byBase.get(k) ?? []).map((i) => s.rows[i]);
  if (wide || !hits.length) hits = [...new Set([...hits, ...prefix(s, k, wide ? 20 : 12)])];
  return hits.map(toMed).sort((a, b) => a.rank - b.rank);
}

export function bySlug(slug: string): IndiaMed | undefined {
  const k = slug.replace(/-/g, "");
  if (!k) return undefined;
  const s = shard(k[0]);
  for (let j = lowerBound(s.keys, k); j < s.keys.length && s.keys[j] === k; j++) if (slugify(s.rows[j][0]) === slug) return toMed(s.rows[j]);
  return undefined;
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
  const q = flat(text);
  if (q.length < 2) return [];
  const s = shard(q[0]);
  const hits = prefix(s, q, limit);
  if (hits.length < 3 && q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    const seen = new Set(hits);
    const fuzzy: { r: Row; d: number }[] = [];
    for (let j = 0; j < s.rows.length; j++) {
      if (seen.has(s.rows[j])) continue;
      const d = editDistance(q, s.keys[j].slice(0, q.length));
      if (d <= allowed) fuzzy.push({ r: s.rows[j], d });
    }
    fuzzy.sort((a, b) => a.d - b.d || a.r[5] - b.r[5]);
    for (const f of fuzzy) {
      if (hits.length >= limit) break;
      hits.push(f.r);
    }
  }
  return hits.map(toMed);
}

/** The most popular oral medicines per letter, for the sitemap and A–Z page (names only; no shard loading). */
let top: string[] | undefined;
export function topMedicines(perLetter = 150): { name: string; slug: string }[] {
  top ??= JSON.parse(readFileSync(path.join(DIR, "top.json"), "utf8")) as string[];
  const count = new Map<string, number>();
  const out: { name: string; slug: string }[] = [];
  for (const name of top) {
    const c = flat(name)[0] ?? "0";
    const n = count.get(c) ?? 0;
    if (n >= perLetter) continue;
    count.set(c, n + 1);
    out.push({ name, slug: slugify(name) });
  }
  return out;
}

/** Same ingredients, other Indian brands starting with the same letter (keeps the page to one shard). */
export function sameIngredients(med: { name: string; salts: { name: string }[] }, limit = 6): IndiaMed[] {
  const s = shard(flat(med.name)[0] ?? "0");
  const key = med.salts.map((x) => x.name).sort().join("+");
  const out: IndiaMed[] = [];
  for (const r of s.rows) {
    if (tidy(r[0]) === med.name || r[1] !== "o") continue;
    if (r[2].map((x) => x[0]).sort().join("+") === key) {
      out.push(toMed(r));
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}
