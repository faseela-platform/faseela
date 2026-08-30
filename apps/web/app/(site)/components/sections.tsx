import Link from "next/link";

import { about, app, channels, cta, footer, hadith, stations, tracks, wings } from "../content";
import { Mark } from "./mark";
import { Num } from "./num";
import { PhoneMockups } from "./phone-mockups";

/**
 * Sections below the hero — the owner's landing (assets/design/faseela-landing.dc.html), with
 * the profile document's wings and steps kept underneath (owner decision D7).
 *
 * What changed from the editorial pass (ADR 0012, revised): raised cards with soft elevation
 * and 16px radii are now allowed, pills carry the wings, and each block reveals once as it
 * enters (`data-reveal`, ADR 0011 revised). What did not change: hard alignment to the start
 * margin, restraint in size, one primary action per view, and the final state authored in the
 * markup.
 */

const sectionY = "py-[var(--section-y-sm)] md:py-[var(--section-y)]";

function Eyebrow({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "accent";
}) {
  return (
    <p
      className={`text-body-sm mb-3 font-bold ${tone === "accent" ? "text-[var(--accent)]" : "text-[var(--brand)]"}`}
    >
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  size = "section",
}: {
  children: React.ReactNode;
  size?: "section" | "invite";
}) {
  const scale =
    size === "invite" ? "text-[clamp(2rem,4vw,3rem)]" : "text-[clamp(1.75rem,3.6vw,2.625rem)]";
  return (
    <h2 className={`font-display ${scale} leading-[1.45] font-extrabold text-[var(--ink)]`}>
      {children}
    </h2>
  );
}

/**
 * من نحن — the owner's two columns: the prose with the five wings as pills, and the hadith as
 * a deep-teal quote card with the mark watermarked in the corner. The stations line (profile
 * document) folds in underneath as a hairline row, so the PDF's content stays on the page.
 */
