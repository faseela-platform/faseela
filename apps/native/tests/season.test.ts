import { describe, expect, it } from "vitest";

import { seasonCountdownLabel, seasonDaysLeft } from "../lib/season";

describe("seasonDaysLeft", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("counts by ceiling — a Season ending tomorrow morning still has a day in it", () => {
    expect(seasonDaysLeft("2026-09-02T06:00:00Z", now)).toBe(1);
  });

  it("counts whole days ahead", () => {
    expect(seasonDaysLeft("2026-09-13T12:00:00Z", now)).toBe(12);
  });

  it("is zero once the Season has ended", () => {
    expect(seasonDaysLeft("2026-09-01T11:00:00Z", now)).toBe(0);
  });

  it("is zero for an unparseable date rather than NaN", () => {
    expect(seasonDaysLeft("not-a-date", now)).toBe(0);
  });
});

describe("seasonCountdownLabel", () => {
  it("hides the clock when the Season has ended", () => {
    expect(seasonCountdownLabel(0)).toBeNull();
  });

  it("uses the singular for one day", () => {
    expect(seasonCountdownLabel(1)).toBe("بقي يوم واحد في الموسم");
  });

  it("uses the dual for two days", () => {
    expect(seasonCountdownLabel(2)).toBe("بقي يومان في الموسم");
  });

  it("uses the 3–10 plural with Eastern digits", () => {
    expect(seasonCountdownLabel(5)).toBe("بقيت ٥ أيام في الموسم");
  });

  it("uses the 11+ singular accusative with Eastern digits", () => {
    expect(seasonCountdownLabel(12)).toBe("بقي ١٢ يوماً في الموسم");
  });
});
