# Customization Layer Discovery Audit — Archetypes / Rules / Traits

**Date:** July 3, 2026 · **Type:** DISCOVERY — READ-ONLY · **Repo:** fashraf94/TradeSeven

## Preamble — provenance & method (BUILD_RULES §2/§3)

| Item | Value |
|---|---|
| Session branch | `claude/customization-layer-audit-nby3ms` |
| Working-tree HEAD | `d2ca3c5` — **identical to `origin/main` HEAD** (verified: `git rev-parse origin/main` == `d2ca3c5` after fetch) |
| Tree status | clean; **no repo file modified/created/deleted** (report written outside the repo tree) |
| "main at HEAD" anchor | The working tree **is** `main` at HEAD. The initial clone's `origin/main` ref was stale (`37ccf9e`); a `git fetch origin main` moved it to `d2ca3c5`. All Q1/Q2/Q3/Q5 citations are `main`. |
| Git investigation ops (permitted, §3) | `git fetch origin main --tags`, `git fetch --deepen=200`, `git fetch` of both keystone branches — history-read only, no tree change |
| Fence contact | The fenced files `decide.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentArchetypeConfig.js`, `agentRiskManager.js`, `agentBattleService.js`, `agentSwapExecution.js`, `agentScoring.js` were **READ only**. **Zero edits.** Reads are flagged `reads-fenced-file`; would-require-an-edit-to-implement items are flagged **FENCE-BLOCKED**. |
| Method | Orchestrator read every load-bearing file directly; a 5-question parallel investigation (55 sub-agents: 5 investigators + 50 adversarial verifiers) independently re-checked each finding. All substance was CONFIRMED; 7 citations had off-by-a-few line drift (corrected below); one over-broad sub-claim was REFUTED and re-stated. |

---

## 1. Executive summary

**Hypothesis under test (§2):** *the per-archetype adjustment menus and the Stream D archetype-keyed knobs are cleanly consumable as a user-facing customization layer, without fenced-file changes and without creating a second source of truth against existing systems.*

### Verdict: **PARTIALLY SUPPORTED** — the raw materials are clean and single-source; the *offense* path and *bounded overrides* hit the fence, and *four of five* identity-orthogonal axes already have a live owner a new surface would double-claim.

