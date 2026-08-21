/**
 * Replays corpora and reports only what looks *wrong*, so a defect does not
 * have to be spotted by reading every line.
 *
 * Each smell below is a shape that was a real bug at least once: the point is
 * not that a flagged verdict is definitely wrong, it is that the flagged set is
 * small enough to check by hand while the full transcript is not.
 *
 *   pnpm tsx src/scripts/triage.ts <dir-of-json-corpora>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runConversation, type Message, type Verdict } from "../harness.js";
import { namesKnownDestination } from "../grammar/proposals.js";
import { namesRecurringPeriod } from "../grammar/opaque.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: triage.ts <dir-of-json-corpora>");
  process.exit(1);
}

const today = "2026-08-21" as const;
const ctx = {
  today,
  horizonStart: "2026-10-01" as const,
  horizonEnd: "2027-06-30" as const,
  destination: null,
};

/** Words that mean the speaker is refusing or blocking, not proposing. */
const REJECTION =
  /\b(?:not|no|out|dead|die|cannot|can'?t|cmi|nvr|never|dun|don'?t|sian|jialat|scrap|drop|forget|nvm|scratch)\b/i;
/** The speaker is talking about themselves. */
const FIRST_PERSON = /\b(?:i|i'?m|im|my|me|myself|i'?ve|ive|i'?d)\b/i;
/** Someone who is not in the chat. */
const THIRD_PARTY = /\b(?:he|she|they|his|her|their|asked if|says?|said)\b/i;

const days = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  ) + 1;

interface Smell {
  code: string;
  why: string;
}

/** The spans each speaker's last declaration recorded, for the no-op check. */
const prevSpans = new Map<string, string>();

