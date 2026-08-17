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
  // Declining was the original fix; these shapes are now resolved exactly,
  // which satisfies the same requirement — the span must never widen.
  it("narrows to the part of the month that was meant", () => {
    expect(parse("cmi first two weeks of nov lah")?.declarations[0]).toMatchObject(
      { state: "UNAVAILABLE", start: "2026-11-01", end: "2026-11-14" },
    );
    expect(parse("cannot end of december")?.declarations[0]).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-12-21",
      end: "2026-12-31",
    });
  });

  it("still declines a boundary it cannot turn into a span", () => {
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

/**
 * Found in live group testing: "can't do 20-25 nov" was claiming the whole of
 * November. Over-claiming is the one failure mode the grammar must not have —
 * a missed parse costs an LLM call, a confident wrong one corrupts the trip.
 */
describe("explicit days must not widen to the month", () => {
  const ctx = {
    today: "2026-08-17" as const,
    horizonStart: "2026-11-01" as const,
    horizonEnd: "2027-01-31" as const,
    destination: null,
  };

  const only = (text: string) => {
    const parsed = parseAvailabilityMessage(text, ctx);
    expect(parsed, text).not.toBeNull();
    expect(parsed!.declarations, text).toHaveLength(1);
    return parsed!.declarations[0]!;
  };

  it("reads a day range before the month", () => {
    expect(only("i can't do 20-25 nov")).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-11-20",
      end: "2026-11-25",
    });
  });

  it("reads a day range after the month", () => {
    expect(only("free nov 20 to 25")).toMatchObject({
      state: "AVAILABLE",
      start: "2026-11-20",
      end: "2026-11-25",
    });
  });

  it("reads a single day", () => {
    expect(only("cmi 25 dec")).toMatchObject({
      state: "UNAVAILABLE",
      start: "2026-12-25",
      end: "2026-12-25",
    });
  });

  it("handles ordinals", () => {
    expect(only("can't make it 3rd-7th dec")).toMatchObject({
      start: "2026-12-03",
      end: "2026-12-07",
    });
  });

  it("keeps a bare month a whole month", () => {
    expect(only("free in november")).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });

  it("does not mistake a duration for a day range", () => {
    // "3-4 days in Dec" is how long, not when.
    const parsed = parseAvailabilityMessage("free 3-4 days in dec", ctx);
    if (parsed && parsed.declarations.length > 0) {
      expect(parsed.declarations[0]).toMatchObject({
        start: "2026-12-01",
        end: "2026-12-31",
      });
    }
  });

  it("declines a day it can see but cannot resolve", () => {
    // Better one LLM call than confidently claiming all of November.
    expect(parseAvailabilityMessage("cmi nov 20, 22 and 25", ctx)).toBeNull();
  });

  it("rejects an impossible day rather than guessing", () => {
    const parsed = parseAvailabilityMessage("cmi 45 nov", ctx);
    expect(parsed?.declarations ?? []).not.toContainEqual(
      expect.objectContaining({ start: "2026-11-01", end: "2026-11-30" }),
    );
  });
});

/**
 * National Service is a hard travel bar, not a preference. An NSman on
 * mobilisation manning cannot leave the country, so a trip planned over those
 * dates is not merely inconvenient — it is impossible for him.
 */
describe("NS obligations block travel", () => {
  const ctx = {
    today: "2026-08-17" as const,
    horizonStart: "2026-11-01" as const,
    horizonEnd: "2027-03-31" as const,
    destination: null,
  };

  it("reads mob manning as unavailable, however it is spelled", () => {
    for (const text of [
      "first 3 wks of jan i got mob mannin",
      "first 3 weeks of jan i got mob manning",
      "first 3 weeks of jan, mobilisation manning",
    ]) {
      const parsed = parseAvailabilityMessage(text, ctx);
      expect(parsed?.declarations, text).toEqual([
        { state: "UNAVAILABLE", start: "2027-01-01", end: "2027-01-21" },
      ]);
    }
  });

  it("covers the other NS shorthands", () => {
    for (const term of ["ops manning", "mob ex", "ict", "reservist", "in camp"]) {
      const parsed = parseAvailabilityMessage(`${term} in nov`, ctx);
      expect(parsed?.declarations[0], term).toMatchObject({
        state: "UNAVAILABLE",
      });
    }
  });
});

/**
 * These were declined outright before — safe, but the phrasings are far too
 * common to keep paying an LLM call for, and when the extractor is down a
 * decline loses the constraint entirely.
 */
