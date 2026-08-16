/**
 * Five first-class availability states — see AGENTS.md architecture boundaries
 * and docs/PRODUCT_BRIEF.md section 9. UNKNOWN and UNANSWERED must never be
 * collapsed into each other or into UNAVAILABLE anywhere in the data model or UI.
 */
export const AVAILABILITY_STATES = [
  "AVAILABLE",
  "MAYBE",
  "UNAVAILABLE",
  "UNKNOWN",
  "UNANSWERED",
] as const;

export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

/**
 * States a user can actively declare for a date range. UNANSWERED is excluded:
 * it is the absence of any declaration, never a stored value — untouched dates
 * default to UNANSWERED by having no covering declaration (brief section 9).
 */
export const DECLARED_AVAILABILITY_STATES = [
  "AVAILABLE",
  "MAYBE",
  "UNAVAILABLE",
  "UNKNOWN",
] as const;

export type DeclaredAvailabilityState =
  (typeof DECLARED_AVAILABILITY_STATES)[number];

/** Calendar date as "YYYY-MM-DD". Timezone-free by design — trip planning
 * operates on whole days, and ISO date strings compare correctly with `<`. */
export type ISODate = string;
