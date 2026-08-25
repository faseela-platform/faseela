import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { notificationsFor, unreadNotificationCount, type MemberNotification } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
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

/** A quiet mark per kind — colour alone would carry the meaning otherwise. */
const KIND: Record<string, { label: string; tone: string }> = {
  submission_accepted: { label: "قُبل", tone: "var(--brand)" },
  submission_returned: { label: "للتحسين", tone: "var(--accent)" },
  submission_rejected: { label: "لم يُقبل", tone: "var(--ink-muted)" },
  points_awarded: { label: "نقاط", tone: "var(--brand)" },
  tier_unlocked: { label: "رتبة", tone: "var(--accent)" },
  track_update: { label: "مسار", tone: "var(--ink-muted)" },
  app_update: { label: "تحديث", tone: "var(--ink-muted)" },
  announcement: { label: "إعلان", tone: "var(--brand)" },
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
      <Nav
        current="/ishaarat"
        signedIn
        memberName={session.user.name}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">الإشعارات</p>
              <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
                ما الجديد لديك
              </h1>
            </div>

            {unreadCount > 0 ? (
              <form action={markAllSeenAction}>
                <button
                  type="submit"
                  className="text-body-sm min-h-11 rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none"
                >
                  تحديد الكل كمقروء
                </button>
              </form>
            ) : null}
          </div>

          <div className="hairline rule-draw mt-10" />

          {items.length === 0 ? (
            <p className="text-body-lg mt-12 max-w-lg text-[var(--ink-muted)]">
              لا إشعارات بعد. سيصلك هنا خبر قبول عملك واحتساب نقاطك وكل جديد من المبادرة.
            </p>
          ) : (
            <ol className="reveal-stagger mt-4 max-w-3xl">
              {items.map((n, i) => {
                const kind = KIND[n.type] ?? { label: "إشعار", tone: "var(--ink-muted)" };
                const href = destination(n);

                const inner = (
                  <article
                    className={`border-b border-[var(--hairline)] py-5 ps-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
                      n.seen ? "" : "bg-[color-mix(in_oklch,var(--brand)_4%,transparent)]"
                    }`}
                    style={{ borderInlineStartWidth: n.seen ? 0 : 2, borderInlineStartColor: kind.tone }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="text-caption font-semibold" style={{ color: kind.tone }}>
                        {kind.label}
                        {n.trackTitle ? (
                          <span className="font-normal text-[var(--ink-faint)]">
                            {" "}
                            · {n.trackTitle}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-caption text-[var(--ink-faint)]">
                        {dateFmt.format(n.publishedAt)}
                      </p>
                    </div>
                    <h2 className="text-body-lg mt-1 leading-[1.5] font-medium text-[var(--ink)]">
                      {n.title}
                    </h2>
                    <p className="text-body-sm mt-1 leading-[1.7] text-[var(--ink-muted)]">
                      {n.body}
                    </p>
                  </article>
                );

                return (
                  <li key={n.id} style={{ ["--i" as string]: i }}>
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
