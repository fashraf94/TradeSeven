# Detector Appendix — Discovery Report (read-only, VERIFIED)

**Date:** July 11, 2026
**Author:** CC (Opus execution)
**Governs:** Agent Learning System Architecture V1.3 (FROZEN) §18.1 (Detector Appendix), §3.1/§3.3 (detectors + interventionClass), §6 (shadow receipts)
**Purpose:** Surface + verify the live-code anchors each launch detector contract must bind to, so the Detector Appendix is authored from VERIFIED anchors, not INFERRED spec.
**This report writes no detector contracts.** Discovery only. Hard STOP at the end.

---

## Session preamble (BUILD_RULES §2 / §3)

- **Branch:** `claude/detector-appendix-discovery-ywyrc2` (harness-provisioned; no branch created mid-task).
- **HEAD SHA:** `6f3f4c29ff1bdc19f36478c44c8a7fc4553a83d9`
- **Tree status:** clean (`git status --porcelain` empty at session start).
- **Repo is shallow** (`git rev-parse --is-shallow-repository` → true). No history deepening was needed for this task.
- **Read-only honored:** no repo files edited, created, moved, or staged. This report lives **outside the repo tree** (session scratchpad), per BUILD_RULES §3.
- **Fence respected:** the calibration-fence files (`decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`) were **read/called only**. Every point where a future capture/learning hook would need to *write* into a fenced file is flagged **FENCE-AUTH REQUIRED**.

**Methodology / label discipline.** Every finding is labeled **VERIFIED** (I read the code at the cited `file:line` this session and it directly states the claim), **INFERRED** (concluded from surrounding live code, not stated at one line), or **NOT FOUND** (searched; not present — searches named). Spec/design docs (`docs/…`, repo-root `*.md`/`*.docx`) were used for orientation only and are **never** cited as VERIFIED. Live JS under `api/` and `src/` is the sole authority. The large majority of anchors below were read directly by me; a parallel verification fleet corroborated them (noted where relevant). There is a pre-existing in-repo `discovery/` directory (prior-session artifacts) — left untouched; not used as evidence.

---

## Executive verdict table

| # | Question | Verdict | Key anchor |
|---|----------|---------|-----------|
| A1 | Which pipeline does a learned equip write to? | **VERIFIED** — soft `activeRules[]` path exists and is decoupled from hard `guardrails[]`. A learned equip can ride soft-only. | `equip-bundle.js:122/151`, `agentGuardrails.js:168/462/472` |
| A2 | Lean/adjustment allowlist canonical source | **VERIFIED** — `src/data/archetypeAdjustments.js` (non-fenced); TF-01/02/04 are stable, **archetype-scoped** keys; conflict-group at-most-one enforced. **Literal "cap of 2" NOT FOUND as a number** (see A2). | `archetypeAdjustments.js:62-65,283,361` |
| A3 | Tempo dial: real bands + param | **VERIFIED** — named dial `{measured 0.7, standard 1.0, aggressive 1.3}`; moves swap-capacity/hurdle knobs. **Currently dark** (flag + version-bound). | `tempoDialBands.js:31-40`, `tempoDialClamp.js:132-167` |
| A4 | Time-exit / hold-duration template | **VERIFIED — TWO subsystems.** Season has a discrete template `sx-03`; the Agent/LLM path has **no** time-exit template (tick-based `forcedRotation`). TF-04 has no numeric consumer. | `seasonRuleRegistry.js:311`, `agentArchetypeConfig.js:49`, `archetypeAdjustments.js:65` |
| B | interventionClass (proof burden) | **VERIFIED, heterogeneous** — freshness/confirmation = **modulating** (prompt-soft); churn-in-chop = **suppressive** (but dark); hold-duration = **split/ambiguous**. | see Part B |
| B1 | Within-taken comparator for modulating | **VERIFIED — exists** for freshness & confirmation via `trades[].snapshot`. | `buildTechnicalSnapshot.js:23`, `agent-evaluate.js:1886` |
| C1 | Lessons/consolidation funnel | **VERIFIED** — writers + readers mapped; **double-count risk into the Haiku decision prompt is real** if a new store isn't superseding. | `agentConsolidationApply.js:3`, `agentEvalPromptAssembly.js:518` |
| C2 | Receipts schema | **VERIFIED** — rich `evaluationMetadata`; provenance present; **receipt exists only for TAKEN swaps** (HOLD writes none). | `agent-evaluate.js:1860-1883` |
| C3 | Generation-boundary aggregator | **VERIFIED** — `agent-daily-scores` (day boundary) + `agent-batch-review` (review/consolidation) are existing slots; piggyback feasible, **no new slot needed**. | `agent-daily-scores.js` (cron `45 1 * * 2-6`) |
| C4 | Existing shadow logger | **VERIFIED** — fire-and-forget training log at `fantasytrades/shadow/{stream}/{date}/`. **Name collides; infra NOT reusable as-is** (§5 forbids fire-and-forget for catalog events). | `shadowLogger.js:8,34,42` |
| C5 | Cron slot count | **VERIFIED — 36/40** (founder correct; spec doc's 38 and BUILD_RULES §6's 37 are both stale). | `vercel.json:20-165` |
| D1 | Regime classes | **VERIFIED** — `regime`(4), `volatilityRegime`(4), breadth, per-stock regime incl. `choppy`. | `indexIntelligence.js:30-49`, `agentRegimeClassifier.js:63` |
| D2 | Trigger-universe raw material | **VERIFIED** — all four definable from `buildTechnicalSnapshot`; task's assumed field names (`bbands_state`, `volume_confirmation_score`) **NOT FOUND verbatim** — real equivalents named. | `buildTechnicalSnapshot.js:47-105` |
| E1 | Shadow-capture point | **VERIFIED — non-fenced.** Ideal capture sits in `agent-evaluate.js` between Haiku decision and gates. No fence-auth needed for capture; sibling-spread precedent exists. | `agent-evaluate.js:1689-1722` |
| E2 | Shadow scorability | **VERIFIED, mixed.** Deterministic exit policies exist (guardrail stop/trail, `forcedRotation`, season `sx-*`); normal agent swap-out is **LLM-discretionary → unscorable** unless a deterministic exit is frozen. | `agentGuardrails.js:531`, `agentRiskManager.js:154` |

