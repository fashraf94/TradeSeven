# Command Center Value-Loop — Ground-Truth Audit (Read-Only)

**Mode:** Phase 0 discovery · READ-ONLY · hard STOP after report
**Audit date:** 2026-06-25 (report generated 2026-06-26)
**Method:** Every claim cited `file:line`. Load-bearing claims were independently re-verified against the cited lines by a second adversarial pass. No edits were made; this report is the only file created.

---

## 1. Baseline (§1)

| Item | Value |
|---|---|
| **Audited branch** | `claude/command-center-audit-rknu2b` |
| **HEAD SHA** | `37ccf9e38b5028a2c4469bc1eea8dd76b7e443a9` |
| **`origin/main` last commit** | `37ccf9e3 Merge pull request #541 from fashraf94/claude/elegant-curie-3tedjt` |
| **Behind origin/main?** | **No.** HEAD == `origin/main` (identical SHA). The audit branch is even with main. |
| **Working tree** | clean |

> Note: the audit prompt expected the audited branch to be `main`. It is actually the dedicated audit branch `claude/command-center-audit-rknu2b`, which is **at the same commit as `origin/main`** — so the audited tree is byte-identical to `main`. No discrepancy of substance.

### Relevant in-flight branch map (not switched to — last commit subjects only)

| Branch | Last commit |
|---|---|
| `origin/claude/redesign-command-center-ELPcr` | `e3cbd378 phase 7: thread directiveThreadId through timeline, add visual connector` |
| `origin/claude/redesign-command-center-WWe2X` | `b9371cc9 phase 6: thread review-mode props from AgentBattleScreen to AgentChat` |
| `origin/claude/differentiate-archetype-portfolios-3wbxM` | `18cbf04a fix: show stock symbol in closed trades section` (substantive commit on branch: `204c70a6 feat: differentiate archetype portfolios with scoring, temps, and constraints` — **appears already merged**: `archetypeScoring.js` exists on the audited tree) |
| `origin/claude/archetype-picker-reseed` | `7f8ada2f fix(dashboard): address archetype-picker code-review findings (Spec 1 Phase 4)` |
| `origin/claude/consolidation-writer-dossier-t3ykE` | `6fe210cb sprint1(phase2-fix): move reflection to dedicated cron, await consolidation chain, free EarningsGame slots` |
| `origin/claude/dossier-discovery-audit-may2026` | `a0444b5a docs: Dossier System discovery audit report (May 2026)` |
| `origin/claude/add-trait-data-layer-8p5KX` | `ac5b0f33 Fix audit findings: error handling, state sync, shared rule safety` |
| `origin/claude/fix-trait-ui-issues-JSTM5` | `7eeca1f8 feat: bundle-trait integration — traitId attribution, grouped display, counter fix, radar fix` |
| `origin/claude/forge-enforcement-keystone-implementation` | `ae74029d test(keystone): Phase 8 code-review fixes — make tripwire tests prove their titles` |
| `origin/claude/forge-enforcement-keystone-discovery` | `a9384c9c docs(forge-enforcement): keystone discovery audit — Path 2 findings report` |
| `origin/claude/forge-rule-extract-session2-may26` | `2a4ce93d docs(stream-b): rule extraction — institutional, fundamental, tier_strategy, game_state` |
| `origin/claude/forge-bundle-management-starter-kit` | `973202c2 feat(forge): update Starter Kit questions and wire Spotlight CTA` |
| `origin/claude/create-voice-layer-prompt-2V8pU` | `accbdd15 feat: replace Haiku with Gemma 4 via OpenRouter in agent chat` |
| `origin/claude/voice-layer-recon` | `d8fdb827 docs(recon): voice layer audit — 9 question groups + state matrix + UX walkthrough` |
| `origin/claude/voice-layer-routing-kVZdn` | `a1f1ebc8 feat(voice-layer): phase 1 — mode-aware routing + first-message-on-deploy` |
| `origin/claude/watchlist-equip-backend-TbkDh` | `030aa232 feat(agent): Phase 5B1 — watchlist equip backend + data model` |
| `origin/claude/extend-watchlist-slots-VUWd0` | `2559617d feat(forge): watchlist anatomy slot extensions for Phase 3 UI` |

(The full repo has ~250 remote branches; the above is the subset matching archetype / rule / trait / vision / command-center / dossier / learning / consolidation / voice-layer / watchlist-equip.)

---

## 2. One-line verdict table

**Legend — "reaches trading?":** yes = its output reaches `decide.js` and/or the Haiku eval prompt (`agentEvalPromptAssembly.js` via `agent-evaluate.js`); partial = reaches one prompt path but not the other, or only indirectly; no = cosmetic/inert; n/a = UI-only surface.

### Loadout categories (Section A)

| System | Tag | Reaches trading? |
|---|---|---|
| Archetype (`agent.archetype`) | **LIVE** | **yes** |
| Watchlist (`agent.equippedWatchlistId`) | **LIVE** | **yes** |
| Traits — **data path** (`agent.equippedTraits`, auto-seeded) | **LIVE** | **yes** |
| Traits — **equip UI slot** (`TRAIT_SLOT_ENABLED`) | **PARTIAL** (flag off) | n/a |
| Rules / rule-bundles — **projection pipeline** | **LIVE** | yes (trait-rules) |
| Rules / rule-bundles — **user-equip UI** (RuleBundlePicker) | **PARTIAL** (dormant; no default bundle) | partial |
| `equippedRules` (a stored agent field) | **ABSENT** | — |

