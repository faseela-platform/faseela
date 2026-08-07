import { about, channels, cta, hadith, stations, stats, tracks, wings } from '../content';
import { Num } from './num';
import { Ornament } from './ornament';

/**
 * Sections below the hero. Every reveal is scroll-linked via the `.reveal*` classes in globals.css,
 * which use native CSS `animation-timeline` and therefore run off the main thread (ADR 0011).
 *
 * Two rules visible throughout:
 *   - vertical travel only, so nothing needs RTL adaptation
 *   - markup carries the final state, motion is layered on, so unsupported browsers and
 *     reduced-motion visitors see finished content rather than a blank page
 */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-caption font-medium tracking-normal text-[var(--accent)]">{children}</p>
  );
}

export function Hadith() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface-raised)] px-6 py-20">
      <blockquote className="reveal mx-auto max-w-2xl text-center">
        <p className="font-display text-[clamp(1.4rem,4vw,1.953rem)] leading-[1.45] font-medium text-[var(--ink)]">
          «{hadith.text}»
        </p>
        <footer className="mt-4 text-body-sm text-[var(--ink-muted)]">
          {hadith.attribution}
        </footer>
      </blockquote>
    </section>
  );
}

export function Stats() {
  return (
    <section className="px-6 py-20">
      <div className="reveal-stagger mx-auto grid max-w-4xl grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={stat.label} style={{ ['--i' as string]: i }} className="text-center">
            <p className="font-display text-[clamp(2rem,6vw,3.052rem)] leading-[1.42] font-bold text-[var(--brand)]">
              <Num value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-1 text-body-sm text-[var(--ink-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function About() {
  return (
    <section id="about" className="px-6 py-24">
      <div className="reveal mx-auto max-w-2xl text-center">
        <Eyebrow>{about.eyebrow}</Eyebrow>
        <h2 className="mb-5 font-display text-[clamp(1.8rem,5vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]">
          {about.title}
        </h2>
        <p className="text-body-lg leading-[1.7] text-[var(--ink-muted)]">{about.body}</p>
      </div>

      <div className="reveal-stagger mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wings.map((wing, i) => (
          <article
            key={wing.title}
            style={{ ['--i' as string]: i }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-start"
          >
            <h3 className="mb-2 font-display text-card-title leading-[1.5] font-semibold text-[var(--ink)]">
              {wing.title}
            </h3>
            <p className="text-body-sm leading-[1.7] text-[var(--ink-muted)]">{wing.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Tracks() {
  return (
    <section
      id="tracks"
      className="border-y border-[var(--border)] bg-[var(--surface-raised)] px-6 py-24"
    >
      <div className="reveal mx-auto mb-16 max-w-2xl text-center">
        <Eyebrow>{tracks.eyebrow}</Eyebrow>
        <h2 className="font-display text-[clamp(1.8rem,5vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]">
          {tracks.title}
        </h2>
      </div>

      <ol className="reveal-stagger mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.steps.map((step, i) => (
          <li key={step.index} style={{ ['--i' as string]: i }} className="text-start">
            {/*
             * The step index is a Latin-digit ordinal inside Arabic prose, so it is isolated like
             * every other number on the page.
             */}
            <span
              className="num mb-3 block font-display text-section leading-[1.45] font-bold text-[var(--accent)]"
              dir="ltr"
            >
              {step.index}
            </span>
            <h3 className="mb-2 font-display text-card-title leading-[1.5] font-semibold text-[var(--ink)]">
              {step.title}
            </h3>
            <p className="text-body-sm leading-[1.7] text-[var(--ink-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Stations() {
  return (
    <section className="px-6 py-24">
      <div className="reveal-grow mx-auto max-w-2xl text-center">
        <Eyebrow>{stations.eyebrow}</Eyebrow>
        <h2 className="mb-5 font-display text-[clamp(1.8rem,5vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]">
          {stations.title}
        </h2>
        <p className="text-body-lg leading-[1.7] text-[var(--ink-muted)]">{stations.body}</p>
      </div>
      <Ornament className="mx-auto mt-14 w-full max-w-sm opacity-70" />
    </section>
  );
}

export function Channels() {
  return (
    <section className="px-6 pb-24">
      <ul className="reveal-stagger mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {channels.map((channel, i) => (
          <li key={channel.label} style={{ ['--i' as string]: i }}>
            <a
              href={channel.href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-5 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)]"
            >
              <span className="text-body font-medium text-[var(--ink)]">{channel.label}</span>
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
    <section className="border-t border-[var(--border)] px-6 py-24">
      <div className="reveal mx-auto max-w-xl text-center">
        <h2 className="mb-4 font-display text-[clamp(1.8rem,5vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]">
          {cta.title}
        </h2>
        <p className="mb-8 text-body-lg leading-[1.7] text-[var(--ink-muted)]">{cta.body}</p>
        <a
          href="https://linktr.ee/faseela_24"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block rounded-full bg-[var(--brand)] px-8 py-3.5 text-body font-medium text-white transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[var(--color-seedling-600)]"
        >
          {cta.primary}
        </a>
      </div>
    </section>
  );
}
