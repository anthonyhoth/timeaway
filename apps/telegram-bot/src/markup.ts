/**
 * Telegram formatting for the trip card.
 *
 * The card is re-sent and re-edited constantly, so it is the one message worth
 * fitting to a phone deliberately. Measured on an iPhone 14 Pro (393pt) at
 * Telegram's default text size, which renders body text at 17pt, an incoming
 * bubble holds roughly **34 proportional characters** per line.
 *
 * **Monospace was tried and rejected.** Telegram has no table markup, so
 * columns can only be faked with a padded `<pre>` block — and iOS renders those
 * in a noticeably smaller face inside a narrower bubble. The alignment gained
 * was not worth the text getting harder to read, which was the complaint the
 * formatting was meant to fix. Proportional text also *wraps* rather than
 * scrolling sideways, so a long line degrades instead of breaking.
 *
 * HTML is used rather than MarkdownV2: it reserves three characters instead of
 * eighteen, and every name and note on this card is user-supplied.
 */

/** Escape user-supplied text. HTML mode only reserves these three. */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const bold = (text: string) => `<b>${text}</b>`;

/**
 * Collapsible detail, for the parts of the card that grow without bound —
 * notes, opinions — so a long-running trip does not push the options off the
 * screen.
 */
export function collapsible(title: string, lines: readonly string[]): string {
  return `<blockquote expandable>${title}\n${lines.join("\n")}</blockquote>`;
}
