import type { ParticipantPlanningState } from "@timeaway/database";
import { isSgHolidayCoverage, SG_HOLIDAY_COVERAGE_END } from "@timeaway/trip-engine";
import type {
  EvaluatedWindow,
  ParticipantDiagnostic,
  RankedWindows,
} from "@timeaway/trip-engine";
import {
  formatDateRange,
  formatDestinations,
  formatDuration,
} from "@timeaway/shared";


export interface CardInput {
  destinations: string[];
  durationMinDays: number | null;
  durationMaxDays: number | null;
  /** True when the duration was assumed rather than chosen. */
  durationDefaulted?: boolean;
  ranked: RankedWindows;
  participants: readonly ParticipantPlanningState[];
  tripUrl: string;
  /** Structural mismatches between a person and the trip's current shape. */
  diagnostics?: readonly ParticipantDiagnostic[];
  /** The current round's options, already spread across the horizon. */
  shortlist?: readonly EvaluatedWindow[];
  /** How many options this round offers — 5, then 3. */
  shortlistSize?: number;
  /** The trip's window, so leave figures can be qualified past our data. */
  horizonStart?: string | null;
  horizonEnd?: string | null;
  /**
   * True when nobody set a window and this one was read off what people said.
   * Shown, because an inferred window is a claim about the group's intent and
   * they should be able to see and correct it.
   */
  horizonDerived?: boolean;
  /** Set once the organiser has confirmed; renders the settled state. */
  selected?: { start: string; end: string } | null;
}

/** Everyone still in the trip — opt-outs are not part of any count. */
function travellers(
  participants: readonly ParticipantPlanningState[],
): ParticipantPlanningState[] {
  return participants.filter((p) => !p.optedOut);
}

function nameOf(
  participants: readonly ParticipantPlanningState[],
  participantId: string,
): string {
  return (
    participants.find((p) => p.participantId === participantId)?.displayName ??
    "Someone"
  );
}

/** "Farah" / "Farah and Dan" / "Farah, Dan and Mei" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * People whose status needs naming — everyone except the plainly available,
 * whose number is already shown against each option. Keeping the names is the
 * point: "Farah — roster not out yet" is the distinction the product exists
 * for, and a bare count would throw it away.
 */
function attentionLines(
  window: EvaluatedWindow,
  participants: readonly ParticipantPlanningState[],
): string[] {
  return participantLines(window, participants, { includeCounts: false });
}

function participantLines(
  window: EvaluatedWindow,
  participants: readonly ParticipantPlanningState[],
  options: { includeCounts?: boolean } = {},
): string[] {
  const includeCounts = options.includeCounts ?? true;
  const lines: string[] = [];

  if (includeCounts && window.counts.available > 0) {
    lines.push(
      `${window.counts.available} of ${travellers(participants).length} can make it`,
    );
  }

  // UNKNOWN-driven maybes are named separately — collapsing them into a
  // generic "maybe" would discard the product's core distinction.
  const pending = window.participants
    .filter((p) => p.status === "MAYBE" && p.dayCounts.unknown > 0)
    .map((p) => nameOf(participants, p.participantId));
  if (pending.length > 0) {
    lines.push(`${joinNames(pending)} — roster not out`);
  }

  const maybe = window.participants
    .filter((p) => p.status === "MAYBE" && p.dayCounts.unknown === 0)
    .map((p) => nameOf(participants, p.participantId));
  if (maybe.length > 0) {
    lines.push(`${joinNames(maybe)} — maybe`);
  }

  const blocked = window.participants
    .filter((p) => p.status === "UNAVAILABLE")
    .map((p) => nameOf(participants, p.participantId));
  if (blocked.length > 0) {
    lines.push(`${joinNames(blocked)} — can't make it`);
  }

  const silent = window.participants
    .filter((p) => p.status === "UNANSWERED")
    .map((p) => nameOf(participants, p.participantId));
  if (silent.length > 0) {
    lines.push(`${joinNames(silent)} — no dates yet`);
  }

  if (includeCounts) {
    lines.push(
      `${window.leaveDays} leave ${window.leaveDays === 1 ? "day" : "days"}`,
    );
  }
  return lines;
}

/**
 * Mismatches that no choice of dates can fix.
 *
 * Grouped by kind rather than listed per person: three people blocked by the
 * same thing used to produce three near-identical warnings and three warning
 * icons, which reads as three separate problems. One heading names everyone,
 * each person contributes only what is specific to them, and the way out is
 * stated once — the trade-off is the group's to make, so it has to be legible
 * at a glance.
 */
