import { describe, expect, it } from "vitest";
import { applyDestinationEdit, parseDestinationEdit } from "./destination.js";

const TODAY = "2026-08-17";
const parse = (text: string, current: string[] = ["Japan"]) =>
  parseDestinationEdit(text, TODAY, current);

describe("parseDestinationEdit — adding", () => {
  it("adds a place offered alongside the current one", () => {
    expect(parse("lets try korea too")).toEqual({ op: "ADD", destinations: ["Korea"] });
    expect(parse("can also consider taiwan")).toEqual({ op: "ADD", destinations: ["Taiwan"] });
    expect(parse("what about vietnam")).toEqual({ op: "ADD", destinations: ["Vietnam"] });
  });

  it("adds several at once", () => {
    expect(parse("lets add korea and taiwan too")).toEqual({
      op: "ADD",
      destinations: ["Korea", "Taiwan"],
    });
  });

  it("ignores adding something already on the list", () => {
    expect(parse("add japan to the list")).toBeNull();
  });
});

describe("parseDestinationEdit — replacing", () => {
  it("replaces on 'instead' and its cousins", () => {
    for (const t of ["lets go korea instead", "actually lets do korea", "change it to korea"]) {
      expect(parse(t)).toEqual({ op: "REPLACE", destinations: ["Korea"] });
    }
  });
});

describe("parseDestinationEdit — removing", () => {
  it("removes a place the trip actually has", () => {
    for (const t of ["not japan", "drop japan", "japan is out"]) {
      expect(parse(t)).toEqual({ op: "REMOVE", destinations: ["Japan"] });
    }
  });

  it("won't remove something that was never on the list", () => {
    // The guard that stops "not sure" deleting an imaginary place.
    expect(parse("not korea")).toBeNull();
    expect(parse("not sure")).toBeNull();
  });
});

describe("parseDestinationEdit — declining", () => {
  it("ignores date talk that happens to carry an edit word", () => {
    // These were the dangerous near-misses: an edit word plus a month.
    expect(parse("lets go in june instead")).toBeNull();
    expect(parse("can also do december")).toBeNull();
  });

  it("ignores availability messages", () => {
    expect(parse("cmi korea trip")).toBeNull();
    expect(parse("only got 2 days AL")).toBeNull();
  });

  it("now reads a positive assessment as a suggestion", () => {
    // Superseded deliberately: "korea looks nice" is how a destination gets
    // proposed, and treating it as chatter sent it to the LLM or nowhere.
    expect(parse("korea looks nice")).toEqual({
      op: "ADD",
      destinations: ["Korea"],
    });
  });

  it("still ignores chatter that only looks like one", () => {
    expect(parse("let's eat later")).toBeNull();
    expect(parse("the weather is fine too")).toBeNull();
  });
});

describe("applyDestinationEdit", () => {
  it("appends, replaces and removes", () => {
    expect(applyDestinationEdit(["Japan"], { op: "ADD", destinations: ["Korea"] })).toEqual(["Japan", "Korea"]);
    expect(applyDestinationEdit(["Japan"], { op: "REPLACE", destinations: ["Korea"] })).toEqual(["Korea"]);
    expect(applyDestinationEdit(["Japan", "Korea"], { op: "REMOVE", destinations: ["Japan"] })).toEqual(["Korea"]);
  });

  it("de-duplicates case-insensitively and caps the list", () => {
    expect(applyDestinationEdit(["Japan"], { op: "ADD", destinations: ["japan"] })).toEqual(["Japan"]);
    const many = applyDestinationEdit(
      ["A", "B", "C", "D", "E"],
      { op: "ADD", destinations: ["F"] },
    );
    expect(many).toHaveLength(5);
  });

  it("can empty the list, leaving the trip destination-open", () => {
    expect(applyDestinationEdit(["Japan"], { op: "REMOVE", destinations: ["Japan"] })).toEqual([]);
  });
});

/**
 * Found while testing two-message continuations: "actually only the last 2
 * weeks" carries the replace word "actually", and its leftovers became a
 * destination called **Only** — which, being a REPLACE, wiped the group's
 * actual choices. Replace is the destructive op and had the loosest check.
 */
describe("replace is vetted like everything else", () => {
  const parse = (text: string, current: string[] = ["Japan"]) =>
    parseDestinationEdit(text, "2026-08-17", current);

  it("does not invent a destination from a qualifier", () => {
    expect(parse("actually only the last 2 weeks")).toBeNull();
    expect(parse("actually nvm")).toBeNull();
    expect(parse("actually i think not")).toBeNull();
  });

  it("still replaces when a real place is named", () => {
    expect(parse("let's go Korea instead")).toMatchObject({ op: "REPLACE" });
    expect(parse("change it to Taiwan")).toMatchObject({ op: "REPLACE" });
    expect(parse("actually lets do Bali")).toMatchObject({ op: "REPLACE" });
  });
});

/**
 * Founder-reported, reversing an earlier decision.
 *
 * The old rule read "drop Japan" as a decision about the plan and "I don't want
 * Japan" as merely one person's view, recording the second only as a note — so
 * the card kept offering a destination somebody had plainly rejected.
 *
 * The safety that mattered is kept elsewhere: removal is destructive, so a
 * non-organiser still gets a confirm button rather than silently editing the
 * group's plan, and the objection is recorded as a note either way.
 */
describe("a first-person objection removes the place", () => {
  const parse = (text: string) =>
    parseDestinationEdit(text, "2026-08-17", ["Japan", "Korea"]);

  it("removes what the speaker rejected", () => {
    for (const text of [
      "Idw to go japan alr",
      "I dont want Japan anymore",
      "i don't want japan",
      "idw japan",
      "japan no more",
      "im sick of japan",
    ]) {
      expect(parse(text), text).toEqual({
        op: "REMOVE",
        destinations: ["Japan"],
      });
    }
  });

  it("removes the place actually named, not the first on the list", () => {
    expect(parse("i just went korea, idw go again")).toEqual({
      op: "REMOVE",
      destinations: ["Korea"],
    });
  });

  it("removes nothing when no place is named", () => {
    // An objection to the trip in general is a note, not an edit.
    expect(parse("idw go again")).toBeNull();
    expect(parse("i dont want to go so early")).toBeNull();
    expect(parse("actually nvm")).toBeNull();
  });
});
