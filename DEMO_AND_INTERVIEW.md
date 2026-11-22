# MedMatch: demo script + interview cheat-sheet

Live: https://medmatch-xi.vercel.app · Repo: github.com/nocturnalvigilante/medmatch · Focus: **AI**

---

## 2-minute fair demo

**Bring:** laptop (homepage open), phone, 1–2 real Indian strips (Dolo, Combiflam), hotspot as backup.

| Time | Do | Say |
|---|---|---|
| 0:00 | Homepage | "363k Indian students in the US. Your Dolo runs out. What do you buy at CVS?" |
| 0:10 | Type `combiflme` (typo) | "Type-ahead over 209k Indian medicines. Typos are fine." |
| 0:20 | Pick Combiflam → confirm | "You check the ingredients against the strip. The AI never decides alone." |
| 0:30 | Result | "An AI agent called RxNorm and FDA tools: one US combo product, prescription status, what to ask for." |
| 0:45 | **Show to pharmacist** | "Big card for the counter, or share with family on WhatsApp." |
| 0:55 | Camera → photo of real strip | "Reads the composition printed on the foil, not the AI's memory." |
| 1:15 | Type `Torvalin 10` (fake) | "The AI guesses atorvastatin. Our eval caught that, so unknown brands force a strip check." |
| 1:30 | Type `Benadryl syrup` | "Same name, different medicine in the US. And a US cough-syrup plan by symptom." |
| 1:45 | `/accuracy` | "Every eval is public, failures included." |
| 1:55 | QR on homepage | "Scan it, try your own medicine." |

**If the AI is slow or down:** the list path (Dolo 650, Pan-D, Combiflam) needs no AI.

---

## Interview cheat-sheet (5–10 min, AI focus)

### One line
Indian medicine → US equivalent. AI reads the name or strip; US government data decides the match.

### How the AI is used
| Step | Model | Job | Guardrail |
|---|---|---|---|
| Read name | Gemini 3.5 Flash-Lite, asked **twice** in parallel | Brand → ingredients (only names on no list) | Disagreement or not on a list → user must tick "checked my strip" |
| Read photo | Gemini 3.5 Flash (vision) | Reads the printed composition | Cross-checked against our lists; mismatch flagged |
| What to ask for | Flash-Lite **with tools** | Agent writes the pharmacist answer | Only from tool results; max 4 turns, 8 tool calls |

**Tools:** `find_combination` · `products_at_strength` · `lookup_ingredient`. All of them call RxNorm (NIH) and openFDA.

**Data:** 47 hand-checked brands → 209k Indian medicines (MIT dataset) → AI fallback.

### Evals (`/accuracy`, `eval/`, `scripts/`)
| Eval | Result |
|---|---|
| Typed brands, production path | **30/30**, 0 AI calls, 8 ms median |
| Dataset vs hand check | **52/53** (Norflox differs → hand check wins) |
| Strip photos (synthetic) | **12/12** ingredients · 10/10 strengths · 2/2 refused to guess |
| Agent: right tools | **20/20** |
| Agent: agrees with combo lookup | **15/15** |
| Agent: no brands from memory | **20/20** |
| AI alone: real brands / typos | 28/30 · 8/8 |
| Made-up brands caught | 23/33 → fix → **30/30** |
| US name / OTC status | 42/42 · 42/42 |

### Failures we found → what we changed
- **Made-up brands:** "Torvalin 10" → confident atorvastatin, both answers → the double-ask missed 10/33 → **anything off our lists must be confirmed against the strip**.
- **"Duraflux" (v1):** invented at high confidence → **ask twice, flag disagreement**.
- **Drotin 40 → AI said 80 mg** → never prefill a guessed strength.
- **Tool run failed 1/20 (Gemini 503)** → retry once.
- **Photo "Pantoprazole Sodium eq. to Pantoprazole"** broke the lookup → extract the active ingredient.
- **Dataset only lists 2 ingredients** (a hidden paracetamol risks a double dose) → flag "may be missing one, check the strip".
- **"Acetaminophen not sold" (TA)** = wrong form → "sold, just not as an inhaler" + switch button.
- **Benadryl**: India = 3-ingredient syrup, US = diphenhydramine → automatic clash warning.

### Likely questions
- **Why not let the AI answer everything?** It invents. Our eval proves it (33/50 made-up brands). US facts come only from RxNorm/openFDA.
- **How do you know the agent doesn't hallucinate?** The tool-use eval checks each US brand it names against the tool output (20/20).
- **What's the riskiest failure?** A wrong ingredient reaching the result. Three layers stop it: the lists, the strip check, and the double-ask.
- **Cost?** $0. Free-tier Gemini with no billing, plus rate limits and token caps.
- **Security?** A fresh-session review found 9 issues, all fixed (`SECURITY.md`). Cabinet protected by RLS; keys only in env vars.
- **What would you do next?** Real-photo eval, more real users, Hindi, a shared rate limiter.
- **Monitoring?** Structured logs per lookup, plus "Was this right?" feedback → new eval cases.

### Users
- **v1:** a friend in India ("not for me") → clearer homepage; Pullu's typos → typo handling.
- **TA video:** type-ahead, speed, dead ends, value prop, hierarchy, cabinet → all fixed (`CHANGES_V2.md`).
- **v2 testers:** _fill in after testing_.
