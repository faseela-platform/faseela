import { describe, expect, it } from "vitest";

import {
  toApiContentItem,
  toApiLeaderboardRow,
  toApiMemberProfile,
  toApiNotification,
  toApiProgress,
  toApiSeason,
  toApiTrackDetail,
  toApiTrackSummary,
} from "../index.js";

/**
 * The serializers exist for one reason: the wire cannot carry a `Date`. Every
 * test here asserts against a hand-written literal — the ISO string is written
 * out, not recomputed via `toISOString()` — so a serializer that mangled a
 * timestamp could not agree with its own test.
 *
 * Null-season handling is deliberately absent: serializers take non-null input,
 * and deciding what an absent Season means belongs to the route that knows.
 */

describe("toApiLeaderboardRow", () => {
  it("converts lastAwardedAt to an ISO string and passes scalar fields through", () => {
    const row = toApiLeaderboardRow({
      rank: 1,
      userId: "user-1",
      name: "سارة",
      image: "https://example.com/a.png",
      points: 120,
      lastAwardedAt: new Date(Date.UTC(2026, 0, 15, 9, 30, 0)),
    });

    expect(row).toEqual({
      rank: 1,
      userId: "user-1",
      name: "سارة",
      image: "https://example.com/a.png",
      points: 120,
      lastAwardedAt: "2026-01-15T09:30:00.000Z",
    });
  });

  it("passes a null image through as null, not a string", () => {
    const row = toApiLeaderboardRow({
      rank: 2,
      userId: "user-2",
      name: "عمر",
      image: null,
      points: 80,
      lastAwardedAt: new Date(Date.UTC(2026, 1, 1)),
    });

    expect(row.image).toBeNull();
  });
});

describe("toApiSeason", () => {
  it("converts startsAt and endsAt to ISO strings and drops the row's createdAt", () => {
    /**
     * A const, not an inline literal, deliberately: the real DB row carries
     * `createdAt`, which the serializer accepts structurally (a variable, like
     * the route's) and must not forward to the wire.
     */
    const dbRow = {
      id: "season-1",
      slug: "mawsim-1",
      title: "الموسم الأول",
      startsAt: new Date(Date.UTC(2026, 5, 1)),
      endsAt: new Date(Date.UTC(2026, 8, 1)),
      createdAt: new Date(Date.UTC(2026, 4, 20, 12, 0, 0)),
    };
    const season = toApiSeason(dbRow);

    expect(season).toEqual({
      id: "season-1",
      slug: "mawsim-1",
      title: "الموسم الأول",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-09-01T00:00:00.000Z",
    });
  });
});

describe("toApiTrackSummary", () => {
  it("passes every summary field through unchanged", () => {
    const summary = toApiTrackSummary({
      slug: "reading-groups",
      title: "حلقات القراءة",
      summary: "مسار القراءة الجماعية",
      position: 1,
      taskCount: 4,
      totalPoints: 40,
    });

    expect(summary).toEqual({
      slug: "reading-groups",
      title: "حلقات القراءة",
      summary: "مسار القراءة الجماعية",
      position: 1,
      taskCount: 4,
      totalPoints: 40,
    });
  });
});

describe("toApiTrackDetail", () => {
  it("maps the task array preserving order and every field", () => {
    const detail = toApiTrackDetail({
      slug: "reading-groups",
      title: "حلقات القراءة",
      summary: "مسار القراءة الجماعية",
      totalPoints: 25,
      tasks: [
        {
          id: "task-b",
          title: "اقرأ الفصل الأول",
          instructions: "اقرأ ثم لخّص",
          mode: "review" as const,
          points: 15,
          position: 1,
        },
        {
          id: "task-a",
          title: "شارك اقتباساً",
          instructions: "اختر اقتباساً وشاركه",
          mode: "attest" as const,
          points: 10,
          position: 2,
        },
      ],
    });

    expect(detail).toEqual({
      slug: "reading-groups",
      title: "حلقات القراءة",
      summary: "مسار القراءة الجماعية",
      totalPoints: 25,
      tasks: [
        {
          id: "task-b",
          title: "اقرأ الفصل الأول",
          instructions: "اقرأ ثم لخّص",
          mode: "review",
          points: 15,
          position: 1,
        },
        {
          id: "task-a",
          title: "شارك اقتباساً",
          instructions: "اختر اقتباساً وشاركه",
          mode: "attest",
          points: 10,
          position: 2,
        },
      ],
    });
  });
});

