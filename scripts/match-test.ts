// Riskiest-part test: run every salt in eval/medicines.json through the matcher.
// Writes eval/match-results.csv for a by-hand check of every row.
import { readFileSync, writeFileSync } from "node:fs";
import { matchDrug } from "../src/lib/match.ts";

type Salt = { name: string; mg?: number; form?: "oral" | "inhaled"; expect: string; status: string };
const meds: { brand: string; salts: Salt[] }[] = JSON.parse(readFileSync("eval/medicines.json", "utf8"));

const rows = [["brand", "salt", "mg", "expected_us", "got_us", "expected_status", "got_status", "name_ok", "status_ok", "same_strength", "brands", "note", "hand_check"]];
let n = 0, nameOk = 0, statusOk = 0;

for (const m of meds) {
  for (const s of m.salts) {
    const r = await matchDrug(s.name, s.mg, s.form);
    const okName = s.expect.split("|").includes((r.usName ?? "").toLowerCase());
    const okStatus = r.status === s.status;
    n++; if (okName) nameOk++; if (okStatus) statusOk++;
    const mark = okName && okStatus ? "  " : "✗ ";
    console.log(`${mark}${m.brand.padEnd(18)} ${s.name.padEnd(24)} → ${(r.usName ?? r.suggestion ?? "-").padEnd(18)} ${r.status.padEnd(9)}${r.someFormsRx ? "(+Rx forms)" : ""}${r.combinationOnly ? "(combo only)" : ""} ${r.brands.slice(0, 3).join(", ")}${r.sameStrengthInUS === false ? `  [${s.mg} mg not sold in US]` : ""}`);
    rows.push([m.brand, s.name, String(s.mg ?? ""), s.expect, r.usName ?? r.suggestion ?? "", s.status, r.status, String(okName), String(okStatus), String(r.sameStrengthInUS ?? ""), r.brands.join("; "), r.note ?? "", ""]);
  }
}

const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
writeFileSync("eval/match-results.csv", csv + "\n");
console.log(`\n${n} salts · US name ${nameOk}/${n} · status ${statusOk}/${n} · wrote eval/match-results.csv`);
