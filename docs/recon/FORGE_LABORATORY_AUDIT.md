# Forge / Laboratory Ecosystem Audit

**Recon for:** FantasyTrades loadout system design
**Mode:** Read-only investigation (no code changes)
**Scope:** Forge UI, Laboratory shell, Playbooks, Strategy, Agent DNA,
SignalDrop, and their connection (or non-connection) to agent battles.

---

The Forge tab is structurally three layers:

1. **Laboratory shell** (`ForgeLanding.jsx`) — the gold-titled front door with
   Discover / Laboratory / Advanced pill tabs. State-aware page (new /
   testing / results / deployed).
2. **Advanced Mech Bay** (`ForgeScreen.jsx`) — the older Forge UI, now
   reachable as the "Advanced" tab. Internally has The Forge / Intel Codex /
   Proving Grounds sub-tabs and the visible robot (Mech).
3. **Rule library** (`forgeKnowledgeBase.js` + `forgeCollections.js` +
   `traitLibrary.js` + `dnaGroups.js`) — static bundled data, no
   Firestore reads at runtime. ~143 rule templates, 15 named "Playbooks"
   (collections), 16 traits across 3 DNA groups.

What the screenshots called a "Playbook" is internally a
`TRADING_STYLE_COLLECTIONS` entry. What's called "Agent DNA" is the
`equippedTraits[]` array on the agent doc. What gets read by the
in-battle Haiku at evaluation time is **only** the `activeRules` array
on the agent doc, populated by *equipping a bundle*. Traits, DNA
groupings, and Playbook metadata never reach Haiku as first-class
concepts — they all funnel through the same `activeRules` shape.

A second deterministic enforcement path exists
(`agent.deployedStrategy.guardrails` → `applyGuardrails()` in
`agent-evaluate.js`) but it consumes a *different* data structure
(dimension-derived guardrails from `compile-dimensions.js`), not Forge
rules. This is the second surprise on top of Playbooks/DNA: there's a
parallel "deployed strategy" pipeline whose source of truth is the
Strategy Laboratory's dimension sliders, not the Mech Bay's rule
bundles.

---

## Q1. Playbooks

### Where are Playbooks defined?

Playbooks are exported as `TRADING_STYLE_COLLECTIONS` and the broader
`FORGE_COLLECTIONS` array from `src/data/forgeCollections.js`:

- `src/data/forgeCollections.js:11` — `TRADING_STYLE_COLLECTIONS` start
- `src/data/forgeCollections.js:996` — `FORGE_COLLECTIONS` = style
  collections + 8 "themed" thematic collections concatenated

Definitions are **static JS constants**, bundled into the SPA at build
time. The file header (line 1–3) calls out: *"Curated collections that
group rule templates by strategic intent."* No Firestore. Mirrored on
the API side at `api/_utils/stockIntelligenceData.js` (unused by the
forge runtime path) and referenced by `src/data/ruleRelationships.js`
(builds the Intel Codex "Found In" chips).

### How many Playbooks, and what are they?

There are **15 collections total**: 12 "style" collections
(`isStyleCollection: true`) and 3 themed collections. From
`src/data/forgeCollections.js`:

**Style collections (TRADING_STYLE_COLLECTIONS, lines 11–989):**

| ID                  | Title              | File line |
|---------------------|--------------------|-----------|
| `swing-trader`      | Swing Trader       | 14        |
| `day-trader`        | Day Trader         | 97        |
| `momentum-rider`    | Momentum Rider     | 180       |
| `defensive-fortress`| Defensive Fortress | 263       |
| `trend-surfer`      | Trend Surfer       | 350       |
| `vwap-warrior`      | VWAP Warrior       | 439       |
| `squeeze-hunter`    | Squeeze Hunter     | 514       |
| `oversold-sniper`   | Oversold Sniper    | 589       |
| `volume-detective`  | Volume Detective   | 664       |
| `rs-leader`         | RS Leader          | 739       |
| `triple-threat`     | Triple Threat      | 821       |
| `baggerbomb-native` | BaggerBomb Native  | 903       |

**Themed collections (FORGE_COLLECTIONS continuation, lines 996–1119):**

- `defensive-playbook`, `momentum-hunter`, `value-investor`,
  `contrarian-edge`, `conviction-plays`, `battle-tactics`,
  `game-clock-plays`, `threshold-hunters`, `tier-master`.

Themed collections use the older `ruleIds: []` shape with no param
overrides; style collections use the richer `rules: [{ ruleId,
paramOverrides, rationale, priority, priorityLabel }]` shape.

### Data shape of a single Playbook

A style collection (e.g. `swing-trader`,
`src/data/forgeCollections.js:13–93`):

```js
{
  id: 'swing-trader',
  title: 'Swing Trader',
  subtitle: '...',
  icon: 'TrendingUp',           // lucide-react icon name
  accentColor: '#5EEAD4',
  difficulty: 'intermediate',
  tags: ['trend', 'patience', ...],
  isStyleCollection: true,
  philosophy: '...',            // long-form description
  conflicts: ['day-trader'],    // soft-conflict warnings
  progressionHints: {           // optional, not all collections
    rookie:  { activeCount: 5, injectedCount: 3, message: '...' },
    starter: { activeCount: 7, injectedCount: 6, message: '...' },
    partner: { activeCount: 9, injectedCount: 9, message: '...' },
  },
  rules: [
    {
      ruleId: 'tech-rsi-oversold',
      paramOverrides: { threshold: 35, volumeConfirm: true },
      rationale: '...',
      priority: 1,
      priorityLabel: 'Core Strategy',
    },
    // ...
  ],
  get ruleIds() { return this.rules.map(r => r.ruleId); },
}
```

A themed collection (e.g. `battle-tactics`,
`src/data/forgeCollections.js:1062–1076`) is simpler:

```js
{
  id: 'battle-tactics',
  title: 'Battle Tactics',
  subtitle: '...',
  icon: 'Swords',
  accentColor: '#6366F1',
  ruleIds: ['mb-01', 'mb-04', 'mb-07', 'mb-09', 'mb-10', 'mb-15'],
}
```

### "Dot count" under each Playbook name

