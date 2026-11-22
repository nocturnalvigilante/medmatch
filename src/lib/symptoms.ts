// Syrups by symptom (v2 plan, finding 6): Indian cough/cold syrups mix 3-4 ingredients, many not sold in the US.
// People want "which US cough syrup do I buy?", not four ingredient cards. We map each ingredient to the job it does,
// name the US over-the-counter ingredient for that job, and get US brands and combined products from RxNorm/openFDA
// (never from memory). Always ends with "ask a pharmacist".
import { matchDrug, findCombination } from "@/lib/match";

type Job = { key: string; label: string; symptom: string; us?: string; note?: string; rxOnly?: boolean };
const JOBS: Record<string, Job> = {
  expectorant: { key: "expectorant", label: "Loosens mucus", symptom: "Chesty cough with phlegm", us: "guaifenesin" },
  suppressant: { key: "suppressant", label: "Calms a dry cough", symptom: "Dry, tickly cough", us: "dextromethorphan" },
  antihistamine: { key: "antihistamine", label: "Stops runny nose and sneezing", symptom: "Runny nose, sneezing", us: "chlorpheniramine" },
  decongestant: { key: "decongestant", label: "Unblocks the nose", symptom: "Blocked nose", us: "phenylephrine", note: "An FDA panel found oral phenylephrine doesn't work well as a decongestant. Pseudoephedrine works, but is kept behind the pharmacy counter and needs ID." },
  bronchodilator: { key: "bronchodilator", label: "Opens the airways", symptom: "Wheezing, tight chest", rxOnly: true, note: "Needs a US prescription (albuterol). If you are wheezing, see a doctor or urgent care." },
  fever: { key: "fever", label: "Fever and aches", symptom: "Fever, body ache", us: "acetaminophen" },
};

// Indian ingredient (first word is enough) → job, and the US ingredient when it's a different drug for the same job.
const ROLE: [RegExp, string, string?][] = [
  [/^guaifenesin/, "expectorant"],
  [/^ambroxol/, "expectorant", "guaifenesin"],
  [/^bromhexine/, "expectorant", "guaifenesin"],
  [/^ammonium chloride/, "expectorant", "guaifenesin"],
  [/^sodium citrate/, "expectorant", "guaifenesin"],
  [/^dextromethorphan/, "suppressant"],
  [/^codeine/, "suppressant", "dextromethorphan"],
  [/^chlorpheniramine|^chlorphenamine/, "antihistamine"],
  [/^diphenhydramine/, "antihistamine", "diphenhydramine"],
  [/^pheniramine/, "antihistamine", "chlorpheniramine"],
  [/^triprolidine/, "antihistamine", "chlorpheniramine"],
  [/^cetirizine/, "antihistamine", "cetirizine"],
  [/^levocetirizine/, "antihistamine", "levocetirizine"],
  [/^phenylephrine/, "decongestant"],
  [/^pseudoephedrine/, "decongestant", "pseudoephedrine"],
  [/^levosalbutamol|^salbutamol|^terbutaline/, "bronchodilator"],
  [/^paracetamol|^acetaminophen/, "fever"],
];

export type SymptomLine = { symptom: string; job: string; indian: string[]; us?: string; usBrands: string[]; status?: string; note?: string };
export type SymptomPlan = { lines: SymptomLine[]; combined?: { ingredients: string[]; brands: string[]; status: string } };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Returns a plan only for cough/cold medicines (2+ cough/cold jobs, or any cough/cold ingredient in a liquid). */
export async function symptomPlan(salts: string[], isLiquid: boolean): Promise<SymptomPlan | undefined> {
  const byJob = new Map<string, { indian: string[]; us?: string; swap?: boolean }>(); // swap: a different drug does this job in the US
  for (const raw of salts) {
    const name = raw.toLowerCase().trim();
    const hit = ROLE.find(([re]) => re.test(name));
    if (!hit) continue;
    const job = JOBS[hit[1]];
    const entry = byJob.get(job.key) ?? { indian: [], us: hit[2] ?? job.us, swap: !!hit[2] };
    entry.indian.push(name);
    byJob.set(job.key, entry);
  }
  const coldJobs = [...byJob.keys()].filter((k) => k !== "fever");
  if (!coldJobs.length || (coldJobs.length + (byJob.has("fever") ? 1 : 0) < 2 && !isLiquid)) return undefined;

  const lines: SymptomLine[] = await Promise.all(
    [...byJob].map(async ([key, e]) => {
      const job = JOBS[key];
      if (job.rxOnly || !e.us) return { symptom: job.symptom, job: job.label, indian: e.indian, usBrands: [], note: job.note };
      const m = await matchDrug(e.us, undefined, "oral");
      const usName = m.usName ?? e.us;
      const swapped = !!e.swap && !e.indian.some((i) => i.startsWith(e.us!.slice(0, 6)));
      const renamed = !swapped && !e.indian.some((i) => i.startsWith(usName.slice(0, 6))); // paracetamol → acetaminophen: same drug
      return {
        symptom: job.symptom,
        job: job.label,
        indian: e.indian,
        us: m.usName ?? e.us,
        usBrands: m.brands.slice(0, 3),
        status: m.status === "otc" ? "over the counter" : m.status === "rx" ? "needs a prescription" : m.status === "not_sold" ? "not sold" : undefined,
        note:
          [
            swapped ? `${cap(e.indian.join(" and "))} ${e.indian.length > 1 ? "aren't" : "isn't"} sold for this in the US; ${usName} does the same job.` : "",
            renamed ? `Same medicine: ${e.indian[0]} is called ${usName} in the US.` : "",
            job.note ?? "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      };
    }),
  );

  // One US product covering the main jobs (e.g. guaifenesin + dextromethorphan → Robitussin DM / Mucinex DM), if RxNorm/openFDA list one.
  const usIngs = [...new Set(lines.filter((l) => l.us && l.status === "over the counter" && l.us !== "phenylephrine").map((l) => l.us!))];
  let combined: SymptomPlan["combined"];
  for (const set of [usIngs, usIngs.filter((u) => u !== "acetaminophen")]) {
    if (set.length < 2) continue;
    const c = await findCombination(set);
    if ("found" in c && c.found) {
      combined = { ingredients: c.usIngredients ?? set, brands: (c.brands ?? []).slice(0, 3), status: c.status === "otc" ? "over the counter" : "needs a prescription" };
      break;
    }
  }
  return { lines, combined };
}
