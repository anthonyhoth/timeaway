
import type { Db } from "../client.js";
import { waitlistSignups } from "../schema/index.js";
import { getTripByShortCode } from "./trips.js";
import { loadTripPlanningState } from "./planning.js";

/**
 * What an unauthenticated visitor may see. The trip URL is unguessable but
 * public, so this type deliberately carries **first names only** and no raw
 * per-day availability — §15 classifies those as private, and a shape that
 * cannot represent them cannot leak them (docs/DECISIONS.md).
 */
export interface PublicParticipant {
  firstName: string;
  isOrganiser: boolean;
  maxLeaveDays: number | null;
  declarations: {
    state: "AVAILABLE" | "MAYBE" | "UNAVAILABLE" | "UNKNOWN";
    start: string;
    end: string;
  }[];
}

export interface PublicTripView {
  shortCode: string;
  destinationCandidates: string[];
  status: string;
  horizonStart: string | null;
  horizonEnd: string | null;
  durationMinDays: number | null;
  durationMaxDays: number | null;
  /** Options offered this round — 5, then 3. */
  shortlistSize: number;
  selectedStart: string | null;
  selectedEnd: string | null;
  participants: PublicParticipant[];
}

/** "Anthony Ho" → "Anthony"; already-single names pass through unchanged. */
export function firstNameOf(displayName: string): string {
  const trimmed = displayName.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  return first.length > 0 ? first : "Someone";
}

export async function loadPublicTripView(
  db: Db,
  shortCode: string,
): Promise<PublicTripView | undefined> {
  const trip = await getTripByShortCode(db, shortCode);
  if (!trip) return undefined;

  const participants = await loadTripPlanningState(db, trip.id);

  return {
    shortCode: trip.shortCode,
    destinationCandidates: trip.destinationCandidates ?? [],
    status: trip.status,
    horizonStart: trip.horizonStart,
    horizonEnd: trip.horizonEnd,
    durationMinDays: trip.durationMinDays,
    durationMaxDays: trip.durationMaxDays,
    shortlistSize: trip.shortlistSize,
    selectedStart: trip.selectedStart,
    selectedEnd: trip.selectedEnd,
    participants: participants.map((p) => ({
      firstName: firstNameOf(p.displayName),
      isOrganiser: p.isOrganiser,
      maxLeaveDays: p.maxLeaveDays,
      declarations: p.declarations,
    })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Idempotent: signing up twice is a no-op rather than an error. The unique
 * index is on `lower(email)`, which Drizzle's typed `target` cannot express,
 * so the conflict is caught rather than declared.
 */
export async function addWaitlistSignup(
  db: Db,
  input: { email: string; source?: string; tripShortCode?: string | null },
): Promise<void> {
  try {
    await db.insert(waitlistSignups).values({
      email: input.email.trim(),
      source: input.source ?? "landing",
      tripShortCode: input.tripShortCode ?? null,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "23505") throw error; // anything but a duplicate is real
  }
}
