import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completedTaskIds,
  followedTrackIds,
  memberProgress,
  unreadNotificationCount,
  memberSubmissions,
  publishedTracks,
  taskContentChoices,
  trackBySlug,
  trackContentItems,
  trackFollowerCounts,
} from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { r2IsConfigured } from "@/lib/r2";
import { taskStage, walkedSegments } from "@/lib/road";
import { Nav } from "../../components/nav";
import { Num } from "../../components/num";
import {
  BackLink,
  buttonClass,
  Card,
  EmptyState,
  Ordinal,
  Pill,
  Points,
} from "../../components/ui";
import { AttestButton } from "../attest-button";
import { follow, unfollow } from "../actions";
import { ReviewPanel } from "../review-panel";
import { RoadLane } from "../road";

/**
 * A single Track with its Tasks — the vertical slice's deepest page, and the
 * first in the codebase where the database's own vocabulary reaches the reader.
 *
 * A Server Component that mounts the completion controls as its only client code;
 * the Task list, the totals and the session read all stay on the server.
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

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
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

  /**
   * §10/§11: whether this reader follows the Track, and how many do; §13: the
   * Track's published content for the المحتوى tab; §15 path 2: each scoped review
   * Task's choosable content, for the submission picker.
   */
  const [followedSet, followerCounts, contentItems] = await Promise.all([
    session?.user ? followedTrackIds(db, session.user.id) : Promise.resolve(new Set<string>()),
    trackFollowerCounts(db, [track.id]),
    trackContentItems(db, track.id),
  ]);
  const isFollowing = followedSet.has(track.id);
  const followerCount = followerCounts.get(track.id) ?? 0;
  const choicesEntries = await Promise.all(
    track.tasks
      .filter((t) => t.mode === "review")
      .map(async (t) => [t.id, await taskContentChoices(db, t.id)] as const),
  );
  const choicesByTask = new Map(choicesEntries);
  const activeTab: "maham" | "muhtawa" = tab === "muhtawa" ? "muhtawa" : "maham";

  /**
   * طريق الفسائل: each Task's growth stage and how far the road reads as walked
   * earth — both server-computed so the road needs no client JavaScript at all.
   */
  const stages = track.tasks.map((task) =>
    taskStage(task.mode, done.has(task.id), submissionByTask.get(task.id)?.state ?? null),
  );
  const walked = walkedSegments(stages);

  /** The Member's tier (lifetime) and unread notifications, for the nav badge and bell. */
  const [tier, unreadCount] = session?.user
    ? await Promise.all([
        memberProgress(db, session.user.id).then((p) => p.tier.name),
        unreadNotificationCount(db, session.user.id),
      ])
    : [null, 0];

  return (
    <>
      <Nav
        current="/masarat"
        signedIn={Boolean(session?.user)}
        memberName={session?.user?.name}
        tier={tier}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          {/*
           * A back link, not a breadcrumb trail. One level up is the only ancestor
           * this page has, and a two-item breadcrumb is more chrome than information.
           */}
          <BackLink href="/masarat">كل المسارات</BackLink>

          <div data-reveal="0" className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <div>
              <p className="text-body-sm mb-3 font-bold text-[var(--brand)]">مسار</p>
              <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
                {track.title}
              </h1>
              <p className="lede text-lede mt-5 max-w-xl text-[var(--ink-muted)]">
                {track.summary}
              </p>

              {/* §11: the follow affordance and the follower count, as ONE persistent
                  toggle on both platforms (owner, 2026-09-05): the following state is
                  itself the unfollow button — supersedes §11's hide-button +
                  foot-unfollow reading (ADR 0035 note). */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {isFollowing ? (
                  <form action={unfollow.bind(null, track.id, track.slug)}>
                    <button
                      type="submit"
                      className="text-body-sm inline-flex min-h-11 items-center rounded-[var(--radius-chip)] bg-[var(--tint-brand)] px-4 font-semibold text-[var(--brand-deep)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-transparent hover:text-[var(--ink-muted)]"
                      title="إلغاء المتابعة"
                    >
                      تتابع هذا المسار ✓
                    </button>
                  </form>
                ) : (
                  <form action={follow.bind(null, track.id, track.slug)}>
                    <button type="submit" className={buttonClass("primary", "sm")}>
                      تابع المسار
                    </button>
                  </form>
                )}
                <p className="text-body-sm text-[var(--ink-muted)]">
                  <Num value={followerCount} /> {followerCount === 1 ? "متابع" : "متابعون"}
                </p>
              </div>
            </div>

            {/*
             * The Track's totals, pinned to the end column — the Points in gold, the
             * count in ink. Both are computed from the Task rows rather than stored on
             * the Track, so they cannot drift from the Tasks actually published.
             */}
            <dl className="flex items-start gap-10 md:justify-end">
              <div>
                <dt className="text-body-sm mb-2 text-[var(--ink-muted)]">عدد المهام</dt>
                <dd className="font-display text-[clamp(1.6rem,3vw,2.441rem)] leading-[1.42] font-bold text-[var(--ink)]">
                  <Num value={track.tasks.length} />
                </dd>
              </div>
              <div>
                <dt className="text-body-sm mb-2 text-[var(--ink-muted)]">مجموع النقاط</dt>
                <dd className="font-display text-[clamp(1.6rem,3vw,2.441rem)] leading-[1.42] font-bold text-[var(--accent)]">
                  <Num value={track.totalPoints} />
                </dd>
              </div>
            </dl>
          </div>

          {/*
           * The empty Task list is a designed state, not an error. حتى يسمع كلام الله
           * has no Tasks today because neither source document describes any
           * (ADR 0019), and this Track is genuinely published — so the page says so
           * plainly rather than rendering an empty grid that reads as a bug.
           */}
          {/* §13: the Track page's two faces — its materials and its Tasks. Server-
              rendered tabs (links, no JS): the road stays on المهام, the content
              grid lives on المحتوى, and either can be linked to directly. */}
          <nav
            aria-label="أقسام المسار"
            className="mt-12 flex gap-2 border-b border-[var(--hairline)]"
          >
            {(
              [
                ["maham", "المهام", `/masarat/${track.slug}`],
                ["muhtawa", "المحتوى", `/masarat/${track.slug}?tab=muhtawa`],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                aria-current={activeTab === key ? "page" : undefined}
                className={`text-body-sm inline-flex min-h-11 items-center border-b-2 px-4 font-semibold transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
                  activeTab === key
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-transparent text-[var(--ink-muted)] hover:text-[var(--brand)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {activeTab === "muhtawa" ? (
            contentItems.length === 0 ? (
              <EmptyState
                title="محتوى هذا المسار قيد الإعداد."
                body="سيضيف مشرفو المسار موادّه قريباً."
              />
            ) : (
              <ol className="mt-8 grid gap-4 md:grid-cols-2">
                {contentItems.map((item, i) => (
                  <Card
                    key={item.id}
                    as="li"
                    reveal={(i % 2) * 80}
                    className="relative flex flex-col transition-shadow duration-[130ms] ease-[var(--ease-hover)] has-[a:hover]:shadow-[var(--card-shadow)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-card-title leading-[1.5] font-bold">
                        {/* The heading is the stretched link so the card's accessible
                            name is the TITLE, not a CTA repeated on every card. */}
                        <Link
                          href={`/muhtawa/${item.id}`}
                          className="text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] after:absolute after:inset-0 after:content-[''] hover:text-[var(--brand)]"
                        >
                          {item.title}
                        </Link>
                      </h3>
                      {item.classification ? <Pill tone="brand">{item.classification}</Pill> : null}
                    </div>
                    <p className="text-body-sm mt-2 mb-4 line-clamp-3 text-[var(--ink-muted)]">
                      {item.body}
                    </p>
                    <div className="mt-auto border-t border-[var(--hairline)] pt-4">
                      {/* brand-deep, not brand: as plain small text this must clear the
                          contrast floor on its own (axe flagged the lighter teal). */}
                      <p
                        aria-hidden="true"
                        className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--brand-deep)]"
                      >
                        اقرأ وابدأ العمل عليه ←
                      </p>
                    </div>
                  </Card>
                ))}
              </ol>
            )
          ) : track.tasks.length === 0 ? (
            <div className="mt-12 border-t border-[var(--hairline)]">
              <EmptyState
                title="مهام هذا المسار قيد الإعداد."
                body="المسار منشور، وستُضاف مهامه قريباً."
              />
            </div>
          ) : (
            <>
              {/*
               * طريق الفسائل: a single winding lane down the list, the card on
               * alternating sides (small screens: a straight rail at the inline
               * start). The `<ol>` order is the reading order; the lane is pure
               * decoration and every row's semantics live in its card.
               */}
              <ol>
                {track.tasks.map((task, i) => (
                  <li
                    key={task.id}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]"
                  >
                    <div className="col-start-1 row-start-1 md:col-start-2">
                      <RoadLane index={i} stage={stages[i]} walked={i < walked} />
                    </div>
                    <div
                      className={`col-start-2 row-start-1 py-3 ${
                        i % 2 === 0 ? "md:col-start-1" : "md:col-start-3"
                      }`}
                    >
                      <Card reveal={(i % 2) * 80} className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <Ordinal>
                            <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                          </Ordinal>
                          {/* The Points value — the reason a Member reads this card at all. */}
                          <p className="text-body-sm shrink-0 pt-2">
                            <Points>
                              <Num value={task.points} />
                            </Points>
                          </p>
                        </div>

                        <div className="mt-4 flex flex-1 flex-col">
                          <h3 className="font-display text-card-title mb-2 leading-[1.5] font-bold text-[var(--ink)]">
                            {task.title}
                          </h3>
                          <p className="text-body-sm mb-4 text-[var(--ink-muted)]">
                            {task.instructions}
                          </p>

                          {/*
                           * How completion works, stated on the Task rather than explained once
                           * at the top. A Member deciding whether to start this Task needs to
                           * know now whether it waits on an Editor.
                           */}
                          <p className="text-caption mb-5 flex flex-wrap items-center gap-2 text-[var(--ink-muted)]">
                            <Pill tone={task.mode === "review" ? "gold" : "brand"}>
                              {MODE_LABEL[task.mode]}
                            </Pill>
                            <span>{MODE_HINT[task.mode]}</span>
                          </p>

                          {/*
                           * `attest` Tasks get a button; `review` Tasks get the submission panel —
                           * the two completion paths, each rendered in the Member's own state.
                           * Signed-out readers get a sign-in link either way, its `callbackURL`
                           * returning them to this exact Track.
                           */}
                          <div className="mt-auto border-t border-[var(--hairline)] pt-4">
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
                                  className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
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
                                initialContentId={submissionByTask.get(task.id)?.contentId ?? null}
                                contentChoices={(choicesByTask.get(task.id) ?? []).map((c) => ({
                                  id: c.id,
                                  title: c.title,
                                }))}
                                reviewNote={submissionByTask.get(task.id)?.reviewNote ?? null}
                                r2Enabled={r2IsConfigured}
                              />
                            ) : (
                              <Link
                                href={`/dukhul?callbackURL=/masarat/${track.slug}`}
                                className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
                              >
                                سجّل دخولك لإرسال عملك
                              </Link>
                            )}
                          </div>
                        </div>
                      </Card>
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
        <section className="gutter mx-auto max-w-[1440px] border-t border-[var(--hairline)] py-16">
          {/* Unfollow lives in the header toggle now (owner, 2026-09-05) — one
              pattern on both platforms, no duplicate exit here. */}
          <Link
            href="/masarat"
            className="text-body-lg inline-flex min-h-11 items-center gap-1.5 font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true" className="inline-block ltr:rotate-180">
              →
            </span>{" "}
            تصفّح باقي المسارات
          </Link>
        </section>
      </main>
    </>
  );
}
