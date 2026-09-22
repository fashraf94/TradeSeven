# FantasyTrades Trading Agent Architecture Audit

## Baseline, coverage, and executive assessment

**Discovery only. No implementation or runtime qualification.**

- Repository: C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel.
- Inspected commit: 1740996d43100a94fa97f9e9958b48c297d2017f; September 21, 2026; merge of PR #885.
- Initial checkout: detached HEAD, clean. Authorized task branch created: codex/trading-agent-architecture-audit. HEAD unchanged; final repository status has no reported changes.
- Remote freshness: UNVERIFIED. Initial fetch failed on Git metadata permissions; automatic approval review rejected the escalated fetch. No remote comparison is claimed.
- Scope: application entry points, schedulers, ranking/data pipelines, six archetypes, BaggerBomb and tournament agents, Managed Mandate, partnership/Forge paths, enforcement, records, learning, and relevant tests read as source.
- Excluded: production records, secrets, external Harness Lab, Hermes/Pi environments, deployed configurations, paid calls, experiments, tests/builds, trading/settlement execution, dependency installation, repository edits, commits, pushes, PRs, merges, and deployment.
- Git status reported no changes but warned that the user-level Git ignore file was inaccessible. No repository file was written by this audit. This report is outside the repository.

Applicable AGENTS/CLAUDE/BUILD_RULES and the documentation index were inspected first. The available index was used; generated canonical/rulings indexes under docs/knowledge were not present in this checkout. The September 19 brain/Jev audit covers an earlier BaggerBomb-focused baseline. Its adjudication explicitly says **proposed**, so neither is evidence that this task was already completed. The tick-capture build report describes an off switch, but the current checked-in flag is true; its claimed deployment prerequisites remain unverified. Sources: [docs/BUILD_RULES.md:7–90](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/BUILD_RULES.md:7>); [docs/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md:3–7](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md:3>); [docs/audits/20260921_BUILD_TICK_CAPTURE.md:11–40](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/audits/20260921_BUILD_TICK_CAPTURE.md:11>); [src/config/featureFlags.js:2650–2692](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:2650>).

| Executive conclusion | Practical meaning |
|---|---|
| Preserve and extend the architecture | Ranking, identity, deterministic controls, mode contracts, technical evidence, learning receipts, and tick capture are substantial assets. No rewrite is justified. |
| The active system is mixed | Normal deployment is rank-first; intraday decisions mix technical setups, ranks, catalysts, controls, and model judgment; tournament deployment is prescribed; Mandate uses a curated snapshot slate. |
| Lower-ranked stocks are not categorically excluded | Equipped watchlists can force attention at deployment; catalysts can add ranked-universe names intraday. Admission caps and evidence coverage still determine whether meaningful investigation occurs. |
| Authority coverage needs repair before greater autonomy | Approved proposals/gameplans do not repeat the full normal validation path. Some hard user guardrails run after a model-trigger early return. |
| A cross-mode unit mismatch needs separate adjudication | Mandate copies sector caps of 2/3/4 into a fraction-based gate. That does not constrain normal sector exposure as a percentage cap would. |
| Differentiation exists but falls short of the target | Weights, churn limits, rotation behavior, identity and bounded controls differ. Several advertised regime/conviction fields are not live enforcement; marginal correlation and durable setup lifecycles are not established. |
| The smallest pilot is a contract extension | One archetype, one mode, existing model, sealed evidence, explicit setup/wait/invalidation, linked records and deterministic verification. No new service or live JEV hop is required. |

**Evidence vocabulary:** O = observed current source and caller/flag conditions; T = test source inspected, never executed; D = documentation/intended behavior; I = inference or proposed consequence; R = unavailable runtime/deployment evidence. “Active” below means reachable under checked-in conditions, not confirmed deployed.

## A. Current decision architecture

### Entry-point inventory

| Trigger/caller | Reachable path | Principal effect |
|---|---|---|
| User deploy through agentDeploy | POST /api/agent/decide | Authenticate, resolve agent/build/watchlist, obtain rankings, Sonnet shortlist/strategy, Haiku portfolio, validate and create battle. |
| Tournament orchestrator/draft | tournamentAgentBoards → tournamentAgentDraft → prescribed decide path | Generate ranked boards, resolve exclusive snake draft, deploy six prescribed stocks; deployment itself does not reselect. |
| Scheduled evaluator | agent-evaluate, every 15 minutes during configured weekday UTC hours; market/session guards | Price/score/risk work, conditional reasoning, validation, swaps, records and completion. |
| Chat, Forge and watchlist actions | chat, directiveGate, watchlist routes, equip-watchlist | Research/conversation; bounded directives; saved/committed/equipped attention sources and deploy-time rules. |
| Scheduled Mandate evaluation | mandate-evaluate; direct transport selected | Snapshot and pinned vintage → one BUY/ADD/SELL/TRIM/HOLD proposal → gate and revision-aware execution. |
| Completion/review jobs | pendingReflection queue → reflect; agent-batch-review | Reflections, lessons, debrief and periodic consolidation. |
| Historical season handlers | Retained files without current schedule entries | Do not count these as scheduled active agent modes. |

Callers and schedules: [src/services/agentDeploy.js:108–116](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/services/agentDeploy.js:108>); [api/agent/decide.js:83–153](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:83>); [api/_utils/tournamentAgentBoards.js:408–511](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tournamentAgentBoards.js:408>); [api/_utils/tournamentAgentDraft.js:85–142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tournamentAgentDraft.js:85>); [vercel.json:149–206](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/vercel.json:149>); [docs/BUILD_RULES.md:76–85](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/BUILD_RULES.md:76>).

### Normal deployment

1. The client resolves the agent/clone and calls decide. The route separates authenticated user deployment from internal tournament deployment.
2. The normal path requires indexIntelligence/stockRankings. It computes archetype rankings over the available rows and sends the full ranked CSV to Sonnet. There is **not an unconditional top-35 cut before this first reasoning call**.
3. It adds recent FantasyTimes stories and the equipped watchlist's name, tickers and thesis. If Sonnet fails to supply the expected tool selection, the deterministic top-35 archetype fallback applies.
4. Equipped symbols are unioned into the shortlist. The tiered policy intentionally permits a rankings-plus-watchlist universe, including some symbols absent from rankings; tournament policy has stricter ledger/universe constraints.
5. Haiku chooses the portfolio from the resulting shortlist/data. Invalid selections enter retry/fallback handling. Baseline price validation and mode checks precede creation.
6. createAgentBattle freezes agentContext, deployed controls, initial watchlists and a resolved manifest when enabled. The launch execution mode is autopilot.

Sources: [api/agent/decide.js:318–528](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:318>); [api/agent/decide.js:552–646](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:552>); [api/agent/decide.js:820–931](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:820>); [api/_utils/agentBattleService.js:181–272](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentBattleService.js:181>); [api/_utils/gameModePolicy.js:41–83](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/gameModePolicy.js:41>).

Tournament boards still use ranks and model selection, with deterministic padding/fallback. The prescribed deploy route enforces exact mode size, stocks-only eligibility and known universe membership. Sources: [api/_utils/tournamentAgentBoards.js:125–249](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tournamentAgentBoards.js:125>); [api/agent/decide.js:1245–1266](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:1245>); [api/agent/decide.js:1302–1482](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:1302>).

### Intraday BaggerBomb flow

Scheduled handler → active battles ordered by evaluation start age → per-battle transaction/lease and tickSeq → fresh prices and score calculation → technical/macro evidence and candidate refresh → deterministic risk pass → post-trade state refresh → proposal/gameplan branches → news/catalyst augmentation → trigger gate → prompt/model → controls/validation → reserve/execute/confirm → decision, learning, capture and explanation records.

Material details:

