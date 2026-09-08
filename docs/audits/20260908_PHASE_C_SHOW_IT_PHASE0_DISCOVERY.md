# Phase C — Show it, the research path: Phase 0 discovery (V1)

**Date:** September 8, 2026
**Seed:** `PHASE_C_SHOW_IT_PHASE0_SEED_V1.md` (Flash, with Fable; founder upload — not in the repo at HEAD).
**Branch:** `claude/phase-c-discovery-audit-xmiltc` (harness-assigned). **Base:** `origin/main` @ `4a8ae54a5f0d89915dbe15cee63d4b506e36bd7f`. **This report is the branch's first and only commit — docs-only.**
**Mode:** read-only. `file:line` throughout; every anchor VERIFIED at HEAD `4a8ae54a` unless marked ASSUMED. NOT FOUND is an answer. No code changed. Hard STOP after §10.
**Reads:** BUILD_RULES §1–§11 (binding) · `docs/audits/PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` Q9 + hazard 8 · `docs/audits/20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md` §E (E12–E14), §3 hazards · `docs/audits/20260907_VOICE_GROUNDING_BUILD_PHASE0_REPORT.md` items 7, 9, §3 · `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_3.md` §1, §3, §6, §9, §11, App. D · the ledger `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` D-31, D-43, D-44, D-52, D-54, D-100–D-109.

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

| Check | Result |
|---|---|
| `git fetch origin` | **Run first.** Pulled new refs `ops/step-minus-1-cron-quiesce`, `smoke/character-pane`, `ui-redesign`, `ui-redesign-backup`, tag `backup-with-research`. |
| Branch | `claude/phase-c-discovery-audit-xmiltc` — the harness branch. `origin/claude/phase-c-discovery-audit-xmiltc` exists at the same SHA as `origin/main`, so this report is its first commit. (`origin/claude/review-phase-c-docs-W4H3y` is an unrelated 2025 Intel-Codex branch that happens to say "Phase C"; not read.) |
| HEAD | `4a8ae54a` = `origin/main` (0 ahead / 0 behind). Top: `#825 grounded-deploy-opener`, `dfec828d docs: spec V1.3 committed; ledger rows D-106 → D-109`. |
| Working tree | Clean before the report was written. |
| Environment | No `node_modules`; `GCS_CREDENTIALS`, `EODHD_API_KEY`, `OPENROUTER_API_KEY`, `CLAUDE_API_KEY`, `FIREBASE_*` all unset. Nothing external was called; no Firestore, GCS, EODHD, OpenRouter or Anthropic figure below is measured. |
| Measurements | Two scratchpad scripts (outside the repo): the pure `api/_utils/technicalCalculations.js` was executed over synthetic candles; the cache-brief and fundamentals-mirror sizes were measured from JSON literals built to the exact key lists at `voice-layer-cache.js:219-258` / `:436-475` and `compute-index-intelligence.js:544-585` (the builders themselves import `firebase-admin`, absent here). Values in those literals are ASSUMED; key sets are VERIFIED. |
| Report copy | Written first to the session scratchpad, then copied byte-identical to `docs/audits/20260908_PHASE_C_SHOW_IT_PHASE0_DISCOVERY.md`. |

**Fence statement.** No fenced file edited. Fenced files read to cite only: `api/_utils/agentScoring.js:36-69`, `api/_utils/agentBattleService.js:155-165, :198-199, :262-263`, `api/agent/decide.js:1174`, `api/_utils/agentArchetypeConfig.js` (import site only).

---

## 1. Executive verdict

| # | Item | Verdict | In one sentence |
|---|---|---|---|
| 1 | `debate.js` inputs/outputs; widening to the universe | **FOUND · CONSTRAINED** | A 15 s Haiku route that answers only about the seven book names (`flattenPortfolioServer`, 404 otherwise); widening is one guard plus four position-dependent lines, the fetch and indicators need nothing — but its MACD and SMA50 are **structurally null** on the 30-calendar-day window it fetches, so "MACD histogram: negative" is a placeholder today (hazard 1). |
| 2 | The honesty of its prompt | **FOUND — breaches** | Eleven lines invite advocacy, a stance, a conviction score or a recommendation (`suggestedAction: "hold" \| "consider_exit"`); every one would breach R1 / the GROUNDED rules if voiced; the list to forbid is §2.A2. |
| 3 | The user-facing screener | **FOUND** | One endpoint, `POST /api/screener/chat` (Gemma → `screenSpec` → the deterministic util over the daily `stockRankings` doc); per-symbol fields are the rankings entry's scores/ranks/returns; vintage is the doc's `computedAt`/`updatedAt`/`mode`; "ranked by composite score" is the same `compositeScore` the util falls back to. |
| 4 | Overlap with the fundamentals mirror | **FOUND — the screener call is unnecessary** | The mirror (P/E vs sector, P/B, growth, cap class, EPS revisions, beat rate, surprise percentile, `computedAt`) already rides the cache brief for book + bench under `'shadow'`; every other screenable field sits on the same `stockRankings` entry — one map hit, no Gemma, no spec. |
| 5 | `api/screener/chat.js` | **FOUND — ancestor, not reusable** | Its honesty discipline (neutral voice, past-tense returns, name the gap, no buy/sell) is the research prompt's ancestor; its shape (a universe filter with its own session store, no symbol, no battle) is a competitor; as-is it cannot answer "show me MPC". |
| 6 | `research_only` at HEAD | **FOUND** | A model-emitted label the gate turns into a deliberate null after the call; nothing branches before the model; no server-side symbol detector exists; a chip is the only model-free trigger. |
| 7 | An `ask` chip with a `research` kind | **CONSTRAINED — addable** | A third kind is dropped today at four points (server normalizer, two client labels, two tap handlers); each is a small edit, and the symbol must be server-validated like a directive id. |
| 8 | The pane's entry points | **FOUND (doors) · NOT FOUND (what it opens)** | Three doors exist on a piece's Why? panel and none on a Bench chip (a `<span>`); no research card, no message type, no panel exists for Show it to open. |
| 9 | The research endpoint, in order | **FOUND** | Auth → owner → agent-belongs → universe → cap (one transaction) → technicals (cache 5 min/4 h + an uncached real-time price) → fundamentals (cache brief or the rankings read) → compose in code → optional narration; Gemma p50/p95 **NOT MEASURED** (the reader script now exists; no credentials here). |
| 10 | The cap | **FOUND — two shapes** | Research-as-a-message charges the existing budgets in the `file-directive` transaction pattern but cannot say "1 of 3"; an own counter is either fence contact (a battle-doc key), an own collection (server-only, needs a GET), or a count of research exchanges in `chatExchanges[]` (no new key, client-derivable). Founder's ruling. |
| 11 | Pre-computation on the cache doc | **FOUND — cheap; the seed's budget NOT FOUND** | ≈1.0 KB per name × ≤31 names ≈ 32 KB, ~3 % of Firestore's 1 MiB; the "Phase B discovery §3 doc-size budget" does not exist in `docs/`; the in-repo line is 60 % of 1 MiB; the cache covers book + bench only today. |
| 12 | Provenance labels | **FOUND / NOT FOUND** | The fundamentals carry `computedAt` and a renderer; the technicals' quote time, candle date and `calculatedAt` all exist in the data and are rendered by nothing; the archetype lens has no field at all. |
| 13 | The narrator's voicing | **FOUND · NOT FOUND (lint)** | The grounded rules live in `GROUNDED_SHARED_RULES`; the reply lint is applied in code only to the anticipation clause and to no chat reply — a research reply has nothing to pass through today. |
| 14 | C1 status and labelling | **FOUND (decider) · NOT FOUND (platform)** | "The agent's own words / The system's reason / The plan at deploy / from the scoring path" label the decider's side on screen; no on-screen label for platform data exists — the card would be the first. |
| 15 | Fence and files | **CLEAR — review threshold** | Nothing fenced needs editing (`flattenBenchServer` is exported); the build touches ≈13–16 files → BUILD_RULES §2 adversarial review; 39/40 crons, no new cron. |

---

## 2. Findings

### A. `debate.js` — the technicals module

#### Item 1 — Inputs and outputs at HEAD · FOUND · CONSTRAINED

**In game terms:** the platform already has a "show me the chart read on X" endpoint; it only knows the seven names on the board, argues rather than reports, and nobody can reach it from the live screen.

**The route.** `api/agent/debate.js`: `maxDuration: 15` (`:10`); POST (`:37`); rate limit 5 / 60 s (`:32`); `requireAuth` (`:42`); body `{ battleId, targetSymbol, userStance, additionalContext }` (`:46`), the stance one of six (`:21-28`), the note capped at 200 chars and stripped (`:57-59`). Reads the battle doc and checks `ownerId` (`:65-74`), then the agent doc (`:77-81`). Imports: only `flattenPortfolioServer` from fenced `agentScoring.js` (`:5`); `getStockAnalysisData` (`:7`); `calculateAllIndicators` from `api/_utils/technicalCalculations.js` (`:8`). **No test file exists for it** (`api/agent/` listing — NOT FOUND).

