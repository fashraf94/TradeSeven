# Delight Layer · Task 4 — Signature Deploy (Hold-to-Deploy Sky Coupling)
## Phase 1 build report — the intent channel + coupling, merged dark

**Spec:** DELIGHT LAYER ARC — Task 4, V1 (July 31, 2026), Phase 1.
**Rulings executed:** R-T4-ARCH, R-T4-S1…S5 (founder relay, Aug 1, 2026).
**Basis:** `docs/audits/20260801_DELIGHT_DEPLOY_SKY_COUPLING_PHASE0_DISCOVERY.md`.
**Branch:** `claude/delight-deploy-sky-coupling-0q1kc6` · Phase 1 commit `e5b08979` (Phase 0 report `b38dad01`).
**Status:** built, dark, all tests green. **SOFT STOP — founder feel pass requested.**

---

## 1. Executive verdict table

| Item | Status | One-line |
|---|---|---|
| Intent channel (dispatch) | **DONE** | `ft-deploy-intent` from the shipped hold hook — one site covers all six deploy holds, and nothing else. |
| Intent core (curve + exhale) | **DONE** | New pure overlay in `warpStateMachine.js`; 101 pure rows. |
| Starfield listener | **DONE** | Ref-write only; cannot restart the field, inert under reduced motion. |
| Flag posture | **DARK** | `DEPLOY_SKY_COUPLING_ENABLED = false`. Preview via `?deploySkyCoupling=1`. |
| Acceptance A1 (flag-off inert) | **GREEN** | Nothing dispatched, no listener registered, hold byte-identical. |
| Acceptance A2 (pure intent rows) | **GREEN** | Monotone, `max()`, exhale bound, terminal clears, peak < endgame. |
| Acceptance A3 (event contract) | **GREEN** | Rows on both ends, driven through the real gesture. |
| Acceptance A4 (reduced motion) | **GREEN** | No loop, no repaint; button fill still shows progress. |
| Acceptance A6 (no new reads) | **GREEN** | Existing import guard still passes, untouched. |
| Full test suite | **GREEN** | 6708 passed / 0 failed (382 files). Lint clean. |
| Fence | **UNTOUCHED** | Client-only; every file is `src/*`. |
| `/code-review` (BUILD_RULES §2) | **NOT TRIGGERED** | 6 files / 1047 lines — under the ≥10 files OR ≥1500 lines threshold. |

**What is NOT here (Phase 2, by the phase plan):** the commit surge, the post-deploy BATTLE LIVE settle, and the button cosmetic pass. Today a completed hold releases from the top of the curve and exhales — a deliberate placeholder, not the final commit beat.

---

## 2. The feel pass (what to do, what to look for)

**Preview URL:** append `?deploySkyCoupling=1` to the dashboard URL on the Vercel preview. Nothing else needs enabling — the ceremony and both starfield flags are already live in production.

Run each on **desktop and phone**:

1. **The hold (the ramp).** Press and hold "Deploy". The sky should stay calm for roughly the first third, become noticeable around the halfway mark, and rush hard through the final third. *Question for you: does the threshold land where completing the hold feels like crossing something — or is the first half too dead?*
2. **The abort (the exhale).** Hold past halfway, then let go. The sky should exhale back over ~1.2s — quick release, gentle settle. *Question: does it read as an exhale, or as a switch turning off?*
3. **Hold-to-commit.** Hold all the way through. Today: the sky peaks, then exhales while the ceremony curtain comes down. *This is the placeholder.* Phase 2 replaces the exhale with the surge, timed into the ~450ms "Locked in" beat per your R-T4-S3 — the last window in which the sky is still visible.
4. **Re-hold during an exhale.** Abort, then immediately grab it again. It should pick up from where the exhale had got to, never snap down to nothing.
5. **During a live battle.** If you have a battle running, the sky is already at BATTLE LIVE (0.5) and the hold lifts it to 1.4. In a real ENDGAME the hold does nothing visible — confirmed acceptable per R-T4-S3b.

**The three numbers to tune** (all tuning-exempt — change them without a spec re-version; `src/components/warpStateMachine.js`, in `WARP_TUNING`):

| Constant | Now | What it does |
|---|---|---|
| `INTENT_PEAK` | `1.4` | How fast a completed hold drives the sky. Must stay below `SPEED_ENDGAME_PEAK` (2.2) and above `SPEED_LIVE` (0.5) — both pinned by a test row. |
| `INTENT_CURVE_EXPONENT` | `2.5` | The gentle→steep shape. Higher = deader early, more violent at the end. Lower = more linear. |
| `INTENT_EXHALE_MS` | `1200` | Abort decay length. A test row pins it below the tier eases, so an abort always reads faster than a tier change. |

---

## 3. What was built (file:line)

*(Anchors verified at commit `e5b08979`.)*

**`src/config/featureFlags.js:1337-1393`** — `DEPLOY_SKY_COUPLING_ENABLED = false` (`:1370`) + `isDeploySkyCouplingOn()` (`:1385`), cloning the `isStarfieldOn()` shape exactly (flag OR `?deploySkyCoupling=1`, SSR-safe, malformed URL degrades to the flag). The docstring carries your R-T4-S1 note for the eventual flip PR — see §5.

