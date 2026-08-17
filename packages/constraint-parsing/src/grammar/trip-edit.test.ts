import { describe, expect, it } from "vitest";
import { parseTripEdit } from "./trip-edit.js";

/**
 * Found by tracing "I'm not free 2 weeks in nov" through the pipeline: the
 * availability parser declines it (which two weeks?), so it fell through here,
 * where "not" is an edit word — and became "move the trip to November". From
 * an organiser that applied with no confirmation at all.
 */
describe("a statement about oneself is never a change to the trip", () => {
  const parse = (text: string) => parseTripEdit(text, "2026-08-17", ["Japan"]);

  it("does not turn personal unavailability into a horizon move", () => {
    expect(parse("I'm not free 2 weeks in nov")).toBeNull();
    expect(parse("i can't do nov")).toBeNull();
    expect(parse("im busy in december")).toBeNull();
    expect(parse("i have no leave for nov")).toBeNull();
  });

  it("still reads a genuine change to the plan", () => {
    expect(parse("let's push it to december")).toMatchObject({ horizon: {} });
    expect(parse("make it 5 days")).toMatchObject({ duration: { min: 5 } });
    expect(parse("let's do Korea instead")).toMatchObject({ destination: {} });
  });

  it("still reads a change stated in the first person", () => {
    // "I" alone is not the tell — the availability vocabulary is.
    expect(parse("i think we should do Korea instead")).toMatchObject({
      destination: {},
    });
  });
});

/**
 * Reported live: a group typed "we want to go Hainan this year end", "planning
 * on this year end", "this year end", "whole of December" — and the bot
 * answered none of them. `resolveHorizon` understood every one; nothing routed
 * them to the trip, because `parseTripEdit` demanded an edit word like
 * "instead" or "make it" and a group stating its plan uses neither.
 */
describe("planning the trip out loud", () => {
  const plan = (text: string, horizonUnset = true, current: string[] = []) =>
    parseTripEdit(text, "2026-08-17", current, { horizonUnset });

  it("reads a window from how a group actually states one", () => {
    for (const text of [
      "planning on this year end",
      "we can do this year end",
      "this year end",
      "end of this year",
    ]) {
      expect(plan(text)?.horizon, text).toEqual({
        start: "2026-11-15",
        end: "2027-01-05",
      });
    }
  });

  it("takes the place and the period from one sentence", () => {
    // Naming both is the normal shape of planning aloud.
    expect(plan("we want to go Hainan this year end")).toMatchObject({
      destination: { op: "ADD", destinations: ["Hainan"] },
      horizon: { start: "2026-11-15", end: "2027-01-05" },
    });
  });

  it("treats a first destination as an addition, not a rewrite", () => {
    // The weakest claim that fits: no organiser approval, nothing discarded.
    expect(plan("let's do Japan")).toMatchObject({
      destination: { op: "ADD", destinations: ["Japan"] },
      destructive: false,
    });
  });

  it("only takes a bare period while the trip has no window", () => {
    // Answering "when?" is one thing; a passing mention of a month once a
    // window exists is not enough to move it.
    expect(plan("whole of December")?.horizon).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
    expect(plan("whole of December", false)).toBeNull();
  });

  it("still keeps a terse edit's place and dates apart", () => {
    // "Korea instead" moves the destination; reading a horizon out of it
    // would be inventing one.
    expect(plan("let's go Korea instead", false, ["Japan"])).toMatchObject({
      destination: { op: "REPLACE", destinations: ["Korea"] },
    });
    expect(plan("let's go Korea instead", false, ["Japan"])?.horizon).toBeUndefined();
  });

  it("still ignores chatter and personal availability", () => {
    expect(plan("hahaha")).toBeNull();
    expect(plan("ok lah")).toBeNull();
    expect(plan("i can't do december")).toBeNull();
  });
});
