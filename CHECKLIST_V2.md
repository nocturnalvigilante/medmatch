# MedMatch v2 checklist (due Tue Dec 1, 5:30 PM, project fair in class)

Focus: **AI** ("the app calls models itself, with tools, and evals to check how well it works"). Graders hold this part to a higher standard.
Ariel's feedback: (1) the match must be correct, so test what could go wrong; (2) stay on the main use case; (3) the interface matters (clear buttons and names, people with different skills); (4) photo of the strip later.

## 1. Plan → GitHub issues (Nov 18)
- [x] Turned V2_PLAN.md into GitHub issues #1–#12, with the stuck points (#1–#5) at the top: https://github.com/nocturnalvigilante/medmatch/issues
- [ ] Agree the order

## 2. Build v2, one slice at a time, deploying each (Nov 18–27)
**AI focus gap:** v1 calls a model, but not *with tools*. That is the biggest risk to the grade.
- [x] **AI with tools** (#6, `/api/advise`): Gemini picks and calls `find_combination`, `products_at_strength` and `lookup_ingredient`, then writes "What to ask for" from the tool results only.
  - Original goal: Gemini function calling. The model calls our RxNorm and openFDA lookups as tools, for example to find the combined US product or check a strength. US facts still come only from the tools, never from the model's memory.
- [x] **Combination matching** (#1): the `find_combination` tool gives Augmentin 500/125 for Augmentin 625 Duo; for Montair LC it says no US combination. Removed the v1 banner that guessed "ask for the combined product".
  - Was: (Augmentin, Montair LC): one card with the combined US product, or "no US combo, here's what to do"
- [~] **Strength → actual US product** (#3): the `products_at_strength` tool finds Tylenol 8 HR for 650 mg. The AI summary sometimes still says just "Tylenol"; check it in the eval.
- [ ] **Brand collision list** (Benadryl, and others), each with a specific warning
- [ ] **Syrups by symptom**, always with "ask a pharmacist"
- [ ] **OTC alternative** when the answer is prescription-only or not sold (Pan-D → omeprazole)
- [ ] **Photo of the strip** (Gemini vision) → brand and mg (Ariel; Pullu's typos)
- [ ] **Evals, grown and published:**
  - 50 made-up brands → "don't know vs guess" rate
  - 15 combination products
  - Photo-reading accuracy
  - Tool-call correctness
  - An eval page in the app or the README
- [ ] Show v2 to people again (**Aditi, Karthik, Lakshmi** plus 2 more in the US); write down where they got stuck

## 3. Design review (Nov 27–28)
- [ ] Screenshot every screen at 390 px and 1440 px
- [ ] Check visual hierarchy, spacing and type on each screen
- [ ] Design the **loading**, **empty** (new cabinet, no results) and **error** states (AI down, lookup failed, unknown brand)
- [ ] Fix every place where it's hard to tell what to do next

## 4. Security pass (Nov 28)
- [ ] API routes that read or change user data check who's signed in. Today `/api/read` and `/api/match` touch no user data, and the cabinet goes through Supabase RLS. Re-check any new route.
- [x] Supabase: explicit **grant** (select/insert/delete to `authenticated`, nothing to `anon`). Ran it; anon read now gets "permission denied".
- [ ] Keys out of the repo; `.env` deny rule (done in v1, re-check)
- [x] **Rate limit** on `/api/read` (15/min per IP, returns 429; tested) and **token cap** (`maxOutputTokens` 8192, input 80 chars). Add both to the photo route later.
- [ ] Fresh-session security review of the whole project → `SECURITY.md`: what we checked, found and fixed

## 5. Write-ups and submission
- [ ] `CHANGES_V2.md`: what changed since v1, and why (tied to user and instructor feedback)
- [ ] Commits that show the work since v1 (small commits per slice)
- [ ] Classroom: live URL + GitHub link + security pass

## 6. Fair and interview
- [ ] Practise a 2-minute demo; cut whatever is unclear
- [ ] Laptop with v2 deployed, on Dec 1 in person (no extension days)
- [ ] Week 9 interview (5–10 min): an AI-focused overview covering the model, tools, evals, failure cases and what we fixed
