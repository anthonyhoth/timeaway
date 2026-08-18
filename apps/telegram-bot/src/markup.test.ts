import { describe, expect, it } from "vitest";
import { collapsible, esc } from "./markup.js";

/**
 * The card is re-sent constantly, so it is worth fitting to a phone
 * deliberately: an iPhone 14 Pro at default text size holds roughly 34
 * proportional characters per line.
 *
 * Monospace columns were tried and rejected — iOS renders `<pre>` in a smaller
 * face inside a narrower bubble, so the alignment cost exactly the readability
 * the formatting was meant to buy.
 */
describe("markup sized for a phone", () => {
  /**
   * Names and notes are user-supplied, and Telegram rejects malformed HTML
   * outright — so an unescaped angle bracket does not garble the card, it makes
   * the message fail to send and the group sees nothing at all.
   */
  it("escapes what users typed", () => {
    expect(esc("Mei & <friends>")).toBe("Mei &amp; &lt;friends&gt;");
    expect(esc("a > b & c < d")).toBe("a &gt; b &amp; c &lt; d");
  });

  it("leaves ordinary punctuation alone", () => {
    // MarkdownV2 would need eighteen characters escaped here; HTML needs none
    // of them, which is why the card uses HTML.
    expect(esc("budget tight, under $800 (max!) — 5-7 days")).toBe(
      "budget tight, under $800 (max!) — 5-7 days",
    );
  });

  it("collapses sections that grow without bound", () => {
    expect(collapsible("Noted (3)", ["a", "b", "c"])).toBe(
      "<blockquote expandable>Noted (3)\na\nb\nc</blockquote>",
    );
  });
});
