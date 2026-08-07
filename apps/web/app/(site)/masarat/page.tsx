import type { Metadata } from "next";
import Link from "next/link";

import { publishedTracks } from "@faseela/db";

import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";

/**
 * The Tracks index — the first page in this codebase built from real database
 * rows rather than a copy module.
 *
 * `masarat` in the URL rather than `tracks`, matching the Arabic vocabulary the
 * product speaks in (مسارات). Latin transliteration, not Arabic script, for the
 * same reason `track.slug` is Latin-only: an Arabic path segment percent-encodes
 * into something unshareable.
 *
 * A server component with no client boundary, like the landing page. Nothing here
 * needs interactivity: the reveals are CSS scroll timelines (ADR 0011) and the
 * data is fetched on the server.
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
        {/*
         * Bottom padding is deliberately smaller than top. The section originally
         * used the same generous value on both edges, which on a three-Track index
         * left roughly 470px of dead space below the last cell — enough that the
         * final Track sat in an empty region the reader had no reason to scroll to.
         */}
        <section className="gutter pt-[var(--section-y-sm)] pb-16 md:pt-[var(--section-y)] md:pb-24">
          <div className="reveal mb-16 max-w-3xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">المسارات</p>
            <h1 className="font-display max-w-3xl text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              اختر مسارك وابدأ
            </h1>
            <p className="text-lede mt-6 max-w-xl text-[var(--ink-muted)]">
              كل مسار موضوع متكامل، مقسّم إلى مهام قصيرة يمكن إنجازها في وقتك. أنجز المهمة، واجمع
              نقاطها في الموسم.
            </p>
          </div>

          {/*
           * The empty state is a real state, not a defensive afterthought. Before an
           * Editor publishes anything the database is genuinely empty, and a page
           * that renders a bare grid in that case looks broken rather than early.
           */}
          {tracks.length === 0 ? (
            <div className="border-t border-[var(--hairline)] py-16">
              <p className="text-body-lg text-[var(--ink-muted)]">
                لا توجد مسارات منشورة بعد. عُد قريباً.
              </p>
            </div>
          ) : (
            /*
             * `lattice-auto` lets each cell size to its content. The default 22rem
             * floor is right for the landing page, where cells hold comparable copy;
             * here a Track with no Tasks yet sits beside one with two, and the floor
             * inflated the short cell into a 440px void mid-page.
             *
             * `gap-y` restores the breathing room the floor used to provide, without
             * tying it to a height the content does not need.
             */
            <ol className="reveal-stagger lattice lattice-2 lattice-auto gap-y-4">
              {tracks.map((track, i) => (
                <li key={track.slug} style={{ ["--i" as string]: i }}>
                  {/*
                   * The ordinal, large but dim — the same hierarchy the landing page
                   * uses. Latin digits inside an Arabic document need both the
                   * `.num` isolation and `dir="ltr"`, or a two-digit number reorders.
                   */}
                  <span
                    className="num font-display text-page-title leading-[1.45] font-medium text-[var(--ink-faint)]"
                    dir="ltr"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div>
                    <h2 className="font-display text-card-title mb-3 leading-[1.5] font-medium">
                      {/*
                       * The whole cell is not the link. A link wrapping a grid cell
                       * makes the accessible name the entire block of text, which
                       * reads as one enormous unlabelled link in a screen reader.
                       * The heading is the link; the cell is layout.
                       */}
                      <Link
                        href={`/masarat/${track.slug}`}
                        className="text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
                      >
                        {track.title}
                      </Link>
                    </h2>
                    <p className="text-body-sm mb-6 max-w-sm text-[var(--ink-muted)]">
                      {track.summary}
                    </p>

                    {/*
                     * Task count and Points as a hairline fact strip. Both are real
                     * aggregates from the database, so a Track with no Tasks yet
                     * honestly reports zero rather than being hidden.
                     */}
                    <dl className="text-body-sm flex items-center gap-6 text-[var(--ink-faint)]">
                      <div className="flex items-baseline gap-2">
                        <dt>المهام</dt>
                        <dd className="font-medium text-[var(--ink-muted)]">
                          <Num value={String(track.taskCount)} />
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <dt>النقاط</dt>
                        <dd className="font-medium text-[var(--ink-muted)]">
                          <Num value={String(track.totalPoints)} />
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/*
         * A closing invitation, so the page ends rather than merely stopping. The
         * landing page closes with a call to action for the same reason: a list
         * that runs out reads as truncated, and the Member who has just read the
         * Tracks is exactly the person to ask.
         */}
        {tracks.length > 0 && (
          <section className="gutter border-t border-[var(--hairline)] py-16 md:py-24">
            <div className="reveal max-w-xl">
              <h2 className="font-display text-[clamp(1.4rem,2.4vw,1.953rem)] leading-[1.45] font-medium text-[var(--ink)]">
                جاهز تبدأ؟
              </h2>
              <p className="text-body-lg mt-4 text-[var(--ink-muted)]">
                انضم إلى فسيلة، واختر المهمة الأولى في المسار الذي يناسبك.
              </p>
              <a
                href="https://linktr.ee/faseela_24"
                target="_blank"
                rel="noreferrer noopener"
                className="text-body-sm mt-8 inline-block rounded-md bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90"
              >
                انضم إلينا
              </a>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
