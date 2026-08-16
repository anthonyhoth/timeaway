import { describe, expect, it } from "vitest";
import { firstNameOf, isValidEmail } from "./public-view.js";

describe("firstNameOf — the public privacy boundary", () => {
  it("keeps only the given name", () => {
    expect(firstNameOf("Anthony Ho")).toBe("Anthony");
    expect(firstNameOf("Mei Ling Tan")).toBe("Mei");
  });

  it("passes single names through", () => {
    expect(firstNameOf("Farah")).toBe("Farah");
  });

  it("never returns an empty label", () => {
    expect(firstNameOf("")).toBe("Someone");
    expect(firstNameOf("   ")).toBe("Someone");
  });

  it("tolerates messy whitespace rather than leaking the remainder", () => {
    expect(firstNameOf("  Daniel   Wong  ")).toBe("Daniel");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("someone@example.com")).toBe(true);
    expect(isValidEmail("a.b+tag@sub.domain.sg")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("no@domain")).toBe(false);
    expect(isValidEmail("spaces in@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects absurdly long addresses", () => {
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});
