# FantasyTrades — League Tournament: Implementation Spec V1.0

**Date:** June 11, 2026
**Status:** Spec-pass output. Binds `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md` (design of record) + the June 10 implementation discovery + the June 10–11 founder decisions into the document the build's phased prompts are cut from.
**Governing contract:** `FANTASYTRADES_PRELAUNCH_SEQUENCE_AMENDMENT_A_JUN10_2026.md`, Amendment 3 item 3. All blockers cleared (DRB logger, DST claims, V4 scorer — merged to main). The build is GO.
**Reading order for any implementation chat:** this spec → V2.1 → the June 10 discovery report → Amendment A (Signal Capture Rider) → the Vision placement Addendum A §4 catalog. All to live in-repo per Phase 0.

---

## 0. Decisions register since V2.1 (all founder-locked unless marked [PROPOSED])

1. **Prescribed-portfolio deploy path** added to §7 engine scope. In tournament mode the deploy never self-selects: Monday's six come from draft resolution; Tue–Fri's six are the prior day's incumbents. The orchestrator reserves symbols in the agent ledger *before* deploy, then deploys with the prescribed six — the discovery's registration race is dissolved by sequencing, not solved by code.
2. **Agent held-set ledger = two-phase reserve/confirm** at the five non-fenced swap call sites (reserve on the ledger doc → swap → confirm; compensating release in the existing catch blocks), **incrementally maintained, with a nightly derived rebuild** from `status=='active'` tournament battles as reconciliation. No fenced transaction plumbing.
3. **Deploy endpoint auth** ships in the orchestrator phase: user-token ownership check (Firebase Auth) for client calls; `CRON_SECRET` header for internal callers (pattern proven in-repo at the claims cron), with internal callers exempt from the 3/min/IP rate limit. Logged on the security workstream independently.
4. **Fence expanded:** `agentEvalPromptAssembly.js` joins the calibration fence. Its flat6 edits run inside the §7 gated process.
5. **Import rule of record (revised June 2026):** `api/` MAY import `src/` modules whose transitive imports are Node-clean, guarded by a dependency-surface test (the test-file module import is the runtime guard; never mock it — comment required). The old blanket prohibition is retired; it was the root cause of the scoring-copy proliferation.
6. **§7 collapse rider verdict:** the V4 cron's flat values were a defect (fixed, merged); the collapse converges all scoring copies to **one canonical home — [PROPOSED]: the client constants + `calculateAssetScoreV3` in `src/`, with `agentScoring.js` re-exporting the canonical constants** so fenced consumers keep their import path. Decided inside §7 with its invariant test.
7. **Training mode (founder-shaped, deferred post-launch):** a second mode of the same game — identical format (user 3-pick draft + agent six, five days), CPU opponents only, no rank/social layer, deployed exclusively from the Command Center. Built after the tournament is live and working. Its arrival must answer the one-battle-per-agent coexistence question (candidate: separate training-agent context). The legacy "two-mode agent identity" guardrail (scout vs autopilot) is formally retired — both modes are autopilot; the distinction is stakes, not agent role.
8. **One-battle-per-agent constraint accepted for V1.** A registered player's tournament battle is their battle Mon–Fri. Spectating (read-only view-mode) is unaffected. Casual/solo deploys during tournament weeks are unavailable to registered players; the spec says so rather than letting the old "spectate + train" phrasing dangle.
9. **Group structure (restated for precision):** all pools, drafts, claims, and exclusivity are **per group of four** — each group is one game with its own 12-name user draft, claim wire, and 24-name agent market. The bracket runs multiple concurrent games; **top two by weekly score per group advance** and are re-grouped with other advancers; every round is a fresh group, fresh draft, fresh pools (V1.2 §3 carried). Base-layer groups follow the same per-group structure.
10. **k = 1.5** (founder-set): each user-layer point is worth 1.5× at aggregation. User layer = 4.5 effective units vs the agent's 6.
11. **[PROPOSED] Draft catalog = the full ranked universe** (same catalog agents see), per group. The contention dial (curated board) stays in the tuning ledger.
12. **Cron budget plan:** ≤2 new schedule entries. Tournament claims **branch inside the existing claims handler** (eligibility filter extended; window/idempotency guards imported as-is) — zero new slots. Orchestrator takes one slot. **[PROPOSED] tournament eval rides the existing agent-evaluate cron** with the budget raised 60→300s (in-repo precedent: compute-briefs et al.) + `TIME_BUDGET_MS` raised proportionally + `EVALUATING_LOCK_TIMEOUT_MS` re-examined; a separate tournament eval cron is the fallback if load proves it (discriminator exists: `gameMode` field).
13. **Docs-in-repo:** Phase 0's first commit creates `docs/` containing this spec, V2.1, Amendment A, the Vision placement Addendum A, and both June 10 audit reports. Every future implementation chat reads from version control, not from chat-pasted context.

