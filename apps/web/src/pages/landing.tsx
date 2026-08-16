import { BRAND } from "../theme.js";
import { Layout, Logo } from "./layout.js";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Add Timeaway to the group chat",
    body: "No one else has to install anything, sign up, or link a calendar.",
  },
  {
    n: "02",
    title: "Just talk about dates",
    body: "“Can’t do October.” “Max 2 days leave.” “Roster not out yet.” Timeaway picks it up as you go.",
  },
  {
    n: "03",
    title: "Get dates that actually work",
    body: "Ranked windows with the leave cost worked out — and who each one leaves out.",
  },
];

export function LandingPage({ botUrl, signedUp }: { botUrl: string; signedUp?: boolean }) {
  return (
    <Layout
      title="Timeaway — find the days that work"
      description="Timeaway helps friend groups turn “when are you guys free?” into actual trip dates."
    >
      <header class="wrap" style="padding-top:26px;padding-bottom:26px">
        <Logo />
      </header>

      {/* Hero — the Horizon gradient is a marketing surface only (brief §22). */}
      <section
        style={`background:${BRAND.horizon};color:#fff;padding:84px 0 92px;position:relative;overflow:hidden`}
      >
        <div class="wrap" style="position:relative;max-width:900px;text-align:center">
          <p
            style="font-size:14px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;opacity:.86;margin-bottom:22px"
          >
            For friend groups who keep saying “we should travel”
          </p>
          <h1 style="font-size:clamp(44px,7.4vw,80px);color:#fff">
            find the days
            <br />
            that work.
          </h1>
          <p
            style="font-size:clamp(17px,2.1vw,21px);margin:26px auto 36px;max-width:600px;opacity:.94"
          >
            Turn “when are you guys free?” into actual trip dates — without the
            twelve-message back-and-forth.
          </p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a
              class="btn"
              href={botUrl}
              style={`background:#fff;color:${BRAND.layover}`}
            >
              Start a trip on Telegram
            </a>
            <a class="btn" href="#how" style="border-color:rgba(255,255,255,.5);color:#fff">
              See how it works
            </a>
          </div>
          <p style="font-size:14px;opacity:.82;margin-top:20px">
            Free · no sign-up · your friends don’t need the app
          </p>
        </div>
      </section>

      {/* The differentiator, stated plainly. */}
      <section class="wrap" style="padding:80px 0 10px;max-width:820px;text-align:center">
        <h2 style="font-size:clamp(28px,3.6vw,40px)">
          It knows the difference between
          <span style={`color:${BRAND.cant}`}> “no” </span>
          and
          <span style={`color:${BRAND.unknown}`}> “not yet”.</span>
        </h2>
        <p class="muted" style="font-size:18px;margin-top:20px">
          Shift work, rosters that drop a month ahead, leave that hasn’t been
          approved. Most tools treat “I don’t know yet” as a no and quietly drop
          you from the plan. Timeaway keeps you in it.
        </p>
        <div
          style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:28px"
        >
          <span class="chip" style={`background:#E7F3EE;color:${BRAND.available}`}>
            ✓ Works
          </span>
          <span class="chip" style={`background:#FBF0DC;color:${BRAND.maybe}`}>
            ? Maybe
          </span>
          <span class="chip" style={`background:#FBEAE8;color:${BRAND.cant}`}>
            ✕ Can’t
          </span>
          <span class="chip" style={`background:${BRAND.contrail};color:${BRAND.unknown}`}>
            ◦ Don’t know yet
          </span>
        </div>
      </section>

      <section id="how" class="wrap" style="padding:72px 0">
        <div
          style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px"
        >
          {STEPS.map((step) => (
            <div class="card">
              <div
                style={`font-size:13px;font-weight:700;letter-spacing:.1em;color:${BRAND.layover};margin-bottom:14px`}
              >
                {step.n}
              </div>
              <h3 style="font-size:20px;margin-bottom:10px">{step.title}</h3>
              <p class="muted" style="font-size:16px">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample of the real output, so the promise is concrete. */}
      <section class="wrap" style="padding:10px 0 84px">
        <div
          class="card"
          style="max-width:520px;margin:0 auto;border-radius:24px;padding:30px"
        >
          <p
            style={`font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.jetlag};margin-bottom:16px`}
          >
            What the group sees
          </p>
          <p style="font-size:15px;font-weight:600">Japan · 4–6 days</p>
          <h3 style="font-size:30px;margin:14px 0 4px">7–10 Nov</h3>
          <p class="muted" style="font-size:15px;margin-bottom:20px">
            Deepavali long weekend
          </p>
          <div style="display:grid;gap:11px;font-size:16px">
            <div style={`color:${BRAND.available};font-weight:600`}>
              ✓ 3 can make it
            </div>
            <div style={`color:${BRAND.unknown};font-weight:600`}>
              ◦ Farah — roster not out yet
            </div>
            <div style={`color:${BRAND.carryOn};font-weight:600`}>
              Costs 1 leave day
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist — deliberately secondary: the bot already works. */}
      <section style={`background:${BRAND.white};border-top:1px solid ${BRAND.contrail};padding:74px 0`}>
        <div class="wrap" style="max-width:560px;text-align:center">
          <h2 style="font-size:clamp(24px,3vw,32px)">Want the app when it lands?</h2>
          <p class="muted" style="font-size:17px;margin:14px 0 26px">
            Timeaway works in Telegram today. Leave your email and we’ll tell you
            when the app arrives — nothing else, ever.
          </p>
          {signedUp ? (
            <p
              style={`color:${BRAND.available};font-weight:600;font-size:17px`}
            >
              You’re on the list. Talk soon.
            </p>
          ) : (
            <form
              method="post"
              action="/waitlist"
              style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@email.com"
                aria-label="Email address"
                style="flex:1;min-width:240px"
              />
              <button class="btn btn-primary" type="submit">
                Keep me posted
              </button>
            </form>
          )}
        </div>
      </section>

      <footer
        style={`border-top:1px solid ${BRAND.contrail};padding:34px 0;background:${BRAND.cloud}`}
      >
        <div
          class="wrap"
          style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"
        >
          <Logo height={22} />
          <p class="muted" style="font-size:14px">
            plan together. travel better.
          </p>
        </div>
      </footer>
    </Layout>
  );
}
