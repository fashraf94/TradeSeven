# Cron Dispatcher Consolidation — Phase 0 Discovery (V1)

**Prerequisite A** to `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md` §10
**Date:** August 6, 2026
**Type:** Read-only discovery. No code changed, no cron touched, no consolidation performed. This report is the only artifact.
**Repo state at audit:** branch `claude/cron-dispatcher-discovery-7pyrof`, HEAD `0b40097`, clean tree. `git fetch origin` run at session start (BUILD_RULES §3); comparisons are against fetched refs.
**Method:** every `vercel.json` entry read against its handler file end-to-end; import chains traced to the fence; cross-cutting areas (orphans, fan-out, fence membership, scheduling primitives, indexes) audited separately. All load-bearing counts and fence chains re-verified by hand at source. Markers: **VERIFIED** = read at cited line this session; **ASSUMED** = inferred/platform-side.

---

## 0. Executive verdict (for the founder)

| Question | Answer |
|---|---|
| How many cron slots are in use? | **37 of 40** (VERIFIED by parsing `vercel.json` — **not** the "38–40" the brief assumed). 3 slots free today. |
| Any dead registrations to reclaim for free? | **Zero.** All 37 registrations point at a real handler that exports a working function and does real work. There is no free cleanup win. |
| Do the 3 restructure jobs fit *without* consolidation? | **Barely — and it's a trap.** 3 free slots exactly fit 3 new single-purpose crons (37→40), but that exhausts the platform ceiling and blows the BUILD_RULES §6 "≤2 new tournament crons" reserve. Zero margin left. |
| Do they fit *with* the low-risk consolidation below? | **Yes, with room to spare.** Low-risk (non-fenced) consolidation frees ~3–4 slots; building the 3 restructure jobs *behind a dispatcher* (the recommended path) costs 0–1 net slots. |
| Does a fan-out dispatcher already exist to copy? | **Yes** — `tournament-orchestrator` → `runOrchestratorTick` is a working in-process fan-out with pacing, per-target failure isolation, a 270 s budget-deferral, and idempotency markers. Extend it; don't invent one. But it reaches the fence, so it is not a clean template for the non-fenced jobs. |
| Is any of this "just plumbing"? | **No, not all of it.** 9 of the 11 scoring/eval/battle crons reach fenced code; consolidating the nightly settlement scorers or the intraday trading loop is **§7 fence contact**, not routine. The non-fenced janitors and draft-drivers are the safe wins. |
| Per-user rollover (D-37) scheduling — does anything like it exist? | **Nothing.** No per-user date trigger, no `portfolios` collection, no `rolloverDate` field anywhere. It is entirely net-new and needs a new Firestore index if built as a collection-group sweep. |

**Bottom line:** the slot crisis is milder than the charter feared (37, not 38–40), but the "reclaim dead crons for free" hope is empty. The durable fix is the dispatcher, exactly as the charter proposes. Sequence it non-fenced-first; the fenced settlement crons are a separate, §7-gated step.

---

## 1. Summary (8 bullets)

1. **Headroom: 37/40 registered, 3 free (VERIFIED).** Dead-registration reclaim = **0 slots** — every registered path resolves to a live, working handler. The season crons the charter flagged are *already unregistered* and consume nothing.
2. **The 3 restructure jobs (portfolio eval D-19, per-user rollover D-37, proactive triggers D-31) fit in the 3 free slots as single crons — but only exactly**, leaving zero margin and violating the §6 two-slot tournament reserve. This is why the dispatcher is a prerequisite, not a nicety.
3. **Low-risk consolidation can reclaim ~3–4 slots with zero fence contact:** merge the two weekly janitors (`fantasytimes/cleanup` + `ingest-cleanup`), merge the two `*/10` draft-drivers (`snake-draft-autopick` + `live-draft-fire`), and fold the scattered weekly compute jobs behind one day-gated weekly dispatcher.
4. **A fan-out dispatcher already exists and works:** `tournament-orchestrator` → `runOrchestratorTick` (`api/_utils/tournamentOrchestrator.js:946`) — ET-routed duties, per-seat try/catch + cooldown, ≥20 s pacing, a 270 s deadline that defers overflow to the next tick, two-grain idempotency markers. It is the pattern to extend. Two lighter fan-outs also exist (`scan-movers`→`generate-mover` in-process; `callArtDirector`→`art-director` dynamic-import).
5. **9 of 11 scoring/eval/battle crons reach the fence** (import-traced). The intraday trading loop (`agent-evaluate`) and the pre-market claim window (`process-draft-claims`) are the most timing-sensitive; the nightly settlement scorers (`baggerbomb-v4-daily-scores`, `agent-daily-scores`, `snake-draft-daily-scores`) reach fenced scoring math on an ordering-bound cadence. **Consolidating any of these is §7 fence contact.** `compute-rankings` and `compute-daily-baggerbomb-levels` are the two that do **not** reach the fence.
6. **No per-user scheduling primitive exists** (VERIFIED, zero grep hits for `rolloverDate`/`anniversary`/`nextRunAt`; no `portfolios` collection). D-37 is net-new. A daily "portfolios whose rollover date is today" sweep needs **no** index if it's a top-level single-equality query, but needs a **new** `COLLECTION_GROUP` index if it sweeps a per-user subcollection — none exists today (`fieldOverrides: []`).
7. **No shared idempotency, retry, or observability layer exists.** The reusable pieces are the `isAlreadyProcessedForDay` / `claimSystem.lastProcessedDay` per-day guard (the only guard imported across handlers) and the single distributed lock in `agent-evaluate` (`cronState.evaluatingAt`, 120 s lease). A dispatcher that retries or fans out per-user must bring its own idempotency key; there is no primitive to inherit. Success/failure is observable **only** via Vercel's own function logs + HTTP response bodies — no runs/status collection.
8. **Runtime budget is real and binding.** Plan is **Vercel Pro** (300 s function ceiling; `maxDuration:300` in four handlers). Two heavy pre-market crons (`compute-index-intelligence` 300 s + `compute-rankings` 180 s = 480 s) **cannot** serially share a dispatcher — the sum breaches the ceiling. Any serial fan-out inherits the *sum* of its handlers' runtimes; the settlement group and the heavy compute group each need explicit budget accounting before grouping.

---

## 2. Full cron inventory (Area A)

**Count reconciliation (VERIFIED):** 37 schedule entries = 37 Vercel slots. 36 unique path strings (only `/api/fantasytimes/ingest-earnings` appears twice as an identical path with two schedules). 31 unique **handler files** (query-param variants such as `generate-pulse?period=…` share one file). Platform ceiling **40** is ASSUMED (BUILD_RULES §6 "37/40"; consistent with `maxDuration:300` usage, which requires Pro) — the exact current Vercel cron quota is a dashboard fact only the founder can confirm.

`ET` below = America/New_York (EST = UTC−5, EDT = UTC−4). "DST-dual" = the schedule lists two comma-hours in **one** entry so one lands at the intended ET clock time year-round (this costs **one** slot, not two).

### Table A — identity, schedule, purpose, coupling

