"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { supabaseWithClerk } from "@/lib/supabase";
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
  // Each step gets its own history entry (?step=confirm), so the browser Back button goes back a step instead of leaving the site.
  const fromHistory = useRef(false);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      fromHistory.current = true;
      setStep((e.state?.step as Step) ?? "brand");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    const url = step === "brand" ? window.location.pathname : `?step=${step}`;
    if (step === "brand") window.history.replaceState({ step }, "", url);
    else window.history.pushState({ step }, "", url);
  }, [step]);
  const [brand, setBrand] = useState("");
  const [salts, setSalts] = useState<Salt[]>([]);
  const [aiNote, setAiNote] = useState("");
  // AI eval: made-up brands came back with invented ingredients at "medium" confidence; real brands came back "high".
  const [unsure, setUnsure] = useState(false);
  const [checkedStrip, setCheckedStrip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Medicine | null>(null);
  const [cabinet, setCabinet] = useState<Medicine[]>([]);

  // Signed out: cabinet lives in this browser. Signed in: it lives in Supabase (RLS = own rows only).
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const db = useMemo(() => (isSignedIn ? supabaseWithClerk(() => getToken()) : null), [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!db) {
      try {
        setCabinet(JSON.parse(localStorage.getItem("cabinet") ?? "[]"));
      } catch {}
      return;
    }
    db.from("cabinet")
      .select("med_id, brand, matches")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) return setError("Couldn't load your saved cabinet. Try again in a minute.");
        setCabinet((data ?? []).map((r) => ({ id: r.med_id, brand: r.brand, matches: r.matches })));
      });
  }, [isLoaded, db]);

  async function saveCabinet(c: Medicine[]) {
    const before = cabinet;
    setCabinet(c);
    if (!db) {
      try {
        localStorage.setItem("cabinet", JSON.stringify(c));
      } catch {}
      return;
    }
    const added = c.filter((m) => !before.some((b) => b.id === m.id));
    const removed = before.filter((b) => !c.some((m) => m.id === b.id));
    const results = await Promise.all([
      ...added.map((m) => db.from("cabinet").insert({ med_id: m.id, brand: m.brand, matches: m.matches })),
      ...removed.map((m) => db.from("cabinet").delete().eq("med_id", m.id)),
    ]);
    if (results.some((r) => r.error)) {
      setCabinet(before);
      setError("Couldn't save to your cabinet. Try again.");
    }
  }

  async function readBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim()) return;
    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 3000);
    setError("");
    setAiNote("");
    setUnsure(false);
    setCheckedStrip(false);
    try {
      const res = await fetch("/api/read", { method: "POST", body: JSON.stringify({ brand }) });
      const j = await res.json();
      if (!res.ok) {
        setSalts([{ name: "", form: "oral" }]);
        setAiNote(j.note ?? "Type the ingredients from the strip.");
      } else {
        if (j.salts.length && j.brand) setBrand(j.brand); // use the corrected spelling, e.g. "Combiflam"
        setSalts(j.salts.length ? j.salts.map((s: Salt) => ({ ...s, form: "oral" })) : [{ name: "", form: "oral" }]);
        const bits = [];
        if (!j.salts.length) bits.push("We don't recognise this brand. Type the ingredients from the strip.");
        else if (j.confidence === "high") bits.push("Check these against the back of your strip.");
        setUnsure(j.salts.length > 0 && j.confidence !== "high");
        if (j.salts.length && !j.strengthKnown) bits.push("Strength wasn't in the name. Check the mg on the strip.");
        if (j.note) bits.push(j.note);
        setAiNote(bits.join(" "));
      }
      setStep("confirm");
    } catch {
      setError("Network problem. Try again.");
    } finally {
      clearTimeout(slowTimer);
      setBusy(false);
      setSlow(false);
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
    setJustSaved(false);
    setStep("brand");
    setBrand("");
    setSalts([]);
    setCurrent(null);
    setAiNote("");
    setUnsure(false);
    setCheckedStrip(false);
    setError("");
  }

  const overlaps = findOverlaps(current ? [...cabinet.filter((m) => m.id !== current.id), current] : cabinet);

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">MedMatch</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Moved to the US with medicines from India? Find what to ask for at a US pharmacy.</p>
      </header>

      {step === "brand" && (
        <form onSubmit={readBrand} className="space-y-3">
          <label htmlFor="brand" className="block font-medium">Medicine name on the strip</label>
          <input id="brand" className={input} placeholder="e.g. Combiflam, Dolo 650, Pan-D" value={brand} onChange={(e) => setBrand(e.target.value)} autoFocus />
          <button className={primary} disabled={busy || !brand.trim()}>{busy ? "Reading…" : "Next"}</button>
          {!busy && (
            <p className="text-sm text-zinc-500">
              Try:{" "}
              {["Dolo 650", "Pan-D", "Combiflam"].map((ex) => (
                <button key={ex} type="button" className="mr-2 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200" onClick={() => setBrand(ex)}>{ex}</button>
              ))}
            </p>
          )}
          {slow && <p className="text-sm text-zinc-500">Still reading. Unusual names take a few more seconds.</p>}
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
              <input aria-label="Ingredient" className={`${input} min-w-0 flex-1`} placeholder="Ingredient, e.g. paracetamol" value={s.name} onChange={(e) => setSalts(salts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Strength in mg" className={`${input.replace("w-full", "")} w-24 shrink-0`} inputMode="decimal" placeholder="mg" value={s.mg ?? ""} onChange={(e) => setSalts(salts.map((x, j) => (j === i ? { ...x, mg: Number(e.target.value) || undefined } : x)))} />
              <button type="button" aria-label="Remove ingredient" className="px-2 text-zinc-500 hover:text-red-600" onClick={() => setSalts(salts.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {salts.some((x) => x.name.trim() && !x.mg) && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Add the mg from the back of the strip. The strength changes which US product matches.</p>
          )}
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
            <button type="button" className={ghost} onClick={() => setSalts([...salts, { name: "", form: salts[0]?.form ?? "oral" }])}>+ Add another ingredient from the strip</button>
            {unsure && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                <p><b>Our AI isn&apos;t sure this brand exists.</b> These ingredients may be a guess. Only continue if they match what&apos;s printed on your strip, or type them yourself.</p>
                <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={checkedStrip} onChange={(e) => setCheckedStrip(e.target.checked)} /> I checked these against my strip</label>
              </div>
            )}
            <button type="button" className={primary} onClick={lookUp} disabled={busy || (unsure && !checkedStrip)}>{busy ? "Checking US sources…" : "These are right, find US names"}</button>
          </div>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={reset}>Start over</button>
        </section>
      )}

      {step === "result" && current && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{current.brand} in the US</h2>
          {current.matches.length > 1 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <b>This is a combination medicine.</b> Don&apos;t buy the parts separately and take them together on your own.
              {current.matches.every((m) => m.status !== "not_sold") && (
                <> At the pharmacy, ask for the combined product: <b>{current.matches.map((m) => m.usName ?? m.query).join("-")}{current.matches.every((m) => m.strengthMg) ? ` ${current.matches.map((m) => m.strengthMg).join("/")} mg` : ""}</b>.</>
              )}
              {current.matches.some((m) => m.status === "not_sold") && <> One part isn&apos;t sold in the US, so there is no exact US version. Ask a pharmacist what to use instead.</>}
            </div>
          )}
          {current.matches.some((m) => m.brands.some((b) => b.toLowerCase() === current.brand.split(/[\s-]/)[0].toLowerCase())) && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <b>Same name, maybe a different medicine.</b> &ldquo;{current.brand.split(/[\s-]/)[0]}&rdquo; is also a US brand, but the US product can contain different ingredients. Match by the ingredients above, not the box name.
            </div>
          )}
          {current.matches.map((m, i) => (
            <Card key={i} m={m} onSuggest={(name) => applySuggestion(name, m.query)} />
          ))}
          <p className="text-xs text-zinc-500">From RxNorm (NLM) and openFDA listings. Not medical advice: confirm with a pharmacist before taking anything.</p>
          <div className="flex flex-wrap gap-2">
            {!cabinet.some((c) => c.id === current.id) && (
              <button className={primary} onClick={() => { saveCabinet([...cabinet, current]); setJustSaved(true); }}>Save to my cabinet</button>
            )}
            {justSaved && cabinet.some((c) => c.id === current.id) && (
              <p role="status" className="self-center text-sm text-emerald-700 dark:text-emerald-400">✓ Saved{isSignedIn ? " to your account" : " on this device. Sign in to keep it on any device"}.</p>
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
      {m.status === "rx" && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
          <b>To get a US prescription:</b> book your university&apos;s student health clinic, an urgent care clinic, or a telehealth visit. Bring this strip so the doctor can see exactly what you took at home.
        </p>
      )}
      {m.sameStrengthInUS === false &&<p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{m.strengthMg} mg isn&apos;t a standard US strength. Ask the pharmacist about the dose.</p>}
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