---

## 1. Component specs

### 1.1 Tournament group document + user-layer service (non-fenced)

A drafts-sibling collection (`tournamentGroups`), shaped per the discovery P2 classification:
- `players[4]`: `{odUserId, picks[3]}` — `pickCategories` dropped; category system removed end to end.
- `userPool`: flat array — full catalog minus the group's 12 user-held names; dropped picks return here.
- `claimSystem.{enabled, currentWaiverPriority, lastProcessedDay, processingLog}` — **shape verbatim from the legacy system** (discovery: shape-agnostic).
- `dailyScores.day{N}` per player (user-layer daily close), feeding waiver priority exactly as the legacy fallback does (lowest prior-day scorer first).
- Legs/flip state per pick: `{symbol, legs[{direction, baselinePrice, baselineSource, openedAt, closedAt?, bankedScore?, thresholdHistory}], flipCountToday}`.
- Round metadata: `roundNumber, bracketGameId | baseLayerWeek, groupMembers, status`.

**Claims variant:** the existing `process-draft-claims` handler gains an eligibility branch (legacy drafts vs `tournamentGroups`), importing `getClaimProcessingWindow` + `isAlreadyProcessedForDay` unchanged. Tournament branch: pool validation against `userPool` (no categories), pending cap 3 → config, contest resolution reusing the queue/rotation algorithm with a sibling for roster/pool mutation + writes (per the discovery's reusable/sibling split). DST guard inherited by construction.

**Flip endpoint:** authenticated (owner-only), validates cap (5/day, config), closes the live leg (bank score at baseline rules: current price if market open, next open otherwise), opens the new leg with fresh per-leg thresholds, writes a flip feed event (Signal Capture event — §2), atomic single-doc update.

**User-layer scorer (new module, non-fenced):** sources `calculateAssetScoreV3` from `src/utils/baggerBombUtils.js` — identity-by-construction with the rest of the product, now twice-precedented, Node-clean-guarded. Per-leg invocation: `asset = {symbol, baseATR, direction}` (tier absent → 1.0 multiplier by the verified fallback), `priceChange` from leg baseline, per-leg `history`, `thresholdPriceChange` per the V4-fix convention. **Threshold construction (baseATR × 1 / 1.5 / 2.0) replicated under a port-contract test** mirroring `decide.js:584-592` (test pattern: the consistency-battery precedent). Daily close banks per player into `dailyScores.day{N}`; weekly = Σ days; composite = agentScore + 1.5 × userScore.

### 1.2 Agent held-set ledger (non-fenced)

`tournamentGroups/{id}.agentLedger` (or sibling doc): `{symbol → {heldBy: agentId, since, source: 'draft'|'swap'}}`.
- **Reserve/confirm protocol** wrapping all five `executeSwapServer` call sites in `agent-evaluate.js`: transactional reserve (fail = candidate unavailable) → swap → confirm; release `symbolOut` on success; compensating release on swap failure (existing catch blocks).
- **Candidate pre-filtering:** hotBench refresh, bench merges, catalyst additions, and the `benchAssets` array fed to `pickEmergencyReplacement` are all filtered to ledger-available symbols in non-fenced code (discovery P1.3 anchors); `pickSwapReplacementCandidate` receives the cross-agent held set via its existing `heldSymbols` parameter.
- **Emptied-pool emergency skip** (agent stays in a busting position when filtering empties candidates) is **designed behavior**: surfaced as a feed event ("wanted out of X — no replacement available"), not a silent log.
- **Nightly reconciliation:** derived rebuild from active tournament battles' portfolios; divergences logged and corrected; runs inside the daily-scores window (no new cron).
- Own-player's user-layer picks are **never** in this ledger (dual markets) — an agent may freely swap into them (the mid-week double-down).

### 1.3 Tournament Orchestrator (non-fenced; one cron slot)

Responsibilities: morning deploy fan-out, Monday draft resolution, round advancement, champion conclusion.
- **Fan-out:** batched sequential deploys with the eval cron's deferral pattern; internal `CRON_SECRET` auth; rate-limit exempt; retry-after-cooldown on failure (the 2-min `lastDeployedAt` throttle is the pacing floor); per-player idempotency via the day's battle existence check (completed battles never block — verified).
- **Prescribed-portfolio payloads:** Monday = draft-resolved six; Tue–Fri = prior close's six (incumbent re-instantiation; rotation-at-deploy remains off per V2.1 §4).
- **Monday sequence:** user draft completes → boards produced (Sonnet shortlist ranked per agent, USER PICKS block in context) → ledger-aware deterministic snake resolution (own-player user picks available to own agent only) → reserve all 24 → deploys with prescribed picks → playback event stream written for the spectator surface.
- **Round advancement (Fri close):** weekly scores finalized → top two per group locked → new groups composed → bracket state written → loadout window opens; champion conclusion at final-four resolution (one-screen recap, [PROPOSED] format in §3).

### 1.4 §7 engine parameterization (THE fence entry — isolated phase)

Scope per the discovery P6 enumeration plus the prescribed-portfolio path:
- Mode config (`flat6`): portfolio shape 6 stocks / no crypto / flat 1x, threaded through `validatePortfolio`, `enrichPortfolio`, `buildFallbackPortfolio`, `createAgentBattle` (resurrecting the dead doc config as the live mode config), `flattenPortfolioServer` / `calculateAssetScoreServer`, prompt text (deploy + eval prompt files — both fenced), `PORTFOLIO_TOOL` schema, tier-iteration sites, hftConfig mode-awareness, client tier-bound UI.
- **Prescribed-portfolio entry path:** deploy accepts a provided six (skip Haiku selection; validate + create), used by all tournament deploys.
- **Invariant:** tiered-mode behavior byte-identical before/after — equivalence battery expanded per discovery P6.2 (scorer battery long/short × tier × history × baselines; flatten parity; constants equality across copies).
- **Collapse rider:** converge the scoring copies to the canonical home (decision §0.6) under the revised import rule; the v4 cron is already converged.
- **Gate-1 calibration:** fresh archetype-differentiation probes for `flat6` only.
- Scheduling rule (Amendment A): this phase runs when nothing else competes for founder review.

### 1.5 Draft systems, playback, battle view, nav (non-fenced)

- **User draft:** 3-pick snake per group, lobby + pre-committed boards reusing the watchlist-creation flow (ranking step, minimum-depth rule); board prefill **[PROPOSED]:** seeded from the player's equipped watchlist top names + latest scout alerts, freely editable. All picks start long.
- **Agent draft playback:** resolution event stream replayed at ~5s/pick (config), VOD-native; sniped-board shifts rendered; per-pick rationale from the board's stored reasoning snippets.
- **Battle view composition:** user strip (3 picks, direction badges, flip affordance + cap indicator, per-leg badge state, SHORT badging per existing precedent) + the agent battle view + composite header (agent + 1.5×user); double-down visual moment when layers align; flips and double-downs as feed events. Transparency per V2.1 §9: WHAT live to all, WHY owner-only live, full WHY at completion (Film Room).
- **Nav:** `TOURNAMENT_TAB_ENABLED` flag flip is the **last act of the build**; `LeagueScreen` placeholder replaced by the entry hierarchy (my game now / my standing / the wider world).
- **Aggregation:** daily composite, weekly totals, seasonal leaderboard (signed, monthly reset, CPUs marked, bottom navigable, you-are-here row), career rank (RP = scaled total + placement 100/66/33, CPU-farm guard, tier-floor ratchet), learning feeds population-level (consensus + contrarian) as a scheduled job folded into existing aggregation windows where possible.

## 2. Signal Capture walk (Amendment 4 — binding)

Every event below writes **awaited in-request** or via the **queue-flag pattern** (`pendingReflection` precedent). Nothing rides the fire-and-forget shadow logger. Reconcile event numbering against the in-repo catalog at Phase 0; flagged items (#4/#7/#9-class) get their field additions at the producing surface.

| Event | Producer | Write path | Pattern |
|---|---|---|---|
| User draft pick (symbol, rank, board snapshot) | draft lobby service | group doc, awaited | A |
| Pre-committed board (full ranking + edits vs prefill) | board service | group doc subdoc, awaited | A |
| Claim placed / resolved (add, drop, contest outcome) | claims branch | claims subcollection (existing shape, minus category) | A |
| Flip (symbol, direction, leg baselines, banked leg) | flip endpoint | group doc atomic update + feed event | A |
| Double-down formed/broken (layer alignment change) | ledger confirm + flip/claim writes | derived flag on both writes | A |
| Agent board + resolution deltas (wanted vs got) | orchestrator | playback stream doc, awaited | A |
| USER PICKS reaction (agent rationale referencing picks) | deploy/board production | stored on board doc | A |
| Debate events | existing debate path | existing battle-doc writes + `pendingReflection`-style flag | B |
| Loadout change in nightly window | loadout service | group/agent doc, awaited | A |

## 3. [PROPOSED] defaults (ratify or overturn at review)

Nightly window = one surface, two tabs (Claims / Loadout), open while market closed, countdown to 9:24 ET close. Flip events render as feed cards with old→new direction and banked-leg result; group-visible. Lineup card (Tue–Fri) = incumbents + overnight claim results + a one-line agent note. Champion recap = one screen: bracket path, best week, signature double-down, final composite. Draft catalog = full universe (§0.11). Tournament eval = shared cron at 300s (§0.12).

## 4. Phase plan (one branch per phase; discovery-lite → STOP → build; pushed ≠ deployed)

- **P0 — docs + scaffolding:** `docs/` commit; `tournamentGroups` schema; feature-flag plumbing. Small.
- **P1 — user layer:** group doc service, draft lobby variant, claims branch, scorer + port-contract test, legs/flips. Code-review threshold likely triggers.
- **P2 — agent ledger:** reserve/confirm wrappers, candidate filtering, reconciliation, emptied-pool feed event.
- **P3 — orchestrator + deploy auth:** fan-out, CRON_SECRET + ownership auth, prescribed-payload plumbing (consumes the §7 path via a stub until P4 lands; P3/P4 order may invert at the build chat's discretion with founder sign-off).
- **P4 — §7 engine parameterization** (the fence entry; isolated; founder-review exclusive window; invariant battery + Gate-1 flat6 calibration).
- **P5 — draft systems + playback.**
- **P6 — aggregation: composite/weekly/leaderboard/rank + feeds.**
- **P7 — battle view composition + entry hierarchy.**
- **P8 — integration pass, signal-capture verification against the catalog, eval-budget raise + load observation.**
- **P9 — flag flip + launch checklist** (production cron observation, ledger reconciliation clean for 5 days, one full simulated bracket round with CPU padding).

## 5. Tuning ledger (initial values)

k = **1.5** (founder-set). Flip cap **5/day**. Claim pending cap **3/cycle**. Board depth **15–20**. Playback **~5s/pick**. Draft catalog **full universe**. Rank tiers/thresholds/RP scaling — set raw at P6, watch. CPU-farm fraction, CPU difficulty — P6. Short floor — none at launch.

## 6. Guardrails

Fence list as amended (now incl. `agentEvalPromptAssembly.js`). §7 is the only fence entry; calling fenced functions is permitted, editing them outside P4 is not. One task = one branch — **fresh branches off current main per phase** (the epic-volta session-branch pattern is retired). Discovery-lite → STOP per phase. `/code-review` at ≥10 files or ≥1500 lines. Read-only refers to project state; history deepening permitted and reported. Signal Capture Rider binding throughout. Training mode, agent shorting, live per-pick drafting, within-agent double-down, multi-battle-per-agent: post-launch program (V2.1 §11 + §0.7 here).

---

*Spec V1.0 prepared June 11, 2026. The build is GO at P0.*
