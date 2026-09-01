import { arabicDigits } from "./rtl";

/**
 * The Season countdown for اللوحة — pure, importable under plain node.
 *
 * The Leaderboard is a contest with an end (ADR 0024), but nothing on the screen
 * said so; a visible clock is what makes a Season feel like a Season. Days are
 * counted by ceiling: a Season ending tomorrow morning still has "a day" in it,
 * because telling a Member «بقي ٠» while Points still count would read as closed.
 */
export function seasonDaysLeft(endsAt: string, now: Date): number {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/**
 * The chip's Arabic label, honouring number agreement: يوم واحد، يومان، then
 * ٣–١٠ أيام, then ١١+ يوماً. `null` when the Season has ended — the API still
 * returns it until the ranking closes, and a finished clock is not a countdown.
 */
export function seasonCountdownLabel(daysLeft: number): string | null {
  if (daysLeft <= 0) return null;
  if (daysLeft === 1) return "بقي يوم واحد في الموسم";
  if (daysLeft === 2) return "بقي يومان في الموسم";
  if (daysLeft <= 10) return `بقيت ${arabicDigits(daysLeft)} أيام في الموسم`;
  return `بقي ${arabicDigits(daysLeft)} يوماً في الموسم`;
}
