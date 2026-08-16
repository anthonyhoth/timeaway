import "dotenv/config";
import { Bot } from "grammy";

/**
 * One-shot: point Telegram at the deployed webhook. Run after each deploy
 * URL change, not on every boot:
 *
 *   WEBHOOK_URL=https://<host>/telegram/webhook pnpm webhook:set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

const bot = new Bot(requireEnv("TELEGRAM_BOT_TOKEN"));
await bot.api.setWebhook(requireEnv("WEBHOOK_URL"), {
  secret_token: requireEnv("TELEGRAM_WEBHOOK_SECRET"),
});
console.log(`Webhook set to ${process.env.WEBHOOK_URL}`);
