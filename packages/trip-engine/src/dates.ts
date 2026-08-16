import type { ISODate } from "@timeaway/shared";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

export function toUtc(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function toIso(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIso(dt);
}

/** Inclusive count of days from start to end; 1 when start = end. */
export function daySpan(start: ISODate, end: ISODate): number {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / 86_400_000) + 1;
}

/** Every date from start to end, inclusive. Empty if end < start. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}
