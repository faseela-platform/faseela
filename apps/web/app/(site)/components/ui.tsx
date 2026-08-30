import Link from "next/link";

import { Mark } from "./mark";

/**
 * The product surface vocabulary — Slice 9 T6, ADR 0012 (revised) and ADR 0029.
 *
 * Every product page composes these instead of restating Tailwind strings, so the
 * identity is one edit wide: radii from `--radius-*`, elevation from `--elevation-*`,
 * gold on the things the initiative counts (points, tiers, ordinals), teal on actions.
 * All server-safe; the few interactive states are CSS (`:hover`, `:active`, `:focus-visible`).
 *
 * `buttonClass()` is a string helper rather than a component on purpose: the same look
 * has to sit on `<Link>`, `<a>`, `<button type="submit">` and `useFormStatus` buttons,
 * and a wrapper component would either forward every prop or forbid one of them.
 */

export type ButtonVariant = "primary" | "gold" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] font-semibold transition-[color,background-color,border-color,transform,box-shadow,opacity] duration-[150ms] ease-[var(--ease-out-expo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "min-h-12 px-6 py-3 text-body",
  sm: "min-h-11 px-4 py-2 text-body-sm",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  /* Teal gradient with the glow — the one primary per view. */
  primary:
    "text-white bg-[linear-gradient(160deg,var(--teal-hi),var(--teal-lo))] shadow-[0_10px_28px_var(--glow)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_var(--glow)]",
  /* Gold — for the invitation and celebrations, never two on a page. */
  gold: "text-[var(--color-stem-950)] bg-[linear-gradient(160deg,var(--gold-hi),var(--gold-lo))] shadow-[0_10px_28px_color-mix(in_oklch,var(--gold-lo)_30%,transparent)] hover:-translate-y-0.5",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink)] hover:border-[var(--accent)]",
  ghost:
    "text-[var(--ink-muted)] hover:bg-[color-mix(in_oklch,var(--brand)_8%,transparent)] hover:text-[var(--brand)]",
  /* Destructive: outlined, red only on hover — it must never be the brightest thing at rest. */
  danger:
    "border border-[var(--border)] text-[var(--ink-muted)] hover:border-[oklch(0.6_0.18_25)] hover:text-[oklch(0.5_0.18_25)]",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${extra}`.trim();
}

/** Eyebrow + title + optional lede, hard-aligned to the start margin, revealed once. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  aside,
  size = "page",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Something that sits at the end of the header row (an action, a count). */
  aside?: React.ReactNode;
  /** `page` for a route's own title, `section` for a subordinate one. */
  size?: "page" | "section";
}) {
  const titleClass =
    size === "page"
      ? "font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-extrabold text-[var(--ink)]"
      : "font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]";
  return (
    <div data-reveal="0" className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-body-sm mb-3 font-bold text-[var(--brand)]">{eyebrow}</p>
        ) : null}
        <h1 className={titleClass}>{title}</h1>
        {lede ? (
          <p className="lede text-lede mt-5 max-w-xl text-[var(--ink-muted)]">{lede}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/** "→ back to X". The arrow points right: under RTL that is the way back. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-body-sm mb-10 inline-flex min-h-11 items-center gap-1.5 font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
    >
      <span aria-hidden="true" className="inline-block ltr:rotate-180">
        →
      </span>{" "}
      {children}
    </Link>
  );
}

/**
 * A raised surface. `tone="brand"` tints it with the teal (the reader's own row, a
 * live state); `tone="gold"` with the accent (a celebration, a rank). Elevation, not a
 * solid border — the hairline is only there for separation on dark grounds.
 */
export function Card({
  children,
  tone = "plain",
  padding = "md",
  className = "",
  reveal,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  tone?: "plain" | "brand" | "gold";
  padding?: "md" | "sm" | "none";
  className?: string;
  /** Reveal delay in ms; omit for no reveal. */
  reveal?: number;
  as?: "div" | "article" | "li" | "section";
}) {
  const bg =
    tone === "brand"
      ? "bg-[color-mix(in_oklch,var(--brand)_6%,var(--surface-raised))]"
      : tone === "gold"
        ? "bg-[color-mix(in_oklch,var(--gold-hi)_10%,var(--surface-raised))]"
        : "bg-[var(--surface-raised)]";
  const pad = padding === "md" ? "p-6" : padding === "sm" ? "p-4" : "";
  return (
    <Tag
      data-reveal={reveal === undefined ? undefined : String(reveal)}
      className={`rounded-[var(--radius-card)] ${bg} ${pad} ${className}`}
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {children}
    </Tag>
  );
}

/** A small label. `tone` picks the ink; the shape is always the same. */
export function Pill({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "muted" | "brand" | "gold" | "ink";
  className?: string;
}) {
  const ink =
    tone === "brand"
      ? "bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] text-[var(--brand)]"
      : tone === "gold"
        ? "bg-[color-mix(in_oklch,var(--gold-hi)_18%,transparent)] text-[var(--accent-ink)]"
        : tone === "ink"
          ? "border border-[var(--border)] text-[var(--ink)]"
          : "border border-[var(--border)] text-[var(--ink-muted)]";
  return (
    <span
      className={`text-caption inline-flex items-center rounded-full px-3 py-1 font-semibold ${ink} ${className}`}
    >
      {children}
    </span>
  );
}

/** A large ordinal or count in gold — the identity's voice for the things it counts. */
export function Ordinal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`num font-display text-page-title leading-[1.45] font-extrabold text-[var(--accent)] ${className}`}
      dir="ltr"
    >
      {children}
    </span>
  );
}

/** Points in gold with the unit. `--accent-ink`, the text-safe gold — `--accent` fails contrast at body size. */
export function Points({
  children,
  unit = "نقطة",
  className = "",
}: {
  children: React.ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={`font-semibold text-[var(--accent-ink)] ${className}`}>
      {children} {unit}
    </span>
  );
}

/**
 * An empty state that says why it is empty and what to do next, with the mark as a
 * quiet illustration (design-rules IA 5). Never a bare sentence.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-lg flex-col items-start gap-4 py-12">
      <Mark
        size={56}
        mono
        shadow={false}
        idPrefix="empty-mark"
        className="text-[var(--ink-faint)]"
      />
      <p className="text-body-lg font-medium text-[var(--ink)]">{title}</p>
      {body ? <p className="text-body-sm text-[var(--ink-muted)]">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** A determinate progress bar; the sentence beside it carries the number for readers. */
export function ProgressBar({ fill, tone = "brand" }: { fill: number; tone?: "brand" | "gold" }) {
  const grad =
    tone === "gold"
      ? "linear-gradient(90deg, var(--gold-lo), var(--gold-hi))"
      : "linear-gradient(90deg, var(--teal-lo), var(--teal-hi))";
  return (
    <div
      aria-hidden="true"
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--hairline)]"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, fill)) * 100)}%`, background: grad }}
      />
    </div>
  );
}

/** A section divider that carries a small label; replaces the bare `.hairline` + caption pairs. */
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="hairline my-10" />;
  return (
    <div className="my-10 flex items-center gap-4">
      <span className="text-caption font-semibold text-[var(--ink-muted)]">{label}</span>
      <div className="hairline flex-1" />
    </div>
  );
}