describe("toApiProgress", () => {
  it("flattens the tier to its name and passes the next-tier gap through", () => {
    expect(
      toApiProgress({
        tier: { name: "عام" },
        points: 120,
        nextTier: { name: "خاص" },
        pointsToNext: 80,
      }),
    ).toEqual({ tier: "عام", points: 120, nextTier: "خاص", pointsToNext: 80 });
  });

  it("carries a null next tier (top of the ladder) through as null", () => {
    const p = toApiProgress({
      tier: { name: "فسيلي" },
      points: 1000,
      nextTier: null,
      pointsToNext: null,
    });
    expect(p.nextTier).toBeNull();
    expect(p.pointsToNext).toBeNull();
  });
});

describe("toApiMemberProfile", () => {
  it("passes name/phone through and carries the completeness flag the caller decided", () => {
    expect(toApiMemberProfile({ name: "سارة", phoneNumber: "70123456" }, true)).toEqual({
      name: "سارة",
      phoneNumber: "70123456",
      complete: true,
    });
    expect(toApiMemberProfile({ name: "", phoneNumber: null }, false).complete).toBe(false);
  });
});

describe("toApiContentItem", () => {
  it("converts the dates to ISO, takes the image URL as a param, and drops the mediaKey", () => {
    const dbRow = {
      id: "c-1",
      type: "event",
      title: "لقاء القراءة",
      body: "نصّ",
      classification: "أدب",
      mediaKey: "content/c-1/x.png",
      taskId: null,
      trackId: "t-1",
      linkUrl: null,
      eventAt: new Date(Date.UTC(2026, 2, 10, 17, 0, 0)),
      eventPlace: "بيروت",
      publishedAt: new Date(Date.UTC(2026, 2, 1, 8, 0, 0)),
      trackSlug: "reading-groups",
      trackTitle: "حلقات القراءة",
    };
    expect(toApiContentItem(dbRow, "https://signed.example/x.png")).toEqual({
      id: "c-1",
      type: "event",
      title: "لقاء القراءة",
      body: "نصّ",
      classification: "أدب",
      imageUrl: "https://signed.example/x.png",
      linkUrl: null,
      eventAt: "2026-03-10T17:00:00.000Z",
      eventPlace: "بيروت",
      publishedAt: "2026-03-01T08:00:00.000Z",
      trackSlug: "reading-groups",
      trackTitle: "حلقات القراءة",
    });
  });

  it("carries a null image through as null", () => {
    expect(
      toApiContentItem(
        {
          id: "c-2",
          type: "news",
          title: "خبر",
          body: "ن",
          classification: null,
          linkUrl: "https://faseela.example",
          eventAt: null,
          eventPlace: null,
          publishedAt: new Date(Date.UTC(2026, 0, 1)),
          trackSlug: null,
          trackTitle: null,
        },
        null,
      ).imageUrl,
    ).toBeNull();
  });
});

describe("toApiNotification", () => {
  it("converts the publish date to an ISO string and carries the reader's seen flag", () => {
    expect(
      toApiNotification({
        id: "n-1",
        type: "submission_accepted",
        title: "قُبل عملك",
        body: "قُبل عملك في «تلخيص الفصل»، واحتُسبت ٢٠ نقطة.",
        linkUrl: null,
        trackSlug: "reading-groups",
        trackTitle: "حلقات القراءة",
        publishedAt: new Date(Date.UTC(2026, 2, 15, 12, 0, 0)),
        seen: false,
      }),
    ).toEqual({
      id: "n-1",
      type: "submission_accepted",
      title: "قُبل عملك",
      body: "قُبل عملك في «تلخيص الفصل»، واحتُسبت ٢٠ نقطة.",
      linkUrl: null,
      trackSlug: "reading-groups",
      trackTitle: "حلقات القراءة",
      publishedAt: "2026-03-15T12:00:00.000Z",
      seen: false,
    });
  });
});