function smellsOf(v: Verdict): Smell[] {
  const out: Smell[] = [];
  const d = v.detail;

  if (v.outcome === "TRIP_EDIT") {
    if (REJECTION.test(v.text))
      out.push({ code: "EDIT-FROM-REJECTION", why: "moves the trip on a refusal" });
    if (FIRST_PERSON.test(v.text))
      out.push({ code: "EDIT-FROM-SELF", why: "a message about the speaker moved the plan" });
    if (THIRD_PARTY.test(v.text))
      out.push({ code: "EDIT-FROM-THIRD-PARTY", why: "someone else's dates moved the plan" });
    // A horizon one or two days wide is never a trip search window.
    const horizon = /"horizon":\{"start":"([\d-]+)","end":"([\d-]+)"\}/.exec(d);
    if (horizon && days(horizon[1]!, horizon[2]!) <= 2)
      out.push({ code: "EDIT-HORIZON-TOO-NARROW", why: `${days(horizon[1]!, horizon[2]!)}-day horizon` });
    if (/"duration"/.test(d) && /\b(?:leave|al|off|shift|ict|reservist)\b/i.test(v.text))
      out.push({ code: "EDIT-DURATION-FROM-LEAVE", why: "leave arithmetic became trip length" });
  }

  if (v.outcome === "AVAILABILITY") {
    const spans = [...d.matchAll(/"start":"([\d-]+)","end":"([\d-]+)"/g)];
    for (const s of spans) {
      const n = days(s[1]!, s[2]!);
      if (n > 120) out.push({ code: "AVAIL-SPAN-HUGE", why: `${n}-day declaration` });
      if (n === 1 && /\b(?:to|till|until|onwards?|after|from|week|weeks)\b/i.test(v.text))
        out.push({ code: "AVAIL-SPAN-COLLAPSED", why: "a range read as one day" });
    }
    if (THIRD_PARTY.test(v.text) && !FIRST_PERSON.test(v.text))
      out.push({ code: "AVAIL-THIRD-PARTY", why: "recorded someone else's dates as the speaker's" });
    // This tool missed "ok sept dead" recording the speaker as free for the
    // whole month, because a 30-day span is not a huge one. Only an AVAILABLE
    // reading counts: "count me out for march" also carries a rejection word
    // and correctly produces UNAVAILABLE, which is not the bug.
    const claimsFree = /"state":"AVAILABLE"/.test(d);
    const optingOut = /\b(?:count me out|me out|i'?m out|im out|opt(?:ing)? out)\b/i.test(v.text);
    if (claimsFree && !optingOut &&
        /\b(?:dead|die|died|gone|cancelled|scrapped|off the table)\b/i.test(v.text))
      out.push({ code: "AVAIL-ON-REJECTION", why: "declared free on a period being ruled out" });
  }

  // A message naming several windows should not come back with one. The
  // teacher listing three school holidays had two of them silently dropped,
  // and nothing in this tool could see it.
  if (v.outcome === "AVAILABILITY") {
    // Real month spellings only: "mar[a-z]*" also matches "mark", which had
    // this flagging a message about exam marking as naming two windows.
    const months = new Set(
      (v.text
        .toLowerCase()
        .match(
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g,
        ) ?? []).map((m) => m.slice(0, 3)),
    );
    const ranges = (v.text.match(/\d{1,2}(?:\/\d{1,2})?\s*(?:-|–|to)\s*\d{1,2}/g) ?? []).length;
    const named = Math.max(months.size, ranges);
    const claimed = (d.match(/"start"/g) ?? []).length;
    if (named >= 2 && claimed < named)
      out.push({
        code: "AVAIL-WINDOWS-DROPPED",
        why: `message names ${named} windows, recorded ${claimed}`,
      });
  }

  // The Cry / CENT / Again class: a destination nobody would recognise, from a
  // word that was never capitalised in the original either.
  if (v.outcome === "TRIP_EDIT" || v.outcome === "OPTION_REFERENCE") {
    for (const m of d.matchAll(/"destinations":\[([^\]]*)\]/g)) {
      for (const raw of m[1]!.matchAll(/"([^"]+)"/g)) {
        const name = raw[1]!;
        if (name === "ADD" || name === "REMOVE" || name === "REPLACE") continue;
        const known = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const titleCased = new RegExp(`\\b${name}\\b`).test(v.text);
        if (!titleCased && known.test(v.text) && !namesKnownDestination(name))
          out.push({ code: "EDIT-DEST-SUSPECT", why: `"${name}" is unrecognised and was never capitalised` });
      }
    }
  }

  // Assent joins the shortlist; it must never clear it.
  if (/"op":"REPLACE"/.test(d) &&
      /\b(?:idm|dun ?mind|don'?t mind|chin ?chai|also can|up to (?:you|u|yall))\b/i.test(v.text))
    out.push({ code: "EDIT-REPLACE-FROM-ASSENT", why: "agreeing to a place cleared the others" });

  // A recurring period we cannot place should be asked about, not recorded.
  if (v.outcome === "AVAILABILITY" && namesRecurringPeriod(v.text))
    out.push({ code: "AVAIL-RECURRING-GUESS", why: "guessed one instance of a recurring period" });

  if (v.outcome === "CONTINUATION") {
    const prev = /joined to "([^"]*)"/.exec(d)?.[1] ?? "";
    // A fragment that continues a dates statement should share some vocabulary
    // with it, or at least name a period.
    const sharesTime =
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|weekend|day|days|month|first|last|half)\b|\d/i;
    // A continuation exists to narrow or extend the previous reading. When the
    // join produces exactly what was already recorded, the fragment added
    // nothing — and tryContinuation deletes and rewrites the declarations, so
    // whatever the fragment did say is silently discarded. "12-19 can" after
    // "ICT 9-20 mar" was swallowed whole this way.
    const joinedSpans = (d.match(/"start":"[\d-]+","end":"[\d-]+"/g) ?? []).join("|");
    if (prevSpans.has(v.speaker) && prevSpans.get(v.speaker) === joinedSpans)
      out.push({ code: "CONT-NO-OP", why: `"${v.text}" changed nothing and was absorbed` });

    if (!sharesTime.test(v.text))
      out.push({ code: "CONT-NO-TIME", why: `attached "${v.text}" to "${prev}"` });
  }

  if (v.outcome === "NOTE_ONLY" || v.noted) {
    if (/DESTINATION_OBJECTION/.test(d) && /\b(?:idm|dun ?mind|don'?t mind|ok|fine|can|like|love|nice|shiok)\b/i.test(v.text))
      out.push({ code: "NOTE-SENTIMENT-INVERTED", why: "assent recorded as an objection" });
    if (/BUDGET/.test(d) && !/\$\s?[\d,]+|\b(?:budget|ex|expensive|cheap(?:est|er)?|afford|broke|money|cost|price|fare|\d+\s*k\b|pay|spend)\b/i.test(v.text))
      out.push({ code: "NOTE-BUDGET-NO-MONEY", why: "budget note with no money in the message" });
  }

  if (v.outcome === "AVAILABILITY" || v.outcome === "CONTINUATION") {
    prevSpans.set(v.speaker, (d.match(/"start":"[\d-]+","end":"[\d-]+"/g) ?? []).join("|"));
  }
  return out;
}

let all: { file: string; index: number; v: Verdict; smells: Smell[] }[] = [];
let total = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  let messages: Message[];
  try {
    messages = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    console.error(`!! ${file}: bad JSON — ${(e as Error).message}`);
    continue;
  }
  const verdicts = runConversation(messages, { ctx, current: ["Japan"], horizonUnset: false });
  total += verdicts.length;
  verdicts.forEach((v, i) => {
    const smells = smellsOf(v);
    if (smells.length > 0) all.push({ file, index: i + 1, v, smells });
  });
}

const byCode = new Map<string, number>();
for (const row of all) for (const s of row.smells) byCode.set(s.code, (byCode.get(s.code) ?? 0) + 1);

console.log(`${"=".repeat(78)}`);
console.log(`TRIAGE — ${all.length} suspicious of ${total} messages`);
console.log("=".repeat(78));

for (const [code] of [...byCode].sort((a, b) => b[1] - a[1])) {
  console.log(`\n### ${code}  (${byCode.get(code)})`);
  for (const row of all.filter((r) => r.smells.some((s) => s.code === code))) {
    const why = row.smells.find((s) => s.code === code)!.why;
    console.log(`  [${row.file} #${row.index}] ${row.v.speaker}: ${row.v.text}`);
    console.log(`      ${row.v.outcome} — ${why}`);
    console.log(`      ${row.v.detail}`);
  }
}

console.log(`\n${"-".repeat(78)}`);
for (const [code, n] of [...byCode].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(4)}  ${code}`);
}
