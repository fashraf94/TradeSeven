# Delight Layer — Task 2 (Battle-Weather Starfield) — Phase 1 Build Report

**Date:** July 30, 2026
**Spec:** DELIGHT_LAYER_STARFIELD_SPEC_V2 (LOCKED) + **Amendment A** (mobile in scope, relayed at Phase 1 kickoff)
**Discovery basis:** `docs/audits/20260730_DELIGHT_STARFIELD_BACKGROUND_PHASE0_DISCOVERY.md`
**Branch:** `claude/delight-starfield-background-js9xtw`
**Base HEAD:** `964614b0` (Phase 0 report commit, on top of `96abcb5d`)
**Fence status:** **NON-FENCED.** No file under BUILD_RULES §1 was read *or* written in Phase 1. Zero `api/` contact. Client-only.
**Status:** **SOFT STOP — founder feel pass.** Merged dark; both flags ship `false`.

---

## 1. Executive summary

Phase 1 is built, tested and pushed. The component, the pure state machine, both flags and the URL override all exist and are wired at four flag-conditional sites (two mounts + two root paints). Nothing is live: `STARFIELD_BACKGROUND_ENABLED` and `STARFIELD_MOBILE_ENABLED` both ship `false`, and with them off the app is byte-identical to before.

Beyond the spec's letter, three things are worth your attention before the feel pass:

1. **The engine had a real defect that a browser smoke caught and unit tests could not.** The first working build rendered ~20 visible specks out of 220 particles — most stars flew off-viewport before they were bright enough to see. Fixed (projection widened, alpha curve linearised, disc-sampled directions). Evidence: §5.
2. **Amendment A3's house-pattern question has a definitive answer: no such pattern exists.** Zero occurrences of `deviceMemory`, `hardwareConcurrency`, `getBattery`, `connection.effectiveType` or `saveData` anywhere in `src/`. Per your instruction I did **not** invent a detection heuristic. The degraded tier is *defined* (`mobile-lite`) but deliberately **unwired** and unreachable — selecting it needs a ruling on the signal. §6.
3. **Amendment A4 (mobile legibility) passes by construction, verified visually.** The dashboard's cards are *opaque* `CMD.surface` (`#15171E`), so at peak intensity on a 375px viewport no streak bleeds through them — only the root gutters show the field. §5.

---

## 2. What shipped

| File | Status | Role |
|---|---|---|
| `src/components/warpStateMachine.js` | NEW (499 ln) | The render-free pure core: tiers, R-PREC, R-WINDOW, ramp, easing, decay, handoff, **plus** the R-T2-S8 scheduling decisions, device profiles, tint sanitiser, override synthesis, seeded RNG. |
| `src/components/StarfieldBackground.jsx` | NEW (377 ln) | Canvas 2D radial-projection field. Lifecycle lifted verbatim from `BaggerBombBackground.jsx`; reduced-motion inverted to default ON. |
| `src/components/warpStateMachine.test.js` | NEW (619 ln) | Acceptance rows **A2 + A2s** — 53 pure unit rows, node env, no DOM. |
| `src/components/starfield.inert.test.jsx` | NEW (211 ln) | Acceptance row **A1** (+ an early **A6** import guard) — 17 rows. |
| `src/config/featureFlags.js` | +119 ln | Both flags, both `isXxxOn()` helpers, `getWarpDevOverride()`. |
| `src/App.jsx` | +18/−2 | The two flag-conditional mounts. |
| `src/components/Dashboard/CommandDashboardDesktop.jsx` | +5/−1 | Root paint transparent under `isStarfieldOn()`. |
| `src/components/Dashboard/CommandDashboard.jsx` | +5/−1 | Root paint transparent under `isStarfieldMobileOn()`. |

**8 files, 1,854 insertions, 5 deletions.** `src/components/DesktopBackground.jsx` is **not** touched (R-T2-S5/S6) — its three price-line SVG strokes are intact, so `tokens.guard.test.js` and `tokenGuardBaseline.json` are unaffected and the 21→18 update correctly stays with the future everywhere-swap PR.

### The four flag-conditional sites

