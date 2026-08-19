import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { parseDestinationEdits } from "./destination.js";
import { mightContainConstraint } from "../prefilter.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const places = (text: string) =>
  parseDestinationEdits(text, "2026-08-17", []).flatMap((e) => e.destinations);

/**
 * "idm" is *I don't mind* — assent, not a proposal. It failed at four separate
 * layers, which is why the message did nothing at all:
 *
 *   1. the gate had no such word, so it was discarded before any parser ran;
 *   2. no frame recognised assent, so no destination edit was produced;
 *   3. the token was not stripped, so the name came out as "Idm Japan";
 *   4. spelled out, "i dont mind japan" matched the *open-ended availability*
 *      vocabulary and recorded nine months of free time from a remark about a
 *      destination.
 *
 * The fourth was the serious one: a confident wrong answer rather than a miss.
 */
describe("assent to a destination", () => {
  it("arrives at the parsers at all", () => {
    for (const text of ["idm japan", "idm korea or japan", "i dun mind bali"]) {
      expect(mightContainConstraint(text), text).toBe(true);
    }
  });

  it("reads the abbreviation people actually type", () => {
    expect(places("idm japan")).toEqual(["Japan"]);
    expect(places("i dont mind japan")).toEqual(["Japan"]);
    expect(places("dun mind japan")).toEqual(["Japan"]);
  });

  it("keeps the name clean", () => {
    // The assent token has to be stripped, or the place is "Idm Japan".
    expect(places("i dun mind bali lah")).toEqual(["Bali"]);
  });

  it("takes both when two places are named", () => {
    // "Or" is load-bearing: the name extractor splits on it, so it survives
    // the strip that removes every other additive marker.
    expect(places("idm korea or japan")).toEqual(["Korea", "Japan"]);
  });

  /**
   * The over-claim. "I don't mind" with an object is about that object; only
   * the bare form means fully flexible.
   */
  it("does not turn a remark about a place into a year of free time", () => {
    for (const text of ["i dont mind japan", "idm japan", "dun mind bali"]) {
      expect(parseAvailabilityMessage(text, ctx), text).toBeNull();
    }
  });

  it("still reads the bare form as fully flexible", () => {
    for (const text of ["i dun mind", "i dun mind lah", "up to you all", "flexible"]) {
      expect(
        parseAvailabilityMessage(text, ctx)?.declarations[0],
        text,
      ).toEqual({ state: "AVAILABLE", start: "2026-10-01", end: "2027-06-30" });
    }
  });
});
