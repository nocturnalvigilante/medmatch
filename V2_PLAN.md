# MedMatch v2 plan

**Who it's for:** Indian students and families who have moved to the US (or are packing to go) with medicines from home, and need to know what to buy or ask for at a US pharmacy.

**What v1 does:** type the brand on the strip → AI proposes the ingredients → you confirm them → RxNorm and openFDA give the US name, OTC or prescription status, and shelf brands. You can save medicines to a cabinet (Clerk sign-in, Supabase with row-level security), and it warns when two saved medicines share an ingredient.

## What testing showed (see eval/user-tests.md)
1. **Combination medicines are the riskiest gap.** v1 shows one card per ingredient. For Augmentin, the amoxicillin card on its own points to a weaker drug. v1 now shows a warning banner, but it still doesn't look up the real combined US product.
2. **The same brand name can mean a different product.** Indian Benadryl cough syrup is not US Benadryl. v1 now warns about this, but only when the names match exactly.
3. **Strength matters, and people skip it.** 650 mg paracetamol in the US is "Tylenol 8HR", not regular Tylenol.
4. **Syrups need a different answer.** People want "which US cough syrup should I buy", not four ingredient cards.
5. **The audience wasn't clear.** A friend in India said it isn't useful to them. The first screen should say who it's for.

## v2 features, in priority order
1. **Real combination matching:** query RxNorm for the multi-ingredient product (for example, amoxicillin/clavulanate 500/125 → Augmentin), and show one card with one answer. Only fall back to separate cards when no combined US product exists.
2. **"What to ask for" by strength:** map the strength to the actual US product (for example, 650 mg → Tylenol 8HR Arthritis), and flag when the US has no matching strength.
3. **Brand collision list:** a curated list of names that mean different things in India and the US (Benadryl, Crocin vs Tylenol, and others), with a specific warning for each.
4. **Syrups and symptoms:** for multi-ingredient syrups, suggest the closest US OTC product by symptom (cough, cold, acidity), always with "ask a pharmacist".
5. **OTC alternatives:** when the answer is prescription-only or not sold, suggest an OTC option where one exists (for example, Pan-D → omeprazole/Prilosec), clearly labelled.
6. **Photo of the strip:** read the brand and mg from a photo, so nobody has to type salts.
7. **Clearer first screen:** "Moved to the US with medicines from India?" plus three example medicines to tap.

## Known accuracy issues (from the hand check of eval/match-results.csv)
- Ecosprin 75: the app says 75 mg is sold in the US, but US low-dose aspirin is 81 mg.
- Glycomet 500: it suggests Glumetza, which is extended-release. Plain metformin is sold as Glucophage.
- Some correct answers show no US brand name (amoxicillin, cefixime, ondansetron, telmisartan).

## Safety and cost
- The AI only proposes ingredients. US names and status always come from RxNorm and openFDA, and the user confirms the ingredients first.
- Keys live only in env vars (Vercel and `.env.local`). Supabase RLS limits each user to their own cabinet rows.
- Gemini runs on the free tier with no billing, so the maximum spend is $0. Vercel is on the Hobby plan.

## How we'll measure v2
- Hand-checked accuracy on 60+ salts, including 15 combination products (v1: 42/42 names and statuses).
- 5 real users who live in the US. Success means each one finds the right thing to buy, or knows to see a pharmacist, for 2 of their own medicines in under 2 minutes.
