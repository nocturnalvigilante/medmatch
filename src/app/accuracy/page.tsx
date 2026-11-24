// Public eval page (proposal promise): how often each AI step is right, and how often it says "don't know" instead of guessing.
// Numbers are read from the eval files the test scripts write, so this page can't drift from the latest run.
import type { Metadata } from "next";
import Link from "next/link";
import photo from "../../../eval/photo-summary.json";
import tools from "../../../eval/tools-summary.json";
import ai from "../../../eval/ai-summary.json";
import match from "../../../eval/match-summary.json";
import readSum from "../../../eval/read-summary.json";
import dataset from "../../../eval/dataset-check.json";

export const metadata: Metadata = {
  title: "How accurate is MedMatch? Our evals | MedMatch",
  description: "How often MedMatch's AI reads Indian medicine names and strip photos correctly, how often it refuses to guess, and how its US matches are checked.",
  alternates: { canonical: "/accuracy" },
};

const REPO = "https://github.com/nocturnalvigilante/medmatch/blob/main";

function Tile({ big, label, detail, tone = "teal" }: { big: string; label: string; detail: string; tone?: "teal" | "amber" }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <p className={`text-3xl font-semibold tabular-nums ${tone === "teal" ? "text-teal-700 dark:text-teal-400" : "text-amber-700 dark:text-amber-400"}`}>{big}</p>
      <p className="mt-1 font-medium">{label}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

export default function Accuracy() {
  const m = match;
  const real = ai.real, typo = ai.typo, fake = ai.fake;
  const date = (s: string) => s.slice(0, 10);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <p className="text-sm font-medium uppercase tracking-wider text-teal-700 dark:text-teal-400">Evals</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">How accurate is MedMatch?</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        We test every AI step against answers we checked by hand, and publish the results, including the failures. The rule throughout: when the AI isn&apos;t sure, it should say so instead of guessing.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">How a lookup works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["1 · Find the medicine", "Your typed name is matched against 209,000 Indian medicines (and our hand-checked list). Only unknown names, and photos, go to the Gemini AI, which only proposes ingredients."],
            ["2 · You confirm", "You check the ingredients against the strip. If the AI isn't sure, you have to tick that you checked."],
            ["3 · US sources decide", "NIH RxNorm and FDA listings give the US name and OTC status. An AI agent then calls these as tools to write what to ask for."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/50">
              <p className="font-semibold">{t}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Finding a typed medicine</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Tile big={`${readSum.right}/${readSum.brands}`} label="Right ingredients" detail={`Real Indian brands typed the way people type them. ${readSum.pickerShown} showed a “which one is on your strip?” choice that included the right one.`} />
          <Tile big={`${(readSum.bySource as Record<string, number>).ai ?? 0}`} label="Needed the AI" detail={`All found in our hand-checked list or the 209,000-medicine list, in a median ${Math.round(readSum.medianSeconds * 1000)} ms.`} />
          <Tile big={`${dataset.agree}/${dataset.found}`} label="List agrees with hand check" detail={`Where our hand-checked brands appear in the public Indian medicine list, the ingredients match. The one difference (${dataset.disagreements.join(", ")}) uses our hand check.`} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Source list: <a className="underline" href="https://github.com/junioralive/Indian-Medicine-Dataset">Indian Medicine Dataset</a> (MIT), {dataset.medicines.toLocaleString()} medicines still sold. Where it lists only two ingredients, you&apos;re asked to check the strip for a third.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reading a photo of the strip</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Tile big={`${photo.ingredientsRight}/${photo.photos}`} label="Ingredients right" detail="Read from the composition printed on the strip or box: fronts, backs, close-ups, blurry and hologram foil." />
          <Tile big={`${photo.strengthRight}/${photo.strengthChecked}`} label="Strength right" detail={photo.strengthRight === photo.strengthChecked ? "Every mg value it read matched the label." : "Photos where the mg it read matched the label."} />
          <Tile big={`${photo.refusedToGuess}/${photo.unreadable}`} label="Refused to guess" detail="Photos with no readable composition (or not a medicine) got no ingredients, not a guess." />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Test set: {photo.byKind?.web?.photos ?? 0} real product photos of Indian medicines from an online pharmacy (each labelled by hand from what is printed in it), plus {photo.byKind?.synthetic?.photos ?? 0} rendered strips with tilt, blur and glare. Photos showing only the brand count as right if the app fills in from our checked list or asks for the back. {photo.serviceErrors ? `${photo.serviceErrors} photos got no answer because the free AI tier was busy; they are not scored. ` : ""}Last run {date(photo.ranAt)}. <a className="underline" href={`${REPO}/eval/photo-results.csv`}>Every result</a></p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">When the AI has to read a name</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">For names on neither list. Tested on the AI alone, with the lists switched off.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Tile big={`${real.ok}/${real.n}`} label="Real Indian brands" detail={`Ingredients right. Strength right ${real.strengthRight}/${real.strengthChecked} when given.`} />
          <Tile big={`${typo.ok}/${typo.n}`} label="Misspellings" detail="Real typos from testers, like “disprine” and “cefoximine”." />
          <Tile big={`${ai.fakeInventedFlaggedFinal}/${ai.fakeInventedFinal}`} label="Made-up brands: guesses caught" detail={`On ${fake.n} made-up brands the AI said “don't know” ${fake.ok} times and guessed the rest. Every guess now makes you confirm against the strip before we look anything up.`} />
        </div>
        <div className="mt-3 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/50">
          <p className="font-medium">What this eval changed</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            At first our only safety check was asking the AI twice and flagging disagreement. On 50 made-up brands that caught {ai.fakeInventedFlagged} of {ai.fakeInvented} guesses: names like “Torvalin 10” got the drug they sound like (atorvastatin), confidently, both times. So now any brand that isn&apos;t on our hand-checked list must be confirmed against the strip. Re-run: {ai.fakeInventedFlaggedFinal} of {ai.fakeInventedFinal} caught. The cost: real brands that aren&apos;t on the list also ask for one extra tick.
          </p>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Last run {date(ai.ranAt)}. <a className="underline" href={`${REPO}/eval/ai-results.csv`}>Every result</a></p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">The AI agent that writes &ldquo;what to ask for&rdquo;</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Tile big={`${tools.toolChoiceRight}/${tools.cases}`} label="Called the right tools" detail="Combinations always checked for one US product; strengths checked against US products." />
          <Tile big={`${tools.agreesWithTool}/${tools.comboCases}`} label="Agreed with the lookup" detail="On 15 combination medicines, its answer matched what RxNorm/openFDA returned." />
          <Tile big={`${tools.noUngroundedBrands}/${tools.cases - tools.routeFailed}`} label="No brands from memory" detail="Every US brand it named came from a tool result." />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Last run {date(tools.ranAt)}. <a className="underline" href={`${REPO}/eval/tools-results.csv`}>Every result</a></p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">The US match itself</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Tile big={`${m.name}/${m.n}`} label="US name right" detail="Ingredients from common Indian medicines, checked by hand." />
          <Tile big={`${m.status}/${m.n}`} label="OTC / prescription right" detail="Whether you can buy it without a prescription in the US." />
        </div>
        <p className="mt-2 text-xs text-zinc-500"><a className="underline" href={`${REPO}/eval/match-results.csv`}>Every result</a></p>
      </section>

      <section className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <h2 className="font-semibold">Known limits</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Photo tests so far use synthetic strips; real creased foil is harder.</li>
          <li>The AI still proposes ingredients for most made-up brands ({ai.fakeInvented} of {fake.n}). It&apos;s only safe because brands off our checked list must be confirmed against the strip.</li>
          <li>It missed 2 of 30 real brands (it said “don&apos;t know” for Levocet; Sinarest has several versions). Saying “don&apos;t know” is the safe failure.</li>
          <li>US availability changes; we re-check our sources daily, but always confirm with a pharmacist.</li>
        </ul>
      </section>

      <p className="mt-8 text-sm"><Link href="/" className="underline">Try MedMatch</Link> · <a className="underline" href={`${REPO}/scripts`}>Eval scripts</a></p>
    </main>
  );
}
