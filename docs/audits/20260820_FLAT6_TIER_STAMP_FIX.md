# Flat6 Tier-Multiplier Stamp Pass-Through — Fix Record (C-2 remediation)

**Branch `claude/flat6-tier-stamp-passthrough` @ base `ef421a7f` (= `origin/main`, post-Ask-1 merge PR #781).**
Origin: Ask 1 build review §6 ① (`20260819_EXIT_BEHAVIOR_ASK1_BUILD_REVIEW.md`) — a CONFIRMED
pre-existing production defect escalated under BUILD_RULES §3, ruled by the founder to fix
under option (a). Phase 0 discovery was delivered and accepted before any code was written;
the founder's fix rulings (shape (ii), landing (a), both tests red-first with the static guard
primary, retroactive honesty as drafted) are executed here.

---

## ⚠️ MERGE == DEPLOY — read this before merging

**This fix carries NO feature flag. The behavior change goes live with the deploy that
follows the merge — merging this branch IS the deploy decision.** Do not merge it casually.

- The binding timing constraint (kickoff + founder ruling 2): land **between battles** —
  after a Friday-evening advancement bank, before the next Monday-morning pipeline
  (`tournamentOrchestrator.js` — Friday `runFridayAdvancement`, Monday cohort formation).
  Deploying mid-week steps every live flat6 star/core position's base term discontinuously
  (a star at +5% instantly loses half its base points) and makes that week's days
  internally incomparable.
- Live occupancy is checked on the founder's dashboard at merge time — this environment has
  no production credentials, so no session-side check substitutes for it.
- A flag was considered and rejected in Phase 0 §5: the fix corrects live scoring math to
  its designed value; a flag would enshrine the defect as a configuration. The landing
  window, not a flag, is the safety mechanism.

## 1. The defect (what production did before this branch)

The D2 flat6 design stamps `tierMultiplier: 1.0` on every flat6 doc asset at creation
(`agentBattleService.js:100-105`; `flatMultiplier` = 1.0 for flat6 `agentGameModes.js:70`,
null for tiered `:50`) and on every swap-in (`agentSwapExecution.js` incoming stamp). The
scorer honors it via `asset.tierMultiplier ?? CONVICTION_MULTIPLIERS[asset.tier]`
(`agentScoring.js:249,:267`; star 2.0 / core 1.5 / support 1.0 from
`baggerBombScoring.js:56-60`; `basePoints = priceChange * 10 * tierMultiplier` `:270`).

**Five rebuild seams dropped the stamp** — each rebuilt `{symbol, baseATR, tier, direction}`
from the doc asset without `tierMultiplier`, so the `??` fell to slot labels and production
flat6 **live scores and swap locks applied 2.0×/1.5× by slot label**, against the D2 design,
the doc snapshot, and the eval prompt's own flat-1x text:

| Site | Pre-fix location | Surface |
|---|---|---|
| 1 | `agent-evaluate.js` agent arm, no-price | live scores |
| 2 | `agent-evaluate.js` agent arm, main | **the battle's `activeScore` / eval context** |
| 3 | `agent-evaluate.js` CPU arm, no-price | opponent scores |
| 4 | `agent-evaluate.js` CPU arm, main | opponent scores |
| 5 | `agentSwapExecution.js` `assetObj` | **the swap lock — `lockedPoints`** |

The one caller that passed the doc asset through whole — `agent-daily-scores.js:122-128` —
was correct all along (and banks only tier-independent badge points anyway, `:176-183`).

**The client-divergence finding (Phase 0 substance CONFIRMED; its anchor CORRECTED at §2
review):** the flat6 client display spreads the FULL doc asset into the scorer, so the D2
stamp survived client-side and the display has computed flat 1x all along while the server
computed tiered — a live display-vs-engine divergence. **This fix resolves it in the
client's favor**: the client was showing the D2-designed numbers. The REAL seams are
`src/utils/flat6BattleEnrichment.js` (the `Flat6BattleView` path; its own header `:20-21`
documents the flat-1x-by-override contract) and `src/screens/AgentBattleScreen.jsx:655`
(renders tournament docs — `:991` switches to `FLAT6_TIERS` on
`gameMode === 'baggerbomb_tournament'`). Phase 0 misattributed the seam to
`useBaggerBombBattleV4.js:368` — that hook subscribes to the USER `battles` collection
(casual V4; those docs carry no D2 stamp), so its spread is inert for flat6. The `/code-review`
pass caught the misattribution; the load-bearing comments were placed at the two real seams
and none at the hook.

## 2. The fix (founder shape (ii): mode-resolved, scorer untouched)

One mode-resolve per battle, mirroring the executor's own incoming-swap precedent. **Zero
scorer edits** — the scorer already honors the stamp; that is the design.

