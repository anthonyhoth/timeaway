import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { mightContainConstraint } from "./prefilter.js";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
import { parseDestinationEdit } from "./grammar/destination.js";
import { parseParticipantNote } from "./grammar/notes.js";
import { parseParticipationChange } from "./grammar/participation.js";
import { parseReversal } from "./grammar/reversal.js";
import { parseUnderspecifiedSpan } from "./grammar/underspecified.js";
import { parseMultiSpan } from "./grammar/multi-span.js";
import { resolveHorizon } from "./grammar/horizon.js";
import type { ExtractionContext } from "./types.js";

const MESSAGES: [string, string][] = [
  // ---------- 1. SCHEDULE ----------
  ["S", "eh guys i free whole of nov leh"],
  ["S", "cannot dec sia got ict"],
  ["S", "i got ict 12 to 23 nov"],
  ["S", "reservist in oct cmi"],
  ["S", "my ict dates just came out 5-16 october die"],
  ["S", "bo eng that week ah"],
  ["S", "i only got 8 al left for the year"],
  ["S", "al all burnt liao cannot take leave"],
  ["S", "still got 12 al can afford long trip"],
  ["S", "boss say cannot clear leave in q4"],
  ["S", "my company block leave dec"],
  ["S", "blackout period nov to jan for my dept"],
  ["S", "i take leave 20-27 dec confirm"],
  ["S", "applying al for the first week of dec"],
  ["S", "roster not out yet lah"],
  ["S", "my roster only comes out 2 weeks before"],
  ["S", "im on night shift that whole week cmi"],
  ["S", "working shift dec 1 to 7"],
  ["S", "got exam till 15 nov after that free"],
  ["S", "exams end 20 nov so anything after can"],
  ["S", "sherlyn wedding 14 nov cannot"],
  ["S", "got wedding to attend that weekend"],
  ["S", "im jiemui for my cousin wedding in dec cmi"],
  ["S", "school hols dec i can go"],
  ["S", "can only do school holidays cos my gf teacher"],
  ["S", "chinese new year period cannot lah"],
  ["S", "cny cmi family thing"],
  ["S", "deepavali long weekend can?"],
  ["S", "got ph on 20 nov leh good time to go"],
  ["S", "i free 3-9 nov"],
  ["S", "free 3/11 to 9/11"],
  ["S", "cannot make it 12/12-15/12"],
  ["S", "nov 15 onwards i free"],
  ["S", "anytime after 20 dec can"],
  ["S", "before cny please"],
  ["S", "i free first two weeks of dec"],
  ["S", "last week of nov good for me"],
  ["S", "mid dec cannot early dec can"],
  ["S", "free in oct last 2 weeks, nov 1st week and dec 3rd week"],
  ["S", "cmi nov but dec can"],
  ["S", "i can do either nov or dec"],
  ["S", "not free 2 weeks in nov"],
  ["S", "need a week in dec"],
  ["S", "i can take max 3 days leave only"],
  ["S", "cant take more than 4 days off"],
  ["S", "got 5 days leave left only"],
  ["S", "i can only take fri mon type of leave"],
  ["S", "weekday cannot weekend can only"],
  ["S", "i knock off late but weekends free"],
  ["S", "im free whenever"],
  ["S", "anytime works for me"],
  ["S", "up to you guys i flexible"],
  ["S", "i dun mind any dates"],
  ["S", "confirm cannot dec im flying for work"],
  ["S", "work trip to shanghai in nov"],
  ["S", "attachment ends dec so after that free"],
  ["S", "i got mob manning that week"],
  ["S", "high key ict this year sian"],
  ["S", "recalled for ops manning cannot confirm yet"],
  ["S", "my ns reservist is usually oct so try avoid"],
  ["S", "got bto appointment dec 5 cannot"],
  ["S", "renovation starting dec i very tied up"],
  ["S", "kena posted to new team cannot take leave first 3 months"],
  ["S", "just started new job cannot take leave until dec"],
  ["S", "i still on probation until nov cannot apply al"],
  ["S", "im on mc now but should be ok by nov"],
  ["S", "sat sun only for me"],
  ["S", "public holiday 25 dec can go one"],
  ["S", "i free from 20 dec till 2 jan"],
  ["S", "20 dec till 2 jan i free"],
  ["S", "i can take leave anytime just tell me the dates"],
  ["S", "let me check with my boss first"],
  ["S", "need to confirm with my supervisor"],
  ["S", "wait i check my roster then lyk"],
  ["S", "i tbc first ah"],

  // ---------- 2. DESTINATION ----------
  ["D", "how about taiwan"],
  ["D", "japan can?"],
  ["D", "lets go korea"],
  ["D", "bali also can"],
  ["D", "taiwan is fine too"],
  ["D", "why not vietnam"],
  ["D", "hainan not bad leh"],
  ["D", "what about da nang"],
  ["D", "add penang to the list"],
  ["D", "korea instead lah"],
  ["D", "drop japan too ex"],
  ["D", "japan is out"],
  ["D", "no more japan pls"],
  ["D", "i just went korea last year dont want go again"],
  ["D", "been there done that"],
  ["D", "taiwan vs japan which one"],
  ["D", "korea or japan?"],
  ["D", "i vote for taiwan"],
  ["D", "im keen on da nang"],
  ["D", "seoul in winter shiok"],
  ["D", "bangkok lah cheap and near"],
  ["D", "jb one night can already"],
  ["D", "batam or bintan"],
  ["D", "somewhere near lah dont want long flight"],
  ["D", "anywhere with beach"],
  ["D", "as long as got good food"],
  ["D", "aircon country pls i cannot take heat"],
  ["D", "chiang mai in nov is damn nice"],
  ["D", "ok lah taiwan"],
  ["D", "no strong feelings about where"],
  ["D", "korea leh"],
  ["D", "hokkaido can or not"],
  ["D", "throw in kaohsiung as an option"],
  ["D", "cross off bangkok too hot"],
  ["D", "actually lets do osaka"],
  ["D", "the weather is fine too"],
  ["D", "the food there is not bad"],
  ["D", "lets eat later then discuss"],
  ["D", "lets talk about it tmr"],
  ["D", "my gf wants to go jeju"],

  // ---------- 3. BUDGET ----------
  ["B", "japan too ex lah"],
  ["B", "budget max 1500"],
  ["B", "i can only spend around 1k"],
  ["B", "under 1200 can?"],
  ["B", "flight alone already 800 sia"],
  ["B", "i broke until end of the year"],
  ["B", "can we keep it below $1000"],
  ["B", "korea damn expensive now with the exchange rate"],
  ["B", "split the airbnb how"],
  ["B", "lets each pay our own then settle later"],
  ["B", "i need to save up abit first"],
  ["B", "money tight this quarter"],
  ["B", "if got cheap flight then can"],
  ["B", "scoot promo 200 return only"],
  ["B", "1500 per pax too much for me"],
  ["B", "cheaper option any?"],
  ["B", "hotel around 100 a night ok?"],
  ["B", "i pay first you all paynow me"],

  // ---------- 4. TRIP SHAPE ----------
  ["T", "5 days enough?"],
  ["T", "lets do 4d3n"],
  ["T", "one week trip"],
  ["T", "long weekend is enough for jb"],
  ["T", "at least 6 days pls"],
  ["T", "no more than 5 days"],
  ["T", "4 to 6 days"],
  ["T", "3n4d can already"],
  ["T", "we want to go year end"],
  ["T", "planning for dec"],
  ["T", "thinking of nov or dec"],
  ["T", "push it to jan lah"],
  ["T", "make it 7 days"],
  ["T", "can we do 2 weeks"],
  ["T", "shorter trip better i think"],
  ["T", "we go for a week in dec"],
  ["T", "aiming for cny period"],
  ["T", "next year march how"],
  ["T", "lets target q1 next year"],
  ["T", "i got 5 days leave so max 5 days trip"],

  // ---------- 5. GROUP DYNAMICS ----------
  ["G", "count me out"],
  ["G", "im out for this one"],
  ["G", "you all go ahead without me"],
  ["G", "sorry cannot make it this round"],
  ["G", "im in"],
  ["G", "count me in"],
  ["G", "ok can"],
  ["G", "up to you all"],
  ["G", "i follow whatever majority say"],
  ["G", "anything can lah"],
  ["G", "nvm scratch that"],
  ["G", "actually cannot liao something came up"],
  ["G", "ignore what i said just now"],
  ["G", "changed my mind i can go"],
  ["G", "im not out anymore"],
  ["G", "sorry ah i retract my nov"],
  ["G", "wait i also want to join"],
  ["G", "disagree lah nov too rainy"],
  ["G", "why cannot dec"],
  ["G", "can we decide already"],
  ["G", "so when ah"],
  ["G", "ok confirm nov 15-20?"],
  ["G", "everyone ok with dec?"],
  ["G", "silence means yes ah"],
  ["G", "let jason decide"],
  ["G", "whatever you all decide i follow"],
  ["G", "i defer to the majority"],
  ["G", "sorry i think i cant join this trip"],
  ["G", "putting me back in"],
  ["G", "im rejoining"],
];

