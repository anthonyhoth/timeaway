import { serve } from "@hono/node-server";
import { Hono } from "hono";

// Telegram is one adapter, not the architecture — see AGENTS.md.
// Business logic must live in @timeaway/trip-engine, not here.
const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
