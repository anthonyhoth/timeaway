/**
 * The prefilter's one hard contract: it may only reject a message no parser
 * downstream would have claimed. This replays a corpus and reports every
 * violation — a message the gate dropped that a parser would have read.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mightContainConstraint } from "../prefilter.js";
import { parseAvailabilityMessage } from "../grammar/availability.js";
import { parseParticipantNote } from "../grammar/notes.js";
import { parseParticipationChange } from "../grammar/participation.js";
import { parseReversal } from "../grammar/reversal.js";
import { parseTripEdit } from "../grammar/trip-edit.js";
import { namesOpaquePeriod } from "../grammar/opaque.js";
import { parseUnderspecifiedSpan } from "../grammar/underspecified.js";
import { parseBudget } from "../grammar/budget.js";
import { parseDestinationEdit } from "../grammar/destination.js";

const dir = process.argv[2];
const today = "2026-08-21" as const;
const ctx = { today, horizonStart: "2026-10-01" as const, horizonEnd: "2027-06-30" as const, destination: null };

const claimers: [string, (t: string) => unknown][] = [
  ["availability", (t) => parseAvailabilityMessage(t, ctx)],
  ["note", (t) => parseParticipantNote(t)],
  ["participation", (t) => parseParticipationChange(t)],
  ["reversal", (t) => parseReversal(t)],
  ["trip-edit", (t) => parseTripEdit(t, today, ["Japan"], { horizonUnset: false })],
  ["opaque", (t) => (namesOpaquePeriod(t) ? "opaque" : null)],
  ["underspecified", (t) => parseUnderspecifiedSpan(t, ctx)],
  ["budget", (t) => parseBudget(t)],
  ["destination", (t) => parseDestinationEdit(t, today, ["Japan"])],
];

let violations = 0;
let total = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const messages = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const m of messages) {
    total++;
    if (mightContainConstraint(m.text)) continue;
    const claimed = claimers.filter(([, fn]) => {
      try { return fn(m.text) != null; } catch { return false; }
    });
    if (claimed.length > 0) {
      violations++;
      console.log(`VIOLATION [${file}] "${m.text}"`);
      for (const [name, fn] of claimed) {
        console.log(`    ${name}: ${JSON.stringify(fn(m.text))}`);
      }
    }
  }
}
console.log(`\n${violations} gate-contract violations across ${total} messages`);