function diagnosticLines(input: CardInput): string[] {
  const diagnostics = input.diagnostics ?? [];
  if (diagnostics.length === 0) return [];

  const name = (id: string) => nameOf(input.participants, id);
  const lines: string[] = [];

  /**
   * One heading, one detail per person, one remedy. With a single person the
   * detail is folded into the heading — repeating their name three times to
   * say one thing is exactly the noise this avoids.
   */
  const section = (
    heading: (who: string) => string,
    details: { who: string; detail: string }[],
    remedy: (who: string) => string,
  ) => {
    const who = joinNames(details.map((d) => d.who));
    if (lines.length > 0) lines.push("");
    if (details.length === 1 && details[0]!.detail) {
      lines.push(`⚠️ ${heading(who)} — ${details[0]!.detail}`);
    } else {
      lines.push(`⚠️ ${heading(who)}`);
      for (const d of details.filter((d) => d.detail)) {
        lines.push(`${d.who} — ${d.detail}`);
      }
    }
    lines.push(remedy(who));
  };

  const ranges = (rs: readonly { start: string; end: string }[]) =>
    rs.map((r) => formatDateRange(r.start, r.end)).join(", ");

  const outside = diagnostics.filter((d) => d.kind === "ANSWERED_OUTSIDE_HORIZON");
  if (outside.length > 0) {
    section(
      (who) => `${who} answered for dates outside this trip`,
      outside.map((d) => ({
        who: name(d.participantId),
        detail: ranges(d.statedRanges),
      })),
      (who) => `Move the trip, or plan this one without ${who}.`,
    );
  }

  const blocked = diagnostics.filter((d) => d.kind === "BLOCKED_ACROSS_HORIZON");
  if (blocked.length > 0) {
    const details = blocked.map((d) => ({
      who: name(d.participantId),
      detail:
        d.availableElsewhere.length > 0
          ? `free ${ranges(d.availableElsewhere)}`
          : "",
    }));
    const elsewhere = details.filter((d) => d.detail).map((d) => d.detail);
    section(
      (who) => `${who} can't do any of these dates`,
      details,
      (who) =>
        elsewhere.length > 0
          ? `Shift the dates, or go without ${who}.`
          : `Widen the dates, or go without ${who}.`,
    );
  }

  const leave = diagnostics.filter((d) => d.kind === "LEAVE_CAP_BLOCKS_ALL");
  if (leave.length > 0) {
    section(
      (who) => `${who} can't spare the leave`,
      leave.map((d) => ({
        who: name(d.participantId),
        detail:
          `${d.maxLeaveDays} ${d.maxLeaveDays === 1 ? "day" : "days"}, ` +
          `shortest option costs ${d.cheapestWindowLeave}`,
      })),
      (who) => `Shorten the trip, or plan a shorter one with ${who} separately.`,
    );
  }

  return lines;
}

/** Non-date input already captured, one bullet per person. */
function notedLines(
  participants: readonly ParticipantPlanningState[],
): string[] {
  return participants
    .filter((p) => p.maxLeaveDays !== null)
    .map(
      (p) =>
        `• ${p.displayName} — up to ${p.maxLeaveDays} leave ${
          p.maxLeaveDays === 1 ? "day" : "days"
        }`,
    );
}

function header(input: CardInput): string[] {
  const lines = [formatDestinations(input.destinations)];
  if (input.horizonDerived && input.horizonStart && input.horizonEnd) {
    lines.push(
      `Looking at ${formatDateRange(input.horizonStart, input.horizonEnd)} — from what you've said`,
    );
  }
  if (input.durationMinDays !== null && input.durationMaxDays !== null) {
    // Marked when we assumed it, so nobody mistakes our guess for the group's
    // decision — and so it reads as something they are invited to change.
    const assumed = input.durationDefaulted ? " (default)" : "";
    lines[0] += ` · ${formatDuration(input.durationMinDays, input.durationMaxDays)}${assumed}`;
  }
  return lines;
}

/**
 * The live trip card. One message per trip, edited in place as availability
 * arrives, so the group sees the picture sharpen without the chat filling up.
 *
 * Everything here is rendering only — every number comes from the engine.
 */
