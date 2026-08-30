import type { Metadata } from "next";
import Link from "next/link";

import { publishedTracks } from "@faseela/db";

import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import { buttonClass, Card, EmptyState, Ordinal, PageHeader, Points } from "../components/ui";

/**
 * The Tracks index — the first page in this codebase built from real database
 * rows rather than a copy module.
 *
 * `masarat` in the URL rather than `tracks`, matching the Arabic vocabulary the
 * product speaks in (مسارات). Latin transliteration, not Arabic script, for the
 * same reason `track.slug` is Latin-only: an Arabic path segment percent-encodes
 * into something unshareable.
 *
 * A server component with no client boundary of its own: the data is fetched on
 * the server and the reveals are the layout's observer (ADR 0011 revised).
 */

export const metadata: Metadata = {
  title: "المسارات — مبادرة فسيلة",
  description: "مسارات فسيلة: مواضيع متكاملة مقسّمة إلى مهام قصيرة تُنمّي وعيك خطوة خطوة.",
};

/**
 * Content is Editor-owned and changes without a deploy, so the page cannot be
 * statically frozen at build time. Sixty seconds is short enough that a
 * newly-published Track appears while an Editor is still looking at the site,
 * and long enough that the page is not a database query per visitor.
 */
export const revalidate = 60;

export default async function TracksIndexPage() {
  const tracks = await publishedTracks(db);

  return (
    <>
      <Nav current="/masarat" />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="المسارات"
            title="اختر مسارك وابدأ"
            lede="كل مسار موضوع متكامل، مقسّم إلى مهام قصيرة يمكن إنجازها في وقتك. أنجز المهمة، واجمع نقاطها في الموسم."
          />

          {/*
           * The empty state is a real state, not a defensive afterthought. Before an
           * Editor publishes anything the database is genuinely empty, and a page
           * that renders a bare grid in that case looks broken rather than early.
           */}
          {tracks.length === 0 ? (
            <div className="mt-12 border-t border-[var(--hairline)]">
              <EmptyState
                title="لا توجد مسارات منشورة بعد."
                body="عُد قريباً — أول مسار في طريقه."
              />
            </div>
          ) : (
            <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tracks.map((track, i) => (
                <Card
                  key={track.slug}
                  as="li"
                  reveal={(i % 3) * 80}
                  className="flex min-h-[15rem] flex-col justify-between"
                >
                  {/*
                   * The ordinal in gold — the identity's voice for the things it counts
                   * (ADR 0029). `aria-hidden` because it is decoration: the list order and
                   * the Track's own name already say which this is.
                   */}
                  <Ordinal>
                    <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  </Ordinal>

                  <div className="mt-6">
                    <h2 className="font-display text-card-title mb-2 leading-[1.5] font-bold">
                      {/*
                       * The whole card is not the link. A link wrapping a card makes the
                       * accessible name the entire block of text; the heading is the link.
                       */}
                      <Link
                        href={`/masarat/${track.slug}`}
                        className="text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
                      >
                        {track.title}
                      </Link>
                    </h2>
                    <p className="text-body-sm mb-5 text-[var(--ink-muted)]">{track.summary}</p>

                    {/*
                     * Task count and Points as a fact strip. Both are real aggregates from
                     * the database, so a Track with no Tasks yet honestly reports zero.
                     */}
                    <dl className="text-body-sm flex items-center gap-6 border-t border-[var(--hairline)] pt-4 text-[var(--ink-muted)]">
                      <div className="flex items-baseline gap-2">
                        <dt>المهام</dt>
                        <dd className="font-semibold text-[var(--ink)]">
                          <Num value={String(track.taskCount)} />
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <dt>النقاط</dt>
                        <dd>
                          <Points unit="">
                            <Num value={String(track.totalPoints)} />
                          </Points>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </Card>
              ))}
            </ol>
          )}
        </section>

        {/*
         * A closing invitation, so the page ends rather than merely stopping. The
         * Member who has just read the Tracks is exactly the person to ask — and since
         * Slice 1 an account is one e-mail away, so the invitation leads to sign-in.
         */}
        {tracks.length > 0 && (
          <section className="gutter mx-auto max-w-[1440px] border-t border-[var(--hairline)] py-16 md:py-24">
            <div data-reveal="0" className="max-w-xl">
              <h2 className="font-display text-[clamp(1.4rem,2.4vw,1.953rem)] leading-[1.45] font-bold text-[var(--ink)]">
                جاهز تبدأ؟
              </h2>
              <p className="text-body-lg mt-4 text-[var(--ink-muted)]">
                انضم إلى فسيلة، واختر المهمة الأولى في المسار الذي يناسبك.
              </p>
              <Link href="/dukhul" className={buttonClass("primary", "md", "mt-8")}>
                انضم إلينا
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
