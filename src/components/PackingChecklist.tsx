"use client";
import { useEffect, useState } from "react";

type Item = { id: string; title: string; body: string };

export function PackingChecklist({ items }: { items: Item[] }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem("packing") ?? "[]"));
    } catch {}
  }, []);
  function toggle(id: string) {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem("packing", JSON.stringify(next));
    } catch {}
  }
  const pct = Math.round((done.length / items.length) * 100);
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-sm">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums text-zinc-500">{done.length}/{items.length}</span>
      </div>
      <ol className="mt-4 space-y-2">
        {items.map((it) => {
          const on = done.includes(it.id);
          return (
            <li key={it.id}>
              <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${on ? "border-teal-500 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}>
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-teal-700" checked={on} onChange={() => toggle(it.id)} />
                <span>
                  <span className={`block font-medium ${on ? "text-zinc-500 line-through" : ""}`}>{it.title}</span>
                  <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">{it.body}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
