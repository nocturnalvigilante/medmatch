# MedMatch v2 checklist (due Tue Dec 1, 5:30 PM, project fair in class)

Focus: **AI** ("the app calls models itself, with tools, and evals to check how well it works"). Graders hold this part to a higher standard.
Ariel's feedback: (1) the match must be correct, so test what could go wrong; (2) stay on the main use case; (3) the interface matters (clear buttons and names, people with different skills); (4) photo of the strip later.

## 1. Plan → GitHub issues
- [x] Turned V2_PLAN.md into GitHub issues #1–#12, with the stuck points (#1–#5) at the top: https://github.com/nocturnalvigilante/medmatch/issues
- [x] Worked through them in order; #1–#11 are closed, each with a link to the commit that did it

## 2. Build v2, one slice at a time, deploying each
- [x] **AI with tools** (#6, `/api/advise`): Gemini picks and calls `find_combination`, `products_at_strength` and `lookup_ingredient`, then writes "What to ask for" from the tool results only
- [x] **Combination matching** (#1): Augmentin 625 Duo → Augmentin 500/125; Montair LC → no US combination, with what to do
- [x] **Strength → actual US product** (#3): Dolo 650 → Tylenol 8 HR (checked live)
- [x] **Brand names that mean a different US product** (#2): Benadryl, and automatic warnings from the dataset
- [x] **Syrups by symptom** (#5), always with "ask a pharmacist"
- [x] **OTC alternative** (#7): Pan-D → Prilosec or Nexium (checked live)
- [x] **First screen** (#4): who it's for, and that the AI list is a draft
- [x] **Photo of the strip** (#8, Gemini vision)
- [x] **Evals, grown and published** (#9) at https://medmatch-xi.vercel.app/accuracy:
  - 50 made-up brands → 30 of 30 inventions caught after the fix
  - 15 combination products, and tool-call correctness (20 cases)
  - 100 real product photos plus 12 test images (the proposal promised 50)
- [ ] **Show v2 to people again** (#12): **Aditi, Karthik, Lakshmi** plus 2 more in the US, by about Nov 28; write down where they got stuck → `eval/user-tests.md`

## 3. Design review (#10)
- [x] Screenshot every screen at 390 px and 1440 px
- [x] Check hierarchy, spacing and type on each screen
- [x] Loading, empty and error states (AI down, unknown brand, page not found)
- [x] Fixed 4 problems → [`DESIGN_REVIEW.md`](DESIGN_REVIEW.md)

## 4. Security pass (#11)
- [x] No API route touches user data; the cabinet is protected by Supabase row-level security
- [x] Supabase grant: nothing to `anon`; checked live
- [x] Keys out of the repo and its full history; `.env` deny rule
- [x] Rate limits and token caps on every route
- [x] Fresh-session review: 10 findings, all fixed → [`SECURITY.md`](SECURITY.md)
- [ ] Two hand steps listed at the end of `SECURITY.md` (wider deny rules; run the new constraints in the Supabase SQL editor)

## 5. Write-ups and submission
- [x] [`CHANGES_V2.md`](CHANGES_V2.md): what changed since v1, and why
- [x] Small commits per slice since v1
- [ ] **Google Classroom by Dec 1, 5:30 PM:**
  - Live link: https://medmatch-xi.vercel.app
  - GitHub link: https://github.com/nocturnalvigilante/medmatch
  - Security pass: https://github.com/nocturnalvigilante/medmatch/blob/main/SECURITY.md

## 6. Fair and interview
- [ ] Practise the 2-minute demo in [`DEMO_AND_INTERVIEW.md`](DEMO_AND_INTERVIEW.md)
- [ ] Laptop with v2 open, Dec 1 in person (no extension days)
- [ ] Week 9 interview (5–10 min), AI-focused: model, tools, evals, failure cases, what we fixed
