import { describe, expect, it } from "vitest";
import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseUnderspecifiedSpan } from "./grammar/underspecified.js";

describe("mightContainConstraint", () => {
  it("passes availability statements from the proof scenario", () => {
    expect(mightContainConstraint("Can't do October")).toBe(true);
    expect(mightContainConstraint("Max 2 days leave")).toBe(true);
    expect(mightContainConstraint("I only know my roster one month ahead")).toBe(true);
    expect(mightContainConstraint("Sheryl can only travel during school holidays")).toBe(true);
  });

  it("passes casual Singapore group-chat phrasings", () => {
    expect(mightContainConstraint("cmi for oct sia")).toBe(true);
    expect(mightContainConstraint("I got reservist in sep")).toBe(true);
    expect(mightContainConstraint("4-6 days can")).toBe(true);
    expect(mightContainConstraint("free after the 15th")).toBe(true);
    expect(mightContainConstraint("nov ok for me")).toBe(true);
    expect(mightContainConstraint("deepavali long weekend?")).toBe(true);
  });

  it("passes date-shaped messages", () => {
    expect(mightContainConstraint("21/11 to 25/11?")).toBe(true);
    expect(mightContainConstraint("2026-11-07")).toBe(true);
    expect(mightContainConstraint("maybe the weekend after")).toBe(true);
  });

  it("filters ordinary chatter", () => {
    expect(mightContainConstraint("hahahaha")).toBe(false);
    expect(mightContainConstraint("wah the food there looks amazing")).toBe(false);
    expect(mightContainConstraint("who's bringing the switch")).toBe(false);
    expect(mightContainConstraint("lol")).toBe(false);
  });

  it("filters degenerate input", () => {
    expect(mightContainConstraint("")).toBe(false);
    expect(mightContainConstraint("x".repeat(1500))).toBe(false);
  });
});

describe("Singaporean leave and NS shorthand reaches the grammar", () => {
  it("lets AL through", () => {
    // These were discarded at the gate, so no parser ever saw them.
    for (const text of ["got 12 AL", "12 al", "no more AL", "AL left 6"]) {
      expect(mightContainConstraint(text), text).toBe(true);
    }
  });

  it("lets ICT through", () => {
    // The pattern read "icct?", which matches "icc" and "icct" but never "ict".
    expect(mightContainConstraint("got ict")).toBe(true);
  });

  it("lets mobilisation manning through", () => {
    expect(mightContainConstraint("mob manning")).toBe(true);
  });

  it("still drops ordinary chatter", () => {
    expect(mightContainConstraint("the food there damn shiok")).toBe(false);
  });
});

/**
 * The gate's contract, asserted against the parsers themselves rather than
 * restated by hand: **it may only reject what no parser would have claimed.**
 *
 * Breaking it is silent — the message is discarded before anything can read it
 * — and it has now happened three times. "AL" was gated out while the leave
 * parser understood it; "ict" was gated out by a typo; and every phrasing of
 * planning aloud was gated out while the trip-edit parser handled it, making
 * that parser dead code for the exact messages it was written for.
 *
 * This test fails the next time a parser learns something the gate has not.
 */
describe("the gate never discards what a parser could read", () => {
  const today = "2026-08-17" as const;
  const ctx = {
    today,
    horizonStart: null,
    horizonEnd: null,
    destination: null,
  };

  /** Real phrasings, spanning every parser behind the gate. */
  const corpus = [
    "cmi october",
    "got 12 AL",
    "no more AL",
    "got ict next month",
    "mob manning first 3 wks of jan",
    "free the whole of december",
    "can't do 20-25 nov",
    "reservist first two weeks of nov",
    "we want to go Hainan this year end",
    "this year end",
    "end of this year",
    "planning on this year end",
    "whole of December",
    "let's do Japan",
    "let's go Korea instead",
    "push it to december",
    "make it 5 days",
    "count me out",
    "i just went korea, don't want to go again",
    "budget is tight for me",
    "actually nvm",
    "free in oct last 2 weeks and nov 1st week",
    "i'm not free 2 weeks in nov",
    "roster not out yet for nov",
  ];

  const claimedBy = (text: string) =>
    parseAvailabilityMessage(text, ctx) !== null ||
    parseTripEdit(text, today, [], { horizonUnset: true }) !== null ||
    parseParticipantNote(text) !== null ||
    parseParticipationChange(text) !== null ||
    parseReversal(text) !== null ||
    parseUnderspecifiedSpan(text, ctx) !== null;

  for (const text of corpus) {
    it(`lets through: ${text}`, () => {
      if (!claimedBy(text)) return; // nothing downstream wants it; fine to drop
      expect(
        mightContainConstraint(text),
        `a parser reads "${text}" but the gate discards it`,
      ).toBe(true);
    });
  }
});
