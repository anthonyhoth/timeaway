import type { ISODate } from "@timeaway/shared";
import { eachDay, SG_PUBLIC_HOLIDAYS_2026 } from "@timeaway/trip-engine";
import type { PriceTier } from "./types.js";

/**
 * Travel demand out of Singapore, computed from calendars rather than fares.
 *
 * Published seasonality advice is US/Europe-centric and wrong for this
 * beachhead: from SIN the expensive periods are the MOE school holidays,
 * Chinese New Year, and long weekends — not "northern summer" (founder-decided,
 * docs/DECISIONS.md). Everything here is explainable back to a date, so bot
 * copy can say *why* a window is pricey without ever claiming to know a fare.
 */

/** Recurring MOE school-holiday blocks, as month/day ranges. Approximate:
 *  exact term dates shift a few days each year and are published annually. */
const SCHOOL_HOLIDAYS: {
  label: string;
  from: [number, number];
  to: [number, number];
}[] = [
  { label: "March school holidays", from: [3, 14], to: [3, 22] },
  { label: "June school holidays", from: [5, 30], to: [6, 30] },
  { label: "September school holidays", from: [9, 5], to: [9, 13] },
  { label: "year-end school holidays", from: [11, 16], to: [12, 31] },
];

function isWithin(
  date: ISODate,
  from: [number, number],
  to: [number, number],
): boolean {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const value = month * 100 + day;
  return value >= from[0]! * 100 + from[1]! && value <= to[0]! * 100 + to[1]!;
}

export interface DemandAssessment {
  tier: PriceTier;
  /** Fraction of the window falling inside a high-demand period, 0–1. */
  pressure: number;
  /** Human phrases for the bot, e.g. "June school holidays". */
  reasons: string[];
}

/**
 * Assess demand pressure across an inclusive window. A window mostly inside
 * school holidays reads PEAK; one clear of them reads LOW.
 */
export function assessDemand(
  start: ISODate,
  end: ISODate,
  publicHolidays: ReadonlySet<ISODate> = SG_PUBLIC_HOLIDAYS_2026,
): DemandAssessment {
  const days = eachDay(start, end);
  if (days.length === 0) return { tier: "LOW", pressure: 0, reasons: [] };

  const reasons = new Set<string>();
  let loadedDays = 0;

  for (const day of days) {
    let loaded = false;
    for (const block of SCHOOL_HOLIDAYS) {
      if (isWithin(day, block.from, block.to)) {
        reasons.add(block.label);
        loaded = true;
      }
    }
    if (publicHolidays.has(day)) {
      reasons.add("public holiday weekend");
      loaded = true;
    }
    if (loaded) loadedDays++;
  }

  const pressure = loadedDays / days.length;
  const tier: PriceTier =
    pressure >= 0.75
      ? "PEAK"
      : pressure >= 0.4
        ? "HIGH"
        : pressure > 0
          ? "SHOULDER"
          : "LOW";

  return { tier, pressure, reasons: [...reasons] };
}
