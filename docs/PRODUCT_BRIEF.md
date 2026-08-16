# Timeaway — Product Brief

This is the canonical source-of-truth brief for Timeaway, written by the founder before implementation began. It is reproduced here verbatim. Do not rewrite, summarize away, or silently reinterpret any part of it — if something here conflicts with a later decision, that conflict must be recorded explicitly in `docs/DECISIONS.md`, not resolved silently.

See `docs/DECISIONS.md` for the research-validated refinements and open questions layered on top of this brief. See `AGENTS.md` for how to use both documents when doing implementation work.

---

## 1. Product thesis

Timeaway helps friend groups find trip dates that actually work.

Core promise: **Find the days that work.**

The product exists in the stage before itinerary planning:
"We should travel" → who can go → when can everyone go → how much leave does it cost → group agrees on dates.

Timeaway is **not**:
- an itinerary planner
- a booking platform
- a flight tracker
- an expense splitter
- a travel-history app

Its job ends when the group reaches an agreed date window.

The strongest positioning is: **Turn "when are you guys free?" into actual trip dates.**

## 2. MVP wedge

The first product should be a Telegram bot, not a native app.

Reason:
- planning already happens inside group chat
- no install requirement for participants
- dramatically lower participation friction
- naturally viral inside existing social groups
- lets you validate the core scheduling engine before investing in native UI

The Telegram bot is the first client, not the architecture.

Long-term channel roles:
```
Telegram bot = coordination surface
Web = richer shared trip view + acquisition + explanation
Native app = persistent personal travel-planning layer
```

Do not build a Telegram Mini App initially. Use Telegram: natural-language messages, inline buttons, inline one-month calendar, start/end date range selection, reminders, ranked date results, group updates.

Mini App only becomes justified if the Telegram button-calendar becomes a proven usability bottleneck.

## 3. Telegram → website funnel

The bot should not aggressively say "Download Timeaway." The CTA should provide immediate utility: **View full trip**.

Example:
```
Best current match
21–25 Nov

✓ 4 can make it
? Marcus awaiting roster
2 leave days

[ View full trip ]
```

That opens something like: `gettimeaway.com/t/abc123`

The web trip page can show: best window, alternatives, participant breakdown, availability overview, constraints, planning status.

The website can then explain the larger Timeaway product and eventually promote the app.

Preferred domain: `gettimeaway.com`. `gettimeaway.app` can redirect if acquired.

## 4. Fundamental object model

Core hierarchy:
```
User
  ↓
optional Travel Circle
  ↓
Trip
  ↓
Participants
Constraints
Availability
Candidate Windows
Selected Window
```

A Trip means: a shared planning workspace around an intention to travel. It does not mean the journey actually occurred.

Travel Circles are optional persistent groups such as: university friends, work friends, couple friends.

Trips can exist without a permanent circle. Every trip may later offer: "Save this group for future trips?" Overlapping circles are allowed.

## 5. Trip lifecycle

```
IDEA
↓
PLANNING
↓
MATCH_FOUND
↓
DATE_SELECTED
↓
ARCHIVED
```

Optional later: `HAPPENED` — but only if a user explicitly confirms the trip happened.

Never infer: Date selected = trip happened. Timeaway knows planning facts, not travel completion.

## 6. Definition of product success

Timeaway succeeds when: the group agrees on dates.

Not when: flights are booked, hotels are booked, people board a plane, the trip finishes.

Primary north-star metric: **Trip Date Resolution Rate** — % of created trips that reach DATE_SELECTED.

Supporting metrics:
- invite → response rate
- % participants providing a useful constraint
- time to first viable window
- time to selected window
- number of viable windows found
- % trips reaching full response
- natural-language vs calendar input usage
- repeat-group planning
- second-trip creation
- participant → organiser viral conversion

A particularly useful retention metric later: % of groups that create another trip.

## 7. Target user

Primary user: **The organiser** — usually the person in the group saying "Guys, when are you free?"

Likely initial beachhead: working adults, roughly 25–40, travel with friends, organise trips periodically, high coordination complexity.

> See `docs/DECISIONS.md` — this age band was narrowed during research validation. The MVP beachhead is now 23–29, Singapore, Telegram-native. Treat that decision as authoritative over the number in this section.

