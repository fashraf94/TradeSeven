# Forge System — Discovery Audit Report

**Date:** 2026-05-25
**Auditor:** Claude Code
**Branch audited:** main @ `3b6554c39bf428b61918b7a2de0d91e61a07e973`
**Scope:** Read-only investigation, no code modifications.

---

## Executive Summary

1. **Rules DO shape Haiku's behavior, but only Haiku's.** `api/_utils/agentEvalPromptAssembly.js:283-323` injects active rules verbatim into Haiku's system prompt, split into `CONSTRAINTS (must obey)` for `risk`/`allocation` categories and `STRATEGY PREFERENCES (should follow)` for everything else. Haiku is instructed to populate `cited_forge_rules` and `overridden_forge_rules` (`agentEvalToolSchema.js:110-145`). **Voice Layer (Gemma) does NOT read rules at all** — anticipation, trade narration, and first-message prompts contain zero rule context. This is the single biggest cross-system inconsistency in the codebase.

2. **The rule corpus is real and validated, but heavily skewed.** 143 rules in `src/data/forgeKnowledgeBase.js` (3,798 lines), distributed across 13 categories. Largest categories: Technical (25), Mid-Battle (16), Fundamental (14). Smallest: Rebalancing (5), Season State (6). A handful of templates have visibly overlapping intent (e.g., three different RSI rules; three different VWAP-entry variants) but most overlap appears intentional — different nuances of similar setups distributed across archetypes.

3. **Workshop Chat is shipped and wired, not broken.** `src/components/Forge/WorkshopChat.jsx` (1,005 lines) and `api/forge/workshop-chat.js` (642 lines) are both fully implemented, tested, shadow-logged, and accessible from `ForgeLanding.jsx`. The founder's "no longer accessible from UI" report is a **visibility gate**, not a deletion: the "Talk to Agent" button only renders when `landingState === 'testing'` (`ForgeLanding.jsx:2212`), which requires at least one active Season experiment. Users with no experiments cannot see the entry point.

4. **Archetype identity is lost at the most common application path.** 12 active Trading Style Collections (`src/data/forgeCollections.js`, 1,120 lines) — swing-trader, day-trader, momentum-rider, defensive-fortress, trend-surfer, vwap-warrior, squeeze-hunter, oversold-sniper, volume-detective, rs-leader, triple-threat, baggerbomb-native — plus 9 legacy themed collections. When a user applies a collection from the Discover tab, only the rules flow through; **no `archetypeId`/`sourceCollection` field is written to the agent doc**. The deploy-from-Season-experiment path *does* preserve `deployedStrategy.sourceCollection`, but most users will never go through that path. This is the structural reason archetypes "have no identity" downstream.

5. **Three behavioral concerns are contested between systems with no precedence rule.** Entry timing (Haiku 70% conviction floor vs. Voice Layer user-confirmation flow vs. Forge entry rules), stop-loss (hardcoded ATR thresholds in the Haiku prompt vs. Forge `risk` rules vs. Survival Mode override vs. `agentGuardrails.js` deterministic enforcement), and risk tolerance (`agent.config.risk` exists but is never read by Haiku; dossier execution disciplines influence implicitly; market regime overrides). See Section E.1 matrix.

6. **Two important fields are orphans.** `agent.config.risk` (0–100 score, set at agent creation in `agentService.js:99`) is never read anywhere in the decision pipeline. `agent.equippedTraits` (DNA traits, persisted in Firestore via `useTraits.js:40-72`) is also never read by any backend code — grep for `traitId` across `api/*` returns zero hits. DNA traits are currently pure UI state with no downstream effect on behavior.

7. **Strategy Laboratory is operationally live but its feedback loop into Forge is one-way.** `api/cron/season-daily-evaluate.js` runs M-F at 4:30/5:30 PM ET, writes per-rule citation stats (`timesFollowed`, `timesBlocked`, `timesOverridden`) into `seasonEntries/{id}`, and rebuilds the leaderboard. But these measurements do **not** auto-update Forge rule tunings or surface back into rule UI — refinement is manual. The "Forge Score" and "BaggerBomb Fitness Score" described in `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` are specced but not implemented; the codebase currently uses `compositeScore` from `seasonLeaderboard.js` instead.

8. **Behavioral gaps are real but smaller than feared.** Of the founder's named gaps (trade frequency, profit cap, stop loss, risk mechanisms, sector focus), most have an owner in code — they're just owned by **hardcoded behaviors in the Haiku prompt** rather than by Forge rules. Trade frequency, profit-taking thresholds, and time-horizon are all hardcoded constants in `agentEvalPromptAssembly.js:32-91`. Sector focus is per-battle Vision scope (`visionTypes.js:196`); agent-level sector preference is deferred to Dossier Sprint 2. The systems exist; they're just not labelled, configurable, or aligned with Forge.

---

## Section A — Rule Definition and Storage

### A.1 Rule Schema

**Status:** ✅ Defined and validated at write-time.

**Canonical rule document** (Firestore: `agents/{agentId}/rules/{ruleId}`):

| Field | Type | Notes |
|---|---|---|
| `text` | string ≤1000 chars | Interpolated final rule text |
| `textTemplate` | string ≤500 chars, nullable | Original template with `{param}` placeholders |
| `params` | object, nullable | Parameter definitions inherited from forgeKnowledgeBase |
| `paramValues` | object ≤5 keys, nullable | User's overrides |
| `category` | enum (1 of 13) | See list below |
| `source` | enum (1 of 7) | `forge_discover`, `forge_custom`, `manual`, `agent_*` |
| `sourceRef` | string, nullable | Template ID from forgeKnowledgeBase |
| `visibility` | enum | `public` \| `private` |
| `status` | enum | `draft` \| `testing` \| `active` \| `proven` \| `queued` |
| `priority` | number | User-assignable |
| `traitId` | string, nullable | Link to DNA trait |
| `isRefined` | boolean | User manually edited |
| `isDeleted` | boolean | Soft delete |
| `bundleIds` | string[] | Reciprocal index to containing bundles |
| `createdAt`, `updatedAt` | timestamp | |

**Validation:** `src/services/forgeService.js:33-108` enforces all constraints at create/update time.

**13 categories** (defined in `src/data/forgeKnowledgeBase.js:5-19`):

| Category | Mode | Use |
|---|---|---|
| `technical` | both | Price action, indicators |
| `fundamental` | both | Financial metrics |
| `risk` | both | Constraint rules ✅ injected as CONSTRAINTS |
| `allocation` | both | Position sizing ✅ injected as CONSTRAINTS |
| `institutional` | both | Smart-money signals |
| `mid_battle` | clash-only | Swap timing |
| `game_state` | clash-only | Phase-aware logic |
| `threshold` | clash-only | Bonus optimization |
| `tier_strategy` | clash-only | Tier management |
| `entry_criteria` | season-only | Season entry filters |
| `exit_stops` | season-only | Season exits |
| `rebalancing` | season-only | Drift correction |
| `season_state` | season-only | Season position adaptation |

**Consistency:** ✅ The same 13 categories are referenced uniformly in `ForgeRuleCard.jsx:7-27`, `forgeService.js:17`, and `useForge.js:34-45`.

**Versioning:** ❌ No explicit version field. Backward compat is achieved by making `textTemplate` and `params` nullable — older rules without templates fall back to the static `text` field. Param key renames are reconciled by a mapping table in `CUSTOM_RULE_BUILDER_TECHNICAL_REFERENCE.md:154-170` (e.g., spec `rsiThreshold` → actual `threshold`).

### A.2 Rule Storage Locations

**Primary storage:** `agents/{agentId}/rules/{ruleId}` (Firestore subcollection)
- Create: `src/services/forgeService.js:121-147`
- Read: `src/services/forgeService.js:157-164`
- Update: `src/services/forgeService.js:172-233`
- Soft delete: `src/services/forgeService.js:234-242`

**Secondary index:** `agents/{agentId}/bundles/{bundleId}.ruleIds[]` + denormalized `ruleSnapshots[]`
- Add: `src/services/forgeService.js:300-320`
- Remove: `src/services/forgeService.js:322-335`
- Snapshot: `src/services/forgeService.js:351-370`

**Static template definitions:** `src/data/forgeKnowledgeBase.js` (3,798 lines) — `FORGE_RULE_TEMPLATES` array of 143 entries, bundled at build time.

**Static archetype/collection bundles:** `src/data/forgeCollections.js` (1,120 lines) — `TRADING_STYLE_COLLECTIONS` array (12 collections × 7–9 rules each, plus 9 legacy themed collections).

