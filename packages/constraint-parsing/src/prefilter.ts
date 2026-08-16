/**
 * Stage 1 of ambient triage: a free, deterministic gate that decides whether
 * a group message could plausibly contain availability information before any
 * LLM spend. Tuned for recall over precision — false positives cost a cheap
 * classifier call; false negatives silently lose a constraint. Messages that
 * fail this gate are discarded immediately and never stored (docs/DECISIONS.md
 * "reads ≠ stores").
 */

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:${MONTHS})\\b`, "i"),
  // 4/11, 04-11, 2026-11-04, "4th", "21st"
  /\b\d{1,2}[/-]\d{1,2}\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}(?:st|nd|rd|th)\b/i,
  // availability vocabulary
  /\b(?:free|avail(?:able)?|busy|leave|off\b|offs)\b/i,
  /\b(?:can(?:'?t| ?not)?|cannot|cmi)\b/i,
  /\b(?:ok|okay|on\b|confirm(?:ed)?)\b/i,
  /\b(?:roster|shift|schedule|ns\b|reservist|icct?|exam|exams)\b/i,
  /\b(?:holiday|holidays|ph\b|long weekend|school hols?)\b/i,
  /\b(?:week|weekend|weekday|next month|this month|month end)\b/i,
  /\b(?:date|dates|when|window|trip|travel|fly|flight)\b/i,
  /\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\b/,
  /\b\d+\s*days?\b/i,
];

export function mightContainConstraint(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 1000) return false;
  return PATTERNS.some((p) => p.test(t));
}
