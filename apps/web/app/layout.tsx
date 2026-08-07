import type { Metadata, Viewport } from 'next';
import { Cairo, Rubik } from 'next/font/google';

import './globals.css';

/**
 * Cairo for display, Rubik for UI and body — ADR 0009.
 *
 * Both load as variable fonts because the hero sequence morphs weight. `display: swap` keeps
 * first paint fast on Lebanese mobile data, which is the performance floor this project builds
 * against.
 */
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['arabic', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مبادرة فسيلة',
  description:
    'مبادرة فسيلة — مسارات ومهام تُنمّي الوعي والمعرفة، ومحطات ثقافية للشباب في لبنان.',
};

export const viewport: Viewport = {
  themeColor: '#f7fbfa',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // `lang` and `dir` on <html> are what make logical CSS properties resolve correctly.
    // Every `margin-inline-start` in this codebase depends on this one attribute.
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--surface)] font-body text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
