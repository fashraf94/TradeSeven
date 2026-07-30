# Delight Layer — Task 2 (Battle-Weather Starfield) — Phase 2 Build Report

**Date:** July 30, 2026
**Spec:** DELIGHT_LAYER_STARFIELD_SPEC_V2 (LOCKED) + Amendment A (mobile) + **State Map Amendment B** (R-T2-S9)
**Rulings applied:** R-T2-S9, R-T2-S10, R-T2-S11, R-T2-S12, R-T2-S13
**Branch:** `claude/delight-starfield-background-js9xtw` @ `a1891903`
**Base:** `403ed91c` (the founder's flag-on → flag-off feel-pass commits, fast-forwarded)
**Fence status:** **NON-FENCED.** `api/agent/decide.js` and `api/_utils/agentBattleService.js` were **READ only** (permitted) to establish the real doc shape. Zero `api/` writes.
**Status:** **SOFT STOP — second founder feel pass.** Flags remain `false`.

---

## 1. Executive summary

The starfield now runs on real battle data. Both flags still ship `false`, flag-off is still byte-identical, and **no new Firestore read was added** — the adapter is a pure projection of the poll result `App.jsx` already holds for the "No battle live" card, so the sky and that card read one source and cannot contradict each other.

Three things worth your attention:

1. **The R-T2-S13 gate is CLEARED on evidence, not assumption** (§2). `activatedAt` has exactly one writer, is never mutated, and the repo already carries the `activatedAt || createdAt` fallback as a house pattern at two independent sites. R-WINDOW has a real denominator; no fallback constant needed inventing, so the HARD STOP does not fire.
2. **Amendment B is live and verified in a browser against real doc shapes** (§3) — including the exact two-battle case that drove the ruling.
3. **One interpretation is flagged for your call** (§4): R-T2-S10 names the ENDGAME→ENDGAME handoff, and I applied it to *any* downward move out of ENDGAME. Reasoning and the one-word narrowing are in §4.

---

## 2. The R-T2-S13 gate — CLEARED

Your HARD STOP fires if `activatedAt` is "absent or unreliable". It is neither. All VERIFIED first-hand this session:

| Question | Finding |
|---|---|
| How many paths create an `agentBattles` doc? | **One.** `createAgentBattle` → `db.collection('agentBattles').add(battleDoc)` (`api/_utils/agentBattleService.js:284`). The only other `.set()` on that collection is inside a test's fake db. |
| Is `activatedAt` always written? | **Yes** — `api/_utils/agentBattleService.js:123`, in the *same object literal* as `createdAt` (`:122`) and `expiresAt` (`:125`). All three are the same `now`. |
| Can it be updated later? | **No.** `activatedAt:` appears as a write at exactly one line repo-wide; every other occurrence is a read. |
| Is there a house fallback? | **Yes, two independent sites** — `src/utils/flat6BattleEnrichment.js:56` and `src/screens/AgentBattleScreen.jsx:610` both resolve `activatedAt || createdAt`. `api/cron/agent-evaluate.js:709` carries the same defensive fallback with the comment *"should never happen on new battles"*. |

**So the R-WINDOW denominator is real:** `expiresAt − activatedAt` = deploy instant → market close, which is genuinely that battle's whole run. The adapter uses the house fallback chain, so even a legacy doc missing `activatedAt` yields a correct denominator.

**If both stamps were ever missing**, the game still counts as live membership (matching the card) but reports `totalDuration: null`, which the core reads as an unprovable clock and caps at BATTLE LIVE — never a guessed window. That is the same R-T2-S3 principle the League 5-day arc already falls under, so no new rule and no invented constant.

---

## 3. What shipped

| File | Status | Role |
|---|---|---|
| `src/components/warpBattleAdapter.js` | NEW (105 ln) | Real-doc → `liveGames`. Pure, no React, no Firebase. |
| `src/components/warpBattleAdapter.test.js` | NEW (209 ln) | 18 rows, fixtures built from the **real doc shape** (R-T2-S13). |
| `src/components/starfield.depstability.test.jsx` | NEW (231 ln) | 6 jsdom rows — the R-T2-S12 poll-identity hazard, and only that. |
| `src/components/warpStateMachine.js` | +99/−17 | Amendment B precedence, `endgameProgress`, R-T2-S10 ease selection. |
| `src/components/warpStateMachine.test.js` | +165 | 11 new rows: Amendment B + R-T2-S10. |
| `src/App.jsx` | +14/−3 | `starfieldLiveGames` memo + the prop at both mounts. |
| `src/components/starfield.inert.test.jsx` | +15/−4 | A1 rows updated to pin the prop threading too. |

**Suite: 349 files / 6,267 tests green. Build clean.** `DesktopBackground.jsx` untouched; `tokenGuardBaseline.json` untouched.

### The adapter, and why its filter is copied rather than written

`status === 'active'` — character for character what `CommandDashboardDesktop.jsx:89` does to decide `isLive`. That is deliberate and the module says so in a comment: a filter that diverges is exactly how a sky that disagrees with the card gets built. Training clones are already excluded upstream by the poll, so they never arrive.

### Amendment B (R-T2-S9)

`selectGoverningGame` now runs two passes: any game inside its own window wins on **fraction of window elapsed**; only if nobody is in a window does the soonest-ending game govern. `endgameProgress()` is the new unit of urgency.

This makes the corrected state-table clause **automatic** rather than a second check: because pass 1 prefers any in-window game, a BATTLE LIVE verdict now *proves* nobody is in a window — they would otherwise be governing.

**Verified in a browser, real doc shapes through the adapter**, using the case from your ruling: A ends in 20 min of a 40-min run (10-min window → not in it); B ends in 25 min of a 100-min run (25-min window → at its edge).

```
governing=B-long  tier=endgame  ramp=0.013  target=0.82     (0 page errors)
```

Under the old soonest-ending rule that same instant read BATTLE LIVE, straight through B's peak.

### R-T2-S12 dep-stability test

Scoped exactly as ruled — not a general canvas rig. It proves a new `liveGames` array identity does **not** restart the field: across 5 simulated poll cycles, **zero** rAF cancellations, one loop in flight, no context churn. It also covers unmount and the reduced-motion no-schedule path.

Worth recording: its **first run caught a flaw in its own stub.** A counter-only `cancelAnimationFrame` left cancelled callbacks in the queue, which had quietly made the unmount assertion a tautology. The stub now models real cancellation semantics.

---

## 4. One interpretation, flagged for your call

**R-T2-S10 names the ENDGAME→ENDGAME handoff. I applied it to any downward move out of ENDGAME**, which also covers ENDGAME→BATTLE LIVE (the governing game resolves and the next one is live but not yet in its own window).

Reasoning: treating only the literal case leaves the **larger** drop snapping at the **faster** ease —

| Transition | Drop | Under the literal reading | As implemented |
|---|---|---|---|
| ENDGAME → ENDGAME (lower ramp) | 2.2 → 0.8 | 30s decay | 30s decay |
| ENDGAME → BATTLE LIVE | 2.2 → **0.5** | **15s tier ease** | 30s decay |

— which is the very glitch the ruling exists to remove, appearing one case over. Both are tuning-exempt and provisional. **Say the word and it narrows to the literal reading** (one condition in `resolveEaseMs`). Upward transitions still use the fast tier ease, so entering a fight stays responsive; a test row pins that.

---

## 5. Second feel pass — what to do

**Setup constraint you need to know first.** The one-live-battle guard is **per agent**, not per user (`api/agent/decide.js:689-693` queries `agentId`). So:

- **A real two-game handoff needs TWO DISTINCT RANKED AGENTS**, each with an active deploy.
- **Training-pod battles will not work as the second game** — the poll deliberately filters training clones (`App.jsx:3907-3911`), so they never reach the sky. This is intentional and matches the card.
- If running two ranked agents at once is not practical on your account, tell me — the `?warpState=` override synthesizes a single game and *cannot* demo a handoff today. Extending it to synthesize a two-game handoff is a small, dev-only addition I can make on request; I have not built it, since your kickoff says this item wants real battle data.

**Step 1 — flip on-branch** in `src/config/featureFlags.js` (`STARFIELD_BACKGROUND_ENABLED`, and `STARFIELD_MOBILE_ENABLED` for phone). Or skip the flip and use `?starfield=1` / `?starfieldMobile=1` on the preview URL — safer, and it exercises the same path.

**Step 2 — the real endgame ramp against a market close.** Deploy an agent, then open the dashboard **inside the final 30 minutes before the close** (4:00pm ET normally; 1:00pm ET on an early-close day; 8:00pm ET if the portfolio holds crypto — `expiresAt` is computed per battle). The window is `min(30 min, 25% of that battle's run)`, so a battle deployed in the morning gets the full 30 minutes. The sky should be climbing continuously, peaking in the final minute, then decaying to calm over ~30s once it resolves.

- A battle deployed **late** in the day has a proportionally smaller window on purpose — deploy 20 minutes before the close and the endgame is only the last 5 minutes. That is R-WINDOW preventing a battle from being born in endgame, not a bug.

**Step 3 — the two-game handoff.** With two agents deployed, the governing game is now the one **furthest into its own window**, so the handoff you will see is: the more-urgent battle holds the sky, and when it resolves the sky **eases down over ~30s** to whatever the second battle warrants. Watch for whether that descent reads as "that fight ended" or as a deflation — that is the §4 judgement.

**Step 4 — revert the flags before any merge.**

### Still tuning-exempt, changeable on your word

All speeds, the 15s tier ease, the 30s decay (including the §4 descent), window constants, particle counts, and the engine feel knobs (trail length, star brightness, projection width, vanishing-point height). One named block at the top of `warpStateMachine.js`.

---

## 6. Carried forward

- **Defect #2 is REQUIRED before flip** (R-T2-S11), on its own branch, not this one. Until it lands, a transient Firestore error blanks the live set for up to 120s and the sky correctly follows the card into RESTING. A row documents that behaviour as intended-given-the-bug.
- **Phase 3 remains:** A5 tint test, the final A6 import guard, and the docs note in the component header.
- **Unchanged out of scope:** Snake Draft and the 5-day-arc endgame (both still cap at BATTLE LIVE by the unprovable-clock rule), the everywhere-swap, and the `tokenGuardBaseline` 21→18 update that rides it.

---

*End of Phase 2 build report. SOFT STOP — awaiting the second founder feel pass.*
