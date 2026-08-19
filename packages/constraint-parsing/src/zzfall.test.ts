import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseDestinationEdits, parseDestinationObjection } from "./grammar/destination.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";
import { parseBudget } from "./grammar/budget.js";

const CTX = { today: "2026-08-17", horizonStart: "2026-10-01", horizonEnd: "2027-06-30", destination: null } as const;
const DESTS = ["Japan", "Korea"];

const MESSAGES: string[] = [
  // --- schedule / availability: clipped forms
  "cfm can", "cfm cannot", "confirm plus chop can", "shld be ok nov",
  "nov shld be fine", "oct can le", "i cfm free dec", "cmi nov",
  "nov cmi", "bo eng nov", "nov bo eng", "i ok w nov", "ok w me",
  "ok wif me", "fine w me", "aok", "can can can", "can can",
  "yup can", "yeah can nov", "yes nov", "ya nov ok", "nov 👍",
  "👍", "👍👍", "🙆", "❌", "🙅‍♂️", "can 👍", "ok 🙏",
  "nov fine by me", "no prob nov", "np nov", "np", "sure thing nov",
  "dec sure", "im ok either", "either also can", "both also can",
  "anything also can", "anyhow can", "up 2 u", "u all decide",
  "u guys decide", "u all say when", "follow u all", "follow lah",
  "i follow", "i chin cai", "chin chai", "anything lah", "watever",
  "whatever also can", "same lah", "same here", "ditto", "+1",
  "+1 for nov", "sama sama", "me too", "me also", "me 3",
  "i also can nov", "i osso can", "nov i die die must go",
  "confirm chop nov", "nov steady", "steady bom pi pi",
  // negatives / clipped
  "nov jialat for me", "nov die la work", "nov si beh busy",
  "cannot lah nov", "nov cannot", "nov no can", "nov nope",
  "nope", "nah", "nah nov cannot", "nov pass", "pass on nov",
  "count me out nov", "nov i skip", "i skip nov", "sorry nov cmi",
  "nov gg", "gg nov", "nov confirm cannot", "nov 🙅", "nov ❌",
  "nov out for me", "i out nov", "out nov", "nov siao meh work",
  "i kena ict nov", "kena reservist nov", "got ict nov",
  "ict nov", "ns nov", "hi key nov", "nov got mob man",
  "atc nov", "got course nov", "nov got wedding",
  "nov i attach", "nov gt work", "nov wk", "nov working",
  "nov ot", "nov got ot", "nov peak", "nov q4 close",
  // leave
  "no al left", "al habis", "al all burnt", "al 0", "0 al",
  "al left 3 only", "got 3 al nia", "3 al nia", "only 3 al",
  "i got 3d al", "3d al", "3 days al", "al not approved",
  "boss dun approve", "boss dun let me take leave", "cannot clear leave",
  "leave rejected", "leave not approve", "cant apply leave",
  "cannot chao keng liao", "no more off", "block leave nov",
  "nov block leave", "leave freeze nov", "cannot take al nov",
  "al must clear by dec", "must clear al by dec", "need to clear al by dec",
  // trip length
  "4d3n", "5d4n", "3d2n can", "make it 4d3n", "4d3n enough",
  "long wkend enough", "long wknd", "lw enough", "1 wk enough",
  "1wk", "abt 5d", "5d", "5days", "abt a wk", "a wk plus",
  "wk long trip", "short trip lah", "short getaway", "quick getaway",
  "cant more than 4d", "max 4d", "min 5d", "4-5d", "4 to 5d",
  // budget
  "too ex la", "damn ex", "expensive sia", "e x p e n s i v e",
  "sian ex", "cannot afford la", "cant afford", "broke af",
  "im broke", "no $$", "no $", "no monies", "pokai", "im pokai",
  "bo lui", "bo luiz", "tio pokai", "budget 1k", "1k budget",
  "under 1k", "abt 1k", "ard 1k", "max 1k", "1k max", "1.5k max",
  "keep it below 1k", "800 can", "800 ok", "800 alr very ex",
  "flight alone 800", "5 bucks also no", "sgd800", "$800 nia",
  "800 nia", "cheap cheap can", "cheapo trip", "budget trip lah",
  "must be cheap", "wallet cannot take it", "my wallet cries",
  "cannot burn so much", "dun wan spend so much", "spend less lah",
  // destination
  "idm japan", "idm", "idw korea", "idc", "i dw korea",
  "dowan korea", "dowan", "dun wan korea", "bo chap",
  "jp can", "jp?", "kr can", "tw can", "vn can", "th?",
  "bkk can", "hcm can", "hkg?", "kl can", "jb can", "bali can",
  "sk instead", "jpn instead", "japan sian", "japan again ah",
  "japan bo pian", "japan liao lah", "korea siao", "korea meh",
  "y not tw", "tw leh", "tw lah", "how ah tw", "japan or korea",
  "japan boring", "been jp too many times", "just came back from jp",
  "jp 3 times liao", "jp no more", "no more jp", "jp out",
  "swap to korea", "change korea", "korea better", "korea nicer",
  "taiwan cheaper", "vietnam cheapest", "somewhere cheap",
  "somewhere near", "short haul only", "no long haul", "sea only",
  "smth near", "nearby countries only",
  // group dynamics
  "im out", "im in", "count me in", "in", "out", "i in",
  "i out", "im ard", "im arrowed", "chope me a spot", "chope",
  "jio me", "jio", "dun jio me", "dun jio", "no jio",
  "next time lah", "next round", "u all go first", "u all go",
  "go ahead lah", "i sit out", "sit out", "i pangseh",
  "sorry pangseh", "pang seh liao", "i tio pangseh", "im tapping out",
  "tapping out", "i drop out", "drop out", "i zzz", "cmi this trip",
  "cannot make it this round", "maybe next yr", "next yr lah",
  "im back", "im back in", "i rejoin", "put me back in", "add me back",
  "on second thought", "eh actually i can", "actually can",
  "actually cmi", "aiya cmi", "aiyo cannot", "wait i cmi",
  "hold up", "hold on", "wait ah", "smth came up", "sth came up",
  "got smth on", "got sth on", "kena work", "kena arrow",
  "boss arrow me", "nvm i cannot", "nvm", "nvmd", "scratch tt",
  "ignore tt", "disregard", "retract", "cancel that",
  "not anymore", "no longer can", "cmi liao", "cannot liao",
  "changed mind", "chg mind", "plan change", "plans changed",
  // misc typos / elision
  "novemebr can", "nov can??", "novv can", "decemer ok",
  "im fre nov", "fre in nov", "avail nov", "avail",
  "free liao", "free le", "nov free le", "nov ok le",
];

