import type { Metadata } from "next";
import Link from "next/link";
import { PackingChecklist } from "@/components/PackingChecklist";

export const metadata: Metadata = {
  title: "Bringing medicines from India to the US: checklist before you fly | MedMatch",
  description: "What students and parents should check before packing Indian medicines for the US: the 90-day rule, prescriptions, controlled drugs, and medicines the US doesn't sell.",
  alternates: { canonical: "/before-you-fly" },
};

const ITEMS = [
  { id: "orig", title: "Keep every medicine in its original strip or box", body: "The printed label shows the name and ingredients. Loose tablets in a pill box are hard to identify at customs and at a US pharmacy." },
  { id: "rx", title: "Carry the prescription or a doctor's letter", body: "One letter from your doctor listing each medicine, its generic (ingredient) name, strength and why you take it. Ask for it in English." },
  { id: "90", title: "Bring no more than about a 90-day supply", body: "The FDA generally allows a personal supply of up to about 90 days, decided case by case. More than that can look commercial." },
  { id: "carry", title: "Pack medicines in your carry-on", body: "Checked bags get delayed. Keep at least a week's supply with you." },
  { id: "controlled", title: "Check for controlled medicines", body: "Medicines with codeine, tramadol, alprazolam, clonazepam or other sleep, anxiety or strong pain medicines are controlled in the US. Carry the prescription and declare them." },
  { id: "notsold", title: "Know which ones the US doesn't sell", body: "Nimesulide, aceclofenac, drotaverine and domperidone aren't sold in the US. Once they run out you'll need a US alternative from a doctor or pharmacist." },
  { id: "us", title: "Look up the US name of each medicine now", body: "Paracetamol is acetaminophen in the US; salbutamol is albuterol. Knowing the name saves time when you're sick and the strip runs out." },
  { id: "declare", title: "Declare medicines if asked", body: "Answer honestly on the customs form and keep medicines easy to show." },
];

export default function BeforeYouFly() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <p className="text-sm font-medium uppercase tracking-wider text-teal-700 dark:text-teal-400">For students and parents</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Before you fly: packing medicines from India</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Eight things to check before you pack. Tick them off; we remember your progress on this device.</p>

      <PackingChecklist items={ITEMS} />

      <section className="mt-8 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 p-6 text-white">
        <h2 className="text-xl font-semibold">Find the US names for everything you&apos;re packing</h2>
        <p className="mt-1 text-teal-50/90">Add each medicine to your cabinet, then show the list to a US pharmacist when you need a refill.</p>
        <Link href="/" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 font-medium text-teal-900 hover:bg-teal-50">Start with your first medicine</Link>
      </section>

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        <p>Sources: <a className="underline" href="https://www.fda.gov/industry/import-basics/personal-importation" rel="noopener">FDA: Personal importation</a> and <a className="underline" href="https://www.cbp.gov/travel/us-citizens/know-before-you-go/prohibited-and-restricted-items" rel="noopener">U.S. Customs and Border Protection: prohibited and restricted items</a>. Rules change and officers decide at the border; check these pages before you travel.</p>
        <p className="mt-1">Not legal or medical advice.</p>
      </footer>
    </main>
  );
}
