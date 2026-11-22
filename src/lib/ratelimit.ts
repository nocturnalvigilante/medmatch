// In-memory, per server instance: enough to stop one person or script draining the free-tier Gemini quota.
// The free tier itself is the hard cap (no billing attached).
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket: string, max: number, windowMs = 60_000) {
  // Vercel sets x-real-ip / x-vercel-forwarded-for itself; prefer those over the client-controllable x-forwarded-for chain.
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(k, recent);
  // Keep memory bounded by dropping keys with no recent hits (a global clear would reset everyone's limit).
  if (hits.size > 5000) for (const [key, times] of hits) if (!times.some((x) => now - x < windowMs)) hits.delete(key);
  return recent.length > max;
}
