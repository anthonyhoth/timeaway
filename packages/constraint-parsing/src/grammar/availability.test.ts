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

describe("parseAvailabilityMessage — does not over-claim a period", () => {
  // Found by an end-to-end run: this marked someone out for all of November.
  it("declines when only part of a month is meant", () => {
    expect(parse("cmi first two weeks of nov lah")).toBeNull();
    expect(parse("cannot end of december")).toBeNull();
    expect(parse("free mid sep")).toBeNull();
    expect(parse("can after the 15th of november")).toBeNull();
  });

  it("still claims the plain whole-period cases", () => {
    expect(parse("cmi nov")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });
});

describe("year inference prefers the trip's own window", () => {
  const y2027 = { today: "2026-08-17", horizonStart: "2027-01-01", horizonEnd: "2027-12-31" };

  it("reads a bare month as the year the group is planning in", () => {
    // Anchored to today this was Dec 2026 — outside a 2027 trip entirely.
    expect(parseAvailabilityMessage("cannot december", y2027)?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2027-12-01",
    });
  });

  it("leaves an explicit year alone", () => {
    expect(parseAvailabilityMessage("cmi december 2026", y2027)?.declarations[0]).toMatchObject({
      start: "2026-12-01",
    });
  });

  it("does not invent an overlap that isn't there", () => {
    // June never lands inside a November trip, so it stays outside and the
    // engine's diagnostic surfaces the mismatch instead of a bogus shift.
    const nov = {
      today: "2026-08-17",
      horizonStart: "2026-11-01",
      horizonEnd: "2026-11-30",
    };
    const r = parseAvailabilityMessage("i can only travel in june", nov);
    expect(
      r?.declarations.some(
        (d) => d.state === "AVAILABLE" && d.start.startsWith("2027-06"),
      ),
    ).toBe(true);
  });
});

describe("open-ended availability", () => {
  const wide = {
    today: "2026-08-17",
    horizonStart: "2026-11-01",
    horizonEnd: "2027-10-31",
  };

  it("reads 'free whenever' as available across the whole trip window", () => {
    for (const t of ["im free whenever", "ok to travel anytime", "any dates work for me", "i dun mind"]) {
      expect(parseAvailabilityMessage(t, wide)?.declarations[0]).toEqual({
        state: "AVAILABLE",
        start: "2026-11-01",
        end: "2027-10-31",
      });
    }
  });

  it("captures a leave cap and open availability from one message", () => {
    // The cap alone used to win, silently dropping the availability.
    const r = parseAvailabilityMessage("got 12 days leave, anytime works", wide);
    expect(r?.maxLeaveDays).toBe(12);
    expect(r?.declarations[0]).toMatchObject({ state: "AVAILABLE" });
  });

  it("is vetoed by negation or uncertainty", () => {
    expect(parseAvailabilityMessage("cannot anytime", wide)).toBeNull();
    expect(parseAvailabilityMessage("not sure whenever", wide)).toBeNull();
  });

  it("declines without a horizon, having nothing to mark", () => {
    expect(parseAvailabilityMessage("im free whenever", { today: "2026-08-17" })).toBeNull();
  });
});
