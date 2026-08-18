import { describe, expect, it } from "vitest";
import { mightContainConstraint } from "../prefilter.js";
import { parseDestinationEdit } from "./destination.js";
import { parseTripEdit } from "./trip-edit.js";
import { namesLikelyPlace, readProposal, stripProposalLanguage } from "./proposals.js";

const today = "2026-08-17" as const;
const add = (text: string, current: string[] = ["Japan"]) =>
  parseDestinationEdit(text, today, current);
const shape = (text: string, current: string[] = ["Japan"]) =>
  parseTripEdit(text, today, current, { horizonUnset: false });

/**
 * Proposals in talk come in a handful of formats that differ in how strongly
 * they claim the right to decide — imperative-inclusive "let's X", interrogative
 * "how about X", declarative-modal "we could X". None of them is an edit word,
 * which is why the grammar heard none of them.
 */
describe("destinations proposed the way people propose them", () => {
  it("adds on an additive assessment — the founder's case", () => {
    expect(add("Korea is fine too")).toEqual({
      op: "ADD",
      destinations: ["Korea"],
    });
  });

  it("reads the interrogative proposal formats", () => {
    for (const text of [
      "how about Taiwan",
      "what about Bali",
      "why not Vietnam",
      "shall we do Taiwan",
      "why don't we do Bali",
    ]) {
      expect(add(text)?.destinations, text).toHaveLength(1);
    }
  });

  it("reads the weaker declarative-modal formats", () => {
    // "We could" claims less authority than "let's", and is used more.
    for (const text of ["we could do Bangkok", "maybe Bali", "we can do Penang"]) {
      expect(add(text)?.destinations, text).toHaveLength(1);
    }
  });

  it("reads assessments that follow the referent", () => {
    for (const text of ["Korea sounds good", "hainan not bad", "Taiwan works"]) {
      expect(add(text)?.destinations, text).toHaveLength(1);
    }
  });

  it("reads Singapore English particles as the proposal they are", () => {
    // In speech these are intonation; in text they are the only signal.
    for (const text of ["Bali can?", "Taiwan leh", "korea also can", "Bali or not"]) {
      expect(add(text)?.destinations, text).toHaveLength(1);
    }
  });

  it("treats every proposal as an addition, never a replacement", () => {
    // A suggestion joins what is on the table; only an explicit contrastive
    // marker clears it. Adding is also the reading that discards nothing.
    expect(add("Korea is fine too")?.op).toBe("ADD");
    expect(add("how about Taiwan")?.op).toBe("ADD");
    expect(add("let's go Korea instead")?.op).toBe("REPLACE");
  });

  it("leaves the name clean", () => {
    // Stripping the frames we matched beats growing a filler list, which has
    // leaked five times.
    expect(add("Korea is fine too")?.destinations).toEqual(["Korea"]);
    expect(add("we could do Bangkok", [])?.destinations).toEqual(["Bangkok"]);
    expect(add("Taiwan leh")?.destinations).toEqual(["Taiwan"]);
  });

  it("still accepts places no list of ours holds", () => {
    // The frame identifies a place by grammar, so the gazetteer is not a gate.
    expect(add("let's do Batam", [])?.destinations).toEqual(["Batam"]);
    expect(add("how about Ipoh", [])?.destinations).toEqual(["Ipoh"]);
  });

  it("does not turn any old subject into a destination", () => {
    // A bare assessment constrains its subject not at all.
    for (const text of [
      "the weather is fine too",
      "the food sounds good",
      "that cat is cute",
      "ok lah",
      "can lah",
      "this is nice",
    ]) {
      expect(add(text), text).toBeNull();
    }
  });
});

describe("trip windows proposed the same way", () => {
  it("reads a period from every proposal format", () => {
    for (const [text, start] of [
      ["how about december", "2026-12-01"],
      ["december can?", "2026-12-01"],
      ["why not next june", "2027-06-01"],
      ["shall we do december", "2026-12-01"],
      ["maybe march", "2027-03-01"],
      ["december sounds good", "2026-12-01"],
      ["nov leh", "2026-11-01"],
      ["year end works", "2026-11-15"],
    ] as const) {
      expect(shape(text)?.horizon?.start, text).toBe(start);
    }
  });

  it("takes a place and a period from one proposal", () => {
    expect(shape("how about Taiwan in december")).toMatchObject({
      destinations: [{ op: "ADD", destinations: ["Taiwan"] }],
      horizon: { start: "2026-12-01", end: "2026-12-31" },
    });
  });

  it("still ignores chatter and personal availability", () => {
    for (const text of ["ok lah", "hahaha", "i can't do december", "that cat is cute"]) {
      expect(shape(text), text).toBeNull();
    }
  });
});

