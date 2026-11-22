import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "MedMatch: find your Indian medicine at a US pharmacy",
  description: "Brought medicine from India? Find its US name, whether you need a prescription, and what to ask the pharmacist for. Checked against NIH RxNorm and FDA listings.",
  openGraph: { siteName: "MedMatch", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4 text-sm">
          {/* Logo, not a page heading: the page's own heading carries what to do. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load on purpose: resets the step-by-step state */}
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" aria-label="MedMatch home">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-700 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span className="text-base">Med<span className="text-teal-700 dark:text-teal-400">Match</span></span>
          </a>
          <nav className="flex items-center gap-4">
            <Link href="/medicines" className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">Medicines</Link>
            <Link href="/before-you-fly" className="hidden text-zinc-600 hover:text-zinc-950 sm:inline dark:text-zinc-400 dark:hover:text-white">Before you fly</Link>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Sign in</button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </nav>
        </header>
        {children}
        <footer className="mx-auto max-w-5xl border-t border-zinc-200 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800">
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/medicines" className="hover:text-zinc-900 dark:hover:text-zinc-200">Indian medicines A–Z</Link>
            <Link href="/before-you-fly" className="hover:text-zinc-900 dark:hover:text-zinc-200">Before you fly</Link>
            <Link href="/accuracy" className="hover:text-zinc-900 dark:hover:text-zinc-200">How accurate is it?</Link>
            <a href="https://github.com/nocturnalvigilante/medmatch" className="hover:text-zinc-900 dark:hover:text-zinc-200">GitHub</a>
          </nav>
          <p className="mt-4 max-w-2xl text-xs">MedMatch finds the US name for the same ingredient using NIH RxNorm and FDA listings. It isn&apos;t medical advice and never tells you what dose to take. Always confirm with a US pharmacist.</p>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
