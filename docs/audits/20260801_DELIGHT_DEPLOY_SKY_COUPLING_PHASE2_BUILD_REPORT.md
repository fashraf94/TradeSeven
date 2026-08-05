# Delight Layer · Task 4 — Signature Deploy (Hold-to-Deploy Sky Coupling)
## Phase 2 build report — commit surge, post-deploy settle, button polish

**Spec:** Task 4 V1 §6 Phase 2. **Rulings executed:** R-T4-S1, R-T4-S3 (option ii), R-T4-ARCH; feel-pass round 1 approved as-is.
**Branch:** `claude/delight-deploy-sky-coupling-0q1kc6` · Phase 2 commit `253f00b9`.
**Status:** built, still dark. **SOFT STOP — second feel pass requested.**
**Anchors verified at `253f00b9`.**

---

## 1. Executive verdict table

| Item | Status | One-line |
|---|---|---|
| 3. Terminal-collision check (done FIRST) | **VERIFIED — hazard is real but not reachable today** | The ceremony doesn't unmount the button; **Phase 2's own settle does.** Guard is now structural, not timing-dependent. |
| 1. Commit surge in the lock beat | **DONE** | Attack to the sky's ceiling in 140ms, release across the rest of the 450ms window, hands off to the exhale. |
| 2. Post-deploy settle | **DONE** | Optimistic append, flag-gated, no new read path. Failure exhales instead. |
| 4. Button cosmetic pass | **DONE** | Progress-scaled charge glow. Box-shadow + border only — no layout, no copy. |
| Carry-alongs | **DONE** | `gesture` comment corrected; 8631/8584 → 8689/8642 (+ the poll citation in the same header). |
| A5 (settle lands BATTLE LIVE) | **GREEN, with a nuance** | No RESTING dip is ever *visible*; but arrival is a 15s tier ease — see §3. |
| A1 (flag-off byte-identical) | **GREEN** | Settle **and** button polish both gated; each pinned by its own row. |
| A6 (no new read paths) | **GREEN** | Guarded explicitly — the settle block may not contain getDoc/getDocs/onSnapshot/collection/query. |
| Full suite | **GREEN** | 6740 passed / 53 skipped / 0 failed (384 files). `vite build` clean. No new lint errors. |
| **BUILD_RULES §2 review** | **⚠ THRESHOLD HIT — see §6** | 10 files. `/code-review` unavailable this session; inline review performed and recorded. |

---

## 2. The feel pass — what to watch, and what to set up

**Setup:** append `?deploySkyCoupling=1` to the dashboard URL on the Vercel preview. **You need a real deploy** — the surge and the settle are on the actual deploy path, so this cannot be judged with the `?warpState=` instrument. Deploy an agent you're willing to spend; the server's 120s cooldown means one attempt per two minutes.

### A. The commit beat (the new part)

Hold all the way through and **watch the sky, not the button**, through the moment the ceremony curtain drops. The drawn sky speed:

| after lock | speed | |
|---|---|---|
| 0ms | 1.80 | where the hold left it — no step |
| 70ms | 2.00 | attack |
| **140ms** | **2.20** | **the punch — the sky's ceiling** |
| 250ms | 1.42 | release |
| 450ms | 0.70 | **scrim mounts**, exhale takes over |

**The question:** does *ramp → lock → punch → curtain* read as one continuous moment, or as two events? If the punch feels clipped, `INTENT_SURGE_RISE_MS` (140) is the dial. If it doesn't feel like enough, `INTENT_SURGE_PEAK` is at the ceiling already (2.2 = the endgame peak) — going higher means letting a commit outrank a real endgame, which is a D2 question, not a tuning one.

### B. The settle (R-T4-S2's "Back to hub" path)

After the reveal, press **"Back to hub"** — *not* "Enter the battle", which navigates away and unmounts the sky. You should return to a dashboard whose sky is at, or climbing toward, BATTLE LIVE — never sitting calm.

**Be precise about what you'll see.** The battle is injected while the ceremony is still running, and the sky then eases up over the standard 15s tier ease:

| seconds between inject and your return | sky speed | |
|---|---|---|
| +3s | 0.20 | 20% of the way |
| +8s | 0.41 | 53% |
| +10s | 0.49 | 67% |
| **+15s** | **0.70** | **at BATTLE LIVE** |

