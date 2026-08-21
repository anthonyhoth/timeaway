import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { parseDestinationEdit } from "./destination.js";
import { parseSpanList } from "./multi-span.js";
import { namesOpaquePeriod } from "./opaque.js";
import { namesLikelyPlace } from "./proposals.js";

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const dates = (text: string) => parseAvailabilityMessage(text, ctx)?.declarations;

/**
 * The remaining findings from the third replay, minus register — the founder
 * ruled that out of scope: the target user does not write in paragraphs.
 */
describe("every window in a list is recorded", () => {
  /**
   * parseSpanList reads both windows correctly. It was never reached: the year
   * hint comes from the trip horizon, and a horizon opening in October makes
   * "june" mean June 2026, which has gone. Every segment failed to resolve, the
   * whole list declined, and the single-reference path silently kept the first.
   */
  it("keeps a second window inside the same month", () => {
    expect(dates("june i can do 1-13 june or 24-30 june")).toEqual([
      { state: "AVAILABLE", start: "2027-06-01", end: "2027-06-13" },
      { state: "AVAILABLE", start: "2027-06-24", end: "2027-06-30" },
    ]);
  });

  it("resolves a list the year hint would put in the past", () => {
    expect(
      parseSpanList("1-13 june or 24-30 june", today, 2026)?.map((e) => e.range),
    ).toEqual([
      { start: "2027-06-01", end: "2027-06-13" },
      { start: "2027-06-24", end: "2027-06-30" },
    ]);
  });

  it("still reads a cross-month list", () => {
    expect(dates("i can do either nov or dec")).toHaveLength(2);
  });
});

describe("a month-by-month calendar is read", () => {
  /**
   * The densest availability message in three sweeps, and it recorded nothing.
   * It also carries the MAYBE the five-state model exists for.
   */
  it("reads each month and its own answer", () => {
    expect(dates("mar: no. apr: yes. may: maybe. jun: no")).toEqual([
      { state: "UNAVAILABLE", start: "2027-03-01", end: "2027-03-31" },
      { state: "AVAILABLE", start: "2027-04-01", end: "2027-04-30" },
      { state: "MAYBE", start: "2027-05-01", end: "2027-05-31" },
      { state: "UNAVAILABLE", start: "2027-06-01", end: "2027-06-30" },
    ]);
  });

  it("reads the Singlish forms of the same shape", () => {
    expect(dates("nov: cannot. dec: can")).toEqual([
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-30" },
      { state: "AVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
  });

  it("is not confused by an ordinary sentence containing a colon", () => {
    expect(dates("shortlist: seoul, taipei, danang")).toBeUndefined();
  });
});

describe("agreeing to a place does not delete the others", () => {
  /**
   * "Actually" is a replace word, so assent carrying it became a destructive
   * rewrite of the shortlist rather than an addition to it.
   */
  it("adds rather than replaces when the message is assent", () => {
    expect(parseDestinationEdit("okinawa idm actually", today, ["Japan"])).toMatchObject({
      op: "ADD",
    });
    expect(
      parseDestinationEdit("chiang mai in dec is damn nice actually", today, ["Japan"]),
    ).toMatchObject({ op: "ADD" });
  });

  it("still replaces when that is what was asked", () => {
    expect(
      parseDestinationEdit("actually lets do korea instead", today, ["Japan"]),
    ).toMatchObject({ op: "REPLACE" });
  });
});

describe("a preposition does not make the next word a place", () => {
  /**
   * Fourth and fifth causes of a nonsense destination, after all-caps (CENT),
   * residue (Again) and the infinitive (Cry). Both come from the locative rule
   * accepting a function word: "at least", "in but".
   */
  it("rejects a function word standing where a place would", () => {
    expect(namesLikelyPlace("Least", "Then Georgia is out, at least for 2027")).toBe(false);
    expect(namesLikelyPlace("But Where", "ok im in but where")).toBe(false);
    expect(parseDestinationEdit("ok im in but where", today, ["Japan"])).toBeNull();
  });

  it("still accepts a real place behind the same prepositions", () => {
    expect(namesLikelyPlace("Sekinchan", "lets go to Sekinchan")).toBe(true);
    expect(namesLikelyPlace("Sekinchan", "the food in Sekinchan is good")).toBe(true);
  });
});

describe("a recurring period is asked about, not guessed", () => {
  /**
   * A teacher has four school holidays a year. Resolving "school hols" to the
   * year-end one and ruling out the other three is not a partial answer, it is
   * a wrong one — and it silently removes the March and June windows she went
   * on to name.
   *
   * This replaces the previous behaviour, which recorded that single guess.
   * Asking is the existing answer for a period only the speaker can pin down.
   */
  it("treats a bare recurring period as opaque", () => {
    for (const text of [
      "i can only move during school hol",
      "i can only join during school holidays",
      "only during the term break",
    ]) {
      expect(namesOpaquePeriod(text), text).toBe(true);
    }
  });

  it("does not guess one instance of it", () => {
    expect(dates("i can only move during school hol")).toBeUndefined();
  });

  /**
   * The period table holds one school-holiday window, the year-end one. Naming
   * it resolves; naming any other instance asks, because "cmi during the march
   * school hols" was otherwise recorded as 15 Nov – 31 Dec — the March holidays
   * filed as the year-end ones.
   */
  it("still resolves the instance we actually hold", () => {
    expect(namesOpaquePeriod("cmi school holidays in dec")).toBe(false);
    expect(dates("i can only do school holidays in dec")?.[1]).toMatchObject({
      state: "AVAILABLE",
      start: "2026-12-01",
    });
  });

  it("asks about an instance we cannot resolve rather than guessing", () => {
    expect(namesOpaquePeriod("cmi during the march school hols")).toBe(true);
    expect(dates("cmi during the march school hols")).toBeUndefined();
  });
});
