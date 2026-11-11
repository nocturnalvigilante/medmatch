import { matchDrug, type Form } from "@/lib/match";

type Salt = { name: string; mg?: number; form?: Form };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const salts: Salt[] = Array.isArray(body?.salts) ? body.salts.slice(0, 6) : [];
  const clean = salts
    .map((s) => ({ name: String(s.name ?? "").trim().slice(0, 80), mg: Number(s.mg) > 0 ? Number(s.mg) : undefined, form: s.form }))
    .filter((s) => s.name);
  if (!clean.length) return Response.json({ error: "Add at least one active ingredient." }, { status: 400 });
  const matches = await Promise.all(clean.map((s) => matchDrug(s.name, s.mg, s.form ?? "oral")));
  return Response.json({ matches });
}
