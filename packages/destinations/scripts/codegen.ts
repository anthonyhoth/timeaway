/**
 * Turns the fetched data files into a typed TypeScript module, so the dataset
 * compiles into dist/ like any other source and needs no runtime file IO or
 * path resolution — the same approach as the public-holiday table.
 *
 *   pnpm --filter @timeaway/destinations data:codegen
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Destination, MonthClimate } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");

const destinations = JSON.parse(
  readFileSync(join(dataDir, "destinations.json"), "utf8"),
) as Destination[];

const climateFile = JSON.parse(
  readFileSync(join(dataDir, "climate.json"), "utf8"),
) as {
  _source: string;
  _licence: string;
  _period: string;
  climate: Record<string, MonthClimate[]>;
};

const missing = destinations.filter((d) => !climateFile.climate[d.id]);
if (missing.length > 0) {
  throw new Error(
    `climate.json is missing: ${missing.map((d) => d.id).join(", ")}`,
  );
}

const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with: pnpm --filter @timeaway/destinations data:codegen
//
// Climate: ${climateFile._source}
// Licence: ${climateFile._licence}
// Period:  ${climateFile._period}
`;

const body = `import type { Destination, MonthClimate } from "../types.js";

export const CLIMATE_ATTRIBUTION = ${JSON.stringify(climateFile._source)};
export const CLIMATE_LICENCE = ${JSON.stringify(climateFile._licence)};
export const CLIMATE_PERIOD = ${JSON.stringify(climateFile._period)};

export const DESTINATIONS: Destination[] = ${JSON.stringify(destinations, null, 2)};

export const CLIMATE: Record<string, MonthClimate[]> = ${JSON.stringify(
  climateFile.climate,
  null,
  2,
)};
`;

writeFileSync(join(here, "..", "src", "data", "generated.ts"), `${banner}\n${body}`);
console.log(
  `generated.ts written — ${destinations.length} destinations, ${
    Object.keys(climateFile.climate).length
  } climate records`,
);
