# Keystone Spec — Pre-Lock Verification Audit (Findings)

**Type:** Read-only discovery. No code modified, no commits, no branch created. Only this file was written.
**Repo:** `fashraf94/TradeSeven`
**Date:** 2026-05-29
**Method:** `rg` / `grep` / `git log` / `git show` / `sed -n` / file reads only.

---

## ⚠️ State / branch caveat (read this first — it conditions every line citation below)

The audit instructed "Stay on `main`." The working tree this audit ran against is the
session branch **`claude/optimistic-fermat-w6Kr2`** (HEAD = `05e1629`, the merge of PR #445
*forge-enforcement-keystone-discovery*). That HEAD is **strictly ahead of `main`**:

```
$ git rev-parse HEAD       → 05e1629  (PR #445 keystone-discovery merge)
$ git rev-parse origin/main → d40aee5  (PR #430)
$ git log --oneline HEAD..origin/main   → (empty: origin/main fully contained in HEAD)
```

The spec's cited line numbers (`agent-evaluate.js:637`, `:713`, `agentTriggerGate.js:90-113`,
`agentSwapExecution.js:61-64`) line up with **HEAD**, not `main` — i.e. the spec was authored
against the post-#445 state, not against `d40aee5`. To keep the audit honest I verified every
relevant file against `origin/main` with `git show`/`git diff`:

| File | main vs HEAD | What differs | Effect on this audit |
|---|---|---|---|
| `api/_utils/agentSwapExecution.js` | **IDENTICAL** | — | Q2/Q6 evidence valid on main verbatim |
| `api/_utils/agentRiskManager.js` | **IDENTICAL** | — | Q2 evidence valid on main verbatim |
| `api/_utils/agentArchetypeConfig.js` | **IDENTICAL** | — | Q4 evidence valid on main verbatim |
| `api/_utils/agentTriggerGate.js` | differs only at `:218` (Vera deepdive skip) | margin block `:90-113` **identical** | Q5 evidence valid on main verbatim |
| `api/_utils/agentBattleService.js` | +1 line at `:174` (`bankedBadgePoints`) | lines `:116`/`:154` unaffected (before `:174`) | Q3 evidence valid on main verbatim |
| `api/cron/agent-evaluate.js` | **+104 / −7** | Phase-3 anticipations, Phase-2 badge banking, day-1 calendar gate | **line numbers shift**; control flow identical |
| `api/agent/decide.js` | +11 / −3 | Vera deepdive filter, `supportedTerms` | `createAgentBattle` call unaffected |
| `vercel.json` | +4 | adds `agent-daily-scores` cron — **NOT** the `agent-evaluate` cron | Q1 cron schedule identical |

`agent-evaluate.js` is the only execution file whose **line numbers** move between main and
HEAD. The control flow is the same; only voice-layer / scoring lines were inserted above the
risk loop. Main equivalents for the load-bearing symbols:

| Symbol | HEAD (cited below) | `origin/main` |
|---|---|---|
| `evaluateRisk(` call | `:637` | `:609` |
| risk `executeSwapServer(` | `:713` | `:685` |
| `evaluateTriggers(` call | `:859` | `:831` |
| Haiku `validateTradeDecision(` | `:1031` | `:987` |
| Haiku `executeSwapServer(` | `:1084` | `:1040` |
| proposal `executeSwapServer(` | `:1516`, `:1601` | `:1419`, `:1504` |
| gameplan `executeSwapServer(` | `:1680` | `:1583` |

**All snippets below are pasted from the HEAD working tree** (which matches the spec's
citations). Where a fact is invariant across main↔HEAD it is flagged.

---

## Q1 — Is the `*/15` cron the ONLY thing that triggers a mid-battle evaluation?

**Plain answer: YES.** The realistic maximum evaluation cadence is **one Haiku pass per battle
per 15-minute cron tick**, only on weekdays 13:00–21:00 UTC. There is no websocket / realtime /
push path into agent swap or evaluation logic, and there is no intra-tick re-evaluation loop
(Haiku is called at most once per battle per tick). A faster path does **not** exist.

### Evidence

**1a. The `agent-evaluate` schedule (`vercel.json:137-140`) — identical on main and HEAD:**
```json
    {
      "path": "/api/cron/agent-evaluate",
      "schedule": "*/15 13,14,15,16,17,18,19,20,21 * * 1-5"
    },
```
→ every 15 min, hours 13–21 UTC (~09:00–17:00 ET), Mon–Fri ⇒ ceiling ≈ 9h × 4 = **36 ticks/day**.

