import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedMatch",
  description: "Find the US name for your Indian medicine.",
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
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                Sign in to sync your cabinet
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </header>
        {children}
      </body>
    </html>
    </ClerkProvider>
  );
}