**Reference/educational:** `DKB_FORGE_RULES.md` — auto-extracted human-readable rules ref (~1,000 lines). Not imported into production code, but cross-referenced by `api/cron/season-pit-stop-manage.js:38` for validation registry.

**Canonical authority:** The static templates in `forgeKnowledgeBase.js` are the source of truth; Firestore rule docs reference back via `sourceRef`. Custom rules (no `sourceRef`) exist only in Firestore.

### A.3 Rule Corpus Inventory

**Total: 143 rules across 13 categories.**

| Category | Count | Notes |
|---|---|---|
| Technical | 25 | Largest; mixes legacy `tech-*`, `t-NN`, and `tv-NN` (TradingView) variants |
| Mid-Battle Trading | 16 | Clash-only swap timing/hurdle rules |
| Fundamental | 14 | `f-NN` (legacy) and `fund-*` (newer) coexist |
| Risk | 12 | `r-NN` and `risk-*` |
| Allocation | 11 | `a-NN`, `alloc-*` |
| Game State | 11 | `gs-NN` clash phase rules |
| Tier Strategy | 10 | `ts-NN` |
| Institutional | 10 | `i-NN` |
| Threshold | 8 | `th-NN` |
| Entry Criteria | 8 | `se-NN` season |
| Exit & Stops | 7 | `sx-NN` season |
| Season State | 6 | `ss-NN` season |
| Rebalancing | 5 | `sr-NN` season |

**Visible duplicate-intent examples** (not exhaustive):
- RSI: `tech-rsi-oversold` (buy <30), `tech-rsi-overbought` (avoid >70), `tv-01` "RSI Momentum Zone" (50–70 power zone) — three overlapping treatments of the same indicator.
- VWAP entry: `t-09` "Buy the dip to fair value" (param `pct=0.3`) and `tv-04` "VWAP Reclaim Entry" (param `dev=0.3`) — same concept, different rule IDs, used in different style collections.
- Bollinger: `tech-bollinger-squeeze`, `tv-05` "Squeeze Direction Filter", `tv-06` "Bollinger Lower Band Entry" — different nuances, used in different collections.

**Sparse categories:** Rebalancing (5), Season State (6) — both narrow-scope season-mode features.

**Dense categories:** Technical (25) carries the largest legacy debt (three naming generations coexist: `tech-*`, `t-NN`, `tv-NN`).

**Naming pattern:** 13 distinct ID prefixes (`t-`, `tech-`, `tv-`, `f-`, `fund-`, `r-`, `risk-`, `a-`, `alloc-`, `i-`, `mb-`, `gs-`, `th-`, `ts-`, `se-`, `sx-`, `sr-`, `ss-`) — consistent within categories but reflects rule-authoring done in batches over multiple phases.

### A.4 Custom Rule Builder

**Status:** 🟠 Backend and basic UI exist; parameterization UI does not.

**Per `CUSTOM_RULE_BUILDER_TECHNICAL_REFERENCE.md`**, users were intended to author custom rules with parameters. In code:
- **Backend:** No dedicated endpoint. Uses generic `forgeService.createRule()` accepting `source: 'forge_custom'` or `source: 'manual'`.
- **UI:** `src/components/Forge/MyRulesTab.jsx:100-108` provides a manual rule creation form with just two fields: `text` (≤1000 chars) and `category` dropdown. Wired to `useForge.js:409-427` (`createManualRule`).
- **Custom rule shape:** Text-only — `text` set, `textTemplate: null`, `params: null`, `paramValues: null`. **No parameterization** is currently authorable through the UI. The `RuleConfigDrawer.jsx` (which renders parameter sliders) only fires for Discover-tab template rules.

**Persistence:** Per-agent (under `agents/{agentId}/rules/`). No global shared library. User can set `visibility: 'public'` via `updateRule` but no UI exposes that toggle.

**Production usage:** 🟡 Unverified. Code paths are live; no observed traffic from the audit scope. Hypothesis: feature is shipped but unused.

---

## Section B — Rule Consumption in the Decision Pipeline

### B.1 Trading Brain (Haiku) Rule Reads

**Status:** ✅ Active. Haiku reads rules and is explicitly instructed to cite them.

**Injection point:** `api/_utils/agentEvalPromptAssembly.js:283-323`

```javascript
const activeRules = ctx.activeRules || [];
if (activeRules.length > 0) {
  const constraintCats = new Set(['risk', 'allocation']);
  const constraints = activeRules.filter(r => constraintCats.has(r.category));
  const strategies = activeRules.filter(r => !constraintCats.has(r.category));

  const ruleLines = [];
  if (constraints.length > 0) {
    const cLines = constraints.map((r, i) =>
      `C${i + 1}. ${resolveRuleText(r)} [${capitalize(r.category)}]`
    );
    ruleLines.push(`== CONSTRAINTS (must obey) ==\n${cLines.join('\n')}`);
  }
  if (strategies.length > 0) {
    const sLines = strategies.map((r, i) =>
      `S${i + 1}. ${resolveRuleText(r)} [${capitalize(r.category || 'general')}]`
    );
    ruleLines.push(`== STRATEGY PREFERENCES (should follow) ==\n${sLines.join('\n')}`);
  }
```

**Prompt block** (`api/_utils/agentEvalPromptAssembly.js:166-174`):
```
━━━ FORGE RULES ━━━
When FORGE RULES are present in your identity block, they represent user-configured rules
organized as CONSTRAINTS and STRATEGY PREFERENCES.
- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.
- STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may
  deviate with explanation.
When forge rules influence your decision, populate cited_forge_rules with the rule IDs and how
they influenced you (followed or blocked_trade). If you considered a rule but it did not apply,
use overridden_forge_rules with the appropriate reason. If Survival Mode forces you to break a
constraint, use overridden_forge_rules. Constraints always override strategy preferences.
```

**Tool schema** (`api/_utils/agentEvalToolSchema.js:110-145`): Haiku's structured output includes:
- `cited_forge_rules[]`: `{ ruleId, ruleText, influence: 'followed' | 'blocked_trade' }`
- `overridden_forge_rules[]`: `{ ruleId, reason: 'no_match' | 'conflict_with_constraint' | 'market_conditions' | 'insufficient_data' | 'higher_priority_opportunity' }`

**Data flow:**
```
agents/{id}.activeRules
  → battle.agentContext.activeRules  (frozen at battle creation, agentBattleService.js:119)
  → buildEvalSystemPrompt(ctx) in agentEvalPromptAssembly.js
  → injected verbatim into Haiku system prompt
  → Haiku populates cited_forge_rules / overridden_forge_rules in tool output
```

**Filtering:** Rules are partitioned by category (`risk`/`allocation` → constraints; rest → preferences). All active rules are read; no regime-based filtering. An `institutional` rule triggers a special data-lag warning (`agentEvalPromptAssembly.js:304-312`):

```
C_INST: INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F filings
is lagged up to 135 days. NEVER hold a position based solely on strong institutional
accumulation if VWAP or 5-min RSI shows a breakdown. Intraday technicals ALWAYS override stale
institutional signals.
```

**Concrete trace example:** A rule with `sourceRef: 'tech-rsi-oversold'` and `paramValues: { threshold: 35 }` →
- `resolveRuleText` (`agentEvalPromptAssembly.js:376`) interpolates → "Buy when RSI drops below 35"
- Sanitized for prompt injection (`agentEvalPromptAssembly.js:337-366`)
- Rendered as `S1. Buy when RSI drops below 35 [Technical]` inside the prompt
- Haiku may cite it in `cited_forge_rules: [{ ruleId: 'xyz', ruleText: '...', influence: 'followed' }]`

### B.2 Voice Layer Rule Reads

**Status:** ❌ Voice Layer does NOT read rules. This is the most important asymmetry in the system.

**Files audited:**
- `api/_utils/voiceLayerPrompt.js`
- `api/_utils/voiceLayerAnticipation.js`
- `api/_utils/voiceLayerTradeNarration.js`

**Finding:** Grep for `activeRules`, `forgeRule`, or `cited_forge_rules` across Voice Layer files: **zero results**. Voice Layer prompts contain agent identity, market context, battle state, archetype string, regime brief, and directive — but **never rules**.

**Closest indirect path:** `api/_utils/agentNewsContext.js:151-276` reads rules to enhance news prioritization for Haiku (not Gemma). Example (`agentNewsContext.js:210-217`):