const CTX: ExtractionContext = {
  today: "2026-08-17",
  horizonStart: null,
  horizonEnd: null,
  destination: null,
};

const CTX_H: ExtractionContext = {
  today: "2026-08-17",
  horizonStart: "2026-10-01",
  horizonEnd: "2027-01-31",
  destination: null,
};

const DESTS: string[] = [];
const DESTS2 = ["Japan", "Taiwan", "Bangkok"];

function j(v: unknown): string {
  return v === null || v === undefined ? "-" : JSON.stringify(v);
}

it("sim", () => {
  const out: string[] = [];
  let missed = 0;
  for (const [cat, text] of MESSAGES) {
    const gate = mightContainConstraint(text);
    const avail = safe(() => parseAvailabilityMessage(text, CTX));
    const availH = safe(() => parseAvailabilityMessage(text, CTX_H));
    const edit = safe(() => parseTripEdit(text, "2026-08-17", DESTS, { horizonUnset: true }));
    const editSet = safe(() => parseTripEdit(text, "2026-08-17", DESTS, { horizonUnset: false }));
    const dest = safe(() => parseDestinationEdit(text, "2026-08-17", DESTS));
    const dest2 = safe(() => parseDestinationEdit(text, "2026-08-17", DESTS2));
    const note = safe(() => parseParticipantNote(text));
    const part = safe(() => parseParticipationChange(text));
    const rev = safe(() => parseReversal(text));
    const under = safe(() => parseUnderspecifiedSpan(text, CTX));
    const multi = safe(() => parseMultiSpan(text, "2026-08-17"));
    const hor = safe(() => resolveHorizon(text, "2026-08-17"));

    const claimed =
      avail !== null ||
      availH !== null ||
      edit !== null ||
      dest !== null ||
      dest2 !== null ||
      note !== null ||
      part !== null ||
      rev !== null ||
      under !== null;
    if (!claimed) missed++;

    out.push(
      [
        `[${cat}] ${JSON.stringify(text)}`,
        `   gate=${gate}${claimed ? "" : "  *** NOTHING CLAIMED ***"}`,
        `   avail(no-hor)=${j(avail)}`,
        `   avail(hor)   =${j(availH)}`,
        `   tripEdit(unset)=${j(edit)}`,
        `   tripEdit(set)  =${j(editSet)}`,
        `   destEdit(empty)=${j(dest)}   destEdit(JP,TW,BKK)=${j(dest2)}`,
        `   note=${j(note)}  part=${j(part)}  rev=${j(rev)}`,
        `   under=${j(under)}  multi=${j(multi)}  horizon=${j(hor)}`,
      ].join("\n"),
    );
  }
  out.unshift(`TOTAL=${MESSAGES.length} NOTHING-CLAIMED=${missed}`);
  writeFileSync("/tmp/sim.txt", out.join("\n\n"));
});

function safe<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (err) {
    return `ERROR: ${(err as Error).message}`;
  }
}
