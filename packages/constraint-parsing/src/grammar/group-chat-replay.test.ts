import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";
import { joinUtterances, looksLikeContinuation } from "./continuation.js";
import { parseDestinationEdit } from "./destination.js";
import { parseParticipantNote } from "./notes.js";
import { parseReversal } from "./reversal.js";
import { parseTripEdit } from "./trip-edit.js";

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const edit = (text: string, current: string[] = ["Japan"]) =>
  parseTripEdit(text, today, current, { horizonUnset: false });

/**
 * Regressions from replaying three simulated Singaporean group chats — 2, 3 and
 * 6 friends, 343 messages — through the ambient pipeline in bot.ts's own branch
 * order. Sibling to simulation.test.ts, kept separate because that file records
 * a different corpus.
 *
 * The failure that matters here is the same one it names: a confident wrong
 * answer, not a missing one. Every case below was a message about *a person*
 * that the pipeline acted on as an instruction about *the trip*.
 */
describe("a short message is not automatically a continuation", () => {
  /**
   * The worst finding of the replay. looksLikeContinuation accepted any message
   * of eight words or fewer, so once someone stated a date every subsequent
   * thing they typed was glued to it and re-parsed — and tryContinuation
   * deletes the previous declarations before writing the merged reading, so
   * each fragment silently rewrote what they said.
   *
   * CONTINUATION_MARKER already existed for exactly this, and nothing called it.
   */
  it("does not treat unrelated chatter as a fragment", () => {
    for (const text of [
      "porridge or fishball",
      "OH YA how",
      "eh ya ur bto! how",
      "ya feb is aunties n pineapple tarts",
      "ok so where we going",
      "hahaha ok fair",
      "wfh",
      "cheap",
    ]) {
      expect(looksLikeContinuation(text), text).toBe(false);
    }
  });

  /**
   * The tightening above cost this one on its first attempt, which is the risk
   * it carries: a hedge is not content, and treating "i think" as content left
   * Haziq's whole month blocked instead of the fortnight he was narrowing it
   * to. Kept as the counterweight — the gate has to stay narrow *and* let a
   * real fragment through.
   */
  it("still narrows a block when the fragment names the exact dates", () => {
    const previous = "march got ICT";
    const fragment = "9-20 march i think";
    expect(looksLikeContinuation(fragment)).toBe(true);
    expect(parseAvailabilityMessage(previous, ctx)?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2027-03-01", end: "2027-03-31" },
    ]);
    expect(
      parseAvailabilityMessage(joinUtterances(previous, fragment), ctx)
        ?.declarations,
    ).toEqual([{ state: "UNAVAILABLE", start: "2027-03-09", end: "2027-03-20" }]);
  });

  it("still recognises the qualifier it was built for", () => {
    for (const text of [
      "but only the first half",
      "and the week after",
      "or dec",
      "actually only the 20th onwards",
      "though not the first week",
      "maybe just the weekend",
    ]) {
      expect(looksLikeContinuation(text), text).toBe(true);
    }
  });

  it("never lets an aside invert a stated availability", () => {
    const previous = "sorry sorry. nov for me can";
    expect(parseAvailabilityMessage(previous, ctx)?.declarations).toEqual([
      { state: "AVAILABLE", start: "2026-11-01", end: "2026-11-30" },
    ]);
    // "eh ya ur bto! how" flipped this to UNAVAILABLE for the whole month.
    expect(looksLikeContinuation("eh ya ur bto! how")).toBe(false);
  });

  /**
   * Joining these produced UNAVAILABLE 2027-03-01 → 2028-02-29: a month of
   * leave widened into a full year. The year-wrap itself is correct — a range
   * whose end month precedes its start is meant to wrap, which is how "Nov–Feb"
   * works — so the defect was never the parse. It was that the join happened.
   */
  it("does not join a second month mentioned for another reason", () => {
    const previous = "eh no. i got reservist in march";
    const aside = "ya feb is aunties n pineapple tarts";

    expect(looksLikeContinuation(aside)).toBe(false);

    // The reading it would have produced, kept here to show what is avoided.
    const joined = joinUtterances(previous, aside);
    expect(parseAvailabilityMessage(joined, ctx)?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2027-03-01", end: "2028-02-29" },
    ]);
    expect(parseAvailabilityMessage(previous, ctx)?.declarations).toEqual([
      { state: "UNAVAILABLE", start: "2027-03-01", end: "2027-03-31" },
    ]);
  });
});

