import Link from "next/link";

import { hadith, hero, stats } from "../content";
import { CountUp } from "./count-up";
import { HeroScene } from "./hero-scene";
import { ChipIcon, Mark3D } from "./hero-scene/mark-3d";
import { Ornament } from "./ornament";

/**
 * The hero — the owner's landing design (assets/design/faseela-landing.dc.html) with the
 * T-A scene decision folded in: sky and orb, the mark floating over land that grows out of
 * the book, the dashed orbit ring, the three loop chips, and the real numbers under the CTAs.
 *
 * Two columns under `md`: the text column hard-aligned to the start margin (the right edge
 * under RTL — ADR 0012's rule survives the redesign), the scene in the end column. On a phone
 * the scene comes first and the chips become a row, because nothing can orbit at 390px.
 *
 * Server component. The only client code is the scene island (tilt + pause) and the counters;
 * strip both and the section is complete.
 */
export function Hero() {
  return (
    <section className="hero-sky relative overflow-hidden">
      {/* Stars — behind everything, clipped by the section. The sun/moon live in the mark's stage. */}
      <div aria-hidden="true" className="hero-stars absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="hero-star absolute rounded-full bg-white"
            style={{
              top: `${s.y}%`,
              insetInlineStart: `${s.x}%`,
              width: s.size,
              height: s.size,
              opacity: 0.7,
              animationDelay: `-${(i % 7) * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="gutter relative mx-auto grid max-w-[1440px] items-center gap-8 pt-28 pb-16 md:min-h-[100svh] md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-6 md:pt-32 md:pb-20">
        {/* --- text column --- */}
        <div className="relative z-10 order-2 max-w-[640px] md:order-1">
          <p className="text-body-sm mb-5 font-semibold text-[var(--ink-muted)]">
            «{hadith.text}» — {hadith.attribution}
          </p>

          {/* 1.42, not the design's 1.32: the measured Arabic display floor (typography.md) wins. */}
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
            <span className="wordmark block">{hero.wordmark}</span>
            <span className="block text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.5] font-bold">
              {hero.taglineWords.map((word, i) => (
                <span
                  key={i}
                  className={`inline-block ${i === hero.taglineAccentIndex ? "text-[var(--brand)]" : ""}`}
                >
                  {word}
                  {i < hero.taglineWords.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
          </h1>

          <p className="lede text-body-lg mt-6 max-w-[520px] leading-[1.85] text-[var(--ink-muted)]">
            {hero.lede}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              href={hero.ctaHref}
              className="text-body inline-flex min-h-12 items-center rounded-[var(--radius-btn)] px-8 py-3.5 font-bold text-white transition-[transform,box-shadow] duration-[150ms] ease-[var(--ease-out-expo)] hover:-translate-y-0.5 active:scale-[0.97]"
              style={{
                background: "linear-gradient(160deg, var(--teal-hi), var(--teal-lo))",
                boxShadow: "0 14px 34px var(--glow)",
              }}
            >
              {hero.cta}
            </Link>
            <a
              href={hero.ctaSecondaryHref}
              className="text-body inline-flex min-h-12 items-center rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface-raised)] px-8 py-3.5 font-semibold text-[var(--ink)] transition-[color,border-color,transform] duration-[150ms] ease-[var(--ease-out-expo)] hover:border-[var(--accent)] active:scale-[0.97]"
            >
              {hero.ctaSecondary}
            </a>
          </div>

          {/* The loop as a row — phones only; on wider screens the chips orbit the mark. */}
          <ul className="mt-6 grid grid-cols-3 gap-2 md:hidden" aria-label="كيف تعمل فسيلة">
            {hero.chips.map((chip) => (
              <li
                key={chip.label}
                className="hero-chip flex flex-col items-center gap-1.5 px-2 py-3 text-center"
                style={{ animation: "none" }}
              >
                <ChipIcon kind={chip.icon} />
                <span className="text-caption font-bold text-[var(--ink)]">{chip.label}</span>
              </li>
            ))}
          </ul>

          {/* The initiative's real numbers, under the CTAs (owner's change, T-A round 2). */}
          <dl className="mt-9 grid max-w-[560px] grid-cols-2 gap-x-4 gap-y-5 border-t border-[var(--hairline)] pt-5 sm:grid-cols-4">
            {stats.map((stat) => (
              /* `dt` first in the DOM (a valid <dl>), the number above it visually. Teal and gold
                 alternate, as in the owner's stats band. */
              <div key={stat.label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-caption text-[var(--ink-muted)]">{stat.label}</dt>
                <dd
                  className={`font-display text-[1.875rem] leading-[1.2] font-bold ${stat.tone === "accent" ? "text-[var(--accent-ink)]" : "text-[var(--brand)]"}`}
                >
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </dd>
              </div>
            ))}
          </dl>

          <Ornament className="mt-10 hidden w-full max-w-md opacity-60 md:block" />
        </div>

        {/* --- scene column. Clipped on phones so the land stops at the stage instead of running under the copy. --- */}
        <div className="relative order-1 overflow-hidden md:order-2 md:overflow-visible">
          {/* The mark is server-rendered and handed to the island as children — never hydrated. */}
          <HeroScene>
            <Mark3D />
          </HeroScene>
        </div>
      </div>

      {/* Scroll hint — a quiet mouse glyph, centred, hidden on phones. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-5 hidden justify-center md:flex">
        <div className="flex h-[42px] w-[26px] justify-center rounded-[14px] border-[1.5px] border-[var(--ink-faint)] pt-[7px]">
          <span className="scroll-hint-dot h-2 w-1 rounded-[3px] bg-[var(--brand)]" />
        </div>
      </div>
    </section>
  );
}

/** Deterministic star field (no Math.random — the server and client must agree). */
const STARS = Array.from({ length: 48 }, (_, i) => ({
  x: (i * 37 + 77) % 100,
  y: (i * 53 + 49) % 55,
  size: 1 + ((i * 3) % 3),
}));