The dots are **rule-category color dots**. Each collection is hydrated
at runtime by `useForge.js:241–267` (`collectionData` memo) which
builds a `categoryColors: [...catColorSet]` array — one entry per
distinct rule category present in the collection's rules. Rendered as
6px dots in `CollectionDetailSheet.jsx:405–413`. The horizontal chip
strip (`CollectionChips.jsx:64–75`) only shows the single accent dot,
not a dot count.

Example: a Playbook with rules tagged `technical`, `mid_battle`,
`threshold` would show 3 dots in those three category colors.

### Playbook rule categories

The full category enum is `FORGE_CATEGORIES` in
`src/data/forgeKnowledgeBase.js:5–19`:

| ID              | Label                | Mode     | Notes                       |
|-----------------|---------------------|----------|-----------------------------|
| `technical`     | Technical            | both     |                             |
| `fundamental`   | Fundamental          | both     |                             |
| `risk`          | Risk                 | both     | Constraint category         |
| `allocation`    | Allocation           | both     | Constraint category         |
| `mid_battle`    | Mid-Battle Trading   | clash    | BaggerBomb (1-day) only     |
| `game_state`    | Game State           | clash    | Phase-aware                 |
| `threshold`     | Threshold Strategy   | clash    |                             |
| `tier_strategy` | Tier Strategy        | clash    |                             |
| `institutional` | Institutional        | both     | Has 135-day data-lag warning|
| `entry_criteria`| Entry Criteria       | season   | Season mode only            |
| `exit_stops`    | Exit & Stops         | season   | Season mode only            |
| `rebalancing`   | Rebalancing          | season   | Season mode only            |
| `season_state`  | Season State         | season   | Season mode only            |

So the **TECHNICAL / MID_BATTLE / THRESHOLD** labels visible in the
screenshots are members of this 13-element enum. There are no other
hidden categories.

### Rule shape

A single rule template (`forgeKnowledgeBase.js:34–56`, the
`tech-rsi-oversold` example):

```js
{
  id: 'tech-rsi-oversold',
  category: 'technical',
  modes: 'both',                  // 'clash' | 'season' | 'both'
  headline: 'Buy oversold stocks',
  description: '...',
  learnMore: '...',
  difficulty: 'beginner',
  forgeTemplates: [
    {
      text: 'Prefer stocks with RSI below {threshold}',
      params: {
        threshold: {
          type: 'number', default: 30, min: 15, max: 45,
          step: 5, unit: 'RSI', label: 'Oversold threshold',
          hint: '...',
        },
        volumeConfirm: {
          type: 'toggle', default: false, label: 'Require volume confirmation',
          hint: '...',
        },
      },
      category: 'technical',
    }
  ],
  relatedIndicator: 'RSI (14-period)',
  kbEntryId: null,
  tags: ['momentum', 'RSI', 'oversold', 'mean-reversion'],
  agentUseDescription: '...',     // Surfaced to the user as "what this does"
}
```

There are **143 rule template definitions** in
`forgeKnowledgeBase.js`. ID prefixes encode category-ish groupings:
`tech-*`, `fund-*`, `risk-*`, `alloc-*`, `mb-*` (mid-battle), `gs-*`
(game state), `th-*` (threshold), `ts-*` (tier strategy), `t-*` /
`tv-*` (additional technical/TradingView ports), `f-*` (fundamental
extras), `r-*` (risk extras), `a-*` (allocation extras), `i-*`
(institutional), `se-*` / `sx-*` / `sr-*` / `ss-*` (Season).

### Are rules executable or prompt-material?

**Prompt-material at battle time**, with one exception.

A rule's `text` template (e.g. `'Prefer stocks with RSI below
{threshold}'`) is interpolated against `paramValues` and then injected
into Haiku's system prompt as a natural-language constraint or
preference:

- Decode path: `agentEvalPromptAssembly.js:252–293` —
  `activeRules` are split into `constraints` (categories `risk`,
  `allocation`) vs `strategies` (everything else), rendered as
  `== CONSTRAINTS (must obey) ==` and `== STRATEGY PREFERENCES (should
  follow) ==` blocks.
- Decode path (battle-creation Haiku):
  `agentPromptAssembly.js:67–93` — same split (CONSTRAINTS /
  STRATEGY PREFERENCES) for the strategy-brief call.
- Sanitization: `agentEvalPromptAssembly.js:307–336` strips prompt-
  injection patterns from user-authored text before injection.
- Text resolution: `interpolateRuleText()` at
  `agentEvalPromptAssembly.js:346–356` replaces `{paramKey}`
  placeholders with `paramValues[key] ?? param.default`.

There is **no deterministic executor that reads a Forge rule's
`paramValues` and applies it as code** in the agent-evaluate cron.
Rules influence the LLM via prompt, that's it.

The exception: `api/_utils/agentGuardrails.js` (Phase 4B) is a hard
deterministic override layer that runs **after** Haiku in
`agent-evaluate.js:864–915`. It reads
`battle.agentContext.deployedGuardrails` (e.g. `stopLoss`,
`trailingStop`, `maxSectorWeight`) and can force a SWAP or block one.
**But the source data is `agent.deployedStrategy.guardrails`, not
`agent.activeRules`** — guardrails are produced by the
`compile-dimensions.js` pipeline (Season Laboratory experiments), not
by the Forge rule library. See Q4 / Q5.

A parallel hardcoded layer is `api/_utils/agentRiskManager.js`
(`evaluateRisk()`), which runs *before* Haiku and applies fixed rules
(bust avoidance at -0.85 ATR, VWAP failure exits, etc.). It does not
read user rules either.

### Rule parameters

Each param entry is the slider/picker schema. Live example from
`forgeKnowledgeBase.js:46`:

```js
threshold: {
  type: 'number',
  default: 30,
  min: 15, max: 45,
  step: 5,
  unit: 'RSI',
  label: 'Oversold threshold',
  hint: 'RSI level below which a stock is considered oversold. ...',
}
```

Param types observed: `number`, `integer`, `toggle`, `select` (with
`options: [{ value, label }]`), `enumNumber`, `enum`. The slider UI
clamps to `[min, max]` with `step`. Values are stored as
`paramValues` on the rule doc when the user adds it to a bundle —
see `useForge.js:345–356`.

The screenshot example "Oversold threshold: 30 RSI → 35 RSI" is
captured at the *collection* level via
`paramOverrides: { threshold: 35 }` on the collection's rule entry
(`forgeCollections.js:29` for swing-trader). When the user clicks
"Use This Playbook," those overrides get persisted as the rule's
`paramValues` (`useForge.js:196–207`).