- The function has a 300-second platform setting and 290-second internal budget. Battles run sequentially; the lease TTL is 120 seconds. This is not evidence of a current overlap incident, but replay and execution design must account for mutable state beyond initial admission. [api/cron/agent-evaluate.js:166–194](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:166>); [api/cron/agent-evaluate.js:375–408](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:375>); [api/cron/agent-evaluate.js:634–689](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:634>).
- Force-refreshed prices and positive/non-fallback quote health protect held and CPU scoring. Invalid required quotes skip the tick. Technical documents are fetched for held plus original bench symbols; intraday candles are held-only. VWAP has session/coverage/age checks. [api/cron/agent-evaluate.js:792–872](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:792>); [api/cron/agent-evaluate.js:1102–1142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1102>).
- A refreshed hot bench uses the top 15 by BaggerBomb fit, with equipped-symbol retention and a soft cap of 20. New hot-bench symbols get prices and ranking-derived rows, but not the same pre-decision technical-document fetch. Up to five cross-tagged news candidates can enter if a ranking row exists and tournament constraints allow them. [api/cron/agent-evaluate.js:1153–1304](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1153>); [api/cron/agent-evaluate.js:2203–2253](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2203>).
- Risk logic precedes model gating: bust/VWAP protection, bonus locks, trailing and archetype stagnation. After forced trades, a successful refresh rebuilds decision state. A failed refresh suppresses discretionary reasoning and records failure. [api/_utils/agentRiskManager.js:115–196](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentRiskManager.js:115>); [api/cron/agent-evaluate.js:1993–2116](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1993>).
- Approved proposals and approved gameplans can execute through alternate branches. Gameplan suppression invokes a deterministic guardrail pass; pending-proposal early return does not have the same call. No-trigger return precedes the normal applyGuardrails call. [api/cron/agent-evaluate.js:2101–2192](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2101>); [api/cron/agent-evaluate.js:2295–2314](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2295>); [api/cron/agent-evaluate.js:2857–2990](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2857>).
- Triggered reasoning has a 10-second prompt-build budget and 22-second model budget. An accepted tool result does not authorize execution: locks, distressed-entry veto, trade validation, hurdle/window checks and tournament reservation still apply. Guardrail exceptions fail closed to a failure HOLD; already committed risk trades remain real actions. [api/cron/agent-evaluate.js:2372–2578](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2372>); [api/cron/agent-evaluate.js:2968–3280](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2968>).
- executeSwapServer transactionally rereads the slot and writes the portfolio/trade history. It checks self/duplicate positions, but does not itself reproduce every caller-side policy check. A fresh live beacon may replace the price supplied by the caller, so the execution is not solely a function of the model packet. [api/_utils/agentSwapExecution.js:152–210](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:152>); [api/_utils/agentSwapExecution.js:316–369](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:316>).

**Failure semantics:** missing deployment rankings reject normal deployment; model selection has rank fallbacks; bad held quotes skip scoring/decision; unusable VWAP disables that signal; absent macro defaults to selective; invalid/failed model results become a failure HOLD; guardrail exceptions fail closed for the remaining proposed action; reservation rejection prevents that swap. A no-action result can therefore mean deliberate HOLD, no trigger, unavailable evidence, exhausted budget, invalid output, or rejected execution. Records and UI should preserve those distinctions.

### Managed Mandate

This is a separate, checked-in enabled architecture, not a dormant name or a BaggerBomb alias. It uses a virtual cash-and-shares book, a quarterly pinned archetype/model/gate vintage, shared tick snapshots, configured cadence tiers and one model action. The default seat is Anthropic Haiku at temperature 0.7 with 600 output tokens. Flags enable evaluation/close and founder creation; rollover remains false. Actual creation/deployment/use is R.

Candidate snapshots union held tickers with a curated universe under a 300-symbol cap. The prompt selects the first 40 complete non-held snapshot entries, then may trim for token budget; each candidate line supplies ticker, price and sector. This is an order-limited slate, not the BaggerBomb ranking pipeline.

The gate separates exit and entry lanes. Execution uses decision identity, transactional duplicate detection, current book revision/envelope validation, mark drift/freshness checks and accounting invariants. These are valuable reusable patterns, subject to the sector-cap defect in G03. Sources: [api/_utils/mandateConfig.js:27–157](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateConfig.js:27>); [api/_utils/mandateUniverseSnapshot.js:80–109](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateUniverseSnapshot.js:80>); [api/_utils/mandatePromptAssembly.js:41–108](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandatePromptAssembly.js:41>); [api/_utils/mandateGenerationConfig.js:25–53](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateGenerationConfig.js:25>); [api/_utils/mandateGate.js:59–151](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateGate.js:59>); [api/_utils/mandateExecution.js:435–603](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateExecution.js:435>); [src/config/featureFlags.js:1914–1967](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:1914>).

## B. Component and ownership map

“Target owner” below is a recommendation, not an assertion that these three subsystems currently exist as separate services.

| Component / storage surface | Observed responsibility and status | Intended/target owner |
|---|---|---|
| compute-rankings; peerRankings, sectorRankings, scannerSummary | Fundamental peer/sector analysis and scanner output; scheduled source | Brain evidence production; Harness authorizes source/cutoff |
| compute-index-intelligence; stockRankings, stockTechnicalScores, marketContext | Technical/composite/momentum/BB-fit fields and market evidence | Shared evidence layer; Harness provenance; Brain interpretation |
| archetypeRegistry, identity/character tables, archetypeScoring, agentArchetypeConfig | Six identities, weights, compatibility, behavior knobs; some fields descriptive/inert | Brain core; Harness enforces declared vetoes |
| Forge rules/bundles, projectActiveRules, build resolution | Resolve equipped live rules and conflicts for deployment; compiler remains off | Partnership preferences; Harness compatibility/authority |
| agentContext, resolvedAgentManifest | Battle snapshot of identity/controls; manifest writes enabled | Shared versioned contract; Harness owns pinning |
| decide, tournament boards/draft | Candidate selection, initial portfolio and prescribed dispatch | Brain proposes; Harness eligibility and creation |
| agent-evaluate | Evidence retrieval, risk, reasoning orchestration, validation, mutation and records in one handler | Separate responsibilities inside existing modules before considering services |
| agentRiskManager, agentGuardrails, validateTradeDecision | Deterministic but path-specific protection and action checks | Harness |
| executeSwapServer; tournament reserve/confirm ledger | Transactional mutation and exclusive-symbol coordination | Harness final disposition |
| chat, directiveGate, controlPromptRenderer, watchlists | Conversation, bounded control interpretation, attention and explanations | Partnership, with Harness admission constraints |
| evaluations, statusFeed, tick/tickBody documents, learning receipts | Decision/action history, HTTP capture, controls, evidence predicates and provenance | Harness records; Partnership reads for explanation |
| reflect, batch review, consolidation; lessons/disciplines/consolidatedInsight | Automated post-game model-generated persistent influence | Partnership/Brain learning; Harness acceptance/version/rollback |
| Mandate vintage/snapshot/gate/execution | More explicit execution contracts, separate portfolio semantics | Brain plus Harness; Partnership linkage incomplete |
| External Harness Controller, Hermes, Pi | No interfaces verified in inspected application paths | Harness Lab ownership; independent peer adapters |
| JEV experiment runner/reports | Narrow research evaluation, not active trading authority found | Research judge; Harness accepts/rejects/routes judgments |

Key contract evidence: [api/_utils/archetypeRegistry.js:115–165](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/archetypeRegistry.js:115>); [api/_utils/projectActiveRules.js:62–108](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/projectActiveRules.js:62>); [api/_utils/resolvedAgentManifest.js:101–165](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/resolvedAgentManifest.js:101>); [src/config/featureFlags.js:1421–1482](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:1421>). Database names identify schemas only; no private records were read.

## C. Archetype differentiation matrix

The six code IDs are momentum_chaser, contrarian, degen, analyst, diversifier and guardian. The ranking universe contains **239 unique literal stock symbols across 11 sectors** at this baseline, not exactly 250. This is a source count, not a runtime coverage count. [api/_utils/rankingConfig.js:15–82](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/rankingConfig.js:15>).

### Executable differences

Weight vectors below are F/T/B/A/I/D: fundamental, technical, BaggerBomb fit, ATR percentile, inverse composite, and universe-sector rarity. Values are percentages.

