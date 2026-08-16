import { describe, expect, it } from "vitest";
import {
  isSgHolidayCoverage,
  SG_PUBLIC_HOLIDAYS,
  SG_PUBLIC_HOLIDAYS_2026,
  SG_PUBLIC_HOLIDAYS_2027,
} from "./holidays-sg.js";
import { isWeekend, leaveDaysRequired } from "./leave.js";

describe("isWeekend", () => {
  it("marks Saturday and Sunday only", () => {
    expect(isWeekend("2026-11-21")).toBe(true); // Sat
    expect(isWeekend("2026-11-22")).toBe(true); // Sun
    expect(isWeekend("2026-11-23")).toBe(false); // Mon
    expect(isWeekend("2026-11-27")).toBe(false); // Fri
  });
});

describe("leaveDaysRequired", () => {
  const none: ReadonlySet<string> = new Set();

  it("costs nothing for a weekend-only window", () => {
    expect(leaveDaysRequired("2026-11-21", "2026-11-22", none)).toBe(0);
  });

  it("costs 5 for a full Mon–Fri week", () => {
    expect(leaveDaysRequired("2026-11-23", "2026-11-27", none)).toBe(5);
  });

  it("Sat–Wed costs 3 weekdays", () => {
    expect(leaveDaysRequired("2026-11-21", "2026-11-25", none)).toBe(3);
  });

  it("public holidays reduce the cost — Deepavali observed Monday", () => {
    // 7–11 Nov 2026: Sat, Sun (Deepavali), Mon (observed), Tue, Wed.
    expect(
      leaveDaysRequired("2026-11-07", "2026-11-11", SG_PUBLIC_HOLIDAYS_2026),
    ).toBe(2);
  });

  it("holiday-stacked windows can cost zero leave", () => {
    // 8–10 Aug 2026: Sun (National Day), Mon (observed), … Tue 11 is work.
    expect(
      leaveDaysRequired("2026-08-08", "2026-08-10", SG_PUBLIC_HOLIDAYS_2026),
    ).toBe(0);
  });
});

describe("2027 holiday coverage", () => {
  it("knows the gazetted 2027 dates", () => {
    // CNY falls Sat 6 + Sun 7 Feb 2027, with Mon 8 Feb as the substitute.
    expect(SG_PUBLIC_HOLIDAYS_2027.has("2027-02-08")).toBe(true);
    expect(SG_PUBLIC_HOLIDAYS_2027.has("2027-10-28")).toBe(true); // Deepavali
  });

  it("makes the CNY 2027 long weekend cheap in leave", () => {
    // Sat 6 – Mon 8 Feb: weekend plus the substitute holiday.
    expect(leaveDaysRequired("2027-02-06", "2027-02-08", SG_PUBLIC_HOLIDAYS)).toBe(0);
    // Extending to Wed 10 Feb costs only Tue and Wed.
    expect(leaveDaysRequired("2027-02-06", "2027-02-10", SG_PUBLIC_HOLIDAYS)).toBe(2);
  });

  it("reports whether a window is inside gazetted coverage", () => {
    expect(isSgHolidayCoverage("2027-05-01", "2027-05-05")).toBe(true);
    expect(isSgHolidayCoverage("2028-01-01", "2028-01-05")).toBe(false);
  });
});