### "Use This Playbook" code path

`CollectionDetailSheet.jsx:524` button → `onUsePlaybook(collection)`
prop → `ForgeScreen.jsx:691` → `handleUsePlaybook()` at
`ForgeScreen.jsx:179–221`.

What it does, step by step:

1. Read `collection.progressionHints[level]` to get
   `activeCount` (e.g. starter = 7) — rookies/starters get a partial
   bundle, partners get the full 9-rule set.
2. Sort rules by `priority` ascending (1 = Core Strategy → 4 =
   Mastery).
3. For each rule, call
   `forge.addRuleToBundle(template, paramOverrides, { status:
   addedIndex < activeCount ? 'active' : 'queued', priority })`.
4. `forge.addRuleToBundle()` at `useForge.js:325–376` writes a new
   rule doc under `agents/{agentId}/rules/` with
   `source: 'forge_discover'`, `sourceRef: template.id`,
   `paramValues: overrides`, then appends `ruleId` to the active
   *draft* bundle (created if none exists, named `'My Strategy'`).
5. Toast: "Swing Trader Playbook created!" or "... 7 active, 2
   queued".

Net effect: a **new draft bundle is filled with rules**. The bundle
is NOT auto-forged/equipped — the user still has to go to My Bundles
and click Forge → Equip before the rules become `activeRules` on the
agent doc.

### "Merge these rules into New Strategy" code path

`CollectionDetailSheet.jsx:541` button →
`onMergeIntoBundle(collection)` → `ForgeScreen.jsx:693` →
`handleMergeIntoBundle()` at `ForgeScreen.jsx:224–234`.

Logic is simpler than "Use This Playbook":

- For each rule in `collection.rules`, if not already collected
  (deduped by `sourceRef`), call `forge.addRuleToBundle(rule,
  paramOverrides)` with **no status/priority hints**.
- Toast: `Merged ${title} rules into bundle!`.

This appends to the existing **first draft bundle** (the same active
bundle in the LoadoutDropdown). It does **not** apply
`progressionHints` — all merged rules land as active. Hits the
`maxRulesPerBundle` cap eventually (`forgeService.js:302`).

### Is the output a Strategy or an Agent?

The output of both actions is a **Bundle** in
`agents/{agentId}/bundles/{bundleId}`. Bundle is what the user calls a
"Strategy" in the UI (default name `'New Strategy'` on creation:
`useForge.js:430`). The bundle moves through states:

`draft` → `forged` (snapshot rules frozen) → `equipped` (rules
become `agent.activeRules`) → optionally `archived`.

See `forgeService.js:257–456` for the CRUD.

---

## Q2. Strategy

### What is a Strategy?

Two related but distinct concepts share the word "Strategy" in the UI,
and the codebase doesn't help by overloading the term:

