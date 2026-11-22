# data/india/

About 209,000 Indian medicines that are still sold, in forms a traveller carries (oral, inhaled, topical, eye), with their ingredients and strengths.

- **Source:** [Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset) (`DATA/updated_indian_medicine_data.csv`), MIT license. See [`LICENSE-indian-medicine-dataset.txt`](LICENSE-indian-medicine-dataset.txt).
- **Built by:** `python3 scripts/build-india.py updated_indian_medicine_data.csv data/india`
- **Files:** one per first letter (`a.json` … `z.json`), rows sorted by name, plus `top.json` (popular names for the sitemap). A search only loads one letter.
- **Row format:** `[name, form (o/i/t/e/a), [[ingredient, strength]], maker, complete (1/0), popularity rank, base key]`
- **`complete = 0`:** the source only had its two short ingredient columns for this medicine, and some strips list a third ingredient. The app asks the user to check the strip for these.
- **Checked against our hand-checked brands:** `python3 scripts/dataset-check.py` → `eval/dataset-check.json` (52/53 agree).