### Subsystems (Sections B–E)

| System | Tag | Reaches trading? |
|---|---|---|
| Rules pipeline (`projectActiveRules` → `activeRules` → prompts) | **LIVE** | **yes** |
| Forge knowledge base (143 static templates) | LIVE (authoring lib) | partial (indirect) |
| Trait **strength** → `paramValues` → Haiku | **LIVE** | **yes** |
| Trait **identity** (name) → Haiku | **ABSENT** | no |
| Learning — Reflection (`reflect.js` → `memory[]`) | **LIVE** | partial (Sonnet deploy only) |
| Learning — Review (`agent-batch-review.js` → `lessons[]`) | **LIVE** | no |
| Learning — Consolidation (`consolidatedInsight` + `disciplines`) | **LIVE** | partial |
| Learning — Payoff read (`consolidatedInsight` → Haiku + Sonnet) | **LIVE** | **yes** |
| Learning — end-to-end loop (battle → insight → Haiku) | **LIVE** (across battles) | **yes** |
| Learning — `agent.directives[]` (learning channel) | **STUBBED** (deprecated) | no |
| Archetype on **trading** (hftConfig knobs + draft scoring) | **LIVE** | **yes** |
| Archetype on **voice** (Gemma persona) | **STUBBED** (agnostic) | n/a |
| Archetype dead config (`convictionMods`/`regimePreferences`/`sectorConcentrationCap`/`tradeFrequency`) | **STUBBED** (defined, read nowhere) | no |

### Command Center surfaces (Section F)

| Surface | Tag | Reaches trading? |
|---|---|---|
| Command Center shell (`CommandDashboard` / `CommandDashboardDesktop`) | **LIVE** | yes (Deploy → battle) |
| Desk-brief / "Today's Read" (Daily Regime Brief) | **LIVE** (live data) | partial |
| "Talk it over · Soon" button | **STUBBED** (no-op) | no |
| BaggerBomb battle window (`ManageStation` + Deploy state → `AgentBattleScreen`) | **LIVE** | yes |
| Evolution feed (`EvolutionPreviewCard` + `AgentRecordSheet`) | **LIVE** | no |
| EQUIP slots (archetype + watchlist) | **LIVE** | **yes** |
| Chat plumbing (`api/agent/chat.js` + `AgentChat.jsx` + `voiceLayerPrompt.js`) | **LIVE** (battle-scoped) | partial |

---

## 3. Per-section findings

### The trading-path spine (referenced throughout)

The launch trading loop has two LLM calls, and most "does it reach trading?" answers turn on whether a field reaches one of them:

1. **Deploy / draft (Sonnet + Haiku portfolio build)** — `api/agent/decide.js`. Reads the **live** agent doc, projects rules, builds the Sonnet strategy prompt (`agentPromptAssembly.js`) and a Haiku portfolio prompt.
2. **Intraday eval (Haiku trade-decision, every 15 min)** — cron `api/cron/agent-evaluate.js` calls `buildAgentIdentityBlock(battle)` (`agentEvalPromptAssembly.js`) and `buildEvalSystemPrompt(...)`, model `claude-haiku-4-5-20251001` (`agent-evaluate.js:1519-1536`), tool `submit_trade_decision`. This prompt reads the **frozen** `battle.agentContext`, snapshotted at battle creation by `createAgentBattle` (`agentBattleService.js`).

Cron cadence (`vercel.json`): `agent-evaluate` `*/15 13–21 * * 1-5`; `process-pending-reflections` `*/15 13–0 * * *` (`:145-148`); `agent-batch-review` `25 20,21 * * 1-5` (`:153-156`); `compute-daily-regime-brief` `30 12 * * 1-5` (`:162-163`); `agent-daily-scores` `45 1 * * 2-6`.

---

### Section A — Loadout & equip surface

**Agent-doc loadout fields that exist and are written:** `archetype`, `equippedWatchlistId` / `equippedWatchlistName`, `equippedTraits[]`, `equippedBundleIds[]`. There is **no** `equippedRules` field.

- **Archetype — LIVE / reaches trading: yes.** Written at creation (validated in `api/agent/create-profile.js:182-184`) and changed (battle-locked) by `api/agent/change-archetype.js:84-85` (`tx.update(agentRef, { archetype, updatedAt })`, lock at `:77`). Read on the deploy path at `api/agent/decide.js:242-244` (`computeArchetypeRankings(stockUniverse, archetype)`, `ARCHETYPE_TEMPERATURES[archetype]`) and interpolated into the eval system prompt (`agentEvalPromptAssembly.js:40` — `Your archetype is ${archetype}`). See Section E for depth.

- **Watchlist — LIVE / reaches trading: yes.** Written by `api/agent/equip-watchlist.js:100-105` (transactional), cleared by `unequip-watchlist.js`, born-equippable at creation (`AgentCreationFlow.jsx:348-353`). Read at deploy (`decide.js:254-262`), tickers + thesis folded into the Sonnet strategy user prompt (`decide.js:295-304`), snapshot frozen into the battle (`decide.js:695`).