Other group members are participants, not necessarily full product users initially. Their UX should be close to: "Tell Timeaway what you can/can't do" → "done". The organiser gets the deeper workflow.

## 8. Core planning model

Owner creates the first search boundary.

Initial organiser inputs: destination (chosen or open), destination candidates (optional), rough travel period, duration range, invite friends, organiser availability.

Prefer `4–6 days`, not `5 days`.

Owner input defines the initial search space. Then:
```
OWNER SEARCH SPACE
↓
HARD CONSTRAINTS
↓
FEASIBLE WINDOWS
↓
SOFT PREFERENCES
↓
RANKED WINDOWS
```

Hard constraints eliminate candidates. Soft preferences rerank candidates. **Do not let an LLM decide feasibility.**

## 9. Availability semantics

First-class states:
```
AVAILABLE
MAYBE
UNAVAILABLE
UNKNOWN
UNANSWERED
```

Important distinction:
- **UNANSWERED** — the user has provided no information.
- **UNKNOWN** — the user explicitly cannot forecast that date yet. Example: "I only know my roster one month ahead."

Unknown must not equal unavailable. Untouched calendar dates default to UNANSWERED. Never available or unavailable.

Partial availability is allowed. Users should be allowed to submit without classifying every date. CTA language should support that, e.g. "Done for now" rather than "Complete availability."

## 10. Uncertainty model

Timeaway should work with progressively knowable schedules. Examples: school holidays only, roster released monthly, future leave uncertain, between jobs, dependent on advance notice.

Candidate windows can have states such as: `POSSIBLE`, `STRONG_CANDIDATE`, `CONFIRMED / SELECTED`.

Example output: `4 available · 1 roster pending`

Do not require unanimous certainty before showing useful recommendations.

Support structured conditional constraints later, such as:
```
available if leave_required <= 2
available if booking_notice >= 6 weeks
not Christmas week
```

## 11. Natural-language input

Natural language is a core product advantage. Examples: "Can't do October.", "Sheryl can only travel during school holidays.", "Maximum two days leave.", "I only know my roster one month ahead."

Architecture rule: **Natural language in → structured constraints out → deterministic planning afterward.** The LLM parses. The trip engine decides. Never: LLM directly chooses trip dates.

Natural-language changes should become explicit structured records. Preserve the original user text for auditability. If ambiguity matters, ask or propose an interpretation before applying.

Inputs default to trip-specific. Later optionally ask: "Apply this to future trips too?" Do not silently turn one-trip constraints into permanent personal rules.

## 12. Telegram calendar UX

Telegram inline calendar is the secondary input path. One month at a time. Do not show multiple months simultaneously on mobile. The calendar is not meant to force 31 independent decisions.

The primary interaction should support ranges:
```
[ Works ] [ Maybe ] [ Can't ]
Choose start date → Choose end date → Save range
```

So "Can't → Sep 4 → Sep 17" becomes one structured unavailable range.

Natural language and calendar input should map into the same data model. "Can't do Sep 4–17" and "Can't / 4 → 17" produce the same constraint.

## 13. Calendar design decision

The broader planning horizon can be larger, but the visible interaction unit should be: **one full-width month**.

Reason: better touch target size, lower perceived density, clearer cognitive unit, easier month-by-month certainty reasoning.

Planning horizon guidance:
- broad trip intent: up to ~12 months
- initial active planning slice: ~3 months
- expandable active horizon: up to ~6 months
- visible calendar: 1 month at a time

Users should never have to classify six months of dates as homework.

## 14. Flight search

Do not integrate live flights in V1.

Core V1: invite, availability, duration constraints, leave optimisation, destination preferences, ranked date windows.

Later — V1.5: public holidays, weather, approximate flight pricing. V2: live airfare, alerts, deep links.

Flight API principle:
```
availability filtering
↓
leave computation
↓
duration constraints
↓
candidate ranking
↓
only then external flight pricing
```

Do not query flight providers for every possible date combination. Flight price should initially be a ranking signal, not a hard constraint. Cache aggressively. Distinguish estimated/stale vs live. No dependency on a "Google Flights API"; use legitimate providers later.

## 15. Privacy model