| Archetype | Rank weights F/T/B/A/I/D | Rotation and discretionary swap policy | Live evidence/identity emphasis; target gap |
|---|---|---|---|
| Trend Follower | 5/40/30/25/0/0 | Stagnation movement threshold 0.15%, 5 qualifying ticks; winner floor 0.15%; model hurdle 0.35 ATR; 6 swaps/60 min | Trend/sector strength, confirmation and days-scale identity. Persistent relative strength, breakout acceptance and tracked invalidation are not a complete live lifecycle. |
| Contrarian | 15/10/15/20/40/0 | 0.30%, 6 ticks; winner floor 0%; hurdle 0.40 ATR; 4/60 min | Inverse-composite selection plus recovery/turnaround prose. Registry says canEnterDistressed=true, but normal evaluator rejects distressed incoming names for all archetypes. |
| Speculator | 0/15/25/60/0/0 | 0.10%, 3 ticks; winner floor 0.20%; hurdle 0.20 ATR; 12/60 min | Strong volatility preference and faster turnover are real. Explicit event-time/catalyst-decay state is not established in active reasoning. |
| Fundamental Investor | 40/30/15/5/0/10 | 0.30%, 6 ticks; winner floor 0%; hurdle 0.40 ATR; 4/60 min | Stronger fundamental weighting; valuation/growth/revision fields can appear. Persistent business thesis, cash-generation evidence hierarchy and thesis deterioration remain incomplete. |
| Diversifier | 25/20/20/5/0/30 | Same basic rotation/hurdle/window as Fundamental Investor | Sector coverage prose and universe-sector rarity. The score is not marginal diversification against current holdings; live correlation/theme exposure veto not found. |
| Capital Preserver | 30/20/10/5/0/35 | Forced stagnation rotation disabled; hurdle 0.50 ATR; 2/120 min | Lower turnover is substantial. Liquidity, distance-to-invalidation, drawdown and exit-quality policy are not comprehensively represented. Positive ATR weight is not itself a low-volatility veto. |

Sources: [api/_utils/archetypeScoring.js:15–142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/archetypeScoring.js:15>); [api/_utils/agentArchetypeConfig.js:36–218](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentArchetypeConfig.js:36>); [api/_utils/evalIdentityBlocks.js:99–141](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/evalIdentityBlocks.js:99>).

These are base settings, subject to existing tempo/control clamps and protective-action exceptions. Tick counts are qualifying observations with age rules, not guaranteed elapsed minutes. Emergency actions are excluded from the displayed discretionary count limits.

**Shared execution:** candidate sources and S1–S5 setup prose; general stock/market regime classifier; score/clock/bonus physics; standard conviction threshold of 70; locks, eligibility and tournament constraints. All intraday Haiku calls use temperature 0.4, despite different deployment temperatures. Source paths: [api/_utils/agentRegimeClassifier.js:25–148](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentRegimeClassifier.js:25>); [api/_utils/agentEvalPromptAssembly.js:340–438](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.js:340>); [api/_utils/agentSwapExecution.js:28–89](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:28>); [api/cron/agent-evaluate.js:2420–2520](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2420>).

**Declaration versus use:** regimePreferences and convictionMods are exposed through registry/config but their claimed differentiated enforcement was not found in inspected BaggerBomb decision consumers. defaultPreset also does not mean each new battle receives it: battle creation initializes balanced. Archetype concentration counts are not six universally live percentage gates: the derived Diversifier tournament gate is observe-only under SECTOR_CAP_MODE, while equipped user caps have their own path. [api/_utils/agentBattleService.js:252–256](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentBattleService.js:252>); [api/_utils/agentGuardrails.js:101–150](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentGuardrails.js:101>); [src/config/featureFlags.js:939–966](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:939>).

**Mandate differences:** pinned identity and sector-cap values plus cadence distinguish archetypes: Trend Follower/Speculator fast; Contrarian/Diversifier standard; Fundamental Investor/Capital Preserver slow. They share the default model seat. This does not establish differentiated trading quality; its candidate evidence is thin and its cap units need correction.

**Test evidence only:** archetype configuration tests inspect IDs, limits and disabled Capital Preserver rotation; prompt-honesty tests inspect six identities across prompt variants. They do not show that models exhibit the target philosophy or that signals exist for every candidate. [api/_utils/agentArchetypeConfig.test.js:14–76](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentArchetypeConfig.test.js:14>); [api/_utils/agentEvalPromptAssembly.honesty.test.js:37–77](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.honesty.test.js:37>).

## D. Rank dependency and candidate-source maps

### Consequential rank roles

| Use | Role | Consequence if ranks become only one evidence source |
|---|---|---|
| Normal decide requires stockRankings | Prerequisite/data contract | Keep the data contract or supply an explicit equivalent evidence record; deleting ranks breaks deployment. |
| Full archetype-sorted CSV to Sonnet | Weighting input, attention ordering, evidence | Retain ranks while declaring alternative opportunity origin and attention budget. |
| Top-35 fallback and tournament padding | Candidate generator and deterministic fallback | Replace only after defining an equally deterministic multi-source fallback. |
| Hot-bench top 15 by BB fit; monitoring list | Candidate generation/top-N truncation | A valid lower-ranked idea may not be seen unless watchlist/catalyst admission retains it. |
| Ranking row required to materialize hot-bench/catalyst candidate | Effective data-availability prerequisite | Eligibility and evidence completeness must become explicit fields rather than an incidental row-existence check. |
| Fundamental/technical/composite/BB/ATR fields | Weighting and model evidence | Preserve units/cohorts/as-ofs; ranks are not interchangeable raw measurements. |
| Momentum rank/score, raw trend/pattern features | Produced evidence; direct deployment CSV omits momentumScore | Existence upstream does not establish use by every model prompt. |
| Scouting board | Display and research attention | UI should distinguish eligible, investigated, ranked and rejected. |
| Contrarian inverseComposite | Executable weighting input | Removing composite changes the archetype's current candidate behavior. |

Sources: [api/agent/decide.js:318–461](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:318>); [api/_utils/agentPromptAssembly.js:37–57](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentPromptAssembly.js:37>); [api/_utils/agentPromptAssembly.js:239–254](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentPromptAssembly.js:239>); [api/cron/compute-index-intelligence.js:1305–1455](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/compute-index-intelligence.js:1305>); [api/cron/agent-evaluate.js:1153–1288](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1153>).

### Alternative sources and their actual bridge

| Source | Reaches active trading? | Limits |
|---|---|---|
| Equipped committed watchlist | Yes: deployment thesis/tickers; deterministic shortlist/hot-bench union | Battle snapshot retains ID/name/tickers, not activation/invalidation/thesis. Equip route blocks changes while activeBattleId exists. |
| FantasyTimes stories, including enabled retrieval-influenced content | Yes: deployment context, intraday trigger and cross-tag candidates | Recent bounded retrieval; catalysts capped; ranking-row and mode restrictions remain. |
| Technical patterns, squeeze/NR7, levels/divergence | Yes: ranking/technical evidence and triggers/prompt | No universal executable per-archetype setup lifecycle. |
| Fundamental scanners | Through upstream rankings/research surfaces | No separate autonomous scanner-to-order authority found. |
| Screener chat | Research: language translated into deterministic screenStocks | No direct active evaluator caller found. |
| Forge watchlist dialogue/analysis/themes | Research → saved list → commit/equip → deploy | Does not automatically become a live per-symbol hypothesis in the battle. |
| Ordinary user conversation | Bounded directives/leans and explanation | Does not itself append an arbitrary ticker to the live candidate menu. |
| Model suggestions | Within declared selection/tool menus | Cannot assume suggestions expand authorized universe or supply missing evidence. |
| Correlation research | Research/UI surface located | Marginal-correlation veto not found in inspected BaggerBomb/Mandate decision path. |
| Show It research card | Implemented route behind false flag | Do not count as available launched investigative tooling. |
| Mandate curated universe | Yes: snapshot → bounded complete-entry slate | Price/sector candidate packet; no user-hypothesis bridge in assembly inputs. |

Evidence: [api/_utils/watchlistEquip.js:77–175](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/watchlistEquip.js:77>); [api/agent/equip-watchlist.js:86–97](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/equip-watchlist.js:86>); [api/forge/watchlists.js:424–447](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/forge/watchlists.js:424>); [api/agent/scouting-board.js:86–158](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/scouting-board.js:86>); [api/screener/chat.js:36](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/screener/chat.js:36>); [api/forge/watchlist-analysis.js:196–237](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/forge/watchlist-analysis.js:196>); [src/config/featureFlags.js:2420–2436](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:2420>).

