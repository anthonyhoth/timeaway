import type { ParticipantPlanningState } from "@timeaway/database";
import type { EvaluatedWindow, RankedWindows } from "@timeaway/trip-engine";
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

function participantLines(
  window: EvaluatedWindow,
  participants: readonly ParticipantPlanningState[],
): string[] {
  const lines: string[] = [];

  if (window.counts.available > 0) {
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

  lines.push(
    `🗓 ${window.leaveDays} leave ${window.leaveDays === 1 ? "day" : "days"}`,
  );
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
    const best = feasible[0]!;
    lines.push(
      "Best match so far",
      `${formatDateRange(best.window.start, best.window.end)} · ${best.window.days} days`,
      "",
      ...participantLines(best, input.participants),
    );

    const alternatives = feasible.slice(1, 3);
    if (alternatives.length > 0) {
      lines.push(
        "",
        `Also works: ${alternatives
          .map(
            (w) =>
              `${formatDateRange(w.window.start, w.window.end)} (${w.leaveDays} leave)`,
          )
          .join(" · ")}`,
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

  lines.push("", input.tripUrl);
  return lines.join("\n");
}
