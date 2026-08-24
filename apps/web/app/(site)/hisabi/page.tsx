import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { memberProgress, memberTrackPoints } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";

/**
 * A Member's profile — their standing on the permission ladder (spec §48's
 * "التقدم"). Deliberately minimal (§30): the tier they hold, the Points behind it,
 * how far the next rung is, and where those Points came from. Not a rich public
 * profile — that is Phase 3.
 *
 * Tiers run on **lifetime** Points, so this page is the one place the sum across
 * every Season is shown; the Leaderboard next door stays season-scoped (ADR 0024).
 */
export const metadata: Metadata = {
  title: "حسابي — مبادرة فسيلة",
  /** Personal, so it does not belong in a search index. */
  robots: { index: false, follow: false },
};

/** Per request: a Member's own Points and tier, never shared or cached. */
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/dukhul?callbackURL=${encodeURIComponent("/hisabi")}`);
  }

  const [progress, trackPoints] = await Promise.all([
    memberProgress(db, session.user.id),
    memberTrackPoints(db, session.user.id),
  ]);

  /**
   * How far through the current tier's band the Member is, 0–1. At the top tier
   * there is no band above, so the bar is full — an arrived state, not a stalled one.
   */
  const bandStart = progress.tier.minPoints;
  const bandEnd = progress.nextTier?.minPoints ?? progress.points;
  const fill = progress.nextTier
    ? Math.min(1, Math.max(0, (progress.points - bandStart) / (bandEnd - bandStart || 1)))
    : 1;

  return (
    <>
      <Nav current="/hisabi" signedIn memberName={session.user.name} tier={progress.tier.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal max-w-3xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">حسابي</p>
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              {session.user.name?.trim() || "عضو"}
            </h1>
            <p className="text-lede mt-4 flex items-center gap-3 text-[var(--ink-muted)]">
              رتبتك الحالية
              <span className="text-body-sm rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-3 py-1 font-semibold text-[var(--brand)]">
                {progress.tier.name}
              </span>
            </p>
          </div>

          {/* Points + progress to the next rung. */}
          <div className="reveal mt-12 max-w-3xl rounded-md border border-[var(--border)] px-6 py-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-body-sm text-[var(--ink-muted)]">مجموع نقاطك</p>
              <p className="font-display text-[clamp(1.6rem,3vw,2.441rem)] leading-[1.2] font-medium text-[var(--brand)]">
                <Num value={progress.points} />
              </p>
            </div>

            {/*
             * The band bar. `aria-hidden` on the visual bar because the sentence
             * below states the same thing in words — a screen reader gets the fact,
             * not a decorative track. CSS-only width, no client JS (ADR 0011).
             */}
            <div
              aria-hidden="true"
              className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[var(--hairline)]"
            >
              <div
                className="h-full rounded-full bg-[var(--brand)]"
                style={{ width: `${Math.round(fill * 100)}%` }}
              />
            </div>

            <p className="text-body-sm mt-4 text-[var(--ink-muted)]">
              {progress.nextTier ? (
                <>
                  باقٍ{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    <Num value={progress.pointsToNext ?? 0} />
                  </span>{" "}
                  نقطة حتى رتبة{" "}
                  <span className="font-semibold text-[var(--ink)]">{progress.nextTier.name}</span>.
                </>
              ) : (
                <>بلغت أعلى رتبة. استمرّ في الإسهام.</>
              )}
            </p>
          </div>

          <div className="hairline rule-draw mt-16" />

          {/* Where the Points came from, per Track. */}
          <h2 className="text-caption mt-12 mb-8 font-semibold text-[var(--ink-muted)]">
            نقاطك حسب المسار
          </h2>

          {trackPoints.length === 0 ? (
            <div className="py-6">
              <p className="text-body-lg max-w-lg text-[var(--ink-muted)]">
                لم تُحتسب لك نقاط بعد. أنجز مهمة في أحد المسارات لتبدأ رحلتك.
              </p>
              <Link
                href="/masarat"
                className="text-body-sm mt-6 inline-block font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
              >
                <span aria-hidden="true">→</span> تصفّح المسارات
              </Link>
            </div>
          ) : (
            <ol className="reveal-stagger max-w-3xl">
              {trackPoints.map((row, i) => (
                <li key={row.trackId} style={{ ["--i" as string]: i }}>
                  <Link
                    href={`/masarat/${row.trackSlug}`}
                    className="group flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <span className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                      {row.trackTitle}
                    </span>
                    <span className="text-body-sm shrink-0 font-semibold text-[var(--brand)]">
                      <Num value={row.points} /> نقطة
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
