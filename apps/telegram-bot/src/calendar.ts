import type {
  AvailabilityState,
  DeclaredAvailabilityState,
  ISODate,
} from "@timeaway/shared";
import { addDays } from "@timeaway/trip-engine";

/**
 * Telegram inline calendar. The platform offers only discrete buttons — there
 * is no drag or gesture support — so a range is entered as three taps: pick a
 * mode, tap the start, tap the end (brief §12). It must never become 31
 * independent decisions.
 *
 * Rendering is pure: these functions return button rows, and the bot layer
 * turns them into an InlineKeyboard. Callback payloads stay well under
 * Telegram's 64-byte limit.
 */

export interface CalendarButton {
  text: string;
  data: string;
}

export interface CalendarState {
  mode: DeclaredAvailabilityState;
  /** First day of the displayed month. */
  monthAnchor: ISODate;
  /** Set after the first date tap, cleared when the range completes. */
  pendingStart?: ISODate;
}

export interface CalendarBounds {
  /** Earliest selectable day — usually the trip horizon start or today. */
  min: ISODate;
  max: ISODate;
}

const MODES: { state: DeclaredAvailabilityState; code: string; label: string }[] =
  [
    { state: "UNAVAILABLE", code: "U", label: "Can't" },
    { state: "AVAILABLE", code: "A", label: "Works" },
    { state: "MAYBE", code: "M", label: "Maybe" },
    { state: "UNKNOWN", code: "K", label: "Not sure" },
  ];

export const MODE_BY_CODE = new Map(MODES.map((m) => [m.code, m.state]));
const CODE_BY_MODE = new Map(MODES.map((m) => [m.state, m.code]));

/** Compact day markers — buttons are narrow, so no emoji. */
const MARKER: Record<AvailabilityState, string> = {
  AVAILABLE: "✓",
  MAYBE: "~",
  UNAVAILABLE: "✕",
  UNKNOWN: "?",
  UNANSWERED: "",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parts(date: ISODate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function iso(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday = 0 … Sunday = 6, matching the grid's column order. */
function mondayIndex(date: ISODate): number {
  const { year, month, day } = parts(date);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function monthStart(date: ISODate): ISODate {
  const { year, month } = parts(date);
  return iso(year, month, 1);
}

export function shiftMonth(anchor: ISODate, delta: number): ISODate {
  const { year, month } = parts(anchor);
  const total = (year * 12 + (month - 1)) + delta;
  return iso(Math.floor(total / 12), (total % 12) + 1, 1);
}

const NOOP = "cal:x";

/**
 * The full keyboard: mode row, weekday headings, day grid, navigation, and
 * the closing actions.
 */
export function renderCalendarKeyboard(
  state: CalendarState,
  existing: ReadonlyMap<ISODate, AvailabilityState>,
  bounds: CalendarBounds,
): CalendarButton[][] {
  const rows: CalendarButton[][] = [];

  rows.push(
    MODES.map((m) => ({
      text: m.state === state.mode ? `• ${m.label} •` : m.label,
      data: `cal:m:${m.code}`,
    })),
  );

  rows.push(
    ["M", "T", "W", "T", "F", "S", "S"].map((d) => ({ text: d, data: NOOP })),
  );

  const { year, month } = parts(state.monthAnchor);
  const total = daysInMonth(year, month);
  const lead = mondayIndex(iso(year, month, 1));

  let week: CalendarButton[] = Array.from({ length: lead }, () => ({
    text: " ",
    data: NOOP,
  }));

  for (let day = 1; day <= total; day++) {
    const date = iso(year, month, day);
    const selectable = date >= bounds.min && date <= bounds.max;

    let text: string;
    if (!selectable) {
      text = "·";
    } else if (date === state.pendingStart) {
      text = `[${day}]`;
    } else {
      text = `${day}${MARKER[existing.get(date) ?? "UNANSWERED"]}`;
    }

    week.push({ text, data: selectable ? `cal:d:${date}` : NOOP });

    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push({ text: " ", data: NOOP });
    rows.push(week);
  }

  // Navigation is bounded by the trip horizon — no wandering into 2031.
  const previous = shiftMonth(state.monthAnchor, -1);
  const next = shiftMonth(state.monthAnchor, 1);
  const hasPrevious = previous >= monthStart(bounds.min);
  const hasNext = next <= bounds.max;

  rows.push([
    hasPrevious
      ? {
          text: `‹ ${MONTH_NAMES[parts(previous).month - 1]}`,
          data: `cal:n:${previous.slice(0, 7)}`,
        }
      : { text: " ", data: NOOP },
    {
      text: `${MONTH_NAMES[month - 1]} ${year}`,
      data: NOOP,
    },
    hasNext
      ? {
          text: `${MONTH_NAMES[parts(next).month - 1]} ›`,
          data: `cal:n:${next.slice(0, 7)}`,
        }
      : { text: " ", data: NOOP },
  ]);

  rows.push(
    state.pendingStart
      ? [{ text: "Cancel this range", data: "cal:c" }]
      : [{ text: "Done for now", data: "cal:done" }],
  );

  return rows;
}

/** Instruction text above the grid — always says what the next tap does. */
export function calendarCaption(state: CalendarState): string {
  const mode = MODES.find((m) => m.state === state.mode)!;
  if (state.pendingStart) {
    return `${mode.label} from ${state.pendingStart} — now tap the last day (or tap it again for a single day).`;
  }
  return `Marking dates you ${mode.label.toLowerCase()}. Tap the first day of a range.`;
}

export function modeCode(state: DeclaredAvailabilityState): string {
  return CODE_BY_MODE.get(state)!;
}

/** Inclusive range between two taps, in either tap order. */
export function orderRange(a: ISODate, b: ISODate): { start: ISODate; end: ISODate } {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export { addDays };
