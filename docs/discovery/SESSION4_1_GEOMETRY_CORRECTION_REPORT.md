# LevelStory Session 4.1 — Episode Geometry Unit Correction

**Branch:** `claude/level-study-session4-event-detection-u9811g` (continues S4)
**Config:** `STUDY_CONFIG_VERSION = 3` (unchanged — no downstream consumer of these values exists)
**Date:** 2026-07-12
**Scope:** calibration correction only. No features, no hourly classes, no outcomes, no aggregation. The role machine does not move.

---

## Executive verdict

| Item | Status |
|---|---|
| Episode threshold unit error (4× too tight) | ✅ Corrected |
| Key renames off `*Atr` (unit can't be misread again) | ✅ `zoneHalfWidthU` / `closeSeparationU` / `dedupIntersectU` |
| No hardcoded literal in `lib/events.js` (all from config) | ✅ Verified |
| Regression guard (ATR-equivalent assertions) | ✅ `tests/25` (4 tests) |
| Role-flip threshold decoupled + unchanged | ✅ By construction (role machine untouched) |
| Full test suite | ✅ 105 tests; 65 pass / 40 fail — the 40 are **missing-data only**, zero logic failures |
| **Rebuild + corrected §7 event-budget checkpoint** | ⛔ **Pending founder-local run** — no data/network in this container |

**Bottom line:** the miscalibration is fixed, renamed so it can't recur, and guarded by a regression test. The corrected event budget — the number that matters — is a founder-local `npm run levels && npm run events` away; it is reported here as **pending**, not projected (S4 §8 stands).

---

## 1. The defect

The Addendum §6.1/§6.2 specifies episode geometry in **ATR**. The S4 founder prompt §3.2 restated those thresholds as multiples of the distance unit `u` **without converting the unit**. Because `u = clamp(0.25·ATR, floor, cap) ≈ 0.25·ATR` (unclamped), every episode threshold shipped **4× too tight**:

| Threshold | Addendum (ATR) | S4 shipped (`×u`) | Effective ATR | Error |
|---|---|---|---|---|
| Zone half-width | 0.25 ATR | 0.25·u | 0.0625 ATR | 4× too tight |
| Episode-close separation | 1.0 ATR | 1.0·u | 0.25 ATR | 4× too tight |
| Cross-level dedup radius | 0.5 ATR | 0.5·u | 0.125 ATR | 4× too tight |

The engine and its 14 tests were correct; **only the constants were wrong.** Origin is the founder-side prompt, not the build. The S4 run's tells all trace to this one bug: 26.35 events/symbol/month (vs the §13 assumption of 1–2), `shad=0` on 10/11 symbols (zones too small for the dedup rule to ever fire), median episode length 3 sessions.

## 2. The fix

Config (`research/level-study/config.js`, `episode` block), keys renamed so the unit is explicit and each carries its ATR equivalent:

```
zoneHalfWidthU            : 1.0   // ×u = 0.25·ATR  (was zoneAtrMult 0.25)
closeSeparationU          : 4.0   // ×u = 1.0·ATR   (was closeSeparationAtr 1.0)
crossLevelDedup.dedupIntersectU : 2.0 // ×u = 0.5·ATR (was intersectAtr 0.5)
```

`lib/events.js` reads all three from config — no hardcoded literal (`lib/events.js:23-26`). The `03` console banner shows the ATR equivalents. Grep confirms the only readers of the old keys were `config.js`, `lib/events.js`, and the `03` banner — all updated.

**Regression guard** (`tests/25-episode-geometry.test.js`, 4 tests): asserts each threshold's ATR equivalent (`thresholdU · atrMultiple` = 0.25 / 1.0 / 0.5), that the values are the corrected multiples (not the S4 4×-too-tight ones), that `episodeZone` scales with `u` (proving no hardcoded literal), and that the role zone (0.25·u) ≠ the episode zone (1.0·u). A future redefinition of `u` (a change to `atrMultiple`) or a revert to the S4 values now fails immediately.

## 3. Role-flip decoupling (§2b) — unchanged by construction

The role-flip threshold's flip rate (~2.3 / 100 matched-family sessions) was measured and accepted at **0.5·u** (S3.5). It must not float with the widened episode zone. It doesn't — and this is a **structural guarantee, not an empirical hope**:

- The role machine reads `levels.lineage.roleMachine.{zoneHalfWidthUnits 0.25 + flipBeyondOppositeBoundaryUnits 0.25}` = 0.5·u (`lib/lineage.js:187-188`); the episode engine reads `config.episode.*`. Separate config subtrees.
- This session touches **neither** `roleMachine.*` **nor** `lib/lineage.js` **nor** `lib/level-sources.js` (which builds the registry). `npm run levels` output is therefore byte-identical to S4's, so **flip rates cannot have changed**.
- `tests/25` asserts the two zones are numerically distinct (0.25·u role vs 1.0·u episode) — the decoupling made explicit.

The founder-local `npm run levels` flip-rate re-read (expected ~2.15–2.62 / 100, unchanged) is the empirical confirmation of what the code structure already guarantees. If it moved, the decoupling is incomplete — but no code path exists by which it could.

## 4. Rebuild + corrected checkpoint — pending founder-local run

This container has no `data/` and no network to `eodhd.com` (unchanged from S4). Per the founder-run note, the config fix + tests + docs are complete; the rebuild and corrected checkpoint are a founder-local step:

```
cd research/level-study
npm test          # 105 tests; new-suite green, 40 missing-data failures unchanged
npm run levels    # flip rates MUST be unchanged (~2.15–2.62/100) — the decoupling check
npm run events    # the corrected event budget + §7 verdict
```

### Expected direction (predictions, not targets — state whether each held after the run)
1. Total events **drop substantially** (order 4–8×) — zones 4× wider and the close threshold 4× higher means far fewer, longer episodes.
2. Median episode length **rises**; probes-per-episode **rises** (more intraday noise absorbed into each episode).
3. **Shadowing appears** (`shad > 0`) — the dedup radius (now 0.5·ATR) is wide enough for zones to overlap, so the rule becomes live.
4. Events/symbol/month moves **toward the §13 assumption of 1–2** (from 26.35).

### Acceptance criterion (the session's verdict — to be filled in from the founder-local run)
Re-read the corrected checkpoint against parent §13's budget and §15's **n ≥ 30** floor. Report honest counts — tune nothing. State (a) events/symbol/month vs 1–2 and, if still above, by how much (a finding about the zone/episode definition, not a number to hand-fix); (b) per-side, per-question cells vs n≥30; (c) **which of P1–P6 survive at 11 symbols and which do not.** The S4 run's PASSes were a loose-filter artifact; the corrected numbers are the real input to the founder's universe-expansion decision.

**Explicitly permitted (and expected) outcome:** the budget comes back thin and several questions are unanswerable at 11 symbols. That is the correct result and the whole reason the checkpoint exists. **Never loosen an independence rule, widen a zone, or shrink a separation to raise counts** (S4 §8).

## 5. Test tally

`npm test` → **105 tests: 65 pass / 40 fail.** All 40 failures are missing-data (`requireData()` — no `data/normalized/`), unchanged from S4. The 4 new `tests/25` geometry-guard assertions are green; the 14 independence/lifecycle tests (recalibrated to config-derived landmarks so they can't silently break on a future constant change) are green.