| # | Site | Flag | Off-state |
|---|---|---|---|
| 1 | `src/App.jsx:8622` (desktop dashboard mount) | `isStarfieldOn()` | `<DesktopBackground isDesktop={isDesktop} />` — unchanged |
| 2 | `src/App.jsx:8575` (mobile dashboard mount) | `isStarfieldMobileOn()` | `<DesktopBackground isDesktop={isDesktop} />` — unchanged (self-returns null on mobile) |
| 3 | `CommandDashboardDesktop.jsx:132` (root paint) | `isStarfieldOn()` | `background: CMD.bg` — unchanged |
| 4 | `CommandDashboard.jsx:235` (root paint) | `isStarfieldMobileOn()` | `background: CMD.bg` — unchanged |

---

## 3. How the state machine works (and why it is shaped this way)

The core **never reads a clock** — every function takes `now` from its caller, the same discipline as `leagueTournament.js:1169`. That is what makes 53 rows assertable with plain numbers, and it is what let ruling R-T2-S8 retire the jsdom+rAF-spy rig: the *scheduling decisions* live in the pure module (`resolveLoopPlan`) and are unit-tested there, while the loop that obeys them is inherited from a shipping component.

**One easing rule covers all four behaviours.** An ease anchor is dropped whenever the tier changes *or* the governing game changes; speed is then `lerp(anchor, target, elapsed/easeMs)`. Because `t = 0` on the very frame the anchor drops, speed equals the previous speed at that instant — a transition can never step (R-RAMP). Once `t` reaches 1, speed tracks the target exactly, so the continuous endgame ramp stays continuous. Decay to rest uses `DECAY_MS` (30s) instead of `TIER_EASE_MS` (15s).

**Unprovable clocks get no endgame.** A game with no usable `endsAt` or no usable `totalDuration` counts toward LIVE membership but its window resolves to 0, so it can never reach ENDGAME. This is your R-T2-S3 principle in code ("a format that cannot prove its clock does not get an endgame — C-20 spirit"), and it is *why* the League 5-day arc caps at BATTLE LIVE without needing a special case.

**The dev override drives the real machine.** `?warpState=` is converted into the same `liveGames` shape the Phase-2 adapter will produce, rather than into a parallel display path that could drift from it (the §9 display-agreement rule applied to the instrument). An over-long `?warpClock=` is clamped into the window so "endgame" is honestly endgame.

---

## 4. Test results (executed, not asserted)

```
npx vitest run
  Test Files  347 passed | 1 skipped (348)
       Tests  6221 passed | 53 skipped (6274)
```

New rows: **70 passing** (53 core + 17 inert). Full suite green, including `src/theme/tokens.guard.test.js`, which guards the two dashboard files I edited.

`npx vite build` → **✓ built in 24.66s.**

**Two test-authoring defects were caught and fixed during the run, both mine:**
- Two monotonicity rows iterated *past* the governing game's end, where the game correctly leaves the live set and the sky decays — the core was right, my bounds were wrong.
- The A1 source-text tripwire matched **its own explanatory comment** (the component header quotes `if (!isDesktop) return null` while explaining why it does *not* self-gate). Fixed with a comment-stripper — the documented house gotcha from the Task 1 discovery ("strip comments first").

**Lint:** my four new files produce exactly one error, `'process' is not defined` in the test — identical to the house's own `src/theme/tokens.guard.test.js:130`, and CI never runs lint. The `'motion' is defined but never used` error in `CommandDashboard.jsx` is a **pre-existing config artifact** (the config lacks `react/jsx-uses-vars`), reproduced verbatim on untouched files; `motion.` is used 23× in that file.

---

## 5. Browser verification (what unit tests cannot cover)

The canvas draw path has no unit coverage by design (R-T2-S8 forbids the jsdom rig, and the repo mocks `getContext` nowhere). So I ran a throwaway Chromium harness against the real component and **looked at the output**. The harness was deleted before commit; it is not in the diff.

