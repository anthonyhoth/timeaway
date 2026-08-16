import type { PublicTripView } from "@timeaway/database";
import type {
  EvaluatedWindow,
  ParticipantDiagnostic,
  RankedWindows,
} from "@timeaway/trip-engine";
import { BRAND } from "../theme.js";
import {
  formatDateRange,
  formatDestinations,
  formatDuration,
} from "@timeaway/shared";
import { Layout, Logo } from "./layout.js";

interface StatusLine {
  colour: string;
  text: string;
}

/**
 * Per-person status only — never per-day availability, which §15 classifies
 * as private and this page is unauthenticated (docs/DECISIONS.md).
 */
function statusLines(
  window: EvaluatedWindow,
  view: PublicTripView,
): StatusLine[] {
  const nameOf = (index: number) => view.participants[index]?.firstName ?? "Someone";
  const lines: StatusLine[] = [];

  window.participants.forEach((p, index) => {
    const name = nameOf(index);
    if (p.status === "AVAILABLE") {
      lines.push({ colour: BRAND.available, text: `${name} — can make it` });
    } else if (p.status === "MAYBE" && p.dayCounts.unknown > 0) {
      lines.push({ colour: BRAND.unknown, text: `${name} — roster not out yet` });
    } else if (p.status === "MAYBE") {
      lines.push({ colour: BRAND.maybe, text: `${name} — maybe` });
    } else if (p.status === "UNAVAILABLE") {
      lines.push({ colour: BRAND.cant, text: `${name} — can’t make it` });
    } else {
      lines.push({ colour: BRAND.jetlag, text: `${name} — no dates yet` });
    }
  });

  return lines;
}

