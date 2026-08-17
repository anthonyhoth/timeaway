import type { ConstraintExtractor } from "@timeaway/constraint-parsing";
import {
  applyDestinationEdit,
  describeTripEdit,
  isUnknownAnswer,
  mightContainConstraint,
  parseAvailabilityMessage,
  parseDurationRange,
  parseParticipantNote,
  parseParticipationChange,
  parseTripEdit,
  parseTripRequest,
  resolveHorizon,
} from "@timeaway/constraint-parsing";
import type { Db, Trip } from "@timeaway/database";
import {
  addCalendarDeclaration,
  addNlDeclarations,
  addParticipantNote,
  archiveTrip,
  createTrip,
  listDeclarations,
  clearLeaveCap,
  deleteDeclaration,
  ensureParticipantForTelegramUser,
  findParticipantsForUserInTrip,
  forgetParticipant,
  findActivePlanningTripByChatId,
  getTripById,
  getTripByShortCode,
  listOwnRecord,
  loadTripPlanningState,
  countEventsSince,
  recordEvent,
  selectTripDates,
  setAmbientPaused,
  setCardMessageId,
  setDestinationCandidates,
  setLeaveCap,
  setParticipantOptedOut,
  setTripShape,
  setShortlistSize,
  setTripChatId,
  upsertTelegramUser,
} from "@timeaway/database";
import {
  diagnoseParticipants,
  evaluateWindows,
  generateCandidateWindows,
  rankForDisplay,
  resolveRange,
  selectDiverseWindows,
  SG_PUBLIC_HOLIDAYS,
} from "@timeaway/trip-engine";
import { renderTripCard } from "./card.js";
import {
  EXTRACTOR_DEGRADED_NOTICE,
  ExtractorHealth,
} from "./extractor-health.js";
import {
  logBotError,
  userFacingCallbackError,
  userFacingError,
} from "./errors.js";
import type { CalendarState } from "./calendar.js";
import {
  calendarCaption,
  MODE_BY_CODE,
  monthStart,
  orderRange,
  renderCalendarKeyboard,
} from "./calendar.js";
import type { ISODate } from "@timeaway/shared";
import { formatDateRange, formatDestinations, formatDuration } from "@timeaway/shared";
import type { Context } from "grammy";
import { Bot, InlineKeyboard } from "grammy";


export interface BotDeps {
  db: Db;
  /** e.g. https://timeaway.sg — trip links are `${base}/t/${shortCode}`. */
  publicBaseUrl: string;
  /** Absent = ambient capture runs prefilter-only and extracts nothing. */
  extractor?: ConstraintExtractor;
  /** Injectable for tests; defaults to today in Singapore time. */
  today?: () => ISODate;
  /** Ceiling on LLM extractions per trip per day. */
  llmCallsPerTripPerDay?: number;
}

/** Generous for a real group, low enough to bound a runaway chat. */
const DEFAULT_LLM_CALL_CAP = 150;

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
  "Where are you thinking of going?\n" +
  "A place, or a few like Korea or Japan — or just say you're not sure.";

const HORIZON_PROMPT =
  "Roughly when could this trip happen?\n" +
  "Something like Sep–Nov, next year, or year end — or just say you're not sure.";

const DURATION_PROMPT =
  "How many days?\n" +
  "A range works best — 4–6, a long weekend, a week — or just say you're not sure.";

/** Long weekend through a full week — used when the organiser can't say yet. */
const DEFAULT_DURATION = { min: 3, max: 7 };

/** Brief §13's "initial active planning slice" — used when the horizon is
 *  unknown, since windows cannot be generated without one. */
function defaultHorizon(today: ISODate): { start: ISODate; end: ISODate } {
  const [y, m, d] = today.split("-").map(Number);
  const end = new Date(Date.UTC(y!, m! - 1 + 3, d!));
  return { start: today, end: end.toISOString().slice(0, 10) as ISODate };
}

const JOIN_MESSAGE =
  "Hey! I'm Timeaway — I help this group find trip dates that actually work.\n\n" +
  "Tap below and then just talk about dates the way you normally would " +
  "(\u201ccmi October\u201d, \u201conly got 2 days AL\u201d). I'll work out " +
  "which windows fit everyone.\n\n" +
  "I only keep what's about dates, and I'm not reading anything until you " +
  "start. /pause stops me anytime, /help explains the rest.\n\n" +
  "If I've been in this group before, remove and re-add me — otherwise " +
  "Telegram keeps hiding your messages from me.";

/**
 * Telegram only accepts publicly resolvable URLs in inline keyboard buttons,
 * and rejects the **whole message** when one is invalid rather than dropping
 * the button — so a localhost base URL silently swallowed the entire trip
 * confirmation. Anything not button-safe falls back to a plain text link.
 */
