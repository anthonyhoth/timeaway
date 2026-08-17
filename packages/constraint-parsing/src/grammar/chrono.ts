import * as chrono from "chrono-node";
import type { ISODate } from "@timeaway/shared";
import type { FoundPeriod } from "./periods.js";

/**
 * General-purpose date parsing, sitting *below* every Singapore-specific layer.
 *
 * Chosen over Duckling deliberately. Duckling is Haskell, ships as an HTTP
 * service, and would mean a second container, a network hop on the hot path,
 * and a runtime nobody here maintains — against a deploy story whose first rule
 * is "run one instance". Chrono is TypeScript, in-process, MIT, and has **zero
 * dependencies**; the whole benefit of Duckling's larger grammar is in locales
 * and languages we do not serve.
 *
 * `en.GB` is not a stylistic choice. Singapore writes DD/MM, and the two
 * locales disagree on exactly the input a Singaporean is most likely to type:
 *
 *     "3/11"   en.GB → 3 November      en.US → 11 March
 *
 * Getting that backwards would silently book the wrong month.
 *
 * Chrono is eager, so its output is guarded rather than trusted. Left alone it
 * reads "nov 20, 22 and 25" as the year 2022, and reduces a bare "november" to
 * the single day 1 Nov. Both are rejected below.
 */

/** Trips are planned within a couple of years — anything beyond is a misread. */
const MAX_YEARS_AHEAD = 3;

/**
 * "max 2 days leave" is a leave cap, not a date, but chrono resolves the "2
 * days" to a calendar day two days from now. Left in, it gave every leave-cap
 * message a spurious date reference and broke the cap-only path entirely.
 */
const BARE_DURATION =
  /^\s*\d{1,3}\s*(?:days?|d|weeks?|wks?|months?|nights?|hrs?|hours?)\s*$/i;

/**
 * A boundary word turns a date into a half-open interval: "after the 15th"
 * means the 16th onwards, "before the 20th" means up to the 19th. Chrono
 * returns the pivot day itself, which is both the wrong span and — for
 * "before" — the wrong side of it. Only a two-ended range is safe here.
 */
const BOUNDARY_BEFORE = /\b(?:before|after|until|till|from|by|since|past)\s*$/i;

export function findChronoPeriod(
  text: string,
  today: ISODate,
): FoundPeriod | null {
  const reference = toUtcDate(today);
  const results = chrono.en.GB.parse(text, reference, { forwardDate: true });

  for (const result of results) {
    // A day must be *stated*. Chrono happily returns 1 November for a bare
    // "november"; treating that as a single day would discard the other 29,
    // and whole months are the SG grammar's job anyway.
    if (!result.start.isCertain("day") || !result.start.isCertain("month")) {
      continue;
    }

    if (BARE_DURATION.test(result.text)) continue;

    // Two-ended ranges are safe even when a boundary word is present
    // ("dec 20th till jan 2nd"); a lone pivot is not.
    if (!result.end && BOUNDARY_BEFORE.test(text.slice(0, result.index))) {
      continue;
    }

    const start = componentsToIso(result.start);
    const end = result.end ? componentsToIso(result.end) : start;
    if (!start || !end || end < start) continue;

    // "nov 20, 22 and 25" parses as the year 2022. A date in the past, or
    // implausibly far ahead, means we have misread the sentence — and a
    // decline costs one LLM call, where a wrong claim corrupts the trip.
    if (end < today) continue;
    if (Number(start.slice(0, 4)) > Number(today.slice(0, 4)) + MAX_YEARS_AHEAD) {
      continue;
    }

    return {
      range: { start: start < today ? today : start, end },
      // Distinguished so the caller can tell an explicit two-ended span from a
      // single day: only the former is trustworthy alongside a narrowing word.
      note: result.end ? "chrono range" : "chrono date",
      start: result.index,
      end: result.index + result.text.length,
    };
  }
  return null;
}

/**
 * Read the calendar components chrono resolved rather than its Date object.
 * `.date()` is built in the host timezone, so formatting it as ISO can shift
 * the day either side of midnight — on a server in UTC that silently moves a
 * Singaporean's dates by one.
 */
function componentsToIso(component: chrono.ParsedComponents): ISODate | null {
  const year = component.get("year");
  const month = component.get("month");
  const day = component.get("day");
  if (year == null || month == null || day == null) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toUtcDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}
