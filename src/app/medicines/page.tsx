import type { Metadata } from "next";
import Link from "next/link";
import { BRANDS } from "@/lib/brands";
import { slugOf } from "@/lib/summary";

export const metadata: Metadata = {
  title: "Indian medicines and their US equivalents, A–Z | MedMatch",
  description: "Common Indian medicine brands (Dolo 650, Pan-D, Combiflam, Montair LC and more) with their US names, prescription status and US brands.",
  alternates: { canonical: "/medicines" },
};

export default function Medicines() {
  const sorted = [...BRANDS].sort((a, b) => a.brand.localeCompare(b.brand));
  const groups = new Map<string, typeof sorted>();
  for (const b of sorted) {
    const k = b.brand[0].toUpperCase();
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-3xl font-semibold tracking-tight">Indian medicines in the USA</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Pick a medicine to see its US name, whether you need a prescription, and what to ask the pharmacist for. Don&apos;t see yours? <Link href="/" className="underline">Search any brand</Link>.</p>
      <div className="mt-8 space-y-6">
        {[...groups].map(([letter, list]) => (
          <section key={letter}>
            <h2 className="text-sm font-semibold text-zinc-500">{letter}</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {list.map((b) => (
                <li key={b.brand}>
                  <Link href={`/medicine/${slugOf(b.brand)}`} className="block rounded-xl border border-zinc-200 p-3 hover:border-teal-500 dark:border-zinc-800">
                    <span className="font-medium">{b.brand}</span>
                    <span className="block text-sm text-zinc-500">{b.salts.map((s) => s.name).join(" + ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
