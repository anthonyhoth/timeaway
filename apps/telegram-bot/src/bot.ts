import type { ConstraintExtractor } from "@timeaway/constraint-parsing";
import { mightContainConstraint } from "@timeaway/constraint-parsing";
import type { Db, Trip } from "@timeaway/database";
import {
  addNlDeclarations,
  createTrip,
  ensureParticipantForTelegramUser,
  findActivePlanningTripByChatId,
  setAmbientPaused,
  setLeaveCap,
  upsertTelegramUser,
} from "@timeaway/database";
import type { ISODate } from "@timeaway/shared";
import type { Context } from "grammy";
import { Bot } from "grammy";
import { formatDateRange, formatDuration } from "./format.js";
import { parseDurationRange, parseHorizon } from "./parse.js";

export interface BotDeps {
  db: Db;
  /** e.g. https://gettimeaway.com — trip links are `${base}/t/${shortCode}`. */
  publicBaseUrl: string;
  /** Absent = ambient capture runs prefilter-only and extracts nothing. */
  extractor?: ConstraintExtractor;
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

const DESTINATION_PROMPT =
  "Where are you thinking of going? Reply with a destination, or /skip if it's open.";

const HORIZON_PROMPT =
  "Roughly when could this trip happen?\n" +
  "e.g. Sep–Nov, December, or 2026-09-01 to 2026-11-30";

const DURATION_PROMPT = "How many days? A range works best, e.g. 4–6";

const JOIN_MESSAGE =
  "Hey! I'm Timeaway — I help this group find trip dates that actually work.\n\n" +
  "I'll quietly watch this chat for availability talk (\"can't do October\", " +
  "\"max 2 days leave\") once a trip is being planned — I keep only what's " +
  "about dates, nothing else. /pause stops me anytime.\n\n" +
  "/newtrip — start planning a trip";

function isGroup(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function forceReply(messageId: number, placeholder: string) {
  return {
    reply_parameters: { message_id: messageId },
    reply_markup: {
      force_reply: true as const,
      input_field_placeholder: placeholder,
      selective: true,
    },
  };
}

/**
 * Thin adapter only: parses input, calls repositories, formats replies.
 * Planning logic lives in @timeaway/trip-engine — never here (AGENTS.md).
 *
 * Ambient capture (founder-decided, docs/DECISIONS.md): group messages flow
 * through a deterministic prefilter, then LLM extraction. Non-matching
 * messages are discarded here and never stored. Successful parses get a ✍
 * reaction; declarations and leave caps persist against the auto-added
 * participant.
 */
export function createBot(token: string, deps: BotDeps): Bot {
  const bot = new Bot(token);
  const today = deps.today ?? todaySgt;
  const wizards = new Map<string, WizardState>();

  const keyOf = (chatId: number, userId: number) => `${chatId}:${userId}`;

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    const wasOut = ["left", "kicked"].includes(
      ctx.myChatMember.old_chat_member.status,
    );
    if (isGroup(ctx) && wasOut && status === "member") {
      await ctx.reply(JOIN_MESSAGE);
    }
  });

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
      DESTINATION_PROMPT,
      forceReply(ctx.msg.message_id, "Destination — or /skip"),
    );
  });

  bot.command("skip", async (ctx) => {
    if (!ctx.from) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    if (state?.step !== "destination") return;
    state.destination = null;
    state.step = "horizon";
    await ctx.reply(HORIZON_PROMPT, forceReply(ctx.msg.message_id, "e.g. Sep–Nov"));
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    const existed = wizards.delete(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.reply(existed ? "Trip setup abandoned." : "Nothing to cancel.");
  });

  bot.command("pause", async (ctx) => {
    if (!isGroup(ctx)) return;
    const trip = await findActivePlanningTripByChatId(deps.db, String(ctx.chat.id));
    if (!trip) return;
    await setAmbientPaused(deps.db, trip.id, true);
    await ctx.reply("Paused — I'm not reading this chat. /resume when you want me back.");
  });

  bot.command("resume", async (ctx) => {
    if (!isGroup(ctx)) return;
    const trip = await findActivePlanningTripByChatId(deps.db, String(ctx.chat.id));
    if (!trip) return;
    await setAmbientPaused(deps.db, trip.id, false);
    await ctx.reply("Back on — I'll watch for availability talk again.");
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from || ctx.message.text.startsWith("/")) return;

    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    const isWizardReply =
      state !== undefined &&
      (ctx.chat.type === "private" ||
        ctx.message.reply_to_message?.from?.id === ctx.me.id);

    if (isWizardReply) {
      await handleWizardStep(ctx, state);
      return;
    }

    if (isGroup(ctx)) {
      await handleAmbientMessage(ctx);
    }
  });

  async function handleWizardStep(
    ctx: Context & { message: { text: string } },
    state: WizardState,
  ): Promise<void> {
    const messageId = ctx.msg!.message_id;

    if (state.step === "destination") {
      const text = ctx.message.text.trim();
      state.destination =
        text.toLowerCase() === "skip" ? null : text.slice(0, 100);
      state.step = "horizon";
      await ctx.reply(HORIZON_PROMPT, forceReply(messageId, "e.g. Sep–Nov"));
      return;
    }

    if (state.step === "horizon") {
      const horizon = parseHorizon(ctx.message.text, today());
      if (!horizon) {
        await ctx.reply(
          `Sorry, I didn't catch that. ${HORIZON_PROMPT}`,
          forceReply(messageId, "e.g. Sep–Nov"),
        );
        return;
      }
      state.horizonStart = horizon.start;
      state.horizonEnd = horizon.end;
      state.step = "duration";
      await ctx.reply(DURATION_PROMPT, forceReply(messageId, "e.g. 4–6"));
      return;
    }

    const duration = parseDurationRange(ctx.message.text);
    if (!duration) {
      await ctx.reply(
        `Sorry, I didn't catch that. ${DURATION_PROMPT}`,
        forceReply(messageId, "e.g. 4–6"),
      );
      return;
    }

    const from = ctx.from!;
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
      telegramChatId: isGroup(ctx) ? String(ctx.chat!.id) : null,
    });
    wizards.delete(keyOf(ctx.chat!.id, from.id));

    const lines = [
      "Trip created 🎉",
      "",
      state.destination ?? "Destination open",
      formatDateRange(state.horizonStart!, state.horizonEnd!),
      formatDuration(duration.min, duration.max),
      "",
      isGroup(ctx)
        ? "Just talk dates in this chat — I'm listening. Friends elsewhere can use:"
        : "Share it with your group:",
      `${deps.publicBaseUrl}/t/${trip.shortCode}`,
    ];
    await ctx.reply(lines.join("\n"), {
      reply_parameters: { message_id: messageId },
      link_preview_options: { is_disabled: true },
    });
  }

  async function handleAmbientMessage(
    ctx: Context & { message: { text: string } },
  ): Promise<void> {
    const text = ctx.message.text;
    // Stage 1: free deterministic gate. Failing messages are dropped here —
    // never logged, never stored ("reads ≠ stores").
    if (!mightContainConstraint(text)) return;
    if (!deps.extractor) return;

    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip || trip.ambientPaused) return;

    let result;
    try {
      result = await deps.extractor.extract(text, {
        today: today(),
        horizonStart: trip.horizonStart,
        horizonEnd: trip.horizonEnd,
        destination: trip.destination,
      });
    } catch (error) {
      console.error("extraction failed", error);
      return;
    }
    if (!result.relevant) return;
    // Third-party relays ("Sheryl can only do school holidays") need identity
    // resolution we don't have yet — skip rather than guess. TODO(task 8+).
    if (result.subjectName) return;
    if (result.declarations.length === 0 && result.maxLeaveDays === null) return;

    const from = ctx.from!;
    const participant = await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(from.id),
      displayName: [from.first_name, from.last_name].filter(Boolean).join(" "),
    });

    if (result.declarations.length > 0) {
      await addNlDeclarations(
        deps.db,
        participant.id,
        result.declarations.map((d) => ({
          state: d.state,
          startDate: d.start,
          endDate: d.end,
        })),
        text,
      );
    }
    if (result.maxLeaveDays !== null) {
      await setLeaveCap(deps.db, participant.id, result.maxLeaveDays, text);
    }

    // Ack without noise (founder-decided): react, don't reply. The live trip
    // card (task 10) will pick these up on its next update.
    try {
      await ctx.react("✍");
    } catch (error) {
      console.error("reaction failed", error);
    }
  }

  bot.catch((err) => {
    console.error("bot error", err.error);
  });

  return bot;
}

export type { Trip };
