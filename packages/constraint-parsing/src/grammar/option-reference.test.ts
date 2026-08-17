import { describe, expect, it } from "vitest";
import { parseOptionReference } from "./option-reference.js";

const pick = (text: string, count = 3) => parseOptionReference(text, count);

describe("parseOptionReference", () => {
  it("reads the phrasings people actually use on a numbered list", () => {
    for (const [text, index] of [
      ["the middle one", 1],
      ["the first one", 0],
      ["the second one", 1],
      ["the last one", 2],
      ["option 2", 1],
      ["no. 3", 2],
      ["#1", 0],
      ["2", 1],
      ["let's do the last one", 2],
      ["i'll take 2", 1],
      ["3 lah", 2],
    ] as const) {
      expect(pick(text)?.index, text).toBe(index);
    }
  });

  it("has no middle to pick when the count is even", () => {
    // Choosing either neighbour would be a guess about somebody's dates.
    expect(pick("the middle one", 4)).toBeNull();
    expect(pick("the middle one", 5)?.index).toBe(2);
  });

  it("declines a number outside the list rather than clamping it", () => {
    // "5" against three options is a misread, and quietly selecting the last
    // would be a wrong answer dressed as a right one.
    expect(pick("5", 3)).toBeNull();
    expect(pick("option 4", 3)).toBeNull();
    expect(pick("0", 3)).toBeNull();
  });

  it("stays clear of ordinary conversation", () => {
    // This runs ahead of the privacy gate, so it must not become a way for
    // chatter to be read and stored.
    for (const text of [
      "2 weeks in nov",
      "i can do 2",
      "first week of dec",
      "the middle of november",
      "sounds good",
      "2 days leave",
      "last time we went there",
    ]) {
      expect(pick(text), text).toBeNull();
    }
  });

  it("does nothing when there is no list to choose from", () => {
    expect(parseOptionReference("the middle one", 1)).toBeNull();
    expect(parseOptionReference("2", 0)).toBeNull();
  });
});