export function About() {
  return (
    <section id="about" className={`gutter mx-auto max-w-[1440px] scroll-mt-24 ${sectionY}`}>
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-[72px]">
        <div data-reveal="0">
          <Eyebrow>{about.eyebrow}</Eyebrow>
          <SectionTitle>{about.title}</SectionTitle>
          <p className="lede text-body-lg mt-6 max-w-xl leading-[1.95] text-[var(--ink-muted)]">
            {about.body}
          </p>
          <ul className="mt-7 flex flex-wrap gap-2.5" aria-label="أجنحة العمل">
            {wings.map((wing) => (
              <li
                key={wing.title}
                className="text-caption rounded-full border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink-muted)]"
              >
                {wing.title}
              </li>
            ))}
          </ul>
        </div>

        <figure
          data-reveal="120"
          className="relative overflow-hidden rounded-[24px] px-10 py-12 text-[var(--color-paper-50)]"
          style={{
            background: "linear-gradient(160deg, var(--teal-lo), #0f3c34)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <div
            aria-hidden="true"
            className="absolute -start-12 -bottom-16 w-[300px] opacity-[0.12]"
          >
            <Mark size={300} mono shadow={false} idPrefix="about-mark" className="text-white" />
          </div>
          <blockquote className="font-display relative text-[1.625rem] leading-[1.8] font-bold">
            «{hadith.text}»
          </blockquote>
          <figcaption className="text-body-sm relative mt-4 font-semibold text-[var(--color-seedling-100)]">
            {hadith.cardAttribution}
          </figcaption>
        </figure>
      </div>

      {/* The wings in full, and the stations — the profile document's content, kept (D7). */}
      <div className="mt-20 grid gap-x-8 gap-y-10 border-t border-[var(--hairline)] pt-12 md:grid-cols-3">
        {wings.map((wing, i) => (
          <article key={wing.title} data-reveal={String((i % 3) * 80)}>
            <span className="num text-body-sm font-semibold text-[var(--accent)]" dir="ltr">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display text-card-title mt-2 leading-[1.5] font-bold text-[var(--ink)]">
              {wing.title}
            </h3>
            <p className="text-body-sm mt-2 max-w-sm text-[var(--ink-muted)]">{wing.body}</p>
          </article>
        ))}
        <article
          data-reveal="160"
          className="rounded-[var(--radius-card)] bg-[var(--surface-raised)] p-6"
          style={{ boxShadow: "var(--elevation-1)" }}
        >
          <Eyebrow tone="accent">{stations.eyebrow}</Eyebrow>
          <h3 className="font-display text-card-title leading-[1.5] font-bold text-[var(--ink)]">
            {stations.title}
          </h3>
          <p className="text-body-sm mt-2 text-[var(--ink-muted)]">{stations.body}</p>
        </article>
      </div>
    </section>
  );
}

/**
 * المنصّة — the product on a dark ground in both themes (it is the app's own night), three
 * phone mockups and four feature pills. The mockups are illustrations of real screens, captioned
 * as such.
 */
export function App() {
  return (
    <section
      id="app"
      className="scroll-mt-24 overflow-hidden text-[var(--color-paper-50)]"
      style={{ background: "linear-gradient(175deg, #0f1f1c 0%, #0b0e0d 100%)" }}
    >
      <div className="gutter mx-auto max-w-[1440px] py-[var(--section-y-sm)] md:pt-[6.5rem] md:pb-32">
        <div data-reveal="0" className="max-w-[560px]">
          <p
            className="text-body-sm mb-3 font-bold"
            style={{ color: "var(--color-logo-teal-hi-night)" }}
          >
            {app.eyebrow}
          </p>
          <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.625rem)] leading-[1.45] font-extrabold">
            {app.title}
          </h2>
          <p className="lede text-body-lg mt-5 leading-[1.9] text-[var(--color-paper-300)]">
            {app.body}
          </p>
        </div>

        <PhoneMockups />

        <ul
          data-reveal="120"
          className="mt-14 flex flex-wrap justify-center gap-3.5"
          aria-label="ميزات المنصّة"
        >
          {app.features.map((f) => (
            <li
              key={f.label}
              className="text-body-sm rounded-full border border-[var(--color-paper-800)] px-5 py-2.5 font-semibold"
              style={{
                color: f.tone === "accent" ? "var(--color-stem-200)" : "var(--color-seedling-200)",
              }}
            >
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * كيف تعمل — the four steps from the profile document, kept (D7) and restyled: cards on the
 * paper ground, the ordinal in gold, the loop in reading order.
 */
export function Steps() {
  return (
    <section id="tracks" className={`gutter mx-auto max-w-[1440px] scroll-mt-24 ${sectionY}`}>
      <div data-reveal="0" className="mb-12 max-w-3xl">
        <Eyebrow>{tracks.eyebrow}</Eyebrow>
        <SectionTitle>{tracks.title}</SectionTitle>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.steps.map((step, i) => (
          <li
            key={step.index}
            data-reveal={String(i * 80)}
            className="flex min-h-[14rem] flex-col justify-between rounded-[var(--radius-card)] bg-[var(--surface-raised)] p-6"
            style={{ boxShadow: "var(--card-shadow)" }}
          >
            <span
              className="num font-display text-page-title leading-[1.45] font-extrabold text-[var(--accent)]"
              dir="ltr"
            >
              {step.index}
            </span>
            <div>
              <h3 className="font-display text-card-title leading-[1.5] font-bold text-[var(--ink)]">
                {step.title}
              </h3>
              <p className="text-body-sm mt-2 text-[var(--ink-muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * الدعوة — the closing invitation, centred by the owner's design (the one centred block on the
 * page, and it earns it: a single action, nothing to align to). The channels fold in as the
 * social row (D7). Then the footer.
 */
export function Join() {
  return (
    <section id="join" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute start-[30%] -top-[200px] h-[600px] w-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--blob-a) 0%, transparent 65%)",
          filter: "blur(16px)",
        }}
      />
      <div className="gutter relative mx-auto max-w-[860px] pt-24 pb-20 text-center md:pt-32 md:pb-24">
        <div data-reveal="0">
          <div className="mb-5 flex justify-center">
            <Mark size={72} idPrefix="join-mark" />
          </div>
          <SectionTitle size="invite">{cta.title}</SectionTitle>
          <p className="lede text-body-lg mx-auto mt-5 max-w-[480px] leading-[1.9] text-[var(--ink-muted)]">
            {cta.body}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <Link
              href={cta.primaryHref}
              className="text-body inline-flex min-h-12 items-center rounded-[var(--radius-btn)] px-9 py-3.5 font-bold text-[var(--color-stem-950)] transition-transform duration-[150ms] ease-[var(--ease-out-expo)] hover:-translate-y-0.5 active:scale-[0.97]"
              style={{
                background: "linear-gradient(160deg, var(--gold-hi), var(--gold-lo))",
                boxShadow: "0 14px 34px color-mix(in oklch, var(--gold-lo) 30%, transparent)",
              }}
            >
              {cta.primary}
            </Link>
            <a
              href={cta.secondaryHref}
              className="text-body inline-flex min-h-12 items-center rounded-[var(--radius-btn)] border border-[var(--border)] px-9 py-3.5 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--accent)] active:scale-[0.97]"
            >
              {cta.secondary}
            </a>
          </div>

          <ul
            className="text-body-sm mt-14 flex flex-wrap justify-center gap-x-7 gap-y-3 font-semibold"
            aria-label="قنواتنا"
          >
            {channels.map((channel) => (
              <li key={channel.label}>
                <a
                  href={channel.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center gap-1.5 text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
                >
                  {channel.label}
                  <span className="num font-normal text-[var(--ink-muted)]" dir="ltr">
                    {channel.handle}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* --ink-muted, not --ink-faint: caption-size text on paper needs the darker step to pass contrast. */}
      <footer className="gutter text-caption flex flex-wrap items-center justify-between gap-2 border-t border-[var(--hairline)] py-6 text-[var(--ink-muted)]">
        <span>
          {footer.copyright} <Num value={footer.year} /> — {footer.tagline}
        </span>
        <span>{footer.motto}</span>
      </footer>
    </section>
  );
}
