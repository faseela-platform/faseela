import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { contentItemById, memberProgress, unreadNotificationCount } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { Nav } from "../../components/nav";
import { Num } from "../../components/num";
import { BackLink, buttonClass, Card, Pill, Points } from "../../components/ui";

/**
 * صفحة المحتوى (§14) — a single piece of a Track's content: its information, and
 * the Tasks linked to it (§15 path 1: الكتاب ← المهام المرتبطة به). «سأبدأ العمل
 * عليه» leads to the Track's Tasks, where the §15 path-2 picker records which
 * content the work is about.
 *
 * A draft id 404s exactly like an unknown one — the db read guarantees it.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await contentItemById(db, id);
  if (!item) return { title: "المحتوى غير موجود — مبادرة فسيلة" };
  return { title: `${item.title} — مبادرة فسيلة`, description: item.body.slice(0, 160) };
}

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await contentItemById(db, id);
  if (!item) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const [tier, unreadCount] = session?.user
    ? await Promise.all([
        memberProgress(db, session.user.id).then((p) => p.tier.name),
        unreadNotificationCount(db, session.user.id),
      ])
    : [null, 0];

  const imageUrl =
    item.mediaKey && r2IsConfigured ? await presignGetUrl(item.mediaKey, 3600) : null;
  const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" });

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
          {item.trackSlug ? (
            <BackLink href={`/masarat/${item.trackSlug}?tab=muhtawa`}>
              {item.trackTitle ?? "المسار"}
            </BackLink>
          ) : (
            <BackLink href="/mustajaddat">المستجدّات</BackLink>
          )}

          <div data-reveal="0" className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <div>
              <p className="text-body-sm mb-3 flex flex-wrap items-center gap-2 font-bold text-[var(--brand)]">
                {item.classification ? <Pill tone="brand">{item.classification}</Pill> : null}
                <span className="text-caption font-normal text-[var(--ink-muted)]">
                  {dateFmt.format(item.publishedAt)}
                </span>
              </p>
              <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
                {item.title}
              </h1>
              <p className="text-body mt-6 max-w-2xl whitespace-pre-line text-[var(--ink-muted)]">
                {item.body}
              </p>
              {item.linkUrl ? (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary", "sm", "mt-6")}
                >
                  فتح الرابط الخارجي
                </a>
              ) : null}
            </div>

            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned URL host varies; next/image would need a remote pattern per bucket
              <img
                src={imageUrl}
                alt=""
                className="h-fit w-full rounded-[var(--radius-card)] border border-[var(--hairline)] object-cover"
              />
            ) : null}
          </div>

          {/* §15 path 1: the Tasks this content opens. */}
          {item.linkedTasks.length > 0 ? (
            <div className="mt-14">
              <h2 className="text-body-sm mb-6 font-bold text-[var(--brand)]">
                المهام المرتبطة بهذا المحتوى
              </h2>
              <ol className="grid gap-4 md:grid-cols-2">
                {item.linkedTasks.map((task) => (
                  <Card key={task.id} as="li" className="flex flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-card-title leading-[1.5] font-bold text-[var(--ink)]">
                        {task.title}
                      </h3>
                      <p className="text-body-sm shrink-0 pt-1">
                        <Points>
                          <Num value={task.points} />
                        </Points>
                      </p>
                    </div>
                    <p className="text-body-sm mt-2 mb-5 text-[var(--ink-muted)]">
                      {task.instructions}
                    </p>
                    <div className="mt-auto border-t border-[var(--hairline)] pt-4">
                      <Link
                        href={`/masarat/${item.trackSlug}`}
                        className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
                      >
                        ابدأ العمل عليه من صفحة المسار
                      </Link>
                    </div>
                  </Card>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