- **Traits (DATA path) — LIVE / reaches trading: yes.** `agent.equippedTraits` is **auto-seeded at every agent creation**: `AgentCreationFlow.jsx:383` → `seedDefaultTraits(agentId, archetype)` → writes `equippedTraits` + one trait-rule doc per trait (`seedDefaultTraits.js:62-79`). The seeder header states the chain explicitly (`seedDefaultTraits.js:13-18`): *"defaults go live at DEPLOY … decide.js re-projects agent.activeRules … selecting trait rules by traitId ∈ equippedTraits."* Confirmed live at `decide.js:182` (`projectActiveRules(agent.equippedTraits, ...)`) → `decide.js:201` (`agent.activeRules = activeRulesForDeploy`) → consumed by Sonnet prompt (`agentPromptAssembly.js:75-91`) **and** Haiku eval prompt (`agentEvalPromptAssembly.js:519-538`).

- **Traits (equip UI slot) — PARTIAL / n/a.** The user-facing trait slot renders only behind `TRAIT_SLOT_ENABLED`, which defaults **false** (`featureFlags.js:97`; gate at `src/utils/equipSlots.js:24-26`; benches at `EquipBench.jsx:4-6`, `EquipStation.jsx:110`). So at launch the bench shows **2 slots only: Archetype · Watchlist**. The flag's own comment (`featureFlags.js:84-97`) is decisive: *"Surface-only: equippedTraits seeding, trait persistence, and the projectActiveRules projection are untouched — agents keep their seeded traits invisibly and battle behavior is unchanged."*

- **Rules / rule-bundles — PARTIAL.** The projection pipeline is LIVE (Section B), but: (a) the bench rule-bundle picker is *"retained but dormant"* — no slot opens it (`EquipBench.jsx:93`; `getEquipSlots` yields only archetype/watchlist/(traits)); (b) `equippedBundleIds` initializes to `[]` at creation (`AgentCreationFlow.jsx:347`), so a launch agent has **no manual/StarterKit bundle rules** unless the user authors them in the Forge. `equippedBundleIds` is a real field written by `forgeService.equipBundle` (`forgeService.js:541`) and snapshotted into the battle (`agentBattleService.js:156`), but the eval prompt renders `ctx.activeRules`, **not** the raw id array (`agentEvalPromptAssembly.js:519`).

- **`equippedRules` field — ABSENT.** No agent-doc field by that name exists. The only `equippedRules` identifiers are local UI count variables (e.g. `src/components/Season/PitStopChanges.jsx:93`, `const equippedRules = useMemo(...)`).

**Verdict (A):** Three loadout categories reach trading at launch — **Archetype, Watchlist, and (auto-seeded) Traits** — not two. The user can only *equip* archetype + watchlist; traits ride along invisibly as seeded defaults. Manual rule-bundles are wired but unpopulated/dormant at launch.

*Equip UI surfaces (real, not hinted):* `EquipSheet.jsx` (watchlist), `ArchetypePicker.jsx` (archetype), `RuleBundlePicker.jsx` (rules, dormant), `TraitsSheet.jsx` (traits, behind flag). The `EquippedWatchlistCard` is **archived** (`EquippedWatchlistCard.ARCHIVED.jsx`); the live surface is the benches.

---

### Section B — Rules system

**Does an equipped Forge rule reach a BaggerBomb agent-battle Haiku prompt today? YES.** The full live chain (no off-by-default flag breaks it):

```
agents/{id}/rules + bundles  (Firestore)
  → projectActiveRules(equippedTraits, ruleDocs, bundles)   decide.js:182
  → agent.activeRules = activeRulesForDeploy                decide.js:201
  → createAgentBattle freezes agentContext.activeRules       agentBattleService.js:155
  → buildAgentIdentityBlock reads ctx.activeRules            agentEvalPromptAssembly.js:519
  → rendered as C#/S# CONSTRAINTS + STRATEGY PREFERENCES     agentEvalPromptAssembly.js:524-538
  → sent as Haiku eval user message                          agent-evaluate.js:1525 (model claude-haiku-4-5)
```

- **Definitions:** `forgeKnowledgeBase.js` defines `FORGE_RULE_TEMPLATES` — **143 templates** across **13 categories** (`forgeKnowledgeBase.js:5-19`, `:30`). It is a **static client authoring library** (`:1-3`, "Zero Firestore reads — bundled with Vite"). Several categories are `mode: 'season'` (entry_criteria/exit_stops/rebalancing/season_state, `:15-18`) and thus not BaggerBomb (clash) rules. **Important:** `projectActiveRules` does **not** read this file — it reads *instantiated* Firestore rule docs. The "143" is the equip-time ceiling, not the per-agent reachable count.

