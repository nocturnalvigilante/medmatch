# MedMatch v2 plan

**Who it's for:** Indian students and families who have moved to the US (or are packing to go) with medicines from home, and need to know what to buy or ask for at a US pharmacy.

**What v1 does:** type the brand on the strip → AI proposes the ingredients → you confirm them → RxNorm and openFDA give the US name, OTC or prescription status, and shelf brands. You can save medicines to a cabinet (Clerk sign-in, Supabase with row-level security), and it warns when two saved medicines share an ingredient.

## What we saw when people used v1 (details in eval/user-tests.md)

**Real users**
1. **Friend 1 (in India) didn't see who it was for:** "I'm not in the US, so it's not useful for me." They also didn't understand why page 2 had an "add ingredient" button. They didn't realise the AI's list is a draft you check against the strip.
2. **Friend 2 (Pullu) typed the way people really type:** misspellings ("disprine", "cefoximine"), an ingredient name instead of a brand, and a brand the AI didn't know ("gastroaid"). v1 showed a raw technical error and missed both typos. Pullu also expected the browser Back button to go back one step.

Both are fixed in v1 (friendly errors, typo and ingredient handling, a URL for each step). The deeper problems underneath them are in the plan below.

**AI-agent walkthroughs (bug hunting, not user research)**

3. **Combination medicines are the riskiest gap.** For Augmentin, the amoxicillin card on its own points to a weaker drug. v1 now warns about this, but it doesn't look up the real combined US product.
4. **The same brand name can mean a different product.** Indian Benadryl cough syrup is not US Benadryl. v1 warns about this only when the names match exactly.
5. **Strength matters, and people skip it.** 650 mg paracetamol in the US is "Tylenol 8HR", not regular Tylenol.
6. **Syrups need a different answer.** People want "which US cough syrup should I buy", not four ingredient cards.

## Fix first
1. **Clearer first screen** (from Friend 1): v1 now says "Moved to the US with medicines from India?" and has three example medicines to tap. v2 adds a 3-step picture of how it works, and one line saying the AI's list is a draft to check against the strip.
2. **Real combination matching** (from finding 3): ask RxNorm for the multi-ingredient product (for example, amoxicillin/clavulanate 500/125 → Augmentin) and show one card with one answer. Show separate cards only when the US has no combined product.
3. **Brand collision list** (from finding 4): a hand-kept list of names that mean different things in India and the US (Benadryl, Crocin vs Tylenol, and others), with a specific warning for each.

## Add next
4. **"What to ask for" by strength** (from finding 5): map the strength to the actual US product (for example, 650 mg → Tylenol 8HR Arthritis), and say plainly when the US has no matching strength.
5. **Syrups and symptoms** (from finding 6): for multi-ingredient syrups, suggest the closest US OTC product by symptom (cough, cold, acidity), always with "ask a pharmacist".
6. **OTC alternatives:** when the answer is prescription-only or not sold, suggest a clearly labelled OTC option where one exists (for example, Pan-D → omeprazole/Prilosec).

## Wait
7. **Photo of the strip:** read the brand and mg from a photo. Pullu's typos show typing is a real pain point, but it can wait until the answers above are right.

## AI reading (from eval/ai-results.csv)
- **Real brands:** ingredients right 30/30, and strengths right whenever the AI fills one in. Typos from testers: 8/8.
- **The real risk is invention.** Asked about made-up brands, the AI invented ingredients 3 times out of 8, once at "high" confidence. v1 now asks twice and flags any disagreement, which caught all 3. The user must then confirm against the strip.
- **The AI got a strength wrong:** it guessed 80 mg for Drotin, which is 40 mg. v1 now leaves the mg box empty unless the strength is in the name.
- **For v2:**
  - Grow the made-up-brand test to 50 names and publish the "don't know vs guess" rate, as the proposal promised.
  - Look up brands in a real Indian drug list (for example, CDSCO-approved brands) before trusting the AI.
  - Photo of the strip, so the ingredients and mg are read off the actual box, not from memory.

## Matching accuracy (from the hand check of eval/match-results.csv)
- v1 gets the US name right 42/42 times and the OTC/Rx status 42/42.
- Fixed during the hand check:
  - Ecosprin 75 had said 75 mg is sold in the US. It now says it isn't; US low-dose aspirin is 81 mg.
  - Glycomet 500 now labels Glumetza as extended-release.
- Still open: some correct answers show no US brand name (amoxicillin, cefixime, ondansetron, telmisartan). v2 will show the generic as the thing to ask for.

## Safety and cost
- The AI only proposes ingredients. US names and status always come from RxNorm and openFDA, and the user confirms the ingredients first.
- Keys live only in env vars (Vercel and `.env.local`), and an agent deny rule blocks `.env`. Supabase row-level security limits each user to their own cabinet rows.
- Gemini uses a free-tier key with no billing, so the maximum spend is $0. Vercel is on the Hobby plan.

## How we'll measure v2
- Hand-checked matching accuracy on 60+ salts, including 15 combination products (v1: 42/42 names and statuses).
- AI on 50 made-up brands: no invented ingredients reach the result page without the user confirming them against the strip (v1: 3/3 caught out of 8).
- 5 real users who live in the US. Success means each one finds the right thing to buy, or knows to see a pharmacist, for 2 of their own medicines in under 2 minutes, without help.
