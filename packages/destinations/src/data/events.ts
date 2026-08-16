import type { DestinationEvent } from "../types.js";

/**
 * Hand-curated destination-side seasonal windows — the sharp events that
 * monthly climate buckets cannot express, and the only thing that makes price
 * pressure differ *between* destinations for the same window (Singapore-side
 * demand is identical for all of them).
 *
 * Lunar-calendar dates move every year and are listed explicitly per year
 * rather than computed: Lunar New Year is 17 Feb 2026 and 6 Feb 2027, shared
 * by Chinese New Year, Korean Seollal, and Vietnamese Tết. Coverage currently
 * runs to the end of 2027 — see EVENT_COVERAGE_END.
 *
 * `approximate: true` marks windows that shift by a week or so year to year
 * (blossom, foliage, ski conditions). Bot copy should hedge accordingly.
 */
export const EVENT_COVERAGE_END = "2027-12-31";

const JAPAN_CITIES = ["tokyo", "osaka", "sapporo"] as const;
const KOREA_CITIES = ["seoul", "busan"] as const;

function forEach(
  ids: readonly string[],
  event: Omit<DestinationEvent, "destinationId">,
): DestinationEvent[] {
  return ids.map((destinationId) => ({ destinationId, ...event }));
}

export const DESTINATION_EVENTS: DestinationEvent[] = [
  // ---- Japan -------------------------------------------------------------
  ...forEach(JAPAN_CITIES, {
    label: "Golden Week",
    start: "2026-04-29",
    end: "2026-05-05",
    raisesPrices: true,
  }),
  ...forEach(JAPAN_CITIES, {
    label: "Golden Week",
    start: "2027-04-29",
    end: "2027-05-05",
    raisesPrices: true,
  }),
  ...forEach(JAPAN_CITIES, {
    label: "Obon",
    start: "2026-08-11",
    end: "2026-08-16",
    raisesPrices: true,
  }),
  ...forEach(JAPAN_CITIES, {
    label: "Obon",
    start: "2027-08-11",
    end: "2027-08-16",
    raisesPrices: true,
  }),
  ...forEach(JAPAN_CITIES, {
    label: "New Year in Japan",
    start: "2026-12-29",
    end: "2027-01-03",
    raisesPrices: true,
  }),
  {
    destinationId: "tokyo",
    label: "cherry blossom",
    start: "2026-03-25",
    end: "2026-04-07",
    raisesPrices: true,
    approximate: true,
    activities: ["nature"],
  },
  {
    destinationId: "tokyo",
    label: "cherry blossom",
    start: "2027-03-25",
    end: "2027-04-07",
    raisesPrices: true,
    approximate: true,
    activities: ["nature"],
  },
  {
    destinationId: "osaka",
    label: "cherry blossom",
    start: "2026-03-27",
    end: "2026-04-09",
    raisesPrices: true,
    approximate: true,
    activities: ["nature"],
  },
  {
    destinationId: "osaka",
    label: "cherry blossom",
    start: "2027-03-27",
    end: "2027-04-09",
    raisesPrices: true,
    approximate: true,
    activities: ["nature"],
  },
  {
    destinationId: "sapporo",
    label: "cherry blossom",
    start: "2026-04-28",
    end: "2026-05-08",
    raisesPrices: true,
    approximate: true,
    activities: ["nature"],
  },
  {
    destinationId: "sapporo",
    label: "Snow Festival",
    start: "2026-02-04",
    end: "2026-02-11",
    raisesPrices: true,
    approximate: true,
    activities: ["snow", "culture"],
  },
  {
    destinationId: "sapporo",
    label: "Snow Festival",
    start: "2027-02-04",
    end: "2027-02-11",
    raisesPrices: true,
    approximate: true,
    activities: ["snow", "culture"],
  },
  {
    destinationId: "sapporo",
    label: "ski season",
    start: "2026-12-10",
    end: "2027-03-31",
    raisesPrices: false,
    approximate: true,
    activities: ["snow"],
  },
  {
    destinationId: "sapporo",
    label: "ski season",
    start: "2026-01-01",
    end: "2026-03-31",
    raisesPrices: false,
    approximate: true,
    activities: ["snow"],
  },
  {
    destinationId: "tokyo",
    label: "autumn leaves",
    start: "2026-11-15",
    end: "2026-12-05",
    raisesPrices: false,
    approximate: true,
    activities: ["nature"],
  },

  // ---- Korea -------------------------------------------------------------
  ...forEach(KOREA_CITIES, {
    label: "Seollal",
    start: "2026-02-16",
    end: "2026-02-19",
    raisesPrices: true,
  }),
  ...forEach(KOREA_CITIES, {
    label: "Seollal",
    start: "2027-02-05",
    end: "2027-02-08",
    raisesPrices: true,
  }),
  ...forEach(KOREA_CITIES, {
    label: "autumn foliage",
    start: "2026-10-20",
    end: "2026-11-10",
    raisesPrices: false,
    approximate: true,
    activities: ["nature"],
  }),
  {
    destinationId: "seoul",
    label: "ski season",
    start: "2026-12-10",
    end: "2027-02-28",
    raisesPrices: false,
    approximate: true,
    activities: ["snow"],
  },

  // ---- Greater China -----------------------------------------------------
  ...forEach(["taipei", "hong-kong"], {
    label: "Chinese New Year",
    start: "2026-02-14",
    end: "2026-02-22",
    raisesPrices: true,
  }),
  ...forEach(["taipei", "hong-kong"], {
    label: "Chinese New Year",
    start: "2027-02-03",
    end: "2027-02-11",
    raisesPrices: true,
  }),

  // ---- Vietnam -----------------------------------------------------------
  // Tết effectively shuts much of the country for a week.
  ...forEach(["hanoi", "ho-chi-minh-city", "da-nang"], {
    label: "Tết",
    start: "2026-02-14",
    end: "2026-02-22",
    raisesPrices: true,
  }),
  ...forEach(["hanoi", "ho-chi-minh-city", "da-nang"], {
    label: "Tết",
    start: "2027-02-03",
    end: "2027-02-11",
    raisesPrices: true,
  }),

  // ---- Thailand ----------------------------------------------------------
  ...forEach(["bangkok", "chiang-mai", "phuket"], {
    label: "Songkran",
    start: "2026-04-13",
    end: "2026-04-15",
    raisesPrices: true,
    activities: ["culture"],
  }),
  ...forEach(["bangkok", "chiang-mai", "phuket"], {
    label: "Songkran",
    start: "2027-04-13",
    end: "2027-04-15",
    raisesPrices: true,
    activities: ["culture"],
  }),
  {
    destinationId: "chiang-mai",
    label: "burning season haze",
    start: "2026-02-15",
    end: "2026-04-15",
    raisesPrices: false,
    approximate: true,
  },
  {
    destinationId: "chiang-mai",
    label: "burning season haze",
    start: "2027-02-15",
    end: "2027-04-15",
    raisesPrices: false,
    approximate: true,
  },

  // ---- Indonesia ---------------------------------------------------------
  {
    destinationId: "bali",
    label: "peak season",
    start: "2026-07-01",
    end: "2026-08-31",
    raisesPrices: true,
  },
  {
    destinationId: "bali",
    label: "peak season",
    start: "2027-07-01",
    end: "2027-08-31",
    raisesPrices: true,
  },
];