**Eligibility is separate from rank.** Authorized tiered watchlist expansion is existing policy, not evidence of unrestricted trading. Tournament held-symbol exclusion, prescribed stock universe, mandatory crypto slot in tiered mode, data availability, cooldowns, instrument-type matching and usable prices are different restrictions. A low rank alone is not a universal veto. Tests explicitly preserve both omitted in-universe and off-ranking equipped symbols. [api/_utils/watchlistEquip.test.js:117–147](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/watchlistEquip.test.js:117>); [api/_utils/gameModePolicy.js:41–99](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/gameModePolicy.js:41>).

### Setups and data availability

Existing live prompt setups are S1 squeeze breakout; S2 breakout confirmation using RVOL, BB %B and relative strength; S3 strong-relative-strength pullback; S4 mean reversion; S5 news catalyst. Technical calculations/pattern detectors already provide useful inputs. The live trigger gate detects events, not proof that a valid entry setup exists.

There are also **deterministic learning classifiers**: D1 extension/room, D2 volume/momentum confirmation and D3 chop/churn. D1 annotations are written with receipts; D2/D3 appear in corpus analysis, not the active entry gate inspected. Reuse their data and missingness semantics after qualification; do not advertise them as an already qualified live setup engine. [api/_utils/learning/detectorClassifiers.js:90–123](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/detectorClassifiers.js:90>); [api/_utils/learning/detectorClassifiers.js:219–327](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/detectorClassifiers.js:219>); [api/_utils/learning/captureReceipt.js:213–235](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/captureReceipt.js:213>).

| Evidence | Current availability / limitation |
|---|---|
| Daily OHLCV, SMA/RSI/MACD/ATR, levels, candles, relative strength, BB | Available/derived; per-candidate coverage and bar basis vary. |
| Intraday prices and held-symbol VWAP | Available with specific checks; not equal coverage across candidates. |
| Intraday RVOL | Do not infer from the synthetic daily refresh: injectIntradayBar deliberately uses average volume. D2 treats intraday volumeRatio as unknown. |
| Valuation, revenue growth, market cap, selected EPS revision/beat/surprise fields | Available where populated; null/as-of rendering exists. |
| Business-quality/cash-generation thesis, revision history, catalyst timing/decay | Some upstream inputs/research exist; a complete live decision packet/lifecycle was not established. |
| Correlation/cross-theme marginal exposure | Research capability exists; active portfolio integration not found. |
| Liquidity/spread/depth and realistic execution-quality evidence | No sufficient active packet established; provider coverage/licensing requires external confirmation. |

Sources: [api/cron/compute-index-intelligence.js:258–288](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/compute-index-intelligence.js:258>); [api/_utils/learning/barBasis.js:51–104](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/barBasis.js:51>); [api/_utils/fundamentalsRender.js:96–176](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/fundamentalsRender.js:96>); [api/_utils/agentEvalPromptAssembly.js:1588–1725](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.js:1588>). New provider spend is not justified until existing coverage is measured.

## E. Partnership, identity, and learning map

| State | Writer → reader | Scope/lifetime and observed effect |
|---|---|---|
| Archetype core | Versioned source registry → deployment/evaluation/Mandate vintage | Stable release identity exists. BaggerBomb uses frozen context plus some live config; Mandate pins a fuller quarterly vintage. |
| Equipped rules/build | Forge/profile operations → projectActiveRules/build resolution → frozen agentContext | Live equipped rules are projected at deploy; conflict/compatibility mechanisms exist. Compiler and shadow assembly are off. |
| Standing leans/dials/settingsRev | User settings → deploy snapshot/control renderer | Durable bounded preferences and revision lineage; not a complete normalized model of industries, explanation preference and horizon. |
| Watchlist thesis and conditions | Forge/watchlist routes → deploy prompt | Rich saved object; thesis reaches Sonnet; battle snapshot drops thesis/activation/invalidation. |
| Conversation/directives | Chat model plus directiveGate → battle ledger/control renderer → eval prompt | Canonical allowed adjustments, core-conflict/research-only outcomes, killed/overridden controls and expiry handling exist. |
| Temporary Vision | Reader in evaluator; generic factory/service and completion transition | Schema has thesis/confidence/conflicts/evidenceTrail, but a complete ongoing agent-hypothesis writer lifecycle was not found. Generic service writes battles, not agentBattles. |
| Evaluations/receipts/explanations | Evaluator/renderer → battle UI | Can distinguish filed/heard; echoed directive IDs are not proof of causal influence or execution. |
| Lessons/disciplines/insight | Reflection/batch-review/consolidation → future prompts/deployments | Automated persistent influence; structural validation, not demonstrated semantic/archetype-quality qualification. |

Sources: [api/_utils/agentBattleService.js:181–244](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentBattleService.js:181>); [api/_utils/controlPromptRenderer.js:104–237](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/controlPromptRenderer.js:104>); [api/_utils/directiveGate.js:139–213](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/directiveGate.js:139>); [api/_utils/directiveUtils.js:38–78](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/directiveUtils.js:38>); [src/types/vision/visionFactory.js:29–52](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/types/vision/visionFactory.js:29>); [src/firebase/firebaseService.js:240–243](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/firebase/firebaseService.js:240>); [api/cron/agent-evaluate.js:1382–1408](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1382>); [src/screens/battleView/deriveReceipts.js:1–23](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/screens/battleView/deriveReceipts.js:1>).

**Disagreement and authority.** ARCHETYPE_INTEGRITY_MODE is enforce and standing leans are enabled. A user request can be classified as a core conflict or research-only; allowed adjustment IDs are validated and rendered as bounded influence. Semantic fit checking is disabled, so valid ID admission does not establish perfect semantic understanding of every conversation. Grounded voice is shadow by default and Show It is off. Advice-first progression is the target, but new BaggerBomb battles initialize autopilot and the launch UI removed the execution-mode toggle. Existing manual/copilot fields are not a qualified delegation ladder. [src/config/featureFlags.js:703–887](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:703>); [src/config/featureFlags.js:2271–2274](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:2271>); [src/screens/AgentBattleScreen.jsx:2625](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/screens/AgentBattleScreen.jsx:2625>).

**Horizon.** Signal-drop parsing recognizes intraday/swing/positional/long-term language, while BaggerBomb creation defaults to a full trading day and has fixed mode timing. Mandate supports a three-month book. A user's long-term idea must be contextual research or explicitly translated into an allowed near-term setup; no complete typed horizon-conflict policy was found in the active integration. Directive expiry labels also need care: legacy 3_games is implemented as three trading days within the battle, with permissive fallback when timing is absent.

**Learning.** Reflection uses Sonnet; every fifth game can trigger Sonnet consolidation. Consolidation validates structure, lengths and referenced lesson IDs and writes disciplines/insight/history. Confidence increments and retirement after repeated contradictions are heuristics, not demonstrated calibration. Persistent lessons can help continuity, but common consolidation principles and outcome-led lessons can cause convergence, hindsight contamination or preference drift unless accepted against evidence and identity policy. These are risks, not measured corruption. A complete reversible prior-state snapshot for each learning promotion was not found in inspected writers. [api/agent/reflect.js:97–186](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/reflect.js:97>); [api/_utils/agentConsolidationPrompt.js:43–93](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentConsolidationPrompt.js:43>); [api/_utils/agentConsolidationApply.js:43–157](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentConsolidationApply.js:43>); [api/_utils/agentConsolidationApply.js:263–311](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentConsolidationApply.js:263>).

**Action lifecycle.**

- BaggerBomb: deploy initial portfolio; HOLD or slot SWAP; deterministic risk/guardrail substitutions; optional proposal approval; completion. Exit generally requires replacement. WAIT/WATCH can be explanations or monitoring states but are not a complete durable setup lifecycle. ADD/TRIM and free cash sizing are not this mode's action model. Moving attention into hot bench is not a position promotion.
- Mandate: BUY/ADD/SELL/TRIM/HOLD with cash/share accounting and an explicit exit lane. However, prompt text says BUY/ADD only from the candidate slate while slate construction removes held names; this conflicts with ADD's declared purpose and needs a narrow correction.
- Neither inspected model tool establishes a general promote/demote or hypothesis-invalidation state machine. Keep semantic intent separate from executable verbs.

## F. Harness and JEV readiness

### Preserve existing contracts

