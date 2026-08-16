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

## Open / accepted risk: budget/affordability may be a bigger blocker than date-finding

**Status: accepted, not addressed by design.** Across three independent research threads (general group-travel commentary and two separate Singapore-specific threads, spanning both the working-professional and student demographics), the cost of the trip came up as a bigger source of group friction than finding dates. Timeaway does not address this — deliberately, per section 19's scope. This is a known limitation of the product's chosen scope, not a bug to fix. Worth keeping in mind when writing marketing copy: Timeaway solves one real part of group trip friction, not the whole thing, and claiming otherwise would overpromise.
