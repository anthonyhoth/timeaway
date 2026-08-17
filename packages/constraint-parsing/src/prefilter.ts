/**
 * Stage 1 of ambient triage: a free, deterministic gate that decides whether
 * a group message could plausibly contain availability information before any
 * LLM spend. Tuned for recall over precision — false positives cost a cheap
 * classifier call; false negatives silently lose a constraint. Messages that
 * fail this gate are discarded immediately and never stored (docs/DECISIONS.md
 * "reads ≠ stores").
 *
 * **Its one hard contract**: it may only reject a message no parser downstream
 * would have claimed. Anything a parser can read must reach it. That is easy to
 * break by accident — the vocabulary lives here while the capability lives in
 * the grammar — and breaking it is invisible, because the message simply
 * vanishes. It has happened three times (AL, ICT, planning aloud), so
 * prefilter.test.ts now asserts the contract directly against the parsers.
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
  // "AL" is how Singaporeans write annual leave, and it rarely appears with
  // the word "leave" beside it — "got 12 AL" was being discarded here, before
  // the grammar or the LLM ever saw it.
  /\b(?:al|annual leave)\b/i,
  /\b(?:can(?:'?t| ?not)?|cannot|cmi)\b/i,
  /\b(?:ok|okay|on\b|confirm(?:ed)?)\b/i,
  // "icct?" matched "icc" and "icct" but never "ict", so In-Camp Training —
  // which the availability grammar handles — never reached it.
  /\b(?:roster|shift|schedule|ns\b|reservist|ict|mob|manning|exam|exams)\b/i,
  /\b(?:holiday|holidays|ph\b|long weekend|school hols?)\b/i,
  /\b(?:week|weekend|weekday|next month|this month|month end)\b/i,
  /\b(?:date|dates|when|window|trip|travel|fly|flight)\b/i,
  // Planning the trip aloud — "we want to go Hainan this year end", "let's do
  // Japan". The trip-edit parser handles these, and without the vocabulary
  // here the message was discarded before it ever reached that parser.
  /\b(?:year|years|yr|eoy)\b/i,
  /\b(?:let'?s|lets|plan|planning|thinking|aiming|hoping|looking|wanna|want)\b/i,
  // Joining or sitting the trip out. Found by the contract test below: the
  // participation parser has always read "count me out", and the gate has
  // always thrown it away first.
  /\b(?:count me (?:in|out)|leave me out|without me|not joining|won'?t join|sit(?:ting)? (?:this|it) out|opt(?:ing)? out|i'?m (?:in|out)|im (?:in|out)|not going|not coming|joining)\b/i,
  // Opinions worth recording — budget above all, which is the constraint the
  // founder's research flagged as more likely to sink a trip than dates.
  /\b(?:budget|expensive|pricey|costly|afford|affordable|cheap(?:er)?|broke|money|cost|\$)\b/i,
  // Taking something back.
  /\b(?:n[ve]?vm|never ?mind|scratch that|ignore|disregard|cancel|undo|retract|any ?more|no longer|changed? (?:my )?mind|came up)\b/i,
  /\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\b/,
  /\b\d+\s*days?\b/i,
];

export function mightContainConstraint(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 1000) return false;
  return PATTERNS.some((p) => p.test(t));
}