Availability and future travel intentions are sensitive. Default: **private**.

Suggested access model:
- **Public** — name, avatar
- **Shared within trip/circle** — relevant planning participation, shared planning statistics
- **Private** — raw availability, future travel intentions, calendar-derived data, leave information, personal constraints

Availability should be selectively shared with specific trips or circles. Never create public feeds like "Anthony may be away 21–25 Nov."

## 16. User identity architecture

Telegram identity must not be your canonical identity. Use:
```
Timeaway User
id = UUID
```
Then linked identities: `telegram_user_id`, `email`, `apple_user_id`, `google_user_id`.

This lets someone start in Telegram and later connect the same account to web or iOS.

## 17. Data ownership

- **User-owned** — personal availability, default travel preferences, home airport, leave allowance, future calendar connection
- **Trip-owned** — destination, trip horizon, participants, candidate windows, selected dates, trip-specific constraints
- **Circle-owned** — members, repeated planning relationships, circle-specific norms/preferences

Natural-language inputs default to trip-owned unless deliberately promoted.

## 18. Social/profile model

Timeaway cannot reliably know whether a trip actually occurred. Therefore avoid: trips taken, countries visited, nights travelled, places travelled together.

Safe profile language:
```
12 trips planned
8 dates agreed
5 travel circles

Planned with Sarah 6 times
Planning since 2026
```

Possible profile direction: **planning identity**, not "travel passport."

Future profile can surface: trips planned, dates agreed, repeat planning partners, travel circles, usual duration, common destination preferences, planning history.

Only show "trip happened" if explicitly confirmed.

## 19. What happens after a date is selected

Keep scope narrow. After "21–25 November selected," offer: Add to calendar, Share dates, Archive planning.

Potential outbound links later: Search flights, Search hotels.

Do not build: itinerary management, reservation imports, expense tracking, booking workflows. Timeaway's job is done once the date is resolved.

> See `docs/DECISIONS.md` — this boundary is flagged as an open risk (no revenue mechanism), not yet resolved.

## 20. Brand

Working brand: **Timeaway**. Tagline: **Find the days that work.**

Celebratory product copy can still use e.g. "Bound for Tokyo" even though Bound is not the product name.

Preferred styling: lowercase wordmark `timeaway`, premium consumer product, calm, optimistic, social, travel-oriented without looking like a travel agency.

Reference feeling: Airbnb, Flighty, polished Apple consumer software.

Avoid: Jira, Google Calendar, enterprise SaaS dashboard aesthetics.

The surface should feel "We're going somewhere," not "We're administering calendars."

## 21. Light-theme color system

Primary theme: light. Canvas `#FAFAF8`. Surface `#FFFFFF`. Primary text ~`#1F2328`. Secondary text ~`#68707C`. Borders ~`#E7E8EA`.

Primary functional accent — **Layover** `#4657E8`. Use for: primary CTA, selected navigation, links, focus states, Telegram bot avatar, app icon background, primary brand moments.

Do not use the brand hue for availability meaning. Semantic palette remains independent:
```
AVAILABLE    green
MAYBE        amber
UNAVAILABLE  red
UNKNOWN      gray
UNANSWERED   neutral / no mark
```

Always pair semantic colors with symbols/text.

## 22. Brand gradient

Marketing can use a richer expressive gradient, inspired by AMRA's broader visual language.

Working gradient concept — **Horizon**: `#4457E8 → #7767F1 → #55B7E8`.

Use for: website hero, large marketing surfaces, celebration moments, illustrations, possibly the standalone marketing mark.

Do not use gradients in: app icon background, core logo geometry, small-scale logo usage, routine primary buttons. The logo must scale cleanly in monochrome.

## 23. Logo direction

Avoid literal: airplane, globe, suitcase, calendar, map pin, clock. "T + plane" was considered but judged too generic/travel-agency-like.

Preferred conceptual territory: two things folding together into one shared opening. Möbius-inspired, but not a literal complex Möbius strip.

Logo principles: one or two shapes maximum, one fold/crossing max, strong negative space, rounded geometry, works at 16–24 px, monochrome first, no gradients, warm-white mark on solid Layover background for app icon.

Top logo exploration directions: 1. Shared Window, 2. Folded T, 3. Continuous Loop Path.

