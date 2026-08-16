# Timeaway

Find the days that work.

Start with [AGENTS.md](./AGENTS.md) — it points to the founder brief and decisions log that are the source of truth for this project.

## Layout

```
apps/telegram-bot/   Telegram bot adapter (Hono)
packages/trip-engine/ Deterministic planning engine
packages/database/    Drizzle ORM + Neon Postgres
packages/shared/       Shared types across packages
```

## Development

```bash
pnpm install
pnpm dev
```
