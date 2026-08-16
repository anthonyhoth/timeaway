import { describe, expect, it } from "vitest";
import { isButtonSafeUrl } from "./bot.js";

/**
 * Telegram rejects the entire message when an inline button URL is invalid,
 * not just the button — a localhost base URL silently swallowed the whole
 * "Trip set up" confirmation in live testing.
 */
describe("isButtonSafeUrl", () => {
  it("accepts real public URLs", () => {
    expect(isButtonSafeUrl("https://timeaway.sg/t/abc123")).toBe(true);
    expect(isButtonSafeUrl("https://t.me/TimeawayBot?startgroup=trip_x")).toBe(true);
    expect(isButtonSafeUrl("http://example.com/path")).toBe(true);
  });

  it("rejects local hosts, which is what broke it", () => {
    expect(isButtonSafeUrl("http://localhost:3000/t/abc123")).toBe(false);
    expect(isButtonSafeUrl("http://127.0.0.1:3000/t/abc")).toBe(false);
    expect(isButtonSafeUrl("http://0.0.0.0:3000/")).toBe(false);
  });

  it("rejects hosts with no dot, which Telegram will not resolve", () => {
    expect(isButtonSafeUrl("https://intranet/t/abc")).toBe(false);
  });

  it("rejects non-http schemes and malformed input", () => {
    expect(isButtonSafeUrl("ftp://example.com/x")).toBe(false);
    expect(isButtonSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isButtonSafeUrl("not a url")).toBe(false);
    expect(isButtonSafeUrl("")).toBe(false);
  });
});
