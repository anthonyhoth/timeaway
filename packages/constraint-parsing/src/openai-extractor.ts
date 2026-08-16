import { AVAILABILITY_STATES, DECLARED_AVAILABILITY_STATES } from "@timeaway/shared";
import OpenAI from "openai";
import type {
  ConstraintExtractor,
  ExtractionContext,
  ExtractionResult,
} from "./types.js";

/**
 * Stage 2+3 of ambient triage in a single call: relevance + extraction.
 * gpt-5.6-luna (founder-decided) — OpenAI's fast/cheap tier, strict
 * structured outputs, low reasoning effort. The LLM only ever parses text
 * into structured constraints; it never decides feasibility, ranks, or
 * mutates anything (brief section 26 — unchanged by the provider choice).
 */
const MODEL = "gpt-5.6-luna";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" },
    subjectName: { type: ["string", "null"] },
    declarations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          state: { type: "string", enum: [...DECLARED_AVAILABILITY_STATES] },
          start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          end: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        },
        required: ["state", "start", "end"],
      },
    },
    maxLeaveDays: { type: ["integer", "null"] },
  },
  required: ["relevant", "subjectName", "declarations", "maxLeaveDays"],
} as const;

function systemPrompt(ctx: ExtractionContext): string {
  const horizon =
    ctx.horizonStart && ctx.horizonEnd
      ? `The trip is being planned within ${ctx.horizonStart} to ${ctx.horizonEnd}${ctx.destination ? ` (destination: ${ctx.destination})` : ""}.`
      : "No trip horizon is set yet.";
  return [
    "You extract structured travel-availability constraints from a single message in a friends' group chat planning a trip together. Singapore context: casual Singlish is common (\"cmi\" = cannot make it, \"can\" = yes).",
    `Today is ${ctx.today} (Singapore). ${horizon}`,
    "Rules:",
    "- relevant=false when the message carries no availability, leave, or scheduling information about a person. Jokes, plans about destinations, and logistics chatter are not relevant.",
    "- Extract only what is stated. Never invent dates.",
    `- states: ${AVAILABILITY_STATES.slice(0, 4).join(", ")} — use UNKNOWN when the person explicitly cannot know yet (\"roster not out\", \"depends on my posting\"). Do NOT use UNKNOWN for silence or vagueness; that is relevant=false.`,
    "- A bare month means the whole month; resolve years toward the trip horizon, else the next future occurrence.",
    "- \"max N days leave\" or similar caps go in maxLeaveDays, not declarations.",
    "- subjectName: null when the sender speaks for themselves; the stated name when they relay someone else's availability.",
    "- Date ranges are inclusive; single days have start = end.",
  ].join("\n");
}

export class OpenAiConstraintExtractor implements ConstraintExtractor {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extract(
    messageText: string,
    ctx: ExtractionContext,
  ): Promise<ExtractionResult> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt(ctx) },
        { role: "user", content: messageText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "constraint_extraction",
          strict: true,
          schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return EMPTY_RESULT;
    try {
      const parsed = JSON.parse(raw) as ExtractionResult;
      return {
        relevant: parsed.relevant === true,
        subjectName: parsed.subjectName ?? null,
        declarations: Array.isArray(parsed.declarations)
          ? parsed.declarations
          : [],
        maxLeaveDays: parsed.maxLeaveDays ?? null,
      };
    } catch {
      return EMPTY_RESULT;
    }
  }
}

const EMPTY_RESULT: ExtractionResult = {
  relevant: false,
  subjectName: null,
  declarations: [],
  maxLeaveDays: null,
};