Strongest conceptual message: multiple schedules converge into one opening.

## 24. Design language

Borrow Airbnb's principles, not its coral. Use: generous whitespace, strong typography, few containers, rounded tactile controls, restrained shadows, destination imagery for travel emotion, calm functional surfaces, warm celebratory moments.

Suggested shape language: buttons ~12–14 px radius, cards ~16–20 px, pills for chips, sheets with larger rounded top corners. Avoid excessive card nesting.

## 25. Technical architecture

Because long-term flexibility matters more than minimum setup, preferred architecture is:
```
Telegram
    ↓
TypeScript API
    ↓
Trip engine
    ↓
Postgres
```

Recommended stack:
- **Backend** — TypeScript, Hono or Fastify, Drizzle ORM, Neon Postgres, Railway hosting, Cloudflare R2 later if object storage is needed
- **Frontend later** — Expo, TypeScript, Expo Router, TanStack Query, React Hook Form, Zod, Zustand only if necessary
- **Tooling** — pnpm, GitHub, GitHub Actions, Sentry, PostHog, RevenueCat only once native monetization exists, EAS for native builds later

Core philosophy: **own application architecture; rent infrastructure.** Do not put business logic inside Telegram handlers. The planning engine must be platform-independent.

## 26. LLM architecture

LLM responsibilities: extract structured constraints, resolve conversational input, interpret hard vs soft preference language, potentially detect ambiguity.

LLM must not: calculate feasibility, determine intersection logic, rank solely by prose reasoning, mutate state silently.

Deterministic engine handles: candidate generation, duration constraints, availability intersection, leave-day computation, hard constraints, ranking formula.

## 27. Suggested repository structure

```
timeaway/
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── PRODUCT.md
│   ├── MVP.md
│   ├── UX.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   └── DECISIONS.md
│
├── apps/
│   └── telegram-bot/
│
├── packages/
│   ├── trip-engine/
│   ├── database/
│   └── shared/
│
└── ...
```

Telegram is one adapter around the shared domain.

> Note: this repo currently uses `docs/PRODUCT_BRIEF.md` (this file) in place of `docs/PRODUCT.md`, since it is the verbatim founder brief rather than a distilled product doc. Splitting it into `PRODUCT.md` / `MVP.md` / `UX.md` / `DATA_MODEL.md` is a reasonable future task, not a blocker.

## 28. Codex operating principle

The repository should become the source of truth. Not this chat (or any chat).

`AGENTS.md` should tell Codex/Claude Code: what docs to read, architecture boundaries, testing expectations, engineering conventions, explicit MVP exclusions.

`DECISIONS.md` should record major choices and reasons so later agents do not casually reverse them.

Prefer small implementation tasks rather than "Build Timeaway." Example sequence:
```
1. Scaffold monorepo
2. Implement User / Trip / Participant models
3. Implement availability model
4. Implement candidate-window generation
5. Implement hard-constraint engine
6. Implement ranking
7. Implement Telegram trip creation
8. Implement natural-language constraint parsing
9. Implement Telegram calendar range input
10. Implement result summaries
11. Add web trip read-only view
```

## 29. MVP exclusions

Do not build initially: native iOS app, Telegram Mini App, live flight integration, weather, itinerary builder, expense splitting, booking management, public profiles, public travel feed, complex travel circles, payments, social network features, AI itinerary generation.

## 30. Core MVP proof

The first end-to-end scenario should be:
```
Owner:
Japan sometime Sep–Nov
4–6 days

↓
shares / adds Timeaway in Telegram

Friend A: Can't do October
Friend B: School holidays only
Friend C: Max 2 days leave
Friend D: Roster only known one month ahead

↓
Timeaway parses constraints
↓
deterministic engine generates candidates
↓
Timeaway posts:

Best current match
21–25 Nov

✓ 4 likely available
? 1 roster pending
2 leave days

[ View full trip ]
```

If that works reliably for real groups, you've validated the central product.

## The single sentence Codex should understand

Timeaway is a channel-independent group travel date-resolution engine, initially delivered through a Telegram bot, that converts partial natural-language and calendar availability into ranked feasible trip windows while preserving uncertainty and minimising participant effort.
