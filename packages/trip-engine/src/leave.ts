import type { ISODate } from "@timeaway/shared";
import { eachDay, toUtc } from "./dates.js";

/** Saturday/Sunday weekend — the Singapore working-week convention. */
export function isWeekend(date: ISODate): boolean {
  const dow = toUtc(date).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Annual-leave days a window costs: weekdays in [start, end] (inclusive) that
 * are not public holidays. The holiday set is injected data — the engine owns
 * the computation, not the calendar (see holidays-sg.ts for the SG dataset).
 */
export function leaveDaysRequired(
  start: ISODate,
  end: ISODate,
  publicHolidays: ReadonlySet<ISODate>,
): number {
  let days = 0;
  for (const day of eachDay(start, end)) {
    if (!isWeekend(day) && !publicHolidays.has(day)) days++;
  }
  return days;
}