**1. Strategy-as-Bundle (the Mech Bay's notion).**
A bundle of Forge rules. Definition at
`forgeService.js:257–279`. Bundle name defaults to
`'New Strategy'` (`useForge.js:430`) or `'My Strategy'`
(`useForge.js:332`). Bundle doc shape:

```js
{
  name: 'New Strategy',
  version: 1,
  previousVersionId: null,
  status: 'draft' | 'forged' | 'equipped' | 'archived',
  ruleIds: [],
  ruleSnapshots: [],              // frozen on forge
  conflictCheckResult: null,
  createdAt, forgedAt, equippedAt, archivedAt,
  performanceData: { battlesEquipped, totalCitations, ... },
  hiddenFromBundleList?: boolean, // ephemeral dimension-sourced bundles
}
```

Storage: `agents/{agentId}/bundles/{bundleId}` in Firestore. Read in
`useForge.js:130–188`.

**2. Strategy-as-DeployedStrategy (the Laboratory's notion).**
A *named experiment* deployed to the live agent. Lives at
`agent.deployedStrategy` on the agent doc. Created by
`src/services/deployStrategyService.js` after a Season experiment
completes. Shape (lines 152–167):

```js
{
  experimentId, experimentName, seasonId,
  bundleId,                         // points at the bundle below
  dimensionValues, dimensionHash,
  directives: [...],
  guardrails: [...],                // ← consumed by applyGuardrails
  sourceCollection, forgeScore, alpha, rank,
  deployedAt: '<ISO>',
  schemaVersion,
}
```

When a Season experiment is deployed, `deployExperimentToAgent()`
first equips a bundle (so `activeRules` is populated for Haiku) and
then writes `deployedStrategy` metadata. The deployed strategy's
`guardrails` is the data structure consumed by the deterministic
guardrail layer in `agent-evaluate.js:869`.

### Differences

| Aspect            | Bundle (Mech Bay)         | DeployedStrategy (Laboratory) |
|-------------------|---------------------------|-------------------------------|
| Source data       | Forge rules + `paramValues` | Dimension sliders (`stopLossPct`, etc.) |
| Authored via      | Mech Bay accordion / Playbook | Workshop Chat → Compile / Season Entry Modal |
| Persisted at      | `agents/{id}/bundles/{bid}` | `agents/{id}.deployedStrategy` |
| Reaches Haiku as  | `activeRules[]` in prompt | `directives[]` (also prompt) |
| Reaches executor as | n/a                     | `deployedGuardrails[]` (hard override) |
| Lifecycle states  | draft → forged → equipped → archived | Tied to experiment lifecycle |
| Multiple allowed  | Yes — up to `FORGE_LIMITS[level].maxBundles` (5 at any level) | Implicitly one (single object on agent) |

A deployed-strategy bundle is created by Compile/Deploy with a
deterministic `bundleId` (dimension hash) and the
`hiddenFromBundleList: true` flag so it doesn't show up in My
Bundles. See the audit-note at `forgeService.js:202–204`.

### Multiple Strategies?

Yes — for the bundle-Strategy. `FORGE_LIMITS` at
`agentProgression.js:53–57`: max 5 bundles per agent at all levels;
`maxRulesPerBundle` rises from 10 (rookie) → 20 (partner). Bundles
beyond 5 require archive-first.

LoadoutDropdown (`AgentIdentityCard.jsx` → `LoadoutDropdown.jsx`)
exposes the bundle library to the user as a Destiny-style picker on
the Mech Bay's left pane.

For deployedStrategy: only one at a time. Re-deploying replaces it
(`deployStrategyService.js:113–121`).

### How does a Strategy get equipped?

Bundle equip flow (`forgeService.js:387–456`, called from
`useForge.js:493–506`):

1. Read agent doc; reject if `agent.activeBattleId` is set (no equip
   mid-battle).
2. Bundle must be in `forged` status.
3. Read snapshots from all currently-equipped bundles + the new one,
   merge into a single `activeRules` array. Each entry is shaped:
   `{ ruleId, text, textTemplate, params, paramValues, category,
   bundleName }` (`forgeService.js:433–441`).
4. Batch write: bundle.status = `equipped`, agent doc gets
   `equippedBundleIds: [...prev, bundleId]` and `activeRules`
   (overwritten with the merged set).

Battle creation in `agentBattleService.js:114–135` snapshots
`agent.activeRules` and `agent.equippedBundleIds` into
`battle.agentContext` so the rules are frozen for the duration of the
battle.

### Strategy slot under Agent DNA vs Strategy library?

**Different concepts despite the shared word.** "Strategy" under
Agent DNA is the middle of three trait *groups* defined in
`src/data/dnaGroups.js:18–26`:

```js
strategy: {
  id: 'strategy',
  name: 'Strategy',
  description: 'How your agent thinks about the game',
  icon: 'Brain',
  color: '#F59E0B',
  categories: ['fundamental', 'game_state', 'threshold'],
  maxTraits: 2,
}
```

It's a *grouping label* over a set of rule categories, and you equip
up to 2 traits from that group's `STRATEGY_TRAITS` list (5 traits, see
Q3). It has no relationship to the user's bundle library; "Strategy"
here is closer in meaning to "thought patterns" than to a saved
strategy preset.

---

## Q3. Agent DNA

### Data shape

DNA = three named groups, each with a fixed slot capacity. Defined
statically at `src/data/dnaGroups.js`:

```js
DNA_GROUPS = {
  instincts:  { categories: ['technical', 'tier_strategy'],
                maxTraits: 2, color: '#5EEAD4', icon: 'Eye'    },
  strategy:   { categories: ['fundamental', 'game_state',
                             'threshold'],
                maxTraits: 2, color: '#F59E0B', icon: 'Brain'  },
  discipline: { categories: ['risk', 'allocation', 'mid_battle'],
                maxTraits: 2, color: '#EF4444', icon: 'Shield' },
};
```

Total slots = 6 (`TOTAL_TRAIT_SLOTS` at line 47). Each group's
`categories` list defines which Forge rule categories belong to that
DNA bucket.

Persistence: `agent.equippedTraits[]` on the Firestore agent doc.
Each entry is `{ traitId, strength, isCustom, equippedAt }`
(`useTraits.js:208–214`).

### Available traits per slot

Traits are defined in `src/data/traitLibrary.js`. **16 traits
total**, partitioned across the three DNA groups:

- `INSTINCT_TRAITS` (`traitLibrary.js:17–189`): 6 traits — Trend
  Rider, Bargain Hunter, Squeeze Whisperer, Volume Believer,
  Breakout Chaser, Smart Money Tracker.
- `STRATEGY_TRAITS` (`traitLibrary.js:191–319`): 5 traits —
  Threshold Harvester, Dual Conviction, Score Adaptor, Sector
  Rotator, Penalty Dodger.
- `DISCIPLINE_TRAITS` (`traitLibrary.js:325–456`): 5 traits — Iron
  Discipline, Patient Holder, Active Trader, Diversifier, Let
  Winners Run.

`TRAIT_LIBRARY` is the concatenation at line 462; `TRAIT_BY_ID` is a
lookup map at line 469.

### Trait data shape

From `traitLibrary.js:18–44`:

```js
{
  id: 'trait-trend-rider',
  name: 'Trend Rider',
  identityStatement: 'Trusts the trend and buys the pullback',
  dnaGroup: 'instincts',
  icon: 'TrendingUp',
  source: 'library',
  tags: [...],
  ruleIds: ['tech-moving-average-trend', 't-09', 'tv-01'],
  strengthProfiles: {
    subtle:   { 'tech-moving-average-trend': { ... }, 't-09': { ... }, ... },
    moderate: { 'tech-moving-average-trend': { ... }, ... },
    dominant: { 'tech-moving-average-trend': { ... }, ... },
  },
}
```

A trait is **a named bundle of 2–4 Forge rules with three preset
parameter profiles** (subtle / moderate / dominant). Equipping a
trait at, say, "moderate" strength means: take its `ruleIds`, look
up each template, and add it to the bundle with
`paramOverrides = strengthProfiles.moderate[ruleId]`.

So traits are **not a new construct in the agent runtime** — they're
a UI layer on top of Forge rules.

### Trait selection effect on agent behavior

`useTraits.equipTrait()` (`hooks/useTraits.js:141–224`) is the entry
point. The pipeline:

1. Check slot availability against `DNA_GROUPS[group].maxTraits`.
2. Look up `strengthProfiles[strength]` for the chosen strength.
3. For each `ruleId` in the trait, find the template in
   `FORGE_RULE_TEMPLATES` and call
   `forge.addRuleToBundle(template, paramOverrides, { status:
   'active', priority: 1, traitId })`.
4. "Last Equipped Wins" — if two traits share a `ruleId`, the most
   recent equip overrides the earlier one's params, and the earlier
   trait is flagged `isCustom: true`.
5. Persist the trait entry into `agent.equippedTraits`.

Because the only on-the-wire change is "more rules in the bundle,"
agent behavior change is the same as adding rules manually — pure
prompt material, ranked by category as CONSTRAINTS vs STRATEGY
PREFERENCES in Haiku's eval prompt. There is **no trait-aware
executor** anywhere in `api/`.

There's also a bonus layer: `src/data/traitCombos.js:11+` defines
emergent "Class Titles" (e.g. "Disciplined Surfer", "Volatility
Harvester") that appear over the mech when specific trait pairs are
equipped. Pure UI flavor — combos affect the displayed class title
and gradient, not Haiku or the cron.

### Robot's three colored indicator rows

This is the most common misread of the UI. The robot itself
(`MechSVG.jsx`) doesn't have three DNA-coded indicator rows — it
takes a single `primaryGlow` and `visorColor` derived from the
*dominant* and *secondary* DNA groups (`getMechColors.js:23–46`).
The colored rows the user is seeing are almost certainly the **fill
bars inside each `DNAGroupCard`** (`DNAGroupCard.jsx:61–69`): a
3px-tall bar colored by `group.color`, filled by
`equippedRuleCount / totalRulesInGroup`. Three cards stacked
vertically → three colored bars.

There's also the **`DNASocketMatrix`** (`AgentIdentityCard` →
`DNASocketMatrix.jsx`), which renders 6 pips (2 per group) in a
single horizontal row, lit/dimmed by `equippedTraits` filling each
group's slots. So the answer depends on whether the screenshot shows
3 horizontal bars (DNAGroupCard) or 1 row of 6 pips (DNASocketMatrix).

Both are **stateful** — they react to `slotUsage` derived from
`equippedTraits`.

---

## Q4. Connection to Agent Battles

### Are Playbook rules the same as `activeRules`?

**Not directly — but they become `activeRules` through the bundle
equip pipeline.**

Playbook rules live in `forgeCollections.js` as static definitions.
"Use This Playbook" copies them into a draft bundle. Forging the
bundle freezes a `ruleSnapshots[]` array. Equipping the bundle
expands `ruleSnapshots[]` into the agent doc's `activeRules[]`
(`forgeService.js:417–441`). Trait equipping reaches the same
endpoint via `useForge.addRuleToBundle()`.

`activeRules` shape on the agent doc and in
`battle.agentContext.activeRules`:

```js
{
  ruleId, text, textTemplate, params, paramValues,
  category,        // critical for the CONSTRAINTS/STRATEGY split
  bundleName,
}
```

### How rules reach `agentContext.activeRules` at battle creation

`agentBattleService.js:114–135` snapshots the agent doc into
`battle.agentContext`:

```js
agentContext: {
  agentName: agentData.name || 'Agent',
  archetype: agentData.archetype || 'unknown',
  strategyBrief: agentData.lastDecision?.strategyBrief || '',
  innerMonologue: agentData.lastDecision?.innerMonologue || {},
  activeRules: agentData.activeRules || [],
  equippedBundleIds: agentData.equippedBundleIds || [],
  deployedGuardrails: Array.isArray(agentData.deployedStrategy?.guardrails)
    ? agentData.deployedStrategy.guardrails
    : [],
  riskTolerance: agentData.config?.risk || 50,
  evaluationInterval: 15,
  consolidatedInsight: agentData.consolidatedInsight || null,
  initialPortfolio: { star: ..., core: ..., support: ... },
}
```

So at the moment of battle creation, the agent's `activeRules` (the
merged snapshot of all equipped bundles) plus the `deployedStrategy
.guardrails` plus the `archetype` are frozen onto the battle.

