import { describe, expect, it } from "vitest";

import { toApiLeaderboardRow, toApiSeason, toApiTrackDetail, toApiTrackSummary } from "../index.js";

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
