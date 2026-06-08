# Phantom Score at Agent Battle Start — Discovery Audit Findings

**Type:** Read-only investigation (no code changed; protected fence untouched)
**Date:** 2026-06-08
**Branch:** `claude/agent-battle-phantom-score-wCRbY`
**Verdict:** **Outcome A — separate, unhardened scoring path.** The agent battle screen
recomputes scores **live on the client** through its own inline `enrichAsset`, which lacks
the day-1 activation-baseline gate that both the server cron and the classic BaggerBomb
client hook already have. The displayed `%` reads the entry baseline (correctly → +0.00%)
while the badge/Meltdown math reads `previousClose` (→ phantom Bust/Crash/Meltdown). The fix
lands **outside** the protected fence.

---

## 1. Pre-flight

- **HEAD commit:** `b54f14ef2f5cf538c137357d125ca611b66a841e` — *"Merge pull request #471 …vibrant-fermat-KEsQP"*. Local `HEAD` == `origin/main` (in sync; nothing to pull).
- **The three prior-fix commit hashes are NOT present by hash.** `f9b5197`, `19ce879`,
  `16c9180`, `4368e5a` all return "NOT FOUND" (`git log <hash>` fails). The repo has clearly
  been rebased/squashed through PR merges since March, so the original March SHAs no longer
  resolve. **However, the equivalent hardening is present in live code:**
  - `api/_utils/baselineValidation.js` — Guard 1 (activation price), Guard 2 (day-2+
    `previousClose`), Guard 3 (swap-lock parity), plus the shared `resolveThresholdBaseline`
    precedence. Commit chain `076645e → d037b2f → 501dbf6` (PR #459 `fix/agent-bust-scoring-baseline`, merged `d7e76ab`).
  - `api/cron/agent-evaluate.js:296-345` — the **day-1 activation gate** (`isActivationDay`)
    on the server scoring path.
  - `src/hooks/useBaggerBombBattleV4.js:195-229` — the classic BaggerBomb **client** calendar-day
    gate (commit `5f84898` *"Day-1 calendar gate for BaggerBomb threshold baseline"*, PR #431).
  - NaN/zero-baseline guard present in both `src/utils/baggerBombUtils.js:554-571` and
    `api/_utils/agentScoring.js:247-260`.
  - **Gap:** none of this hardening reached `src/screens/AgentBattleScreen.jsx` `enrichAsset`,
    which is the path the agent battle screen actually displays. That is the recurrence.

---

## 2. Scoring path (Question A)

The agent battle screen computes per-asset scores **client-side, live**, in its own inline
function — it is **not** routed through the BaggerBomb hooks, and it shares only the leaf
math function with BaggerBomb.

- Screen: `src/screens/AgentBattleScreen.jsx` (routed from `BattleViewScreen.jsx:23-31` when
  `currentBattle.agentDeployed === true`).
- Per-asset score function: **`enrichAsset`** at `src/screens/AgentBattleScreen.jsx:530-602`.
- Leaf math: it calls **`calculateAssetScoreV3`** from the shared
  `src/utils/baggerBombUtils.js:535-627` (imported at `AgentBattleScreen.jsx:32`).
- The server has a parallel byte-identical port `calculateAssetScoreServer`
  (`api/_utils/agentScoring.js:228-304`) used by the crons — **inside the fence** — but the
  *displayed* score the user sees 2 minutes in is the client `enrichAsset` recompute, not the
  server port (see Question F).

**So: the leaf math is shared with BaggerBomb (`calculateAssetScoreV3`), but the baseline
assembly that feeds it is a distinct, agent-only path (`enrichAsset`).** The bug is in the
baseline assembly, not the leaf math.

---

## 3. Baseline source (Question B)

`enrichAsset` builds **two** baselines, and they diverge — this is the heart of the bug.

**Base-points / displayed-% baseline (`openPrice`)** — `AgentBattleScreen.jsx:544-551`:
```
openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0
priceChange = ((curPrice - openPrice) / openPrice) * 100
```
Priority: swapPrice → `startingPrices` (entry) → stale `asset.price` → 0. On a flat-from-entry
stock this is ~0% → display shows **+0.00%**.

**Threshold / badge baseline (`thresholdBaseline`)** — `AgentBattleScreen.jsx:560-566`:
```
thresholdBaseline = asset.swapPrice
  || previousClosePrices[asset.symbol]   // ← previousClose WINS over startingPrices
  || startingPrices[asset.symbol]
  || openPrice
thresholdPriceChange = ((curPrice - thresholdBaseline) / thresholdBaseline) * 100
multiplier = thresholdPriceChange / baseATR        // line 572 → drives badges/Meltdown
```
Priority: swapPrice → **`previousClose`** → startingPrices → openPrice. `previousClosePrices`
is freshly polled from EODHD (`AgentBattleScreen.jsx:467, 474-476`).

**The stale-price fallback the March fix removed from the BaggerBomb hooks is effectively back
here, in a new form:** the threshold baseline unconditionally prefers `previousClose` over the
entry price, with **no activation-day gate**. On a gap day, `previousClose` ≠ entry even when
the stock has not moved since the battle started.

---

## 4. Guards (Question C)

| Guard (March hardening equivalent) | Server cron | Classic BaggerBomb client | **Agent screen `enrichAsset`** |
|---|---|---|---|
| (a) empty `startingPrices` → null, not `{}` | n/a (reads `portfolio.startingPrices`) | n/a | **Absent** — `startingPrices = battle?.state?.startingPrices \|\| {}` (`:422`); `{}` is truthy |
| (b) skip scoring when no valid baseline | partial (NaN guard) | `hasValidBaseline` gate (`useBaggerBombBattleV4.js:245-252,441-444`) | **Absent** — scores immediately; only a NaN guard in the leaf (`baggerBombUtils.js:554-571`) |
| (c) day-0 / first-trading-day → entry baseline | **Present** — `isActivationDay` (`agent-evaluate.js:303,343-344`) | **Present** — calendar-day gate (`useBaggerBombBattleV4.js:195-229`) | **ABSENT** — `tradingDays`/`currentTradingDay` are read only for the day *label* (`AgentBattleScreen.jsx:71-74`), never for the threshold baseline |

Guard (c) is the decisive miss. The agent screen has **no** notion of "it is day 1, so measure
badges against the entry price, not `previousClose`."

---

## 5. Activation sequence (Question D)

No DB-level capture-before-active race. `createAgentBattle` writes `status:'active'` and
`portfolio.startingPrices` in the **same atomic document write**
(`api/_utils/agentBattleService.js:73, 100`). After navigation, the client also overwrites
`portfolio.startingPrices` with fresher captured prices (`App.jsx:6462-6484`).

The client `battle.state.startingPrices` is populated on both entry paths:
- Fresh deploy: from deploy-time `asset.price` (`App.jsx:6413-6416, 6447-6449`).
- Re-open from dashboard card: from the Firestore doc's `portfolio.startingPrices`
  (`App.jsx:6533-6535`).

**So `startingPrices` is present and correct when the phantom score appears** — this is *not*
a capture-timing race (rules out Outcome C). The entry baseline is fine; the threshold
baseline simply ignores it on day 1.

> Note: the client reads `battle.state.startingPrices` (`AgentBattleScreen.jsx:422`) while the
> server reads `battle.portfolio.startingPrices` (`agent-evaluate.js:306`). Both are populated,
> so this naming split is not the active bug, but it is a latent footgun (see §10).

---

## 6. Display vs score lineage (Question E) — the smoking gun

Side-by-side, for one held stock on activation day:

| | Displayed **%** | Displayed **score / badges** |
|---|---|---|
| Computed at | `AgentBattleScreen.jsx:549` (`priceChange`) | `:584-590` (`calculateAssetScoreV3`) via `multiplier` `:572` |
| Baseline | `openPrice` = `startingPrices[sym]` (entry) — `:544` | `thresholdBaseline` = `previousClose[sym]` — `:560-561` |
| Value when flat-from-entry on a gap day | `(95-95)/95 = ` **0.00%** | `(95-100)/100 = -5%` → `/2.5 ATR =` **-2.0 → Meltdown** |

**They do NOT share a baseline.** The `%` reads entry; the badge multiplier reads
`previousClose`. A stock that gapped down ~5% from the prior close and then sat flat shows
**+0.00%** while the score path fabricates Bust (-10) + Crash (-20) + Meltdown (-35) = **-65**,
exactly the per-stock figure in the symptom. Summed across the portfolio (some flat/positive)
nets the **Agent -25 / CPU -130** scoreboard. The "x.x% to Bust/Meltdown/Bagger" proximity
labels are driven by the same `previousClose`-based `multiplier`, which is why they are
populated while the `%` reads zero.

---

## 7. Live vs static score (Question F)

The scoreboard renders the **live client recompute**, not a static Firebase field — the
opposite of Outcome E.

- `displayPlayerScore` = `playerTotalScore` when prices are loaded and the battle is active
  (`AgentBattleScreen.jsx:670-674`). It only falls back to `scoreState.currentScore` while
  `loadingPrices` is true or the battle is `completed`.
- `playerTotalScore` = `sumPortfolioPoints(enrichedPlayerPortfolio) + bankedScore`
  (`:658-661`), i.e. the sum of `enrichAsset(...).points` across the tiers (`:640-646`).
- `opponentTotalScore` is likewise the live sum over the CPU portfolio (`:662-665`).

So at the 2-minute mark, the negative numbers on screen are produced **live by `enrichAsset`**
— the phantom is generated in the client, not read from a stale stored field. `scoreState`
static fields are not the culprit here.

---

## 8. Root-cause hypothesis (one sentence)

The agent battle's live client scoring path (`src/screens/AgentBattleScreen.jsx:530-602`
`enrichAsset`) builds its **threshold/badge baseline as `previousClose`-first with no
activation-day gate** (`:560-566`), so on a battle's first day it measures Bust/Crash/Meltdown
badges against the prior session's close while the displayed `%` is measured against the entry
price (`:544-551`) — a gap between those two baselines fabricates ~-65/stock of badge points on
a ticker showing +0.00%, the exact "phantom score" signature; the server cron
(`api/cron/agent-evaluate.js:343-344`) and the classic BaggerBomb hook
(`src/hooks/useBaggerBombBattleV4.js:195-229`) both gate this on day 1, but `enrichAsset` never
received that gate.

---

## 9. Fix location (described, not written) — and blast radius

**Where:** `src/screens/AgentBattleScreen.jsx`, inside `enrichAsset`, at the `thresholdBaseline`
assembly (`:560-566`). The conceptual fix is to give `enrichAsset` the same day-1 gate the
server and the V4 hook already have: on the battle's activation day, the threshold baseline
must be the **entry price** (`startingPrices[sym]` / `swapPrice`), and `previousClose` should
only take over on day 2+. The activation date is available on the doc
(`agentBattle.createdAt` / `timing.tradingDays`, already read at `:71-74, 1066`), so the gate
needs no new data.

**Blast radius:**
- **Outside the protected fence.** `AgentBattleScreen.jsx` and the shared
  `src/utils/baggerBombUtils.js` are **not** in the Section 7 fence list. The fence
  (`api/_utils/agentScoring`, `archetypeScoring`, `agentSwapExecution`, `decide.js`, the
  `createAgentBattle` doc shape, `useAgentBattleId`, etc.) is the **server** scoring stack,
  which is already correct and should **not** be touched.
- The leaf `calculateAssetScoreV3` is shared with classic BaggerBomb — **do not change the leaf
  math**; change only the baseline `enrichAsset` hands it, so BaggerBomb is unaffected.
- Display-only change in effect: it corrects the *number shown live*. It does not alter the
  authoritative server `scoreState` (which already gates correctly), so there is no
  client/server score divergence risk from the fix — in fact it *removes* the existing
  divergence.

**Decision for Flash:** patch `enrichAsset` in place (add the day-1 gate / reorder the fallback
to entry-first on activation day) vs. route the agent screen's baseline assembly through the
already-hardened shared helper. Both are out-of-fence; the in-place gate is the smaller change.

---

## 10. Open questions / surprises

1. **Field-name split (latent footgun).** Client reads `battle.state.startingPrices`
   (`:422`); server reads `battle.portfolio.startingPrices` (`agent-evaluate.js:306`). Today
   both are populated, but any future path that builds the nav object without `state.startingPrices`
   would silently fall `openPrice` through to stale `asset.price` (`:544`) and corrupt the `%`
   too. Worth normalizing when the fix lands.
2. **CPU opponent uses the same buggy path.** `enrichedOpponentPortfolio` runs through the same
   `enrichAsset` (`:616-624`), so the **CPU -130** is phantom for the same reason — the opponent
   has no server `scoreState`, so its on-screen score is *purely* this client recompute. The fix
   covers both sides automatically.
3. **March SHAs unresolvable.** The audit could not verify the original `f9b5197 → 4368e5a`
   chain by hash (rebased away). Verification was done by locating the *equivalent live
   guards* instead. If exact-commit provenance matters, it would need the PR history, not the
   branch SHAs.
4. **The agent screen is newer than the hardening.** This is a textbook "Outcome A": a
   dedicated agent screen (`AgentBattleScreen.jsx`) was built with its own inline scoring and
   never inherited the day-1 gate that both older paths carry — which is precisely why a
   March-era BaggerBomb fix didn't prevent a June agent-battle recurrence.

---

**End of findings. Hard STOP — no code changed; fix decision deferred to Flash.**
