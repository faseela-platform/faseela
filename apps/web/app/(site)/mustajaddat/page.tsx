import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import {
  discoveryTracks,
  feedItems,
  followedTracksWithLatest,
  memberProgress,
  unreadNotificationCount,
  type FeedItem,
} from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { Nav } from "../components/nav";
import { CONTENT_TYPE_LABEL } from "../components/content-types";
import { buttonClass, Card, EmptyState, Pill } from "../components/ui";

/**
 * الصفحة الرئيسة (§3, §43) — a personalized read, not authored sections: the Member's
 * followed Tracks with their latest word (§3.2), then a single merged,
 * reverse-chronological stream of published content (§3.3/§3.4 — "don't split into
 * many sections"), then discovery (§3.5). A visitor sees the stream and a sign-in
 * prompt (§43). Live, so a just-published piece shows at once. The static marketing
 * landing stays at `/`.
 *
 * Owner decision 2026-09-03 (page roles): NO personal card here — §3.1's «مهامك
 * وتقدمك» was duplicating /hisabi, so tier/points/progress and the open-work list
 * live ONLY at حسابي (its سجل أعمالي already carries أعمال مفتوحة). المستجدّات is
 * purely "what's happening"; الإشعارات is "addressed to me"; حسابي is "who I am".
 * A deliberate, recorded departure from §3.1 — ADR 0036.
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

  /** `memberProgress` feeds only the nav's tier badge now — the page itself is impersonal. */
  const [feed, progress, unreadCount, followed, discover] = await Promise.all([
    feedItems(db, { limit: 40 }),
    userId ? memberProgress(db, userId) : Promise.resolve(null),
    userId ? unreadNotificationCount(db, userId) : Promise.resolve(0),
    userId ? followedTracksWithLatest(db, userId) : Promise.resolve([]),
    userId ? discoveryTracks(db, userId) : Promise.resolve([]),
  ]);

  const mediaUrls = new Map<string, string>();
  if (r2IsConfigured) {
    for (const item of feed) {
      if (item.mediaKey) mediaUrls.set(item.id, await presignGetUrl(item.mediaKey));
    }
  }

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
          {/* A visitor prompt (§43); a signed-in Member gets no personal card here —
              their state lives at /hisabi (owner decision 2026-09-03, ADR 0036). */}
          {!userId ? (
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
          ) : null}

          {/* Zone 2 — the Tracks this Member follows, each with its latest word (§3.2, R3). */}
          {userId && followed.length > 0 ? (
            <div className="mb-14 max-w-3xl">
              <h2 className="text-body-sm mb-4 font-bold text-[var(--brand)]">مسارات تتابعها</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {followed.map((f) => (
                  <li key={f.trackId}>
                    <Link
                      href={`/masarat/${f.slug}`}
                      className="block rounded-[var(--radius-card)] border border-[var(--hairline)] px-5 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)]"
                    >
                      <p className="text-body font-semibold text-[var(--ink)]">{f.title}</p>
                      <p className="text-caption mt-1 text-[var(--ink-muted)]">
                        {f.latest ? `جديدها: ${f.latest.title}` : "لا جديد بعد — مهامه بانتظارك"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
          {/* Zone 5 — اكتشف: the published Tracks the Member has not followed yet
              (§3.5's honest version, R3; the smart recommender stays deferred). */}
          {userId && discover.length > 0 ? (
            <div className="mt-16 border-t border-[var(--hairline)] pt-10">
              <h2 className="text-body-sm mb-4 font-bold text-[var(--brand)]">اكتشف مسارات أخرى</h2>
              <ul className="grid gap-3 md:grid-cols-3">
                {discover.map((d) => (
                  <li key={d.trackId}>
                    <Link
                      href={`/masarat/${d.slug}`}
                      className="block h-full rounded-[var(--radius-card)] border border-[var(--hairline)] px-5 py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)]"
                    >
                      <p className="text-body font-semibold text-[var(--ink)]">{d.title}</p>
                      <p className="text-caption mt-1 line-clamp-2 text-[var(--ink-muted)]">
                        {d.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
