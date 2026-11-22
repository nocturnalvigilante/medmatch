// "Was this right?" from result pages → Supabase `feedback` table (insert-only for the public; read in the dashboard).
// This is the error-analysis loop on real use: every "wrong" report becomes a candidate eval case.
import { createClient } from "@supabase/supabase-js";
import { rateLimited } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (rateLimited(req, "feedback", 10)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const b = await req.json().catch(() => null);
  const verdict = b?.verdict === "right" || b?.verdict === "wrong" ? b.verdict : null;
  const brand = String(b?.brand ?? "").trim().slice(0, 120);
  if (!verdict || !brand) return Response.json({ error: "bad_request" }, { status: 400 });
  const row = {
    brand,
    verdict,
    ingredients: String(b?.ingredients ?? "").slice(0, 400),
    comment: String(b?.comment ?? "").trim().slice(0, 500) || null,
    source: String(b?.source ?? "").slice(0, 20) || null,
  };
  console.log(JSON.stringify({ evt: "feedback", verdict, brand, source: row.source })); // Vercel logs (monitoring)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: true, stored: false });
  const { error } = await createClient(url, key).from("feedback").insert(row);
  if (error) console.error("feedback insert failed:", error.code); // e.g. table not created yet; the user still sees "thanks"
  return Response.json({ ok: true, stored: !error });
}
