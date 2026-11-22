"use client";
// Pharmacist card (full screen, big type, to show at the counter or print) and share (WhatsApp / native share).
import { useEffect, useState } from "react";

export type CardLine = { india: string; us: string; status: string };

export function MedicineActions({ brand, askFor, lines, shareUrl }: { brand: string; askFor: string; lines: CardLine[]; shareUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function share() {
    const url = shareUrl ?? window.location.href;
    const text = `${brand} from India → in the US: ${askFor}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${brand} in the USA`, text, url });
        return;
      } catch {
        return; // user cancelled
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${brand} → ${askFor}\n${shareUrl ?? window.location.href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const btn = "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition";
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button onClick={() => setOpen(true)} className={`${btn} bg-teal-700 text-white hover:bg-teal-800`}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6" /></svg>
          Show to pharmacist
        </button>
        <button onClick={share} className={`${btn} border border-zinc-300 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900`}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>
          Share with family
        </button>
        <button onClick={copy} className={`${btn} border border-zinc-300 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900`}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Card for the pharmacist" className="fixed inset-0 z-50 flex flex-col overflow-auto bg-white p-6 text-zinc-950 sm:p-10">
          <div className="mx-auto w-full max-w-2xl flex-1">
            <div className="flex items-center justify-between print:hidden">
              <p className="text-sm font-medium uppercase tracking-wider text-teal-800">For the pharmacist</p>
              <button onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm">Close</button>
            </div>
            <p className="mt-6 text-lg text-zinc-600">I take this medicine from India:</p>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">{brand}</p>
            <ul className="mt-6 divide-y divide-zinc-200 border-y-2 border-zinc-900">
              {lines.map((l) => (
                <li key={l.india} className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-baseline sm:gap-4">
                  <span className="text-lg text-zinc-600">India: {l.india}</span>
                  <span className="text-2xl font-semibold capitalize">US: {l.us}</span>
                  <span className="text-base font-medium">{l.status}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-lg text-zinc-600">What I&apos;m looking for:</p>
            <p className="text-2xl font-semibold sm:text-3xl">{askFor}</p>
            <p className="mt-8 text-base text-zinc-500">Could you help me find the US equivalent, or tell me what to use instead? Thank you.</p>
            <p className="mt-10 text-xs text-zinc-400">From MedMatch, using NIH RxNorm and FDA listings. Not medical advice.</p>
          </div>
          <div className="mx-auto mt-6 flex w-full max-w-2xl gap-2 print:hidden">
            <button onClick={() => window.print()} className="rounded-xl border border-zinc-300 px-4 py-2.5 font-medium">Print</button>
            <button onClick={() => setOpen(false)} className="rounded-xl bg-zinc-900 px-4 py-2.5 font-medium text-white">Done</button>
          </div>
        </div>
      )}
    </>
  );
}
