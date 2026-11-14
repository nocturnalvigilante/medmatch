# MedMatch

**Moved to the US with medicines from India?** Type the brand on the strip, and MedMatch tells you what to ask for at a US pharmacy: the US name, whether it's over the counter or prescription, or that it isn't sold in the US at all.

**Live:** https://medmatch-xi.vercel.app

## The core task
1. Type an Indian brand as printed on the strip (for example "Dolo 650", "Pan-D" or "Combiflam"). Typos are fine.
2. The AI suggests the active ingredients and strengths. **You check them against the strip** and fix them if needed.
3. Each ingredient gets a US answer: the US generic name, OTC or prescription, US shelf brands, and whether your strength is sold in the US. If the drug isn't sold in the US, it says so and tells you to ask a pharmacist.
4. Save it to your medicine cabinet. It warns you when two saved medicines share an ingredient. Signed out, the cabinet is saved in this browser. Signed in, it syncs to your account.

Warnings:
- Combination medicines: don't buy the parts separately.
- Brand names that mean a different product in the US (for example Benadryl).
- Strength is missing from what you entered.

## How it works
| Part | What it does |
|---|---|
| Gemini 3.5 Flash-Lite (`/api/read`) | Brand → proposed ingredients. This is **only a proposal**. The model never decides the US match. It answers twice in parallel (quick and careful). If the two answers disagree, or the model isn't highly confident, the page shows a red "AI isn't sure" box, and you must tick that the ingredients match your strip before going on. If the strength isn't in the name, the mg box is left empty for you to fill in. |
| RxNorm (NIH) | Indian (INN) name → US ingredient (paracetamol → acetaminophen, frusemide → furosemide). Exact lookup only; fuzzy matches show up only as "did you mean?". |
| openFDA | Whether the drug is actually sold to people in the US, OTC vs prescription, and which brands are listed. |
| Clerk | Sign-in. |
| Supabase | `cabinet` table with row-level security. Each row belongs to the Clerk user id (`auth.jwt()->>'sub'`). |
| Next.js on Vercel | App and API routes. |

The matcher is [`src/lib/match.ts`](src/lib/match.ts). The rule there: if we can't verify it, say so. Never guess.

## Evidence
- **Matching accuracy:** [`eval/match-results.csv`](eval/match-results.csv). 42 salts from common Indian medicines. The US name was right 42/42 times and the OTC/Rx status 42/42. Every row was checked by hand (`hand_check` column). Run it with `npm run match-test`.
- **AI reading accuracy:** [`eval/ai-results.csv`](eval/ai-results.csv) is 46 calls to the real `/api/read` route, with every row checked by hand. Run it with `npm run ai-test`.
  - **Real brands:** ingredients right 30/30 (hand check), and strength right in every case where the AI filled one in (17/17).
  - **Typos from testers:** 8/8 corrected ("disprine" → Disprin, "cefoximine" → cefixime).
  - **Made-up brands** (the dangerous case): the AI said "don't know" for 5/8 and invented ingredients for 3/8. **All 3 inventions were caught** by the "AI isn't sure" box. Before the two-answer check, a made-up brand got invented ingredients at *high* confidence.
  - **Cost of the check:** 3 of 38 real names show the box anyway (one extra tick), and a read takes about 3 s instead of about 1 s.
- **User tests:** [`eval/user-tests.md`](eval/user-tests.md). What real users did and said, and what we changed.
- **v2 plan:** [`V2_PLAN.md`](V2_PLAN.md).

## Security and cost
- Keys live only in environment variables (`.env.local` locally, Vercel in production). `.env*` is gitignored, and [`.env.example`](.env.example) lists the names with no values.
- [`.claude/settings.json`](.claude/settings.json) has deny rules that keep coding agents out of `.env` files.
- Supabase row-level security is on. Signed-out users can't read or write any cabinet rows. Signed-in users can only touch their own.
- **Spending limit:** Gemini uses a free-tier key with no billing account attached, so it can't be charged. If the quota runs out, requests fail and the app asks you to type the ingredients instead. Vercel (Hobby), Supabase (Free), Clerk (Free), RxNorm and openFDA (no key) are all free.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev
```
Supabase setup: run [`supabase/cabinet.sql`](supabase/cabinet.sql), and add Clerk as a third-party auth provider.

*MedMatch is not medical advice. Always confirm with a US pharmacist.*
