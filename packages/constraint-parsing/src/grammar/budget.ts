/**
 * What someone is willing to spend.
 *
 * The note already keeps their words verbatim, which is right for the card but
 * cannot be compared: "under $800" and "$700 damn ex" are the same kind of fact
 * expressed two ways, and a group needs to see the *tightest* of them, not a
 * list of quotations.
 *
 * Parsed from the stored text at render time rather than stored separately, so
 * there is one source of truth and no migration to keep in step.
 *
 * The distinction that matters is a **limit** from a **complaint**. "I only want
 * to spend $500" states a ceiling. "$700 damn ex sia" says a price is too high
 * — which implies a ceiling *below* it, but is not one, and recording $700 as
 * their budget would be generous in exactly the wrong direction.
 */
export interface Budget {
  /** In whole dollars; "1k" and "1.5k" are expanded. */
  amount: number;
  /** True when they stated a ceiling, false when they called a price too high. */
  limit: boolean;
}

/** "$500", "500", "1k", "1.5k", "S$500", "sgd 500". */
// The comma form is tried first and must be complete: with plain digits first
// the alternation matched "150" of "1500" and quietly cut the budget by nine
// tenths.
const AMOUNT =
  /(?:s?\$|sgd\s*)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k\b)?/i;

/** Phrases that state a ceiling. */
const LIMIT =
  /\b(?:only want to spend|only spend|only got|only have|under|below|within|at most|no more than|not more than|max(?:imum)?|budget(?:'?s)? (?:is|around|about)?|cap(?:ped)? at|keep it (?:under|below|to)|up to|spend up to|less than|cheaper than|maintain(?:ing)? under)\b/i;

/** Phrases that call a price too high — a ceiling below it, not at it. */
const COMPLAINT =
  /\b(?:too ex|damn ex|so ex|super ex|very ex|ex sia|ex lah|too expensive|expensive|pricey|too much|too pricey|cannot afford|siao (?:price|expensive)|robbery|atas)\b/i;

export function parseBudget(rawText: string): Budget | null {
  const text = rawText.trim();
  if (!text) return null;

  const match = AMOUNT.exec(text);
  if (!match) return null;

  const digits = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(digits)) return null;
  const amount = Math.round(match[2] ? digits * 1000 : digits);

  // Prices people actually argue about. Below this a number is far more likely
  // to be days, a count, or a date fragment than money.
  if (amount < 50 || amount > 100_000) return null;

  const limit = LIMIT.test(text);
  if (!limit && !COMPLAINT.test(text)) return null;
  return { amount, limit };
}

/** "$500" / "$1,200" — the way it would be written back to the group. */
export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-SG")}`;
}
