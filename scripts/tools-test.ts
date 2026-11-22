// Tool-use eval for /api/advise (AI with tools). For each medicine it checks:
//  1. Tool choice: 2+ ingredients → find_combination was called; a strength on a single ingredient → products_at_strength.
//  2. Agreement: the AI's answer agrees with what find_combination returned (one US product vs sold separately).
//  3. Grounding: every US brand the AI names appears in a tool result (no brands from memory).
// Calls the real route (BASE=http://localhost:3000) and writes eval/tools-results.csv + eval/tools-summary.json.
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
type Salt = { name: string; mg?: number };
const CASES: { brand: string; salts: Salt[] }[] = [
  // 15 combination medicines
  { brand: "Combiflam", salts: [{ name: "ibuprofen", mg: 400 }, { name: "paracetamol", mg: 325 }] },
  { brand: "Pan-D", salts: [{ name: "pantoprazole", mg: 40 }, { name: "domperidone", mg: 30 }] },
  { brand: "Montair LC", salts: [{ name: "montelukast", mg: 10 }, { name: "levocetirizine", mg: 5 }] },
  { brand: "Augmentin 625 Duo", salts: [{ name: "amoxicillin", mg: 500 }, { name: "clavulanic acid", mg: 125 }] },
  { brand: "Meftal Spas", salts: [{ name: "mefenamic acid", mg: 250 }, { name: "dicyclomine", mg: 10 }] },
  { brand: "Zerodol-P", salts: [{ name: "aceclofenac", mg: 100 }, { name: "paracetamol", mg: 325 }] },
  { brand: "Saridon", salts: [{ name: "paracetamol", mg: 250 }, { name: "propyphenazone", mg: 150 }, { name: "caffeine", mg: 50 }] },
  { brand: "Telma-H", salts: [{ name: "telmisartan", mg: 40 }, { name: "hydrochlorothiazide", mg: 12.5 }] },
  { brand: "Telma-AM", salts: [{ name: "telmisartan", mg: 40 }, { name: "amlodipine", mg: 5 }] },
  { brand: "Losar-H", salts: [{ name: "losartan", mg: 50 }, { name: "hydrochlorothiazide", mg: 12.5 }] },
  { brand: "O2", salts: [{ name: "ofloxacin", mg: 200 }, { name: "ornidazole", mg: 500 }] },
  { brand: "Glycomet-GP 1", salts: [{ name: "metformin", mg: 500 }, { name: "glimepiride", mg: 1 }] },
  { brand: "Amlokind-AT", salts: [{ name: "amlodipine", mg: 5 }, { name: "atenolol", mg: 50 }] },
  { brand: "Ecosprin-AV 10", salts: [{ name: "aspirin", mg: 75 }, { name: "atorvastatin", mg: 10 }] },
  { brand: "Norflox-TZ", salts: [{ name: "norfloxacin", mg: 400 }, { name: "tinidazole", mg: 600 }] },
  // 5 single-ingredient medicines (strength matters)
  { brand: "Dolo 650", salts: [{ name: "paracetamol", mg: 650 }] },
  { brand: "Allegra 120", salts: [{ name: "fexofenadine", mg: 120 }] },
  { brand: "Pan 40", salts: [{ name: "pantoprazole", mg: 40 }] },
  { brand: "Drotin 40", salts: [{ name: "drotaverine", mg: 40 }] },
  { brand: "Ecosprin 75", salts: [{ name: "aspirin", mg: 75 }] },
];