Reuse archetypeRegistry, gameModePolicy, resolvedAgentManifest, existing decision tools, tick capture, learningSchemas, Mandate request envelopes/vintages and transactional receipts. The compiler is not required to start a pilot and should not be activated incidentally.

Tick capture is a major improvement: an atomic tick sequence, early-exit dispositions, model attempted/dispatched/outcome distinctions, original/final decisions, committed actions, controls/version hashes, evidence vintages, timing/token records and request/response hashes. Text bodies retain HTTP request/response and selected controls separately from the permanent primitive allowlist. The checked-in limits include a three-second finalization budget, minimum remaining time, text/body size caps and 120-day expiry metadata. Missing sequence records, truncation and body expiry are legitimate replay limitations. An expireAt field does not prove that the deployed database TTL policy exists. [api/_utils/tickCapture/captureConfig.js:38–99](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tickCapture/captureConfig.js:38>); [api/_utils/tickCapture/captureSerializer.js:63–185](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tickCapture/captureSerializer.js:63>); [api/_utils/tickCapture/captureWriter.js:156–204](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tickCapture/captureWriter.js:156>).

Learning receipts already capture raw predicates, null flags, source paths, as-of/staleness, classification, execution context and versions. They must remain distinguishable from reasoning inputs: the evaluator can **refetch the incoming technical document after the swap** for capture and recompute its regime. A richer receipt therefore does not prove that the Brain saw those facts before deciding. The source labels this capture_refetch. [api/_utils/learning/learningSchemas.js:155–210](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/learningSchemas.js:155>); [api/_utils/learning/captureReceipt.js:140–161](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/learning/captureReceipt.js:140>); [api/cron/agent-evaluate.js:3323–3363](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:3323>).

### Readiness assessment

| Requirement | Assessment |
|---|---|
| Replay exact retained model input | Supported for complete, untruncated captured bodies within retention. Coverage/runtime retention unverified. |
| Identical model output | Not guaranteed by identical input, model name or temperature; qualification should compare policy behavior and verification. |
| Replay complete deterministic execution | Incomplete for BaggerBomb: live beacon, current time, transaction state, conditional evidence fetches and later records are not one closed packet. |
| Uniform time-bounded evidence | Partial: price/VWAP/news-specific checks exist; no uniform cutoff/TTL/bar-basis contract across all evidence found. Positive quote health is not a timestamp-age check. |
| Structured opportunity/setup/contradiction/invalidation episode | Existing records are extensible but no complete joined lifecycle found across active paths. |
| State/version/rejection identity | Stronger Mandate envelope/vintage pattern; BaggerBomb manifest/tick/action IDs are useful starting points. |
| Cost and latency | Capture supports instrumentation; deployed frequency, tokens, gaps and overhead were not measured. |
| Peer engines and neutral Harness disposition | External interface evidence absent. No verified application adapter to Hermes or Pi. |

Sources for live dependencies: [api/_utils/agentQuoteHealth.js:23–28](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentQuoteHealth.js:23>); [api/_utils/agentEvalPromptAssembly.js:887–931](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.js:887>); [api/_utils/agentEvalPromptAssembly.js:1244–1275](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.js:1244>); [api/_utils/agentSwapExecution.js:181–187](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:181>).

**Engine/provider/policy/verifier separation.** Anthropic SDK and tool-use parsing are embedded in deployed decision paths; Gemma/OpenRouter handles other structured/narrative calls. An engine adapter should accept the same sealed work package and return a normalized proposal plus raw transport evidence. It must not redefine archetype policy or verification. A neutral Harness Controller should run Hermes and Pi as independent peers; Pi must not be placed beneath Hermes. None of those external interfaces was supplied or verified.

**JEV.** Experiment scripts and checked-in direction-judge reports concern narrow directive interpretation/fit. They do not qualify trading judgment, calibrated routing, safety, sizing or execution. No active JEV trading caller was found in the inspected api/agent, api/cron and api/_utils paths. Proposed roles: evidence-support review, identity consistency, failure classification and lesson review. JEV returns a judgment; deterministic Harness policy accepts, rejects, escalates and records it. Start with offline labeled review only if it resolves a measured gap. [scripts/experiments/jevDirectionJudge.js:1–40](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/scripts/experiments/jevDirectionJudge.js:1>); [docs/audits/20260918_JEV_DIRECTION_JUDGE_ROUND2.md:1–33](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/audits/20260918_JEV_DIRECTION_JUDGE_ROUND2.md:1>).

## G. Findings ranked by consequence

Severity refers to credible virtual-game/architecture consequences at this baseline. No production incident is asserted.

### G01 — High: alternate approval paths do not share the full execution authority boundary

- **Status/category:** O; enforcement/authority gap. R deployment exposure.
- **Consequence/path:** an owner can update whole pendingProposal/gameplanMeeting objects under the checked-in rules. Approved handlers resolve bench/slot and reserve a symbol, then call executeSwapServer without the normal complete validation/guardrail/hurdle chain. Even an honest approval can be stale against current policy/state. The executor rereads the slot but does not require the originally expected outgoing identity or rerun all admission checks.
- **Evidence:** [firestore.rules:429–439](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/firestore.rules:429>); [src/services/agentService.js:566–626](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/services/agentService.js:566>); [api/cron/agent-evaluate.js:4409–4492](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:4409>); [api/cron/agent-evaluate.js:5241–5309](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:5241>); [api/_utils/agentSwapExecution.js:152–177](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:152>).
- **Counterevidence/limits:** owner-only client access, server-only creation/portfolio writes, bench existence, self/duplicate checks and tournament reservation remain. Launch autopilot clears pending proposals, and the mode UI is removed; these narrow ordinary usage but do not validate the writable objects or gameplan branch. No exploitation was attempted.
- **Confidence:** high source confidence; runtime exposure unverified.
- **Owner/disposition:** Harness/application execution. Adjudicate first; require a server-owned proposal identity, bounded approval transition and fresh versioned validation for every writer before expanded delegation. Reuse current controls.

### G02 — High: a hard user guardrail can depend on a reasoning wake-up

- **Status/category:** O + I; enforcement scheduling gap.
- **Consequence/path:** no-trigger and pending-proposal returns occur before normal applyGuardrails. A user profit target or custom stop that does not also trigger the earlier risk/trigger system may wait rather than being checked at each eligible tick.
- **Evidence:** [api/cron/agent-evaluate.js:2101–2116](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2101>); [api/cron/agent-evaluate.js:2295–2314](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2295>); [api/cron/agent-evaluate.js:2892–2990](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2892>); [api/_utils/agentGuardrails.js:251–345](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentGuardrails.js:251>); [api/_utils/agentTriggerGate.js:39–200](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentTriggerGate.js:39>).
- **Counterevidence/limits:** riskManager already runs before the model, and gameplan suppression has a guardrail pass. Locks/no replacement can intentionally defer a guardrail; that is a separate precedence rule. No timing failure was reproduced.
- **Confidence:** high ordering confidence; specific live occurrence unverified.
- **Owner/disposition:** Harness. Put mandatory deterministic evaluation on the same eligible-tick authority path independent of model wake-up; separately adjudicate lock/exit precedence.

### G03 — High: Mandate sector-cap units do not match their source

- **Status/category:** O; cross-mode contract defect.
- **Consequence/path:** archetype sectorConcentrationCap values are counts 2/3/4. Registry exposes them unchanged; buildVintagePayload copies them unchanged. Mandate checkSectorCap compares a portfolio fraction with that value. Thus, for example, 0.90 <= 2 passes the sector check. This is a static arithmetic consequence, not an executed test. Multiple same-sector positions can evade a meaningful sector percentage limit while respecting single-position limits.
- **Evidence:** [api/_utils/agentArchetypeConfig.js:66–214](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentArchetypeConfig.js:66>); [api/_utils/archetypeRegistry.js:144–150](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/archetypeRegistry.js:144>); [api/_utils/mandateVintage.js:85–96](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateVintage.js:85>); [api/_utils/mandateGate.js:127–142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateGate.js:127>); [api/_utils/mandateSectorCap.js:46–75](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateSectorCap.js:46>).
- **Counterevidence/limits:** cash and single-position gates still apply; stored vintages may differ and were not read. The spec accepts battle/book enforcement divergence, but that does not demonstrate a valid unit conversion. Gate tests use fractional fixture caps; vintage tests only assert copying the registry value. [api/_utils/mandateGate.test.js:9–15](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateGate.test.js:9>); [api/_utils/mandateGate.test.js:112–143](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateGate.test.js:112>); [api/_utils/mandateVintage.test.js:70–77](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateVintage.test.js:70>); [docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:401–403](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md:401>).
- **Confidence:** high for newly generated current-source vintage; deployed effect unverified.
- **Owner/disposition:** Harness/mode policy. Define units and independently approved Mandate fractions; reject invalid domains at vintage publication. Do not silently divide by six or mutate existing pinned vintages.

