// End-to-end reading test on the PRODUCTION path (checked list → 209k Indian dataset → AI), unlike ai-test.ts which isolates the AI.
// For each hand-checked brand: did we get the right ingredients (or a "which one?" picker that contains them), and from where?
// Writes eval/read-summary.json. Run against a local server: BASE=http://localhost:3000 node scripts/read-test.ts
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
type Salt = { name: string; mg?: number };
const meds: { brand: string; salts: Salt[] }[] = JSON.parse(readFileSync("eval/medicines.json", "utf8"));
const SYN: [string, string][] = [["amoxycillin", "amoxicillin"], ["frusemide", "furosemide"], ["thyroxine", "levothyroxine"], ["acetaminophen", "paracetamol"]];
const norm = (s: string) => {
  let n = s.toLowerCase();
  for (const [a, b] of SYN) n = n.replace(a, b);
  return n.replace(/\b(sodium|potassium|hydrochloride|dihydrochloride|maleate|ip|bp)\b/g, "").replace(/[^a-z]/g, "").slice(0, 6);
};
const same = (a: Salt[], b: Salt[]) => a.length === b.length && a.map((x) => norm(x.name)).sort().join() === b.map((x) => norm(x.name)).sort().join();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const bySource: Record<string, number> = {};
let ok = 0, picker = 0, needsTick = 0;
const ms: number[] = [];
for (const m of meds) {
  const t = Date.now();
  const r = await fetch(`${BASE}/api/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: m.brand }) });
  const j = await r.json().catch(() => ({}));
  ms.push(Date.now() - t);
  const src = j.variants ? "dataset-picker" : String(j.source ?? "ai");
  bySource[src] = (bySource[src] ?? 0) + 1;
  let good = false;
  if (j.variants) {
    picker++;
    good = j.variants.some((v: { salts: Salt[] }) => same(v.salts, m.salts));
  } else good = same(j.salts ?? [], m.salts);
  if (!j.variants && j.confidence !== "high") needsTick++;
  if (good) ok++;
  console.log(`${good ? "  " : "✗ "}${m.brand.padEnd(18)} [${src}${j.confidence && !j.variants ? `, ${j.confidence}` : ""}] ${j.variants ? `${j.variants.length} options` : (j.salts ?? []).map((s: Salt) => s.name).join(" + ")}`);
  if (src === "ai") await sleep(4500);
}
const sorted = [...ms].sort((a, b) => a - b);
const summary = { brands: meds.length, right: ok, pickerShown: picker, askedToConfirm: needsTick, bySource, medianSeconds: sorted[Math.floor(sorted.length / 2)] / 1000, ranAt: new Date().toISOString() };
writeFileSync("eval/read-summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(`\nright ${ok}/${meds.length} · sources ${JSON.stringify(bySource)} · picker ${picker} · median ${summary.medianSeconds}s`);
