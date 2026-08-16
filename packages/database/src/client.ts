import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

/**
 * Standard node-postgres Pool rather than Neon's HTTP driver: the API is a
 * long-running service, and repositories need real transactions (which the
 * HTTP driver lacks). Still Neon-hosted Postgres — see docs/DECISIONS.md.
 */
export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
