import type { Metadata } from "next";
import Link from "next/link";
import { BRANDS, slugOf } from "@/lib/brands";
import { topMedicines } from "@/lib/india";

export const metadata: Metadata = {
  title: "Indian medicines and their US equivalents, A–Z | MedMatch",
  description: "Popular Indian medicine brands (Dolo 650, Pan-D, Combiflam, Montair LC and thousands more) with their US names, prescription status and US brands.",
  alternates: { canonical: "/medicines" },
};

export default function Medicines() {
  const checked = [...BRANDS].sort((a, b) => a.brand.localeCompare(b.brand));
  const popular = topMedicines(24);
  const groups = new Map<string, typeof popular>();
  for (const m of popular) {
    const k = /[a-z]/i.test(m.name[0]) ? m.name[0].toUpperCase() : "#";
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <h1 className="text-3xl font-semibold tracking-tight">Indian medicines in the USA</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Pick a medicine to see its US name, whether you need a prescription, and what to ask the pharmacist for. We cover about 209,000 Indian medicines; <Link href="/" className="underline">search for yours</Link>.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Hand-checked</h2>
        <p className="text-sm text-zinc-500">Ingredients checked by hand against the label.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {checked.map((b) => (
            <li key={b.brand}>
              <Link href={`/medicine/${slugOf(b.brand)}`} className="block rounded-xl border border-zinc-200 p-3 hover:border-teal-500 dark:border-zinc-800">
                <span className="font-medium">{b.brand}</span>
                <span className="block truncate text-sm text-zinc-500">{b.salts.map((s) => s.name).join(" + ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Popular, A–Z</h2>
        <nav className="mt-2 flex flex-wrap gap-1 text-sm">
          {[...groups.keys()].map((k) => (
            <a key={k} href={`#l-${k}`} className="rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">{k}</a>
          ))}
        </nav>
        <div className="mt-4 space-y-6">
          {[...groups].map(([letter, list]) => (
            <section key={letter} id={`l-${letter}`}>
              <h3 className="text-sm font-semibold text-zinc-500">{letter}</h3>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {list.map((m) => (
                  <li key={m.slug}><Link href={`/medicine/${m.slug}`} className="hover:underline">{m.name}</Link></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