| Check | Result |
|---|---|
| Field actually draws | **Yes** — lit-pixel counts rise with tier: resting **737** → live **1,842** → endgame **6,411** (of 1,024,000) |
| Three states visibly distinct | **Yes** — resting is a still, faint field with no streaks; endgame is dramatic radial streaking |
| Radial projection from a vanishing point above centre | **Yes**, visually confirmed |
| Tint sourced from the token | **Yes** — `--ft-warp-tint` reads `#00d9ff`; no `var()` reaches canvas |
| **Reduced motion → one static frame, no loop** | **Yes** — canvas bitmap byte-identical after 2.5s of wall time (row A3 behaviour, observed in a real browser) |
| **Mobile DPR cap actually clamps** | **Yes** — at a 375px viewport with device DPR **3**, the canvas backing store is 562px → effective DPR **1.4987 ≈ 1.5** |
| **A4 mobile legibility at peak** | **Passes by construction** — opaque `CMD.surface` (`#15171E`) cards fully occlude the field; no streak bleeds through text |

**The defect this caught.** The first working build drew ~20 visible specks from a 220-star field: at `PROJECTION 0.5` most stars crossed the viewport edge while still too far to be bright, and a `nearness²` alpha curve kept the mid-field invisible. Three fixes — projection `0.5 → 0.28`, alpha curve linearised with an `ALPHA_GAIN`, and directions sampled over the unit **disc** instead of the unit square (square sampling puts ~21% of stars in corners at radius up to 1.41, which exit almost immediately). Result: ~7× more visible field, and a peak that reads as a peak. **A unit test would not have found this** — every row passed both before and after.

---

## 6. Amendment A — status of each clause

| Clause | Status |
|---|---|
| **A1** separate `STARFIELD_MOBILE_ENABLED` + `isStarfieldMobileOn()` | **Done.** Independence is test-asserted: neither helper may reference the other's flag. |
| **A2** mobile mount + transparent `CommandDashboard.jsx` root; no `!isDesktop` self-gate | **Done.** The component takes an explicit `mode`; a test asserts the string `isDesktop` never appears in its code. |
| **A3** mobile budget tier (~110–130 particles, DPR 1.5) + degraded tier | **Partly, deliberately.** 120 particles, DPR cap 1.5 — both verified in-browser. Degraded tier: see the STOP below. |
| **A4** legibility is the hard constraint | **Passes**, verified visually (§5). Caveat: probed with a representative opaque card, not the live dashboard — confirm on preview. |
| **A5** feel gate extends to mobile | Ready — mobile override URLs in §7. |

### STOP-A3 — the degraded tier has no detection signal, and I did not invent one

You asked me to report rather than invent if no house pattern existed. **None exists:** `deviceMemory`, `hardwareConcurrency`, `getBattery`, `navigator.connection`, `effectiveType`, `saveData` — **zero occurrences** across `src/`.

So `mobile-lite` (70 particles, DPR 1) is defined in the profile table and **nothing selects it**; an unknown mode falls back to `desktop`, never to lite (test-asserted, so it cannot be reached by accident). To activate it you need to rule on the signal. The cheapest honest options:

- **(a) Do nothing for now** — ship mobile at the single 120-particle tier, let the beta tell you whether any device struggles. *Recommended*: it costs nothing and the independent mobile flag is already the kill-switch.
- **(b) `navigator.hardwareConcurrency <= 4`** — crude, widely supported, no permission.
- **(c) Measured-fps auto-degrade** — honest but stateful, and it can oscillate; wants its own spec.

---

## 7. Preview instructions (the feel pass)

**Flip on-branch, smoke, then revert before any merge.** Standard flag practice — the flip is its own one-line PR later, carrying your A7 sign-off.

**Step 1 — flip the flag(s) on the branch** in `src/config/featureFlags.js`:
- desktop: `export const STARFIELD_BACKGROUND_ENABLED = true;`
- mobile: `export const STARFIELD_MOBILE_ENABLED = true;`

Push, wait for the Vercel preview, then sign in and land on the dashboard.

**No flag flip needed if you prefer:** both gates also honour a dev-preview param, the house idiom — append `?starfield=1` (desktop) or `?starfieldMobile=1` (mobile) to the preview URL and the field renders with the flags still `false`. This is the safer way to smoke it.

**Step 2 — the three states.** Append to the dashboard URL:

