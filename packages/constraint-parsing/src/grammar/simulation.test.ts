import { describe, expect, it } from "vitest";
import { mightContainConstraint } from "../prefilter.js";
import { parseAvailabilityMessage } from "./availability.js";
import { parseDestinationEdit } from "./destination.js";
import { parseParticipantNote } from "./notes.js";
import { parseParticipationChange } from "./participation.js";
import { parseTripEdit } from "./trip-edit.js";

const today = "2026-08-17" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const edit = (text: string, current: string[] = []) =>
  parseTripEdit(text, today, current, { horizonUnset: true });

/**
 * Regressions from a simulated corpus of 183 group-chat messages, plus a
 * research pass on how people really talk when planning together.
 *
 * Every case below was a *wrong* answer rather than a missing one, which is the
 * failure mode that matters: a missed parse costs one message, a confident
 * wrong parse silently reshapes the trip.
 */
describe("a message about the speaker never moves the trip", () => {
  /**
   * The worst finding. An obligation rarely uses the word "can't", so these all
   * fell through to the trip-edit parser — which then pointed the trip at
   * exactly the dates being blocked out.
   */
  it("does not move the trip to the dates someone just ruled out", () => {
    for (const text of [
      "renovation starting dec i very tied up",
      "just started new job cannot take leave until dec",
      "i broke until end of the year",
      "blackout period nov to jan for my dept",
      "working shift dec 1 to 7",
      "applying al for the first week of dec",
      "sorry ah i retract my nov",
      "work trip to shanghai in nov",
    ]) {
      expect(edit(text), text).toBeNull();
    }
  });

  it("does not move the trip to a period someone argued against", () => {
    // "Nov too rainy" was read as a request to go in November.
    expect(edit("disagree lah nov too rainy")).toBeNull();
    expect(edit("nov too crowded")).toBeNull();
  });

  it("still hears the group changing the plan", () => {
    for (const text of [
      "how about december",
      "we want to go Hainan this year end",
      "make it 5 days",
      "push it to december",
      "minimum 5 days",
    ]) {
      expect(edit(text, ["Japan"]), text).not.toBeNull();
    }
  });
});

describe("destination edits keep their direction", () => {
  const dest = (text: string) =>
    parseDestinationEdit(text, today, ["Japan", "Bangkok"]);

  it("removes rather than adds when both words appear", () => {
    // "Remove bangkok also" was an ADD: the weak additive "also" outranked the
    // explicit verb, inverting the operation.
    expect(dest("remove bangkok also")).toEqual({
      op: "REMOVE",
      destinations: ["Bangkok"],
    });
  });

  it("removes when the reason follows the place", () => {
    // "Too" in "too expensive" was read as the additive "too", and the removal
    // vanished entirely.
    expect(dest("drop japan too ex")).toEqual({
      op: "REMOVE",
      destinations: ["Japan"],
    });
    expect(dest("cross off bangkok too hot")).toEqual({
      op: "REMOVE",
      destinations: ["Bangkok"],
    });
  });

  it("only removes places the trip actually has", () => {
    expect(dest("drop paris")).toBeNull();
  });
});

describe("dates written the way people write them", () => {
  const dates = (text: string) =>
    parseAvailabilityMessage(text, ctx)?.declarations;

  /**
   * The most common way dates get typed, and it was silently recording a
   * single day — sometimes the start, sometimes the end — instead of the range.
   */
  it("reads DD/MM–DD/MM without spaces", () => {
    expect(dates("cannot make it 12/12-15/12")).toEqual([
      { state: "UNAVAILABLE", start: "2026-12-12", end: "2026-12-15" },
    ]);
    expect(dates("free 20/12-27/12")).toEqual([
      { state: "AVAILABLE", start: "2026-12-20", end: "2026-12-27" },
    ]);
  });

  it("carries a numeric range across the new year", () => {
    expect(dates("free 28/12-3/1")).toEqual([
      { state: "AVAILABLE", start: "2026-12-28", end: "2027-01-03" },
    ]);
  });

  it("keeps both halves of an either/or", () => {
    // "Or" was not a segment separator, so December was dropped in silence
    // while the sender saw the message acknowledged.
    expect(dates("i can do either nov or dec")).toHaveLength(2);
    expect(dates("free nov or dec")).toHaveLength(2);
  });
});

describe("Singapore vocabulary the corpus insisted on", () => {
  it("knows Chinese New Year, the biggest blocker in this market", () => {
    expect(parseAvailabilityMessage("cny cmi family thing", ctx)?.declarations[0])
      .toMatchObject({ state: "UNAVAILABLE", start: "2027-02-05" });
    expect(
      parseAvailabilityMessage("chinese new year period cannot lah", ctx)
        ?.declarations[0],
    ).toMatchObject({ state: "UNAVAILABLE" });
  });

  it("knows 'ex' means expensive", () => {
    // Probably the highest-frequency budget word here, and it was missing.
    expect(parseParticipantNote("japan too ex lah")?.kind).toBe("BUDGET");
    expect(parseParticipantNote("too ex for me")?.kind).toBe("BUDGET");
  });

  it("reads money written the way it is spoken", () => {
    expect(parseParticipantNote("i can only spend around 1k")?.kind).toBe("BUDGET");
  });
});

describe("'I'm in' has to stand alone", () => {
  /**
   * Research finding: "I'm in" collides head-on with "I'm in a meeting" and
   * "I'm in camp", which mean the opposite. Someone stating they were busy was
   * being recorded as joining the trip.
   */
  it("joins the trip only when nothing follows", () => {
    for (const text of ["im in", "im in!", "im in lah", "count me in"]) {
      expect(parseParticipationChange(text), text).toBe("IN");
    }
  });

  it("is not a commitment when it introduces where someone is", () => {
    for (const text of ["im in a meeting", "im in camp", "im in office"]) {
      expect(parseParticipationChange(text), text).toBeNull();
    }
  });
});

describe("the gate still lets every one of these through", () => {
  for (const text of [
    "korea instead lah",
    "drop japan",
    "japan is out",
    "im rejoining",
    "up to you guys i flexible",
    "up to you all",
    "cny cmi family thing",
    "japan too ex lah",
    "12/12-15/12 cannot",
  ]) {
    it(`arrives: ${text}`, () => {
      expect(mightContainConstraint(text)).toBe(true);
    });
  }
});