**The book-only guard.** `:84-90`: `portfolio = battle.portfolio || agent.lastDecision?.portfolio`, `flattenPortfolioServer(portfolio)` flattens `star`, `core`, `support` and nothing else (`agentScoring.js:36-51`, fenced, cite only), 404 `Position X not found in portfolio`. `flattenBenchServer` (`:57-69`) is exported and un-imported here. The book is seven slots (`src/utils/baggerBombUtils.js:480-482`: 2 + 2 + 3).

**The data fetch.** `:96` `getStockAnalysisData(targetSymbol, { fields: ['daily', 'price'] })`:
- `daily` = EOD OHLCV from `getDateDaysAgo(30)` — **30 calendar days** (`api/_utils/marketDataCache.js:220-222`, `:92-96`), newest first, `close = adjusted_close` (`:239`). Cached L1 in-memory 5 min (`:41`), L2 Firestore `marketDataCache` 4 h (`:31`), TTL stretched to the next open when the market is closed (`marketSchedule.js:345-354`). Cold: one EODHD call; the module header's own figure is "2-4 seconds for multiple API calls per query" (`:8-10`, ASSUMED — never measured in the repo).
- `price` = EODHD real-time, **fetched on every call, never cached** (`:529-531`, `:587-603`); on failure falls back to `daily[0].close` with `fallback: true` (`:611-617`).
- The L2 `_technicals` cache path (`fetchTechnicals`, `:539-566`) is **not used**: `'technicals'` is not requested, so the indicators are recomputed in-request at `:106`.

**`calculateAllIndicators(ohlcvData)`** (`technicalCalculations.js:494-528`) returns `calculatedAt`, `dataPoints`, `rsi(14)`, `macd(12,26,9)`, `sma{20,50,200}`, `ema{12,26,50}`, `bollingerBands(20,2)`, `atr(14)`, `volumeProfile(20)`. Minimum windows: SMA/EMA `< period → null` (`:20`, `:33`); RSI `< 15` (`:62`); **MACD `< 35 → null`** (`:195`); BB `< 20` (`:248`); ATR `< 15` (`:286`); volume profile `< 21 → null` (`:337`). Thirty calendar days yield ≈20–22 trading candles, so at HEAD `macd`, `sma50`, `sma200`, `ema50` are **always null** on this path, and `volumeProfile` is null on a holiday-thinned window. Reproduced in the scratchpad: 30 candles → `macd: null`, `sma50: null`, `sma200: null`, `ema50: null`. (The `_technicals` L2 cache written by `fetchTechnicals :557-566` computes from the same `result.daily`, so its cached docs carry the same nulls — the class, not just this route.)

**The prompt it builds** (`:122-154`). Fields used: `rsi.value`/`zone`, the **sign** of `macd.histogram`, `sma20`, `sma50`, `atr.percent`/`regime`, `volumeProfile.tier`; defaults `{ histogram: 0 }`, `'N/A'`, `'unknown'` (`:122-127`). Because `macd` is null, `:145` renders `MACD histogram: negative` **on every call** (`0 > 0` is false) and `:146` renders `Above SMA50: N/A` on every call. `entryPrice` from `position.entryPrice || battle.startingPrices[symbol]` (`:110`); P&L `:111-113`. `agentName`, `archetype = agent.archetype || 'balanced'` (`:116-117`; `'balanced'` is not an archetype id). `renderLegacyDirectives` (`:120`) returns the "no legacy directives" line whenever `ARCHETYPE_INTEGRITY_MODE !== 'off'` (`legacyDirectiveSanitize.js:36-41`; the mode is `'enforce'`, `featureFlags.js:770`), so `YOUR DIRECTIVES` is a constant today.

System prompt, verbatim (`:130-139`):
> You are ${agentName}, a ${archetype} AI trading agent in a BaggerBomb battle on FantasyTrades. Your Coach is challenging one of your positions. Defend your analysis with specific indicators, or acknowledge if the Coach has a valid point. — Respond ONLY with valid JSON … `"agentResponse": "1-3 sentence counter-argument citing specific data"`, `"citedIndicators": [...]`, `"citedStrategy": "strategy_name or null"`, `"conviction": 0-100`, `"suggestedAction": "hold" | "consider_exit" | null`.

User message (`:141-154`): `POSITION DATA` (symbol, tier, entry, current, P&L) · `TECHNICAL SNAPSHOT` (RSI, MACD sign, above SMA20/50, ATR %, volume tier) · `YOUR DIRECTIVES` · `COACH'S CHALLENGE: Stance: "…"` + the note. **It is archetype-voiced** (the archetype is in the identity line) **and it asks for a recommendation** (`suggestedAction`) and a stance strength (`conviction`).

**The model and latency.** `claude-haiku-4-5-20251001`, `max_tokens: 512`, `temperature: 0.5` (`:159-165`); a 10 s race (`:167-169`) → 500 on timeout (`:176`). ~2–4 s is the foundation's figure (E13, ASSUMED). Parse: direct `JSON.parse`, then a `{…}` regex (`:180-200`).

**The response shape** (`:203-215`): `{ success, battleId, targetSymbol, userStance, debate: { agentResponse, citedIndicators, citedStrategy, conviction (default 50), suggestedAction } }`.

**`suggestedAction` never renders.** `src/components/Agent/DebateModal.jsx` stores the whole response (`:62-64`), renders `agentResponse`, `citedIndicators` (`:225`) and a `conviction` bar (`:253-260`), and writes `suggestedAction` only into the battle ledger on close (`:72-83`, `:81`). The modal is mounted (`AgentBattleScreen.jsx:2606-2612`) and `handleChallenge` exists (`:1094-1097`), but `onChallenge` is passed `undefined` on both live tapes (`PaneTape.jsx:228`, `GameTapeView.jsx:641`) and the feed's Challenge button renders only when it is provided (`AgentActivityFeed.jsx:482-484`) — the entry point is unwired at HEAD, exactly as E13 found on Sep 7.

