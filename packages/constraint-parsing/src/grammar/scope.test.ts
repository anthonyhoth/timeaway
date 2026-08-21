import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { parseDestinationEdit } from "./destination.js";
import { parseParticipantNote } from "./notes.js";
import { namesLikelyPlace } from "./proposals.js";
import { parseTripEdit } from "./trip-edit.js";

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const dates = (text: string) => parseAvailabilityMessage(text, ctx)?.declarations;
const edit = (text: string, current: string[] = ["Japan"]) =>
  parseTripEdit(text, today, current, { horizonUnset: false });

/**
 * What a word is *about*.
 *
 * The remaining findings from the second replay are all one question asked in
 * different places: a word was matched anywhere in the message and its meaning
 * assumed, when that meaning depends entirely on what it governs. "Only" is a
 * date restriction or a headcount. "To" introduces a country or an infinitive.
 * "Idm" agrees to a calendar or to a destination. Same token, opposite result.
 */
describe("assent is about whatever it names", () => {
  /**
   * MIND_HAS_OBJECT already existed for this — "idm japan" must not book nine
   * months — but it only looks for an object *after* the phrase. The replay
   * found the object in front of it, and behind a word its own lookahead
   * excused.
   */
  it("does not book the horizon when the assent names a place", () => {
    for (const text of [
      "taiwan i dun mind",
      "idm either",
      "then da nang? bali? korea? i really idm",
      "korea idm",
    ]) {
      expect(dates(text), text).toBeUndefined();
    }
  });

  it("does not book the horizon when the assent is tacked onto something else", () => {
    expect(dates("3 days i can unpaid also, idm")).toBeUndefined();
    // A loose "a day" still resolves to a single day near today, which is
    // outside the horizon entirely. That is a separate defect and deliberately
    // left alone: this repo keeps out-of-window declarations so the engine can
    // surface the mismatch rather than silently shifting them. What matters
    // here is that nine months of availability are no longer invented.
    for (const d of dates("like 180 a day gone but idm lah") ?? []) {
      expect(d.end).not.toBe("2027-06-30");
    }
  });

  it("still reads the bare form as fully flexible", () => {
    for (const text of [
      "i dun mind",
      "i dun mind lah",
      "up to you all",
      "flexible",
      "chin chai",
      "anything also can",
    ]) {
      expect(dates(text)?.[0], text).toEqual({
        state: "AVAILABLE",
        start: "2026-10-01",
        end: "2027-06-30",
      });
    }
  });
});

describe("'only' restricts the thing it governs", () => {
  /**
   * The exclusive reading rules out the whole horizon and carves the stated
   * window back in, which is right for "i can only do 23-28 feb" and disastrous
   * when the word governs anything else. RESTRICTIVE matched a bare "only" or
   * "just" anywhere in the message.
   */
  it("does not block the horizon when 'just' means merely", () => {
    // Nine months of UNAVAILABLE from a remark about cafés. A stray one-day
    // reading of "now" survives — outside the window, and left alone for the
    // reason given above — but the horizon-wide block is gone.
    const result =
      dates("bali is for when we can afford a villa. now go also just sit in cafe") ?? [];
    expect(
      result.some((d) => d.state === "UNAVAILABLE" && d.start === "2026-10-01"),
    ).toBe(false);
  });

  it("does not apply a headcount restriction to an unrelated date range", () => {
    // "Only 5" is five days of leave; the exclusive reading was applied to the
    // 23–28 Feb sitting in the same sentence.
    const result = dates("23/2-28/2 is 6 days, i can only do 5 remember");
    for (const d of result ?? []) {
      expect(d.state === "UNAVAILABLE" && d.start === "2026-10-01").toBe(false);
    }
  });

  it("still restricts when it governs a date", () => {
    expect(dates("i can only join during school holidays")).toEqual([
      { state: "UNAVAILABLE", start: "2026-10-01", end: "2027-06-30" },
      { state: "AVAILABLE", start: "2026-11-15", end: "2026-12-31" },
    ]);
    expect(dates("i can only do 23-28 feb")).toEqual([
      { state: "UNAVAILABLE", start: "2026-10-01", end: "2027-06-30" },
      { state: "AVAILABLE", start: "2027-02-23", end: "2027-02-28" },
    ]);
  });
});