// US brands the model might name from memory. Any of these in the answer must also appear in a tool result.
const US_BRANDS = ["Tylenol", "Advil", "Motrin", "Aleve", "Bayer", "Ecotrin", "Prilosec", "Nexium", "Pepcid", "Protonix", "Zyrtec", "Xyzal", "Allegra", "Claritin", "Benadryl", "Singulair", "Augmentin", "Amoxil", "Zofran", "Imodium", "Flagyl", "Cipro", "Glucophage", "Lasix", "Micardis", "Norvasc", "Hyzaar", "Cozaar", "Tenoretic", "Lipitor", "Amaryl", "Combogesic", "Twynsta", "Ponstel", "Bentyl", "Tindamax", "Excedrin"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rows = [["brand", "ingredients", "tools_called", "tool_choice_ok", "combo_found", "agrees_with_tool", "ungrounded_brands", "ask_for", "seconds", "hand_check"]];
let n = 0, choiceOk = 0, comboN = 0, agreeOk = 0, grounded = 0, failed = 0;

for (const c of CASES) {
  const t = Date.now();
  const res = await fetch(`${BASE}/api/advise`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: c.brand, salts: c.salts }) });
  const j = await res.json().catch(() => ({}));
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  n++;
  if (!res.ok || !j.advice) {
    failed++;
    console.log(`✗ ${c.brand.padEnd(18)} route failed: ${j.error ?? res.status}`);
    rows.push([c.brand, c.salts.map((s) => s.name).join(" + "), "", "false", "", "", "", `FAILED: ${j.error ?? res.status}`, secs, ""]);
    await sleep(9000);
    continue;
  }
  const tools: { tool: string; result: unknown }[] = j.tools ?? [];
  const called = tools.map((x) => x.tool);
  const choice = c.salts.length > 1 ? called.includes("find_combination") : called.includes("products_at_strength") || called.includes("lookup_ingredient");
  if (choice) choiceOk++;

  const text = `${j.advice.askFor} ${(j.advice.points ?? []).join(" ")}`;
  const combo = tools.find((x) => x.tool === "find_combination")?.result as { found?: boolean; brands?: string[] } | undefined;
  let agree = "";
  if (c.salts.length > 1 && combo) {
    comboN++;
    const lower = text.toLowerCase();
    const saysOne = (combo.brands ?? []).some((b) => lower.includes(b.toLowerCase().replace(/ \(.*\)$/, ""))) || /\b(combined|combination product|one product|single product|sold together)\b/.test(lower) || /\b[a-z]+ \d+(\.\d+)? ?mg ?\/ ?[a-z]+ \d+(\.\d+)? ?mg\b/.test(lower) || /\b[a-z]+ and [a-z]+ \d+(\.\d+)? ?mg ?\/ ?\d+(\.\d+)? ?mg\b/.test(lower);
    const saysSeparate = /\b(separate|separately|no (us |single |combined )?(combination|product)|not sold|isn't sold|is not sold|no exact)\b/.test(lower);
    const ok = combo.found ? saysOne : saysSeparate;
    agree = String(ok);
    if (ok) agreeOk++;
  }
  const toolText = JSON.stringify(tools.map((x) => x.result)).toLowerCase();
  const ungrounded = US_BRANDS.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(text) && !toolText.includes(b.toLowerCase()));
  if (!ungrounded.length) grounded++;

  console.log(`${choice && agree !== "false" && !ungrounded.length ? "  " : "✗ "}${c.brand.padEnd(18)} tools=[${called.join(",")}] combo=${combo ? combo.found : "-"} agree=${agree || "-"} ungrounded=[${ungrounded.join(",")}] ${secs}s\n     → ${j.advice.askFor}`);
  rows.push([c.brand, c.salts.map((s) => `${s.name} ${s.mg ?? ""}`.trim()).join(" + "), called.join(" "), String(choice), combo ? String(combo.found) : "", agree, ungrounded.join(" "), j.advice.askFor, secs, ""]);
  await sleep(9000); // advise route: 10/min per IP, and several Gemini calls each
}

writeFileSync("eval/tools-results.csv", rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
const summary = { cases: n, routeFailed: failed, toolChoiceRight: choiceOk, comboCases: comboN, agreesWithTool: agreeOk, noUngroundedBrands: grounded, ranAt: new Date().toISOString() };
writeFileSync("eval/tools-summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(`\n${n} cases · failed ${failed} · right tool ${choiceOk}/${n} · agrees with combination tool ${agreeOk}/${comboN} · no brands from memory ${grounded}/${n - failed}`);
