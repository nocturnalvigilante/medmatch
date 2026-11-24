# MedMatch

**Moved to the US with medicines from India?** Type the brand on the strip, and MedMatch tells you what to ask for at a US pharmacy: the US name, whether it's over the counter or prescription, or that it isn't sold in the US at all.

**Live:** https://medmatch-xi.vercel.app

## The core task
1. Type an Indian brand as printed on the strip (for example "Dolo 650", "Pan-D" or "Combiflam"). Typos are fine.
2. MedMatch fills in the active ingredients and strengths: from our hand-checked list, then the 209,000-medicine dataset, and only then the AI. **You check them against the strip** and fix them if needed. You can also take a photo of the strip instead.
3. Each ingredient gets a US answer: the US generic name, OTC or prescription, US shelf brands, and whether your strength is sold in the US. If the drug isn't sold in the US, it says so and tells you to ask a pharmacist.
4. Save it to your medicine cabinet. It warns you when two saved medicines share an ingredient. Signed out, the cabinet is saved in this browser. Signed in, it syncs to your account.

Warnings:
- Combination medicines: don't buy the parts separately.
- Brand names that mean a different product in the US (for example Benadryl).
- Strength is missing from what you entered.

## New in v2
- **Photo of the strip:** the camera button reads the composition printed on the foil (Gemini vision), so ingredients come from the strip, not the model's memory.
- **AI agent with tools** (`/api/advise`): Gemini calls RxNorm/openFDA lookups (`find_combination`, `products_at_strength`, `lookup_ingredient`) and writes "what to ask for" only from their results.
- **209,000 Indian medicines** (public MIT dataset, see [`data/`](data/README.md)): type-ahead across all of them, an instant answer without AI, a "which one is on your strip?" picker, and automatic "same name, different medicine" warnings.
- **"Was this right?"** feedback on every result, plus structured logs for monitoring.
- **A page for each medicine** (`/medicine/dolo-650`, …), with an FAQ, structured data, a sitemap and share images, so people find it from Google searches like "Dolo 650 in USA".
- **A card to show the pharmacist**, plus sharing to WhatsApp and family.
- **Before you fly** (`/before-you-fly`): a packing checklist for students and parents.
- **Published evals** at [`/accuracy`](https://medmatch-xi.vercel.app/accuracy).

## v2 write-ups
- **What changed since v1, and why:** [`CHANGES_V2.md`](CHANGES_V2.md)
- **Security pass:** [`SECURITY.md`](SECURITY.md)
- **Design review** (every screen at phone and laptop width): [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md)
- **Evals, live:** https://medmatch-xi.vercel.app/accuracy

## How it works
| Part | What it does |
|---|---|
| Gemini 3.5 Flash-Lite (`/api/read`) | Brand → proposed ingredients, used only for names on neither our list nor the dataset. This is **only a proposal**. The model never decides the US match. It answers twice in parallel (quick and careful). If the two answers disagree, or the model isn't highly confident, the page shows a red "AI isn't sure" box, and you must tick that the ingredients match your strip before going on. If the strength isn't in the name, the mg box is left empty for you to fill in. |
| RxNorm (NIH) | Indian (INN) name → US ingredient (paracetamol → acetaminophen, frusemide → furosemide). Exact lookup only; fuzzy matches show up only as "did you mean?". |
| openFDA | Whether the drug is actually sold to people in the US, OTC vs prescription, and which brands are listed. |
| Clerk | Sign-in. |
| Supabase | `cabinet` table with row-level security. Each row belongs to the Clerk user id (`auth.jwt()->>'sub'`). |
| Next.js on Vercel | App and API routes. |

The matcher is [`src/lib/match.ts`](src/lib/match.ts). The rule there: if we can't verify it, say so. Never guess.

## Evidence
All results are on [`/accuracy`](https://medmatch-xi.vercel.app/accuracy). Each eval is a script in [`scripts/`](scripts/) with its results in [`eval/`](eval/).

| Eval | Result | Files |
|---|---|---|
| Typed brands, as the app runs them | 30/30 right, no AI calls, 8 ms median | [`read-summary.json`](eval/read-summary.json) |
| Dataset against our hand check | 52 of 53 agree (Norflox differs; the hand check wins) | [`dataset-check.json`](eval/dataset-check.json) |
| US name and OTC or prescription status | 42/42 and 42/42, every row checked by hand | [`match-results.csv`](eval/match-results.csv) (`npm run match-test`) |
| AI alone, real brands and typos | 28/30 and 8/8 | [`ai-results.csv`](eval/ai-results.csv) (`npm run ai-test`) |
| Made-up brands (the dangerous case) | The AI invented ingredients for 33 of 50. The first guard caught 23. After the fix (anything off our lists must be checked against the strip), 30 of 30 inventions caught. | [`ai-summary.json`](eval/ai-summary.json) |
| Strip photos: 100 real product photos plus 12 test images | Ingredients right 109 of 111 scored (1 got no answer because the free AI tier was busy). The 2 misses asked for a photo of the back instead of guessing. Strength right 79/79; refused to guess on 19/19 unreadable photos; never wrong at high confidence | [`photo-results.csv`](eval/photo-results.csv) (`npm run photo-test`) |
| AI agent with tools | Right tools 20/20; agrees with the combination lookup 15/15; no US brand from the model's memory 20/20 | [`tools-results.csv`](eval/tools-results.csv) (`npm run tools-test`) |

The photos are downloaded by [`scripts/fetch-web-photos.py`](scripts/fetch-web-photos.py) and not stored in the repo (copyright).

**User tests:** [`eval/user-tests.md`](eval/user-tests.md), with what real users did and said, and what we changed. **v2 plan:** [`V2_PLAN.md`](V2_PLAN.md).

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
