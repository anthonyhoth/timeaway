import type { DeclaredAvailabilityState, ISODate } from "@timeaway/shared";

export interface ExtractionContext {
  /** Today's date in the group's timezone (SGT at MVP). */
  today: ISODate;
  /** Trip search space, when known — helps the model resolve bare months. */
  horizonStart?: ISODate | null;
  horizonEnd?: ISODate | null;
  destination?: string | null;
}

export interface ExtractedDeclaration {
  state: DeclaredAvailabilityState;
  /** Inclusive ISO dates. */
  start: ISODate;
  end: ISODate;
}

export interface ExtractionResult {
  /** False = the message carries no availability information; store nothing. */
  relevant: boolean;
  /**
   * Who the statement is about: null/absent = the sender themselves.
   * Third-party relays ("Sheryl can only do school holidays") set the name;
   * the MVP pipeline currently skips those rather than guessing identity.
   */
  subjectName: string | null;
  declarations: ExtractedDeclaration[];
  /** "Max 2 days leave" — a hard cap, not a date range. */
  maxLeaveDays: number | null;
}

export interface ConstraintExtractor {
  extract(messageText: string, ctx: ExtractionContext): Promise<ExtractionResult>;
}
