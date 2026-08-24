import type { Metadata } from "next";
import Link from "next/link";

import { reviewQueue } from "@faseela/db";

import { db } from "@/lib/db";
import { requireEditor } from "@/lib/require-editor";
import { Nav } from "../components/nav";
import { Num } from "../components/num";

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
  const editor = await requireEditor();
  const queue = await reviewQueue(db);

  return (
    <>
      <Nav current="/muraja3a" signedIn memberName={editor.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal max-w-3xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">المراجعة</p>
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              قائمة المراجعة
            </h1>
            <p className="text-lede mt-6 max-w-xl text-[var(--ink-muted)]">
              الأعمال المُرسَلة بانتظار قرارك، الأقدم أولاً. اقبل العمل فتُحتسب نقاطه، أو أعِده
              للتحسين، أو ارفضه.
            </p>
          </div>

          <div className="hairline rule-draw mt-12" />

          {queue.length === 0 ? (
            <div className="py-16">
              <p className="text-body-lg max-w-lg text-[var(--ink-muted)]">
                لا أعمال بانتظار المراجعة الآن.
              </p>
            </div>
          ) : (
            <ol className="reveal-stagger mt-8">
              {queue.map((item, i) => (
                <li key={item.submissionId} style={{ ["--i" as string]: i }}>
                  <Link
                    href={`/muraja3a/${item.submissionId}`}
                    className="group flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
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
                    <span className="text-caption shrink-0 text-[var(--ink-faint)]">
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
