import { describe, expect, it } from "vitest";
import { suggestDestinations } from "./suggest.js";
import type { Destination, MonthClimate } from "./types.js";

const destinations: Destination[] = [
  {
    id: "tropical",
    name: "Tropical",
    country: "T",
    latitude: 0,
    longitude: 0,
    flightHoursFromSin: 2,
    visaFreeSg: true,
  },
  {
    id: "snowy",
    name: "Snowy",
    country: "S",
    latitude: 43,
    longitude: 141,
    flightHoursFromSin: 8,
    visaFreeSg: true,
  },
];

/** Every month identical, so tests exercise scoring rather than seasonality. */
const flat = (c: Omit<MonthClimate, "month">): MonthClimate[] =>
  Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...c }));

const climate = {
  tropical: flat({ avgHighC: 31, avgLowC: 25, rainfallMm: 150, rainDays: 14 }),
  snowy: flat({ avgHighC: -1, avgLowC: -8, rainfallMm: 90, rainDays: 16 }),
};

const base = { destinations, climate, start: "2026-10-12", end: "2026-10-16" };

describe("suggestDestinations", () => {
  it("prefers the comfortable destination for a general trip", () => {
    const results = suggestDestinations(base);
    expect(results[0]!.destination.id).toBe("tropical");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("flips the ranking when the group wants snow", () => {
    const results = suggestDestinations({ ...base, looking: "snow" });
    expect(results[0]!.destination.id).toBe("snowy");
    expect(results[0]!.reasons).toContain("snow likely");
  });

  it("keeps warm destinations out of the top when snow is wanted", () => {
    const results = suggestDestinations({ ...base, looking: "snow" });
    const tropical = results.find((r) => r.destination.id === "tropical")!;
    expect(tropical.reasons).toContain("no snow");
    expect(tropical.score).toBeLessThanOrEqual(0.2);
  });

  it("respects a flight-time cap", () => {
    const results = suggestDestinations({ ...base, maxFlightHours: 5 });
    expect(results.map((r) => r.destination.id)).toEqual(["tropical"]);
  });

  it("carries the demand tier and its reason into every suggestion", () => {
    const peak = suggestDestinations({
      ...base,
      start: "2026-06-10",
      end: "2026-06-15",
    });
    expect(peak[0]!.priceTier).toBe("PEAK");
    expect(peak[0]!.reasons).toContain("June school holidays");

    const low = suggestDestinations(base);
    expect(low[0]!.priceTier).toBe("LOW");
  });

  it("scores a low-season window above the same trip in peak season", () => {
    const low = suggestDestinations(base)[0]!;
    const peak = suggestDestinations({
      ...base,
      start: "2026-06-10",
      end: "2026-06-15",
    })[0]!;
    expect(low.score).toBeGreaterThan(peak.score);
  });

  it("is deterministic — same input, same order", () => {
    expect(suggestDestinations(base)).toEqual(suggestDestinations(base));
  });
});

describe("destination events", () => {
  const events = [
    {
      destinationId: "tropical",
      label: "Songkran",
      start: "2026-04-13",
      end: "2026-04-15",
      raisesPrices: true,
    },
    {
      destinationId: "snowy",
      label: "ski season",
      start: "2026-12-10",
      end: "2027-03-31",
      raisesPrices: false,
      approximate: true,
      activities: ["snow" as const],
    },
  ];

  it("raises only the affected destination's price tier", () => {
    const during = suggestDestinations({
      ...base,
      start: "2026-04-13",
      end: "2026-04-16",
      events,
    });
    const tropical = during.find((r) => r.destination.id === "tropical")!;
    const snowy = during.find((r) => r.destination.id === "snowy")!;
    expect(tropical.priceTier).toBe("SHOULDER");
    expect(tropical.reasons).toContain("Songkran");
    // Same dates, no event there — stays at the origin-side tier.
    expect(snowy.priceTier).toBe("LOW");
  });

  it("ranks a destination lower during its own peak than just after", () => {
    const during = suggestDestinations({
      ...base,
      start: "2026-04-13",
      end: "2026-04-16",
      events,
    }).find((r) => r.destination.id === "tropical")!;
    const after = suggestDestinations({
      ...base,
      start: "2026-04-20",
      end: "2026-04-23",
      events,
    }).find((r) => r.destination.id === "tropical")!;
    expect(after.score).toBeGreaterThan(during.score);
  });

  it("hedges approximate events in the reason text", () => {
    const results = suggestDestinations({
      ...base,
      start: "2027-01-10",
      end: "2027-01-15",
      events,
      looking: "snow",
    });
    expect(results[0]!.destination.id).toBe("snowy");
    expect(results[0]!.reasons).toContain("ski season (usually)");
  });
});
