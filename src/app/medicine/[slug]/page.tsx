// One server-rendered page per Indian brand ("Dolo 650 in the USA"): the channel people actually search on.
// Built from RxNorm/openFDA facts only; cached for a day (ISR).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandBySlug, describe, relatedBrands, summarize } from "@/lib/summary";
import { MedicineActions } from "@/components/MedicineActions";
import { Feedback } from "@/components/Feedback";
import { SymptomCard } from "@/components/SymptomCard";

// Rendered per request (the layout reads the Clerk session); the RxNorm/openFDA answers underneath are cached for a day.

const STATUS_LABEL = { otc: "Over the counter", rx: "Needs a prescription", not_sold: "Not sold in the US", unknown: "Couldn't check" } as const;
const STATUS_CLS = {
  otc: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  rx: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  not_sold: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  unknown: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = brandBySlug((await params).slug);
  if (!b) return {};
  const ings = b.salts.map((s) => s.name).join(" + ");
  const canonical = `/medicine/${b.slug}`;
  return {
    title: `${b.brand} in the USA: US equivalent and what to ask for | MedMatch`,
    description: `${b.brand} (${ings}) from India: its US name, whether you need a prescription, and which US brands to look for. Checked against NIH RxNorm and FDA listings.`,
    alternates: { canonical },
    openGraph: { title: `${b.brand} in the USA`, description: `What ${b.brand} is called at a US pharmacy.`, type: "article" },
  };
}

export default async function MedicinePage({ params }: { params: Promise<{ slug: string }> }) {
  const brand = brandBySlug((await params).slug);
  if (!brand) notFound();
  const s = await summarize(brand);
  const checked = new Date().toISOString().slice(0, 10);
  const ings = describe(brand);
  const usNames = s.matches.map((m) => m.usName ?? m.query).join(" + ");
  const needsRx = s.matches.some((m) => m.status === "rx");
  const notSold = s.matches.some((m) => m.status === "not_sold");

  const faq = [
    { q: `What is ${brand.brand} called in the USA?`, a: s.askFor },
    {
      q: `Can I buy ${brand.brand} without a prescription in the US?`,
      a: notSold ? `No. At least one ingredient (${s.matches.filter((m) => m.status === "not_sold").map((m) => m.usName ?? m.query).join(", ")}) isn't sold in the US.` : needsRx ? `Not all of it. ${s.matches.filter((m) => m.status === "rx").map((m) => m.usName ?? m.query).join(", ")} needs a US prescription.` : `Yes. ${usNames} is sold over the counter in the US.`,
    },
    {
      q: `Can I bring ${brand.brand} from India to the US?`,
      a: "The FDA generally lets travellers bring up to a 90-day personal supply in the original packaging, but it is decided case by case and some drugs aren't allowed. Carry the prescription or a doctor's letter, and check the FDA personal importation page before you fly.",
    },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        name: `${brand.brand} in the USA`,
        about: { "@type": "Drug", name: brand.brand, activeIngredient: brand.salts.map((x) => x.name).join(", "), nonProprietaryName: usNames },
        lastReviewed: checked,
        audience: { "@type": "PeopleAudience", audienceType: "Patients" },
      },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="text-sm text-zinc-500">
        <Link href="/medicines" className="hover:underline">All medicines</Link> / {brand.brand}
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{brand.brand} in the USA</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">Indian {brand.brand} contains {ings}.</p>

      <section className="mt-6 rounded-2xl border-2 border-teal-500 bg-teal-50 p-5 dark:border-teal-700 dark:bg-teal-950/40">
        <p className="text-sm font-medium text-teal-800 dark:text-teal-300">What to ask for at a US pharmacy</p>
        <p className="mt-1 text-xl font-semibold">{s.askFor}</p>
        <MedicineActions brand={brand.brand} askFor={s.askFor} lines={s.matches.map((m) => ({ india: `${m.query}${m.strengthMg ? ` ${m.strengthMg} mg` : ""}`, us: m.usName ?? m.query, status: STATUS_LABEL[m.status] }))} />
      </section>

      {s.symptoms && (
        <div className="mt-5">
          <SymptomCard plan={s.symptoms} />
        </div>
      )}

      {s.warnings.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <h2 className="font-semibold">Before you buy</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">{s.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Ingredient by ingredient</h2>
        <div className="mt-2 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {s.matches.map((m) => (
            <div key={m.query} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-zinc-500">India: {m.query}{m.strengthMg ? ` ${m.strengthMg} mg` : ""}</p>
                  <p className="text-lg font-semibold capitalize">US: {m.usName ?? "not found"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_CLS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
              </div>
              {m.brands.length > 0 && <p className="mt-2 text-sm">US brands: <b>{m.brands.join(", ")}</b>, or the generic.</p>}
              {!!m.alternatives?.length && (
                <p className="mt-2 text-sm">Over-the-counter options from the same drug family to ask about: {m.alternatives.map((a) => `${a.name}${a.brand ? ` (${a.brand})` : ""}`).join(", ")}. Not the same medicine.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4">
        <Feedback brand={brand.brand} source={`page-${brand.source}`} ingredients={describe(brand)} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Questions people ask</h2>
        <dl className="mt-2 space-y-4">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-zinc-700 dark:text-zinc-300">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {relatedBrands(brand).length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Similar Indian medicines</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {relatedBrands(brand).map((r) => (
              <Link key={r.slug} href={`/medicine/${r.slug}`} className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">{r.brand}</Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-900/50">
        <p className="font-semibold">Have a different medicine?</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Type any Indian brand and we&apos;ll find its US version.</p>
        <Link href="/" className="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 font-medium text-white hover:bg-teal-800">Check another medicine</Link>
      </section>

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        <p>Sources: <a className="underline" href="https://www.nlm.nih.gov/research/umls/rxnorm/" rel="noopener">RxNorm (U.S. National Library of Medicine)</a> and <a className="underline" href="https://open.fda.gov/apis/drug/ndc/" rel="noopener">openFDA drug listings</a>. {brand.source === "checked" ? "Ingredients from our hand-checked list of Indian brands." : <>Ingredients from the <a className="underline" href="https://github.com/junioralive/Indian-Medicine-Dataset" rel="noopener">Indian Medicine Dataset</a>{brand.maker ? ` (maker: ${brand.maker})` : ""}; check them against your strip.</>} Last checked {checked}.</p>
        <p className="mt-1">MedMatch finds the US name for the same ingredient. It is not medical advice and doesn&apos;t tell you what dose to take. Always confirm with a US pharmacist.</p>
      </footer>
    </main>
  );
}