Realistically the ceremony's own floors (~9.5s minimum) run *after* injection, so expect to return with the sky **around 50–70% of the way up and still rising**. The thing A5 was written to prevent — the sky sitting at RESTING for up to two minutes after a deploy — is gone. But "lands on BATTLE LIVE" is, strictly, *arrives climbing*.

**The question:** does returning to a rising sky read as the room spinning up for your battle, or as the sky being late? If late, the lever is `TIER_EASE_MS` (15s) — Task 2 tuning, tuning-exempt, and it would affect every tier transition, not just this one. Worth a round-3 decision rather than a silent change.

### C. Abort and re-hold (regression check)

Round 1's beats must be unchanged: hold past halfway and release (exhale), and abort-then-immediately-re-hold (picks up from the decay). Nothing in Phase 2 touched those paths, but they share the same state.

### D. The button

The CTA now gathers a glow as you hold — brightest at the moment it locks. It should read as the *same* build as the sky, not a second thing happening. Nothing moves: the glow is box-shadow and border colour only.

---

## 3. Item 3 — the terminal-collision check (done first, as instructed)

**Two findings, and the second is the one that matters.**

1. **The ceremony overlay does not unmount the deploy button.** `DeployCeremony` renders as a sibling (`CommandDashboard.jsx:535`) and portals to `document.body`. Mounting it leaves the Deploy section untouched.

2. **But the button does unmount — and Phase 2's own settle is what causes it.** Both shells swap the Deploy section out the moment `isLive` flips:
   - mobile `CommandDashboard.jsx:465` — `{!isLive ? <DeployStation/> : <ManageStation/>}`
   - desktop `CommandDashboardDesktop.jsx:221` — `{!isLive && <DeployCard/>}`

   and `isLive` is computed from `activeAgentBattles` filtered on `status === 'active'` (mobile `:139-141`, desktop `:89-91`) — **exactly the state item 2 writes.** Before Phase 2 that could not happen until the next 120s poll. So the hazard you anticipated is created by this phase, not merely inherited by it.

**Is it reachable today? No — but only by timing.** `fireComplete` sets phase `'locked'` at t=0; the unmount arrives when the deploy resolves, seconds later. The hook's unmount terminal is guarded by `phaseRef.current === 'charging'`, so no abort is dispatched. And even if one were, it would land long after the 450ms surge had finished.

**That is a margin, not a guarantee**, so per your instruction the precedence is now structural (`warpStateMachine.js:936`): while a commit surge is in flight, only another commit may disturb it. Four rows pin it, including an abort with **no** `reason` field (the shape an unmount actually sends if the reason were ever dropped) and one that fires an abort on *every frame* of the attack and still requires the punch to reach full peak.

---

## 4. What was built (file:line)

**`src/components/warpStateMachine.js`**
- `INTENT_SURGE_PEAK` (`:172`) = 2.2, `INTENT_SURGE_MS` (`:182`) = 450, `INTENT_SURGE_RISE_MS` (`:184`) = 140 — all tuning-exempt.
- `isSurging` (`:821`), `surgeSpeed` (`:837`), folded into `intentSpeed` via `max()`.
- The terminal-collision guard (`:936`).

**`src/App.jsx:6570-6610`** — the §2 settle inside `handleCreateAgentTrainingBattle`. Flag-gated (`:6596`), idempotent on id, placed **before** the battle-object construction so a downstream throw cannot lose a battle that genuinely exists server-side (the D-8 defect path from the Phase 0 register).

**`src/components/Dashboard/deployCeremony/HoldToDeployButton.jsx`** — `couplingOn` latched once per mount (`:62`, lazy `useState` — this component re-renders every frame of a hold), `chargeGlow` (`:64`), `chargeTransition` (`:66`), applied at `:125`. Muted variant gets a quarter-radius glow on its rule only.

**Carry-alongs** — `src/theme/motion.js:38,112-125`; `StarfieldBackground.jsx:16-17` and `featureFlags.js:1217,1225,1271`. I also corrected the poll citation in the same StarfieldBackground header (`3887-3922` → the live `3891-3933`) since leaving a known-wrong anchor beside one I'd just fixed seemed worse than the small scope stretch — flagging it rather than burying it.

## 5. Two design points worth your eye

**The surge peak is the endgame peak, deliberately.** D2 says a *hold* must never outrank a real endgame. The surge is a different beat, and the spec doesn't bound it — so I bounded it at `SPEED_ENDGAME_PEAK`: the commit is the one moment intent is allowed to *reach* the sky's maximum, and it never exceeds it. If you want the punch louder, that's a D2 question rather than a tuning one, and I'd want a ruling.