- `api/cron/agent-evaluate.js` (non-fenced): import `resolveModeConfig`
  (`agentGameModes.js`) at `:93`; one resolve per battle at `:761-762` —
  ```js
  const flat6StampMultiplier = resolveModeConfig(battle.gameMode).flatMultiplier;
  const flat6Stamp = flat6StampMultiplier != null ? { tierMultiplier: flat6StampMultiplier } : {};
  ```
  spread `...flat6Stamp` into all four rebuild literals (`:770`, `:807`, `:822`, `:855`).
- `api/_utils/agentSwapExecution.js` (**fenced — edit sanctioned by this kickoff, scoped to
  this fix**): the existing incoming-stamp `resolveModeConfig` call hoisted to a single
  `swapModeConfig` resolve above the outgoing-score block (`:199-201`); the outgoing
  `assetObj` gains the conditional stamp (`:215`):
  ```js
  ...(swapModeConfig.flatMultiplier != null ? { tierMultiplier: swapModeConfig.flatMultiplier } : {}),
  ```
  The incoming-swap stamp (`:296-298`) now reads the same single resolve. Lock math itself
  untouched (`lockedPoints = scoreResult.totalPoints`, `:250`).
- `src/utils/flat6BattleEnrichment.js` + `src/screens/AgentBattleScreen.jsx:655`
  (founder-directed comment, RELOCATED to the real seams — see §1): a load-bearing comment
  on each client full-asset spread — it is WHY client display scored flat; never "optimize"
  either into a field subset, which would silently re-create this defect client-side. The
  founder's kickoff named `useBaggerBombBattleV4.js:368` from the Phase 0 anchor; that
  anchor was wrong (user-battles hook, inert for flat6), so the comment intent landed at
  the two seams that actually carry the stamp and no edit was made to the hook.

**Tiered byte-identity by construction:** tiered battles resolve `flatMultiplier` = null →
the conditional spread adds **no field** → the `??` falls back to `CONVICTION_MULTIPLIERS`
exactly as before, which IS tiered's design. No mode conditional can mis-fire; the
behavioral tiered-control test locks 75 (star 2.0×) both before and after the fix.

## 3. The tests (both red-first, watched fail against the pre-fix callers)

`api/_utils/flat6TierStamp.passthrough.test.js` — two halves:

1. **The static caller-supply class guard (PRIMARY — its absence is why the defect
   survived).** The P4 battery (`p4Equivalence.battery.test.js` §2b) proves the scorer
   MECHANISM honors an explicit stamp; nothing anywhere pinned that the CALLERS supply it.
   The guard does REPO-LEVEL discovery (the `agent-evaluate.test.js` census pattern, per a
   `/code-review` finding — a hardcoded caller list would be the same blindness): it walks
   every `.js` under `api/` for `calculateAssetScoreServer(` call sites (excluding
   `*.test.js` and `__fixtures__`/`__mocks__` test infrastructure, and the definition line
   by lookback rather than by path) and classifies each: an object-literal rebuild must
   carry `tierMultiplier` — directly, or via `...flat6Stamp` accepted ONLY alongside the
   pinned mode-resolved definition (an empty-object alias cannot satisfy it); the
   executor's `assetObj` identifier is accepted only if its definition carries the stamp;
   a bare `asset` identifier is accepted as the whole-doc pass-through. Site count pinned
   at **6** (4 cron + 1 executor + 1 daily) so a NEW caller — in ANY api file — registers
   here and gets classified deliberately: mutation-checked by dropping an unstamped caller
   into a brand-new `api/cron/` file, which failed the guard by file and literal, then
   restored green on removal. RED pre-fix: all five rebuild sites failed.
2. **The behavioral flat6 lock test.** Through the real `executeSwapServer` (in-memory
   Firestore transaction mock, the `agentSwapExecution.test.js` harness shape): a flat6
   star-tier swap-out at +3% locks **45** (30 flat base + 15 bagger) — RED pre-fix at 75
   (slot-label 2.0×). The tiered control (no gameMode, no doc stamp) locks **75** before
   AND after — the byte-identity witness.

**Consumer-census note:** `agent-evaluate.test.js:829` — the repo-level `executeSwapServer`
consumer census gained one additive allowlist entry for this test file (a test consumer,
not a new production call site). No census pin was weakened.

## 4. Banked data — forward-only safe

- The daily banker persists badge points only (`agent-daily-scores.js:176-183`);
  `bonusPoints` is tier-independent. Unaffected in either direction.
- Swap locks persist `lockedPoints` on `trades[]` at execution time; historical records are
  stored values — no read path recomputes a banked day through this scorer (grep-verified
  in Phase 0; `tournamentClaims.js:71` reads, never recomputes).
- The only live exposure is the CURRENT week's `activeScore` — which is exactly what the
  landing window protects (see the merge==deploy box above).

## 5. Retroactive honesty (per the kickoff, verbatim from the accepted Phase 0 draft)

