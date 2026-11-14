# MedMatch v1: user tests

Live site: https://medmatch-xi.vercel.app · Tests run Nov 13–14, 2026.

## Real users

### Friend 1 (Indian student, currently in India)
- **Tried:** Paracetamol, Combiflam, Ciplox, Saridon, Crocin
- **Confused by:** "Why is there an 'Add ingredient' option on the 2nd page?" They didn't realise the AI's ingredient list is a draft you can correct.
- **Would use it?** "I'm not in the US, so it's not useful for me." Our target user is someone who has *already moved* to the US (or is packing to go), not students in India.
- **What we changed:** relabelled the button "+ Add another ingredient from the strip".
- **For v2:** say on the first screen who it's for ("Moved to the US with medicines from India?").

### Friend 2: "Pullu"
- **Tried:** cefoximine (misspelled cefixime), gastroaid, disprine (misspelled Disprin)
- **What broke:**
  - "gastroaid" showed a raw technical error ("Expected ':' after property name in JSON…").
  - "disprine" wasn't recognised as Disprin (aspirin).
  - "cefoximine": the app said "Did you mean Cefixime?" but left the boxes empty, because it only expected brand names, not ingredient names.
- **Also said:** "Why isn't your site path sensitive? 👎" The browser Back button left the site instead of going back a step.
- **What we changed:**
  - If the fast AI fails or doesn't recognise a name, a second, more careful pass runs (~4 s max) before saying "we don't recognise this".
  - Technical errors are never shown to the user.
  - Ingredient names (and misspellings of them) are now accepted directly.
  - Each step has its own URL (?step=confirm / ?step=result), so Back works.
- **Re-test:** cefoximine → cefixime ✅, disprine → Disprin (aspirin) ✅, gastroaid → "don't recognise" (correct; not a known Indian brand) ✅

<!-- Add Friend 3 here: medicines tried, where they got stuck, would they use it, what we changed. -->

## AI-agent walkthroughs (not real users)

These were run by an AI agent playing a new user, to find bugs before real tests. They are **not** user research.

| Run | Medicines | Result | Problem found |
|---|---|---|---|
| A | Crocin 500, Augmentin 625 Duo, made-up "Zorvanix 20" | Crocin ✅, unknown brand handled ✅ | Augmentin split into two cards; the amoxicillin card alone points to a weaker drug |
| B | "pan d" | ✅ correct | Saved without sign-in but header said "Sign in to save"; no "Saved" confirmation |
| C | Montair LC, "dolo650" | ✅ correct, typo caught | No warning that there's no single US combined pill; 650 mg Tylenol is the 8HR product |
| D | Meftal Spas, Benadryl cough syrup | Meftal ✅, Benadryl ❌ | US "Benadryl" is a different product (allergy pill), so "look for Benadryl" misleads |

Also: Crocin's mg box was left blank with no hint; unknown names sat on "Reading…" ~8 s with no feedback.

## Fixed in v1 after testing
- Combination medicines: banner says don't buy the parts separately, and names the combined product (e.g. "amoxicillin-clavulanic acid 500/125 mg").
- Same brand name in both countries (e.g. Benadryl): red warning to match by ingredients, not box name.
- Missing strength: amber hint to add the mg from the strip.
- Slow reads: "Still reading…" after 3 s. AI step moved to a faster model (~1 s).
- Saving: "✓ Saved on this device / to your account" message; header now says "Sign in to sync your cabinet".
- Typos: "combiflame" → "Did you mean Combiflam?"
- Clearer "+ Add another ingredient from the strip" button.
- First screen says who it's for ("Moved to the US with medicines from India?") with tappable examples (from Friend 1).
- Prescription results say where to get a US prescription (student health, urgent care, telehealth), as the proposal promised.
- From the AI eval (`eval/ai-results.csv`): the AI answers twice, and if the answers disagree a red "AI isn't sure" box appears, and you must tick that you checked the strip. Guessed strengths are no longer prefilled.
