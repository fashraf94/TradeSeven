# Command Center Sync Pass 1 — Cumulative Code Review

**Date:** August 31, 2026
**Branch:** `claude/cc-sync-pass1-5lz5sb` vs `origin/main` (`fa6dfed7`)
**Trigger:** BUILD_RULES §2 — review is mandatory at ≥10 files OR ≥1500 lines on the cumulative branch diff. This branch: **32 files, ~3,500 insertions.**
**Method:** 6 independent dimensions → adversarial refutation of every finding → completeness critic. 48 agents.
**Disposition:** **41 findings · 15 CONFIRMED · 26 REFUTED.**

---

## Executive verdict

| | |
|---|---|
| **Flag OFF** | **Safe.** Byte-identity proven against a golden captured from the pre-pass component; `vite build` clean; the added Firestore read sits inside the flag branch, so the read bill is unchanged. |
| **Flag ON** | **Safe to smoke-test, after the fixes below.** The timezone blocker made every off-hours time wrong outside Eastern; it is fixed and re-proved across five zones. |
| **Un-gated changes** | P-4, P-5, the `PvpCommandCenter` deletion: verified sound. **P-6 carried three defects** and is the one part a preview cannot exercise, because crons do not run there (BUILD_RULES §6). All three are fixed. |
| **Fence** | **Not touched.** No file on the `docs/BUILD_RULES.md:14-24` list is edited. Fenced files were read only. |

BUILD_RULES §2 checklist: multi-lens ✅ · adversarial refutation ✅ · explicit `vite build` ✅ (exit 0) · mutation-checked where tests were added ✅ · written down ✅ (this file).

---

## CONFIRMED findings and their dispositions

### BLOCKER 1 — every off-hours time was wrong outside Eastern · FIXED

`getMarketState()`'s `nextOpenTime` / `nextCloseTime` are **not instants**. `getETDate()` (`src/utils/marketSchedule.js:76`) re-parses a `toLocaleString('en-US', {timeZone:'America/New_York'})` string in the **browser's** zone, so the resulting Date's *local fields* are the ET wall clock while its *epoch* is shifted by `(browserOffset − etOffset)`. `CommandDashboard.jsx:203` already documents this for its own use.

The adapter took `.getTime()` of those Dates and `deskCopy` re-projected the epoch through `Intl`/`America/New_York` — double-converting. Measured against the unmodified module at the real instant `2026-09-14T22:00:00Z`, whose true next open is **Tue 9:30 AM ET**:

| Viewer zone | Rendered |
|---|---|
| `America/New_York` | `Tue 9:30 AM ET` ✅ |
| `UTC` | `Tue 5:30 AM ET` ❌ |
| `America/Los_Angeles` | `Tue 12:30 PM ET` ❌ |
| `Asia/Tokyo` | `Mon 8:30 PM ET` ❌ wrong **day**, and in the past |

The branch's own tests could not catch it: the fixtures injected true-UTC Dates, a shape `getMarketState()` only returns when the runner's TZ *is* ET.

**Fix.** Wall clocks are carried structurally as `nextOpenEt {weekdayIndex, hour, minute}` and formatted from the **fields**; `nextDecisionAt` keeps only true instants. The close-clamp compares ET minutes-past-midnight on both sides. Re-proved across five zones — all now render the identical correct string. Fixtures rebuilt with the local-field constructor, matching the real producer.

> **Self-criticism worth recording:** the Phase 0 discovery report flagged `getETDate()` as "the exact anti-pattern `tournamentTime.js:5-7` calls out" — and the build then consumed `.getTime()` of its output anyway. Finding a hazard in discovery is worth nothing if the build does not carry it forward.

### BLOCKER 2 — P-6 jammed its own queue · FIXED

`reviewPending` cleared **only** inside the review write (`agent-batch-review.js:260`). A queue-sourced battle hitting either early return — `already_reviewed` (`:110`) or `no_activity` (`:126`) — kept the flag forever. The queue is `limit(5)`, unordered: **five stuck battles permanently starve the drain and no battle ever gets a debrief again** — strictly worse than the bug P-6 was written to fix.

