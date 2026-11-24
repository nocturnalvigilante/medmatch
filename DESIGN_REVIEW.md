# Design review (v2)

Every page and every state of the core task was opened in a fresh headless browser at **390 px** (phone) and **1440 px** (laptop) on the live site, and screenshotted. All screenshots are in [`docs/design-review/`](docs/design-review/).

## What was checked
| Screen | Phone | Laptop |
|---|---|---|
| Home (empty) | [390](docs/design-review/390-01-home.jpg) | [1440](docs/design-review/1440-01-home.jpg) |
| Type-ahead while typing "dol" | [390](docs/design-review/390-02-typeahead.jpg) | [1440](docs/design-review/1440-02-typeahead.jpg) |
| Ingredients step (Dolo 650) | [390](docs/design-review/390-03-confirm.jpg) | [1440](docs/design-review/1440-03-confirm.jpg) |
| Result, loading | [390](docs/design-review/390-04-result-loading.jpg) | [1440](docs/design-review/1440-04-result-loading.jpg) |
| Result | [390](docs/design-review/390-05-result.jpg) | [1440](docs/design-review/1440-05-result.jpg) |
| Unknown brand, reading | [390](docs/design-review/390-06-unknown-reading.jpg) | [1440](docs/design-review/1440-06-unknown-reading.jpg) |
| Unknown brand ("Zorvanix 20") | [390](docs/design-review/390-07-unknown-brand.jpg) | [1440](docs/design-review/1440-07-unknown-brand.jpg) |
| "Which one is on your strip?" picker (Asthalin) | [390](docs/design-review/390-08-picker.jpg) | [1440](docs/design-review/1440-08-picker.jpg) |
| Typed an ingredient ("acetaminophen") | [390](docs/design-review/390-09-ingredient-typed.jpg) | [1440](docs/design-review/1440-09-ingredient-typed.jpg) |
| Medicine page (/medicine/dolo-650) | [390](docs/design-review/390-10-medicine-page.jpg) | [1440](docs/design-review/1440-10-medicine-page.jpg) |
| Medicines A–Z | [390](docs/design-review/390-11-medicines.jpg) | [1440](docs/design-review/1440-11-medicines.jpg) |
| Before you fly | [390](docs/design-review/390-12-before-you-fly.jpg) | [1440](docs/design-review/1440-12-before-you-fly.jpg) |
| Accuracy | [390](docs/design-review/390-13-accuracy.jpg) | [1440](docs/design-review/1440-13-accuracy.jpg) |
| Page not found | [390](docs/design-review/390-14-not-found.jpg) | [1440](docs/design-review/1440-14-not-found.jpg) |

## What we found and fixed
| # | Screen | Problem | Fix | After |
|---|---|---|---|---|
| 1 | Typed an ingredient | Typing "acetaminophen" went to the AI, which renamed it to paracetamol. That set off the red "this brand isn't on our checked list, could be a guess" warning and the jargon "USAN name / INN name". | Known ingredient names are recognised before the AI: instant, no AI call, no warning. The message says it's an ingredient, so there's no brand to check. | [390](docs/design-review/fix-ingredient.jpg) |
| 2 | Unknown brand | The AI's own sentence was shown under ours ("…is not a recognized major Indian medicine brand. Unable to determine active ingredients"), saying the same thing twice in robot language. "Find the US version" was clickable with no ingredients. There was no way to try a photo. | Our message only ("Check the spelling, or type the ingredients printed on the back of the strip"). A "Take a photo of the strip instead" button. "Find the US version" stays disabled until an ingredient is typed. | [390](docs/design-review/fix-unknown.jpg) |
| 3 | Page not found | A mistyped link showed Next.js's bare "404 This page could not be found", a dead end. | A designed page that explains what happened, with "Look up a medicine" and "Browse medicines A–Z". | [390](docs/design-review/fix-404.jpg) |
| 4 | Typed an ingredient | "Check the mg on the strip" appeared twice (text and yellow hint). | Kept only the yellow hint. | |

## What held up
- **Hierarchy:** each screen has one heading and one main action. The step bar (Name → Ingredients → US match) shows where you are, and the result leads with "What to ask for".
- **Loading states:** the result shows the US details at once, with a skeleton for the AI summary ("Checking US combination products… The details below are already ready"). A slow name says the AI is reading it.
- **Empty states:** the home page explains the 3 steps, with tappable examples and popular medicines. The before-you-fly checklist starts at 0/8 with a progress bar.
- **Error states:** an unknown brand, "none of these" in the picker, a missing strength (yellow hint) and the AI being down ("Try the summary again") each say what to do next.
- **Phone and laptop:** no horizontal scrolling at 390 px. Buttons are full-width on phones, and the laptop home page splits into the search field and the "How it works" panel, as the TA suggested.
