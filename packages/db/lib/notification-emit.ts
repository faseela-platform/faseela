import { eq, sql } from "drizzle-orm";

import type { Queryable } from "./client";
import { track, trackFollow } from "./content";
import { notification } from "./notification";
import { memberTier, pointAward } from "./progress";
import { tierForPoints, type Tier } from "./tiers";

/**
 * Raising the events §38 asks for — «قبول المهمة · رفض المهمة لإعادة التعديل · رفض
 * نهائي · اعتماد النقاط · فتح صلاحية جديدة».
 *
 * Every function here takes a `Queryable`, not a `Database`, because each is called
 * from **inside** the transaction that causes the event: the notification and the
 * thing it announces commit together or not at all. A Member is never told their work
 * was accepted by a transaction that then rolled back, and no acceptance goes
 * unannounced because a second write failed afterwards.
 *
 * The wording lives here rather than in the UI so the same sentence reaches a bell on
 * the web, a bell in the app, and (later) a push notification.
 */

export type EmitInput = {
  type:
    | "submission_accepted"
    | "submission_returned"
    | "submission_rejected"
    | "points_awarded"
    | "tier_unlocked"
    | "track_update";
  userId: string;
  title: string;
  body: string;
  trackId?: string | null;
  taskId?: string | null;
};

/**
 * Write one notification, already published — an event has happened, so there is
 * nothing to draft. `createdBy` stays null: no person authored "your work was
 * accepted".
 */
export async function emitNotification(tx: Queryable, input: EmitInput, at: Date): Promise<void> {
  await tx.insert(notification).values({
    type: input.type,
    userId: input.userId,
    title: input.title,
    body: input.body,
    trackId: input.trackId ?? null,
    taskId: input.taskId ?? null,
    state: "published",
    publishedAt: at,
    createdAt: at,
    updatedAt: at,
  });
}

/** Arabic-Indic digits, so a number reads as part of the sentence around it. */
const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Announce credited Points, and — if they carried the Member over a threshold — the
 * capability that just opened (§38's «فتح صلاحية جديدة»).
 *
 * The tier is *derived*, never stored (ADR 0024), so "did they just level up" is
 * answered by asking what their total was before this award and what it is now. Both
 * reads happen inside the caller's transaction, against the ledger the award was just
 * written to.
 */
export async function emitPointsAwarded(
  tx: Queryable,
  args: { userId: string; points: number; taskId?: string | null; trackId?: string | null },
  at: Date,
): Promise<void> {
  await emitNotification(
    tx,
    {
      type: "points_awarded",
      userId: args.userId,
      title: "احتُسبت نقاطك",
      body: `أُضيفت ${ar(args.points)} نقطة إلى رصيدك.`,
      taskId: args.taskId,
      trackId: args.trackId,
    },
    at,
  );

  const [total] = await tx
    .select({ sum: sql<number>`coalesce(sum(${pointAward.points}), 0)::int` })
    .from(pointAward)
    .where(eq(pointAward.userId, args.userId));

  const after = Number(total?.sum ?? 0);
  const before = after - args.points;
  if (before < 0) return;

  const ladder = (await tx
    .select({
      key: memberTier.key,
      name: memberTier.name,
      minPoints: memberTier.minPoints,
      position: memberTier.position,
    })
    .from(memberTier)) as Tier[];

  const wasTier = tierForPoints(before, ladder);
  const nowTier = tierForPoints(after, ladder);
  if (!nowTier || wasTier?.key === nowTier.key) return;

  await emitNotification(
    tx,
    {
      type: "tier_unlocked",
      userId: args.userId,
      title: "رتبة جديدة",
      body: `بلغت رتبة «${nowTier.name}»، وفُتحت لك صلاحيات جديدة.`,
    },
    at,
  );
}

/**
 * Tell the people following a Track that something was published on it — §38's first
 * trigger, «تحديث مهم لمسار يتابعه المستخدم».
 *
 * **Following is explicit now** (§10, R3): the audience is the `track_follow` rows —
 * the follow button, the auto-follow on first work, and the launch backfill together
 * replaced the implicit worked-in-it predicate this function carried until Slice 12.
 *
 * That the audience is *narrow* is still the point, not an optimisation. Sending every
 * Track's news to every Member is exactly the flood «لا يجب تحويل كل تحديث صغير إلى
 * إشعار» warns against; a notice that reaches only people who follow the Track is one
 * they asked for — by the button, or by their own first work — and an unfollow is
 * honoured absolutely.
 */
export async function emitTrackUpdate(
  tx: Queryable,
  args: { trackId: string; title: string; body: string; taskId?: string | null },
  at: Date,
): Promise<void> {
  const [trackRow] = await tx
    .select({ title: track.title })
    .from(track)
    .where(eq(track.id, args.trackId))
    .limit(1);
  if (!trackRow) return;

  /** The Track's followers — unique by construction (`track_follow_unique`). */
  const followers = await tx
    .select({ userId: trackFollow.userId })
    .from(trackFollow)
    .where(eq(trackFollow.trackId, args.trackId));
  if (followers.length === 0) return;

  for (const follower of followers) {
    await emitNotification(
      tx,
      {
        type: "track_update",
        userId: follower.userId,
        title: args.title,
        body: `«${trackRow.title}»: ${args.body}`,
        trackId: args.trackId,
        taskId: args.taskId,
      },
      at,
    );
  }
}