### G04 — High for pilot validity: evidence captured after a trade can be mistaken for evidence used to decide

- **Status/category:** O + I; evidence/qualification gap.
- **Consequence/path:** hot-bench candidates lack the initial technical/regime fetch; learning capture repairs the record with a later read. A review can mistakenly credit the model with facts it never received. Intraday synthetic volume also cannot establish genuine RVOL confirmation.
- **Evidence:** [api/cron/agent-evaluate.js:1102–1142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1102>); [api/cron/agent-evaluate.js:1251–1304](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1251>); [api/cron/agent-evaluate.js:3323–3363](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:3323>); [api/cron/compute-index-intelligence.js:258–288](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/compute-index-intelligence.js:258>).
- **Counterevidence/limits:** ranking rows still provide meaningful evidence; capture_refetch and timestamps/nulls are explicitly labeled; D2 correctly abstains on intraday volumeRatio.
- **Confidence:** high.
- **Owner/disposition:** Harness evidence contract plus Brain. Fetch/qualify required candidate evidence before sealing; retain post-action context under separate provenance. Block setup qualification on placeholder/missing inputs.

### G05 — Medium: attention is multi-source, but shared caps still suppress archetype-specific investigation

- **Status/category:** O + I; selection coupling.
- **Consequence/path:** refresh prioritizes common BB-fit candidates; catalyst and materialization paths depend on ranking rows. A documented lower-ranked idea has no guaranteed investigation unless its source survives admission.
- **Evidence:** [api/cron/agent-evaluate.js:1153–1288](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:1153>); [api/cron/agent-evaluate.js:2203–2253](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2203>).
- **Counterevidence/limits:** full CSV is visible at initial strategy generation; equipped symbols are deterministically retained. This is not a “top ranks only” system.
- **Confidence:** high mechanism, medium behavioral effect.
- **Owner/disposition:** Brain candidate policy/Harness eligibility. Preserve ranks and add explicit origin, admission reason and exclusion reason to the bounded candidate contract.

### G06 — Medium: user hypotheses lose durable meaning at the trading boundary

- **Status/category:** O; missing integration.
- **Consequence/path:** a watchlist's thesis reaches deployment strategy, but only tickers/name/ID survive in the battle snapshot. Activation/invalidation/horizon cannot reliably drive ongoing principled investigation from that snapshot. Chat controls are not a substitute for a hypothesis lifecycle.
- **Evidence:** [api/agent/decide.js:397–405](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:397>); [api/_utils/watchlistEquip.js:170–175](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/watchlistEquip.js:170>); [api/forge/watchlists.js:424–447](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/forge/watchlists.js:424>); [api/agent/equip-watchlist.js:86–97](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/equip-watchlist.js:86>).
- **Counterevidence/limits:** rich saved watchlists, deploy thesis, bounded directives and optional Vision reader already exist.
- **Confidence:** high for inspected snapshot/path; absence claim bounded to active integration.
- **Owner/disposition:** Partnership. Extend the existing hypothesis/watchlist contract with provenance and expiration, retaining an explicit “investigate, not mandatory trade” authority meaning.

### G07 — Medium: some differentiation is declared rather than enforced

- **Status/category:** O + I; policy coupling/missing behavior.
- **Consequence/path:** unused conviction/regime preferences, universal distressed-entry veto, shared candidate pipeline and sector-rarity proxy cannot deliver all six target philosophies. A Contrarian exception declared in config does not grant one in execution.
- **Evidence:** [api/_utils/agentArchetypeConfig.js:127–153](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentArchetypeConfig.js:127>); [api/_utils/archetypeScoring.js:112–142](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/archetypeScoring.js:112>); [api/cron/agent-evaluate.js:3009–3033](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:3009>); [api/_utils/agentGuardrails.js:101–150](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentGuardrails.js:101>).
- **Counterevidence/limits:** weights, real rotation/hurdle/window differences, identity blocks, user controls and Capital Preserver's disabled rotation are substantial.
- **Confidence:** high wiring confidence; model differentiation unmeasured.
- **Owner/disposition:** Brain policy with Harness veto ownership. Adjudicate active versus descriptive fields; qualify one explicit setup before expanding to six libraries.

### G08 — Medium: “hard exit” and target horizon need mode-specific semantics

- **Status/category:** O + I; product/mode constraint.
- **Consequence/path:** fixed-slot exits require substitutes and may defer under bonus locks; model WAIT is normally HOLD, and long-horizon theses live inside much shorter games. Calling these unconditional stops or full portfolio management overstates capability.
- **Evidence:** [api/_utils/agentGuardrails.js:452–478](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentGuardrails.js:452>); [api/_utils/agentGuardrails.profitTarget.test.js:222–253](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentGuardrails.profitTarget.test.js:222>); [src/constants/agentGameModes.js:36–72](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/constants/agentGameModes.js:36>); [api/_utils/agentBattleService.js:108–126](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentBattleService.js:108>).
- **Counterevidence/limits:** protective exceptions exist; Mandate has SELL/TRIM and cash.
- **Confidence:** high.
- **Owner/disposition:** Founder/mode policy and Harness. Preserve mode physics; define truthful exit/WAIT/horizon semantics before pilot behavior changes.

### G09 — Medium: capture is not yet a sealed, joined decision episode

- **Status/category:** O + I; observability/migration gap.
- **Consequence/path:** tick bodies, evaluation history, learning receipts and mutable execution inputs do not automatically yield one comparable candidate→evidence→setup→proposal→verification→commit lifecycle. Replaying only a prompt cannot reproduce all final dispositions.
- **Evidence:** [api/_utils/tickCapture/captureSerializer.js:63–185](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/tickCapture/captureSerializer.js:63>); [api/_utils/agentEvalPromptAssembly.js:887–931](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentEvalPromptAssembly.js:887>); [api/_utils/agentSwapExecution.js:181–187](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentSwapExecution.js:181>).
- **Counterevidence/limits:** strong new tick capture, provenance-aware learning records, resolved manifest and Mandate envelope already cover much of the foundation.
- **Confidence:** high for integration gap, runtime completeness unknown.
- **Owner/disposition:** Harness. Extend/join current schemas; add opportunity/setup/hypothesis/evidence-cutoff/state-revision identities. Keep permanent text allowlist and retention boundaries.

### G10 — Medium: automated learning can change persistent policy without demonstrated quality qualification

- **Status/category:** O + I; learning governance gap.
- **Consequence/path:** post-game narratives/consolidation affect future prompts; structural validation cannot prove causal lesson quality, archetype consistency or calibrated confidence. Hindsight and shared advice can blur identities.
- **Evidence:** [api/agent/reflect.js:167–186](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/reflect.js:167>); [api/_utils/agentConsolidationPrompt.js:43–93](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentConsolidationPrompt.js:43>); [api/_utils/agentConsolidationApply.js:263–311](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/agentConsolidationApply.js:263>).
- **Counterevidence/limits:** lesson IDs, validators, cycle/history fields and outcome-blind learning receipts are real controls; no convergence incident measured.
- **Confidence:** high automatic influence; medium risk.
- **Owner/disposition:** Partnership/Brain learning; Harness promotion control. Freeze learning during comparative pilot; later require evidence-linked acceptance, version and rollback.

### G11 — Medium: Mandate's reasoning packet underuses its execution foundation

