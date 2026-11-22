// Type-ahead: ~209k Indian medicines by popularity (with typo tolerance), then RxNorm spelling suggestions
// for ingredient names (e.g. "acetominophin" → "acetaminophen"). Names only; no AI, no user data.
import { rateLimited } from "@/lib/ratelimit";
import { search } from "@/lib/india";

export async function GET(req: Request) {
  if (rateLimited(req, "suggest", 120)) return Response.json({ meds: [], names: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ meds: [], names: [] });
  const meds = search(q, 8).map((m) => ({ name: m.name, form: m.form, salts: m.salts, complete: m.complete, maker: m.maker }));
  let names: string[] = [];
  if (meds.length < 3 && q.length >= 4) {
    try {
      const res = await fetch(`https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } });
      const j = await res.json();
      names = (j.suggestionGroup?.suggestionList?.suggestion ?? []).slice(0, 4).map((s: string) => s.toLowerCase());
    } catch {}
  }
  return Response.json({ meds, names });
}
