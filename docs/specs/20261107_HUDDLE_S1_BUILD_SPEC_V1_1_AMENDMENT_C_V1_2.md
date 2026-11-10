# Huddle S1 — Build Spec V1.1 — Amendment C, V1.2 (Command Center alignment + hub contract + feasibility facts)

**Date:** Nov 7, 2026 · **Supersedes:** `20261101_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_C_V1_1.md` (C1 and C2 revised; C3–C9 carried unchanged; C10–C14 added) · **Precedence:** C > B > A > V1.1
**Closes:** the Command Center chat's five additions (C1–C5) and nine hub rules (C6–C9) of Nov 1, the Huddle rows of the Shared Research feasibility review of Nov 4 (§4 "The Huddle" row; Q1, Q2, Q6, Q7, Q9), as they touch S1, and the onboarding handoff's item C01 (C15, added Nov 7).
**Destination when committed:** `docs/specs/20261107_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_C_V1_2.md`
**Note:** the feasibility review read Amendment C (Nov 1), not C V1.1. C1 is identical in both, so its findings apply as written.

---

## C1. The per-symbol cache becomes a shared evidence record — replaces §3.5 (revised)
Collection **`symbolDayEvidence/{etDate}_{SYMBOL}`** (no client access; scanner and allowlist entries use this name). **`etDate` is the ET trading date** from the existing ET helpers (`marketSchedule.js` / `marketCalendar.js`), never a UTC date (the newsroom keys some stores by UTC and some by ET; this record uses ET only). Schema from day one, **null when unknown, never zero**; reserved groups are absent until written and read as null:
```
symbol, etDate
price:    { lastClose, lastCloseAsOf }                                       // Huddle job writes
news:     [ ≤ 10 { newsId, eventId|null, publishedAt, eventTime|null,
                   sourceKind: 'primary_release'|'press_wire'|'coverage'|'fantasytimes_story',
                   source, title, url|null, primaryReleaseUrl|null } ]       // Huddle job writes
sources:  { eodhd, newsfilter, fantasytimes }: 'ok'|'skipped'|'error'        // Huddle job writes
release:  { text, url, eventTime, publishedAt }                              // reserved; Shared Research writes
earnings: { period, reportDate, timing: 'bmo'|'amc'|null, currency,
            epsActual, epsEstimate,                                          // EODHD supplies these six
            epsEstimateAsOf, revActual, revEstimate, revEstimateAsOf,
            guidanceCurrent, guidancePrevious }                              // no source at HEAD; stay null
                                                                             // reserved; Shared Research writes
claims:   { price|news|release|earnings: { claimGeneration, leaseUntil, owner } }   // per-field-group ownership (B4 rules)
```
- **`newsId` is defined per `sourceKind`.** `fantasytimes_story`: the `fantasyTimesStories` document id (the same id `fantasyTimesWire/{etDate}.bySymbol` indexes and the agent's `seenStoryIds` holds). EODHD-sourced kinds (`coverage`, `press_wire`, `primary_release`): the first 16 hex characters of a SHA-256 of the normalized `url`; for these kinds `url` is required and an item without one is dropped with reason `no_url`. EODHD `/news` carries no item id, and the app's existing `news-${Date.now()}-${index}` id (`api/news/stock.js:61`) changes on every fetch, so it is never used.
- **`publishedAt` is the vendor's date, never the fetch instant.** `api/news/stock.js:66` substitutes the fetch time for a missing date; the evidence fetcher does not. An EODHD item with no date is dropped with reason `no_publication_time`. For `fantasytimes_story`, `publishedAt` is the story's own `publishedAt` (its write instant) and `eventTime` is null.
- `eventId` in S1 is a best-effort dedupe key (symbol + normalized title + 24 h window) or null; proper event collapsing is Shared Research's.
- Field ownership: the Huddle's morning job fills `price`, `news[]`, `sources`; `release` and `earnings` are Shared Research's. `fantasytimes_story` is the app's own Wire story; `press_wire` is a press-wire release. All fetchers live under **`api/_utils/evidence/`**.

## C2. Origin on every plan item — adds to §3.2 and §4 (revised)
Each stance and line carries `origin: { kind: 'huddle' | 'research', recordKind: 'researchWork' | 'hypothesisVersion' | null, recordId: string | null }`, the same `recordKind` / `recordId` pair the pack-item `source` uses. Formats: a `researchWork` id as stored; a hypothesis version as `{watchlistId}/v{n}`. S1 always writes `{ kind: 'huddle', recordKind: null, recordId: null }`. Conditional templates ("prefer B if its setup confirms") are a later family.

## C3. Receipt vocabulary — adds to §6.4
§6.4's status names are provisional; when the framework chat publishes the shared vocabulary, S1 renames by string substitution. Records stay on the huddle record. "Heard" = a tick capture showing the item in the prompt, the same receipt Shared Research calls "considered".

## C4. The chip does not announce — adds to §8
A state label and a door, never an announcement: no badge, pulse, toast, count, or live region. Shadow's status line stays the hub's only live region. The chip sits **outside Shadow's fixed box and leaves its size alone**, is a **44 px** target, and fits at **360 px** wide.

## C5. One voice rulebook — adds to §7
`docs/design/SHADOW_VOICE_RULES_V1.md`, committed in the S1 PR: §7's rules plus the Command Center's four (no learning claims; a time on every fact; "unverified" said aloud; no advice phrased as the agent's decision), plus C12 below. The system prompt and the forbidden-terms tests cite it; Shared Research extends it for written openings.

## C6. Next action and the hub spec amendment — adds to §8
- S1 adds **one rule** in `hub/nextAction.js` with its own Later key **`huddle:{etDate}`**, in the agreed attention order: *a game in session* → *Huddle ready* (before the open; above "deployed, starts 9:30") → *a review ready* → *research awaiting your direction* → *the first deployment*. After the plan is confirmed or skipped, the card falls through. Every `nextAction.test.js` and `CommandCenterHub.s4` row the new order moves is re-pinned in the same commit and listed in the report.
- The S1 PR also commits **`docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_D_20261101.md`** with a `docs/README.md` row, carrying the hub-side rulings of this amendment (attention order, chip, Partnership panel, readers, copy, audio, sheets, activity, and the Deploy card's reconfirm line of C15). The hub spec file itself is **unchanged**.

## C7. Readers and the deploy provider — replaces §6.2 and §8's reader paragraph
- **The client post-deploy hook is dropped from S1.** Nothing the root deploy provider imports may import the Huddle service, and the hook brought no behaviour the sweep does not already provide: a battle's first check is a forced trigger and the sweep runs before that check's prompt, so a plan confirmed before deploy is applied at the first read either way. Status copy for the interval: *waiting for the agent's first read*. (§6.1's apply route stays for confirm; the `apply` route for the hook is removed.)
- **One reader per record**, keyed by uid and auth epoch, living in the hub chunk: `src/hooks/useHuddleToday.js` (the huddle record) and `src/hooks/useHuddleHistory.js` (plan history for Partnership), each with a **single service import** (`src/services/huddleService.js`), pinned by the mount guard's permitted map and NAMED list. **No read per tab switch.** The entry chunk is checked by sourcemap attribution before and after the build; the report shows both.
- **No status poll.** Plan status refreshes on sheet open, on confirm/skip, and on `visibilitychange`; each listener is registered in the hub's activity guard manifest.

## C8. Hub surfaces — adds to §8
- **Partnership panel:** replacing the reserved "Not in this release" text moves its copy-guard pins under this ruling. The panel gets the Research panel's states: **loading, none, error**, and an **as-of note** on a kept answer.
- **Words:** every string lives in `hub/hubCopy.js` under the copy guard; no learning claims; plan status words come from receipts only (and C14).
- **Audio:** no autoplay; playback stops on unmount, on a hidden tab, and while the deploy ceremony covers the page; every listener in the activity guard manifest.
- **Sheet:** the Huddle sheet is a **HubSheet** on the hub's overlay stack (background inert, focus to Close, Escape, focus return).
- **Activity:** "Plan confirmed" / "Plan skipped" rows come from huddle records with kind-specific ids (`huddle-plan:{uid}:{etDate}`) and the same cutoff as every other row.

## C9. Checks and reporting — adds to §9 and §10
- The flag-on dry run on the never-merge smoke branch includes the hub at 360 px and desktop.
- The build report gains a **hub-contract section** listing each rule in C4, C6, C7, C8, C14 and C15's Deploy card line as **held** or **moved under a ruling**, and the before/after entry-chunk attribution.
- The build report goes to **both** chats: the Huddle chat for the plain-terms, fence and script review, and the Command Center chat for the hub-side check, before the founder merges.

---

## C10. Gathered evidence uses the pack-item shape — replaces `cards[].sources[]` in §3.1 and extends A §A7
The huddle record gains **`evidence[]`**, one entry per item the job gathered, in the shape Shared Research, the stock research modal and the Film Room already agreed:
```
{ id, kind, fact, source: { recordKind, recordId, label }, at, asOf|null,
  status: 'verified'|'unverified'|'unavailable', reason|null }
```
- `id` is deterministic: the first 12 hex characters of a SHA-256 of `kind|recordKind|recordId|at`. A7's `evidenceIds[]` on script sentences, `names[]`, and each card point at these ids; cards render their source lines from them (`cards[].sources[]` is removed). No `pin` in S1.
- S1 kinds: `close`, `headline`, `event`, `holding`, `agent_pick`, `opener`, `prior_plan`, `source_status`.
- Status rules: a close from the morning record is `verified` with its `asOf`. A headline is stored as an attribution (`fact` = "{source} reported: {title}") and is `verified` as that attribution only; Shadow never restates a coverage claim as fact. A source that errored or was skipped is a `source_status` item, `unavailable`, with its reason. Nothing `unverified` is spoken without the word "unverified" (C5).

## C11. Earnings calendar: real keys and the announcement date — adds to §5.2 and §4.3
- Read only the keys the payload carries, per the committed capture `api/_utils/__fixtures__/earningsCalendarCapture.js:1-16` (nine keys): `actual`, `estimate`, `date` (fiscal period end), `report_date` (announcement), `before_after_market`, `currency`, plus `code`, `difference`, `percent`. Never `actual_eps`, `eps_estimate`, `actual_revenue`, `revenue_estimate`, `report_time` or `market_cap`; three live readers ask for those and get null (`ingest-earnings.js:127-131`, `submit-earnings-batch.js:141-142`, `api/stocks/earnings-calendar.js:88-90`). That is out of scope: report it, do not fix it.
- An earnings event's ET date, its event id (`earn:{SYMBOL}:{etDate}:{bmo|amc}`) and its place on the event strip use **`report_date`**, never `date`.
- An earnings row with no BMO/AMC label is untimed and not eligible for `NO_ADDS_BEFORE` (V1.1 §4.3: untimed events are not eligible).
- A null estimate is "no estimate on file", never 0 and never a beat or a miss. S1 computes no surprise.
- A unit test runs the evidence fetcher's earnings parsing against the capture fixture.

## C12. No volume claims in S1 — adds to §7 and C5
The agent sees no live volume for a held name, and the bench `RVOL=` it does see is a trailing-mean placeholder during regular hours with no basis stamp (`compute-index-intelligence.js:258-290`). So the gather step passes **no volume or relative-volume value** to the script, and a volume question is answered "unknown". The forbidden-terms test bans `RVOL` and any number adjacent to "volume" in a script. `SHADOW_VOICE_RULES_V1.md` carries the rule.

## C13. Capture the EODHD `/news` payload before writing its fetcher — adds to §9 and A §A8
No `/news` response has ever been captured; every reader assumes its keys. Before the evidence fetcher for EODHD news is written:
1. One local script makes **at most 2** calls, `/news?s={SYM}.US&limit=3`, for two symbols, one of them likely to carry a press-wire item that morning. This is authorized spend (≈ 5 units each by the census's assumed weight) and counts against the build's spend rule.
2. The responses are committed, with the API token stripped, as **`api/_utils/__fixtures__/eodhdNewsCapture.js`**, with a header in the style of the earnings capture: capture date, symbols, the observed keys, the `date` format and timezone, whether `link`, `content` and `symbols` are present, and the absence of an item id.
3. The fetcher and its tests are written against the fixture. No key the fixture lacks is read. If the fixture contradicts C1 (for example, no `link`), STOP that sub-step and report; do not invent a fallback.

## C14. The hub copy guard as it stands — adds to C8
S1's hub strings must pass the existing guards without loosening any of them: the no-learning list (`hubCopy.guard.test.js:372-376`, which bans learn, improv, intelligen, smart, earned, tier, evolv, grow, unlock, remembers, level up, "sources · N" counts and more); the numeral rule (only 1, 1.3 and 10 may appear as literals, `:417-421` — durations and clock times render from data); and the pairing fence (no string names Shadow or the agent together with an idea except the four honest lines, `:331-340` — Huddle copy speaks of the plan, never of ideas). A conflict between a needed string and a guard is a **finding in the report**, never a loosened guard.

## C15. A plan belongs to the archetype it was confirmed under — amends A §A1, B §B1 and spec §6.1 (onboarding handoff C01)
A plan is validated against one archetype's dissent table, and the deploy route is fenced, so the plan's application is the server boundary that keeps a plan from reaching a battle running a different archetype.
- **Confirm records the archetype.** The confirm route reads the player's equipped archetype (the same read the gather step uses), validates `replacement` with that archetype's dissent row (a change since generation can transform items, which returns A §A1's 422 preview), and freezes `archetype` in the confirmation.
- **Confirmations append, never overwrite.** `plan.confirmations[]` holds each frozen snapshot `{ current, revision, archetype, renderedText, renderedTextHash, confirmedAt }`; `plan.confirmed` is the newest, for readers. Receipts stay keyed by `(battleId, revision)`.
- **Reconfirm.** The confirm route also accepts an already-confirmed plan, but only when the player's equipped archetype differs from the newest confirmation's; otherwise it returns the confirmed state unchanged (idempotent, as A §A1). A reconfirm runs A §A1 steps 2–3 under the current archetype and appends a confirmation. The session-close refusal (410) applies as before.
- **Apply picks the matching confirmation.** For each battle, inside the B §B1 transaction, the apply module selects the newest confirmation whose `archetype` equals the battle's frozen `agentContext.archetype`. If none matches, the disposition is **`stale_approach`**: retryable, re-attempted by the next caller after a new confirmation lands, expired at the session close like every other retryable disposition. `archetype_unsupported` (no dissent row) is unchanged. A battle never receives a confirmation made under another archetype.
- **Status copy:** `stale_approach` reads as the plan having been confirmed under a different approach, with "Reconfirm" as the action; the exact words pass C14.
- **Hub: the Deploy card's reconfirm line.** When the archetype the hub's existing agent reader shows differs from the newest confirmation's `archetype`, the Deploy card shows one line asking for reconfirmation and a "Reconfirm" door that opens the Huddle sheet at the plan card. Pure derivation from readers the hub already has (the agent reader and `useHuddleToday`); the card makes no service call itself, so C7's deploy-provider rule holds. The line never blocks or delays a deploy.
- **Tests:** confirm under archetype A, switch to B, deploy → the new battle gets `stale_approach` and the Deploy card shows the line; reconfirm under B → the next apply writes it to that battle, while a still-running battle under A keeps its A receipt; reconfirm with an unchanged archetype → idempotent; a dissent transform on reconfirm → 422 preview; two live battles under A and B each receive only their own confirmation.

---

## Not in S1 (recorded so nobody builds it by accident)
- The record changes the Command Center chat listed for the Shared Research slice (`researchWork.findings[]`, `question`, `symbolKeys[]` + index, `origin: 'shared_research'` and its host collection; a second `evidenceRefs[].kind`; idea-version `origin` values; a durable exchange id on host sessions; a versioned research `summary`; the `gate.js` cohort split; `trackedFrom`) belong to the framework chat's own build.
- The three lens corrections from the review (the review clock starts at deploy, not at ready; no draft → ready move; `invalidated` has no writer) are inputs to the Huddle S2 concept, not S1.
