"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { supabaseWithClerk } from "@/lib/supabase";
import type { DrugMatch, Form } from "@/lib/match";
import { baseKey, findBrand, slugOf, suggest, suggestIngredient, type KnownBrand } from "@/lib/brands";
import { MedicineActions } from "@/components/MedicineActions";
import { Feedback } from "@/components/Feedback";
import { SymptomCard } from "@/components/SymptomCard";
import type { SymptomPlan } from "@/lib/symptoms";
import Link from "next/link";

type Salt = { name: string; mg?: number; strength?: string; form: Form };
type DatasetMed = { name: string; form: Form; complete: boolean; maker?: string; salts: { name: string; mg?: number; strength: string }[] };
type Medicine = { id: string; brand: string; matches: DrugMatch[]; clash?: string; symptoms?: SymptomPlan };
type Step = "brand" | "confirm" | "result";
type Option = { key: string; label: string; detail?: string; onPick: () => void };

const STATUS: Record<DrugMatch["status"], { label: string; cls: string }> = {
  otc: { label: "Over the counter", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rx: { label: "Needs a prescription", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  not_sold: { label: "Not sold in the US", cls: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  unknown: { label: "Couldn't check", cls: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
};
const FORM_LABEL: Record<Form, string> = { oral: "tablet / capsule / syrup", inhaled: "inhaler", topical: "cream / gel", eye: "eye drops", any: "any form" };

const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition disabled:opacity-50";
const primary = `${btn} bg-teal-700 text-white shadow-sm hover:bg-teal-800`;
const ghost = `${btn} border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900`;
const link = "text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200";
const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950";

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
    window.scrollTo({ top: 0 });
  }, [step]);
  const [brand, setBrand] = useState("");
  const [salts, setSalts] = useState<Salt[]>([]);
  const [aiNote, setAiNote] = useState("");
  // AI eval: made-up brands came back with invented ingredients at "medium" confidence; real brands came back "high".
  const [unsure, setUnsure] = useState(false);
  const [checkedStrip, setCheckedStrip] = useState(false);
  // Why the user must tick "I checked my strip": the AI guessed, the brand isn't on any list, or the list may miss an ingredient.
  const [checkReason, setCheckReason] = useState<"" | "unlisted" | "partial">("");
  const [variants, setVariants] = useState<DatasetMed[]>([]);
  const [source, setSource] = useState("typed"); // where the ingredients came from: checked list, dataset, AI or photo (for feedback)
  const [busy, setBusy] = useState<"" | "read" | "match">("");
  const [slow, setSlow] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Medicine | null>(null);
  // v2 #6: AI with tools writes "what to ask for", using only RxNorm/openFDA tool results.
  type Advice = { state: "loading" | "ok" | "error"; askFor?: string; points?: string[]; seePharmacist?: boolean; tools?: string[] };
  const [advice, setAdvice] = useState<Advice | null>(null);
  const adviceReq = useRef(0);
  const [cabinet, setCabinet] = useState<Medicine[]>([]);
  const [remote, setRemote] = useState<string[]>([]);
  const [remoteMeds, setRemoteMeds] = useState<DatasetMed[]>([]);

  // Signed out: cabinet lives in this browser. Signed in: it lives in Supabase (RLS = own rows only).
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const db = useMemo(() => (isSignedIn ? supabaseWithClerk(() => getToken()) : null), [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    let local: Medicine[] = [];
    try {
      local = JSON.parse(localStorage.getItem("cabinet") ?? "[]");
    } catch {}
    if (!db) return setCabinet(local);
    (async () => {
      const { data, error } = await db.from("cabinet").select("med_id, brand, matches").order("created_at");
      if (error) return setError("Couldn't load your saved cabinet. Try again in a minute.");
      const saved: Medicine[] = (data ?? []).map((r) => ({ id: r.med_id, brand: r.brand, matches: r.matches }));
      // TA feedback: the cabinet "disappeared" after signing in. Offer to move medicines saved on this device into the account.
      // Security review: ask first, since on a shared computer they may belong to someone else.
      setPendingMove(local.filter((m) => !saved.some((s) => s.id === m.id)));
      setCabinet(saved);
    })();
  }, [isLoaded, db]);

  const [pendingMove, setPendingMove] = useState<Medicine[]>([]);
  async function moveToAccount(yes: boolean) {
    const toMove = pendingMove;
    setPendingMove([]);
    if (!yes || !db) return;
    const res = await db.from("cabinet").insert(toMove.map((m) => ({ med_id: m.id, brand: m.brand, matches: m.matches })));
    if (res.error) return setError("Couldn't move those medicines into your account. They're still saved on this device.");
    try {
      localStorage.removeItem("cabinet");
    } catch {}
    setCabinet((c) => [...c, ...toMove]);
  }

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

  // Cold start: wake the search server while the user is still reading, so the first keystroke is fast.
  useEffect(() => {
    fetch("/api/suggest?q=w").catch(() => {});
  }, []);

  // Type-ahead (instructor feedback): our checked list answers instantly; RxNorm spelling suggestions fill in when it has nothing.
  const local = useMemo(() => suggest(brand), [brand]);
  useEffect(() => {
    const q = brand.trim();
    if (step !== "brand" || q.length < 2) {
      setRemote([]);
      setRemoteMeds([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const j = await (await fetch(`/api/suggest?q=${encodeURIComponent(q)}`)).json();
        if (!live) return;
        setRemoteMeds(j.meds ?? []);
        setRemote((j.names ?? []).filter((n: string) => n !== q.toLowerCase()));
      } catch {}
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [brand, step]);

  function startFresh() {
    setError("");
    setUnsure(false);
    setCheckReason("");
    setVariants([]);
    setCheckedStrip(false);
  }

  function pickKnown(b: KnownBrand) {
    startFresh();
    setBrand(b.brand);
    setSalts(b.salts.map((s) => ({ ...s, form: "oral" })));
    setAiNote("From our checked list of Indian brands. Still compare with the back of your strip.");
    setSource("list");
    setStep("confirm");
  }

  // A medicine picked from the ~209k-item Indian list (type-ahead or the "which one?" picker).
  function pickDataset(m: DatasetMed) {
    startFresh();
    setBrand(m.name);
    setSalts(m.salts.map((s) => ({ name: s.name, mg: s.mg, strength: s.strength, form: m.form === "any" ? "oral" : m.form })));
    setAiNote("From a list of 209,000 Indian medicines. Check it matches the back of your strip.");
    setSource("dataset");
    if (!m.complete) {
      setUnsure(true);
      setCheckReason("partial");
    }
    setStep("confirm");
  }

  function pickIngredient(name: string) {
    startFresh();
    setBrand(name);
    setSalts([{ name, form: "oral" }]);
    setAiNote("Add the mg from the back of the strip.");
    setStep("confirm");
  }

  const brandOptions: Option[] = [
    ...local.map((s) => ({
      key: `l-${s.label}`,
      label: s.label,
      detail: s.kind === "brand" ? s.detail : "ingredient",
      onPick: () => (s.brand ? pickKnown(s.brand) : pickIngredient(s.label)),
    })),
    ...remoteMeds
      .filter((m) => !local.some((l) => l.kind === "brand" && baseKey(l.label) === baseKey(m.name)))
      .map((m) => ({ key: `d-${m.name}`, label: m.name, detail: m.salts.map((s) => `${s.name}${s.strength ? ` ${s.strength}` : ""}`).join(" + "), onPick: () => pickDataset(m) })),
    ...remote.filter((n) => !local.some((l) => l.label === n)).map((n) => ({ key: `r-${n}`, label: n, detail: "ingredient · did you mean?", onPick: () => pickIngredient(n) })),
  ];

  // v2 (proposal + TA feedback): read the strip from a photo. Shrink it in the browser first (fast upload, under the size cap).
  const fileRef = useRef<HTMLInputElement>(null);
  async function readPhoto(file: File) {
    setBusy("read");
    startFresh();
    setAiNote("");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      const res = await fetch("/api/photo", { method: "POST", body: JSON.stringify({ image, mime: "image/jpeg" }) });
      const j = await res.json();
      if (!res.ok) return setError(j.note ?? "We couldn't read that photo. Type the name instead.");
      if (!j.salts.length) {
        if (j.brand) {
          setBrand(j.brand);
          return readBrand(undefined, j.brand); // brand readable, composition not: fall back to reading the name
        }
        return setError(j.note || "We couldn't find a medicine name in that photo. Try the side with the name, in good light.");
      }
      setBrand(j.brand || "Your medicine");
      setSource(j.source === "list" ? "list" : "photo");
      setSalts(j.salts.map((x: Salt) => ({ ...x, form: "oral" })));
      setUnsure(j.confidence !== "high");
      const bits = [j.source === "list" ? "Read the name from your photo; ingredients from our checked list." : "Read from your photo. Check every line against the strip."];
      if (j.salts.some((x: Salt) => !x.mg)) bits.push("Some strengths weren't readable. Add the mg.");
      if (j.note) bits.push(j.note);
      setAiNote(bits.join(" "));
      setStep("confirm");
    } catch {
      setError("We couldn't open that photo. Try again, or type the name.");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function readBrand(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const name = (override ?? brand).trim();
    if (!name) return;
    setBusy("read");
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 2500);
    startFresh();
    setAiNote("");
    try {
      const res = await fetch("/api/read", { method: "POST", body: JSON.stringify({ brand: name }) });
      const j = await res.json();
      if (res.ok && j.variants?.length) {
        setVariants(j.variants);
        setSalts([]);
        setStep("confirm");
        return;
      }
      if (res.ok && j.source === "dataset") {
        pickDataset({ name: j.brand, form: j.form ?? "oral", complete: j.confidence !== "partial", salts: j.salts });
        return;
      }
      if (!res.ok) {
        setSalts([{ name: "", form: "oral" }]);
        setAiNote(j.note ?? "Type the ingredients from the strip.");
      } else {
        if (j.salts.length && j.brand) setBrand(j.brand); // use the corrected spelling, e.g. "Combiflam"
        setSource(j.source === "list" ? "list" : "ai");
        setSalts(j.salts.length ? j.salts.map((s: Salt) => ({ ...s, form: "oral" })) : [{ name: "", form: "oral" }]);
        const bits = [];
        if (!j.salts.length) bits.push(`We don't recognise “${name}”. Type the ingredients printed on the back of the strip.`);
        else if (j.source === "list") bits.push("From our checked list of Indian brands. Still compare with the back of your strip.");
        else if (j.confidence === "high") bits.push("Our AI read these. Check them against the back of your strip.");
        if (j.confidence === "unlisted") setCheckReason("unlisted");
        setUnsure(j.salts.length > 0 && j.confidence !== "high");
        if (j.salts.length && !j.strengthKnown) bits.push("Strength wasn't in the name. Check the mg on the strip.");
        if (j.note) bits.push(j.note);
        setAiNote(bits.join(" "));
      }
      setStep("confirm");
    } catch {
      setError("Network problem. Check your connection and press Next again.");
    } finally {
      clearTimeout(slowTimer);
      setBusy("");
      setSlow(false);
    }
  }

  async function fetchAdvice(forBrand: string, list: { name: string; mg?: number; form?: Form }[]) {
    const req = ++adviceReq.current; // ignore answers for a medicine the user already left
    setAdvice({ state: "loading" });
    try {
      const res = await fetch("/api/advise", { method: "POST", body: JSON.stringify({ brand: forBrand, form: list[0]?.form ?? "oral", salts: list.map((x) => ({ name: x.name, mg: x.mg })) }) });
      const j = await res.json();
      if (req !== adviceReq.current) return;
      if (!res.ok || !j.advice?.askFor) return setAdvice({ state: "error" });
      const names: Record<string, string> = { find_combination: "US combination products", products_at_strength: "US products at your strength", lookup_ingredient: "each ingredient" };
      setAdvice({ state: "ok", ...j.advice, tools: [...new Set((j.tools ?? []).map((t: { tool: string }) => names[t.tool] ?? t.tool))] as string[] });
    } catch {
      if (req === adviceReq.current) setAdvice({ state: "error" });
    }
  }

  async function lookUp(list: Salt[] = salts) {
    const clean = list.filter((s) => s.name.trim());
    if (!clean.length) return setError("Type at least one ingredient from the strip.");
    setBusy("match");
    setError("");
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      const res = await fetch("/api/match", { method: "POST", body: JSON.stringify({ salts: clean, brand: brand.trim() }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setJustSaved(false);
      setCurrent({ id: crypto.randomUUID(), brand: brand.trim(), matches: j.matches, clash: j.clash, symptoms: j.symptoms });
      setStep("result");
      fetchAdvice(brand.trim(), clean);
    } catch (e) {
      setError((e as Error).message || "The US lookup failed. Press the button again.");
    } finally {
      clearTimeout(slowTimer);
      setBusy("");
      setSlow(false);
    }
  }

  function switchForm(form: Form) {
    const next = salts.map((s) => ({ ...s, form }));
    setSalts(next);
    lookUp(next);
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
    setAdvice(null);
    adviceReq.current++;
    setAiNote("");
    startFresh();
  }

  function openSaved(c: Medicine) {
    setCurrent(c);
    setBrand(c.brand);
    setSalts(c.matches.map((m) => ({ name: m.query, mg: m.strengthMg, form: m.form })));
    setJustSaved(false);
    setStep("result");
    fetchAdvice(c.brand, c.matches.map((m) => ({ name: m.query, mg: m.strengthMg, form: m.form })));
  }

  const overlaps = findOverlaps(current ? [...cabinet.filter((m) => m.id !== current.id), current] : cabinet);
  const form = salts[0]?.form ?? "oral";

  return (
    <main className={`mx-auto px-4 pb-16 ${step === "brand" ? "max-w-5xl" : "max-w-2xl"}`}>
      {pendingMove.length > 0 && (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-teal-300 bg-teal-50 p-3 text-sm dark:border-teal-800 dark:bg-teal-950/40">
          <span className="flex-1">{pendingMove.length} medicine{pendingMove.length > 1 ? "s" : ""} saved on this device ({pendingMove.map((m) => m.brand).join(", ")}). Move into your account?</span>
          <button className="rounded-lg bg-teal-700 px-3 py-1.5 font-medium text-white" onClick={() => moveToAccount(true)}>Move</button>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700" onClick={() => moveToAccount(false)}>Not mine</button>
        </div>
      )}
      {step === "brand" && (
        <div className="grid gap-6 pt-6 md:grid-cols-2 md:items-stretch md:pt-12">
          {/* Search half: one big field, nothing else competing for attention. */}
          <section className="flex flex-col justify-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Brought medicine from India?</h1>
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">Find out what it&apos;s called in the US, and whether you can buy it without a prescription.</p>
            <form onSubmit={readBrand} className="mt-6">
              <label htmlFor="brand" className="mb-1.5 block text-sm font-medium">Name on the strip, or an ingredient</label>
              <Combobox
                id="brand"
                value={brand}
                onChange={setBrand}
                options={busy ? [] : brandOptions}
                placeholder="Start typing, e.g. Dolo, Combiflam, Pan-D"
                big
                autoFocus
              />
              <button className={`${primary} mt-3 w-full py-3 text-base`} disabled={!!busy || !brand.trim()}>
                {busy === "read" ? <><Spinner /> Reading…</> : "Next: check ingredients →"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])} />
              <button type="button" className={`${ghost} mt-2 w-full`} disabled={!!busy} onClick={() => fileRef.current?.click()}>
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
                Or take a photo of the strip
              </button>
              {slow && <p className="mt-2 text-sm text-zinc-500">This name isn&apos;t on our list, so our AI is reading it. Up to 10 seconds.</p>}
              {!busy && (
                <p className="mt-3 text-sm text-zinc-500">
                  Or try:{" "}
                  {["Dolo 650", "Pan-D", "Combiflam"].map((ex) => (
                    <button key={ex} type="button" className="mr-1 rounded-full border border-zinc-300 px-2.5 py-0.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900" onClick={() => pickKnown(suggest(ex, 1)[0].brand!)}>
                      {ex}
                    </button>
                  ))}
                </p>
              )}
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            {cabinet.length > 0 && (
              <div className="mt-6 text-sm">
                <span className="text-zinc-500">Your cabinet: </span>
                {cabinet.map((c) => (
                  <button key={c.id} className="mr-1.5 mt-1 rounded-full bg-zinc-100 px-2.5 py-0.5 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800" onClick={() => openSaved(c)}>{c.brand}</button>
                ))}
              </div>
            )}
          </section>

          {/* Story half: the value prop as 1-2-3. */}
          <aside className="rounded-3xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-900 p-6 text-white shadow-lg sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wider text-teal-100">How it works</p>
            <ol className="mt-4 space-y-5">
              {[
                ["Type the name or snap the strip", "Any of 209,000 Indian medicines. Suggestions appear as you type, so spelling doesn't matter."],
                ["Check the ingredients", "We show what's inside. You compare it with the back of the strip."],
                ["Get your US match", "The US name, whether you need a prescription, and what to ask the pharmacist for."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 font-semibold">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-teal-50/90">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-medium">Example: Dolo 650 → <span className="underline decoration-teal-200/60">acetaminophen (Tylenol)</span></p>
              <p className="mt-1 text-teal-50/90">India says paracetamol; the US says acetaminophen. Same medicine, different name.</p>
            </div>
            <div className="mt-6 hidden items-center gap-4 rounded-2xl bg-white/10 p-4 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
              <img src="/qr.svg" alt="QR code to open MedMatch on your phone" width={88} height={88} className="rounded-lg bg-white p-1" />
              <div className="text-sm">
                <p className="font-semibold">Use it at the pharmacy</p>
                <p className="text-teal-50/90">Scan to open on your phone, then add it to your home screen.</p>
              </div>
            </div>
            <p className="mt-6 text-xs text-teal-100/80">US facts come from the National Library of Medicine (RxNorm) and FDA (openFDA). Not medical advice.</p>
          </aside>
          <section className="md:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Popular medicines</h2>
              <Link href="/medicines" className="text-sm text-teal-700 hover:underline dark:text-teal-400">See all →</Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Dolo 650", "Pan-D", "Combiflam", "Montair LC", "Augmentin 625 Duo", "Allegra 120", "Azithral 500", "Meftal Spas"].map((b) => {
                const k = findBrand(b)!;
                return (
                  <Link key={b} href={`/medicine/${slugOf(b)}`} className="rounded-xl border border-zinc-200 p-3 transition hover:border-teal-500 dark:border-zinc-800">
                    <span className="block font-medium">{b}</span>
                    <span className="block truncate text-xs text-zinc-500">{k.salts.map((x) => x.name).join(" + ")}</span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Link href="/before-you-fly" className="rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900">
                <p className="font-medium">Packing for the US?</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">8 things to check before you bring medicines from India.</p>
              </Link>
              <Link href="/accuracy" className="rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900">
                <p className="font-medium">How accurate is it?</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Our published test results, including where the AI fails.</p>
              </Link>
              <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/50">
                <p className="font-medium">Show the pharmacist</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Every result has a big-text card to show at the counter, or share with family.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {step !== "brand" && <Stepper step={step} onBack={() => (step === "result" ? setStep("confirm") : reset())} />}

      {step === "confirm" && (
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">What&apos;s inside {brand}?</h1>
            {aiNote && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{aiNote}</p>}
          </div>

          {variants.length > 0 && salts.length === 0 && (
            <div className="space-y-2">
              <p className="font-medium">Several medicines are called “{brand}”. Which one is on your strip?</p>
              {variants.map((v) => (
                <button key={v.name} onClick={() => pickDataset(v)} className="block w-full rounded-2xl border border-zinc-200 p-4 text-left transition hover:border-teal-500 dark:border-zinc-800">
                  <span className="font-semibold">{v.name}</span>
                  <span className="mt-0.5 block text-sm text-zinc-500">{v.salts.map((s) => `${s.name}${s.strength ? ` ${s.strength}` : ""}`).join(" + ")}</span>
                </button>
              ))}
              <button className={link} onClick={() => { setVariants([]); setSalts([{ name: "", form: "oral" }]); }}>None of these: I&apos;ll type the ingredients</button>
            </div>
          )}

          {!(variants.length > 0 && salts.length === 0) && <>
          <div className="space-y-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="grid grid-cols-[1fr_6rem_2rem] gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span>Ingredient</span>
              <span>Strength (mg)</span>
              <span />
            </div>
            {salts.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2">
                <Combobox
                  id={`ing-${i}`}
                  ariaLabel="Ingredient"
                  value={s.name}
                  onChange={(v) => setSalts(salts.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                  options={suggestIngredient(s.name).map((n) => ({ key: n, label: n, onPick: () => setSalts(salts.map((x, j) => (j === i ? { ...x, name: n } : x))) }))}
                  placeholder="e.g. paracetamol"
                />
                <input aria-label="Strength in mg" className={input} inputMode="decimal" placeholder={s.strength && !s.mg ? s.strength : "mg"} title={s.strength} value={s.mg ?? ""} onChange={(e) => setSalts(salts.map((x, j) => (j === i ? { ...x, mg: Number(e.target.value) || undefined } : x)))} />
                <button type="button" aria-label="Remove ingredient" className="h-10 text-zinc-400 hover:text-red-600" onClick={() => setSalts(salts.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400" onClick={() => setSalts([...salts, { name: "", form }])}>+ Add another ingredient</button>
          </div>

          {salts.some((x) => x.name.trim() && !x.mg && !x.strength) && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Add the mg from the back of the strip. The strength changes which US product matches.</p>
          )}

          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">It&apos;s a</span>
            <select className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950" value={form} onChange={(e) => setSalts(salts.map((x) => ({ ...x, form: e.target.value as Form })))}>
              <option value="oral">Tablet / capsule / syrup</option>
              <option value="inhaled">Inhaler</option>
              <option value="topical">Cream / gel</option>
              <option value="eye">Eye drops</option>
            </select>
          </label>

          {unsure && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {checkReason === "partial" ? (
                <p><b>Our medicine list only shows two ingredients for this one,</b> and some strips have a third (often paracetamol or caffeine). Add anything missing from the back of the strip, then tick.</p>
              ) : checkReason === "unlisted" ? (
                <p><b>This brand isn&apos;t on our checked list,</b> so these ingredients come from our AI and could be a guess. Only continue if they match what&apos;s printed on your strip, or type them yourself.</p>
              ) : (
                <p><b>Our AI isn&apos;t sure this brand exists.</b> These ingredients may be a guess. Only continue if they match what&apos;s printed on your strip, or type them yourself.</p>
              )}
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={checkedStrip} onChange={(e) => setCheckedStrip(e.target.checked)} /> I checked these against my strip</label>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          {busy === "match" ? (
            <LookupProgress slow={slow} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={`${primary} py-3`} onClick={() => lookUp()} disabled={!!busy || (unsure && !checkedStrip)}>These match my strip → find the US version</button>
              <button type="button" className={link} onClick={reset}>Start over</button>
            </div>
          )}
          </>}
        </section>
      )}

      {step === "result" && current && (
        <section className="space-y-5">
          <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">{current.brand} in the US</h1>

          {/* 1. The answer: one focal box. */}
          {advice?.state === "loading" && (
            <div aria-busy="true" className="rounded-2xl border-2 border-dashed border-teal-300 p-5 dark:border-teal-800">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">What to ask for</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500"><Spinner /> Checking US combination products and your strength. The details below are already ready.</p>
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          )}
          {advice?.state === "error" && (
            <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Couldn&apos;t write a summary right now. The details below come straight from RxNorm and openFDA.{" "}
              <button className="underline" onClick={() => fetchAdvice(current.brand, current.matches.map((m) => ({ name: m.query, mg: m.strengthMg, form: m.form })))}>Try the summary again</button>
            </p>
          )}
          {advice?.state === "ok" && (
            <div className="rounded-2xl border-2 border-teal-500 bg-teal-50 p-5 shadow-sm dark:border-teal-700 dark:bg-teal-950/40">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">What to ask for</p>
              <p className="mt-1 text-xl font-semibold">{advice.askFor}</p>
              {!!advice.points?.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{advice.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
              {advice.seePharmacist && <p className="mt-3 text-sm font-medium">Show this screen to the pharmacist before buying.</p>}
              {!!advice.tools?.length && <p className="mt-2 text-xs text-zinc-500">AI summary of live lookups: {advice.tools.join(", ")} (RxNorm, openFDA).</p>}
              <MedicineActions
                brand={current.brand}
                askFor={advice.askFor ?? ""}
                lines={current.matches.map((m) => ({ india: `${m.query}${m.strengthMg ? ` ${m.strengthMg} mg` : ""}`, us: m.usName ?? m.query, status: STATUS[m.status].label }))}
                shareUrl={findBrand(current.brand) ? `${window.location.origin}/medicine/${slugOf(findBrand(current.brand)!.brand)}` : window.location.origin}
              />
            </div>
          )}

          {current.symptoms && <SymptomCard plan={current.symptoms} />}

          {/* 2. Warnings, only when they apply. */}
          {current.matches.length > 1 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <b>This is a combination medicine.</b> Don&apos;t buy the parts separately and take them together on your own.
              {current.matches.some((m) => m.status === "not_sold") && <> One part isn&apos;t sold in the US, so there is no exact US version. Ask a pharmacist what to use instead.</>}
            </div>
          )}
          {current.clash && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <b>{current.clash.split(":")[0]}.</b>{current.clash.slice(current.clash.indexOf(":") + 1)}
            </div>
          )}
          {overlaps.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {overlaps.map((o) => (
                <p key={o.drug}>⚠ <b>{o.brands.join(" and ")}</b> both contain <b>{o.drug}</b>. Taking them together can double the dose.</p>
              ))}
            </div>
          )}

          {/* 3. Details per ingredient. */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">{current.matches.length > 1 ? "Each ingredient" : "Details"}</h2>
            {current.matches.map((m, i) => (
              <Card key={i} m={m} onSuggest={(name) => applySuggestion(name, m.query)} onEdit={() => setStep("confirm")} onForm={switchForm} />
            ))}
            {busy === "match" && <LookupProgress slow={slow} />}
            <p className="text-xs text-zinc-500">From RxNorm (NLM) and openFDA listings. Not medical advice: confirm with a pharmacist before taking anything.</p>
            <Feedback key={current.id} brand={current.brand} source={source} ingredients={current.matches.map((m) => `${m.query}${m.strengthMg ? ` ${m.strengthMg}` : ""}`).join(" + ")} />
          </div>

          {/* 4. Next steps. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {!cabinet.some((c) => c.id === current.id) ? (
              <button className={primary} onClick={() => { saveCabinet([...cabinet, current]); setJustSaved(true); }}>Save to my cabinet</button>
            ) : (
              <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">✓ {justSaved ? "Saved" : "In your cabinet"}{isSignedIn ? " (your account)" : " on this device. Sign in to keep it on any device"}.</p>
            )}
            <button className={ghost} onClick={reset}>Check another medicine</button>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          {cabinet.length > 0 && (
            <section className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/50">
              <h2 className="mb-1 font-semibold">My cabinet <span className="font-normal text-zinc-500">({cabinet.length})</span></h2>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {cabinet.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <button className="min-w-0 text-left" onClick={() => openSaved(c)}>
                      <span className="font-medium">{c.brand}</span>
                      <span className="ml-2 text-sm text-zinc-500">{c.matches.map((m) => m.usName ?? m.query).join(" + ")}</span>
                    </button>
                    <button aria-label={`Remove ${c.brand}`} className="px-2 text-zinc-400 hover:text-red-600" onClick={() => saveCabinet(cabinet.filter((x) => x.id !== c.id))}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

function Stepper({ step, onBack }: { step: Step; onBack: () => void }) {
  const steps: [Step, string][] = [["brand", "Name"], ["confirm", "Ingredients"], ["result", "US match"]];
  const at = steps.findIndex(([s]) => s === step);
  return (
    <nav aria-label="Progress" className="flex items-center justify-between gap-4 py-6">
      <button onClick={onBack} className={link}>← Back</button>
      <ol className="flex items-center gap-2 text-sm">
        {steps.map(([s, label], i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${i < at ? "bg-teal-700 text-white" : i === at ? "bg-teal-100 text-teal-900 ring-2 ring-teal-600 dark:bg-teal-950 dark:text-teal-200" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}>{i < at ? "✓" : i + 1}</span>
            <span className={`hidden sm:inline ${i === at ? "font-medium" : "text-zinc-500"}`}>{label}</span>
            {i < steps.length - 1 && <span className="w-4 border-t border-zinc-300 dark:border-zinc-700" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function LookupProgress({ slow }: { slow: boolean }) {
  return (
    <div role="status" className="rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p className="flex items-center gap-2 font-medium"><Spinner /> Finding the US version…</p>
      <ul className="mt-2 space-y-1 pl-6 text-zinc-500">
        <li>US name (National Library of Medicine)</li>
        <li>Over the counter or prescription (FDA)</li>
        <li>Brands on US shelves</li>
      </ul>
      {slow && <p className="mt-2 text-zinc-500">First lookups of a medicine take a few seconds; repeats are instant.</p>}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

// Type-ahead input with a keyboard-friendly dropdown (arrow keys, Enter, Escape).
function Combobox({ id, value, onChange, options, placeholder, big, autoFocus, ariaLabel }: { id: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; big?: boolean; autoFocus?: boolean; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const show = open && options.length > 0;
  const pick = (o: Option) => {
    setOpen(false);
    setActive(-1);
    o.onPick();
  };
  return (
    <div className="relative">
      <input
        id={id}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        className={`${input} ${big ? "py-3.5 text-lg shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(options[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-teal-50 dark:bg-teal-950/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
            >
              <span className="font-medium">{o.label}</span>
              {o.detail && <span className="ml-2 text-sm text-zinc-500">{o.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ m, onSuggest, onEdit, onForm }: { m: DrugMatch; onSuggest: (name: string) => void; onEdit: () => void; onForm: (f: Form) => void }) {
  const [typedRight, setTypedRight] = useState(false);
  const box = "rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800";

  // Misspelling: offer the fix, or let the user say they typed it right.
  if (m.result === "suggestion" && m.suggestion) {
    if (typedRight) {
      return (
        <article className={box}>
          <p className="font-medium">We can&apos;t find “{m.query}” in the US drug database.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Either the US doesn&apos;t sell it, or the strip spells it a little differently. Show the strip to a pharmacist; they can look up the ingredient for you.</p>
          <button className={`${ghost} mt-3`} onClick={onEdit}>Edit the spelling</button>
        </article>
      );
    }
    return (
      <article className={box}>
        <p>We couldn&apos;t find <b>“{m.query}”</b> exactly. Did you mean <b>{m.suggestion}</b>?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={primary} onClick={() => onSuggest(m.suggestion!)}>Yes, use “{m.suggestion}”</button>
          <button className={ghost} onClick={() => setTypedRight(true)}>No, I typed it right</button>
        </div>
      </article>
    );
  }
  if (m.result === "not_found" || m.result === "error") {
    return (
      <article className={box}>
        <p className="font-medium">{m.result === "error" ? `Couldn't check “${m.query}” right now.` : `“${m.query}” isn't in the US drug database.`}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{m.result === "error" ? "The US lookup didn't answer. We won't guess." : "Check the spelling on the strip, or show the strip to a pharmacist."}</p>
        <button className={`${ghost} mt-3`} onClick={onEdit}>{m.result === "error" ? "Go back and try again" : "Edit the spelling"}</button>
      </article>
    );
  }

  const s = STATUS[m.status];
  // "paracetamol" → "acetaminophen" is a rename worth explaining; "drotaverine" → "drotaverin" is just spelling.
  const renamed = !!m.usName && m.usName.toLowerCase().slice(0, 5) !== m.query.toLowerCase().trim().slice(0, 5);
  return (
    <article className={box}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-zinc-500">{m.query}{m.strengthMg ? ` ${m.strengthMg} mg` : ""}{renamed ? " is called" : ""}</p>
          <p className="text-xl font-semibold capitalize">{m.usName ?? "—"}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${m.soldAsForms?.length ? STATUS.unknown.cls : s.cls}`}>
          {m.soldAsForms?.length ? `Not sold as ${FORM_LABEL[m.form]}` : s.label}
          {m.someFormsRx ? " (some strengths need a prescription)" : ""}
        </span>
      </div>
      {renamed && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Same medicine, different name: India says <b>{m.query}</b>, the US says <b>{m.usName}</b>.</p>}

      {m.status === "not_sold" && m.soldAsForms?.length ? (
        <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
          <p>{m.note}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {m.soldAsForms.map((f) => (
              <button key={f} className={ghost} onClick={() => onForm(f)}>Show it as {FORM_LABEL[f]}</button>
            ))}
          </div>
        </div>
      ) : (
        m.note && <p className="mt-2 text-sm">{m.note}</p>
      )}

      {m.brands.length > 0 && (
        <p className="mt-3"><span className="text-sm text-zinc-500">Look for on the shelf: </span><b>{m.brands.join(", ")}</b>, or the generic “{m.usName}”</p>
      )}
      {(m.status === "otc" || m.status === "rx") && m.brands.length === 0 && <p className="mt-3 text-sm">Sold as the generic “{m.usName}”.</p>}
      {m.sameStrengthInUS === false && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{m.strengthMg} mg isn&apos;t a standard US strength. Ask the pharmacist about the dose.</p>}

      {!!m.alternatives?.length && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-medium">{m.status === "rx" ? "Over-the-counter options to ask the pharmacist about:" : "What you can ask the pharmacist about instead:"}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {m.alternatives.map((a) => (
              <li key={a.name}><b className="capitalize">{a.name}</b>{a.brand ? ` (${a.brand})` : ""}. {a.why}.</li>
            ))}
          </ul>
          <p className="mt-1 text-xs opacity-80">Not the same medicine. Ask if it&apos;s right for you.</p>
        </div>
      )}
      {m.status === "not_sold" && !m.soldAsForms?.length && !m.alternatives?.length && (
        <p className="mt-3 text-sm"><b>What to do:</b> show the strip to a pharmacist or doctor and ask what&apos;s used for the same thing in the US.</p>
      )}
      {m.status === "rx" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
          <b>To get a US prescription:</b> book your university&apos;s student health clinic, an urgent care clinic, or a telehealth visit. Bring this strip so the doctor can see exactly what you took at home.
        </p>
      )}
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
