import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { currentSeason, memberProgress, memberSeasonPoints, seasonLeaderboard } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Num } from "../components/num";
import { buttonClass, Card, EmptyState, PageHeader, Pill, Points } from "../components/ui";

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
          <section className="gutter mx-auto flex min-h-[60vh] max-w-[1440px] items-center py-16">
            <div className="max-w-xl">
              <PageHeader
                eyebrow="لوحة الموسم"
                title="لا يوجد موسم مفتوح"
                lede="الموسم الحالي انتهى، والموسم القادم لم يبدأ بعد. النقاط لا تُحتسب خارج المواسم، وترتيب المواسم السابقة محفوظ."
              />
              <Link href="/masarat" className={buttonClass("secondary", "md", "mt-8")}>
                تصفّح المسارات
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
  /** The reader's tier (lifetime), for the nav badge — distinct from their season Points above. */
  const tier = session?.user ? (await memberProgress(db, session.user.id)).tier.name : null;

  return (
    <>
      <Nav
        current="/lawha"
        signedIn={Boolean(session?.user)}
        memberName={session?.user?.name}
        tier={tier}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="لوحة الموسم"
            title={season.title}
            lede="الترتيب محسوب من النقاط المُحتسبة في هذا الموسم وحده. المتساوون في النقاط يتساوون في الترتيب."
          />

          {/*
           * The reader's own line, above the table — a teal-tinted card, because it is
           * the live state, theirs. Shown even at zero points, and even when they are
           * far down the list: only appearing once you rank makes the page feel closed
           * to the Member who most needs a reason to start.
           */}
          {session?.user && myPoints !== null ? (
            <Card tone="brand" reveal={80} className="mt-10 max-w-3xl">
              <p className="text-body-sm text-[var(--ink-muted)]">
                {myPoints === 0 ? (
                  <>
                    لم تُحتسب لك نقاط في هذا الموسم بعد.{" "}
                    <Link
                      href="/masarat"
                      className="font-semibold text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
                    >
                      ابدأ بمهمة
                    </Link>
                  </>
                ) : (
                  <>
                    نقاطك في هذا الموسم:{" "}
                    <Points>
                      <Num value={myPoints} />
                    </Points>
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
            </Card>
          ) : null}

          {/*
           * Nobody has earned anything yet. Distinct from the no-Season state above:
           * the Season is open, the Tasks are there, and the first Member to complete
           * one leads. Saying that is an invitation.
           */}
          {rows.length === 0 ? (
            <div className="mt-10 border-t border-[var(--hairline)]">
              <EmptyState
                title="لم تُحتسب نقاط في هذا الموسم بعد."
                body="أول من يُنجز مهمة يتصدّر اللوحة."
                action={
                  <Link href="/masarat" className={buttonClass("primary", "sm")}>
                    اختر مهمة
                  </Link>
                }
              />
            </div>
          ) : (
            <ol className="mt-10 max-w-3xl">
              {rows.map((row, i) => {
                const isMe = session?.user?.id === row.userId;
                const top = row.rank <= 3;

                return (
                  <li
                    key={row.userId}
                    data-reveal={String(Math.min(i, 4) * 60)}
                    className={`flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-3 py-4 ${
                      isMe
                        ? "rounded-[var(--radius-card)] bg-[color-mix(in_oklch,var(--brand)_6%,transparent)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/*
                       * The rank: gold for the top three (the positions a Member says out
                       * loud), muted after. Through `Num`, which formats with `Intl` for
                       * ar-LB and wraps the result in a bidi isolate — without which a
                       * two-digit rank inside RTL prose reorders, rendering 10 as 01.
                       */}
                      <span
                        className={`font-display text-body flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold ${
                          top
                            ? "bg-[color-mix(in_oklch,var(--gold-hi)_18%,transparent)] text-[var(--accent)]"
                            : "text-[var(--ink-muted)]"
                        }`}
                      >
                        <Num value={row.rank} />
                      </span>

                      <span className="text-body-lg font-medium text-[var(--ink)]">
                        {/* Fallback so a Member who earned Points before completing
                            their §5 profile never renders as a blank row. */}
                        {row.name.trim() || "عضو"}
                        {isMe ? (
                          <Pill tone="brand" className="ms-2">
                            أنت
                          </Pill>
                        ) : null}
                      </span>
                    </div>

                    <span className="text-body-lg shrink-0">
                      <Points>
                        <Num value={row.points} />
                      </Points>
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
