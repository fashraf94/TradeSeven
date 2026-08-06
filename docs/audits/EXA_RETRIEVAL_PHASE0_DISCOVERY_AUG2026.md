# EXA Retrieval Integration — Phase 0 Discovery Audit

**Task:** CC Phase 0 — read-only discovery audit for `EXA_RETRIEVAL_INTEGRATION_SPEC_V1_3.md` (lock candidate).
**Date:** August 6, 2026
**Type:** Read-only. No code changed. This report is the only file committed.
**Terminal state:** hard STOP after commit + push. Founder review follows.

---

## Preamble (BUILD_RULES §3 discovery protocol)

- **Branch:** `claude/exa-retrieval-discovery-audit-28b9qu`
- **HEAD SHA:** `5e445984257ac11e40d40fba27e231aa7457297a`
- **Tree status:** clean at session open.
- **`git fetch origin`:** run as the first step of the session (BUILD_RULES §3). Remote-tracking refs current; no stale-ref gap.
- **Read-only confirmation:** no project state changed — no edits, no new files except this report, no `npm install`, and **no cron/endpoint was executed that would incur EXA or model API spend**. The one command that executed code, `node -e "import('./api/_utils/rankingConfig.js')…"`, evaluates a pure static constant table (no network, no model, no I/O) to count the universe; it spends nothing.
- **Fenced files (BUILD_RULES §1 / spec §2):** `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`, `decide.js`, `agentBattleService.js`, `agentSwapExecution.js`, `tournamentUserScoring.js` were **read** (Q10 requires it) and **not modified**.
- **Standing rule applied:** plan-said ≠ code-did. The live repo is authoritative; where the spec and the code disagree, the code wins and the disagreement is reported in §3 below (it is not reconciled in the spec's favour).

**Method.** The 25 questions were answered by a fan-out of 14 read-only discovery agents (one lane per question cluster), each producing `file:line`-cited verdicts, followed by 5 adversarial verifiers instructed to *refute* the load-bearing findings (bright line ×2, peer decomposition, durable execution, lease). The auditor independently re-read and re-verified the highest-leverage anchors — the Q10 EXA→agent chain, the equip boundary (Q15), the universe count (Q4), the differentiation chips (Q5), the durable-execution primitive (Q11), and the render sink (Q25). Every citation below was read at the cited line.

---

## 1. Verdict summary table

| Q | Short title | Verdict | One-line impact |
|---|---|---|---|
| 1 | `exaClient.js` thin-client state | **EXISTS** | Generic transport; auth/POST/timeout/in-band cost log; no query logic leaked. Confirms §3.9. |
| 2 | Domain-exclusion list + date guard reusability | **PARTIAL** | List + `hostOf` exported; date guard **not** exported; all housed in the mover module — no shared module. |
| 3 | Screener insertion point + sourced-reason render | **PARTIAL** | Seams locatable, but **no router** and **no per-candidate reason/link slot** exist. Falsifies §8.2/§8.4. |
| 4 | Universe table + stable security identifier | **PARTIAL** | Universe is **239** (not 232); identity is the **bare ticker string only** — no CUSIP/FIGI/exchange/share-class. Falsifies §8.3. |
| 5 | Set-analyst chips + differentiation phrasing | **EXISTS** | Chips = `OPENING_ACTIONS` (not FoundInChips); **2 banned differentiation chips ship as defaults**; no phrasing filter. Falsifies §7.6. |
| 6 | Gemma seeding + per-turn reconstruction | **PARTIAL** | Prompt assembly **flattens structure to prose**; per-turn reconstruction already exists; no register-lint/deflection gate. |
| 7 | B-sweep host cron + headroom | **PARTIAL** | Budget untouched at **37/40**; `compute-rankings`(180s)/`compute-index-intelligence`(300s) are viable co-tenants; **runtime headroom is UNVERIFIABLE statically**. |
| 8 | All notes paths | **EXISTS** | Watchlist notes fully mapped; **never reaches Gemma or an agent**; but **no read-time revocation resolution exists**. Falsifies §7.9 mechanism. |
| 9 | Detection substrate + §6.1 decomposition | **PARTIAL** | Only price closes have history; **§6.1 decomposition is NOT computable today** (peer/rank/score are latest-snapshot-only). Falsifies §6.1. |
| 10 | Bright line: cache/EXA → agent prompt | **PARTIAL** | Raw-text + execution + proposed-cache lines **HOLD**; a **model-laundered Wire headline** reaches agent prompts at 3 sites (dark, `EXA_RETRIEVAL_ENABLED=false`). Complicates §11. |
| 11 | Durable post-response execution | **PARTIAL** | `waitUntil` + cron pending-flag **exist** ("none" is false), but **unwired for EXA+distillation** and duration-bounded. |
| 12 | Lease / idempotency primitive | **PARTIAL** | Atomic singleflight + stale-owner recovery **exist** (`evaluatingAt`), but **no owner token, no attempt count, no reusable module**. §5.4 lease is a net-new abstraction. |
| 13 | EXA field availability + stability | **PARTIAL** | Only `url`+`publishedDate` code-proven; update/version/identity fields **absent**; cost-on-failure **unavailable**; stability **UNVERIFIABLE** (no fixture). |
| 14 | Distillation model client | **EXISTS** | `wireModelCall` is the natural Haiku-class seam but has **no timeout/retry**; hardened precedent is the `agent-evaluate` Haiku call; no Stage-2 seam exists. |
| 15 | Watchlist save + equip payload | **PARTIAL** | Equip carries watchlist **name + thesis** (sanitized) into the agent prompt — **not symbol-IDs-only**. Falsifies §3.7. |
| 16 | Screener conversation history | **PARTIAL** | Independence holds only because **there is no retrieval upstream**; persisted `message`/`spec` **do** travel back to Gemma and into watchlist metadata. |
| 17 | Trend lifecycle + version envelope | **ABSENT** | No `detectorVersion`/`sourceDataVersion`, no lifecycle entity, no diffable rank/score history. Falsifies §5.2/§6.4. |
| 18 | Transaction ordering / CAS | **ABSENT** | All writes are unconditional `batch.set`; no CAS, no `sourceDataVersion`; cross-cron order is wall-clock only. Falsifies §5.4/§7.4. |
| 19 | Request fanout ceilings | **EXISTS** | Set-analyst path detects **zero episodes**; hard **40-symbol** cap + Gemma `MAX_ATTEMPTS=2`; fanout is bounded today. |
| 20 | Free-text routing taxonomy | **PARTIAL** | A deterministic **dimension** router exists (regex→column); **no horizon/event-date parsing**, no unknown/mixed→typed-only. Falsifies §7.8. |
| 21 | Mechanical-cause screens | **PARTIAL** | Only YoY growth persists; **no raw EPS/revenue series, no share-count series** — most §6.2 screens not computable. |
| 22 | Firestore security rules | **EXISTS** | Deny-by-default; server collections `write:if false` + Admin-SDK bypass; user isolation by uid/field. New cache is read-denied until an explicit rule is added. |
| 23 | Storage/update limits on new caches | **PARTIAL** | Collections **absent**; single shared `themeKey` doc carries **real hot-doc + 1MiB risk**; cap/TTL are **server-code duties** rules cannot enforce. |
| 24 | Rollup host for weekly spend | **EXISTS** | ≥6 live weekly slots (`compute-briefs` Sun, `promote-discover-themes` Mon, …); no new slot needed. Confirms §10. |
| 25 | Render sanitization | **PARTIAL** | React auto-escaping backbone; **one unsanitized `href` sink** (`WhyMovingPopup.jsx:145`, no protocol allowlist); no DOMPurify. |

**Falsified-assumptions count:** 12 of 25 questions surfaced at least one falsified spec assumption. §3 is not empty — it is the heart of this report.

---

## 2. Full answers

### Q1 — `exaClient.js` post-Alex state
**Verdict:** EXISTS
**Evidence:**
- `api/helpers/exaClient.js:1-8` — header: "GENERIC Exa /search transport — auth, POST, cost logging, timeout. NO domain query logic lives here (that is the caller's job)"; mirrors the `sonar.js`/`sonarCatalystFetch.js` split.
- `api/helpers/exaClient.js:21` — `queryExa(body, {timeoutMs})` takes the entire `/search` body from the caller; no query/category/date/domain constructed inside.
- `api/helpers/exaClient.js:22-25` — auth reads `process.env.EXA_API_KEY`, throws if missing; `:30-35` POST with header `x-api-key` (not Bearer); `:27-28,55-58` `AbortController` timeout (`DEFAULT_TIMEOUT_MS=8000`); `:36-39` generic HTTP error throw.
- `api/helpers/exaClient.js:44-47` — in-band cost logging: `console.log` of results count + `JSON.stringify(costDollars)` + `searchType` (log only, **not persisted**); `:48-53` pure passthrough of `{results, costDollars, searchType, requestId}`.

**Detail:** 60 lines, single export. Auth, POST, timeout, generic error throw, in-band cost log, pure passthrough. No mover/FantasyTimes/Alex terminology, no domain list, no date logic, no category default. Cost is logged but not persisted (log-only observability).
**Spec impact:** Confirms §3.9 "thin client" and §4.1 — the domain/query logic sits in the caller. No falsified assumption.

---

### Q2 — Domain-exclusion list and date guard from the Alex arc
**Verdict:** PARTIAL
**Evidence:**
- `api/_utils/exaCatalystFetch.js:28-34` — `EXCLUDED_DOMAINS` is an **exported** const: flat array of 5 hosts (menafn, marketscreener, news-pravda, newsbreak, finanznachrichten); comments frame it as a freshness/date-laundering denylist.
- `api/_utils/exaCatalystFetch.js:36-38` — `hostOf(url)` is an **exported** pure helper.
- `api/_utils/exaCatalystFetch.js:40-44` — `withinWindow(publishedDate, fromMs, toMs)` is the date guard and is **NOT exported** (module-private).
- `api/_utils/exaCatalystFetch.js:63-66` — the trigger-day window is built **inline** inside `fetchExaCatalystChannels`, not a shared helper.
- `api/_utils/sonarCatalystFetch.js:8` — the sibling fetcher reuses none of these; there is no shared freshness/domains module. Only importer of the exported pieces is the test file.

**Detail:** Two of three pieces (`EXCLUDED_DOMAINS`, `hostOf`) are importable; the date guard is private and the window is inline. Everything lives inside the mover-named module — there is no neutral shared home. A new consumer would couple to the mover file and still re-implement the date guard.
**Spec impact:** Complicates §4.1/§4.2 ("reusable as a shared module"). See §3.

---

### Q3 — Screener dialogue flow: candidate insertion + sourced-reason render
**Verdict:** PARTIAL
**Evidence:**
- `api/screener/chat.js:207-211` — one hardwired `buildVoiceLayerPrompt({mode:'research'})` call; **no router branch**; `:270` a single binary `shouldScreen` gate.
- `api/screener/chat.js:294-297` — candidates come only from `screenStocks`/`screenIndustries` over the **local** universe read at `:278` (`indexIntelligence/stockRankings`); no off-universe path.
- `api/screener/chat.js:301-315` — `responsePayload` assembles `screen.results` + `appliedSpec`/`rejectedFilters`/`matchCount`; the natural server insertion seam sits between the screen call and this block.
- `api/_utils/screenStocks.js:64-66,352-378` — `projectResult` emits a strict field whitelist (symbol/sector/scores); **no `reason` and no `url` key**.
- `src/components/Search/RankRow.jsx:29-124` — the per-row renderer has **no reason/link slot**; the only free text is the screen-level Gemma `message` (`ScreenerView.jsx:474-489`).

**Detail:** The flow is fully locatable, but the artifacts §8.2/§8.4 assume do not exist: no router, no off-universe path, no per-candidate reason/link contract. The one field that could hold a per-candidate reason is the watchlist ticker `reasoning`, which the screener's Save path currently forces to `''` (`ScreenerView.jsx:277`).
**Spec impact:** Complicates §8.2 (router) and §8.4 (approval gate + sourced reason + links). See §3.

---

### Q4 — Universe symbol table and company-name metadata
**Verdict:** PARTIAL
**Evidence:**
- `api/_utils/rankingConfig.js:359` — `ALL_TICKERS = Object.values(STOCK_UNIVERSE).flatMap(...)` evaluates to **239** (verified by executing the module: 11 sectors XLK28/XLV22/XLF23/XLE19/XLY22/XLP22/XLI23/XLB20/XLU20/XLRE20/XLC20). The spec's "232" survives only in stale artifacts.
- `api/_utils/rankingConfig.js:430-456` + repo-wide grep — **no CUSIP/FIGI/ISIN/SEDOL/exchange/share-class field anywhere**; identity is the bare uppercased ticker string.
- Universe includes `C`, `F`, `K`, `T` as bare string keys (`rankingConfig.js:32,44,50,80`); **`A` (Agilent) is absent** (0 matches). None carry disambiguation metadata — lookups are exact-string.
- `api/_utils/tickerSearchMatch.js:5-6` — universe search **excludes company-name matching**; canonical names come from EODHD `General.Name` at fetch time (`compute-rankings.js:128`), not stored as universe metadata.
- `api/_utils/tickerValidation.js:15-38` — off-universe tickers are only split validated/unsupported; no off-universe issuer metadata is stored (`parse-signal` emits an `off_universe_ticker_seen` observability log only).

**Detail:** A universe table exists and is complete for its 239 members, but the only identifier is the ticker string. There is no exchange/listing/share-class/ADR field, no stored company name, no deterministic name→ticker resolver for the tradeable universe, and no off-universe issuer record.
**Spec impact:** Falsifies §8.3 wholesale (see §3) and corrects the recurring "232-ticker" figure.

---

### Q5 — Set-analyst chip generation + differentiation-phrased chips
**Verdict:** EXISTS
**Evidence:**
- `api/forge/watchlist-analysis.js:273-277` — `OPENING_ACTIONS` is the actual set-analyst chip source (server-side), and it ships the differentiation-phrased chips **"What separates the winners from the laggards?"** (`:276`) and **"Which are the outliers?"** (`:277`).
- `api/forge/watchlist-analysis.js:270` — the opening narration itself says "…or what separates the winners from the laggards."
- `api/forge/watchlist-analysis.js:59-63` — a `FOCUS` regex matches `outliers|stands out|separates|differ|distinct` and routes to the fundamental tier.
- `api/forge/watchlist-analysis.js:144-151` — `sanitizeSuggestedActions` only trims length/count; **no phrasing filter**.
- Q5 premise correction: `src/components/Forge/FoundInChips.jsx` / `CollectionChips.jsx` are Forge rule-library UI (trait/collection pills), **not** the set-analysis chips.

**Detail:** Chip content is generated server-side in `watchlist-analysis.js` (static `OPENING_ACTIONS` + Gemma-suggested follow-ups). Two of the three default opening chips are exactly the differentiation phrasing §7.6 bans, and there is no code path today that could constrain chips to frequency-only.
**Spec impact:** Falsifies the §7.6 premise that differentiation phrasing can simply be excluded — it is the live default. Product impact: the flagship set-analyst opening actions must be reworded or fenced off retrieval-backed content. See §3.

---

### Q6 — Gemma seeding: injection point, register-tag survival, per-turn reconstruction
**Verdict:** PARTIAL
**Evidence:**
- `api/_utils/voiceLayerPrompt.js:840-846,798-816,2411-2521,2861` — `buildVoiceLayerPrompt` renders every structured object to **labeled prose** via block builders and returns `blocks.join('\n\n')` as one flat system string. Structure does **not** survive as machine-readable tags.
- `api/forge/watchlist-dialogue.js:1058-1059,1343-1383` — the watchlist/set layer **already reconstructs** structured state (`candidateTickers`/anatomy) per turn; it does not rely on chat history for that state.
- `api/forge/watchlist-dialogue.js:562-565,593-627` — the only register-adjacent code (`detectNarrativeActionDrift`) is observability-only ("does NOT block or rewrite"); **no register-lint / deflection gate exists**.
- `api/_utils/gemmaClient.js:71-77` — no prompt caching; the large static scaffolding ships every turn.

**Detail:** The injection point is `buildVoiceLayerPrompt`, which flattens structure to prose — so register tags would not survive as structure without a schema change. Per-turn reconstruction is not a new technique here (it is already the watchlist-dialogue pattern), so feasibility is high. The register-lint/deflection layer §4.9 assumes is absent. Token volume of re-injection is bounded and small relative to existing scaffolding, but the **dollar** cost is UNVERIFIABLE from the repo (no prompt caching, external Gemma/OpenRouter pricing).
**Spec impact:** Complicates §7.5 (tag survival) and §4.9 (register lint/deflection do not exist). See §3.

---

### Q7 — B-sweep host cron: candidates, headroom, budget
**Verdict:** PARTIAL
**Evidence:**
- `vercel.json` — the `crons` array holds **exactly 37 entries** (budget untouched, 37/40; `BUILD_RULES.md:73`).
- `api/cron/compute-index-intelligence.js:54` — `config = { maxDuration: 300 }`; `api/cron/compute-rankings.js:13` — `maxDuration: 180`. Both are the named leading co-tenant candidates and are live single-slot handlers.
- `api/cron/compute-index-intelligence.js:713` — `fetchBatch(ALL_TICKERS, 10, 500)` iterates the 239-symbol universe (24 batches, ~11.5s fixed inter-batch delay floor + one EODHD GET/symbol); `:251,569-571` intraday adds `fetchRealtimeQuotes` over ~255 symbols.
- `api/cron/compute-index-intelligence.js:553,1241-1242,1255` — run time is telemetered but only observable from a **live run**, not by static read.

**Detail:** Two well-fitting host candidates exist and the budget is intact. But adding a per-symbol EXA call + a Stage-2 distillation call to a 239-symbol sweep is a large marginal cost against a 180s/300s ceiling, and the **actual runtime/network headroom at the largest fresh batch is UNVERIFIABLE without a production run**. §6 eligibility/screens would have to shrink the multiplier substantially, and even the batch size is 239, not the spec's ~232.
**Spec impact:** Confirms §7.2's "co-tenant, no new slot" is *architecturally* available (budget 37/40) but leaves the headroom claim unproven and corrects the symbol count. See §3.

---

### Q8 — All notes paths
**Verdict:** EXISTS
**Evidence:**
- Write: `api/forge/watchlists/[id]/notes.js:52,71` — POST reads only `req.body.notes` (capped), `tx.update {notes, updatedAt}`; header states "notes is user-facing only. It does NOT reach the agent."
- Read: `api/forge/watchlists/[id].js:104` and `api/forge/watchlists.js:103` — GET returns `{...data}` **verbatim**; **no revocation resolution** at read.
- Edit: `api/forge/watchlists/[id].js:129-135,224-230` — PATCH edits notes on drafts only (committed → 409).
- Analysis sink: `api/forge/watchlist-analysis.js:316-324` — the Gemma analyst loads the doc but reads only `userId`/`deletedAt`/`tickers`; **grep confirms zero access to `watchlist.notes`**; `:372` Gemma is grounded on the deterministic rankings digest, never notes.
- Agent-seeding: `api/agent/equip-watchlist.js:104` — forwards **only** `name`; `notes` is never read; grep across `api/agent/` + all six fenced files returns nothing.
- Summary: `src/components/Forge/Watchlist/WatchlistAnalysisView.jsx:178` — `saveWatchlistNotes(id, lastAnalyst.text.slice(0,2000))` **writes** an analyst answer into notes (a sink), never reads notes back into a prompt.
- Distinct system: `api/ai-advisor.js:386-422` — `buildGamePlanPrompt(userNotes)` **does** feed notes into a model prompt, but from the separate `gamePlanNotes` collection (`gamePlanNotesService.js:19`), **not** watchlist notes.

**Detail:** Every watchlist-notes path — write, read, edit, analysis, summary, Gemma-seeding, agent-seeding — is mapped. On current code **watchlist notes never reaches Gemma or an agent**. But the §7.9 "sealed snapshot resolved against revocation at read time" machinery does not exist: notes is a plain ≤2000-char string returned verbatim, with no source references and no read-time resolution.
**Spec impact:** Reassures the bright line (notes is inert to models today) but falsifies the §7.9 mechanism (no read-time revocation). Flags a *separate* notes system (`gamePlanNotes`) that does reach a model. See §3.

---

### Q9 — Detection substrate + §6.1 decomposition
**Verdict:** PARTIAL (the critical §6.1 sub-question is **ABSENT / not computable**)
**Evidence:**
- `api/cron/compute-rankings.js:1320,1400` — `peerRankings/{ticker}` is written per-ticker and **overwritten each run**; versioned only by `computedAt`/`expiresAt`.
- `api/cron/compute-rankings.js:290,304` — the **only** diffable history is `priceHistory` days[] (dated closes); it holds **prices only** — no rank/score/fundamental snapshots.
- Adversarial verifier (Q9) refuted "decomposition is computable": (a) per-issuer typed metrics are latest-snapshot-only; (b) peer/cohort rankings are recomputed fresh and overwritten with **no prior-period values and no dated cohort roster**; (c) no stored own-metric-vs-peer delta exists.
- `fundamentalScore`/`fundamentalRank`/`sectorTechnicalRank` are present cross-sectionally *now* but carry no time dimension.

**Detail:** V1 metrics are partially queryable — rank/score exist as a latest snapshot, and price closes carry genuine history. But §6.1 relative-move decomposition requires prior-period values for both the issuer's own metrics and the peer cohort, and **none are stored**. Peer history is exactly what PR-B (V1.5) would introduce. Therefore, on HEAD, "did the rank move because the issuer moved or because peers deteriorated / the cohort changed?" cannot be answered from stored data.
**Spec impact:** Falsifies §6.1 as a *today* capability (see §3). B's V1 detection surface shrinks: decomposition is a data-build prerequisite, not a query over existing data — matching §12's own "prerequisite, not enhancement" framing but stronger than §7.1 implies.

---

### Q10 — Bright-line verification (most important; complete answer)
**Verdict:** PARTIAL — the strict bright line **holds**; the absolute claim is **complicated by a model-laundered Wire seam**.

**What HOLDS (verified against the fenced files):**
- **No raw retrieved free text reaches a trading agent.** EXA has exactly one runtime consumer, `api/fantasytimes/generate-mover.js` (`:176-201`); the EXA `[ATTRIBUTION]/[CONTEXT]` block is placed only into the *Wire mover* Haiku prompt. Raw EXA `title`/`snippet`/`url` are never written to a collection an agent reads.
- **The fenced assemblers import nothing EXA-derived and no proposed cache.** `agentPromptAssembly.js` / `agentEvalPromptAssembly.js` read no EXA source; grep confirms `thematicSearchCache`/`tickerTrendContext`/`thematicOffUniverseHits` appear **nowhere** in the repo (no stub, no TODO). Adversarial verifier V1 attempted five refutation vectors and could not break this.
- **No autonomous retrieval influence on execution** — nothing in `decide.js`/`agentSwapExecution.js`/`agentBattleService.js`/`tournamentUserScoring.js` lets a retrieval result move a pick; the equip boundary is user-mediated.

**What is COMPLICATED (the one seam):**
- The FantasyTimes Wire **does** reach trading-agent prompts at three sites: the strategy system prompt via `formatStoriesSummary` (`api/_utils/agentPromptAssembly.js:252-264`, which renders each story's **model-written `headline`** at `:259`), the eval news block (`api/_utils/agentNewsContext.js:259-302`), and the eval trigger detail (`api/_utils/agentTriggerGate.js`).
- The pipeline is: `generate-mover.js` (EXA in the Haiku prompt when `EXA_RETRIEVAL_ENABLED`) → story `body`/`headline` written to `fantasyTimesStories` (via `publishStoryWithWire`) → `api/agent/decide.js:358-373` fetches `fantasyTimesStories`, builds `storiesSummary`, and passes it into `buildStrategySystemPrompt` (the Sonnet trading-agent call, `:376` `claude-sonnet-4-6`).
- So a **model-laundered, EXA-influenced headline** can reach the trading agent's reasoning context. It is **currently dark**: `EXA_RETRIEVAL_ENABLED = false` (`src/config/featureFlags.js:1215`), and with the flag off the mover prompt is byte-identical to the Sonar-only path (`featureFlags.js:1208-1210`). The Wire→agent channel itself is live regardless of EXA; today it carries Sonar/EODHD-derived headlines.
- **Registry gap:** `agentNewsContext.js` (the Wire/news channel into the eval prompt) is listed in `CLASSIFIED_NON_REGISTRY_IMPORTS`, **not** in `PROMPT_CONTRIBUTING_MODULES`, in `api/_utils/__fixtures__/promptHonestyRegistry.js:61,67` — with an explicit comment that this is "NOT an assertion that they are prose-free." So the C-20 prose-honesty sweep does not cover the channel by which news text enters agent prompts.

**Detail:** The spec's bright line, read strictly ("no *retrieved free text*"; "no autonomous execution influence"), holds — and the *new* build (proposed caches → fenced files) is clean. But the spec's absolute framing in §11 ("Injection surface: exactly one — Stage 2") is not true at the platform level: a second, pre-existing injection surface exists — the Wire — through which EXA-*influenced* (Haiku-laundered) headlines already reach agent prompts, gated only by a flag that is a one-line flip. This is not a leak this arc introduces, but it is a live seam the spec must acknowledge, especially because Workstream B proposes writing retrieval-derived caches that would be one Wire-style consumer away from the same channel.
**Spec impact:** Complicates §11 and §3.7 (see §3). Treat as the headline audit finding.

---

### Q11 — Durable execution under Vercel termination
**Verdict:** PARTIAL (mechanisms exist; the spec's "none" premise is falsified)
**Evidence:**
- `import { waitUntil } from '@vercel/functions'` is used at **20 non-test sites** (`api/agent/equip-bundle.js:55,298`, `unequip-bundle.js`, `set-tempo-dial.js`, `reforge-bundle.js`, `equip-watchlist.js`, `change-archetype.js`, `api/forge/watchlists/[id]/*`, `api/season/create-entry.js`, …); package installed (`package.json:27`, `@vercel/functions ^3.5.0`).
- Every current `waitUntil` call wraps **lightweight logging** (`waitUntil(logSignalDrops(...).catch(()=>{}))`, `equip-bundle.js:298`) — **never** a model/EXA call.
- The sole EXA consumer, `generate-mover.js`, runs EXA + the Haiku call **fully synchronously** inside `maxDuration: 30`, with no `waitUntil`.
- The durable-write substrate is the **cron-drained pending-flag** pattern (`pendingReflection` → `api/cron/process-pending-reflections.js`); no external queue library is used in app code (`@google-cloud/pubsub` is only a transitive firebase-admin dep).

**Detail:** Two mechanisms exist — `waitUntil` (post-response continuation within the function's remaining `maxDuration`) and the queue-flag/cron re-drive (durable across restarts). Neither is currently wired for EXA + distillation, and `waitUntil` is duration-bounded and used fire-and-forget with a swallowed `.catch` — which BUILD_RULES §5 (Signal Capture Rider) forbids for durable catalog writes. So for a *guaranteed* cache write, the sanctioned pattern is the queue-flag, not `waitUntil`-swallow.
**Spec impact:** Falsifies the spec's implicit "no durable mechanism" premise (§5/§7.2/§10) — a mechanism exists — while confirming the real gap: it is unwired for generation and unsafe as fire-and-forget. See §3.

---

### Q12 — Lease / idempotency primitive
**Verdict:** PARTIAL
**Evidence:**
- `api/cron/agent-evaluate.js:544-577` — the only production lease: an `evaluatingAt` timestamp with expiry + **age-based stale recovery**. It is a genuine atomic singleflight with first-write conflict handling.
- Grep confirms **no `lockOwner`/`claimedBy`/`ownerToken`/attempt-count** on any lock anywhere.
- The lock is inline in `processAgentBattle`; `agentCronState.js` centralizes only the release-stamp (`evaluatingAt:null`), not acquisition — there is **no reusable lease module**.
- Idempotency keys exist for the Wire (`wireWriteThrough.js:140` `buildIdempotencyKey`) and per-day guards elsewhere, but none is a general lease.

**Detail:** Atomic singleflight and stale-owner recovery **exist** and are proven. But §5.4's lease additionally requires an **owner identity** and an **attempt count**, neither of which exists on any lock, and there is **no shared primitive** to extend — the working lease is inline in one cron. So §5.4 is an extension in concept (a real singleflight+stale pattern to copy) but a net-new reusable abstraction in practice.
**Spec impact:** Complicates §5.4 (see §3): "extension of an existing pattern" is fair for singleflight+stale-recovery; "reuse an existing lease primitive" is not — owner/attempt-count/module are new.

---

### Q13 — EXA field availability + result stability
**Verdict:** PARTIAL
**Evidence:**
- Code-proven result fields: `r.url` (`exaCatalystFetch.js:88,92`), `r.publishedDate` (`:92,95`, the only temporal field, drives the attribution window), `r.title`/`r.highlights`/`r.text` (`:90-92`); `r.score` only in the capture script.
- **Absent** (no code reads them): last-update time, content-version time, and any per-result listing/security identity — ticker identity exists only in the *outbound* query (`:54-61`), never read back.
- Cost on failed/aborted calls: `exaClient.js:36-40` throws before `resp.json()` on HTTP error; `:54-56` converts abort to a thrown "Exa timeout"; the degrade path hardcodes `costDollars:null` (`exaCatalystFetch.js:82`) — cost is **structurally unavailable** on any failure.
- Stability across identical queries: **no** code/comment/fixture evidence; `capture-exa-search.js` grabs one response; `type:'auto'` is a non-deterministic router. **UNVERIFIABLE.** No EXA fixture exists in the repo (grep for `costDollars|api.exa.ai|searchType` across `*.json` is empty; the R2 provenance fixture was never committed).

**Detail:** Only `url` + `publishedDate` are grounded in code the consumer relies on. Update/version/identity fields do not exist in the consumed surface. Failure-path cost is unobservable. Result stability — central to §5.3's F-15 regeneration argument — is entirely unverifiable from the repo and would require repeated live `/search` calls. All response-shape claims rest on OpenAPI-citing comments + synthetic mocks, not a captured real response.
**Spec impact:** Falsifies parts of §9 schemas and §5.3 (see §3); marks stability/cost-on-failure/canonical-URL-vs-original-URL as items only a live capture can resolve.

---

### Q14 — Distillation model client
**Verdict:** EXISTS (candidates), with the Stage-2 contract **new**
**Evidence:**
- `api/_utils/wireModelCall.js:44-49,104-108` — the sole Anthropic importer in the Wire context; `messages.create` with params from `getGenerationConfig` (model, maxTokens, temperature, thinking, outputConfig) and a `provenanceStamp` (`generationVersion`, `:68-73`). **No request timeout, no `maxRetries`** (inherits SDK ~2 retries).
- The hardened precedent is the `agent-evaluate` Haiku call: **timeout 20_000, `maxRetries:0`, temp 0.4, 2048 cap** — bounded behavior exists only at that call site, not in a wrapper.
- `api/_utils/wireGenerationConfig.js:46-83` — `SEAM_EXECUTION` registers only Wire story seams; **no distillation/extraction seam** exists.
- `api/_utils/gemmaClient.js:32-35` — Gemma via OpenRouter (`google/gemma-4-26b-a4b-it`), not Haiku, no model/prompt version stamp — **not** a Haiku-class candidate.

**Detail:** `wireModelCall` is the natural Stage-2 Haiku-class transport and already carries a version stamp and a Haiku-capable config path, but it has no timeout/retry of its own, and R-A1 fences it to the Wire context. A Stage-2 seam entry (with its own timeout/retry/token-cap/prompt-version) and the bounded timeout/retry policy would be net-new. The distillation handler's max Vercel duration is whatever host it rides (`generate-mover` is `maxDuration:30`).
**Spec impact:** Confirms §4.3/§14 a Haiku-class client is reachable, but falsifies "the generation client applies a bounded timeout+retry out of the box" and "a Stage-2 seam exists." See §3.

---

### Q15 — Watchlist save + equip payload
**Verdict:** PARTIAL
**Evidence:**
- Persisted on save (`watchlists/{id}`): beyond canonical symbols, the doc stores `thesis`, `activationConditions`, `invalidationConditions`, `notes`, `name`, source provenance (`sourceDropId`/`sourceSessionId`/`sourceScreenSpec`), and per-ticker `reasoning`/`category`/`addedBy` (`api/forge/watchlists.js:414-420`; `watchlistValidation.js`).
- Reaches the equipped-agent payload: `api/agent/equip-watchlist.js:104,112-117` writes `equippedWatchlistName` onto the agent settings doc; `api/_utils/agentBattleService.js:181-183` freezes it into the battle-doc snapshot; `api/agent/decide.js:382` passes `thesis` into `buildStrategyUserPrompt`; `api/_utils/agentPromptAssembly.js:126-150` renders **name + thesis** into the agent's strategy prompt (both sanitized via `sanitizeRuleText`, `:133`).

**Detail:** The equip boundary carries more than tickers: the watchlist **name** and **thesis** (both user-authored free text) cross into the agent doc, the frozen battle snapshot, and the Sonnet strategy prompt. They are sanitized by `sanitizeRuleText` (length cap + injection-pattern strip), which is a real mitigation, but they are still free text, not "canonical symbol IDs only."
**Spec impact:** Falsifies §3.7 ("crossing the equip boundary as canonical symbol IDs only") and §8.6 ("what survives a save is the ticker"). See §3. Relevant to A's approval-gate bright-line argument.

---

### Q16 — Screener conversation history
**Verdict:** PARTIAL
**Evidence:**
- `api/screener/chat.js:31-38,278` — the screener path imports no EXA/web/news; the only external read is the local `stockRankings` doc. There is **no retrieval** to leak.
- `api/screener/chat.js:193-197` — persisted `userMessage`+`message` are **replayed** into the next Gemma call as conversation history; `:202-204` + `voiceLayerPrompt.js:2335-2348` re-inject `latestSpec` as a "PREVIOUS SCREEN" block.
- `src/components/Search/ScreenerView.jsx:284` → `api/forge/watchlists.js:228-249` — `appliedSpec` travels into watchlist metadata as `sourceScreenSpec` (sanitized to filters/rankBy/limit/screenType, hard-capped at 4000 bytes).
- `api/screener/chat.js:259-267,407` — `_scratchpad` is explicitly excluded from the doc and response and diverted only to the GCS shadow logger.

**Detail:** Referential independence (§3.8) currently holds — but only because the screener performs no retrieval, not because persistence scrubs content. The persistence layer is **not** an inertness barrier: the stored Gemma `message` re-reaches Gemma via history replay, `latestSpec` re-reaches Gemma via re-injection, and `appliedSpec` reaches watchlist metadata. If a future thematic feature ever wrote a sourced reason into `message` or a result field, these existing carriers would forward it.
**Spec impact:** Confirms §3.8 for today, but falsifies the assumption that persistence *enforces* independence (§8.6). See §3.

---

### Q17 — Trend lifecycle substrate + version envelope
**Verdict:** ABSENT
**Evidence:**
- Grep across production code: **no `detectorVersion`, no `sourceDataVersion`** anywhere in the detection substrate (the only `*Version` stamps are the Wire arc's `schemaVersion`, a separate arc).
- `api/cron/compute-rankings.js:1400` / `compute-index-intelligence.js:1218` — versioning is only `computedAt`/`expiresAt`/`updatedAt`/`mode`; `expiresAt` is a freshness horizon, never a monotonic version and never compared on write.
- `api/cron/compute-rankings.js:290` — `priceHistory` (dated closes) is the only diffable structure and holds prices only — **no rank/score snapshots** to diff for lifecycle transitions.
- No `lifecycleState`/`episode`/`newlyActive`/`materiallyChanged`/`reversed`/`trendState` entity exists in the detection path.

**Detail:** Neither the versions envelope (§5.2) nor a trend-lifecycle entity (§6.4) exists on HEAD, and there is no historical rank/score snapshot to diff. Lifecycle classification has no data foundation.
**Spec impact:** Falsifies §5.2 and §6.4 — both are from-scratch builds, not "surface what exists." See §3.

---

### Q18 — Transaction ordering across ingestion/recompute/invalidation/late writes
**Verdict:** ABSENT
**Evidence:**
- `api/cron/compute-rankings.js:1316-1423` — `persistResults` uses one `db.batch()` of **unconditional** `batch.set` for `peerRankings/{ticker}`, `sectorRankings/latest`, `scannerSummary/latest`; atomic per batch, but no precondition/version. `priceHistory` is a **separate** earlier batch (`:304-315`) — not committed with rankings.
- `api/cron/compute-index-intelligence.js:957-1237` — one batch, all `batch.set`; `:1015` the consumer reads `peerRankings` mid-pipeline with a plain `.get()` — no version compare, no read-in-transaction.
- Grep: **no `runTransaction` and no compare-and-set** in either detection cron (all transaction usage is in `agent-evaluate.js`, the battle-scoring arc).
- `compute-index-intelligence.js:10` — idempotency is "running twice overwrites the same docs" (last-writer-wins), not version gating; cross-cron order is wall-clock only (`vercel.json:46,126,130`).

**Detail:** The substrate offers only Firestore per-batch atomicity and unconditional last-writer-wins overwrite. There is no CAS, no `sourceDataVersion`, and no cross-store ordering between fundamentals ingestion, rankings recompute, and any cache.
**Spec impact:** Falsifies §5.4 (late-write CAS) and §7.4 (invalidation ordered by CAS on `sourceDataVersion`). See §3.

---

### Q19 — Request fanout ceilings
**Verdict:** EXISTS (bounded today)
**Evidence:**
- `api/forge/watchlist-analysis.js:316-324` + `cohortDigest.js` — the set-analyst path reads already-computed `rankings`/`peerRankings`/`estimates` docs and builds a pure in-memory digest; **no per-symbol episode detection, no EXA fetch**.
- `api/_utils/watchlistValidation.js:22` (write) and `watchlist-analysis.js:43,324` (read) — a hard **40-symbol** ceiling on a set.
- `api/_utils/gemmaClient.js:160` — Gemma capped at `MAX_ATTEMPTS=2`.

**Detail:** On current code a set open / chip press / free-text ask detects **zero** episodes and triggers no fan-out beyond reading a bounded (≤40-symbol) digest and one Gemma call. The spec's fanout ceilings (§7.7) guard a multiplier that does not exist yet — which is a benefit: there is no unbounded fan-out to contain today, and the 40-symbol cap is the natural hard limit to inherit.
**Spec impact:** Confirms §7.7's ceilings are additive over an already-bounded surface; no falsified assumption, but the "detected episodes per request" quantity is zero today.

---

### Q20 — Free-text routing on "Ask about this set"
**Verdict:** PARTIAL
**Evidence:**
- `api/forge/watchlist-analysis.js:91-100` — `deriveFocusDimension` is the only deterministic router; it classifies by **dimension/column** (debtToEquity, trailingPE, profitMarginTTM, revenueGrowthYOY, atrPercentile, momentumScore, return1M, sma…), **not** by horizon.
- `api/forge/watchlist-analysis.js:49` — `FUNDAMENTAL_KEYWORDS` matches only "earnings beat"/"beat rate"; **"since earnings" matches nothing** → `focusDimension=null`.
- `src/.../cohortRowsView.js:47` — unknown timeframe silently defaults to `return1M`-desc; **no "typed-only" mode** exists.
- Contrast: the screener routes with Gemma (text→screenSpec, `chat.js`), so the two surfaces are inverted (set analyst = deterministic dimension router + Gemma narration; screener = Gemma router).

**Detail:** A deterministic router exists, but it routes to a *display column*, not a *horizon class*. There is no absolute/relative/event-anchored/mixed/fast-catalyst/unknown taxonomy, no event-relative date parsing ("since earnings" is unrecognized), and no unknown/mixed→typed-only fallback — the spec's §7.8 taxonomy is a from-scratch build with tests.
**Spec impact:** Falsifies §7.8 (see §3). The building block (a tested deterministic router pattern) exists; the horizon taxonomy does not.

---

### Q21 — Mechanical-cause screens (§6.2)
**Verdict:** PARTIAL
**Evidence:**
- `api/cron/compute-rankings.js:1358` — the persisted `metrics` object contains **no raw quarterly EPS/revenue series, no share-count series, no one-time-item flags**.
- Only the **YoY growth rate** is persisted; the 12-quarter `Earnings.History` is fetched **transiently** within `compute-rankings` and not retained.

**Detail:** Of §6.2's four screens, only comp-base *direction* is even partially inferrable (via the persisted YoY rate); one-time charges, share-count changes, and consolidation effects are **not** computable from persisted typed data today, because the raw series they need are not retained. Computing them would require persisting the quarterly EPS/revenue history and a share-count series.
**Spec impact:** Complicates §6.2 — the screens are mostly not computable on HEAD without new persistence. See §3.

---

### Q22 — Firestore security rules
**Verdict:** EXISTS
**Evidence:**
- `firestore.rules:1` — `rules_version = '2'`; `:919-921` terminal catch-all `match /{document=**} { allow read, write: if false; }` = **deny-by-default** (v2 non-inheriting, so this closes gaps).
- Server-only cache precedents: `marketDataCache` authed-read/`write:if false` (`:41-44`); `signalDropCache` both server-only (`:69-72`); `voiceLayerCache` (`:611-614`); `indexIntelligence`/`stockTechnicalScores` public-read/server-write (`:600-608`); `discoverThemes` authed-read/server-write (`:633-641`) — the closest precedent for a new platform-content collection.
- User isolation by doc-id (`users` `:84-91`) and by field (`gamePlanNotes` `:115-123`; `seasonEntries` `:717-726` with an `affectedKeys().hasOnly([...])` allowlist).
- **No admin-claim / service-account predicate anywhere** (grep: the only "admin" is a comment at `:388`). Server writes are authorized purely by `write:if false` + Admin-SDK transport bypass (`api/_utils/firebaseAdmin.js:5-33`).
- `api/_utils/ingestedClaims.js:5-8` — a live platform cache with **no explicit rule block**, protected solely by the catch-all and served server-side — the exact precedent for a new platform cache.

**Detail:** The posture strongly prevents client cache writes (deny-by-default + `write:if false`), cache poisoning (server-only writes via Admin SDK), and cross-user leakage (uid/field isolation). It cannot enforce "authorized source-metadata changes" via an in-rules admin predicate — there is none; that guarantee rests entirely on the Admin-SDK transport boundary. A new `thematicSearchCache` inherits the safe default (client-denied) and must add an explicit `allow read` block to be client-readable.
**Spec impact:** Confirms §8.5/§11 client-write protection; nuances that "unauthorized source-metadata changes" are prevented by transport, not by rules. No falsified assumption of consequence.

---

### Q23 — Storage/update limits on `thematicSearchCache` / `thematicOffUniverseHits`
**Verdict:** PARTIAL (collections absent; structural limits by precedent)
**Evidence:**
- Grep: `thematicSearchCache`/`thematicOffUniverseHits`/`tickerTrendContext` = **zero occurrences** repo-wide; per-instance limits are UNVERIFIABLE by reading.
- `firestore.indexes.json:432` — `fieldOverrides: []`; **no native TTL policy declared** in the repo (TTL is console/gcloud-configured) — UNVERIFIABLE from repo.
- Revocation precedent is application-level: `ingestedClaims.js:285-319` `deleteExpired()` queries `where('expiresAt','<',now)` and batch-deletes in 500-doc chunks; `marketDataCache.js:188` is a single-doc-per-key cache with **no size guard**.
- Subcollection precedents for append-only evidence: `learningEvidence/{agentId}/atoms` (`firestore.rules:851`), `learningReceipts/{battleId}/receipts` (`:858`), `seasonEntries/{id}/dailyLogs` (`:729`) — **none enforce an append cap in rules**.
- `firestore.rules:536-538` — `errorLogs` `keys().size()<=10`/`message.size()<=5000` is the only doc-shape guard and cannot bound total doc size.

**Detail:** A single shared `thematicSearchCache/{themeKey}` doc funnels all writes for a theme onto one document — real exposure to the ~1 write/sec/document soft limit (hot-doc contention under concurrent cache-miss writes) and to the 1MiB doc-size limit as the candidate array grows. The `thematicOffUniverseHits/{issuerId}/evidence/{recordId}` subcollection shape structurally sidesteps hot-doc contention (matching the `learningEvidence`/`dailyLogs` precedents). Critically, "append-only capped," "revocable," and "expiring" are all **server-code duties** — Firestore rules cannot count subcollection docs, bound doc size, cap write rate, or express a TTL.
**Spec impact:** Confirms the §9 subcollection instinct; complicates §5.1/§8.5 (single shared doc is a hot-doc risk; cap/TTL live in server code). See §3.

---

### Q24 — Rollup host for weekly spend reporting
**Verdict:** EXISTS
**Evidence:**
- Weekly slots viable as hosts: `compute-briefs` `0 1 * * 0` Sun, `maxDuration:300` (`compute-briefs.js:23`); `compute-estimates` Sat `maxDuration:180`; `compute-institutional-intelligence` Mon `maxDuration:120`; `generate-econ?mode=preview` Mon; `promote-discover-themes` Mon `maxDuration:30` (a read-aggregate-write job — the closest structural analogue); `generate-column` Mon/Fri.
- No competing job: grep for `spendRollup`/`weeklySpend`/`costRollup`/`costLedger`/`exaCostLog` = **zero** — no spend-rollup collection or persisted cost ledger exists yet. EXA `costDollars` is only console-logged (`exaClient.js:44-47`), never persisted.

**Detail:** At least six live weekly slots exist; `compute-briefs` (Sun, most slack) or `promote-discover-themes` (Mon, read-aggregate-write) are the natural hosts. The budget stays 37/40. Note there is no persisted cost ledger today, so the rollup would need a cost-capture write added upstream (cost is currently ephemeral in logs).
**Spec impact:** Confirms §10 (rollup rides an existing weekly schedule, no new slot). No falsified assumption; one dependency flagged (cost must be persisted first).

---

### Q25 — Render sanitization
**Verdict:** PARTIAL
**Evidence:**
- Backbone: React 19 auto-escaping of text children (issuer names, titles, theme labels rendered as `{text}` are escaped). No central render sanitizer; **no DOMPurify** (`package.json`).
- `src/components/.../WhyMovingPopup.jsx:145` — renders `href={url}` from `/api/why-moving` `citations` with `target="_blank" rel="noopener noreferrer"` but **no protocol allowlist** — a `javascript:` URL would pass. This is the concrete external-URL render sink and it is the pattern any EXA-URL renderer would copy.
- `src/components/FantasyTimes/StoryDetail.jsx` — the one `dangerouslySetInnerHTML` sink (manually `&`/`<`/`>`-escaped, not a sanitizer library).
- `DeepdiveMarkdown.jsx:85` — the one renderer that *does* sanitize links, via `rehype-sanitize`'s protocol allowlist.

**Detail:** Text sanitization is real for `{text}` children by virtue of React. But URL sanitization is inconsistent: only the markdown path enforces a protocol allowlist; the live external-citation link renderer (`WhyMovingPopup`) does not. Since EXA URLs already flow through `/api/why-moving`-style citations, a retrieval feature that renders source links must add explicit protocol allowlisting — the spec's "URLs sanitized at render" (§11) is not uniformly true today.
**Spec impact:** Complicates §11 display safety (see §3): one unsanitized `href` sink and one `dangerouslySetInnerHTML` sink exist; no central sanitizer.

---

## 3. Falsified spec assumptions

This section is the point of the audit. Each entry names the spec section, what it assumed, and what the repo actually shows.

1. **§11 / §3.7 — "Injection surface: exactly one — Stage 2." (Q10)** False at the platform level. A pre-existing, currently-dark seam already carries EXA-*influenced* content into trading-agent prompts: `generate-mover.js` (EXA in the Haiku prompt when `EXA_RETRIEVAL_ENABLED`) → `fantasyTimesStories` → `decide.js:358-373` → `formatStoriesSummary` headline (`agentPromptAssembly.js:259`) → the Sonnet strategy prompt, plus `agentNewsContext.js:259-302` and `agentTriggerGate.js`. Gated only by `EXA_RETRIEVAL_ENABLED=false` (`featureFlags.js:1215`). The strict "no *raw* retrieved free text / no execution influence" line does hold; the *absolute* claim does not.

2. **§11 — the prose-honesty sweep covers every module feeding agent prompts. (Q10)** False. `agentNewsContext.js` — the Wire/news channel into the eval prompt — is in `CLASSIFIED_NON_REGISTRY_IMPORTS`, not `PROMPT_CONTRIBUTING_MODULES` (`promptHonestyRegistry.js:61,67`), explicitly *not* asserted prose-free.

3. **§3.7 / §8.6 — data crosses the equip boundary as canonical symbol IDs only; "what survives a save is the ticker." (Q15)** False. The watchlist **name** and **thesis** (user free text) cross onto the agent settings doc (`equip-watchlist.js:104`), into the frozen battle snapshot (`agentBattleService.js:181-183`), and into the Sonnet strategy prompt (`decide.js:382` → `agentPromptAssembly.js:126-150`). They are sanitized (`sanitizeRuleText`), but they are not symbol IDs.

4. **§6.1 — relative-move decomposition is computable. (Q9)** Not on HEAD. Peer/rank/score stores are latest-snapshot-only and overwritten each run (`compute-rankings.js:1320,1400`); only price closes carry history (`:290`). There are no prior-period peer values, no dated cohort roster, and no stored own-metric-vs-peer delta. Decomposition is a data build, not a query.

5. **§5.2 / §6.4 — a versions envelope (`detectorVersion`, `sourceDataVersion`) and a trend lifecycle are available at detect/write/read. (Q17)** Absent. No such fields and no lifecycle entity exist in the detection substrate; the only stamps are `computedAt`/`expiresAt` freshness horizons, and there is no diffable rank/score history.

6. **§5.4 / §7.4 — late writes use compare-and-set; invalidation is ordered by CAS on `sourceDataVersion`. (Q18)** Absent. Both detection crons persist via unconditional `batch.set` (`compute-rankings.js:1403,1408,1418`; `compute-index-intelligence.js:1000,1232`); no CAS, no `sourceDataVersion`, no transaction; cross-cron ordering is wall-clock only.

7. **§8.3 — a deterministic listing identifier exists; collision-prone single-letter tickers are handled; name→ticker resolution is available; off-universe issuers have metadata. (Q4)** False on every clause. Identity is the bare ticker string (no CUSIP/FIGI/exchange/share-class); `C`/`F`/`K`/`T` are bare keys with no disambiguation (and `A` is not even in the universe); universe search excludes company names (`tickerSearchMatch.js:6`); no off-universe issuer metadata is stored. **Related:** the "232-ticker universe" (§8.1/§15 and throughout) is stale — the live count is **239** (`rankingConfig.js:359`).

8. **§7.6 — differentiation phrasing can simply be excluded from set-analyst chips. (Q5)** Understates the problem. Two differentiation chips ("What separates the winners from the laggards?", "Which are the outliers?") ship as the **default** opening actions (`watchlist-analysis.js:276-277`), the opening narration uses the phrasing (`:270`), and there is no phrasing filter (`:144-151`). Banning them is a live product change, not a no-op.

9. **§7.8 — a tested horizon-routing taxonomy exists (or is close). (Q20)** False. The only deterministic router classifies by display *dimension*, not *horizon* (`watchlist-analysis.js:91-100`); "since earnings" is unrecognized; unknown timeframe silently defaults to `return1M`-desc; there is no typed-only branch.

10. **§4.1 / §4.2 — the Alex-arc domain list and date guard are reusable as a shared module. (Q2)** Partial. `EXCLUDED_DOMAINS` and `hostOf` are exported; `withinWindow` (the date guard) is **not** exported and the window is inline; all of it lives in the mover module — no shared module exists.

11. **§4.3 / §14 — a bounded Haiku-class distillation client/seam is available out of the box. (Q14)** False. `wireModelCall` has no timeout and no `maxRetries`; no Stage-2/extraction seam is registered in `SEAM_EXECUTION`; the only bounded Haiku call is inline in `agent-evaluate`. `gemmaClient` is Gemma/OpenRouter, not Haiku.

12. **§5 / §7.2 / §10 — durable post-response execution is a missing capability the spec must introduce. (Q11)** Overstated in the opposite direction: `waitUntil` (`@vercel/functions`, 20 sites) **and** the cron pending-flag pattern exist. The real gap is narrower: neither is wired for EXA+distillation, `waitUntil` is `maxDuration`-bounded, and its fire-and-forget-`.catch` form is forbidden by BUILD_RULES §5 for durable writes.

13. **§7.9 — notes are "resolved against revocation at read time." (Q8)** No such machinery exists. Watchlist notes is a plain ≤2000-char string returned verbatim on every read path, with no source references and no read-time resolution. (Upside: watchlist notes never reaches Gemma or an agent today.)

14. **§8.6 / §3.8 — persistence enforces referential independence. (Q16)** False mechanism. Independence holds only because the screener performs no retrieval; the persistence layer actively forwards the stored Gemma `message` (history replay), `latestSpec` (re-injection), and `appliedSpec` (watchlist metadata).

15. **§5.1 / §9 — a single per-`themeKey` cache doc is a safe storage choice; append-cap/TTL are structural. (Q23)** Complicated. A single shared doc is a hot-doc (~1 write/sec) and 1MiB-growth risk; Firestore rules cannot enforce the cap, doc size, write rate, or a TTL — all are server-code duties (`ingestedClaims` precedent).

16. **§11 — URLs are sanitized at render. (Q25)** Not uniformly. `WhyMovingPopup.jsx:145` renders external citation `href`s with no protocol allowlist; only the markdown path sanitizes; no DOMPurify.

17. **§5.3 (F-15) / §9 — EXA result stability and response schema are known. (Q13)** Unverifiable from the repo. No fixture/provenance JSON exists; stability across identical queries has zero evidence and `type:'auto'` is a non-deterministic router; failure-path cost is structurally unavailable.

---

## 4. New-build inventory

What the spec assumes exists that does not, and would be built from zero (or from a non-reusable precedent):

- **Shared hygiene kernel (§4).** No shared retrieval-hygiene module exists. The domain list + `hostOf` are exported but live in the mover module; the date guard is private and the window inline. The three-stage pipeline, controlled vocabulary, four registers, template renderer, selection-provenance line, and empty-result register are all net-new.
- **Stage-2 distillation seam + bounded client (§4.3, §14).** No extraction seam in `SEAM_EXECUTION`; no wrapper with timeout/retry/token-cap/prompt-version. `wireModelCall` is the closest transport but is Wire-fenced (R-A1) and unbounded; the bounded-call precedent is inline in `agent-evaluate`.
- **Lease primitive (§5.4).** Atomic singleflight + stale-owner recovery exist (`agent-evaluate.js:544-577` `evaluatingAt`), but owner token, attempt count, and a reusable shared module are new.
- **Versions envelope + supersession/revocation (§5.2, §5.3).** `detectorVersion`/`sourceDataVersion`/`normalizerVersion`/`vocabularyVersion`/etc. do not exist in the detection substrate; supersession, `superseded_by`, visible-regeneration, and read-time revocation resolution are all new. (The Wire arc's `schemaVersion` is a separate lineage.)
- **CAS / transaction ordering (§5.4, §7.4).** Detection crons use unconditional `batch.set`; compare-and-set on `sourceDataVersion` and cross-store ordering are new.
- **§6.1 decomposition data + §6.2 mechanical screens (§6).** Requires persisting historical per-issuer typed metrics and peer/cohort snapshots (none retained today) and raw quarterly EPS/revenue + share-count series (not persisted).
- **Trend lifecycle entity (§6.4).** No trend/episode store, no lifecycle state machine, no diffable rank/score history.
- **The three cache collections (§9).** `thematicSearchCache`, `thematicOffUniverseHits`, `tickerTrendContext` do not exist — collections, indexes, rules, and (server-code) caps/TTL are all new.
- **Workstream A router + candidate/issuer-identity machinery (§8).** No router, no intent-key normalization, no off-universe path, no per-candidate sourced-reason/link render slot, no deterministic name→ticker resolver, no stable listing identifier. Privacy/abuse controls (per-user quota, novelty ceiling, negative-cache cooldown) are new.
- **Routing taxonomy for the ask box (§7.8).** A horizon/event-date taxonomy with a typed-only fallback and tests — new (the existing router classifies by column).
- **Golden-set extraction harness (§2).** No extraction golden-set or acceptance matrix exists.
- **Persisted cost ledger + weekly rollup (§10).** EXA `costDollars` is console-logged only; a persisted cost collection is a prerequisite for the rollup (the host schedule itself exists — Q24).
- **Register-lint / deflection layer for Gemma (§4.9).** Only observability drift-detection exists; the lint/deflection gate is new.

---

## 5. Observations (not proposals — noted only)

1. **The bright-line risk is a flag flip, not a new wire.** Because the EXA→Wire→agent channel is already assembled and dark (`EXA_RETRIEVAL_ENABLED=false`), the platform's "retrieval never touches agent reasoning" property currently depends on one boolean plus the (separate) Alex-arc's dormancy — not on structural isolation. Anyone enabling the Alex mover EXA flag for the Wire's own reasons would, as a side effect, route retrieval-influenced headlines into trading-agent prompts. Worth stating in the spec even though it predates this arc.

2. **The prose-honesty sweep has a stated blind spot on exactly the channel that matters.** `agentNewsContext.js` (news → eval prompt) is deliberately outside `PROMPT_CONTRIBUTING_MODULES`. Any future decision to let validated retrieval components ride the news channel would land in an unswept module.

3. **`sanitizeRuleText` is the de-facto trust boundary for free text entering agent prompts** (`agentPromptAssembly.js:293`). Watchlist name/thesis already rely on it. If A ever lets an approved display label travel further than the ticker, this is the single guard it would lean on — length cap + a fixed injection-pattern list, not a semantic filter.

4. **The universe is 239 and drifts.** Any spec arithmetic keyed to "232" (cost envelope, fanout multiplier) is off by ~3% and, more importantly, keyed to a number that changes when a sector list is edited; `ALL_TICKERS.length` is the live source.

5. **`why-moving` is a second, live retrieval-shaped surface** rendering external citation URLs to the browser without protocol allowlisting (`WhyMovingPopup.jsx:145`). It is not in this arc's scope, but it is the existing pattern an EXA-URL renderer would inherit, and it is the place the §11 URL-sanitization guarantee is currently untrue.

6. **`ingestedClaims` is the working template for a revocable platform cache** (`ingestedClaims.js`): no explicit rule (catch-all deny), Admin-SDK writes, `expiresAt` field + a manual `deleteExpired()` sweep, 500-doc batches. It answers most of the §5/§8.5/§23 "how do we do a safe server-only expiring cache" questions by precedent.

7. **The set-analyst surface is genuinely episode-free today (Q19).** Whatever fanout ceilings B adds are additive over a path that currently detects nothing — so the risk B introduces is entirely new spend, not the taming of an existing blow-up. The 40-symbol set cap is the natural ceiling to inherit.

---

## 6. STOP

Report committed to `docs/audits/EXA_RETRIEVAL_PHASE0_DISCOVERY_AUG2026.md` and pushed to `claude/exa-retrieval-discovery-audit-28b9qu`. No other file changed; no branch/PR/merge action taken; no cron or endpoint executed. This is a hard STOP pending founder review. No implementation, scaffolding, or next-phase work follows.

*EXA_RETRIEVAL_PHASE0_DISCOVERY_AUG2026 — read-only discovery audit, Aug 6, 2026. Pairs with EXA_RETRIEVAL_INTEGRATION_SPEC_V1_3.md.*