describe("sub-periods narrow instead of declining", () => {
  const ctx = {
    today: "2026-08-17" as const,
    horizonStart: "2026-11-01" as const,
    horizonEnd: "2027-03-31" as const,
    destination: null,
  };

  const range = (text: string) => {
    const parsed = parseAvailabilityMessage(text, ctx);
    expect(parsed, text).not.toBeNull();
    return parsed!.declarations[0];
  };

  it("counts weeks from the start", () => {
    expect(range("reservist first two weeks of nov")).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-14",
    });
  });

  it("counts weeks from the end", () => {
    expect(range("cmi last week of dec")).toMatchObject({
      start: "2026-12-25",
      end: "2026-12-31",
    });
  });

  it("splits halves on the real month length", () => {
    expect(range("free first half of jan")).toMatchObject({
      start: "2027-01-01",
      end: "2027-01-16",
    });
  });

  it("applies the stated early/mid/late convention", () => {
    expect(range("free early nov")).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-10",
    });
    expect(range("busy end of december")).toMatchObject({
      start: "2026-12-21",
      end: "2026-12-31",
    });
  });

  it("still declines a qualifier it cannot place", () => {
    // "before the 20th" is a boundary, not a span we can name confidently.
    expect(parseAvailabilityMessage("cmi before the 20th of nov", ctx)).toBeNull();
  });

  it("leaves an unqualified month whole", () => {
    expect(range("free in november")).toMatchObject({
      start: "2026-11-01",
      end: "2026-11-30",
    });
  });
});

/**
 * "AL" is the ordinary Singaporean word for annual leave, and it is usually
 * written without the unit. Requiring "days" meant the most natural phrasings
 * were exactly the ones that failed — and the prefilter discarded most of them
 * before the grammar or the LLM ever saw them.
 */
describe("AL as annual leave", () => {
  it("reads a cap stated with the bare abbreviation", () => {
    for (const [text, expected] of [
      ["got 12 AL", 12],
      ["i have 10 AL left", 10],
      ["only 5 al left", 5],
      ["12 al", 12],
      ["still got 8 al", 8],
      ["left 4 al", 4],
      ["i have 14 annual leave", 14],
    ] as const) {
      expect(parse(text)?.maxLeaveDays, text).toBe(expected);
    }
  });

  it("reads the reversed forms", () => {
    expect(parse("AL left 6")?.maxLeaveDays).toBe(6);
    expect(parse("al balance 9")?.maxLeaveDays).toBe(9);
    expect(parse("my AL is 14 days")?.maxLeaveDays).toBe(14);
  });

  it("still reads the forms that spell out the unit", () => {
    expect(parse("only got 3 days AL left")?.maxLeaveDays).toBe(3);
    expect(parse("i got 12 days al")?.maxLeaveDays).toBe(12);
    expect(parse("AL only 5 days")?.maxLeaveDays).toBe(5);
  });

  it("treats exhausted leave as a zero cap, not an absent one", () => {
    for (const text of ["no more AL", "burnt all my AL", "my AL all used up"]) {
      expect(parse(text)?.maxLeaveDays, text).toBe(0);
    }
  });

  it("does not mistake the name Al for a leave cap", () => {
    // A bare "Al 5" is ambiguous, so the connective is required.
    expect(parse("Al 5 mins away")?.maxLeaveDays ?? null).toBeNull();
  });
});

/**
 * The engine error behind "next year dec" → all of 2027.
 *
 * The resolution chain was a `??` cascade, so whichever parser ran first won —
 * and the broadest ran first. The two readings were never rivals: "next year"
 * says which year, "dec" says where inside it. A broad match is context, not
 * an answer.
 */
describe("date references resolve by specificity, not parser order", () => {
  const wide = {
    today: "2026-08-17",
    horizonStart: "2026-08-01",
    horizonEnd: "2027-12-31",
  };
  const at = (text: string) =>
    parseAvailabilityMessage(text, wide)?.declarations[0];

  it("lets a year give its year to a month", () => {
    expect(at("next year dec im free too")).toMatchObject({
      state: "AVAILABLE",
      start: "2027-12-01",
      end: "2027-12-31",
    });
    expect(at("free next year june")).toMatchObject({
      start: "2027-06-01",
      end: "2027-06-30",
    });
  });

  it("lets a month give its month to a week", () => {
    // Previously all of September.
    expect(at("im free next month first week")).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-07",
    });
  });

  it("narrows twice over when both are stated", () => {
    expect(at("free next year first 2 weeks of dec")).toMatchObject({
      start: "2027-12-01",
      end: "2027-12-14",
    });
  });

  it("still answers with the broad period when nothing narrows it", () => {
    expect(at("free next year")).toMatchObject({
      start: "2027-01-01",
      end: "2027-12-31",
    });
    expect(at("free next month")).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("keeps chrono out of the specificity contest", () => {
    // Chrono reads "next week" as a single day, which is nested inside the
    // right week and would win by being wrong in the right direction.
    expect(at("free next week")).toMatchObject({
      start: "2026-08-24",
      end: "2026-08-30",
    });
  });

  it("keeps the stated scope when the two conflict rather than nest", () => {
    // "next week nov" is contradictory, not nested; inventing a resolution
    // would settle a conflict only the speaker can.
    const parsed = at("free next week nov");
    expect(parsed?.start.slice(0, 7)).toBe("2026-08");
  });
});