Compounding it: `completeBattle` stamped the flag **unconditionally** (`agent-evaluate.js:4302`) while `pendingReflection` two lines above is CPU-gated. Passive tournament CPU battles — which have no trades and no evaluations by construction (P4 contract #5) — were parked in a queue they could only ever be skipped out of.

**Fix.** The flag releases on every terminal path; failures deliberately do *not* release, so a thrown error retries next run. The stamp is CPU-gated to match `pendingReflection`. The two selection lists are de-duped.

### BLOCKER 3 — duplicate, misdated debriefs · FIXED (found by the completeness critic)

`processBattleReview` deduped on `r.date === todayStr`. A battle reviewed while still active on day D, completing overnight, finds no review dated D+1 and is reviewed a **second** time: a duplicate debrief, a duplicate `statusFeed` beat, a duplicate auto-debrief message in a finished battle's chat, and a duplicate lesson `arrayUnion`'d onto the **agent** doc — which feeds prompt assembly.

**Fix.** A completed battle dedupes against its own completion day (ET); active battles still dedupe against today.

### MAJOR — the Desk could describe the wrong battle · FIXED

Both shells built the adapter from **unsorted** `liveBattles[0]` while rendering Manage cards from `orderedLiveBattles`. With a ranked battle and a casual clone live together — possible today, `CASUAL_CLONE_CONCURRENCY_ENABLED` is `true` — the Desk could describe one battle while sitting above another, unlabelled. Fixed to follow `orderedLiveBattles[0]`.

### MAJOR — a still-true countdown was discarded · FIXED

A crypto fullday battle expires at 8:00 PM ET, four hours after the close. For that window it is `LIVE_CLOSED` **and** still counting down to an end the next open never reaches — so replacing "3h left" with "Resumes Tue 9:30 AM ET" discarded the truer fact. The resume time now rides the activity line; the countdown keeps the rail.

### MAJOR — the alert channel replayed old events as new · FIXED

`BreakthroughAlerts` keeps a **mount-scoped** dedupe set and shows each entry for 60 seconds. Inside `AgentChat` that is fine — it mounts when a battle opens. On the Dashboard it mounts on every visit, so an unfiltered feed replays an hours-old `gameplan_meeting` as freshly-arrived, every time. The adapter now bounds the alert feed to the last hour. The Desk's own feed *line* stays unbounded — it is stamped, so it claims no freshness.

### MAJOR — `deriveNextDecisionAt` ignored the injected `now` · FIXED

It clamped only against the close, never against the present, so a starved eval tick rendered a "next ~" that had already passed. Now returns null in that case and the posture degrades to `Checked {time}` with no invented follow-up.

### MAJOR ×2 — two tautological guards · FIXED

Both mine, and both would have passed with the feature deleted:

1. The Huddle test **re-implemented the component's ternary in its own body** and never imported the screen. Tab identity is now its own module (`src/screens/agentBattleTabs.js`) and the test loads it.
2. The `ManageStation` row claiming to guard the shells' battle-id match **compared the component to itself**. The guard is extracted as `syncForBattle` and tested where it lives.

### MINOR — the cron rider was inert · REVERTED

`voice-layer-cache.js:661` skips unless `OPEN`/`PRE_MARKET`, and hour 21 UTC is post-close in both DST regimes, so every tick the rider added was rejected. It captured no new data and only created drift against the handler's header comment — the BUILD_RULES §6 hazard. Reverted; cron count returns to its original 39.

> **If post-close proximity should refresh, the handler's market-hours guard is what needs changing, not the schedule.** Founder call.

### MINOR — `0.0 ATR from next bonus tier` · FIXED

`detectRedZone` only admits positions near a threshold, so sub-0.05 gaps are common, and `0.0` reads as "it arrived" for a position that crossed nothing. Renders `<0.1` now.

---

## Notable REFUTED findings

Recorded because a review that never refutes itself has not been run adversarially.

- **"The `get()` join breaks existing client reads."** Refuted. The only client-SDK reader (`tournamentGroupService.js:499`) resolves its agent via `where('ownerId','==',uid)` at `:471-474`, so it *is* the owner.
- **"The leak self-clears on the next trading day."** Refuted by the refuters, then **partially overturned** by the critic: the path they traced is real but does not generalise, because some completed docs never produce a non-empty `todayEvals`. Treated as confirmed; fixed regardless.
- **"POST_CLOSE renders misleading swap locks."** Refuted as a defect — rulings §6 explicitly asks POST_CLOSE to render stamped numbers. Noted below as unreachable in practice.
- **"Flag-off is not byte-identical."** Refuted across every touched file.

---

## Open items — NOT fixed, recorded for the founder

1. **POST_CLOSE is unreachable on the Desk.** Both shells filter to `status === 'active'` before building the adapter, so `derivePhase` never returns `POST_CLOSE` through this wiring. `DESK_COPY.postureComplete` is a dead branch and rulings §6's "POST_CLOSE renders stamped numbers" is undelivered — the POST_CLOSE slot is served by `ReviewStation`'s `debrief_pending` card instead. The screenshot for that state is therefore **synthetic** (driven directly through the adapter). Not a defect; a spec/wiring mismatch that wants a ruling.
2. **Flag-off costs a few KB.** `AgentDesk` statically imports `BreakthroughAlerts`, and `AgentDesk` is statically imported by both eagerly-loaded shells — so `LiveActivityPanel` is now duplicated into the eager chunk, where before it lived only in the lazy `AgentBattleScreen` chunk. A dynamic import would recover it.
3. **The new read is not `trackRead`-accounted** (`src/App.jsx:3975`), so read accounting under-reports once the flag flips. Matches the adjacent pre-existing precedent (the `tournamentGroups` `getDoc` is also untracked).
4. **The Manage card's eyebrow still reads `· LIVE` beside a pulsing dot** while the body says "Market closed". True of the battle and true of the market respectively, but it reads as a contradiction. Left for Claude Design's layout pass rather than resolved unilaterally.
5. **`agent-batch-review` still has no coverage outside the new predicate** (411 lines, previously zero tests). Deliberate scope limit, per rulings §10.

---

## Verification of record

```
vite build                exit 0
npm run test:run          exit 0   Test Files 518 passed | 1 skipped (519)
                                   Tests 8628 passed | 62 skipped (8690)
npm run test:rules        exit 0   Test Files 5 passed (5)
                                   Tests 139 passed (139)
```

Baseline at `origin/main` was `Test Files 509 passed | 1 skipped (510)` / `Tests 8403 passed`. Every test added on this branch was mutation-checked — a defect was injected for each guard and the guard reddened. Crons do not run on Vercel preview, so P-6 is verified by unit tests on the selector plus observation of the first production run, never claimed as preview-tested.
