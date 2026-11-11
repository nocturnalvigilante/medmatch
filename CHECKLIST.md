# MedMatch v1 checklist (due Tue Nov 17, 5:30 PM)

Core task: type an Indian medicine → confirm its salts → see US names, OTC/Rx, or "Not sold in the US" → save to cabinet.

## 1. Riskiest part first: matching (Nov 10–11)
- [x] RxNorm and openFDA reachable, no key needed
- [x] Found: RxNorm fuzzy search maps mefenamic acid → meclofenamic acid (wrong drug). Use exact normalized lookup only; fuzzy = "did you mean?" that the user must confirm
- [x] Found: RxNorm has domperidone (horse gel). "In RxNorm" ≠ sold to people. Sold = openFDA HUMAN OTC/Rx listing
- [x] `src/lib/match.ts`: salt → US generic, brands, OTC/Rx, not-sold, US strengths
- [ ] Run `npm run match-test` on 30 medicines; **hand-check every row** in `eval/match-results.csv` (you)
- [ ] Swap in the real medicines Aditi, Karthik and Lakshmi named (you)

## 2. Build end to end (Nov 11–14)
- [ ] Gemini key in `.env.local` (you: aistudio.google.com, free tier) → AI reads brand → salts + strengths
- [ ] Confirm screen: user edits/accepts salts before any lookup
- [ ] Result card: US box names first, OTC/Rx, "Not sold in the US → ask a pharmacist"
- [ ] Clerk sign-in (you: create app, paste keys)
- [ ] Supabase `cabinet` table + RLS on (you: create project, paste keys)
- [ ] Same-drug overlap warning in cabinet (cheap once cabinet exists)
- [ ] GitHub repo (`gh repo create medmatch --public`)
- [ ] Vercel deploy, env vars set there, live link from day one (you: `npm i -g vercel`, `vercel login`)
- [ ] Agent walkthrough in browser as a new person; fix each stuck point

## 3. Test with real users (Nov 14–16): you, not the agent
- [ ] 3+ people (Aditi, Karthik, Lakshmi or UChicago Indian students)
- [ ] Give the core task, watch without helping, write what each did and said → `eval/user-tests.md`

## 4. Before you ship
- [ ] Keys only in env vars; `.env*` gitignored; nothing in git history
- [ ] Deny rule for `.env` in `.claude/settings.json`
- [ ] Supabase RLS on (Clerk user id = row owner)
- [ ] Gemini spending limit / free tier only; Vercel Hobby
- [ ] `/security-review`

## 5. Plan v2 + submit
- [ ] `V2_PLAN.md` from user-test notes (fix first / add / wait)
- [ ] Google Classroom: live URL + GitHub link + v2 plan
