/**
 * Withdrawing from, or rejoining, the trip itself.
 *
 * The distinction that matters: **"I can't do October" is about dates, "count
 * me out" is about the trip.** Someone in a group chat may simply not be
 * travelling, and treating that as a date constraint would let one
 * non-traveller drag every window down — or worse, block them.
 *
 * The separator is a date reference. "Count me out for November" narrows to a
 * period and is availability; "count me out" with no date is a withdrawal.
 * Callers must therefore run availability parsing first.
 */
export type ParticipationChange = "OUT" | "IN";

export const OUT_WORDS =
  /\b(?:count me out|leave me out|without me|not joining|won'?t join|can'?t join|cannot join|not going|not coming|sit(?:ting)? (?:this|it) (?:one )?out|skip(?:ping)? (?:this|it)(?: one)?|i'?m out|im out|go ahead without|you (?:all|guys) go|not for me|opt(?:ing)? out)\b/i;

/**
 * "I'm in" must stand alone. Followed by anything it is usually the opposite —
 * "I'm in a meeting", "I'm in camp", "I'm in office" — and those were being
 * recorded as joining the trip. A bare "I'm in" ends the message, optionally
 * with a particle or an exclamation.
 */
export const IN_WORDS =
  /\b(?:count me in|i'?m joining|im joining|i'?m coming|im coming|put me back|rejoin(?:ing)?|i'?m back in|im back in)\b|\b(?:i'?m|im)\s+in(?=\s*(?:[!.]+|lah|leh|lor|sia|liao|too|also|already)?\s*$)/i;

/** Anything naming a period is about availability, not participation. */
const HAS_DATE_HINT =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend|month|year|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\b/i;

export function parseParticipationChange(
  rawText: string,
): ParticipationChange | null {
  const text = rawText.trim();
  if (!text) return null;

  // "Out in November" is a date constraint; "out" alone is leaving the trip.
  if (HAS_DATE_HINT.test(text)) return null;

  // Rejoining is checked first: "actually I'm in" contains no out-words, but
  // "I'm not out anymore" would trip both, and the later statement wins.
  if (IN_WORDS.test(text)) return "IN";
  if (OUT_WORDS.test(text)) return "OUT";
  return null;
}
