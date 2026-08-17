import { describe, expect, it } from "vitest";
import {
  parseAvailabilityMessage,
  parseOptionReference,
  parseUnderspecifiedSpan,
} from "@timeaway/constraint-parsing";
import { positionSpans } from "@timeaway/trip-engine";

/**
 * The exchange this exists for, end to end:
 *
 *   "I'm not free 2 weeks in nov"   → which two weeks?
 *   "The middle one"                → 9–22 Nov, UNAVAILABLE
 *
 * Three words that mean nothing without remembering the question. The pieces
 * live in three packages, so the integration is asserted here rather than
 * assumed from the units.
 */
const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-11-01" as const,
  horizonEnd: "2026-12-31" as const,
  destination: null,
};

describe("clarifying an underspecified span", () => {
  const ask = (text: string) => {
    // The grammar must decline first — asking is the fallback, not the path.
    expect(parseAvailabilityMessage(text, ctx)).toBeNull();
    const span = parseUnderspecifiedSpan(text, ctx);
    expect(span, text).not.toBeNull();
    return { span: span!, options: positionSpans(span!.within, span!.days) };
  };

  it("answers 'the middle one' with the middle two weeks of November", () => {
    const { span, options } = ask("I'm not free 2 weeks in nov");
    expect(options).toHaveLength(3);

    const reference = parseOptionReference("The middle one", options.length);
    expect(reference).not.toBeNull();

    expect(options[reference!.index]).toEqual({
      position: "middle",
      start: "2026-11-09",
      end: "2026-11-22",
    });
    expect(span.state).toBe("UNAVAILABLE");
  });

  it("answers the other two positions just as well", () => {
    const { options } = ask("I'm not free 2 weeks in nov");
    const at = (text: string) =>
      options[parseOptionReference(text, options.length)!.index];

    expect(at("the first one")).toMatchObject({ start: "2026-11-01", end: "2026-11-14" });
    expect(at("the last one")).toMatchObject({ start: "2026-11-17", end: "2026-11-30" });
    expect(at("2")).toMatchObject({ position: "middle" });
  });

  it("keeps the direction of the original statement", () => {
    const { span } = ask("free a week in dec");
    expect(span.state).toBe("AVAILABLE");
    expect(span.days).toBe(7);
  });

  it("does not ask when the position was already given", () => {
    // findSubPeriod resolves this exactly, so there is no question to ask.
    expect(
      parseAvailabilityMessage("cmi first 2 weeks of nov", ctx)?.declarations,
    ).toEqual([{ state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-14" }]);
    expect(parseUnderspecifiedSpan("cmi first 2 weeks of nov", ctx)).toBeNull();
  });
});
