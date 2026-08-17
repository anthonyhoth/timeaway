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

## Decision (2026-08-16, founder-decided): destination knowledge base — scope change against brief §29, and why it is not a vector store

**Scope change, explicitly overriding the brief.** Brief §29 lists weather among MVP exclusions and §14 defers weather and approximate pricing to V1.5. The founder has moved a destination knowledge base into MVP as a **non-blocking suggestion layer**. Rationale: a group that knows *when* it is free often does not know *where* to go, and answering that at the moment the window is found is high-value. The distinction from what §29 rules out is that this is a **static, curated dataset with no runtime API dependency** — not the live flight/weather integration the brief was guarding against. Date resolution never depends on it; if the knowledge base is absent or stale, the core loop is unaffected.

This does extend the product's job slightly, from "when can we go" toward "where should we go". Recorded here so the positioning shift is deliberate rather than accidental.

**Storage: a relational table, not vector embeddings.** The founder asked whether embeddings were the right fit. They are not, for four reasons:
1. Semantic search requires embedding the *query* at lookup time — a model inference call, which defeats the stated goal of LLM-free retrieval.
2. The query is structured, not semantic: the engine already computed exact months deterministically, so this is a `WHERE month IN (…)` filter.
3. Approximate nearest-neighbour returns fuzzy top-k; the product needs complete, deterministic, explainable ranking — the same standard set for window ranking.
4. Scale: ~20 destinations × 12 months ≈ 240 rows (~100KB). The entire knowledge base fits in an LLM context window, so even a model-assisted path needs no retrieval infrastructure. Vector search becomes justified at 10⁵+ unstructured documents — revisit only if travel prose is ingested at that scale.

**The LLM moves to build time, not query time** — mirroring "LLM parses, engine decides": models and scrapers *build* the dataset offline; the engine *queries* it deterministically at runtime.

**Shape:** checked-in JSON loaded in memory and queried by pure functions, matching the existing SG-public-holidays pattern. Every fact is diffable in review, the engine stays testable without a database, and there is no migration. Promote to Postgres only if it grows or needs runtime editing. Monthly granularity for smooth data (climate, price tier, crowds) plus a separate events table with explicit date ranges for sharp windows (cherry blossom, ski season, Golden Week) that monthly buckets cannot express.

**Sourcing, founder-confirmed:**
- **Weather is real data, not estimates.** Open-Meteo historical reanalysis, fetched once offline and baked in. Their free *endpoint* is non-commercial, but the *data* is CC BY 4.0 and redistributable commercially with attribution — so a build-time fetch with attribution in the dataset is the clean path, and there is no runtime dependency.
- **Price seasonality is derived from demand drivers, not scraped fares.** No free authoritative dataset exists; commercial ones are paid and scraping aggregators generally breaches terms. More importantly, published seasonality advice is US/Europe-centric and *wrong for Singapore* — from SIN the expensive periods are SG school holidays (June, mid-Nov–Dec), Chinese New Year, and destination-side peaks like Golden Week. So price pressure is computed deterministically from those calendars, with a coarse curated LOW/SHOULDER/HIGH/PEAK tier layered on top as adjustment. Output stays explainable ("pricier: SG school holidays overlap Golden Week") and honest per §14's estimated-vs-live rule — copy says "typically", never asserts live fares.
- **Coverage: ~20 short-haul destinations from Singapore** (SE Asia + NE Asia), matching where the 23–29 beachhead actually travels and small enough that every row can be hand-verified.

**Integration:** a second deterministic pass after window ranking. For each top window, destinations are scored by day-weighted overlap of the months the window spans (28 Jun–3 Jul is ~45% June, 55% July), producing lines like "7–10 Nov · consider Chiang Mai (dry, low season)".

---

## Decision (2026-08-16): destination-side events, and a Singlish-aware ambient grammar

**Destination events now differentiate price between destinations.** Singapore-side demand pressure is identical for every destination in a given window, so it could only ever rank *windows*, never *places*. A hand-curated event table supplies the missing signal: a destination-side peak raises that destination's tier alone, which is why Tokyo during Golden Week ranks below Tokyo a fortnight later. Events also carry activity tags, so a group wanting snow gets Sapporo's ski season surfaced directly.

Data honesty rules applied:
- Lunar-calendar dates move yearly and are listed **explicitly per year**, never computed — Lunar New Year is 17 Feb 2026 and 6 Feb 2027, shared by Chinese New Year, Seollal, and Tết. Coverage ends 2027-12-31 (`EVENT_COVERAGE_END`) and must be extended before then.
- Windows that drift year to year (cherry blossom, autumn foliage, ski conditions, haze) carry `approximate: true` and render hedged — "ski season (usually)" — rather than as fact.
- Events whose real dates could not be verified were **omitted rather than guessed**; a wrong festival date is worse than a missing one.

**The deterministic grammar now fronts ambient capture, tuned for Singlish.** Previously every message passing the prefilter cost an LLM call. The grammar claims the common phrasings for free and the LLM sees only what it declines. Vocabulary covers local usage this beachhead actually writes: `cmi`, `bo eng`, `can`/`cannot` as complete answers, particles (`lah`, `leh`, `sia`, `liao`) stripped before parsing, `AL` for annual leave, `reservist`/`ICT`/`NS` as blocking commitments, `roster` as the UNKNOWN trigger, and "next next week" meaning the week after next.

**The grammar declines rather than guesses**, which is the load-bearing safety property — a confident wrong parse silently corrupts someone's availability:
- **`cmi` requires a date reference.** It means both "cannot make it" *and* "poor quality" in Singlish, so "that plan cmi one" must not mark anyone unavailable.
- Bare intent with no date ("can", "cannot lah") is declined — it answers nothing specific.
- Conditionals, third-party statements ("she can only do school holidays"), and anything else unclaimed fall through to the LLM.
- Negation beats affirmation when both match, since `cannot` contains `can`.

Vocabulary was grounded in published Singlish references plus SG workplace/NS terms; direct Reddit access was blocked from the build environment, so **real group usage remains the untested variable** — worth reviewing which messages fall through to the LLM once the bot sits in a live chat, since that log is the natural source of missing vocabulary.

---

## Decision (2026-08-16): live trip card, and what happens when constraints conflict

**One card per trip, edited in place.** The ranked result is a single message in the group chat that is updated with `editMessageText` as availability arrives, not reposted. Constraints land continuously in ambient capture, so reposting would make the bot the noisiest member of the chat. Telegram rejects no-op edits ("message is not modified"), which is expected whenever a parsed message doesn't move the ranking and is swallowed rather than logged as an error. `/dates` deliberately reposts instead of editing, so the card can be resurfaced at the bottom of a busy chat.

**The conflict case is a product feature, not an error state.** When no window works for everyone, "nothing found" is useless. `rankNearMisses` ranks infeasible windows by how few people they exclude, so the card can say "Closest: 6–9 Nov, Mei can't make it — shift a date or go without someone." Timeaway surfaces the trade-off; the group decides. This is the one moment where the product's whole value is on screen.

**Card copy preserves the distinctions the engine computes.** Roster-pending participants are named separately from plain maybes ("Farah — waiting on roster" vs "— maybe"), and people who have said nothing appear as "no dates yet" rather than being silently absent. Collapsing these would discard the validated differentiator at the exact moment the user sees it.

**Confirmation is organiser-only**, enforced on the callback by comparing the presser's user id to `trips.organiser_id`; anyone else gets an explanatory alert rather than a silent no-op. Confirming sets `DATE_SELECTED` and re-renders the card into its settled state.

### Bug found by end-to-end testing, worth remembering

An end-to-end run against the real database revealed the grammar parsing *"cmi first two weeks of nov lah"* as **UNAVAILABLE for all of November** — a silent over-claim that would have produced wrong trip dates from a correct sentence. The month matcher found "nov" and ignored the narrowing qualifier. Fixed by declining whenever a sub-period qualifier ("first", "last", "early", "mid", "end of", "N weeks", "after") appears alongside a period, leaving those for the LLM.

The general lesson, now encoded in tests: **the grammar's failure mode must be declining, never over-claiming.** A missed parse costs one LLM call; a confident wrong parse corrupts someone's availability invisibly. Unit tests alone did not catch this — it took running real sentences against real storage.

---

## Decision (2026-08-16, founder-decided): inline calendar is three taps per range; date-painting is not possible in Telegram

The founder asked whether the calendar could support **date-painting** (dragging across days), and instructed not to build it if the answer was per-day buttons. The honest platform answer: **Telegram inline keyboards are discrete buttons only** — every tap is a separate `callback_query`, and there is no drag, swipe, gesture, or multi-select. Painting is impossible in a native inline keyboard, full stop.

