# Start here

This folder is the handoff point for Timeaway from a research/planning session to implementation on another machine.

## What's in this repo right now

- `docs/PRODUCT_BRIEF.md` — the full founder brief (product thesis, object model, lifecycle, UX rules, tech stack, brand). Written before implementation, reproduced verbatim.
- `docs/DECISIONS.md` — refinements made during a market-validation research pass after the brief was written: narrowed target segment (23–29, Singapore, Telegram-native), the distribution model (link-passthrough, not bot-locked), the validated core differentiator (UNKNOWN vs UNANSWERED availability states), and the competitive positioning vs Howbout. Also records two open, unresolved items: the revenue model, and an accepted risk that budget may matter more to users than date-finding.
- `AGENTS.md` — operating instructions for any coding agent working in this repo: what to read first, architecture boundaries, scope discipline, naming constraints.
- `brand-kit.png` — existing brand asset.

No code exists yet. This is a docs-only handoff.

## What to do on this machine

1. Open this folder in Claude Code (or your agent of choice).
2. Have it read `AGENTS.md` first — it points to everything else.
3. First real implementation task is brief section 28 / `AGENTS.md`'s task list, item 1: scaffold the monorepo (`apps/telegram-bot`, `packages/trip-engine`, `packages/database`, `packages/shared`), per the structure in brief section 27.
4. `git init` and set up a remote when you're ready — not done yet, deliberately left for you to wire up on this machine with your own GitHub auth.

## Why it's structured this way

Per the brief's own section 28 ("Codex operating principle"): the repository, not any chat, should be the source of truth. These four files exist so a fresh agent session — on any machine, with zero memory of how this project was scoped — has everything it needs to start correctly without re-deriving decisions that were already made and validated.
