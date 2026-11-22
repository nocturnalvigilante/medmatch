// Re-checks only the 50 made-up brands against the current /api/read (with the checked-list rule),
// and adds the result to eval/ai-summary.json as fakeInventedFlaggedFinal.
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const src = readFileSync("scripts/ai-test.ts", "utf8");
const FAKE: string[] = JSON.parse(src.match(/const FAKE = (\[[\s\S]*?\]);/)![1].replace(/,\s*\]/, "]"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let invented = 0, flagged = 0;
for (const brand of FAKE) {
  const r = await fetch(`${BASE}/api/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand, skipList: true }) });
  const j = await r.json().catch(() => ({}));
  if ((j.salts ?? []).length) {
    invented++;
    if (j.confidence !== "high") flagged++;
    console.log(`${j.confidence !== "high" ? "  caught " : "✗ MISSED "} ${brand} → ${(j.salts as { name: string }[]).map((s) => s.name).join(" + ")} [${j.confidence}]`);
  }
  await sleep(4500);
}
const sum = JSON.parse(readFileSync("eval/ai-summary.json", "utf8"));
sum.fakeInventedFinal = invented;
sum.fakeInventedFlaggedFinal = flagged;
sum.finalRanAt = new Date().toISOString();
writeFileSync("eval/ai-summary.json", JSON.stringify(sum, null, 2) + "\n");
console.log(`\nwith the checked-list rule: invented ${invented}, caught ${flagged}/${invented}`);
