# Forge Enforcement Keystone V1.4 — Phase 0 Pre-Implementation Discovery

| | |
|---|---|
| **Status** | Phase 0 COMPLETE — approved; Phase 1 proceeding |
| **Branch** | `claude/forge-enforcement-keystone-implementation` (off `origin/main` @ `05e1629`) |
| **Scope** | Read-only discovery. Zero code changes in Phase 0. |
| **Spec** | `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md` (LOCKED, embedded in the implementation prompt) |
| **Verified against** | live `origin/main` working tree |

This report records the three Gate-0 verifications and the six findings that
contradict V1.4 implementation assumptions, with the resolutions approved by
Flash before Phase 1.

---

## Gate 0 — Branch base ✅ (with a stale-assumption correction)

| Item | Finding |
|---|---|
| Session-default branch | `claude/trusting-thompson-tHOTO` (HEAD `b20b857`) |
| HEAD vs `origin/main` | HEAD is **+2 commits, docs-only** (`KEYSTONE_PRELOCK_FINDINGS.md`). `git diff origin/main...HEAD` touches **no `.js` files**. |
| `agent-evaluate.js` main vs HEAD | **Byte-identical, 2033 lines on both.** |
| Implementation branch base | `origin/main` = `05e1629` (the PR #445 merge) |

**Correction (finding D6):** the prompt warned that HEAD anchors (`:637`, `:713`)
differ from main (`:609`, `:685`). **Not true in this repo.** The
`claude/optimistic-fermat-w6Kr2` work the pre-lock audit ran against (voice
anticipations, badge banking, day-1 calendar gate) has **already been merged into
`main`** (PRs #445/#446/#447). The `:637`/`:713` set *is* the current main set;
`:609`/`:685` are obsolete. Every anchor below was re-verified against the live
file and matches the `:637` set. **Branching off `main` is clean.**

### Anchor verification (all confirmed against live `origin/main`)

| Spec anchor | Reality | Status |
|---|---|---|
| `evaluateRisk` def | `agentRiskManager.js:30` | ✅ |
| `pickEmergencyReplacement` def | `agentRiskManager.js:111-133` | ✅ |
| `validateTradeDecision` def / conviction floor | `agentSwapExecution.js:21` / `:61-64` | ✅ |
| `trades[]` write | `agentSwapExecution.js:242-255` | ✅ |
| `evaluateRisk` call site | `agent-evaluate.js:637` | ✅ |
| `pickEmergencyReplacement` call | `agent-evaluate.js:660` | ✅ |
| risk-path `executeSwapServer` | `agent-evaluate.js:713` | ✅ |
| re-read after swap | `agent-evaluate.js:747-748` | ✅ |
| 5 persistence sites | `:760 / :775 / :800 / :872 / :1329` (all write `cronState.vwapTicks`) | ✅ |
| `source:'risk_manager'` / `source:'gameplan_meeting'` | `:738` / `:793` | ✅ |
| `ctx.archetype` use | `:888` | ✅ |
| Haiku `validateTradeDecision` / `executeSwapServer` | `:1031` / `:1084` | ✅ |

---

## Gate 0b — `pickEmergencyReplacement` semantics → **wrapper needed in Phase 3** ⚠️

`agentRiskManager.js:111-133`: filters out cooldown assets + asset-type
mismatch, sorts the bench by `prices[symbol].changePercent` desc, returns
`candidates[0]` or `null`.

- **Same bench pool as Haiku?** ❌ Call site (`:659-660`) passes
  `flattenBenchServer(bench)`, which **excludes `watchlist.hotBench`** — but Haiku
  swaps *can* use hotBench (`validateTradeDecision:38`). Pools differ.
- **hotBench recency?** ❌ Not considered.
- **Excludes currently-held symbols?** ❌ Not explicitly; relies on bench not
  containing actives (revolving-door + 24h cooldown mostly covers it).
- **Returns null cleanly if all candidates fail Knob B?** ❌ **No quality
  awareness.** Returns one top-by-momentum pick; that pick can be **negative**
  daily% (fails `requireBenchPositive`) or **below the stagnation hurdle**, with
  **no fallback to the next candidate.**

**Determination:** Knob A needs a candidate that clears
`clearsHurdleFloor({reason:'stagnation'})` **and** is bench-positive. The current
function cannot express "best *qualifying* candidate." **→ Phase 3 implements the
wrapper** `pickSwapReplacementCandidate(...)` that iterates candidates and returns
the best one clearing Knob B + bench-positive, else null. Confirms the scope
upper bound.

---

## Gate 0c — `agentContext.archetype` presence ⚠️ (code-safe; live distribution via log)

- **Persisted:** `agentBattleService.js:116` → `agentContext: { archetype:
  agentData.archetype || 'unknown', ... }`.
- **Read:** `agent-evaluate.js:224` → `const ctx = battle.agentContext || {};`;
  used as `ctx.archetype` at `:888`.
- **Safety:** unset → `'unknown'` → `getArchetypeConfig('unknown')` →
  `ARCHETYPE_CONFIGS.analyst`. The "legacy battles accept analyst-default"
  decision (Decision 19) holds **at the code level**.
- **Not verifiable from the container:** the *distribution* of real archetype
  values in live Firestore (no DB access here).

**Resolution (approved):** accept the code-level analyst-default guarantee for
launch, and add a **Gate-1 archetype-distribution log** in the cron (implemented
in Phase 1) so the live mix is observable from logs without DB access.

---

## Six findings that contradict V1.4 assumptions (resolutions approved)

| # | Spec says | Reality | Approved resolution |
|---|---|---|---|
| **D1** | field is `battle.agent_context.archetype` (snake_case) | field is **`battle.agentContext.archetype`** (camelCase); **no `agent_context` exists anywhere**. Following the spec literally → `undefined` → the exact A1 silent-failure it warns about. | Use `ctx.archetype` (already the correct accessor at `:888`) / `battle.agentContext`. **Never snake_case.** |
| **D2** | "Create `getArchetypeConfig()`" | **Already exists**, `agentArchetypeConfig.js:135-137`, exact analyst-default fallback; already used in `create-profile.js`. | **Reuse** it; import into the cron. No duplicate helper. |
| **D3** | `evaluateRisk(state, presetOverrides, archetypeConfig)`; pseudocode uses a `state` object | actual is **7 discrete params** `(position, currentPrice, entryPrice, baseATR, intradaySnapshot, cronMemory, presetOverrides={})`. | `archetypeConfig` is the **8th param** (default null). Stagnation state threads via **`cronMemory`** (mirroring `ticksBelowVwap`), not a `state` obj. **`dailyPct` for winner-suppression is NOT in `evaluateRisk`** today — Phase 3 must supply it (e.g. `prices[sym].changePercent`). |
| **D4** | Knob C reads `t.evaluationMetadata?.reason` | `evaluationMetadata` is **spread to top-level** on trades (`agentSwapExecution.js:177`); the reason is stored as **`exitReason`** (`bust_avoidance`/`vwap_failure`/`stepped_trail`/`haiku_decision`), no `reason` key, no nesting. | Knob C `getRecentSwapCount` filters on **`t.exitReason`**. Couples Phase 5↔Phase 6. |
| **D5** | receipt carries `source`; enumerates `haiku_decision` | `source` today lives on **statusFeed/evaluations**, not `trades[]`; value is **`'haiku'`** not `'haiku_decision'`; extra sources exist (`proposal_system`, `system`, `vision.source`). | Phase 6 adds `source` (+canonical `reason`) to **`evaluationMetadata`** so it lands on `trades[]`, and reconciles the source vocabulary. |
| **D6** | HEAD vs main anchor drift | code is **identical** main↔HEAD (Gate 0). | Use the verified `:637` anchor set. |

None are fatal; each has a clean resolution. They change implementation details
in Phases 1/3/4/5/6 — exactly what Phase 0 exists to catch.

---

## Bonus confirmations (de-risk later phases)

- **Invariant 1 premise verified:** action→reason is 1:1 today —
  `EMERGENCY_SWAP→bust_avoidance`, `SWAP_OUT→vwap_failure`,
  `TRAIL_STOP→stepped_trail` (`agentRiskManager.js:43-82`); the risk loop gates on
  **action** at `:647`. Knob A reusing `SWAP_OUT` with `reason:'stagnation'` will
  break that 1:1, so reason-keyed bypass is genuinely necessary.
- **B1 structure verified:** `riskSwaps` is frozen in the eval loop (`:647-648`),
  executed in the loop at `:658-752`, with a **post-write re-read at `:747-748`**.
  In-loop Knob C reading fresh `battle.trades` is implementable as specified.
- **Persistence pattern:** `vwapTicks` seeded `:616`
  `{...(battle.cronState?.vwapTicks||{})}`, mutated `:626-628`, persisted at all 5
  sites — the template for `stagnationTicks`/`lastTickPrice`/`lastTickTimestamp`.
  The 5 sites are **not uniform** (`:872` adds `triggerGatePassCount`; `:1329` is
  the big `finalUpdate`), so `finalizeCronState` (Phase 2) should stamp the
  **shared** cron-state subset.
- **Decision 2 wiring is clean:** base levers already come from `presetConfig.risk`
  (`:642`); `hftConfig` slots in as the new archetype-driven 8th arg with zero
  overlap.
- **Tooling:** `vitest` — `npm run test:run`. `node_modules` must be installed
  (`npm install`) on a fresh container. ESLint config is **frontend-only**
  (`globals.browser`) and already reports 5 errors on `agent-evaluate.js`
  (incl. `'process' is not defined`), so lint is **not a gate for `api/` files**;
  tests are the gate.

---

## Scope read

Phase 0 points to the **upper half** of the ~850–1,300-line estimate: the
`pickEmergencyReplacement` wrapper is needed (Gate 0b), and D3/D4/D5 add
reconciliation work in Phases 3–6. Nothing discovered inflates beyond the spec's
stated upper bound.
