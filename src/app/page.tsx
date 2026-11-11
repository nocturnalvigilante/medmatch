"use client";

import { useEffect, useState } from "react";
import type { DrugMatch, Form } from "@/lib/match";

type Salt = { name: string; mg?: number; form: Form };
type Medicine = { id: string; brand: string; matches: DrugMatch[] };
type Step = "brand" | "confirm" | "result";

const STATUS: Record<DrugMatch["status"], { label: string; cls: string }> = {
  otc: { label: "Over the counter", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rx: { label: "Needs a prescription", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  not_sold: { label: "Not sold in the US", cls: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  unknown: { label: "Couldn't check", cls: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
};

const btn = "rounded-lg px-4 py-2.5 font-medium disabled:opacity-50";
const primary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
const ghost = `${btn} border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900`;
const input = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2.5";

export default function Home() {
  const [step, setStep] = useState<Step>("brand");
  const [brand, setBrand] = useState("");
  const [salts, setSalts] = useState<Salt[]>([]);
  const [aiNote, setAiNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Medicine | null>(null);
  const [cabinet, setCabinet] = useState<Medicine[]>([]);

  // Local cabinet until sign-in + Supabase land.
  useEffect(() => {
    try {
      setCabinet(JSON.parse(localStorage.getItem("cabinet") ?? "[]"));
    } catch {}
  }, []);
  const saveCabinet = (c: Medicine[]) => {
    setCabinet(c);
    try {
      localStorage.setItem("cabinet", JSON.stringify(c));
    } catch {}
  };

  async function readBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim()) return;
    setBusy(true);
    setError("");
    setAiNote("");
    try {
      const res = await fetch("/api/read", { method: "POST", body: JSON.stringify({ brand }) });
      const j = await res.json();
      if (!res.ok) {
        setSalts([{ name: "", form: "oral" }]);
        setAiNote(j.note ?? "Type the ingredients from the strip.");
      } else {
        setSalts(j.salts.length ? j.salts.map((s: Salt) => ({ ...s, form: "oral" })) : [{ name: "", form: "oral" }]);
        const bits = [];
        if (!j.salts.length) bits.push("We don't recognise this brand. Type the ingredients from the strip.");
        else bits.push(`AI read this with ${j.confidence} confidence. Check it against the back of your strip.`);
        if (j.salts.length && !j.strengthKnown) bits.push("Strength wasn't in the name. Check the mg on the strip.");
        if (j.note) bits.push(j.note);
        setAiNote(bits.join(" "));
      }
      setStep("confirm");
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function lookUp() {
    const clean = salts.filter((s) => s.name.trim());
    if (!clean.length) return setError("Add at least one ingredient.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/match", { method: "POST", body: JSON.stringify({ salts: clean }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setCurrent({ id: crypto.randomUUID(), brand: brand.trim(), matches: j.matches });
      setStep("result");
    } catch (e) {
      setError((e as Error).message || "Lookup failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(name: string, query: string) {
    setSalts((s) => s.map((x) => (x.name.trim().toLowerCase() === query.toLowerCase() ? { ...x, name } : x)));
    setStep("confirm");
  }

  function reset() {
    setStep("brand");
    setBrand("");
    setSalts([]);
    setCurrent(null);
    setAiNote("");
    setError("");
  }

  const overlaps = findOverlaps(current ? [...cabinet.filter((m) => m.id !== current.id), current] : cabinet);

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">MedMatch</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Find the US name for a medicine you brought from India.</p>
      </header>

      {step === "brand" && (
        <form onSubmit={readBrand} className="space-y-3">
          <label htmlFor="brand" className="block font-medium">Medicine name on the strip</label>
          <input id="brand" className={input} placeholder="e.g. Combiflam, Dolo 650, Pan-D" value={brand} onChange={(e) => setBrand(e.target.value)} autoFocus />
          <button className={primary} disabled={busy || !brand.trim()}>{busy ? "Reading…" : "Next"}</button>
        </form>
      )}

      {step === "confirm" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Check the ingredients for {brand}</h2>
            {aiNote && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{aiNote}</p>}
          </div>
          {salts.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label="Ingredient" className={input} placeholder="Ingredient, e.g. paracetamol" value={s.name} onChange={(e) => setSalts(salts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Strength in mg" className={`${input} w-24 shrink-0`} inputMode="decimal" placeholder="mg" value={s.mg ?? ""} onChange={(e) => setSalts(salts.map((x, j) => (j === i ? { ...x, mg: Number(e.target.value) || undefined } : x)))} />
              <button type="button" aria-label="Remove ingredient" className="px-2 text-zinc-500 hover:text-red-600" onClick={() => setSalts(salts.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            Type
            <select className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1" value={salts[0]?.form ?? "oral"} onChange={(e) => setSalts(salts.map((x) => ({ ...x, form: e.target.value as Form })))}>
              <option value="oral">Tablet / capsule / syrup</option>
              <option value="inhaled">Inhaler</option>
              <option value="topical">Cream / gel</option>
              <option value="eye">Eye drops</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghost} onClick={() => setSalts([...salts, { name: "", form: salts[0]?.form ?? "oral" }])}>+ Add ingredient</button>
            <button type="button" className={primary} onClick={lookUp} disabled={busy}>{busy ? "Checking US sources…" : "These are right, find US names"}</button>
          </div>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={reset}>Start over</button>
        </section>
      )}

      {step === "result" && current && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{current.brand} in the US</h2>
          {current.matches.map((m, i) => (
            <Card key={i} m={m} onSuggest={(name) => applySuggestion(name, m.query)} />
          ))}
          <p className="text-xs text-zinc-500">From RxNorm (NLM) and openFDA listings. Not medical advice: confirm with a pharmacist before taking anything.</p>
          <div className="flex flex-wrap gap-2">
            {!cabinet.some((c) => c.id === current.id) && (
              <button className={primary} onClick={() => saveCabinet([...cabinet, current])}>Save to my cabinet</button>
            )}
            <button className={ghost} onClick={reset}>Check another medicine</button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}

      {overlaps.length > 0 && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {overlaps.map((o) => (
            <p key={o.drug}>⚠ <b>{o.brands.join(" and ")}</b> both contain <b>{o.drug}</b>. Taking them together can double the dose.</p>
          ))}
        </div>
      )}

      {cabinet.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 font-semibold">My cabinet</h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {cabinet.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <button className="text-left" onClick={() => { setCurrent(c); setBrand(c.brand); setStep("result"); }}>
                  <span className="font-medium">{c.brand}</span>
                  <span className="ml-2 text-sm text-zinc-500">{c.matches.map((m) => m.usName ?? m.query).join(" + ")}</span>
                </button>
                <button aria-label={`Remove ${c.brand}`} className="text-zinc-400 hover:text-red-600" onClick={() => saveCabinet(cabinet.filter((x) => x.id !== c.id))}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Card({ m, onSuggest }: { m: DrugMatch; onSuggest: (name: string) => void }) {
  if (m.result === "suggestion" && m.suggestion) {
    return (
      <article className="rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
        <p>We couldn&apos;t find <b>{m.query}</b> exactly.</p>
        <button className={`${ghost} mt-3`} onClick={() => onSuggest(m.suggestion!)}>Did you mean “{m.suggestion}”? Check your strip first</button>
      </article>
    );
  }
  const s = STATUS[m.status];
  return (
    <article className="rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm text-zinc-500">{m.query}{m.strengthMg ? ` ${m.strengthMg} mg` : ""} is called</p>
      <p className="text-xl font-semibold">{m.usName ?? "—"}</p>
      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${s.cls}`}>{s.label}{m.someFormsRx ? " (some strengths need a prescription)" : ""}</span>
      {m.brands.length > 0 && (
        <p className="mt-3"><span className="text-sm text-zinc-500">Look for on the shelf: </span><b>{m.brands.join(", ")}</b>, or the generic “{m.usName}”</p>
      )}
      {(m.status === "otc" || m.status === "rx") && m.brands.length === 0 && <p className="mt-3 text-sm">Sold as the generic “{m.usName}”.</p>}
      {m.sameStrengthInUS === false && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{m.strengthMg} mg isn&apos;t a standard US strength. Ask the pharmacist about the dose.</p>}
      {m.note && <p className="mt-2 text-sm">{m.note}</p>}
    </article>
  );
}

function findOverlaps(meds: Medicine[]) {
  const by = new Map<string, Set<string>>();
  for (const med of meds)
    for (const m of med.matches) {
      if (m.result !== "matched") continue;
      const k = (m.usName ?? m.query).toLowerCase();
      if (!by.has(k)) by.set(k, new Set());
      by.get(k)!.add(med.brand);
    }
  return [...by].filter(([, b]) => b.size > 1).map(([drug, b]) => ({ drug, brands: [...b] }));
}
