import type { Metadata, Viewport } from "next";
import type React from "react";
import { Cairo, Rubik } from "next/font/google";

import "../globals.css";
import { RevealObserver } from "./components/reveal-observer";
import { ThemeScript } from "./components/theme-script";

/**
 * Cairo for display, Rubik for UI and body — ADR 0009.
 *
 * Both load as variable fonts because the hero sequence morphs weight. `display: swap` keeps
 * first paint fast on Lebanese mobile data, which is the performance floor this project builds
 * against.
 */
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const rubik = Rubik({
  subsets: ["arabic", "latin"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مبادرة فسيلة",
  description: "مبادرة فسيلة — مسارات ومهام تُنمّي الوعي والمعرفة، ومحطات ثقافية للشباب في لبنان.",
};

export const viewport: Viewport = {
  // paper-50 by day, paper-950 by night — the browser chrome follows the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e0d" },
  ],
};

/**
 * The application's root layout, held in the `(site)` route group.
 *
 * The group survives the removal of Payload — whose admin panel once lived in a
 * sibling `(payload)` group with its own `<html>` — because the `(review)` editor
 * surface built on our own auth will sit beside it, and keeping the member site in
 * its own group leaves room for that neighbour without a later reshuffle. Route
 * groups do not appear in URLs, so `/` is still served from here.
 *
 * The document is `lang="ar" dir="rtl"`: Arabic is the source language and every
 * logical CSS property in the codebase resolves against this one `dir`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` and `dir` on <html> are what make logical CSS properties resolve correctly.
    // Every `margin-inline-start` in this codebase depends on this one attribute.
    // `suppressHydrationWarning` because `theme-script.tsx` may add `data-theme` before React
    // hydrates; that attribute is the visitor's choice, not a mismatch to repair.
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${rubik.variable} h-full antialiased`}
      suppressHydrationWarning
      // Tells Next the smooth scroll in globals.css is intentional, so it can disable it
      // during route transitions (otherwise every navigation animates to the top).
      data-scroll-behavior="smooth"
    >
      <head>
        <ThemeScript />
      </head>
      <body className="font-body flex min-h-full flex-col bg-[var(--surface)] text-[var(--ink)]">
        {/* One-shot section reveals on every page (ADR 0011 revised); ~1 KB, additive. */}
        <RevealObserver />
        {children}
      </body>
    </html>
  );
}