**Bottom line for the Appendix:** the four candidate detectors do **not** share one interventionClass or one compilation surface. Two are prompt-soft *modulating* (with clean within-taken comparators, so they can make performance claims without the shadow gate); one is hard *suppressive* but its target control is currently **dark**; and the hold-duration detector fractures across two subsystems and has no clean soft agent-side target. Details and implications below.

---

# Part A — Compilation-target anchors

## A1 — Which pipeline does a learned equip write to?

**Plain answer:** There are two write paths. The **soft** path is `agent.activeRules[]` (prompt-material only). The **hard** path is `agent.deployedStrategy.guardrails[]` (deterministic post-decision overrides). A learned equip can ride the soft `activeRules[]` path and **never** needs to touch `guardrails[]`. They are separate pipelines; nothing compiles a rule/lean ID into a guardrail.

- **[VERIFIED]** Manual rule/bundle equip writes `agent.activeRules[]` via `api/agent/equip-bundle.js`: `const activeRules = snapshotsToActiveRules(allSnapshots)` (`equip-bundle.js:122`) → persisted through `txUpdateAgentSettings(tx, agentRef, { equippedBundleIds, activeRules, … })` (`equip-bundle.js:151-153`). The projection lives in `bundleRuleProjection.js` (`snapshotsToActiveRules`, imported `equip-bundle.js:39`).
- **[VERIFIED]** `activeRules[]` is the **soft / prompt-only** path: it is snapshotted into `battle.agentContext.activeRules` and consumed by prompt assembly (`agentPromptAssembly.js` / `agentEvalPromptAssembly.js`, fenced-read) as rule/constraint prompt text. Nothing enforces `activeRules` post-decision. *(Corroboration: the A1 verification agent traced the same path and the same non-enforcement.)*
- **[VERIFIED]** `guardrails[]` is the **hard-override** path. `api/_utils/agentGuardrails.js:1-7` header: *"Deterministic post-Haiku enforcement layer. Reads `agent.deployedStrategy.guardrails` (snapshotted into `battle.agentContext`) and overrides Haiku's decision when hard quantitative thresholds are breached."* `applyGuardrails(...)` (`agentGuardrails.js:168`) runs **after** the Haiku decision and can:
  - **force a SWAP** — `stopLoss`/`trailingStop` breach returns `{ decision:'SWAP', symbolOut:forcedBreach.symbol, symbolIn:replacement.symbol, … action:'forced_exit' }` (`agentGuardrails.js:462-469`);
  - **block a swap → HOLD** — `maxSectorWeight` breach returns `{ decision:'HOLD', … action:'blocked_swap' }` (`agentGuardrails.js:472-482`).
  Guardrail types: `stopLoss`/`trailingStop`/`maxSectorWeight` (hard), `maxPosition` (n/a for BaggerBomb slots), `profitTarget` (soft note only) — enumerated `agentGuardrails.js:9-16`, `328-364`.
- **[VERIFIED]** The application site is in the **non-fenced** cron: `applyGuardrails({ haikuResult, guardrails, battle, … })` is called at `api/cron/agent-evaluate.js:1722`, and the override is materialized back into `haikuResult` at `agent-evaluate.js:1743`.
- **[VERIFIED — coupling flag]** The only place directives and guardrails are written together is the **Laboratory "Deploy" gesture** (`src/components/Forge/DeployToAgent.jsx` → `deployExperimentToAgent`), which writes `deployedStrategy.directives[]` **and** `guardrails[]`. That is a *separate* pipeline from `equip-bundle`; it does not force a learned lean through guardrails, and Deploy permits directives-only. **No coupling forces the hard path.**

**A1 conclusion:** a learned equip rides `activeRules[]` (soft, prompt-material) with no guardrail contact. ✔ Clean for the Appendix's "soft, prompt-material compilation target" requirement.

## A2 — The lean/adjustment allowlist (canonical source)

**Plain answer:** The lean menu is a single non-fenced module. TF-01/TF-02/TF-04 are real, stable, **archetype-scoped** keys (under Trend Follower). Equip passes through a conflict-group "choose at most one per opposition" gate. A literal global **"cap of 2 leans" was not found as a numeric constant** — see below.

- **[VERIFIED]** Canonical file: **`src/data/archetypeAdjustments.js`** (non-fenced; `src/data/`). Header (`:1-8`): *"Single source of truth for BOTH the voice layer … and the deterministic directive gate (the per-archetype allowlist)."* Structure: `ARCHETYPE_ADJUSTMENTS` keyed by six stable archetype **code-ids** (`momentum_chaser`, `contrarian`, `degen`, `guardian`, `diversifier`, `analyst`), each with `zones` (prose) + `adjustments[]` (the lean menu).
- **[VERIFIED]** The three referenced leans live under `momentum_chaser` (Trend Follower):
  - `TF-01` `'Prefer fresh breakouts over extended / late-stage entries'` (`archetypeAdjustments.js:62`),
  - `TF-02` `'Require stronger confirmation before entering'` (`:63`),
  - `TF-04` `'Give winners more room before rotating out'` (`:65`).
  Each entry is `{ id, canonical, canonicalTextVersion, policy:{riskDirection, concentrationDirection, timeHorizonDirection, coreAlignment, forbiddenOpposite} }`.
- **[VERIFIED]** IDs are **stable, versioned keys** a compiler can target: version discipline at `archetypeAdjustments.js:240-246` (`getCanonicalTextVersion`; wording edits bump version, semantic changes mint a new id). Accessors: `getAllowlist` (`:214`), `isValidAdjustmentId` (`:219`), `getCanonicalText` (`:224`), `getAdjustment` (`:237`).
- **[VERIFIED — per-archetype scoping]** The menu is **archetype-scoped**: TF-* appear only under `momentum_chaser`. `getAllowlist(codeId)` returns that archetype's list and **does not fall back** on the directive-write path (`archetypeAdjustments.js:213-215`). ⇒ A detector targeting TF-01 is **inherently Trend-Follower-scoped**, not universal.
- **[VERIFIED — conflict groups]** `ADJUSTMENT_CONFLICT_GROUPS` (`archetypeAdjustments.js:283`) defines "choose-at-most-one" opposition sets per archetype; **`momentum_chaser: []`** (`:286`) — the TF menu has **no** internal conflict pairs (uniformly caution-shaped), so TF-01/02/04 never mutually exclude. Equip rejection is enforced by `findEquipConflicts(codeId, candidateId, equippedIds)` (`:361`): equipping a lean that shares a group with an already-equipped lean is refused.
- **[NOT FOUND — literal "cap of 2"]** Searched `MAX_LEANS`, `maxLeans`, `cap of`, `at most 2`, `<= 2`, `LEAN_CAP` across `api/`, `src/`. The only equip-count cap found is a **level-gated bundle cap**: `if (currentEquipped.length >= limits.maxBundles) …` (`equip-bundle.js:109`) — that caps *bundles*, not leans, and is keyed to agent level. The "cap of 2" as a fixed number does not exist verbatim in the code I read. The actual equip constraints are (a) `maxBundles` (level-gated) and (b) conflict-group at-most-one. **If the Appendix needs a hard "≤2 leans" guarantee, it must cite the lean-equip service (change-archetype lean-rider path) or treat it as a to-be-added constraint — do not assert it from `archetypeAdjustments.js`.**