`agent.activeRules` itself is written exclusively by
`equipBundle()` / `unequipBundle()` in `forgeService.js`. There is no
trait-direct or playbook-direct write — those go through bundles.

### Does the user's Strategy/Playbook/DNA reach the agent at battle
start, mid-battle, or both?

- **At battle start (Sonnet/Haiku strategy & portfolio call,
  `api/agent/decide.js`):** The strategy and portfolio LLM calls use
  `buildSystemPrompt()` (`agentPromptAssembly.js:25–100`) which reads
  `agent.activeRules` and splits them into CONSTRAINTS / STRATEGY
  PREFERENCES.
- **Mid-battle (every 15-minute eval, `api/cron/agent-evaluate.js`):**
  `buildAgentIdentityBlock()` and the eval system prompt
  (`agentEvalPromptAssembly.js:170–293`) re-render the same rule set
  from `battle.agentContext.activeRules`. Frozen at battle-creation —
  swapping bundles mid-battle is blocked by `agent.activeBattleId`
  check (`forgeService.js:395–397`).
- **Guardrails post-Haiku:** `applyGuardrails()` runs after every
  Haiku eval response and may force a SWAP/HOLD override based on
  `battle.agentContext.deployedGuardrails`.

So Forge rules influence Haiku at both phases as prompt text;
deployed-strategy guardrails additionally hard-enforce at the
executor layer; nothing else from Playbooks/DNA reaches the runtime.

### Deterministic execution vs prompt-material

| Layer                  | File                          | Source of truth          | Deterministic? |
|------------------------|-------------------------------|---------------------------|----------------|
| Risk Manager           | `agentRiskManager.js`         | Hardcoded constants       | Yes — runs pre-Haiku |
| Trigger Gate           | `agentTriggerGate.js`         | Hardcoded thresholds      | Yes — gates Haiku |
| Forge rules (CONSTRAINTS/STRATEGY) | `agentEvalPromptAssembly.js` | `battle.activeRules`     | No — prompt text only |
| Guardrails             | `agentGuardrails.js`          | `battle.deployedGuardrails` | Yes — post-Haiku override |
| Locks (near threshold) | `agent-evaluate.js:917`       | `lockedPositions` set     | Yes — blocks Haiku SWAP_OUT of locked symbol |

Notably, the Risk Manager has its own hardcoded -0.85 ATR bust buffer
and VWAP-failure logic — it does **not** read any user rules. Same
for the Trigger Gate's threshold-proximity detector.

### MID_BATTLE / THRESHOLD categories → code paths?

These are **organizational labels** in `FORGE_CATEGORIES`. They drive:

- UI grouping in the Mech Bay accordion (`CATEGORY_ORDER` at
  `useForge.js:39–46`).
- DNA group assignment (e.g. `threshold` → "Strategy" group via
  `dnaGroups.js:24`).
- The CONSTRAINTS vs STRATEGY-PREFERENCES split in prompt assembly
  (`agentEvalPromptAssembly.js:255` — only `risk` and `allocation`
  are CONSTRAINTS; everything else is STRATEGY).
- The `institutional` category triggers an extra prompt block
  (`C_INST` data-lag warning) at `agentEvalPromptAssembly.js:274–283`.

There are **no per-category code paths in the eval cron** beyond
those. A `mid_battle` rule named "Stop the churn" with `swaps: 2,
window: 60, freeze: 45` parameters is just rendered as the
interpolated sentence: *"If 2 or more swaps are executed within 60
minutes, disable non-emergency evaluations for 45 minutes"* — Haiku
reads it and decides whether to honor it.

