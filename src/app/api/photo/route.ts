// AI step (v2, proposal promise): photo of the strip → brand, strength and the composition printed on it.
// Indian strips print "Each tablet contains: Paracetamol IP 650 mg" on the back, so the model READS the ingredients
// off the foil instead of recalling them from memory. The user still confirms before any US lookup.
import { rateLimited } from "@/lib/ratelimit";
import { findBrand } from "@/lib/brands";

const MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash";
const FALLBACK = "gemini-3.5-flash-lite";
const MAX_BASE64 = 3_000_000; // ~2.2 MB image; the page shrinks photos to ~1280 px JPEG first

const PROMPT = `This is a photo of an Indian medicine strip, box or bottle.
Read ONLY what is printed and visible. Do not use memory to fill in ingredients you cannot see.
- "brand": the brand name as printed (e.g. "Dolo 650", "Pan-D"), or "" if not visible.
- "composition_visible": true only if you can read a composition line such as "Each tablet contains ...".
- "salts": the ingredients and strengths from the composition line, e.g. {"name": "paracetamol", "mg": 650}. Drop "IP"/"BP"/"USP". When the label says "X Sodium eq. to X 40 mg", give the active ingredient after "eq. to" ("pantoprazole", 40). Use null for mg if the strength isn't readable. If no composition is visible, return [].
- "confidence": "high" if the text is sharp and fully readable, "medium" if partly readable, "low" if you are guessing.
- "note": one short sentence for the user, e.g. "Composition is on the back of the strip; take a photo of that side." if it isn't visible.
- If the image is not a medicine package, return brand "" and salts [] and say so in note.
Return JSON: {"brand": string, "composition_visible": boolean, "salts": [{"name": string, "mg": number|null}], "confidence": "high"|"medium"|"low", "note": string}`;

// "Pantoprazole Sodium IP eq. to Pantoprazole" → "pantoprazole"; "Domperidone IP (as SR pellets)" → "domperidone".
function cleanName(raw: string) {
  let n = raw.toLowerCase();
  const eq = n.match(/(?:eq\.?|equivalent)\s*to\s+(.+)$/);
  if (eq) n = eq[1];
  return n
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(ip|bp|usp|diluted|anhydrous)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function POST(req: Request) {
  if (rateLimited(req, "photo", 10)) return Response.json({ error: "rate_limited", note: "Too many photos in a minute. Wait a moment and try again." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key", note: "Photo reading is off. Type the name instead." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const image = String(body?.image ?? "");
  const mime = String(body?.mime ?? "image/jpeg");
  if (!image || image.length > MAX_BASE64 || !/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) {
    return Response.json({ error: "bad_image", note: "That photo couldn't be used. Try a JPEG or PNG under 2 MB." }, { status: 400 });
  }

  async function ask(model: string) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "low" } }, // token cap
      }),
      signal: AbortSignal.timeout(25000),
    }).catch(() => undefined);
    if (!res?.ok) {
      console.error(`photo gemini ${model}: ${res ? res.status : "timeout/network"}`);
      return null;
    }
    try {
      const j = await res.json();
      return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    } catch {
      return null;
    }
  }

  const p = (await ask(MODEL)) ?? (await ask(FALLBACK));
  if (!p) return Response.json({ error: "ai_failed", note: "We couldn't read that photo right now. Type the name on the strip instead." }, { status: 502 });

  const salts = (Array.isArray(p.salts) ? p.salts : [])
    .slice(0, 6)
    .map((s: { name?: unknown; mg?: unknown }) => ({ name: cleanName(String(s.name ?? "")), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined }))
    .filter((s: { name: string }) => s.name);
  const brand = String(p.brand ?? "").slice(0, 80);
  let confidence = ["high", "medium", "low"].includes(p.confidence) ? p.confidence : "low";
  let note = String(p.note ?? "").slice(0, 300);

  // Cross-check against our hand-checked list: if the photo's composition disagrees with what we know, don't trust either silently.
  const known = findBrand(brand);
  if (known && salts.length) {
    const key2 = (l: { name: string }[]) => l.map((s) => s.name.slice(0, 4)).sort().join("+");
    if (key2(known.salts) !== key2(salts)) {
      confidence = "low";
      note = `The photo shows different ingredients from what we have on file for ${known.brand}. Check the strip carefully.`;
    }
  }
  // Brand visible but composition not: fall back to the known list (if we have it), clearly labelled.
  const fromList = !salts.length && !!known;

  return Response.json({
    brand: known?.brand ?? brand,
    salts: fromList ? known!.salts : salts,
    compositionVisible: !!p.composition_visible && salts.length > 0,
    source: fromList ? "list" : "photo",
    confidence: fromList ? "high" : confidence,
    note,
  });
}
