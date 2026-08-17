/**
 * How people actually put a destination or a date on the table.
 *
 * The parsers so far required an *edit* word — "instead", "make it", "push to"
 * — which is how you'd write a command, not how anyone talks. Real group
 * planning is proposal-and-assessment, and the conversation-analytic
 * literature describes its shape closely enough to encode:
 *
 *  - **Proposals** come in a small set of formats that differ in how strongly
 *    they claim the right to decide (Stevanovic & Peräkylä on deontic
 *    authority; Curl & Drew on modal vs. interrogative forms): imperative-
 *    inclusive "let's X", interrogative "how about X / shall we X / why not
 *    X", and the weakest, declarative-modal "we could X / maybe X".
 *
 *  - **Assessments** follow the referent rather than precede it, and agreement
 *    is the preferred, minimal, unmarked response (Pomerantz): "X is fine",
 *    "X sounds good", "X works", or in Singapore English simply "X can".
 *
 *  - **Additive discourse markers** — "too", "also", "as well", "or", "plus"
 *    (Schiffrin) — mark the referent as joining what is already on the table
 *    rather than replacing it. That is exactly the difference between "Korea
 *    is fine too" (add) and "Korea instead" (replace).
 *
 *  - **Singapore English particles** carry the illocutionary force that
 *    intonation carries in speech (Gupta): "leh" and "hor" solicit agreement,
 *    "meh" marks scepticism, "lah" asserts. "Can" stands alone as a predicate
 *    (Wee), so "Korea can?" is a full proposal and "can lah" a full agreement.
 *
 * The point of all this is cost: every phrasing recognised here is one fewer
 * LLM call, and — with no credits — one fewer constraint lost entirely.
 */

/**
 * Frames that precede the thing being proposed. Each one governs a noun
 * phrase, so whatever survives temporal stripping is a genuine candidate: the
 * grammar itself tells us a place was named.
 */
