# League Tournament — Launch Runbook (P9)

**Status:** the go-live procedure of record for the League Tournament. Created at P9 (2026-06-13).
**Audience:** the founder (non-technical). This is a checklist — do the steps in order; do not skip ahead.
**The one rule that governs everything below:** the flag flip is **LAST**, and it must never precede the Firestore rules deploy. If you flip the tab before the rules are deployed, every screen in the League tab fails to load (every read is denied — a 403).

**Companion documents:** the go/no-go that gated this launch is `docs/audits/2026-06-13_P9_STAGE0_LAUNCH_READINESS_ASSESSMENT.md`; the phase record is `docs/audits/2026-06-13_P9_PHASE_REPORT.md`; the deferred-items watch list is `docs/LAUNCH_READINESS_WATCH_LEDGER.md`.

---

## Part A — The go-live sequence (the order of record)

Do these **in order**. Each step has a "confirm before continuing" gate.

### 1. Merge the P9 work (everything except the flip)
Merge the P9 pull request — the reconciliation dev-screen report, this runbook, and the phase report. **It does not contain the flag flip.** After it merges and deploys, nothing changes for users (the tab is still hidden) — this is intentional.
- **Confirm:** the P9 PR is merged and the Vercel production deploy is green.

### 2. Deploy the five Firestore rules blocks (the blocking gate — your action)
The five tournament collections are read-protected by rules that live in the repo but are **inert until you deploy them in the Firebase Console**. Deploy them now.
- The five blocks (all in `firestore.rules`): `tournamentGroups` (line 302), the recursive subcollections block `tournamentGroups/{groupId}/{document=**}` (line 312), `tournamentBrackets` (line 322), `tournamentLeaderboards` (line 334), `tournamentRanks` (line 339).
- **How:** Firebase Console → Firestore → Rules → publish the current `firestore.rules`. (The CLI equivalent is `npm run deploy:rules`, which runs `firebase deploy --only firestore:rules` — use whichever you prefer; both require your Firebase credentials. **This step is never automated by a Claude session.**)
- **What each block grants:** authenticated **read** to all tournament surfaces (groups, claims, boards, streams, ledger, brackets, leaderboards, ranks); **no client writes** (every mutation goes through the server endpoints). This is exactly the spectator-transparency + server-authoritative-writes design.
- **Confirm:** the Console shows the tournament rules as published.

### 3. Verify the deploy (a read that would have 403'd now succeeds)
Open the dev surface (`?tournamentDev=1`, signed in) and confirm a tournament read resolves — e.g. the bracket card or leaderboard card renders, or seed a dev group and watch its doc load. Before the deploy these reads 403; after it they succeed.
- **Confirm:** at least one tournament read resolves on the dev screen with no permission error in the console.

### 4. Run the five-days-clean reconciliation → GREEN
On the dev screen, run a full simulated week and reconcile each banked day:
1. **Seed bracket** (or **Seed dev group**) → it attaches.
2. Set the **duty clock** to a Monday morning, run **Monday duty** (the pipeline: boards → agent draft → user draft → deploy).
3. For each simulated day Mon→Fri: step the duty clock forward one day, click **Bank scores**, then click **Reconcile ledger**.
4. Read the **Reconciliation** card after each day.
- **GREEN** = `divergences: 0` — every held symbol resolves to a verified holder (no orphaned brackets, no silent loss). This is the launch criterion of record.
- **RED** = one or more divergences listed (`wrong_holder`, `unverifiable_holder`, `not_in_portfolio`, `duplicate_holding`, `missing_in_ledger`, `foreign_battle`). **A RED is a STOP** — do not proceed to the flip; report it.
- **Confirm:** five consecutive banked days reconcile GREEN.

### 5. Confirm the security pass holds
The P9 audit verified every item server-authoritative (claim window/day-5/cap, flip cap, the WHY projection allowlist, server-only mutation, the dev/prod boundary). No action is needed unless step 4 or a pre-flip change surfaced something. If anything changed since the audit, re-read `docs/audits/2026-06-13_P9_STAGE0_LAUNCH_READINESS_ASSESSMENT.md` §Block 3.
- **Confirm:** nothing has changed the security posture since the audit.

### 6. Flip the flag (LAST — your deliberate action)
Only now, with steps 2–5 confirmed, make the one-line change and merge it as its **own** commit/PR (never bundled with other work):

```
src/config/featureFlags.js — line 78
- export const TOURNAMENT_TAB_ENABLED = false;
+ export const TOURNAMENT_TAB_ENABLED = true;
```

A staged, ready-to-merge branch carrying exactly this one-line commit accompanies the P9 work (see Part C). Merge it deliberately after steps 2–5 are green.
- **Confirm:** the flip PR is merged and the production deploy is green. The "League" tab (Trophy icon) now appears in the bottom nav (5 items) and the desktop sidebar (7 items).

