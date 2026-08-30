import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { memberProgress, memberTrackPoints, unreadNotificationCount } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import {
  buttonClass,
  Card,
  EmptyState,
  PageHeader,
  Pill,
  Points,
  ProgressBar,
} from "../components/ui";

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

  const [progress, trackPoints, unreadCount] = await Promise.all([
    memberProgress(db, session.user.id),
    memberTrackPoints(db, session.user.id),
    unreadNotificationCount(db, session.user.id),
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
      <Nav
        current="/hisabi"
        signedIn
        memberName={session.user.name}
        tier={progress.tier.name}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="حسابي"
            title={session.user.name?.trim() || "عضو"}
            lede={
              <span className="flex flex-wrap items-center gap-3">
                رتبتك الحالية
                <Pill tone="gold">{progress.tier.name}</Pill>
              </span>
            }
          />

          {/* Points + progress to the next rung — gold, because this is what the initiative counts. */}
          <Card tone="gold" reveal={80} className="mt-10 max-w-3xl">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-body-sm text-[var(--ink-muted)]">مجموع نقاطك</p>
              <p className="font-display text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.2] font-extrabold text-[var(--accent-ink)]">
                <Num value={progress.points} />
              </p>
            </div>

            {/*
             * The band bar. `aria-hidden` on the visual bar because the sentence below
             * states the same thing in words — a screen reader gets the fact, not a
             * decorative track.
             */}
            <div className="mt-5">
              <ProgressBar fill={fill} tone="gold" />
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
          </Card>

          {/* Where the Points came from, per Track. */}
          <h2 className="text-body-sm mt-14 mb-4 font-bold text-[var(--brand)]">
            نقاطك حسب المسار
          </h2>

          {trackPoints.length === 0 ? (
            <EmptyState
              title="لم تُحتسب لك نقاط بعد."
              body="أنجز مهمة في أحد المسارات لتبدأ رحلتك."
              action={
                <Link href="/masarat" className={buttonClass("primary", "sm")}>
                  تصفّح المسارات
                </Link>
              }
            />
          ) : (
            <ol className="max-w-3xl">
              {trackPoints.map((row, i) => (
                <li key={row.trackId} data-reveal={String(Math.min(i, 4) * 60)}>
                  <Link
                    href={`/masarat/${row.trackSlug}`}
                    className="group flex min-h-14 items-center justify-between gap-4 border-b border-[var(--hairline)] px-3 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <span className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                      {row.trackTitle}
                    </span>
                    <span className="text-body-sm shrink-0">
                      <Points>
                        <Num value={row.points} />
                      </Points>
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
