# Decisions

Choices made after the founder brief (`docs/PRODUCT_BRIEF.md`) was written, with the reasoning and evidence behind each. These come from a market-validation research pass (last30days research tool + manual Reddit research with an authenticated session, since anonymous Reddit scraping was rate-limited). Treat these as authoritative over anything in the brief they contradict. Do not silently reverse a decision here without adding a new dated entry explaining why.

No dates are recorded per-decision since all of the below came out of a single research pass. If a future agent revisits one of these, add a dated append below it rather than editing it in place.

---

## Decision: MVP beachhead is Singapore, Telegram-native, ages 23–29 — not the brief's stated 25–40

**Why:** Section 7 of the brief names 25–40 working adults as the beachhead with no specific geography or channel-fit check. Research found:

- Telegram in Singapore is not a WhatsApp replacement for friend-group conversation generally — WhatsApp dominates at ~84–88% penetration in SG/UK-type markets, and a rich SG-focused Reddit thread on friendship in your 30s named WhatsApp repeatedly for exactly this kind of coordination, never Telegram.
- However: the founder has direct, first-hand confirmation that genuine multi-turn Telegram group-chat interaction (not just one-way deal/news channel subscription) exists among younger Singaporeans. This is treated as ground truth, not something to re-litigate with more research.
- Two SG-specific age segments were tested for fit:
  - **18–21 (pre/early-NS, grad-trip stage):** rich, real pain confirmed (see UNKNOWN/UNANSWERED decision below), but the trips are one-shot ("grad trip"), gated by parental permission (a constraint type outside the brief's model entirely), and don't fit the brief's repeat-planning / Travel Circles retention thesis. Poor fit for MVP.
  - **23–29 (post-NS, early-career):** matches the brief's repeat-trip and Travel Circles thesis, still young enough for Telegram fluency, still has annual leave (though less of it and less roster complexity than nurses/cabin-crew-style shift workers).

**Decision:** design and validate the MVP around 23–29-year-old Singaporeans, Telegram-native, not the full 25–40 band and not the younger grad-trip segment.

**How to apply:** any persona work, onboarding copy, or constraint-vocabulary design should assume this segment specifically — young professional, has some annual leave, no parental gating, plans with an established friend group, comfortable interacting with a bot in Telegram.

---

## Decision: distribution model is link-passthrough, not bot-embedded conversation

**Why:** Every competitor surveyed (Howbout, WhenAvailable, and other entrants in multiple independent 2026 "best group trip app" roundups) converges on the same pattern: generate a shareable link from wherever the tool lives, drop that link into whatever chat the friend group already uses (WhatsApp, iMessage, SMS, Telegram — doesn't matter). None of them require the whole friend group to relocate into one specific messenger. Real Telegram scheduling bots do exist and get genuine adoption for this exact use case (`@groupagreebot`, `@PollBot`), which proves bot-in-chat interaction is tolerated — but the category-wide convergence on link-passthrough is a stronger signal than any single data point.

**Decision:** the Telegram bot is the *organiser's* tool for triggering a trip and getting a shareable link back — it does not require every participant to be active inside a Telegram group chat with the bot. The organiser can drop the resulting link into whatever channel the friend group actually uses.

**How to apply:** the participant-facing flow (calendar range input, natural-language constraint submission) needs to work well from a shared web link, not only from inside a Telegram conversation. Don't design the MVP as if universal Telegram adoption across every participant is required — only the organiser needs to be Telegram-comfortable.

---

## Decision: UNKNOWN vs UNANSWERED is the core validated differentiator — treat it as load-bearing, not a nice-to-have

**Why:** Section 9's distinction between "hasn't answered" and "explicitly can't know yet" was found in the wild, unprompted, twice independently:

- Shift workers (nurses, cabin crew) manually posting their monthly roster into a group chat as soon as it releases, so friends can cross-reference it by hand — a manual version of exactly this state.
- Singapore JC/poly grads planning a "grad trip" who can't lock dates because their own university interview offers haven't arrived yet — a different but equally real instance of "I cannot answer this yet, and that's different from not answering."

No surveyed competitor (Howbout, WhenAvailable) appears to model this. Howbout's own users complain that its calendar display doesn't handle recurring/conditional date states well, which is consistent with a binary busy/free model that collapses "unknown" into either blank or unanswered.

**Decision:** the UNKNOWN state is not a v1.5 refinement — it should be present and visible in the MVP's Telegram calendar UX and in the ranked-window output (e.g. "4 available · 1 roster pending"), per the brief's own section 30 proof scenario.

---

## Decision: primary competitive differentiation vs Howbout is ranked decision output, not feature parity

**Why:** Howbout is a mature, well-resourced competitor — 10M claimed users, 4.8/5 across 75,000+ App Store reviews, calendar sync with Google/Outlook/iCloud, integrated chat. Timeaway cannot out-resource it on breadth. But Howbout's product surfaces availability as a raw overlay and leaves interpretation to the user; it has no travel-specific computation (duration ranges, leave-day cost, public-holiday stacking) because it is a general social-plans calendar, not a travel tool, and no evidence it models UNKNOWN as a state distinct from unanswered.

**Decision:** compete on being a categorically different tool — travel-specific constraint computation and a ranked, decided output — not on breadth of the "friend calendar" feature set. Do not chase itinerary, booking, or expense-splitting features to compete more broadly; that both violates the brief's own MVP exclusions (section 29) and abandons the actual differentiated ground.

**Concrete features this implies for the bot-stage MVP, in priority order:**
1. Ranked candidate windows as the output, not a raw availability grid.
2. UNKNOWN/MAYBE/UNANSWERED as first-class states in the inline calendar (see decision above).
3. Duration-range input and computed leave-day cost per candidate window — Howbout has no reason to build this; it's out of category for a generic plans calendar.
4. Structured natural-language constraint parsing, with the two-tap range calendar kept as the *primary* input path and NL as a supplement — NL accuracy risk means it should never be the only way in.
5. No calendar-sync/OAuth requirement to get started — trip-scoped, participant-declared constraints only, lower setup friction than Howbout's calendar-linking flow (this is a real tradeoff, not a free win: Howbout's sync means it's automatically current, Timeaway's requires manual re-declaration).

**Do not reference the competitor by name in anywhere-user-facing** — a related but separate instruction: the founder does not want any other specific competitor product referenced or labeled in Timeaway's own copy, docs, or code. Howbout can be discussed internally as a competitive reference point (as above); a different specific competitor researched earlier in the process must not be named anywhere in this repository at all, per explicit founder instruction.

---

## Open / unresolved: revenue model

**Status: not decided.** Section 19 of the brief excludes booking, flights, and hotels from scope, and states Timeaway's job ends at DATE_SELECTED. Research flagged this as a real risk: competing group-trip-planning startups (e.g. PathWrangler) have died specifically from lack of revenue while solving a similar coordination problem, and DATE_SELECTED is exactly the moment a group's purchase intent peaks — which the current scope hands away for free.

**Do not resolve this by silently expanding scope into booking/itinerary features** — that contradicts the brief's explicit exclusions and the validated differentiation strategy above. This needs a founder decision (e.g., an affiliate link at the DATE_SELECTED moment, a freemium Travel Circles tier, something else), not an engineering default. Flag it back to the founder if it becomes blocking; don't invent an answer.

---

## Decision (2026-08-16): initial database schema shape for User / Trip / Participant

Small implementation assumptions made while building the first schema (brief section 28, task 2), recorded here so they aren't silently reversed or rediscovered:

- **Travel Circles are not in the initial schema.** Trips reference an organiser and participants directly; no `circles` table yet. The brief's object model includes optional circles, but trips can exist without one, and "complex travel circles" is an MVP exclusion. A nullable `circle_id` on trips can be added when circles land — nothing in the current shape blocks it.
- **Participants can exist before the person has an account.** `participants.user_id` is nullable with an `invite_name` fallback (a check constraint requires at least one). This supports the link-passthrough distribution model — the organiser names friends up front ("Marcus"), and each friend claims their slot when they first respond via the shared link. Display strings like "? Marcus awaiting roster" work pre-claim.
- **`HAPPENED` is not in the `trip_status` enum.** The brief marks it optional-later and confirmation-only. Adding a Postgres enum value later is a one-line migration; leaving it out now keeps the state machine honest about what's actually implemented.
- **Trip horizon and selected window are stored as Postgres `date` columns** (calendar dates, no timezone), matching the product's day-granularity semantics. `selected_start`/`selected_end` live on the trip row; when candidate windows get their own table (task 4), the selected window may become a reference instead — that refactor is expected, not a reversal.

---

## Decision (2026-08-16): availability model — declarations as ranges, UNANSWERED as absence, latest-wins resolution

Implementation shape for brief section 28 task 3, recorded because each point is a semantic commitment, not just code:

- **Availability is stored as range declarations, not per-day rows.** A declaration is (participant, state, start, end, source, original text). "Can't do Sep 4–17" is one row, whether it came from the calendar or from parsed natural language — both sources produce the identical shape, per brief section 12. `source` is an enum (`CALENDAR` | `NATURAL_LANGUAGE`), and a check constraint requires `original_text` on NL-derived rows (the auditability rule).
- **UNANSWERED is never stored.** The declared-state enum has four values (`AVAILABLE`, `MAYBE`, `UNAVAILABLE`, `UNKNOWN`); UNANSWERED is the derived state of a date covered by no declaration. This is the direct encoding of "untouched calendar dates default to UNANSWERED" — not a collapse of the five-state model. All five states exist in the shared TypeScript type and in resolution output.
- **Overlap resolution is latest-declaration-wins, per date.** Declarations are ordered by creation; the most recent declaration covering a date determines its state. This makes corrections natural ("Can't do Sep 4–17" … "actually Sep 10 works") and makes roster releases work: a broad UNKNOWN over November gets overridden by concrete availability when the roster lands, without deleting history.
- **Date ranges are inclusive on both ends**, and dates are ISO `YYYY-MM-DD` strings end to end (Postgres `date` columns, string comparisons in the engine). No timezones anywhere in availability semantics.
- **Resolution lives in `@timeaway/trip-engine` as pure functions** (`resolveDay`, `resolveRange`), unit-tested, with the DB layer knowing nothing about precedence. Declarations are append-mostly; editing history is not required for MVP.

---

## Decision (2026-08-16, founder-decided): window-level classification, feasibility, and ranking semantics

The founder ruled directly on window classification, and confirmed the remaining three proposals in the same exchange. These are product semantics, not implementation details — do not change without a new founder decision.

**Per-participant classification of a candidate window (founder ruling):**

- AVAILABLE is strict: every single day in the window must be explicitly AVAILABLE. No exceptions.
- Any MAYBE or UNKNOWN day → the participant is MAYBE for the window. The engine preserves per-state day counts so display can distinguish UNKNOWN-driven maybe ("roster pending") from declared maybe — collapsing them in output would surrender the core differentiator.
- Any UNAVAILABLE day → UNAVAILABLE for the window, dominating everything else.
- Every day UNANSWERED → UNANSWERED ("hasn't responded"); answered-with-gaps → MAYBE with the gap counted. Silent non-responders stay visibly distinct from uncertain responders.

**Feasibility (founder-confirmed):** a window is eliminated iff at least one participant is UNAVAILABLE for it — via declared days or via a leave cap ("max 2 days leave" makes windows costing more leave UNAVAILABLE for that participant). MAYBE, roster-pending, and UNANSWERED never eliminate; planning proceeds without unanimous certainty. "Plan without X" is the future relaxation path.

**Ranking (founder-confirmed):** transparent lexicographic order, no weighted score — most clear-cut AVAILABLE participants → fewest leave days → fewest roster-pending → fewest MAYBE → earliest start → shortest duration. Every rank position must be explainable in one sentence.

**Leave computation (agent assumption, recorded):** leave cost = Mon–Fri days in the window that are not Singapore gazetted public holidays; weekend is Sat/Sun. The holiday set is injected data — the engine ships the MOM 2026 table (`SG_PUBLIC_HOLIDAYS_2026`) with Sunday-holiday observed Mondays listed explicitly. The 2027 list must be appended when MOM gazettes it (typically mid-year); coverage boundary is exported as `SG_HOLIDAY_COVERAGE_END`. One shared holiday calendar per trip at MVP — per-participant calendars (mixed-country groups) are a later concern.

---

## Decision (2026-08-16, founder-decided): Telegram bot uses grammY with webhooks

The bot framework is **grammY** (TypeScript-first, actively maintained, first-class Hono adapter) and the production update transport is a **webhook** into the same Hono service that serves everything else — one process on Railway, per the brief's single-service architecture. Long-polling exists only as the local-dev mode (`pnpm dev` / `BOT_MODE=polling`), since localhost can't receive webhooks. The webhook is authenticated with Telegram's `secret_token` echo; `pnpm webhook:set` registers the URL after deploys.

Supporting implementation choices made alongside (agent, recorded):

- **DB driver is node-postgres (`pg`), not Neon's HTTP driver.** Repositories need real transactions (user+identity, trip+organiser-participant are atomic pairs) and the API is a long-running server, so the standard Postgres protocol is the right fit. The database is still Neon — infrastructure choice unchanged.
- **Wizard state is in-memory**, keyed by chat+user, lost on restart, single-instance only. Fine for MVP; must move to Postgres or Redis before running multiple instances. The wizard is the structured input path — the NL constraint layer (task 8) is separate and LLM-backed; the wizard's month/duration parsing is deterministic and unit-tested.
- **Trips created via the wizard start at PLANNING**, not IDEA: the wizard collects the full owner search space and immediately hands back a share link, so there is no observable IDEA stage in this flow. IDEA remains in the enum for future entry points.
- **"Today" is Singapore time (UTC+8)** for horizon parsing ("Aug–Oct" said mid-August starts today, not Aug 1; past months roll to next year). Injectable for tests; revisit if the beachhead widens.

---

## Decision (2026-08-16, founder-decided): bot keeps Telegram privacy mode ON; ambient group capture is a later opt-in

Telegram bots in privacy mode (the default) do not receive group messages except commands, replies to the bot's own messages, and service messages — @mentions do **not** bypass it. Disabling privacy mode (or making the bot a group admin) would let Timeaway read entire group conversations, enabling the brief §30 vision of friends casually typing "Can't do October" and the bot picking it up ambiently.

**Founder decision: privacy mode stays ON.** Reading whole group chats by default is a trust and positioning liability that contradicts the brief's own privacy-first stance (§15), and the validated link-passthrough distribution model doesn't need it — participants respond via the shared web link. Ambient capture may return later as an **explicit opt-in** ("let Timeaway watch this chat for availability messages"), recorded as a new decision when it does.

**Mechanism:** every wizard prompt uses ForceReply (with `selective` targeting in groups), so the user's answer is a reply to the bot's message — which privacy mode delivers. The destination Skip became `/skip` (or a typed "skip"), since an inline button can't share a message with ForceReply. The text handler additionally ignores any group message that isn't a direct reply to the bot, so even a privacy-off/admin misconfiguration never silently consumes ambient conversation.

> **REVERSED (2026-08-16, same day, founder-decided): ambient group capture is now the core product motion, not a later opt-in.**
>
> The founder's reasoning: the DM/deep-link path creates a say-it-twice problem — a friend answers "how many leave days do you have?" in the group conversation, then has to be persuaded to open a bot DM and repeat it. That participant friction contradicts the brief's own participant-effort-minimisation goal (§6, §7) and §30's proof scenario, which always depicted friends typing constraints into the chat. The bot should triage the group's conversation in real time and converge on windows *as the discussion happens*.
>
> **New design (founder-confirmed on all three sub-decisions):**
> - Privacy mode goes **OFF** via BotFather; the bot must be removed/re-added to existing groups. Telegram's permanent "has access to messages" member-list label plus an explicit join message ("I'll watch this chat for availability talk — /pause anytime") is the consent story. Adding the bot to a group *is* the group's opt-in.
> - **Three-stage triage:** deterministic vocabulary prefilter (free, discards most chatter) → cheap LLM relevance classifier → LLM extraction into the existing structured declaration/constraint shapes with verbatim source text. The engine remains fully deterministic; the LLM still only parses (§26 unchanged).
> - **Ack = emoji reaction + live card:** the bot reacts (✍️) to messages it parsed and silently edits one trip-status card in place (`editMessageText`); it never replies per-parse. Clarifying questions only when ambiguity changes feasibility, batched.
> - **Auto-add participants:** anyone in the group whose availability gets parsed becomes a participant automatically; the organiser can remove them.
> - **Reads ≠ stores:** non-matching messages are discarded at the webhook edge, never logged or persisted. Only extracted constraints plus the verbatim sentence that produced them are stored. This is the line that keeps §15 defensible.
> - **DM calendar and web link stay as quiet fallbacks** (rosters, precise ranges, private answers, non-Telegram friends) — never the primary ask. The bot doesn't push people there.
> - **The bot cannot read messages sent before it joined** (Bot API limitation, no history access). Product motion: add Timeaway first, then start the discussion.
>
> Build-order consequence: NL parsing (task 8) is promoted from supplement to core pipeline and now blocks on an Anthropic API key; the ranked-results card (task 10) becomes the live-edited card this pipeline feeds; the group reply-only guard from the ForceReply work is replaced by the triage pipeline.

---

## Decision (2026-08-16, founder-decided): the organiser confirms the selected dates

In a group trip, only the **organiser** can confirm a candidate window (moving the trip to `DATE_SELECTED`), via an inline button on the ranked-results card posted in the chat. Everyone sees the ranked windows and the confirmation; social agreement happens in conversation, where it already happens today. This matches the brief's organiser-as-primary-user model (§7) and avoids building a voting mechanism whose stall-on-non-responders failure mode is the exact problem Timeaway exists to solve. "Any participant confirms" and "group vote" were considered and rejected for MVP; a vote could return later as an opt-in if real groups ask for it.

Related flow decision implied by privacy mode + link-passthrough: participants provide availability **privately in a DM with the bot** (deep link `t.me/<bot>?start=trip_<code>` from the shared trip card) or later via the web link — never by the bot reading the group. Ranked results and the confirmation are posted **to the group**; raw individual availability stays private per the brief's §15 access model, surfacing only as window-level statuses ("3 can make it · Farah roster pending").

---

## Decision (2026-08-16, founder-decided): LLM provider for constraint extraction is OpenAI gpt-5.6-luna

The ambient extraction pipeline uses **OpenAI's `gpt-5.6-luna`** (GA July 2026; the fast/cheap tier of the GPT-5.6 family — $0.20/M input, $1.20/M output, strict structured outputs, `reasoning_effort` low). Founder's explicit choice. Cost profile fits high-volume group-chat triage well.

Implementation notes (agent, recorded):
- The extractor sits behind a `ConstraintExtractor` interface in `packages/constraint-parsing`; the provider is one file and can be swapped without touching the bot or engine. Section 26's division is unchanged: the LLM parses text into structured declarations — feasibility, intersection, and ranking remain deterministic TypeScript.
- Prefilter (stage 1) and extraction (stages 2+3 merged into a single Luna call with a `relevant` flag) — one round-trip per candidate message keeps latency and cost down; the deterministic prefilter discards most chatter before any spend.
- Third-party relays ("Sheryl can only do school holidays") are recognised by the schema (`subjectName`) but deliberately skipped at MVP — resolving a spoken name to a group member identity is deferred rather than guessed.
- Missing `OPENAI_API_KEY` degrades gracefully: the bot runs, ambient capture prefilters but extracts nothing.

---

## Decision (2026-08-16, founder-decided): deterministic grammar first, LLM only as fallback

**The engine is the default path; the LLM is the exception.** A shared deterministic grammar (`packages/constraint-parsing/src/grammar/`) runs before any model call, in both entry points — `/newtrip` arguments and ambient group messages. The LLM is consulted only for input the grammar explicitly declines (`needsLlm`). This cuts cost and latency on the common cases and, more importantly, makes the everyday behaviour reproducible and testable rather than model-dependent.

Escalation triggers (the grammar refusing to guess, rather than guessing badly):
- conditional language — "unless", "if", "depends", "but not", "avoid", "prefer"
- leftover tokens containing digits after dates and durations were consumed
- nothing recognised at all in non-empty input

**`/newtrip` now accepts free text**, parsed by consuming what it recognises and treating the residue as destination candidates — so unknown place names work without a gazetteer. `/newtrip a Korea/Japan trip in 2027 year end` yields destinations `["Korea", "Japan"]` and horizon `2027-11-15 … 2028-01-05`, then asks only for the duration. Previously all arguments were silently discarded.

Founder-decided semantics:
- **"Year end" resolves to 15 Nov – 5 Jan**, deliberately crossing the year boundary: a trip departing 30 Dec is a year-end trip. Other fuzzy periods (mid-year, early/late, quarters, school holidays, next year) follow the same table-driven approach and are approximate by design — they set a *rough* search horizon (brief §8), not a hard constraint. A period already past rolls forward to its next occurrence unless a year is pinned.
- **Multiple destinations are stored as candidates** (`trips.destination_candidates`), not flattened to one label. `trips.destination` now means *the settled choice*, null until the group picks; display falls back to "Korea or Japan". Destination does not feed the engine at MVP (no flights or weather), so this is a labelling concern only.
- **Confirmation is shown only for interpreted values.** Anything inferred is echoed once alongside the next question ("Got it: Korea or Japan / 15 Nov 2027 – 5 Jan 2028" + "How many days?"), so correcting and answering happen in one step — brief §11's "propose an interpretation". When arguments supply everything and there's no question left to piggyback on, a Create/Start-over card appears instead. Fully literal input creates with no confirmation step.

**Consequence for ambient capture:** the same grammar should front the ambient path so common phrasings ("can't do October") never reach the LLM. Currently ambient still calls Luna for everything that passes the prefilter — wiring the grammar in front is the next step, not yet done.

---

## Open / accepted risk: budget/affordability may be a bigger blocker than date-finding

**Status: accepted, not addressed by design.** Across three independent research threads (general group-travel commentary and two separate Singapore-specific threads, spanning both the working-professional and student demographics), the cost of the trip came up as a bigger source of group friction than finding dates. Timeaway does not address this — deliberately, per section 19's scope. This is a known limitation of the product's chosen scope, not a bug to fix. Worth keeping in mind when writing marketing copy: Timeaway solves one real part of group trip friction, not the whole thing, and claiming otherwise would overpromise.
