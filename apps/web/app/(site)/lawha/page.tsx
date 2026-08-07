import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { currentSeason, memberSeasonPoints, seasonLeaderboard } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";

/**
 * The Leaderboard for the current Season.
 *
 * `lawha` (لوحة) rather than `leaderboard`, matching `masarat`.
 *
 * Always Season-scoped, because `seasonLeaderboard` has no unscoped variant —
 * CONTEXT.md is explicit that a lifetime ranking is a different thing and does not
 * exist. Between Seasons this page therefore has nothing to rank, which is a
 * designed state rather than an error.
 */

export const metadata: Metadata = {
  title: "لوحة الموسم — مبادرة فسيلة",
  description: "ترتيب أعضاء فسيلة في الموسم الحالي، محسوباً من النقاط المُحتسبة.",
};

/**
 * Per request. The Leaderboard changes the instant anyone completes a Task, and
 * this page also highlights the reader's own row — so a shared cache would show
 * one Member's position to another.
 */
export const dynamic = "force-dynamic";

/**
 * Rank as Arabic ordinal words for the top three, digits after.
 *
 * Worth the special case: الأول carries standing in a way that ١ does not, and the
 * top three are the only positions a Member describes out loud.
 */
const ORDINAL: Record<number, string> = { 1: "الأول", 2: "الثاني", 3: "الثالث" };

export default async function LeaderboardPage() {
  const season = await currentSeason(db);

  /**
   * No open Season. The honest page, not an empty table: Points cannot be earned
   * or ranked right now, and saying so is more useful than rendering a zero-row
   * leaderboard that reads as a failed query.
   */
  if (!season) {
    return (
      <>
        <Nav current="/lawha" />
        <main>
          <section className="gutter flex min-h-[60vh] items-center py-16">
            <div className="reveal max-w-xl">
              <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">لوحة الموسم</p>
              <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
                لا يوجد موسم مفتوح
              </h1>
              <p className="text-lede mt-6 text-[var(--ink-muted)]">
                الموسم الحالي انتهى، والموسم القادم لم يبدأ بعد. النقاط لا تُحتسب خارج المواسم،
                وترتيب المواسم السابقة محفوظ.
              </p>
              <Link
                href="/masarat"
                className="text-body-sm mt-8 inline-block font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
              >
                <span aria-hidden="true">→</span> تصفّح المسارات
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  const [rows, session] = await Promise.all([
    seasonLeaderboard(db, season.id),
    auth.api.getSession({ headers: await headers() }),
  ]);

  /**
   * The reader's own standing, read from the ledger rather than searched for in
   * `rows`. A Member outside the top 50 is absent from that list entirely, and
   * telling them "you have no points" because they are 51st would be a lie.
   */
  const myPoints = session?.user ? await memberSeasonPoints(db, session.user.id, season.id) : null;
  const myRow = session?.user ? rows.find((r) => r.userId === session.user.id) : undefined;

  return (
    <>
      <Nav current="/lawha" signedIn={Boolean(session?.user)} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal max-w-3xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">لوحة الموسم</p>
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              {season.title}
            </h1>
            <p className="text-lede mt-6 max-w-xl text-[var(--ink-muted)]">
              الترتيب محسوب من النقاط المُحتسبة في هذا الموسم وحده. المتساوون في النقاط يتساوون في
              الترتيب.
            </p>
          </div>

          {/*
           * The reader's own line, above the table.
           *
           * Shown even at zero points, and even when they are far down the list.
           * The alternative — only appearing once you rank — makes the page feel
           * closed to the Member who most needs a reason to start.
           */}
          {session?.user && myPoints !== null ? (
            <div className="reveal mt-12 rounded-md border border-[var(--border)] px-6 py-5">
              <p className="text-body-sm text-[var(--ink-muted)]">
                {myPoints === 0 ? (
                  <>
                    لم تُحتسب لك نقاط في هذا الموسم بعد.{" "}
                    <Link
                      href="/masarat"
                      className="font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
                    >
                      ابدأ بمهمة
                    </Link>
                  </>
                ) : (
                  <>
                    نقاطك في هذا الموسم:{" "}
                    <span className="font-semibold text-[var(--ink)]">
                      <Num value={myPoints} />
                    </span>
                    {myRow ? (
                      <>
                        {" — "}الترتيب{" "}
                        <span className="font-semibold text-[var(--ink)]">
                          {ORDINAL[myRow.rank] ?? <Num value={myRow.rank} />}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </p>
            </div>
          ) : null}

          <div className="hairline rule-draw mt-12" />

          {/*
           * Nobody has earned anything yet. Distinct from the no-Season state
           * above: the Season is open, the Tasks are there, and the first Member to
           * complete one leads. Saying that is an invitation.
           */}
          {rows.length === 0 ? (
            <div className="py-16">
              <p className="text-body-lg max-w-lg text-[var(--ink-muted)]">
                لم تُحتسب نقاط في هذا الموسم بعد. أول من يُنجز مهمة يتصدّر اللوحة.
              </p>
              <Link
                href="/masarat"
                className="text-body-sm mt-8 inline-block rounded-md bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90"
              >
                اختر مهمة
              </Link>
            </div>
          ) : (
            <ol className="reveal-stagger mt-8">
              {rows.map((row, i) => {
                const isMe = session?.user?.id === row.userId;

                return (
                  <li
                    key={row.userId}
                    style={{ ["--i" as string]: i }}
                    className={`flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-5 ${
                      isMe ? "bg-[color-mix(in_oklch,var(--brand)_6%,transparent)] px-4" : ""
                    }`}
                  >
                    <div className="flex items-baseline gap-5">
                      {/*
                       * The rank through `Num`, not as a bare numeral. `Num`
                       * formats with `Intl` for ar-LB and wraps the result in a
                       * bidi isolate — without which a two-digit rank inside RTL
                       * prose reorders, rendering 10 as 01.
                       */}
                      <span className="text-body-lg w-8 shrink-0 font-semibold text-[var(--ink-faint)]">
                        <Num value={row.rank} />
                      </span>

                      <span className="text-body-lg font-medium text-[var(--ink)]">
                        {row.name}
                        {isMe ? (
                          <span className="text-caption ms-2 font-semibold text-[var(--brand)]">
                            أنت
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <span className="text-body-lg shrink-0 font-semibold text-[var(--brand)]">
                      <Num value={row.points} /> نقطة
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
