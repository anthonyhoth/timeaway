import { describe, expect, it } from "vitest";
import { classifyMembership } from "./membership.js";

/**
 * The live failure: the bot was re-added and greeted nobody. The handler tested
 * `status === "member"` alone, so being added as an administrator — routine in
 * supergroups — matched nothing and produced silence with no error.
 */
describe("classifyMembership", () => {
  it("counts being added as an administrator as joining", () => {
    expect(classifyMembership("left", "administrator")).toBe("joined");
    expect(classifyMembership("kicked", "administrator")).toBe("joined");
  });

  it("counts an ordinary add as joining", () => {
    expect(classifyMembership("left", "member")).toBe("joined");
  });

  it("counts removal as leaving, however it happened", () => {
    expect(classifyMembership("member", "left")).toBe("left");
    expect(classifyMembership("administrator", "kicked")).toBe("left");
    expect(classifyMembership("creator", "left")).toBe("left");
  });

  it("reads a restricted member by whether they are still in the chat", () => {
    // "restricted" alone says nothing about presence.
    expect(
      classifyMembership("left", "restricted", { isMember: true }),
    ).toBe("joined");
    expect(
      classifyMembership("member", "restricted", { isMember: false }),
    ).toBe("left");
  });

  it("does not treat a promotion as a join", () => {
    // Already present; greeting again would be noise.
    expect(classifyMembership("member", "administrator")).toBe("other");
    expect(classifyMembership("administrator", "member")).toBe("other");
  });

  it("always classifies, even for a status we do not know", () => {
    // "other" is a real answer that gets logged; an unmatched condition is not.
    expect(classifyMembership("member", "something_new")).toBe("left");
    expect(classifyMembership("something_new", "member")).toBe("joined");
    expect(classifyMembership("what", "eh")).toBe("other");
  });
});
