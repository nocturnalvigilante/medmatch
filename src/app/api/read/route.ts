import { rateLimited } from "@/lib/ratelimit";
import { findBrand, INGREDIENTS } from "@/lib/brands";
import { findVariants } from "@/lib/india";
import { doseLabel, parseDose } from "@/lib/dose";
// AI step: brand name → proposed salts + strengths. The user must confirm before any lookup.
// The model only proposes ingredients; it never decides US equivalents.

// Lite answers in <1s; full Flash took 10-30s in testing, so it is only the backup.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const FALLBACK = "gemini-3.5-flash";

const PROMPT = `You read Indian medicine brand names. Given a brand as printed on an Indian strip or box,
return its active ingredients (salts) and strengths per tablet/unit.
Rules:
- Only answer if you are confident this brand exists in India. If unsure, return "salts": [] and say why in "note".
- If the input is itself an ingredient (generic/salt) name or a misspelling of one (e.g. "paracetamol", "cefoximine" → "cefixime"), return that ingredient as the only salt with "mg": null unless a number is given, and set "brand" to the corrected name.
- If the input is an obvious misspelling of a well-known Indian brand (e.g. "combiflame" → "Combiflam", "dolo650" → "Dolo 650", "disprine" → "Disprin"), answer for the corrected brand, put the corrected spelling in "brand", and say "Did you mean <brand>?" in "note".
- Different strengths of one brand exist (e.g. "Dolo 650" vs "Dolo 500"). If the strength is not in the input, set "strength_known": false.
- Use Indian (INN) names as printed, e.g. "paracetamol", "pantoprazole sodium".
- "mg" is always milligrams. For a microgram strength, give mg as a decimal (thyroxine 50 mcg → 0.05).
- Never suggest US names or equivalents.
Return JSON: {"brand": string, "salts": [{"name": string, "mg": number|null}], "strength_known": boolean, "confidence": "high"|"medium"|"low", "note": string}`;

