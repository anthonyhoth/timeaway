import type { ISODate } from "@timeaway/shared";

/**
 * Singapore gazetted public holidays, per Ministry of Manpower announcements.
 * When a holiday falls on a Sunday the following Monday is gazetted as a
 * substitute and is listed explicitly; Saturday holidays carry no substitute.
 *
 * MAINTENANCE: MOM publishes each year's list around the middle of the
 * preceding year (the 2027 list was gazetted 18 June 2026). Append the next
 * year when it is published and extend SG_HOLIDAY_COVERAGE_END. Dates beyond
 * coverage compute leave from weekdays alone, which silently overstates the
 * cost of a holiday-stacked window — use isSgHolidayCoverage() to warn.
 */
export const SG_PUBLIC_HOLIDAYS_2026: ReadonlySet<ISODate> = new Set([
  "2026-01-01", // New Year's Day (Thu)
  "2026-02-17", // Chinese New Year (Tue)
  "2026-02-18", // Chinese New Year (Wed)
  "2026-03-21", // Hari Raya Puasa (Sat)
  "2026-04-03", // Good Friday
  "2026-05-01", // Labour Day (Fri)
  "2026-05-27", // Hari Raya Haji (Wed)
  "2026-05-31", // Vesak Day (Sun)
  "2026-06-01", // Vesak Day observed (Mon)
  "2026-08-09", // National Day (Sun)
  "2026-08-10", // National Day observed (Mon)
  "2026-11-08", // Deepavali (Sun)
  "2026-11-09", // Deepavali observed (Mon)
  "2026-12-25", // Christmas Day (Fri)
]);

export const SG_PUBLIC_HOLIDAYS_2027: ReadonlySet<ISODate> = new Set([
  "2027-01-01", // New Year's Day (Fri)
  "2027-02-06", // Chinese New Year (Sat)
  "2027-02-07", // Chinese New Year (Sun)
  "2027-02-08", // Chinese New Year substitute (Mon)
  "2027-03-10", // Hari Raya Puasa (Wed)
  "2027-03-26", // Good Friday
  "2027-05-01", // Labour Day (Sat)
  "2027-05-17", // Hari Raya Haji (Mon)
  "2027-05-20", // Vesak Day (Thu)
  "2027-08-09", // National Day (Mon)
  "2027-10-28", // Deepavali (Thu)
  "2027-12-25", // Christmas Day (Sat)
]);

/** Every gazetted holiday we know about, across all covered years. */
export const SG_PUBLIC_HOLIDAYS: ReadonlySet<ISODate> = new Set([
  ...SG_PUBLIC_HOLIDAYS_2026,
  ...SG_PUBLIC_HOLIDAYS_2027,
]);

export const SG_HOLIDAY_COVERAGE_START: ISODate = "2026-01-01";
export const SG_HOLIDAY_COVERAGE_END: ISODate = "2027-12-31";

/**
 * Whether the gazetted table actually covers a window. Outside coverage, leave
 * computation is still correct about weekends but blind to public holidays,
 * so callers should hedge rather than quote a leave cost as fact.
 */
export function isSgHolidayCoverage(start: ISODate, end: ISODate): boolean {
  return start >= SG_HOLIDAY_COVERAGE_START && end <= SG_HOLIDAY_COVERAGE_END;
}
