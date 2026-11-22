import { matchDrug, type Form } from "@/lib/match";
import { rateLimited } from "@/lib/ratelimit";
import { brandClash } from "@/lib/summary";
import { symptomPlan } from "@/lib/symptoms";

const FORMS: Form[] = ["oral", "inhaled", "topical", "eye"];

type Salt = { name: string; mg?: number; form?: Form };

export async function POST(req: Request) {
  // Security review: each request fans out to RxNorm/openFDA, so limit it too.
  if (rateLimited(req, "match", 20)) return Response.json({ error: "Too many lookups in a minute. Wait a moment and try again." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const salts: Salt[] = Array.isArray(body?.salts) ? body.salts.slice(0, 6) : [];
  const clean = salts
    .map((s) => ({ name: String(s.name ?? "").trim().slice(0, 80), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined, form: FORMS.includes(s.form as Form) ? (s.form as Form) : ("oral" as Form) }))
    .filter((s) => s.name);
  if (!clean.length) return Response.json({ error: "Add at least one active ingredient." }, { status: 400 });
  const brand = String(body?.brand ?? "").trim().slice(0, 80);
  const isLiquid = /syrup|suspension|drops?\b|liquid|linctus|elixir/i.test(brand);
  const [matches, clash, symptoms] = await Promise.all([
    Promise.all(clean.map((s) => matchDrug(s.name, s.mg, s.form ?? "oral"))),
    brand ? brandClash(brand, clean.map((s) => s.name)) : undefined,
    symptomPlan(clean.map((s) => s.name), isLiquid),
  ]);
  console.log(JSON.stringify({ evt: "match", n: matches.length, results: matches.map((m) => m.result + ":" + m.status), clash: !!clash })); // monitoring (Vercel logs)
  return Response.json({ matches, clash, symptoms });
}
