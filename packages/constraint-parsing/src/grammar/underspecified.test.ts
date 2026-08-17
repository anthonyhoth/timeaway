import { describe, expect, it } from "vitest";
import { parseUnderspecifiedSpan } from "./underspecified.js";
import { parseAvailabilityMessage } from "./availability.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-11-01" as const,
  horizonEnd: "2026-12-31" as const,
  destination: null,
};

describe("parseUnderspecifiedSpan", () => {
  it("reads a length and a period with no position", () => {
    expect(parseUnderspecifiedSpan("I'm not free 2 weeks in nov", ctx)).toEqual({
      state: "UNAVAILABLE",
      days: 14,
      within: { start: "2026-11-01", end: "2026-11-30" },
      lengthLabel: "2 weeks",
    });
  });

  it("keeps the direction of the statement", () => {
    // The same question, opposite answers.
    expect(parseUnderspecifiedSpan("free a week in dec", ctx)?.state).toBe(
      "AVAILABLE",
    );
    expect(parseUnderspecifiedSpan("cannot 3 days in dec", ctx)?.state).toBe(
      "UNAVAILABLE",
    );
  });

  it("counts words as well as digits", () => {
    expect(parseUnderspecifiedSpan("busy two weeks in nov", ctx)?.days).toBe(14);
    expect(parseUnderspecifiedSpan("free a week in nov", ctx)?.days).toBe(7);
  });

  it("stays out of the way when the position is already stated", () => {
    // findSubPeriod resolves these exactly; asking would be a silly question.
    expect(parseUnderspecifiedSpan("cmi first 2 weeks of nov", ctx)).toBeNull();
    expect(parseUnderspecifiedSpan("cmi last week of nov", ctx)).toBeNull();
  });

  it("declines when there is nothing to position", () => {
    // A span that fills the month is just the month.
    expect(parseUnderspecifiedSpan("not free 5 weeks in nov", ctx)).toBeNull();
  });

  it("declines without a clear direction", () => {
    expect(parseUnderspecifiedSpan("2 weeks in nov", ctx)).toBeNull();
  });

  it("only sees what the availability grammar refused", () => {
    // The division of labour: anything parseable never reaches here.
    expect(parseAvailabilityMessage("I'm not free 2 weeks in nov", ctx)).toBeNull();
  });
});
