# AGENTS.md

Instructions for any coding agent (Claude Code, Codex, or otherwise) working in this repository.

## Read these first, in order

1. `docs/PRODUCT_BRIEF.md` — the full founder brief. Canonical source of truth for product thesis, object model, lifecycle, UX rules, brand, and tech stack preferences.
2. `docs/DECISIONS.md` — research-validated refinements and open questions layered on top of the brief. Where this contradicts the brief, `DECISIONS.md` wins — but the contradiction itself is documented there, not silently applied.

The repository, not any chat history, is the source of truth. If you are starting fresh with no memory of how this project came to be, these two files are everything you need.

## Architecture boundaries

- **Telegram is one adapter, not the architecture.** Business logic lives in the trip engine package, not in Telegram bot handlers. The trip engine must be able to run headless / be called from a web backend later without modification.
- **LLM parses, the engine decides.** Natural-language input is converted to structured constraints by an LLM. Feasibility, intersection logic, ranking, and any date-selection math are deterministic code, never LLM output. See brief section 26.
- **Preserve original user text** on every natural-language-derived constraint, for auditability.
- **Availability has five states**, not three: `AVAILABLE`, `MAYBE`, `UNAVAILABLE`, `UNKNOWN`, `UNANSWERED`. Do not collapse `UNKNOWN` into `UNAVAILABLE` or `UNANSWERED` anywhere in the data model or UI — this distinction is the product's core validated differentiator (see `DECISIONS.md`).
- **Own application architecture, rent infrastructure.** Recommended stack is in brief section 25 — TypeScript, Hono/Fastify, Drizzle, Neon Postgres, Railway. Don't introduce a different backend language or a heavier framework without a documented reason added to `DECISIONS.md`.
- **Telegram identity is not canonical identity.** Every user is a UUID-keyed Timeaway User with linked external identities (`telegram_user_id`, `email`, etc.) from day one, even though Telegram is the only client at MVP. Retrofitting this later is expensive; do it correctly from the first schema.

## MVP scope discipline

Do **not** build, even if it seems small: native iOS app, Telegram Mini App, live flight integration, weather, itinerary builder, expense splitting, booking management, public profiles, public travel feed, complex travel circles, payments, social network features, AI itinerary generation. Full list and reasoning in brief section 29.

If a task seems to require one of these, stop and flag it rather than quietly building a small version of it.

## Target user for this MVP

Singapore, Telegram-native, ages 23–29, early-career, plans trips periodically with an established friend group. This is narrower than brief section 7's stated 25–40 — see `docs/DECISIONS.md` for why. Use this when making UX or copy judgment calls (e.g. tone, assumed leave allowance, assumed Telegram fluency).

## Naming constraint

Do not reference other group-trip-planning products by name anywhere in this repository's user-facing copy, marketing content, or code comments/identifiers, except where `docs/DECISIONS.md` explicitly discusses Howbout as an internal competitive reference point. This is an explicit founder instruction, not a default policy — don't relax it without being told to.

## How to work

Prefer small, explicit implementation tasks over broad ones. Do not attempt "build Timeaway" as a single task. Brief section 28 gives a reasonable starting sequence:

```
1. Scaffold monorepo
2. Implement User / Trip / Participant models
3. Implement availability model
4. Implement candidate-window generation
5. Implement hard-constraint engine
6. Implement ranking
7. Implement Telegram trip creation
8. Implement natural-language constraint parsing
9. Implement Telegram calendar range input
10. Implement result summaries
11. Add web trip read-only view
```

Suggested repo structure is in brief section 27 (`apps/telegram-bot`, `packages/trip-engine`, `packages/database`, `packages/shared`). This repo doesn't have that structure yet — task 1 above is to create it.

## Testing expectations

Not yet specified by the founder. Default to: the trip engine (constraint intersection, ranking) is pure, deterministic logic and should be unit-tested thoroughly since it's the one part of the system that must never be wrong. Telegram bot handlers and web views are thinner and can be tested more lightly. Don't invent a heavier testing policy than this without checking — ask rather than assume if it becomes a real decision point.

## When you're unsure

If a design question isn't answered by `docs/PRODUCT_BRIEF.md` or `docs/DECISIONS.md`, don't guess and move on silently — either ask the founder, or make the smallest reasonable assumption and record it as a new entry in `docs/DECISIONS.md` so it doesn't get silently reversed or rediscovered later.