export async function POST(req: Request) {
  // Cheap abuse guard for the free list lookups; the strict limit below protects the AI quota.
  if (rateLimited(req, "read-all", 60)) return Response.json({ error: "rate_limited", note: "Too many lookups in a minute. Wait a moment and try again." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key", note: "AI reading is off. Type the ingredients from the strip." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const brand = String(body?.brand ?? "").trim().slice(0, 80);
  if (!brand) return Response.json({ error: "Type a brand name." }, { status: 400 });

  // Design review: typing an ingredient ("acetaminophen") went to the AI, which renamed it and triggered the
  // "could be a guess" warning. A known ingredient name has no brand to guess, so answer it directly.
  // User test: this ran after the dataset search, so "paracetamol" came back as "Paracetamol Tablet 500 mg". Ingredient first.
  const typed = brand.toLowerCase().replace(/\d+(\.\d+)?\s*(mg|mcg|g)?\b/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const ingredient = INGREDIENTS.find((i) => i === typed);
  if (ingredient) {
    const amount = brand.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)?\b/);
    const mg = parseDose(amount ? `${amount[1]}${amount[2] ?? ""}` : undefined);
    const strength = amount ? doseLabel(`${amount[1]}${amount[2] ?? ""}`) : undefined;
    return Response.json({ brand: ingredient, salts: [{ name: ingredient, ...(mg ? { mg, strength } : {}) }], strengthKnown: !!mg, confidence: "high", source: "ingredient", note: "" });
  }

  // Fast path (instructor feedback: reading felt slow): brands on our hand-checked list answer instantly, no AI call.
  const known = body?.skipList === true && process.env.NODE_ENV !== "production" ? undefined : findBrand(brand); // evals pass skipList to measure the AI itself
  if (known) return Response.json({ brand: known.brand, salts: known.salts, strengthKnown: true, confidence: "high", source: "list", note: "" });

  // Next: ~209k Indian medicines from a public dataset (agreed with our hand check 52/53). Still no AI call.
  if (body?.skipList !== true || process.env.NODE_ENV === "production") {
    let variants = findVariants(brand);
    // "Asthalin inhaler", "Combiflam syrup": the user named the form, so keep only that form.
    const said = /inhal|rotacap|respule/i.test(brand) ? "inhaled" : /syrup|suspension|tablet|capsule/i.test(brand) ? "oral" : /cream|gel|ointment/i.test(brand) ? "topical" : /eye/i.test(brand) ? "eye" : undefined;
    const word = brand.toLowerCase().match(/\b(syrup|suspension|tablet|capsule|inhaler|rotacaps?|respules|cream|gel|ointment|drops?)\b/)?.[1];
    if (said) {
      const stem = word?.replace(/s$/, "");
      if (!variants.some((v) => v.form === said && (!stem || v.name.toLowerCase().includes(stem)))) variants = findVariants(brand, true); // "Asthalin 100mcg Inhaler" has extra words
      const byForm = variants.filter((v) => v.form === said);
      const byWord = stem ? byForm.filter((v) => v.name.toLowerCase().includes(stem)) : [];
      if (byWord.length) variants = byWord;
      else if (byForm.length) variants = byForm;
    }
    const distinct = [...new Map(variants.map((v) => [`${v.form}|${v.salts.map((s) => s.name + s.strength).join("+")}`, v])).values()];
    if (distinct.length === 1) {
      const v = distinct[0];
      return Response.json({
        brand: v.name,
        salts: v.salts.map((s) => ({ name: s.name, mg: s.mg, strength: s.strength })),
        form: v.form,
        strengthKnown: true,
        confidence: v.complete ? "high" : "partial", // partial: the source lists only 2 ingredients; the strip may have more
        source: "dataset",
        note: "",
      });
    }
    if (distinct.length > 1) {
      // Several products share the name (tablet vs kids' syrup, different strengths): let the user pick the one on the strip.
      return Response.json({
        brand,
        source: "dataset",
        variants: distinct.slice(0, 8).map((v) => ({ name: v.name, form: v.form, complete: v.complete, salts: v.salts.map((s) => ({ name: s.name, mg: s.mg, strength: s.strength })) })),
        salts: [],
        confidence: "high",
        note: "",
      });
    }
  }

  // Rate limit on the AI path: 15 per minute per IP (each read = 2 model calls).
  if (rateLimited(req, "read", 15)) return Response.json({ error: "rate_limited", note: "Too many lookups in a minute. Wait a moment and try again." }, { status: 429 });

  type Parsed = { brand?: unknown; salts?: unknown; strength_known?: unknown; confidence?: unknown; note?: unknown };
  async function ask(model: string, thinking: "low" | "high" = "low"): Promise<Parsed | null> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nInput: ${JSON.stringify(brand)}` }] }],
        // Token cap: the answer is a short JSON object; 8192 leaves room for thinking (2048 cut off answers in testing) but stops runaway output.
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: thinking } },
      }),
      signal: AbortSignal.timeout(model === FALLBACK ? 20000 : 8000),
    }).catch(() => undefined); // timeout / network
    if (!res?.ok) {
      console.error(`gemini ${model}/${thinking}: ${res ? res.status : "timeout/network"}`); // server log only, no key
      return null;
    }
    try {
      const j = await res.json();
      return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    } catch {
      return null; // malformed JSON from the model
    }
  }
  const cleanSalts = (p: Parsed | null) =>
    (Array.isArray(p?.salts) ? p!.salts : [])
      .map((s: { name?: unknown; mg?: unknown }) => ({ name: String(s.name ?? "").slice(0, 80), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined }))
      .filter((s: { name: string }) => s.name);

  // Ask twice in parallel: quick (~1s) and careful (~3s). A real brand gets the same ingredients both times.
  // AI eval: a made-up brand ("Duraflux") got invented ingredients at "high" confidence, and different ones on
  // another run. So if the two answers disagree, we mark it "low" and the page makes the user check the strip.
  const [quick, careful] = await Promise.all([ask(MODEL, "low"), ask(MODEL, "high")]);
  // Compare drugs, not spellings: drop salt words ("potassium clavulanate" = "clavulanic acid") and
  // use the first 4 letters, so "amoxycillin" (Indian) and "amoxicillin" count as the same drug.
  const SALT_WORDS = /\b(potassium|sodium|calcium|magnesium|hydrochloride|dihydrochloride|hcl|maleate|mesylate|besylate|succinate|tartrate|citrate|sulphate|sulfate|phosphate|acetate|fumarate|bromide|hydrobromide|trihydrate|dihydrate|monohydrate)\b/g;
  const saltSet = (p: Parsed | null) =>
    cleanSalts(p).map((s: { name: string }) => s.name.toLowerCase().replace(SALT_WORDS, "").trim().slice(0, 4)).sort().join("+");
  const disagree = !!quick && !!careful && saltSet(quick) !== saltSet(careful);
  let parsed = [quick, careful].find((p) => cleanSalts(p).length > 0) ?? quick ?? careful;
  if (!parsed) parsed = await ask(FALLBACK); // Lite down entirely; full Flash (10-30s)
  if (!parsed) {
    return Response.json({ error: "ai_failed", note: "Our AI couldn't read that right now. Type the ingredients from the strip." }, { status: 502 });
  }
  if (disagree) parsed = { ...parsed, confidence: "low" };
  // AI eval: Drotin (40 mg) came back as 80 mg. When the strength isn't in the name, don't prefill a number;
  // the user types the mg from the strip instead of trusting a guessed dose.
  const strengthKnown = parsed.strength_known !== false;
  const salts = cleanSalts(parsed);
  // v2 eval (50 made-up brands): the AI invented ingredients for 33, and the two-answer check caught only 23.
  // Names like "Torvalin 10" get the drug they sound like (atorvastatin) at high confidence, both times.
  // So a brand that isn't on our checked list is never trusted on the AI's word: the user must confirm against the strip.
  // Exception: the input is itself an ingredient name ("paracetamol"), where there is no brand to invent.
  const n = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  const isIngredient = salts.length === 1 && n(salts[0].name).startsWith(n(brand).slice(0, 6)) && n(brand).length >= 5;
  const aiConfidence = ["high", "medium", "low"].includes(String(parsed.confidence)) ? String(parsed.confidence) : "low";
  const confidence = salts.length && !isIngredient && aiConfidence === "high" ? "unlisted" : aiConfidence;
  console.log(JSON.stringify({ evt: "read", source: "ai", confidence, disagree, salts: salts.length })); // monitoring: how often the AI path runs and is unsure
  return Response.json({
    brand: String(parsed.brand ?? brand).slice(0, 80),
    salts: salts.map((s) => (strengthKnown ? s : { name: s.name })),
    strengthKnown,
    confidence,
    aiConfidence,
    note: String(parsed.note ?? "").slice(0, 300),
  });
}
