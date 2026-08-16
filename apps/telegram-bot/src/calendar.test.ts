import type { AvailabilityState, ISODate } from "@timeaway/shared";
import { describe, expect, it } from "vitest";
import type { CalendarState } from "./calendar.js";
import {
  calendarCaption,
  monthStart,
  orderRange,
  renderCalendarKeyboard,
  shiftMonth,
} from "./calendar.js";

const bounds = { min: "2026-11-01", max: "2026-12-31" };
const base: CalendarState = { mode: "UNAVAILABLE", monthAnchor: "2026-11-01" };
const noExisting = new Map<ISODate, AvailabilityState>();

const flat = (rows: { text: string; data: string }[][]) =>
  rows.flat().map((b) => b.text);

describe("renderCalendarKeyboard", () => {
  it("puts every mode on one row with the active one marked", () => {
    const rows = renderCalendarKeyboard(base, noExisting, bounds);
    expect(rows[0]).toHaveLength(4);
    expect(rows[0]!.map((b) => b.text)).toEqual([
      "• Can't •",
      "Works",
      "Maybe",
      "Not sure",
    ]);
  });

  it("lays the month out Monday-first with correct leading blanks", () => {
    // 1 Nov 2026 is a Sunday, so it sits in the last column of week one.
    const rows = renderCalendarKeyboard(base, noExisting, bounds);
    const firstWeek = rows[2]!;
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek.slice(0, 6).every((b) => b.text === " ")).toBe(true);
    expect(firstWeek[6]!.text).toBe("1");
  });

  it("keeps every week seven columns wide, padding the last", () => {
    const rows = renderCalendarKeyboard(base, noExisting, bounds);
    const weeks = rows.slice(2, -2);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("renders all 30 days of November exactly once", () => {
    const texts = flat(renderCalendarKeyboard(base, noExisting, bounds));
    for (let day = 1; day <= 30; day++) {
      expect(texts.filter((t) => t === String(day))).toHaveLength(1);
    }
  });

  it("marks days the user already answered", () => {
    const existing = new Map<ISODate, AvailabilityState>([
      ["2026-11-09", "UNAVAILABLE"],
      ["2026-11-10", "AVAILABLE"],
      ["2026-11-11", "MAYBE"],
      ["2026-11-12", "UNKNOWN"],
    ]);
    const texts = flat(renderCalendarKeyboard(base, existing, bounds));
    expect(texts).toContain("9✕");
    expect(texts).toContain("10✓");
    expect(texts).toContain("11~");
    expect(texts).toContain("12?");
    // Untouched days carry no marker.
    expect(texts).toContain("13");
  });

  it("brackets the pending start once a range is underway", () => {
    const texts = flat(
      renderCalendarKeyboard(
        { ...base, pendingStart: "2026-11-09" },
        noExisting,
        bounds,
      ),
    );
    expect(texts).toContain("[9]");
  });

  it("disables days outside the trip horizon", () => {
    const rows = renderCalendarKeyboard(
      base,
      noExisting,
      { min: "2026-11-10", max: "2026-11-20" },
    );
    const buttons = rows.flat();
    const ninth = buttons.find((b) => b.data === "cal:d:2026-11-09");
    expect(ninth).toBeUndefined();
    expect(buttons.find((b) => b.data === "cal:d:2026-11-15")).toBeDefined();
  });

  it("keeps every callback payload inside Telegram's 64-byte limit", () => {
    const rows = renderCalendarKeyboard(
      { ...base, pendingStart: "2026-11-09" },
      noExisting,
      bounds,
    );
    for (const button of rows.flat()) {
      expect(Buffer.byteLength(button.data, "utf8")).toBeLessThanOrEqual(64);
    }
  });

  it("hides navigation beyond the horizon", () => {
    const only = renderCalendarKeyboard(base, noExisting, {
      min: "2026-11-01",
      max: "2026-11-30",
    });
    const nav = only.at(-2)!;
    expect(nav[0]!.data).toBe("cal:x");
    expect(nav[2]!.data).toBe("cal:x");

    const withNext = renderCalendarKeyboard(base, noExisting, bounds);
    expect(withNext.at(-2)![2]!.data).toBe("cal:n:2026-12");
  });

  it("offers Done normally and Cancel mid-range", () => {
    expect(renderCalendarKeyboard(base, noExisting, bounds).at(-1)![0]!.text).toBe(
      "Done for now",
    );
    expect(
      renderCalendarKeyboard(
        { ...base, pendingStart: "2026-11-09" },
        noExisting,
        bounds,
      ).at(-1)![0]!.text,
    ).toBe("Cancel this range");
  });
});

describe("calendarCaption", () => {
  it("says what the next tap does", () => {
    expect(calendarCaption(base)).toContain("Tap the first day");
    expect(calendarCaption({ ...base, pendingStart: "2026-11-09" })).toContain(
      "now tap the last day",
    );
  });
});

describe("month helpers", () => {
  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("normalises to the first of the month", () => {
    expect(monthStart("2026-11-17")).toBe("2026-11-01");
  });
});

describe("orderRange", () => {
  it("accepts the two taps in either order", () => {
    expect(orderRange("2026-11-17", "2026-11-09")).toEqual({
      start: "2026-11-09",
      end: "2026-11-17",
    });
  });

  it("treats a repeated tap as a single day", () => {
    expect(orderRange("2026-11-09", "2026-11-09")).toEqual({
      start: "2026-11-09",
      end: "2026-11-09",
    });
  });
});
