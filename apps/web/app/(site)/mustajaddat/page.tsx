import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import {
  feedItems,
  memberHomeTasks,
  memberProgress,
  unreadNotificationCount,
  type FeedItem,
} from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import { CONTENT_TYPE_LABEL } from "../components/content-types";
import { buttonClass, Card, EmptyState, Pill, Points, ProgressBar } from "../components/ui";

/**
 * الصفحة الرئيسة (§3, §43) — a personalized read, not authored sections. Signed in,
 * it opens with the Member's own tasks and progress (§3.1), then a single merged,
 * reverse-chronological stream of published content (§3.3/§3.4 — "don't split into
 * many sections"). A visitor sees the stream and a sign-in prompt (§43). Live, so it
 * reflects a new task or a just-published piece at once. The static marketing landing
 * stays at `/`.
 */
export const metadata: Metadata = { title: "المستجدّات — مبادرة فسيلة" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });
const dateTimeFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

export default async function MustajaddatPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;

  const [feed, progress, tasks, unreadCount] = await Promise.all([
    feedItems(db, { limit: 40 }),
    userId ? memberProgress(db, userId) : Promise.resolve(null),
    userId ? memberHomeTasks(db, userId) : Promise.resolve([]),
    userId ? unreadNotificationCount(db, userId) : Promise.resolve(0),
  ]);

  const mediaUrls = new Map<string, string>();
  if (r2IsConfigured) {
    for (const item of feed) {
      if (item.mediaKey) mediaUrls.set(item.id, await presignGetUrl(item.mediaKey));
    }
  }

  const open = tasks.filter(
    (t) => t.submissionState === "draft" || t.submissionState === "returned",
  );
  const awaiting = tasks.filter((t) => t.submissionState === "pending");

  /** How far through the tier's band the Member is — the same sum `/hisabi` shows. */
  const fill = progress
    ? progress.nextTier
      ? Math.min(
          1,
          Math.max(
            0,
            (progress.points - progress.tier.minPoints) /
              (progress.nextTier.minPoints - progress.tier.minPoints || 1),
          ),
        )
      : 1
    : 0;

  return (
    <>
      <Nav
        current="/mustajaddat"
        signedIn={Boolean(userId)}
        memberName={session?.user?.name ?? null}
        tier={progress?.tier.name ?? null}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          {/* Zone 1 — the signed-in Member's own state (§3.1), or a visitor prompt (§43). */}
          {userId && progress ? (
            <Card tone="brand" reveal={0} className="mb-14 max-w-3xl">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-card-title font-bold text-[var(--ink)]">
                  {session?.user?.name?.trim() || "أهلاً بك"}
                </p>
                <p className="text-body-sm flex items-center gap-2 text-[var(--ink-muted)]">
                  <Pill tone="gold">{progress.tier.name}</Pill>
                  <Points>
                    <Num value={progress.points} />
                  </Points>
                </p>
              </div>
              <div className="mt-4">
                <ProgressBar fill={fill} tone="gold" />
              </div>
              {progress.nextTier ? (
                <p className="text-caption mt-2 text-[var(--ink-muted)]">
                  <Num value={progress.pointsToNext ?? 0} /> نقطة حتى «{progress.nextTier.name}»
                </p>
              ) : null}

              {open.length > 0 ? (
                <div className="mt-5 border-t border-[var(--hairline)] pt-4">
                  <p className="text-caption mb-2 font-semibold text-[var(--brand)]">مهمة مفتوحة</p>
                  <ul className="space-y-1">
                    {open.map((t) => (
                      <li key={t.taskId}>
                        <Link
                          href={`/masarat/${t.trackSlug}`}
                          className="text-body-sm inline-flex min-h-11 items-center font-medium text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
                        >
                          {t.taskTitle}
                          <span className="text-caption text-[var(--ink-muted)]">
                            &nbsp;— {t.trackTitle}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {awaiting.length > 0 ? (
                <p className="text-caption mt-4 text-[var(--ink-muted)]">
                  <Num value={awaiting.length} /> بانتظار المراجعة
                </p>
              ) : null}
            </Card>
          ) : (
            <Card reveal={0} className="mb-14 max-w-2xl">
              <p className="font-display text-card-title font-bold text-[var(--ink)]">
                تابِع جديد مبادرة فسيلة.
              </p>
              <p className="text-body-sm mt-2 text-[var(--ink-muted)]">
                سجّل دخولك لمتابعة مهامك ونقاطك وتقدّمك.
              </p>
              <Link href="/dukhul" className={buttonClass("primary", "sm", "mt-5")}>
                دخول
              </Link>
            </Card>
          )}

          {/* Zone 3 + 4 — the merged content stream, newest first (§3.3/§3.4). */}
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
            المستجدّات
          </h1>

          {feed.length === 0 ? (
            <div className="mt-6 border-t border-[var(--hairline)]">
              <EmptyState title="لا مستجدّات بعد." body="أول خبر أو فعالية تُنشر تظهر هنا." />
            </div>
          ) : (
            <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {feed.map((item, i) => (
                <li key={item.id} data-reveal={String((i % 3) * 80)}>
                  <FeedCard item={item} mediaUrl={mediaUrls.get(item.id) ?? null} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}

/** One content piece in the stream. Links to its Track when it has one, otherwise to
 * its outbound link, otherwise it is a plain card. Events show their time and place. */
function FeedCard({ item, mediaUrl }: { item: FeedItem; mediaUrl: string | null }) {
  const href = item.trackSlug ? `/masarat/${item.trackSlug}` : item.linkUrl || null;
  const external = !item.trackSlug && Boolean(item.linkUrl);

  const inner = (
    <article
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-raised)] transition-[transform,box-shadow] duration-[150ms] ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {mediaUrl ? (
        <Image
          src={mediaUrl}
          alt=""
          width={480}
          height={240}
          unoptimized
          className="h-40 w-full object-cover"
        />
      ) : (
        /* No image: a quiet band in the type's colour, so the grid keeps its rhythm. */
        <div
          aria-hidden="true"
          className="h-3"
          style={{
            background:
              item.type === "event"
                ? "linear-gradient(90deg, var(--gold-lo), var(--gold-hi))"
                : "linear-gradient(90deg, var(--teal-lo), var(--teal-hi))",
          }}
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption mb-2 flex flex-wrap items-center gap-2 text-[var(--ink-muted)]">
          <Pill tone={item.type === "event" ? "gold" : "brand"}>
            {CONTENT_TYPE_LABEL[item.type]}
          </Pill>
          {item.trackTitle ? <span>{item.trackTitle}</span> : null}
        </p>
        <h2 className="text-body-lg font-bold text-[var(--ink)] group-hover:text-[var(--brand)]">
          {item.title}
        </h2>
        <p className="text-body-sm mt-2 line-clamp-3 text-[var(--ink-muted)]">{item.body}</p>
        {item.type === "event" && item.eventAt ? (
          <p className="text-caption mt-3 font-semibold text-[var(--accent)]">
            {dateTimeFmt.format(item.eventAt)}
            {item.eventPlace ? ` — ${item.eventPlace}` : ""}
          </p>
        ) : null}
        <p className="text-caption mt-auto pt-4 text-[var(--ink-muted)]">
          {dateFmt.format(item.publishedAt)}
        </p>
      </div>
    </article>
  );

  if (!href) return <div className="group block h-full">{inner}</div>;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group block h-full">
      {inner}
    </a>
  ) : (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  );
}