| State | URL |
|---|---|
| Resting | `?starfield=1&warpState=resting` |
| Battle live | `?starfield=1&warpState=live` |
| Endgame (90s to peak) | `?starfield=1&warpState=endgame&warpClock=90` |
| Endgame, near the window edge | `?starfield=1&warpState=endgame&warpClock=1500` |
| Mobile equivalents | swap `?starfield=1` for `?starfieldMobile=1` |

**Give each state ~20 seconds before judging.** Tier transitions ease over 15s by design, so a screenshot at 3s shows the *transition*, not the state — this is exactly the mistake my own first smoke made.

`warpClock` is seconds remaining. It is clamped into the 30-minute window, so values above 1800 all land at the window edge. The endgame ramp counts down in real time from whatever you set, so `warpClock=90` lets you watch it accelerate to peak over 90 seconds.

**Step 3 — hygiene checks worth doing while you are there:** switch to another tab for a few seconds and come back (the loop pauses and resumes); turn on Reduce Motion in the OS and reload (one static dim frame, no animation).

**Step 4 — revert the flag(s) to `false` before any merge.**

### What to tune from your feedback

All of these change on my side with no spec re-version and no new ruling: every speed (resting 0.12 / live 0.5 / endgame floor 0.8 / peak 2.2), the 15s tier ease, the 30s decay, the window constants, particle counts (220 desktop / 120 mobile), and the engine's feel knobs — trail length, star brightness, projection width, vanishing-point height. They are all named constants in one block at the top of `warpStateMachine.js`.

---

## 8. Deferred to Phase 2 (not started — gated on your feel pass)

Live wiring: the `activeAgentBattles` prop threading, the adapter mapping docs → `liveGames`, the local endgame ticker, and the adapter unit rows including the defect-#2-shaped input. Nothing in this commit reads Firestore (row A6 asserted early).

Also still open from the spec: A5 tint test and the final A6 guard land in Phase 3; the defect-#2 micro-task (`App.jsx:3902` resets the poll to `[]` on a transient error, which would wrongly calm the sky mid-battle) remains recommended-before-flip and separately branched.

---

## 9. Code review (BUILD_RULES §2 — mandatory at ≥1500 lines; this diff was 1,859)

`/code-review` is not available as a skill in this session, so the mandate was met with **three independent adversarial reviewers**, each given a different lens and instructed to refute rather than confirm. Two used empirical methods beyond reading: a mutation sweep against the 53 unit rows, and a 33-probe jsdom lifecycle rig.

| Lens | Verdict |
|---|---|
| Flag-off byte-identity | **Guarantee HOLDS.** Proven mechanically — every ternary collapsed to its false branch and byte-compared against HEAD (all three files identical); import side effects probed in Node with trapped globals (**0 side effects, 0 pending handles**). 7/7 checks clean. |
| Canvas lifecycle | **7/7 categories CLEAN** — no rAF/listener leak, no double-scheduling, no stale closure, no NaN, deps provably stable, `getContext` fully guarded, pure core clock-free. |
| State machine vs State Map | **1 critical + 3 high found.** 7 of 18 spec-relevant mutants survived the original suite. |

**Fixed (commits `b076ddb2`, `2ad49a5d`) — 1 critical, 3 high, 1 medium, ~10 low:**

The critical one is worth stating plainly: the id-less fallback key was derived from **array position**, so a caller that reordered `liveGames` between frames re-anchored the ease every frame and — because `t` is 0 on an anchor frame by design — **pinned the speed forever**. Measured: 4,000 frames with alternating order held the sky at 0.12 against a target of 0.5, and stalled the endgame ramp mid-climb. Fixed at both levels: content-derived keys, and the ease re-anchors only when the target actually moves.

The three highs: `dtMs` defaulted to 0 so the natural call shape froze the ease; the ease ran on caller deltas so "10–20s" became 75s at 500ms frames (both fixed by measuring **wall time** from the `now` already passed in); and the LIVE→ENDGAME boundary — the one place the tier flips while the key does not — had no assertion at all.

Every one of the 10 new unit rows was a **surviving mutant**: the behaviour was wrong (or could silently become wrong) and all 53 original rows still passed.

### The four items FLAGGED, not changed