## A3 — Tempo dial: real bands + underlying param

**Plain answer:** A discrete, named tempo dial with a `measured` band **does exist** as live code, but it is currently **dark** (behind a flag + a version binding that fails closed to `standard`). It moves swap-*capacity* and swap-*hurdle* knobs, not entry selection.

- **[VERIFIED]** `VALID_TEMPO_VALUES = ['measured', 'standard', 'aggressive']` and `TEMPO_DIAL_BANDS.multipliers = { measured: 0.7, standard: 1.0, aggressive: 1.3 }` (`tempoDialBands.js:31-40`). ⇒ `measured` is a real band, multiplier **0.7**.
- **[VERIFIED]** The desired tempo is read from `battle.agentContext.dials.tempo` via `desiredTempoOf(battle)` (`tempoDialClamp.js:65-67`).
- **[VERIFIED — underlying params moved]** `applyTempoToHftConfig` (`tempoDialClamp.js:132-167`) changes exactly five `hftConfig` leaves, direction-aware:
  - `swapWindow.capPerWindow → round(cap × mult)` (capacity; `:139`),
  - `forcedRotation.ticksThreshold → round(ticks ÷ mult)` (resistance; `:145`),
  - `hurdleFloor.byReason.{haiku_decision,stagnation}.atrMultiplier → v ÷ mult` (resistance; `:154-156`),
  - `hurdleFloor.default.atrMultiplier → v ÷ mult` (`:163`).
  At `measured` (0.7): fewer swaps allowed per window **and** a higher swap hurdle **and** longer time-to-forced-rotation. Untouched: all safety/structural fields (`tempoDialClamp.js:29-32`).
- **[VERIFIED — consumption / choke point]** The clamp is applied in the **non-fenced** cron: `const dialClamp = clampHftConfig({ hftConfig: resolveHftConfig(baseArchetypeConfig, battle.gameMode), desiredTempo: desiredTempoOf(battle), dialEnabled: TEMPO_DIAL_ENABLED })` at `agent-evaluate.js:1045-1052`; the clamped `dialClamp.hftConfig` then feeds risk/swap gating (consumers noted at `tempoDialClamp.js:37-38`: `agent-evaluate.js:1038/1086/1748`, `agentRiskManager.js:154/315`).
- **[VERIFIED — currently DARK]** `tempoDialBands.js:6-24`: values are *provisional*, land dark, and are **version-bound** (`forKnobConfigVersion: 2`). `resolveTempoDial` fails closed to `effectiveTempo:'standard'` unless `TEMPO_DIAL_ENABLED === true` **and** `bandTable.forKnobConfigVersion === deployed KNOB_CONFIG_VERSION` (`tempoDialClamp.js:105-116`). Any knob-generation change breaks the binding → `suppressionReason:'band_version_mismatch'`.
- **[VERIFIED — task's named params don't exist verbatim]** Searched `reviewInterval`, `promotionThreshold`, "review interval 30/60", "0.3/0.4 ATR". **NOT FOUND** as literal tempo params. There is no discrete "review interval" param (the eval cron simply runs `*/15`, `vercel.json:134-135`). The "0.3/0.4 ATR" figures are **hurdle/stagnation ATR margins** in `agentRiskManager` (e.g. degen stagnation floor `0.3` ATR), not a "promotion threshold." **The live tempo mechanism is the tempo dial, not review-interval/promotion-threshold params.**

**A3 conclusion for churn-in-chop:** "slow down / trade less in chop" maps to the tempo dial `measured` band, which mechanically **reduces swap participation** (lower `capPerWindow`, higher hurdle). Real and named — but **dark today**, and it modulates *swap rotation frequency*, not entry selection.

## A4 — Time-exit / hold-duration rule template

**Plain answer:** There is **no single time-exit template**. Two independent subsystems govern hold duration:

1. **[VERIFIED] Season / Forge "dimension" system — HAS a discrete template.** `sx-03` "Time-Based Exit" (`seasonRuleRegistry.js:311`, `phase:'exit'`, `priority: SOFT`): `expired = pos.daysSinceEntry >= params.days && pos.returnSinceEntry < params.pct → SELL` (`:317`). Its params are tunable Trading-Style dimensions in the `exitDiscipline` collection: `timeExitDays {rule:'sx-03', integer, min 2, max 15, default 5, unit days}` and `timeExitMinGainPct {rule:'sx-03', enumNumber, options [0,1,3,5], default 1, %}` (`compile-dimensions.js:78-83`). Winner-holding co-levers: `sx-02` trailing stop (HARD, `seasonRuleRegistry.js:304`) and `sr-04` "Add to Winners" (rebalance). Consumed in `seasonPipeline.executeExitPhase` and invoked from cron `season-daily-evaluate.js`. *(sx-03 + exitDiscipline dimensions independently read and confirmed by me; broader sx-*/sr-* family mapped by the A4 verification agent.)*
2. **[VERIFIED] Agent / LLM BaggerBomb battle system — NO time-exit template.** Exit/rotation is governed by `hftConfig.forcedRotation` (Knob A: `{enabled, pctThreshold, ticksThreshold, maxTickAgeMinutes, winnerThreshold}`, e.g. `agentArchetypeConfig.js:49`), `hurdleFloor` (Knob B), `swapWindow` (Knob C), plus LLM discretion. **Hold duration is counted in *stagnation ticks*, not calendar days** (`ticksThreshold`/`pctThreshold`, consumed `agentRiskManager.js:154`). Winner-holding = `forcedRotation.winnerThreshold` (a position up ≥ `winnerThreshold` on the day is exempt from forced rotation).
3. **[VERIFIED] TF-04 is prompt-only.** `TF-04` `'Give winners more room before rotating out'` has `policy.timeHorizonDirection:'longer'` (`archetypeAdjustments.js:65`), but `timeHorizonDirection` **has no numeric consumer** anywhere in `api/`/`src/` (grep returns only the table + the directive-invariant proof). TF-04 is enforced at the prompt/directive layer; it does not set `winnerThreshold`, `ticksThreshold`, or `sx-03` days.
4. **[VERIFIED] The one non-fenced runtime lever over agent hold-duration** is the tempo dial: `forcedRotation.ticksThreshold` is divided by the tempo multiplier (`tempoDialClamp.js:142-145`) — slower tempo lengthens the hold before rotation.