**1b. Every caller of the swap/eval functions is inside the cron file.**
`rg -n "executeSwapServer|evaluateRisk|evaluateTriggers" --type js` (non-comment, non-test):
```
api/_utils/agentTriggerGate.js:20   export function evaluateTriggers(...)   ← definition
api/_utils/agentSwapExecution.js:102 export async function executeSwapServer ← definition
api/_utils/agentRiskManager.js:30   export function evaluateRisk(...)        ← definition
api/cron/agent-evaluate.js:637      const riskResult = evaluateRisk(         ← cron
api/cron/agent-evaluate.js:713      const riskSwapResult = await executeSwapServer( ← cron
api/cron/agent-evaluate.js:859      ... = evaluateTriggers(battle, ...)      ← cron
api/cron/agent-evaluate.js:1084     const swapResult = await executeSwapServer( ← cron
api/cron/agent-evaluate.js:1516     await executeSwapServer(                 ← cron (proposal)
api/cron/agent-evaluate.js:1601     await executeSwapServer(                 ← cron (proposal)
api/cron/agent-evaluate.js:1680     const gameplanSwapResult = await executeSwapServer( ← cron (gameplan)
```
All non-definition references elsewhere (`shadowLogger.js:127`, `voiceLayerPrompt.js:1574/2805`,
test files) are comments/tests. **No API route, no client service, no websocket handler calls
`executeSwapServer`/`evaluateRisk`/`evaluateTriggers`.**

**1c. `processAgentBattle` is only invoked from the cron handler (`agent-evaluate.js:121`):**
```js
        await processAgentBattle(db, battle, summary, startTime);
```
`grep -rn processAgentBattle` returns only this call site + the definition (`:157`) + comments.

**1d. The "swap" services that are NOT the agent path.** `grep` for swap-execution surfaced
`src/services/swapServiceV4.js`, `src/services/freeAgencyService.js`,
`src/components/freeAgency/shared/useSwapLogic.js`, `src/hooks/useBaggerBombBattleV4.js`.
These are the **human V4 game** (collection `battles`/`freeAgents`), not agents.
`agentSwapExecution.js:3-4` says so explicitly:
```js
// Writes to agentBattles collection (not battles).
```
and `:81` "Mirrors src/services/swapServiceV4.js:210-361 but adapted ... agentBattles collection."
Agents never swap through the client services.

**1e. The only websocket is a price feed, not an eval trigger** (`api/ws-config.js:1-2,28-29`):
```js
// Vercel Serverless Function - WebSocket Configuration
// Returns WSS URLs with embedded API token for client-side WebSocket connections
    stocksUrl: `wss://ws.eodhistoricaldata.com/ws/us?api_token=${API_KEY}`,
    cryptoUrl: `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${API_KEY}`,
```
This hands the EODHD market feed to the **client** for live prices. It does not call into swap/eval.

**1f. No intra-tick re-evaluation loop.** The handler iterates each battle once
(`agent-evaluate.js:108` `for (const battle of activeBattles)`), calls `processAgentBattle` once
per battle, and inside that function Haiku is awaited exactly once (`:895-916`). There is no inner
loop that re-wakes Haiku within a tick. (Note: multiple *swaps* can occur in one tick — see Q2 —
but only one *Haiku evaluation*.)

> Caveat worth recording for the frequency model: the deterministic **risk manager** and the
> **trigger gate** run *every* tick before Haiku; only the *Haiku* call is gated. So "evaluation"
> in the deterministic sense happens every tick; "Haiku evaluation" happens ≤1×/battle/tick.

---

## Q2 — Within a SINGLE tick, how many swaps can execute, and in what order vs `trades[]` writes?

**Plain answer:**
- **Maximum swaps per battle per tick is NOT 1.** In normal (autopilot) operation it is
  **(one forced rotation per active position that trips a risk action) + (one Haiku autopilot
  swap)** — i.e. potentially several, bounded only by portfolio size and bench-replacement
  availability. There is **no per-tick swap cap / circuit breaker anywhere in the code.**
- `trades[]` (with `swappedOutAt`) is written **immediately, per-swap, inside each
  `executeSwapServer` Firestore transaction** — *not* batched.
- **Within-tick visibility holds:** a circuit-breaker that reads `trades[]` (or `scoreState.tradeCount`)
  **would** see the first rotation's write before the second is executed — because (a) each
  `executeSwapServer` re-reads the live doc inside its own transaction, and (b) the risk loop
  re-reads the whole battle doc into memory after every risk swap. So Knob C's `trades[]`-derived
  count **can** bind within a tick **if the check is placed in the execution loop** (it reads
  post-write state, not a frozen pre-tick count).
- A Risk-Manager forced swap **AND** a Haiku swap **can both execute in the same tick** — nothing
  between them blocks Haiku.

### Evidence

**2a. `riskSwaps` is built across ALL active positions** (`agent-evaluate.js:614-653`):
```js
    const riskSwaps = [];
    const lockedPositions = new Set();
    ...
    for (const score of assetScores) {                 // ← every active position
      ...
      const riskResult = evaluateRisk(                 // :637  (main :609)
        { symbol: score.symbol, tier: asset?.tier, baseATR: score.baseATR },
        currentPrice, entryPrice, score.baseATR,
        intradaySnapshot,
        { ticksBelowVwap: vwapTicks[score.symbol] },
        presetConfig.risk
      );
      riskStatus[score.symbol] = riskResult;
      if (['EMERGENCY_SWAP', 'SWAP_OUT', 'TRAIL_STOP'].includes(riskResult.action)) {
        riskSwaps.push({ score, asset, riskResult });  // ← multiple can be pushed
      }
      if (riskResult.action === 'LOCK') {
        lockedPositions.add(score.symbol);
      }
    }
