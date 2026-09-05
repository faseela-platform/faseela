import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  canManageTrackScope,
  memberProgress,
  submissionForReview,
  submissionTrackId,
  unreadNotificationCount,
} from "@faseela/db";

import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../../components/nav";
import { Num } from "../../components/num";
import { BackLink, Card, Points } from "../../components/ui";
import { ReviewDecision } from "../review-decision";

/**
 * One Submission under review (spec §24): the Task, who submitted it, and every
 * attempt in order — each previous try and each previous note kept visible, so the
 * current attempt is judged in the light of what came before it. The verdict is
 * taken at the bottom, on the pending attempt.
 */
export const metadata: Metadata = {
  title: "مراجعة عمل — مبادرة فسيلة",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

const DECISION_LABEL: Record<"accepted" | "returned" | "rejected", string> = {
  accepted: "قُبلت",
  returned: "أُعيدت",
  rejected: "رُفضت",
};

/**
 * The line shown when a Submission is not pending, so no verdict form is offered.
 * Keyed exhaustively on the non-pending states, so adding a new state to the enum
 * is a typecheck error here rather than a silent blank.
 */
const STATE_LABEL: Record<"accepted" | "returned" | "rejected" | "draft" | "cancelled", string> = {
  accepted: "قُبل هذا العمل ونُقّط.",
  returned: "أُعيد هذا العمل للعضو، وهو ينتظر إعادة إرساله.",
  rejected: "رُفض هذا العمل نهائياً.",
  draft: "لا يزال مسودة لدى العضو.",
  cancelled: "أغلق العضو هذه المسودة.",
};

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;

  /**
   * §35/§36: a supervisor may open only their own Tracks' Submissions. Resolve the
   * Submission's Track and refuse (404) if it is out of scope — enforced here on the
   * server, not by hiding the link, so editing the URL cannot reach it.
   */
  const trackId = await submissionTrackId(db, id);
  if (!trackId || !canManageTrackScope(staff.role, staff.supervisedTrackIds, trackId)) notFound();

  const detail = await submissionForReview(db, id);
  if (!detail) notFound();

  /** An Editor is a Member too, so their own tier and bell show in the nav as everywhere. */
  const [tier, unreadCount] = await Promise.all([
    memberProgress(db, staff.id).then((p) => p.tier.name),
    unreadNotificationCount(db, staff.id),
  ]);

  /**
   * Presigned read URLs for any attached files, minted now and short-lived, so an
   * Editor can open a Member's file without the bucket being public. Built on the
   * server per attempt; absent when R2 is not configured.
   */
  const mediaUrls = new Map<number, string>();
  if (r2IsConfigured) {
    for (const a of detail.attempts) {
      if (a.mediaKey) mediaUrls.set(a.attemptNo, await presignGetUrl(a.mediaKey));
    }
  }

  return (
    <>
      <Nav
        current="/muraja3a"
        signedIn
        memberName={staff.name}
        tier={tier}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          <BackLink href="/muraja3a">قائمة المراجعة</BackLink>

          <div data-reveal="0" className="max-w-2xl">
            <p className="text-body-sm mb-3 font-bold text-[var(--brand)]">
              {detail.memberName || "عضو"}
            </p>
            <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
              {detail.taskTitle}
            </h1>
            <p className="text-body-sm mt-4 text-[var(--ink-muted)]">{detail.taskInstructions}</p>
            {detail.contentTitle ? (
              <p className="text-body-sm mt-2 text-[var(--ink-muted)]">
                المحتوى المختار:{" "}
                <span className="font-semibold text-[var(--ink)]">{detail.contentTitle}</span>
              </p>
            ) : null}
            <p className="text-caption mt-3">
              الحدّ الأقصى:{" "}
              <Points>
                <Num value={detail.taskPoints} />
              </Points>
            </p>
          </div>

          {/* The attempt history, oldest first (§24, §26 — nothing here is overwritten). */}
          <ol className="mt-10 max-w-2xl space-y-6">
            {detail.attempts.map((a, i) => (
              <li key={a.attemptNo} data-reveal={String(Math.min(i, 3) * 80)}>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <p className="text-caption font-semibold text-[var(--ink-muted)]">
                    المحاولة <Num value={a.attemptNo} />
                  </p>
                  <p className="text-caption text-[var(--ink-muted)]">
                    {dateFmt.format(a.submittedAt)}
                  </p>
                </div>

                <Card padding="sm">
                  {a.body ? (
                    <p className="text-body-sm whitespace-pre-wrap text-[var(--ink)]">{a.body}</p>
                  ) : (
                    <p className="text-body-sm text-[var(--ink-muted)]">لا نص، ملف فقط.</p>
                  )}

                  {a.mediaKey ? (
                    mediaUrls.get(a.attemptNo) ? (
                      <a
                        href={mediaUrls.get(a.attemptNo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-caption mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--brand)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand-deep)]"
                      >
                        <span aria-hidden="true">📎</span>&nbsp;افتح الملف المرفق
                      </a>
                    ) : (
                      <p className="text-caption mt-3 text-[var(--ink-muted)]">
                        ملف مرفق (المعاينة غير متاحة).
                      </p>
                    )
                  ) : null}
                </Card>

                {/* An earlier verdict on this attempt, kept beside it. */}
                {a.decision ? (
                  <p className="text-caption mt-2 text-[var(--ink-muted)]">
                    {DECISION_LABEL[a.decision]}
                    {a.decision === "accepted" && a.earnedPoints !== null ? (
                      <>
                        {" — "}
                        <Points>
                          <Num value={a.earnedPoints} />
                        </Points>
                      </>
                    ) : null}
                    {a.reviewNote ? ` — ${a.reviewNote}` : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          {/* The verdict, taken only while the work is actually pending. */}
          {detail.state === "pending" ? (
            <Card reveal={120} className="mt-10 max-w-2xl">
              <ReviewDecision submissionId={detail.submissionId} maxPoints={detail.taskPoints} />
            </Card>
          ) : (
            <p className="text-body-sm mt-10 max-w-2xl text-[var(--ink-muted)]">
              {STATE_LABEL[detail.state] ?? "لا إجراء متاح."}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