> Prior forensic reads of flat6 `base`/`active` terms — notably the fork adjudication's
> cpu-40 "+869 ordinary price movement" — were computed under the slot-label multiplier
> inflation this fix removes: star/core base terms in those reads carry up to 2.0×/1.5×
> inflation relative to the D2 flat design. The adjudications' conclusions stand (the badge
> hypothesis was refuted on its own arithmetic; human losses were swap-dominated under
> either multiplier treatment), but any MAGNITUDE read of a flat6 `base` term predating
> this fix inherits that asterisk.

## 6. Rider: the Tier-1 swapMotive baseline script (R9 evidence, read-only)

`scripts/calibration/motive-baseline-summary.js` — NOT part of the fix; the founder-requested
pre-flip evidence pull for setting R9's rollback-trigger N at the joint Asks 1+3 flip. Run
from the founder's environment exactly like the void pre-check
(`FIREBASE_ADMIN_CREDENTIALS` in `.env.local` or env):

```
node scripts/calibration/motive-baseline-summary.js --since 2026-08-19
```

Read-only (single `get()`, no writes). Reports, over `trades[]` windowed on `swappedOutAt`:
the model-swap (`exitReason === 'haiku_decision'`) motive distribution
(defensive_cut / profit_take / momentum_rotation / upgrade), the **profit_take attempt rate
under the current prohibition**, the undeclared rate (`swapMotive === null` — asked, not
answered) vs the legacy rate (field absent — predates Tier 1), the deterministic-reason
split, and the F3 contamination check (non-null motive on deterministic swaps, which the
un-gated pre-fix stamp could have produced before the Ask 3 dark-contract fix). Flags:
`--since` / `--until` (YYYY-MM-DD), `--status active|completed|all`, `--json out.json`.

## 7. Review + verification gate (at the audit commit)

- **BUILD_RULES §2 `/code-review` at high effort** (scoring-adjacent regardless of size,
  per founder ruling): findings and dispositions in §8 below.
- **Fix battery:** 240 tests green across the 8 adjacent suites (flat6TierStamp,
  agentSwapExecution, agent-evaluate, both suppression-pass suites, the P4 equivalence
  battery, agentGuardrails, ask1) — after RED was watched first on both new halves.
- **Full repository suite:** run without tail-piping, exit code asserted, Test Files line
  read — numbers in §8.
- **`vite build`:** green — §8.
- **Fence statement:** one fenced file touched (`agentSwapExecution.js`), sanctioned by the
  fix kickoff, edit scoped to the stamp pass-through + the single-resolve hoist. No other
  fenced file edited; Gate-7 locked call forms untouched.

## 8. Gate results

- **`/code-review` (high effort)** — run on the branch diff (single-pass inline review;
  the harness did not fan out subagent verifiers on this run — stated for the record).
  Six findings, all dispositioned on-branch:
  1. **CONFIRMED (the significant one):** the Phase-0 client-seam anchor was wrong —
     `useBaggerBombBattleV4` subscribes to the USER `battles` collection and never renders
     flat6, so the founder-directed comment there guarded an inert path while the real
     seams (`flat6BattleEnrichment.js`, `AgentBattleScreen.jsx:655`) had none. Fixed: hook
     hunk reverted to base; load-bearing comments placed at both real seams; §1/§2 of this
     record corrected. The Phase-0 SUBSTANCE (client scored flat all along) stands.
  2. **CONFIRMED:** the static guard's hardcoded three-file list could not catch a new
     caller in a new file — the closed-list blindness it exists to kill. Fixed: repo-level
     `api/` walk (census pattern); mutation-checked with a probe file (§3).
  3. Motive script: off-enum `swapMotive` strings were counted but never printed
     (invisible bucket in R9 evidence). Fixed: OFF-ENUM rows print.
  4. Motive script: re-implemented `parseEnvFile` dropped single-quote stripping vs the
     void pre-check's helper. Fixed: imports the exported helper from
     `export-agent-battles.js` (runner is import-guarded).
  5. This record's §8 placeholders must not be committed. Closed by this fill.
  6. Motive script: `doc.data()` materialized twice per battle doc. Fixed: single bind.
- **Full repository suite** (run to a complete log, exit code recorded in-log, no tail
  piping): **exit code 0** — Test Files **494 passed | 1 skipped (495)** (the skip is the
  pre-existing emulator-gated `firestore.rules.emulator.test.js`); Tests **8094 passed |
  60 skipped (8154)**.
- **`vite build`**: exit code 0, `✓ built in 34.62s`.
- **Lint**: the five touched pre-existing files show **exactly the base commit's counts**
  (20 problems: 15 errors / 5 warnings — verified by linting the base versions in a
  temporary worktree with the repo config); both new files lint **clean (0/0)**. Zero
  introduced.
- **Fix battery** (the 8 adjacent suites incl. both new halves): green after the guard
  rewrite; RED was watched first on both new halves pre-fix (§3).
