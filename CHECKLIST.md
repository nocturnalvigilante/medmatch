# MedMatch v1 checklist (due Tue Nov 17, 5:30 PM)

Core task: type an Indian medicine → confirm its salts → see US names, OTC/Rx, or "Not sold in the US" → save to cabinet.

## 1. Riskiest part first: matching (Nov 10–11)
- [x] RxNorm and openFDA reachable, no key needed
- [x] Found: RxNorm fuzzy search maps mefenamic acid → meclofenamic acid (wrong drug). Use exact normalized lookup only; fuzzy = "did you mean?" that the user must confirm
- [x] Found: RxNorm has domperidone (horse gel). "In RxNorm" ≠ sold to people. Sold = openFDA HUMAN OTC/Rx listing
- [x] `src/lib/match.ts`: salt → US generic, brands, OTC/Rx, not-sold, US strengths
- [x] `npm run match-test` on 42 salts: US name 42/42, status 42/42; every row hand-checked in `eval/match-results.csv` (fixed Ecosprin 75 strength and Glycomet extended-release brand)
- [x] Real testers' medicines added (Combiflam, Ciplox, Saridon, Crocin, Disprin, cefixime)

## 2. Build end to end (Nov 11–14)
- [x] Gemini reads brand → salts + strengths (3.5-flash-lite ~1 s, careful retry, flash fallback; typos handled)
- [x] Confirm screen: user edits/accepts salts before any lookup
- [x] Result card: US box names first, OTC/Rx, "Not sold in the US → ask a pharmacist"
- [x] Clerk sign-in
- [x] Supabase `cabinet` table + RLS on
- [x] Same-drug overlap warning (Supabase when signed in, browser when signed out)
- [x] GitHub repo: https://github.com/nocturnalvigilante/medmatch
- [x] Live: https://medmatch-xi.vercel.app (all keys set in Vercel)
- [x] Agent walkthroughs (4 runs) as a new person; each stuck point fixed (see `eval/user-tests.md`)

## 3. Test with real users (Nov 14–16): you, not the agent
- [ ] 3+ people (Aditi, Karthik, Lakshmi or UChicago Indian students): 2 done, more in progress
- [ ] Give the core task, watch without helping, write what each did and said → `eval/user-tests.md`

## 4. Before you ship
- [x] Keys only in env vars; `.env*` gitignored; nothing in git history (scanned)
- [x] Deny rule for `.env` in `.claude/settings.json`
- [x] Supabase RLS on (Clerk user id = row owner; anon read returns nothing, anon insert blocked)
- [x] Gemini free-tier key with no billing ($0 max); Vercel Hobby; Supabase and Clerk free
- [x] `/security-review`: 1 medium finding (openFDA key could leak in error notes), fixed

## 5. Plan v2 + submit
- [x] `V2_PLAN.md` from user-test notes (fix first / add / wait)
- [ ] Google Classroom: live URL + GitHub link + v2 plan