function WindowCard({
  window,
  view,
  headline,
}: {
  window: EvaluatedWindow;
  view: PublicTripView;
  headline: string;
}) {
  return (
    <div class="card" style="border-radius:24px;padding:30px">
      <p
        style={`font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.jetlag}`}
      >
        {headline}
      </p>
      <h2 style="font-size:clamp(30px,5vw,42px);margin:12px 0 6px">
        {formatDateRange(window.window.start, window.window.end)}
      </h2>
      <p class="muted" style="font-size:16px;margin-bottom:22px">
        {window.window.days} days · {window.leaveDays}{" "}
        {window.leaveDays === 1 ? "leave day" : "leave days"}
      </p>
      <div style="display:grid;gap:10px">
        {statusLines(window, view).map((line) => (
          <div style={`font-size:16px;font-weight:600;color:${line.colour}`}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TripPage({
  view,
  ranked,
  diagnostics = [],
  botUrl,
}: {
  view: PublicTripView;
  ranked: RankedWindows;
  diagnostics?: readonly ParticipantDiagnostic[];
  botUrl: string;
}) {
  const destination = formatDestinations(view.destinationCandidates);
  const settled =
    view.status === "DATE_SELECTED" && view.selectedStart && view.selectedEnd;
  // Same rule as the bot card: every window is technically feasible before
  // anyone answers, so calling the first one a match would be misleading.
  const hasAnyDates = view.participants.some((p) => p.declarations.length > 0);
  const best = hasAnyDates
    ? (ranked.feasible[0] ?? ranked.nearMisses[0])
    : undefined;
  const nameOfIndex = (id: string) =>
    view.participants[Number(id)]?.firstName ?? "Someone";

  return (
    <Layout
      title={`${destination} — Timeaway`}
      description={`Trip planning for ${destination}. See the dates that work for everyone.`}
    >
      <header class="wrap" style="padding:26px 0">
        <Logo />
      </header>

      <section class="wrap" style="max-width:640px;padding:16px 0 8px">
        <p
          style={`font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.layover}`}
        >
          {settled ? "Dates confirmed" : "Planning in progress"}
        </p>
        <h1 style="font-size:clamp(32px,5.4vw,46px);margin:12px 0 8px">
          {destination}
        </h1>
        <p class="muted" style="font-size:17px">
          {view.durationMinDays !== null && view.durationMaxDays !== null
            ? formatDuration(view.durationMinDays, view.durationMaxDays)
            : "Duration not set"}
          {view.horizonStart && view.horizonEnd
            ? ` · looking at ${formatDateRange(view.horizonStart, view.horizonEnd)}`
            : ""}
        </p>
      </section>

      <section class="wrap" style="max-width:640px;padding:24px 0 8px">
        {settled ? (
          <div
            class="card"
            style={`border-radius:24px;padding:32px;background:${BRAND.horizon};color:#fff;border:none`}
          >
            <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9">
              It’s happening
            </p>
            <h2 style="font-size:clamp(32px,5.4vw,46px);margin:12px 0 0;color:#fff">
              {formatDateRange(view.selectedStart!, view.selectedEnd!)}
            </h2>
          </div>
        ) : best ? (
          <WindowCard
            window={best}
            view={view}
            headline={
              ranked.feasible.length > 0
                ? "Best match so far"
                : "Closest — doesn’t work for everyone yet"
            }
          />
        ) : (
          <div class="card" style="border-radius:24px;padding:32px;text-align:center">
            <h2 style="font-size:24px;margin-bottom:10px">No dates yet</h2>
            <p class="muted" style="font-size:16px">
              Nobody has shared dates yet. Say when you’re free in the group
              chat and this page updates.
            </p>
            {view.participants.some((p) => p.maxLeaveDays !== null) && (
              <p class="muted" style="font-size:15px;margin-top:16px">
                Noted so far:{" "}
                {view.participants
                  .filter((p) => p.maxLeaveDays !== null)
                  .map((p) => `${p.firstName} up to ${p.maxLeaveDays} leave days`)
                  .join(", ")}
              </p>
            )}
          </div>
        )}
      </section>

      {ranked.feasible.length > 1 && (
        <section class="wrap" style="max-width:640px;padding:18px 0">
          <p
            style={`font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.jetlag};margin-bottom:12px`}
          >
            Also works
          </p>
          <div style="display:grid;gap:10px">
            {ranked.feasible.slice(1, 4).map((w) => (
              <div
                class="card"
                style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-radius:16px"
              >
                <span style="font-weight:600;font-size:16px">
                  {formatDateRange(w.window.start, w.window.end)}
                </span>
                <span class="muted" style="font-size:15px">
                  {w.leaveDays} leave · {w.counts.available} in
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {diagnostics.length > 0 && (
        <section class="wrap" style="max-width:640px;padding:18px 0">
          <p
            style={`font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.jetlag};margin-bottom:12px`}
          >
            Worth sorting out
          </p>
          <div style="display:grid;gap:10px">
            {diagnostics.map((d) => {
              const name = nameOfIndex(d.participantId);
              if (d.kind === "LEAVE_CAP_BLOCKS_ALL") {
                return (
                  <div class="card" style="border-radius:16px;padding:18px 20px">
                    <p style="font-weight:600;font-size:16px">
                      {name} has {d.maxLeaveDays} leave{" "}
                      {d.maxLeaveDays === 1 ? "day" : "days"}; the shortest
                      option here costs {d.cheapestWindowLeave}.
                    </p>
                    <p class="muted" style="font-size:15px;margin-top:6px">
                      {d.longestAffordableDays > 0
                        ? `${name} could manage about ${d.longestAffordableDays} days — shorten the trip, or plan a short one with ${name} separately.`
                        : `Shorten the trip, or plan this one without ${name}.`}
                    </p>
                  </div>
                );
              }
              const elsewhere =
                d.kind === "BLOCKED_ACROSS_HORIZON"
                  ? d.availableElsewhere
                  : d.statedRanges;
              const said = elsewhere
                .map((r) => formatDateRange(r.start, r.end))
                .join(", ");
              return (
                <div class="card" style="border-radius:16px;padding:18px 20px">
                  <p style="font-weight:600;font-size:16px">
                    {said
                      ? `${name} can’t do these dates, but said ${said} works.`
                      : `${name} can’t do any of these dates.`}
                  </p>
                  <p class="muted" style="font-size:15px;margin-top:6px">
                    {said
                      ? `Move the trip, or plan this one without ${name}.`
                      : `Widen the dates, or plan this one without ${name}.`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Primary CTA: the bot works today, so this beats a waitlist ask. */}
      <section class="wrap" style="max-width:640px;padding:34px 0 20px">
        <div
          class="card"
          style="border-radius:24px;padding:30px;text-align:center"
        >
          <h2 style="font-size:24px;margin-bottom:10px">
            Planning something yourself?
          </h2>
          <p class="muted" style="font-size:16px;margin-bottom:22px">
            Timeaway finds dates that work for your whole group — free, and your
            friends don’t need to install anything.
          </p>
          <a class="btn btn-primary" href={botUrl}>
            Start your own trip
          </a>
          <p class="muted" style="font-size:14px;margin-top:16px">
            Want the app instead?{" "}
            <a href="/" style={`color:${BRAND.layover};font-weight:600`}>
              Join the waitlist
            </a>
          </p>
        </div>
      </section>

      <footer
        style={`border-top:1px solid ${BRAND.contrail};padding:30px 0;margin-top:30px`}
      >
        <div class="wrap" style="text-align:center">
          <p class="muted" style="font-size:14px">
            timeaway · find the days that work.
          </p>
        </div>
      </footer>
    </Layout>
  );
}
