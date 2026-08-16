import type { ParticipantPlanningState } from "@timeaway/database";
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
  ranked: RankedWindows;
  participants: readonly ParticipantPlanningState[];
  tripUrl: string;
  /** Structural mismatches between a person and the trip's current shape. */
  diagnostics?: readonly ParticipantDiagnostic[];
  /** The current round's options, already spread across the horizon. */
  shortlist?: readonly EvaluatedWindow[];
  /** How many options this round offers — 5, then 3. */
  shortlistSize?: number;
  /** Set once the organiser has confirmed; renders the settled state. */
  selected?: { start: string; end: string } | null;
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
    lines.push(`✅ ${window.counts.available} can make it`);
  }

  // UNKNOWN-driven maybes are named separately — collapsing them into a
  // generic "maybe" would discard the product's core distinction.
  const pending = window.participants
    .filter((p) => p.status === "MAYBE" && p.dayCounts.unknown > 0)
    .map((p) => nameOf(participants, p.participantId));
  if (pending.length > 0) {
    lines.push(`❓ ${joinNames(pending)} — waiting on roster`);
  }

  const maybe = window.participants
    .filter((p) => p.status === "MAYBE" && p.dayCounts.unknown === 0)
    .map((p) => nameOf(participants, p.participantId));
  if (maybe.length > 0) {
    lines.push(`🤔 ${joinNames(maybe)} — maybe`);
  }

  const blocked = window.participants
    .filter((p) => p.status === "UNAVAILABLE")
    .map((p) => nameOf(participants, p.participantId));
  if (blocked.length > 0) {
    lines.push(`❌ ${joinNames(blocked)} can't make it`);
  }

  const silent = window.participants
    .filter((p) => p.status === "UNANSWERED")
    .map((p) => nameOf(participants, p.participantId));
  if (silent.length > 0) {
    lines.push(`💬 ${joinNames(silent)} — no dates yet`);
  }

  if (includeCounts) {
    lines.push(
      `🗓 ${window.leaveDays} leave ${window.leaveDays === 1 ? "day" : "days"}`,
    );
  }
  return lines;
}

/**
 * Mismatches that no choice of dates can fix, each stated with the two ways
 * out: reshape the trip, or go ahead without that person. The group decides —
 * Timeaway only makes the trade-off visible.
 */
function diagnosticLines(input: CardInput): string[] {
  const lines: string[] = [];

  for (const d of input.diagnostics ?? []) {
    const name = nameOf(input.participants, d.participantId);

    if (d.kind === "ANSWERED_OUTSIDE_HORIZON") {
      const said = d.statedRanges
        .map((r) => formatDateRange(r.start, r.end))
        .join(", ");
      lines.push(
        `⚠️ ${name} answered for ${said} — outside this trip.`,
        `   Move the dates, or plan this one without ${name}.`,
      );
      continue;
    }

    if (d.kind === "BLOCKED_ACROSS_HORIZON") {
      const elsewhere = d.availableElsewhere
        .map((r) => formatDateRange(r.start, r.end))
        .join(", ");
      lines.push(
        elsewhere
          ? `⚠️ ${name} can't do these dates, but said ${elsewhere} works.`
          : `⚠️ ${name} can't do any of these dates.`,
        elsewhere
          ? `   Move the trip to ${elsewhere}, or plan this one without ${name}.`
          : `   Widen the dates, or plan this one without ${name}.`,
      );
      continue;
    }

    const affordable =
      d.longestAffordableDays > 0
        ? `${name} could manage about ${d.longestAffordableDays} days`
        : `${name} can't spare leave for this`;
    lines.push(
      `⚠️ ${name} has ${d.maxLeaveDays} leave ${d.maxLeaveDays === 1 ? "day" : "days"};` +
        ` the shortest option here costs ${d.cheapestWindowLeave}.`,
      `   ${affordable} — shorten the trip, or keep this one and plan a short trip with ${name} separately.`,
    );
  }

  return lines;
}

function header(input: CardInput): string[] {
  const lines = [formatDestinations(input.destinations)];
  if (input.durationMinDays !== null && input.durationMaxDays !== null) {
    lines[0] += ` · ${formatDuration(input.durationMinDays, input.durationMaxDays)}`;
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
    );

    // Acknowledge anything already heard that isn't a date, so the card never
    // looks like it ignored someone.
    const caps = input.participants
      .filter((p) => p.maxLeaveDays !== null)
      .map((p) => `${p.displayName} up to ${p.maxLeaveDays} leave days`);
    if (caps.length > 0) lines.push("", `Noted so far: ${caps.join(", ")}`);

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
        const pending = w.counts.rosterPending > 0 ? ` · ${w.counts.rosterPending} roster pending` : "";
        lines.push(
          `${index + 1}. ${formatDateRange(w.window.start, w.window.end)} · ${w.window.days} days`,
          `    ✅ ${w.counts.available} in · ${w.leaveDays} leave${pending}`,
        );
      });
      const attention = attentionLines(options[0]!, input.participants);
      if (attention.length > 0) lines.push("", ...attention);

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

  const issues = diagnosticLines(input);
  if (issues.length > 0) lines.push("", ...issues);

  lines.push("", input.tripUrl);
  return lines.join("\n");
}