- **Projection layer:** `projectActiveRules(equippedTraits, ruleDocs, bundles)` (`projectActiveRules.js:66`). Selects (i) trait rules whose `traitId ∈ equippedTraits` (deduped newest by `(traitId, sourceRef)`, `:96-106`) plus (ii) non-trait rules whose id is in a **non-archived** bundle (`:76-81`, `:109-111`). Emits items `{ruleId, text, textTemplate, params, paramValues, category, bundleName, hardness}` (`:41-58`). Hard/soft is resolved once here; `HARD_CATEGORIES = {risk, allocation}` (`ruleHardness.js:23`) → those become CONSTRAINTS, the rest STRATEGY PREFERENCES.

- **Injection is executed in production**, not flag-gated. `decide.js:176-182` reads rules+bundles fresh each deploy and projects; `:201` assigns to `agent.activeRules`. The Rule Conflict Reconciler is gated by `CONFLICT_RECONCILER_INJECT_ENABLED` (default **false**, `featureFlags.js:247`), but **inject-off returns the projected rules untouched** (`decide.js:189-201`) — the flag governs conflict *resolution*, never whether rules reach the prompt. Reconciler error also fails open to raw projected rules (`decide.js:196-201`).

- **Count reachable at launch:** data-dependent (0..N). Trait-rules are **always present** (seeded defaults); manual/StarterKit bundle-rules are present **only if the user authored a bundle** (none by default — `equippedBundleIds: []`).

**Verdict (B):** The rules **pipeline** is **LIVE / reaches trading: yes**. The launch-relevant qualifier is *what populates it*: every launch agent gets its seeded archetype trait-rules; user-authored bundle rules are reachable but require Forge authoring (the equip-bench affordance is dormant).

*New files worth adding to the map (not in hints):* `api/_utils/ruleHardness.js` (hard/soft resolver), `api/cron/agent-evaluate.js` (the actual Haiku-injection site, `:1525`), `api/_utils/agentBattleService.js` (the freeze choke point, `:155`).

---

### Section C — Traits system

- **Trait registry — LIVE.** `TRAIT_LIBRARY` (`src/data/traitLibrary.js:459-468`) composes instinct/strategy/discipline traits; each carries `ruleIds` + `strengthProfiles` keyed `ruleId → paramOverrides` at three levels (subtle/moderate/dominant) (`traitLibrary.js:27-43`). `ARCHETYPE_DEFAULT_TRAITS` (`traitLibrary.js:483`) maps each archetype CODE-ID → its default traits (the seed source).

- **Strength → params baking — LIVE.** `expandTraitToRuleSpecs` writes the per-strength `paramOverrides` into each rule doc's `paramValues` and interpolates text from them (`traitEquip.js:57-71`). `buildSeedPlan` produces `{ruleSpecs, equippedTraits}` (`traitEquip.js:102-134`). `seedDefaultTraits` persists both at creation (`seedDefaultTraits.js:50,77`; invoked `AgentCreationFlow.jsx:383`). Hand-equip is also real (`useTraits.js:168 equipTrait`).

- **Trait STRENGTH reaches Haiku — LIVE / yes.** Same projection chain as rules; the eval prompt's `resolveRuleText` re-interpolates `textTemplate` with `paramValues` (`agentEvalPromptAssembly.js:585-604`), so the strength-baked numeric thresholds are rendered into the constraint/strategy text Haiku sees. Not behind any off-by-default flag.

- **Trait IDENTITY (trait name / `identityStatement`) reaches Haiku — ABSENT / no.** Projection **drops `traitId`**: `toActiveRuleItem` returns no trait-identity field (`projectActiveRules.js:41-58`). A whole-file grep of `agentEvalPromptAssembly.js` for `traitId|trait-|identityStatement|TRAIT_BY_ID|dnaGroup` returns **zero matches**. Haiku sees the strength-tuned rule *text* only, never which trait produced it.

**Verdict (C):** **LIVE** for launch on the strength axis (trait strength reaches Haiku as numeric thresholds); **ABSENT** on the identity axis (trait names never reach the model). Traits are **not** schema-only on `main`.

---

### Section D — Learning loop (most important section)

**Does a completed BaggerBomb battle → lesson → `consolidatedInsight` → Haiku run end-to-end in production today? YES — across battles (not within one).** Each link traced:

- **Reflection — LIVE / reaches trading: partial.** `reflect.js` (`generateReflection`) writes `agent.memory[]` as a rolling 5-game window (`reflect.js:200-224`) and a `gameDesignFeedback` collection doc (`:279`). It is queue-drained: `completeBattle` sets `pendingReflection: true` on normal completed battles (`agent-evaluate.js:2786-2792`, `:2860-2867`); the cron `process-pending-reflections.js:44-94` queries `status='completed' AND pendingReflection=true`, **awaits** `generateReflection`, and clears the flag only on success (retry-safe). On Sonnet failure it still writes a fallback memory entry so the queue doesn't hot-loop (`reflect.js:68-80`). `memory[]` reaches the **Sonnet deploy prompt** (`agentPromptAssembly.js:70-71`), **not** the in-battle Haiku eval — hence *partial*.

- **Review — LIVE / reaches trading: no.** `agent-batch-review.js` writes per-day `battle.dailyReviews[]` (`:216-224`) and, via the Gemma auto-debrief, `agent.lessons[]` + `agent.forgeSuggestions[]` (`:339-344`, each `consumed:false`/`status:'pending'`). Runs `25 20,21 * * 1-5` (`vercel.json:153-156`). `lessons[]` is the raw material consolidation absorbs; the review itself does not feed the trading prompt.

