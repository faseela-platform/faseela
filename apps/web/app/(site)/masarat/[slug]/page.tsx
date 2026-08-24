import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completedTaskIds,
  memberProgress,
  memberSubmissions,
  publishedTracks,
  trackBySlug,
} from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { r2IsConfigured } from "@/lib/r2";
import { Nav } from "../../components/nav";
import { Num } from "../../components/num";
import { AttestButton } from "../attest-button";
import { ReviewPanel } from "../review-panel";

/**
 * A single Track with its Tasks — the vertical slice's deepest page, and the
 * first in the codebase where the database's own vocabulary reaches the reader.
 *
 * A Server Component that now mounts one Client Component. Until the attest
 * button existed this page shipped no JavaScript at all; it now ships the button
 * and nothing else — the reveals are still CSS scroll timelines, and the Task
 * list, the totals and the session read all stay on the server.
 */

/**
 * Rendered per request, not every 60 seconds.
 *
 * It was `revalidate = 60` while this page was anonymous. It cannot stay that way
 * now that it reads the session: a cached copy would show one Member's completed
 * Tasks to the next visitor, and on a page whose whole purpose is recording who
 * did what, serving somebody else's progress is the worst possible bug. Reading
 * `headers()` opts this route into dynamic rendering anyway — this line only makes
 * the intent explicit rather than incidental.
 */
export const dynamic = "force-dynamic";

/**
 * Pre-renders the known Tracks at build time while leaving unknown slugs to be
 * rendered on demand. `dynamicParams` defaults to true, which is what allows a
 * Track published after the build to work without a redeploy — with it false, a
 * newly published Track would 404 until someone rebuilt.
 */
