import { raw } from "hono/html";
import { BRAND } from "../theme.js";
import { CHAT_BUBBLES, HERO_CSS, HERO_SCRIPT } from "./hero.js";
import { Layout, Logo } from "./layout.js";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Add Timeaway to the group chat",
    body: "Nobody else installs anything, signs up, or links a calendar.",
  },
  {
    n: "02",
    title: "Just talk about dates",
    body: "“Can’t do October.” “Max 2 days leave.” “Roster not out yet.” It picks them up as you go.",
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
      extraCss={HERO_CSS}
      script={HERO_SCRIPT}
    >
      <div class="stage" aria-hidden="true">
        <div class="orb" />
      </div>

      <header
        class="wrap"
        style="position:relative;z-index:2;padding-top:26px;padding-bottom:6px"
      >
        <Logo />
      </header>

      {/* Act one — the unresolved group chat. */}
      <section class="scene" id="act-hero" style="min-height:96svh;padding-top:30px">
        <p
          style={`font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.jetlag}`}
        >
          Every group trip starts here
        </p>
        <h1 style="font-size:clamp(42px,7vw,78px);margin-top:20px;max-width:820px">
          find the days
          <br />
          that work.
        </h1>

        <div class="bubbles">
          {CHAT_BUBBLES.map((b) => (
            <div
              class={`bubble ${b.side}`}
              style={`--bx:${b.x};--by:${b.y};--bz:${b.z};--bd:${b.delay}s`}
            >
              {b.text}
            </div>
          ))}
        </div>

        <p class="muted" style="font-size:17px;max-width:520px;margin-top:8px">
          Five people, four constraints, nobody with the full picture.
        </p>
      </section>

      {/* Act two — the sphere resolves it. */}
      <section class="scene" id="act-sphere">
        <div class="on-orb">
          <h2>
            It knows the difference between “no” and “not yet”.
          </h2>
          <p>
            Rosters that drop a month ahead. Leave that isn’t approved. Most
            tools read “I don’t know yet” as a no and quietly drop you from the
            plan. Timeaway keeps you in it, and works the rest out.
          </p>
        </div>
      </section>

      {/* Act three — the answer. */}
      <section class="scene" id="act-result">
        <p
          style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff;opacity:.85;margin-bottom:26px"
        >
          Fourteen messages later, without the fourteen messages
        </p>
        <div class="result">
          <p style={`font-size:14px;font-weight:600;color:${BRAND.jetlag}`}>
            Japan · 4–6 days
          </p>
          <h3 style="font-size:38px;margin:12px 0 4px">7–10 Nov</h3>
          <p class="muted" style="font-size:15px;margin-bottom:22px">
            Deepavali long weekend
          </p>
          <div style="display:grid;gap:12px;font-size:16px;font-weight:600">
            <div style={`color:${BRAND.available}`}>✓ 3 can make it</div>
            <div style={`color:${BRAND.unknown}`}>◦ Farah — roster not out yet</div>
            <div style={`color:${BRAND.carryOn}`}>Costs 1 leave day</div>
          </div>
        </div>
        <a
          class="btn"
          href={botUrl}
          style={`margin-top:34px;background:#fff;color:${BRAND.layover}`}
        >
          Start a trip on Telegram
        </a>
        <p style="font-size:14px;color:#fff;opacity:.85;margin-top:16px">
          Free · no sign-up · your friends don’t need the app
        </p>
      </section>

      {/* Back to solid ground for the explanatory half. */}
      <div style={`position:relative;z-index:1;background:${BRAND.cloud}`}>
        <section class="wrap" style="padding:88px 0 40px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
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

        <section class="wrap" style="padding:10px 0 78px;text-align:center">
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
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

        <section
          id="waitlist"
          style={`background:${BRAND.white};border-top:1px solid ${BRAND.contrail};padding:74px 0`}
        >
          <div class="wrap" style="max-width:560px;text-align:center">
            <h2 style="font-size:clamp(24px,3vw,32px)">Want the app when it lands?</h2>
            <p class="muted" style="font-size:17px;margin:14px 0 26px">
              Timeaway works in Telegram today. Leave your email and we’ll tell
              you when the app arrives — nothing else, ever.
            </p>
            {signedUp ? (
              <p style={`color:${BRAND.available};font-weight:600;font-size:17px`}>
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

        <footer style={`border-top:1px solid ${BRAND.contrail};padding:34px 0`}>
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
      </div>
      {raw("")}
    </Layout>
  );
}