What is possible, and what was built: brief §12's design — pick a mode, tap the start, tap the end, and the range is stored. Nine days cost three taps, not nine, and the calendar never becomes "31 independent decisions". Founder approved on that basis.

Real painting would require a **Mini App** (a webview with touch handlers), which §29 excludes. Note that §2 names the precise trigger for revisiting: *"Mini App only becomes justified if the Telegram button-calendar becomes a proven usability bottleneck."* That evidence does not exist yet — no real group has used the button calendar — so building one now would be deciding ahead of the data.

**The calendar's role has shifted since the brief was written.** Ambient capture now absorbs the common cases ("cmi nov" is one message and zero taps), so the calendar is no longer the primary input path — it is the **precision fallback** for exactly what the grammar deliberately declines, such as "first two weeks of Nov". That is a much smaller job than the brief envisaged, which is what makes three taps acceptable.

Implementation notes:
- Rendering is pure (`renderCalendarKeyboard` returns button rows), so grid layout, Monday-first weeks, horizon-bounded navigation, and the 64-byte callback-payload limit are all unit-tested without Telegram.
- Days the user already answered carry compact markers (`9✕`, `10✓`, `11~`, `12?`) so the calendar shows current state rather than a blank grid; the pending start renders as `[9]`.
- Navigation is bounded by the trip horizon — no wandering years away.
- Calendar state is keyed **by message**, and only the user who opened it can tap; anyone else gets an explanatory alert. This matters in group chats where the message is visible to everyone.
- Ranges persist as `source: CALENDAR` declarations — identical shape to natural-language ones, per §12's requirement that both paths produce the same records — and the trip card refreshes immediately after each save.

---

## Decision (2026-08-16, founder-decided): domain is timeaway.sg, and the trip page's funnel shape

**Domain is `timeaway.sg`**, overriding brief §3's `gettimeaway.com` (with `gettimeaway.app` as redirect). The `.sg` reinforces the Singapore beachhead the research pass narrowed to, and is shorter. All code, comments and `.env.example` now default to `https://timeaway.sg`; the brief keeps its original text as the verbatim founder document, with this entry as the override. Trip links are `timeaway.sg/t/<shortCode>`.

**The trip page is the demo, not a landing page.** A marketing page argues Timeaway works; the trip page shows it working on the visitor's own trip, with their friends' names on it. Three visitor types arrive at that URL, and only one wants marketing:
1. Participants already in the Telegram group — they want status; a pitch is noise.
2. Participants arriving from other messengers (the link-passthrough model) — they experience the product working before being asked anything. Highest intent of any visitor.
3. Forwarded or curious strangers — the only audience for whom a waitlist is the natural ask.

**Primary CTA is "start your own trip", waitlist secondary** (founder-decided). The bot already works, so asking someone to join a waitlist for something usable today would be incoherent; the waitlist is for the *native app*, which remains an MVP exclusion. The primary button opens `t.me/TimeawayBot`, which also drives the participant→organiser conversion brief §6 tracks as a metric. Email capture sits below it, quieter.

