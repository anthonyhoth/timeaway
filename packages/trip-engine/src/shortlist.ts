import { daySpan } from "./dates.js";
import type { EvaluatedWindow } from "./feasibility.js";

/**
 * Turning a ranked list into a genuine shortlist.
 *
 * Ranking alone produces near-duplicates — 4–8 Feb, 5–9 Feb and 6–10 Feb all
 * score the same and are all the same week. Offered as "five options across
 * the year" that is really one option shown three times, and it gives the
 * group nothing to choose between.
 *
 * So candidates are spread out: the selector first tries to keep a month
 * between picks and relaxes only as far as it must to fill the quota. When
 * the group is genuinely only free in one stretch, it will cluster — but
 * never overlap.
 */

/** Days between two windows; negative when they overlap. */
export function separationDays(
  a: { start: string; end: string },
  b: { start: string; end: string },
): number {
  if (a.start <= b.end && b.start <= a.end) return -1;
  return a.end < b.start
    ? daySpan(a.end, b.start) - 2
    : daySpan(b.end, a.start) - 2;
}

/** Separations tried in turn, widest first. */
const GAP_LADDER = [30, 21, 14, 7, 3, 0];

export function selectDiverseWindows(
  ranked: readonly EvaluatedWindow[],
  count: number,
): EvaluatedWindow[] {
  if (count <= 0 || ranked.length === 0) return [];

  let best: EvaluatedWindow[] = [];

  for (const gap of GAP_LADDER) {
    const picked: EvaluatedWindow[] = [];
    for (const candidate of ranked) {
      const farEnough = picked.every(
        (p) => separationDays(p.window, candidate.window) >= gap,
      );
      if (farEnough) picked.push(candidate);
      if (picked.length === count) break;
    }
    if (picked.length > best.length) best = picked;
    if (best.length === count) break;
  }

  return best;
}
