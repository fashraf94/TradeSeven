# Delight Layer — Task 2 (Battle-Weather Starfield) — Cumulative Code Review

**Date:** July 30, 2026
**Branch:** `claude/delight-starfield-background-js9xtw`
**Reviewed range:** merge-base `96abcb5d` … `e450edcf` (12 commits, 14 code files, +3,387/−9)
**Fixes commit:** `cce7cbb2`
**Fence status:** NON-FENCED. No fenced file read or written during the review.

---

## 1. Why this review, and how it was run

BUILD_RULES §2 makes review mandatory at ≥10 files **or** ≥1500 lines; this diff is 14 files / ~3,387 lines. The three per-phase reviews during the build were scoped to each phase's change. This is the **cumulative** pass — bugs that only emerge from the interaction of the layered changes, regressions a later phase introduced, vacuous tests, and comment/anchor drift across the whole diff.

`/code-review` is not available as a skill in this environment, so the mandate was met with a **6-dimension adversarial review** (state-machine correctness, adapter/wiring, component lifecycle, dark-merge guarantee, test integrity, cross-phase consistency). Each dimension's findings were then handed to an independent verifier instructed to **refute** them with a concrete repro. 22 agents total.

**Verdict: 13 CONFIRMED, 0 PLAUSIBLE, 3 REFUTED. No critical, no high, no live functional bug.**

The dark-merge guarantee and the state-machine correctness dimensions came back clean of behavioural defects; the confirmed set is one real test-coverage gap, two weak test rows, a guard inconsistency, a dead no-op line, a latent reduced-motion gap, and comment/anchor drift.

Two REFUTALS are worth recording because they show the review pushing back on itself:
- A proposal to add a literal band assertion for `TIER_EASE_MS` (10–20s) / `DECAY_MS` (~30s) was **refuted** — those values are explicitly tuning-exempt, so a band test would break CI the moment the founder re-tunes by feel, contradicting the ruling. The binding invariant (`DECAY_MS > TIER_EASE_MS` + per-direction ease selection) *is* tested.
- A `toEpochMs` "order-dependent ENDGAME" was **refuted at the shipped-path level** — every real caller routes through the adapter, which converts to `number|null` before the core sees it, and `normalizeLiveGames` re-sanitizes; the residual was a defensive-guard inconsistency, fixed anyway.

## 2. The confirmed findings and their fixes (all in `cce7cbb2`)

Each new or strengthened test row below was **mutation-verified** to fail under the exact defect it covers.

| Sev | Finding | Fix |
|---|---|---|
| medium | `resolveEaseMs`'s `&& target < prev.speed` direction guard was mutation-dead — dropping it kept all 74 core rows green, so R-T2-S14's "upward keeps the fast tier ease" was unpinned for the endgame case (and a comment claimed it was pinned) | Added an **upward endgame→endgame handoff** row asserting `easeMs === TIER_EASE_MS`; dropping the guard now fails |
| low→nit | `toEpochMs({seconds})` lacked the `Number.isFinite` guard its sibling branches all have → leaked `NaN` | Guarded to match the contract; added non-finite `{seconds}`/`toMillis` → null rows |
| low | The adapter header + `App.jsx` memo claimed sky and card "can never contradict / cannot disagree" — overstated; they share the source but the sky additionally drops games past their local `expiresAt` while the card keys on status alone (intended, tested) | Softened both comments to "share the source, diverge on the local-clock drop" |
| low | `depstability` "picks up new battle content" row asserted only *no restart*, never that the loop consumed the new battle — deleting the `liveGamesRef` refresh kept it green | Row now spies `advanceWarp` (calling through) and asserts the loop was **fed** the new battle; freezing the ref now fails |
| low | Stale `App.jsx` mount anchors `:8622`/`:8575` (drifted to `:8631`/`:8584`) in `featureFlags.js` and `StarfieldBackground.jsx` headers | Corrected |
| low | `warpStateMachine.js` header frozen at "Phase 1 / rulings S2/S3/S7/S8"; body implements S9 (Amendment B), S10, S14; the STATE MAP block still stated the pre-Amendment-B "soonest-ending governs" rule | Header advanced to Phases 1-3 + S9/S10/S14; R-PREC line corrected to Amendment B |
| nit→correctness | Under reduced motion, a mid-session `ft-accent-changed` updated `tintRef` but never repainted the one static frame (latent — the event is dispatched nowhere yet) | Added a `[tint, reduce]` effect that repaints the static frame |
| nit | No-op `strokeStyle = colour` "restore" inside the white-blend branch (strokeStyle is never mutated there) | Removed; comment corrected |
| nit | `tint` row asserted `#00d9ff`, which equals `WARP_TINT_FALLBACK` — could not tell a real chain-walk from a fallback | Added a row that rebinds `--ft-accent` to a **distinct** colour and asserts it lands |
| nit | Orphaned `advanceWarp` JSDoc left stacked above `resolveEaseMs` after the phased insert | Moved back onto `advanceWarp` |
| nit | "PHASE 1: the override is the ONLY driver" comment — stale after Phase-2 live wiring | Retired |
| nit | Adapter header cited `App.jsx:2344` (the sibling `activeTrainingBattles`); the source is `:2345` | Corrected |

## 3. Post-fix state

- Flags remain `false`; `DesktopBackground.jsx` untouched; `tokenGuardBaseline.json` untouched.
- Suite **351 files / 6,284 tests green**; production build clean; lint clean on all touched files.
- Clean merge into current `main` (which advanced 4 commits, no file overlap).

---

*End of cumulative code review. Fixes merged into the branch; PR opened.*