```
`evaluateRisk` (`agentRiskManager.js:30-86`, identical on main) returns **one** prioritized action
per position (EMERGENCY_SWAP > SWAP_OUT > LOCK > TRAIL_STOP > HOLD), so each position contributes at
most one forced rotation — but **many positions can each contribute one**, so `riskSwaps.length` can
be > 1.

**2b. The risk-swap execution loop runs each one sequentially and re-reads the doc after each**
(`agent-evaluate.js:657-752`):
```js
    // ---- Execute risk-triggered swaps (no Haiku needed) ----
    for (const { score, asset, riskResult } of riskSwaps) {
      ...
      const riskSwapResult = await executeSwapServer(    // :713  (main :685)
        db, battle.id, battle,
        slot.tier, slot.slotIndex,
        replacement, currentDay, prices, evaluationMetadata, snapshot
      );
      ...
      summary.swapped++;

      // Re-read battle doc after swap for accurate state in subsequent processing
      const updatedDoc = await battleRef.get();          // :747
      Object.assign(battle, updatedDoc.data());          // :748  ← in-memory battle now reflects swap #1
    }
```
The `:747-748` re-read means the in-memory `battle` (and thus `battle.trades`, `battle.scoreState.tradeCount`)
**already reflects the first rotation** when the second iteration runs. This is the answer to the
spec's critical question: **the second forced rotation sees the first's `trades[]` write**, not the
pre-tick count.

**2c. `trades[]` is written per-swap inside the transaction** (`agentSwapExecution.js`, identical on main):
```js
102 export async function executeSwapServer(db, battleId, battle, ... snapshot = null) {
105   return await db.runTransaction(async (transaction) => {
106     const battleSnap = await transaction.get(battleRef);     // ← reads LIVE doc each call
111     const liveData = battleSnap.data();
...
172       swappedOutAt: now,                                      // ← swappedOutAt stamped on the trade
...
242     const trades = [...(liveData.trades || []), closedTrade].slice(-50);  // ← rebuilt from LIVE trades
...
250       trades,
251       [`scoreState.tradeCount`]: (liveData.scoreState?.tradeCount || 0) + 1, // ← live per-swap counter
...
255     transaction.update(battleRef, updates);                  // ← committed immediately, per swap
```
Because `liveData` comes from `transaction.get` (`:106`), **even without** the `:747-748` re-read,
each swap's transaction observes prior committed `trades[]`/`tradeCount`. So a `trades[]`-derived
breaker reads post-write state whether it reads the transaction's `liveData` or the cron's
re-read `battle`.

> Knob-C binding nuance: the *decision* of which positions enter `riskSwaps` is made in the
> `:618-653` loop from the **pre-tick** `assetScores`. The *count* visible to a breaker is live
> at *execution* time (`:713` onward). So a breaker placed **inside the `:657-752` loop** binds
> correctly; a breaker that pre-computes against the frozen `riskSwaps` list would see the
> pre-tick count. Place the check in the loop.

**2d. Risk swap AND Haiku swap can both fire in one tick.** After the risk loop, control falls
through the proposal/gameplan gates and (absent a pending proposal) into the trigger gate + Haiku.
There is **no "a risk swap happened ⇒ skip Haiku" guard**:
```js
754   const proposalHandled = await handlePendingProposal(...);  // only short-circuits on a PENDING proposal
756   if (proposalHandled === 'skip_haiku') { ... return; }
770   const gameplanHandled = await handleGameplanMeeting(...);  // only short-circuits a gameplan meeting
...
859   const { shouldEvaluate, triggers, ... } = evaluateTriggers(...);
...
1084  const swapResult = await executeSwapServer(...)            // Haiku autopilot swap
```
Haiku returns a single tool decision per tick (`:912-924`), so it adds **at most one** swap.

**2e. There is NO per-tick swap cap / circuit breaker today.**
`grep -rniE "maxSwap|swapsThisTick|circuit.?break|swapBudget|maxRotation|rotationCap|tickSwap"`
across `api/` → **0 hits.** The only swap accounting that exists is:
- `scoreState.tradeCount` incremented per swap (`agentSwapExecution.js:251`),
- `summary.swapped++` (cron-run log counter, in-memory, `agent-evaluate.js:744`, `:1097`),
- a trade-id offset that *counts this tick's non-hold feed entries* to avoid id collisions
  (`agent-evaluate.js:674`):
  ```js
  const riskTradeId = `trade_${String((battle.scoreState?.tradeCount || 0) + 1 + statusFeedEntries.filter(e => e.action !== 'hold').length).padStart(3, '0')}`;
  ```
None of these **limit** the number of swaps; they only number/log them.

**2f. The proposal/gameplan `executeSwapServer` sites are dormant under the launch guard.**
(`agent-evaluate.js:1491-1492`)
```js
  // PRESERVED FOR POST-LAUNCH (2026-05-19): proposal lifecycle (approved/vetoed/expired).
  // Unreachable under the launch guard above while modes are autopilot. Kept for revival.
```
Proposal creation is force-disabled to autopilot (`:1043-1046`, and `agentBattleService.js:153`
`executionMode: 'autopilot'`), so `:1516`/`:1601`/`:1680` do not add swaps in normal launch
operation. **Realistic max under launch = (N risk swaps) + (1 Haiku swap).**

---

## Q3 — Does the battle doc carry archetype identity readable at the `evaluateRisk` call site?

**Plain answer: YES, the identity is persisted and is in scope at the hook site — but NOT under the
field the spec assumes.** It lives at **`battle.agentContext.archetype`**, not `battle.archetype`.
The cron already binds it locally as `ctx.archetype`. `strategyPreset` **is** hardcoded `'balanced'`
at creation, but it is **NOT immutable** — a user-facing toggle mutates it post-creation.

### Evidence

**3a. Persistence — `createAgentBattle` writes `agentContext.archetype`** (`agentBattleService.js:114-116`, identical on main):
```js
    agentContext: {
      agentName: agentData.name || 'Agent',
      archetype: agentData.archetype || 'unknown',   // ← the archetype identity
```
There is **no top-level `battle.archetype`** field anywhere (`grep` confirms the only
`.archetype` read in the cron/risk files is `ctx.archetype` at `agent-evaluate.js:888`).

**3b. Created from `decide.js`** (`api/agent/decide.js:550`), passing `agentData` whose
`archetype` originates at `decide.js:99` (`const archetype = agent.archetype || 'analyst';`):
```js
    const battleResult = await createAgentBattle(
      db, agentData, thresholds, startingPrices, { ... }
    );
```

**3c. In scope at the hook site.** `ctx` is bound at `agent-evaluate.js:224` inside
`processAgentBattle`, and the `evaluateRisk` call at `:637` is in the same function body:
```js
224   const ctx = battle.agentContext || {};
...
888   const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ')...;
```
So `getArchetypeConfig(ctx.archetype)` (or `battle.agentContext?.archetype`) resolves at `:637`.
`getArchetypeConfig('unknown')` falls back to `analyst` (`agentArchetypeConfig.js:136`), so the
hook never throws even on a missing/legacy value.

**3d. Reliably present?** YES for every battle created via `createAgentBattle` (the field has
always been set there, with an `|| 'unknown'` default). For very old/legacy battles the cron
defends twice: `battle.agentContext || {}` (`:224`) and `ctx.archetype || 'unknown'` (`:888`).
**Caveat:** the migration guard (`agent-evaluate.js:204-216`) backfills `executionMode`,
`strategyPreset`, etc. **but does NOT backfill `agentContext.archetype`** — so a legacy battle
missing it stays missing and resolves to `'unknown'`→`analyst`, rather than being repaired.

**3e. `strategyPreset` hardcoded at creation** (`agentBattleService.js:154`, identical on main):
```js
    strategyPreset: 'balanced',     // 'aggressive' | 'balanced' | 'defensive' (Sprint 4)
```
Backfilled to `'balanced'` for legacy battles (`agent-evaluate.js:210`).

**3f. …but `strategyPreset` IS later mutated** by a user toggle — `updateStrategyPreset`
writes to the `agentBattles` collection (`src/services/agentService.js:394,435-441`):
```js
const BATTLES_COLLECTION = 'agentBattles';
...
export const updateStrategyPreset = async (battleId, preset) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, { strategyPreset: preset, updatedAt: serverTimestamp() });
};
```
Wired to UI: `src/components/Agent/StrategyPresetToggle.jsx:25` and
`src/components/Agent/StrategyPresetBadge.jsx:43`. The autopilot launch guard governs
`executionMode`, **not** `strategyPreset`, so a live battle's preset can be `aggressive`/`defensive`,
not guaranteed `'balanced'`. (The risk loop already consumes the preset:
`agent-evaluate.js:231` `getPresetConfig(battle.strategyPreset || 'balanced')` → passed to
`evaluateRisk` at `:642`.)

---

## Q4 — Actual archetype keys, the HFT exemplar, and the dead fields

**Plain answer:**
- The six archetype keys are exactly **`momentum_chaser, analyst, diversifier, contrarian, degen,
  guardian`** — matches the spec's list.
- The highest-frequency / HFT-leaning exemplar in code is **`degen`** (`tradeFrequency: 'highest'`,
  `vwapFailureTicks: 3`, `trailStopLevel: 'sma9'`). 
- **`day_trader` does NOT exist as an agent archetype.** It exists only in the **Forge rule-builder**
  domain (client-side dimension/collection), unrelated to `ARCHETYPE_CONFIGS`. So `degen` is *not*
  literally the reanchoring spec's `day_trader`; they live in different subsystems.
- **`Hermes` = NOT FOUND** anywhere in code (`*.js`/`*.jsx`).
- **`riskOverrides` and `defaultPreset` are dead** — defined on every archetype but read by nothing.

### Evidence

**4a. The keys** (`agentArchetypeConfig.js:6,7,30,51,70,91,112,139`, identical on main):
```js
export const ARCHETYPE_CONFIGS = {
  momentum_chaser: { ... },   // :7
  analyst:         { ... },   // :30
  diversifier:     { ... },   // :51
  contrarian:      { ... },   // :70
  degen:           { ... },   // :91
  guardian:        { ... },   // :112
};
export const VALID_ARCHETYPES = Object.keys(ARCHETYPE_CONFIGS);   // :139
```

**4b. `degen` is the HFT exemplar** (`agentArchetypeConfig.js:91-111`) — pasted in full so the
spec's `hftConfig` addition can be sized against the **real object shape**:
```js
  degen: {
    label: 'Degen',
    defaultPreset: 'aggressive',                 // ← DEAD (see 4d)
    regimePreferences: {
      favoredStrategies: ['volatility_squeeze', '52_week_high', 'news_catalyst'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    riskOverrides: {                             // ← DEAD (see 4d)
      bustBuffer: 0.90,
      vwapFailureTicks: 3,
      trailStopLevel: 'sma9',
    },
    convictionMods: {
      convictionThreshold: 0.85,
    },
    sectorConcentrationCap: 4,
    tradeFrequency: 'highest',
    defaultConfig: { risk: 90, concentration: 75, momentum: 90 },
    avatarColors: ['#ef4444', '#f59e0b'],
  },
```

**4c. `day_trader` is a Forge-domain concept, not an archetype.**
`grep -rn "day_trader\|day-trader"` (code only):
```
src/utils/dimensionMapper.js:313   id: 'day-trader',
src/utils/dimensionMapper.js:383   'day-trader': { ... }
src/data/forgeCollections.js:24    conflicts: ['day-trader'],
src/data/forgeCollections.js:96    id: 'day-trader',
```
Zero hits in `agentArchetypeConfig.js` or anywhere under `api/`. `Hermes`:
`grep -rni hermes --include=*.js --include=*.jsx` → **0 hits.**

**4d. `riskOverrides` and `defaultPreset` are dead.**
`grep -rn "riskOverrides"` / `grep -rn "defaultPreset"` (code only) return **only the six
definitions inside `agentArchetypeConfig.js`** — no reader anywhere. Confirmation that the live
risk path uses a *different* source: `evaluateRisk` takes `presetOverrides` keyed
`{ bustBuffer, vwapFailureTicks, trailStopATR }` (`agentRiskManager.js:35-37`) and is fed
`presetConfig.risk` from **`getPresetConfig(strategyPreset)`** (`agent-evaluate.js:231,642`), never
the archetype's `riskOverrides`. (Note the shape mismatch — archetype has `trailStopLevel: 'sma9'`,
the risk manager wants `trailStopATR: <number>`, and archetype `bustBuffer: 0.90` is positive while
the manager compares `atrMultiplier <= bustBuffer` with a default of `-0.85`; wiring them naively
would be a bug. Flagged, not touched.)

**4e. `getArchetypeConfig` has no caller in the cron/risk path today** — only at profile creation
(`api/agent/create-profile.js:93,180,185`). So the spec's §4.1 hook
`getArchetypeConfig(battle.archetype)` at `:637` is **net-new wiring** in the cron.

---

## Q5 — V1.2 status (the spec's Gate 0)

**Plain answer: V1.2 is NOT merged — not to `main`, and not even to this ahead-of-main HEAD.** It
is a *drafted* spec that is **not on disk**, reconstructed from two verification reports that both
conclude the underlying fixes are **unshipped real gaps**. The bench-vs-active margin formula is
**INLINE** with hardcoded constants, and no `computeBenchVsActiveMargin()` helper exists anywhere.
Mapped to the spec's options this is **Scenario C (V1.2 not shipped)** — with the important §6.8
nuance that V1.2 *as drafted* fixes the trigger gate **inline (no extraction)**, so the shared
helper will not appear "for free" even when V1.2 ships.

### Evidence

**5a. No V1.2 / "Swap Evaluation Pipeline Refresh" commit exists.**
`grep -rln "Swap Evaluation Pipeline Refresh\|Pipeline Refresh"` → **0 hits** (the audit's name for
V1.2 appears nowhere in the repo). `git log --oneline --all | grep -iE "v1\.2|swap eval|pipeline refresh"`
returns only the **bench-staleness verification** docs (#443), which are discovery, not implementation.
The V1.2-adjacent commits (#443 bench-staleness, #444 mb04) are **docs**, and they sit **ahead of
`main`** (`origin/main` = #430), so on `main` neither the reports nor any V1.2 code exist.

**5b. The discovery report states V1.2's spec is not on disk** (`FORGE_ENFORCEMENT_KEYSTONE_DISCOVERY_REPORT.md:232`):
```
V1.2's spec is **not on disk** (project knowledge). Reconstructed from the two **committed**
reports it was drafted from — `MB04_BASELINE_NORMALIZATION_VERIFICATION_REPORT.md` and
`BENCH_STALENESS_VERIFICATION_REPORT.md` ...
```
and (`:344`):
```
V1.2 as drafted commits to fixing the trigger gate *inline*, not to extraction.
```

**5c. The margin formula is INLINE with hardcoded constants** (`agentTriggerGate.js:90-113`,
**identical on `origin/main`** — verified via `git show`):
```js
    const benchAssets = flattenBenchServer(battle.portfolio?.bench);
    const hasWeakActive = assetScores.some(s => s.priceChange <= 0);     // :92
    if (hasWeakActive) {
      for (const benchAsset of benchAssets) {
        if (benchAsset.cooldownUntil && new Date(benchAsset.cooldownUntil) > new Date()) continue;
        const benchPrice = prices[benchAsset.symbol];
        if (!benchPrice) continue;
        const dailyChangePct = benchPrice.changePercent || 0;
        const benchATR = benchAsset.baseATR || 2.5;                       // :103  hardcoded ATR fallback
        const benchATRMult = dailyChangePct / benchATR;                   // :104  ← the margin, inline
        if (benchATRMult >= 0.5) {                                        // :106  hardcoded 0.5 hurdle
          triggers.push({ type: 'bench_outperformance', detail: `...` });
        }
      }
    }
```
`grep -rn "computeBenchVsActiveMargin\|benchVsActive\|computeMargin\|benchMargin"` → **0 hits.**
No helper exists; the formula has not been extracted.

**5d. Both V1.2 source reports conclude "real gap / unshipped."**
- `BENCH_STALENESS_VERIFICATION_REPORT.md:3` — `**Outcome C (real gap).** Reopens the launch-blocker chain.`
  and `:114` — per-tick rescoring is `**definitively ABSENT.**`
- `MB04_BASELINE_NORMALIZATION_VERIFICATION_REPORT.md:24` — `**Outcome: C (qualified — multi-day modes only).**`
  and `:76` — the `0.5` "is hardcoded and ignores the user's `atr` param", confirming the mb-04
  normalization is **not** applied in code.

**5e. Classification:** Scenario **C** — V1.2 not shipped. The helper would have to be created as
part of V1.2/Knob B. The discovery report's §6.8 (`:344-347`) is the authoritative coordination
note: because V1.2-as-drafted fixes inline, the spec must *explicitly* add
"extract `computeBenchVsActiveMargin`" to V1.2's scope or make it Knob B's first step — otherwise
Knob B either edits freshly-merged V1.2 code or duplicates the formula.

---

## Q6 — Do the two Knob B hook sites behave as the spec assumes?

**Plain answer: YES on both counts.**
- `validateTradeDecision` **does** run on the Haiku swap path; a hurdle check added there would gate
  Haiku-proposed swaps.
- Risk-Manager forced swaps **do NOT** pass through `validateTradeDecision` — they call
  `executeSwapServer` directly. The emergency bypass is **structural** (different call site), not a
  reason-string convention.
- One nuance the spec should absorb: **guardrail-forced swaps are NOT bypassed** — they materialize
  into `haikuResult` and *do* go through `validateTradeDecision`. So "bypass" = the
  `agentRiskManager` loop only, not every non-Haiku swap.

### Evidence

**6a. Haiku path runs `validateTradeDecision` and gates on it** (`agent-evaluate.js:1030-1088`;
`validateTradeDecision` at `:987` on main):
```js
    if (decision === 'SWAP' && haikuResult) {
      const validation = validateTradeDecision(haikuResult, battle);   // :1031
      if (!validation.valid) {
        validationErrors = [...validationErrors, ...validation.errors];
        decision = 'HOLD';                                              // ← swap blocked here
        downgraded = true;
      } else {
        ...
        if (mode === 'autopilot') {
          ...
          const swapResult = await executeSwapServer(                  // :1084 only reached if valid
            db, battle.id, battle,
            validation.resolvedTier, validation.resolvedSlotIndex,
            benchAsset, currentDay, prices, evaluationMetadata, snapshot
          );
```
A hurdle check inside `validateTradeDecision` (`agentSwapExecution.js:21-75`; conviction floor at
`:61-64`) — or as a sibling gate at `:1031` — gates Haiku swaps. (Haiku swaps are *also* pre-gated by
the guardrail layer `:965-1010`, LOCK block `:1013-1018`, and DISTRESSED block `:1021-1026`.)

**6b. Risk-Manager forced swaps skip `validateTradeDecision` — structural bypass**
(`agent-evaluate.js:657-717`). The risk loop builds metadata inline and calls `executeSwapServer`
directly; `validateTradeDecision` is never invoked on this path:
```js
    for (const { score, asset, riskResult } of riskSwaps) {
      ...
      const evaluationMetadata = { id: riskTradeId, action: 'SWAP', trigger: riskResult.reason, ... };
      ...
      const riskSwapResult = await executeSwapServer(    // :713 — NO validateTradeDecision above it
        db, battle.id, battle, slot.tier, slot.slotIndex,
        replacement, currentDay, prices, evaluationMetadata, snapshot
      );
```
This loop sits entirely above the Haiku block (`:884+`) and the `validateTradeDecision` call
(`:1031`). The bypass is by **call-site topology**, independent of any `reason`/`trigger` string. ✔
matches the spec's "emergency bypass is structural."

**6c. Guardrail overrides are NOT bypassed (spec refinement).** When `applyGuardrails` forces a
swap it rewrites `haikuResult.decision = 'SWAP'` (`agent-evaluate.js:985-997`), so it then flows
through the same `validateTradeDecision` at `:1031`. Only the `agentRiskManager` loop is the
true validator-bypass.

---

## Spec assumptions that did NOT hold

Ordered by impact on the load-bearing questions (cadence Q1, within-tick swap count Q2).

1. **(Q2 — affects the circuit breaker's premise) "How many swaps per tick" is NOT 1.**
   A single tick can execute **one forced rotation per active position that trips
   EMERGENCY_SWAP/SWAP_OUT/TRAIL_STOP** (`agent-evaluate.js:618-653` builds a multi-entry
   `riskSwaps`, `:657-752` executes each) **plus one Haiku autopilot swap** (`:1084`), with **no
   per-tick cap anywhere** (`grep` for any breaker/cap → 0 hits). Any circuit-breaker design that
   assumes "≤1 swap/tick so a pre-tick count is sufficient" is physically wrong. **Good news for
   Knob C:** the breaker *can* still bind within a tick, because `trades[]`/`tradeCount` are written
   per-swap inside each transaction (`agentSwapExecution.js:242-255`) and the cron re-reads the doc
   after every risk swap (`:747-748`) — **but only if the check is placed inside the execution loop**,
   reading post-write state, not the frozen `riskSwaps` list.

2. **(Q5 — Gate 0) V1.2 has not shipped; it isn't even on disk as a spec.** The audit's name
   "Swap Evaluation Pipeline Refresh" appears nowhere; V1.2 is reconstructed from two verification
   reports that both report **unshipped real gaps** (bench-staleness Outcome C, mb-04 Outcome C).
   The margin is **inline** (`agentTriggerGate.js:104`, hardcoded `0.5` at `:106`) and **no
   `computeBenchVsActiveMargin` helper exists**. This is **Scenario C**, not A/B — and worse than a
   plain C: V1.2-as-drafted fixes inline, so the helper must be *explicitly* added to scope
   (discovery report §6.8). The spec's Gate-0 "is V1.2 merged?" must be answered **NO**.

3. **(Q3 — breaks the §4.1 hook as written) The archetype field is `battle.agentContext.archetype`,
   NOT `battle.archetype`.** The spec's hook `getArchetypeConfig(battle.archetype)` at `:637` would
   read `undefined` → silently fall back to `analyst` for every battle. Correct call:
   `getArchetypeConfig(ctx.archetype)` / `battle.agentContext?.archetype` (persisted at
   `agentBattleService.js:116`; bound as `ctx` at `agent-evaluate.js:224`). There is **no** top-level
   `battle.archetype` anywhere.

4. **(Q3) `strategyPreset` is NOT immutably `'balanced'`.** It is hardcoded at creation
   (`agentBattleService.js:154`) but a user toggle (`updateStrategyPreset`,
   `agentService.js:435`, wired to `StrategyPresetToggle.jsx`/`StrategyPresetBadge.jsx`) mutates it
   on the live `agentBattles` doc. The autopilot launch guard does not cover it. Any spec logic that
   treats `strategyPreset === 'balanced'` as invariant is unsafe.

5. **(Q4) `day_trader`/`Hermes` are not agent archetypes.** `day_trader` exists only in the Forge
   rule-builder (`dimensionMapper.js`, `forgeCollections.js`); `Hermes` is absent from code entirely.
   The six real keys match the spec, and **`degen`** (`tradeFrequency:'highest'`) is the de-facto
   HFT exemplar — but it is a *distinct* construct from the reanchoring spec's `day_trader`. Don't
   assume a `day_trader` archetype key exists.

6. **(Q4 — sizing the `hftConfig` addition) `riskOverrides` and `defaultPreset` are dead AND
   shape-incompatible with the live risk manager.** They're read by nothing; the live risk path is
   parametrized by `strategyPreset`→`getPresetConfig` instead. If `hftConfig` is meant to drive
   `evaluateRisk`, note the live manager expects `{ bustBuffer:<neg>, vwapFailureTicks, trailStopATR:<num> }`
   (`agentRiskManager.js:35-37`), whereas the dead `riskOverrides` use `bustBuffer:0.90` (positive)
   and `trailStopLevel:'sma9'` (string) — copying that shape would misfire.

7. **(Q3, minor) The migration guard backfills `strategyPreset` but not `agentContext.archetype`**
   (`agent-evaluate.js:204-216`). Legacy battles missing the archetype are not repaired, only
   defaulted to `'unknown'`→`analyst` at read time. Fine for safety, but the hook will quietly treat
   such battles as `analyst`.

8. **(Q6, refinement not contradiction) The validator bypass is the `agentRiskManager` loop only.**
   Guardrail-forced swaps (`agent-evaluate.js:985-997`) still pass through `validateTradeDecision`
   (`:1031`). "Forced swaps bypass the validator" is true for risk-manager rotations; it is **not**
   true for guardrail overrides.

9. **(Cross-cutting) The spec's line numbers track the session branch (post-#445 HEAD), not `main`.**
   On `origin/main`, `evaluateRisk` is at `:609` and the risk `executeSwapServer` at `:685`
   (not `:637`/`:713`). The control flow is identical and the helper files
   (`agentSwapExecution.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`) are byte-identical, so
   no *substantive* assumption breaks — but if the spec is locked with `:637`/`:713` as anchors,
   note they are HEAD anchors, and `main` does not yet contain the keystone-discovery merge.

---

*Read-only audit. Every claim above is backed by a pasted snippet with `file:line`. Items marked
NOT FOUND were searched with the commands shown. No production code was modified; the only file
written is this one.*
