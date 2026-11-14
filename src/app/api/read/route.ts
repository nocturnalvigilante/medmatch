// AI step: brand name → proposed salts + strengths. The user must confirm before any lookup.
// The model only proposes ingredients; it never decides US equivalents.

// Lite answers in <1s; full Flash took 10-30s in testing, so it is only the backup.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const FALLBACK = "gemini-3.5-flash";

const PROMPT = `You read Indian medicine brand names. Given a brand as printed on an Indian strip or box,
return its active ingredients (salts) and strengths per tablet/unit.
Rules:
- Only answer if you are confident this exact brand exists in India. If unsure, return "salts": [] and say why in "note".
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

  try {
    // Gemini often returns 503/429 or stalls when busy: retry, then fall back to full Flash.
    let res: Response | undefined;
    for (const model of [MODEL, MODEL, FALLBACK]) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nBrand: ${JSON.stringify(brand)}` }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingLevel: "low" } },
        }),
        signal: AbortSignal.timeout(model === FALLBACK ? 20000 : 8000),
      }).catch(() => undefined); // timeout → try the next model
      if (res && res.status !== 503 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 800));
    }
    if (!res?.ok) throw new Error(`Gemini ${res?.status}`);
    const j = await res.json();
    const parsed = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const salts = (Array.isArray(parsed.salts) ? parsed.salts : [])
      .map((s: { name?: unknown; mg?: unknown }) => ({ name: String(s.name ?? "").slice(0, 80), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined }))
      .filter((s: { name: string }) => s.name);
    return Response.json({
      brand: String(parsed.brand ?? brand),
      salts,
      strengthKnown: parsed.strength_known !== false,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
      note: String(parsed.note ?? ""),
    });
  } catch (e) {
    return Response.json({ error: "ai_failed", note: `Couldn't read that (${(e as Error).message}). Type the ingredients from the strip.` }, { status: 502 });
  }
}