```javascript
const matchingCategories = reporter.forgeRuleAffinity.filter(cat =>
  activeRules.some(r => r.category === cat)
);
if (matchingCategories.length > 0) {
  reporterContextLines.push(
    `- ${reporter.name} (${reporter.beat}) stories signal ${reporter.signalType.toUpperCase()}. ` +
    `Your ${matchingCategories.map(c => capitalize(c)).join(' and ')} rules are most relevant.`
  );
```

This produces metadata like "Alex (Stock Spotlight) stories signal VOLATILITY. Your technical rules are most relevant." — but this lives in Haiku's news block, not Gemma's prompt.

**Gemma sees instead:**
- `agent.archetype` (string) — read at `voiceLayerPrompt.js:2391, 2148, 2209, 2269, 2593, 2820, 3046`
- `consolidatedInsight` (dossier-derived string) — read at `voiceLayerPrompt.js:275`
- Vision state — read via `buildVisionStateBlock()`
- Market regime brief
- Battle state (portfolio, scores, anticipation candidates)

**Implication:** Gemma can contradict Forge rules in narration without realizing it. Example: a user with a `risk` rule "Never hold concentrated semi exposure" — Haiku sees the rule, Gemma does not. If Gemma proposes "We should double down on AVGO since semis are running," there is no rule-side check.

### B.3 Risk Manager / Pre-Trade Gates

**Status:** ✅ Active deterministic enforcement, but operates on a DIFFERENT data source than Forge rules.

**Three layers exist:**

1. **Risk Manager** (`api/_utils/agentRiskManager.js:30-86`) — System defaults, always active:
   - `EMERGENCY_SWAP` if `atrMultiplier <= -0.85x`
   - `SWAP_OUT` if below VWAP for 2+ ticks
   - `LOCK` near bonus threshold (within 0.2x ATR)
   - `TRAIL_STOP` above 1.5x ATR if price falls below 5m SMA20
   - `HOLD` default
   - **Not configurable. Not connected to Forge rules.**

2. **Guardrails** (`api/_utils/agentGuardrails.js:58-217`) — Post-Haiku deterministic override:
   - Stop-loss (hard): force exit if P&L ≤ −threshold%
   - Trailing stop (hard): force exit if drawdown from peak ≤ −threshold%
   - Max sector weight (hard): block swap if would exceed sector cap
   - Reads `battle.agentContext.deployedGuardrails` (frozen from `agent.deployedStrategy.guardrails`)
   - **Separate from Forge rules.** Stop-loss configured via "Deploy Strategy" UI, not "Forge Rules" UI.

3. **Survival Mode** (`agentEvalPromptAssembly.js:184-186`) — Haiku-level override:
   ```
   You have explicit permission to OVERRIDE user directives if live data shows a position has
   breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal.
   ```

**Guardrail enforcement** (`api/cron/agent-evaluate.js:967-1010`):
```javascript
const result = applyGuardrails({ haikuResult, guardrails: deployedGuardrails, ... });
// If guardrail forces a different decision, materialize it as a SWAP:
if (result.decision === 'SWAP') {
  haikuResult = { ...haikuResult, decision: 'SWAP', symbolOut, symbolIn,
                  rationale: `Guardrail override: ${overrideNote}`, ... };
  decision = 'SWAP';
}
```

**Forge rules vs. guardrails distinction:**
- Forge rules: Haiku-visible context. Haiku reasons over them and decides whether to follow.
- Guardrails: Deterministic. Override Haiku's decision after the fact.
- A user setting a "Cut at -5%" Forge rule and a "Stop-loss 5%" guardrail are storing the same intent in two unrelated places.

### B.4 Strategy Preset Application

**Status:** ✅ Rules persisted; archetype identity lost in the common path.

**UI flow:** `src/components/Forge/CollectionDetailSheet.jsx:523-535` ("Use This Playbook" button) → `ForgeScreen.jsx` handler → `forgeService.mergeCollectionIntoBundle(collection)` → Firestore.