- **Status/category:** O; missing evidence/action-contract mismatch.
- **Consequence/path:** first-40 complete non-held candidates carry price/sector but cannot establish the target technical/fundamental hypotheses. ADD instruction conflicts with excluding held names from the allowed slate.
- **Evidence:** [api/_utils/mandatePromptAssembly.js:60–108](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandatePromptAssembly.js:60>); [api/_utils/mandatePromptAssembly.js:174–199](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandatePromptAssembly.js:174>).
- **Counterevidence/limits:** book/regime/pinned identity and execution gates are supplied; this is not arbitrary unbounded tool access.
- **Confidence:** high packet content, model behavior unmeasured.
- **Owner/disposition:** Brain/mode contract. Preserve snapshots/vintages/execution; separately enrich opportunity packets and distinguish entry from held-management universes. Defer as a second pilot surface.

### G12 — Low–medium: provider/prompt/config duplication raises change cost, but more orchestration would add avoidable complexity

- **Status/category:** O + I; over-engineering and coupling risk.
- **Consequence/path:** direct Anthropic calls/tool formats, multiple prompt variants, live and candidate registry versions, dark compiler/grounding/research paths and mode-specific orchestration increase the number of contracts that can drift. Extra JEV or agent hops would add cost/latency without demonstrated benefit.
- **Evidence:** [api/agent/decide.js:392–421](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/agent/decide.js:392>); [api/cron/agent-evaluate.js:2420–2520](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/cron/agent-evaluate.js:2420>); [api/_utils/mandateModelCall.js:52–117](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/api/_utils/mandateModelCall.js:52>); [src/config/featureFlags.js:1421–1482](<C:/Users/fashr/.codex/worktrees/d9c5/portfolio-duel/src/config/featureFlags.js:1421>).
- **Counterevidence/limits:** separate mode enforcers, release snapshots versus Mandate vintages, client versus server validation, and primitive versus text capture have legitimate distinct trust/lifetime purposes. Do not consolidate those indiscriminately.
- **Confidence:** high coupling; no measured savings.
- **Owner/disposition:** Harness adapters/shared rendering. Extract only seams required by the pilot. Defer services, generic agent frameworks and wholesale flag removal.

## H. Growth-path assessment and subsystem disposition

| Capability/subsystem | Growth classification | Disposition and tradeoff |
|---|---|---|
| Rank engines, technical calculations, pattern evidence | Already supported | Preserve; retain provenance and raw evidence alongside scores. |
| Archetype registry, manifests, mode policy | Already supported foundation | Preserve/extend; distinguish current, pinned and candidate policy versions. |
| Deterministic execution and tournament ledger | Supported with restructuring | Consolidate admission coverage across all writers; keep transaction/ledger boundaries and mode-specific rules. |
| Low-ranked authorized user idea at deployment | Already partly supported | Preserve equip union; modest extension for hypothesis lifecycle and evidence qualification. |
| Source-aware candidate attention and explicit setup states | Modest restructuring for one bounded setup | Add records and deterministic evidence qualification around existing model; not a new service. |
| Sealed BaggerBomb reasoning input | Modest restructuring for pilot | Move late evidence reads before sealing and record state/cutoff. Full execution replay is larger work. |
| Full six-archetype target behavior | Meaningful redesign of policy/evidence contracts | Build progressively; correlation, thesis history and catalyst timing need more than revised prose. |
| Ongoing personalized partnership and delegation ladder | Meaningful product/state redesign | Preserve bounded controls; explicitly version scope, permission and expiration. |
| Mandate | Supported execution foundation; meaningful Brain enrichment | Preserve vintage/snapshot/accounting; correct units/action contract; defer as pilot two. |
| Learning promotion and reversal | Meaningful contract redesign | Keep receipts/lessons; separate candidate lessons from accepted persistent influence. |
| Engine/provider comparison | Modest application adapter; external scope unknown | Defer commitment until Harness Lab/Pi/Hermes interfaces are supplied. |
| Compiler, shadow assembly, Show It, dormant season logic | Not required for first pilot | Defer activation/removal; inventory owners rather than expanding scope. |
| Arbitrary ADD/TRIM/cash inside unchanged fixed-slot BaggerBomb | Structurally blocked within that mode contract | Use Mandate or obtain a separate mode-policy change. |
| Real-time microstructure setup without verified data or sub-tick response | Blocked within stated evidence/cadence constraints | Narrow the setup; do not simulate missing facts. |

No evidence shows the application is a structural dead end. The strongest architecture improvement is consistent, versioned contracts around existing functions.

## I. Minimum-change architecture and Trend Follower pilot

**Recommended scope:** an offline/advisory Trend Follower pilot under the existing flat-six training policy. It proposes decisions and records verification; it receives no additional live execution authority. Flat-six avoids tier/crypto complications while retaining existing game rules. If representative sealed training evidence is unavailable, use explicitly synthetic fixtures. Creating/running these fixtures is later work, not performed here.

### Contracts before infrastructure

1. **Harness work package.** Extend existing manifest/mode identifiers with episode/tick ID, state revision, evidence cutoff, allowed universe, action budget, policy/adapter/model versions and authority level. Preserve ranks.
2. **Opportunity record.** Stable ID and source set: existing rank candidates, existing technical/catalyst opportunities and one eligible user-watchlist hypothesis. Record admitted/excluded status and reason. A cap must not silently delete the user case.
3. **Hypothesis record.** Extend saved watchlist/thesis rather than introducing a competing free-form memory store: statement, source/author reference, permitted horizon, supporting/contradicting evidence IDs, activation/invalidation, expiry, and status. In the smallest pilot this is frozen at deployment. Mid-battle idea admission is a separate scoped extension.
4. **Setup record.** One versioned Trend Follower setup, initially a completed-bar continuation/confirmation case built from existing S2 concepts and qualified D1/D2 predicates. Declare exact bar basis, required evidence, regime allowance, acceptable entry geometry, invalidation and recheck condition. Do not use neutralized intraday volume as confirmation or call a single high RSI reading “persistent strength.” Numeric thresholds and precedence require adjudication before implementation.
5. **Brain output.** Candidate attention, evidence-supported thesis, contradictions, regime interpretation, semantic ENTER/SWAP, WAIT/WATCH or REJECT, invalidation and explanation. WAIT/WATCH maps to the current executable HOLD while keeping a distinct reason/state in the episode. Model conviction remains self-report.
6. **Harness verification.** Validate evidence completeness/freshness, mode eligibility, current portfolio constraints, authority, setup-policy vetoes and existing action checks. Record the original proposal, every rejection/override and final disposition. Later execution must revalidate the expected state revision/slot; a verifier judgment alone is not a committed trade.
7. **Decision episode.** Join existing tick capture, manifest, learning and action receipts by stable IDs. Add only missing candidate-origin/setup/contradiction/invalidation links. Mark decision-visible evidence separately from post-action capture. Keep text in approved retained bodies, not permanent primitive records.
8. **Provider/engine seam.** Wrap the existing model request behind a small adapter; use one current model call. The work package, policy and verifier remain stable if an external engine later changes.

### Evidence hierarchy and action lifecycle

For this pilot: game/authority constraints first; evidence validity next; setup and invalidation evidence next; regime and current portfolio effect next; ranks as supporting comparative evidence; user hypothesis as a reason for attention. The agent may disagree and wait. Protective exits remain owned by deterministic mode policy and do not depend on a successful model response.

Existing: rankings, technicals, setup prose, D1/D2 primitives, game constraints, identity, equip union, model seam and capture. Proposed: complete pre-decision candidate packet, explicit setup/hypothesis lifecycle, sealed work package and joined verifier result. Missing prerequisites: actual evidence availability/bar basis, accepted thresholds and external adapter interfaces.

### Proposed acceptance cases — none executed

| Case | Current support / gap | Required observable result |
|---|---|---|
| A: eligible low-ranked user idea | Equip can admit it; live thesis continuity incomplete | Candidate and hypothesis appear with source IDs; an evidence-based investigate/wait/reject/act result; no mandatory trade. |
| B: high rank, invalid setup/entry | HOLD exists; explicit setup gate/lifecycle incomplete | Rank does not override setup; WAIT/WATCH/rejection names missing confirmation, poor entry or invalidation and recheck condition. |
| C: user conflicts with core | Directive gate has core-conflict/bounded IDs | Principled disagreement; unchanged authority/core; explanation cites the relevant policy. |
| D: stale/incomplete/contradictory evidence | Specific gates and null handling exist; no uniform packet policy | Missing/stale/contradictory fields remain explicit; no fabricated confirmation; degraded output distinguishable from a valid wait. |
| E: valid idea violates game/portfolio rule | Many deterministic checks exist; path coverage and cap units need repair | Harness veto before mutation on every approval/automatic path; preserved original proposal and reasoned final disposition. |
| F: identical sealed input to qualified peers | Retained HTTP inputs help; external adapters unverified | Same package hash/cutoff/policy/universe, separately recorded engine/provider/model/config/version, candidate attention, evidence claims, actions and verifier results. No wording/output identity requirement. |

