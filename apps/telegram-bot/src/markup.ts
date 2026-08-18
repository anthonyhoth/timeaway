/**
 * Telegram formatting, sized for a phone.
 *
 * The trip card is re-sent and re-edited constantly, so it is the one message
 * worth fitting to the screen precisely. Measured against an iPhone 14 Pro
 * (393pt wide) at Telegram's default text size, which renders body text at
 * 17pt:
 *
 *   incoming bubble content   ~283pt
 *   proportional (SF Pro)     ~34 characters
 *   monospace   (SF Mono)     ~28 characters
 *
 * The monospace figure is the binding one, because a `<pre>` block **does not
 * wrap** — it scrolls sideways. A table one character too wide is worse than no
 * table at all, so everything built here is held to 26 columns.
 *
 * **Telegram has no table markup.** Columns exist only as padded monospace, and
 * that is the whole reason the width budget above has to be respected rather
 * than estimated.
 *
 * HTML is used rather than MarkdownV2: it needs three characters escaped
 * instead of eighteen, and every name and note on this card is user-supplied.
 */

/** The widest a monospace row may be before Telegram scrolls it sideways. */
export const MONO_COLUMNS = 26;

/** Escape user-supplied text. HTML mode only reserves these three. */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const bold = (text: string) => `<b>${text}</b>`;

/**
 * A fixed-width block. Content is escaped here rather than by the caller, so a
 * name containing "<" cannot break the message — Telegram rejects malformed
 * HTML outright, and the group would see nothing at all.
 */
export function mono(rows: readonly string[]): string {
  return `<pre>${esc(rows.join("\n"))}</pre>`;
}

/**
 * Collapsible detail. Used for the parts of the card that grow without bound —
 * notes, warnings — so a long-running trip does not push the options off the
 * screen.
 */
export function collapsible(title: string, lines: readonly string[]): string {
  return `<blockquote expandable>${title}\n${lines.join("\n")}</blockquote>`;
}

/** Pad to a column width, truncating rather than overflowing the row. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width, " ");
}

/** Right-align, so day numbers line up under each other. */
export function padStart(text: string, width: number): string {
  return text.padStart(width, " ");
}
