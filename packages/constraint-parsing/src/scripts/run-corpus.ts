/**
 * Replays generated group-chat corpora through the ambient pipeline and prints
 * a per-message verdict plus a summary.
 *
 *   pnpm tsx src/scripts/run-corpus.ts <dir-of-json-corpora>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runConversation, type Message, type Verdict } from "../harness.js";

const CORPUS_DIR = process.argv[2];
if (!CORPUS_DIR) {
  console.error("usage: run-corpus.ts <dir-of-json-corpora>");
  process.exit(1);
}

// A trip already has a window unless --no-horizon says otherwise: ambient
// capture runs against a live trip, and horizonUnset changes which parser gets
// first refusal on a bare period.
const horizonUnset = process.argv.includes("--no-horizon");
const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: horizonUnset ? null : ("2026-10-01" as const),
  horizonEnd: horizonUnset ? null : ("2027-06-30" as const),
  destination: null,
};

const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".json")).sort();
let grand: Verdict[] = [];

for (const file of files) {
  let messages: Message[];
  try {
    messages = JSON.parse(readFileSync(join(CORPUS_DIR, file), "utf8"));
  } catch (e) {
    console.error(`!! ${file}: bad JSON — ${(e as Error).message}`);
    continue;
  }

  const verdicts = runConversation(messages, {
    ctx,
    current: ["Japan"],
    horizonUnset,
  });
  grand = grand.concat(verdicts);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`CORPUS: ${file}  (${messages.length} messages)`);
  console.log("=".repeat(78));

  verdicts.forEach((v, i) => {
    console.log(
      `${String(i + 1).padStart(3)} ${v.outcome.padEnd(20)} ${v.speaker}: ${v.text}`,
    );
    if (v.detail) {
      const note = v.noted && v.outcome !== "NOTE_ONLY" ? " [+note]" : "";
      console.log(`    -> ${v.detail}${note}`);
    }
  });

  const counts = new Map<string, number>();
  for (const v of verdicts) counts.set(v.outcome, (counts.get(v.outcome) ?? 0) + 1);
  console.log(`\n-- ${file} summary --`);
  for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(
      `   ${String(n).padStart(4)}  ${k}  (${((n / verdicts.length) * 100).toFixed(1)}%)`,
    );
  }
}

console.log(`\n${"#".repeat(78)}`);
console.log(`GRAND TOTAL: ${grand.length} messages`);
console.log("#".repeat(78));
const gc = new Map<string, number>();
for (const v of grand) gc.set(v.outcome, (gc.get(v.outcome) ?? 0) + 1);
for (const [k, n] of [...gc].sort((a, b) => b[1] - a[1])) {
  console.log(
    `${String(n).padStart(5)}  ${k}  (${((n / grand.length) * 100).toFixed(1)}%)`,
  );
}