export function renderTripCard(input: CardInput): string {
  const lines = header(input);
  lines.push("");

  if (input.selected) {
    lines.push(
      "🎉 Dates confirmed",
      formatDateRange(input.selected.start, input.selected.end),
      "",
      input.tripUrl,
    );
    return lines.join("\n");
  }

  const { feasible, nearMisses } = input.ranked;

  // Every window "works" before anyone has answered, since UNANSWERED never
  // eliminates one — so calling the first of them a best match is nonsense.
  // Until at least one person states dates, the card is an invitation.
  const hasAnyDates = input.participants.some((p) => p.declarations.length > 0);

  if (!hasAnyDates || (feasible.length === 0 && nearMisses.length === 0)) {
    lines.push(
      "I'm listening in this chat now.",
      "",
      "Just talk about dates like you normally would — \u201ccmi October\u201d, " +
        "\u201conly got 2 days AL\u201d, \u201croster not out yet\u201d — and I'll " +
        "work out what fits.",
      "",
      "You can shape the trip the same way: \u201clet's do Japan\u201d, " +
        "\u201cnext year\u201d, \u201cmake it a long weekend\u201d.",
    );

    // Acknowledge anything already heard that isn't a date, so the card never
    // looks like it ignored someone. One line per person: a comma-joined run
    // stops being readable the moment a second person is in it.
    const notes = notedLines(input.participants);
    if (notes.length > 0) lines.push("", "Noted so far:", ...notes);

    lines.push("", "/dates to see options · /pause to stop me reading", input.tripUrl);
    return lines.join("\n");
  }

  if (feasible.length > 0) {
    const options = input.shortlist ?? feasible.slice(0, input.shortlistSize ?? 5);
    const size = input.shortlistSize ?? options.length;

    if (options.length === 1) {
      const only = options[0]!;
      lines.push(
        "One window works for everyone",
        `${formatDateRange(only.window.start, only.window.end)} · ${only.window.days} days`,
        "",
        ...participantLines(only, input.participants),
      );
    } else {
      lines.push(
        size <= 3
          ? `Narrowed to ${options.length} — which works best?`
          : `${options.length} windows work so far`,
        "",
      );
      options.forEach((w, index) => {
        const pending =
          w.counts.rosterPending > 0 ? ` · ${w.counts.rosterPending} pending` : "";
        lines.push(
          `${index + 1}. ${formatDateRange(w.window.start, w.window.end)} · ` +
            `${w.window.days}d · ` +
            `${w.counts.available}/${travellers(input.participants).length} · ` +
            `${w.leaveDays} leave${pending}`,
        );
      });
      const attention = attentionLines(options[0]!, input.participants);
      if (attention.length > 0) lines.push("", ...attention);

      const notes = notedLines(input.participants);
      if (notes.length > 0) lines.push("", "Noted so far:", ...notes);

      lines.push(
        "",
        size <= 3
          ? "Pick one below, or say what still doesn't work."
          : "Say what doesn't work and I'll narrow these down.",
      );
    }
  } else {
    // The conflict case: say who'd have to be left out rather than nothing.
    const best = nearMisses[0]!;
    lines.push(
      "No window works for everyone yet.",
      "",
      `Closest: ${formatDateRange(best.window.start, best.window.end)} · ${best.window.days} days`,
      ...participantLines(best, input.participants),
      "",
      "Shift a date or go without someone — your call.",
    );
  }

  // Opinions, shown but never acted on: a disagreement about *where* must
  // not void a trip that works on *dates* (brief §8 — soft preferences
  // inform, they do not eliminate).
  const noted = input.participants.flatMap((p) =>
    (p.notes ?? []).slice(-2).map((n) => `• ${p.displayName} — “${n.text}”`),
  );
  if (noted.length > 0) lines.push("", "Worth knowing:", ...noted);

  const sittingOut = input.participants.filter((p) => p.optedOut);
  if (sittingOut.length > 0) {
    lines.push(
      "",
      `🙅 ${joinNames(sittingOut.map((p) => p.displayName))} sitting this one out`,
    );
  }

  // Past gazetted data the leave maths is still right about weekends but
  // blind to public holidays, which is exactly where the good windows are.
  // Say so rather than quietly reporting a worse number.
  if (
    input.horizonStart &&
    input.horizonEnd &&
    !isSgHolidayCoverage(input.horizonStart, input.horizonEnd)
  ) {
    lines.push(
      "",
      `⏳ Leave counts ignore public holidays after ${SG_HOLIDAY_COVERAGE_END.slice(0, 4)} — I don't have them yet.`,
    );
  }

  const issues = diagnosticLines(input);
  if (issues.length > 0) lines.push("", ...issues);

  lines.push("", input.tripUrl);
  return lines.join("\n");
}