export const PROPOSAL_FRAME =
  /\b(?:how ?about|what ?about|whatabout|why not|why don'?t (?:we|u|you)|shall we|should we|can we|could we|we (?:could|can|should|might)|let'?s|lets|maybe|perhaps|possibly|thoughts on|what (?:do )?(?:you|u|yall|y'all) think(?: of| about)?|open to|down for|up for|keen (?:on|for)|want(?:ing)? to|wanna|would like|'?d like|hoping to|hope to|planning (?:to|on)|plan (?:to|on)|thinking (?:of|about)|looking at|aiming for|aim for|going for|shall|add|adding|include|including|throw in|chuck in|consider|considering|suggest|suggesting|propose|proposing|vote(?: for)?|voting(?: for)?|prefer|rather)\b/i;

/**
 * Assessments that follow the referent. Agreement in talk is minimal and
 * unmarked, which is why so many of these are a single word — and why they
 * cannot be trusted on their own to identify a *place*. See the plausibility
 * requirement in `namesLikelyPlace`.
 */
export const ASSESSMENT_FRAME =
  /\b(?:is|are|sounds?|looks?|seems?|feels?)\s+(?:quite\s+|damn\s+|super\s+|very\s+|pretty\s+|also\s+)?(?:fine|good|great|nice|ok(?:ay)?|cool|fun|interesting|decent|solid|alright|awesome|shiok|steady|power|not bad)\b|\b(?:works?|work for me|not bad|sounds good|can lah|can leh|can lor|can sia|can one|can ah|can\b|okay|ok\b|steady|shiok|on lah|i'?m down|im down|down for it|game|sure can)\b/i;

/**
 * Additive markers: the referent joins the list rather than replacing it.
 *
 * This is the whole of "Korea is fine too". An addition is also the *safest*
 * reading — it discards nobody's earlier suggestion — so where a message is
 * ambiguous between adding and replacing, adding wins.
 */
export const ADDITIVE_MARKER =
  /\b(?:too|also|as well|aswell|on top|plus|additionally|another option|other option|alternatively|or)\b/i;

/**
 * Interrogative particles and tags. In speech these are intonation; in text
 * they are the only signal that a bare noun is a proposal rather than a
 * mention.
 */
export const PROPOSAL_TAG =
  /\?\s*$|\b(?:leh|hor|ah|meh|or not|can or not|how|how ah|thoughts)\s*\??\s*$/i;

/**
 * A deliberately small gazetteer, used *only* to disambiguate bare assessment
 * frames like "X is fine too", where X could be anything — the weather, the
 * hotel, a person.
 *
 * It is not the destination database and is not meant to be complete: unknown
 * places still work through the proposal frames above, which identify a place
 * by grammar rather than by lookup ("let's do Batam", "how about Ipoh"). This
 * only decides whether a *bare* noun in an assessment is worth treating as a
 * destination.
 *
 * Weighted to where Singaporeans actually go.
 */
const COMMON_DESTINATIONS = new Set(
  [
    "japan", "tokyo", "osaka", "kyoto", "hokkaido", "fukuoka", "okinawa", "sapporo", "nagoya",
    "korea", "seoul", "busan", "jeju",
    "taiwan", "taipei", "kaohsiung", "taichung",
    "thailand", "bangkok", "phuket", "krabi", "chiang mai", "koh samui", "pattaya", "hua hin",
    "vietnam", "hanoi", "saigon", "ho chi minh", "da nang", "hoi an", "phu quoc", "nha trang",
    "malaysia", "kl", "kuala lumpur", "penang", "johor", "jb", "malacca", "melaka", "ipoh",
    "langkawi", "cameron highlands", "desaru", "kota kinabalu", "kuching",
    "indonesia", "bali", "batam", "bintan", "jakarta", "bandung", "lombok", "yogyakarta", "surabaya",
    "philippines", "manila", "cebu", "boracay", "palawan", "siargao", "bohol",
    "hong kong", "macau", "china", "shanghai", "beijing", "chengdu", "xian", "guilin",
    "hainan", "sanya", "shenzhen", "guangzhou", "harbin", "zhangjiajie",
    "cambodia", "siem reap", "phnom penh", "laos", "myanmar", "yangon", "brunei",
    "india", "delhi", "mumbai", "kerala", "goa", "sri lanka", "maldives", "nepal", "bhutan",
    "australia", "perth", "melbourne", "sydney", "brisbane", "gold coast", "tasmania",
    "new zealand", "nz", "queenstown", "auckland",
    "dubai", "abu dhabi", "qatar", "turkey", "istanbul", "cappadocia", "egypt", "morocco",
    "jordan", "israel", "georgia", "kazakhstan", "uzbekistan", "mongolia",
    "europe", "london", "paris", "switzerland", "italy", "rome", "milan", "venice",
    "spain", "barcelona", "madrid", "portugal", "lisbon", "greece", "santorini",
    "germany", "berlin", "munich", "netherlands", "amsterdam", "iceland", "norway",
    "finland", "sweden", "denmark", "austria", "vienna", "prague", "budapest", "croatia",
    "usa", "us", "america", "new york", "nyc", "la", "los angeles", "san francisco",
    "hawaii", "seattle", "canada", "vancouver", "toronto",
    "mexico", "brazil", "peru", "argentina", "chile", "colombia",
    "south africa", "kenya", "tanzania", "madagascar", "mauritius", "seychelles",
  ].map((name) => name.toLowerCase()),
);

/**
 * Is this residue worth treating as a place?
 *
 * Only consulted for assessment frames, where the subject is unconstrained —
 * "the weather is fine too" must not create a trip to Weather. Two signals are
 * accepted: a name we recognise, or a capital letter in the original text,
 * which in chat is a deliberate act.
 */
export function namesLikelyPlace(
  candidate: string,
  originalText: string,
): boolean {
  const name = candidate.trim().toLowerCase();
  if (name.length < 2) return false;
  if (COMMON_DESTINATIONS.has(name)) return true;

  // A locative preposition selects a place outright, whatever follows it —
  // "let's go to Sekinchan" needs no list and no capital letter.
  const head = escape(name.split(" ")[0]!);
  if (new RegExp(`\\b(?:to|in|at|around)\\s+${head}\\b`, "i").test(originalText)) {
    return true;
  }

  // Capitalised mid-sentence, ignoring the first word, where a capital says
  // nothing. Chat is mostly lowercase, so this is a real signal when present.
  const words = originalText.trim().split(/\s+/);
  return words
    .slice(1)
    .some((word) => new RegExp(`^${escape(name.split(" ")[0]!)}`, "i").test(word) && /^[A-Z]/.test(word));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove the proposal scaffolding, leaving the thing being proposed.
 *
 * Growing the filler word-list was the alternative, and it has leaked five
 * times: any word that can sit beside a place name eventually gets read as
 * one. Stripping the frames we have *already matched* is exact by
 * construction — "Korea is fine too" leaves "Korea", not "Korea Fine".
 */
export function stripProposalLanguage(text: string): string {
  return text
    .replace(PROPOSAL_FRAME, " ")
    .replace(ASSESSMENT_FRAME, " ")
    .replace(ADDITIVE_MARKER, " ")
    .replace(
      /\b(?:leh|lah|lor|hor|meh|sia|ah|ar|liao|one|or not|thoughts|how)\b/gi,
      " ",
    )
    .replace(
      /\b(?:could|would|should|shall|might|must|will|do|does|did|go|going|goes|be|been|is|are|was|were|am|the|a|an|think|thought|guess|reckon|feel|say|said|really|quite|just|still|then|actually|instead)\b/gi,
      " ",
    )
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ProposalShape {
  /** A recognised way of putting something on the table. */
  proposes: boolean;
  /** Explicitly joining what is already there — "too", "also", "or". */
  additive: boolean;
  /** Identified by a frame that governs a noun, so the residue is trustworthy. */
  framed: boolean;
}

export function readProposal(text: string): ProposalShape {
  const framed = PROPOSAL_FRAME.test(text);
  const assessed = ASSESSMENT_FRAME.test(text) || PROPOSAL_TAG.test(text);
  return {
    proposes: framed || assessed,
    additive: ADDITIVE_MARKER.test(text),
    framed,
  };
}
