import { BRAND } from "../theme.js";
import { Layout, Logo } from "./layout.js";

/**
 * What is held, why, and how to get rid of it. Written plainly rather than as
 * boilerplate: the bot reads group conversation, which people are right to ask
 * about, and a vague policy would undermine the disclosure the bot already
 * makes in chat.
 */
export function PrivacyPage() {
  const Section = ({ title, children }: { title: string; children: unknown }) => (
    <section style="margin-bottom:34px">
      <h2 style="font-size:22px;margin-bottom:10px">{title}</h2>
      <div class="muted" style="font-size:16px">
        {children as never}
      </div>
    </section>
  );

  return (
    <Layout
      title="Privacy — Timeaway"
      description="What Timeaway stores, why, how long, and how to delete it."
    >
      <header class="wrap" style="padding:26px 0">
        <Logo />
      </header>

      <main class="wrap" style="max-width:680px;padding:20px 0 80px">
        <h1 style="font-size:clamp(30px,5vw,42px);margin-bottom:10px">Privacy</h1>
        <p class="muted" style="font-size:17px;margin-bottom:36px">
          Timeaway reads group chat to find trip dates. Here is exactly what
          that means.
        </p>

        <Section title="What we keep">
          <p>
            Only what is about planning: dates and availability you state,
            leave-day limits, destinations discussed, and remarks about budget
            or preferences. For anything derived from a message we store the
            message text itself, so you can always see why we recorded
            something.
          </p>
          <p style="margin-top:10px">
            We also keep your Telegram user ID and display name, and the ID of
            the group the trip belongs to.
          </p>
        </Section>

        <Section title="What we discard">
          <p>
            Every other message. Messages that do not look like planning are
            dropped as they arrive and are never written down — not logged, not
            stored, not sent anywhere.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            People in the trip, through the bot and the trip link. The trip link
            is unguessable but not password-protected, so treat it as shareable.
            It shows first names and per-person status — never anyone's
            day-by-day calendar.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Send <strong>/forget</strong> in the group. That removes your dates,
            your notes and your place in the trip immediately and permanently.
          </p>
          <p style="margin-top:10px">
            <strong>/pause</strong> stops the bot reading the chat at all.
            Removing the bot from a group stops it too.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Planning data lives as long as the trip does. Archived trips and
            their messages are deleted after 12 months. Waitlist emails are kept
            until you ask us to remove them.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            Message text that our own parser cannot interpret is sent to OpenAI
            to extract dates from it, and is not used to train their models.
            Nothing else leaves our systems.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, or a deletion request that <strong>/forget</strong>{" "}
            doesn't cover:{" "}
            <a href="mailto:hello@timeaway.sg" style={`color:${BRAND.layover};font-weight:600`}>
              hello@timeaway.sg
            </a>
            .
          </p>
        </Section>
      </main>

      <footer style={`border-top:1px solid ${BRAND.contrail};padding:30px 0`}>
        <div class="wrap" style="text-align:center">
          <p class="muted" style="font-size:14px">
            timeaway · find the days that work.
          </p>
        </div>
      </footer>
    </Layout>
  );
}
