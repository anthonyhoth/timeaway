import type { ISODate } from "@timeaway/shared";

/** What a destination is good for in a given month. */
export const ACTIVITY_TAGS = [
  "beach",
  "city",
  "nature",
  "hiking",
  "diving",
  "snow",
  "food",
  "shopping",
  "culture",
] as const;

export type ActivityTag = (typeof ACTIVITY_TAGS)[number];

/**
 * Coarse price expectation. Deliberately four buckets, not a number: we do not
 * have fare data and must never imply we do (brief §14 — distinguish estimated
 * from live). Demand pressure computed from holiday calendars refines this at
 * query time.
 */
export const PRICE_TIERS = ["LOW", "SHOULDER", "HIGH", "PEAK"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export interface Destination {
  /** Stable slug, used as the join key across data files. */
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Typical non-stop block time from Singapore, hours. */
  flightHoursFromSin: number;
  /** Visa-free (or visa-on-arrival) for a Singapore passport. */
  visaFreeSg: boolean;
}

/** Climate normals derived from Open-Meteo reanalysis (CC BY 4.0). */
export interface MonthClimate {
  month: number;
  avgHighC: number;
  avgLowC: number;
  /** Mean total precipitation for the month, mm. */
  rainfallMm: number;
  /** Mean count of days with ≥1 mm precipitation. */
  rainDays: number;
}

/** Curated, editorial layer — reviewed by hand, unlike the climate figures. */
export interface MonthProfile {
  month: number;
  priceTier: PriceTier;
  activities: ActivityTag[];
  /** Short human phrase used verbatim in bot copy, e.g. "dry season". */
  note?: string;
}

/**
 * Sharp seasonal windows that monthly buckets cannot express — cherry blossom,
 * ski season, Golden Week. Dates are per-year where they move.
 */
export interface DestinationEvent {
  destinationId: string;
  label: string;
  start: ISODate;
  end: ISODate;
  /** Raises price pressure while active (festivals, national holidays). */
  raisesPrices: boolean;
  activities?: ActivityTag[];
}

export interface DestinationDataset {
  destinations: Destination[];
  climate: Record<string, MonthClimate[]>;
  profiles: Record<string, MonthProfile[]>;
  events: DestinationEvent[];
}
