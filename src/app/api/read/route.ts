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
- Never suggest US names or equivalents.
Return JSON: {"brand": string, "salts": [{"name": string, "mg": number|null}], "strength_known": boolean, "confidence": "high"|"medium"|"low", "note": string}`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key", note: "AI reading is off. Type the ingredients from the strip." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const brand = String(body?.brand ?? "").trim().slice(0, 80);
  if (!brand) return Response.json({ error: "Type a brand name." }, { status: 400 });

  type Parsed = { brand?: unknown; salts?: unknown; strength_known?: unknown; confidence?: unknown; note?: unknown };
  async function ask(model: string, thinking: "low" | "high" = "low"): Promise<Parsed | null> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nInput: ${JSON.stringify(brand)}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingLevel: thinking } },
      }),
      signal: AbortSignal.timeout(model === FALLBACK ? 20000 : 8000),
    }).catch(() => undefined); // timeout / network
    if (!res?.ok) return null;
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
  return Response.json({
    brand: String(parsed.brand ?? brand),
    salts: cleanSalts(parsed).map((s) => (strengthKnown ? s : { name: s.name })),
    strengthKnown,
    confidence: ["high", "medium", "low"].includes(String(parsed.confidence)) ? parsed.confidence : "low",
    note: String(parsed.note ?? ""),
  });
}
