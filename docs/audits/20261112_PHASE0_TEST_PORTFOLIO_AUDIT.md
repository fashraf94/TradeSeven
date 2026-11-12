# Phase 0 — Test portfolio audit: the Mandate, Season Mode and the Practice Field loop (read-only)

**Claude Code, 12 Nov 2026.** For the Practice Field chat (Fable) and the founder.
**HEAD:** `1e041a022126f48b0d2a2cc9dfc02dd20b465198` (= `origin/main` after `git fetch origin`, run first; the #1038 merge). **Branch:** `claude/practice-field-test-portfolio-phase0`, cut from that HEAD. **Writes:** this file and its row in `docs/README.md`. Nothing else.
**Read-only:** no edits under `api/`, `src/`, `scripts/`, rules, indexes or flags; no model calls; no EODHD calls; no PR closed, commented, rebased or merged.
**Firestore:** read only, with the growth replay's service-account recipe (`scripts/experiments/growth-replay/README.md:19`, `:23`), from two scripts in the session scratchpad that each passed a write-call grep before they ran. The scripts printed counts and dates only. This report carries no uid, agent id, book id or battle id, and quotes no model-written or player text.
**Citations:** every `file:line` below was read at this HEAD in this session and is **VERIFIED** unless marked otherwise. Four read-only sub-readers located code for Q4, Q6, Q7, Q8 and Q10; every anchor they returned that this report cites was re-printed and checked at this HEAD before commit (§8).

---

## 1. In plain terms

**Is the Mandate running? Its machinery is, but it has never run a single portfolio.** It was switched on on 14 August. Since then not one book has been created, so it has spent **$0 on AI**. Every trading day it still downloads market data for its 136 stocks: prices four times a day, plus company data, splits and dividends. That is about **1,700 EODHD data units a weekday, roughly 105,000 so far** (an estimate from its own counter), for portfolios that do not exist. It is under 2 % of the daily data allowance, so the money is small. But it buys nothing, and nothing on `main` reports it or stops it.

| Question | Short answer |
|---|---|
| Q1. Is the Mandate running? | Switched on and running daily, with **zero books**, zero AI spend, and ~1,700 data units a day spent on nothing |
| Q2. The "five old PRs" | **Seven Mandate PRs merged** in August: the whole engine. **Three are open**, each a one-line switch; close all three |
| Q3. What a test portfolio can reuse | Most of the engine: the paper book, honest fills with modelled costs, splits and dividends, the daily close and its rows, risk scores, the AI decision call |
| Q4. Season Mode | Unscheduled and dead. The Mandate already rebuilt and fixed its maths. Only its "you vs SPY" chart is worth keeping |
| Q5. The twin | Two books see the same prices at the same moment by design. Benchmark prices are already collected. The engine just won't create two books for one player, and nothing pairs them yet |
| Q6. Test subjects | Single stocks, sectors and industries have data. Themes have a few seeded lists. Catalysts have no record at all |
| Q7. Hand-offs | The Film Room's "Drill" card is already "nominated for the Practice Field", with no button to send it. The Forge's equip endpoints can apply a result. **No Film Room card exists in production yet** |
| Q8. Running notes | The engine already makes the AI write 2–5 sentences of reasoning on every decision, then **throws them away**. Notes kept in their own record never reach a battle |
| Q9. Cost | About $0.03–$0.09 per test per day with an AI twin, half that with a benchmark twin, under a cent for a rule-managed book. Market data stays flat while tests use shared stocks. **The engine evaluates at most about 50 books per slot as written** |
| Q10. Where it lives | No Practice Field screen exists. Follow Huddle's dark-flag pattern; start founder-only |

**What exists.** A nearly complete paper-portfolio engine:
- It runs books of US stocks with real delayed prices.
- It charges modelled trading costs and applies splits and dividends.
- It marks every book once a day at the official close and keeps a daily row.
- It scores risk and asks an AI manager for one action per check.
- Every book shares one price snapshot, which is exactly what a fair twin needs.

Around it:
- the Film Room's cards and their reserved "next steps";
- ideas that already carry a stock list, a length and a review against the market;
- benchmark prices for SPY and the sector funds;
- the Forge's equip endpoints.

**What is missing.**
- A *test-shaped* book. The engine allows one $10M, three-month book per player, chosen by archetype.
- Pairing a test with its twin.
- Keeping the AI's reasoning.
- A "send to test" button.
- A result record.
- A Practice Field screen.
- Any premium or entitlement system.

**The biggest surprise.** The Mandate is not "barely started". It was built, reviewed and switched on in three days in August, then never given its first book, and it has paid for market data every day since. Two smaller surprises:
- The AI's written reasons are discarded the moment it decides.
- A units mix-up means the engine's sector limit (no more than X % in one sector) would never bind (§9.1). It should be fixed before any book trades.

## 2. Answers

### Q1. Is the Mandate running right now?

**The machinery runs every trading day. No book exists. Model spend is zero. Market-data spend is not.**

**Flags (VERIFIED).** `MANAGED_MANDATE_ENABLED = true` (`src/config/featureFlags.js:1930`), `MANDATE_EVAL_ENABLED = true` (`:1938`), `MANDATE_CLOSE_ENABLED = true` (`:1946`), `MANDATE_FOUNDER_CREATE_ENABLED = true` (`:1974`). Still dark: `MANDATE_ROLLOVER_ENABLED = false` (`:1954`), `MANDATE_DORMANCY_DOWNSHIFT_ENABLED = false` (`:1962`); transport `MANDATE_TRANSPORT_MODE = 'direct'` (`:1983`). They were lit by PR #759, merged 14 Aug 2026 (merge `2f554469`). The docstrings above them still describe the false value as the default, e.g. "When FALSE (DEFAULT, merge-dark) nothing mandate-related runs" (`src/config/featureFlags.js:1924`).

**Schedules (VERIFIED).** `mandate-evaluate` runs `*/15 14,15,16,17,18,19,20,21,22 * * 1-5` (`vercel.json:197-198`): 36 fires per weekday. `mandate-rollover` runs `*/15 12,13 * * 1-5` (`vercel.json:201-202`): 8 fires per weekday.

**What `mandate-evaluate` does (VERIFIED).** After auth (`api/cron/mandate-evaluate.js:230-234`) and the master gate (`:237-239`), the market calendar decides the duty. Three 30-minute eval slots per session, open+30, midday and 30 minutes before the close (`api/_utils/mandateSessionSlots.js:39`, `:89-93`), and a close window from 15 to 120 minutes after the close (`api/_utils/mandateConfig.js:215-216`, `api/_utils/mandateSessionSlots.js:218-226`).

- **With no books.** The first fire in each slot finds no snapshot for that slot (`api/cron/mandate-evaluate.js:284-286`), reads the active books (`:287`), then builds the day's slow layer (`:289`) and the slot's price snapshot (`:292-294`) for the curated list of 136 stocks (`api/_utils/mandateUniverseSnapshot.js:80-110`; the list is `api/_utils/mandateCandidateUniverse.js:33`, counted at this HEAD). The slow layer fetches, per stock, fundamentals through a 24-hour cache plus a splits and a dividends request (`api/_utils/mandateUniverseSnapshot.js:352-454`, the two requests at `:317-320`). The price snapshot is real-time quotes, 100 tickers per request (`api/_utils/mandateConfig.js:110`, `api/_utils/mandateUniverseSnapshot.js:502-508`). The book query then returns nothing (`api/cron/mandate-evaluate.js:362-367`) and the fire ends. The close window does the same for a close snapshot (`:661-675`), finds no books, counts the sweep complete and runs retention cleanup (`:766-771`).
- **With books.** Each book whose cadence tier is due in the slot (slow: one slot; standard: two; fast: three, `api/_utils/mandateSessionSlots.js:48-52`; tier per archetype, `api/_utils/mandateGenerationConfig.js:47-54`) gets one model call on Haiku 4.5, 600 output tokens at most (`api/_utils/mandateGenerationConfig.js:25-34`). The answer is normalised, gated and executed (`api/cron/mandate-evaluate.js:195-219`), its cost is priced into the book's telemetry (`:428-429`), and at the close every active book gets one daily row (`api/_utils/mandateClosePass.js:155`).

**What `mandate-rollover` does (VERIFIED).** After the master gate it checks the pre-market window, then returns `mandate_rollover_dark` because `MANDATE_ROLLOVER_ENABLED` is false (`api/cron/mandate-rollover.js:52-65`). It does nothing, with or without books.

**Production records (Firestore, read 12 Nov 2026 after the open+30 slot; counts and dates only).**

| Record | Count | Dates |
|---|---|---|
| `mandates` (books) | **0** | — |
| `archetypeVintages` | **0** | — (every creation publishes one before it writes the book, `api/_utils/mandateCreationService.js:57`, so no creation call has ever reached that step) |
| `mandateBatches`, `mandateBatchStats` | 0, 0 | batch transport never ran |
| `mandateUniverseDaily` | 64 | 14 Aug → 12 Nov 2026; 136 stocks each, 0 held |
| `mandateUniverseSnapshots` | 251 | `2026-08-14_close` → `2026-11-12_open30` (63 open+30, 62 midday, 63 pre-close, 63 close) |
| `mandateUpstreamCalls` | 64 dated counters | **23,320** counted requests in total; a full day reads 280 (17 days) or about 416 (30 days) |

**Spend.** Model: **$0**. No book has ever been evaluated, so there are no last-evaluated dates and no cost telemetry. Market data: the counter counts one per quote request, one per fundamentals refetch and one per splits or dividends request. 280 = 272 splits and dividends requests plus 8 quote requests; 416 adds 136 fundamentals refetches. EODHD bills quotes per ticker and fundamentals at 10 per request (`docs/audits/20260918_PHASE0_INTRADAY_ADDENDA.md:46`, `:48`, both founder-measured; also `api/_utils/marketDataCache.js:446`). Splits and dividends are billed at 1 each, ASSUMED there (`docs/audits/20260918_PHASE0_INTRADAY_ADDENDA.md:55`). In billed units that is about 816 a day when fundamentals are cached and about 2,176 when they are refetched: **≈ 1,700 units a weekday, ≈ 105,000 units over the 63 full trading days since 14 Aug (ESTIMATE from the counter)**. The plan ceiling is 100,000 a day (`api/_utils/mandateConfig.js:104`), so this is under 2 % of one day's allowance. It is small, and it buys nothing. The fundamentals cache key is shared (`api/_utils/marketDataCache.js:618`), so some of those refetches also serve other features (INFERRED).

**Why the live acceptance wave never happened.** The acceptance report's live rows all wait on a ≥ 10-day run of six founder books (`docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:14-23`, procedure at `:77`). With no vintage and no book in production, Part C (creating the six books) never started, and Part D's batch window (Aug 24 to Sep 4, `:81`) passed unused.

### Q2. The open Mandate PRs

`gh pr list --state open` returns 10 open PRs. Three match mandate, substrate, season or portfolio in their title or branch: **#760, #761 and #762**, all opened 14 Aug 2026 (90 days ago). The other seven are unrelated: #1043, #1042, #1040, #980, #451 (one uploaded design file, `FANTASYTRADES_V1_ARCHETYPE_TRAIT_SYSTEM.md`), #427 and #422. The "about five PRs open for months" are really **seven merged Mandate PRs and three open one-line flag flips** (table in §3).

**On `main` (VERIFIED by merge commit).** Phase 1, schema, rules, indexes, vintage store, creation service and founder endpoint: #740 (`646f5c0f`). Phase 2, the evaluation pipeline: #745 (`625d4cbc`). Phase 3, close pass, friction, risk metrics, corporate actions and health: #750 (`8c1bdc4d`). Phase 4, rollover, escape hatch and quarter summaries: #752 (`07bd548a`). Phase 5, batch transport: #757 (`5103e834`). Phase 6 Part A, cron registration, runbook and acceptance report: #758 (`9948ec2a`). Flip PR #1, master, eval, close and founder-create: #759 (`2f554469`). Four cumulative reviews sit in `docs/audits/20260812_MANDATE_PHASE2_CUMULATIVE_REVIEW.md` through `20260813_MANDATE_PHASE5_CUMULATIVE_REVIEW.md`. The acceptance report says the machinery is "acceptance-green" in the harness, 160 tests with 0 failed, and that the live wave remains (`docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:25`). **Not on `main`:** the live wave (Parts C and D), the closing recommendations (Part F, `:101-108`), the rollover flip and the batch transport flip.

**Merge checks** were run read-only with `git merge-tree --write-tree origin/main <head>`. They are textual only; no tests were run. #760 and #762 are stacked on other branches, so GitHub's "MERGEABLE" for them is measured against those stale bases. The `main` result is in the table in §3.

### Q3. Parts a test portfolio could reuse

The baked assumptions were found by grepping every non-test use of each constant. Whether a part is "callable with a different book" means without editing the module.

| Part | What it does | Mandate assumptions baked in | Callable with a different book? |
|---|---|---|---|
| **Book and valuation** | `buildNewMandateDoc` builds the book (`api/_utils/mandateSchema.js:168-206`); `markBook` values it at the snapshot mark, then the last good mark, then cost (`api/_utils/mandateValuation.js`, pure) | $10M is a default parameter in the schema (`api/_utils/mandateSchema.js:73`) but hard-coded in creation (`api/_utils/mandateCreationService.js:84`) and the escape (`api/_utils/mandateEscape.js:151`); `quarterIndex: 1` and the quarter key (`api/_utils/mandateSchema.js:193-194`); **one active book per user** (`api/_utils/mandateCreationService.js:95-111`) | `markBook` and `buildNewMandateDoc`: yes. `createMandate`: no (fixed capital, one book per user, six-archetype check at `:50`, three-month boundary at `:67`) |
| **Execution and fill price** | `computeExecution` fills at mark ± friction (`api/_utils/mandateExecution.js:65-69`); entries need a fresh positive mark, exits fall back to the last good mark, then cost (`:222-236`); `executeDecision` is a revision-checked, exactly-once transaction on any book reference (`:435`) | None beyond the book shape; drift guard 150 bps under batch (`api/_utils/mandateConfig.js:141`) | Yes |
| **Which quote a fill uses** | The slot snapshot's EODHD real-time `close`, "the raw last price (no fallback)" (`api/_utils/mandateUniverseSnapshot.js:141-145`; request `api/_utils/tournamentPrices.js:64`); `priceAsOf` is the vendor's quote time (`api/_utils/mandateUniverseSnapshot.js:154-155`) | — | — |
| **How old it can be** | Entries check only that the price is present (`api/_utils/mandateUniverseSnapshot.js:593-596`, `api/_utils/mandateGate.js:111-114`); the 20-minute limit (`api/_utils/mandateConfig.js:97`) labels held stocks and never blocks an exit (`api/_utils/mandateGate.js:72-89`). The snapshot is built on the slot's first fire and reused by later fires in its 30-minute window (`api/cron/mandate-evaluate.js:284-286`), so a fill can use a quote up to about 30 minutes past its build, plus the vendor's own delay. Under batch transport a result may be 4 hours old (`api/_utils/mandateConfig.js:134`) | — | — |
| **Friction** | Market-cap tiers, 3–20 bps, labelled idealized (`api/_utils/mandateConfig.js:174-186`; `api/_utils/mandateFrictionModel.js`) | None | Yes |
| **Corporate actions** | Splits and dividends fetched in the daily layer (`api/_utils/mandateUniverseSnapshot.js:305-337`), applied before marking (`api/_utils/mandateCorporateActions.js:199`), overnight-gap classifier (`:321`) | None | Yes (pure functions) |
| **Calendar** | Trading days and session slots (`api/_utils/mandateSessionSlots.js:79-100`) | The three-month term is wired in (`api/_utils/mandateCalendar.js:154-159`, `api/_utils/mandateConfig.js:37`); slots are fixed (`api/_utils/mandateSessionSlots.js:41-52`); holidays are maintained for **2026 and 2027 only** (`src/utils/marketCalendar.js:69`), after which every slot fails closed (`api/_utils/mandateSessionSlots.js:84-85`) | Trading-day helpers: yes. Term: no |
| **Daily rows** | `closeBook` marks a book once a day at the official close and writes `dailyRows/{date}` (`api/_utils/mandateClosePass.js:155-175`; row shape `api/_utils/mandateSchema.js:228-262`) | Quarter lens in scoring (`api/_utils/mandateClosePass.js:435`); the cron's close sweep only reads `mandates` (`api/cron/mandate-evaluate.js:699-704`) | `closeBook` takes any document reference: yes, if the document has the book shape. The scheduled sweep: no |
| **Gate and sizing** | `evaluateGate`: exit lane first, then quarantine, universe, cash floor, sector cap and single-position weight (`api/_utils/mandateGate.js:59-140`) | Values frozen per archetype into the vintage: 2 % cash, 5–15 positions, 35 % single position, sector cap from the archetype (`api/_utils/mandateVintage.js:88-96`) | Yes: it takes any `gateConfig` object. **Bug found, §9.1:** the sector cap is copied in the wrong units |
| **Decision tool and model call** | One action per eval, with a required `rationale` of "2–5 sentences" (`api/_utils/mandateDecisionTool.js:24-68`, `:36`, `:61-65`); direct call `callMandateModelDirect` (`api/_utils/mandateModelCall.js:150`) | The prompt allows only six inputs (`api/_utils/mandatePromptAssembly.js:41-43`), speaks of "a virtual book of US equities" (`:68`) and "Day N of this quarter" (`api/_utils/mandateContextBlock.js:55`) | Tool and call: yes. Prompt: needs a test-aware variant |
| **Transport** | Direct (live) or batch, which halves the price (`api/_utils/mandateBatchTransport.js:162`, `:487`; discount `api/_utils/modelPriceTable.js:28`) | None | Yes; batch has never run in production (census) |
| **Accelerated clock** | Founder-only harness that backdates books to exercise rollover and escape (`api/_utils/mandateAcceleratedClock.js:64-181`; gate `api/mandate/accelerate.js:32-33`) | The whole lifecycle | Test tooling only |
| **Escape** | A once-ever replacement book within 14 days (`api/_utils/mandateEscape.js:48`; `api/_utils/mandateConfig.js:38`) | $10M, the quarter, one book per user | No; Mandate-specific |
| **Shared snapshot** | One price fetch per slot for all books, capped at 300 stocks (`api/_utils/mandateUniverseSnapshot.js:1-27`; `api/_utils/mandateConfig.js:78`) | The 136-stock list is the default argument (`api/_utils/mandateUniverseSnapshot.js:81`, `:357`, `:477`) | The builder takes `candidateUniverse` as a parameter; the cron does not pass one |

**Fenced-file contact (BUILD_RULES §1).** No Mandate module imports a fenced file (a `git grep` of every `api/_utils/mandate*.js`, `api/cron/mandate*.js` and `api/mandate/*.js` non-test file for the eleven fenced paths returns nothing). The vintage reads archetype physics through `archetypeRegistry.js`, which imports the fenced tables `agentArchetypeConfig.js` and `archetypeScoring.js` (`api/_utils/archetypeRegistry.js:48-57`). Reading is §1-permitted. A test portfolio built on these parts has no fence contact unless it must change what the battle agent does (Q7).

### Q4. Season Mode

**What exists.** About 40 files and 15,600 lines (sub-reader's `wc -l`, not re-counted):
- the four `api/season/*` endpoints;
- the two `api/cron/season-*` handlers;
- nine `api/_utils/season*` modules and four prompt modules;
- three screens plus `src/screens/PitStopScreen.jsx`, 14 `src/components/Season/*` components and the Forge's `SeasonModeToggle`.

`DeskSeasonRail.jsx` shares the name only; it is the League's weekly ladder rail.

**Scheduled? No.** No `vercel.json` entry names a season handler. The daily engine says so itself: "⚠ NOT SCHEDULED — THIS HANDLER DOES NOT RUN (as of Jul 25, 2026)." (`api/cron/season-daily-evaluate.js:9`). There is no season feature flag.

The four `api/season/*` endpoints still deploy (`.vercelignore` excludes only tests and `api/scripts/**`). They check sign-in and ownership only (`api/season/create-entry.js:331`, `:471`). The screens are still wired into `App.jsx`, imported at `src/App.jsx:107` and rendered at `:9793`. The only way in from outside is a mobile banner shown while an entry is active (`:12682`), fed by an unflagged query (`:3767`).

**Production (counts only).** 3 seasons and 4 entries, all `completed`, created 13 Apr to 7 May 2026. No entry is active, so the banner does not show.

**Its model.** $100,000 starting cash (`api/_utils/seasonConfig.js:8`), trades at the daily close (`api/_utils/seasonSettlement.js:9`), terms of 5, 10, 15 or 20 days (`api/season/create-entry.js:41`), no friction. It made Haiku, Sonnet (`api/_utils/seasonPrompts/pitStopDebrief.js:288`) and OpenRouter calls (`api/season/pit-stop-reply.js:3`), none of which runs now.

**Overlap with the Mandate.** No imports either way. The Mandate *forked* the season maths and fixed it: "forked from season math (I12 fork ledger)" (`api/_utils/mandateExecution.js:4`) and "FORKED from the season math" (`api/_utils/mandateRiskMetrics.js:4`). Two season defects show why the forks are the better base:
- TRIM can sell more shares than are held: `api/_utils/seasonSettlement.js:68` computes shares from dollars and `:87` subtracts them unclamped.
- The SPY anchor is never set at entry (`spyStartPrice: 0`, `api/season/create-entry.js:100`). Settlement then falls back to the first point of a price history (`api/_utils/seasonSettlement.js:320`), so its "alpha" is measured from an older SPY price than the term's start (INFERRED by the sub-reader from the 90-day history window).

**Worth reusing.** One piece, presentational only: **`SeasonPerformanceChart`** (`src/components/Season/SeasonPerformanceChart.jsx:167`). It already plots the book's return against SPY's (`:176-177`), which is the twin picture. Everything else is either superseded by the Mandate (book, settlement, metrics, calendar) or dead (the pit-stop stack and the crons). This repeats BUILD_RULES §6 ("Season mode is scrapped (founder ruling C-19)"). §6's census line "19 of 21 are registered" is stale: 28 handlers with 26 registered, per the sub-reader.

### Q5. The twin

**Same prices at the same moments: yes, by construction.** Market data is "fetched once per tick, platform-wide. No book fetches its own data" (`api/_utils/mandateUniverseSnapshot.js:4-5`). Every book evaluated in a slot reads the one snapshot document for that date and slot (`api/cron/mandate-evaluate.js:284-295`), and every book is marked at the close from one `${date}_close` snapshot (`:661-675`). Two books in the same slot reason and fill against identical marks.

**Same starting state: yes for a fresh pair, but the Mandate will not create the pair.** A new book is cash only: `initialValue` and cash are the starting capital, with no positions (`api/_utils/mandateSchema.js:73-78`). But:
- A user may hold only one active book (`api/_utils/mandateCreationService.js:95-111`), so a test book and its twin cannot both belong to the player.
- Cadence follows the archetype (`api/_utils/mandateGenerationConfig.js:47-54`). A twin of the same archetype shares the cadence; a different archetype would evaluate on other slots.
- A book created mid-session writes a `partial:true` row that day (`docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:68`), so a pair must be created together, ideally before the open.
- The Mandate's manager is a separate agent pinned to a frozen archetype vintage ("D-7: the mandate's MANAGER is a separate agent from the user's arena agents", `api/_utils/mandateGenerationConfig.js:11`). Its prompt has six allowed inputs (`api/_utils/mandatePromptAssembly.js:41-43`) and none of them is the player's equipped ideas, settings or learning. **"The agent as it is today" cannot be expressed as a Mandate book without new prompt inputs.**

**Benchmarks are already collected, at no extra cost.** SPY, QQQ, DIA, IWM, VOO, XLK and XLF are not in the Mandate's 136-stock list (checked at this HEAD). They are collected elsewhere:
- `compute-index-intelligence` writes `indexIntelligence/marketContext` with SPY, QQQ, DIA and IWM price and change (`api/cron/compute-index-intelligence.js:1216-1223`) and fetches the sector funds (`:88`, `:740`).
- `intraday-poll` is live (`INTRADAY_COLLECT_ENABLED = true`, `src/config/featureFlags.js:2640`; schedule `vercel.json:165-166`). Every 5 minutes (`api/_utils/intradayConfig.js:11`, `api/_utils/intraday/pollRunner.js:210-212`) it sweeps 244 symbols: SPY, QQQ, DIA, IWM, RSP, the 11 sector funds and 228 stocks (`api/_utils/intraday/universe.js:14-16`). The sweep lands in `intradaySnapshots/latest`, which is overwritten (`api/_utils/intraday/intradayStore.js:7`).

A benchmark twin needs one closing value per benchmark per day. Reading the index record costs 0 units; this audit did not check whether its last write of the day carries the official close. Adding SPY or a sector fund to the Mandate's close snapshot costs 1 unit per ticker per snapshot (quotes bill per ticker, `docs/audits/20260918_PHASE0_INTRADAY_ADDENDA.md:46`). Neither path keeps a dated benchmark series today.

**What "the gap to the twin" needs.** Each book already stores its daily total value (`api/_utils/mandateSchema.js:228-262`). Missing:
1. a link that pairs a test book with its twin;
2. a dated benchmark series scaled to the same starting money;
3. one shared start instant;
4. a gap figure computed from the same rounded values the player sees (BUILD_RULES §9).

### Q6. The five test subjects

**What all five share: the idea record.**
- A player's idea is versioned at `watchlists/{watchlistId}/hypothesisVersions/v{n}` (`api/_utils/hypothesisRecords/model.js:7`), and its stocks are the list's `tickers`.
- It carries a horizon (`['intraday', 'swing', 'positional', 'longterm', 'unspecified']`, `src/constants/hypothesisRecords.js:40`), counted in sessions as `{ intraday: 2, swing: 10, positional: 30, longterm: 60 }` (`:44`), and a review date (`api/_utils/hypothesisRecords/carriage.js:490`).
- **The one existing way to watch a list over a fixed window** is the idea review: "how the names of the list it rode in did against the market" (`api/_utils/hypothesisRecords/review.js:5`), against SPY (`:83`), within 11 requests (`:85`). It stores a start and an end, not a daily series.
- Ideas are on for allowlisted owners only (`src/config/featureFlags.js:3208`, `api/_utils/hypothesisRecords/gate.js:54`).

That record is the natural "test item": it already names stocks, a horizon length and a review against the market.

| Subject | What defines its stocks today | What lets a test watch it day by day | Missing |
|---|---|---|---|
| **Catalyst** (earnings, news) | No catalyst record. Nearest: the consensus doc's earnings lists, looking 5 days ahead (`api/_utils/fantasyTimesConsensus.js:68`); the daily brief's key events, which carry `tickers` (`api/_utils/dailyRegimeBriefPrompt.js:45`) but live in one doc overwritten daily (`api/cron/compute-daily-regime-brief.js:236`); a single stock's next earnings date on request (`api/_utils/marketDataCache.js:513`); the earnings calendar endpoint, up to 30 days (`api/stocks/earnings-calendar.js:16`) | The Wire's day doc indexed by symbol (`api/_utils/wireWriteThrough.js:264`, `:433`); writes on (`src/config/featureFlags.js:1571`); 30-day retention (`api/fantasytimes/cleanup.js:89`) | A stored forward earnings calendar; an event record tying a date to its stocks; news older than 30 days |
| **Single stock** | The symbol; the house universe is 228 stocks (`api/_utils/rankingConfig.js:15`) | Daily closes in `priceHistory`, 200 days (`api/cron/compute-rankings.js:197`, `:300`); daily metric rows (`api/_utils/metricSnapshots.js:127`, on at `src/config/featureFlags.js:2015`) | A daily series for stocks outside the 228 |
| **Sector** | `STOCK_UNIVERSE`: 11 sectors with their funds (`api/_utils/rankingConfig.js:18`). The Mandate keeps its own different list ("Health Care" at `api/_utils/mandateCandidateUniverse.js:49` against "Healthcare" at `api/_utils/rankingConfig.js:26`), and the browser keeps a third (sub-reader) | Members' closes in `priceHistory`; sector fund prices in `indexIntelligence` (Q5) | A stored daily sector return; one agreed sector list instead of three |
| **Industry** | A stock → industry map only (`api/_utils/rankingConfig.js:114`, `:462`); industry funds (`:389`). 54 industries across the 228 stocks, 11 with a single member (sub-reader, computed) | The single-stock stores | An industry → stocks list (invert the map); an industry series; enough members in many industries |
| **Theme** | `discoverThemes` docs with 5 names each, written only by a seed script (`scripts/seed-discover-themes.js:206`); the weekly cron only rotates which theme is featured (`api/cron/promote-discover-themes.js:90`); wider lists sit in bundled JSON (`dkb/thematic/ai-infrastructure-buildout.json:64`) | Only per-member stores, or an idea review once the theme becomes a list | Dated, versioned membership; a theme index; members outside the 228 (the sub-reader found several) |

**Research records** live in `researchWork` (`api/_utils/researchRecords/model.js:80`). They are a research trail, not a subject definition.

### Q7. The hand-offs

**Film Room → test.** A card lives at `agents/{agentId}/plays/{entryId}` (`api/_utils/filmRoom/cardStore.js:4`).

Routes and stages:
- It has three routes, `['watch', 'drill', 'set']` (`api/_utils/filmRoom/cardStore.js:61`), and the build writes three stages, `['card', 'nominated', 'retired']` (`api/_utils/filmRoom/cardStore.js:63`).
- The camp stages are absent on purpose: "`drilled → drafted → proven → installed` are not here" (`api/_utils/filmRoom/cardStore.js:62`). The contract's full chain is `card → nominated → drilled → drafted → proven → installed → retired` (`docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:86`).
- The stage is fixed at creation: Drill gives `nominated`, every other route gives `card` (`api/_utils/filmRoom/cardStore.js:168`). The only later move is retire (`:312`). The endpoint accepts nothing else: "op must be create or retire." (`api/film-room/card.js:77`).
- Clients cannot write cards (`firestore.rules:464`).
- The contract's drill record, `agents/{agentId}/drills/{drillId}` (`docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:95`), was not found in code or rules.

**Where "send to test" attaches.** A Drill card is already "nominated for the Practice Field" (`src/screens/filmRoomV2/filmRoomCopy.js:372`). Its copy promises "The Practice Field opens later; this keeps the moment for it." (`:321`). The natural attach point is therefore the `nominated` card, keyed by its entry id. The test's result writes the reserved `drilled` stage through a new card op with the same version check as retire.

A Watch or Set card cannot be sent without a new op, because its stage is fixed at creation. The screen's reserved footer (`src/screens/filmRoomV2/filmRoomCopy.js:295`) renders empty only when cards are off (`src/screens/filmRoomV2/FilmRoomScreenV2.jsx:408`). When cards are on, Your Call and the Receipt fill it, so there is no empty slot left; the Receipt's next-step line is the place. Cards are on for an allowlist only (`src/config/featureFlags.js:3526`).

**Test → Forge.** The contract already rules that "a play installs only through existing equip endpoints (a lean, a rule setting, a dial) and takes effect at the next battle's creation" (`docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:109`). Every writer below is non-fenced. Each changes behaviour only through a fenced reader, the battle snapshot, the deploy or the prompt, so applying a result through them is **not** fence contact; changing what those readers do with it would be.

| What changes | Writer (non-fenced) | Field | How it reaches the battle (fenced reader) |
|---|---|---|---|
| A list (League) | `api/agent/equip-watchlist.js:219` | `equippedWatchlistId` | `api/agent/decide.js:390` builds the equipped snapshot |
| An idea (hypothesis) | `api/forge/watchlists/[id]/hypothesis-versions.js` line 80 → `api/_utils/hypothesisRecords/store.js:188` | `watchlists/{id}/hypothesisVersions` | carried into the battle at `api/agent/decide.js:973`. The sub-reader found it in neither prompt assembler, so it is provenance only (INFERRED) |
| Rule bundles | `api/agent/equip-bundle.js:229` | `equippedBundleIds`, `activeRules` | `api/_utils/agentBattleService.js:196` → `api/_utils/agentEvalPromptAssembly.js:1251` |
| Leans | `api/agent/equip-lean.js:230` | `standingLeans` | `api/_utils/agentBattleService.js:239` → `api/_utils/agentEvalPromptAssembly.js:1241` |
| Tempo dial | `api/agent/set-tempo-dial.js:149` | `dials.tempo` | the battle snapshot (`api/_utils/agentBattleService.js:239`) |
| Guardrails and traits | `api/agent/update-agent-settings.js:206` | `deployedStrategy`, `equippedTraits` | `applyGuardrails` in the fenced `agentGuardrails.js` |
| Archetype | `api/agent/change-archetype.js:351` | `archetype` | the archetype config read at battle time |
| Compiled builds | `api/_utils/compileOnSettingsChange.js:438` | `compiledBuilds/{mode}` | dark: `COMPILER_ENABLED = false` (`src/config/featureFlags.js:1437`) |
| Today's instruction (one battle) | Huddle `api/_utils/huddle/applyPlan.js:104` and the directive endpoints | `battle.directive` | `api/_utils/agentEvalPromptAssembly.js:1240`; Huddle is off on `main` (`src/config/huddleFlags.js:38`) |

For the "new rule version" in the founder's step 5, no player-facing writer was found. Both versions are code constants: `RULE_LIBRARY_VERSION = 1` (`api/_utils/archetypeVersionConstants.js:27`) and `ARCHETYPE_IDENTITY_VERSION = 2` (`:58`). Archetype physics live in the fenced `agentArchetypeConfig.js` (BUILD_RULES §1), so a rule-version result is a code change under the fence, never a player action.

**History as a day-one backstory.**
- **The Trend Follower evaluator** is pure: "a function of the evidence it is handed and the frozen threshold" (`api/_utils/setupEvaluator/tfSetupV1.js:10`). It offers `evaluateTfEntry` (`:360`) and `evaluateTfHolding` (`:389`), with thresholds at `api/_utils/setupEvaluator/thresholds.js:31` and a minimum of 55 completed bars (`:84`). It reads daily bars through one EODHD request per symbol (`api/_utils/setupEvidence/acquire.js:95`) and makes no model call.
- **The offline runner** (`scripts/experiments/agent-workspace/experiment.mjs`) compares the baseline admission policy against two hard-coded candidates (`:9`). It reports no outcomes (`:96`) and records zero model, market and database requests (`:106`).
- **The nearest true replay** is `scripts/experiments/tf-setup-corpus-replay.mjs`: no model calls and no Firestore (`:6`), capped at 60 requests (`:85`).

Before a test starts, for a list of stocks, these can say:
- each stock's Trend Follower entry verdict as of the last session (valid, invalid or unknown, and which evidence is missing);
- its holding-leg breaks;
- how a candidate admission rule changes what would have been admitted.

They cannot give a return or a profit figure, and they cover only the Trend Follower.

### Q8. The agent's running notes

**Which existing call could write a short daily note.**

| Call | Model, limit | What it writes today | Cost per note |
|---|---|---|---|
| **Mandate eval** | Haiku 4.5, 600 out (`api/_utils/mandateGenerationConfig.js:25-34`) | A required `rationale` of "2–5 sentences" on every eval (`api/_utils/mandateDecisionTool.js:36`, `:61-65`). **It is thrown away:** it is read at `:115`, and the decision record has no field for it (`api/_utils/mandateSchema.js:271-301`) | **$0 extra**: it comes with the eval ($0.015 direct, $0.0075 batched) |
| **End-of-day batch review** | Haiku 4.5, 1,024 out (`api/cron/agent-batch-review.js:316-317`) | "daily film-room reviews … around the 4:00 PM ET close" (`:3`), a "3-4 sentence summary of the day" (`:109`), stored on the battle (`:360`), plus a lesson on the agent (`:477`) | Not stated in the repo. The nearest existing daily-note shape |
| **Reflection** | Sonnet 4.6, 4,096 out (`api/_utils/reflectionOutcome.js:20`, `:26`) | One per finished battle, not per day | $0.017–$0.028 (`docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md:80`) |
| **Huddle script** | Sonnet 5.5, 8,000 out (`api/_utils/huddle/scriptPrompt.js:26`, `:28`) | One morning script per player | Not found. Sonnet 5.5 is missing from the price table (`api/_utils/modelPriceTable.js:32-36`), which today holds only Haiku 4.5 |
| Research records | not a model call of their own: "One record per research run" (`api/_utils/researchRecords/model.js:7`) | — | — |

**Recommendation.** For a model-managed book, the note is the eval's own rationale, stored instead of discarded: one field on a non-fenced record, no new call. For a rule-managed book, a batch-review-shaped Haiku call once a day (≈ $0.0045, ASSUMED size, Q9).

**Could the note reach a battle prompt?**
- **(i) A note in its own record: no.** The evaluation prompt is assembled from arguments the cron passes (`api/cron/agent-evaluate.js:3153-3156`) and from the battle's frozen context (`api/_utils/agentEvalPromptAssembly.js:746`). Making a new record reach it is fence contact, or the DR-13 flag-split with its registry entry in the same commit (`docs/BUILD_RULES.md:30`).
- **(ii) A note in the agent's memory: yes**, and it would cost a lesson.
  - The deploy prompt prints "RECENT GAME MEMORY" (`api/_utils/agentPromptAssembly.js:95-96`).
  - Memory keeps five entries (`api/agent/reflect.js:521`).
  - Consolidation reads memory (`api/_utils/agentConsolidationPrompt.js:216`) into the consolidated insight. Each new battle copies that insight (`api/_utils/agentBattleService.js:242`) and the evaluation prints it (`api/_utils/agentEvalPromptAssembly.js:774`).
- **(iii) A note in a research record: no route found.**
- **The instruction slot is closed to model text** by rule: "No model string ever reaches the battle's instruction slot" (`api/_utils/huddle/planTemplates.js:6`).

**Default.** Test notes in their own record reach no battle prompt. Only the Forge hand-off (Q7) changes what the agent does.

### Q9. Cost at scale

**Price inputs (VERIFIED).**
- Haiku 4.5 costs $1 per million input tokens and $5 per million output tokens (`api/_utils/modelPriceTable.js:34`); batch halves it (`:28`).
- The Mandate's reference size is about 12,000 tokens in and 600 out per eval, "~$0.0075/eval batched" (`docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:372`). Direct, that is **$0.015 per eval**.
- Evals per book per day: slow 1, standard 2, fast 3 (`api/_utils/mandateSessionSlots.js:48-52`).
- A separate daily note, if one is wanted, is ASSUMED here at about 3,000 tokens in and 300 out on Haiku: about $0.0045. The eval's `rationale` already exists at no extra cost (Q8).

| Shape (per test, per trading day) | Model spend (direct; batch halves) | EODHD units |
|---|---|---|
| **(a)** model-managed test book + model-managed twin | 2 books × 1–3 evals × $0.015 = **$0.03–$0.09** (standard: $0.06) | **0 extra** while the test's stocks sit inside the shared snapshot; otherwise per stock outside it about 4 quote units, 2 splits/dividends units and 10 for a fundamentals refetch, ≈ 6–16 a day |
| **(b)** model-managed test book + benchmark twin | 1 book × 1–3 evals × $0.015 = **$0.015–$0.045** (standard: $0.03) | the same, plus **0** for the benchmark (index record) or 1 per benchmark per snapshot |
| **(c)** rule-managed book + one daily note | **≈ $0.0045** (the note only; ASSUMED size) | the same as (a) |

A month is about 21 trading days. Shape (a) at standard cadence costs about $1.26 per test per month direct, or $0.63 batched; (b) costs about half that; (c) about $0.09. The Mandate's own alert threshold is $1.00 per book per month (`api/_utils/mandateConfig.js:292`). It is **only an alert**: a log line at the close (`api/_utils/mandateClosePass.js:575-577`), not a stop.

**How it grows with players.**
- **Model spend** is linear in running tests: players × tests per player × evals per day.
- **Market data** stays flat while every test's stocks fit inside one shared snapshot, which is capped at 300 symbols (`api/_utils/mandateConfig.js:78`); held stocks always join it (`api/_utils/mandateUniverseSnapshot.js:68-110`). It grows only when subjects bring stocks from outside it.
- **Firestore writes** are linear: one daily row per book per day and one decision per eval.
- **Sweep capacity is a hard limit, independent of cost.** Each fire evaluates one page of 25 books (`api/_utils/mandateConfig.js:117`, `api/cron/mandate-evaluate.js:362-367`). A 30-minute slot window catches two 15-minute fires (`api/_utils/mandateSessionSlots.js:39`, `vercel.json:198`), so **at most about 50 books are evaluated per slot**. The 105-minute close window catches 7 fires, so **at most about 175 books are closed per day** (`api/_utils/mandateConfig.js:215-216`). With a model twin per test, about 25 concurrent tests fill the eval slots. Beyond that, books silently miss slots (the sweep rotates fairly, `api/cron/mandate-evaluate.js:344-361`), and beyond 175 books daily rows go missing.

**Caps, limits and the cron budget.** The cron budget is **45 of 100** entries (BUILD_RULES §6; `vercel.json` has 45 `crons` entries, counted at this HEAD). A test portfolio fits inside the existing `mandate-evaluate` handler; it needs no new entry.

**Model spend caps.** No per-user cap was found. The Mandate's $1 band is an alert (above). The only hard stop is the Anthropic account's own monthly limit, which the reflection path names as a possible failure, "'enforced_spend_limit_reached'" (`api/_utils/reflectionOutcome.js:73`).

**Rate limits.** An in-memory limiter per serverless instance (`api/_utils/rateLimit.js:2`), 60 requests a minute by default (`api/_utils/security.js:203`). It guards request floods, not spend.

**Premium or entitlement.** **None exists.** The sub-reader found no payment library and no `isPro`, plan-tier or subscription field. Limits that exist today are not tied to payment:
- one active Mandate book per user (`api/_utils/mandateCreationService.js:95-111`);
- one active battle per agent (`api/agent/decide.js:800`);
- five open Film Room cards per agent (`src/data/cardSlots.js:24`);
- a lean cap by level (`api/agent/equip-lean.js:142`), built but dark (`MASTERY_ENFORCEMENT_ENABLED = false`, `api/_utils/masteryConfig.js:108`).

"One test at a time, more for premium" would follow the lean cap's shape: a per-player limit read from one function, with the paid source added later.

### Q10. Where it would live

- **Routes.** There is no router: `App.jsx` holds one `screen` state (`src/App.jsx:2234`) and renders screen by screen. The Film Room is `screen === 'filmRoom'` (`:9718`). The Forge is a separate `showForge` state (`:8839`).
- **The Practice Field has no screen.** It exists only as Film Room copy (`src/screens/filmRoomV2/filmRoomCopy.js:321`, `:372`).
- **Command Center hub.** Panels are not registered. There are three fixed areas, Partnership, Research and Archetype (`src/components/CommandCenter/hub/composition.js:62`). Partnership is the reserved one ("Partnership isn't part of this release.", `src/components/CommandCenter/hub/hubCopy.js:132`) and Huddle takes it over when Huddle is on. A test card in the hub therefore means either a fourth area, which is a hub-spec change, or a place inside the Archetype area.
- **Film Room footer.** Reserved for "your-call" and "receipt" (`src/screens/filmRoomV2/filmRoomCopy.js:295`), and filled by the cards when they are on (Q7). The "send to test" entry belongs on the Receipt of a nominated card.
- **The Forge** is where a result is applied, through the equip endpoints of Q7. The result shows there as an offer, never as an automatic equip.
- **The flag pattern a new dark surface should follow is Huddle S1's.**
  1. A flag module of its own (`src/config/huddleFlags.js:5`, value `:38`), registered as a flag source (`src/config/flagPinGuard.test.js:54`) and dark by design (`:318`).
  2. One server gate (`api/_utils/huddle/gate.js:11`), with routes answering 404 before auth (`api/_utils/huddle/routeKit.js:21`).
  3. A client guard on the literal.
  4. Any prompt-contributing text registered (`api/_utils/__fixtures__/promptHonestyRegistry.js:60`).

  For a founder-only first stage, add a server-only uid list on the `COCKPIT_ALLOWLIST_UIDS` model ("SERVER ONLY. No module under src/ may import this file", `api/_utils/callRecords/allowlist.js:23`), exposed to the client through a status route.

## 3. Open PR table (Q2)

All three were opened 14 Aug 2026, 90 days before this audit. Heads were resolved with `gh pr view` and merge-checked against `origin/main` with `git merge-tree --write-tree`: a textual check only, no tests run.

| PR | Title (short) | Branch → base | Files, lines | Merges with `main`? | What it adds | Recommendation |
|---|---|---|---|---|---|---|
| **#760** | Flip PR #2: light the rollover sweep | `claude/mandate-flip2-rollover-live` → `claude/mandate-flip1-substrate-live` (merged as #759); head `84da3ff2`, 2,094 commits behind `main` | 4 files, +26 −18 | **No.** Conflict in `src/config/flagPinGuard.test.js` (GitHub's "MERGEABLE" is measured against the stale base) | `MANDATE_ROLLOVER_ENABLED` false → true, with its pins | **Close.** There are no books to roll over; if the Mandate is revived, re-cut it from `main` |
| **#761** | Config PR-D: transport → `'batch'` | `claude/mandate-config-transport-batch` → `main`; head `f3133acd`, base at the #757 merge, 2,095 commits behind | 3 files, +10 −7 | Yes, textually | `MANDATE_TRANSPORT_MODE` `'direct'` → `'batch'` for the acceptance batch window | **Close.** Its window (Aug 24 to Sep 4) has passed with no books; batch is a one-line change on a fresh branch when needed |
| **#762** | PR-D-revert: transport back to `'direct'` | `claude/mandate-config-transport-revert` → `claude/mandate-config-transport-batch`; head `486fde93` | 2 files, +3 −3 (stacked; against `main` it changes two test files only, +8 −5) | Yes, textually (cumulative) | The standby rollback for #761 | **Close** with #761 |

None of the three holds parts worth keeping: each is a flag flip and its pins.

## 4. Reuse table: one row per loop piece

| Loop piece | Status | Anchor | What is missing |
|---|---|---|---|
| **Item from the Film Room** | Partly exists | A Drill card is created as `nominated` (`api/_utils/filmRoom/cardStore.js:168`); the camp stages are reserved and unbuilt (`:62`) | A "send to test" op (only create and retire exist, `api/film-room/card.js:77`); the `drilled` write-back. **0 cards exist in production**, and cards are allowlist-only |
| **Test subject** | Partly exists | The idea record: list, horizon and review against SPY (`api/_utils/hypothesisRecords/model.js:7`, `src/constants/hypothesisRecords.js:40-44`, `api/_utils/hypothesisRecords/review.js:83`); sector and industry maps (`api/_utils/rankingConfig.js:18`, `:114`); seeded themes | A catalyst record; industry → stocks lists; versioned theme membership; one sector list |
| **Test portfolio** | Partly exists, the largest piece | The Mandate's book, execution, friction, corporate actions, daily close and rows, all on `main` and lit (Q3) | Test-shaped creation (subject universe, chosen length, starting money, more than one book per player); a test-aware prompt; the sweep's ~50-books-per-slot ceiling (Q9) |
| **Twin** | Partly exists | One shared snapshot per slot, so identical prices (`api/cron/mandate-evaluate.js:284-295`); benchmark prices already collected (`api/cron/compute-index-intelligence.js:1216-1223`) | The pair link; creating two books for one player; a dated benchmark series; "the agent as it is today" as a manager (Q5) |
| **Paper money** | Exists | Cash, positions and marks (`api/_utils/mandateSchema.js:73-78`, `api/_utils/mandateValuation.js`) | A test-sized starting amount: a parameter, not code (`api/_utils/mandateSchema.js:73`) |
| **Running notes** | Partly exists | The eval's required rationale (`api/_utils/mandateDecisionTool.js:61-65`); the batch-review day summary (`api/cron/agent-batch-review.js:109`) | Storing the rationale (it is discarded, `api/_utils/mandateSchema.js:271-301`); a note record and its screen |
| **History backstory** | Partly exists | The Trend Follower evaluator and corpus replay (`api/_utils/setupEvaluator/tfSetupV1.js:10`, `scripts/experiments/tf-setup-corpus-replay.mjs:6`) | Other archetypes; any return figure |
| **Result** | Partly exists | Risk metrics and the composite (`api/_utils/mandateRiskMetrics.js:242`); the idea review's start and end against SPY (`api/_utils/hypothesisRecords/review.js:5`) | A headline measure and length declared before the start, and a verdict record that compares the test to its twin |
| **Hand-off to the Forge** | Exists as endpoints | The equip writers (Q7); the contract's install rule (`docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:109`) | A result → equip offer and the `installed` stage. A new rule version is fence work, not a player action |
| **Premium limit** | Missing | No entitlement system. Patterns: one book per user (`api/_utils/mandateCreationService.js:95-111`), the dark lean cap (`api/_utils/masteryConfig.js:108`) | A per-player test limit and its future paid source |

## 5. Founder decisions this audit surfaced

1. **Pause the Mandate's daily data buying until a book exists, or keep it running.** Nothing changes for players. Pausing saves about 1,700 EODHD units a weekday; it is a flag-flip PR that reconciles its pins.
2. **Close PRs #760, #761 and #762.** Nothing changes for players.
3. **Build the test portfolio on the Mandate engine, not Season Mode.** Tests get the Mandate's honest fills, friction and daily close, which already fixed Season Mode's defects.
4. **Who manages the test: the model, or rules?** With the model, the player watches an agent reason each slot, at about $0.015 an eval. With rules, the player watches mechanical picks plus one note a day.
5. **The default twin: a benchmark (the market or a sector fund) or "the agent as it is today".** A benchmark is cheaper and ready now. The agent twin needs the player's equipped setup turned into new manager prompt inputs.
6. **Starting paper money for a test**, e.g. $100,000 against the Mandate's $10M. The player sees these numbers on every row.
7. **Must a test's stocks sit inside the shared price list (the Mandate's 136, or the house 228)?** This decides which stocks a player can test, and whether market-data cost stays flat.
8. **Show the agent's own words as the running note**, which means storing the eval rationale. The player reads model-written text daily, so it needs Shadow's voice rules and honesty labels.
9. **Test notes never reach a battle prompt; only the Forge changes the agent.** The player knows a running test cannot quietly change their agent.
10. **Which Film Room cards can be sent to test: Drill cards only, or Watch and Set too?** This decides which button the player sees on a card.
11. **The Forge receives a result as an offer the player confirms, never an automatic equip.** The player stays in charge of the archetype.
12. **Test lengths offered:** the idea record's 2, 10, 30 or 60 sessions, or the founder's own. The calendar runs out at the end of 2027 and must be extended before any test crosses it.
13. **"One test at a time" is per player or per archetype, and premium waits for an entitlement system that does not exist.** This decides how many tests a player can run.
14. **Fix the Mandate's sector-cap unit bug (§9.1) before any book trades.** Without the fix, test books could pile into one sector.

## 6. Proposed build packages, smallest watchable test portfolio first

| # | Package | Size | Fenced-file contact | Depends on |
|---|---|---|---|---|
| **P0** | **Housekeeping.** Fix the sector-cap units in `mandateVintage.js` (§9.1). Add the eval `rationale` (and `conviction`) to the decision record (`api/_utils/mandateSchema.js:271-301`). Optionally skip the snapshot build while no active book exists (decision 1) | Small: 2–3 non-fenced files plus tests | None. The vintage reads the fenced tables through the registry (read-permitted) | Decisions 1 and 14 |
| **P1** | **Founder-only benchmark test, the smallest watchable one.** One test book per founder in `mandates`, with a `kind` marker. A creation path that does not claim the one-Mandate-book slot, takes starting money and a length in sessions, and limits the candidate slate to the subject's stocks inside the shared snapshot. The existing `mandate-evaluate` sweep then evaluates and closes it unchanged. A daily benchmark row (SPY or a sector fund) written at the close. A read-only founder screen showing the book, today's rationale and the gap to the benchmark, behind its own flag module and a server-only uid list (Q10) | Medium: about 8–12 files, likely past the BUILD_RULES §2 review threshold | None | P0; decisions 3–7 |
| **P2** | **Film Room → test.** A "send to test" op on `nominated` cards (`api/film-room/card.js`, `api/_utils/filmRoom/cardStore.js`), the test keyed on the card's entry id, and the reserved `drilled` stage written back when the test finishes | Small to medium | None | P1; decision 10; cards on for the player |
| **P3** | **The result and the Forge offer.** A headline measure and length declared at start, a verdict record against the twin, and an "apply to the archetype" offer through the existing equip endpoints (Q7), with the `installed` stage | Medium | None while it uses existing endpoints. A rule-version result is fence work, out of scope | P1; decisions 9 and 11 |
| **P4** | **The agent twin.** A second book whose manager prompt carries the player's equipped list, leans and rules as new Mandate prompt inputs (`api/_utils/mandatePromptAssembly.js:41-43` is the allowlist to extend) | Medium | None: the Mandate assembler is not fenced. It reads the same equipped fields the battle does, never the battle prompt | P1; decision 5 |
| **P5** | **Scale and limits.** A multi-page sweep or batch transport past about 50 books a slot (Q9); a per-player test limit (decision 13); extend the holiday calendar past 2027 | Medium | None (`mandate-evaluate.js` is non-fenced) | Player numbers |
| **P6** | **Subject records.** A catalyst record with dates and stocks, industry → stocks lists, versioned theme membership, one sector list (Q6) | Medium each | None | Decision 7 |

## 7. Not found

- A Mandate book, vintage, batch or cost-telemetry record in production (census, Q1).
- Any open PR beyond #760–#762 whose title or branch names mandate, substrate, season or portfolio.
- Storage of the Mandate eval's `rationale`.
- A pair or twin link in the Mandate or Season Mode; a dated benchmark series.
- A catalyst or event record; a stored forward earnings calendar; an industry → stocks list; versioned theme membership.
- A Practice Field screen; the contract's `agents/{agentId}/drills` collection.
- **Any Film Room card in production: `plays` holds 0 documents.**
- A premium, entitlement or payment mechanism; a per-user model spend cap.
- A Sonnet 5.5 price in `api/_utils/modelPriceTable.js`; a cost figure for the end-of-day batch review or the Huddle script.
- A player-facing writer of a rule-library or archetype version.

## 8. How the citations were checked

Every backticked `path:line` in this report was printed from this HEAD by a script before commit. The script fails on a missing file or a line past the end. Each printed line was read against its claim. The sub-readers' anchors were re-read in this session (Q4, Q6, Q7, Q8, Q10) before use. Counts marked "sub-reader" (Season Mode's line totals, the 54 industries, the theme names outside the 228) were not re-counted. Firestore figures come from two read-only census scripts in the session scratchpad, each gated on an empty write-call grep. Their outputs, which hold no ids, stay outside the repo.

