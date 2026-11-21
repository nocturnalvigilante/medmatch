// Type-ahead backup: when our own list has nothing close, ask RxNorm for spelling suggestions
// (e.g. "acetominophin" → "acetaminophen"). Names only; no AI, no user data.
import { rateLimited } from "@/lib/ratelimit";

export async function GET(req: Request) {
  if (rateLimited(req, "suggest", 120)) return Response.json({ names: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 4) return Response.json({ names: [] });
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    const j = await res.json();
    const names: string[] = (j.suggestionGroup?.suggestionList?.suggestion ?? []).slice(0, 4).map((s: string) => s.toLowerCase());
    return Response.json({ names });
  } catch {
    return Response.json({ names: [] });
  }
}
