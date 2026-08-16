/**
 * Build-time only. Fetches ten years of daily reanalysis per destination from
 * Open-Meteo and reduces it to monthly climate normals, written to
 * data/climate.json.
 *
 * Run offline and commit the result — there is no runtime dependency on this
 * API (docs/DECISIONS.md). Open-Meteo data is CC BY 4.0; attribution ships in
 * the generated file.
 *
 *   pnpm --filter @timeaway/destinations data:climate
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Destination, MonthClimate } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");

// Five years is ample for "is June wet here" and keeps each response small
// enough to fetch reliably; classical 30-year normals would not change any
// bucket this product uses.
const START = "2020-01-01";
const END = "2024-12-31";

/** The archive API times out under load often enough to need this. */
async function withRetry<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        const backoffMs = 2000 * 2 ** (attempt - 1);
        process.stdout.write(`retry ${attempt} in ${backoffMs / 1000}s… `);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  throw new Error(`${label}: giving up after 4 attempts`, { cause: lastError });
}

interface ArchiveResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

async function fetchDestination(d: Destination): Promise<MonthClimate[]> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(d.latitude));
  url.searchParams.set("longitude", String(d.longitude));
  url.searchParams.set("start_date", START);
  url.searchParams.set("end_date", END);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("timezone", "auto");

  const body = await withRetry(d.id, async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    return (await response.json()) as ArchiveResponse;
  });

  const highs: number[][] = Array.from({ length: 12 }, () => []);
  const lows: number[][] = Array.from({ length: 12 }, () => []);
  // Per-year monthly totals, so rainfall is a monthly mean rather than a
  // ten-year sum; rain days likewise.
  const rainTotals = new Map<string, number>();
  const rainDayCounts = new Map<string, number>();

  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } =
    body.daily;

  for (let i = 0; i < time.length; i++) {
    const day = time[i]!;
    const monthIndex = Number(day.slice(5, 7)) - 1;
    const yearMonth = day.slice(0, 7);

    const high = temperature_2m_max[i];
    const low = temperature_2m_min[i];
    const rain = precipitation_sum[i];

    if (high !== null && high !== undefined) highs[monthIndex]!.push(high);
    if (low !== null && low !== undefined) lows[monthIndex]!.push(low);
    if (rain !== null && rain !== undefined) {
      rainTotals.set(yearMonth, (rainTotals.get(yearMonth) ?? 0) + rain);
      if (rain >= 1) {
        rainDayCounts.set(yearMonth, (rainDayCounts.get(yearMonth) ?? 0) + 1);
      }
    }
  }

  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : values.reduce((sum, v) => sum + v, 0) / values.length;

  const round1 = (v: number) => Math.round(v * 10) / 10;

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const key = String(month).padStart(2, "0");
    const monthlyTotals = [...rainTotals.entries()]
      .filter(([ym]) => ym.endsWith(`-${key}`))
      .map(([, total]) => total);
    const monthlyRainDays = [...rainDayCounts.entries()]
      .filter(([ym]) => ym.endsWith(`-${key}`))
      .map(([, count]) => count);

    return {
      month,
      avgHighC: round1(mean(highs[i]!)),
      avgLowC: round1(mean(lows[i]!)),
      rainfallMm: Math.round(mean(monthlyTotals)),
      rainDays: Math.round(mean(monthlyRainDays)),
    };
  });
}

const destinations = JSON.parse(
  readFileSync(join(dataDir, "destinations.json"), "utf8"),
) as Destination[];

const outputPath = join(dataDir, "climate.json");

// Resume: keep anything already fetched so a mid-run failure costs only the
// destinations that hadn't been reached yet.
const climate: Record<string, MonthClimate[]> = existsSync(outputPath)
  ? (JSON.parse(readFileSync(outputPath, "utf8")).climate ?? {})
  : {};

function save(): void {
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        _source: "Open-Meteo historical reanalysis (https://open-meteo.com)",
        _licence: "CC BY 4.0",
        _period: `${START}..${END}`,
        _generated: new Date().toISOString().slice(0, 10),
        climate,
      },
      null,
      1,
    )}\n`,
  );
}

for (const destination of destinations) {
  if (climate[destination.id]) continue;
  process.stdout.write(`fetching ${destination.id}… `);
  climate[destination.id] = await fetchDestination(destination);
  save();
  console.log("ok");
  // Stay well inside the free tier's rate limits.
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

save();
console.log(
  `\nwrote climate.json for ${Object.keys(climate).length} destinations`,
);
