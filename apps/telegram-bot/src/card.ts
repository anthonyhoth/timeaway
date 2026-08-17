import type { ParticipantPlanningState } from "@timeaway/database";
import { isSgHolidayCoverage, SG_HOLIDAY_COVERAGE_END } from "@timeaway/trip-engine";
import type {
  EvaluatedWindow,
  ParticipantDiagnostic,
  RankedWindows,
} from "@timeaway/trip-engine";
import {
  formatDateRange,
  formatTripDates,
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
  // generic "maybe" would discard the product's core distinction. The *reason*
  // is named too: "roster not out" was hard-coded from when a shift roster was
  // the only thing that produced UNKNOWN, and read as nonsense once a company
  // closure could.
  const pending = window.participants.filter(
    (p) => p.status === "MAYBE" && p.dayCounts.unknown > 0,
  );
  const byReason = new Map<string, string[]>();
  for (const person of pending) {
    const reason = unknownReason(participants, person.participantId);
    byReason.set(reason, [
      ...(byReason.get(reason) ?? []),
      nameOf(participants, person.participantId),
    ]);
  }
  for (const [reason, names] of byReason) {
    lines.push(`${joinNames(names)} — ${reason}`);
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
 * Why this person's dates are unknown, in their own terms.
 *
 * Read off what they actually wrote, so a nurse still sees "roster not out"
 * while someone waiting on a company shutdown sees that instead. A generic
 * label would have been easier and would have thrown away the distinction the
 * product exists to make.
 */
function unknownReason(
  participants: readonly ParticipantPlanningState[],
  participantId: string,
): string {
  const said = participants
    .find((p) => p.participantId === participantId)
    ?.declarations.find((d) => d.state === "UNKNOWN")?.sourceText;
  if (!said) return "dates not confirmed";
  if (/\broster\b/i.test(said)) return "roster not out";
  if (/\bshift/i.test(said)) return "shifts not out";
  const opaque =
    /\b(company (?:closure|shutdown|leave)|office (?:closure|shutdown)|block leave|forced leave|clearance leave|notice period)\b/i.exec(
      said,
    );
  if (opaque) return `waiting on ${opaque[1]!.toLowerCase()} dates`;
  return "dates not confirmed";
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

/**
 * What every option in the shortlist has in common, as one line.
 *
 * The engine spreads options across the horizon, so they routinely share a
 * length and a leave cost — and repeating those on every row is the noise a
 * reader has to see past to find the dates.
 */
function sharedFacts(
  options: readonly EvaluatedWindow[],
  travellerCount: number,
): string | null {
  const same = <T>(pick: (w: EvaluatedWindow) => T) =>
    options.every((w) => pick(w) === pick(options[0]!)) ? pick(options[0]!) : null;

  const days = same((w) => w.window.days);
  const leave = same((w) => w.leaveDays);
  const available = same((w) => w.counts.available);

  const facts: string[] = [];
  if (days !== null) facts.push(`${days} days`);
  if (leave !== null) {
    facts.push(`${leave} leave ${leave === 1 ? "day" : "days"}`);
  }
  if (available !== null) facts.push(`${available} of ${travellerCount} free`);
  return facts.length > 0 ? `All ${facts.join(" · ")}` : null;
}

/** Only what this option does *not* share with the rest. */
function varyingFacts(
  window: EvaluatedWindow,
  options: readonly EvaluatedWindow[],
  travellerCount: number,
): string {
  const differs = <T>(pick: (w: EvaluatedWindow) => T) =>
    options.some((w) => pick(w) !== pick(options[0]!));

  const facts: string[] = [];
  if (differs((w) => w.window.days)) facts.push(`${window.window.days} days`);
  if (differs((w) => w.leaveDays)) {
    facts.push(`${window.leaveDays} leave`);
  }
  if (differs((w) => w.counts.available)) {
    facts.push(`${window.counts.available} of ${travellerCount}`);
  }
  if (window.counts.rosterPending > 0) {
    facts.push(`${window.counts.rosterPending} pending`);
  }
  return facts.length > 0 ? ` · ${facts.join(" · ")}` : "";
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

/**
 * One fact per line.
 *
 * "Japan · 5–7 days (default) · looking at Dec" packs three separate decisions
 * into a single run of middots, and a reader has to parse the punctuation to
 * find the one they care about. Stacked, each is answerable on its own.
 */
function header(input: CardInput): string[] {
  const lines = [formatDestinations(input.destinations)];

  if (input.durationMinDays !== null && input.durationMaxDays !== null) {
    // Marked when we assumed it, so nobody mistakes our guess for the group's
    // decision — and so it reads as something they are invited to change.
    const assumed = input.durationDefaulted ? " (default)" : "";
    lines.push(
      `${formatDuration(input.durationMinDays, input.durationMaxDays)}${assumed}`,
    );
  }
  if (input.horizonStart && input.horizonEnd) {
    const source = input.horizonDerived ? " — from what you've said" : "";
    lines.push(
      `${formatDateRange(input.horizonStart, input.horizonEnd)}${source}`,
    );
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
      formatTripDates(input.selected.start, input.selected.end, { showYear: true }),
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
    // The worked examples used to live here and were repeated on every card.
    // They are onboarding, not status: useful exactly once, which is where the
    // join message already says them. What belongs on a card is what is
    // happening and what is still needed.
    lines.push("Listening here — say when you're free and I'll work it out.");

    // Name who we are actually waiting on. More useful than a tutorial, and it
    // is the thing that moves the trip along.
    const waiting = travellers(input.participants)
      .filter((p) => p.declarations.length === 0)
      .map((p) => p.displayName);
    if (waiting.length > 0) {
      lines.push("", `Waiting on ${joinNames(waiting)}.`);
    }

    // Acknowledge anything already heard that isn't a date, so the card never
    // looks like it ignored someone. One line per person: a comma-joined run
    // stops being readable the moment a second person is in it.
    const notes = notedLines(input.participants);
    if (notes.length > 0) lines.push("", "Noted so far:", ...notes);

    lines.push("", "/dates · /calendar · /pause", input.tripUrl);
    return lines.join("\n");
  }

  if (feasible.length > 0) {
    const options = input.shortlist ?? feasible.slice(0, input.shortlistSize ?? 5);
    const size = input.shortlistSize ?? options.length;

    if (options.length === 1) {
      const only = options[0]!;
      lines.push(
        "One window works for everyone",
        `${formatTripDates(only.window.start, only.window.end)} · ${only.window.days} days`,
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
      // Whatever is the same on every row is stated once, above them. A
      // shortlist where each line reads "5d · 2/4 · 3 leave" makes the reader
      // scan three times to learn nothing — the dates are the only thing that
      // actually differs, so the dates are all that is left on the row.
      const shared = sharedFacts(options, travellers(input.participants).length);
      if (shared) lines.push(shared, "");

      options.forEach((w, index) => {
        lines.push(
          `${index + 1}. ${formatTripDates(w.window.start, w.window.end)}` +
            varyingFacts(w, options, travellers(input.participants).length),
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
      `Closest: ${formatTripDates(best.window.start, best.window.end)} · ${best.window.days} days`,
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
