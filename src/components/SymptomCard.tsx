import type { SymptomPlan } from "@/lib/symptoms";

// "Which US cough syrup do I buy?": one row per symptom the Indian medicine treats, with the US over-the-counter ingredient for it.
export function SymptomCard({ plan }: { plan: SymptomPlan }) {
  return (
    <section className="rounded-2xl border border-sky-300 bg-sky-50 p-5 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
      <h2 className="font-semibold">Buying a US cough or cold medicine instead</h2>
      <p className="mt-1 text-sm opacity-80">Indian syrups mix several medicines. In the US, pick only what matches your symptoms.</p>
      {plan.combined && (
        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm dark:bg-black/20">
          <b>One US product covers most of this:</b> {plan.combined.ingredients.join(" + ")}
          {plan.combined.brands.length ? ` (for example ${plan.combined.brands.join(", ")})` : ""}, {plan.combined.status}.
        </p>
      )}
      <ul className="mt-3 divide-y divide-sky-200 dark:divide-sky-900">
        {plan.lines.map((l) => (
          <li key={l.symptom} className="py-2.5 text-sm">
            <p className="font-medium">{l.symptom}</p>
            <p className="mt-0.5">
              {l.us ? (
                <>
                  US: <b className="capitalize">{l.us}</b>
                  {l.usBrands.length ? ` (${l.usBrands.join(", ")})` : ""}
                  {l.status ? `, ${l.status}` : ""}
                </>
              ) : (
                <b>No over-the-counter option</b>
              )}
              <span className="opacity-70">. In yours: {l.indian.join(", ")}.</span>
            </p>
            {l.note && <p className="mt-0.5 opacity-80">{l.note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs opacity-80">Check the active ingredients on the US box, don&apos;t take two products with the same ingredient, and don&apos;t give US cough and cold medicines to children under 4 without a doctor. Ask the pharmacist.</p>
    </section>
  );
}
