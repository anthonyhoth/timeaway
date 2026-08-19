import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseDestinationEdits, parseDestinationObjection } from "./grammar/destination.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";

const CTX = { today: "2026-08-17", horizonStart: "2026-10-01", horizonEnd: "2027-06-30", destination: null } as const;
const DESTS = ["Japan", "Korea"];

const MESSAGES: string[] = [
  // holidays & SG calendar
  "cny cannot", "cny period cannot", "after cny can", "hari raya cannot",
  "deepavali long wkend", "gd fri long wkend", "good fri", "natl day",
  "ndp wkend", "chinese new year cannot", "cny lah", "reunion dinner cannot",
  "qing ming", "hungry ghost month cannot", "7th month", "school hols",
  "sch hols only", "june hols", "dec hols", "mar hols", "sept hols",
  // clipped dates
  "fri to sun", "fri-sun", "thurs to sun", "thu-sun", "sat sun only",
  "wkends only", "wkend only", "wkdays cannot", "weekdays cannot",
  "1st wk nov", "2nd wk nov", "last wk nov", "mid nov", "end nov",
  "nov 1st wk", "nov ltr half", "nov 2nd half", "eoy", "yr end",
  "cd of nov", "nx mth", "nxt mth", "nx yr", "nxt yr", "this yr end",
  "b4 dec", "aft dec", "aft cny", "b4 cny", "ard nov", "abt nov",
  "nov ish", "novish", "novemberish", "nov onwards", "from nov",
  "13-16 nov", "13 to 16 nov", "13/11", "13.11", "nov 13-16",
  // participation & deferral
  "sian dun wan go", "dun feel like going", "no mood", "no mood lah",
  "aiya forget it", "forget it lah", "call off", "call it off",
  "postpone", "postpone lah", "delay to next yr", "push to next yr",
  "let's push back", "shelve first", "park first", "hold first",
  "rain check", "raincheck", "next time can", "maybe next time",
  "i tag along", "can i tag along", "i join", "i join can", "join",
  "i wan join", "wan join", "count mi in", "cnt me in", "im down",
  "down", "down for it", "keen", "keen keen", "keen af", "so keen",
  "i keen", "sign me up", "put my name", "add me", "add me pls",
  // budget more
  "how much ah", "budget how much", "per pax how much", "pax 1k?",
  "1k per pax", "1k pp", "1k/pax", "under 1k pp", "ard 1.2k",
  "1.2k", "cannot exceed 1k", "1k limit", "limit 1k", "capped at 1k",
  "my budget 800", "i can only 800", "800 max for me", "800 tops",
  // destination clipped
  "jp", "kr", "tw", "vn", "sk", "hk", "kl", "jb", "bkk", "bali",
  "jp lah", "jp lor", "how abt jp", "how abt taiwan", "hw abt taiwan",
  "wat abt taiwan", "wad abt taiwan", "taiwan?", "taiwan can anot",
  "taiwan can not", "taiwan can bo", "japan pls", "japan plz",
  "japan ba", "korea ok bo", "i vote taiwan", "vote taiwan", "taiwan 1",
];

function j(v: unknown) { return JSON.stringify(v); }

it("fall2", () => {
  const out: string[] = [];
  for (const m of MESSAGES) {
    const gate = mightContainConstraint(m);
    const av = parseAvailabilityMessage(m, CTX as never);
    const teSet = parseTripEdit(m, "2026-08-17", DESTS, {});
    const teUnset = parseTripEdit(m, "2026-08-17", DESTS, { horizonUnset: true });
    const de = parseDestinationEdits(m, "2026-08-17", DESTS);
    const ob = parseDestinationObjection(m, "2026-08-17");
    const no = parseParticipantNote(m);
    const pa = parseParticipationChange(m);
    const re = parseReversal(m);
    const anyClaim = av !== null || teSet !== null || de.length > 0 || no !== null || pa !== null || re !== null;
    const status = !gate ? "A-GATED" : anyClaim ? "CLAIM" : "B-NOCLAIM";
    out.push(`${status} | ${j(m)} | av=${j(av)} | teSet=${j(teSet)} | teUnset=${j(teUnset)} | de=${j(de)} | obj=${j(ob)} | note=${j(no)} | part=${j(pa)} | rev=${j(re)}`);
  }
  writeFileSync("/tmp/fall2.txt", out.join("\n"));
});