function j(v: unknown) { return JSON.stringify(v); }

it("fall", () => {
  const out: string[] = [];
  for (const m of MESSAGES) {
    const gate = mightContainConstraint(m);
    let av: unknown = null, te: unknown = null, de: unknown = null, no: unknown = null, pa: unknown = null, re: unknown = null, bu: unknown = null, ob: unknown = null;
    try { av = parseAvailabilityMessage(m, CTX as never); } catch (e) { av = "ERR" + e; }
    try { te = parseTripEdit(m, "2026-08-17", DESTS, { horizonUnset: true }); } catch (e) { te = "ERR" + e; }
    try { de = parseDestinationEdits(m, "2026-08-17", DESTS); } catch (e) { de = "ERR" + e; }
    try { ob = parseDestinationObjection(m, "2026-08-17"); } catch (e) { ob = "ERR" + e; }
    try { no = parseParticipantNote(m); } catch (e) { no = "ERR" + e; }
    try { pa = parseParticipationChange(m); } catch (e) { pa = "ERR" + e; }
    try { re = parseReversal(m); } catch (e) { re = "ERR" + e; }
    try { bu = parseBudget(m); } catch (e) { bu = "ERR" + e; }
    const deA = de as unknown[];
    const anyClaim = av !== null || te !== null || (Array.isArray(deA) && deA.length > 0) || no !== null || pa !== null || re !== null;
    const status = !gate ? "A-GATED" : anyClaim ? "CLAIM" : "B-NOCLAIM";
    out.push(`${status} | ${j(m)} | av=${j(av)} | te=${j(te)} | de=${j(de)} | obj=${j(ob)} | note=${j(no)} | part=${j(pa)} | rev=${j(re)} | bud=${j(bu)}`);
  }
  out.push(`TOTAL=${MESSAGES.length}`);
  writeFileSync("/tmp/fall.txt", out.join("\n"));
});
