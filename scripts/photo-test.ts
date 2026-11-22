// Photo-reading eval: does Gemini read the ingredients printed on a strip, and does it refuse to guess when they aren't visible?
// Calls the real /api/photo route (BASE=http://localhost:3000) with every image in eval/photos and writes eval/photo-results.csv.
// The current images are SYNTHETIC (rendered foil strips with tilt, blur and glare); real phone photos go in eval/photos/real/.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
type Salt = { name: string; mg?: number };

// expected: salts printed on the photo. "list" = name visible but no composition → may fill from our checked list.
// [] = nothing readable: the right answer is no ingredients.
const EXPECTED: Record<string, { salts: Salt[]; brand?: string; mayUseList?: boolean }> = {
  "dolo650-clean": { brand: "Dolo 650", salts: [{ name: "paracetamol", mg: 650 }] },
  "dolo650-tilt-blur": { brand: "Dolo 650", salts: [{ name: "paracetamol", mg: 650 }] },
  combiflam: { brand: "Combiflam", salts: [{ name: "ibuprofen", mg: 400 }, { name: "paracetamol", mg: 325 }] },
  pand: { brand: "Pan-D", salts: [{ name: "pantoprazole", mg: 40 }, { name: "domperidone", mg: 30 }] },
  "montair-lc": { brand: "Montair LC", salts: [{ name: "montelukast", mg: 10 }, { name: "levocetirizine", mg: 5 }] },
  augmentin: { brand: "Augmentin 625 Duo", salts: [{ name: "amoxicillin", mg: 500 }, { name: "clavulanic acid", mg: 125 }] },
  "zerodol-p": { brand: "Zerodol-P", salts: [{ name: "aceclofenac", mg: 100 }, { name: "paracetamol", mg: 325 }] },
  drotin: { brand: "Drotin 40", salts: [{ name: "drotaverine", mg: 40 }] },
  "unknown-brand": { salts: [{ name: "famotidine", mg: 40 }] }, // brand not on our list; composition printed
  "name-only": { brand: "Telma 40", salts: [{ name: "telmisartan", mg: 40 }], mayUseList: true },
  "no-composition-unknown": { salts: [] }, // made-up name, no composition: must not invent ingredients
  "not-medicine": { salts: [] },
};

const SUFFIX = /\b(sodium|potassium|hydrochloride|dihydrochloride|trihydrate|diluted|eq|to|as|sr|pellets|ip|bp|usp)\b/g;
const norm = (s: string) => s.toLowerCase().replace(/amoxycillin/, "amoxicillin").replace(/clavulanate/, "clavulanic acid").replace(SUFFIX, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (s: Salt[]) => s.map((x) => `${x.name}${x.mg ? ` ${x.mg}` : ""}`).join(" + ") || "(none)";

const dirs = ["eval/photos", "eval/photos/real"].filter(existsSync);
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => `${d}/${f}`));
const rows = [["photo", "kind", "expected", "got", "source", "confidence", "ingredients_ok", "strength_ok", "invented", "seconds", "note"]];
let n = 0, ok = 0, mgN = 0, mgOk = 0, refuseN = 0, refuseOk = 0, flaggedWrong = 0;

for (const f of files) {
  const id = f.split("/").pop()!.replace(/\.\w+$/, "");
  const exp = EXPECTED[id];
  if (!exp) continue; // real photos need an entry above to be scored
  const t = Date.now();
  const res = await fetch(`${BASE}/api/photo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: readFileSync(f).toString("base64"), mime: f.endsWith("png") ? "image/png" : "image/jpeg" }) });
  const j = await res.json().catch(() => ({}));
  const got: Salt[] = j.salts ?? [];
  const ms = Date.now() - t;
  n++;
  let good: boolean, mg = "", invented = false;
  if (!exp.salts.length) {
    refuseN++;
    good = got.length === 0;
    invented = !good;
    if (good) refuseOk++;
  } else {
    good = got.length === exp.salts.length && exp.salts.every((e) => got.some((g) => same(g.name, e.name)));
    const checks = exp.salts.map((e) => ({ e, g: got.find((g) => same(g.name, e.name)) })).filter((c) => c.g?.mg);
    if (checks.length) {
      const m = checks.every((c) => c.g!.mg === c.e.mg);
      mgN++; if (m) mgOk++;
      mg = String(m);
    }
    if (!good && j.confidence === "high") flaggedWrong++; // wrong AND not flagged: the dangerous case
  }
  if (good) ok++;
  console.log(`${good ? "  " : "✗ "}${id.padEnd(24)} → ${fmt(got)} [${j.source ?? "?"}, ${j.confidence ?? "?"}] ${(ms / 1000).toFixed(1)}s`);
  rows.push([id, f.includes("/real/") ? "real" : "synthetic", fmt(exp.salts), fmt(got), String(j.source ?? ""), String(j.confidence ?? ""), String(good), mg, String(invented), (ms / 1000).toFixed(1), String(j.note ?? j.error ?? "")]);
  await sleep(7000); // free tier per-minute limit
}

writeFileSync("eval/photo-results.csv", rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
const summary = { photos: n, ingredientsRight: ok, strengthChecked: mgN, strengthRight: mgOk, unreadable: refuseN, refusedToGuess: refuseOk, wrongButHighConfidence: flaggedWrong, ranAt: new Date().toISOString() };
writeFileSync("eval/photo-summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(`\nphotos ${n}: ingredients right ${ok}/${n} · strength right ${mgOk}/${mgN} · refused to guess ${refuseOk}/${refuseN} · wrong at high confidence ${flaggedWrong}`);
