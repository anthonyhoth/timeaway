import { describe, expect, it } from "vitest";
import { formatMoney, parseBudget } from "./budget.js";

/**
 * A note keeps someone's words, which cannot be compared. "Under $800" and
 * "$700 damn ex" are the same kind of fact said two ways, and a group needs to
 * see the tightest of them rather than a list of quotations.
 */
describe("parseBudget", () => {
  it("reads a stated ceiling", () => {
    expect(parseBudget("I only want to spend $500 on flights")).toEqual({
      amount: 500,
      limit: true,
    });
    expect(parseBudget("budget tight, under $800")).toEqual({
      amount: 800,
      limit: true,
    });
    expect(parseBudget("max $1,200")).toEqual({ amount: 1200, limit: true });
  });

  /**
   * A price called too high implies a ceiling *below* it, and is not one.
   * Reading "$700 damn ex" as a $700 budget would be generous in exactly the
   * wrong direction.
   */
  it("keeps a complaint distinct from a limit", () => {
    expect(parseBudget("$700 damn ex sia")).toEqual({
      amount: 700,
      limit: false,
    });
    expect(parseBudget("$900 too expensive")).toEqual({
      amount: 900,
      limit: false,
    });
  });

  it("expands the shorthand people actually type", () => {
    expect(parseBudget("i can only spend around 1k")?.amount).toBe(1000);
    expect(parseBudget("under 1500")?.amount).toBe(1500);
  });

  it("does not read a number as money without a reason to", () => {
    // Days, leave and dates are all bare numbers in this chat.
    for (const text of ["5 days leave", "20-25 nov", "got 12 al", "japan is nice"]) {
      expect(parseBudget(text), text).toBeNull();
    }
  });

  it("ignores figures too small or large to be a trip budget", () => {
    expect(parseBudget("under 5")).toBeNull();
    expect(parseBudget("under 500000")).toBeNull();
  });

  it("writes money back the way it was meant", () => {
    expect(formatMoney(500)).toBe("$500");
    expect(formatMoney(1200)).toBe("$1,200");
  });
});