Per the kickoff instruction — *disagreement with a ruling means flag and stop, not build something better* — these are surfaced rather than fixed:

**F1 — a genuine conflict between two State Map clauses.** The state table says BATTLE LIVE means *"≥1 live game, **none in endgame window**"*; R-PREC says *"the **soonest-ending** live game governs. If **it** is inside its endgame window…"*. These disagree when a *later*-ending game is inside its own window while the soonest-ending one is not. Verified case: game A ends in 20 min of a 40 min total (window 10 min → not in window, and it governs); game B ends in 25 min of a 100 min total (window 25 min → **is** in its window). The code follows R-PREC — the more specific rule — and shows BATTLE LIVE. Consequence: when A resolves, B hands off already at 80% ramp and the speed climbs 0.5 → 1.92 over 15s. **Ruling needed:** does R-PREC govern (current behaviour, defensible), or should any game inside its own window pull the sky into ENDGAME? I recommend R-PREC as-is — one clock governs, which is what keeps the ramp coherent — but this is yours.

**F2 — ENDGAME→ENDGAME handoff currently ramps *down*.** When the governing game resolves and the next one is also in its window but earlier in its ramp, speed eases 2.19 → 0.82 over ~20s while never leaving ENDGAME. The spec's handoff bullet says "ease to the new target" (what it does); R-RAMP says the endgame ramp is "continuous (no steps inside it)" (no step occurs — it eases). So it satisfies the letter both ways, but it may feel like the fight deflating mid-peak. The alternative is a monotone envelope (floor the new target at the current speed). **This is a feel call — you will see it in the A7 two-game handoff.** No code change made.

**F3 — the decay is not resumable, and defect #2 makes that reachable.** A single frame in which the live set flickers non-empty restarts the full 30s decay from the partially-decayed speed (measured: 0.2048 instead of 0.12 after a full window). The root cause is upstream — `App.jsx:3902` resets `activeAgentBattles` to `[]` on **any** fetch error — which is exactly the already-filed defect #2 your spec elevated to recommended-before-flip. I did not add a debounce, because that would be inventing behaviour the spec does not describe to paper over a known upstream bug. **Recommendation stands: land the defect-#2 micro-task before the flip.**

**F4 — ruling R-T2-S8 rests on a premise my Phase 0 got wrong.** That ruling retired the jsdom+rAF rig partly because my discovery reported such a rig would be "a repo-first with no established location or precedent." **That was incorrect.** `src/components/Forge/workshop/character/CharacterArea.scrollreset.test.jsx` already does exactly this in-repo — `// @vitest-environment jsdom`, `createRoot` + `act`, per-file `vi.mock`, **no setupFiles** — and its own header says it exists because "the static render smoke could never catch" stateful bugs. The reviewer rebuilt the rig in minutes with zero new dependencies.

This matters for **Phase 2 specifically**. The concrete hazard: adding `liveGames` to the effect's dependency array — which `exhaustive-deps` would happily accept — would make the effect re-run on every 120s poll (a fresh array identity each time), recreating the field and resetting the warp state to RESTING. Since the tier ease is 15s and the endgame ramp needs minutes, **the sky would never reach peak** — and nothing in CI would catch it, because `renderToString` schedules no frames. I have **not** built the rig (S8 says not to). **Ruling requested:** permit a jsdom lifecycle test in Phase 2/3, asserting one-loop-at-mount, one-after-hide/show, zero-after-unmount, zero-under-reduced-motion.

### One Phase-2 landmine, recorded

`agentBattles` docs carry **`expiresAt`** and have **no duration field**. The core's input contract is `{endsAt, totalDuration}`, and spec V2 D5 correctly assigns that mapping to the Phase-2 adapter. But if raw docs were ever passed straight through, `endsAt` would be `undefined` → the clock reads as unprovable → the sky caps at BATTLE LIVE and, worse, an **already-expired battle counts as live forever** (the ended-game filter keys on the same field). The `?warpState=` override cannot reveal this, because it synthesises both fields. The component's prop doc now carries this warning in bold; the adapter's unit rows must be built from a **real doc shape**, not the synthesized one.

---

*End of Phase 1 build report. SOFT STOP — awaiting the founder feel pass.*