**Conversion peaks at DATE_SELECTED** — the moment the group succeeds (brief §6's definition of success). CTA emphasis should be contextual: understated while planning is in progress, celebratory once dates are locked.

**Privacy: summary only, first names** (founder-decided). The short code is unguessable (32^8 ≈ 1.1e12) but the URL is unauthenticated, so the page shows the best window, alternatives, leave cost, and per-person *status* with first names ("Farah — roster pending"). No per-day availability grids, no full names, no contact details. This matches §15's "shared within trip" tier while keeping raw availability — explicitly classified private — off a public URL. Revisit if authenticated access (e.g. Telegram Login Widget) is added.

**Page design deferred to the founder**, who will supply direction based on the brand kit. Only the domain, funnel shape and privacy envelope are settled here.

---

## Decision (2026-08-16): web surface implementation (task 11)

**`apps/web` is its own app**, not routes bolted inside `apps/telegram-bot` — Telegram is one adapter, not the architecture (AGENTS.md). Both are served by a single process today (the architecture's one-service-on-Railway shape), with the bot app mounting `createWebApp()`; splitting them into separate deployments later requires no code change.

**Rendering uses `hono/jsx`, chosen for escaping rather than ergonomics.** Destination names and participant names are user-supplied and flow onto a public page, so automatic escaping is a security property, not a convenience — template strings would have depended on remembering to call an escape helper on every interpolation. A test asserts a `<script>` destination renders inert.

**The privacy boundary is enforced by the type, not by discipline.** `PublicTripView` carries `firstName` only and has no field capable of holding a full name or a per-day availability grid, so the page *cannot* leak them even if a future edit tries. `firstNameOf` is unit-tested, including the empty and whitespace cases that would otherwise render a blank label.

**Waitlist signup is idempotent** — the unique index is on `lower(email)`, which Drizzle's typed `onConflictDoNothing` target cannot express, so a duplicate-key error (SQLSTATE 23505) is caught and swallowed while any other error still propagates. The form uses POST-then-redirect so a refresh cannot resubmit.

**Brand kit findings, and one thing that needs the founder:**
- The kit resolves the logo (the folded-T from §23), the full palette, semantic colours that are darker than the brief's generic green/amber/red and clearly tuned for contrast, the Horizon gradient marked backgrounds-only, and UI tokens. Treated as authoritative where its neutrals differ slightly from §21's approximations, being the later and more specific artifact.
- **Söhne is a commercial Klim typeface and needs a separate webfont licence.** The site ships Inter (free, and already the kit's body face) with Söhne first in the stack, so a licensed webfont takes over automatically if one is added. This is a founder purchase decision, not something to assume.
- **The logo is the kit's own artwork, cropped — never redrawn** (founder instruction). `scripts/codegen-assets.ts` inlines the crops as base64 so they compile into `dist/` with no runtime file IO, and serves them from `/assets` with immutable caching plus a content-hash query string, so replacing artwork busts the cache automatically.
- Extraction detail worth keeping: the kit's canvas is `#FCFCFC`, not Cloud `#FAFAF8`, so an opaque crop showed a faint box against the page. The mark and wordmark are un-composited off that known background (solving `P = a·C + (1−a)·B` per pixel) to get true transparency with anti-aliased edges intact. The app icon is cropped opaque instead — it contains *white* artwork, which that method would erase, since it assumes artwork darker than the background.
- Using the kit's wordmark as artwork also sidesteps the Söhne licence for the logo itself: the lettering ships as an image rather than as live text in an unlicensed webfont.

---

## Decision (2026-08-16, founder-directed): scroll-driven hero, built with gradients rather than 3D geometry

The founder asked for a "strong 3D render" hero — unresolved chat bubbles, scrolling into a gradient "Siri-like" sphere in the manner of amra.com, resolving into a rendered trip. Inspecting the reference settled the technique: **AMRA's sphere is not a rendered mesh.** It is a large soft gradient orb that travels up through the page on scroll, shifting colour, with content passing over it. So the look is reproducible in CSS, with no WebGL, no asset pipeline, and no modelling.

**What was built** is a three-act scroll narrative matching the product's own story:
1. **Unresolved** — chat bubbles floating in CSS 3D perspective, carrying real phrasing from the Singlish grammar ("cmi october", "roster not out yet leh") rather than lorem ipsum, scattered at different Z depths so parallax reads as genuine dimension.
2. **The sphere** — the Horizon-gradient orb rises to fill the viewport, layered radial gradients plus a slowly drifting conic highlight for the "Siri" quality, with the differentiator stated in white over it.
3. **Resolved** — the orb recedes and the settled trip card tilts upright into place.

Scroll progress is computed per act and written to CSS custom properties on a `requestAnimationFrame` loop, so the animation stays in the compositor rather than thrashing layout.

**Honest limits, so expectations stay calibrated:** this is a gradient-and-perspective composition, not a raytraced render. Photoreal 3D — a rendered globe, physical calendar objects, real lighting — needs an actual 3D tool. Spline is the usual choice for founders here since it exports web-embeddable scenes directly; Blender plus pre-rendered stills is the other route. Either would slot into the same three-act structure without changing the scroll logic.

### How the reference actually does it (inspected 2026-08-16)

Worth recording, because it changed the implementation. Inspecting amra.com directly:

- **Their sphere is a looping 1080×1080 MP4** streamed from Mux, sitting inside a `border-radius: 50%` container with a base64 blurred JPEG placeholder while it loads. `autoplay muted loop playsinline`. It is a pre-rendered animation, not CSS — which is why the gradient motion looks organic and costs nothing to play.
- **Their sphere never scales.** The beacon's transform is a plain `translate`; it is a fixed size and the page scrolls past it. The apparent growth is just the circle's curvature entering the viewport.
- **They run Lenis** (`html class="lenis lenis-smooth"`), which replaces native scrolling with an interpolated, damped position. That is the single biggest contributor to the glide.

**Changes made after that inspection**, when the founder observed our scroll felt less smooth:
1. **Dropped `scale()` on the orb** — animating scale on a 1500px multi-stop gradient forces a full repaint every frame. Now fixed-size with `translate3d` only, matching the reference and staying on the compositor.
2. **Stopped animating the conic gradient's angle.** A changing `from` angle under a 42px blur cannot be cached; the layer is now rasterized once and rotated via CSS animation, which is compositor-only.
3. **Cached section geometry.** The loop measured `getBoundingClientRect()` three times per frame, forcing a layout flush per frame; offsets are now measured on load and resize only.
4. **Added damped easing to scroll progress** (`cur += (target − cur) × 0.11`), which recovers most of the Lenis feel without hijacking native scroll — deliberately avoiding the accessibility and platform-behaviour trade-offs a scroll-jacking library brings.

Measured after: median frame 16.6 ms, p90 17.4 ms, worst 18.4 ms, no frame over 25 ms across a scripted scroll sweep — a locked 60 fps.

**The remaining gap to the reference is the sphere asset itself.** Matching it exactly means rendering a looping gradient video (Blender/After Effects/Spline) and clipping it to a circle, which also removes the gradient rasterization cost entirely. The current structure would accept that swap by replacing one element.

**Progressive enhancement was load-bearing, not optional.** Acts two and three put white text over the orb, so with JavaScript disabled they would have been white-on-white and unreadable. A `.js` class gates the whole choreography: without it those sections paint their own gradient background and the trip card renders upright and opaque. `prefers-reduced-motion` also stops the float and drift animations.

Note for a future session: the founder asked to install skills named `/taste` and `/impeccable`. Neither exists in their skills catalogue, org catalogue, or the Anthropic set — searched as both skills and plugins. Nothing was installed.

---

## Decision (2026-08-17, founder-decided): the destination knowledge base is engine-internal, not a customer-facing surface

Revises the framing of the 2026-08-16 knowledge-base entry, which described it as a "non-blocking suggestion layer" rendered after window ranking. **The founder's intent is that it feeds the decision engine, not the UI.** Destination recommendations to users are a V2 idea, not part of this MVP.

Practical consequences:
- Nothing in the bot card or the web trip page should display climate, price tier, or destination suggestions. The earlier entry's "7–10 Nov · consider Chiang Mai (dry, low season)" example is **not** the plan.
- The package stays as a queryable input the engine may draw on, and its data (climate normals, SG demand calendar, destination events) remains correct and tested regardless of whether anything consumes it yet.
- It is therefore not "dormant unwired UI" — it is an engine input awaiting a decision about whether it should influence ranking at all.

**One open question this leaves**, for the founder when relevant: within a trip whose destination is already known, the knowledge base could legitimately rank *windows* — a November window and a December window to the same place differ in weather, demand, and destination-side events like Golden Week. That would be an engine input rather than a user-facing suggestion, and so consistent with this decision. But it would change the founder-confirmed lexicographic ranking order (available → leave → roster-pending → maybe → start → duration), whose stated virtue is that every position is explainable in one sentence. Not to be added without an explicit decision.

**Also corrected here (agent overstatement):** deployment and webhooks were previously described as blocking a real trial. They are not. Long polling works in production as well as locally; the webhook is a scale and latency optimisation. The genuine constraint is only that the bot is unavailable whenever the machine running it sleeps, and that trip links resolve to localhost until a host and domain exist — both of which matter for unattended multi-day testing with other people, not for the founder's own testing.

---

## Decision (2026-08-17): one horizon parser, after live testing found the wizard rejecting valid input

**Bug found in the founder's first real Telegram session.** The wizard rejected "next year" and "next year around june-july" with "Sorry, I didn't catch that", while `/newtrip next year` had always worked. Cause: **two parsers existed.** `/newtrip` arguments went through the grammar package (fuzzy periods, relative dates, month ranges), but the wizard's horizon step still called an older `parseHorizon` in the bot app that only understood month names and ISO dates. The grammar work never replaced it.

Fixed by making `resolveHorizon` in the grammar package the single entry point for "roughly when could this trip happen?", used by both paths, and deleting the bot-local parser so the two cannot drift apart again.

Two parsing improvements came out of the same session:
- **A year phrase can now combine with a month range.** "Next year around June–July" means June to July of 2027, not all of 2027 — the year is extracted first and passed to the month matcher as a hint, so the more specific signal wins while still taking the year from elsewhere in the sentence.
- **A bare space separates months.** "June July 2028" previously read as June alone, because a dash or "to" was required. People write it that way; requiring punctuation made the bot look obtuse for no benefit.

The horizon prompt now advertises what it actually accepts ("Sep–Nov · next year · June–July 2027 · year end · Q1") rather than only the two narrowest forms.

**The general lesson, consistent with the earlier over-claim bug:** unit tests passed throughout, because both parsers were individually correct — the defect was that the *wrong one was wired up*. Integration through the real client is what surfaces this class of bug, and more of it is likely as the rest of the Telegram surface gets exercised for the first time.

---

## Decision (2026-08-17): the wizard accepts "I don't know" at every step

**Second bug from live testing.** Answering "idk yet" to "How many days?" looped on "Sorry, I didn't catch that". Probing it surfaced a worse, silent variant: **"idk yet" typed at the destination step created a trip to a place called "Idk Yet"** — a wrong answer accepted confidently, which is the failure mode this project has repeatedly treated as the one to avoid.

Root cause is a design gap rather than a parsing gap. The wizard demanded a precise answer at every step from a product whose entire premise is tolerating uncertainty, and `/skip` only existed on the destination question, so the duration step had no escape at all.

**Decisions:**
- `isUnknownAnswer` recognises the forms people actually type (idk, dunno, not sure, no idea, tbc, whatever, up to you, flexible, no preference), tolerating Singlish particles, and is applied at **every** step rather than patched into one.
- Destination unknown → the trip is simply destination-open, the same as `/skip`.
- Duration unknown → **3–7 days is assumed and stated plainly**: "No problem — I'll assume 3–7 days for now, anything from a long weekend to a week." A duration is structurally required to generate candidate windows, so a stated assumption beats a dead end. The range spans long weekend to full week, which covers the realistic span for short-haul trips from Singapore.
- Duration parsing also learned the phrasings people use instead of numbers: named durations ("a week", "long weekend", "weekend", "two weeks"), hedges ("about 5", "5ish", "maybe 4 to 6 days"), and spelled-out numbers ("four to six").
- The prompt now offers the escape rather than hiding it: "Not sure yet? Just say so."

**Follow-on gap, not yet addressed:** there is no way to change a trip's destination, horizon or duration after creation, so an assumed duration is currently permanent for that trip. The copy deliberately does not promise editing. Worth building an `/edit` path before real groups use this.

---

## Decision (2026-08-17, founder-observed): a trip created in a DM is staged, not live, and must be bound to a group

**Third finding from live testing, and the most substantive.** Completing the wizard in a one-to-one DM announced "Trip created 🎉" and handed over a share link, before any friend had been invited or any availability collected. The founder challenged whether that made sense.

It did not, and the problem was deeper than premature copy. **A DM-created trip was functionally orphaned:**
- `trips.telegram_chat_id` was null, and ambient capture finds trips *by chat* — so nothing anyone said anywhere could ever reach it.
- `/dates` and `/calendar` are group-only.
- The web trip page is read-only by design.

So there was no path at all from that state to collecting a single constraint. The link resolved to a real page showing the destination, horizon and duration, and "No dates yet" — permanently, with no way to change it.

**Decision: DM creation stages a trip; adding the bot to a group makes it live.**
- The DM completion no longer celebrates. It says "Trip set up ✓", states what was captured, and explains the next step: "Now add me to the group chat — that's where I pick up everyone's dates."
- The primary action is an **"Add to group chat" button** using Telegram's `?startgroup=trip_<shortCode>` deep link, which prompts a group picker, adds the bot, and delivers `/start trip_<shortCode>` to that group.
- The `/start` handler binds the trip to that chat (`setTripChatId`, which also clears any stale card message id), confirms in the group, and posts the live card immediately.
- Creating a trip *inside* a group is unchanged and still celebratory, because ambient capture genuinely does start working there at once.

**Why this shape rather than making the web page writable:** the founder-directed model is that availability arrives through ordinary group conversation. A web input form would reintroduce the say-it-twice friction that motivated ambient capture in the first place. Staging in a DM and then binding to a group keeps a single path.

**Also spotted:** the founder's `.env` still sets `PUBLIC_BASE_URL=https://gettimeaway.com`, so live trip links carry the old domain even though the code default is now `timeaway.sg`. Environment beats default; the `.env` needs updating.

---

## Decision (2026-08-17, founder-directed): the wizard teaches plain language, never commands

The founder noticed the wizard was giving contradictory instructions. It was: the destination step advertised `/skip`, the horizon step offered no escape at all, and the duration step said to answer in words. Three steps, three conventions — and `/skip` silently did nothing at two of the three, so the single advertised convention was also broken.

**Decision: plain language is the only advertised way to say "I don't know."** Teaching a command contradicts the product's own premise that you just talk normally, and a new user already knows how to type "not sure" without learning anything. `/skip` survives as an undocumented alias so it works for anyone who tries it, now at every step rather than one, and it has been removed from the command menu.

All three prompts now share one shape — question, examples, same escape phrase — so the pattern is learnable from the first answer:

> Where are you thinking of going?
> A place, or a few like Korea or Japan — or just say you're not sure.

> Roughly when could this trip happen?
> Something like Sep–Nov, next year, or year end — or just say you're not sure.

> How many days?
> A range works best — 4–6, a long weekend, a week — or just say you're not sure.

Input placeholders match ("Japan — or not sure", "Sep–Nov — or not sure", "4–6 — or not sure").

**What "not sure" means is decided in one place** (`applyUnknownAnswer`), so the steps cannot drift apart again:
- **Destination** — genuinely open. No assumption, so nothing is announced; the summary shows "Destination open".
- **Horizon** — previously had no escape at all. Now defaults to **the next 3 months**, which is brief §13's "initial active planning slice", and says so.
- **Duration** — 3–7 days, and says so.

The principle: **state assumptions out loud, stay quiet about non-assumptions.** An open destination is a real answer; an assumed horizon or duration is the bot filling a gap, and the user should know it happened.

---

## Note (2026-08-17): Telegram rejects the whole message when an inline button URL is invalid

**Symptom:** after the duration assumption ("I'll assume 3–7 days"), the bot went silent — no trip confirmation at all.

**Cause:** the `.env` had been pointed at `http://localhost:3000` for local testing (on the agent's own suggestion), and Telegram refuses `localhost` as an inline keyboard button URL. Critically it **rejects the entire `sendMessage` call**, not just the offending button, so the whole "Trip set up ✓" message vanished. The failure was invisible in the chat and only appeared in the process log as `400: inline keyboard button URL ... is invalid: Wrong HTTP URL`.

**Fix:** `isButtonSafeUrl` gates every URL button — requiring http/https, a dotted hostname, and rejecting localhost/127.0.0.1/0.0.0.0. When a URL fails the check the button is omitted and the link still appears as plain text in the message body, so nothing is lost in local development. Unit-tested, since the failure mode is silent.

**Generalisable lesson:** a Telegram send that fails takes the whole message with it. Any user-visible step that depends on one API call should assume that call can fail on data that looked fine locally — and `bot.catch` logging to stdout means such failures are invisible to the person actually using the bot. Worth revisiting whether the catch handler should surface something to the user rather than only the console.

---

## Note (2026-08-17): /dates and /calendar were dead in groups — grammY middleware ordering

**Symptom:** in the first real group session, `/dates@timeawaybot` produced no response at all, with nothing in the log.

**Cause:** grammY runs middleware in registration order, and a handler that returns *without calling `next()`* terminates the chain. The catch-all `bot.on("message:text")` returned early for anything starting with `/`, and `/dates` and `/calendar` were registered **after** it — so they never ran. Commands registered before the catch-all (`/newtrip`, `/pause`, `/resume`, `/cancel`) worked, which is what made the failure look arbitrary.

**Fix:** the catch-all now calls `next()` for command messages instead of returning, so registration order no longer decides whether a command works. Worth remembering when adding any future command.

## Note (2026-08-17): the card claimed a "best match" before anyone had answered

On joining a group the card read "Best match so far · 1–7 Nov 2027 · anthony — no dates yet", which is self-contradictory. The cause is a consequence of a correct engine rule: **UNANSWERED never eliminates a window** (brief §10 — do not require unanimous certainty), so before anyone answers, *every* window is feasible and the ranking simply returns the first.

Feasibility was right; the presentation was not. The card now renders its invitation state until at least one participant has actually stated dates, regardless of how many windows technically qualify. It also acknowledges non-date input that has been heard — "Noted so far: anthony up to 10 leave days" — so the card never appears to have ignored someone who spoke.

Related tidy-up: binding a trip to a group posted an intro message immediately followed by a near-identical card. It now posts the card alone, with the onboarding text living in the card's invitation state, so there is one message that later becomes the answer rather than two competing ones.

---

## Decision (2026-08-17, founder-directed): the engine diagnoses structural mismatches, and offers the two ways out

The founder supplied four real scenarios. Running each through the live pipeline first showed **all four were mishandled, two of them silently** — a reminder that probing beats reasoning about parser behaviour.

| scenario | before | after |
| --- | --- | --- |
| "teacher, only during school holidays" | `AVAILABLE` for the holiday block, but **"only" dropped**, so other dates stayed UNANSWERED and they were never excluded | horizon blocked, then the holiday window carved back in |
| "nurse, roster only out next week" | `UNKNOWN` for **next week itself** — the wrong month entirely | `UNKNOWN` across the trip horizon |
| "can only travel in June" (November trip) | `AVAILABLE` June, invisible to every window; looked like silence | horizon blocked, June retained, and diagnosed |
| "only 1 day of leave" (7-day trip) | every window infeasible, no explanation | diagnosed with what they *could* manage |

**New concept: participant diagnostics.** Ordinary per-window unavailability is what the ranking already handles. A *structural* mismatch is different — no choice of dates fixes it — and deserves to be stated once, with remedies:
- `BLOCKED_ACROSS_HORIZON` — unavailable for every window; if they named dates outside the trip, those are surfaced ("Mei can't do these dates, but said 1–30 Jun 2027 works").
- `LEAVE_CAP_BLOCKS_ALL` — no window of this length fits their leave. The engine computes `longestAffordableDuration`, so the card can say what they *could* do rather than only what they can't.
- `ANSWERED_OUTSIDE_HORIZON` — everything they said falls outside the trip window, which would otherwise read as never having replied.

Each renders **the founder's two options**: reshape the trip, or proceed without that person and optionally plan a separate shorter one. Consistent with the brief, Timeaway surfaces the trade-off and never resolves it.

**Two parsing rules this required:**
- **"Only" is restrictive.** It emits an `UNAVAILABLE` blanket over the horizon followed by the stated `AVAILABLE` window, letting latest-declaration-wins do the work. The stated range is recorded *as given* even when outside the horizon, so "only June" still remembers June. Without a known horizon the complement is unbounded, so the grammar declines.
- **"Roster out next week" names when they'll know, not what they're unsure about.** Such messages now mark the *horizon* UNKNOWN rather than the mentioned date.

**Bug caught while testing the diagnostics:** the blocked-everywhere check read raw declarations and so flagged the teacher, whose later `AVAILABLE` overrides the blanket block. It now asks the resolver (`assessParticipantWindow`) instead — the same latest-wins rule the rest of the engine uses. Any code inspecting declarations directly rather than resolving them is suspect.

**Web trip page brought to parity, and stopped being cacheable.** The page still showed "Best match so far" with nobody having answered, ignored leave caps, and showed no diagnostics — the card fixes had not been mirrored. It also sent **no cache headers at all**, so browsers (Telegram's in-app one especially) could serve a stale copy, which is what the founder observed as the link "not updating". It now sends `Cache-Control: no-store, must-revalidate`.

**Deferred:** "roster out next week" is stored only as UNKNOWN over the horizon; the *when they'll know* date is discarded. Capturing it would let the bot follow up at the right moment, which needs a scheduler and a schema column — worth doing, not yet done.

---

## Decision (2026-08-17, founder-directed): planning narrows in rounds — 5 options, then 3, then a date

The founder set out the intended shape of the product loop: collect constraints, narrow to **five workable windows across the year**, present them, let the group react to *those*, narrow to **three**, and proceed from there. This replaces the previous behaviour of continuously showing one "best match" plus a couple of alternatives.

**The change that made this work was diversity, not ranking.** Probing a year-long horizon showed the top five ranked windows were 1 Jan, then 4–8 Feb, 5–9 Feb and 6–10 Feb, then 6 Mar — three of the five being the same February week. Ranking optimises quality, and near-identical windows score near-identically, so an unfiltered top-N is a shortlist in name only; it gives the group nothing to choose between.

`selectDiverseWindows` greedily walks the ranked list requiring a minimum separation, trying a month first and relaxing through 21/14/7/3/0 days only as far as needed to fill the quota. Where the group is genuinely free all year the five land in five different months; where only one stretch works it clusters, but never overlaps.

**Rounds are explicit state.** `trips.shortlist_size` starts at 5 and the organiser narrows it to 3 with a button — matching the existing rule that only the organiser advances the trip. At 3, each option gets its own Select button, so choosing a date is one tap. The web trip page mirrors the same rounds.

**Names survive the compaction.** A five-option list can't repeat everyone's status per option, but reducing people to counts would discard exactly the distinction the product exists for. Each option shows counts (`✅ 3 in · 1 leave`), and the named statuses — "Farah — roster not out yet" — appear once beneath.

**Bug found while demoing the rounds:** with a 2027 horizon, "cannot december" resolved to December *2026*, because bare months were anchored to today rather than to the trip. The answer then landed outside the trip and read as a mismatch. Date resolution now prefers a reading that falls inside the horizon, shifting the year by one or two where that lands inside — but never overriding an explicit year, and never inventing an overlap that doesn't exist ("only June" against a November trip still correctly falls outside and is diagnosed).

**Open question for the founder:** to produce "five windows in the year" the trip horizon has to *be* roughly a year, and the wizard currently takes whatever the organiser gives (often a single month). Nothing widens it automatically. Worth deciding whether an unknown or narrow horizon should default wider, versus asking.

---

## Decision (2026-08-17, founder-directed): the trip can be edited in conversation, with additive changes open and destructive ones gated

Trip shape was frozen at creation — the gap behind several earlier problems, including an assumed 3–7 day duration being permanent. The founder asked for conversational editing: "let's try Korea too" adds a candidate, "let's go Korea instead" replaces. Extended, on the founder's direction, to dates and length as well.

**Permission model (founder-decided):**
- **Additive changes apply immediately, for anyone.** "Korea too" just works — it takes nothing away.
- **Destructive changes need the organiser.** Replacing or removing a destination, moving the dates, or changing the length discards something the group already agreed. From the organiser they apply directly; from anyone else the bot holds the change and offers the organiser an Apply button, rather than silently ignoring a real suggestion. Consistent with organiser-confirms-dates.
- **Acknowledgement is a ✍ reaction plus the updated card**, matching the ambient no-noise rule. The card is the shared record, so a wrong edit is visible and correctable without extra messages.

**Guards, because a wrongly rewritten trip is worse than a missed edit:**
1. An explicit edit word is required — plain chatter never edits anything.
2. **Availability is parsed first.** "Can also do December" is someone describing *themselves*, not asking to move the trip; only messages availability declines are considered as edits.
3. Temporal tokens are consumed before destination extraction, so "let's go in June instead" moves the *dates* rather than inventing a place called "June".
4. REPLACE and REMOVE must name a destination the trip already has — the guard that stops "not sure" deleting an imaginary place called "Sure".
5. A horizon edit is only read when no place and no duration were named, so "Korea instead" moves the destination, not the calendar.

**Filler vocabulary did the heavy lifting**, and every gap in it produced a real bug during testing: "can also consider taiwan" yielded a place called "Can Taiwan"; "actually lets do korea" yielded "Do Korea"; "lets push to december instead" yielded "Push"; "long weekend instead" yielded "Long". Each was fixed by teaching the parser which words are never place names.

**Accepted limitation:** there is no gazetteer, so ADD trusts the residue to be a place. That is deliberate — it lets unknown destinations work without maintaining a list — and the visible card is the safety net.

**Not built:** pending edits live in memory, so a restart drops an unapproved suggestion. Fine for a proposal that is seconds old; worth moving to the database alongside wizard state if multiple instances ever run.

---

## Decision (2026-08-17, founder-decided): adding the bot offers a Start button; planning never begins on its own

The founder asked whether adding the bot to a group starts planning without an owner running the flow in a DM. It did not: joining only posted an intro, and ambient capture is gated on finding an active trip for that chat, so with no trip the bot read nothing at all. Someone had to run `/newtrip` in the group, or arrive via the `?startgroup=trip_<code>` deep link from a DM-staged trip.

That required knowing and typing a command — exactly the kind of step the ambient pivot was meant to remove.

**Decision: the join message carries a "Start planning a trip" button.** One tap, no typing, and consent stays explicit — the bot is demonstrably not reading anything beforehand, which is worth saying plainly in a chat where it has message access. **Whoever taps becomes the organiser**, which is more meaningful than whoever happened to add the bot.

Starting this way asks for *nothing*: the trip is created destination-open, with the next three months and 3–7 days as placeholders, and conversation reshapes it through the editing grammar ("let's do Japan", "next year", "make it a long weekend"). The card's invitation state now says so, since this flow never asks the wizard's questions.

Fully automatic start — creating a trip the moment the bot joins — was considered and rejected: a bot that begins recording availability for a trip nobody asked for is a worse first impression, and the organiser would be assigned by accident.

`/newtrip` still works in a group and in a DM, so nothing is taken away; the button is simply the path that needs no prior knowledge.

---

## Note (2026-08-17): what happens when most of the group is wide open

The founder asked how the engine recommends when three of five members reply with generous leave (10/12/13 days) and "happy to travel whenever". Running it surfaced one correct behaviour and two defects.

**Correct:** when availability stops discriminating — every window feasible for everyone who answered — the lexicographic ranking falls through to **leave cost**, so the shortlist becomes the cheapest windows of the year, spread across it by the diversity selector. That is the right fallback: with nothing to separate windows on people, separate them on what they cost.

**Defect 1: "3 in" hid the denominator.** In a five-person group that reads like agreement when two people have not spoken at all. Counts are now "3 of 5 in" everywhere, including the single-window and confirmed views. The silent members were already named ("Mei and Dan — no dates yet"), but the headline number implied more consensus than existed.

**Defect 2: the grammar declined "im free whenever" and "ok to travel anytime"** — plausibly the most common replies to "when are you free?" — sending both to the LLM. It now reads open-ended phrases (whenever, anytime, any dates, all good, flexible, don't mind) as AVAILABLE across the whole horizon.

Two subtleties in that fix worth keeping:
- **The wizard and ambient chat mean opposite things by the same word.** Answering "whenever" to *"how many days?"* means "I don't know"; saying "free whenever" in chat means "fully available". The two live in separate code paths, which is why both readings can be correct.
- **Ordering mattered.** "Got 12 days leave, anytime works" originally returned only the cap, because the leave-cap branch returned before the open-ended check ran, silently dropping the availability. The open-ended branch now runs first and carries the cap with it.

**Left as is:** the bot still presents a shortlist while 40% of the group is silent, rather than waiting for a quorum. That follows brief §10 — do not require unanimous certainty before showing something useful — and the card names who has not answered.

---

## Decision (2026-08-17, founder-directed): members can opt out; a shortlist still shows while others are silent

The founder confirmed the bot should keep showing a shortlist while some members are silent, and asked for an explicit opt-out — because **not everyone in a group chat is travelling**, and judging readiness by a response threshold would misread that.

**Silence was already handled better than assumed.** Participants are only created when someone speaks, so a group member who never engages never becomes part of the trip and never appears in a count. The real gap was different: someone who *has* spoken had no way to withdraw, and would sit in the trip forever diluting the counts or constraining windows.

**Decision: `participants.opted_out`, set from conversation.** "Count me out", "not joining this one", "sitting this one out", "you guys go ahead" withdraw; "count me in", "actually I'm in" rejoin. Opting out is self-service — nobody needs the organiser's permission not to travel.

**The distinction that makes it safe: a date reference.** "Count me out **for November**" is a date constraint; "count me out" is leaving the trip. Availability is parsed first and anything naming a period is excluded from participation parsing, so the two cannot be confused.

**Opt-outs constrain nothing.** They are removed before the engine sees the participants, so their dates never narrow a window, and they are excluded from every count — "3 of 4 in", not "3 of 5". They stay visible on the card as "🙅 Dan sitting this one out", so the group can see the decision rather than watch someone silently vanish. The web page applies the same filter.

**Subtle bug avoided:** engine participant ids are positions in the *travelling* list, so the web page's name lookup had to filter identically or it would have printed the wrong person's name against a status.

**Threshold logic remains deliberately absent.** Per brief §10 and this decision, the bot never waits for a quorum before showing options; it names who has not answered and lets the group judge.

---

## Decision (2026-08-17, founder-directed): non-schedule disagreements are recorded, never acted on

The founder asked how objections that aren't about dates should behave — "I just went Korea, don't want to go again", "I want to go Seoul", budget concerns — and set the rule: **they must not void the trip**. Timeaway notes them and flags them up.

This is brief §8's line made concrete: hard constraints eliminate candidates, soft preferences only inform. A disagreement about *where* must never eliminate a window that works on *dates*.

**`participant_notes` records three kinds** — destination objection, destination preference, budget — always with the person's own words, per the auditability rule. They appear on the card under "Worth knowing", quoted verbatim:

> Worth knowing:
> • Mei — "i just went korea, idw go again"
> • Wei — "i want to go seoul"
> • Dan — "budget quite tight for me"

Nothing downstream reads them. Feasibility, ranking and the shortlist are untouched.

**The line against a trip edit is first person.** "Drop Japan" is a decision about the plan and edits it (organiser-gated); "I'd rather not do Japan again" is one person's view and is only recorded. Notes are therefore parsed *before* trip edits, so an opinion is never executed as an instruction. Budget is the exception to the first-person requirement — "too expensive" from anyone is worth recording.

**On budget specifically:** DECISIONS has carried an open risk since the research pass that affordability may matter more to groups than date-finding, and §19 puts budgeting outside the product's scope. Recording budget remarks is the honest middle: the friction becomes visible to the group without the engine pretending it can price a trip.

**Bug worth remembering:** the budget pattern originally ended `\d\b`, so "under 1500" never matched — a word boundary after a digit fails on any multi-digit number. Amounts are now matched without a trailing boundary. Cheap to write, silent to fail.

---

## Decision (2026-08-17, founder-directed): trial-readiness pass — visibility, measurement, deletion, help

Built from the founder's market-research readiness table and top-ten risk register, targeting the items rated blocker that were genuinely at zero.

**Errors are now visible, and traceable.** `bot.catch` logged to stdout only, so a failed API call looked to the group like the bot ignoring them — read as poor parsing accuracy rather than a bug, corrupting judgement about every other risk.

Two audiences, one incident, joined by a **short reference code**:
- **The group** gets a calm, generic line that never blames them, never leaks internals, and quotes the ref: *"Something went wrong on my end — nothing you did. Give it another go in a moment. If it keeps happening, quote ref a3f9c2."* Callback failures get a terse toast version, under Telegram's ~200-character cap. Rate-limited to one apology a minute, so an error inside the error path cannot loop and a burst cannot bury the chat.
- **The log** gets one structured JSON line per incident — ref, kind, chat, user, update type, and for Telegram failures the `method`, `error_code` and `description` (the last is what identified the localhost-button bug). Structured so it stays greppable by ref and pipes into an aggregator later without reformatting.

**The log deliberately never records what anyone wrote.** The privacy page promises non-planning messages are not stored, and an error path must not quietly become the exception. Free text contributes only its *length* — enough to distinguish a one-word reply from a paragraph. Commands and callback payloads *are* logged, because they are our own vocabulary: `sel:2026-11-07:2026-11-10` is far more useful than "a callback happened", and contains nothing a person typed. A test asserts an address embedded in a message never reaches the log.

Errors are classified (`telegram_api`, `network`, `database`, `unknown`) so patterns are countable in analytics without reading logs. The `bot_error` event carries the ref and kind only. The earlier copy claimed "nothing was lost", which could not be guaranteed, and was dropped.

**Analytics exist, in Postgres rather than a vendor.** `analytics_events` covers the funnel brief §6 already specified: `bot_added_to_group`, `planning_started`, `trip_created`, `constraint_captured`, `shortlist_shown`, `date_selected`, `participant_opted_out`, `participant_forgotten`, `trip_archived`, `extraction_failed`, `bot_error`. No API key is needed to start learning, and a PostHog sink can be added later without touching a call site. Writes swallow their own failures — analytics must never break the thing it measures. Properties carry counts, sources and states, never message text.

**`constraint_captured` doubles as the accuracy signal.** It records whether the deterministic grammar or the LLM resolved each message, so the grammar-to-LLM ratio *is* the vocabulary-gap measure the founder's "beta-gate with accuracy target" needs. No separate eval harness required to start.

**Privacy-mode failure is now explained rather than silent.** On joining, the bot checks `can_read_all_group_messages` and says plainly when it cannot read the chat. That covers the global setting; **per-group state is not exposed by any API**, and a group the bot was in *before* privacy mode was disabled keeps hiding messages until it is removed and re-added — undetectable from inside, because you cannot observe traffic you are not receiving. The join message therefore tells people to remove and re-add if the bot has been there before. Copy solves what detection cannot.

**Deletion is real.** `/forget` removes a person's declarations, notes and participant row in a transaction, behind a confirmation. This matters because the auditability rule stores people's verbatim messages — the thing that makes the bot trustworthy is exactly what creates a retention duty. `/reset` archives a trip so a group can start again, organiser-only.

**`/help` exists**, addressing the support-overload risk: previously a confused group member had nothing at all, since `/start` only responds in a DM.

**A privacy page ships at `/privacy`**, written plainly rather than as boilerplate — what is kept, what is discarded on arrival, who can see the trip link, how to delete, a 12-month retention limit on archived trips, and the fact that unparsed text reaches OpenAI. A vague policy would undercut the disclosure the bot already makes in chat.

**Deliberately not built:** confidence scores, because the ranking is lexicographic precisely so every position is explainable in a sentence, and coverage ("3 of 5 in", named roster-pending) is the honest confidence signal. Digest mode and quiet hours were also skipped — the no-noise design (react, don't reply; edit one card) already prevents the noise risk.

**Still open after this pass:** a correction path (nobody can see or fix what the bot recorded about them), hosting, in-memory state, uncapped LLM spend, the 2027 data cliff, and the nudge loop that would close the founder's "habit-forming" gap.

---

## Decision (2026-08-17): the context layer — remembering what we asked

Founder corrected my reading: in *"I'm not free 2 weeks in nov"* → *"the middle
one"*, **the middle one is the middle two weeks of November**, not an item from
the shortlist. *"That is why it is crucial to handle these messages
contextually."*

That correction matters, because the option-reference work shipped an hour
earlier would have resolved those three words against the trip shortlist and
**selected a trip window instead of recording someone's unavailability** — a
confident wrong answer, the failure mode this codebase is built to avoid.

**Ask rather than lose.** "2 weeks in Nov" states a length and a period and
says nothing about position. The grammar is right to decline — but declining
sent it to an LLM that cannot know the answer either, because the information
is not in the message. The missing piece is one question with three obvious
answers, so the bot now asks:

    Which 2 weeks?
    [1–14 Nov]  [9–22 Nov]  [17–30 Nov]

`positionSpans` places a span of known length at the start, middle and end of a
period. Three, because it covers the range without making anyone scan a list,
and because it matches how people say it unprompted. The middle is centred with
the odd day given to the front, so the options stay in calendar order and never
collide with their own labels.

**An open question is the nearest referent.** Pending questions are checked
*before* the shortlist's own "the middle one", and keyed per chat **and per
person** — two people can be mid-answer at once, and one person's "the middle
one" must never land on the other's dates. A message that is not an answer
leaves the question open and carries on to the ordinary parsers, rather than
being swallowed. Questions expire after 15 minutes.

**A third over-claim, found while testing this.** `"free a week in dec"` was
being recorded as *all of December* — thirty-one days claimed from a statement
about seven. The sub-period guard caught `2 weeks` but not the word forms
("a week", "two weeks") or days at all ("3 days in Jan").

The shape now lives in `span-shape.ts`, imported by both parsers: availability
uses it to **decline**, the underspecified parser uses it to **ask**. One
definition, deliberately — importing one from the other would cycle, and two
copies would drift about which messages are ambiguous. It requires a period
*after* the length, so `"12 days leave, anytime works"` is untouched; that
exact regression was fixed once already.

---

## Decision (2026-08-17): a statement about yourself is never a change to the trip

Founder asked how *"I'm not free 2 weeks in nov"* then *"the middle one"* are
handled. Tracing both through the pipeline found one bug and one hole.

**The bug.** `parseTripEdit` claimed the first message as a **horizon move to
all of November**, `destructive: true`. From a non-organiser that raises a
confirm button for a change nobody asked for; **from the organiser it applies
silently** — one person's personal unavailability quietly reshaping the whole
trip.

The cause is an ordering assumption that does not hold. Trip edits are checked
after availability, which is what keeps "can also do December" a personal
statement. But that only protects messages availability *claims*. "2 weeks in
Nov" is ambiguous about *which* two weeks, so the grammar correctly declines —
and the message fell through to a parser where `not` is an edit word.

Availability declining is not evidence the message was about the trip. So trip
edits now decline outright on first-person availability language, however
ambiguous the dates: `ABOUT_THEMSELVES`. "I think we should do Korea instead"
still edits — the pronoun is not the tell, the availability vocabulary is.

**The hole.** "The middle one" was dropped by the stage-1 gate as chatter, and
nothing downstream understood positional reference anyway. The card offers
buttons, but people answer a numbered list the way they answer a person.

`parseOptionReference(text, optionCount)` handles the real phrasings — "the
middle one", "the second one", "option 2", "no. 3", "#1", "2", "3 lah", "let's
do the last one". Three choices worth recording:

  * It takes the **count**, because "the middle one" is meaningless for an even
    number of options — with four, either neighbour would be a guess about
    somebody's dates, so it declines.
  * Out-of-range numbers **decline rather than clamp**. "5" against three
    options is a misread, and selecting the last would be a wrong answer
    dressed as a right one.
  * It runs **ahead of the privacy gate**, so the patterns are anchored and
    narrow. A loose one here would become a way for ordinary conversation to be
    read and stored, which is what "reads ≠ stores" exists to prevent.

The shortlist is computed by one shared function rather than recomputed beside
the renderer: the index someone means is the index they can *see*, and two
implementations of "the shortlist" would eventually disagree about which window
that is.

Selection stays **organiser-only**, matching the buttons. Anyone may say "the
middle one"; from a non-organiser it is relayed as a suggestion rather than
silently ignored or silently applied.

**Still open:** *"not free 2 weeks in Nov"* remains genuinely underspecified.
It now declines safely instead of corrupting the trip, but the right answer is
to ask *which* two weeks. Worth building once there is a clarify-and-answer
pattern; the reversal flow's buttons are the obvious model.

---

## Decision (2026-08-17): card density — one icon per section, one problem per warning

Founder: mark the assumed duration, collapse the repeated conflict warning, and
generally *"do not overload the output with too much text and emojis… use emojis
to demarcate sections… do not create too much cognitive load."*

**"3–7 days (default)".** The wizard assumes 3–7 when someone answers "idk", and
the card then presented that identically to a range the group had chosen. Marking
it does two things: it stops our guess being mistaken for their decision, and it
reads as an invitation to change it. This needed a column
(`trips.duration_defaulted`) rather than a check for `3 && 7` — someone can
deliberately pick exactly 3–7, and inferring it would mislabel their choice. An
explicit edit ("make it 5 days") clears the flag.

**Warnings collapse by kind, not by person.** Three people blocked by the same
thing produced three near-identical warnings, each with its own ⚠️, reading as
three separate problems. Now one heading names everyone, each person contributes
only what is specific to them, and the way out is stated once. With a single
person the detail folds into the heading — saying their name three times to make
one point is exactly the noise being removed:

    ⚠️ Dan and Mei can't do any of these dates
    Dan — free 3–9 Jan 2027
    Shift the dates, or go without Dan and Mei.

**Emoji demarcate sections, not lines.** Per-line ✅ ❓ 🤔 ❌ 💬 🗓 turned every
status into a decoded symbol. The distinctions they carried are the product's
whole point, so the *words* stay and only the icons go: "Farah — roster not out",
"Mei — can't make it". ⚠️ (problems), 🎉 (confirmed) and ⏳ (data limit) remain,
one per section. A test asserts the status icons stay out.

**Option rows are one line, not two.** `1. 7–11 Nov 2026 · 5d · 3/4 · 2 leave` —
five options previously cost ten lines and five ticks. Per-option length is kept
despite the squeeze, because with a 3–7 day range the options genuinely differ
and dropping it would hide the trade-off being ranked.

---

## Decision (2026-08-17): AL without the unit, and two gate bugs behind it

Founder: *"AL should be accepted as an abbreviation for Annual Leave too."*

`AL` was already in the leave-cap patterns, but only alongside the word
**days** — so `"only got 3 days AL left"` worked while `"got 12 AL"`,
`"still got 8 al"` and `"AL left 6"` did not. That is backwards: the bare form
is how people actually write it, so the most natural phrasings were exactly the
ones that failed.

Probing it surfaced a worse problem one layer up. The stage-1 prefilter had no
`al` vocabulary at all, so most AL messages were **discarded before any parser
ran** — not escalated to the LLM, just dropped. `"no more AL"` parsed correctly
as a zero cap and still never reached the grammar in production.

The same probe exposed a typo in the NS pattern: `icct?` matches "icc" and
"icct" but **never "ict"**. In-Camp Training has been handled by the
availability grammar since the Singlish work, and gated out before reaching it
the whole time. `mob` and `manning` were added alongside it, since yesterday's
NS vocabulary had the same exposure.

Both cases are the prefilter's stated failure mode inverted — it is documented
as "recall over precision, because a false negative silently loses a
constraint", and these were silently losing constraints.

Exhausted leave now reads as a **zero cap** rather than no cap: `"burnt all my
AL"`, `"my AL all used up"`, `"habis"`. Zero is a hard constraint; absent means
unconstrained, and the two are opposites.

One guard worth noting: the reversed pattern requires a connective
(`AL left 6`, `AL balance 9`, `my AL is 14`). A bare `"Al 5"` is left alone,
because **Al is also a name** and a five-day leave cap invented from someone's
name would be invisible to everyone.

---

## Decision (2026-08-17): retractions — the one gap the architecture could not close

Founder shared external research on non-LLM ambient parsing. Most of it
describes what this repo already does, and in two places we deliberately go
further. One finding was a real gap, and it is now built.

**Where the research agrees with the build.** Deterministic-first with the LLM
as a narrow fallback, a date library rather than hand-rolled parsing (Chrono,
adopted yesterday), a structured constraint store, and the claim that the moat
is the consensus workflow rather than the parsing. All already true here.

**Where we deliberately differ: scoring.** The research proposes weighted
scores — `+10 available, +5 preferred, −20 unavailable`. We rank
lexicographically over hard constraints instead, and should keep doing so.
Under weighted scoring two people's preferences (+10) cancel one person's
hard impossibility (−20), so a window someone *cannot legally travel on* — an
NSman on mobilisation manning — can outrank one that works for everybody. That
inverts the product's whole promise, which is a date that works for the *group*,
not the most enthusiastic subset. Hard constraints eliminate; they do not
subtract. Preferences are recorded as notes and never move the ranking.

**Where we deliberately differ: five states, not two.** The research's model is
available/unavailable. We keep UNKNOWN (a nurse whose roster is unpublished)
distinct from UNANSWERED (silence), because collapsing them either punishes
someone for a roster they do not control or invents consent from silence.

**The real gap: bare retractions.** *"Actually nvm, I can't do that anymore."*
Every other parser produces a *new* fact, and the engine settles conflicts by
overlapping dates. A bare retraction names no date, so there is nothing to
overlap: the withdrawn constraint survived, kept shaping the shortlist, and the
speaker had been told it was handled. Silent, and unfalsifiable from the chat.

Resolution follows the speaker's own recent history, never anyone else's:

  * one recent fact → withdraw it
  * several of the same kind → withdraw the newest, the ordinary reading of "that"
  * several *kinds* inside one conversational moment (10 min) → **ask**, with a
    button per kind

Two invariants. A retraction **never withdraws more than one fact**, and the bot
**always names what it dropped** — an invisible deletion is indistinguishable
from the bug this fixes. A retraction that carries dates ("actually I can't do
20-25 Nov") is a new declaration and stays on the ordinary path.

`participants.max_leave_days_set_at` was added because the cap is a column
rather than a row and so carried no timestamp of its own, which the
same-moment window needs.

**Not built: voting.** The research lists a VOTE intent. Confirmation is
currently organiser-only and deliberate; turning date selection into a group
vote is a product decision, not a parsing one, and is left open.

---

## Decision (2026-08-17): Chrono over Duckling, guarded, beneath the Singapore layers

Founder asked to evaluate Duckling against Chrono and adopt one, keeping the
Singapore-localised handling separate.

**Chrono.** Duckling's grammar is larger, but the cost is structural: it is
Haskell, ships as an HTTP service, and would mean a second container, a network
hop on the message hot path, and a runtime nobody here maintains — directly
against a deploy story whose first rule is *run one instance*. (Worth noting
the npm package named `duckling` is an unrelated duck-typing library; Facebook's
is not on npm at all.) Chrono is TypeScript, in-process, MIT, **zero
dependencies**. Most of what Duckling adds is locales and languages we do not
serve.

**`en.GB`, not `en.casual`.** Not stylistic. Singapore writes DD/MM, and the
locales disagree on precisely the input a Singaporean is most likely to type:

    "3/11"    en.GB → 3 November      en.US → 11 March

**Chrono is guarded, not trusted.** Probing it against real phrasings found
three ways it would have corrupted availability outright:

| Input | Chrono alone | Why it is rejected |
| --- | --- | --- |
| `nov 20, 22 and 25` | year **2022** | reads a day as a year |
| `november` | 1 Nov, single day | discards the other 29 |
| `max 2 days leave` | a date 2 days out | a leave cap is not a date |
| `after the 15th` | 15 Nov, single day | half-open interval, wrong side |

So results must state a day and a month, must not be a bare duration, must not
be a lone pivot after a boundary word, and must fall between today and three
years out. Two-ended spans are distinguished from single days, because only the
former is trustworthy alongside a narrowing word.

**Layering — the localisation stays ours.** Chrono runs *last*, after every
Singapore-specific reading has had its turn: fuzzy periods (CNY, school
holidays) → relative periods → sub-periods → months and day ranges → chrono →
LLM. It cannot override a local reading, and it parses none of them anyway
(`cny period`, `first 3 wks of jan`, `2nd week of jan` all return nothing). It
earns its place on the general tail we used to pay the LLM for: `dec 20th till
jan 2nd`, `3/11`, `next fri to sun`.

Also read the calendar components chrono resolved rather than its `Date`:
`.date()` is built in the host timezone, so ISO-formatting it can shift the day
across midnight — on a UTC server that silently moves a Singaporean's dates.

---

## Decision (2026-08-17): notes stop swallowing dates; days stop widening to months

Live group testing: the bot reacted ✍ to a member's message but `/dates` never
changed. Two independent bugs, found by probing the parsers with real phrasings.

**Notes were terminal.** The opinion branch recorded a note and `return`ed,
unlike every neighbouring branch, which first checks the message isn't also
availability. People bundle the two constantly — *"free in Nov but budget's
tight"*, *"I can afford 10 days of leave"* — and the note branch ate the dates
while the ✍ told the group they had landed. Notes are now **additive**:
recorded, then execution continues to availability and, if needed, the LLM.
A single `finish()` acks once however many signals one message carried.

**Explicit days widened to whole months.** `"can't do 20-25 nov"` was recorded
as *all of November* — the exact over-claim the grammar exists to prevent, and
invisible to the person who wrote it. Day ranges now resolve exactly, in either
order, with ordinals. Three guards keep the failure mode pointed at declining:
a day we can see but cannot place (`"nov 20, 22 and 25"`) declines rather than
taking the first; an impossible day declines; and a span that continues into
another month (`"dec 20th till jan 2nd"`) stands aside for the general parser
rather than claiming its first half.

**Sub-periods resolve instead of declining.** `"first 3 wks of jan"`,
`"last week of dec"`, `"early nov"` were all handed to the LLM. That was safe
when it was the only safe option, but the phrasings are too common to keep
paying for — and with the extractor down, declining loses the constraint
outright. Counted spans and halves are arithmetic; the vague ones commit to a
stated convention (early = 1st–10th, mid = 11th–20th, late = 21st–end) rather
than pretending to precision nobody has. Anything unplaceable still declines.

**NS is a travel bar, not a preference.** Founder-reported: *"first 3 wks of jan
i got mob mannin"*. An NSman on mobilisation manning cannot leave the country,
so this is hard unavailability, and a trip built over it is impossible for him
rather than merely awkward. `mob manning` / `mob mannin` / `mobilisation
manning` / `ops manning` / `mob ex` / `high key` / `low key` / `recalled` join
the existing reservist/ICT vocabulary.

---

## Decision (2026-08-17): tell the difference between a bad minute and a dead extractor

Live group testing surfaced a silent bot. The cause was an exhausted OpenAI
balance, but the *bug* was ours: every extractor failure was handled the same
way — log, record `extraction_failed`, `return`. Two things were wrong with
that.

**The group heard nothing.** Someone types their dates, the grammar declines,
the LLM throws, and the bot goes quiet. Silence in a chat reads as *received*,
so people believe their availability is recorded when nothing was written. That
is worse than an error: it is a wrong answer delivered as a non-answer.

**We kept paying for the same failure.** A dead key or an empty balance fails
identically on every subsequent message — a round-trip of latency each time, and
the real cause buried under thousands of identical stack traces.

So failures are now classified. `quota` and `auth` are **standing** — the next
call cannot succeed — and trip a breaker that skips the call outright.
Everything else is **transient**: stay silent, retry on the next message, since
a one-off timeout should cost nothing more than the parse it missed. Notably
**429 is ambiguous** and cannot be classified by status: rate-limiting is
transient, an exhausted balance is not, and only the error `code` separates
them.

The breaker is a 15-minute **cooldown, not a latch**, and any success clears it,
so topping up credits restores the bot without a restart.

When it trips, the group is told once per chat per hour, and the notice **names
no vendor and admits no billing problem** — that is our business, not theirs.
It offers phrasings the deterministic grammar handles and points at `/dates`,
so the trip keeps moving through our outage rather than stalling on it. This is
the same posture as the spend cap: degrade to grammar-only, never stop.

---

## Decision (2026-08-17): correction path, spend cap, data-cliff honesty, nudge loop, deploy config

Clearing the five items left open after the trial-readiness pass.

**`/mine` — see and fix what the bot recorded.** Until now a misread was both invisible and permanent: someone could see the dates were wrong but had no way to find out why, let alone correct it. `/mine` lists every declaration **with the words that produced it** ("Can't make it · 1–31 Oct 2026 — from 'cmi october'"), the leave limit and its source, and any notes, each with a Remove button. Deletions are scoped to the asker's own participant row, so one person can never remove another's dates from a card they can happen to see. This is simultaneously the trust fix for misparsing and the PDPA *access* right, where `/forget` was only the *erasure* right.

**LLM spend is capped per trip per day** (150 by default). Cost previously scaled with how chatty a group was, with nothing stopping the bot being added to a 500-person chat. Past the cap it **degrades to grammar-only rather than stopping** — the common phrasings still work, which is exactly the behaviour when no API key is configured, so the failure mode was already designed and tested. Both `llm_call` and `llm_cap_reached` are recorded, so spend is observable before it is surprising.

**The 2027 data cliff is now stated, not silent.** Past gazetted coverage the leave arithmetic remains correct about weekends but blind to public holidays — precisely where the good windows are — so it would quietly report worse numbers with no indication anything was missing. The card now says so, but only once real leave figures are on screen; qualifying numbers that aren't shown yet would be noise.

**The nudge loop.** The bot always knew who had not answered and whose roster was pending, and had never once asked them — the gap behind the founder's "magical once, not habit-forming" risk. The organiser now gets an "Ask the quiet ones" button beside "Narrow to 3", which names the silent and the roster-pending separately and closes with a reminder that "count me out" is a valid answer. Deliberately **not** a nag at people who have opted out, and organiser-gated like every other outbound action.

**Deploy config, not a deploy.** `railway.json` fixes the build, start command and health check; `DEPLOY.md` is the runbook. Three things it calls out because they will otherwise bite: run **one instance** (wizard, calendar and pending-edit state is in memory), **migrations are not automatic**, and a **redeploy clears that in-memory state** so anyone mid-wizard restarts, while stored trips and availability are untouched.

**Still open:** in-memory state itself (the reason for the single-instance rule), the 2028 holiday table when MOM publishes it, third-party relay ("Sheryl can only do school holidays"), and a way for participants to carry across trips in the same chat — the cheap half of "saved groups" for repeat use.

---

## Open / accepted risk: budget/affordability may be a bigger blocker than date-finding

**Status: accepted, not addressed by design.** Across three independent research threads (general group-travel commentary and two separate Singapore-specific threads, spanning both the working-professional and student demographics), the cost of the trip came up as a bigger source of group friction than finding dates. Timeaway does not address this — deliberately, per section 19's scope. This is a known limitation of the product's chosen scope, not a bug to fix. Worth keeping in mind when writing marketing copy: Timeaway solves one real part of group trip friction, not the whole thing, and claiming otherwise would overpromise.