export async function generateStaticParams() {
  const tracks = await publishedTracks(db);
  return tracks.map((track) => ({ slug: track.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const track = await trackBySlug(db, slug);

  if (!track) return { title: "المسار غير موجود — مبادرة فسيلة" };

  return {
    title: `${track.title} — مبادرة فسيلة`,
    /** The Track's own summary, which is written as prose and needs no truncation. */
    description: track.summary,
  };
}

/**
 * How a Task is completed, in the reader's language.
 *
 * The database stores `attest` and `review`; neither word means anything to a
 * Member. The mapping lives here rather than in the schema because it is
 * presentation: the same enum will need different wording in a review queue than
 * on a public page.
 */
const MODE_LABEL: Record<"attest" | "review", string> = {
  attest: "تأكيد ذاتي",
  review: "بحاجة إلى مراجعة",
};

const MODE_HINT: Record<"attest" | "review", string> = {
  attest: "تُحتسب نقاطها بمجرّد تأكيدك إنجازها.",
  review: "أرسل عملك، وتُحتسب النقاط بعد قبوله.",
};

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const track = await trackBySlug(db, slug);

  /**
   * `notFound()` covers both an unknown slug and a slug that exists but is not
   * published — `trackBySlug` returns null for both, deliberately, so an
   * unpublished Track cannot be detected by the shape of its error.
   */
  if (!track) notFound();

  /**
   * Who is reading, and what they have already done. Both are needed before the
   * Task list renders, because a Task the Member finished must not present a
   * button that the database would refuse.
   */
  const session = await auth.api.getSession({ headers: await headers() });
  const taskIds = track.tasks.map((t) => t.id);
  const done = session?.user
    ? await completedTaskIds(db, session.user.id, taskIds)
    : new Set<string>();

  /**
   * The Member's own Submissions for this Track's `review` Tasks, so each one
   * renders in its true state — a draft to resume, work under review, a return to
   * revise, or an accepted Task — rather than a bare form. Keyed by Task id.
   */
  const mySubmissions = session?.user ? await memberSubmissions(db, session.user.id, taskIds) : [];
  const submissionByTask = new Map(mySubmissions.map((s) => [s.taskId, s]));

  /** The Member's tier (lifetime), for the nav badge. */
  const tier = session?.user ? (await memberProgress(db, session.user.id)).tier.name : null;

  return (
    <>
      <Nav
        current="/masarat"
        signedIn={Boolean(session?.user)}
        memberName={session?.user?.name}
        tier={tier}
      />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          {/*
           * A back link, not a breadcrumb trail. One level up is the only ancestor
           * this page has, and a two-item breadcrumb is more chrome than
           * information. The arrow points right, the direction "back" travels in RTL.
           */}
          <Link
            href="/masarat"
            className="text-body-sm mb-12 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            {/*
             * The arrow points RIGHT. Under RTL the reader travels leftward, so “back” is rightward
             * — the opposite of the LTR convention. A left arrow here, which is what this first
             * read as, points the reader deeper into the page rather than out of it.
             *
             * `aria-hidden` because the arrow is decoration: the link already says كل المسارات, and
             * a screen reader announcing “right arrow” adds nothing.
             */}
            <span aria-hidden="true">→</span> كل المسارات
          </Link>

          <div className="reveal grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <div>
              <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
                {track.title}
              </h1>
              <p className="text-lede mt-6 max-w-xl text-[var(--ink-muted)]">{track.summary}</p>
            </div>

            {/*
             * The Track's totals, pinned to the end column. Both are computed from
             * the Task rows rather than stored on the Track, so they cannot drift
             * from the Tasks actually published.
             */}
            <dl className="flex items-start gap-10 md:justify-end">
              <div>
                <dt className="text-body-sm mb-2 text-[var(--ink-muted)]">عدد المهام</dt>
                <dd className="font-display text-[clamp(1.6rem,3vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
                  <Num value={track.tasks.length} />
                </dd>
              </div>
              <div>
                <dt className="text-body-sm mb-2 text-[var(--ink-muted)]">مجموع النقاط</dt>
                <dd className="font-display text-[clamp(1.6rem,3vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
                  <Num value={track.totalPoints} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="hairline rule-draw mt-16" />

          {/*
           * The empty Task list is a designed state, not an error. حتى يسمع كلام الله
           * has no Tasks today because neither source document describes any
           * (ADR 0019), and this Track is genuinely published — so the page says so
           * plainly rather than rendering an empty lattice that reads as a bug.
           */}
          {track.tasks.length === 0 ? (
            <div className="py-16">
              <p className="text-body-lg max-w-lg text-[var(--ink-muted)]">
                مهام هذا المسار قيد الإعداد. المسار منشور، وستُضاف مهامه قريباً.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-caption mt-16 mb-8 font-semibold text-[var(--ink-muted)]">
                المهام
              </h2>

              <ol className="reveal-stagger lattice lattice-2">
                {track.tasks.map((task, i) => (
                  <li key={task.id} style={{ ["--i" as string]: i }}>
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="num font-display text-page-title leading-[1.45] font-medium text-[var(--ink-faint)]"
                        dir="ltr"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      {/*
                       * The Points value. Prominent, because it is the reason a Member
                       * reads this cell at all — but still not brighter than the Task
                       * title, which is what the ordinal's dimness protects.
                       */}
                      <p className="text-body-sm shrink-0 font-semibold text-[var(--brand)]">
                        <Num value={task.points} /> نقطة
                      </p>
                    </div>

                    <div>
                      <h3 className="font-display text-card-title mb-3 leading-[1.5] font-medium text-[var(--ink)]">
                        {task.title}
                      </h3>
                      <p className="text-body-sm mb-5 max-w-sm text-[var(--ink-muted)]">
                        {task.instructions}
                      </p>

                      {/*
                       * How completion works, stated on the Task rather than explained
                       * once at the top. A Member deciding whether to start this Task
                       * needs to know now whether it waits on an Editor.
                       */}
                      <p className="text-caption mb-4 text-[var(--ink-faint)]">
                        <span className="font-semibold">{MODE_LABEL[task.mode]}</span>
                        {" — "}
                        {MODE_HINT[task.mode]}
                      </p>

                      {/*
                       * `attest` Tasks get a button; `review` Tasks get the
                       * submission panel — the two completion paths, each rendered
                       * in the Member's own state. Signed-out readers get a sign-in
                       * link either way, its `callbackURL` returning them to this
                       * exact Track so completing a Task never costs two navigations.
                       */}
                      {task.mode === "attest" ? (
                        session?.user ? (
                          <AttestButton
                            taskId={task.id}
                            trackSlug={track.slug}
                            points={task.points}
                            alreadyDone={done.has(task.id)}
                          />
                        ) : (
                          <Link
                            href={`/dukhul?callbackURL=/masarat/${track.slug}`}
                            className="text-body-sm font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
                          >
                            سجّل دخولك لتأكيد الإنجاز
                          </Link>
                        )
                      ) : session?.user ? (
                        <ReviewPanel
                          taskId={task.id}
                          trackSlug={track.slug}
                          state={submissionByTask.get(task.id)?.state ?? null}
                          initialBody={submissionByTask.get(task.id)?.body ?? ""}
                          initialMediaKey={submissionByTask.get(task.id)?.mediaKey ?? null}
                          reviewNote={submissionByTask.get(task.id)?.reviewNote ?? null}
                          r2Enabled={r2IsConfigured}
                        />
                      ) : (
                        <Link
                          href={`/dukhul?callbackURL=/masarat/${track.slug}`}
                          className="text-body-sm font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
                        >
                          سجّل دخولك لإرسال عملك
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {/*
         * A way onward, so a Track that runs out of Tasks does not dead-end the
         * reader. The obvious next move from the end of one Track is another Track.
         */}
        <section className="gutter border-t border-[var(--hairline)] py-16">
          <Link
            href="/masarat"
            className="text-body-lg font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> تصفّح باقي المسارات
          </Link>
        </section>
      </main>
    </>
  );
}