describe("the pieces", () => {
  it("strips scaffolding without eating the referent", () => {
    expect(stripProposalLanguage("Korea is fine too")).toBe("Korea");
    expect(stripProposalLanguage("how about Taiwan")).toBe("Taiwan");
    expect(stripProposalLanguage("we could do Bangkok")).toBe("Bangkok");
  });

  it("marks additives so an addition is never read as a replacement", () => {
    expect(readProposal("Korea is fine too").additive).toBe(true);
    expect(readProposal("Korea also can").additive).toBe(true);
    expect(readProposal("how about Korea").additive).toBe(false);
  });

  it("vouches for a name by recognition or by capitalisation", () => {
    expect(namesLikelyPlace("Korea", "korea is fine too")).toBe(true);
    expect(namesLikelyPlace("Weather", "the weather is fine too")).toBe(false);
    // Unknown, but capitalised deliberately mid-sentence.
    expect(namesLikelyPlace("Sekinchan", "i heard Sekinchan is nice")).toBe(true);
  });
});

/**
 * The corpus, kept as one table so coverage and over-claiming are read
 * together. Adding a phrasing to the left column without breaking the right is
 * the whole job: every phrase recognised here is one fewer LLM call, and with
 * no credits, one fewer constraint lost outright.
 *
 * The gate is checked alongside the parsers deliberately. Four times now a
 * working parser has been dead code because the prefilter discarded the
 * message first, so "does it parse" is not the question — "does it arrive and
 * parse" is.
 */
describe("colloquial proposals, end to end", () => {
  const RECOGNISED = [
    // Assessment + additive — the founder's case and its neighbours.
    "Korea is fine too", "korea also can", "korea looks nice",
    "Korea sounds good", "korea not bad",
    // Interrogative proposals.
    "how about Taiwan", "what about Bali", "why not Vietnam",
    "shall we do Taiwan", "why don't we do Bali",
    // Declarative-modal, the weakest and most common.
    "we could do Bangkok", "maybe Bali", "we can do Penang",
    // Imperative-inclusive.
    "let's do Batam", "let's go to Sekinchan",
    // Singapore English: particles carry what intonation carries in speech.
    "Bali can?", "Taiwan leh", "Bali or not", "korea can or not",
    // Explicit additions.
    "add Penang too", "include Osaka as well",
    // Stance and intention.
    "i vote Korea", "keen on Taiwan", "open to Bali", "thoughts on Korea",
    "consider Vietnam", "thinking of Japan", "looking at Korea",
    "aiming for Taiwan", "we want to go Hainan this year end",
    // The same formats, applied to dates.
    "how about december", "december can?", "why not next june",
    "year end works", "maybe march", "december sounds good", "nov leh",
    "shall we do december", "let's aim for march",
  ];

  /**
   * Every one of these carries a proposal *frame* with something that is not a
   * place or a date. They are the price of reading colloquial language, and
   * the line the grammar must hold.
   */
  const IGNORED = [
    "let's eat later", "let's watch a movie", "the weather is fine too",
    "the food sounds good", "the hotel looks nice", "that cat is cute",
    "my boss is fine with it", "ok lah", "can lah", "hahaha", "sounds good",
    "this is nice", "see you later", "who's paying",
  ];

  const reads = (text: string) =>
    parseDestinationEdit(text, today, []) !== null ||
    parseTripEdit(text, today, [], { horizonUnset: true }) !== null;

  for (const text of RECOGNISED) {
    it(`reads: ${text}`, () => {
      expect(mightContainConstraint(text), "gate discards it").toBe(true);
      expect(reads(text), "gate passes but no parser claims it").toBe(true);
    });
  }

  for (const text of IGNORED) {
    it(`ignores: ${text}`, () => {
      expect(reads(text), "claimed something it should not have").toBe(false);
    });
  }
});
