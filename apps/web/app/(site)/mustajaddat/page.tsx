import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { feedItems, memberHomeTasks, memberProgress, type FeedItem } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import { CONTENT_TYPE_LABEL } from "../components/content-types";

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

  const [feed, progress, tasks] = await Promise.all([
    feedItems(db, { limit: 40 }),
    userId ? memberProgress(db, userId) : Promise.resolve(null),
    userId ? memberHomeTasks(db, userId) : Promise.resolve([]),
  ]);

  const mediaUrls = new Map<string, string>();
  if (r2IsConfigured) {
    for (const item of feed) {
      if (item.mediaKey) mediaUrls.set(item.id, await presignGetUrl(item.mediaKey));
    }
  }

  const open = tasks.filter((t) => t.submissionState === "draft" || t.submissionState === "returned");
  const awaiting = tasks.filter((t) => t.submissionState === "pending");

  return (
    <>
      <Nav
        current="/mustajaddat"
        signedIn={Boolean(userId)}
        memberName={session?.user?.name ?? null}
        tier={progress?.tier.name ?? null}
      />
      <main>
        <section className="gutter pt-10 pb-16 md:pb-24">
          {/* Zone 1 — the signed-in Member's own state (§3.1), or a visitor prompt (§43). */}
          {userId && progress ? (
            <div className="reveal mb-14 max-w-3xl rounded-lg border border-[var(--hairline)] bg-[color-mix(in_oklch,var(--brand)_4%,transparent)] p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-body-lg font-medium text-[var(--ink)]">
                  {session?.user?.name?.trim() || "أهلاً بك"}
                </p>
                <p className="text-body-sm text-[var(--ink-muted)]">
                  <span className="font-semibold text-[var(--brand)]">{progress.tier.name}</span>
                  {" · "}
                  <Num value={progress.points} /> نقطة
                </p>
              </div>
              {progress.nextTier ? (
                <p className="text-caption mt-1 text-[var(--ink-faint)]">
                  <Num value={progress.pointsToNext ?? 0} /> نقطة حتى «{progress.nextTier.name}»
                </p>
              ) : null}

              {open.length > 0 ? (
                <div className="mt-5">
                  <p className="text-caption mb-2 font-semibold text-[var(--ink-muted)]">مهمة مفتوحة</p>
                  <ul className="space-y-1">
                    {open.map((t) => (
                      <li key={t.taskId}>
                        <Link
                          href={`/masarat/${t.trackSlug}`}
                          className="text-body-sm font-medium text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
                        >
                          {t.taskTitle}
                          <span className="text-caption text-[var(--ink-faint)]"> — {t.trackTitle}</span>
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
            </div>
          ) : (
            <div className="reveal mb-14 max-w-2xl rounded-lg border border-[var(--hairline)] p-6">
              <p className="text-body-lg text-[var(--ink)]">تابِع جديد مبادرة فسيلة.</p>
              <p className="text-body-sm mt-2 text-[var(--ink-muted)]">
                سجّل دخولك لمتابعة مهامك ونقاطك وتقدّمك.
              </p>
              <Link
                href="/dukhul"
                className="text-body-sm mt-4 inline-block rounded-md bg-[var(--brand)] px-5 py-2 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90"
              >
                دخول
              </Link>
            </div>
          )}

          {/* Zone 3 + 4 — the merged content stream, newest first (§3.3/§3.4). */}
          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            المستجدّات
          </h1>
          <div className="hairline rule-draw mt-8" />

          {feed.length === 0 ? (
            <p className="text-body-sm mt-10 text-[var(--ink-muted)]">لا مستجدّات بعد.</p>
          ) : (
            <ol className="reveal-stagger mt-8 grid gap-8 md:grid-cols-2">
              {feed.map((item, i) => (
                <li key={item.id} style={{ ["--i" as string]: i }}>
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
    <article className="flex h-full flex-col rounded-lg border border-[var(--hairline)] p-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] group-hover:border-[var(--brand)]">
      {mediaUrl ? (
        <Image
          src={mediaUrl}
          alt=""
          width={480}
          height={240}
          unoptimized
          className="mb-4 h-40 w-full rounded-md object-cover"
        />
      ) : null}
      <p className="text-caption mb-2 font-semibold text-[var(--brand)]">
        {CONTENT_TYPE_LABEL[item.type]}
        {item.trackTitle ? ` · ${item.trackTitle}` : ""}
      </p>
      <h2 className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
        {item.title}
      </h2>
      <p className="text-body-sm mt-2 line-clamp-3 text-[var(--ink-muted)]">{item.body}</p>
      {item.type === "event" && item.eventAt ? (
        <p className="text-caption mt-3 text-[var(--ink-muted)]">
          {dateTimeFmt.format(item.eventAt)}
          {item.eventPlace ? ` — ${item.eventPlace}` : ""}
        </p>
      ) : null}
      <p className="text-caption mt-auto pt-4 text-[var(--ink-faint)]">
        {dateFmt.format(item.publishedAt)}
      </p>
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