**`INTENT_SURGE_MS` mirrors the hook's `LOCK_BEAT_MS` across a module boundary the pure core must not cross** (it cannot import a React hook). That mirror is the one thing that could drift silently and push half the signature beat behind the curtain. A test reads `LOCK_BEAT_MS` out of the hook's source and asserts the surge still fits inside it.

## 6. BUILD_RULES §2 — the mandatory review

**This diff is 10 files, which hits the "≥10 files OR ≥1500 lines" threshold, so `/code-review` is mandatory.** That slash command is not available in this session. Rather than skip the rule or pretend it ran, I performed the review inline and record it here — **you may still want to run `/code-review` yourself before merging**, and I'd support that.

What the review covered and found:

- **Full diff re-read for correctness.** `surgeSpeed` division-by-zero paths checked (`rise = 0` and `fall = 0` both have explicit branches); `isSurging` under negative elapsed (clock skew) holds the punch rather than stranding; `surgeAt` is never cleared but `isSurging`/`surgeSpeed` both close on the window, so aborts are accepted again afterwards and nothing pins.
- **Scope check on the settle.** `handleCreateAgentTrainingBattle` is the agent-deploy path only; `setActiveAgentBattles` is in the same component scope; the injected shape is exactly what the adapter reads and nothing more.
- **A1 leak hunt.** Both new production behaviours (settle, glow) are flag-gated, and each has a mutation-checked row proving the gate is load-bearing.
- **Build verification.** `vite build` exits 0 — worth doing explicitly because no test in the repo imports `App.jsx`, so a syntax error there would pass the whole suite.
- **Lint.** No new errors: `App.jsx` reports 133 at HEAD and 133 after. One pre-existing error in `HoldToDeployButton.jsx` (`'motion' is defined but never used`, an eslint-config gap — `motion.button` in JSX isn't seen by this config) is present at HEAD and left alone per §3.

Nothing found that required a fix. The residual risk I'd point a reviewer at is §3's timing analysis and §2B's settle nuance — both judgement calls surfaced rather than resolved.

## 7. Test posture

**44 new rows.** Totals: `warpStateMachine.test.js` 136, `starfield.intent.test.jsx` 20, `warpBattleAdapter.test.js` 24, `App.deploySettle.test.js` 6 (new).

- **Surge (9 rows)** — punches to the ceiling; never exceeds the endgame peak; starts exactly where the hold left the sky; rises then falls; hands off to the exhale rather than dropping to nothing; monotone after the peak; an abort never launches one; a keyboard commit still punches; the window fits inside the lock beat.
- **Precedence (5 rows)** — an abort mid-surge is ignored *by identity*; a no-reason abort likewise; the punch still reaches full peak under an abort every frame; aborts are accepted again after the window; a genuine second commit re-anchors.
- **A5 (6 + 6 rows)** — the injected shape projects to BATTLE LIVE and explicitly *not* RESTING; claims no endgame at deploy; a missing `expiresAt` still counts as live but capped; self-heals on the next poll; a failed deploy injects nothing. Plus the site guard: appended, flag-gated, correct shape, success-only, idempotent, **and no new Firestore read path**.
- **jsdom (5 rows)** — the surge reaches the *drawn* speed end-to-end; an unmount abort can't replace it; the glow is absent flag-off, grows with progress flag-on, and changes no layout property or copy.

**One Phase 1 row was deliberately replaced.** It asserted "commit and abort are treated identically (the surge is Phase 2)" — Phase 2 is precisely what makes them differ, so it would have failed. The replacement pins the new truth: a commit is strictly louder while its surge runs, and the two converge onto the same exhale once the punch is spent.

**Mutation checks** (each reverted):

| Mutation | Result |
|---|---|
| Remove the terminal-collision guard | 2 precedence rows fail ✓ |
| Launch the surge from 0 instead of the hold's peak | the continuity row fails ✓ |
| Un-gate the settle | 4 settle rows fail ✓ |
| Un-gate the button glow | the A1 glow row fails ✓ |

## 8. Unchanged, as scoped

The ceremony itself (untouched), hold duration (D5), the 8 filed Phase 0 defects (still filed, not fixed), and no new Firestore read paths. Flag posture unchanged: `DEPLOY_SKY_COUPLING_ENABLED = false`. **T3's tier tuning still ships live on merge** and must be named in the PR description, as ruled.