---

## Q5. Forge / Laboratory ecosystem

### Laboratory

A **page-level shell**: `src/components/Forge/ForgeLanding.jsx`,
header reads "The Forge" with "Strategy Laboratory" beneath it
(`ForgeLanding.jsx:2130–2143`). Three sibling pill tabs (line
2081–2085):

```js
TABS = [
  { id: 'discover',   label: 'Discover',   Icon: Compass },
  { id: 'laboratory', label: 'Laboratory', Icon: Beaker  },
  { id: 'advanced',   label: 'Advanced',   Icon: Hammer  },
];
```

The "Laboratory" tab is state-aware (`getLandingState()`,
`ForgeLanding.jsx:111–116`):

- `new` — no experiments yet, no deployed strategy. Shows
  `NewUserHero` with "Build Strategy" / "Configure Manually" CTAs.
- `testing` — `activeExperiment` running. Shows `TestingView`
  cards.
- `results` — last experiment completed, nothing deployed. Shows
  `ResultsView` with Deploy / Refine / Review buttons.
- `deployed` — `agent.deployedStrategy` is live AND its bundle is
  still in `equippedBundleIds`. Shows `DeployedView`.

The "Advanced" tab renders `ForgeScreen` full-bleed
(`ForgeLanding.jsx:2068–2078`) and passes
`laboratoryOnBack={() => setView('laboratory')}` — this is what
produces the "Back to Laboratory" breadcrumb at
`ForgeScreen.jsx:430–449` and `:815–834`.

### Intel Codex

`src/components/Forge/IntelCodex.jsx` — a **rule encyclopedia**.
Two-pane on desktop, full-screen on mobile:

- Left/top: `RuleDirectory` (`RuleDirectory.jsx`) — lets the user
  toggle between `library` (all 143 FORGE_RULE_TEMPLATES grouped by
  category) and `myRules` (user-added rules split into Discover-
  sourced vs private/custom).
- Right/bottom: `RuleDossier` — long-form view of a selected rule
  with refine/delete CTAs and a "Found In" panel
  (`ruleRelationships.js`) showing which traits + collections contain
  this rule.

It's reachable only inside the Advanced (Mech Bay) tab
(`ForgeScreen.jsx:624–629`).

### Proving Grounds

Aliased to `StatsTab`: `ProvingGroundsTab.jsx` re-exports `StatsTab`
verbatim (3 lines, `:5`). `StatsTab.jsx` is a **performance
dashboard**, not a backtest engine — it shows per-bundle and per-rule
citation stats aggregated from agentBattles evaluation data
(`StatsTab.jsx:2–3`). Loaded lazily when the user opens the Proving
Grounds tab (`useForge.js:217–222`).

The screenshot's claim that "Advanced Rules power your Proving
Ground simulations" is **aspirational / misleading**. There is no
simulation runner in the codebase. The Proving Grounds tab is a
read-only stats view based on real battle data, not a backtest.

The **real "simulation"** is the Season Experiment system —
`src/components/Season/SeasonEntryModal.jsx` + the
`api/season/create-entry.js` flow. Each "experiment" is a 4-week
live-data run with a configured strategy (dimension values), and
that's the surface labeled "Proving Ground" on the marketing
side of the spec docs (`SIGNAL_DROP_V2_SPEC.md`, etc.). Don't
confuse the in-Mech-Bay "Proving Grounds" tab with the Laboratory's
real experiment infrastructure.

### Tab relationships

- **Laboratory (page)** is the wrapper; Discover / Laboratory /
  Advanced are its child views.
- **Discover** = `DiscoverPanel.jsx` (Themes, Sectors, Signal Drop
  entry).
- **Laboratory (inner)** = state-driven hero / experiment cards /
  Workshop CTA.
- **Advanced** = `ForgeScreen.jsx` (Mech Bay) which has its own
  **The Forge / Intel Codex / Proving Grounds** sub-tabs
  (`ForgeScreen.jsx:39–43`).

So "The Forge" appears at two different levels: the page-level
"Forge" heading and the inside-Mech-Bay sub-tab. Both legitimately
exist.

### Mech (robot) — stateful or static?

Stateful. `src/components/Forge/MechSVG.jsx`:

- Receives `state` (`dormant` / `idle` / `editing` / `equipping`),
  `primaryGlow`, `visorColor`, `glowIntensity`, `reactPulse` props.
- Renders breathing animation, blinking eyes (random 5–8s,
  `MechSVG.jsx:43–66`), happy/thinking expressions, color-flash
  pulses on rule add/remove (`mechReactPulse` state from
  `ForgeScreen.jsx:268`).
- Colors are computed from DNA distribution in `getMechColors.js`:
  primary glow = dominant group color (most slots filled), visor =
  secondary group color. Empty DNA → muted "standby" colors.
- Has a "scroll-away" behavior on mobile: as the user scrolls,
  mech fades out and a 48px-tall `MechVisorStrip.jsx` slides in with
  the class title + active bundle name
  (`ForgeScreen.jsx:88–89, ForgeScreen.jsx:1144` and friends).

---

## Q6. Watchlist / SignalDrop

The vocabulary is split. There are **two unrelated things called
"watchlist"** in this codebase, and a third inactive concept called
SignalDrop that wraps user-curated watchlists:

### `battle.watchlist.hotBench` — auto-populated, in-battle

Construction: `api/agent/decide.js:244–272`. After Sonnet's
strategy call yields a 25–35 ticker shortlist, the agent's
`watchlist` is built as:

```js
watchlist = {
  active: portfolioTickers,        // current portfolio
  hotBench: shortlist.filter(not-in-active).slice(0, 15),  // strategy backup
  monitoring: top baggerBombFit not-in-active-or-hotBench .slice(0, 18),
  lastRefreshed, totalStocks,
}
```

This object is written to `agent.lastDecision.watchlist` and copied
onto the battle at creation (`agentBattleService.js:152–159`). It's
the symbol pool the mid-battle eval pulls prices for
(`agent-evaluate.js:221`) and `agentSwapExecution.js:36–55` enforces
that any SWAP-IN must come from bench or hotBench. It auto-refreshes
each new trading day inside the cron
(`agent-evaluate.js:388–428`).

This is **NOT user-authored**. The user has no UI to pick what
goes in `hotBench`.

