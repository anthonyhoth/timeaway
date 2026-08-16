import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only db:migrate / db:push need this; db:generate works without a DB.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
