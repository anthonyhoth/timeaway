import type { ISODate } from "@timeaway/shared";

/**
 * Singapore gazetted public holidays for 2026, per the Ministry of Manpower
 * announcement. When a holiday falls on a Sunday, the following Monday is a
 * public holiday and is listed explicitly. Saturday holidays carry no
 * substitute day.
 *
 * MAINTENANCE: MOM publishes each year's list around the middle of the
 * preceding year — the 2027 list must be appended when gazetted. Windows
 * beyond SG_HOLIDAY_COVERAGE_END compute leave from weekdays only; callers
 * that care should check the boundary.
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

export const SG_HOLIDAY_COVERAGE_END: ISODate = "2026-12-31";
