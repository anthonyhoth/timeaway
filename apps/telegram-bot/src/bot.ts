import type { ConstraintExtractor } from "@timeaway/constraint-parsing";
import {
  mightContainConstraint,
  parseTripRequest,
} from "@timeaway/constraint-parsing";
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
import { Bot, InlineKeyboard } from "grammy";
import {
  formatDateRange,
  formatDestinations,
  formatDuration,
} from "./format.js";
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

type WizardStep = "destination" | "horizon" | "duration" | "confirm";

interface WizardState {
  step: WizardStep;
  destinations: string[];
  horizonStart?: ISODate;
  horizonEnd?: ISODate;
  durationMin?: number;
  durationMax?: number;
  /** Set when /newtrip arguments were interpreted, so we echo them back. */
  interpreted: boolean;
  /** Skips re-asking for a destination the arguments already supplied. */
  askedDestination: boolean;
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
    // Deterministic grammar first; the LLM is only consulted for what it
    // can't claim (founder-decided, docs/DECISIONS.md).
    const request = parseTripRequest(ctx.match ?? "", today());
    const state: WizardState = {
      step: "destination",
      destinations: request.destinations,
      horizonStart: request.horizon?.start,
      horizonEnd: request.horizon?.end,
      durationMin: request.duration?.min,
      durationMax: request.duration?.max,
      interpreted: request.interpretations.length > 0,
      askedDestination: request.destinations.length > 0,
    };
    wizards.set(keyOf(ctx.chat.id, ctx.from.id), state);
    await promptNextStep(ctx, state, ctx.msg.message_id);
  });

  bot.command("skip", async (ctx) => {
    if (!ctx.from) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    if (state?.step !== "destination") return;
    state.destinations = [];
    state.askedDestination = true;
    await promptNextStep(ctx, state, ctx.msg.message_id);
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

  /** Everything known so far, for echoing an interpretation back. */
  function summaryLines(state: WizardState): string[] {
    const lines = [formatDestinations(state.destinations)];
    if (state.horizonStart && state.horizonEnd) {
      lines.push(formatDateRange(state.horizonStart, state.horizonEnd));
    }
    if (state.durationMin !== undefined && state.durationMax !== undefined) {
      lines.push(formatDuration(state.durationMin, state.durationMax));
    }
    return lines;
  }

  function nextStep(state: WizardState): WizardStep {
    if (!state.askedDestination) return "destination";
    if (!state.horizonStart) return "horizon";
    if (state.durationMin === undefined) return "duration";
    return "confirm";
  }

  /**
   * Ask only for what's still missing. Anything the grammar interpreted is
   * echoed once alongside the next question, so correcting and answering
   * happen in a single step (founder-decided; brief §11's "propose an
   * interpretation"). When nothing is left to ask, confirm before writing.
   */
  async function promptNextStep(
    ctx: Context,
    state: WizardState,
    replyToId: number,
  ): Promise<void> {
    state.step = nextStep(state);

    const echo = state.interpreted;
    state.interpreted = false;

    if (state.step === "confirm") {
      await ctx.reply(
        [
          echo ? "Got it:" : "Ready to create:",
          ...summaryLines(state),
          "",
          "Create this trip?",
        ].join("\n"),
        {
          reply_parameters: { message_id: replyToId },
          reply_markup: new InlineKeyboard()
            .text("Create trip", "trip:create")
            .text("Start over", "trip:restart"),
        },
      );
      return;
    }

    const preamble = echo ? ["Got it:", ...summaryLines(state), ""] : [];

    const prompts: Record<Exclude<WizardStep, "confirm">, [string, string]> = {
      destination: [DESTINATION_PROMPT, "Destination — or /skip"],
      horizon: [HORIZON_PROMPT, "e.g. Sep–Nov"],
      duration: [DURATION_PROMPT, "e.g. 4–6"],
    };
    const [prompt, placeholder] = prompts[state.step];
    await ctx.reply(
      [...preamble, prompt].join("\n"),
      forceReply(replyToId, placeholder),
    );
  }

  async function finaliseTrip(
    ctx: Context,
    state: WizardState,
    replyToId: number,
  ): Promise<void> {
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
      destinationCandidates: state.destinations,
      horizonStart: state.horizonStart,
      horizonEnd: state.horizonEnd,
      durationMinDays: state.durationMin,
      durationMaxDays: state.durationMax,
      telegramChatId: isGroup(ctx) ? String(ctx.chat!.id) : null,
    });
    wizards.delete(keyOf(ctx.chat!.id, from.id));

    const lines = [
      "Trip created 🎉",
      "",
      ...summaryLines(state),
      "",
      isGroup(ctx)
        ? "Just talk dates in this chat — I'm listening. Friends elsewhere can use:"
        : "Share it with your group:",
      `${deps.publicBaseUrl}/t/${trip.shortCode}`,
    ];
    await ctx.reply(lines.join("\n"), {
      reply_parameters: { message_id: replyToId },
      link_preview_options: { is_disabled: true },
    });
  }

  bot.callbackQuery("trip:create", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.answerCallbackQuery();
    if (state?.step !== "confirm") return;
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await finaliseTrip(ctx, state, ctx.callbackQuery.message!.message_id);
  });

  bot.callbackQuery("trip:restart", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.answerCallbackQuery();
    if (!state) return;
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    const fresh: WizardState = {
      step: "destination",
      destinations: [],
      interpreted: false,
      askedDestination: false,
    };
    wizards.set(keyOf(ctx.chat.id, ctx.from.id), fresh);
    await promptNextStep(ctx, fresh, ctx.callbackQuery.message!.message_id);
  });

  async function handleWizardStep(
    ctx: Context & { message: { text: string } },
    state: WizardState,
  ): Promise<void> {
    const messageId = ctx.msg!.message_id;

    if (state.step === "destination") {
      const text = ctx.message.text.trim();
      state.destinations =
        text.toLowerCase() === "skip"
          ? []
          : parseTripRequest(text, today()).destinations;
      state.askedDestination = true;
      await promptNextStep(ctx, state, messageId);
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
      await promptNextStep(ctx, state, messageId);
      return;
    }

    if (state.step === "duration") {
      const duration = parseDurationRange(ctx.message.text);
      if (!duration) {
        await ctx.reply(
          `Sorry, I didn't catch that. ${DURATION_PROMPT}`,
          forceReply(messageId, "e.g. 4–6"),
        );
        return;
      }
      state.durationMin = duration.min;
      state.durationMax = duration.max;
      // Nothing was interpreted on the way in, so create without a confirm tap.
      if (nextStep(state) === "confirm" && !state.interpreted) {
        await finaliseTrip(ctx, state, messageId);
        return;
      }
      await promptNextStep(ctx, state, messageId);
    }
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
