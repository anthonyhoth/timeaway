import type { ISODate } from "@timeaway/shared";
import type { DestinationSuggestion } from "./suggest.js";
import { suggestDestinations } from "./suggest.js";

/**
 * The baked knowledge base: generated TypeScript, compiled in like any other
 * source, queried by pure functions. No database, no API call, and no model at
 * query time (docs/DECISIONS.md).
 */
export {
  CLIMATE,
  CLIMATE_ATTRIBUTION,
  CLIMATE_LICENCE,
  CLIMATE_PERIOD,
  DESTINATIONS,
} from "./data/generated.js";
export { DESTINATION_EVENTS, EVENT_COVERAGE_END } from "./data/events.js";

import { CLIMATE, DESTINATIONS } from "./data/generated.js";
import { DESTINATION_EVENTS } from "./data/events.js";

export interface WindowSuggestionOptions {
  looking?: "any" | "warm" | "snow";
  maxFlightHours?: number;
  limit?: number;
}

/** Rank the baked destinations for a candidate trip window. */
export function suggestForWindow(
  start: ISODate,
  end: ISODate,
  options: WindowSuggestionOptions = {},
): DestinationSuggestion[] {
  const results = suggestDestinations({
    destinations: DESTINATIONS,
    climate: CLIMATE,
    events: DESTINATION_EVENTS,
    start,
    end,
    looking: options.looking,
    maxFlightHours: options.maxFlightHours,
  });
  return options.limit ? results.slice(0, options.limit) : results;
}
