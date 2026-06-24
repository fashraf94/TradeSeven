# Diversifier Hard-Cap Wire — Build-Cost & Fence Assessment
### FantasyTrades · Option 2 (enforced concentration cap) feasibility · read-only · 2026-06-24

**Repo:** `/home/user/TradeSeven` · **HEAD:** `f8c2316` · **Mode:** read-only. No edits, no build. `file:line` + VERIFIED / ASSUMED.

---

## Verdict — **CLEAN: do it in Option 2** (via apply-time injection), with one scope line

> Wiring the Diversifier a *default, enforced* concentration cap is a **small, fully non-fenced change** — **~1 file (`agentGuardrails.js`), ~10 lines + one constant + tests** — that **reuses `checkSectorCap` as-is** (no change to the enforcement function) and has a **trivial, deterministic dedup** with user rules that **does not depend on the reconciler at all.** Fold it into the archetype-integrity build.
>
> **One honest scope line:** the clean non-fenced wire enforces the cap on **mid-battle swaps** (where over-concentration drift actually happens). Hard-capping the **initial draft** too would touch the fence (`decide.js`), so leave the initial portfolio to the already-strongest-of-six soft constraint and hard-cap the swaps. That covers the real risk without §7.

---

## 1. The exact wire (recommended: **Option A — apply-time injection, non-fenced**)

The live guardrail path: `agent.deployedStrategy.guardrails` (written client-side by `src/services/deployStrategyService.js:152-181`) → snapshotted into `battle.agentContext.deployedGuardrails` by the **fenced** `agentBattleService.js:159-160` → applied at eval by `applyGuardrails` (`agentGuardrails.js:58`, **non-fenced**), called at `agent-evaluate.js:1607`.

**The minimal insertion** is inside `applyGuardrails`, right after it indexes guardrails by type (`agentGuardrails.js:89-92`):

```js
// after: for (const g of guardrails) { if (g?.type) byType[g.type] = g; }
if (battle.agentContext?.archetype === 'diversifier' && !byType.maxSectorWeight) {
  byType.maxSectorWeight = { type: 'maxSectorWeight', value: DIVERSIFIER_SECTOR_CAP_PCT, unit: '%', enforcement: 'hard' };
}
```

- `battle.agentContext.archetype` is populated (`agentBattleService.js:152`, `archetype: agentData.archetype || 'unknown'`) — **VERIFIED** reachable at apply-time.
- `checkSectorCap` consumes only `maxSector.value` (`agentGuardrails.js:173`) — the injected guardrail triggers the existing swap-time check (`:159-178`) **unchanged**. **VERIFIED.**
- `DIVERSIFIER_SECTOR_CAP_PCT` is a **fresh non-fenced constant** (avoids even a fenced *read* of the dead `sectorConcentrationCap`).

**Why apply-time, not the other two candidates:**
- **vs. `agentBattleService.js:159-160` (snapshot-time):** that file is **fenced** (calibration fence + `createAgentBattle` doc shape) → §7-gated. ❌ avoid.
- **vs. `deployStrategyService.js` (deploy-time, non-fenced src):** only helps agents who deployed a Forge strategy; a Diversifier with **no** strategy still gets nothing (its `deployedStrategy.guardrails` is `[]`). It also re-introduces the dedup collision (see §4). ❌ doesn't guarantee for all diversifiers.
- **Apply-time wins:** synthesized from the archetype every eval, so it covers **every** Diversifier regardless of Forge state, and the dedup is a one-line guard.

---

## 2. Fence position — **fully non-fenced** (zero fenced edits)

| Touched | Fenced? | Why ok |
|---|---|---|
| `api/_utils/agentGuardrails.js` (the wire) | **No** — not in the BUILD_RULES §1 fence list | the edit lives here |
| `checkSectorCap` enforcement | **No** — and **unchanged** anyway (reused as-is) | takes `maxSectorValue` as a param |
| read `battle.agentContext.archetype` | **No** — reading a battle field | not a fenced call |
| new constant `DIVERSIFIER_SECTOR_CAP_PCT` | **No** — fresh non-fenced module/const | avoids reading the fenced dead value |
| **`decide.js` draft enforcement** | **Yes — fenced** | **deliberately OUT of scope** (see §6) |

The only fence-adjacent fact is that `agentBattleService.js` (fenced) snapshots the guardrails — but we **don't touch it**; we inject downstream at apply-time. **No §7 gated process needed for the recommended wire.**

---

## 3. Size & blast radius

- **Files:** 1 (`agentGuardrails.js`) + 1 small constants addition + test cases in `agentGuardrails.test.js`. ~10–15 lines of logic.
- **Reuses `checkSectorCap` cleanly** — no change to the enforcement function or the eval path. **VERIFIED** (`checkSectorCap` is param-driven, `agentGuardrails.js:431-463`).
- **Behavioral blast radius:** only `diversifier` agents; `checkSectorCap` only **blocks an over-concentrating SWAP** (returns `null` = no-op otherwise, `:451`) — it never forces a trade. So the worst case is "a Diversifier declines a swap that would over-load a sector and holds / picks another," which is the intended behavior.
- **Gated on `originalDecision === 'SWAP'`** (`agentGuardrails.js:165`) → mid-battle swaps only; no effect on holds or the initial draft (see §6).

