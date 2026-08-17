import { describe, expect, it } from "vitest";
import { parseReversal } from "./reversal.js";
import { parseAvailabilityMessage } from "./availability.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-11-01" as const,
  horizonEnd: "2027-03-31" as const,
  destination: null,
};

describe("parseReversal", () => {
  it("catches explicit undo language", () => {
    for (const text of [
      "actually nvm",
      "nevermind",
      "never mind",
      "scratch that",
      "ignore that",
      "forget what i said",
      "cancel that",
    ]) {
      expect(parseReversal(text), text).not.toBeNull();
    }
  });

  it("catches a change of plans stated without naming it", () => {
    for (const text of [
      "actually i can't do that anymore",
      "cannot already",
      "cmi liao",
      "no longer free",
      "changed my mind",
      "something came up",
    ]) {
      expect(parseReversal(text), text).not.toBeNull();
    }
  });

  it("does not fire on 'actually' plus a positive statement", () => {
    // "Actually I'm free in Nov" is a plain declaration, not a retraction.
    expect(parseReversal("actually i'm free in nov")).toBeNull();
    expect(parseReversal("actually november works")).toBeNull();
  });

  it("does not fire on ordinary chatter", () => {
    expect(parseReversal("that place looks nice")).toBeNull();
    expect(parseReversal("ok sounds good")).toBeNull();
  });
});

/**
 * The division of labour that makes this safe: a retraction that names dates
 * is not a retraction at all, it is a new declaration, and the existing
 * latest-wins path already handles it. Only bare ones reach the reversal code.
 */
describe("a retraction carrying new dates stays on the normal path", () => {
  it("parses as a fresh declaration, not an undo", () => {
    const parsed = parseAvailabilityMessage("actually i can't do 20-25 nov", ctx);
    expect(parsed?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-20", end: "2026-11-25" },
    ]);
  });

  it("leaves the bare form for the reversal path", () => {
    expect(parseAvailabilityMessage("actually nvm, cannot already", ctx)).toBeNull();
    expect(parseReversal("actually nvm, cannot already")).not.toBeNull();
  });
});
