import { describe, expect, it } from "vitest";
import { findChronoPeriod } from "./chrono.js";
import { parseAvailabilityMessage } from "./availability.js";

const today = "2026-08-17" as const;

describe("findChronoPeriod", () => {
  it("reads Singaporean day-first dates", () => {
    // The whole reason for en.GB: en.US would call this 11 March.
    expect(findChronoPeriod("cmi 3/11", today)?.range).toEqual({
      start: "2026-11-03",
      end: "2026-11-03",
    });
  });

  it("spans a year boundary", () => {
    expect(findChronoPeriod("away dec 20th till jan 2nd", today)?.range).toEqual({
      start: "2026-12-20",
      end: "2027-01-02",
    });
  });

  it("refuses a bare month rather than collapsing it to one day", () => {
    // Chrono answers 1 November here; the SG grammar owns whole months.
    expect(findChronoPeriod("november", today)).toBeNull();
  });

  it("rejects the year it invents from a day list", () => {
    // Chrono reads the "22" in "nov 20, 22 and 25" as the year 2022.
    expect(findChronoPeriod("nov 20, 22 and 25", today)).toBeNull();
  });

  it("rejects dates already past", () => {
    expect(findChronoPeriod("3 jan 2020", today)).toBeNull();
  });
});

describe("chrono sits below the Singapore layers", () => {
  const ctx = {
    today,
    horizonStart: "2026-11-01" as const,
    horizonEnd: "2027-03-31" as const,
    destination: null,
  };

  it("never overrides a local reading", () => {
    // Chrono cannot parse either of these; the SG grammar must still win.
    expect(
      parseAvailabilityMessage("first 3 wks of jan i got mob mannin", ctx)
        ?.declarations,
    ).toEqual([
      { state: "UNAVAILABLE", start: "2027-01-01", end: "2027-01-21" },
    ]);
    expect(
      parseAvailabilityMessage("free in november", ctx)?.declarations[0],
    ).toMatchObject({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("catches what the grammar used to hand to the LLM", () => {
    expect(
      parseAvailabilityMessage("cmi dec 20th till jan 2nd", ctx)
        ?.declarations[0],
    ).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-12-20",
      end: "2027-01-02",
    });
  });
});
