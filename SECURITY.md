# Security pass (v2)

An independent review ran in a fresh agent session with read-only access. It read every API route, the matcher, the Supabase SQL, the client cabinet code, the agent deny rules, the headers, the dependencies and the git history. This file records what it checked, what it found and what we fixed.

## What we checked
| Area | Result |
|---|---|
| API routes that read or change someone's data check who's signed in | **No route touches user data.** `/api/read`, `/api/match`, `/api/advise`, `/api/photo` and `/api/suggest` only take medicine names or photos. The cabinet goes straight from the browser to Supabase with the Clerk token, so row-level security enforces who owns each row. |
| Supabase grant + RLS | RLS is on. The `using` and `with check` clauses both test `user_id = auth.jwt()->>'sub'`. `anon` has no grants; `authenticated` has only select, insert and delete. Checked live: an anonymous read gets "permission denied". |
| Keys out of the repo | `.env*` and `ACCOUNTS.local.md` are gitignored. We searched the tracked files and the **full git history** for Google, Clerk and Supabase key patterns and found nothing. The Gemini key goes in a header, never a URL, and logs only print status codes. |
| `.env` deny rule for coding agents | `.claude/settings.json` blocks Read and Edit of `.env*` and `cat .env*`. |
| Rate limits | `/api/read` 15/min, `/api/advise` 6/min, `/api/photo` 10/min, `/api/match` 20/min, `/api/suggest` 120/min, per IP. |
| Token caps | Every model call sets `maxOutputTokens` (read 8192, advise 4096, photo 4096). Input is capped at 80 characters per name, at most 6 ingredients, and photos at about 2 MB. |
| Prompt injection / SSRF | User text is JSON-stringified into prompts, and tool arguments are cut to 80 characters and cast to numbers. Every upstream URL uses fixed hosts with `encodeURIComponent`, and the model never sees a key. AI output is rendered as React text, never HTML, and length-capped. |
| Spending | Gemini uses a free-tier key with no billing account, so the most it can cost is $0. Vercel Hobby, Supabase Free and Clerk Free. |

## What we found and fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | `/api/match` had no rate limit, but each call fans out to RxNorm and openFDA (which uses our key). | 20/min per IP. |
| 2 | Medium | One `/api/advise` request could trigger up to 12 model calls and 36 tool calls; `maxOutputTokens` only caps each call. | At most 4 model turns and 8 tool calls per request; limit lowered from 10 to 6/min. |
| 3 | Medium | The rate limiter cleared **everyone's** counters once 5000 IPs had been seen, and trusted the first `x-forwarded-for` entry. | It now drops only stale keys and prefers the IP headers Vercel sets itself. *Still per instance: see below.* |
| 4 | Low | `form` on `/api/match` wasn't checked; a value like `"toString"` threw an error. | Allowlist: oral, inhaled, topical or eye. |
| 5 | Low | Anyone could send `skipList` to force AI calls, and the model's `brand`/`note` weren't length-capped. | `skipList` only works outside production; outputs are capped. |
| 6 | Low | No security headers (clickjacking, MIME sniffing). | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and a `Permissions-Policy` that allows the camera only for our own page. |
| 7 | Low | Cabinet rows had no size limit. | `check` constraints on the size of `matches` and the length of `brand` (in `supabase/cabinet.sql`). |
| 8 | Low | On a shared computer, the cabinet saved by someone signed out moved silently into the next account to sign in. | We now ask first: "Move into your account?", with a "Not mine" option. |
| 9 | Low | The JSON-LD script tag didn't escape `<`. | Escaped as `<`. |
| 10 | Info | A 404 error message contained the openFDA URL (which can hold the key); it was caught before logging, but fragile. The URL cache had no size limit. | The error message no longer includes the URL, and the cache is capped at 1000 entries. |

## Accepted risks
- **The rate limiter is in memory, per server instance.** A determined script spread across instances can still use up the free Gemini quota. The impact is limited: there is no billing, so nothing gets charged; the app just asks you to type the ingredients. The proper fix is a shared store (Upstash/Vercel KV).
- **`npm audit`** reports a postcss advisory bundled inside Next 15. It runs only at build time on our own CSS, and fixing it needs a major upgrade to Next 16.
- **No Content-Security-Policy yet.** Clerk and Supabase need a carefully scoped policy; it's planned once that list of allowed sources is tested.

## Still to do by hand
- Widen the agent deny rules in `.claude/settings.json` to cover `head`/`tail`/`grep`/`sed`/`source` on `.env*` and `ACCOUNTS.local.md` (the review found that only `cat` is blocked).
- Run the new constraints in `supabase/cabinet.sql` in the Supabase SQL editor.
