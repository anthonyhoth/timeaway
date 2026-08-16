import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

export function createDb(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export type Db = ReturnType<typeof createDb>;
