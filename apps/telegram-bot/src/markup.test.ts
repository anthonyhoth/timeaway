import { describe, expect, it } from "vitest";
import { collapsible, esc, MONO_COLUMNS, mono } from "./markup.js";

/**
 * The trip card is re-sent and re-edited constantly, so it is the one message
 * worth fitting to the screen exactly. Measured on an iPhone 14 Pro (393pt) at
 * Telegram's default text size: ~34 proportional characters per line, ~28
 * monospace.
 *
 * Monospace is the binding constraint, because a `<pre>` block does **not
 * wrap** — it scrolls sideways. One character too wide and the whole option
 * list has to be dragged, which is worse than having no columns at all.
 */
describe("markup sized for a phone", () => {
  it("holds the monospace budget under what the screen fits", () => {
    expect(MONO_COLUMNS).toBeLessThanOrEqual(28);
  });

  /**
   * Names and notes are user-supplied, and Telegram rejects malformed HTML
   * outright — so an unescaped angle bracket does not garble the card, it makes
   * the message fail to send and the group sees nothing at all.
   */
  it("escapes what users typed", () => {
    expect(esc("Mei & <friends>")).toBe("Mei &amp; &lt;friends&gt;");
    expect(esc("a > b & c < d")).toBe("a &gt; b &amp; c &lt; d");
  });

  it("escapes inside a monospace block too", () => {
    expect(mono(["<b>"])).toBe("<pre>&lt;b&gt;</pre>");
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
