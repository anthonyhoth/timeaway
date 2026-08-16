import type { ISODate } from "@timeaway/shared";
import { monthWeights, weightedClimate } from "./climate.js";
import { assessDemand } from "./demand.js";
import type { Destination, MonthClimate, PriceTier } from "./types.js";

export interface SuggestionInput {
  destinations: readonly Destination[];
  climate: Readonly<Record<string, MonthClimate[]>>;
  /** Inclusive window the group is considering. */
  start: ISODate;
  end: ISODate;
  /** What the group is after; "any" ranks for general comfort. */
  looking?: "any" | "warm" | "snow";
  /** Cap block time from Singapore — 4–6 day trips rarely justify long-haul. */
  maxFlightHours?: number;
}

export interface DestinationSuggestion {
  destination: Destination;
  score: number;
  climate: Omit<MonthClimate, "month">;
  priceTier: PriceTier;
  /** Short phrases for bot copy, e.g. ["dry", "mild", "low season"]. */
  reasons: string[];
}

/** Comfort curve: full marks for a 22–30°C high, tapering away either side. */
function comfortScore(avgHighC: number): number {
  if (avgHighC >= 22 && avgHighC <= 30) return 1;
  const distance = avgHighC < 22 ? 22 - avgHighC : avgHighC - 30;
  return Math.max(0, 1 - distance / 15);
}

function drynessScore(rainDays: number): number {
  return Math.max(0, 1 - rainDays / 25);
}

const PRICE_SCORE: Record<PriceTier, number> = {
  LOW: 1,
  SHOULDER: 0.66,
  HIGH: 0.33,
  PEAK: 0,
};

/**
 * Short-haul advantage. These are 4–6 day trips: an eight-hour flight each way
 * eats most of a long weekend, so proximity is a real quality signal rather
 * than a tiebreak. Without it the scorer recommends Sapporo for a warm July
 * trip purely because 25°C scores well.
 */
function proximityScore(flightHours: number): number {
  return Math.max(0, 1 - flightHours / 10);
}

function climateReasons(
  climate: Omit<MonthClimate, "month">,
  looking: "any" | "warm" | "snow",
): string[] {
  const reasons: string[] = [];
  if (climate.avgLowC <= 0) reasons.push("snow likely");
  else if (climate.avgHighC >= 33) reasons.push("hot");
  else if (climate.avgHighC <= 15) reasons.push("cold");
  else if (climate.avgHighC <= 28 && climate.avgHighC >= 20)
    reasons.push("mild");

  if (climate.rainDays <= 7) reasons.push("dry");
  else if (climate.rainDays >= 18) reasons.push("wet season");

  if (looking === "snow" && climate.avgLowC > 2) reasons.push("no snow");
  return reasons;
}

/**
 * Rank destinations for a window, deterministically. No model involved: the
 * climate figures are baked-in normals and the price tier comes from the
 * Singapore demand calendar, so every suggestion is reproducible and every
 * reason traces back to data (docs/DECISIONS.md).
 */
export function suggestDestinations(
  input: SuggestionInput,
): DestinationSuggestion[] {
  const looking = input.looking ?? "any";
  const weights = monthWeights(input.start, input.end);
  const demand = assessDemand(input.start, input.end);

  const suggestions: DestinationSuggestion[] = [];

  for (const destination of input.destinations) {
    if (
      input.maxFlightHours !== undefined &&
      destination.flightHoursFromSin > input.maxFlightHours
    ) {
      continue;
    }
    const months = input.climate[destination.id];
    if (!months) continue;
    const climate = weightedClimate(months, weights);
    if (!climate) continue;

    let score =
      0.35 * comfortScore(climate.avgHighC) +
      0.25 * drynessScore(climate.rainDays) +
      0.25 * PRICE_SCORE[demand.tier] +
      0.15 * proximityScore(destination.flightHoursFromSin);

    // Preference overrides the general comfort curve: a snow trip *wants* the
    // cold that would otherwise score badly.
    if (looking === "snow") {
      score = climate.avgLowC <= 0 ? 1 : Math.min(score, 0.2);
    } else if (looking === "warm") {
      score = climate.avgHighC >= 25 ? score : Math.min(score, 0.3);
    }

    suggestions.push({
      destination,
      score: Math.round(score * 1000) / 1000,
      climate,
      priceTier: demand.tier,
      reasons: [...climateReasons(climate, looking), ...demand.reasons],
    });
  }

  return suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.destination.flightHoursFromSin - b.destination.flightHoursFromSin ||
      a.destination.name.localeCompare(b.destination.name),
  );
}
