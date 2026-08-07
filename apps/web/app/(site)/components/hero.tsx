import { hero, hadith } from '../content';
import { Ornament } from './ornament';

/**
 * The hero, composed to the measured rubric in docs/design/reference.md.
 *
 * Three rules from that rubric drive everything here:
 *
 * - Hard-aligned to the margin, never centred. Under dir="rtl" that is the right margin, achieved
 *   with logical properties so no RTL-specific rule is needed.
 * - Restraint over size. The display is clamped to 72px at weight 500, not 128px at 700. Scale is
 *   read from the long line and tight leading, not from the point size.
 * - The next section intrudes at the fold. This section is deliberately shorter than the viewport
 *   (78svh) so the following one is partly visible, which is the real scroll affordance.
 *
 * The load sequence is three overlapping beats, ~2.1s, defined in globals.css beside its keyframes.
 * No JavaScript: a one-shot CSS animation cannot jank a scroll it never listens to.
 */
export function Hero() {
  return (
    <section className="gutter relative flex min-h-[78svh] flex-col justify-end pt-32 pb-16 md:pb-24">
      <div className="max-w-5xl">
        {/*
         * The reference's eyebrow is uppercase with wide tracking. Neither transfers: Arabic has no
         * case, and letter-spacing severs the cursive joins — the highest-severity Arabic defect,
         * caught by scripts/verify-visual.mjs. The Arabic equivalent of that quiet label register is
         * a small size, a heavier weight, and muted ink, with the letterforms left intact.
         */}
        <p className="hero-eyebrow mb-6 text-caption font-semibold text-[var(--ink-muted)]">
          {hadith.text}
        </p>

        {/*
         * The wordmark and tagline form one headline block. Each line is its own clip wrapper: the
         * reveal sweeps along the reading axis without ever touching a glyph, so the cursive joins
         * and the authored tatweel in فسيلـة survive intact. Splitting Arabic into letters or
         * applying letter-spacing would sever them — see .claude/skills/faseela-arabic-rtl.
         */}
        <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.5rem)] leading-[1.42] font-medium text-[var(--ink)]">
          <span className="hero-line block overflow-hidden">
            <span className="block" style={{ ['--i' as string]: 0 }}>
              <span className="text-[var(--brand)]">{hero.wordmark}</span>
            </span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block" style={{ ['--i' as string]: 1 }}>
              {hero.taglineWords.join(' ')}
            </span>
          </span>
        </h1>

        {/*
         * The lede sits in a narrower measure than the headline. `max-w-lg` lands around 60-65
         * Arabic characters per line, which avoids the orphaned final word a wider measure produced.
         */}
        <p className="hero-lede mt-8 max-w-lg text-lede text-[var(--ink-muted)]">{hero.lede}</p>

        <div className="hero-actions mt-10 flex flex-wrap items-center gap-3">
          {/*
           * Small radius rather than pills, per ADR 0012. No trailing arrow glyph: an arrow is
           * directional and would need mirroring under RTL, where a wrong-facing arrow is worse
           * than none.
           */}
          <a
            href="#tracks"
            className="rounded-md bg-[var(--brand)] px-6 py-3 text-body-sm font-semibold text-white transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[var(--color-seedling-600)]"
          >
            {hero.cta}
          </a>
          <a
            href="#about"
            className="rounded-md px-6 py-3 text-body-sm font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            {hero.ctaSecondary}
          </a>
        </div>

        {/* The ornament closes the block as a rule rather than crowning it as decoration. */}
        <Ornament className="hero-rule mt-16 w-full max-w-2xl opacity-70" />
      </div>
    </section>
  );
}
