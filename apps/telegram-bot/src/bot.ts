import type { Db } from "@timeaway/database";
import { createTrip, upsertTelegramUser } from "@timeaway/database";
import type { ISODate } from "@timeaway/shared";
import { Bot, InlineKeyboard } from "grammy";
import { formatDateRange, formatDuration } from "./format.js";
import { parseDurationRange, parseHorizon } from "./parse.js";

export interface BotDeps {
  db: Db;
  /** e.g. https://gettimeaway.com — trip links are `${base}/t/${shortCode}`. */
  publicBaseUrl: string;
  /** Injectable for tests; defaults to today in Singapore time. */
  today?: () => ISODate;
}

/** MVP beachhead is Singapore — "today" means SGT (UTC+8), not server time. */
function todaySgt(): ISODate {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

type WizardStep = "destination" | "horizon" | "duration";

interface WizardState {
  step: WizardStep;
  destination: string | null;
  horizonStart?: ISODate;
  horizonEnd?: ISODate;
}

const HORIZON_PROMPT =
  "Roughly when could this trip happen?\n" +
  "e.g. Sep–Nov, December, or 2026-09-01 to 2026-11-30";

const DURATION_PROMPT = "How many days? A range works best, e.g. 4–6";

/**
 * Thin adapter only: parses input, calls repositories, formats replies.
 * Planning logic lives in @timeaway/trip-engine — never here (AGENTS.md).
 *
 * Wizard state is in-memory, keyed by chat+user: fine for a single service
 * instance (the MVP deployment), lost on restart — see docs/DECISIONS.md.
 */
export function createBot(token: string, deps: BotDeps): Bot {
  const bot = new Bot(token);
  const today = deps.today ?? todaySgt;
  const wizards = new Map<string, WizardState>();

  const keyOf = (chatId: number, userId: number) => `${chatId}:${userId}`;

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hey! I help your group find trip dates that actually work.\n\n" +
        "/newtrip — start planning a trip\n" +
        "/cancel — abandon the current setup",
    );
  });

  bot.command("newtrip", async (ctx) => {
    if (!ctx.from) return;
    wizards.set(keyOf(ctx.chat.id, ctx.from.id), {
      step: "destination",
      destination: null,
    });
    await ctx.reply(
      "Where are you thinking of going? Type a destination, or skip if it's open.",
      { reply_markup: new InlineKeyboard().text("Skip — destination open", "skip_destination") },
    );
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    const existed = wizards.delete(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.reply(existed ? "Trip setup abandoned." : "Nothing to cancel.");
  });

  bot.callbackQuery("skip_destination", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.answerCallbackQuery();
    if (state?.step !== "destination") return;
    state.destination = null;
    state.step = "horizon";
    await ctx.reply(HORIZON_PROMPT);
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from || ctx.message.text.startsWith("/")) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    if (!state) return; // not mid-wizard; stay quiet in group chats

    if (state.step === "destination") {
      state.destination = ctx.message.text.trim().slice(0, 100);
      state.step = "horizon";
      await ctx.reply(HORIZON_PROMPT);
      return;
    }

    if (state.step === "horizon") {
      const horizon = parseHorizon(ctx.message.text, today());
      if (!horizon) {
        await ctx.reply(`Sorry, I didn't catch that. ${HORIZON_PROMPT}`);
        return;
      }
      state.horizonStart = horizon.start;
      state.horizonEnd = horizon.end;
      state.step = "duration";
      await ctx.reply(DURATION_PROMPT);
      return;
    }

    const duration = parseDurationRange(ctx.message.text);
    if (!duration) {
      await ctx.reply(`Sorry, I didn't catch that. ${DURATION_PROMPT}`);
      return;
    }

    const from = ctx.from;
    const displayName = [from.first_name, from.last_name]
      .filter(Boolean)
      .join(" ");
    const organiser = await upsertTelegramUser(deps.db, {
      telegramUserId: String(from.id),
      displayName,
    });
    const trip = await createTrip(deps.db, {
      organiserUserId: organiser.id,
      destination: state.destination,
      horizonStart: state.horizonStart,
      horizonEnd: state.horizonEnd,
      durationMinDays: duration.min,
      durationMaxDays: duration.max,
    });
    wizards.delete(keyOf(ctx.chat.id, ctx.from.id));

    const lines = [
      "Trip created 🎉",
      "",
      state.destination ?? "Destination open",
      formatDateRange(state.horizonStart!, state.horizonEnd!),
      formatDuration(duration.min, duration.max),
      "",
      "Share it with your group:",
      `${deps.publicBaseUrl}/t/${trip.shortCode}`,
    ];
    await ctx.reply(lines.join("\n"), { link_preview_options: { is_disabled: true } });
  });

  bot.catch((err) => {
    console.error("bot error", err.error);
  });

  return bot;
}