- **Consolidation — LIVE / reaches trading: partial.** The **5-game gate fires in `reflect.js`** (`gamesPlayed % 5 === 0` → `await consolidateAgentEvolution(...)`, `reflect.js:127-145`) — now **awaited inside the cron tick**, not fire-and-forget. `applyConsolidation` does one atomic write of `disciplines`, **regenerates `consolidatedInsight`**, bumps `evolutionCycle`, and appends a typed event to `evolutionTimeline` (`agentConsolidationApply.js:265-273`, event built `:234-252`). It is the **only writer of `agent.disciplines`** (`:1-3`), split selection[]/execution[] (`:51-79`). Absorbed lessons are marked `consumed:true`, not deleted (`:254-263`).

- **Payoff read — LIVE / reaches trading: yes (CONFIRMED, not assumed).** Both trading prompts read `consolidatedInsight`:
  - In-battle Haiku: `buildAgentIdentityBlock` pushes `YOUR STRATEGIC WISDOM …\n${ctx.consolidatedInsight}` (`agentEvalPromptAssembly.js:511-513`, within `:482-516`), and that block is the live Haiku user message (`agent-evaluate.js:1519-1536`).
  - Deploy-time Sonnet: `buildStrategyUserPrompt` pushes `STRATEGIC WISDOM (from N evolution cycles)\n${agent.consolidatedInsight}` (`agentPromptAssembly.js:58-62`), called with the freshly-read live agent doc (`decide.js:295-296`).
  - **`disciplines[]` reaches the trading decision NOWHERE** — it is read only by the *next* consolidation prompt (`agentConsolidationPrompt.js`) and is absent from `voiceLayerPrompt.js`, `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`, `decide.js`.
  - **Freeze nuance:** Haiku reads the **frozen** `battle.agentContext.consolidatedInsight`, snapshotted at battle creation (`agentBattleService.js:172`). So a consolidation written mid- or post-battle affects only the **next** deployed battle — the loop closes *across* battles, never within one.

- **`directives[]` (learning channel) — STUBBED / deprecated.** Nothing in the learning loop writes it; a one-time migration empties it (`api/scripts/migrate-directives.js:86`, execute-gated); the Voice Layer prompt is explicitly told *"NEVER write to agent.directives[]. That channel is deprecated."* (`voiceLayerPrompt.js:350`). Live accumulated wisdom comes from `consolidatedInsight` + the rolling `memory[]` window (`agentPromptAssembly.js:59-71`). The archived `AgentEvolutionTab.ARCHIVED.jsx` / `PlaybookPanel.ARCHIVED.jsx` still reference the dead field, consistent with deprecation.
  - **Do not conflate:** a *separate, live* **user-directive** concept survives — per-battle instructions the user locks in via chat (`addDirective` `src/services/agentService.js:161-181`; `battle.agentContext.directives` / `battle.directive`). These DO reach the eval prompt (the "override user directives" P&L language at `agentEvalPromptAssembly.js:201,422`, and the `battle.directive` read referenced at `:928`). This is *tactical user input*, not the deprecated *learning* artifact.

**Verdict (D):** **LIVE end-to-end, across battles.** Reflection (queue intact) → Review (`lessons[]`) → Consolidation (5-game gate → `consolidatedInsight`) → both trading prompts read `consolidatedInsight`. The only "breaks" relative to a naive reading: (1) the loop is cross-battle because the insight is frozen at battle creation; (2) `disciplines[]` and the learning-`directives[]` channel do **not** reach trading; (3) the "lesson" link runs through **Review/chat** (`agent.lessons[]`), not Reflection (which writes `memory[].lesson`, a different field).

---

### Section E — Archetype system (the launch differentiator)

**Six archetypes** in `agentArchetypeConfig.js:26-204` (code-id → label): `momentum_chaser`→Trend Follower, `analyst`→Fundamental Investor, `diversifier`→Diversifier, `contrarian`→Contrarian, `degen`→Speculator, `guardian`→Capital Preserver.

**Archetype is a REAL mechanical lever on trading — through two independent numeric levers — but NOT through the Haiku prompt body, and NOT through voice.**

1. **Mid-battle deterministic risk knobs (`hftConfig`) — LIVE / yes, bypassing Haiku.** Each archetype carries a differentiated `hftConfig` (`forcedRotation`, `hurdleFloor`, `swapWindow`). `agent-evaluate.js:980-989` resolves it once per battle (`getArchetypeConfig(ctx.archetype)` + `resolveHftConfig`) and passes it into `evaluateRisk` per position (`:1035-1042`). Knobs actually fire:
   - **Knob A — forced rotation** → deterministic `SWAP_OUT` (`agentRiskManager.js:154-166`).
   - **Knob B — hurdle floor** → per-archetype `atrMultiplier` veto on the replacement candidate (`agentRiskManager.js:315-322`; cron `:1112-1118`).
   - **Knob C — swap-window cap** → per-archetype circuit breaker (`agent-evaluate.js:1063-1083`).
   - Differentiation is genuine: degen `forcedRotation.pctThreshold 0.001` / `swapWindow cap 12` / hurdle `0.2` vs guardian `forcedRotation: disabled` / `swapWindow cap 2, window 120m` / hurdle `0.5` (`agentArchetypeConfig.js:151-162,180-194`). *Caveat from the file header (`:17-20`): these values are "launch-seed and ILLUSTRATIVE"; Phase 8 behavioral calibration is post-merge — the wire is real, the tuning may not be.*