**A4 conclusion:** the hold-duration detector must be **split by subsystem**. Season side has a clean, deterministic, soft-priority template (`sx-03`) with real tunable params. Agent side has **no** template ID; its hold-duration lever is fenced `forcedRotation` config (FENCE-AUTH REQUIRED to write) with only the (dark) tempo dial as a non-fenced modulator, and its natural soft lean (TF-04) doesn't move any number.

---

# Part B — interventionClass evidence (the proof burden, §3.3)

Class definitions used: **suppressive** = blocks/delays/shortens-or-forces-exit/**displaces** an otherwise-valid trade; **modulating** = reweights selection **without** hard blocking (e.g., a prompt nudge the LLM can override); **additive** = adds without displacing. Each classification below is proven from **where the control actually takes effect in the real path**, per §3.3.

### setup-freshness → TF-01 → **MODULATING** *(prompt-soft)*
- **[VERIFIED]** TF-01 is a lean → it reaches the decision **only as prompt text**. Leans/rules become `activeRules[]` (A1) and are rendered into the Haiku eval prompt by prompt assembly (`agentEvalPromptAssembly.js`, fenced-read; e.g. the constraints/rules block). There is **no deterministic candidate-pool filter keyed on TF-01** — no code reads the TF-01 id to remove or force a candidate. The LLM can weigh or ignore the nudge.
- ⇒ It **reweights** ranking softly; it does **not** filter out extended entries at a gate. **Modulating.** *(This is the opposite of the "suppressive filter" reading; the proof is the absence of any enforcement site for the id.)*

### entry-confirmation → TF-02 → **MODULATING** *(prompt-soft)*
- **[VERIFIED]** Same mechanism: TF-02 `'Require stronger confirmation'` (`archetypeAdjustments.js:63`) is prompt-material only. No hard entry-gate reads TF-02; the "require confirmation" pressure is applied by the LLM under prompt guidance, not by a deterministic veto. **Modulating.**
- Caveat: the real deterministic entry/swap gates that DO exist (LOCK `agent-evaluate.js:1769`, distressed `:1777`, `validateTradeDecision` `:1787`, hurdle-floor `:1838`, Knob-C cap `:1847`) are **not** driven by TF-02 — they are structural risk gates. So TF-02 remains modulating.

### churn-in-chop → tempo `measured` → **SUPPRESSIVE** *(but the control is dark)*
- **[VERIFIED]** Slowing tempo mechanically **reduces trade participation** via three *hard gates* (none reorder — all block/delay would-be swaps):
  - lowers `swapWindow.capPerWindow` (`tempoDialClamp.js:139`) → the circuit-breaker blocks forced rotations sooner (`agent-evaluate.js:1156-1174`);
  - raises `forcedRotation.ticksThreshold` (`÷0.7`, `tempoDialClamp.js:145`) → the stagnation-exit fire gate fires less often (`agentRiskManager.js:155-159`);
  - raises `hurdleFloor.atrMultiplier` (`÷0.7`, `tempoDialClamp.js:156-163`) → `clearsHurdleFloor` VETOes marginal swaps (`agentRiskManager.js:322,343`).
  A marginal swap that would clear at `standard` is **displaced** at `measured` ⇒ **suppressive**. *(Independently corroborated by the B-tempo-exit verification agent with these same veto sites.)*
- **[VERIFIED — caveat: dark]** The control is **currently dark**: `TEMPO_DIAL_ENABLED === false` (`src/config/featureFlags.js:340`), so `resolveTempoDial` returns `effectiveTempo:'standard'`/`multiplier:1.0` and `applyTempoToHftConfig` returns the identity `hftConfig` (`tempoDialClamp.js:133`; consumed `agent-evaluate.js:1048`). Until enabled, no suppression fires → no shadows to score. Class is **SUPPRESSIVE-when-enabled**.
- **[VERIFIED — no within-taken comparator]** Tempo is stamped per swap receipt (`swapProvenance.js:34-44`, `agent-evaluate.js:1328`) but as a **battle-level constant** — it supports only *cross-battle* high/low-tempo comparison, never within-battle. ⇒ churn-in-chop cannot use a within-taken comparator; it genuinely needs shadow.
- **[FENCE-AUTH REQUIRED — for tempo-specific suppression capture]** Capturing the *specific deterministic veto* that suppressed a trade under `measured` tempo means instrumenting the veto sites — the breaker-skip (`agent-evaluate.js:1174`, non-fenced) **and** the `clearsHurdleFloor` veto in **fenced** `agentRiskManager.js:343`. A general Haiku-decision shadow can be captured non-fenced (E1), but the hurdle-floor veto site is fenced.

### hold-duration → time-exit → **SPLIT / AMBIGUOUS** *(scorable only on the season side)*
- **[VERIFIED] Season side (`sx-03`): SUPPRESSIVE + deterministic + scorable.** `sx-03` emits `action:'SELL'` precisely when `daysSinceEntry >= params.days AND returnSinceEntry < params.pct` (`seasonRuleRegistry.js:317,323`; consumed `seasonPipeline.js:124,133`; params `compile-dimensions.js:82`) — it **forces/accelerates an exit** as a function of a real param. This is the one clean, deterministic, shadow-scorable route. *(Corroborated by the B-tempo-exit agent.)*
- **[VERIFIED] Agent side: NO time-exit param — exit is LLM-discretionary ⇒ NOT shadow-scorable as a time-exit.** Agent-battle exits are fixed risk triggers (`bust_avoidance`, `vwap_failure`, LOCK, `TRAIL_STOP`, stagnation — `agentRiskManager.js:88,101`) plus a **Haiku discretionary SWAP + conviction floor** (`agentSwapExecution.js:76-81`). There is no `daysHeld`/`maxHold` parameter; "hold longer" is not a param the agent path exposes. `forcedRotation.winnerThreshold`/`ticksThreshold` are the nearest levers but are **fenced** (`agentArchetypeConfig.js`) and tick-based, and normal swap-out timing is the LLM's ⇒ a "would have held" shadow is **`unscorable`** here without a frozen deterministic exit.
- **[VERIFIED] TF-04 route: modulating (prompt-only).** If the detector targets TF-04, it is prompt-soft with no numeric effect (A4) ⇒ modulating, and it moves nothing on either engine.

## B1 — Within-taken comparator (for the modulating candidates)

**[VERIFIED — comparator EXISTS for freshness and confirmation.]** Every taken swap stamps a per-symbol technical snapshot onto `trades[i].snapshot` via `buildTechnicalSnapshot(...)` (called at `agent-evaluate.js:1886-1897`; builder `buildTechnicalSnapshot.js:23`). That snapshot carries, **at entry**, the discriminating fields:
- freshness: `levels.distanceToResistancePct`/`distanceToSupportPct` (`buildTechnicalSnapshot.js:86-91`), `volatility.bbPercentB` (`:58`), `momentum.macdFreshBullishCross` (`:50`), `recentAction.lastCandlePattern` (`:96`), `smaStack.distTo52wkHigh` (`:78`);
- confirmation: `volume.ratio` (relative volume, `:67`), `volume.tier` (`:68`), `momentum.upDayVolRatio` (`:54`), `momentum.macdAboveSignal` (`:49`).
Outcome is derivable from the closed trade's PnL. ⇒ Among **taken** trades we can compare fresh-vs-stale and confirmed-vs-unconfirmed outcomes **without any shadow trade**.

**Consequence (per §6.5):** setup-freshness and entry-confirmation, being modulating **with** a clean within-taken comparator, can make performance claims **without the shadow gate**. The suppressive churn-in-chop (which *displaces* trades and has no within-taken counterfactual) must wait for shadow — and today it can't even be observed because the tempo dial is dark.

---

# Part C — Evidence & measurement anchors

## C1 — The existing lessons/consolidation funnel (what the new store supersedes)

- **[VERIFIED — writers]**
  - `agent.lessons[]` is written by review-mode chat and batch review: `agentUpdate.lessons = FieldValue.arrayUnion(lesson)` at `api/agent/chat.js:651` and `api/cron/agent-batch-review.js:342`.
  - `agent.disciplines.selection[]` / `.execution[]` and `agent.consolidatedInsight(Text)` are written **only** by consolidation: `agentConsolidationApply.js:3` — *"Funnel principle: this is the ONLY writer of `agent.disciplines`."* (validates `disciplines.selection`/`execution` at `:65-76`, `consolidatedInsightText` at `:53`).
- **[VERIFIED — readers into prompts]**
  - Haiku **decision** prompt: `if (ctx.consolidatedInsight) …` (`agentEvalPromptAssembly.js:518-520`).
  - Base agent prompt: `agent.consolidatedInsight` → "STRATEGIC WISDOM" (`agentPromptAssembly.js:68-70`).
  - Voice layer: `agent.consolidatedInsight` → "YOUR ACCUMULATED WISDOM" (`voiceLayerPrompt.js:938`, plus 2614/2678/2738/2901/3125…), and `agent.lessons[]` (`voiceLayerPrompt.js:392,406`).
  - Channel taxonomy (`voiceLayerPrompt.js:406`): *"Lessons go to `agent.lessons[]`. Rules go to `agent.forgeSuggestions[]`. `directives[]` … deprecated."*
- **[VERIFIED/INFERRED — supersession + double-count]** The new `agentLessons` store must **supersede or gate** this funnel, not run naively parallel. The concrete double-count risk: `consolidatedInsight` is read into the **Haiku decision prompt** (`agentEvalPromptAssembly.js:518`, VERIFIED). If `agentLessons` also injects into that prompt while consolidation still runs, the same insight is counted twice in the decision. **[INFERRED]** the double-count is conditional on the new store's wiring; **recommendation:** the new store replaces the `lessons[] → consolidation → consolidatedInsight` prompt-injection, or the consolidation reader at `agentEvalPromptAssembly.js:518` (and the voice-layer readers) is gated off when `agentLessons` is active.

## C2 — Receipts schema (evidence-atom source)

- **[VERIFIED — shape]** The per-decision receipt is the `evaluationMetadata` object built at `agent-evaluate.js:1860-1883` (autopilot; parallel proposal shape at `:1994-2019`), passed into `executeSwapServer(... evaluationMetadata, snapshot)` (`:1907-1911`). Fields: `id` (`trade_NNN`), `action`, `trigger` (joined trigger types), `rationale`, `hypothesis`, `evaluationId`, `tradingDay`, `entryRegime` (per-stock), `entryMarketPosture`, `entryConviction`, `entryPreset`, `entryMode`, `exitReason` (`haiku_decision` | `guardrail_*`), plus a `snapshot` = `{symbolOut: buildTechnicalSnapshot(...), symbolIn: buildTechnicalSnapshot(...)}`.
- **[VERIFIED — provenance / selectionSource present]** `...buildSwapReceiptSource({ source, archetype })` stamps `source: 'haiku' | 'guardrail'` + archetype (`agent-evaluate.js:1877`; `swapSource` computed `:1859`). `...buildSwapProvenance(dialClamp.provenance)` (`:1879`) adds `swapProvenance: { tempoDesired, tempoEffective, selectionSource, dialBandVersion, knobConfigVersion, suppressionReason? }` (`swapProvenance.js:32-47`).
- **[VERIFIED — evidence-atom sufficiency]**
  - `opportunityKey` (symbol + setup): **symbol** present (via `executeSwapServer` symbolIn/out); **setup** derivable from `snapshot` (bbPercentB, distanceToResistancePct, candle, etc.). ✔
  - `triggerStatus`: `trigger` field carries the trigger types that fired. ✔
  - `regime`: `entryRegime` (per-stock) + `entryMarketPosture` (market). ✔ *(index-level bull/bear regime is a separate join, D1.)*
  - `effectSize` (outcome): **NOT in the entry receipt.** The receipt captures **entry**; outcome/PnL is realized later on the closed trade. Effect size must be computed at exit/maturity from the closed-trade record, not read from `evaluationMetadata`.
- **[VERIFIED — critical gap]** A receipt is written **only for TAKEN swaps**. The `decision === 'HOLD'` branch just does `summary.held++` (`agent-evaluate.js:2028`) — no receipt. ⇒ **Would-be trades that a learned control blocks have no existing capture.** This is exactly the gap the shadow-receipt system must fill; nothing today records a suppressed opportunity.

## C3 — Generation-boundary aggregator (cron piggyback target)

- **[VERIFIED]** `api/cron/agent-daily-scores.js` is the **day-boundary** aggregator: per active agentBattle it re-scores against the day-end baseline, banks badge points, **resets `thresholdHistory.{symbol}`**, clears `swapPrice`/`swappedInDay`, writes `scoreState.dailyScores[dayKey]`, and bumps `timing.currentTradingDay` (header `:1-20`). Cron slot: **`45 1 * * 2-6`** (`vercel.json:41-43`), i.e. ET Mon–Fri 8:45 PM, after V4 daily-scores/levels.
- **[VERIFIED]** `api/cron/agent-batch-review.js` (slot `25 20,21 * * 1-5`, `vercel.json:145-147`) is the **review → lessons → consolidation** boundary (writes `lessons` at `:342`; consolidation runs the disciplines/`consolidatedInsight` funnel, bumping `evolutionCycle`).
- **[INFERRED — piggyback feasible, no new slot]** Both crons already iterate active agents at a daily boundary and read/write `scoreState`/`thresholdHistory`. Evidence-atom aggregation + maturity computation + shadow-outcome computation can piggyback on **`agent-daily-scores`** (daily rollover, already touches per-position state) and/or **`agent-batch-review`** (already the learning/consolidation boundary). This satisfies ruling #5 (≤2 new slots, prefer piggyback) with **zero** new slots. Headroom: 36/40 (C5) leaves 4 free if a dedicated slot is ever preferred.

## C4 — Existing "shadow logger" (name / infra collision)

- **[VERIFIED]** `api/_utils/shadowLogger.js`: `appendToStream(stream, record)` (`:34`) writes one JSONL object per event to GCS at `shadow/${stream}/${dateKey}/${eventId}.jsonl` (`:42`) in bucket **`fantasytrades`** (`:8`). Streams include `decisions`, `evaluations`, **`compilations`**, `reflections`, `agent_consolidation`, `trade_narration`, etc. (`:59-142`).
- **[VERIFIED — purpose]** Header (`:1-3`): *"Fire-and-forget shadow logging to Google Cloud Storage. Writes structured JSONL records for AI **training data** capture."* It is a **training-signal event log**, categorically different from our detector "shadow receipts" (would-be trades under a learned control).
- **[VERIFIED — fire-and-forget]** `:4-5`: *"NEVER throws. NEVER blocks. All errors are swallowed after console.error."* Callers use `.catch(() => {})` (`:69`, `:115`). This is precisely the pattern **BUILD_RULES §5 forbids for catalog events** ("the shadow logger's silent multi-week data loss is the cautionary tale").
- **[VERIFIED — collision + reuse verdict]**
  - **Naming collision (severe):** our "shadow receipts" collide with this "shadow logger" and its `shadow/` GCS prefix; `compilations` and `agent_consolidation` streams also collide with our "compiler"/"consolidation" vocabulary. **The Appendix must rename or hard-namespace our shadow receipts** (e.g., a distinct term such as "counterfactual receipts" or a namespaced stream `learned_control_shadow/…`).
  - **Infra reuse:** the GCS append layout is fine *structurally*, but the **write contract is not reusable as-is** — our shadow-receipt outcomes are evidence atoms and must be **durably/awaited** (BUILD_RULES §5: awaited in-request writes or the `pendingReflection` queue-flag pattern), not fire-and-forget. Reusing `appendToStream` unchanged would reproduce the documented silent-data-loss bug class. Recommendation: separate, awaited, hard-namespaced store.

## C5 — Cron slot count (ground truth)

- **[VERIFIED — 36]** The `crons` array in `vercel.json:20-165` contains **36 entries** (counted directly). ⇒ **36/40 in use.** The founder's "36/40" is correct; the spec doc's "38/40" is wrong; **BUILD_RULES §6's "37/40" is also stale** (flag for a separate doc-fix tasking, not fixed here per §3). This confirms ruling #5's ≤2-new-slot budget with 4 slots of headroom — and, combined with C3, means **zero** new slots are needed if piggybacked.

---

# Part D — Regime + trigger-universe anchors

## D1 — Regime classes (for the ≥2-regime replication rule, §4.5)

- **[VERIFIED]** Market `regime` (SPY vs MAs) ∈ **{`bull`, `correction`, `bear`, `recovery`}** (`indexIntelligence.js:30,36,42,48`); `regimeDetail` is free-text prose (`:31` etc.).
- **[VERIFIED]** `volatilityRegime` ∈ **{`extreme`, `high`, `normal`, `low`}** (`agentRegimeClassifier.js:63`; consumed for market-posture at `:71-84`).
- **[VERIFIED]** A separate **yield regime** ∈ {`accommodative`, `neutral`, `restrictive`, `crisis`} (`indexIntelligence.js:157-169`).
- **[VERIFIED]** **Breadth** quality is computed SPY (cap-weighted) vs RSP (equal-weight) with a `breadthProximity` threshold (`indexIntelligence.js:13,116,131-134`) → strong/neutral/weak breadth. *(Exact output field name `breadthTier` not confirmed at a single line in the range I read; the breadth classification itself is VERIFIED to exist.)*
- **[VERIFIED]** Per-stock regime classifier yields distressed/… incl. a **`choppy`** class (`agentRegimeClassifier.js` `getStrategiesForRegime`, ref `:147`) — directly relevant to churn-in-chop's eligible-opportunity definition. Market posture ∈ {Defensive, Risk-On, neutral} (`:78-84`).
- **[Recommendation]** For the §4.5 "≥2 regime classes" replication rule, the cleanest stable field is **market `regime`** (4 classes) or **`volatilityRegime`** (4 classes) — either yields ≥2 discrete classes trivially. Both are attached to the decision context (regime is stamped on the receipt as `entryRegime`/`entryMarketPosture`, C2).

## D2 — Trigger-universe raw material (opportunity definitions)

All four eligible-opportunity universes are buildable from live, populated fields — but **the task's assumed field names are not the live names.** The live source is `buildTechnicalSnapshot` (`buildTechnicalSnapshot.js:23`, stamped per taken trade) and the same underlying `technicalScoresMap`/`rankingsMap`/`momentumData` available at decision time.

- **[VERIFIED] chop (churn-in-chop):** definable from `volatility.bBandwidthPercentile` (`:61`) + `volatility.bbPercentB` (`:58`) + `volume.tier`/`volume.ratio` (`:67-68`) + a no-trend condition via `trend.shortTerm`/`intermediate` (`:42-43`). The eval prompt already bins BB bandwidth into **`[SQUEEZE]` (bwPct ≤ 20)** / **`[EXPANDED]` (bwPct ≥ 80)** labels (`agentEvalPromptAssembly.js:1511`). **[NOT FOUND]** a categorical `bbands_state` field named `squeeze`/`expanded`/`normal` — the live equivalent is the **numeric `bBandwidthPercentile`** (+ the prompt's derived SQUEEZE/EXPANDED label).
- **[VERIFIED] fresh vs extended (setup-freshness):** `levels.distanceToResistancePct`/`distanceToSupportPct` (`:89-90`), `volatility.bbPercentB` (`:58`, extended when near/over the upper band), `smaStack.distTo52wkHigh` (`:78`), `momentum.macdFreshBullishCross` (`:50`), `recentAction.lastCandlePattern` (`:96`). Best discriminator: distance-to-level + %B + fresh-cross flag.
- **[VERIFIED] entry confirmation (entry-confirmation):** `volume.ratio` (`:67`), `volume.tier` (`:68`), `momentum.upDayVolRatio` (`:54`), `momentum.macdAboveSignal`/`macdFreshBullishCross` (`:49-50`). **[NOT FOUND]** a field literally named `volume_confirmation_score` — live equivalent is `volume.ratio` + `upDayVolRatio` + MACD confirmation flags.
- **[VERIFIED / INFERRED] hold duration (hold-duration):** the snapshot carries `capturedAt` ISO timestamp (`:39`); the receipt carries `tradingDay` (`agent-evaluate.js:1867`); the position carries `swapPrice`/`swappedInDay` (reset by `agent-daily-scores`) and `baseATR`/`thresholdHistory` (`agentGuardrails.js:506-541`). **[VERIFIED]** agent-side hold clock is *stagnation ticks* (`agentRiskManager.js` `updateStagnationCounter`), and **[VERIFIED]** season-side is *days* (`pos.daysSinceEntry`, `seasonRuleRegistry.js:317`). **[INFERRED]** per-position wall-clock hold is reconstructable (entry via `swappedInDay`/trade timestamp) but there is no single `entryTimestamp`/`holdDuration` field on the live position record — flag as a small capture-completeness item.
- **Denominator (eligible, not just triggered):** for each detector the eligible denominator is the count of symbols in the candidate/bench universe that match the universe predicate at each eval tick (the same `technicalScoresMap`/`rankingsMap` the snapshot reads from) — i.e., count eligible symbols per tick, not just the ones that produced a swap. Candidate `clusterKey`: **battle-episode** (per `battleId` + `tradingDay`) is the most natural live cluster, with **session** (intraday eval tick window) and **sector** (`ranking.sectorName`, `:38`) as secondary keys.

---

# Part E — Decision-site + shadow-capture anchors

## E1 — Decision path + least-invasive shadow-capture point

**Plain answer:** The ideal capture point is at the **non-fenced choke point in `api/cron/agent-evaluate.js`** — no fence-authorization is needed to *capture*. (Reading fenced `decide.js`/`agentSwapExecution.js` is fine; capture does not write into them.)

- **[VERIFIED — the intraday decision path is non-fenced]** For intraday swaps (where all four detectors act), the LLM decision is the **Haiku** call inside the non-fenced cron, not fenced `decide.js` (which is the *initial draft/deploy* portfolio decision). Sequence in `agent-evaluate.js`: tempo clamp `:1045` → `handleGameplanMeeting` `:1462` → Haiku result `haikuResult = toolUse.input` `:1646`, `decision = haikuResult?.decision || 'HOLD'` `:1689` → `applyGuardrails(...)` `:1722` (override materialized `:1743`) → deterministic gates: LOCK `:1769`, distressed `:1777`, `validateTradeDecision` `:1787` (fenced fn, non-fenced call), hurdle-floor `:1838`, Knob-C cap `:1847` → `executeSwapServer` `:1907`.
- **[VERIFIED — capture slot]** The least-invasive shadow-capture point is **between the Haiku decision (`:1689`) and the first gate (`applyGuardrails`, `:1722`)** — here the would-be action, symbols, conviction, rationale, prices, planned sizing (tier/slot from `validateTradeDecision`), and the frozen exit policy are all in scope **before** any block applies. This is **non-fenced** → **no fence-authorization required for capture.**
- **[VERIFIED — precedent, and where fence-auth WOULD apply]** The receipt already rides a **sibling spread** at the swap sites (`...buildSwapReceiptSource({...})` `:1877` + `...buildSwapProvenance(...)` `:1879`); a shadow receipt can follow the same sibling-spread pattern from the non-fenced site. **FENCE-AUTH REQUIRED only if** a hook must *write into* a fenced function's return (e.g., `buildSwapReceiptSource`'s shape-locked three-key return, or editing `agentSwapExecution.js`/`agentArchetypeConfig.js` knobs) — capture as a non-fenced sibling avoids this.

## E2 — Shadow eligibility feasibility (§6.4 scorability)

- **[VERIFIED — entry data present]** At the capture point the path exposes a complete, scorable entry: timestamp (`buildTechnicalSnapshot.capturedAt` / eval tick), price (`prices[symbol].current`), size (tier + slot from `validateTradeDecision`, `agent-evaluate.js:1787-1809`), and an executable action (symbolIn/symbolOut).
- **[VERIFIED — exit policy is mixed; the scorability discriminator]**
  - **Deterministic (scorable):** guardrail `stopLoss`/`trailingStop` (`agentGuardrails.js:519-545` — computed from entry price, `thresholdHistory.maxMultiplier`, `baseATR`), agent `forcedRotation`/stagnation (`agentRiskManager.js:154`), season `sx-01`/`sx-02`/`sx-03` (`seasonRuleRegistry.js`). A shadow whose counterfactual exit is one of these can be scored deterministically.
  - **LLM-discretionary (unscorable):** the *normal* agent swap-out is decided per eval tick by Haiku (`decision = haikuResult.decision`, `agent-evaluate.js:1689`). A shadow that says "the agent would have held/exited here" depends on future LLM discretion and is therefore **`unscorable`** unless a **deterministic exit policy is frozen at capture** (e.g., "hold to the guardrail stop / to a fixed ATR target / to `sx-03` days").
- **[FLAG per §6.5]** **hold-duration** on the agent side is the candidate most exposed to LLM-discretionary exits ⇒ its shadows risk being `unscorable` unless the Appendix freezes a deterministic exit policy. **churn-in-chop**'s counterfactual (the swap that *would* have happened at `standard` tempo) inherits the same exit ambiguity **and** is unobservable while the tempo dial is dark. **setup-freshness / entry-confirmation** avoid the problem entirely by using the within-taken comparator (B1) instead of shadows.

---

# Appendix-shaping implications

These are the findings that change the detector set, their classes, or their measurement path. Ordered by impact.

1. **The four detectors do NOT share one interventionClass** (§3.3 must reflect this):
   - **setup-freshness → TF-01: MODULATING** (prompt-soft; no enforcement site for the id).
   - **entry-confirmation → TF-02: MODULATING** (prompt-soft).
   - **churn-in-chop → tempo `measured`: SUPPRESSIVE** (reduces swap capacity + raises hurdle) — **but the control is dark today** (`TEMPO_DIAL_ENABLED` + version-bound, A3).
   - **hold-duration: SPLIT/AMBIGUOUS** — season `sx-03` (deterministic, suppressive-flavored) vs agent `forcedRotation` (deterministic, suppressive, **fenced**) vs TF-04 (prompt-only, modulating, **moves no number**).

2. **Modulating detectors get a free pass on the shadow gate; the suppressive one is stuck.** setup-freshness and entry-confirmation have a **clean within-taken comparator** in `trades[].snapshot` (B1) → they can make performance claims **without** shadow (§6.5). churn-in-chop is suppressive **and** currently unobservable → it cannot even collect suppression evidence until the tempo dial is enabled. **Consider gating churn-in-chop behind the tempo-dial launch, or narrowing it to an "observe-only until dial live" state.**

3. **hold-duration needs a decision the Appendix must make.** There is no clean, soft, agent-side compilation target: TF-04 changes nothing numeric; the real agent lever (`forcedRotation.winnerThreshold`/`ticksThreshold`) is **FENCE-AUTH REQUIRED** to write and is tick-based (not days); the only clean day-based, tunable, deterministic target is **season `sx-03`** in a different subsystem. Options: (a) scope hold-duration to the **Season** subsystem (`sx-03` timeExitDays/timeExitMinGainPct) where it is clean and scorable; (b) target the agent tempo-dial `ticksThreshold` modulation (dark today); or (c) build a new TF-04→`winnerThreshold` bridge (fence-authorization artifact required). **Do not assume a single "time-exit rule template ID" exists on the agent path — it does not.**

4. **Two trading subsystems, not one.** The Appendix's "compilation target" language must distinguish the **Agent/LLM BaggerBomb battle** path (LLM + fenced `hftConfig` knobs + soft `activeRules`/leans; hold = ticks) from the **Season/Forge dimension** path (deterministic `sx-*`/`sr-*` rules with tunable Trading-Style dimensions; hold = days). Detectors framed against one may have no anchor in the other.

5. **The receipt captures only TAKEN trades — the whole point of shadow receipts.** `evaluationMetadata` is written only on SWAP (`agent-evaluate.js:1860`); HOLD writes nothing (`:2028`). Every suppressed/would-be opportunity is currently invisible. The shadow-receipt store is net-new capture, not a re-read of existing receipts. Effect size is **not** in the entry receipt (it's realized at exit/maturity).

6. **Hard-namespace + durably write our shadow receipts.** The existing `shadowLogger` owns the word "shadow," a `shadow/` GCS prefix, and `compilations`/`agent_consolidation` streams — and it is **fire-and-forget**, which BUILD_RULES §5 forbids for catalog events. Our shadow receipts must (a) be **renamed/hard-namespaced** and (b) use **awaited/queue-flag** durable writes. Reusing `appendToStream` as-is reproduces a documented data-loss bug.

7. **Supersede the lessons funnel cleanly to avoid a decision-prompt double-count.** `consolidatedInsight` feeds the **Haiku decision prompt** (`agentEvalPromptAssembly.js:518`). If `agentLessons` injects into the same prompt while consolidation still runs, the decision double-counts. The new store should **replace** the `lessons[]→consolidation→consolidatedInsight` injection or **gate** the old readers.

8. **Piggyback beats a new cron.** With **36/40** slots used (C5) and two existing daily agent boundaries (`agent-daily-scores` `45 1 * * 2-6`; `agent-batch-review` `25 20,21`), evidence-atom maturity + shadow-outcome computation can run with **zero** new slots (ruling #5 satisfied).

9. **Regime replication is trivially satisfiable.** `regime` (bull/correction/bear/recovery) and `volatilityRegime` (extreme/high/normal/low) each give ≥2 stable classes (§4.5), and regime is already stamped on receipts (`entryRegime`/`entryMarketPosture`). A per-stock **`choppy`** regime also exists — a candidate anchor for churn-in-chop's universe.

10. **Field-name drift in the spec.** The Appendix's assumed field names are not the live names: use `bBandwidthPercentile`/`bbPercentB` (not `bbands_state`), `volume.ratio`/`upDayVolRatio` (not `volume_confirmation_score`), `distanceToResistancePct` for fresh-vs-extended; and the tempo dial (not `reviewInterval`/`promotionThreshold`) for tempo. "0.3/0.4 ATR" are hurdle/stagnation margins, not a promotion threshold. Bind contracts to the verified names.

---

## Open items explicitly NOT resolved from live code (report, don't guess)

- **A2 "cap of 2 leans"** — NOT FOUND as a numeric constant; only `maxBundles` (level-gated) + conflict-group at-most-one were verified. The lean-equip service (change-archetype lean-rider path) was not fully read; the numeric cap, if it exists, lives there.
- **D1 `breadthTier` exact field name/values** — breadth classification VERIFIED to exist (`indexIntelligence.js:116-134`); the exact output field name was not pinned to a single line.
- **D2 per-position `entryTimestamp`/`holdDuration`** — reconstructable but no single dedicated field verified on the live position record (small capture-completeness item).

---

## Hard STOP

Discovery complete. This report writes no detector contracts, no Appendix, no spec, and touches no repo file. **Stopping here** for founder review, per the task's hard constraint and BUILD_RULES §3. Claude authors the Detector Appendix from the VERIFIED anchors above.
