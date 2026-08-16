import "dotenv/config";
import { serve } from "@hono/node-server";
import { OpenAiConstraintExtractor } from "@timeaway/constraint-parsing";
import { createDb } from "@timeaway/database";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { createBot } from "./bot.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name} — see .env.example`);
    process.exit(1);
  }
  return value;
}

const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.warn(
    "OPENAI_API_KEY not set — ambient capture will prefilter but extract nothing",
  );
}

const bot = createBot(requireEnv("TELEGRAM_BOT_TOKEN"), {
  db: createDb(requireEnv("DATABASE_URL")),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "https://gettimeaway.com",
  extractor: openaiKey ? new OpenAiConstraintExtractor(openaiKey) : undefined,
});

// Webhook in production (Railway); polling for local dev, where Telegram
// can't reach us. Founder-decided: grammY + webhook (docs/DECISIONS.md).
const mode = process.env.BOT_MODE ?? "webhook";

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));

if (mode === "webhook") {
  app.post(
    "/telegram/webhook",
    webhookCallback(bot, "hono", {
      secretToken: requireEnv("TELEGRAM_WEBHOOK_SECRET"),
    }),
  );
} else {
  void bot.api
    .deleteWebhook()
    .then(() => bot.start({ onStart: () => console.log("Bot polling for updates") }));
}

void bot.api
  .setMyCommands([
    { command: "newtrip", description: "Start planning a trip" },
    { command: "dates", description: "Show the best dates so far" },
    { command: "skip", description: "Skip the current wizard question" },
    { command: "cancel", description: "Abandon the current trip setup" },
    { command: "pause", description: "Stop reading this chat" },
    { command: "resume", description: "Resume reading this chat" },
  ])
  .catch((err) => console.error("setMyCommands failed", err));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Timeaway API listening on :${port} (bot mode: ${mode})`);
