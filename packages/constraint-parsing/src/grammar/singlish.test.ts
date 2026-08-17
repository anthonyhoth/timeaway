import { describe, expect, it } from "vitest";
import { parseAvailabilityMessage } from "./availability.js";

const ctx = {
  today: "2026-08-17" as const,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};
const state = (text: string) =>
  parseAvailabilityMessage(text, ctx)?.declarations[0]?.state ?? null;

/**
 * Singapore English carries in particles what spoken English carries in
 * intonation, and the assertive and interrogative sets are invisible to a
 * matcher that only sees the word "can".
 *
 * "Can lah" asserts. "Can meh" challenges the very possibility. Both were being
 * recorded as the speaker declaring themselves free.
 */
describe("interrogative particles are questions, not declarations", () => {
  it("declines a question about a date", () => {
    for (const text of [
      "dec can meh",
      "dec can meh?",
      "dec can or not",
      "dec can bo",
      "dec can ah?",
      "dec can hor",
      "dec izzit",
      "everyone ok with dec?",
    ]) {
      expect(state(text), text).toBeNull();
    }
  });

  it("does not invert a challenge into agreement with it", () => {
    // "Nov cannot meh" argues that November *is* possible. It was being
    // recorded as the speaker blocking November out.
    expect(state("nov cannot meh")).toBeNull();
  });

  it("still hears the assertive particles", () => {
    // lah asserts, lor concedes, leh softens, one emphasises — all statements.
    expect(state("nov cannot lah")).toBe("UNAVAILABLE");
    expect(state("nov cannot lor")).toBe("UNAVAILABLE");
    expect(state("dec can lah")).toBe("AVAILABLE");
    expect(state("dec can leh")).toBe("AVAILABLE");
    expect(state("dec can one")).toBe("AVAILABLE");
  });
});

describe("agreement in Singapore English is short and often verbless", () => {
  it("reads the colloquial yeses", () => {
    for (const text of [
      "i think dec can",
      "dec steady",
      "dec on lah",
      "dec okok",
      "dec fine lah",
      "dec chill",
      "dec confirm can",
      "im on for dec",
    ]) {
      expect(state(text), text).toBe("AVAILABLE");
    }
  });

  it("reads Hokkien-derived negation", () => {
    for (const text of [
      "nov cannot lah",
      "nov buay",
      "nov bo eng",
      "nov jialat",
      "nov buay tahan",
      "paiseh nov cannot",
    ]) {
      expect(state(text), text).toBe("UNAVAILABLE");
    }
  });

  it("does not mistake the preposition 'on' for agreement", () => {
    // "on lah" agrees; "on 5 dec" is a date. Only a trailing "on" is a verb.
    expect(state("cmi on 5 dec")).toBe("UNAVAILABLE");
    expect(state("cannot on 20 nov")).toBe("UNAVAILABLE");
  });
});

/**
 * A hedge is an agreement with the commitment removed. Recording it as a firm
 * yes is how a group ends up with a date half of them never agreed to — the
 * failure mode the research turned up repeatedly.
 */
describe("hedged agreement is MAYBE, not yes", () => {
  it("keeps the signal without letting it count as a commitment", () => {
    for (const text of [
      "dec should be can",
      "dec probably can",
      "dec most likely can",
      "dec will try",
    ]) {
      expect(state(text), text).toBe("MAYBE");
    }
  });

  it("leaves an unhedged yes alone", () => {
    expect(state("dec can")).toBe("AVAILABLE");
    expect(state("dec confirm can")).toBe("AVAILABLE");
  });

  it("still declines what is not an answer at all", () => {
    expect(state("dec see how first")).toBeNull();
    expect(state("dec depends")).toBeNull();
    expect(state("dec if can")).toBeNull();
  });
});
