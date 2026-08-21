import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { rejectsNamedPeriod, statesThirdPartyConstraint } from "./stance.js";
import { parseTripEdit } from "./trip-edit.js";

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-08-21" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const edit = (text: string, current: string[] = ["Japan"]) =>
  parseTripEdit(text, today, current, { horizonUnset: false });
const dates = (text: string) => parseAvailabilityMessage(text, ctx)?.declarations;

/**
 * Whose statement is this, and is it a claim at all?
 *
 * A second replay — four fresh group chats, 406 messages — found the first
 * sweep's rejection fix holding in `parseTripEdit` and absent everywhere else.
 * Availability is parsed *first*, so the bug had not been fixed so much as
 * moved: instead of pointing the trip at a month the group had killed, the
 * pipeline now recorded the speaker as free during it.
 *
 * These questions are asked by three parsers and belong to none of them, which
 * is why they live in stance.ts. Every case below comes from that replay.
 */
describe("a period the group has ruled out is nobody's availability", () => {
  /**
   * A bare "ok" makes messageIntent POSITIVE, and the rejection word after it
   * was never weighed — so the month being killed was filed as free.
   */
  it("does not record a rejected month as the speaker being free", () => {
    for (const text of ["ok sept dead", "ok march out", "ok so nov out", "ok feb gone"]) {
      expect(dates(text), text).toBeUndefined();
    }
  });

  it("does not move the trip there either", () => {
    for (const text of ["ok sept dead", "ok march out", "nov out then", "so oct also dead"]) {
      expect(edit(text), text).toBeNull();
    }
  });

  /**
   * The distinction that makes this safe. "Sept dead" is the group ruling a
   * month out; "dec cannot" is one person saying they are busy. Only the first
   * is a rejection — collapsing them would silently delete real declarations,
   * which is why "cmi" and "jialat" are not rejection words even though they
   * sit beside months just as often.
   */
  it("still hears a person saying they personally cannot", () => {
    expect(dates("cny cmi family thing")).toEqual([
      { state: "UNAVAILABLE", start: "2027-02-05", end: "2027-02-20" },
    ]);
    expect(dates("feb cmi")).toEqual([
      { state: "UNAVAILABLE", start: "2027-02-01", end: "2027-02-28" },
    ]);
    expect(dates("dec cannot lah school hols, price double")).toEqual([
      { state: "UNAVAILABLE", start: "2026-12-01", end: "2026-12-31" },
    ]);
    expect(dates("cmi 12-15 dec")).toEqual([
      { state: "UNAVAILABLE", start: "2026-12-12", end: "2026-12-15" },
    ]);
  });

  it("still hears a plain yes that happens to start with ok", () => {
    expect(dates("ok i free in sept")).toEqual([
      { state: "AVAILABLE", start: "2026-09-01", end: "2026-09-30" },
    ]);
    expect(dates("ok sept can")).toEqual([
      { state: "AVAILABLE", start: "2026-09-01", end: "2026-09-30" },
    ]);
  });
});

describe("a negated date range is a rejection too", () => {
  /**
   * The first sweep matched "not" or "no" against a *month*. A negated range
   * puts the month after the numbers, so it never matched — and the trip was
   * pointed at precisely the week the speaker was in camp.
   */
  it("does not move the trip onto a range that was just ruled out", () => {
    for (const text of [
      "but not 3-9 nov",
      "not 12-15 dec",
      "no 3-9 nov",
      "not 3/9-9/9",
    ]) {
      expect(edit(text), text).toBeNull();
    }
  });

  it("recognises the shape directly", () => {
    expect(rejectsNamedPeriod("but not 3-9 nov")).toBe(true);
    expect(rejectsNamedPeriod("ok sept dead")).toBe(true);
    expect(rejectsNamedPeriod("nov out then")).toBe(true);
  });

  it("leaves a genuine proposal of the same dates alone", () => {
    // The veto must not swallow the ordinary way a range gets suggested.
    expect(edit("how about 3-9 nov")).not.toBeNull();
    expect(edit("lets do 12-15 dec")).not.toBeNull();
    expect(rejectsNamedPeriod("how about 3-9 nov")).toBe(false);
    expect(rejectsNamedPeriod("dec cannot lah")).toBe(false);
  });
});

describe("someone else's dates are not the group's dates", () => {
  /**
   * The first sweep caught the reporting form — "sarah says she can only do
   * school hols". It missed the possessive, and its verb list had no "got", so
   * a partner's exam date became a one-day trip window.
   */
  it("recognises a partner or colleague being spoken for", () => {
    for (const text of [
      "my gf can only do weekends, and she got paper 12 sept",
      "my bf cannot in june",
      "my colleague can only do school hols",
      "sarah says she can only do school hols",
      "ryan says he cannot in oct",
    ]) {
      expect(statesThirdPartyConstraint(text), text).toBe(true);
    }
  });

  it("does not let them reshape the trip", () => {
    expect(edit("my gf can only do weekends, and she got paper 12 sept")).toBeNull();
  });

  /**
   * The line is drawn at *whose constraint it is*, not at whether another
   * person is mentioned. "My sister getting married in june" is the speaker's
   * own blocker — they have to attend — and vetoing it would throw away a real
   * declaration. Family are the common case for that, which is why they are
   * not in the possessive list.
   */
  it("still hears the speaker's own obligation to someone else", () => {
    for (const text of [
      "my sister getting married in june",
      "my mom operation in feb, i need to be around",
      "my mom bday on the 5th",
      "i can only do weekends",
    ]) {
      expect(statesThirdPartyConstraint(text), text).toBe(false);
    }
  });
});
