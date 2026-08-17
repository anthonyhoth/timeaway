import type { ISODate } from "@timeaway/shared";

/**
 * The window a trip is actually being planned across, when nobody has set one.
 *
 * A new trip has no horizon. Inventing one — "the next 3 months" — looked
 * harmless and was not: a group planning for December 2027 had every answer
 * land outside a window they never chose, and were told no dates worked. The
 * assumption was invisible, so the failure looked like the engine's.
 *
 * With no horizon stated, the group's own answers define it. That is strictly
 * better information than any default: it cannot exclude what someone said,
 * because it is made of what they said.
 */
export function deriveHorizon(
  participants: readonly {
    optedOut?: boolean;
    declarations: readonly { start: string; end: string }[];
  }[],
  today: ISODate,
): { start: ISODate; end: ISODate } | null {
  const ranges = participants
    .filter((p) => !p.optedOut)
    .flatMap((p) => p.declarations);
  if (ranges.length === 0) return null;

  let start = ranges[0]!.start;
  let end = ranges[0]!.end;
  for (const range of ranges) {
    if (range.start < start) start = range.start;
    if (range.end > end) end = range.end;
  }

  // Dates already past cannot host a trip, and someone's historical statement
  // should not drag the window backwards.
  const from = start < today ? today : start;
  if (end < from) return null;
  return { start: from as ISODate, end: end as ISODate };
}