**What would change to serve any name in the battle's universe.** The universe the pane already knows is `book ∪ bench.stocks ∪ bench.crypto ∪ watchlist.hotBench ∪ agentContext.equippedWatchlist.tickers` (`src/screens/battleView/selectBench.js:87-101`; written at creation by fenced `agentBattleService.js:160-163`, `:198-199`; the hot bench rebuilt mid-tick with the equipped tickers unioned in, `agent-evaluate.js:1011-1029`, soft cap 20, `watchlistEquip.js:113-129`). To serve it:
- the guard `:84-90` becomes membership in that union — `flattenBenchServer` for the bench (`agentScoring.js:57-69`, exported; calling it is §1-permitted), plus the two string arrays;
- the four position-dependent lines must branch: `position.tier` (`:142`), `entryPrice`/P&L (`:110-113`) exist only for book names; the six stances (`:21-28`) are challenge stances about a *held* position and mean nothing for a bench name;
- **the fetch (`:96`) and the indicators (`:106`) need nothing** — both are symbol-keyed;
- the fenced guard is not touched (there is none — the guard is `debate.js`'s own; see item 15).

**Meaning.** Widening is small and non-fenced, but the module as it stands is a debate, not a report: its prompt, its stances and its response fields are the thing Phase C must not voice, and its MACD line is a placeholder. The honest reuse is the data path (`:96`, `:106`) with a longer window, not the prompt.

#### Item 2 — The honesty of its prompt · FOUND, breaches

**In game terms:** the debate asks the character to argue its case and score its confidence; Show it needs it to read numbers aloud and stop.

Against R1 (spec V1.3 §1, `:21`: "Past tense from the record; the future only as cadence; never a specific future trade") and the grounded rules (`api/_utils/voiceLayerGrounding.js:417-422`: TENSE, ATTRIBUTION, the NEVER list; `:406` "You may not say what you will do to a position"), every line below would breach if voiced:

1. `:130` "Your Coach is challenging one of your positions. **Defend your analysis**" — presumes the character authored the decision (C1: the narrator composes reasoning it did not make).
2. `:134` `"agentResponse": "1-3 sentence **counter-argument** citing specific data"` — advocacy, not a reading.
3. `:136` `"citedStrategy"` — the character claims a strategy it applies.
4. `:137` `"conviction": 0-100` — a forward stance strength (the hypothesis class, hazard 3 of Sep 7).
5. `:138` `"suggestedAction": "hold" | "consider_exit"` — a recommendation field; the literal "should I" answer.
6. `:149-150` `YOUR DIRECTIVES` — first-person ownership of the directive slot (the grounded frame says a directive is *filed to the process*, `:421`).
7. `:152-154` `COACH'S CHALLENGE: Stance:` with the stances `hold_longer`, `cut_losses`, `bad_timing`, `earnings_risk` (`:21-28`) — each is a "will it / should I" framing the reply must answer in kind.
8. `:145` `MACD histogram: negative` — rendered from a default when the indicator is null (item 1): a fabricated signal, the C-20 null-honesty class.
9. `:146` `Above SMA50: N/A` — honest as text, but the pair invites "it's below its 50-day" readings from `N/A`.
10. `:117` `'balanced'` — an archetype the platform does not have becomes the voice's identity when `agent.archetype` is missing.
11. The system prompt's identity is **archetype-voiced** ("a ${archetype} AI trading agent"), so the numbers arrive in a persona that the grounded frame reserves for the *record*, not for platform data.

**What the research prompt must forbid** (for Sol): no `suggestedAction`, no `conviction`, no `citedStrategy`, no counter-argument or defence framing, no stance input, no first-person "your analysis / your directives", no forecast or condition ("if it breaks…"), no verdict word (buy/sell/hold/exit), no number the card does not carry (the screener's rule `voiceLayerPrompt.js:2376-2378`: "never fake it; never silently ignore it; never refuse outright" and "no buy/sell advice"), and no archetype lens unless labelled as a lens. One tension to rule: the grounded `OUTPUT_FORMAT` says "NEVER quote raw data numbers in your response" (`voiceLayerGrounding.js:791`; `DATA_CONFIDENCE_RULE`, `voiceLayerPrompt.js:1880`) — a research card **is** numbers. Either the card's numbers are rendered by code and the narration stays qualitative (the `Threshold:` / `Fundamentals (as of …)` precedent), or the research rule carves out "you may read the card's own numbers, attributed and dated".

### B. The screener — the fundamentals module

#### Item 3 — The endpoints and data behind the user-facing screener · FOUND

**In game terms:** the screener is a filter over the whole universe that a model translates from plain English; per name it knows scores, ranks and realized returns, and not price or valuation.

**The endpoint.** `api/screener/*` holds one route: `POST /api/screener/chat` (`api/screener/chat.js:3`). `maxDuration: 30` (`:40`); rate limit 10 / 60 s (`:111`); `requireAuth` (`:121`); body `{ userMessage, sessionId, previousSpec }` (`:125-129`); its own `researchSessions` collection, 30-message soft budget per session (`:42`, `:147`, `:182-190`); Gemma (`google/gemma-4-26b-a4b-it`, `gemmaClient.js:39`) under a 25 s abort (`:214-215`, `callGemmaVoiceWithRetry`); **one Firestore read** of the whole `indexIntelligence/stockRankings` doc (`:278`) — 239 names (`api/_utils/rankingConfig.js:359`, `ALL_TICKERS.length` measured 239); `screenStocks(stocks, spec)` / `screenIndustries` (`:294-297`). Client: `src/components/Search/ScreenerView.jsx:106` (`fetchWithAuth`). The Rankings screen reads the same doc **directly from the client** (`RankingsView.jsx:67`; `firestore.rules:682-684` public read).

**Per-symbol fields** (`api/_utils/screenStocks.js:29-38` `SCALAR_FIELDS`): `symbol, sectorId, sectorName, industryName, fundamentalScore, fundamentalRank, technicalScore, technicalRank, sectorTechnicalRank, sectorTechnicalTotal, compositeScore, baggerBombFit, baggerBombRank, atrPercentile, dailyRange, nr7Flag, bBandwidthPercentile, momentumScore, momentumRank, sma200_position, trend, recentAction, return1W, return1M, return3M, returnYTD, return12M`; nested `arch_scores.<6 keys>` (`:41-43`) and `momentumFactors.<12 keys>` (`:46-50`). Always carried: `BASELINE_FIELDS` (`:64-66`); a result is projected to baseline + referenced fields only (`:501-503`). **UNAVAILABLE by the screener's own prompt** (`voiceLayerPrompt.js:2326-2330`): share price, market cap, P/E, P/B, any valuation multiple; rate/macro sensitivity, leverage; RS percentile, squeeze flags; analyst targets, news, sentiment, ownership.

**Vintage.** The rankings doc is written with `computedAt` and `updatedAt` (`serverTimestamp`), `mode: 'intraday' | 'premarket'`, and `expiresAt` (75 min intraday, 24 h pre-market) (`api/cron/compute-index-intelligence.js:1341-1351`); cadence `vercel.json` #27 `30 10,11 * * 1-5` and #28 `?mode=intraday` hourly 14–20 UTC. The endpoint returns the doc's `dataAsOf` and `dataMode` (`:288-289`) beside the util's `computedAt` — the screen-run instant (`screenStocks.js:400`) — so both clocks travel.

**Cost and latency.** One doc read (ASSUMED sub-second; the doc is guarded at 60 % of 1 MiB, `compute-index-intelligence.js:492`, `:1353-1360`) + one Gemma call (≤25 s). Without the model — the read plus the pure util — it is a Firestore get and in-memory work over 239 rows.

**"Ranked by composite score."** The Search caption is `friendlyField('compositeScore') = 'composite score'` (`screenerAdapter.js:63`; default rank field `:46`); the util's fallback sort is `compositeScore desc` (`screenStocks.js:454-455`); `compositeScore` = the mean of the sector-scoped fundamental and technical percentiles (`compute-index-intelligence.js:1145-1150`). **Same ranking** if the watchlist came from the Search screener; the tournament strip's "composite" is `agentPoints + 1.5 × userPoints` (E14) — a different number with the same word.

#### Item 4 — Overlap with the fundamentals mirror · FOUND — the screener call is unnecessary

**In game terms:** everything the screener could say about one name is already on the row the cache reads every fifteen minutes.

- **The mirror** (`compute-index-intelligence.js:536-585`, `FUNDAMENTAL_MIRROR_ENABLED = true` `featureFlags.js:1554`): `trailingPE { value, sectorMedian }`, `priceBookMRQ`, `revenueGrowthPct`, `marketCapClass`, `earningsRevisions30d`, `beatRate` (computed-only), `surpriseMagPercentile`, `computedAt` (epoch ms, the peerRankings doc's vintage, `:525-528`); null-honest — a missing metric is an omitted key (`:530-534`); written into `stockRankings.stocks[].fundamentals` (`:1202`).
- **Where it already rides.** `voice-layer-cache.js` copies it onto every portfolio and bench brief when the owner's mode is not `'off'` (`:819`, `:316-318`, `:480-482`) — at HEAD the mode is `'shadow'` (`featureFlags.js:2137`), so every active battle's cache doc carries it now (D-107). Rendered by `buildFundamentalsLine` (`voiceLayerGrounding.js:304-322`) under the grounded prompt only (`voiceLayerPrompt.js:1765-1768`, `:1800-1803`).
- **What only the screener has** — `fundamentalScore/Rank`, `compositeScore`, `momentumScore/Rank`, `baggerBombFit/Rank`, `bBandwidthPercentile`, `sma200_position`, `trend`, `recentAction`, the five realized returns, `arch_scores`, `momentumFactors` — **is on the same `stockRankings` entry** the cache already maps (`voice-layer-cache.js:794-797`); the brief already copies `technicalScore/Rank`, `atrPercentile`, `atrPercent`, `nr7Flag`, `sector`, levels and signals (`:219-258`).

**Verdict.** For held and bench names the fundamentals card is the brief's `fundamentals` object plus, if wanted, the entry's scores — **no screener call, no Gemma, no spec**. For a hot-bench or equipped name (not in the cache doc — item 11) it is one `stockRankings` read and a map hit, the read the cron does anyway. The screener is a universe filter, not a per-symbol reader; "call the screener for MPC" would spend a model call to produce a spec the research path never needs.

#### Item 5 — `api/screener/chat.js` · FOUND — ancestor in discipline, competitor in shape

- **Prompt.** `buildVoiceLayerPrompt({ mode: 'research' })` (`:207-211`; assembly `voiceLayerPrompt.js:2929-2945`): identity "a research analyst … neutral, universe-level — not a competitor, not a portfolio manager" (`:2371`); rules `:2373-2379` — "HONESTY OVER COMPLETENESS … never fake it; never silently ignore it; never refuse outright" (`:2376`), "No greeting, no preamble, no hype, **no buy/sell advice**" (`:2378`); returns are "REALIZED, PAST … NEVER imply, forecast, or promise future performance" (`:2316`); output `:2262-2284`.
- **Data inputs.** None per symbol. The model sees only the prior spec (`:202-211`); it emits a `screenSpec`; the util runs it (`:294-297`). The model never touches stock data.
- **Budget.** 30 messages/session soft (`:42`), Gemma 25 s (`:215`), 10 req/min (`:111`), `maxDuration: 30` (`:40`). The turn does not charge on a Gemma failure (`:229-238`).
- **Shadow.** `logConversation({ gameMode: 'research', researchSessionId, screenSpec, matchCount })` (`:398-417`) — the same `conversations` stream (`shadowLogger.js:71`) the battle chat and the latency reader use; fire-and-forget (`.catch(() => {})`, permitted — §5 binds catalog events only).
- **Verdict.** *Ancestor:* its honesty rules are the nearest in-repo text to the research rule the seed asks for. *Competitor:* it is agent-agnostic, battle-less, session-scoped and answers "which names", not "what about this name". *Not reusable as-is:* it takes no symbol, returns no per-name narration, and its Gemma call produces a spec the research path does not need (item 4).

### C. The seam

#### Item 6 — `research_only` at HEAD · FOUND

**In game terms:** the character decides *after* answering that the question was research; nothing routes a research question anywhere, and nothing can tell it is one before the model speaks.

- **Classification.** The model emits `_archetypeProposal.classification ∈ { in_archetype, flex, core_conflict, user_lever, research_only }` (`voiceLayerPrompt.js:112-126`, rule `:125`). The gate validates the label (`directiveGate.js:60`), treats `research_only` as a deliberate null (`:61`, `:77-79`: `{ directive: null, hasDirective: false, status: 'no_change' }`), and `renderDirectiveStatus` emits `NO_CHANGE_STATUS_LINE` = "No change made to your strategy this turn." (`:54-58`; `src/data/decisionRecord.js:398`). `chat.js` calls the gate **after** the model call (`:820-836`) and stamps `archetypeGate` on the exchange (`:986`).
- **The reply with no data.** The model answers from the briefs alone: THIRD PATH step 5 "ONE RESEARCH CUE — point them at a real screen to go explore … never a round-trip you'll bring back" (`voiceLayerPrompt.js:104`; grounded twin `voiceLayerGrounding.js:570`), the NULL-WRITE HAND-OFF "it's a pure research/opinion question — NOTHING is recorded this turn" (`:107`; `:573`), TWO_LEG "There is no catalyst feed in your data — never fabricate one" (`:137`). `chat.js` imports no data path (`:1-48`: no `debate.js`, no `getStockAnalysisData`, no `screenStocks`). Exhibit 3's text is not in the repo (an attachment to the Sep 7 discovery); E12's quotation "I have no fundamental feed" is inherited, not re-read.
- **Where a research question would branch.** Nowhere today: mode detection is `battle | review` only (`chat.js:453-458`); the classification is post-call. **A pre-classifier without a model:** the repo has one deterministic detector, client-side — `findKnownTickers(text, knownTickers)` (`src/utils/findKnownTickers.js:49-87`: `\b[A-Z]{1,5}\b` against the battle's roster set; its only import is data, `src/data/termUniverse.js`, no imports) — it can say "this message names roster symbol X", not "this is a research question". No server-side symbol detector exists (`api/` grep — NOT FOUND). Intent cannot be classified deterministically; **a chip is the honest trigger** because a structured request carries its intent by construction.

#### Item 7 — The chat's `ask` chips · CONSTRAINED, addable

**The contract.** `GROUNDED_OUTPUT_FORMAT` asks for `{ kind: 'directive', id }` or `{ kind: 'ask', text }` (`voiceLayerGrounding.js:772-775`, rule `:789`). The server normalizer `normalizeSuggestedActions(raw, archetype)` (`:805-832`) rewrites a directive chip's text to canonical, drops an off-menu/duplicate id, turns a string into an `ask`, and **drops any other kind** (`:829`); applied only on a grounded turn (`chat.js:871-873`). The client's belief for a filing is the server-fed `currentDirectiveThreadId` (`:947-953`).

**Battle View tap paths.** Label: `chipLabel` (`src/components/Agent/AgentChat.jsx:105-111`) returns `null` for an unknown kind → not rendered (`:395-396`). Tap: `handleActionClick` (`:1044-1056`) — a string or `ask` → `sendMessage(text)` → `POST /api/agent/chat` `{ agentId, battleId, message }` (`:945-951`); `directive` → `fileDirective(id)` → `POST /api/agent/file-directive` `{ agentId, battleId, adjustmentId, expectedDirectiveThreadId }` (`:1005-1040`, `:1016-1023`); anything else → **no-op**.

**League tap paths.** Label: `mintedLabel` (`src/components/League/battleArena/CommandDock.jsx:39-44`) — `null` for other kinds. Tap `:343-347`: `directive` → `fileLive(id)`, else `askLive(chip.text)`. `useArenaEngine.js:83-120` posts `{ …, leagueAsk: true }` to the chat; `fileLive` (`:131-`, `:138`) posts to `file-directive`; chips are read only when `data.grounded` (`:107-112`).

**Verdict.** A `{ kind: 'research', symbol }` chip is dropped today at four points — the normalizer (`:829`), both labels, both tap handlers — and each is a small, local edit. If the **model** mints it, the OUTPUT_FORMAT prose (`:772-775`, `:789`) changes and the symbol must be server-validated against the battle's universe exactly as a directive id is validated against the menu (`:821-828`); if **code** mints it (a door on a piece, D-43's assignment "research/equip" channel, D-100), no prompt changes at all. The tap should go to the research route, never to the chat — the `directive` chip's own rule (`:1053-1055`; `CommandDock.jsx:345`).

#### Item 8 — The pane's entry points · FOUND (doors) · NOT FOUND (what it opens)

**The pane.** Three sections `chat | bench | tape` (`useCharacterPane.js:39-49`); `openPane(section, invoker)` — a named section wins over the remembered one (`:86-98`); `CharacterPane.jsx` takes `chat`, `bench`, `tape`, `overflow` (`:180-200`) and renders all three panels hidden-not-unmounted (`:223-244`, `:386-391`). The overflow holds `Report a bug` alone — "Read and Equip are not built" (`PaneOverflow.jsx:5-6`; `battleViewCopy.js:561-565`).

**The Why? panel's doors** (`WhyPanel.jsx:447-497`): `Ask a follow-up · 1 message` (`battleViewCopy.js:284`; handler `AgentBattleScreen.jsx:1222-1242` → composer prefill `About {symbol} — ` `:285` + `pane.openPane(CHAT)`), `In the chat · n` (`:296`; `:1261-1276` → `setScopeSymbol` + prefill + CHAT), `Read the full check` (`:148`; `:1192-1221` → `openCheck` + CHAT). Row facts are the row's own numbers (`:159-163`); the tier lines are footed `from the scoring path` (`:231-238`; `battleViewCopy.js:132`) — the panel is "a PURE READ (C1) … No fetch, no model call" by its own header (`:3-6`).

**Bench.** `PaneBench.jsx`: a `Chip` is a `<span>` with no handler (`:68-93`); sentence cards `:129-151`; the roster row `:177-186`; an empty assignments slot `:190`. The roster is book-excluded bench + hot bench + equipped tickers (`selectBench.js:87-101`), subtitled with the equipped watchlist's bare name (`:181-182`; `benchWatchlist`, `battleViewCopy.js:594`). No bench price is polled on this screen (A3 §2.5).

**The tape's scoped view.** Display filtering only (`scopeTape.js:3-16`); the scope chip `{symbol} · All` lives in the composer (`AgentChat.jsx:1275-1299`); `scopeSymbol` clears itself when the symbol leaves `knownTickers` (`AgentBattleScreen.jsx:1283-1286`).

**Where a Show it door sits per D-43/D-44.** D-43 (ledger `:443`) makes Show it one of the four verbs on a piece; D-44 (`:444`) makes Why? a free read of persisted text with the absence state primary; D-54 (`:454`) makes Show it's forward path Equip. So: on a **book** piece, the door row of its Why? panel (`WhyPanel.jsx:454-497`) beside `Ask a follow-up · 1 message` — the same row, the same cost-before-the-tap idiom; on a **bench** name, the chip (`PaneBench.jsx:68-93`) has to become a button; in the **conversation**, the `research` chip of item 7.

**What it opens — NOT FOUND.** No research card component exists; the tape's kinds are `trade | check | checkRun` (`buildTape.js:55-59`); chat message types are `user_initiated | auto_debrief | first_message | trade_narration | anticipation | directive_filed` (`deriveChatMessages.js:43-44`, `:101`; `decisionRecord.js:383`); no panel beside `WhyPanel`. Two homes are possible and they differ in one consequence: a **Chat-section card** persisted as an exchange enters the narrator's EARLIER MESSAGES block if it carries `groundingVersion: 1` (`voiceLayerGrounding.js:347-348` — only `directive_filed` is excluded) and counts in the tape's scope; a **transient panel** (the Why? shape) is never persisted, never quoted, never counted. The seed's "the tape as the home" therefore needs a persisted shape with a message type the history window excludes — hazard 3.

### D. Cost, latency, caps

#### Item 9 — The research call as its own endpoint · FOUND

**The order, from the shipped routes.** (1) `applySecurityMiddleware` + rate limit (`debate.js:32`; `file-directive.js:142`); (2) `requireAuth` — the uid from the token, never the body (`chat.js:398`); (3) battle read + `ownerId` (`debate.js:65-74`); (4) `agentBelongsToBattle` — the shared predicate (`chat.js:443`; `file-directive.js:207`); (5) battle active (`file-directive.js:205`); (6) the universe check — book ∪ bench ∪ hot bench ∪ equipped from the battle doc (item 1); (7) the cap, inside the same transaction as any charge (`file-directive.js:196-299`: all reads before writes; explicit count, never `increment`); (8) technicals — `getStockAnalysisData(symbol, { fields: ['daily','price'] })` with a ≥35-trading-day window, or the cache's daily fields (item 11); (9) fundamentals — the cache brief's `fundamentals` (book/bench) or one `stockRankings` read (others); (10) compose the card in code — the `composeAnticipationNote` precedent (`voiceLayerGrounding.js:711-725`: no model, the facts and their labels); (11) optional narration — one Gemma call under the chat turn's discipline (`callGemmaVoice`, abort clamped to an absolute deadline `chat.js:724-729`), the reply linted in code (item 13); (12) the shadow record settled under `waitUntil` or the 2 s cap (`chat.js:152-237`).

**`maxDuration` for a new route.** The in-repo pattern is per-route `export const config = { maxDuration: N }`: `debate.js:10` 15, `chat.js:50` 30, `screener/chat.js:40` 30, `file-directive.js:97` 10, `chat-budget.js:20` 10. `vercel.json` `functions` sets only `includeFiles` — no default is declared in the repo; the platform default when a route omits it is a Vercel fact, ASSUMED, not verifiable here. A research route with one model call fits the screener's 30 / 25 s shape; a data-only route fits `file-directive`'s 10.

**Gemma p50/p95.** `gemmaLatencyMs` is stamped on the first voice call (`chat.js:737-749`) and carried on all three shadow records (`:790`, `:927`, `:1093`). **The reader exists now** — `api/scripts/gemma-latency-report.js` (`:1-59`: reads `shadow/conversations/` for a date range, reports `all` and `ok` distributions plus the timeout count, requires `GCS_CREDENTIALS` `:35-36`) — and the paired harness replays old vs new (`voice-grounding-harness.js:1-40`). **Neither is runnable here** (no credentials); p50/p95 remain NOT MEASURED in this session. The latency table is §3.

#### Item 10 — The cap · FOUND — two shapes

**Where per-battle counters live today.**
- `chatBudgetUsed` on the battle doc — declared by fenced `createAgentBattle` (`agentBattleService.js:263`); limit 10 (`directiveFiling.js:69` `BATTLE_CHAT_BUDGET`); incremented by `chat.js:1002` (`FieldValue.increment`, non-League) and by `file-directive.js:257-262` (an explicit in-transaction count); read by the client off the subscribed doc for the counter (`AgentChat.jsx:523`, `:629`, `:1500`; `AgentBattleScreen.jsx:1794`).
- `reviewBudgetUsed`, limit 5 (`chat.js:359`) — written by the same `:1002` but **not declared in `createAgentBattle`** (grep: absent) — a runtime-added top-level key; a precedent, not a licence (§9 below).
- The League day store `agentChatBudget/{groupId}_{uid}_{dayN}` — its own collection precisely so no battle-doc key is added (`agentChatBudget.js:7-12`, `:33-46`); 10/day (`:36`); plain read (`:85-89`) and transactional explicit-count charge (`:103-121`); server-only rules (`firestore.rules:728-731`); the on-open counter via `GET /api/agent/chat-budget` (`chat-budget.js:3-8`); `file-directive` charges it inside its own transaction (`:236-255`); both writes are recorded in `compositionProtectedStoresAllowlist.json` (`:15`, `:274`).

**Shape A — research is a message.** The route charges exactly as `file-directive.js:230-263` does: `battle.gameMode === 'baggerbomb_tournament'` → the League day doc inside the transaction (fail-open when unkeyable); otherwise `chatBudgetUsed` by explicit count. `Show it · 1 message` is the D-31 idiom the follow-up door already uses (`battleViewCopy.js:284`). **It cannot say "1 of 3"**: the message budget is 10, and a cap of three per battle needs a count of research turns that the message counter does not carry — so Shape A still needs a second count for the cap, unless the cap is "three messages' worth", which is not the brief's cap.

**Shape B — research has its own counter (`researchUsed`, cap 3).** Three placements: (i) a top-level battle-doc key — `createAgentBattle` doc-shape contact, a §7 STOP (cockpit V2 hazard 9; `agentChatBudget.js:7-12`); (ii) its own collection `agentResearchBudget/{battleId}_{uid}` — server-only like the League store, so "cost before the tap" needs a GET (the `chat-budget.js` shape) or the route's `remaining`; (iii) **a count of research exchanges in `chatExchanges[]`** by their `messageType` — no new key (a new element of an existing array: the D-52/D-79 precedent the build Phase 0 named, item 9 note 5), transactional (the count is taken inside the same transaction that appends), and **client-derivable from the subscribed doc** so `Show it · 1 of 3` is one source (BUILD_RULES §9) — at the cost that the cap depends on the exchange being persisted (which a Chat-section card wants anyway; a transient panel does not).

**The ruling is the founder's.** The two questions it turns on: is a research tap *influence* (charge the message budget — spec §6.4's argument for chips) or *inference* (its own cap)? And does the card persist (iii is free) or not (ii)?

#### Item 11 — Pre-computation instead · FOUND — cheap; the seed's budget NOT FOUND

**What the cron writes.** `voice-layer-cache.js` runs `*/15 13-20 UTC` weekdays (`vercel.json` #30; `:6`), `maxDuration: 60` (`:30`), skips outside OPEN/PRE_MARKET (`:705-708`); bulk EODHD real-time prices in batches of 20 (`:33`, `:43-60`); one `stockRankings` read and a `getAll` of `stockTechnicalScores` (`:781-788`); per battle it writes `portfolioBriefs`, `benchBriefs`, `scoutAlerts`, `marketContext`, `dataFreshness`, `forgeSeeds: null`, `newsLines` (flag), `updatedAt` (`:849-866`). **Coverage:** `allSymbols` = book + `watchlist.active` + bench stocks (`:729-754`); briefs are built for book and bench only (`:820-830`). **Hot-bench and equipped names have no brief today.**

**Sizes (measured from the exact key sets; values ASSUMED).**

| Object | Keys | Bytes (JSON) |
|---|---:|---:|
| `calculateAllIndicators` output, 30 candles (executed) | 9 | 462 |
| the debate prompt's indicator subset | 8 | 228 |
| fundamentals mirror, all 8 keys | 8 | 214 |
| portfolio brief incl. mirror (`:219-258`, `:263`, `:289-299`, `:313`, `:317`) | 30 | 1,111 |
| bench brief incl. mirror (`:436-482`) | 26 | 893 |
| a research-card data block per name (full technicals + price + mirror + two provenance stamps) | — | 1,036 |
| the same with the debate-field technicals only | — | 882 |

**Roster.** Book 7 (`baggerBombUtils.js:480-482`) + bench 3 stocks (`decide.js:1174`, fenced, cite only) + ≤1 crypto + hot bench ≤ 20 soft cap with the equipped tickers unioned in (`watchlistEquip.js:113-129`; `agent-evaluate.js:1011-1029`) → **≤ ~31 names** per battle (equipped tickers survive inside the cap, so they add nothing beyond it).

**Arithmetic.** Today's doc ≈ 7 × 1,111 + 4 × 893 ≈ 11.3 KB + alerts/context/newsLines (`NEWSLINE_MAX_LENGTH` 240, `:572`) — ASSUMED < 30 KB. Adding a research block per universe name: 31 × ~1.0 KB ≈ **32 KB** → ≈ 45–65 KB per cache doc, ~3–6 % of Firestore's 1 MiB. **The doc-size budget the seed cites ("the Phase B discovery §3") does not exist in `docs/`** — Phase B is the Heard stamp (D-52; `PHASE_A_SEED_BATTLE_VIEW_CONTROLLER_V1.md:16`) and has no discovery document; no §3 of any September discovery carries a doc-size budget (grep). The in-repo convention is a warn line at **60 % of 1 MiB** (`compute-index-intelligence.js:492` `STOCK_RANKINGS_DOC_WARN_BYTES`; `wireWriteThrough.js:53-54`) — the research block is two orders below it.

**Cost of the extra names.** Extending `allSymbols` to hot bench + equipped is ≤ 20 more symbols in the same bulk price call (one more batch of 20) and ≤ 20 more `getAll` refs; the daily indicators the cache summarises (`trendSummary`, `momentumSummary`, RSI/MACD context, ATR %, levels, NR7, MACD-cross flags, `:140-258`) come from `stockRankings` + `stockTechnicalScores`, not from `getStockAnalysisData` — so **the technicals half of a card is already pre-computed for book and bench**, qualitatively; raw daily readings (`rsi`, `atrPercent`, `bbPercentB`, `distTo52wkHigh`) sit on the rankings entry under `techRaw` (`compute-index-intelligence.js:1211-1215`). What a card would add beyond the brief is the raw indicator values and the two provenance stamps; what it would not get from the cron is a live quote (`prices: 'rest_15min'`) — which the brief already labels.

**A tap as a read.** `voiceLayerCache/{battleId}` is owner-readable from the client (`firestore.rules:716-721`); `stockTechnicalScores/{symbol}` and `indexIntelligence/*` are public reads (`:682-690`). So a tap **can** be a client read with no route at all — for book/bench today, for any universe name via the two public docs — with the consequence that **a client-only read cannot be capped**; the cap is real only where the card's data (or its narration) is served by the route. Hazard 11.

### E. Honesty and provenance

#### Item 12 — The research card's provenance labels · FOUND / NOT FOUND

The table is §6. In one line each: the **fundamentals** have a vintage field and two renderers; the **technicals** have four vintage facts in the data (`daily[0].date`, `cacheStatus`, `fetchedAt`, `calculatedAt`) and the **quote** has `price.timestamp` + `fallback` — none of which `debate.js` renders (`:141-154` carries no date); the **cache** technicals are labelled `'daily'` and the prices `'rest_15min'` (`voice-layer-cache.js:857-862`) with a code-rendered "(Prices as of last cache refresh, not real-time.)" (`voiceLayerPrompt.js:1724-1725`) and the vintage sentence (`voiceLayerGrounding.js:287`); the **archetype lens** has no field anywhere — `debate.js` bakes it into the identity line (`:117`, `:130`) and its response carries nothing that says so (`:203-215`): NOT FOUND.

#### Item 13 — The narrator's voicing under `'on'` · FOUND · NOT FOUND (the lint)

- **Where the rules live.** The identity frame `buildGroundedIdentity` (`voiceLayerGrounding.js:405-409`) is spec §3.1 verbatim; the shared rules — CONFIRMATION, CLOSING, TENSE, ATTRIBUTION, the NEVER list — are `GROUNDED_SHARED_RULES` (`:417-422`), carried by each phase's rules (`:429-523`) and the tone/data block (`:424-427`); `GROUNDED_THIRD_PATH_RULE` (`:564-573`) keeps the research cue; `GROUNDED_OUTPUT_FORMAT` (`:762-793`). Assembled at `voiceLayerPrompt.js:3046-3096` (phase rules `:3053`, output format `:3066`, `DATA_CONFIDENCE_RULE + CONTEXT_VINTAGE_SENTENCE` `:3088`). **A research rule joins `GROUNDED_SHARED_RULES`** ("you describe the platform's numbers; you do not recommend, forecast, or state what the trading process will do") — one string, swept by the honesty sweep because the module is registered (`promptHonestyRegistry.js:53`) and covered by the sixteen off goldens only in the off direction (a grounded-prose change moves no off byte).
- **The reply lint.** `REPLY_LINT_RE = /I'll rotate|I'm rotating|eyeing|watching|keep an eye|I'd consider[^.]*\bswap/i` and `passesReplyLint` (`:704-708`) are applied **in code only to the anticipation signal clause** (`composeAnticipationNote`, `:711-725`). `chat.js` never calls them on a reply (grep — NOT FOUND); the lint is otherwise a *measurement* in the paired harness (`voice-grounding-harness.js:12-13`). `findGuardedVocabulary` (`:678-687`) is a test-side guard over prompt text (35 phrases), not a reply lint. **So "a research reply passes through it" is a build item, not a reuse**: the route must call `passesReplyLint` (plus the research verbs: buy/sell/hold/exit/should/will) on the narration before it is returned or persisted, and say what it did when it fails — the code-owned status-line pattern (`renderDirectiveStatus`, `directiveGate.js:54-58`) is the precedent for a truth-of-record the model cannot override.
- **The number rule.** `:791` "NEVER quote raw data numbers" and `DATA_CONFIDENCE_RULE` (`voiceLayerPrompt.js:1880`) conflict with narrating a card of numbers — item 2's tension, to be ruled with the research rule.

#### Item 14 — C1 status · FOUND (decider) · NOT FOUND (platform)

A research card is platform data (technicals computed by the platform, fundamentals from the mirror), not decision-path output and not the decider's evidence (hazard 8 of Sep 7: "DO NOT quote cache numbers as 'what the decider saw'").

- **"What the decider saw" — the labels that exist on screen:** `From the {t} check` (`WhyPanel.jsx:167`; `battleViewCopy.js:137`), `The agent's own words` / `The system's reason` (`decisionRecord.js:147-148`; footers `selectWhyState.js:180-199`, `:475`; the Bench footer `PaneBench.jsx:152-159`; D-80/D-109 `renderMotive` `:295`), `The plan at deploy · {date}` (`:361`), `Hypothesis recorded at this check (graded after the battle)` (`voiceLayerGrounding.js:149`), and prompt-side `YOUR RECORD (… history, not a plan)` (`:147`) / `CURRENT DIRECTIVE (…)` (`:154`).
- **"What the platform knows" — the labels that exist:** prompt-side only — `CURRENT CONTEXT — prepared for this conversation from cached sources at their labelled vintages; not the evidence the trading process necessarily saw at its check` (`:284`), the vintage sentence (`:287`), "(Prices as of last cache refresh, not real-time.)" (`voiceLayerPrompt.js:1725`). **On screen, NOT FOUND**: the only platform-data footer is `from the scoring path` (`battleViewCopy.js:132`), which names the scorer, not the cache; no cache number is rendered on the Battle View today (A3 §2.5: no bench price is polled).
- **Meaning.** The card introduces the first on-screen platform-data label. The two vocabularies must never share a surface: a card footer of the shape `From the platform · technicals {date} · fundamentals as of {date}` beside a check card footed `The agent's own words` — and the research card must never sit under a `From the {t} check` eyebrow.

### F. Fence and files

#### Item 15 — Fence, files, threshold, cron · CLEAR

- **Fence.** `api/agent/debate.js` is not on §1. `agentScoring.js` is fenced; `flattenBenchServer` is exported (`:57-69`) — widening **calls** it, which §1 permits; there is **no fenced guard to touch** — the debate's guard is its own (`debate.js:84-90`). A research read alters no scoring, no doc shape → not "fenced as a concept". A **new top-level battle-doc key would be** (item 10). `getArchetypeLabel` is imported from fenced `agentArchetypeConfig.js` (`voiceLayerPrompt.js:14`; that module is in `archetypeImportBoundaryBaseline.json:26`) — a new route that imports the legacy table directly trips the **§2.3 ratchet** (record it in the baseline in the same commit, or take the archetype through `getEffectiveArchetype` (`directiveIdentity.js`) and the display map).
- **Files a build would touch** (by the shape this report finds; the spec decides): new `api/agent/research.js` + test; a new pure card composer in `api/_utils/` + test; `api/_utils/voiceLayerGrounding.js` (the research rule; the chip kind in `normalizeSuggestedActions`) + its tests; `api/agent/chat.js` only if the model mints the chip; `api/agent/debate.js` (widen, or retire — its entry point is unwired); `src/components/Agent/AgentChat.jsx` (label + tap); `src/components/League/battleArena/CommandDock.jsx` + `useArenaEngine.js` (League label + tap); `src/screens/battleView/WhyPanel.jsx` + `src/screens/AgentBattleScreen.jsx` (the door); `src/screens/battleView/PaneBench.jsx` (chip → button); `battleViewCopy.js` (strings) + `src/data/decisionRecord.js` (a shared status line / message type); `deriveChatMessages.js` + `TapeCards.jsx` if a card renders in Chat; `firestore.rules` if a new collection; `compositionProtectedStoresAllowlist.json` if a new transactional store; `api/cron/voice-layer-cache.js` if pre-computing. **≈13–16 files** → at or over the **§2 review threshold of 10 files**: the multi-lens adversarial review, reviewer isolation on a snapshot tree, and an explicit `vite build` are mandatory.
- **Cron.** `vercel.json` carries **39 entries** (counted by parsing the `crons` array at HEAD); one slot remains; the seed's "no new cron" holds by necessity — pre-computation branches inside `voice-layer-cache.js`.
- **Registries.** `voiceLayerGrounding.js` is already in `PROMPT_CONTRIBUTING_MODULES` (`promptHonestyRegistry.js:53`); a new research prompt module needs registration only if it renders prose into a fenced assembler (it does not).

---

## 3. D9 — the latency table

Per step of the research call. **Nothing below was measured against a live service in this session**; "measured" means executed locally on pure code.

| Step | Source | Warm | Cold | Basis |
|---|---|---|---|---|
| Auth (`requireAuth`) | token verify | tens of ms | — | ASSUMED |
| Battle doc + agent doc | 2 Firestore gets (`debate.js:65`, `:77`) | ~0.1–0.3 s | same | ASSUMED (no Firestore here) |
| Universe check | in-memory over the battle doc | µs | — | `selectBench.js:87-101` shape |
| Cap check + charge | 1 transaction (`file-directive.js:196-299`) | ~0.2–0.5 s | same | ASSUMED; `file-directive` budgets 10 s for "a transaction over two docs and no model" (`:96-97`) |
| `voiceLayerCache/{battleId}` read | 1 get (`chat.js:557`) | ~0.1 s | same | ASSUMED |
| `stockRankings` read (non-cache names) | 1 get of a doc guarded at 60 % of 1 MiB (`compute-index-intelligence.js:492`) | ~0.2–0.6 s | same | ASSUMED |
| Daily OHLCV | L1 in-memory 5 min (`marketDataCache.js:41`) · L2 Firestore 4 h (`:31`) · EODHD | ~0 / 1 get | EODHD call: "2-4 seconds" is the module's own figure for its multi-call bundle (`:8-10`) | ASSUMED; L1 is per warm instance (`serverCache.js:5`, `:14-15`), so plan cold |
| Real-time price | EODHD every call, uncached (`:529-531`, `:587-603`) | 1 external call | same | ASSUMED |
| Indicators | `calculateAllIndicators` | µs (executed here) | — | measured (30 candles) |
| Card composition | code | µs | — | — |
| Narration (optional) | Gemma via `callGemmaVoice`; the chat's cap 19 s inside a 24 s turn (`chat.js:89-90`, pinned `chat.timeout.test.js:35-36`); the screener's 25 s (`screener/chat.js:215`) | p50/p95 **NOT MEASURED** — the reader `gemma-latency-report.js` needs `GCS_CREDENTIALS` | — | H21 of Sep 7 stands as to numbers |
| Alternative narration | Haiku (`debate.js:159-169`, 10 s race) | "~2–4 s" | — | ASSUMED (E13's foundation figure) |
| Shadow record | `waitUntil` or a 2 s cap clamped to 28 s (`chat.js:152`, `:161`) | 0 (platform) | ≤2 s | pinned `chat.timeout.test.js:60-61` |
| `maxDuration` | per-route `config` (`debate.js:10` 15; `chat.js:50` 30; `screener/chat.js:40` 30; `file-directive.js:97` 10) | — | — | `vercel.json` declares no default |

**Reading.** A data-only research call is bounded by the cold EODHD path (seconds) and fits a 10–15 s route; a narrated one inherits the voice turn's 24 s discipline and must clamp its model call to an absolute deadline as `chat.js:724-729` does. Hazard 7 of Sep 7 stands: none of this rides inside the chat turn.

---

## 4. D10 — the two cap shapes

| | Shape A — a message | Shape B — its own counter |
|---|---|---|
| What is charged | `chatBudgetUsed` (tiered, explicit count in-tx) or the League day doc — `file-directive.js:230-263` verbatim | `researchUsed`, cap 3 per battle |
| Where it lives | existing keys / the existing League collection | (i) a battle-doc key — **§7 STOP** (`createAgentBattle` shape; `agentChatBudget.js:7-12`) · (ii) own collection, server-only, GET for the counter (`chat-budget.js`) · (iii) a count of `chatExchanges[]` entries by `messageType` — no new key, in-tx, client-derivable |
| "Cost before the tap" (D-31) | `Show it · 1 message` — the string idiom of `battleViewCopy.js:284`; the client already reads `chatBudgetUsed` | `Show it · 1 of 3` — (i) trivially from the doc; (ii) needs a read route; (iii) from the subscribed doc, one source (§9) |
| Can it say "1 of 3"? | **No** — the message counter carries no research count | Yes |
| League battle | charges the day store, so the Battle View's counter does not move (D-105's recorded consequence) | (iii) per battle regardless of mode; (ii) needs its own key scheme |
| Race safety | the transaction's explicit count (`file-directive.js:260-262`) | same pattern |
| Records to update | `compositionProtectedStoresAllowlist.json` for any new transactional write | same |
| Tests to reconcile | none pinned on a new field; `chat.test.js` pins the exchange shape | `voiceGroundingFixtures.js:242` carries `reviewBudgetUsed: 0`; any new key needs its fixture |

**The founder's questions.** Influence or inference? Persisted card or transient panel? (iii) is the only placement that is free of fence contact, needs no new route for the counter, and keeps §9 — and it exists only if the card is persisted.

---

## 5. D11 — the pre-computation arithmetic

| Quantity | Value | Basis |
|---|---:|---|
| Universe per battle | ≤ 31 names (7 book + 3–4 bench + ≤20 hot bench incl. equipped) | `baggerBombUtils.js:480-482`; `decide.js:1174`; `watchlistEquip.js:113-129` |
| Cache doc today | ≈ 11.3 KB of briefs (+ alerts, context, newsLines) | 7 × 1,111 + 4 × 893 (key sets VERIFIED, values ASSUMED) |
| Research block per name | ≈ 1.0 KB (882–1,036 B) | measured from the literal |
| Added per doc | ≈ 32 KB | 31 × 1.0 KB |
| Doc after | ≈ 45–65 KB ≈ 3–6 % of 1 MiB | Firestore's 1 MiB is a platform limit (ASSUMED as stated in-repo at `compute-index-intelligence.js:1359`) |
| In-repo warn line | 629,145 bytes (60 % of 1 MiB) | `compute-index-intelligence.js:492`; `wireWriteThrough.js:54` (600 KiB) |
| Extra cron cost | ≤ 20 more symbols in the bulk price call (one more batch) + ≤ 20 `getAll` refs | `voice-layer-cache.js:33`, `:781-788` |
| Cadence | every 15 min, 13–20 UTC weekdays; vintages: prices `rest_15min`, technicals/rankings `daily` | `vercel.json` #30; `:857-862` |
| Not pre-computable | a live quote; anything for a name that enters the universe between ticks (the hot bench is rebuilt mid-tick, `agent-evaluate.js:1031-1048`) | — |

**Meaning.** Pre-composing the card's *data* on the cache doc is cheap by two orders of magnitude and makes a tap a read — but only for names the cron covers (book + bench today; extending to the hot bench is a small edit at `:729-754`), only at the cache's vintages, and only with a client-side cap if the read bypasses the route (hazard 11).

---

## 6. E12 — the provenance table

| Fact on the card | The field that exists | Where it is rendered today | Status |
|---|---|---|---|
| Technicals' source | EODHD EOD (`marketDataCache.js:222`), 30 calendar days (`:221`) | nowhere | FOUND (data) / NOT FOUND (label) |
| Last candle date | `daily[0].date` (`:235`) | nowhere | FOUND / NOT FOUND |
| Cache state of the daily series | `cacheStatus.daily ∈ hit \| fresh \| stale_fallback` (`:471`, `:500`, `:513`), `staleData`, `staleFields` (`:453-454`), `fetchedAt` (`:450`) | nowhere | FOUND / NOT FOUND |
| Indicators' vintage | `calculatedAt`, `dataPoints` (`technicalCalculations.js:506-507`) | nowhere | FOUND / NOT FOUND |
| Last quote | `price.timestamp` (EODHD, `:602`), `fallback: true` when it is the daily close (`:615`) | nowhere; `debate.js:142` prints the price undated | FOUND / NOT FOUND |
| Cache technicals | `dataFreshness { prices: 'rest_15min', technicals: 'daily', rankings: 'daily', marketContext: 'daily' }` (`voice-layer-cache.js:857-862`), `updatedAt` (`:865`) | "(Prices as of last cache refresh, not real-time.)" (`voiceLayerPrompt.js:1724-1725`); `CONTEXT_VINTAGE_SENTENCE` (`voiceLayerGrounding.js:287`) | FOUND (prompt-side) / NOT FOUND (on screen) |
| Fundamentals | `fundamentals.computedAt` epoch ms = the peerRankings doc's vintage (`compute-index-intelligence.js:525-528`, `:580-585`); the doc written weekdays 11:00 UTC (`vercel.json` #7; `compute-rankings.js:1327`, `:1407`) | `Fundamentals (as of Sep 5): …` via `vintageDate` (`voiceLayerGrounding.js:292-297`, `:319-321`); decider side `as of MM-DD` only when older than the block's newest + "Fundamentals data as of {day} (UTC)" (`fundamentalsRender.js:170-175`, `:189`) | FOUND (two renderers, prompt-side) |
| Rankings doc | `computedAt`, `updatedAt`, `mode`, `expiresAt` (`compute-index-intelligence.js:1341-1351`) | screener response `dataAsOf`, `dataMode` (`screener/chat.js:288-289`); screen-run `computedAt` (`screenStocks.js:400`) | FOUND |
| Archetype lens | none — `agent.archetype \|\| 'balanced'` is baked into the identity line (`debate.js:117`, `:130`); the response has no lens field (`:203-215`); the grounded identity carries `archetypeLabel` (`voiceLayerGrounding.js:405-406`) | nowhere | **NOT FOUND** |
| Weekly text brief (not on the card) | `stockBriefs/{symbol}.expiresAt` (`stockBriefService.js:56-61`), Sunday 01:00 UTC (`vercel.json` #9) | `api/stocks/analysis.js:263` only | FOUND, out of path |

---

## 7. Hazards — DO-NOTs for the build (this report's numbering)

1. **DO NOT** build the technicals card on `debate.js`'s 30-calendar-day fetch. MACD needs 35 candles, SMA50 fifty; on this window `macd`, `sma50`, `sma200`, `ema50` are null and `MACD histogram: negative` (`debate.js:145`) is a default, not data. Fetch ≥ 35 trading days (≈ 50 calendar) or omit the indicator (C-20: omit, never a placeholder).
2. **DO NOT** let a research tap cost an external call by default. `price` is uncached EODHD on every call (`marketDataCache.js:529-531`); the cache's `rest_15min` quote already carries an honest label.
3. **DO NOT** persist a research card as an exchange with `groundingVersion: 1` unless its `messageType` is excluded from the history window like `directive_filed` (`voiceLayerGrounding.js:347-348`); otherwise the narrator quotes the platform's numbers as its own earlier words.
4. **DO NOT** write `suggestedActions` on a research exchange; the code-composed shape is `suggestedActions: null` (hazard 28 of the build Phase 0; `voiceLayerAnticipation` precedent).
5. **DO NOT** narrate the card under the raw-number ban as written (`voiceLayerGrounding.js:791`; `voiceLayerPrompt.js:1880`) without the research rule carving out the card's own numbers — or the model paraphrases numbers it was told not to quote.
6. **DO NOT** trust a client-sent symbol. Validate membership in the battle's universe server-side (book ∪ bench ∪ hot bench ∪ equipped, from the battle doc) — the directive-id discipline (`:821-828`) — and 404 with an honest client line when a name has left it (the hot bench is rebuilt mid-tick, `agent-evaluate.js:1031-1048`).
7. **DO NOT** promise the Equip forward path for every name: hot-bench and equipped tickers held by rival agents are kept out (`agent-evaluate.js:1006-1008`, `:1023-1026`); D-54's "reaches the bench at the next check" needs its honest exception.
8. **DO NOT** widen `debate.js` without a test; none exists. Any change to its guard is untested behaviour at HEAD.
9. **DO NOT** add a top-level battle-doc key for the cap (cockpit V2 hazard 9; `agentChatBudget.js:7-12`). `reviewBudgetUsed` (`chat.js:359`, `:1002`) is an undeclared-key precedent that predates the rule, not a licence.
10. **DO NOT** budget for a warm cache. L1 is per warm instance (`serverCache.js:5`, `:14-15`); plan the route's `maxDuration` for the cold EODHD path.
11. **DO NOT** assume the cap holds if the card's data is client-readable. `voiceLayerCache` is owner-readable and `stockTechnicalScores` / `indexIntelligence` are public (`firestore.rules:682-690`, `:716-721`); a cap is real only where the route serves the card or its narration.
12. **DO NOT** reuse `gameMode: 'research'` on the shadow stream for the battle research path (`screener/chat.js:403`); stamp `gemmaLatencyMs: null` when no model was called (`chat.js:380`'s convention) so the latency reader's `ok` set stays honest.
13. **DO NOT** label the fundamentals "weekly". The mirror's `computedAt` moves with the weekday 11:00 UTC peer-rankings cron; only the forward estimates are weekly (Saturday, `vercel.json` #10). Label by `computedAt` (§8 discrepancy 11).
14. **DO NOT** carry `debate.js`'s `'balanced'` default (`:117`) into a lens label; take the archetype through `getEffectiveArchetype(battle, agent)` (`directiveIdentity.js`; `chat.js:822`, `file-directive.js:222`) or omit the lens.
15. **DO NOT** read the cache doc for a hot-bench or equipped name — it has no brief there (`voice-layer-cache.js:729-754`, `:820-830`); fall through to the rankings entry and say "no data" when it is absent (the null-honest rule the character already follows).
16. **DO NOT** import `agentArchetypeConfig.js` directly from a new route without recording it in `archetypeImportBoundaryBaseline.json` in the same commit (§2.3 ratchet; `voiceLayerPrompt.js:14` is the registered importer).

---

## 8. Discrepancies — the seed and the documents against the repo

1. **Seed header — "V2 §2.4 (`debate.js`…)".** The cockpit V2 discovery has no §2.4; its `debate.js` finding is **§2 Q9** (`:214-231`) and hazard 8 (`:327`). The anchors it quotes (`:88-90`, `:57`, `:203-215`) are exact at HEAD.
2. **Seed item 2 — "D-101's one-voice rule".** Ledger D-101 (`:501`) is the `VOICE_GROUNDING_MODE` tri-state. The one-voice rule is **spec V1.3 §1 R1** (`:21`) and hazard 2 of the Sep 7 discovery (`:354`).
3. **Seed header — spec V1.3 "§G4".** No such heading; the research seam labelled G4 is the Sep 7 discovery **§E** (`:258`). Spec §6 is "Chips and the receipt (G3)".
4. **Seed item 11 — "the doc-size budget from the Phase B discovery §3".** NOT FOUND. Phase B is the Heard stamp (D-52, `PHASE_A_SEED_BATTLE_VIEW_CONTROLLER_V1.md:16`) and has no discovery document in `docs/audits/`; no September discovery's §3 carries a doc-size budget. The in-repo budget is the 60 %-of-1 MiB warn line (`compute-index-intelligence.js:492`).
5. **Ledger D-101 "shipped `'off'`".** At HEAD the flag is **`'shadow'`** (`featureFlags.js:2137`, walk step 1, Sep 8 — its own docstring `:2117-2129`). Consequence for Phase C: the fundamentals mirror already rides every active battle's cache doc.
6. **Sep 7 discovery H21 / spec §12 — "no aggregation exists" / "the p50/p95 reader script (before gate 1)".** Both now exist: `api/scripts/gemma-latency-report.js` and `voice-grounding-harness.js`. Still unrunnable here (no `GCS_CREDENTIALS`); the *numbers* remain unmeasured.
7. **Seed item 1 — "`calculateAllIndicators`".** Two modules export that name with different signatures: `api/_utils/technicalCalculations.js:494` (used by `debate.js`) and `src/services/technicalIndicators.js:509`. The §4 copy class; report only.
8. **Sep 7 E14 anchors.** `rankingsMap` at `voice-layer-cache.js:741`, `:749-752` → at HEAD `:786`, `:794-797` (the ATR-fix drift the build Phase 0 predicted). E13's `debate.js` anchors are exact.
9. **Seed item 6 — "exhibit 3".** Not in the repo (an attachment to the Sep 7 discovery); its one quoted line is inherited here, not re-read.
10. **`file-directive.js:157` comment** cites "chat.js:409" for the grounded gate; at HEAD it is `chat.js:465`. Report only.
11. **Spec §3.5 / `CONTEXT_VINTAGE_SENTENCE` (`voiceLayerGrounding.js:287`) / `GROUNDED_TONE_DATA` (`:426`) — "the fundamentals are weekly".** The mirror's `computedAt` is the `peerRankings` doc's, written by `compute-rankings` **weekdays at 11:00 UTC** (`vercel.json` #7); the weekly job is `compute-estimates` (Saturday, #10), which feeds the forward estimates, not the mirror. The label is honest because it carries the date; the sentence is not.
12. **Seed A1 — "the fields".** `debate.js` uses six of the nine indicator groups and, of those, only the sign of MACD and the SMA20/50 comparison (`:122-128`, `:145-146`); Bollinger, EMA and SMA200 are computed and discarded.

---

## 9. Found outside the task — for separate tasking (BUILD_RULES §3; not fixed)

1. **`debate.js` renders a constant "MACD histogram: negative"** (`:123`, `:145`) because its 30-calendar-day window (`marketDataCache.js:221`) never reaches MACD's 35-candle minimum (`technicalCalculations.js:195`); `Above SMA50` is `N/A` for the same reason (`:20`). The cached `_technicals` docs written by `fetchTechnicals` (`:557-566`) carry the same nulls for every consumer that computes from the 30-day daily. A live honesty defect in a shipped (if unwired) route.
2. **`reviewBudgetUsed` is written to the battle doc at runtime** (`chat.js:359`, `:1002`) but is not declared by fenced `createAgentBattle` (`agentBattleService.js:262-263`): a top-level key added outside the fence before the doc-shape rule was written. For the founder's disposition, not a fix here.
3. **`debate.js:117` defaults the archetype to `'balanced'`**, which is not an archetype id (the six are `momentum_chaser, contrarian, diversifier, degen, analyst, guardian`, `screenStocks.js:41-43`).
4. **`file-directive.js:157` comment drift** (cites `chat.js:409`; the line is `:465`).

---

## 10. STOP

Phase 0 complete. Nothing implemented; no prompt text changed; no fenced file edited; no code touched. This report is the branch's only commit. A byte-identical copy was written first outside the repo tree (the session scratchpad) and then added as `docs/audits/20260908_PHASE_C_SHOW_IT_PHASE0_DISCOVERY.md`. The Phase C spec is not written here: it follows the founder's reading of §1, §4 (the cap ruling), §5 (whether to pre-compute) and §8 (the four seed references that do not resolve), with Sol's pass on §2.A2 and §4.

*Show it: the platform's own numbers, dated and attributed, in the character's voice — never a forecast, never a recommendation, never a decision.*
