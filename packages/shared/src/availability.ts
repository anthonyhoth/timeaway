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
