# CC Read-Only Pre-Build Check — the PR 3 Settlement Hook Site

Date 2026-09-16 · Repo fashraf94/TradeSeven · Branch main · HEAD 7c0d191bb8b4d038b0a54355de964d9106f25bcb (merge of PR #853, Amendment B follow-up)
Every citation is file:line at that HEAD and was read in this session (VERIFIED) unless marked ASSUMED.

## 0. Git verification
- git fetch ran first via `git pull`; main fast-forwarded to 7c0d191b. Branch: main. Porcelain: empty at start and at end.
- node_modules absent; nothing installed; npx not run.
- No branch created, no edit, no commit, no push. The prompt names claude/pr3-settlement-hook-check-68fmtf; this session did not create or check it out (see scan above).
- Outside reads: GitHub API, read-only, open-PR list (for Q7).

## 1. Sources read
Addendum §0, verdict, §2 Q1, Q4, §3–§7. Spec V1.3 §1, §3, §7. Amendments A and B in full. BUILD_RULES.md in full. Code as cited below.

## 2. The seven checks

### 2.1 Predicate — CONFIRMED, code unchanged since Aug 31
- Status enum: src/constants/leagueTournament.js:84-116 (complete :94, expired :106, voided :115).
- complete terminal: api/_utils/tournamentGroupService.js:58 (`[COMPLETE]: []`), :57 (BATTLE → COMPLETE|VOIDED only), :59-60 (expired, voided terminal). transitionStatus :115-129 re-asserts on the fresh in-transaction read (:123-124).
- isWeekBanked clamped: leagueTournament.js:1353-1363. Training pods complete without ladder effects via trainingLifecycle.js:751-775 (transition :760) and the Friday plain finish tournamentAdvancement.js:324-329, so `isTraining !== true` is still required.
- Every scorer refuses non-battle: bankGroup tournamentBanking.js:385 (was :375), day-6 clamp :143-150, nightly query :414, bank-daily-scores.js:71, flip.js:139, place-cpu-claims.js:50, process-claims.js:38, reconcile-ledger.js:45, activate-training-pod.js:68. The only writer of tournamentGroups.dailyScores is tournamentBanking.js:392; agent-daily-scores.js:182 and baggerbomb-v4-daily-scores.js:269 write other collections' own dailyScores. backingPools.js mentions dailyScores only in a comment (:323).
- Last change to tournamentAdvancement.js, leagueTournament.js, tournamentGroupService.js, tournamentRank.js, tournamentLeaderboard.js and the six endpoints: bd608373, 2026-08-31 (git log -1). The addendum's anchors in these files are exact.

### 2.2 Hook site — CONFIRMED, identical lines
api/_utils/tournamentAdvancement.js:
```
308  const baseGroups = groups.filter(g => g.bracketGameId == null);
309  for (const group of baseGroups) {
310    try {
311      if (!isWeekBanked(group)) { … summary.bankingPending++; continue; }        // 311-315
324      if (group.isTraining === true) { transitionStatus(COMPLETE); summary.trainingCompleted++; continue; }  // 324-329
338      if (isFinalSnapshotDegraded(group)) { … summary.degradedLocks++; continue; } // 338-342
349      const clean = await runWeekSideEffects(db, { group, entry: null, dev: group.isDev === true, nowIso, summary });
350      if (!clean) { console.error(…deferred to next tick); continue; }             // 350-353
354      await transitionStatus(db, group.id, GROUP_STATUS.COMPLETE, nowIso);
355      console.log(`… base-layer group ${group.id}: week banked — completed …`);
356      summary.baseCompleted++;
357    } catch (err) {
358      console.error(`${LOG_PREFIX} base-layer group ${group.id} FAILED:`, err.message);
359      summary.errors++;
360    }
361  }
```
- The field a backing failure must NOT touch: `summary.errors` (:359; also incremented inside runWeekSideEffects :477-513). Marker withheld when errors > 0 or deferredToNextTick > 0: tournamentOrchestrator.js:999-1000; Friday additionally requires bankingPending === 0 and frozen === 0: :1018-1022. Marker written only when satisfied: :1180-1183 (markDutyComplete :1182). Four fields a hook must never increment: errors, deferredToNextTick, bankingPending, frozen.
- Placement: after :356, not between :354 and :356 (tests pin baseCompleted: tournamentAdvancement.test.js:494, :766, :842).
- Stale object: after :354 the in-memory `group.status` is still 'battle'. transitionStatus writes the doc and returns `to`; it does not mutate the caller's object (:115-129), and the loop's group is a spread copy (tournamentGroupService.js:311). A hook that re-checks the four-part predicate on the in-memory group fails the status clause.
- No `illegal transition "complete"` tolerance in the base loop (the bracket loop has one, :684-689): a concurrent run losing the race throws at :354 into summary.errors. Pre-existing.
- markerSummary for Friday surfaces only groups, gamesLocked, composed, champion, frozen, bankingPending (:1028-1046). A new counter is invisible in the marker/state doc unless added there.

### 2.3 Composite reader — CONFIRMED, unchanged
- getLatestBankedDayEntry :1305-1319 (maxDay = WEEK_DAYS_REQUIRED = 5, :1351). getWeeklyComposite :1340-1345 returns stored compositePoints when finite, else the unrounded legacy fallback. round2 :802-804 (`parseFloat(toFixed(2))`, non-finite → 0). computeComposite :832-834, USER_LAYER_K 1.5 :1119. rankByScores :845-849 (numeric compare, non-finite → 0).
- Banking still writes `compositePoints: round2(computeComposite(agentPoints, totalPoints))` at tournamentBanking.js:342 (was :332); agentPoints round2 :334; totalPoints round2 :319. The Sept 15 banking diff (5fef5e83) touched only the clamp return (:143-150, adds recordedDate) and the clamp log (:472-499). Strict === on stored round2 values remains the right tie test; nothing rounds differently.

### 2.4 Freeze — CONFIRMED
- TOURNAMENT_ADVANCEMENT_FROZEN = false, src/config/featureFlags.js:1143.
- Early return: tournamentAdvancement.js:282-300 (`return summary` :300). Base loop starts :308. A hook at :356 is unreachable while frozen. Second belt in runWeekSideEffects :462-465 returns false → :350 continue → hook unreachable that way too.
- The endpoints have no freeze cover: api/tournament/backing-pools.js and backing-stake.js import only BACKING_BETA_ENABLED (:76, :115). A-C13 stands: settle-on-read and the admin endpoint must check the flag themselves.

### 2.5 Retries — CONFIRMED
- The duty's only input is fetchEligibleGroupsByStatus(BATTLE) :241 → where status == battle (tournamentGroupService.js:302-304) + 4-seat filter :308. A completed group is never read again by this function: the bracket sweep reads tournamentBrackets where status == active (:393-394) and resumes only entries with advancers set and sideEffectsAt missing (:414). Base groups have no bracket entry and no stamp. No base-layer analogue exists.
- Monday catch-up (tournamentOrchestrator.js:552) and run-duty (api/tournament/run-duty.js:57-64: forceDuty, simulated, includeDevGroups: true) run the same function. Settle-on-read (ensureClosed pattern backingPools.js:806-841; called at backing-pools.js:291, backing-stake.js:282/:293) and the admin re-run remain the only retries.

### 2.6 Budget — CONFIRMED that the duty has no deadline
- Function ceiling maxDuration 300: api/cron/tournament-orchestrator.js:28. DUTY_DEADLINE_MS 270_000: tournamentOrchestrator.js:108; budget object :1078; passed to Monday :1164, weekday :1166, training sweep :1140; NOT passed to runFridayAdvancement :1168 (signature :236 takes only now, includeDevGroups). tournamentAdvancement.js has no Date.now() at all.
- Monday: the catch-up at :552 runs before the Monday pipeline on the same budget started at :1078; the pipeline defers groups once elapsed > deadline (:615). Settlement time in the catch-up is subtracted from the new week's boards and deploys.
- Cadence: orchestrator `*/10 11,12,13,14,21,22,23 * * 1-5` (vercel.json:178), banking `15 21 * * 1-5` (:50): 18 evening ticks from 21:20 UTC.
- Per-group cost today: 4 sequential rank transactions (tournamentRank.js:71-105) + 1 leaderboard upsert + 1 transition. Hook adds: ensureClosed (1 get; a closePool transaction if nobody read the pool since Sunday: 3 sets + 2 writes per void) + the settlement transaction (stake query + 1 wallet read per backer + per stake 1 set + 2 writes for recordStakeLoss (backingWallet.js:688/:699) + 2 more for creditPayout on winners (:557/:568) + pool + totals).
- Beta scale from src/constants/backing.js: ALLOWANCE_BP 1000 (:51), PER_TEAM_CAP_BP 500 (:55), MIN_STAKE_BP 50 (:58), 4 teams → hard ceiling 20 stakes per backer per pool; realistic pools 3–10 backers, ≤ 40 stakes → roughly 0.5–2 s per group (ASSUMED; no timing measured, no node_modules). Twelve pods ≈ tens of seconds against ~250 s of headroom. Ample at beta, unbounded by construction.
- Firestore limits (ASSUMED, platform knowledge): 500 writes per transaction (the repo's own batch note metricSnapshots.js:45); a transaction cannot run past ~270 s. At ≈3 writes per losing stake, 5 per winning stake, +2 per pool, the write cap lands near 100 stakes in one pool.

### 2.7 N1 — the durable fix is NOT on main; predicate unchanged; gate 6's property does not hold today
- On main: PR #842 (4654ac5f, 5c50e96f): mon-0845 slot disabled (src/config/liveDraftSlots.js) + scripts/n1-stranded-precheck.js (read-only). POOL_EXCLUDED_SLOT_IDS = ['mon-0845'] src/constants/backing.js:98. Holiday-week commit 5fef5e83 (Sept 15): activation gate on battleStartWeek.mondayEtDate; fanOutDeploys logs at error and counts deploys.emptySeats (tournamentOrchestrator.js:417); isDutySatisfied withholds the Monday/weekday marker on it (:1010-1016).
- Not on main: any banking-side missing-agent-layer detection. Open PRs (#844, #762, #761, #760, #451, #427, #422) touch none of it. grep for any such marker in banking/orchestrator/advancement finds only the pre-existing agentScoresCarried.
- Why the predicate still fires on an agent-less week: fetchGroupAgentScores returns an EMPTY map when no agentBattles exist (tournamentBanking.js:62-89); computeBankingUpdate treats an empty map as a real zero (:95-100) and stamps agentScoresCarried only when the read THREW (:175-181) or when an owner with a prior NON-ZERO standing has no battles today (:328-333, `carry !== 0`). A pod that never received an agent draft has zero prior standing → no carry → no marker → isFinalSnapshotDegraded false (leagueTournament.js:1384) → :338 passes → the week completes with composite = 1.5 × user, and the settlement predicate is satisfied. emptySeats re-ticks the fan-out duty but stops neither banking nor advancement.

## 3. Drift since Sept 12, and hazards

Drift:
1. Advancement routes on EVERY weekday evening (getDutyForInstant tournamentOrchestrator.js:151-159; 5fef5e83). The addendum's "Fridays at/after 12:00 ET" is stale. The hook can fire Mon–Thu evening for a holiday-short week; settlement can land Monday EVENING as well as the Monday-morning catch-up; the marker is structurally withheld Mon–Thu in a normal week (:1037-1044), so "marker withheld" no longer means a wedged Friday by itself. Duty name and marker key unchanged.
2. tournamentBanking.js shifted +10 from :143 (clamp return carries recordedDate; clamp log names the banked weekday). No composite semantics changed.
3. trainingLifecycle.js shifted +55 (completeBankedTrainingPods :696-718 → :751-775). Logic unchanged.
4. PR 1, PR 2 and the Amendment B follow-up (#850, #851, #853) are on main. POOL_STATUS already declares resolving/resolved with no writer (backingPools.js:118-125); recordStakeLoss exists with no caller (allowlist :24-25); closePool is exactly 3 tx.set sites and the allowlist ratchets that count (compositionProtectedStoresAllowlist.json:22, :43). potTotal now lives at backingPools/{id}/private/totals until close (closePool :672-696).
5. Nothing the addendum asserted about these files failed re-verification.

Hazards, and what the build prompt must forbid:
- H1 Control counters. Any exception escaping the hook lands in :357-359 → summary.errors++ → marker withheld → 18 re-dispatches that evening plus the Monday catch-up, all blind to the completed group, and a backing error masks an advancement error. Forbid: touching errors/deferredToNextTick/bankingPending/frozen; the hook owns its counters, has its own try/catch that never rethrows, sits after :356, and a test proves a throwing settler still yields marker-set.
- H2 Tournament collections. The settlement transaction writes only backingPools, backingStakes, backingWallets (later backingEvents). Never tournamentGroups (no settledAt on a terminal doc; updatedAt orders the field query), never tournamentRanks, tournamentLeaderboards, orchestratorState. Enforce with the allowlist write count and a write-log test asserting no tournament* path.
- H3 Time. No deadline in the Friday duty, and on Monday it runs ahead of the budgeted pipeline. Forbid: any non-Firestore I/O in the hook; per-stake transactions (one bounded transaction per group); an unbounded stake count (assert a ceiling inside the transaction); and require either threading `budget` into runFridayAdvancement with a skip-to-settle-on-read past the deadline, or an explicit acceptance of the 300 s kill. A kill mid-loop leaves unfinished groups in battle (recoverable) but a kill between :354 and the settlement leaves a closed pool only settle-on-read or admin can finish.
- H4 Stale group / agent-less week. The loop's group is the pre-transition snapshot. Forbid re-evaluating the predicate on it: one settlement primitive that re-reads tournamentGroups/{id} inside its own transaction and evaluates the predicate on the fresh doc; the hook calls that primitive only. Until gate 6 lands, the predicate cannot tell a whole week from an agent-less one: either add a settlement-side refusal (every human seat agentPoints 0 on the clamped day 5 → hold in resolving, loud) or state that gate 6 is a flip prerequisite, not a code guarantee.
- H5 Concurrency. A duty tick and a client settle-on-read can reach the same closed pool at 17:21 ET. The closed → resolving → resolved decision must be made on the in-transaction read of the pool doc; a second settler sees resolving/resolved and returns without paying.

## 4. STOP
Delivered as one message and as this file in the session scratchpad. No repo file, no branch, no commit, no fixes. Founder review next.
