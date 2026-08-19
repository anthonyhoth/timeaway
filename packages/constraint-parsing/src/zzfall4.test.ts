import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseDestinationEdits } from "./grammar/destination.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";
const CTX = { today: "2026-08-17", horizonStart: "2026-10-01", horizonEnd: "2027-06-30", destination: null } as const;
const M = [
 "idm nov","idm any","idm anything","idm when","idm where","idw nov","idw go nov",
 "mc","on mc","kena mc","hosp leave","no pay leave nov","npl nov","npl","ol nov",
 "cl nov","wfh nov","wfh cannot","childcare leave","exam nov","exams nov","paper nov",
 "fyp nov","internship nov","attachment nov","clinical nov","posting nov","call duty nov",
 "night shift nov","nite shift nov","shift nov","roster nt out","roster nt out yet",
 "duty roster nt out","dun have roster yet","waiting roster","w8 roster",
 "10-15 nov ok","10-15 nov can","10 to 15 nov cmi","nov 10-15 cmi","20nov-25nov",
 "1 wk in dec","a wk in dec","any wk in dec","whichever wk in dec","either wk in dec",
 "unsay","i unsay","take back","take back what i said","paiseh cannot","paiseh cmi",
 "sorry ah cannot","sry cmi","cannot le","cannot liao lah","cannot d","done deal",
 "confirm liao","chop chop","ok chop","booked","i book flight liao","flight booked",
 "i alr book","alr book","gg cannot go","lagi cannot","tak boleh","boleh","boleh can",
 "can sia","can leh","can lor","can one","can bo","can anot","can a not","can not",
 "no lah","yes lah","yalor","ya lor","yalorh","true lah","agree","i agree","agreed",
 "ok can","ok lah can","okok","oki","okie","okiedokie","kk","k","kthx",
];
it("f4", () => {
  const out: string[] = [];
  for (const m of M) {
    const gate = mightContainConstraint(m);
    const av = parseAvailabilityMessage(m, CTX as never);
    const teS = parseTripEdit(m,"2026-08-17",["Japan","Korea"],{});
    const teU = parseTripEdit(m,"2026-08-17",["Japan","Korea"],{horizonUnset:true});
    const de = parseDestinationEdits(m,"2026-08-17",["Japan","Korea"]);
    const no = parseParticipantNote(m); const pa = parseParticipationChange(m); const re = parseReversal(m);
    const any = av||teS||de.length>0||no||pa||re;
    out.push(`${!gate?"A-GATED":any?"CLAIM":"B-NOCLAIM"} | ${JSON.stringify(m)} | av=${JSON.stringify(av)} | teS=${JSON.stringify(teS)} | teU=${JSON.stringify(teU)} | de=${JSON.stringify(de)} | note=${JSON.stringify(no)} | part=${JSON.stringify(pa)} | rev=${JSON.stringify(re)}`);
  }
  writeFileSync("/tmp/fall4.txt", out.join("\n"));
});