describe("naming a month to reject it does not select it", () => {
  /**
   * simulation.test.ts already guards "nov too rainy" and "nov too crowded".
   * The replay found the same failure under a different vocabulary — out, dead,
   * die, not — which none of those patterns cover.
   */
  it("ignores a month that is being ruled out", () => {
    for (const text of [
      "so nov out?",
      "n cny is feb so feb also dead",
      "then feb also die, family thing that whole week",
      "if korea in feb its snow season also",
    ]) {
      expect(edit(text), text).toBeNull();
    }
  });

  it("does not take the rejected half of a rejection plus a proposal", () => {
    // Read as November — the month being ruled out — and December, the month
    // actually proposed, was discarded.
    const result = edit("ok so not nov. dec?");
    if (result?.horizon) {
      expect(result.horizon.start).not.toMatch(/^2026-11/);
    }
  });
});

describe("a constraint belongs to whoever owns it", () => {
  /**
   * The availability path refuses third-party relays outright — identity
   * resolution does not exist yet. parseTripEdit had no equivalent guard, so
   * the same sentence routed around the refusal and reshaped the trip.
   */
  it("does not let someone else's constraint become the group's window", () => {
    const text =
      "oh btw sheryl asked if she can join, she says she can only do school hols cos shes teaching now";
    expect(parseAvailabilityMessage(text, ctx)).toBeNull();
    expect(edit(text)).toBeNull();
  });

  /**
   * A personal ceiling belongs on the participant as maxLeaveDays, which
   * already exists on ExtractionResult. It was landing on the trip as a
   * duration binding every traveller.
   */
  it("does not turn one person's leave cap into the trip length", () => {
    expect(
      edit("enough but i can only take 5 days max at one go, my mgr very anal about it"),
    ).toBeNull();
  });

  it("does not read an aside about weekends as a trip duration", () => {
    // Carried no intent about trip length at all, and capped the trip at three
    // days.
    expect(edit("1 day is weekend what")).toBeNull();
  });
});

describe("correcting yourself is not steering the trip", () => {
  const text = "eh scratch my march thing, dates confirm already. its 2-13 not 9-20";

  it("hears the retraction", () => {
    // Bare "scratch that" was handled; the qualified form was not.
    expect(parseReversal(text)).not.toBeNull();
  });

  it("does not point the trip at the month being corrected", () => {
    expect(edit(text)).toBeNull();
  });

  it("reads an open-ended bound as open-ended", () => {
    // Yielded a horizon of 2027-03-13 … 2027-03-13 — a single day.
    const result = edit("so after 13 march can lor");
    if (result?.horizon) {
      expect(result.horizon.end).not.toBe(result.horizon.start);
    }
  });
});

describe("an opinion is only recorded when there is one", () => {
  /**
   * parseParticipantNote claimed any sentence pairing a number with a
   * money-adjacent word, and inverted the sentiment of at least one phrasing.
   * The prefilter was suppressing several of these by accident, which meant the
   * gate was compensating for the parser rather than the parser being right.
   */
  it("does not record enthusiasm as an objection", () => {
    const note = parseParticipantNote(
      "i dun mind going again actually, bali damn relaxing",
    );
    expect(note?.kind).not.toBe("DESTINATION_OBJECTION");
  });

  it("ignores money words that are not about the trip", () => {
    for (const text of [
      "no they broke up in may",
      "ya 30k this sat, im dying",
      "dont ask. quoted me 68k, i almost fainted",
      "airbnb cheaper if 6 pax",
      "u want cheap flight or not",
      "cheap",
    ]) {
      expect(parseParticipantNote(text), text).toBeNull();
    }
  });

  it("still hears a real budget statement", () => {
    for (const text of [
      "japan too ex lah",
      "1.5k max for me sia, im broke",
      "i can only spend around 1k",
      "too ex for me",
    ]) {
      expect(parseParticipantNote(text)?.kind, text).toBe("BUDGET");
    }
  });
});

describe("destinations come from sentences that name one", () => {
  it("does not invent a destination from a stray capitalised word", () => {
    // From a story about a date splitting a bill: ADD destination "CENT".
    expect(parseDestinationEdit("to the CENT??", today, ["Japan"])).toBeNull();
  });

  it("keeps every option in a list, or claims none of it", () => {
    // Added Taiwan and Da Nang and silently dropped Korea.
    const result = parseDestinationEdit(
      "ok voting. taiwan / da nang / korea. pick one",
      today,
      ["Japan"],
    );
    if (result) {
      expect(result.destinations).toContain("Korea");
    }
  });
});
