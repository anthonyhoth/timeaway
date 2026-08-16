import { describe, expect, it } from "vitest";
import { monthWeights, weightedClimate } from "./climate.js";
import type { MonthClimate } from "./types.js";

const months: MonthClimate[] = [
  { month: 6, avgHighC: 30, avgLowC: 24, rainfallMm: 200, rainDays: 20 },
  { month: 7, avgHighC: 20, avgLowC: 10, rainfallMm: 100, rainDays: 10 },
];

describe("monthWeights", () => {
  it("gives a single month full weight", () => {
    const weights = monthWeights("2026-06-10", "2026-06-15");
    expect(weights.get(6)).toBe(1);
    expect(weights.size).toBe(1);
  });

  it("splits a window straddling two months by day count", () => {
    // 28, 29, 30 Jun + 1, 2, 3 Jul = 3/6 each.
    const weights = monthWeights("2026-06-28", "2026-07-03");
    expect(weights.get(6)).toBeCloseTo(0.5, 5);
    expect(weights.get(7)).toBeCloseTo(0.5, 5);
  });

  it("weights unevenly when the split is uneven", () => {
    // 30 Jun + 1–4 Jul = 1/5 June, 4/5 July.
    const weights = monthWeights("2026-06-30", "2026-07-04");
    expect(weights.get(6)).toBeCloseTo(0.2, 5);
    expect(weights.get(7)).toBeCloseTo(0.8, 5);
  });
});

describe("weightedClimate", () => {
  it("blends the months a window spans", () => {
    const blended = weightedClimate(months, monthWeights("2026-06-28", "2026-07-03"));
    expect(blended).toEqual({
      avgHighC: 25,
      avgLowC: 17,
      rainfallMm: 150,
      rainDays: 15,
    });
  });

  it("returns the month itself when the window sits inside one", () => {
    const blended = weightedClimate(months, monthWeights("2026-07-05", "2026-07-09"));
    expect(blended).toEqual({
      avgHighC: 20,
      avgLowC: 10,
      rainfallMm: 100,
      rainDays: 10,
    });
  });

  it("returns null when no month data covers the window", () => {
    expect(weightedClimate(months, monthWeights("2026-01-05", "2026-01-09"))).toBeNull();
  });
});