2. **Draft-time scoring (`archetypeScoring.js`) — LIVE / yes.** `decide.js:242-244,294,309` uses `computeArchetypeRankings` (stock ranking via `ARCHETYPE_WEIGHTS`), `ARCHETYPE_TEMPERATURES[archetype]` (actual LLM sampling temp, `:309 temperature: temps.sonnet`), and injects `ARCHETYPE_CONSTRAINTS[archetype]` verbatim into the Sonnet strategy system prompt (`agentPromptAssembly.js:5,13-14`). Weights/temps/constraints are strongly differentiated (e.g. degen temp 0.9 / atrPercentile weight 0.60 vs analyst temp 0.2 / fundamentalScore 0.40; contrarian must include ≥5 bottom-3-sector stocks) (`archetypeScoring.js:14-93`).

3. **Haiku eval prompt — identity string only.** The eval system prompt embeds `Your archetype is ${archetype}` with **no per-archetype rule body** (`agentEvalPromptAssembly.js:40,263`). Archetype's mid-battle *behavioral* effect rides the deterministic `hftConfig` outside the prompt, not Haiku's reasoning.

4. **Voice Layer — STUBBED / archetype-agnostic.** `voiceLayerPrompt.js` imports only `getArchetypeLabel` (the display string, `:14`), never `getArchetypeConfig`. Every phase builder uses the **identical** identity sentence with only the label noun swapped (`:2490,2551,2611,2779,2981,3208,3434`); there is **no conditional branch on `agent.archetype`** anywhere. A degen and a guardian get byte-identical voice prompts apart from the archetype noun and agent name. (The other archetype reference is a screener *sort key* `arch_scores.<key>`, `:2184,2215` — not a persona register.)

5. **DEAD config fields — STUBBED.** `convictionMods`, `regimePreferences`, `sectorConcentrationCap`, `tradeFrequency`, `defaultConfig` in `agentArchetypeConfig.js` are defined but **read by no production code** — a repo-wide grep finds these field names **only in `agentArchetypeConfig.js` itself**. (The `favoredStrategies` consumption in `agentRegimeClassifier.js:135-148` reads the **preset** config from `agentPresetConfig.js`, not the archetype config.)

**Verdict (E):** "Archetypes trade differently" is **REAL** — via two live numeric levers (mid-battle `hftConfig` risk physics + draft-time scoring/temperature/constraints). "Archetypes talk differently" is **aspirational** — voice is archetype-agnostic today (only the label noun changes). Differentiation is somewhat uneven across the mid-battle knobs: `analyst`/`diversifier`/`contrarian` share near-identical `hftConfig` baselines (forcedRotation `0.003` / cap `4`) and differ mainly in draft weights; `degen`, `guardian`, `momentum_chaser` are the most structurally distinct. The launch-seed `hftConfig` values are explicitly flagged illustrative/uncalibrated.

*In-flight:* `origin/claude/differentiate-archetype-portfolios-3wbxM`'s substantive commit (`204c70a6`, scoring/temps/constraints) appears **already merged** (`archetypeScoring.js` is on the audited tree); its tip commit is a UI fix. `origin/claude/archetype-picker-reseed` adds the archetype-change reseed dialog. Founder may decide whether either deepens archetypes further.

---

### Section F — Command Center components

- **Shell — LIVE / yes.** Mobile `CommandDashboard.jsx` (rendered when `COMMAND_DASHBOARD_ENABLED`, `App.jsx:8500`; flag default **true**, `featureFlags.js:22`), desktop `CommandDashboardDesktop` (`COMMAND_DASHBOARD_DESKTOP_ENABLED` default **true**, `featureFlags.js:33`). The five-stage rail is literal: `STAGES = [read, equip, deploy, manage, review]` (`CommandDashboard.jsx:55-61`), footer "Read → Equip → Deploy → Manage → Review" (`:361`). Deploy calls `deployAgent(agent.id, onCreateAgentBattle)` (`:135`), wiring the loop into the real `decide.js` battle path.

- **Desk-brief / "Today's Read" — LIVE data / partial.** Content comes from `useDailyRegimeBrief()` (`CommandDashboard.jsx:111`, rendered `:253-279`), which reads the **live** Firestore doc `indexIntelligence/dailyRegimeBrief` (`useDailyRegimeBrief.js:38-39`) — **not** placeholder/hardcoded. That doc is written daily by a real Sonnet cron `compute-daily-regime-brief.js` (forced Tool Use, `claude-sonnet-4-6`, `briefRef.set(...)` `:204-205`; cron `30 12 * * 1-5`). The box itself is **display-only**; the same DRB doc *is* consumed server-side in the agent context (`api/agent/chat.js:231`), so the underlying data — not this UI box — touches the decision/voice path. Absent doc → honest empty-state string (`CommandDashboard.jsx:259-263`).