| # | Path | Schedule (UTC) → plain English | Handler file | Exists / works | maxDur | Long-run | Purpose (from code) |
|---|------|-------------------------------|--------------|:---:|:---:|:---:|---------------------|
| 1 | `/api/lobbies/cleanup-expired` | `*/15 9-23 * * 1-5` — every 15 min, 09–23 UTC, Mon–Fri | `api/lobbies/cleanup-expired.js` | ✅ `:293` | default | no | Lobby GC: disband under-filled Snake-Draft (`drafts`) & BaggerBomb-V3 (`battles`) waiting lobbies past grace; hard-delete disbanded >7 d. |
| 2 | `/api/cron/snake-draft-daily-scores` | `15 21 * * 1-5` — 21:15 UTC Mon–Fri (~post-close ET) | `api/cron/snake-draft-daily-scores.js` | ✅ `:443` | default | **yes** | Legacy Snake close-score recorder **+ 5 League-Tournament branches** (bank groups, CPU claims, complete pods, reconcile ledgers, aggregate leaderboards). |
| 3 | `/api/cron/snake-draft-autopick` | `*/10 * * * *` — every 10 min, 24/7 | `api/cron/snake-draft-autopick.js` | ✅ `:353` | 30 | no | Backup autopick for expired draft-pick deadlines; random asset; transactional. |
| 4 | `/api/cron/baggerbomb-v4-daily-scores` | `15 1 * * 2-6` — 01:15 UTC Tue–Sat (post-close) | `api/cron/baggerbomb-v4-daily-scores.js` | ✅ `:289` | default | no | Nightly BaggerBomb-V4 battle score banking (fenced `calculateAssetScoreV3`). First in overnight chain. |
| 5 | `/api/cron/compute-daily-baggerbomb-levels` | `30 1 * * 2-6` — 01:30 UTC Tue–Sat | `api/cron/compute-daily-baggerbomb-levels.js` | ✅ `:259` | default | no | Computes per-battle display **dollar levels** from thresholds + own EODHD closes. **Not fenced.** |
| 6 | `/api/cron/agent-daily-scores` | `45 1 * * 2-6` — 01:45 UTC Tue–Sat | `api/cron/agent-daily-scores.js` | ✅ `:208` | default | no | Nightly agent-layer settlement scoring (fenced `agentScoring`, `agentBattleService`). Writes `bankedBadgePoints` read next day by `agent-evaluate`. |
| 7 | `/api/cron/compute-rankings` | `0 11 * * 1-5` — 11:00 UTC Mon–Fri (pre-market) | `api/cron/compute-rankings.js` | ✅ `:1431` | 180 | **yes** | Stock-universe fundamentals/technicals ranking (`peerRankings`, `sectorRankings`, `scannerSummary`). **Not fenced.** |
| 8 | `/api/cron/process-draft-claims` | `25 13,14 * * 1-5` — DST-dual → ~9:25am ET pre-market | `api/cron/process-draft-claims.js` | ✅ `:529` | default | no | Overnight waiver-claim resolution (Snake + Tournament). **Canonical DST-window template** (`getClaimProcessingWindow`, `isAlreadyProcessedForDay`). |
| 9 | `/api/cron/compute-briefs` | `0 1 * * 0` — 01:00 UTC Sunday (weekly) | `api/cron/compute-briefs.js` | ✅ `:70` | 300 | **yes** | Weekly Perplexity-Sonar stock briefs for 61 non-Tier-1 symbols. |
| 10 | `/api/cron/compute-estimates` | `0 10 * * 6` — 10:00 UTC Saturday (weekly) | `api/cron/compute-estimates.js` | ✅ `:388` | 180 | **yes** | Weekly EODHD trends + earnings estimates cache (`estimatesCache/latest`). |
| 11 | `/api/fantasytimes/generate-pulse?period=pre_market` | `30 13,14 * * 1-5` — DST-dual → pre-market ET | `api/fantasytimes/generate-pulse.js` | ✅ `:93` | 60 | no | "Kai" market-pulse story (Claude + EODHD). Dedup = one per period/ET-day. |
| 12 | `/api/fantasytimes/generate-pulse?period=midday` | `0 16,17 * * 1-5` — DST-dual → midday ET | same file | ✅ `:93` | 60 | no | Midday pulse (same handler, `period` query). |
| 13 | `/api/fantasytimes/generate-pulse?period=post_close` | `15 20,21 * * 1-5` — DST-dual → ~4:15pm ET | same file | ✅ `:93` | 60 | no | Post-close pulse (same handler). |
| 14 | `/api/fantasytimes/generate-econ?mode=recap` | `0,30 13–21 * * 1-5` — every 30 min in session | `api/fantasytimes/generate-econ.js` | ✅ `:141` | 60 | no | "Neta" econ-print recap on release; referent-dedup → most fires are zero-model no-ops. |
| 15 | `/api/fantasytimes/generate-econ?mode=preview` | `0 1 * * 1` — 01:00 UTC Monday (weekly) | same file | ✅ `:141` | 60 | no | Weekly econ-week preview (Sonar + Sonnet). |
| 16 | `/api/fantasytimes/submit-earnings-batch` | `0 5 * * 1-5` — 05:00 UTC Mon–Fri (~midnight ET) | `api/fantasytimes/submit-earnings-batch.js` | ✅ `:72` | 60 | no | Enqueues Anthropic **Batch API** earnings previews (T+2..T+7). Producer for `poll-batch`. |
| 17 | `/api/fantasytimes/generate-recap` | `0 13,20,21,22,23 * * 1-5` — 13:00 + 20–23 UTC | `api/fantasytimes/generate-recap.js` | ✅ `:112` | 60 | no | "Doug" earnings-result recaps; ET-clock mode split; referent-dedup. |
| 18 | `/api/fantasytimes/poll-batch` | `*/15 * * * 1-5` — every 15 min Mon–Fri | `api/fantasytimes/poll-batch.js` | ✅ `:30` | **10** | no | Polls the async earnings Batch; publishes completed stories. Consumer of `submit-earnings-batch`. |
| 19 | `/api/fantasytimes/generate-column?type=preview` | `0 10,11 * * 1` — DST-dual → ~6am ET Monday | `api/fantasytimes/generate-column.js` | ✅ `:134` | 60 | no | Weekly Monday sector-preview column (Sonnet). |
| 20 | `/api/fantasytimes/generate-column?type=wrap` | `0 21,22 * * 5` — DST-dual → ~5pm ET Friday | same file | ✅ `:134` | 60 | no | Weekly Friday market-wrap column. |
| 21 | `/api/fantasytimes/cleanup` | `0 7 * * 1,4` — 07:00 UTC **Mon & Thu** | `api/fantasytimes/cleanup.js` | ✅ `:13` | 30 | no | Story/Wire retention janitor (expire published, delete aged). |
| 22 | `/api/fantasytimes/scan-movers` | `*/15 13–20 * * 1-5` — every 15 min in session | `api/fantasytimes/scan-movers.js` | ✅ `:246` | 60 | **yes** | Two-tick mover detection over full ticker universe; fans out to `generate-mover` per confirmed mover. |
| 23 | `/api/fantasytimes/ingest-earnings` | `30 23 * * 1-5` — 23:30 UTC Mon–Fri | `api/fantasytimes/ingest-earnings.js` | ✅ `:53` | 60 | **yes** | Ingest earnings-call claims (Sonar + Haiku), evening window. |
| 24 | `/api/fantasytimes/ingest-earnings` | `30 3 * * 2-6` — 03:30 UTC Tue–Sat | same file | ✅ `:53` | 60 | **yes** | Same handler, late-night/after-hours window (the **only** exact-duplicate path). |
| 25 | `/api/fantasytimes/ingest-econ` | `45 14,18,22 * * 1-5` — data-release windows | `api/fantasytimes/ingest-econ.js` | ✅ `:90` | 60 | no | Ingest fed/econ-event claims into `ingestedClaims`. |
| 26 | `/api/fantasytimes/ingest-cleanup` | `0 8 * * 0` — 08:00 UTC Sunday (weekly) | `api/fantasytimes/ingest-cleanup.js` | ✅ `:12` | 30 | no | Delete expired `ingestedClaims` (per-source TTL). |
| 27 | `/api/cron/compute-index-intelligence` | `30 10,11 * * 1-5` — DST-dual → ~6:30am ET | `api/cron/compute-index-intelligence.js` | ✅ `:543` | **300** | **yes** | Pre-market index + full-universe technicals; stamps fenced `arch_scores` onto `stockRankings`. Heaviest cron. |
| 28 | `/api/cron/compute-index-intelligence?mode=intraday` | `0 14–20 * * 1-5` — hourly in session | same file | ✅ `:543` | 300 | **yes** | Intraday refresh of the same docs (real-time quotes; `mode` query). |
| 29 | `/api/cron/agent-evaluate` | `*/15 13–21 * * 1-5` — every 15 min in session | `api/cron/agent-evaluate.js` | ✅ `:160` | **300** | **yes** | **Intraday agent trading loop** (Haiku decisions, fenced swap/risk/guardrail execution). Highest calibration sensitivity. |
| 30 | `/api/cron/process-pending-reflections` | `*/15 13–00 * * *` — every 15 min, 7 days | `api/cron/process-pending-reflections.js` | ✅ `:33` | 60 | **yes** | Drains `pendingReflection` queue (Sonnet) + Wire sweep + Sunday editorial. Fenced via `reflect.js`. |
| 31 | `/api/cron/voice-layer-cache` | `*/15 13–20 * * 1-5` — every 15 min in session | `api/cron/voice-layer-cache.js` | ✅ `:649` | 60 | **yes** | Precompute per-battle voice-layer briefs (market-open-gated). Fenced `agentScoring` reads. |
| 32 | `/api/cron/agent-batch-review` | `25 20,21 * * 1-5` — post-close DST-dual | `api/cron/agent-batch-review.js` | ✅ `:367` | 60 | **yes** | Post-close per-battle review (Haiku) + Gemma debrief. Fenced label/config reads only. |
| 33 | `/api/cron/compute-institutional-intelligence` | `0 1,2 * * 1` — Monday weekly, DST-dual | `api/cron/compute-institutional-intelligence.js` | ✅ `:58` | 120 | **yes** | Weekly institutional-holdings aggregation (~2690 EODHD calls cold; 110 s self-break). **Not fenced.** |
| 34 | `/api/cron/compute-daily-regime-brief` | `30 12 * * 1-5` — 12:30 UTC Mon–Fri | `api/cron/compute-daily-regime-brief.js` | ✅ `:73` | 60 | no | Daily regime brief (Sonnet + Sonar/EODHD calendars). Per-day guard. **Not fenced.** |
| 35 | `/api/cron/promote-discover-themes` | `0 10,11 * * 1` — Monday weekly, DST-dual | `api/cron/promote-discover-themes.js` | ✅ `:54` | 30 | no | Promote a random 3 `discoverThemes` live for the week. Trivial. **Not fenced.** |
| 36 | `/api/cron/tournament-orchestrator` | `*/10 11–14,21–23 * * 1-5` — every 10 min, two windows | `api/cron/tournament-orchestrator.js` | ✅ `:36` | **300** | **yes** | **The existing fan-out dispatcher.** ET-routed duties (Monday pipeline / weekday fanout / Friday advancement) + training sweeps; deploys to fenced `decide.js`. |
| 37 | `/api/cron/live-draft-fire` | `*/10 * * * *` — every 10 min, 24/7 | `api/cron/live-draft-fire.js` | ✅ `:36` | 60 | no | Fires/drives live slot-draft pods (flag `LEAGUE_LIVE_DRAFT`). Fenced archetype reads (read-only). Currently inert (no slot groups exist). |