## 9. Found outside the task (reported, not fixed; BUILD_RULES §3)

1. **The Mandate's sector cap is copied in the wrong units, so it never binds.**
   - Each archetype's `sectorConcentrationCap` is a *count* of picks: 2, 3 or 4 of 6. The battle guardrail divides it by the six picks (`api/_utils/agentGuardrails.js:102`).
   - The Mandate vintage copies the raw count (`api/_utils/mandateVintage.js:88`), and the gate compares it as a *fraction* of the book (`api/_utils/mandateSectorCap.js:51`, `:66-67`). A cap of 3 therefore allows 300 %.
   - The manager's prompt would print "Sector concentration cap: 300.0%" (`api/_utils/mandatePromptAssembly.js:55-57`, `:85`).
   - The gate tests use 0.30 (`api/_utils/mandateGate.test.js:15`), and the vintage test only asserts the pass-through (`api/_utils/mandateVintage.test.js:76-77`), so nothing catches it. No book exists, so it has not mattered yet.
2. **The Mandate flag docstrings still call false the default**, e.g. "When FALSE (DEFAULT, merge-dark) nothing mandate-related runs" (`src/config/featureFlags.js:1924`), while the values are true. BUILD_RULES §2 asks the flip commit to fix such docstrings.
3. **BUILD_RULES §6's cron census is stale.** It says "19 of 21 are registered" (`docs/BUILD_RULES.md:82`); at this HEAD there are 28 `api/cron` handlers and 26 are registered (counted against `vercel.json`). The two unregistered handlers are still the season ones.
4. **Season Mode's endpoints still deploy and accept any signed-in owner** (`api/season/create-entry.js:331`, `:471`). Only the unscheduled cron completes an entry (`api/cron/season-daily-evaluate.js:564`), so a new entry would stay active, and its mobile banner showing, indefinitely (INFERRED). None is active today.
5. **A stale comment.** `api/_utils/setupEvidence/index.js:6` says "NOTHING CALLS IT in this build", but the activation observer (`api/_utils/activationEvidence/tenant.js:49`) and the setup-menu tenant (`api/_utils/setupMenuLabels/tenant.js:48`) import it.