- **"Talk it over · Soon" — STUBBED / no.** A no-op coming-soon button on **both** mobile (`CommandDashboard.jsx:302-317`, `cursor:'default'`, no `onClick`, "Soon" badge; header note `:14-15` "the Voice Layer is deferred") and desktop (`ReadColumn.jsx:131-147`). It is **not** wired to any chat surface, though a live one exists it could attach to (see chat plumbing below).

- **BaggerBomb battle window — LIVE / yes.** In the Command Center the live battle surfaces as (a) the Deploy button flipping to "Battle in progress" when `isLive` (`CommandDashboard.jsx:299`; `isLive` from `activeAgentBattles` filtered to `status==='active'`, `:119-121`) and (b) the **04 MANAGE** pulse-card `ManageStation.jsx` ("Battle live", time left, "{agent} is trading", trade count, `GainLossBadge`, `:53,64-68`). Tapping → `handleOpenAgentBattle` builds a `type:'baggerbomb'` battle object → `AgentBattleScreen` (`App.jsx:6568-6575`). **Correction to hint:** the in-progress card is **`ManageStation.jsx`**, not `GameTapeView.jsx`.

- **Evolution feed — LIVE / no.** The archived `AgentEvolutionTab.ARCHIVED.jsx` was **replaced** by `EvolutionPreviewCard.jsx` (latest 3 timeline entries, mounted after 05 Review, `CommandDashboard.jsx:354-357`; `EvolutionPreviewCard.jsx:22`) **plus** the full "Evolution timeline" inside `AgentRecordSheet.jsx:189,290`. Both render from the shared `buildEvolutionTimeline(agent)` (`src/utils/evolutionTimeline.js:4-6`, explicitly ported from the archived hub). It is a display/record surface fed by real writers (creation, consolidation cycles, lessons, scored games, Forge deploys, `evolutionTimeline.js:8-11`) — it does not itself feed trading.

- **EQUIP slots — LIVE / yes.** `EquipStation.jsx` renders `getEquipSlots(agent)` (`:110`) → Archetype slot from live `agent.archetype` (`:159-160`), Watchlist slot from live `agent.equippedWatchlistId` resolved against committed watchlists (`:132,150-153`). Equip/unequip go through real `agentService.equipWatchlist`/`unequipWatchlist` (`:170-171`); bench is battle-locked off `agent.activeBattleId` (`:108`). Traits slot off (`TRAIT_SLOT_ENABLED=false`) → 2 slots, consistent with Section A. These are the same fields that feed the decision/eval prompt.

- **Chat plumbing usable for a Vision discussion surface — LIVE / partial, battle-scoped.** A complete live stack exists: endpoint `api/agent/chat.js` (auth-gated handler `:130,142`; Voice Layer prompt `buildVoiceLayerPrompt` `:4-5`; Gemma via `callGemmaVoice`; conversation history rebuilt from prior exchanges `:256-270`), UI `AgentChat.jsx` (posts to `/api/agent/chat` `:578`, mounted in `AgentBattleScreen.jsx:998`), and a write of `battle.directive` on lock-in that the eval prompt reads (`agentEvalPromptAssembly.js:928`). **Readiness: HIGH but battle-scoped** — the endpoint hard-requires `agentId` **and** `battleId` (`chat.js:146,149-150`), so a pre-deploy "Talk it over the read" surface (no battle yet) would need either a battle-less mode or a new endpoint. The chat voice path is **Gemma**, while the desk-brief is **Sonnet** — two different model paths.

**Feature flags governing these surfaces:** `COMMAND_DASHBOARD_ENABLED=true`, `COMMAND_DASHBOARD_DESKTOP_ENABLED=true`, `TRAIT_SLOT_ENABLED=false`, `FORGE_HARDSOFT_AUTHORING_ENABLED=false`, `CONFLICT_RECONCILER_DETECT_ENABLED=false`, `CONFLICT_RECONCILER_INJECT_ENABLED=false` (all in `featureFlags.js`).

---

## 4. Corrections (where this prompt's prior assumptions were wrong)

1. **"Archetype + watchlist are the only loadout categories wired into agent trading today." — REFUTED.** **Traits also reach trading** at launch. `equippedTraits` is auto-seeded at every agent creation (`AgentCreationFlow.jsx:383` → `seedDefaultTraits.js:62-79`), projected at deploy (`decide.js:182`), frozen into the battle (`agentBattleService.js:155`), and rendered into **both** the Sonnet strategy prompt (`agentPromptAssembly.js:75-91`) and the Haiku eval prompt (`agentEvalPromptAssembly.js:519-538`) as CONSTRAINTS/STRATEGY PREFERENCES. The prompt conflated the (flag-off) trait **equip UI slot** with the (live) trait **data path**.

2. **"Rules and traits are believed to be not-in-place." — REFUTED at the mechanism level.** The entire projection → prompt machinery is **LIVE and unfenced**. What is genuinely "not in place" is narrower: the **trait equip slot** (`TRAIT_SLOT_ENABLED=false`) and the **rule-bundle equip bench affordance** (`RuleBundlePicker` "retained but dormant", `EquipBench.jsx:93`), plus the fact that a launch agent has **no default rule bundle** (`equippedBundleIds: []`, `AgentCreationFlow.jsx:347`). So *user-authored* rules require Forge authoring, but *seeded trait-rules* flow to trading on day one.