export function isButtonSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].includes(host)) {
      return false;
    }
    return host.includes(".");
  } catch {
    return false;
  }
}

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
  const llmCap = deps.llmCallsPerTripPerDay ?? DEFAULT_LLM_CALL_CAP;
  const wizards = new Map<string, WizardState>();

  const keyOf = (chatId: number, userId: number) => `${chatId}:${userId}`;

  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    const wasOut = ["left", "kicked"].includes(
      ctx.myChatMember.old_chat_member.status,
    );
    if (isGroup(ctx) && wasOut && status === "member") {
      // A tap is the whole setup: no command to remember, and whoever taps
      // becomes organiser — more meaningful than whoever added the bot
      // (founder-decided, docs/DECISIONS.md).
      const existing = await findActivePlanningTripByChatId(
        deps.db,
        String(ctx.chat.id),
      );
      void recordEvent(deps.db, {
        event: "bot_added_to_group",
        chatId: String(ctx.chat.id),
        properties: { canReadMessages: ctx.me.can_read_all_group_messages },
      });

      // Global privacy mode is visible; per-group state is not, and a group
      // the bot was in *before* privacy mode was disabled keeps blocking
      // messages until it is removed and re-added. Both cases fail silently,
      // so both are called out up front.
      if (!ctx.me.can_read_all_group_messages) {
        await ctx.reply(
          "Heads up — I can't read messages in groups yet, so I won't pick up " +
            "any dates. The bot owner needs to turn off privacy mode in " +
            "@BotFather, then remove and re-add me here.",
        );
        return;
      }

      await ctx.reply(JOIN_MESSAGE, {
        reply_markup: existing
          ? undefined
          : new InlineKeyboard().text("Start planning a trip", "trip:begin"),
      });
    }
  });

  bot.command("start", async (ctx) => {
    const payload = (ctx.match ?? "").trim();

    // Added to a group from a staged trip's "Add to group chat" button.
    if (isGroup(ctx) && payload.startsWith("trip_")) {
      const trip = await getTripByShortCode(deps.db, payload.slice(5));
      if (trip) {
        await setTripChatId(deps.db, trip.id, String(ctx.chat.id));
        await refreshTripCard(ctx, {
          ...trip,
          telegramChatId: String(ctx.chat.id),
          cardMessageId: null,
        });
        return;
      }
    }

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

  // Undocumented alias for "not sure" — kept working for anyone who tries it,
  // but the prompts teach plain language instead of commands.
  bot.command("skip", async (ctx) => {
    if (!ctx.from) return;
    const state = wizards.get(keyOf(ctx.chat.id, ctx.from.id));
    if (!state) return;
    await applyUnknownAnswer(ctx, state, ctx.msg.message_id);
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    const existed = wizards.delete(keyOf(ctx.chat.id, ctx.from.id));
    await ctx.reply(existed ? "Trip setup abandoned." : "Nothing to cancel.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "I find trip dates that work for your whole group.",
        "",
        "Just talk normally — I pick up things like “cmi October”, “only got",
        "2 days AL”, “roster not out yet”, “count me out”, “let's try Korea too”.",
        "",
        "Commands:",
        "/dates — show the best options now",
        "/calendar — mark your dates on a calendar",
        "/newtrip — start another trip",
        "/pause · /resume — stop or restart me reading this chat",
        "/mine — see and fix what I've recorded about you",
        "/forget — delete everything I hold about you here",
        "/reset — archive this trip and start over",
        "",
        "I only keep what's about dates, plus what you say about budget or",
        "destinations. Nothing else is stored.",
      ].join("\n"),
    );
  });

  /**
   * What the bot holds about you, and the means to correct it.
   *
   * Both a trust feature and the PDPA access right: until now a misread was
   * invisible *and* permanent, so someone could only guess why the dates
   * looked wrong. Each item is shown with the words that produced it.
   */
  bot.command("mine", async (ctx) => {
    if (!ctx.from) return;
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat.id),
    );
    if (!trip) {
      await ctx.reply("No trip here yet, so I have nothing about you.");
      return;
    }
    const participant = await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    const record = await listOwnRecord(deps.db, participant.id);

    const lines: string[] = [`Here's everything I have for you, ${ctx.from.first_name}.`];
    const keyboard = new InlineKeyboard();

    if (record.declarations.length === 0) {
      lines.push("", "No dates recorded.");
    } else {
      lines.push("", "Dates");
      record.declarations.forEach((d, index) => {
        const label =
          d.state === "AVAILABLE"
            ? "Can make it"
            : d.state === "UNAVAILABLE"
              ? "Can't make it"
              : d.state === "UNKNOWN"
                ? "Don't know yet"
                : "Maybe";
        lines.push(
          `${index + 1}. ${label} · ${formatDateRange(d.start, d.end)}`,
          d.originalText ? `    from “${d.originalText}”` : "    from the calendar",
        );
        keyboard.text(`Remove ${index + 1}`, `del:${d.id}`);
        if ((index + 1) % 3 === 0) keyboard.row();
      });
      keyboard.row();
    }

    if (participant.maxLeaveDays !== null) {
      lines.push(
        "",
        `Leave: up to ${participant.maxLeaveDays} ${participant.maxLeaveDays === 1 ? "day" : "days"}` +
          (participant.maxLeaveDaysSourceText
            ? `\n    from “${participant.maxLeaveDaysSourceText}”`
            : ""),
      );
      keyboard.text("Clear leave limit", "clearcap").row();
    }

    if (record.notes.length > 0) {
      lines.push("", "Noted");
      for (const n of record.notes) lines.push(`• “${n.text}”`);
    }

    lines.push(
      "",
      "Anything wrong, remove it and just say it again. /forget deletes the lot.",
    );

    await ctx.reply(lines.join("\n"), {
      reply_parameters: { message_id: ctx.msg.message_id },
      reply_markup: keyboard,
    });
  });

  bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }
    // Scoped to the asker's own participant row, so one person can never
    // delete another's dates from a card they can see.
    const participant = await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    const removed = await deleteDeclaration(
      deps.db,
      participant.id,
      (ctx.match as RegExpMatchArray)[1]!,
    );
    await ctx.answerCallbackQuery(removed ? "Removed." : "That wasn't yours to remove.");
    if (!removed) return;

    void recordEvent(deps.db, {
      event: "declaration_corrected",
      tripId: trip.id,
      chatId: String(ctx.chat!.id),
    });
    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated);
  });

  bot.callbackQuery("clearcap", async (ctx) => {
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }
    const participant = await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    await clearLeaveCap(deps.db, participant.id);
    await ctx.answerCallbackQuery("Cleared.");
    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated);
  });

  bot.command("forget", async (ctx) => {
    if (!ctx.from) return;
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat.id),
    );
    if (!trip) {
      await ctx.reply("Nothing to forget here — no trip is being planned.");
      return;
    }
    await ctx.reply(
      "This deletes your dates, your notes and your place in this trip. " +
        "It can't be undone.",
      {
        reply_parameters: { message_id: ctx.msg.message_id },
        reply_markup: new InlineKeyboard().text(
          "Delete my data",
          `forget:${trip.id}`,
        ),
      },
    );
  });

  bot.callbackQuery(/^forget:(.+)$/, async (ctx) => {
    const tripId = (ctx.match as RegExpMatchArray)[1]!;
    const user = await upsertTelegramUser(deps.db, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    const rows = await findParticipantsForUserInTrip(deps.db, tripId, user.id);
    for (const row of rows) await forgetParticipant(deps.db, row.id);

    void recordEvent(deps.db, {
      event: "participant_forgotten",
      tripId,
      chatId: ctx.chat ? String(ctx.chat.id) : null,
      properties: { rows: rows.length },
    });

    await ctx.answerCallbackQuery("Deleted.");
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply("Done — I've deleted everything I had about you here.");
    const trip = await getTripById(deps.db, tripId);
    if (trip) await refreshTripCard(ctx, trip, { forceNew: true });
  });

  bot.command("reset", async (ctx) => {
    if (!isGroup(ctx)) return;
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat.id),
    );
    if (!trip) {
      await ctx.reply("No trip to reset — /newtrip starts one.");
      return;
    }
    if (!(await isTripOrganiser(trip, ctx.from!))) {
      await ctx.reply("Only the organiser can reset this trip.");
      return;
    }
    await archiveTrip(deps.db, trip.id);
    void recordEvent(deps.db, {
      event: "trip_archived",
      tripId: trip.id,
      chatId: String(ctx.chat.id),
    });
    await ctx.reply(
      "Trip archived. /newtrip when you want to start another one.",
    );
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

  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) return;
    // Hand commands onward: grammY stops the chain when middleware returns
    // without calling next(), so anything registered below would never run.
    if (ctx.message.text.startsWith("/")) return next();

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
      destination: [DESTINATION_PROMPT, "Japan — or not sure"],
      horizon: [HORIZON_PROMPT, "Sep–Nov — or not sure"],
      duration: [DURATION_PROMPT, "4–6 — or not sure"],
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
    void recordEvent(deps.db, {
      event: "trip_created",
      tripId: trip.id,
      chatId: isGroup(ctx) ? String(ctx.chat!.id) : null,
      properties: {
        via: isGroup(ctx) ? "group_wizard" : "dm_wizard",
        destinations: state.destinations.length,
      },
    });

    const tripUrl = `${deps.publicBaseUrl}/t/${trip.shortCode}`;

    if (!isGroup(ctx)) {
      // A DM trip is staged, not live: ambient capture finds trips by chat, so
      // until this one is bound to a group nobody can contribute anything.
      // Say that plainly rather than celebrating, and hand over the one
      // action that unblocks it.
      const keyboard = new InlineKeyboard().url(
        "Add to group chat",
        `https://t.me/${ctx.me.username}?startgroup=trip_${trip.shortCode}`,
      );
      // Only offer the trip page as a button when Telegram will accept it;
      // otherwise it still appears as a link in the text below.
      if (isButtonSafeUrl(tripUrl)) {
        keyboard.row().url("View trip page", tripUrl);
      }

      await ctx.reply(
        [
          "Trip set up ✓",
          "",
          ...summaryLines(state),
          "",
          "Now add me to the group chat — that's where I pick up everyone's dates.",
          "",
          tripUrl,
        ].join("\n"),
        {
          reply_parameters: { message_id: replyToId },
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        },
      );
      return;
    }

    const lines = [
      "Trip created 🎉",
      "",
      ...summaryLines(state),
      "",
      "Just talk dates in this chat — I'm listening. Friends elsewhere can use:",
      tripUrl,
    ];
    await ctx.reply(lines.join("\n"), {
      reply_parameters: { message_id: replyToId },
      link_preview_options: { is_disabled: true },
    });

    // Seed the live card immediately, so the group has something to watch.
    if (isGroup(ctx)) await refreshTripCard(ctx, trip);
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

  /**
   * "I don't know" at whichever step we're on. Destination has a real
   * unknown state (open); the other two are structurally required, so an
   * assumption is made and stated rather than leaving a dead end.
   */
  async function applyUnknownAnswer(
    ctx: Context,
    state: WizardState,
    messageId: number,
  ): Promise<void> {
    if (state.step === "destination") {
      state.destinations = [];
      state.askedDestination = true;
      await promptNextStep(ctx, state, messageId);
      return;
    }

    if (state.step === "horizon") {
      const horizon = defaultHorizon(today());
      state.horizonStart = horizon.start;
      state.horizonEnd = horizon.end;
      await ctx.reply(
        `No problem — I'll look at the next 3 months for now (${formatDateRange(
          horizon.start,
          horizon.end,
        )}).`,
        { reply_parameters: { message_id: messageId } },
      );
      await promptNextStep(ctx, state, messageId);
      return;
    }

    state.durationMin = DEFAULT_DURATION.min;
    state.durationMax = DEFAULT_DURATION.max;
    await ctx.reply(
      `No problem — I'll assume ${DEFAULT_DURATION.min}–${DEFAULT_DURATION.max} days ` +
        "for now, anything from a long weekend to a week.",
      { reply_parameters: { message_id: messageId } },
    );
    await finaliseTrip(ctx, state, messageId);
  }

  async function handleWizardStep(
    ctx: Context & { message: { text: string } },
    state: WizardState,
  ): Promise<void> {
    const messageId = ctx.msg!.message_id;

    if (isUnknownAnswer(ctx.message.text)) {
      await applyUnknownAnswer(ctx, state, messageId);
      return;
    }

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
      const horizon = resolveHorizon(ctx.message.text, today());
      if (!horizon) {
        await ctx.reply(
          `Sorry, I didn't catch that. ${HORIZON_PROMPT}`,
          forceReply(messageId, "Sep–Nov — or not sure"),
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
          forceReply(messageId, "4–6 — or not sure"),
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

    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip || trip.ambientPaused) return;

    const extractionCtx = {
      today: today(),
      horizonStart: trip.horizonStart,
      horizonEnd: trip.horizonEnd,
      destination: trip.destination,
    };

    // Stage 2: deterministic grammar handles the common phrasings for free.
    // The LLM is consulted only for what the grammar declines to claim
    // (founder-decided, docs/DECISIONS.md).
    // Leaving or rejoining the trip itself. Checked after availability so
    // "count me out for November" remains a date constraint, not a
    // withdrawal.
    if (!parseAvailabilityMessage(text, extractionCtx)) {
      const change = parseParticipationChange(text);
      if (change) {
        const participant = await ensureParticipantForTelegramUser(
          deps.db,
          trip.id,
          {
            telegramUserId: String(ctx.from!.id),
            displayName: [ctx.from!.first_name, ctx.from!.last_name]
              .filter(Boolean)
              .join(" "),
          },
        );
        await setParticipantOptedOut(deps.db, participant.id, change === "OUT");
        void recordEvent(deps.db, {
          event: change === "OUT" ? "participant_opted_out" : "participant_opted_in",
          tripId: trip.id,
          chatId: String(ctx.chat!.id),
        });
        try {
          await ctx.react("✍");
        } catch (error) {
          console.error("reaction failed", error);
        }
        const afterChange = await getTripById(deps.db, trip.id);
        if (afterChange) await refreshTripCard(ctx, afterChange);
        return;
      }
    }

    // Opinions — objections, preferences, budget. Recorded and shown, never
    // acted on, and checked before trip edits so a first-person "I'd rather
    // not do Japan again" isn't executed as "drop Japan".
    {
      const note = parseParticipantNote(text);
      if (note) {
        const participant = await ensureParticipantForTelegramUser(
          deps.db,
          trip.id,
          {
            telegramUserId: String(ctx.from!.id),
            displayName: [ctx.from!.first_name, ctx.from!.last_name]
              .filter(Boolean)
              .join(" "),
          },
        );
        await addParticipantNote(deps.db, participant.id, note.kind, note.text);
        try {
          await ctx.react("✍");
        } catch (error) {
          console.error("reaction failed", error);
        }
        const afterNote = await getTripById(deps.db, trip.id);
        if (afterNote) await refreshTripCard(ctx, afterNote);
        return;
      }
    }

    // Someone steering the trip itself — "Korea too", "push to December",
    // "make it 5 days". Checked after availability, so a message about a
    // person's own dates is never mistaken for a change to the plan.
    if (!parseAvailabilityMessage(text, extractionCtx)) {
      const current = trip.destinationCandidates ?? [];
      const edit = parseTripEdit(text, today(), current);
      if (edit) {
        const isOrganiser = await isTripOrganiser(trip, ctx.from!);
        if (!edit.destructive || isOrganiser) {
          await applyTripEdit(trip, edit, current);
          try {
            await ctx.react("✍");
          } catch (error) {
            console.error("reaction failed", error);
          }
          const afterEdit = await getTripById(deps.db, trip.id);
          if (afterEdit) await refreshTripCard(ctx, afterEdit);
        } else {
          // A destructive change from someone who isn't the organiser: hold
          // it for approval rather than silently ignoring them.
          const id = String(pendingEditSeq++);
          pendingEdits.set(id, { tripId: trip.id, edit, current });
          await ctx.reply(`Change the trip to ${describeTripEdit(edit)}?`, {
            reply_parameters: { message_id: ctx.msg!.message_id },
            reply_markup: new InlineKeyboard().text("Apply", `edit:${id}`),
          });
        }
        return;
      }
    }

    let result = parseAvailabilityMessage(text, extractionCtx);
    let source: "grammar" | "llm" = "grammar";
    if (!result) {
      if (!deps.extractor) return;

      // A standing outage (no credits, dead key) fails identically on every
      // message. Skip the call while the breaker is open, and say something —
      // silence here reads as "recorded" to the person who just typed dates.
      if (!extractorHealth.available()) {
        if (extractorHealth.shouldNotify(String(ctx.chat!.id))) {
          await ctx.reply(EXTRACTOR_DEGRADED_NOTICE, {
            reply_parameters: { message_id: ctx.msg!.message_id },
          });
        }
        return;
      }

      // Spend is otherwise unbounded: cost scales with how chatty a group is,
      // and nothing stops the bot being added to a 500-person chat. Past the
      // cap it degrades to grammar-only rather than stopping — the common
      // phrasings still work, which is the behaviour when no key is set.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const used = await countEventsSince(deps.db, "llm_call", trip.id, since);
      if (used >= llmCap) {
        void recordEvent(deps.db, {
          event: "llm_cap_reached",
          tripId: trip.id,
          chatId: String(ctx.chat!.id),
          properties: { used },
        });
        return;
      }
      void recordEvent(deps.db, {
        event: "llm_call",
        tripId: trip.id,
        chatId: String(ctx.chat!.id),
      });
      source = "llm";
      try {
        result = await deps.extractor.extract(text, extractionCtx);
        extractorHealth.recordSuccess();
      } catch (error) {
        const failure = extractorHealth.record(error);
        const { ref } = logBotError(ctx, error);
        void recordEvent(deps.db, {
          event: "extraction_failed",
          tripId: trip.id,
          chatId: String(ctx.chat!.id),
          properties: { failure, ref },
        });
        // Transient failures stay quiet and retry on the next message. A
        // standing one has just tripped the breaker, so own it out loud.
        if (
          failure !== "transient" &&
          extractorHealth.shouldNotify(String(ctx.chat!.id))
        ) {
          await ctx.reply(EXTRACTOR_DEGRADED_NOTICE, {
            reply_parameters: { message_id: ctx.msg!.message_id },
          });
        }
        return;
      }
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

    // Ack without noise (founder-decided): react, don't reply — the live card
    // carries the actual update.
    try {
      await ctx.react("✍");
    } catch (error) {
      console.error("reaction failed", error);
    }

    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated);
  }

  /**
   * Recompute the trip's ranked windows and update its live card in place.
   * Called after every accepted constraint, so the group watches the picture
   * sharpen without the chat filling with repeated posts.
   */
  async function refreshTripCard(
    ctx: Context,
    trip: Trip,
    options: { forceNew?: boolean } = {},
  ): Promise<void> {
    const chatId = trip.telegramChatId;
    if (!chatId) return;

    const participants = await loadTripPlanningState(deps.db, trip.id);

    // Windows need a horizon and a duration; without them the card just
    // invites input rather than pretending to compute.
    const canCompute =
      trip.horizonStart !== null &&
      trip.horizonEnd !== null &&
      trip.durationMinDays !== null &&
      trip.durationMaxDays !== null;

    // Someone sitting the trip out constrains nothing — their dates must not
    // narrow the options, nor dilute the counts.
    const travelling = participants.filter((p) => !p.optedOut);
    const engineParticipants = travelling.map((p) => ({
      id: p.participantId,
      declarations: p.declarations,
      maxLeaveDays: p.maxLeaveDays ?? undefined,
    }));

    const windows = canCompute
      ? generateCandidateWindows({
          horizonStart: trip.horizonStart!,
          horizonEnd: trip.horizonEnd!,
          durationMinDays: trip.durationMinDays!,
          durationMaxDays: trip.durationMaxDays!,
        })
      : [];

    const ranked = canCompute
      ? rankForDisplay(
          evaluateWindows(windows, engineParticipants, SG_PUBLIC_HOLIDAYS),
        )
      : { feasible: [], nearMisses: [] };

    // Mismatches no choice of dates can fix — surfaced separately so the
    // group can reshape the trip rather than stare at an empty result.
    const diagnostics = canCompute
      ? diagnoseParticipants({
          participants: engineParticipants,
          windows,
          horizonStart: trip.horizonStart!,
          horizonEnd: trip.horizonEnd!,
          publicHolidays: SG_PUBLIC_HOLIDAYS,
        })
      : [];

    const selected =
      trip.status === "DATE_SELECTED" && trip.selectedStart && trip.selectedEnd
        ? { start: trip.selectedStart, end: trip.selectedEnd }
        : null;

    // The round's options, spread across the horizon rather than three
    // variations on the same week (see selectDiverseWindows).
    const shortlistSize = trip.shortlistSize ?? 5;
    const shortlist = selectDiverseWindows(ranked.feasible, shortlistSize);

    const text = renderTripCard({
      destinations: trip.destinationCandidates ?? [],
      durationMinDays: trip.durationMinDays,
      durationMaxDays: trip.durationMaxDays,
      ranked,
      participants,
      tripUrl: `${deps.publicBaseUrl}/t/${trip.shortCode}`,
      selected,
      diagnostics,
      shortlist,
      shortlistSize,
      horizonStart: trip.horizonStart,
      horizonEnd: trip.horizonEnd,
    });

    let keyboard: InlineKeyboard | undefined;
    if (!selected && shortlist.length > 0) {
      keyboard = new InlineKeyboard();
      if (shortlistSize > 3 && shortlist.length > 3) {
        // Round one: the group reacts to the spread before choosing.
        keyboard.text("Narrow to 3", "trip:narrow");
        // The bot already knows who is missing; until now it never asked.
        const quiet = shortlist[0]!.participants.filter(
          (p) => p.status === "UNANSWERED" || p.dayCounts.unknown > 0,
        );
        if (quiet.length > 0) keyboard.text("Ask the quiet ones", "trip:nudge");
      } else {
        // Final round: one button per remaining option.
        shortlist.forEach((w) => {
          keyboard!
            .text(
              formatDateRange(w.window.start, w.window.end),
              `sel:${w.window.start}:${w.window.end}`,
            )
            .row();
        });
      }
    }

    if (trip.cardMessageId && !options.forceNew) {
      try {
        await ctx.api.editMessageText(chatId, Number(trip.cardMessageId), text, {
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });
      } catch (error) {
        // Telegram rejects edits that would not change anything — expected
        // whenever a parsed message doesn't move the ranking.
        const description = String(error);
        if (!description.includes("message is not modified")) {
          console.error("card edit failed", error);
        }
      }
      return;
    }

    const message = await ctx.api.sendMessage(chatId, text, {
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
    await setCardMessageId(deps.db, trip.id, String(message.message_id));
    void recordEvent(deps.db, {
      event: "shortlist_shown",
      tripId: trip.id,
      chatId,
      properties: {
        options: shortlist.length,
        round: shortlistSize,
        participants: travelling.length,
        feasible: ranked.feasible.length,
        diagnostics: diagnostics.length,
      },
    });
  }

  interface PendingEdit {
    tripId: string;
    edit: NonNullable<ReturnType<typeof parseTripEdit>>;
    current: string[];
  }
  const pendingEdits = new Map<string, PendingEdit>();
  let pendingEditSeq = 1;
  const extractorHealth = new ExtractorHealth();

  async function isTripOrganiser(
    trip: Trip,
    from: { id: number; first_name: string; last_name?: string },
  ): Promise<boolean> {
    const user = await upsertTelegramUser(deps.db, {
      telegramUserId: String(from.id),
      displayName: [from.first_name, from.last_name].filter(Boolean).join(" "),
    });
    return user.id === trip.organiserId;
  }

  async function applyTripEdit(
    trip: Trip,
    edit: NonNullable<ReturnType<typeof parseTripEdit>>,
    current: readonly string[],
  ): Promise<void> {
    if (edit.destination) {
      await setDestinationCandidates(
        deps.db,
        trip.id,
        applyDestinationEdit(current, edit.destination),
      );
    }
    if (edit.horizon || edit.duration) {
      await setTripShape(deps.db, trip.id, {
        horizonStart: edit.horizon?.start,
        horizonEnd: edit.horizon?.end,
        durationMinDays: edit.duration?.min,
        durationMaxDays: edit.duration?.max,
      });
    }
  }

  bot.callbackQuery(/^edit:(\d+)$/, async (ctx) => {
    const key = (ctx.match as RegExpMatchArray)[1]!;
    const pending = pendingEdits.get(key);
    if (!pending) {
      await ctx.answerCallbackQuery("That suggestion has expired.");
      return;
    }
    const trip = await getTripById(deps.db, pending.tripId);
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }
    if (!(await isTripOrganiser(trip, ctx.from))) {
      await ctx.answerCallbackQuery({
        text: "Only the organiser can change the trip.",
        show_alert: true,
      });
      return;
    }
    await applyTripEdit(trip, pending.edit, pending.current);
    pendingEdits.delete(key);
    await ctx.answerCallbackQuery("Updated.");
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated, { forceNew: true });
  });

  bot.callbackQuery("trip:begin", async (ctx) => {
    if (!ctx.chat || !isGroup(ctx)) return;
    const existing = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat.id),
    );
    if (existing) {
      await ctx.answerCallbackQuery("Already planning a trip here.");
      return;
    }

    const organiser = await upsertTelegramUser(deps.db, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    // Nothing is asked for up front — the defaults are honest placeholders
    // and conversation reshapes them ("Japan", "next year", "a week").
    const horizon = defaultHorizon(today());
    const trip = await createTrip(deps.db, {
      organiserUserId: organiser.id,
      destinationCandidates: [],
      horizonStart: horizon.start,
      horizonEnd: horizon.end,
      durationMinDays: DEFAULT_DURATION.min,
      durationMaxDays: DEFAULT_DURATION.max,
      telegramChatId: String(ctx.chat.id),
    });
    await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });

    void recordEvent(deps.db, {
      event: "planning_started",
      tripId: trip.id,
      chatId: String(ctx.chat.id),
      properties: { via: "join_button" },
    });
    await ctx.answerCallbackQuery("Listening now.");
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await refreshTripCard(ctx, trip);
  });

  bot.callbackQuery("trip:nudge", async (ctx) => {
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }
    if (!(await isTripOrganiser(trip, ctx.from))) {
      await ctx.answerCallbackQuery({
        text: "Only the organiser can send a nudge.",
        show_alert: true,
      });
      return;
    }

    const people = await loadTripPlanningState(deps.db, trip.id);
    const quiet = people.filter(
      (p) => !p.optedOut && p.declarations.length === 0,
    );
    const pending = people.filter(
      (p) =>
        !p.optedOut &&
        p.declarations.some((d) => d.state === "UNKNOWN"),
    );
    if (quiet.length === 0 && pending.length === 0) {
      await ctx.answerCallbackQuery("Everyone's already answered.");
      return;
    }

    const parts: string[] = [];
    if (quiet.length > 0) {
      parts.push(
        `${quiet.map((p) => p.displayName).join(", ")} — your dates would lock this in. ` +
          "Just say when you can't make it.",
      );
    }
    if (pending.length > 0) {
      parts.push(
        `${pending.map((p) => p.displayName).join(", ")} — any news on your roster?`,
      );
    }
    // No "count me out" nag: opting out is already a valid answer, and
    // pestering someone who has quietly decided not to travel is worse than
    // waiting.
    parts.push("Not coming? Say “count me out” and I'll take you off.");

    void recordEvent(deps.db, {
      event: "nudge_sent",
      tripId: trip.id,
      chatId: String(ctx.chat!.id),
      properties: { quiet: quiet.length, rosterPending: pending.length },
    });
    await ctx.answerCallbackQuery("Asked them.");
    await ctx.reply(parts.join("\n\n"));
  });

  bot.callbackQuery("trip:narrow", async (ctx) => {
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }
    const presser = await upsertTelegramUser(deps.db, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    if (presser.id !== trip.organiserId) {
      await ctx.answerCallbackQuery({
        text: "Only the organiser can narrow the options.",
        show_alert: true,
      });
      return;
    }
    await setShortlistSize(deps.db, trip.id, 3);
    await ctx.answerCallbackQuery("Narrowed to 3.");
    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated);
  });

  bot.command("dates", async (ctx) => {
    if (!isGroup(ctx)) return;
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat.id),
    );
    if (!trip) {
      await ctx.reply("No trip being planned here yet — /newtrip to start one.");
      return;
    }
    // Always a fresh message: /dates is asked precisely because the card has
    // scrolled away, so editing it in place would look like nothing happened.
    await refreshTripCard(ctx, trip, { forceNew: true });
  });

  /** Only the organiser confirms dates (founder-decided, docs/DECISIONS.md). */
  bot.callbackQuery(/^sel:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const [, start, end] = ctx.match as RegExpMatchArray;
    const trip = await findActivePlanningTripByChatId(
      deps.db,
      String(ctx.chat!.id),
    );
    if (!trip) {
      await ctx.answerCallbackQuery("That trip is no longer active.");
      return;
    }

    const participants = await loadTripPlanningState(deps.db, trip.id);
    const organiser = participants.find((p) => p.isOrganiser);
    const presser = await upsertTelegramUser(deps.db, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });
    const organiserUserId = trip.organiserId;

    if (presser.id !== organiserUserId) {
      await ctx.answerCallbackQuery({
        text: `Only ${organiser?.displayName ?? "the organiser"} can confirm the dates.`,
        show_alert: true,
      });
      return;
    }

    await selectTripDates(deps.db, trip.id, start!, end!);
    void recordEvent(deps.db, {
      event: "date_selected",
      tripId: trip.id,
      chatId: String(ctx.chat!.id),
      properties: { start, end },
    });
    await ctx.answerCallbackQuery("Dates confirmed 🎉");
    const updated = await getTripById(deps.db, trip.id);
    if (updated) await refreshTripCard(ctx, updated);
  });

  // ---- Inline calendar ---------------------------------------------------
  // Telegram has no drag or gesture support, so a range is three taps: mode,
  // start, end (brief §12). State is keyed by message so a shared group card
  // stays usable only by whoever opened it.
  interface OpenCalendar {
    ownerId: number;
    tripId: string;
    participantId: string;
    horizonStart: ISODate;
    horizonEnd: ISODate;
    state: CalendarState;
  }
  const calendars = new Map<string, OpenCalendar>();
  const calendarKey = (chatId: number, messageId: number) =>
    `${chatId}:${messageId}`;

  async function drawCalendar(
    ctx: Context,
    open: OpenCalendar,
    messageId: number,
  ): Promise<void> {
    const declarations = await listDeclarations(deps.db, open.participantId);
    const anchor = open.state.monthAnchor;
    const monthEnd = `${anchor.slice(0, 7)}-${String(
      new Date(
        Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0),
      ).getUTCDate(),
    ).padStart(2, "0")}`;
    const existing = resolveRange(declarations, anchor, monthEnd);

    const rows = renderCalendarKeyboard(open.state, existing, {
      min: open.horizonStart,
      max: open.horizonEnd,
    });
    const keyboard = new InlineKeyboard();
    for (const row of rows) {
      for (const button of row) keyboard.text(button.text, button.data);
      keyboard.row();
    }

    await ctx.api.editMessageText(
      ctx.chat!.id,
      messageId,
      calendarCaption(open.state),
      { reply_markup: keyboard },
    );
  }

  bot.command("calendar", async (ctx) => {
    if (!ctx.from) return;
    const trip = isGroup(ctx)
      ? await findActivePlanningTripByChatId(deps.db, String(ctx.chat.id))
      : undefined;
    if (!trip) {
      await ctx.reply("No trip being planned here yet — /newtrip to start one.");
      return;
    }
    if (!trip.horizonStart || !trip.horizonEnd) {
      await ctx.reply("This trip has no date range yet, so there's nothing to mark.");
      return;
    }

    const participant = await ensureParticipantForTelegramUser(deps.db, trip.id, {
      telegramUserId: String(ctx.from.id),
      displayName: [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean)
        .join(" "),
    });

    const state: CalendarState = {
      mode: "UNAVAILABLE",
      monthAnchor: monthStart(trip.horizonStart),
    };
    const message = await ctx.reply(calendarCaption(state));
    const open: OpenCalendar = {
      ownerId: ctx.from.id,
      tripId: trip.id,
      participantId: participant.id,
      horizonStart: trip.horizonStart,
      horizonEnd: trip.horizonEnd,
      state,
    };
    calendars.set(calendarKey(ctx.chat.id, message.message_id), open);
    await drawCalendar(ctx, open, message.message_id);
  });

  bot.callbackQuery(/^cal:/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    if (data === "cal:x") {
      await ctx.answerCallbackQuery();
      return;
    }

    const messageId = ctx.callbackQuery.message?.message_id;
    if (!messageId || !ctx.chat) return;
    const open = calendars.get(calendarKey(ctx.chat.id, messageId));
    if (!open) {
      await ctx.answerCallbackQuery("This calendar has expired — /calendar to reopen.");
      return;
    }
    if (ctx.from.id !== open.ownerId) {
      await ctx.answerCallbackQuery({
        text: "This calendar belongs to someone else — /calendar opens your own.",
        show_alert: true,
      });
      return;
    }

    if (data.startsWith("cal:m:")) {
      const mode = MODE_BY_CODE.get(data.slice(6));
      if (mode) {
        open.state.mode = mode;
        open.state.pendingStart = undefined;
      }
      await ctx.answerCallbackQuery();
      await drawCalendar(ctx, open, messageId);
      return;
    }

    if (data.startsWith("cal:n:")) {
      open.state.monthAnchor = `${data.slice(6)}-01`;
      await ctx.answerCallbackQuery();
      await drawCalendar(ctx, open, messageId);
      return;
    }

    if (data === "cal:c") {
      open.state.pendingStart = undefined;
      await ctx.answerCallbackQuery("Range cancelled.");
      await drawCalendar(ctx, open, messageId);
      return;
    }

    if (data === "cal:done") {
      calendars.delete(calendarKey(ctx.chat.id, messageId));
      await ctx.answerCallbackQuery("Saved.");
      await ctx.api.editMessageText(
        ctx.chat.id,
        messageId,
        "Thanks — got your dates. /calendar anytime to add more.",
      );
      const trip = await getTripById(deps.db, open.tripId);
      if (trip) await refreshTripCard(ctx, trip);
      return;
    }

    if (data.startsWith("cal:d:")) {
      const date = data.slice(6) as ISODate;

      if (!open.state.pendingStart) {
        open.state.pendingStart = date;
        await ctx.answerCallbackQuery("Now tap the last day.");
        await drawCalendar(ctx, open, messageId);
        return;
      }

      const { start, end } = orderRange(open.state.pendingStart, date);
      open.state.pendingStart = undefined;
      await addCalendarDeclaration(deps.db, open.participantId, {
        state: open.state.mode,
        startDate: start,
        endDate: end,
      });
      await ctx.answerCallbackQuery(
        start === end ? `Saved ${start}` : `Saved ${start} → ${end}`,
      );
      await drawCalendar(ctx, open, messageId);

      const trip = await getTripById(deps.db, open.tripId);
      if (trip) await refreshTripCard(ctx, trip);
    }
  });

  // A failed API call previously vanished into the console, so the group saw
  // the bot silently ignore them — which reads as poor accuracy rather than a
  // bug, and corrupts any judgement about how well parsing works.
  let lastErrorAt = 0;
  bot.catch(async (err) => {
    // Full detail to the log, keyed by a reference the user can quote.
    const { ref, kind } = logBotError(err.ctx, err.error);
    void recordEvent(deps.db, {
      event: "bot_error",
      chatId: err.ctx.chat ? String(err.ctx.chat.id) : null,
      properties: { ref, kind },
    });

    // One apology a minute at most: an error inside the error path must not
    // become a loop, and a burst of failures should not bury the chat.
    const now = Date.now();
    if (now - lastErrorAt < 60_000) return;
    lastErrorAt = now;
    try {
      if (err.ctx.callbackQuery) {
        await err.ctx.answerCallbackQuery(userFacingCallbackError(ref));
      } else if (err.ctx.chat) {
        await err.ctx.reply(userFacingError(ref));
      }
    } catch {
      // The chat is unreachable; the logged entry above is all we can do.
    }
  });

  return bot;
}

export type { Trip };