**`src/hooks/useHoldToDeploy.js`** — the dispatcher.
- `dispatchIntent(progress, reason)` (`:66-90`): flag-guarded, SSR-guarded, wrapped in try/catch so the ambient sky can never break a deploy.
- `tick` (`:140`): `{progress}` per frame, dispatched *before* the completion check so a hold that reaches 1 hands the terminal a curve already at its peak.
- `cancel` (`:173`): terminal `abort`.
- `fireComplete` (`:128`): terminal `commit`, from **every** input path including the keyboard (R-T4-S4).
- unmount cleanup (`:211`): terminal `abort` if the button disappears mid-charge. **This one is load-bearing** — without it, the last event the sky ever received is a live progress, and since the overlay only decays on a terminal, the sky would stay leaning in forever.

**`src/components/warpStateMachine.js`** — the pure overlay (appended as a self-contained block, so every existing line anchor in the module and in the Phase 0 report stays valid).
- `WARP_TUNING` intent values (`:118-139`).
- `DEPLOY_INTENT_EVENT` (`:721`) — the event name, defined **once** and imported by both ends so the strings cannot drift apart.
- `intentCurve` (`:733`) / `createIntentState` / `exhaleSpeed` / `intentSpeed` / `reduceIntentEvent` / `applyIntent` (`:830-836`).

**`src/components/StarfieldBackground.jsx`** — the listener.
- `intentRef` (`:256`) + the mount-once listener effect (`:258-270`): a **ref write only**, never `setState`, never `paint()` (R-T4-ARCH). Flag-off registers no listener at all.
- the consumption read in `step` (`:423`): `applyIntent(warpRef.current.speed, intentRef.current, now)`.

## 4. The architecture ruling, as executed (R-T4-ARCH)

`warpRef.current.speed` — the honest battle-state speed — is **never written to**. The intent enters at exactly one line, in `step`, decorating what gets drawn.

That placement is not stylistic. `advanceWarp` computes its ease anchor from `prev.speed` and picks its ease *duration* from `prev.speed`/`prev.tier`. Had the intent been written into `state.speed`, then on the frame a hold ended the sky would believe it was easing down from 1.4 — re-anchoring the 15s tier ease (or the 30s decay) against a speed no battle ever justified, and corrupting the `targetMoved` guard with it. **A mutation test pins this**: moving the intent off the consumption read fails four rows.

Two further consequences, both intentional:
- **Upward-only.** `max(coreSpeed, intent)`, so intent can never slow the sky. With no hold in flight `applyIntent` is provably the identity function.
- **The exhale is never cancelled.** A live event does not clear a running exhale; the two combine with `max()`. Otherwise a re-hold during an exhale would drop the sky from mid-decay to nothing in one frame — the exact kind of step R-RAMP exists to forbid.

## 5. For the Phase 2 / flip PR (your R-T4-S1 note, recorded)

Recorded in the flag docstring so it cannot be lost: flipping this flag on will **also** make the "No battle live" card flip immediately on a successful deploy rather than up to 120s late, because the Phase 2 settle appends the new battle to the shared `activeAgentBattles` state. A truthfulness improvement, not a regression — but a behaviour change *outside the sky*, and it must be named in the flip PR so it does not surprise a reviewer reading the diff.

Also standing (BUILD_RULES §2/§11): the flip PR reconciles its own pins in the same commit — the value pins in `starfield.intent.test.jsx` and the flag docstring.

## 6. Test posture

**116 new rows**, each written to fail under its own defect (house standard).

- **101 pure rows** — `src/components/warpStateMachine.test.js`: the curve (monotone, peak bounds, the gentle/steep shape, NaN safety, clamping), upward-only `applyIntent`, the exhale (decay bound, monotone, clears exactly, shorter than the tier eases, re-hold continuity), and the payload contract (clamping, terminal, malformed-by-identity, clock safety).
- **15 jsdom rows** — `src/components/starfield.intent.test.jsx` (new): A1 flag-off inertness across a full hold/abort/commit and the keyboard path; A3 the real dispatched payloads through the real gesture; the end-to-end seam (intent actually raises the drawn speed and exhales back); the depstability hazard (intent must not restart the field); A4 reduced-motion inertness plus the button-fill fallback.

**Mutation-checked** (each mutation reverted after):

| Mutation | Result |
|---|---|
| Remove the flag guard from `dispatchIntent` | 2 A1 rows fail ✓ |
| Cancel the exhale on a live event | the re-hold continuity row fails ✓ |
| `applyIntent` returns `intent` instead of `max(core, intent)` | 8 rows fail across both files ✓ |
| Move intent off the consumption read | 4 rows fail ✓ |

**Regression:** full suite `6708 passed / 53 skipped / 0 failed` (383 files). `eslint` clean on all six changed files. The A6 import guard, the depstability guard, the motion guard, and the token guard all still pass untouched.

## 7. One defect found and fixed in-build (mine, not pre-existing)

The A3 clock-safety row failed on first run and caught a real bug in my own code: a terminal arriving with an unusable clock left `exhaleFrom` set but `exhaleAt` null, which made the sky **snap** to battle speed instead of exhaling. Fixed to the conservative semantics the module already uses elsewhere ("an unprovable clock gets the safe answer, not a guess"): such a terminal clears intent outright, so the sky can never be stranded leaning in. A single bad *read* still holds the exhale for that frame and resumes on the next good one. Both directions are now pinned by rows.

The 8 pre-existing defects from Phase 0 §11 remain **filed, not fixed** (BUILD_RULES §3). None block this phase.

---

*Phase 1 ends here per the spec's phase plan. Phase 2 (commit surge in the lock beat, the §2 optimistic-append settle, button polish) starts on your feel-pass verdict.*
