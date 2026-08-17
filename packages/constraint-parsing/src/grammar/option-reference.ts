/**
 * Picking one of the options already on screen: "the middle one", "the second
 * one", "option 2", "the last one", "2".
 *
 * The card offers buttons, but people answer a numbered list the way they would
 * answer a person — and every one of these phrasings was being dropped by the
 * stage-1 gate as ordinary chatter, so nothing ever saw them.
 *
 * The count matters, which is why it is a parameter rather than a constant:
 * "the middle one" is only meaningful for an odd number of options, and "3" is
 * only a choice when there are at least three. Anything outside the list is
 * declined rather than clamped — someone saying "5" to a three-item list has
 * misread it, and quietly selecting the last one would be a wrong answer
 * dressed as a right one.
 */
export interface OptionReference {
  /** Zero-based index into the options as presented. */
  index: number;
}

const WORD_ORDINALS: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  fifth: 5,
  "5th": 5,
};

/**
 * Deliberately narrow. This runs ahead of the general gate, so a loose pattern
 * here would quietly become a way for ordinary conversation to be read and
 * stored — exactly what "reads ≠ stores" is there to prevent.
 */
/** Ways of prefacing a choice, shared by both shapes. */
const PREFIX =
  "(?:let'?s (?:do|go (?:with|for)|take)\\s+|i'?ll take\\s+|i (?:pick|choose|vote for)\\s+|go (?:with|for)\\s+)?";
const SUFFIX = "(?:\\s*(?:please|then|lah|leh|lor|ah|sia))?[.!]?";

const NUMBERED = new RegExp(
  `^${PREFIX}(?:the\\s+)?(?:option|opt|no\\.?|number|#)?\\s*(\\d{1,2})(?:\\s+one)?${SUFFIX}$`,
  "i",
);

const NAMED = new RegExp(
  `^${PREFIX}(?:the\\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|middle|last|final)(?:\\s+one)?${SUFFIX}$`,
  "i",
);

export function parseOptionReference(
  rawText: string,
  optionCount: number,
): OptionReference | null {
  const text = rawText.trim();
  if (!text || optionCount < 2) return null;

  const numbered = NUMBERED.exec(text);
  if (numbered) return within(Number(numbered[1]), optionCount);

  const named = NAMED.exec(text);
  if (!named) return null;

  const word = named[1]!.toLowerCase();
  if (word === "last" || word === "final") return within(optionCount, optionCount);
  if (word === "middle") {
    // With an even number there is no middle, and picking either neighbour
    // would be a guess about somebody's dates.
    if (optionCount % 2 === 0) return null;
    return within((optionCount + 1) / 2, optionCount);
  }
  return within(WORD_ORDINALS[word] ?? 0, optionCount);
}

function within(position: number, optionCount: number): OptionReference | null {
  if (!Number.isInteger(position) || position < 1 || position > optionCount) {
    return null;
  }
  return { index: position - 1 };
}
