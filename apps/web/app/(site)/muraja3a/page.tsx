import type { Metadata } from "next";
import Link from "next/link";

import { memberProgress, reviewQueue } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import { EmptyState, PageHeader, Pill } from "../components/ui";

/**
 * The Editor's review queue (spec §16, §23): everything a Member has submitted and
 * that a human has not yet judged, oldest first.
 *
 * This is the surface that replaces Payload's admin for review (ADR 0023). It is
 * an ordinary page of ours, gated by `requireEditor` rather than a separate auth
 * system — a signed-in Member without a staff role gets a 404, never a hint that
 * the queue is here.
 */
export const metadata: Metadata = {
  title: "قائمة المراجعة — مبادرة فسيلة",
  robots: { index: false, follow: false },
};

/** Live: the queue changes the instant a Member submits or an Editor decides. */
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });

export default async function ReviewQueuePage() {
  const staff = await requireStaff();
  /** §35: a supervisor sees only their Tracks' submissions; an admin sees all. */
  const queue = await reviewQueue(
    db,
    staff.role === "admin" ? undefined : staff.supervisedTrackIds,
  );
  /** An Editor is a Member too, so their own tier shows in the nav as everywhere. */
  const tier = (await memberProgress(db, staff.id)).tier.name;

  return (
    <>
      <Nav current="/muraja3a" signedIn memberName={staff.name} tier={tier} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="المراجعة"
            title="قائمة المراجعة"
            lede="الأعمال المُرسَلة بانتظار قرارك، الأقدم أولاً. اقبل العمل فتُحتسب نقاطه، أو أعِده للتحسين، أو ارفضه."
            aside={
              queue.length > 0 ? (
                <Pill tone="brand">
                  <Num value={queue.length} /> بانتظار قرارك
                </Pill>
              ) : null
            }
          />

          {queue.length === 0 ? (
            <div className="mt-8 border-t border-[var(--hairline)]">
              <EmptyState
                title="لا أعمال بانتظار المراجعة الآن."
                body="حين يُرسل عضو عملاً يظهر هنا فوراً."
              />
            </div>
          ) : (
            <ol className="mt-8 max-w-3xl">
              {queue.map((item, i) => (
                <li key={item.submissionId} data-reveal={String(Math.min(i, 4) * 60)}>
                  <Link
                    href={`/muraja3a/${item.submissionId}`}
                    className="group flex min-h-14 items-center justify-between gap-4 border-b border-[var(--hairline)] px-3 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <div>
                      <p className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                        {item.taskTitle}
                      </p>
                      <p className="text-body-sm mt-1 text-[var(--ink-muted)]">
                        {item.memberName || "عضو"}
                        {item.attemptCount > 1 ? (
                          <>
                            {" — المحاولة "}
                            <Num value={item.attemptCount} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-caption shrink-0 text-[var(--ink-muted)]">
                      {dateFmt.format(item.submittedAt)}
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
