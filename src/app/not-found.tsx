import Link from "next/link";

// Design review: a mistyped or old link showed Next.js's bare "404 This page could not be found" with no way forward.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-700 dark:text-teal-400">Page not found</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        The link may be mistyped, or the medicine may not have its own page yet. You can still look up any Indian medicine by name.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/" className="rounded-xl bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800">
          Look up a medicine
        </Link>
        <Link href="/medicines" className="rounded-xl border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Browse medicines A–Z
        </Link>
      </div>
    </main>
  );
}
