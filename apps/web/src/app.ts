import type { Db } from "@timeaway/database";
import {
  addWaitlistSignup,
  isValidEmail,
  loadPublicTripView,
} from "@timeaway/database";
import {
  diagnoseParticipants,
  evaluateWindows,
  generateCandidateWindows,
  rankForDisplay,
  selectDiverseWindows,
  SG_PUBLIC_HOLIDAYS,
} from "@timeaway/trip-engine";
import { Hono } from "hono";
import {
  ICON_PNG_BASE64,
  MARK_PNG_BASE64,
  WORD_PNG_BASE64,
} from "./assets/generated.js";
import { LandingPage } from "./pages/landing.js";
import { TripPage } from "./pages/trip.js";

export interface WebDeps {
  db: Db;
  /** Deep link to the bot — the primary CTA everywhere. */
  botUrl: string;
}

/**
 * The public web surface: a hero landing page and read-only trip views.
 *
 * Kept in its own app because Telegram is one adapter, not the architecture
 * (AGENTS.md) — though both are served by a single process today. Rendering
 * uses hono/jsx so user-supplied text (destinations, first names) is escaped
 * automatically rather than by remembering to call an escape helper.
 */
export function createWebApp(deps: WebDeps): Hono {
  const app = new Hono();

  // Brand assets, cropped from the kit and inlined at build time. Decoded once
  // here and served with immutable caching, so pages stay small.
  const decode = (base64: string): Uint8Array =>
    Uint8Array.from(Buffer.from(base64, "base64"));

  const ASSETS: Record<string, Uint8Array> = {
    "mark.png": decode(MARK_PNG_BASE64),
    "wordmark.png": decode(WORD_PNG_BASE64),
    "icon.png": decode(ICON_PNG_BASE64),
  };

  app.get("/assets/:file", (c) => {
    const body = ASSETS[c.req.param("file")];
    if (!body) return c.notFound();
    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  app.get("/favicon.ico", (c) => c.redirect("/assets/icon.png", 301));

  app.get("/", (c) =>
    c.html(
      LandingPage({
        botUrl: deps.botUrl,
        signedUp: c.req.query("joined") === "1",
      }) as string,
    ),
  );

  app.get("/t/:code", async (c) => {
    const view = await loadPublicTripView(deps.db, c.req.param("code"));
    if (!view) return c.notFound();

    const canCompute =
      view.horizonStart !== null &&
      view.horizonEnd !== null &&
      view.durationMinDays !== null &&
      view.durationMaxDays !== null;

    // Opt-outs constrain nothing, exactly as in the bot.
    const engineParticipants = view.participants
      .filter((p) => !p.optedOut)
      .map((p, index) => ({
      id: String(index),
      declarations: p.declarations,
      maxLeaveDays: p.maxLeaveDays ?? undefined,
      }));

    const windows = canCompute
      ? generateCandidateWindows({
          horizonStart: view.horizonStart!,
          horizonEnd: view.horizonEnd!,
          durationMinDays: view.durationMinDays!,
          durationMaxDays: view.durationMaxDays!,
        })
      : [];

    const ranked = canCompute
      ? rankForDisplay(
          evaluateWindows(windows, engineParticipants, SG_PUBLIC_HOLIDAYS),
        )
      : { feasible: [], nearMisses: [] };

    const diagnostics = canCompute
      ? diagnoseParticipants({
          participants: engineParticipants,
          windows,
          horizonStart: view.horizonStart!,
          horizonEnd: view.horizonEnd!,
          publicHolidays: SG_PUBLIC_HOLIDAYS,
        })
      : [];

    // Live planning data — never let a browser serve a stale copy. Telegram's
    // in-app browser in particular will happily cache HTML without this.
    const shortlist = selectDiverseWindows(ranked.feasible, view.shortlistSize);

    c.header("Cache-Control", "no-store, must-revalidate");
    return c.html(
      TripPage({
        view,
        ranked,
        diagnostics,
        shortlist,
        botUrl: deps.botUrl,
      }) as string,
    );
  });

  app.post("/waitlist", async (c) => {
    const body = await c.req.parseBody();
    const email = String(body.email ?? "").trim();
    if (!isValidEmail(email)) {
      return c.redirect("/?error=email", 303);
    }
    await addWaitlistSignup(deps.db, {
      email,
      source: String(body.source ?? "landing"),
      tripShortCode: body.trip ? String(body.trip) : null,
    });
    // Redirect after POST so a refresh doesn't resubmit.
    return c.redirect("/?joined=1#waitlist", 303);
  });

  app.notFound((c) =>
    c.html(
      `<!doctype html><meta charset="utf-8"><title>Not found — Timeaway</title>
       <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:18vh auto;padding:0 24px;text-align:center">
         <h1 style="font-size:28px;margin-bottom:12px">This trip link isn’t live</h1>
         <p style="color:#6D7179;line-height:1.6">It may have been archived, or the link is incomplete.</p>
         <p style="margin-top:24px"><a href="/" style="color:#4657E8;font-weight:600">Go to timeaway</a></p>
       </div>`,
      404,
    ),
  );

  return app;
}
