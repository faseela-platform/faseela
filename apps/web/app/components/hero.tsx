import { hero } from '../content';
import { Ornament } from './ornament';

/**
 * The hero sequence: three beats choreographed as one movement, ~2.1s, load-triggered.
 * See docs/design/landing-motion.md.
 *
 * Beat 1 (0-900ms)     the ornament self-draws
 * Beat 2 (700-1500ms)  the wordmark clip-reveals from the right, the reading direction
 * Beat 3 (1400-2100ms) the tagline staggers in per word, weight morphing 300 to 600
 *
 * All timing lives in globals.css so the values sit beside the keyframes they belong to. No
 * JavaScript: this is a one-shot CSS animation, which cannot jank a scroll it never listens to.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[92svh] flex-col items-center justify-center px-6 text-center">
      <Ornament className="mb-10 w-full max-w-md" />

      {/*
       * The wordmark is a heading, not an image, so it stays selectable and searchable. The
       * clip-path wrapper is a separate element from the text: animating clip-path on the <h1>
       * itself would also clip its descenders during the reveal.
       */}
      <h1 className="mb-6">
        <span className="hero-wordmark inline-block font-display text-[clamp(3.5rem,14vw,8rem)] leading-[1.42] font-bold text-[var(--brand)]">
          {hero.wordmark}
        </span>
      </h1>

      <p
        className="hero-tagline mb-8 font-display text-[clamp(1.4rem,4.5vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]"
        // A single logical sentence split for the stagger. Word boundaries only: Arabic letters
        // inside a word are joined, and splitting them severs the cursive connection.
      >
        {hero.taglineWords.map((word, i) => (
          <span
            key={word}
            className="inline-block"
            style={{ ['--i' as string]: i, marginInlineEnd: '0.28em' }}
          >
            {word}
          </span>
        ))}
      </p>

      <p className="reveal-fade mx-auto max-w-xl text-body leading-[1.75] text-[var(--ink-muted)]">
        {hero.lede}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#tracks"
          className="rounded-full bg-[var(--brand)] px-7 py-3 text-body font-medium text-white transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[var(--color-seedling-600)]"
        >
          {hero.cta}
        </a>
        <a
          href="#about"
          className="rounded-full border border-[var(--border)] px-7 py-3 text-body font-medium text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          {hero.ctaSecondary}
        </a>
      </div>
    </section>
  );
}
