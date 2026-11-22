# What changed in v2, and why

v1 answered one medicine at a time for people who already found the site, and it was slow and fragile. v2 makes the main task faster and safer, fulfils the AI promises in the proposal (photo of the strip, an AI that calls tools, published evals), and adds the pages people actually search for.

## From the TA's v1 feedback (video, Nov 19)
| Feedback | What we changed |
|---|---|
| "Can you clarify the value prop… a little 1, 2, 3" | Homepage is split in two: one big search field on the left, a gradient "How it works" panel with 3 steps and a real example on the right. |
| "People spelling things wrong… type-ahead functionality" | A dropdown suggests brands and ingredients as you type, and copes with typos ("combiflme" → Combiflam). RxNorm spelling suggestions fill in when our list has nothing ("acetominophin" → acetaminophen). Ingredient fields have type-ahead too. |
| "This took a long time, sometimes up to a full minute or two" | Hand-checked brands answer in about 0.3 s with no AI call (was about 7 s). RxNorm and openFDA answers are cached for a day across requests, and openFDA lookups run in parallel. A US lookup now takes under 1 s; the AI summary takes 3–9 s and no longer blocks the results. Every wait shows what's happening. |
| "Not sold in the U.S.… to me this is a dead end" | When the drug is sold in another form, we say so ("Acetaminophen is sold in the US, but not as an inhaler") with a button to switch. When it isn't sold at all, we say it's not a spelling mistake and suggest over-the-counter medicines from the same drug family to ask about. |
| "Paracetamol… it's unclear" | Cards explain renames: "Same medicine, different name: India says paracetamol, the US says acetaminophen." |
| "I want to say no, no, I had it right" | Misspelling cards offer "Yes, use X" and "No, I typed it right"; the second explains what to do next. |
| "My cabinet just disappeared" | Medicines saved before signing in move into the account. |
| "Where does my eye look?… what is the hierarchy?" | MedMatch is now a small logo; each screen has one heading and one main action. A step bar shows Name → Ingredients → US match. Results are ordered: answer, warnings, details, next steps. |

## From the proposal and earlier feedback
- **Photo of the strip** (proposal; Ariel twice). The camera button reads the *composition printed on the strip*, so the ingredients come from the foil, not the model's memory. If the photo disagrees with our checked list, we flag it.
- **AI with tools** (`/api/advise`). Gemini calls `find_combination`, `products_at_strength` and `lookup_ingredient` (RxNorm + openFDA) and writes "what to ask for" only from what they return.
- **Card to show the pharmacist**, plus sharing to WhatsApp and family (proposal: "shareable card").
- **Published evals** at `/accuracy` (proposal: "a public eval page").

## Reaching people who need it
Research showed real search demand ("dolo 650 in usa", "pan d equivalent in usa", "paracetamol in usa name") that no site answers well.
- **One page per medicine** (`/medicine/dolo-650`, …) with the US answer, warnings, an FAQ, structured data, a sitemap and share images.
- **Before you fly**: an 8-item checklist for students and parents packing medicines (90-day supply, prescriptions, controlled drugs, medicines the US doesn't sell).

## Evals (all re-runnable; results in `eval/`)
- Photo reading: `npm run photo-test` → `eval/photo-results.csv`
- Tool use: `npm run tools-test` → `eval/tools-results.csv`
- Name reading, with 50 made-up brands: `npm run ai-test` → `eval/ai-results.csv`
- US match: `npm run match-test` → `eval/match-results.csv`

The latest numbers are on `/accuracy`.

**What the evals changed:**
- **Made-up brands.** On 50 made-up names, the AI invented ingredients for 33. Our v1 safety check (ask twice, flag disagreement) caught only 23. Drug-sounding names like "Torvalin 10" got atorvastatin, confidently, both times. **Fix:** any brand not on our hand-checked list must be confirmed against the strip. Re-run: 30/30 guesses caught.
- **Tool use.** The first run failed 1 of 20 on a transient Gemini 503, so `/api/advise` now retries once. Re-run: right tools 20/20, agrees with the combination lookup 15/15, no US brands from memory 20/20.
- **Photo reading.** Composition lines like "Pantoprazole Sodium IP eq. to Pantoprazole 40 mg" came back as the whole phrase, which breaks the US lookup. We now extract the active ingredient. Re-run: 12/12 ingredients, 10/10 strengths, 2/2 refused to guess.

## Security
See [`SECURITY.md`](SECURITY.md).
