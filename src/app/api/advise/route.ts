// AI with tools (v2, issue #6): after the user confirms the ingredients, Gemini decides which lookups to run
// (single ingredient, combination product, product at this strength), calls them as tools, and writes
// "what to ask for at the pharmacy" using ONLY what the tools returned. The deterministic cards stay as the source of truth.
import { matchDrug, findCombination, productsAtStrength, type Form } from "@/lib/match";
import { rateLimited } from "@/lib/ratelimit";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const MAX_TURNS = 6;

const SYSTEM = `You help someone who moved from India to the US find what to ask for at a US pharmacy.
They confirmed the ingredients printed on their Indian medicine. Use the tools to look things up:
- The message gives the Form (oral, inhaled, topical, eye). find_combination and products_at_strength only cover oral products: if the Form is not oral, use only lookup_ingredient. If lookup_ingredient returns soldAsForms, say plainly it is sold in the US but not in this form.
- If there are 2+ ingredients, ALWAYS call find_combination first.
- If an ingredient has a strength (mg), call products_at_strength for it, unless a combination product already matches.
- Call lookup_ingredient for each ingredient to get its US name and OTC/prescription status.
Rules:
- Every US name, brand, strength and OTC/Rx status you mention MUST come from a tool result in this conversation. Never use memory.
- If a tool says not found or lookup failed, say so plainly. Never guess a substitute.
- Never give dosing advice. If anything is prescription-only, not sold, or a different strength, set see_pharmacist true.
- If products_at_strength returns an extended-release product, name it exactly (e.g. "Tylenol 8 HR, extended-release") and say a plain tablet at that strength is different.
- Write plain English, not database strings: "Augmentin 500/125 mg tablets", not "amoxicillin 500 MG / clavulanate 125 MG Oral Tablet". Say "needs a prescription" or "over the counter", never "rx"/"otc".
- If there is no US combination product, say clearly that it is sold as separate medicines and not to combine them without a pharmacist.
- If lookup_ingredient returns sameFamilyOtcAlternatives (the drug is not sold or needs a prescription), you may name them as "an over-the-counter option from the same drug family to ask the pharmacist about". Never present them as the same medicine.
- Keep it short and plain: someone standing in a pharmacy aisle should understand it.
When done, reply with ONLY this JSON (no markdown):
{"ask_for": "one sentence: what to pick up or ask the pharmacist for", "points": ["2-4 short facts from the tools"], "see_pharmacist": true|false}`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "lookup_ingredient",
        description: "US generic name, OTC or prescription status, shelf brands, and whether this strength is sold in the US, for ONE ingredient (Indian names like paracetamol are fine).",
        parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, mg: { type: "NUMBER" } }, required: ["name"] },
      },
      {
        name: "find_combination",
        description: "Whether the US sells ONE product containing exactly these ingredients together (e.g. amoxicillin + clavulanic acid), its status, brands, and whether the same strengths are sold.",
        parameters: {
          type: "OBJECT",
          properties: { ingredients: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, mg: { type: "NUMBER" } }, required: ["name"] } } },
          required: ["ingredients"],
        },
      },
      {
        name: "products_at_strength",
        description: "Listed US oral products with this ingredient at exactly this strength, with brand, OTC/Rx, and whether it is extended-release (e.g. acetaminophen 650 mg).",
        parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, mg: { type: "NUMBER" } }, required: ["name", "mg"] },
      },
    ],
  },
];

type Args = { name?: string; mg?: number; ingredients?: { name: string; mg?: number }[] };

async function runTool(name: string, a: Args, form: Form): Promise<unknown> {
  if (name === "lookup_ingredient" && a.name) {
    const m = await matchDrug(String(a.name).slice(0, 80), Number(a.mg) > 0 ? Number(a.mg) : undefined, form);
    return { usName: m.usName, status: m.status, brands: m.brands, sameStrengthInUS: m.sameStrengthInUS, note: m.note, suggestion: m.suggestion, soldAsForms: m.soldAsForms, sameFamilyOtcAlternatives: m.alternatives };
  }
  if (name === "find_combination" && Array.isArray(a.ingredients) && a.ingredients.length >= 2) {
    const ings = a.ingredients.slice(0, 6);
    return findCombination(ings.map((i) => String(i.name).slice(0, 80)), ings.map((i) => (Number(i.mg) > 0 ? Number(i.mg) : undefined)));
  }
  if (name === "products_at_strength" && a.name && Number(a.mg) > 0) return productsAtStrength(String(a.name).slice(0, 80), Number(a.mg));
  return { error: "bad arguments" };
}

type Part = { text?: string; functionCall?: { name: string; args: Args }; thought?: boolean };
type Content = { role: "user" | "model"; parts: (Part | { functionResponse: { name: string; response: unknown } })[] };

export async function POST(req: Request) {
  if (rateLimited(req, "advise", 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "no_key" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const salts = (Array.isArray(body?.salts) ? body.salts : [])
    .slice(0, 6)
    .map((s: { name?: unknown; mg?: unknown }) => ({ name: String(s.name ?? "").trim().slice(0, 80), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined }))
    .filter((s: { name: string }) => s.name);
  if (!salts.length) return Response.json({ error: "no_salts" }, { status: 400 });

  const brand = String(body?.brand ?? "").slice(0, 80);
  const form: Form = ["oral", "inhaled", "topical", "eye"].includes(body?.form) ? body.form : "oral";
  const contents: Content[] = [{ role: "user", parts: [{ text: `Indian medicine: ${JSON.stringify(brand)}\nForm: ${form}\nConfirmed ingredients: ${JSON.stringify(salts)}` }] }];
  const toolLog: { tool: string; args: Args; result: unknown }[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        tools: TOOLS,
        generationConfig: { temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "low" } }, // token cap
      }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => undefined);
    if (!res?.ok) {
      console.error(`advise gemini: ${res ? res.status : "timeout/network"}`);
      return Response.json({ error: "ai_failed", tools: toolLog }, { status: 502 });
    }
    const j = await res.json().catch(() => null);
    const content = j?.candidates?.[0]?.content;
    const parts: Part[] = content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length) {
      contents.push({ role: "model", parts: content.parts }); // keep thought signatures as returned
      const responses = await Promise.all(
        calls.slice(0, 6).map(async (p) => {
          const { name, args } = p.functionCall!;
          const result = await runTool(name, args ?? {}, form);
          toolLog.push({ tool: name, args, result });
          return { functionResponse: { name, response: { result } } };
        }),
      );
      contents.push({ role: "user", parts: responses });
      continue;
    }
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").replace(/^```(json)?|```$/g, "").trim();
    try {
      const a = JSON.parse(text);
      return Response.json({
        advice: {
          askFor: String(a.ask_for ?? "").slice(0, 400),
          points: (Array.isArray(a.points) ? a.points : []).slice(0, 5).map((x: unknown) => String(x).slice(0, 300)),
          seePharmacist: a.see_pharmacist !== false,
        },
        tools: toolLog,
      });
    } catch {
      return Response.json({ error: "ai_bad_json", tools: toolLog }, { status: 502 });
    }
  }
  return Response.json({ error: "too_many_steps", tools: toolLog }, { status: 502 });
}
