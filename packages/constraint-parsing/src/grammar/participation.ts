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

const OUT =
  /\b(?:count me out|leave me out|without me|not joining|won'?t join|can'?t join|cannot join|not going|not coming|sit(?:ting)? (?:this|it) (?:one )?out|skip(?:ping)? (?:this|it)(?: one)?|i'?m out|im out|go ahead without|you (?:all|guys) go|not for me|opt(?:ing)? out)\b/i;

const IN =
  /\b(?:count me in|i'?m in|im in|i'?m joining|im joining|i'?m coming|im coming|put me back|rejoin(?:ing)?|actually i'?m in)\b/i;

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
  if (IN.test(text)) return "IN";
  if (OUT.test(text)) return "OUT";
  return null;
}
