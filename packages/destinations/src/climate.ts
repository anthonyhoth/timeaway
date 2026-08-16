import type { ISODate } from "@timeaway/shared";
import { eachDay } from "@timeaway/trip-engine";
import type { MonthClimate } from "./types.js";

/**
 * How much of a window falls in each calendar month, as fractions summing to 1.
 * A 28 Jun – 3 Jul window is roughly 45% June, 55% July — so its climate is a
 * blend, not whichever month happens to hold the first day.
 */
export function monthWeights(
  start: ISODate,
  end: ISODate,
): Map<number, number> {
  const days = eachDay(start, end);
  const counts = new Map<number, number>();
  for (const day of days) {
    const month = Number(day.slice(5, 7));
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const weights = new Map<number, number>();
  for (const [month, count] of counts) {
    weights.set(month, count / days.length);
  }
  return weights;
}

/** Blend monthly normals across the months a window spans. */
export function weightedClimate(
  months: readonly MonthClimate[],
  weights: ReadonlyMap<number, number>,
): Omit<MonthClimate, "month"> | null {
  let avgHighC = 0;
  let avgLowC = 0;
  let rainfallMm = 0;
  let rainDays = 0;
  let total = 0;

  for (const [month, weight] of weights) {
    const record = months.find((m) => m.month === month);
    if (!record) continue;
    avgHighC += record.avgHighC * weight;
    avgLowC += record.avgLowC * weight;
    rainfallMm += record.rainfallMm * weight;
    rainDays += record.rainDays * weight;
    total += weight;
  }
  if (total === 0) return null;

  const round1 = (v: number) => Math.round((v / total) * 10) / 10;
  return {
    avgHighC: round1(avgHighC),
    avgLowC: round1(avgLowC),
    rainfallMm: Math.round(rainfallMm / total),
    rainDays: Math.round(rainDays / total),
  };
}
