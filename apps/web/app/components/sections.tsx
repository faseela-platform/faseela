import { about, channels, cta, stations, stats, tracks, wings } from '../content';
import { Num } from './num';
import { Ornament } from './ornament';

/**
 * Sections below the hero, composed to the rubric in docs/design/reference.md.
 *
 * The rules that shape every block here:
 *   - hard-aligned to the margin, never centred (logical properties, so RTL mirrors for free)
 *   - cells defined by hairline rules, never cards: no radius, no fill, no shadow (ADR 0012)
 *   - content pinned to opposite edges of a tall cell, with the void between left alone
 *   - ordinals large but recessive, never the brightest element
 *   - vertical travel only, so no reveal needs RTL adaptation
 *   - markup carries the final state; motion is layered on, so unsupported browsers and
 *     reduced-motion visitors meet finished content rather than a blank page
 */

/** Section rhythm from the `--section-y` token, so density is one edit everywhere. */
const sectionY = 'py-[var(--section-y-sm)] md:py-[var(--section-y)]';

/**
 * A quiet section label.
 *
 * The reference sets these uppercase with wide tracking. Neither device transfers to Arabic: there
 * is no case distinction, and letter-spacing severs the cursive joins, which is the most severe
 * Arabic typographic defect there is (W3C alreq §7.3, and enforced by scripts/verify-visual.mjs).
 * The Arabic register for a label is therefore carried by size, weight and muted ink alone.
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-caption font-semibold text-[var(--ink-muted)]">{children}</p>;
}

/**
 * A section heading. Deliberately much smaller than the hero: the reference runs its section titles
 * at roughly a third of the display size, and the restraint is what makes the hero read as large.
 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="max-w-3xl font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
      {children}
    </h2>
  );
}

/**
 * The initiative's real numbers, as a hairline-divided row rather than four floating figures.
 * Reads as a fact strip, which serves the legitimacy-first purpose of the page.
 */
export function Stats() {
  return (
    <section className={`gutter ${sectionY}`}>
      <div className="reveal-stagger lattice lattice-2 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={stat.label} style={{ ['--i' as string]: i }} className="!min-h-[11rem]">
            <p className="font-display text-[clamp(1.8rem,4vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              <Num value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-2 text-body-sm text-[var(--ink-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * About, as an asymmetric two-column composition: the title holds the start column and the prose
 * sits in the end column. The reference uses this shape below its hero, and it breaks the
 * centred-stack monotony a single-column page falls into.
 */
export function About() {
  return (
    <section id="about" className={`gutter ${sectionY}`}>
      <div className="reveal grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <div>
          <Eyebrow>{about.eyebrow}</Eyebrow>
          <SectionTitle>{about.title}</SectionTitle>
        </div>
        <p className="max-w-xl text-lede text-[var(--ink-muted)]">{about.body}</p>
      </div>

      {/*
       * The five wings as a hairline lattice. Each cell is tall, with the title and body pinned to
       * the bottom edge and the void above left empty — that emptiness is the point, and compressing
       * it back into a tight block is what made the first pass read as a component gallery.
       */}
      <div className="reveal-stagger lattice lattice-3 mt-20">
        {wings.map((wing, i) => (
          <article key={wing.title} style={{ ['--i' as string]: i }}>
            <span
              className="num font-display text-body-sm font-semibold text-[var(--ink-faint)]"
              dir="ltr"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="mb-3 font-display text-card-title leading-[1.5] font-medium text-[var(--ink)]">
                {wing.title}
              </h3>
              <p className="max-w-sm text-body-sm text-[var(--ink-muted)]">{wing.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * How the product works. The four steps use the same lattice, with the ordinal pinned to the top of
 * each cell and the content to the bottom — the composition the reference uses for its services
 * grid, and the closest structural analogue to Faseela's own four-step flow.
 */
export function Tracks() {
  return (
    <section id="tracks" className={`gutter ${sectionY}`}>
      <div className="reveal mb-16 max-w-3xl">
        <Eyebrow>{tracks.eyebrow}</Eyebrow>
        <SectionTitle>{tracks.title}</SectionTitle>
      </div>

      <ol className="reveal-stagger lattice lattice-2 lg:grid-cols-4">
        {tracks.steps.map((step, i) => (
          <li key={step.index} style={{ ['--i' as string]: i }}>
            {/*
             * A Latin-digit ordinal inside Arabic prose, isolated like every number on the page.
             * Large but dim: in the reference the ordinal never outshouts its own content, and
             * making it the accent colour inverts the hierarchy.
             */}
            <span
              className="num font-display text-page-title leading-[1.45] font-medium text-[var(--ink-faint)]"
              dir="ltr"
            >
              {step.index}
            </span>
            <div>
              <h3 className="mb-3 font-display text-card-title leading-[1.5] font-medium text-[var(--ink)]">
                {step.title}
              </h3>
              <p className="max-w-xs text-body-sm text-[var(--ink-muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Stations. The eyebrow محطــــات carries an authored tatweel from Faseela's own visual identity,
 * which must survive verbatim — it is a designed stretch, not incidental whitespace.
 */
export function Stations() {
  return (
    <section className={`gutter ${sectionY}`}>
      <div className="hairline rule-draw" />
      <div className="reveal mt-16 grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <div>
          <Eyebrow>{stations.eyebrow}</Eyebrow>
          <SectionTitle>{stations.title}</SectionTitle>
        </div>
        <div>
          <p className="max-w-xl text-lede text-[var(--ink-muted)]">{stations.body}</p>
          <Ornament className="mt-12 w-full max-w-md opacity-60" />
        </div>
      </div>
    </section>
  );
}

/**
 * Channels, as a hairline list rather than bordered tiles. Faseela's presence is already real and
 * public, so this block is evidence: it belongs in the legitimacy argument, not in a footer.
 */
export function Channels() {
  return (
    <section className={`gutter pb-[var(--section-y-sm)] md:pb-[var(--section-y)]`}>
      <ul className="reveal-stagger border-t border-[var(--hairline)]">
        {channels.map((channel, i) => (
          <li key={channel.label} style={{ ['--i' as string]: i }}>
            <a
              href={channel.href}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-center justify-between border-b border-[var(--hairline)] py-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[var(--color-paper-50)]"
            >
              <span className="text-body-lg font-medium text-[var(--ink)] transition-colors duration-[130ms] group-hover:text-[var(--brand)]">
                {channel.label}
              </span>
              {/* A handle is Latin text in an Arabic line — isolate it or the @ jumps sides. */}
              <span className="num text-body-sm text-[var(--ink-muted)]" dir="ltr">
                {channel.handle}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Cta() {
  return (
    <section className={`gutter border-t border-[var(--hairline)] ${sectionY}`}>
      <div className="reveal max-w-3xl">
        <SectionTitle>{cta.title}</SectionTitle>
        <p className="mt-6 mb-10 max-w-lg text-lede text-[var(--ink-muted)]">{cta.body}</p>
        <a
          href="https://linktr.ee/faseela_24"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block rounded-md bg-[var(--brand)] px-7 py-3.5 text-body-sm font-semibold text-white transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[var(--color-seedling-600)]"
        >
          {cta.primary}
        </a>
      </div>
    </section>
  );
}