**Written to agent doc:**
- `equippedBundleIds[]` — array of bundle IDs
- `activeRules[]` — array of rule objects (the rules that end up in Haiku's prompt)
- `deployedStrategy.sourceCollection` — **only set when deploying from a Season experiment**, not from manual Discover-tab application

**Rule object shape persisted** (per Section A.1):
```javascript
{
  id: 'rule_xyz',
  name: 'Stop Loss at 5%',
  category: 'risk',
  text: 'Exit any position down 5% from entry',
  textTemplate: 'Exit any position down {threshold}% from entry',
  params: { threshold: { default: 5, type: 'percent' } },
  paramValues: { threshold: 5 },
  active: true,
  deployedAt: '2026-05-25T...',
}
```

**Mix-and-match:** Bundle/collection application typically appends to existing rules. Archetype selection doesn't wipe prior config — rules are additive unless explicitly deleted via UI.

**Critical finding:** The archetype identity is **not preserved** in the most common application path. `deployedStrategy.sourceCollection` is set by `deployStrategyService.js:161` (Season experiment deploy) and by `season/create-entry.js:255, 263, 347` (Season entry creation) — but `mergeCollectionIntoBundle` from the Discover tab does not set it. See Section C.3 for full trace.

### B.5 Rule Activation State

**Status:** ✅ Active flag exists; per-rule param overrides supported.

**Agent doc shape:**
```javascript
agents: {
  activeRules: [
    { id, name, category, text, textTemplate, params, paramValues, active: true, ... },
    ...
  ],
  deployedStrategy: {
    guardrails: [
      { type: 'stopLoss', value: 5 },
      { type: 'trailingStop', value: 8 },
      { type: 'maxSectorWeight', value: 35 },
    ],
  },
  equippedBundleIds: [...],
}
```

**Activation:** Each rule has an `active` boolean. Param tuning stored in per-rule `paramValues` object (max 5 keys, enforced at `forgeService.js:31`).

**Frozen at battle start:** `agentBattleService.js:119` snapshots `agent.activeRules` into `battle.agentContext.activeRules`. Mid-battle changes to the agent doc do not affect the running battle (by design).

### B.6 The Critical Question — Do Rules Shape Behavior?

**Direct answer: Yes, partially. Three distinct mechanisms; uneven coverage.**

| Mechanism | Strength | Evidence |
|---|---|---|
| **Haiku reads rules as context** | Soft (advisory + override) | `agentEvalPromptAssembly.js:283-323` |
| **Haiku self-reports rule citations** | Logging only | `agentEvalToolSchema.js:110-145` |
| **Guardrails enforce deterministically** | Hard (forces swap) | `agentGuardrails.js:94-178`, `agent-evaluate.js:967-1010` |
| **Voice Layer reads rules** | ❌ Does not | grep returns zero hits in voiceLayer*.js |
| **Risk Manager (LOCK/VWAP)** | Hard but unrelated to Forge | `agentRiskManager.js:60-72` |

**Honest assessment for the founder:**

1. **At the Haiku decision layer, rules work as promised.** They appear in the prompt verbatim. Haiku is told constraints override preferences, and is told to cite which rules influenced it.

2. **Rules are NOT absolute.** Haiku may invoke Survival Mode and override constraints (`agentEvalPromptAssembly.js:184-186`). There's no kill-switch to disable Survival Mode.

3. **Guardrails ARE absolute, but they're not Forge rules.** Stop-loss and trailing-stop are deployed via a separate flow (`agent.deployedStrategy.guardrails`), not through Forge rule UI. A user editing a Forge "Cut at -5%" rule and editing a deployedStrategy stop-loss are operating on two unrelated systems.

4. **Voice Layer ignores rules entirely.** Gemma can narrate trade proposals that contradict the user's Forge rules without flagging them. This is the most significant integration gap.

5. **Rules are read pre-battle (at deploy time) but frozen post-battle-start.** Mid-battle rule edits don't propagate. This is reasonable for battle isolation but means rule tuning requires battle restart.

6. **Rules don't gate execution outside Haiku's loop.** There's no "this trade would violate rule R1, blocked" check in the swap execution path. If Haiku decides to swap despite a constraint, the swap goes through (modulo guardrails).

7. **Empirically, rules are being cited in production.** `cited_forge_rules` and `overridden_forge_rules` are part of Haiku's structured output and the shadow logger captures them (per Section G.1). The data exists; whether it's been analyzed for cite rate / override rate is unverified in this audit.

**Bottom line:** Forge rules are a real input to Haiku's reasoning and influence trade decisions through soft prompt-level guidance. They are NOT a deterministic gate, they do NOT reach Gemma, and they coexist (without coordination) with three other systems that also enforce trade constraints (Risk Manager, Guardrails, Survival Mode).

---

## Section C — Archetypes / Quick Starts

### C.1 Archetype Definitions

**Status:** ✅ 12 active + 9 legacy archetypes defined.

**Primary file:** `src/data/forgeCollections.js` (1,120 lines). Two distinct systems coexist.

**System 1: Trading Style Collections (Phase E, active)**

| Archetype | Lines | Difficulty | Rules |
|---|---|---|---|
| `swing-trader` | 12-93 | intermediate | 9 |
| `day-trader` | 95-176 | intermediate | 9 |
| `momentum-rider` | 178-259 | advanced | 9 |
| `defensive-fortress` | 261-342 | intermediate | 9 |
| `trend-surfer` | 348-435 | intermediate | 9 |
| `vwap-warrior` | 437-510 | intermediate | 7 |
| `squeeze-hunter` | 512-585 | intermediate | 7 |
| `oversold-sniper` | 587-660 | intermediate | 7 |
| `volume-detective` | 662-735 | beginner | 7 |
| `rs-leader` | 737-817 | beginner | 8 |
| `triple-threat` | 819-899 | advanced | 8 |
| `baggerbomb-native` | 901-988 | advanced | 9 |

Each Trading Style Collection includes:
- `id`, `title`, `subtitle`, `icon`, `accentColor`, `difficulty`, `tags`
- `isStyleCollection: true`
- `philosophy` — 200-300 word editorial narrative
- `conflicts[]` — incompatible archetype IDs
- `rules[]` — 7-9 entries, each with `ruleId`, `paramOverrides`, `rationale`, `priority`, `priorityLabel`
- 7 of 12 include `progressionHints` (unlock tiers)

**System 2: Legacy themed collections** (`src/data/forgeCollections.js:996-1119`)
- `defensive-playbook`, `momentum-hunter`, `value-investor`, `contrarian-edge`, `conviction-plays`, `battle-tactics`, `game-clock-plays`, `threshold-hunters`, `tier-master`
- Simpler shape: `title`, `subtitle`, `ruleIds[]` only. No philosophy, no param overrides, no priority tiers.
- Status: 🟠 Deprecated per comment ("Themed Collections (Original)") but still exported and selectable in `BundlePresetModal.jsx:11`.

### C.2 Trading Style Collections (file inventory)

**Files mentioned in project memory but NOT FOUND in repo:** ❌
- `TRADING_STYLE_COLLECTIONS_BATCH1.js`
- `TRADING_STYLE_COLLECTIONS_FINAL.js`
- `TRADINGVIEW_STRATEGY_COLLECTIONS_COMPLETE.js`

Search method: `find /home/user/TradeSeven -iname "*trading*style*"`, `*tradingview*`, `*collection*` — returned only `src/data/forgeCollections.js`. The files referenced in project memory appear to have been intermediate authoring artifacts that were consolidated into `forgeCollections.js` and then deleted, or were never committed.

**Files present and read by production:** ✅
- `src/data/forgeCollections.js` — imported by `BundlePresetModal.jsx:7`, `CollectionDetailSheet.jsx`, `DiscoverTab.jsx`
- `DKB_FORGE_RULES.md` (root) — ~1,000 line auto-extracted reference doc; **not imported into production code** (reference-only)

### C.3 Archetype-to-Agent Application

**Status:** 🚨 Archetype identity is **lost** in the common path.

**Path 1: Discover-tab "Use This Playbook" (common)**
1. User taps button at `CollectionDetailSheet.jsx:523-535`
2. `onUsePlaybook(collection)` → `ForgeScreen.jsx` handler
3. Handler calls `forge.mergeCollectionIntoBundle(collection)` (`forgeService.js`)
4. Service writes rules to `agents/{agentId}/rules/` and bundle to `agents/{agentId}/bundles/`
5. Bundle equipped → `agent.activeRules` updated
6. ❌ **No archetype identifier is written to the agent doc.** No `archetypeId`, no `sourceCollection`, no `originatingPlaybook` field.

**Path 2: Season experiment deploy (rarer)**
1. User runs a Season experiment with a bundle derived from an archetype
2. User taps "Deploy to Agent" → `DeployToAgent.jsx`
3. `deployStrategyService.js:150,161` writes `deployedStrategy.sourceCollection` and `deployedStrategy.experimentId`
4. ✅ Archetype identity preserved here.

**The disconnect:** Most users will apply collections via the Discover tab, which means the agent never records the archetype that produced its rule set. Downstream systems (Voice Layer, Haiku) can read `agent.archetype` (a single string field set at agent creation), but this is unrelated to the Trading Style Collection ID — it's the agent's persona archetype, not the strategy archetype.

### C.4 Archetype-Derived Signals Consumed Elsewhere

**`agent.archetype` (persona) reads** — ✅ Heavily consumed:

| Consumer | File:Line |
|---|---|
| Voice Layer | `api/_utils/voiceLayerPrompt.js:2148, 2209, 2269, 2391, 2593, 2820, 3046` |
| Haiku eval | `api/_utils/agentPromptAssembly.js:48-49` (uppercases the archetype) |
| Consolidation | `api/_utils/agentConsolidationPrompt.js:120, 205` |
| Debate | `api/agent/debate.js:116` |
| Decide | `api/agent/decide.js:99, 404, 575` |
| Chat | `api/agent/chat.js:322, 403` |
| Season entry | `api/season/create-entry.js:255, 263, 347` |
| Workshop chat | `api/forge/workshop-chat.js:448, 594` |

**`deployedStrategy.sourceCollection` reads** — ✅ Limited consumers:
- `api/_utils/voiceLayerPrompt.js` (some references)
- `api/season/create-entry.js:255` (for refinement-pair linkage)

**Trading Style Collection IDs read by other systems?** ❌ None found. The codebase reads `agent.archetype` (persona) and `deployedStrategy.sourceCollection` (deploy-from-experiment) but does **not** read any field that records "this agent was built from the swing-trader Trading Style Collection".

🚨 **This is the structural explanation for why archetypes "have no identity downstream"** — after a Discover-tab apply, there is no way for downstream code to know which collection produced the rules. The rules speak for themselves; the brand doesn't.

### C.5 Agent DNA Traits

**Status:** 🚨 Orphan field. Persisted but never read by backend.

**Definition files:**
- `src/data/dnaGroups.js` — 3 groups (`instincts`, `strategy`, `discipline`), 2 traits per group = 6 total trait slots
- `src/data/traitLibrary.js` — 16 fixed traits across all 3 groups; each bundles 2-4 rules with 3 strength profiles (subtle/moderate/dominant)
- `src/data/traitCombos.js` — combo labels for trait synergies

**UI consumers** (active):
- `src/components/Forge/DNAGroupCard.jsx`
- `src/components/Forge/DNASocketMatrix.jsx`
- `src/components/Forge/TraitCard.jsx`
- `src/components/Forge/TraitStrengthToggle.jsx`
- `src/components/Forge/AgentIdentityCard.jsx`

**Persistence:** `agent.equippedTraits[]` — each entry `{ traitId, strength, ruleIds }`. Read/saved by `src/hooks/useTraits.js:40-72`.

**Relationship to rules:** Equipping a trait creates rules in the agent's bundle (`addRuleToBundle`) with `traitId` field set (`forgeService.js:139`). Unequipping unwinds them (`useTraits.js:74-99`).

**Backend reads:** ❌ Zero. `grep -r 'traitId' api/` returns no results. No Voice Layer prompt mentions traits. No Haiku prompt mentions traits. No Dossier reads traits.

**Implication:** DNA traits are currently pure UI state. They affect the rule set indirectly (by creating tagged rules), but the downstream pipeline cannot distinguish "rule R came from trait T" vs. "rule R was added directly". The trait identity dissolves the moment a rule is added.

---

## Section D — Workshop Chat

### D.1 Code State

**Status:** ✅ Fully wired and accessible — but behind a visibility gate.

**Files (all present and current):**

| File | Lines | Status |
|---|---|---|
| `src/components/Forge/WorkshopChat.jsx` | 1,005 | ✅ Implemented |
| `api/forge/workshop-chat.js` | 642 | ✅ Implemented |
| `api/forge/workshop-chat.test.js` | 387 | ✅ Tested |
| `api/forge/compile-dimensions.js` | (32KB) | ✅ Implemented (thesis→dimensions compiler) |

**Accessibility chain:**
1. `ForgeLanding.jsx:2240` — "Talk to Agent" button with `onClick={handleBuildStrategy}`
2. `ForgeLanding.jsx:2038-2047` — `handleBuildStrategy()` → `requestWorkshopOpen(null)`
3. `ForgeLanding.jsx:2019-2037` — opens the modal once agent capacity validated
4. `ForgeLanding.jsx:2335` — `<WorkshopChat isOpen={workshopState.open} ... />`
5. Client `POST /api/forge/workshop-chat` (`WorkshopChat.jsx:529`)
6. Vercel routes to `api/forge/workshop-chat.js`

**Why the founder thinks it's "not accessible":**

`ForgeLanding.jsx:2212` — The "Talk to Agent" button only renders when:
```javascript
landingState === 'testing'
```

`landingState` is derived from `getLandingState()` at `ForgeLanding.jsx:113`, which evaluates:
- `deployed` > `testing` > `results` > `new`

A user with no active Season experiments lands in state `new` and **does not see the button**. The default flow into Workshop requires the user to first start a Season experiment, then return to Forge Landing.

**Deployment state:** ✅ Not in `vercel.json` crons (correct — it's a request-driven endpoint, not scheduled). Vercel's automatic file-based routing maps `/api/forge/workshop-chat` to the handler.

### D.2 Purpose and Integration

**Design intent (extracted from prompts and code):**

Workshop Chat is a conversational strategy development surface where users brief Gemma on a trading idea, and Gemma extracts a structured thesis suitable for compilation into a parameterized strategy. Gemma is bound to a **25-message budget per session** (rate limited at 10 req/60s per user).

**Seven canonical thesis fields** elicited from the user:
1. Summary
2. Catalyst
3. Instruments
4. Entry Logic
5. Exit Logic
6. Risk Posture
7. Invalidation

When entry + exit + risk are all populated, the user can tap "Compile Strategy" which posts to `compile-dimensions.js`. That endpoint maps the thesis to 130+ strategy dimension parameters (via Claude Haiku), clamps the outputs to schema ranges, records overrides in `appliedClamps`, writes to `workshopTheses/{thesisId}`, and returns dimension values for pre-filling `SeasonEntryModal`.

**Voice Layer integration:** Workshop uses the **same** `buildVoiceLayerPrompt()` / `callGemmaVoiceWithRetry()` / `parseVoiceLayerResponse()` pipeline as `api/agent/chat.js` (battle mode). Mode-specific behavior differences (`api/forge/workshop-chat.js:381`):
- No battleId / market snapshot
- Thesis normalization instead of directive elicitation
- Session-level persistence (vs. battle-level)
- Seed context injection (theme/sector metadata from Discover handoff)

**Outputs persisted:**
- `workshopSessions/{sessionId}` — `exchanges[]`, `latestThesis`, `seedContext`, `status`
- `workshopTheses/{thesisId}` — created by `compile-dimensions.js`, audit trail

### D.3 Dependencies

**Forward (what Workshop reads):**

| Dependency | Use | File:Line |
|---|---|---|
| `voiceLayerPrompt.js` | Build system prompt with thesis + seed context | workshop-chat.js:381 |
| `gemmaClient.js` | OpenRouter Gemma call | workshop-chat.js:396-429 |
| `agents` Firestore | Agent metadata | workshop-chat.js:265-378 |
| `indexIntelligence` | DRB + regime line | workshop-chat.js:265-378 |
| `shadowLogger.js` | `logConversation` (gameMode: 'workshop') | workshop-chat.js:30, 590-608 |

**Reverse (who reads Workshop outputs):**

| Consumer | Reads | File:Line |
|---|---|---|
| `compile-dimensions.js` | `workshopSessions.latestThesis` | compile-dimensions.js:93 |
| `SeasonEntryModal` | Compiled `dimensionValues` + `recommendedDurationDays` via `onCompiled()` | WorkshopChat.jsx:635-648 |
| `DiscoverPanel` | Calls `requestWorkshopOpen()` with seed context | DiscoverPanel.jsx:190, 208 |

**Cross-system pattern references (documentation only):**
- `api/forge/watchlist-dialogue.js` references workshop-chat as a pattern reference (not functional dependency)
- `api/forge/expand-signal.js` references the same DRB injection pattern

**Cron consumers:** ❌ None. No cron reads from `workshopSessions` or `workshopTheses`.

**Verdict:** Workshop Chat is shipped, wired, tested, and functional. The accessibility issue is a UX/discoverability problem, not a code problem. To make it always-accessible, `ForgeLanding.jsx:2212` would need its visibility condition relaxed.

---

## Section E — Overlap and Contradiction

### E.1 Behavioral Concerns Matrix

For each concern, the **owning system(s)** in code (file:line cited in Section E.2 and the prep notes). 🚨 = contested without clear precedence.

| Concern | Forge Rules | Dossier Disciplines | Vision Constraints | Trading Brain (Haiku hardcoded) | Voice Layer | Other |
|---|---|---|---|---|---|---|
| When to enter a position | partial (entry rules) | partial (selection disciplines) | partial (per-battle direction) | 🚨 conviction floor 70% (agentEvalPromptAssembly.js:88-91) | gates user-confirmation flow | Regime classifier (S1–S5) |
| When to exit a position | partial (exit rules) | partial (execution disciplines) | partial (thesis breakage) | 🚨 threshold proximity 0.2x ATR (agentEvalPromptAssembly.js:78-82) | narrates exit | Guardrails (agentGuardrails.js), Risk Manager (agentRiskManager.js), Survival Mode |
| How much capital to commit | ❌ none (no sizing rules) | ❌ none | ❌ none | tier preference (agentEvalPromptAssembly.js:73-76) | directive may override | User (initial portfolio) |
| Sector / theme preferences | partial (institutional rules) | deferred to Sprint 2 (convictions) | ✅ per-battle scope (visionTypes.js:196) | reads regime brief sector signals | reads vision scope | DiscoverThemes, supplyChainIntelligence |
| Trade frequency | ❌ none | ❌ none | ❌ none | ✅ hardcoded MAX 1 SWAP, COOLDOWN, NO ROUND-TRIPS (agentEvalPromptAssembly.js:175-182) | ❌ none | ❌ none |
| Profit-taking thresholds | partial (`exit_stops` season rules) | ❌ none | ❌ none | ✅ hardcoded ATR bonuses +1.0x/+1.5x/+2.0x (agentEvalPromptAssembly.js:32-35) | ❌ none | ❌ none |
| Stop-loss thresholds | 🚨 risk rules | partial (learned aversion) | partial (constraints) | 🚨 hardcoded ATR penalties (agentEvalPromptAssembly.js:37-40) + Survival Mode | ❌ none | 🚨 Guardrails (deployedStrategy.guardrails, agentGuardrails.js:94-153) |
| Risk tolerance / aggressiveness | partial (risk rules) | 🚨 execution disciplines (consolidatedInsight) | partial (confidence level) | 🚨 reads `marketPosture` from regime brief (agentEvalPromptAssembly.js:111-114) | partial (phase tone) | 🚨 `agent.config.risk` exists but UNREAD (agentService.js:99) |
| Time horizon (day-trade vs swing) | partial (mode tagging on rules) | ❌ none | partial (battle duration) | ✅ hardcoded clock-management bands (agentEvalPromptAssembly.js:64-71) | ❌ none | ❌ none |
| What technical setups to favor | ✅ strategy preferences (S-list in prompt) | partial (selection disciplines) | partial (direction) | ✅ S1–S5 regime-scoped strategies (agentEvalPromptAssembly.js:116-139) | reflects in narration | Regime classifier (agentRegimeClassifier.js) |
| What fundamental signals to favor | ✅ institutional rules (when active) | ❌ none | ❌ none | partial (institutional data lag warning) | ❌ none | InstitutionalIntelligence cron |
| How to respond to user messages | ❌ none | ❌ none | ❌ none | ❌ none | ✅ phase-driven (voiceLayerPrompt.js:56-153) | ❌ none |
| Whether to propose vs. just execute | ❌ none | ❌ none | ❌ none | ❌ none | ✅ phase-driven (Discovery asks; Mastery executes, voiceLayerPrompt.js:60, 130) | ❌ none |

### E.2 Direct Overlap Examples

**Forge rules vs. hardcoded Haiku behavior (3 concrete examples):**

1. **Stop-loss thresholds.** A Forge `risk` rule like "Cut if position is down 5%" gets injected as `C1` in the prompt. But the Haiku prompt also contains hardcoded ATR-based penalty thresholds (`agentEvalPromptAssembly.js:37-40`: −1.0x ATR = Bust, −1.5x ATR = Crash). Both can be true simultaneously; which fires first is undefined. **Plus**, `agentGuardrails.js:94-130` enforces deployedStrategy.guardrails.stopLoss deterministically as a third path with stronger semantics — it overrides Haiku's decision regardless.

2. **Trade frequency.** No Forge rule can soften or tighten the hardcoded "ONE SWAP MAXIMUM per evaluation" / "NO ROUND-TRIPS" / cooldown rules in `agentEvalPromptAssembly.js:175-182`. A user wanting an extremely active strategy or extremely passive strategy can author rules saying so, but the rules can't escape the hardcoded gate.

3. **Profit-taking thresholds.** The hardcoded `+1.0x ATR = +15 pts`, `+1.5x = +30 pts`, `+2.0x = +50 pts` bonuses (`agentEvalPromptAssembly.js:32-35`) are baked into Haiku's understanding of when to take profit. A Forge rule "Sell when up 10%" coexists in the prompt with the hardcoded ATR-bonus framework. Haiku has no documented precedence rule.

**Forge rules vs. Dossier disciplines (2-3 examples):**

1. **"I avoid entering stocks below their 200-day MA"** (dossier selection discipline from `SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md`) overlaps with `tech-*` rules that filter on MA position. Same intent, two different storage paths: dossier in `agent.disciplines.selection[]`, rules in `agent.activeRules[]`.

2. **"I don't size up when I'm behind"** (execution discipline) overlaps with allocation-category Forge rules that constrain position sizing under losses.

3. **"My final hour is for converting positions, not creating new ones"** overlaps with the hardcoded clock-management rule (`agentEvalPromptAssembly.js:67`: "Late battle: Swaps are DEFENSIVE ONLY"). A user-authored discipline says the same thing the hardcoded prompt already enforces.

**Forge rules vs. Voice Layer prompt directives (2-3 examples):**

1. **Risk posture / aggressiveness.** A Forge rule "Aggressive momentum strategy" exists in Haiku's prompt as a `STRATEGY PREFERENCE`. Meanwhile, Voice Layer phase logic (`voiceLayerPrompt.js:60, 130`) determines whether Gemma proposes aggressively or cautiously based on `gamesPlayed`, completely independent of rules. A user might author aggressive rules but get cautious Discovery-phase narration.

2. **Concentration vs. diversification.** Forge `allocation` rules limit sector concentration. Voice Layer has no awareness of these. Gemma may propose a concentrating swap that Haiku then rejects via the rule.

3. **"How much to explain to user."** Pure Voice Layer ownership (phase-driven gated explanations). No Forge rule can influence this.

**Direct contradictions:**

The audit found no explicit "system A says X, system B says NOT X" contradictions. The pattern is **silent disagreement**: systems make decisions on the same axis using different inputs, with no precedence rule and no observability into which one fired.

### E.3 Behavioral Gaps

The founder named: trade frequency, profit cap, stop loss, risk mechanisms, sector focus.

**Per-concern status:**

| Founder-named gap | Today's owner | Where the behavior comes from | Suitable future owner |
|---|---|---|---|
| Trade frequency | Trading Brain hardcoded | `agentEvalPromptAssembly.js:175-182` — MAX 1 SWAP, NO ROUND-TRIPS, cooldown | Forge (configurable per archetype) |
| Profit cap | Trading Brain hardcoded | `agentEvalPromptAssembly.js:32-35` — ATR-based bonus thresholds | Forge `exit_stops` rules OR deployedStrategy.profitTarget |
| Stop loss | 🚨 three systems | Hardcoded ATR + Forge `risk` + deployedStrategy.guardrails + Survival Mode | Pick one: deployedStrategy.guardrails has the cleanest semantics |
| Risk mechanisms | 🚨 contested/dead | `agent.config.risk` (UNREAD), dossier disciplines (implicit), regime brief (overrides) | Dossier disciplines OR a new agent-level `riskProfile` |
| Sector focus | Vision (per-battle) only | `vision.thesis.structuredSummary.scope` | Dossier convictions (Sprint 2) or new agent-level `preferredSectors` |

**Additional gaps found:**

- **Time-horizon configurability.** Hardcoded into Haiku's clock-management rules. No way for a user to express "I trade short term" vs. "I trade long term" beyond picking an archetype.
- **Whether the agent narrates while trading.** Hardcoded into Voice Layer phase rules; not exposed.
- **What setups to favor.** Forge rules + Trading Brain regime-scoped strategies + Dossier disciplines all claim this. No clear precedence.
- **Custom rule parameterization.** Custom rules accept only `text` and `category`; param sliders only render for Discover-tab template rules.

---

## Section F — Strategy Laboratory and Season Mode

### F.1 Laboratory State

**Status:** 🟡 Operationally live; Forge Score and BaggerBomb Fitness are specced but not implemented.

**Files implementing Laboratory:**
- UI: `src/components/Forge/ForgeLanding.jsx` (4-state landing: new → testing → results → deployed)
- UI: `src/components/Forge/StrategyDimensions.jsx` (7 dimension knobs, 3-2-2 grid)
- UI: `src/components/Forge/DeployToAgent.jsx`
- UI: `src/components/Forge/StatsTab.jsx` / `ProvingGroundsTab.jsx` (alias)
- UI: `src/components/Season/DailyBriefingCard.jsx`
- API: `api/season/create-entry.js` (experiment launch)
- API: `api/cron/season-daily-evaluate.js` (cron)
- API: `api/cron/season-pit-stop-manage.js` (weekly review/lockin)
- Spec: `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md`

**What's measured (Firestore):** `seasonEntries/{entryId}` + `seasonEntries/{entryId}/dailyLogs/{tradingDay}`
- Portfolio state (cash, positions, sector weights, total return, drawdown from peak)
- Alpha vs SPY (cumulative + daily)
- Per-rule performance: `timesFollowed`, `timesBlocked`, `timesOverridden` + `overrideReasons` breakdown
- Daily activity: trades, entry scans, exit evaluations, rebalance evaluations
- Weekly aggregates
- Final metrics: sharpe, maxDrawdown, consistencyPct, tradeWinRate, profitFactor, recoveryFactor, **compositeScore**

**Input shape:** `POST /api/season/create-entry` with `{ seasonId, agentId, bundleId, [entrySource, dimensionValues, sourceExperimentId, sourceCollection] }`. Server transforms bundle.ruleSnapshots → algorithm.rules[] (lines 140-194), filtering for season-compatible rules (prefix `se-`/`sx-`/`sr-`/`ss-`).

**Production state:** ✅ Live. Vercel cron schedules:
- `season-daily-evaluate`: `30 20,21 * * 1-5` (UTC 20:30 and 21:30, M-F; ET gate 4:15-5:00 PM)
- `season-pit-stop-manage` (open): `0 13,14 * * 6` (Sat)
- `season-pit-stop-manage` (lock-in): `0 3,4 * * 1` (Mon)

**Concurrency limit:** 5 active seasonEntries per user (`create-entry.js:60`).

### F.2 Season Mode Integration

**seasonEntries collection shape** (abbreviated):
```javascript
{
  seasonId, userId, agentId, bundleId, displayId, displayName,
  entryType: 'human',
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED',
  mode: 'solo' | 'tournament',
  durationDays: 5 | 10 | 15 | 20,
  algorithm: { version, rules[], ruleCount, description },
  entrySource: 'direct_join' | 'manual' | 'workshop' | 'refinement_pair',
  sourceExperimentId: null | string,
  sourceCollection: null | string,
  dimensionValuesAtLaunch: null | object,
  creationSource: { method, collectionUsed, sourceExperimentId, timestamp },
  portfolio: { ... },
  seasonState: { alphaVsSpy, currentWeek, currentTradingDay, weeklyResults[], ... },
  dailySnapshots: [],
  recentActivity: [],
  rulePerformance: {},
  completedAt, finalRank,
}
```

**Leaderboard infrastructure (`seasonLeaderboard/{seasonId}`):**
- Rebuilt daily in `season-daily-evaluate.js` after settlement
- Computed by `api/_utils/seasonLeaderboard.js`:
  - `buildLeaderboard(seasonId, entries)` — alpha-sorted (primary), totalReturn tiebreak
  - `computeFinalMetrics(entry, seasonDoc, trades)` — final metrics with composite
- Composite weights (seasonConfig.js): sharpe 0.30, drawdown 0.25, consistency 0.25, winRate 0.20
- This `compositeScore` is the de-facto Forge Score today.

**Pit-Stop cron** (`season-pit-stop-manage.js`): Opens Saturday for weekly rule edits; locks in Sunday night. Validates client-submitted rule changes against `buildRuleSchemaRegistry` derived from `FORGE_RULE_TEMPLATES` (cross-boundary import from `src/data/forgeKnowledgeBase.js`).

### F.3 Forge → Laboratory Pipeline

**Path:** Built strategy → Laboratory experiment

1. **Build:** User creates a bundle (`agents/{agentId}/bundles/{bundleId}`) with rules.
2. **Launch:** `POST /api/season/create-entry` validates ownership, transforms `bundle.ruleSnapshots` → `algorithm.rules[]` (immutable snapshot), creates `seasonEntries/{entryId}` in a transaction with duplicate check.
3. **Run:** Daily cron evaluates entry against EOD data, writes daily log + rebuilds leaderboard.
4. **Measure:** Per-rule citation stats (timesFollowed, timesBlocked, timesOverridden) accumulate in `seasonEntries.rulePerformance`.
5. **Surface:** `StatsTab.jsx` reads these stats and renders per-rule performance to the user. `DailyBriefingCard.jsx` pulls from dailyLog (template-based; no AI call).
6. **Deploy:** `DeployToAgent.jsx` → `deployStrategyService.js` copies the winning bundle to `agent.deployedStrategy` and sets `deployedStrategy.experimentId` + `sourceCollection` + dimensionHash.

**"Strategy" in this pipeline = bundle + dimensionValuesAtLaunch + creationSource metadata** — an immutable experiment configuration snapshot. The same bundle can launch multiple experiments with different dimensions.

**Feedback (Laboratory → Forge):**
- ✅ Alpha + rule citation stats surface in `StatsTab.jsx`
- ✅ Daily briefing UI shows narrative summary
- ✅ Deploy-to-agent path
- 🟠 Laboratory measurements do **not** auto-update Forge rule tunings
- 🟠 No automated rule refinement triggered by performance
- 🟠 Phase 6 spec adds `sourceExperimentId` linking for refinement pairs but the refinement UI is not visible in current code
- ❌ "Forge Score v1.1" specced in `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` — not implemented (compositeScore used instead)
- ❌ "BaggerBomb Fitness Score" specced — not implemented

**Workshop Mode bridge** (Phase 5, partially deferred):
- `api/forge/workshop-chat.js` → conversation → thesis
- `api/forge/compile-dimensions.js` → thesis → dimension pre-fill
- Lands in `StrategyDimensions.jsx` (pre-filled) → user adjusts → launches experiment with `entrySource: 'workshop'`
- The bridge code exists and works in isolation; integration into `ForgeLanding.jsx` is partial (the "Talk to Agent" button exists but only at `landingState === 'testing'`).

---

## Section G — Adjacent Inventory

### G.1 Forge-Related Shadow Logging

`api/_utils/shadowLogger.js` defines 13 streams. Forge-touching streams:

| Forge event | Logged? | Source |
|---|---|---|
| Strategy preset application | ✅ | Indirect via `season-pit-stop-manage.js:38` import of FORGE_RULE_TEMPLATES validation |
| Rule activation changes | ✅ | `season-daily-evaluate.js:29` via `logPipelineDecision` |
| Custom rule creation | ❓ Partial | Test mocks reference `logXxx` calls; production code path verified in service layer but no observed shadow log call directly from `createRule` |
| Workshop chat interactions | ✅ | `workshop-chat.js:30, 590-608` via `logConversation` with `gameMode: 'workshop'` |
| Quick Start application | ❌ | No shadow log call found in `mergeCollectionIntoBundle` or apply paths |
| Strategy dimension compilation | ✅ | `compile-dimensions.js` via `logCompilation` |

**Implication:** Workshop chat has the most complete logging; Quick Start application has none. If the founder wants telemetry on archetype adoption rates, that data is currently not captured.

### G.2 Forge UI Surfaces

`src/components/Forge/` contains 41 components. Inventory:

**Primary entry points (routed/reachable):**
- `ForgeLanding.jsx` — Laboratory landing screen (App.jsx:112)
- `ForgeScreen.jsx` — Advanced editor (App.jsx:111, index.js:1)
- `Watchlist/WatchlistEditor.jsx` — Lazy-loaded modal (App.jsx:55)

**Actively rendered subcomponents (verified):**
- `WorkshopChat.jsx` — Per Section D
- `StrategyDimensions.jsx`
- `MyRulesTab.jsx`, `MyBundlesTab.jsx`, `DiscoverTab.jsx`, `StatsTab.jsx`
- `DeployToAgent.jsx`, `IntelCodex.jsx`, `RuleDirectory.jsx`, `RuleDossier.jsx`
- `Watchlist/CommitModal.jsx`, `Watchlist/DeleteWatchlistModal.jsx`, `Watchlist/UncommitModal.jsx`
- `BundlePresetModal.jsx`, `BundleStrip.jsx`
- `CollectionDetailSheet.jsx`, `CollectionPicker.jsx`
- `StrategyControlsToggle.jsx`, `SeasonModeToggle.jsx`, `TraitStrengthToggle.jsx`
- `RuleConfigDrawer.jsx`, `RuleDetailSheet.jsx`, `RulePickerModal.jsx`
- `RuleModeBadge.jsx`, `RuleTextPreview.jsx`
- `TraitCard.jsx`, `DNAGroupCard.jsx`, `DNASocketMatrix.jsx`
- `MechSVG.jsx`, `MechParticles.jsx`, `MechVisorStrip.jsx`
- `RadarChart.jsx`, `AgentIdentityCard.jsx`, `AgentLearnedSection.jsx`
- `ManagementPanel.jsx`

**Orphan / minimal-use components:**
- `ProvingGroundsTab.jsx` — Pure alias/re-export of `StatsTab.jsx`; no direct imports
- `IntelCodex.jsx` — Used only in `ForgeScreen.jsx:624, 1064`; not imported elsewhere
- `StarterKit.jsx` — Unclear entry point; appears to be Quick Start launcher
- `CategoryAccordion.jsx`, `FoundInChips.jsx`, `CollectionChips.jsx`, `LoadoutDropdown.jsx` — Internal use only

**User reachability:** Forge accessed via `showForge` toggle in `App.jsx:2357` from main shell. Reachable from Season Hub Discover/Stats tabs and Agent Evolution screen. Desktop and mobile render branches at `ForgeScreen.jsx:624` and `:1064`.

### G.3 Cron Slots Used by Forge

`vercel.json` defines **39 of 40** Vercel hobby-tier cron slots. Forge-related (3 paths, 3 slots):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/season-daily-evaluate` | `30 20,21 * * 1-5` | Daily season entry evaluation (black swan → pipeline → settlement → leaderboard rebuild). 4:30–5:30 PM ET M-F. Calls `logPipelineDecision`. |
| `/api/cron/season-pit-stop-manage?action=open` | `0 13,14 * * 6` | Saturday pit-stop opening (1-2 PM ET). Creates pitStop docs, gates entry rule edits. Validates against FORGE_RULE_TEMPLATES. |
| `/api/cron/season-pit-stop-manage?action=lockin` | `0 3,4 * * 1` | Sunday night/Monday morning rule lock-in. Validates submitted rule changes, applies to entry.algorithm.rules, closes edit gate. Cross-boundary import from `src/data/forgeKnowledgeBase.js`. |

**Adjacent (touches Forge concepts):**
- `/api/cron/compute-daily-regime-brief` (`30 12 * * 1-5`) — Daily regime brief used by both Haiku and Voice Layer prompts. Not Forge-exclusive but Forge-relevant.

**Non-Forge crons (36 of 39):** Agent evaluation pipeline (3), BaggerBomb scoring (3), FantasyTimes content pipeline (10), Index/ranking computation (5), Lobby & draft management (6), Pre-market warmup (1), Read-across monitoring (1), etc.

**Orphan crons:** None identified. All 39 paths map to existing functional handlers.

---

## Appendix — Notable File Paths and Line References

### Core Forge code

| Area | File | Lines | Notes |
|---|---|---|---|
| Rule template definitions | `src/data/forgeKnowledgeBase.js` | 1-3798 | 143 templates, 13 categories |
| Archetype/collection definitions | `src/data/forgeCollections.js` | 1-1120 | 12 active + 9 legacy |
| Rule schema validation | `src/services/forgeService.js` | 17-108 | Categories, sources, validation rules |
| Rule CRUD | `src/services/forgeService.js` | 121-242 | Create / Read / Update / Soft-delete |
| Bundle CRUD | `src/services/forgeService.js` | 300-370 | Add/remove rules to bundles |
| Custom rule creation hook | `src/hooks/useForge.js` | 409-427 | createManualRule |
| Custom rule UI | `src/components/Forge/MyRulesTab.jsx` | 100-108 | Form (text + category) |
| Trait hooks | `src/hooks/useTraits.js` | 40-99 | DNA trait equip/unequip |
| Trait schema | `src/data/dnaGroups.js`, `traitLibrary.js`, `traitCombos.js` | full files | 3 groups × 2 slots = 6 sockets |

### Decision pipeline integration

| Area | File | Lines | Notes |
|---|---|---|---|
| Rule injection into Haiku prompt | `api/_utils/agentEvalPromptAssembly.js` | 283-323 | The single most important integration point |
| Rule citation block in prompt | `api/_utils/agentEvalPromptAssembly.js` | 166-174 | "━━━ FORGE RULES ━━━" header |
| Institutional data lag warning | `api/_utils/agentEvalPromptAssembly.js` | 304-313 | Conditional on institutional rules present |
| Rule text interpolation | `api/_utils/agentEvalPromptAssembly.js` | 376 | interpolateRuleText |
| Prompt-injection sanitization | `api/_utils/agentEvalPromptAssembly.js` | 337-366 | |
| Haiku conviction floor | `api/_utils/agentEvalPromptAssembly.js` | 88-91 | "Below 70% must HOLD" |
| Hardcoded clock-management | `api/_utils/agentEvalPromptAssembly.js` | 64-71 | Early/Mid/Late battle bands |
| Hardcoded tier preference | `api/_utils/agentEvalPromptAssembly.js` | 73-76 | Star 2.0x, Core 1.5x, Support 1.0x |
| Hardcoded threshold proximity | `api/_utils/agentEvalPromptAssembly.js` | 78-82 | 0.2x ATR proximity rules |
| Hardcoded ATR bonuses | `api/_utils/agentEvalPromptAssembly.js` | 32-35 | +1.0x / +1.5x / +2.0x |
| Hardcoded ATR penalties | `api/_utils/agentEvalPromptAssembly.js` | 37-40 | −1.0x (Bust) / −1.5x (Crash) |
| Hardcoded anti-thrash | `api/_utils/agentEvalPromptAssembly.js` | 175-182 | MAX 1 SWAP, NO ROUND-TRIPS |
| Survival Mode | `api/_utils/agentEvalPromptAssembly.js` | 184-186 | Override directives at Bust |
| Haiku tool schema (rule citations) | `api/_utils/agentEvalToolSchema.js` | 110-145 | cited_forge_rules / overridden_forge_rules |
| Battle context freeze | `api/_utils/agentBattleService.js` | 119 | Rules frozen at battle creation |
| Cron evaluator | `api/cron/agent-evaluate.js` | 612-752, 896-914, 959-1010 | Risk Manager call, Haiku call, Guardrails enforcement |
| Risk Manager | `api/_utils/agentRiskManager.js` | 30-86 | EMERGENCY_SWAP / SWAP_OUT / LOCK / TRAIL_STOP / HOLD |
| Guardrails | `api/_utils/agentGuardrails.js` | 58-217 | Stop-loss, trailing stop, max sector |
| News intel rule reads | `api/_utils/agentNewsContext.js` | 151-276 | Indirect rule consumption for news prioritization |

### Voice Layer (does NOT read rules)

| Area | File | Lines | Notes |
|---|---|---|---|
| Voice Layer prompt | `api/_utils/voiceLayerPrompt.js` | full file | No `activeRules` reads |
| Voice Layer anticipation | `api/_utils/voiceLayerAnticipation.js` | full file | No rule context |
| Voice Layer trade narration | `api/_utils/voiceLayerTradeNarration.js` | full file | No rule context |
| Archetype string reads (persona, NOT collection ID) | `api/_utils/voiceLayerPrompt.js` | 2148, 2209, 2269, 2391, 2593, 2820, 3046 | Reads `agent.archetype` |
| Phase rules | `api/_utils/voiceLayerPrompt.js` | 56-153 | Discovery / Refinement / Mastery |
| Directive format | `api/_utils/voiceLayerPrompt.js` | 157-171 | hasDirective / directive shape |

### Workshop Chat

| Area | File | Lines | Notes |
|---|---|---|---|
| Workshop UI | `src/components/Forge/WorkshopChat.jsx` | 1-1005 | Full chat modal with thesis panel |
| Workshop API | `api/forge/workshop-chat.js` | 1-642 | Session lifecycle, 25-msg budget, Gemma call |
| Workshop tests | `api/forge/workshop-chat.test.js` | 1-387 | Parse-error fallback, concurrency |
| Compile dimensions API | `api/forge/compile-dimensions.js` | (32KB) | Thesis → dimensions mapping |
| Workshop button visibility | `src/components/Forge/ForgeLanding.jsx` | 2212 | `landingState === 'testing'` gate |
| Workshop modal mount | `src/components/Forge/ForgeLanding.jsx` | 2335 | `<WorkshopChat isOpen={...} />` |

### Archetypes and DNA

| Area | File | Lines | Notes |
|---|---|---|---|
| Trading Style Collections | `src/data/forgeCollections.js` | 12-988 | 12 active archetypes |
| Legacy themed collections | `src/data/forgeCollections.js` | 996-1119 | 9 legacy |
| Apply playbook handler | `src/components/Forge/CollectionDetailSheet.jsx` | 523-535 | "Use This Playbook" button |
| Apply preserves identity? | `src/services/forgeService.js` | `mergeCollectionIntoBundle` | ❌ No archetypeId written |
| Apply preserves identity (Season path)? | `api/season/create-entry.js` | 255, 263, 347 | ✅ `sourceCollection` set |
| Deploy preserves identity? | `api/_utils/deployStrategyService.js` | 150, 161 | ✅ `deployedStrategy.sourceCollection` set |
| Agent archetype string consumers | (see Voice Layer table) | various | `agent.archetype` (persona) — separate from collection ID |

### Strategy Laboratory / Season

| Area | File | Lines | Notes |
|---|---|---|---|
| Spec | `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` | full | Authoritative spec |
| Create entry | `api/season/create-entry.js` | 60, 140-194 | Concurrency cap; bundle→algorithm transform |
| Daily evaluate cron | `api/cron/season-daily-evaluate.js` | full | Daily rule evaluation, settlement |
| Pit stop cron | `api/cron/season-pit-stop-manage.js` | 38-42 | Imports FORGE_RULE_TEMPLATES for validation |
| Leaderboard | `api/_utils/seasonLeaderboard.js` | full | buildLeaderboard, computeFinalMetrics |
| Composite weights | `api/_utils/seasonConfig.js` | (search for weights) | sharpe 0.30, drawdown 0.25, consistency 0.25, winRate 0.20 |
| Deploy service | `api/_utils/deployStrategyService.js` | full | Bundle → agent.deployedStrategy |

### Dossier / Vision (other behavioral systems)

| Area | File | Lines | Notes |
|---|---|---|---|
| Consolidation prompt | `api/_utils/agentConsolidationPrompt.js` | 238-255 | Discipline schema |
| Vision types | `src/types/vision/visionTypes.js` | 89-116, 196 | Constraint object; scope field |
| Vision injection into Haiku | `api/_utils/agentEvalPromptAssembly.js` | 556-616 | buildVisionStateBlock |

### Cron and configuration

| Area | File | Notes |
|---|---|---|
| Vercel cron registry | `vercel.json` | 39/40 slots used; 3 Forge-related |
| Shadow logger | `api/_utils/shadowLogger.js` | 13 streams defined |

### Orphans flagged

- 🚨 `agent.config.risk` (`src/services/agentService.js:99`) — never read by Haiku.
- 🚨 `agent.equippedTraits[]` (`src/hooks/useTraits.js:40-72`) — never read by backend (grep `traitId` in `api/*` → 0 hits).
- 🚨 Archetype identity from Discover-tab application — no field written, no consumer.
- 🚨 Legacy themed collections (`forgeCollections.js:996-1119`) — exported but commented as deprecated.
- 🚨 Files referenced in project memory but absent from repo: `TRADING_STYLE_COLLECTIONS_BATCH1.js`, `TRADING_STYLE_COLLECTIONS_FINAL.js`, `TRADINGVIEW_STRATEGY_COLLECTIONS_COMPLETE.js`.
- 🟠 "Forge Score v1.1" and "BaggerBomb Fitness Score" — specced in `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` but not implemented; `compositeScore` used instead.

---

**End of Forge System Discovery Audit Report.**
