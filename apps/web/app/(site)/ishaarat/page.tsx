import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { notificationsFor, unreadNotificationCount, type MemberNotification } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { buttonClass, EmptyState, PageHeader, Pill } from "../components/ui";
import { markAllSeenAction } from "./actions";

/**
 * الإشعارات (spec §38) — what happened to *you*: your work was accepted, returned or
 * rejected, your points were credited, a new capability opened, plus the initiative's
 * important announcements.
 *
 * Signed-in only, and live: a notification that arrived a second ago should be here.
 */
export const metadata: Metadata = {
  title: "الإشعارات — مبادرة فسيلة",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

/** A quiet mark per kind — colour alone would carry the meaning otherwise. Gold for the
 * things the initiative counts (points, tiers), teal for the product's own events. */
const KIND: Record<string, { label: string; tone: "brand" | "gold" | "muted" }> = {
  submission_accepted: { label: "قُبل", tone: "brand" },
  submission_returned: { label: "للتحسين", tone: "gold" },
  submission_rejected: { label: "لم يُقبل", tone: "muted" },
  points_awarded: { label: "نقاط", tone: "gold" },
  tier_unlocked: { label: "رتبة", tone: "gold" },
  track_update: { label: "مسار", tone: "brand" },
  app_update: { label: "تحديث", tone: "muted" },
  announcement: { label: "إعلان", tone: "brand" },
};

/** Where tapping it should take the reader, if anywhere. */
function destination(n: MemberNotification): string | null {
  if (n.trackSlug) return `/masarat/${n.trackSlug}`;
  return n.linkUrl;
}

export default async function IshaaratPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/dukhul?callbackURL=${encodeURIComponent("/ishaarat")}`);
  }

  const [items, unreadCount] = await Promise.all([
    notificationsFor(db, session.user.id),
    unreadNotificationCount(db, session.user.id),
  ]);

  return (
    <>
      <Nav current="/ishaarat" signedIn memberName={session.user.name} unreadCount={unreadCount} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="الإشعارات"
            title="ما الجديد لديك"
            aside={
              unreadCount > 0 ? (
                <form action={markAllSeenAction}>
                  <button type="submit" className={buttonClass("secondary", "sm")}>
                    تحديد الكل كمقروء
                  </button>
                </form>
              ) : null
            }
          />

          {items.length === 0 ? (
            <div className="mt-8 border-t border-[var(--hairline)]">
              <EmptyState
                title="لا إشعارات بعد."
                body="سيصلك هنا خبر قبول عملك واحتساب نقاطك وكل جديد من المبادرة."
              />
            </div>
          ) : (
            <ol className="mt-8 max-w-3xl space-y-3">
              {items.map((n, i) => {
                const kind = KIND[n.type] ?? { label: "إشعار", tone: "muted" as const };
                const href = destination(n);

                /* Unseen = a raised, teal-tinted card; seen = a quiet row. The difference is
                 * the whole point of the page, so it is carried by surface, not by colour alone
                 * (the pill says what kind it is). */
                const inner = (
                  <article
                    className={`rounded-[var(--radius-card)] px-5 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
                      n.seen
                        ? "border border-[var(--hairline)]"
                        : "bg-[color-mix(in_oklch,var(--brand)_6%,var(--surface-raised))]"
                    }`}
                    style={n.seen ? undefined : { boxShadow: "var(--elevation-1)" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-caption flex items-center gap-2 text-[var(--ink-muted)]">
                        <Pill tone={kind.tone}>{kind.label}</Pill>
                        {n.trackTitle ? <span>{n.trackTitle}</span> : null}
                      </p>
                      <p className="text-caption text-[var(--ink-muted)]">
                        {dateFmt.format(n.publishedAt)}
                      </p>
                    </div>
                    <h2 className="text-body-lg mt-2 leading-[1.5] font-bold text-[var(--ink)]">
                      {n.title}
                    </h2>
                    <p className="text-body-sm mt-1 leading-[1.7] text-[var(--ink-muted)]">
                      {n.body}
                    </p>
                  </article>
                );

                return (
                  <li key={n.id} data-reveal={String(Math.min(i, 4) * 60)}>
                    {href ? (
                      <Link
                        href={href}
                        className="group block transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
