/**
 * Copy-me template for a deep module. See ../README.md.
 *
 * This root file is the package's public surface. It delegates to lib/, which
 * is unreachable from outside — that is what makes the package deep rather than
 * a pass-through.
 */
import { formatPointTotal } from "./lib/format.js";

/** Renders a Point total for display inside Arabic text, bidi-isolated. */
export function pointTotal(points: number): string {
  return formatPointTotal(points);
}