### Table B — dependencies, market-coupling, fence, idempotency, failure-isolation (Area A + C inputs)

| # | Path | External APIs | Firestore written (key) | Market-hours coupling | Fenced-adjacent | Idempotent? | Isolates own failures? | Assumes another cron ran? |
|---|------|---------------|-------------------------|----------------------|:---:|:---:|:---:|---|
| 1 | lobbies/cleanup-expired | — | `drafts`, `battles` | none (wall-clock) | no | yes (status-flip) | per-doc try/catch | no |
| 2 | snake-draft-daily-scores | EODHD | `drafts`, `tournamentGroups`, `tournamentLeaderboards`, ledgers | **strong** (ET holiday cal, post-close) | **YES** (`tournamentUserScoring`⊕`agentScoring`⊕`archetypeScoring`) | yes (per-day `recorded`) | 5 branches each try/caught | internal order load-bearing; feeds next-day claims |
| 3 | snake-draft-autopick | — | `drafts` | anchor only (no firing gate) | no | yes (in-tx revalidate) | per-draft try/catch | no (backup to client) |
| 4 | baggerbomb-v4-daily-scores | EODHD | `battles` | `isTradingDay` gate | **YES** (concept `calculateAssetScoreV3`) | yes (per-day `recorded`) | per-battle try/catch | first in nightly chain |
| 5 | compute-daily-baggerbomb-levels | EODHD | `battles` | own `isTradingDay` (**divergent holiday list**) | **no** | yes (overwrite) | per-battle try/catch | soft (no hard read of #4) |
| 6 | agent-daily-scores | EODHD | `agentBattles` | `isTradingDay` gate | **YES** (`agentScoring`, `agentBattleService`, `agentEvalPromptAssembly`) | yes (per-day `recorded`) | per-battle try/catch | producer for `agent-evaluate` |
| 7 | compute-rankings | EODHD | `peerRankings`, `sectorRankings`, `scannerSummary`, `priceHistory` | none in code | **no** | yes (overwrite + date-dedup) | partial (persist is monolithic) | soft: scanner reads `estimatesCache` (#10) |
| 8 | process-draft-claims | EODHD | `drafts`, `tournamentGroups`, `fantasyTimesConsensus` | **strong** (DST window 9:20–9:35 ET) | **YES** (`agentScoring` via ledger) | yes (`lastProcessedDay`) | branches try/caught | soft: reads waiver priority from #2 (has fallback) |
| 9 | compute-briefs | Perplexity Sonar | `stockBriefs` | none | **no** | yes (overwrite) | per-stock try/catch; **no outer catch** | no |
| 10 | compute-estimates | EODHD | `estimatesCache` | none | **no** | yes (overwrite + floor guard) | full try/catch + retries | no |
| 11–13 | generate-pulse (×3) | EODHD, Anthropic | `fantasyTimesStories`, Wire | **strong** (holiday skip, ET dedup) | **no** | yes (per-period/ET-day dedup) | outer + per-substep try/catch | soft (index-intel, consensus) |
| 14–15 | generate-econ (×2) | EODHD/Sonar, Anthropic | `fantasyTimesStories`, `fantasyTimesConsensus`, Wire | **strong** (recap); weak (preview) | **no** | yes (referent dedup) | outer + substep try/catch | soft (ingestedClaims) |
| 16 | submit-earnings-batch | EODHD, Anthropic Batch | `fantasyTimesBatches` | holiday-gated only | **no** | **weak** (no per-day guard) | outer try/catch | producer for #18 |
| 17 | generate-recap | EODHD, Anthropic | `fantasyTimesStories`, Wire | **strong** (ET mode split) | **no** | yes (referent dedup) | outer + substep try/catch | soft |
| 18 | poll-batch | Anthropic Batch | `fantasyTimesStories`, `fantasyTimesBatches` | none | **no** | reasonably safe (status transition) | per-batch + per-result try/catch | **consumer of #16** |
| 19–20 | generate-column (×2) | EODHD, Anthropic | `fantasyTimesStories`, Wire | weak/moderate (holiday, ET dedup) | **no** | yes (per-type/ET-day dedup) | outer + substep try/catch | soft: `sectorRankings` (#7), week stories |
| 21 | fantasytimes/cleanup | — | `fantasyTimesStories`, Wire | none | **no** | yes | outer + Wire-isolating catch | no |
| 22 | scan-movers | EODHD, Anthropic, Sonar, Exa | `moverCandidates`, `fantasyTimesStories` | **strong** (holiday, ET boundary) | **no** (doc-comment only) | yes (atomic compare-and-set) | per-symbol try/catch | self-chains across ticks |
| 23–24 | ingest-earnings (×2) | EODHD, Sonar, Haiku | `ingestedClaims` | holiday-gated, after-close | **no** | mostly (weak dedup `limit:1`) | outer + per-item results | no (producer) |
| 25 | ingest-econ | Sonar, Haiku | `ingestedClaims` | holiday-gated, release windows | **no** | **weaker** (`limit:1`, non-det Sonar) | outer + per-event results | no (producer) |
| 26 | ingest-cleanup | — | `ingestedClaims` (deletes) | none | **no** | yes | outer + internal catch | no |
| 27–28 | compute-index-intelligence (×2) | EODHD | `indexIntelligence`, `stockTechnicalScores`, `stockRankings` | partial (DST-dual; mode by query) | **YES** (`archetypeScoring`; producer of fenced scoring shapes) | yes (overwrite) | Promise.allSettled per-symbol; monolithic commit | soft: reads `peerRankings` (#7) |
| 29 | agent-evaluate | Anthropic Haiku, EODHD, Gemma | `agentBattles`, ledger | **strong** (`isMarketOpen` gate) | **YES (heaviest — 7 fence files direct)** | per-battle **lock** (`evaluatingAt` 120 s) | strong per-battle + per-sweep | consumes `indexIntelligence` (#27); produces for #6/#32 |
| 30 | process-pending-reflections | Anthropic Sonnet | `agentBattles`, `agents`, Wire, `wireEditorial` | none (7-day) | **YES** (`agentScoring` via `reflect.js`) | yes (queue-flag, cleared on success) | strong 3-tenant isolation | producer: `agent-evaluate` sets the flag |
| 31 | voice-layer-cache | EODHD | `voiceLayerCache` | **yes** (`getMarketState` gate) | **YES** (`agentScoring`, `agentBattleService`) | yes (overwrite) | **partial** (no per-battle catch; monolithic commit) | reads `indexIntelligence` (#27), `cronState` (#29) |
| 32 | agent-batch-review | Anthropic Haiku, Gemma, EODHD | `agentBattles`, `agents` | timed near close (no gate) | **YES** (label/config only) | effective (schedule-spaced, no lock) | per-battle try/catch | consumes #29 same-day output |
| 33 | compute-institutional-intelligence | EODHD | `institutionalHoldings`, `institutionalAggregates` | none | **no** | yes (overwrite; partial-run caveat) | per-symbol; **aggregate tail has no catch** | soft (warm cache) |
| 34 | compute-daily-regime-brief | Anthropic Sonnet, Sonar, EODHD | `indexIntelligence/dailyRegimeBrief` | none (UTC per-day key) | **no** | **strong** (per-day guard) | fetchers settle individually | soft: reads `marketContext` (#27) |
| 35 | promote-discover-themes | — | `discoverThemes` | none | **no** | idempotent-but-nondeterministic | single outer catch | no |
| 36 | tournament-orchestrator | Anthropic, HTTP→`decide.js` | `tournamentOrchestrator/state`, `tournamentGroups`, `agentBattles` | **strong** (ET duty routing) | **YES** (`agentScoring`, `archetypeScoring`, + deploys to fenced `decide.js`) | yes (two-grain markers) | strong layered (sweeps + per-seat) | Fri advancement waits on #2 banking |
| 37 | live-draft-fire | — | `tournamentGroups`, draft state/streams | anchor only (date-based) | **YES** (`archetypeScoring`, read-only) | yes (crash-safe resume) | per-group try/catch | soft handoff to #36 flip |

**Totals:** 37 slots registered · platform ceiling 40 (ASSUMED Pro) · **3 slots headroom** · 0 dead registrations.

---

## 3. Dead and orphaned registrations (Area B) — the (empty) cheap-win column

### B.1 — Registrations pointing at missing or do-nothing handlers: **NONE**
Every one of the 37 registered paths resolves to a handler file that exists and exports a working `export default async function handler` (verified per-row in Table A). **There are zero dead registrations to reclaim.** The charter's framing — "dead registrations are the cheapest slots available, report them first" — turns up empty here: the cheap tier is 0 slots. All headroom beyond the current 3 free slots must come from consolidation.

*Nuance:* `live-draft-fire` (#37) is registered, flag-ON, but **effectively inert** — no `isLiveDraft` slot groups exist until the Phase-4 picker ships, so its queries return empty (`api/cron/live-draft-fire.js:45,64`). It is built-ahead code, not dead code; de-registering it would remove a shipped-dark feature, not reclaim waste.

### B.2 — Handler files that look like crons but are NOT registered (shelved code that appears live)

| File | State | Evidence |
|---|---|---|
| `api/cron/season-daily-evaluate.js` | **DEAD** — present, exports handler `:109`, CRON_SECRET-guarded `:111`, **unregistered** | Absent from `vercel.json` (grep `season` → none). Pipeline fns (`executePipeline`/`settleDay`/`buildDailyLog`/`buildEvaluationContext`) have zero call sites outside the file. |
| `api/cron/season-pit-stop-manage.js` | **DEAD** — present, exports handler `:68`, `?action=open|lockin` routing, **unregistered** | Same. Also listed in `archetypeImportBoundaryBaseline.json:33` (a *different* §2.3 gate, not an invoker). |
| `api/fantasytimes/backfill-visuals.js` | **DEAD** — one-time backfill, CRON_SECRET-guarded GET, **unregistered, zero invokers** | grep `backfill-visuals` repo-wide → only the file itself. |

**Season-mode verification (Area B.3), both ends:** the two season crons are the **only** unregistered handlers in `api/cron/` (19 of 21 files registered — VERIFIED). Both handlers are present and export real, CRON_SECRET-guarded handlers, but **nothing in the repo invokes or schedules them**: every repo reference is a comment or doc cross-reference (`api/season/create-entry.js:25`, `api/_utils/seasonCalendar.js:10,13`, `api/_utils/shadowLogger.js:79`, `docs/BUILD_RULES.md:77`, `docs/SIGNAL_INVENTORY_V2.md`, FORGE specs) — none an import or fetch. Their three schedule entries were removed Jun 4, 2026 by commit `d80aee25` (40→37). **The stale-header trap the charter warned about is already fixed:** `season-daily-evaluate.js:9-19` now honestly states "⚠ NOT SCHEDULED — THIS HANDLER DOES NOT RUN" and documents the falsified-schedule history. Season mode is scrapped permanently per founder ruling C-19; handlers retained un-scheduled by choice. **They consume zero slots** — reclaiming them frees nothing on the budget.

> **The one caveat only the founder can close** (carried from `SIGNAL_INVENTORY_V2.md:72`): both handlers accept `Bearer ${CRON_SECRET}`, so an out-of-repo caller holding that secret (a Vercel-dashboard cron or third-party pinger) *could* invoke them. Nothing in the repo does, and nothing at HEAD schedules them, but a dashboard-side schedule is not visible from source. Worth a 10-second dashboard check.

### B.4 — Duplicate or subsumed work: **NONE fully superseded**
The only exact-duplicate path (`ingest-earnings`, entries 23 & 24) fires at two genuinely different windows (evening 23:30 UTC + late-night 03:30 UTC) to catch after-hours earnings across the session — both do real, distinct work. The other multi-entry handlers (`generate-pulse`, `generate-econ`, `generate-column`, `compute-index-intelligence`) branch on a query param into genuinely different work. No cron's output is fully redundant with another's.

### B.5 — Non-cron handlers under the cron directories (for completeness, not reclaim)
These *look* adjacent but are not scheduled jobs and are correctly unregistered: `generate-macro.js` (client-POST only, `src/services/fantasyTimesDetector.js:216`), `generate-mover.js` (**fan-out target** of `scan-movers`), `art-director.js` (**fan-out target** via dynamic import), `feed.js` / `story/[id].js` / `deepdive/[id].js` (user-facing client routes), `ingest-deepdive.js` (external Vera intake, `VERA_INGEST_SECRET`, driven by `scripts/ingest-vera.js`), `test-art-director.js` / `test-ingestion.js` (manual debug endpoints).

---

## 4. Existing dispatcher / fan-out patterns (Area D) — the pattern to extend

**Three fan-out shapes exist today; the first is the template.**

### D.1 — `tournament-orchestrator` → `runOrchestratorTick` (the real dispatcher)
`api/cron/tournament-orchestrator.js:23,46` is a thin auth+entry wrapper that calls `runOrchestratorTick(db, …)` in `api/_utils/tournamentOrchestrator.js:946`. That function is a **two-level in-process fan-out**:
- **Dispatch level:** `getDutyForInstant` (`:121`) routes each 10-min tick by ET wall-clock to exactly one duty — `runMondayPipeline` / `runWeekdayFanout` / `runFridayAdvancement` / SKIP — plus four inline training sweeps (`sweepIdleDraftingPods`, `flipAwaitingOpenPods`, `expireStaleTrainingPods`, `sweepTrainingActivation`).
- **Deploy level:** `fanOutDeploys` (`:362`) builds a per-seat request (`buildDeployRequest:270`) and issues an **internal HTTP POST** to `${base}/api/agent/decide` with `Authorization: Bearer CRON_SECRET`, up to 6 agent seats × N groups.

**Why it's the template (all VERIFIED):**
- **Failure isolation:** each training sweep is independently try/caught (`:983-1027`); each per-seat deploy is try/caught (`:412-441`) — a failed seat sets a ≥10-min cooldown and the loop continues. One bad target never aborts the batch.
- **Budget deferral:** `DUTY_DEADLINE_MS = 270_000` (`:102`) stops issuing new work at 270 s (of the 300 s `maxDuration`) and defers the remainder to the next tick — the correct answer to "a serial dispatcher inherits the sum of runtimes."
- **Pacing:** `DEPLOY_PACING_MS = 20_000` (`:101`) throttles real deploys.
- **Idempotency:** two-grain markers (per-duty/ET-date on `tournamentOrchestrator/state`, plus per-entity natural guards); a `battleCreated:false` response is scored "skipped," not "deployed," so a no-op can't masquerade as success.

**Caveat that makes it a template only for the *fenced* jobs:** the orchestrator itself is fenced-adjacent — it imports `flattenPortfolioServer` from `agentScoring.js` (`:87`) and reaches `archetypeScoring.js` via `trainingLifecycle.js:70`, and it deploys into the fenced `decide.js`. Its *mechanics* (pacing, deferral, isolation, markers) are exactly what a new non-fenced dispatcher should copy; its *fence reach* is not something to inherit for the non-fenced janitor/generator jobs.

### D.2 — `scan-movers` → `generate-mover` (in-process single-target fan-out)
`scan-movers.js:11` imports `generateAlexMoverStory` and calls it once per confirmed mover inside `runMoverScan`. Per-symbol try/catch; exactly-once via atomic compare-and-set on `moverCandidates`. A simpler, non-HTTP fan-out — useful precedent for "one dispatcher, many same-shape targets."

### D.3 — `callArtDirector` → `art-director.js` (dynamic-import fan-in)
`api/_utils/fantasyTimesVisuals.js:203` does `await import('../fantasytimes/art-director.js')` as a best-effort, post-publish enrichment reached from seven generators + `poll-batch`. Failure degrades to `getDefaultVisual`, never rolls back the story. Precedent for "optional, isolated sub-step."

### D.4 — Success/failure signalling, retry, locking (Area D.2/D.3)
- **Observability:** there is **no** runs/status/health collection anywhere (VERIFIED — zero collection writes for `cronRuns`/`jobRuns`/`lastRunAt`). Handlers signal only via (a) structured, `LOG_PREFIX`-tagged, ISO-timestamped `console.log` and (b) the HTTP JSON response body (`{success, processed, skipped, errors, durationMs}`), both surfaced through Vercel's own function logs. A dispatcher that fans out must invent its own per-target result ledger; there is nothing to inherit.
- **Idempotency:** no generic helper. The one reused guard is `isAlreadyProcessedForDay(claimSystem, currentDay)` / `claimSystem.lastProcessedDay` (`process-draft-claims.js:126,311,488`), imported as-is by `tournamentClaims.js:39`. Everything else rolls its own per-day field (`forDate`, `dailyReviews[].date`, `currentTradingDay`, per-battle `recorded`).
- **Locking:** exactly **one** distributed lock — `agent-evaluate.js:544-577` acquires a per-battle `cronState.evaluatingAt` lease via `db.runTransaction` with a 120 s staleness timeout. Every other `runTransaction` is a compare-and-set state mutation, not a lock lease. **Per-user rollover (D-37) will need a lock/lease pattern that does not exist yet.**
- **Retry:** Vercel Cron does not auto-retry and the repo adds no framework. Re-fire safety is entirely the idempotency guards + the one lock; the intentional DST double-fires are deduped by early-exit window guards.

---

## 5. Consolidation grouping analysis (Area C) — recommendations only

For each proposed group: **schedule compatibility · runtime budget vs 300 s · failure isolation · ordering · idempotency**, then a risk rating. **No grouping is implemented.**

### Group 1 — Weekly janitors · **RISK: LOW (recommended first)**
**Members:** `fantasytimes/cleanup` (#21, Mon/Thu 07:00), `ingest-cleanup` (#26, Sun 08:00). *(Optionally the daily portion of `lobbies/cleanup-expired` — but its `*/15` cadence is required for the +5 min disband grace, so it should stay separate.)*
- **Schedule:** both weekly-ish, different days → a single "maintenance dispatcher" firing daily and self-gating by weekday folds both into one slot. **Save ~1 slot.**
- **Runtime:** 30 s + 30 s well under 300 s even if co-fired.
- **Isolation:** both fully idempotent (delete/expire aged docs), independently failable, zero ordering deps, non-fenced. **Clean.**
- **Idempotency:** native (re-run finds fewer docs).

### Group 2 — `*/10` draft-drivers · **RISK: LOW–MEDIUM (recommended second)**
**Members:** `snake-draft-autopick` (#3, non-fenced), `live-draft-fire` (#37, fenced **read-only** archetype config, flag-gated, currently inert).
- **Schedule:** both `*/10 * * * *` 24/7 — identical cadence, a natural merge into one `*/10` draft-lifecycle dispatcher. **Save ~1 slot.**
- **Runtime:** 30 s + 60 s ≤ 300 s.
- **Isolation:** both crash-safe/idempotent (in-transaction revalidation; resume-on-reentry), both per-draft try/catch. No ordering dep.
- **Fence:** `live-draft-fire` reaches `archetypeScoring`/`agentArchetypeConfig` read-only for CPU seeding — **§1 fence contact to disclose in the PR, but not a §7 blocker** (no scoring math, no swap execution). Rated LOW–MEDIUM only because it touches fenced imports at all.

### Group 3 — Weekly compute jobs · **RISK: LOW–MEDIUM**
**Members:** `compute-briefs` (#9, Sun 01:00, 300 s), `compute-estimates` (#10, Sat 10:00, 180 s), `compute-institutional-intelligence` (#33, Mon 01:00, 120 s), `generate-econ?preview` (#15, Mon 01:00), `promote-discover-themes` (#35, Mon 10:00), `generate-column?preview` (#19, Mon 10:00). All **non-fenced**.
- **Schedule:** all weekly, spread across Sat/Sun/Mon → one weekly dispatcher firing daily, gating each member by its day. **Save ~2–3 slots.**
- **Runtime — the constraint:** `compute-briefs` (300 s) and `compute-estimates` (180 s) **cannot co-fire serially** (480 s > 300 s). Because they fall on *different days* (Sun vs Sat), a day-gated dispatcher never runs both in one invocation — so the group is viable **only** if the dispatcher preserves their day separation. Report this explicitly; a naïve "run all weekly jobs Sunday" breaks the budget.
- **Isolation:** all idempotent by overwrite; independently failable. `compute-briefs` has **no outer try/catch** (#9) — wrap it before it rides a shared dispatcher, or a pre-loop throw 500s the whole tick.

### Group 4 — FantasyTimes session generators · **RISK: MEDIUM**
**Members:** `generate-pulse` ×3 (#11–13), `generate-econ?recap` (#14), `generate-recap` (#17), `generate-column?wrap` (#20). All **non-fenced**, all dedup-idempotent, all market-coupled.
- **Schedule:** these already self-gate by ET-clock dedup, so a single "reporter dispatcher" firing on the union grid (every 30 min in session) and calling each handler — each a no-op when its window/dedup says so — is behaviorally safe. **Potential save ~4–5 slots** (7 entries → 1–2).
- **Runtime:** each 5–30 s; worst-case serial sum on a busy session tick (pulse + econ-recap + recap) ≈ 60–90 s < 300 s. Acceptable but must be measured, not assumed.
- **Isolation:** all have outer + per-substep try/catch → independently failable inside a dispatcher.
- **Why MEDIUM not LOW:** these are LLM-cost and market-timed. Collapsing their firing model changes *when* paid model calls happen and concentrates cost/latency on shared ticks. No fence contact, but a product/cost decision, not pure plumbing.

### Group 5 — Ingest producers · **RISK: MEDIUM–LOW**
**Members:** `ingest-earnings` ×2 (#23–24), `ingest-econ` (#25). Non-fenced, producers into `ingestedClaims`.
- **Schedule:** timed to specific release/after-close windows; a dispatcher firing on the union with per-handler self-gating folds them. **Save ~1–2 slots.**
- **Idempotency weakness to fix first:** both dedup with `getClaimsForTicker(..., {limit:1})` (#25 also regenerates a non-deterministic Sonar set), so re-fires can re-ingest in edge cases. Harden dedup **before** placing them behind a retrying dispatcher.

### Group 6 — Nightly settlement scorers · **RISK: HIGH — §7 FENCE CONTACT**
**Members:** `baggerbomb-v4-daily-scores` (#4, 01:15), `compute-daily-baggerbomb-levels` (#5, 01:30), `agent-daily-scores` (#6, 01:45), and the tournament-banking branches inside `snake-draft-daily-scores` (#2, 21:15).
- **Schedule:** #4/#5/#6 share the same overnight window with a natural ordering (scores → levels; scores → agent) — the most *obvious* consolidation by cadence.
- **But:** #4 reaches `calculateAssetScoreV3`, #6 reaches `agentScoring`, #2 reaches the fence **file** `tournamentUserScoring.js` — consolidating their *timing/ordering* is **§7 fence contact** (see §6). #5 (`levels`) is the one **non-fenced** member and has **no hard data dependency** on #4 (it fetches its own closes), so it can be pulled *out* of the fenced group into Group 1/3 — but note its **divergent holiday list** (omits Juneteenth) is a real correctness bug to fix separately, not to bury in a merge.
- **Runtime:** #4/#5/#6 all run at the account default (no explicit `maxDuration`); a serial dispatcher summing them must set an explicit `maxDuration` and prove the sum fits — unverified today.
- **Recommendation:** **do not** consolidate this group as routine plumbing. If pursued, it is a founder-gated §7 step with its own calibration sign-off.

### Groups NOT recommended for consolidation
- `agent-evaluate` (#29) — intraday fenced trading loop; timing *is* the calibration. Never batch.
- `process-draft-claims` (#8) — DST pre-market fairness window + fenced reach. §7.
- `compute-index-intelligence` (#27/#28, 300 s each) + `compute-rankings` (#7, 180 s) — the two heaviest pre-market jobs; **their sum breaches the 300 s ceiling**, so they cannot serially share a dispatcher regardless of risk.
- `tournament-orchestrator` (#36) — already the dispatcher; extend it, don't fold it into another.

---

## 6. Fenced-adjacent scheduling flags (Area E)

**Fence membership (verified from the repo).** There is **no** authoritative machine-readable fence registry — BUILD_RULES §1 prose (11 files) is the source of truth. The closest machine-readable arrays are the Invariant-R `FORBIDDEN_IMPORTERS` lists (`src/data/archetypeRuleCompatibility.test.js:281-288`, `src/services/ruleCompatGuard.test.js:288-295`), which serve a *different* gate ("ruleCompat guards must not be imported by fenced files") and **enumerate only 8** — missing `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js` (all added/confirmed Jul 24, 2026). One even hard-codes a stale comment: *"The eight fenced files (BUILD_RULES §1)."* **This drift is a contradiction (§8), low-risk for enforcement but a factual misstatement of current §1.** All 11 §1 fence files VERIFIED present on disk. `archetypeImportBoundaryBaseline.json` is the separate §2.3 gate, not a fence list. `decide.js` is imported by **no** production module — no cron reaches it directly (the orchestrator reaches it only via internal HTTP deploy).

**Reach + timing sensitivity (import-traced, spot-verified at source):**

| Cron | Reaches fence? (chain) | Would firing 10 min later / batching change outcomes? | Consolidation posture |
|---|---|---|---|
| `agent-evaluate` #29 | **YES — 7 files direct** (`agentScoring`, `agentEvalPromptAssembly`, `agentBattleService`, `agentSwapExecution`, `agentGuardrails`, `agentRiskManager`, `agentArchetypeConfig`; `:20,22-26,28-34,37,53,55,59`) | **YES, HIGH** — 15-min tick grid drives intraday quote/VWAP state and per-tick swap execution across 5 `executeSwapServer` sites. | **§7. Never batch.** |
| `process-draft-claims` #8 | **YES** — `agentScoring` via `tournamentClaims.js:46`→`tournamentAgentLedger.js:56` | **YES, HIGH (window)** — DST 9:20–9:35 ET pre-market window is fairness-critical; a shift can push resolution past open. | **§7.** Strongest hazard of the pre-market group. |
| `snake-draft-daily-scores` #2 | **YES — fence FILE** `tournamentUserScoring.js` via `tournamentBanking.js:43` (**verified**); + `agentScoring` via ledger; + `archetypeScoring`/`agentArchetypeConfig` | **MODERATE–HIGH** — end-of-day banking→reconcile→leaderboard order is load-bearing; must run on settled closes. | **§7** (touches a fence file in a settlement path). |
| `baggerbomb-v4-daily-scores` #4 | **YES — concept** `calculateAssetScoreV3` (`:24`, verified) | **MODERATE–HIGH** — first in the nightly chain; downstream levels/agent assume its scores; needs settled prices. | **§7** (executes the fenced scoring concept — the §4 local-copy hazard class). |
| `agent-daily-scores` #6 | **YES** — `agentScoring`, `agentBattleService`, `agentEvalPromptAssembly` (`:23,27-30,31`) | **MODERATE** — daily ordering after prices settle; exact minute matters less than ordering + per-day idempotency. | **§7** (fenced settlement call). |
| `tournament-orchestrator` #36 | **YES** — `agentScoring` (`util:87`), `archetypeScoring` (via `trainingLifecycle:70`), + deploys to `decide.js` | **MODERATE–HIGH** — draft-resolution windows are ET-anchored; Fri advancement waits on #2 banking. | **§7** (windowed + fenced deploy). |
| `voice-layer-cache` #31 | **YES** — `agentScoring`, `agentBattleService` (`:11-16`) | **LOW–MODERATE** — precompute cache; market-open-gated; overwrite-idempotent. | Read-only fenced reads; low calibration risk but **§1 contact to disclose**. |
| `process-pending-reflections` #30 | **YES** — `agentScoring` via `reflect.js:16` | **LOW** — idempotent queue drain; 10-min delay just delays narrative. | Routine timing; **§1 contact to disclose**, no §7 for scheduling. |
| `agent-batch-review` #32 | **YES — labels/config only** (`agentBattleService`, `agentEvalPromptAssembly`; `agentArchetypeConfig` via `voiceLayerPrompt`) | **LOW** — reads fenced *labels*, no scoring/execution. | Routine timing; **§1 contact to disclose**. |
| `live-draft-fire` #37 | **YES — read-only** `archetypeScoring`/`agentArchetypeConfig` (via `liveDraftLifecycle`→`trainingLifecycle:70`) | **MODERATE (UX not calibration)** — delays a user draft by a cycle. | Read-only fence; product call, not §7. |
| `compute-rankings` #7 | **NO** — only `rankingConfig`/`rankingHelpers` | n/a | **Not fenced.** Refutes the "daily-scores must precede rankings" hypothesis — no import coupling. |
| `compute-daily-baggerbomb-levels` #5 | **NO** — firebase-only; inline multiplier ladder | n/a | **Not fenced** (but the inline ladder is a §4 local-copy pattern — triage separately). |

**Rule of thumb for the founder:** any consolidation that changes *when* or *in what order* #2, #4, #6, #8, #29, #31, #36 fire is **fence contact requiring a §7 sign-off**, because it can move calibrated scoring/trading outcomes even though the change is "just scheduling." Only #5, #7 among the scoring-adjacent set, plus the janitors/drivers in §5 Groups 1–2, are safe to reschedule as routine plumbing.

---

## 7. Per-user scheduling assessment (Area G — overlaps Spec 1 Phase 0 B.3)

*This item is answered here from the **scheduling** side; the Spec 1 audit answers it from the **schema** side. Noting the overlap per the brief rather than duplicating depth.*

**G.1 — Does anything trigger work by a user's own date today? DEFINITIVELY NO (VERIFIED).**
All 37 crons are fixed platform-wide UTC schedules; every handler selects work by querying *all* active domain docs and gating each against a single platform "today" (ET), never a per-user stored date. Grep for `rolloverDate|anniversaryDate|nextRollover|renewalDate|nextBillingDate|scheduledFor|nextRunAt|dueDate` → **zero hits** in `api/` and `src/`. "rollover" appears only as a bot persona (`RollOver_Rachel`), ET date-rollover comments, and "no rollover" for chat budget. **No `portfolios` collection is referenced in code at all.** The closest pattern is season-mode's per-entry `tradingCalendar.date === todayStr` check (`season-daily-evaluate.js:154`) — but that is (a) dead and (b) still a platform-wide sweep gated on one ET "today," not a per-user anniversary. **D-37 per-user anniversary processing is entirely net-new.**

**G.2 — What the sweep pattern would look like, and the index it needs.**
The natural D-37 shape is a **daily platform cron that queries "portfolios whose rollover date is today"** and processes each hit (the sweep pattern, matching every existing handler's "query-all-active, gate-on-today" idiom — no new *scheduling* primitive required for the trigger itself). The index requirement depends on the collection shape:

| Query shape | New index needed? | Detail |
|---|---|---|
| Top-level `portfolios`, single equality: `.where('rolloverDate','==', today)` | **No** | Firestore auto-maintains collection-scoped single-field indexes; `firestore.indexes.json` only declares composites. Nothing to add. |
| Collection-group sweep of a per-user subcollection: `.collectionGroup('portfolios').where('rolloverDate','==', today)` | **YES — a new `COLLECTION_GROUP` single-field index** | The 28 existing indexes are **all** `queryScope: COLLECTION` and `fieldOverrides` is **empty** — there are **zero** collection-group indexes. A group-scoped single-field query is *not* covered by the automatic collection-scoped indexes; it needs an explicit `fieldOverrides` entry. |
| Any second constraint: `+ .where('status','==','active')`, an `orderBy` for paging, or `rolloverDate + userId` | **YES — a new composite index** | e.g. `{ collectionGroup:'portfolios', queryScope:'COLLECTION_GROUP', fields:[{rolloverDate:ASC},{status:ASC}] }` — absent. Nearest structural analogues (`drafts` status+pickDeadline, `agentBattles` status+pendingReflection+completedAt) are neither on `portfolios` nor group-scoped. |

**Also net-new for D-37 (from §4.D):** per-user work needs **idempotency + locking** that don't exist as shared primitives. It must bring its own per-portfolio "processed for this rollover" marker (the `lastProcessedDay` pattern generalizes) and, if processing is non-idempotent, its own lock/lease (only `agent-evaluate`'s `evaluatingAt` transaction pattern exists to copy). There is no retry framework to inherit.

---

## 8. Recommended sequence (recommendation only — no implementation)

Cheapest and safest first; each step independently mergeable. **Nothing below is authorized to build by this report — it is the proposed order for the founder to ratify.**

0. **(Prerequisite, zero-slot) Build the non-fenced dispatcher shell** by copying the *mechanics* of `runOrchestratorTick` (pacing, 270 s budget-deferral, per-target try/catch, a result ledger, idempotency markers) into a fresh non-fenced module. This is the reusable substrate; it reaches **no** fenced code. Add a per-target result collection to fill the observability gap (§4.D).
1. **Group 1 — weekly janitors** behind the dispatcher (day-gated). Save ~1 slot. Zero fence, zero ordering, fully idempotent. Lowest possible risk.
2. **Group 2 — `*/10` draft-drivers** (`autopick` + `live-draft-fire`). Save ~1 slot. Disclose the read-only §1 fence contact in the PR.
3. **Group 3 — weekly compute** (day-gated; preserve the Sat/Sun day-separation so `compute-briefs`+`compute-estimates` never co-fire). Save ~2–3 slots. Wrap `compute-briefs` in an outer try/catch first.
4. **Land the 3 restructure jobs as handlers behind the dispatcher** (portfolio eval D-19, per-user rollover D-37, proactive triggers D-31) — **0–1 net new slots** instead of 3. D-37 also requires the new Firestore index from §7 and its own idempotency marker.
5. **Group 5 — ingest producers** (after hardening the `limit:1` dedup). Save ~1–2 slots. Medium-low.
6. **Group 4 — FantasyTimes session generators.** Save ~4–5 slots. Medium (cost/market-timing) — a product decision, run it past the founder.
7. **Group 6 — nightly settlement scorers.** **Founder-gated §7 step only**, with its own calibration sign-off and a proven serial `maxDuration`. Pull the non-fenced `levels` (#5) out first (and fix its Juneteenth holiday-list bug as separate tasking).

**Cumulative headroom after step 3:** ~4–5 reclaimed + 3 existing free ≈ 7–8 effective slots, the 3 restructure jobs land at ~0–1 net cost, and the §6 two-slot tournament reserve is preserved — **all without a single §7 fence sign-off.**

---

## 9. Contradictions found (Area B/E cross-cut — docs/comments/naming vs `vercel.json` + code)

1. **Slot-count premise overstated.** The brief says "approximately 38–40 of Vercel's 40 cron slots… there is no room." **Actual: 37/40, 3 free** (VERIFIED). BUILD_RULES §6 ("37/40") is correct; the charter's framing is 1–3 slots pessimistic. (Also: one discovery agent transiently reported "38" — corrected to 37 by direct parse.)
2. **Stale machine-readable fence count.** `src/data/archetypeRuleCompatibility.test.js:280` comments *"The eight fenced files (BUILD_RULES §1)."* — §1 now lists **11**. The Invariant-R arrays omit `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`. Low enforcement risk (different gate) but a factual drift.
3. **`tournament-orchestrator` header vs live gate.** Handler header (`:12-19`) still calls deploy "[P4-GATED] … zero writes," but `tournamentOrchestrator.js:94-99` sets `TOURNAMENT_DEPLOY_ENABLED=true` — deploys are live for real groups. Inert only because zero real groups exist. The header is stale relative to the const it drives.
4. **`live-draft-fire` header vs flag.** Header (`:20`) says it "404s / no-ops flag-off"; `LEAGUE_LIVE_DRAFT` is currently **true** (`featureFlags.js:359`) — live but inert (no slot groups). "Built-dark" framing predates the flip.
5. **Divergent market-holiday lists across the two V4 crons.** `compute-daily-baggerbomb-levels.js:52-56` (`US_MARKET_HOLIDAYS_2026`, 9 dates) **omits Juneteenth 2026-06-19**, which `marketSchedule.NYSE_HOLIDAYS_2026` (used by `baggerbomb-v4-daily-scores`) includes. On Juneteenth the two sibling crons disagree on whether it's a trading day — a real correctness bug (flag for separate tasking per BUILD_RULES §3, not fixed here).
6. **`snake-draft-autopick` holiday drift.** Its local `getBattleStartDate` (`:118-146`) skips only Sat/Sun and omits the holiday list that the sibling copies in `snake-draft-daily-scores.js:96` and `process-draft-claims.js:163` consult — can misdate a battle start across a holiday.
7. **`fantasytimes/cleanup` header "daily" vs twice-weekly registration.** Header (`:3`) says "called by daily cron (2 AM ET)"; `vercel.json` registers `0 7 * * 1,4` = **Mon & Thu only**. Comment contradicts the schedule.
8. **`compute-rankings` / `compute-briefs` / `compute-estimates` auth is GET-only.** Their cron-auth check is gated on `req.method==='GET'` (`compute-rankings.js:1435`, `compute-briefs.js:74`, `compute-estimates.js:394`) — a **POST bypasses the CRON_SECRET check entirely**. Same gap on `lobbies/cleanup-expired` and `snake-draft-autopick` for the POST path. Security observation, flagged for separate tasking.
9. **Stale "crons can't import from src/" comments.** `compute-daily-baggerbomb-levels.js:233` (and a local copy in `process-draft-claims`) cite the **retired** BUILD_RULES §4 import rule to justify duplicated scoring/flatten helpers — a §4 local-copy pattern that the current rule explicitly discourages. Triage separately.
10. **Auth helper unused by crons.** `api/_utils/adminSecretAuth.js` exists but **no** cron uses it; all ~35 handlers hand-roll the identical `x-vercel-cron==='1' || Bearer CRON_SECRET` block. Not a bug, but a consolidation opportunity (a shared `requireCronAuth` helper) worth noting alongside the dispatcher work.

---

## 10. Explicitly out of scope (per brief §4)

No dispatcher designed or built. No handler logic touched. No portfolio schema, archetype substrate, Command Center, arena, or rules-revamp audit (Spec 1 / later specs). Urgent out-of-scope items surfaced above are one-liners flagged for separate tasking, not fixed here: the Juneteenth holiday-list divergence (#5), the autopick holiday drift (#6), the GET-only auth bypass (#8), and the §4 local-copy patterns (#9). Per BUILD_RULES §3, these are reported for separate tasking, not repaired.

---

**STOP.** This report is committed as its own commit for founder review. No consolidation proceeds until the founder rules on the sequence in §8 and the §7-gated Group 6.
