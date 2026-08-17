# Deploying Timeaway

One process serves the Telegram bot and the website. It needs Postgres
(already on Neon) and nothing else.

## First deploy

1. **Create the Railway project** and point it at this GitHub repo.
   `railway.json` already sets the build, start command and health check.

2. **Set environment variables** in Railway (copy values from your local
   `apps/telegram-bot/.env`):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string |
   | `TELEGRAM_BOT_TOKEN` | from @BotFather |
   | `OPENAI_API_KEY` | for constraint extraction |
   | `TELEGRAM_WEBHOOK_SECRET` | any long random string |
   | `PUBLIC_BASE_URL` | `https://timeaway.sg` once DNS resolves |
   | `BOT_DEEP_LINK` | `https://t.me/TimeawayBot` |
   | `BOT_MODE` | `webhook` |

3. **Run migrations** once, from your machine, against the same database:

   ```bash
   cd packages/database && pnpm db:migrate
   ```

4. **Point Telegram at the deployment**, replacing the host with Railway's:

   ```bash
   WEBHOOK_URL=https://<railway-host>/telegram/webhook pnpm --filter @timeaway/telegram-bot webhook:set
   ```

5. **Check it's alive**: `https://<railway-host>/health` returns `{"ok":true}`.

## Notes

- **Run one instance.** Wizard progress, open calendars and pending edits are
  held in memory, so a second instance would drop half of them. Scale only
  after that state moves to Postgres.
- **Polling still works** if the webhook misbehaves — set `BOT_MODE=polling`
  and redeploy. It is less efficient, not less correct.
- **A deploy restarts the process**, which clears those in-memory pieces.
  Anyone mid-wizard has to start again; stored trips and availability are
  unaffected.
- **Migrations are not automatic.** Run them before deploying a change that
  needs them, or the new code will query columns that do not exist yet.