### 7. Begin the first-week observation plan (Part B)
The tab is live. Real users will now reach it. Begin the quiet-success watch.

---

## Part B — The first-week observation plan (quiet-success checklists)

**Recall what "launched" means operationally:** the tab is reachable and real groups play, but **V1 has no self-serve registration/join** — groups are **founder-formed** (you create them and place members). So a brand-new user reaching the tab sees the empty-state poster ("No active tournament group yet…") until you form their group. That is expected; it is not a bug.

A "quiet success" is one where you observe the expected logs and surfaces and have nothing to do. Watch for the **first** of each event:

### B1 — The first real Monday pipeline (the orchestrator's `monday_pipeline` duty)
The production orchestrator cron (`*/10` in the 11:00–14:00 UTC window, Mon–Fri) has been live and inert since P4; the first real (non-dev) group makes it act.
- **Expect:** agent boards produced → agent draft resolved → user draft resolved → six-pick deploys per agent (real `decide.js` deploys, `gameMode: baggerbomb_tournament`).
- **Quiet success:** the group transitions FORMING → BATTLE; four players each have a battle; the orchestrator's duty marker shows COMPLETE.
- **Watch for:** `boards_missing` (a player never committed a board — the deadline auto-commit should have covered it), or any deploy showing `gated` (would mean `TOURNAMENT_DEPLOY_ENABLED` regressed — it should be `true`).

### B2 — The first real banking (the nightly `snake-draft-daily-scores` tournament branch)
Banking lands ~17:15 ET on the nightly handler; it computes each player's daily composite and writes the snapshot.
- **Expect:** `bank OK · day1` (then day2…); `closeScores[uid]` with `totalPoints`, `agentPoints`, `compositePoints`; the reconcile + leaderboard branches run after banking, fire-walled.
- **Quiet success:** composite = agent + 1.5 × user at the snapshot; the leaderboard month doc gains the group's rows; the reconcile pass logs zero divergences.
- **Watch for:** a banking `skipped` you didn't expect, or a reconcile divergence in the logs (the same divergences the dev card surfaces).

### B3 — The first real advancement (the Friday `friday_advancement` duty)
Friday evening, after day-5 banking lands, advancement locks the top two per game and composes the next round.
- **Expect:** "banking pending" no-ops earlier in the evening (normal — advancement waits for day-5 banking, then re-ticks; Monday also runs a catch-up); then top-two locked, bracket game finalized, side-effects (rank + leaderboard) stamped, `sideEffectsAt` set, next-round forming groups composed (or a champion crowned).
- **Quiet success:** the right two advance by composite; ranks and the leaderboard update once; no orphaned bracket game (every completed game carries `sideEffectsAt`).
- **Watch for (by design, not bugs):** on a **holiday-shortened week** (4 trading days), day-5 never banks, so advancement waits indefinitely for your intervention — you must bank manually or apply a founder-cited rule change. Note upcoming short weeks before they arrive.

### B4 — Standing watch items (from `docs/LAUNCH_READINESS_WATCH_LEDGER.md`)
None of these gate launch; each has a scale trigger that has **not** fired at V1. Re-check when the trigger nears:
- **My-group index (W1):** fine at 1–few groups/player; add the composite index (a Console deploy) when a long-lived player accrues *tens* of completed groups.
- **Leaderboard sharding (W2):** fine at tens of rows; land per-entry sharding **before open registration** / a few-thousand monthly actives.
- **Claim/flip read budget (W3):** bounded by group size; no action.
- **Streams/boards literals (W4):** value-consistent today; converge only if you rename a collection.
- **Client ET-date helpers (W5):** low priority; revisit only on a client ET-date drift bug.

---

## Part C — The staged flag flip (ready to merge, not merged)

The flip is prepared as its **own one-line commit on a separate branch**, staged and **not merged**, so you merge it deliberately after Part A steps 2–5 are green. It is also documented as the exact one-liner in Part A step 6 — if you prefer, make that edit by hand instead of merging the branch. Either way, the flip:
- changes **only** `src/config/featureFlags.js` line 78 (`false` → `true`),
- ships in its **own** commit/PR, never bundled with other work,
- must be merged **after** the rules deploy and a GREEN reconciliation, **never before**.

---

## Appendix — Why the flip is "only" the client tab

`TOURNAMENT_DEPLOY_ENABLED` has been `true` since P4, so the production orchestrator has been running in production the whole time — **inert**, because there are no non-dev groups and the dev-group exclusion holds at every duty. So the flip does **not** "turn on" the engine; the engine has been idling. The flip makes the **client surfaces reachable**, so real users can create real groups that the already-running orchestrator then acts on. That is why the rules deploy — not the flag — is the true blocking dependency.