### SignalDrop — user-authored, currently *not* a saved watchlist

There **is** a feature called Signal Drop / Watchlist Workshop in
production today. Entry surface: `src/components/SignalDrop/
SignalDropEntry.jsx` (modal launched from `DiscoverPanel`,
`DiscoverPanel.jsx:314, 354`). Pipeline:

1. User pastes text / URL / image into the modal.
2. `POST /api/forge/parse-signal` (`api/forge/parse-signal.js`)
   runs a Haiku tool-use call to extract topic, tickers, sentiment,
   horizon, etc. Writes to `users/{uid}/signalDrops/{dropId}` and a
   `signalDropCache` (contentHash-keyed 6h TTL).
3. User enters a phased Gemma dialogue
   (`SignalDrop/WatchlistChat.jsx` ↔ `POST /api/forge/watchlist-
   dialogue`). 4 phases: `explore` → `propose` → `refine` →
   `finalize`. Session tracked in `watchlistSessions` collection
   with a 20-message budget.
4. The dialogue produces a `candidateTickers[]` list and an
   "anatomy" (thesis + activation/invalidation conditions + slotted
   ticker reasoning).

**The save step does NOT exist yet.** Comment at
`api/forge/watchlist-dialogue.js:9` is explicit:
*"…the (yet to ship) Phase 4 save endpoint will turn into a
`dropLists` doc."* `SIGNAL_DROP_V2_SPEC.md:136–162` describes the
intended `watchlists` collection shape, but no API or UI wires it
in. A `users/{uid}/signalDrops/{dropId}` record persists during the
dialogue, but there's no view of saved watchlists, no "My
Watchlists" rail on Discover, no Workshop seedContext branch for
saved watchlists (the `'watchlist'` kind is listed in
`VALID_SEED_KINDS` at `workshop-chat.js:46` but no caller emits it
for a saved-watchlist source).

### Relationship between the two

**No direct relationship today.** The in-battle `hotBench` is
auto-computed by Sonnet from the universe; the user-authored
SignalDrop dialogues never persist as a saved watchlist and never
feed `agent.lastDecision.watchlist`. The conceptual goal in the V2
spec is to make Signal Drop watchlists feed something, but that
ship hasn't sailed.

There's also a legacy `userWatchlist` parameter accepted by
`api/_utils/intelligencePrompt.js:727–728` (the
intelligence/research prompt path), but no caller actually passes a
user-curated list — only `[]` or undefined. It's a hook that exists
but isn't wired to a real watchlist source.

---

## Q7. Things you didn't ask about

### A second-source-of-truth Strategy pipeline

The Strategy Laboratory's actual artifact is **not a Forge bundle**
— it's `DIMENSION_VALUES` produced by `compile-dimensions.js`. The
Workshop Chat → Compile → Season Entry pipeline:

1. User talks to Gemma in `WorkshopChat.jsx`, ending with a
   `latestThesis` JSON.
2. `POST /api/forge/compile-dimensions` (`compile-dimensions.js`)
   calls Haiku to map the thesis to `DIMENSION_SCHEMA` values
   (e.g. `riskPosture.stopLossPct: 8`, `entryAggression.rsiCeiling:
   65`). 7 dimensions, ~25 params total.
3. Season Entry Modal renders `StrategyDimensions.jsx` sliders
   pre-filled from those values.
4. On Season start, the dimension values get baked into a
   *deterministic-id* bundle (hidden from My Bundles via
   `hiddenFromBundleList: true`).
5. On Deploy, `deployStrategyService.js:152–167` produces
   `agent.deployedStrategy` with `guardrails: [...]` derived from
   the dimensions.
6. `agent-evaluate.js:869–915` reads `deployedGuardrails` and runs
   `applyGuardrails()` — the only path that turns user data into a
   **deterministic post-Haiku override**.

This pipeline is conceptually parallel to (and architecturally
separate from) the Mech Bay's rule/bundle pipeline, even though both
end in `agent.activeRules` being populated. A loadout system design
needs to be aware that **two parallel concepts of "the user's
strategy" exist**:

- **Bundle-Strategy** (Mech Bay) — rules with `paramValues`, only
  affects Haiku via prompt.
- **Dimension-Strategy** (Laboratory) — dimension sliders, affects
  Haiku via `directives` AND the executor via `guardrails`.

### Per-rule progression and "queued" status

Rules support a `status: 'active' | 'queued'` field
(`useForge.js:353, 201`) for progression-gated playbooks. Rookie
agents only see the top 3–5 priority-1 rules; the rest are
"queued" until the user levels up. This is consumed in
`CollectionDetailSheet.jsx:170–195` ("Use This Playbook (5 of 9
active)") but is not surfaced anywhere else in the UI — neither
My Bundles nor MyRules call out queued rules visually.

### Trait Combos as "Class Titles"

`src/data/traitCombos.js` defines 12+ emergent "Class Title"
combos triggered by specific trait pairs. E.g.
`bargain-hunter + let-winners-run` → "Contrarian Diamond Miner".
First-match-wins. Used only for the displayed title under the mech
and the LoadoutDropdown's mech gradient. Pure UI flavor.

### `agent-batch-review` → `forgeSuggestions[]`

`api/cron/agent-batch-review.js:320–337` shows that the post-battle
auto-debrief writes proposed Forge rules into
`agent.forgeSuggestions[]` (status: `'pending'`). The
`agentBattleService` includes them, but there's no UI surface that
*displays* `forgeSuggestions[]`. The `voiceLayerPrompt.js:344`
comment confirms the channel is intended:
*"Rules go to agent.forgeSuggestions[]"* — but a "review and
accept these suggestions" UI is not in this codebase. Hidden
half-built feature.

### "Open Chat" rule injection

`api/agent/chat.js:447` and `src/components/Agent/OpenChatPanel.jsx:89`
allow the user to chat with the agent during a battle and have the
agent propose a directive (text only) which the user can accept;
accepted directives go into `agent.directives[]`. But
`voiceLayerPrompt.js:344` says:
*"NEVER write to agent.directives[]. That channel is deprecated.
Lessons go to agent.lessons[]. Rules go to agent.forgeSuggestions[]."*

So `directives` is half-deprecated, half still-used, depending on
which writer you look at. `useAgent.activeDirectives`
(`useAgent.js:107–124`) still reads them. There are also
`agent.lessons[]` (consolidation cycle output) — another writeable
agent-level memory that isn't surfaced as a loadout-style construct.

