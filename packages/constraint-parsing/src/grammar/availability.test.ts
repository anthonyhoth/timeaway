import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";

// Sunday 16 Aug 2026.
const ctx = { today: "2026-08-16" };

const parse = (text: string) => parseAvailabilityMessage(text, ctx);

describe("parseAvailabilityMessage — unavailability", () => {
  it("handles the proof-scenario phrasing", () => {
    expect(parse("Can't do October")?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2026-10-01", end: "2026-10-31" },
    ]);
  });

  it("handles Singlish clipped forms", () => {
    expect(parse("cmi oct lah")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-10-01",
    });
    expect(parse("cannot sia, nov")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-11-01",
    });
    expect(parse("bo eng in december")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
    });
  });

  it("reads NS and other blocking commitments as unavailable", () => {
    expect(parse("got reservist in sep")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-09-01",
    });
    expect(parse("ICT in November leh")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-11-01",
    });
  });

  it("lets negation win when both can and cannot appear", () => {
    expect(parse("cannot make it in october")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
    });
  });
});

describe("parseAvailabilityMessage — availability", () => {
  it("reads affirmatives with a date", () => {
    expect(parse("nov ok for me")?.declarations[0]).toMatchObject({
      state: "AVAILABLE",
      start: "2026-11-01",
      end: "2026-11-30",
    });
    expect(parse("i'm free in December")?.declarations[0]).toMatchObject({
      state: "AVAILABLE",
    });
    expect(parse("can lah, sep")?.declarations[0]).toMatchObject({
      state: "AVAILABLE",
    });
  });

  it("resolves relative expressions", () => {
    // Week of Mon 17 Aug 2026.
    expect(parse("free next week")?.declarations[0]).toMatchObject({
      state: "AVAILABLE",
      start: "2026-08-17",
      end: "2026-08-23",
    });
    // "next next week" is the week after next, not next week.
    expect(parse("can next next week")?.declarations[0]).toMatchObject({
      start: "2026-08-24",
      end: "2026-08-30",
    });
    expect(parse("cannot next month")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });
});

describe("parseAvailabilityMessage — uncertainty", () => {
  it("marks roster-pending as UNKNOWN, never UNAVAILABLE", () => {
    expect(parse("roster not out yet for nov")?.declarations[0]).toMatchObject({
      state: "UNKNOWN",
      start: "2026-11-01",
    });
    expect(parse("dunno yet for december")?.declarations[0]).toMatchObject({
      state: "UNKNOWN",
    });
    expect(parse("nov not confirmed yet")?.declarations[0]).toMatchObject({
      state: "UNKNOWN",
    });
  });
});

describe("parseAvailabilityMessage — leave caps", () => {
  it("parses caps stated on their own, with no date", () => {
    expect(parse("max 2 days leave")).toMatchObject({
      relevant: true,
      maxLeaveDays: 2,
      declarations: [],
    });
    expect(parse("only got 3 days AL left")?.maxLeaveDays).toBe(3);
    expect(parse("i got 5 days annual leave")?.maxLeaveDays).toBe(5);
  });

  it("treats no remaining leave as a zero cap", () => {
    expect(parse("no more leave")?.maxLeaveDays).toBe(0);
  });
});

describe("parseAvailabilityMessage — declining safely", () => {
  it("declines bare intent with no date", () => {
    // "can" alone answers nothing in particular.
    expect(parse("can")).toBeNull();
    expect(parse("cannot lah")).toBeNull();
  });

  it("declines bare cmi — it also means 'poor quality' in Singlish", () => {
    expect(parse("that plan cmi one")).toBeNull();
  });

  it("declines conditional statements for the LLM to handle", () => {
    expect(parse("can go november if flights not too ex")).toBeNull();
    expect(parse("october unless my leave got rejected")).toBeNull();
  });

  it("declines third-party statements", () => {
    expect(parse("she can only do school holidays")).toBeNull();
  });

  it("declines ordinary chatter", () => {
    expect(parse("hahaha ok lah")).toBeNull();
    expect(parse("the food there damn shiok")).toBeNull();
  });

  it("declines a date with no stated intent", () => {
    expect(parse("october?")).toBeNull();
  });
});
