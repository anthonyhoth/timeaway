import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import {
  hasContinuationMarker,
  joinUtterances,
  looksLikeContinuation,
  sameReading,
} from "./continuation.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-11-01" as const,
  horizonEnd: "2027-03-31" as const,
  destination: null,
};

/**
 * People type in installments. Each parser sees one message, so the follow-up
 * is a fragment with no referent — and the first message has already been
 * recorded *unqualified*, which is the damaging half: the group ends up with
 * all of December when a fortnight was meant, and nothing looks wrong.
 *
 * The two are re-read as one sentence rather than a new parser being added.
 * That is a much stronger check than interpreting the fragment alone: the join
 * only succeeds if it reads as something already understood.
 */
describe("a thought sent as two messages", () => {
  const both = (a: string, b: string) =>
    parseAvailabilityMessage(joinUtterances(a, b), ctx);

  it("narrows a period the follow-up qualifies", () => {
    expect(both("im free dec", "actually only the last 2 weeks")?.declarations)
      .toContainEqual({ state: "AVAILABLE", start: "2026-12-18", end: "2026-12-31" });
  });

  it("adds a period the follow-up appends", () => {
    expect(both("cmi november", "and december also")?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "UNAVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("carries the direction from the first message into the second", () => {
    // "and dec 1st week" says nothing about free or busy on its own.
    expect(both("free in nov", "and dec 1st week")?.declarations).toEqual([
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-01", end: "2026-12-07" },
    ]);
  });

  it("recognises the words that open a continuation", () => {
    for (const text of ["but only the first half", "and december also", "actually just nov"]) {
      expect(hasContinuationMarker(text), text).toBe(true);
    }
    expect(hasContinuationMarker("i can do december")).toBe(false);
  });

  it("refuses to glue on anything that is not a fragment", () => {
    // A long message that failed to parse is not a continuation — it is
    // something we do not understand, and joining it would invent a sentence
    // nobody wrote.
    expect(
      looksLikeContinuation(
        "actually i was thinking maybe we could try somewhere completely different this time",
      ),
    ).toBe(false);
    expect(looksLikeContinuation("but only the first half")).toBe(true);
  });

  it("joins without mangling punctuation", () => {
    expect(joinUtterances("i can do december.", "but only the first half")).toBe(
      "i can do december but only the first half",
    );
  });
});

/**
 * A merge that reproduces what was already recorded has understood nothing.
 *
 * `tryContinuation` deletes the previous declarations and rewrites them from the
 * joined text, so absorbing such a fragment discards whatever it said. A smell
 * added in the fourth sweep found eight of these across four corpora — three in
 * chats that had already been through three rounds of fixes — including a
 * group's final agreed window.
 */
describe("a merge that changes nothing is not a merge", () => {
  const read = (text: string) =>
    parseAvailabilityMessage(text, ctx)?.declarations ?? [];

  it("recognises a join that reproduces the previous reading", () => {
    const previous = "ICT 9-20 mar";
    const joined = joinUtterances(previous, "12-19 can");
    expect(sameReading(read(previous), read(joined))).toBe(true);
  });

  it("does not mistake a real narrowing for a no-op", () => {
    const previous = "im free dec";
    const joined = joinUtterances(previous, "actually only the last 2 weeks");
    expect(sameReading(read(previous), read(joined))).toBe(false);
  });

  it("does not mistake a real extension for a no-op", () => {
    const previous = "cmi november";
    const joined = joinUtterances(previous, "and december also");
    expect(sameReading(read(previous), read(joined))).toBe(false);
  });

  it("notices a change of state as well as of dates", () => {
    expect(
      sameReading(
        [{ state: "AVAILABLE", start: "2026-11-01", end: "2026-11-30" }],
        [{ state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" }],
      ),
    ).toBe(false);
  });
});