| # | Deciding fact | Verdict impact |
|---|---|---|
| 1 | **The adjustment menus are a clean, single-source, archetype-keyed data module** — `src/data/archetypeAdjustments.js` feeds BOTH the voice layer and the gate; 46 typed adjustments across the 6 archetypes; every adjustment is `coreAlignment: 'reinforces'` (no core-reversing id exists). **VERIFIED.** | **Supports** |
| 2 | **Stream D V1.4 is MERGED and live on `main`** (the task's "may not be merged" hint has drifted). Three differentiated per-archetype knobs, one resolver (`resolveHftConfig`), archetype-locked, reading the frozen snapshot. **VERIFIED.** | **Supports** |
| 3 | **The "offense" (persistent pre-battle standing lean) does NOT exist today, and its two load-bearing insertion points are FENCE-BLOCKED** — the snapshot-at-battle-creation site (`agentBattleService.js:150`) and the eval-prompt read (`agentEvalPromptAssembly.js:936`). Directives are chat-gate-write-only, battle-scoped (`expiry:'end_of_battle'`), with no `source` field. **VERIFIED / FENCE-BLOCKED.** | **Breaks "without fenced changes"** |
| 4 | **Bounded user overrides on Stream D knobs are half-fenced:** the clean single choke point (`agent-evaluate.js:~1002`, assembly of the resolved config) is NON-fenced, but the forcedRotation *fire decision* (`agentRiskManager.js:154`) and the hurdleFloor gate (`agentRiskManager.js:315`) are FENCED. **VERIFIED.** | **Partial** |
| 5 | **Second-source-of-truth risk is real on 4 of 5 orthogonal axes** (research/hunt, tempo, risk, sector each already have ≥2 live claimants; comms is single-owned + an orthogonal budget). Three archetype config fields the design might reach for (`tradeFrequency`, `sectorConcentrationCap`, `defaultConfig.risk`) are **DEAD or seed-only** — reusing them would manufacture a phantom second source. **VERIFIED.** | **Breaks "without a second source of truth"** |

**One-line read for the founder:** the archetype foundation is genuinely re-usable as a customization substrate, but you cannot promote it to an "offense" surface or add bounded knob overrides *without touching fenced files*, and the follow-up design must explicitly resolve stamp-vs-live precedence on four axes that already have owners. Nothing here blocks the strategic decision; it prices it.

---

## 2. Q1 — Rule-vs-archetype conflict map

**Answer in one line: the entire 143-template equip → `activeRules` → prompt path is archetype-BLIND. Any template can be equipped onto any archetype and reaches the prompt uncontested.**

**Q1.1 — Archetype-awareness in the equip path? NONE.** The deploy-time choke point that rebuilds `agent.activeRules` is `projectActiveRules(equippedTraits, ruleDocs, bundles)` — **three params, no archetype argument, no archetype branch in its 115 lines.** Selection is by (a) trait membership `traitId ∈ equippedTraits` and (b) non-archived bundle membership only. *(VERIFIED — `api/_utils/projectActiveRules.js:66` signature, `:97` trait-select, `:109-110` bundle-select.)* It is imported at `decide.js:17` and called at **`decide.js:182`**; archetype is read *afterward* and used only for stock ranking (`computeArchetypeRankings`). *(VERIFIED, reads-fenced-file — `decide.js:182,192,201`.)* The upstream client write path `forgeService.equipBundle` is likewise archetype-free, and its reconciler call there is detect/shadow only. *(VERIFIED — `src/services/forgeService.js`.)*

**Q1.2 — `FORGE_CONFLICT_PAIRS` scope: purely rule-vs-rule.** It is a flat list of 11 `{ ruleA, ruleB, message }` rule-id pairs (`th-04`/`th-05`, `gs-05`/`gs-06`, `mb-01`/`mb-09`, …). **No archetype field anywhere.** `SEASON_CONFLICT_PAIRS` has the same shape. The deploy reconciler (`ruleConflictReconciler`) tie-breaks by dimension/operator/hardness/**provenance-tier** — and its `archetype_default` tier is a *provenance* label (tier 2 = seeded/built-in) meaning "beaten by a user-equipped rule," **not** an identity check against the agent's archetype. *(VERIFIED — `src/data/forgeKnowledgeBase.js:3786`; `src/utils/ruleConflictReconciler.js` PROVENANCE_TIER.)*

**Q1.3 — Contradiction census (category-level; 6 cores verified against live wires).** The 143 templates span 13 categories (technical 25, mid_battle 16, fundamental 14, risk 12, allocation 11, game_state 11, institutional 10, tier_strategy 10, threshold 8, entry_criteria 8, exit_stops 7, season_state 6, rebalancing 5 = 143 — VERIFIED). Cores verified against `ARCHETYPE_WEIGHTS`/`ARCHETYPE_CONSTRAINTS`/`ARCHETYPE_TEMPERATURES` (`archetypeScoring.js`) and `hftConfig` (`agentArchetypeConfig.js`):

| Archetype (code key) | Core (verified wire) | Contradicting families | ~count | Example rule IDs |
|---|---|---|---|---|
| Trend Follower (`momentum_chaser`) | technical .40 / atr .25 / fund .05; shortlist ≥5 from top-3 sectors, avoid −1% sectors (`archetypeScoring.js:15,82`) | mean-reversion/oversold technicals; deep-value; low-vol caps that block runners | ~30 | `tech-rsi-oversold`, `tech-bollinger-squeeze`, `fund-value-pe`, `ts-01` (Volatility Cap) |
| Contrarian (`contrarian`) | inverseComposite .40; shortlist ≥5 from bottom-3, avoid top sector (`archetypeScoring.js:23,84`) | pure momentum/breakout entries; add-to-winners | ~28 | `tech-macd-bullish`, `tech-volume-surge`, `sr-04` (Add to Winners), `mb-11` (Power Hour) |
| Speculator (`degen`) | atr .60, fund .00; ≥3 ATR-pct>0.80, "ignore fundamentals" (`archetypeScoring.js:39,88`); swapWindow cap 12 | ALL fundamental rules; risk/vol-avoidance & tight stops; profit-lock | ~40 | `fund-earnings-surprise`, `fund-financial-health`, `risk-volatility-avoidance`, `th-05` (Bird-in-Hand Lock) |
| Capital Preserver (`guardian`) | sectorDiversity .35, atr .05; ≥5 fund>60, ≥6 sectors, avoid ATR>0.75 (`archetypeScoring.js:55,91`); **forcedRotation DISABLED**, swapWindow cap 2 | high-vol/BaggerBomb chases; House-Money threshold pursuit; concentration; frequent swaps | ~45 | `th-04` (House Money), `risk-single-stock-limit` (loosened), `ts-04` (Performance Rotation) |
| Fundamental Investor (`analyst`) | fund .40 / tech .30; ≥5 fund>70, exclude fund<40 (`archetypeScoring.js:47,90`); temp .2 | fundamental-ignoring pure-technical/vol plays; degen ATR chasing | ~30 | `tech-rsi-oversold` (ignores fundamentals), `th-04`, `ts-01` vol plays |
| Diversifier (`diversifier`) | sectorDiversity .30; span ≥7 sectors, ≤4 per sector (`archetypeScoring.js:31,86`); ENFORCE adds a hard 35% sector cap | concentration/allocation rules that overweight one sector or single names | ~20 | `alloc-sector-cap` (loosened), `alloc-tier-preference`, `risk-single-stock-limit` (raised) |

*(Category-level estimate, not per-rule adjudication, per §3/§5. Exact figures depend on user-set params.)*

**Q1.4 — Where a contradicting equipped rule lands, and does the gate see it?** An equipped rule renders split by **category-derived hardness** (`isHardRule`, where `HARD_CATEGORIES = {'risk','allocation'}`, plus an authored per-rule override): hard → `== CONSTRAINTS (must obey) ==`, else → `== STRATEGY PREFERENCES (should follow) ==`. **The split is category-based, not archetype-based.** *(VERIFIED, reads-fenced-file — `agentPromptAssembly.js:80-87`; `agentEvalPromptAssembly.js:524-538`; `ruleHardness.js:23,39`.)* The archetype-integrity **gate never sees equipped rules at all** — `directiveGate` only evaluates the chat-turn `_archetypeProposal` against the allowlist. *(VERIFIED — `directiveGate.js:60,140`.)* Enforce-mode's only mechanical arm, `injectDiversifierSectorCap`, reads `deployedGuardrails`, not `activeRules`. *(VERIFIED — `agentGuardrails.js:64-85`.)*

> **Correction to task framing (from adversarial verify):** archetype is *not* limited to "stock selection + voice." Beyond `archetypeScoring.js`, archetype drives regime routing, the risk-manager HFT knobs, conviction mods and (nominally) trade frequency via `agentArchetypeConfig.js:26-204`. **But none of those gate equipped *rules*** — the Q1 conclusion (equip path is archetype-blind) stands; the archetype→physics wiring is real and is the subject of Q4/Q5.

**Hypothesis impact: SUPPORTS** the premise that all 143 templates are equippable by any archetype.

---

## 3. Q2 — Adjustment-menu wiring

**Q2.1 — Where the allowlists live.** One non-fenced, zero-import data module: **`src/data/archetypeAdjustments.js`** — `ARCHETYPE_ADJUSTMENTS` keyed by the six code-ids. Each archetype = `{ zones{4 zones}, adjustments[7–8] }`; each adjustment carries a typed policy. It is the **single source of truth for BOTH** the voice layer and the gate (helpers: `getArchetypeZones` [analyst-fallback, display only], `getAllowlist`/`isValidAdjustmentId`/`getCanonicalText` [no-fallback, write path]). Shape for one adjustment (VERIFIED, `archetypeAdjustments.js:62`):

```js
{ id: 'TF-01', canonical: 'Prefer fresh breakouts over extended / late-stage entries',
  policy: { riskDirection:'lower', concentrationDirection:'neutral', timeHorizonDirection:'neutral',
            coreAlignment:'reinforces', forbiddenOpposite:'buying beaten-down reversals (becoming a Contrarian)' } }
```
Counts: TF 8 · CN 8 · SP 7 · CP 8 · DV 7 · FI 8 = **46 adjustments**. Every one is `coreAlignment:'reinforces'` — the invariant that makes the gate airtight (no core-reversing id exists to select). `PASS_THROUGH_SECTORS` is a reserved, **empty & frozen** seam (`:202`) for a deferred typed-emphasis matrix. *(All VERIFIED.)*

**Q2.2 — Consumers.**

| Consumer | file:line | Reads from allowlist | When | Produces |
|---|---|---|---|---|
| Voice persona block | `voiceLayerPrompt.js:2513-2527` | `getAllowlist` (first, no-fallback) + `getArchetypeZones` | `/api/agent/chat`, battle, flag≠`off` | 4-zone identity + `id: canonical` menu |
| Deterministic gate | `directiveGate.js:19,77,79,98` | `isValidAdjustmentId`, `getCanonicalText`, `getAllowlist` | chat directive chokepoint, battle, flag≠`off` | validated `directive={text,expiry}` or null |
| chat.js (transitive) | `chat.js:16,469` | via `gateDirective` only | same turn | writes `battle.directive` (enforce only) |
| Eval corpus/aggregate scripts | `api/scripts/archetype-integrity-eval/*` | `getAllowlist` (offline labelling) | offline harness (not runtime) | eval corpus |
| `directiveIdentity.js` / `legacyDirectiveSanitize.js` / `agentGuardrails.js` | — | **NONE** (touch the integrity *system*, not the allowlist) | — | — |

**Q2.3 — Directive lifecycle: battle-scoped, single-slot, enforce-only.** On lock-in, `chat.js` writes the directive to **one battle-doc slot** `battle.directive = { text, expiry, directiveThreadId, createdAt }`. It is **battle-scoped** — `agent.directives[]` is write-dead and nothing carries the directive across battles. It re-enters cognition only through the **FENCED** read at `agentEvalPromptAssembly.js:936` (`isDirectiveActive` → "ACTIVE DIRECTIVE (from your Coach)" block for the Haiku eval). The gate hard-codes `expiry:'end_of_battle'` (`directiveGate.js:79`) regardless of any model-proposed expiry. *(VERIFIED — `chat.js:604-619`; `agentEvalPromptAssembly.js:927-941`, reads-fenced-file; `directiveUtils.js:15-38`.)*

**Q2.4 — The offense question: no existing mechanism; two load-bearing insertion points are FENCE-BLOCKED.** The directive shape has **no `source` field**, `battle.directive` is written **only** by the chat gate, and even `expiry:'permanent'` does not cross battles (`directiveUtils.js:15`). A persistent, pre-battle standing lean would require **new** pieces:

| Needed piece | Insertion point | Fence status |
|---|---|---|
| Persistent pre-battle lean store | agent doc via `deployStrategyService.js` / `agentService.js` | NON-FENCED |
| Validate lean id → canonical | reuse `isValidAdjustmentId`/`getCanonicalText` | NON-FENCED |
| **Snapshot lean at battle creation** | `agentBattleService.js:150` (agentContext write-once) | **FENCE-BLOCKED** |
| **Read lean into the eval prompt** | `agentEvalPromptAssembly.js:936` (or a new block) | **FENCE-BLOCKED** |
| A `source` discriminator on the directive shape | today's shape is `{text,expiry,directiveThreadId,createdAt}` | new field on **FENCED** write/read paths |

**So the offense path is feasible in principle but its two most load-bearing steps are fenced** — this is the single fact that most qualifies the hypothesis.

**Q2.5 — `ARCHETYPE_INTEGRITY_MODE` interaction. Current state = `'observe'`** (`featureFlags.js:294`, VERIFIED). Consumption differs by state:

| Consumer | `off` | `observe` (current) | `enforce` |
|---|---|---|---|
| chat gate (`chat.js:465-484`) | legacy `normalizeDirective` | **gate runs + logs, writes NULL directive** | gate writes directive |
| voice menu (`voiceLayerPrompt.js:2514`) | null (no block) | menu+zones injected | menu+zones injected (same) |
| legacy sanitize (`legacyDirectiveSanitize.js:37`) | renders legacy array | neutralized | neutralized |
| Diversifier cap (`agentGuardrails.js:66`) | off | **off (byte-identical)** | cap applied |

**Net for today's `observe`:** the gate classifies and logs but **persists nothing**, and the only mechanical arm (Diversifier cap) is inert. *(VERIFIED.)*

**Hypothesis impact: PARTIAL** — the wiring exists and is clean; the standing-lean offense is unsupported and fence-blocked at its load-bearing points.

---

## 4. Q3 — Traits ground truth on `main`

**One line: `main` runs the "Option A" traitId-keyed, bundle-independent model; the trait UI is largely sidelined behind flags and an orphaned screen, but trait rule docs DO land on every created agent.**

**Q3.1 — Live/dead inventory.**

| Module | Status |
|---|---|
| `traitLibrary.js` | **LIVE** (TraitsExploration + seeding) |
| `traitEquip.js` | **LIVE** (backend seed path, no UI) |
| `useTraits.js` | **LIVE** (via ForgeWorkshop → TraitsArea → TraitsExploration strength toggle) |
| `seedDefaultTraits.js` | **LIVE** (agent creation + reseed) |
| `traitEnforcement.js` | **LIVE** (HARD_COUNT + enforced badges in Exploration) |
| `workshop/traits/TraitsExploration.jsx` + `TraitsExplorationKit.jsx` | **LIVE** (view-only surface; `TRAITS_EXPLORATION_ENABLED=true`) |
| `workshop/TraitsArea.jsx` | **LIVE (partial)** — only the exploration early-return branch; the interim branch is dead |
| `traitCombos.js` | imported-but-unreachable (only feeds orphaned ForgeScreen) |
| `traitSlotSummary.js` | imported-but-unreachable (computed, only renders behind `TRAIT_SLOT_ENABLED=false`) |
| `Dashboard/TraitsSheet.jsx` | imported-but-unreachable (`TRAIT_SLOT_ENABLED=false`; `traitsEpoch` never bumps) |
| `Forge/TraitStrengthToggle.jsx`, `Forge/TraitCard.jsx` | imported-but-unreachable (consumers dead; live surface uses Kit's toggle) |

Sub-checks: **earned-trait detection = NOT implemented** (only a future-perk comment, `featureFlags.js:95`); **DNA-group card UI** dead (live DNA rendering is Kit's `DnaPillarHeader`); **strength profiles LIVE** (battle-locked via `useTraits.setTraitStrength`). *(All VERIFIED.)*

**Q3.2 — Option A confirmed; the task's `decide.js:107` anchor has DRIFTED.** The live model is Option A: `projectActiveRules` selects trait rules by `traitId ∈ equippedTraits` deduped by `(traitId, sourceRef)` — **bundle-independent** for trait rules (`projectActiveRules.js:97,100`). The projection is **not** at `decide.js:107` (that line is deploy-auth `TOURNAMENT_ONLY_FIELDS`); it is imported at `decide.js:17` and **called at `decide.js:182`**, then reconciled at `:192`. The equip-path/orphan-cleanup **did land** (`useTraits` auto-unequips traits whose rule docs vanished; `projectActiveRules` dedups + drops archived-bundle rules). *(VERIFIED, reads-fenced-file for decide.js.)*

**Q3.3 — Trait → activeRules path + battle-lock.** A trait's strength toggle (the one live mutation) writes through `useTraits.setTraitStrength`; the resulting rule docs are re-projected into `activeRules` at the next deploy (`decide.js:182`) and reach the prompt. **`useTraits` holds a battle-lock** — it checks `activeBattleId` and blocks the write during an active battle, **failing open** on a read error (`useTraits.js:157,162`). *(VERIFIED.)*

**Q3.4 — Blast radius (factual, no design).**

| (a) If traits are **RETIRED** — breaks / needs removal | (b) If **REBASED** as archetype-scoped bundles |
|---|---|
| `projectActiveRules` trait branch (`:94-107`) + `decide.js:182/192` wiring | Trait objects carry **NO archetype field** (only `dnaGroup`) — `traitLibrary.js:19-43` |
| `seedDefaultTraits.js` + `AgentCreationFlow.jsx:383` seed call + `ArchetypePicker` reseed | The only archetype linkage is the external map `ARCHETYPE_DEFAULT_TRAITS` (`traitLibrary.js:483`) → **from-scratch data-shape change** to scope traits per archetype |
| `useTraits.js`, `traitCombos.js`, `traitLibrary.js`, `traitEquip.js`, `traitEnforcement.js`, `traitSlotSummary.js`, `ruleRelationships.js` trait imports | `strengthProfiles` are ruleId-keyed (`traitLibrary.js:27`) — reusable but no scoping hook |
| UI: TraitsSheet, TraitCard, TraitStrengthToggle, TraitsArea, TraitsExploration(+Kit), DNAGroupCard, FoundInChips, MyBundlesTab | `projectActiveRules` would need archetype-aware selection (today traitId-only), touching FENCED activeRules consumers |
| Flags: `TRAITS_EXPLORATION_ENABLED`, `TRAIT_SLOT_ENABLED`; `archetypeCharacter.js` default-traits import | Seeded per-archetype default sets (`ARCHETYPE_DEFAULT_TRAITS`, `:483`) partially prefigure archetype scoping |

**Q3.5 — User-data exposure (INFERRED — no Firestore creds).** There is **no `source:'trait'` value** in code. Trait rule docs are written with `source:'forge_discover'` + a `traitId` field (`useForge.js:400/410`; `traitEquip.js:61/68`); seeding stamps `provenance:'archetype_default'`, hand-equip stamps `'user_equipped'`. Trait-sourced docs are identified by the **`traitId` field**, not a source value. `seedDefaultTraits` runs at every agent creation (`AgentCreationFlow.jsx:383`, non-blocking) — so real agents almost certainly hold traitId-keyed rule docs. **Marked INFERRED: prod Firestore was not read (sandbox has no creds).**

**Hypothesis impact: SUPPORTS** the memory that Option A landed and traits were sidelined.

---

## 5. Q4 — Stream D dial-readiness

### 5.0 Branch status (report first)

**The V1.4 implementation branch is `claude/forge-enforcement-keystone-implementation` (HEAD `ae74029`, commits labeled "Phase 0–8 … V1.4 §4.x"). BUT it is a STALE earlier snapshot: Stream D V1.4 is MERGED and further-evolved on `main` (`d2ca3c5`).** Evidence: `main` carries the full knob config + resolver + `finalizeCronState` + receipt discriminator, and `main` is *ahead* of the branch — `git diff origin/main origin/…keystone-implementation` shows `agent-evaluate.js` is **~865 lines larger on main** and `agentArchetypeConfig.js` ~26 lines larger; `main`'s history for the config file includes `feat(keystone): Phase 1 — archetype→physics hook (V1.4 §4.1)` plus later evolution. **The task's "may not be merged (calibration smoke pending)" hint has drifted — flag it.** *(VERIFIED via git; see §7.)* All Q4 code citations below are `main`.

| Artifact | Location on main | Status |
|---|---|---|
| Knob config (`hftConfig` blocks) | `agentArchetypeConfig.js:26-204` (FENCED) | MERGED, live |
| `resolveHftConfig` resolver | `agentArchetypeConfig.js:218` (FENCED) | MERGED |
| `finalizeCronState` | `agentCronState.js:35` | MERGED |
| Receipt source discriminator | `agentRiskManager.js:516-529` (FENCED) | MERGED |

### 5.1 Knob shapes as built (VERIFIED, reads-fenced-file)

| Knob | Shape | Fields |
|---|---|---|
| forcedRotation (A) | **Shape-A scalars** | `enabled, pctThreshold, ticksThreshold, maxTickAgeMinutes, winnerThreshold` |
| hurdleFloor (B) | **Shape-B per-reason table** | `enabled, byReason.{haiku_decision,stagnation}.atrMultiplier, default.atrMultiplier, requireBenchPositive` |
| swapWindow (C) | **Shape-A scalars** | `enabled, capPerWindow, windowMinutes, countEmergencies` |

Illustrative degen block (`agentArchetypeConfig.js:151-163`): forcedRotation `{pctThreshold 0.001, ticksThreshold 3, winnerThreshold 0.002}`; hurdleFloor `byReason {haiku 0.2, stagnation 0.6}, default 0.2, requireBenchPositive`; swapWindow `{cap 12, 60min}`. Values are self-labelled "launch-seed and ILLUSTRATIVE" pending Phase-8 calibration (`:17`).

### 5.2 Precedence — archetype-locked, one resolver

`resolveHftConfig(archetypeConfig, gameMode)` = `hftConfigByMode?.[gameMode] ?? hftConfig ?? null` (`agentArchetypeConfig.js:218`), called once per battle at **`agent-evaluate.js:~1002`**. Knobs are **archetype-LOCKED**; the user-toggleable `strategyPreset` governs only **base risk levers** via `getPresetConfig` (`agent-evaluate.js:475`) — the code reads `hftConfig` "regardless of the user-toggleable `strategyPreset`" (`agent-evaluate.js:988-993`). No archetype defines `hftConfigByMode` today → zero-delta by construction. *(VERIFIED, reads-fenced-file.)*

### 5.3 Bounded user overrides — feasibility only (insertion points + fence status)

| Knob / read | Site | Fence status |
|---|---|---|
| forcedRotation — **fire decision** | `agentRiskManager.js:154` | **FENCE-BLOCKED** |
| forcedRotation — counter thresholds | `agent-evaluate.js:1029` | NON-FENCED |
| hurdleFloor — `clearsHurdleFloor` gate | `agentRiskManager.js:315` | **FENCE-BLOCKED** |
| swapWindow — risk-loop breaker | `agent-evaluate.js:1077` | NON-FENCED |
| swapWindow — Haiku-path breaker | `agent-evaluate.js:1735` | NON-FENCED |
| **Single choke point (config assembly)** | `agent-evaluate.js:~1002` | **NON-FENCED** |

A clamped per-user band applied at the **`~1002` assembly** would flow to every read site **without editing a fenced file**. Applying per-site at `:154`/`:315` would require editing FENCED `agentRiskManager.js`. **Caveat (from verify):** every read site defensively re-defaults (`?? 0.001`, `?? 20`, `?? 0.5`), so a clamping layer must **merge, not replace** the knob object or partial overrides silently fall back to hardcoded launch defaults. *(VERIFIED.)*

### 5.4 State / receipt implications

The receipt schema **already anticipates overrides**: `buildSwapReceiptSource` (`agentRiskManager.js:525`) emits `hftKnobsSource:'archetype'` today, and its docstring (`:516-518`) **reserves a post-launch `'user_rule'` value** — this is the existing hook for override provenance. `finalizeCronState` (`agentCronState.js:35`) persists per-tick counters only (not knob values/provenance) — a user-override value would **not** go there. **Caveat:** `'user_rule'` exists only in the docstring; no code path produces it yet, and downstream consumers (training pipelines, Voice Layer) would need to handle the new enum. *(VERIFIED.)*

### 5.5 Archetype read — the frozen snapshot

The knob path reads the **frozen** `battle.agentContext.archetype` snapshot: `ctx = battle.agentContext` (`agent-evaluate.js:468`) → `getArchetypeConfig(ctx.archetype)` (`:994`). **No `agent.archetype`** appears in `agent-evaluate.js` or `agentRiskManager.js`; live `agent.archetype` is confined to the prompt/chat/decide files. This matches the integrity build's prefer-the-snapshot design. *(VERIFIED.)*

**Hypothesis impact: SUPPORTS** — Stream D is merged and dial-ready; a bounded override layer is feasible with a clean non-fenced choke point, while the two fire-decision/hurdle sites are fenced.

---

## 6. Q5 — Claim map for identity-orthogonal axes

**Every one of the five axes already has an owner; four carry a genuine dual-claim risk.**

| Axis | Owner system | Storage | Prompt/physics consumption | Second claimant? (dual-claim) |
|---|---|---|---|---|
| **A. What it researches / hunts** | Archetype shortlist constraint (`ARCHETYPE_CONSTRAINTS`) — SOFT, prompt | `archetypeScoring.js:80` (+ `:14` weights) | `agentPromptAssembly.js:13-14`; `tournamentAgentBoards.js:121` | **YES** — user-equipped **watchlist** priority block (`agentPromptAssembly.js:114`). Scouting Board (`scouting-board.js:6`, reads at `:18-19`) is a **read-only preview**, not a 2nd source. |
| **B. Trade tempo / frequency** | Stream-D `hftConfig` knobs (forcedRotation + swapWindow) — HARD physics | `agentArchetypeConfig.js:46…` | `agentRiskManager.js:154,315`; `agent-evaluate.js:1029,1077,1735` | **YES** — `strategyPreset` (user-toggleable, default `'balanced'`, write `agentService.js:470/473`) governs entry conviction. Precedence **explicitly coded**: knobs apply "regardless of strategyPreset" (`agent-evaluate.js:992`) + test-locked (`invariant1Matrix.test.js:292`). `tradeFrequency` field is **DEAD**. |
| **C. Risk posture** | `strategyPreset` risk levers (`agentPresetConfig` risk block) — live | `agentPresetConfig.js:13-58` | `agent-evaluate.js:475` `getPresetConfig` | **YES (3-way)** — user guardrail `se-07` via `checkSectorCap` (`agentGuardrails.js:496`) + Diversifier core-cap injection (`:64`, cap 35). Precedence = `min(user, core)` "user can only tighten" (`:76`). Archetype `defaultConfig.risk` is CPU/profile seed only (`tournamentCpu.js:73`), NOT live. |
| **D. Sector lean** | `ARCHETYPE_CONSTRAINTS`/`ARCHETYPE_WEIGHTS` — SOFT prompt | `archetypeScoring.js:14,80` | `agentPromptAssembly.js:13`; `tournamentAgentBoards.js:121` | **YES** — HARD `maxSectorWeight` guardrail keyed to `se-07` (`agentGuardrails.js:235,496`). Archetype `sectorConcentrationCap` field is **DEAD**. Soft-prompt vs hard-guardrail precedence to resolve. |
| **E. Communication style / verbosity** | Voice layer (`voiceLayerPrompt.js`) + stamped archetype **voice seeds** | `archetypeIdentity.js:18` (voice seeds) | `voiceLayerPrompt.js:2513` (integrity block, mode-gated); callers `chat.js`, `decide.js` | **PARTIAL** — chat budget (`agentChatBudget.js`, daily limit 10) governs question **COUNT**, orthogonal to style. Real risk = a new verbosity surface vs the STAMPED voice seeds. |

**Dead / seed-only fields (reusing them would manufacture a phantom second source):** `tradeFrequency` (`agentArchetypeConfig.js:54`, 0 live reads), `sectorConcentrationCap` (`:53`, 0 live reads — live cap is `se-07`), `defaultConfig.risk/concentration/momentum` (`:55`, read only by `tournamentCpu.js:73` for CPU opponents + a create-profile seed). *(All VERIFIED.)*

**Already-coded precedence models the follow-up design can lean on:** (B) `hftConfig` beats `strategyPreset` (comment + Gate-6 test lock `invariant1Matrix.test.js:292`); (C) Diversifier cap uses `min(userCap, 35%)` — tighten-only, ENFORCE-only.

**Dual-claim flags to resolve (stamp-vs-live / precedence):** **A, B, C, D** (four axes). **E** is single-owned with an orthogonal budget.

---

## 7. Unexpected findings (report, do not fix — BUILD_RULES §3)

1. **Task premise drift on Q4 (headline):** Stream D V1.4 is **merged and evolved on `main`**, not pending on a branch. The `claude/forge-enforcement-keystone-implementation` branch is a stale snapshot; `main`'s `agent-evaluate.js` is ~865 lines larger. Any design gated on "Stream D not yet merged" should be re-based on this fact.
2. **Task anchor drift on Q3:** `projectActiveRules` is **not** at `decide.js:107` (that's deploy-auth); it's called at `decide.js:182`.
3. **`ForgeScreen.jsx` + `ForgeLanding.jsx` appear fully orphaned on `main`** — `App.jsx` imports `ForgeScreen` but renders `ForgeWorkshop` instead. A large amount of trait UI (`TraitCard`, `MyBundlesTab`, `DNAGroupCard`, combo labels) survives only inside this dead subtree. Dead-code / bundle-size hygiene item.
4. **Triplicated hard/soft constant maintained by hand:** `{'risk','allocation'}` lives in `ruleHardness.js:23` (server), `hardSoftHelper.js:28` (client), and `ruleConflictReconciler.js` — divergence would silently mis-render CONSTRAINTS vs STRATEGY. The fence makes the client/server copy unavoidable, but the reconciler copy is a third.
5. **`traitEnforcement.js` is a hand-synced client-side *predictor*** of the server eval-prompt CONSTRAINTS split, explicitly "not test-linked" — badge/behavior drift risk.
6. **Per-rule hardness override can weaponize a contradiction:** an archetype-contradicting rule can be authored `hard` (`projectActiveRules.js:80-90`; `forgeService.setRuleHardness`), forcing it into the must-obey CONSTRAINTS block regardless of category — sharpening the conflict Q1 describes.
7. **Only 1 of 6 archetypes (Diversifier) has any mechanical integrity enforcement,** and only under `enforce` + tournament; under today's `observe` default it is inert (`agentGuardrails.js:64-69`). The integrity system is, on `main` today, effectively voice/gate-classification only.
8. **`hftConfig` values are uncalibrated** ("launch-seed and ILLUSTRATIVE," `agentArchetypeConfig.js:17`) — the archetype→physics wire is real but not yet tuned (Phase-8 gates 8A/8B are post-merge).

---

## 8. Verified / Inferred index

**INFERRED claims (could not be verified read-only; reason given):**
- **Q3.5 — real agents hold traitId-keyed rule docs on prod.** INFERRED from the code path (`seedDefaultTraits` runs non-blocking at every `AgentCreationFlow.jsx:383` creation). Prod Firestore was **not** read (sandbox has no credentials).
- **Q1.3 census counts** (`~20`–`~45` per archetype). INFERRED order-of-magnitude estimates from category composition, not per-rule adjudication (per §5 scope). Category *totals* (143 across 13) and the example rule IDs are VERIFIED; the per-archetype contradiction *counts* are estimates.
- **Q4 branch "main is ahead of the branch."** VERIFIED by `git diff` line-deltas and `main` history; the branch's internal contents were not exhaustively diffed line-by-line — the *merge-and-evolved-on-main* conclusion is VERIFIED, the "strictly ahead in every file" phrasing is INFERRED from the aggregate diff.

**Everything else in this report is VERIFIED** — read directly at the cited `file:line` on `main` (`d2ca3c5`) this session, and independently re-checked by an adversarial verifier (all substance CONFIRMED; the following citations were corrected for line drift: `projectActiveRules` signature `:66`/trait `:97`/bundle `:109-110`; `directiveIdentity.js:51`; `legacyDirectiveSanitize.js:37`; `EquipStation.jsx:333`; `resolveHftConfig` call `agent-evaluate.js:~1002`; `scouting-board.js:18-19`; `agentService.js:470/473`; Diversifier `effectiveCap` `agentGuardrails.js:76`).

**Fence status:** all fenced files were **READ only; zero edits.** Fence-blocked *future* work identified: Q2.4 (standing-lean snapshot @ `agentBattleService.js:150` + eval read @ `agentEvalPromptAssembly.js:936`); Q4.3 (per-site knob override @ `agentRiskManager.js:154,315`). None were designed around.

---

**HARD STOP.** Discovery only. No design, spec, or implementation follows. The customization design spec is gated on founder review of this report.