### Bundle "queued" vs "active" rules

The rule doc shape supports a `status: 'active' | 'queued'` field
on individual rules. Queued rules are stored in the bundle but get
*excluded* from `ruleSnapshots[]` during forge (no — actually they
**are** included; see `forgeService.js:355–363`). The eval prompt
doesn't filter on status. So "queued" today is effectively a UI-
only label. Worth noting if loadout design wants to lean on this.

### `deployedStrategy.directives[]`

Separate from `agent.directives[]` (the half-deprecated chat-write
channel), `deployedStrategy.directives[]` is a **frozen** list of
directives produced by the experiment-deploy flow
(`deployStrategyService.js:159`). These are NOT injected into the
eval prompt by `agentEvalPromptAssembly.js`; they appear to be
metadata-only as of now. Loadout design should clarify whether the
intent is to inject deployed directives at eval time (currently no
code path does).

### Ephemeral / hidden bundles

`bundle.hiddenFromBundleList: true` is set on dimension-sourced
ephemeral bundles created by the Compile/Deploy path. They're
filtered out in `useForge.js:140, 167, 204` so they don't show up
in My Bundles or pollute Forge analytics. This is the mechanism
that lets the Strategy Laboratory write into the same
`agents/{id}/bundles/` collection without colluding with the
user's manual library. Worth knowing if loadout design wants to
unify both.

### Mode toggle (clash / season / all)

The Mech Bay accordion supports a `forgeMode` toggle
(`ForgeScreen.jsx:72–84`) that filters categories and rules by
mode (`clash` / `season` / `all`). Persisted in localStorage. So
the *same* Forge rule library serves two completely different game
modes; season-only categories (`entry_criteria`, `exit_stops`,
`rebalancing`, `season_state`) are scoped to Season experiments.

### Conflicts & relationships

`FORGE_CONFLICT_PAIRS` (referenced in
`ForgeScreen.jsx:243–261` but not visible — needs verification) and
`SEASON_CONFLICT_PAIRS` (`forgeKnowledgeBase.js:21–28`) provide
soft conflict warnings when a user adds two opposing rules.
`src/data/ruleRelationships.js` builds a "Found In" index used by
Intel Codex to show "this rule is in 3 traits and 2 collections."

### Archetype

`api/_utils/agentArchetypeConfig.js` defines hardcoded archetype
configs (`momentum_chaser`, `analyst`, etc.) — each with risk
overrides (`bustBuffer`, `vwapFailureTicks`), conviction modifiers,
and preferred regimes. The archetype is an agent-creation choice
that lives at `agent.archetype` and isn't currently editable
through the Forge surface. **It's a separate axis of agent
customization** that operates orthogonally to Playbooks/DNA/
Strategy — affecting the deterministic risk manager directly
rather than through prompt material.

### `StarterKit`

`src/components/Forge/StarterKit.jsx` is a 3-question onboarding
flow (style / risk / allocation → preset rules) gated by
`agent.starterKitCompleted` (`ForgeScreen.jsx:308–314`). Creates
the user's first bundle without any AI cost — purely hardcoded
question-to-rule mapping (`StarterKit.jsx:14–48`). Could be
relevant if loadout onboarding needs to reuse the question framing.

### Test/scripts directory references

The legacy `MyBundlesTab.jsx:1–3` comment notes:
*"DEPRECATED: Replaced by BundleStrip + CategoryAccordion in
ForgeScreen (Phase 1 Mech Bay). Kept for rollback purposes."*
Same for `DiscoverTab.jsx:1–3`. So the current Mech Bay has gone
through a Phase 1 redesign and the older flat-list "Discover"
view is intentionally preserved for rollback — there's some
architectural turbulence in this area that loadout design should
budget for.

---

## Summary of system shape

- **Two parallel "Strategy" pipelines exist** — *Forge bundles*
  (Mech Bay rules) and *DeployedStrategy* (Laboratory dimensions).
  Both end up on the agent doc; only the second hard-overrides
  Haiku via guardrails.

- **Playbooks, Traits, and DNA are all UI sugar over the same
  underlying `forgeRules` table.** Every visible knob (Playbook
  click, Trait equip, DNA slot fill) ultimately writes rule docs
  with `paramValues` to a bundle. Differences exist in *how* the
  rules are grouped and presented, not in *what* reaches Haiku.

- **Rules are prompt-material, not executable code.** Only
  `agentGuardrails.js` (deployedStrategy-fed),
  `agentRiskManager.js` (hardcoded), `agentTriggerGate.js`
  (hardcoded), and the locked-position check
  (`agent-evaluate.js:917`) deterministically override Haiku. The
  rest of the rule library influences trades through the
  CONSTRAINTS/STRATEGY split in the LLM prompt.

- **Connection from Forge to battle is asynchronous and bundle-
  mediated.** Bundle equip writes `agent.activeRules`; battle
  creation snapshots that into `battle.agentContext.activeRules`.
  Once a battle is active, you can't change your equipped bundles
  (`forgeService.js:395`).

- **Half-built loadout-adjacent features exist** —
  `agent.forgeSuggestions[]` (post-battle review proposes rules,
  no UI to accept them), the SignalDrop save endpoint (Phase 4
  not shipped), `deployedStrategy.directives[]` (computed but not
  injected into eval prompt), `agent.lessons[]` (consolidation
  output, no rule-equivalent surface).

- **Watchlists are bifurcated.** `battle.watchlist.hotBench` is
  auto-computed strategy backup and not user-authored.
  SignalDrop / Watchlist Workshop is user-authored but doesn't
  persist as a saved object yet. The two never meet in current
  code.

- **Laboratory > Advanced > Mech Bay > Forge** is the tab nesting.
  "The Forge" appears twice (top-level header and inner sub-tab).
  "Strategy" appears three times with three meanings (a bundle, an
  Agent-DNA slot, a deployedStrategy). Naming is the single
  biggest source of confusion in the system.

- **The visible robot is DNA-stateful but not DNA-encoded as 3
  rows.** Primary/secondary glow = top two DNA groups by slot fill;
  no per-group striping on the mech itself. The "3 colored
  indicator rows" the screenshots show are the DNAGroupCard fill
  bars beneath the mech, one per group.