---

## 4. Dedup + the reconciler — **confirmed, and the recommended wire sidesteps it**

The founder's precedence model **does exist**: `ruleConflictReconciler.js:46-49` defines `PROVENANCE_TIER = { user_equipped: 1, archetype_default: 2 }` (user-deliberate beats archetype-default), and `HARD_CATEGORIES` includes `'allocation'` (`:42`), so a sector cap is in its scope. **VERIFIED.**

**But two facts make the reconciler the wrong tool here:**
1. **The reconciler's deploy-time RESOLVE is NOT wired yet.** Its header is explicit: equip-time runs **DETECTION/shadow only**; deploy-time resolve is *"Phase 2, fence-gated, `CONFLICT_RECONCILER_INJECT_ENABLED`. **NOT wired here**"* (`ruleConflictReconciler.js:7-11`). So relying on it to de-dup at runtime **today** would not work.
2. **Option A never creates a rule for it to reconcile.** The archetype-default is synthesized at apply-time and injected **only when `!byType.maxSectorWeight`** — i.e. only when the user has **no** `se-07` rule. If the user *did* equip `se-07`, it's already in `byType` and the default is never added. **The user rule wins automatically; there is no collision and no new conflict.** This is *simpler and stronger* than routing through the reconciler.

So: **confirmed there is no new conflict.** The reconciler's tier precedence is correct in principle (and would govern if you ever modeled the cap as a real Forge rule), but the recommended apply-time wire makes the dedup a deterministic one-line guard that doesn't wait on the un-wired resolve path.

> ⚠️ **If you instead chose Option B** (inject the cap into `deployedStrategy.guardrails` as a real guardrail): until the reconciler's deploy-time resolve is wired, two `maxSectorWeight` entries could both land in the array, and `byType[g.type] = g` (`agentGuardrails.js:91`) keeps the **last** one — non-deterministic precedence. That's the collision the founder worried about, and it is real for Option B today. Another reason to prefer Option A.

---

## 5. The default value (unit mismatch, resolved)

- The dead `sectorConcentrationCap: 2` is a **slot count** ("max 2 stocks per sector"); `se-07`/`maxSectorWeight` is a **slot-share percent** (`compile-dimensions.js:96`, integer 15–50, default 30).
- `checkSectorCap` computes `postWeight = (sectorCounts[incomingSector] / totalSlots) * 100` (`agentGuardrails.js:450`) — a **slot-share %**, where `totalSlots = held.length`.
- For a ~6-stock book (Star 2 + Core 2 + Support 2), "max 2 per sector" = 2/6 = **33.3%**. To *allow 2 and block 3*, the cap must sit in **[33.3%, 50%)** → **~35%** is the honest translation of the dead `sectorConcentrationCap:2`.
- **Recommendation:** `DIVERSIFIER_SECTOR_CAP_PCT ≈ 35%` (encodes "max 2 of 6 per sector," tighter than the generic `se-07` default of 30%—wait: 30% would block the *2nd* stock, i.e. "max 1 per sector," which is very tight). **Pick the % deliberately against the real `held.length` denominator** (verify whether crypto slots count in `collectHeldPositions`) — this is a one-number **calibration** choice, not a cost/fence issue. Default-tighter-than-30% would force near-total sector uniqueness; ~35% gives the "2 per sector" cap the dead config intended.

---

## 6. The one scope boundary — swaps (clean) vs initial draft (fenced)

`applyGuardrails` runs at **eval/swap time** only. So Option A guarantees the Diversifier won't **swap into** over-concentration mid-battle — which is where concentration drift actually occurs. It does **not** hard-cap the **initial drafted portfolio**; that path is `validatePortfolio`/`buildFallbackPortfolio` in **`decide.js` (fenced)**, so a hard draft-cap would need §7.

**Recommendation:** leave the initial draft to the soft constraint — the Diversifier already carries the **strongest** sector-spread instruction of the six ("span ≥7 sectors, no sector >4," `archetypeScoring.js:85`) plus the spread-weighted fit-sort — and hard-cap only swaps via Option A. That delivers the enforceable guarantee where it matters (ongoing behavior) with zero fence contact. If the founder later wants a hard *draft* cap too, that's a separate, fence-gated fast-follow.

---

## Bottom line

**CLEAN — fold the swap-time hard cap into Option 2.** ~1 non-fenced file, reuses `checkSectorCap`, deterministic dedup with user rules (no reconciler dependency, no new conflict), covers all Diversifier agents. The only thing left soft is the *initial draft* spread (fenced `decide.js`), which the strongest-of-six soft constraint already handles — so author the Diversifier's "I cap concentration" line as true **for ongoing trading**, honestly noting the draft leans on the (already strong) soft constraint.

*End of assessment. Read-only — no edits, no build, no plan changes.*
