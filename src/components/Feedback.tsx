"use client";
import { useState } from "react";

export function Feedback({ brand, ingredients, source }: { brand: string; ingredients: string; source: string }) {
  const [state, setState] = useState<"ask" | "why" | "sent">("ask");
  const [comment, setComment] = useState("");
  async function send(verdict: "right" | "wrong", text = "") {
    setState("sent");
    try {
      await fetch("/api/feedback", { method: "POST", body: JSON.stringify({ brand, ingredients, source, verdict, comment: text }) });
    } catch {}
  }
  if (state === "sent") return <p role="status" className="text-sm text-zinc-500">Thanks. Reports like this go straight into our test set.</p>;
  if (state === "why")
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send("wrong", comment);
        }}
      >
        <label htmlFor="fb" className="block text-sm font-medium">What was wrong? (optional)</label>
        <textarea id="fb" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. the strip says 650 mg, or the pharmacist said this isn't the same" className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Send</button>
      </form>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">Was this right?</span>
      <button onClick={() => send("right")} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Yes</button>
      <button onClick={() => setState("why")} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">No, something&apos;s off</button>
    </div>
  );
}
