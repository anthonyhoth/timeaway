import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { parseAvailabilityMessage } from "./grammar/availability.js";
import { parseTripEdit } from "./grammar/trip-edit.js";
const CTX = { today: "2026-08-17", horizonStart: "2026-10-01", horizonEnd: "2027-06-30", destination: null } as const;
const M = ["count me out nov","nov nope","nov ❌","nov 🙅","out nov","i out nov","nov pass","pass on nov","block leave nov","nov block leave","leave freeze nov","nov ot","nov got ot","nov peak","nov gt work","nov wk","got course nov","atc nov","hi key nov","nov got mob man","nov i attach","nov die la work","yes nov","np nov","+1 for nov","confirm chop nov","nov 👍","nov q4 close","al must clear by dec","must clear al by dec","nov gg","gg nov","nov siao meh work","nov no can","no prob nov","after cny can","aft dec","im fre nov","fre in nov","nov can??","nov i die die must go"];
it("f3", () => {
  const out: string[] = [];
  for (const m of M) {
    out.push(`${JSON.stringify(m)} | av=${JSON.stringify(parseAvailabilityMessage(m, CTX as never))} | teSET=${JSON.stringify(parseTripEdit(m,"2026-08-17",["Japan"],{}))}`);
  }
  writeFileSync("/tmp/fall3.txt", out.join("\n"));
});