3. **"consolidatedInsight is read by Haiku" — CONFIRMED (the prompt asked to verify, not assume).** Read at `agentEvalPromptAssembly.js:511-513` (Haiku eval) and `agentPromptAssembly.js:58-62` (Sonnet deploy). **Refinement:** Haiku reads the **frozen** `battle.agentContext.consolidatedInsight` (`agentBattleService.js:172`), so the learning loop closes **across battles**, not within one. And **`disciplines[]` is read by nothing on the trading/voice path** — only `consolidatedInsight` is the payoff field.

4. **"hftConfig* NOT FOUND." — CORRECTED.** `hftConfig` is **not a standalone file**; it is an inline per-archetype config block inside `api/_utils/agentArchetypeConfig.js` (`:35-47` and every archetype), and it is **actively consumed on the trading path** (`agent-evaluate.js:980-989`, `agentRiskManager.js:154,315`; cron `:1063-1083,1112-1118`). The earlier "not found" note referred only to a file named `hftConfig*`.

5. **`agent.directives[]` is not simply "deprecated/empty" in one sense.** The **learning-directives** channel is dead (migration empties it, voice layer forbidden to write it) — correct. But a **separate, live user-directive** concept survives (chat lock-in → `battle.directive` / `agentContext.directives`, `agentService.js:161-181`) and **that one does reach the eval prompt**. The two must not be conflated.

6. **Archetype differentiation is real but partially dead.** Beyond the live levers (`hftConfig` + `archetypeScoring`), a large block of `agentArchetypeConfig.js` (`convictionMods`, `regimePreferences`, `sectorConcentrationCap`, `tradeFrequency`, `defaultConfig`) is **defined but read nowhere in production**. And **voice is archetype-agnostic** — the "archetypes talk differently" half of the promise is not yet built.

7. **Hinted Command Center component names were partly stale:** the in-progress battle card is `ManageStation.jsx` (not `GameTapeView.jsx`); the Evolution feed is `EvolutionPreviewCard.jsx` + `AgentRecordSheet.jsx` (not a single replacement for the archived `AgentEvolutionTab`); the watchlist-equip card `EquippedWatchlistCard.jsx` is archived (live surface = the benches).

---

## 5. Open uncertainties (could not be resolved read-only)

1. **Per-agent reachable rule count at launch.** Whether a given deployed agent has non-empty trait-rules / bundle-rules depends on Firestore state (its seeded `equippedTraits` and any user-authored bundles). Code confirms the *pipeline*; the live *population* (and the real distribution of non-`analyst` archetypes among deployed agents) requires inspecting the production `agents` collection / Gate-1 logs (`agent-evaluate.js:994`). *One edge:* `seedDefaultTraits` returns `{seeded:false}` for an archetype with no `ARCHETYPE_DEFAULT_TRAITS` entry (`seedDefaultTraits.js:44-48`); all six configured archetypes appear to have defaults, but this was not enumerated exhaustively.

2. **`gamesPlayed` ordering vs the 5-game consolidation gate.** Whether `stats.gamesPlayed` is incremented **before** `consolidateAgentEvolution` re-reads the agent doc (`reflect.js:127-145`) was not traced to the exact `completeBattle` write site; if the stats increment lags, the `%5` gate could be off by one game. Resolving requires tracing where `gamesPlayed` is written in `completeBattle`.

3. **Mid-battle freshness of `battle.agentContext.consolidatedInsight` / `activeRules`.** Static grep shows only the creation-time freeze (`agentBattleService.js:155,172`); a dynamic patch elsewhere cannot be fully excluded read-only. Confirming "never refreshed mid-battle" would need runtime tracing.

4. **`hftConfig` calibration status.** The file header (`agentArchetypeConfig.js:17-20`) flags the launch-seed knob values as "ILLUSTRATIVE", with Phase 8 (gates 8A/8B) calibration as post-merge work. The wire is live; whether the numeric values produce *meaningful behavioral separation* yet is not determinable from code.

5. **Whether `decide.js` watchlist tickers alter the candidate POOL vs only appear as prompt text.** The prompt-text path is confirmed (`buildStrategyUserPrompt`, `decide.js:295-304`); the candidate-pool fold via `watchlistEquip` helpers (`unionEquippedIntoHotBench`/`foldEquippedTickers`, imported `decide.js:32-38`) was not fully traced into the final tool input.

6. **Exact `chatExchanges` persistence path** (collection name / write site, lower half of `api/agent/chat.js` ~`:322-505`) was not line-cited; conversation read-back is confirmed (`:256-270`) and a durable `chatExchanges` write is referenced in `api/agent/chat.test.js:309`.

7. **In-flight branch contents** were intentionally not opened (no branch switching). Whether `claude/differentiate-archetype-portfolios-3wbxM` further activates the dead `agentArchetypeConfig.js` fields, or whether any command-center redesign branch wires "Talk it over", would be resolved by diffing those branches against the audited HEAD.

---

**END OF REPORT — hard STOP.** No recommendations, no implementation, no edits beyond this file.