describe("'to' introduces a country or a verb", () => {
  /**
   * Third distinct cause of a nonsense destination, after all-caps (CENT) and
   * leftover residue (Again). The locative rule accepts anything after "to",
   * which is what makes unknown places work and what makes any infinitive a
   * place.
   */
  it("does not read an infinitive as a destination", () => {
    expect(
      parseDestinationEdit(
        "my boss ping me 11pm asking for the deck. i want to cry",
        today,
        ["Japan"],
      ),
    ).toBeNull();
    expect(namesLikelyPlace("Cry", "i want to cry")).toBe(false);
  });

  it("still accepts an unknown place someone is travelling to", () => {
    expect(namesLikelyPlace("Sekinchan", "lets go to Sekinchan")).toBe(true);
    expect(namesLikelyPlace("Sekinchan", "we fly to Sekinchan in june")).toBe(true);
    expect(namesLikelyPlace("Sekinchan", "i heard Sekinchan is nice")).toBe(true);
  });
});

describe("a length and a month in one sentence are both heard", () => {
  /**
   * The horizon was only resolved when no duration was found, so a message
   * carrying both kept the length and silently dropped the dates.
   */
  it("keeps the month when a duration is also named", () => {
    expect(edit("oct then. deepavali long weekend, 8 oct i think")?.horizon)
      .toMatchObject({ start: "2026-10-01" });
  });

  /**
   * Both found by re-running the corpora after the change above: widening what
   * trip-edit will claim let two new wrong claims through.
   */
  it("does not read unpaid leave as the trip's length", () => {
    expect(edit("3 days i can unpaid also, idm")).toBeNull();
  });

  it("discards a window that has already closed", () => {
    // "take 10-13 aug u get 7/8-15/8" resolves to a past August when the year
    // is inferred wrongly; a horizon ending before today is not a search space.
    expect(
      edit("v4 loading. national day 9/8/2027 is a monday. take 10-13 aug u get 7/8-15/8, 9 days")
        ?.horizon,
    ).toBeUndefined();
  });

  it("still refuses to invent a horizon from a bare destination change", () => {
    // "Korea instead" moves the destination; reading a horizon out of it would
    // be inventing one.
    expect(
      parseTripEdit("let's go Korea instead", today, ["Japan"], { horizonUnset: false })
        ?.horizon,
    ).toBeUndefined();
  });
});

describe("a date is not an amount of money", () => {
  it("does not read a day/month as a budget", () => {
    expect(parseParticipantNote("hari raya around 19/2 also")).toBeNull();
    expect(parseParticipantNote("around 19/2")).toBeNull();
  });

  it("still reads a real figure", () => {
    expect(parseParticipantNote("around 1500")?.kind).toBe("BUDGET");
    expect(parseParticipantNote("can we keep it under 1500")?.kind).toBe("BUDGET");
    expect(parseParticipantNote("around $800 max")?.kind).toBe("BUDGET");
  });
});

describe("a condition is not an agreement", () => {
  /**
   * Leading conditionals were vetoed in the first sweep. "Only if" opens the
   * same clause and was applying the trip length as though it had been agreed.
   */
  it("does not apply a conditional trip length", () => {
    expect(edit("only if we go 5 days ah, 4 days taiwan not worth")).toBeNull();
    expect(edit("if korea in feb its snow season also")).toBeNull();
  });

  it("still hears a proposal that happens to carry a condition", () => {
    // The condition trails the proposal here rather than governing it.
    expect(edit("lets do december if flight cheap")).not.toBeNull();
  });
});
