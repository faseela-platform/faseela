/**
 * طريق الفسائل — pure state mapping for the Track page's road (owner decision,
 * 2026-09-01): each Task is a planting spot on a winding path, and its sprout
 * grows through the submission lifecycle. Pure and node-safe so the stages are
 * testable without rendering SVG.
 *
 * No stage means "locked": every spot is walkable (task gating is not in the
 * spec), so untouched Tasks render as tilled soil at full strength, never dimmed.
 */

export type RoadStage =
  /** Untouched — a tilled ring waiting for a seed. */
  | "soil"
  /** A draft (or a cancelled draft, which resumes as one): planted, not sprouted. */
  | "seed"
  /** Under review: a closed bud — alive, waiting on the Editor. */
  | "bud"
  /** Returned for revision: the sprout droops until the Member waters it again. */
  | "returned"
  /** Accepted, or an attested Task: the full seedling stands. */
  | "grown"
  /** Finally rejected: a stone marks the spot; the road walks on. */
  | "stone";

export function taskStage(
  mode: "attest" | "review",
  isDone: boolean,
  submissionState: string | null,
): RoadStage {
  if (mode === "attest") return isDone ? "grown" : "soil";
  switch (submissionState) {
    case "accepted":
      return "grown";
    case "pending":
      return "bud";
    case "returned":
      return "returned";
    case "rejected":
      return "stone";
    case "draft":
    case "cancelled":
      return "seed";
    default:
      return "soil";
  }
}

/**
 * How many road segments read as walked earth: everything up to and including the
 * furthest grown spot. Walking is measured by where the Member has *arrived*, not
 * by contiguity — a Member who did Task 3 first has walked past 1 and 2, which is
 * the truth of a road with no gates.
 */
export function walkedSegments(stages: readonly RoadStage[]): number {
  let furthest = 0;
  stages.forEach((stage, i) => {
    if (stage === "grown") furthest = i + 1;
  });
  return furthest;
}