Add counterfactual pairs: Trend Follower versus Contrarian on established trend versus evidenced reversal; Speculator versus Capital Preserver on high-volatility catalyst risk; Diversifier versus Fundamental Investor on a strong but highly correlated addition; Fundamental Investor versus Trend Follower on poor business evidence versus strong price structure. Define expected divergence only after each policy is specified. All archetypes should agree on unauthorized instruments, missing required evidence and hard game-rule violations.

**Qualification:** measure candidate coverage, evidence support, correct abstention, veto coverage, provenance, policy consistency, disagreement quality, latency/token/capture completeness and safe failure behavior. Profit is an outcome measure, not proof of architecture quality.

**Rollback:** keep old decision contracts/model path available; version the pilot packet/setup/adapter; isolate advisory outputs; freeze automatic learning during comparisons. Do not silently reinterpret existing Mandate vintages or historical records. Fenced behavior changes need the repository's later amendment/review process; this report does not authorize them.

## J. Founder decisions and unresolved facts

### Product/policy decisions

| Decision | Why it changes the design |
|---|---|
| Confirm flat-six training/advisory as first qualification surface | Determines eligibility, duration, action semantics and which execution adapters need proof first. |
| Must the first pilot accept new ideas during a live game, or is deploy-frozen sufficient? | Deploy-frozen reuses watchlists; live intake needs a versioned hypothesis admission/expiry transition. |
| What takes precedence when user stop/profit target conflicts with a bonus lock or no replacement exists? | Determines truthful “hard limit” semantics; cannot be solved by prompt wording. |
| What are Mandate sector caps in percentage units for each archetype? | Current count-to-fraction copy is invalid as a meaningful cap; conversion is a policy choice, not an automatic division. |
| What completed-bar confirmation, entry geometry and invalidation constitute pilot success? | Turns S2 prose into testable policy without claiming unavailable intraday RVOL. |
| What is the permitted horizon translation when the user's thesis outlasts the game? | Determines research-only handling, nearer-term setup framing and rollover/expiry. |
| Which lesson changes can auto-promote versus require review? | Defines stable identity, preference drift controls and reversible learning. |

The supplied vision already settles that user ideas are not orders, hard safety is deterministic, and greater authority needs explicit product rules. Those are not reopened.

### Missing technical/runtime evidence

- Deployed commit/flags/rules, active mode mix, stored Mandate vintages and client access: resolves real exposure of G01–G03.
- Actual candidate technical coverage, provider timestamps/bar basis, licensing and supported volume/liquidity fields: resolves pilot setup/data feasibility.
- Capture TTL/index deployment, sequence coverage, truncation, token/latency distributions and retention access: resolves replay/operating readiness.
- External Harness Controller, Hermes and Pi schemas, tool-permission model, artifact transport, timeout/cancellation and verifier API: resolves Case F and independent adapter scope.
- JEV provider/model, evaluation corpus labels, calibration and operating cost: required before any proposed judging/routing role.
- Observed model behavior and decision distributions across six archetypes: required to claim differentiation beyond source mechanisms.
- Canonical approval for older proposed adjudication items: required before using them as architecture authority.

These facts were not obtained by reading private runtime data or making provider calls.

## K. Recommended sequence and coverage ledger

1. **Evidence adjudication — application owner.** Confirm G01–G04 with targeted later safe tests and deployment/configuration evidence. Resolve cap units and guardrail precedence. Keep discovery and remediation separate.
2. **Target architecture amendment — founder/application + Harness Lab.** Define boundaries, mode-specific authority, evidence/setup/hypothesis/episode contracts, units, lifetimes and external adapter responsibilities. Extend canonical contracts.
3. **Independent design review.** Review every action writer, downgrade/failure branch, time cutoff, partial/missing evidence, version migration and rollback. Separate execution engine, provider, policy and verifier.
4. **Bounded Trend Follower pilot — application.** One mode/setup/model; advisory fixtures/retained authorized evidence; learning frozen. No JEV or extra service prerequisite.
5. **Harness qualification — Harness Lab plus independent Hermes/Pi owners.** Run A–F and counterfactual policy cases under identical sealed packages, validate deterministic final disposition and record uncertainty/cost. External work cannot be certified from this repository.
6. **Rollout review — founder.** Decide whether evidence warrants a limited live scope and delegation level. Observe actual capture/freshness/latency and failure behavior before expansion.
7. **Deferred work.** Mandate Brain enrichment, full six-archetype libraries, live mid-game hypothesis intake, semantic lesson review/JEV and deeper provider portability only after the pilot reveals a need.

| Question | Coverage | Remaining limit |
|---|---|---|
| Q01 End-to-end flow | A, B, G01–G03 | Runtime reachability/deployed modes unverified |
| Q02 Components/ownership | B, E, F | External organizations/interfaces unavailable |
| Q03 Decision approach | Executive, A, D | Model attention not measured |
| Q04 Executable archetypes | C, G07 | Behavioral qualification not run |
| Q05 Rank roles | D | Runtime distributions unknown |
| Q06 Lower-ranked barriers | A, D, G05 | Live coverage unknown |
| Q07 Other sources | D, E | Bounded caller/path census |
| Q08 Setups/evidence | C, D, G04, I | Provider coverage/licensing unverified |
| Q09 Action lifecycle | A, E, G08, G11 | Product precedence decisions open |
| Q10 Partnership | E, G06, I | Actual dialogue behavior untested |
| Q11 Identity/state/horizon | E, J | Complete live hypothesis lifecycle not found |
| Q12 Learning | E, G10 | No corpus/outcome/calibration assessment |
| Q13 Safety/authority | A, F, G01–G03, G08 | No exploit, emulator or production validation |
| Q14 Duplication | B, C, G03, G12, H | Full dead-code census not claimed |
| Q15 Provider/framework | F, G12, I | Hermes/Pi external interfaces absent |
| Q16 Mode/horizon | A, E, H, J | Product translation choices open |
| Q17 Rank-role changes | D, G05, I | Migration tests not run |
| Q18 Extensions/records | D–F, G04, G09, I | Complete sealed execution unavailable |
| Q19 Complexity/cost | A, F, G12, H | No measured usage/savings |
| Q20 Missing boundaries | G, I | Findings remain source-scoped |
| Q21 Preserve | B, F, H | Deployment qualification separate |
| Q22 Growth limits | H | External infrastructure feasibility unknown |
| Q23 Minimal pilot | I | Proposed, not implemented/executed |
| Q24 Delegation | E, G01, I, J | Ladder/product rules still need design |
| Q25 Observable behavior | I | All acceptance/counterfactual cases proposed |

### Verification discipline and search bounds

Source inspection covered decision callers/schedules; api/agent and api/cron entry paths; api/_utils ranking, policy, execution, capture and learning consumers; relevant src services, identity/configuration, battle views and Vision schema; firestore.rules; current documentation index/statuses; and selected tests.

Missing-capability claims refer to those inspected active integrations, not all conceivable files or external systems. Name/caller searches for JEV, Hermes, Pi, Harness Controller and DecisionEpisode were checked against actual orchestration/contracts; unrelated uses of the identifier pi in learning code are predicate-input variables, not a Pi engine.

Inspected tests include watchlist admission, archetype settings, prompt honesty, post-forced-swap tick coherence, guardrail-error HOLD, profit-target deferral, capture serialization/handler isolation, Mandate prompt honesty and Mandate gates/vintage pinning. **No tests or experiments were run.** Test source and historical reports do not certify current execution.

Final disposition: preserve the existing engines, identity and capture; first establish consistent deterministic authority and correctly typed mode contracts, then qualify one evidence-complete Trend Follower setup. No repository remediation or publication was performed.

Automatic approval review rejected the attempted escalated Git fetch. Remote freshness and “current main” ancestry remain unverified; the audit is pinned to the unchanged local SHA above.

