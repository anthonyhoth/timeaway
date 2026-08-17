import type { ISODate } from "@timeaway/shared";

/**
 * Where a span of known length could sit inside a period: at the start, in the
 * middle, or at the end.
 *
 * This is what turns *"2 weeks in November"* into a question with answers.
 * Three is the right number — it covers the range without asking anyone to
 * scan a list, and it matches how people describe it unprompted ("the first
 * two weeks", "the middle one", "the last two weeks").
 *
 * The middle is centred, with any odd day given to the front, so the three
 * options stay in calendar order and never overlap their own labels.
 */
export type SpanPosition = "first" | "middle" | "last";

export interface PositionedSpan {
  position: SpanPosition;
  start: ISODate;
  end: ISODate;
}

export function positionSpans(
  within: { start: string; end: string },
  days: number,
): PositionedSpan[] {
  const total = dayCount(within.start, within.end);
  if (days < 1 || days >= total) return [];

  const firstStart = 0;
  const lastStart = total - days;
  // Centred; the extra day goes to the front so "middle" never sits later
  // than the midpoint, which reads wrong against "last".
  const middleStart = Math.floor((total - days) / 2);

  const spans: PositionedSpan[] = [
    { position: "first", ...offset(within.start, firstStart, days) },
    { position: "middle", ...offset(within.start, middleStart, days) },
    { position: "last", ...offset(within.start, lastStart, days) },
  ];

  // With a span more than half the period the three overlap heavily and the
  // middle can coincide with an end — offering the same dates twice under two
  // names is a worse question than offering two.
  return spans.filter(
    (span, index) =>
      index === 0 ||
      span.start !== spans[index - 1]!.start,
  );
}

function offset(
  from: string,
  days: number,
  length: number,
): { start: ISODate; end: ISODate } {
  const base = Date.parse(`${from}T00:00:00Z`);
  const start = new Date(base + days * 86_400_000);
  const end = new Date(base + (days + length - 1) * 86_400_000);
  return { start: iso(start), end: iso(end) };
}

function iso(date: Date): ISODate {
  return date.toISOString().slice(0, 10) as ISODate;
}

function dayCount(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}
