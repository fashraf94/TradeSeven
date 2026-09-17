# N1 — Can a Mon 08:45 slot pod play its battle week with an empty agent layer?

**Read-only discovery report.** League Tournament arc, Backing Beta Phase 0 Addendum §6, item **N1**.
**Session date:** 2026-09-12. **Scope:** one question. No fixes, no branch, no commit.

---

## 0. Preamble — git verification & session posture

| Check | Value |
|---|---|
| `git fetch origin` (BUILD_RULES §3, first step) | **done** — `0e04833d..2ec68f75 main` |
| Branch | `main` |
| HEAD SHA (all citations are at this SHA) | **`2ec68f7585f4683fdbcb8ff758191f1ea70e3761`** |
| `git status --porcelain` | **empty** (clean tree) |
| History deepened? | **Yes** — `git fetch --unshallow` (BUILD_RULES §3 permits it for investigation; recorded here). Clone was shallow to 2026-08-20; needed to date the `LEAGUE_LIVE_DRAFT` flip. 296 → 3945 commits. |
| `origin/main` moved during the session | `2ec68f75` → `27f42c07` (2 commits: PR #841, "Add files via upload"). **Verified: neither touches any file cited in this report** (`git diff --stat 2ec68f75..origin/main` over all cited files is empty). Citations stand at `origin/main`. |
| Writes to project state | **none** — no branches, no edits, no installs, no `.env` / Vercel / Firestore contact. Scratch scripts were written to the session scratchpad only. |
| Doc path correction | The addendum is at **`docs/2026-09-12_BACKING_BETA_PHASE0_ADDENDUM_DISCOVERY.md`**, not `docs/audits/…` as the prompt cites. |

**Evidence posture.** Every claim below is marked **VERIFIED** (code read at that line this session) or **ASSUMED**. Where behavior was provable by execution, I ran it: `node_modules` is empty and installing packages is out of scope, so the pure functions were exercised under a scratchpad-only ESM loader that stubs `firebase-admin` and throws on any I/O call. No repo file was modified or rewritten.

---

## 1. Executive verdict

> **The answer is yes — and it is worse than N1 supposed.** A Mon 08:45 pod that flips to `battle` after the Monday duty marker is set gets no agent boards, no agent draft and no deploys — and **nothing anywhere in the system notices.** It banks five clean days, finalizes, locks a bracket and writes permanent career rank on a composite that is missing half its inputs. The one guard built for exactly this condition (`agentScoresCarried`) is documented **not** to fire here.

| # | Question | Verdict |
|---|---|---|
| **N1 overall** | Can a Mon 08:45 pod play a week with an empty agent layer? | **CONFIRMED** (one precondition, §3.5 — met in any week another slot pod plays) |
| L1 | Slot fires 08:45 ET, draft completes, pod flips inline to `battle` pre-09:30 | **CONFIRMED** (completes ~08:50–09:00, earlier than the addendum's ~09:15) |
| L2 | Monday pipeline runs at the first tick ≥ 11:00 UTC and sets a per-ET-date marker; later ticks short-circuit | **CONFIRMED** — first tick is **07:00 ET (EDT) / 06:00 ET (EST)**, i.e. *before the slot fires on both DST arms* |
| L3 | Agent layer happens only inside the Monday pipeline; Tue–Fri catch-up needs a stream only Monday writes | **CONFIRMED** |
| L4 | ⇒ a pod reaching `battle` after the marker gets no agent layer that week | **CONFIRMED** |
| — | Does the user layer still bank/score/complete? | **Yes — fully, silently, with `agentPoints: 0`** |
| — | Does any degrade guard fire? | **No.** `agentScoresCarried` is never stamped; `isFinalSnapshotDegraded` returns `false` |
| — | Does it change results? | **Yes — standings order, bracket advancers, and permanent RP** (proved by execution, §5.3) |
| — | Test coverage of this case | **NONE.** The nearest test locks in the short-circuit as correct and never adds a pod between ticks |
| — | Automatic recovery on any later tick/cron/endpoint | **NONE** |
| — | Manual recovery | **Yes — `run-duty` with `simulatedNow` set** (§4.3). A bare forced duty does *not* work |
| — | Blast radius | **Open since 2026-07-17**; 8 exposed Mondays; Firestore evidence spec in §7 |

**Root cause, in one line (VERIFIED, `api/_utils/tournamentOrchestrator.js:519-526`):** the Monday pipeline was deliberately taught to *skip* live-draft pods in `FORMING` — the comment says so outright, *"otherwise a Monday-morning tick would steal a Mon-8:45am slot group before it fires"* — but no compensating re-entry was ever added for when that pod later reaches `battle`. The guard was built half-way: the door was closed, and nothing reopens it.

---

## 2. What actually happens, hour by hour (a Monday in EDT)

| ET time | Event | Consequence for the `mon-0845` pod |
|---|---|---|
| 07:00 | Orchestrator tick #1 (11:00 UTC). Awaiting-open flip lands the Wed/Sat/Sun slot pods in `battle`; Monday pipeline processes them; pass is clean | **Marker `YYYY-MM-DD:monday_pipeline` is SET** |
| 07:10 – 08:40 | Ticks #2–#11 | all `already_complete` |
| 08:50 | `live-draft-fire` (`*/10 * * * *`) fires the slot: CPU-fill, `FORMING → DRAFTING` | pod is drafting |
| ~09:00 | Next fire-cron pass drives autopick; an abandoned draft finishes in ONE pass; inline anchor flip | **`DRAFTING → BATTLE`** |
| 09:00 – 10:50 | Ticks #13–#24, all routed `MONDAY_PIPELINE` | **all short-circuit on the marker. The pod is never seen.** |
| 17:15 | Nightly banking (`snake-draft-daily-scores`) | banks day 1 with `agentPoints: 0`, **no warning, no degrade flag** |
| Tue–Fri 07:00 | `WEEKDAY_FANOUT` | pod counted in `groups`, zero seats assembled, zero deploys, **zero log lines naming it**, marker set |
| Fri evening | `FRIDAY_ADVANCEMENT` | `isFinalSnapshotDegraded` = false → **week locks**; bracket advancers and permanent RP written on the half-composite |

---

## 3. The chain, link by link

### L1 — the slot fires at 08:45 ET and flips inline to `battle` before 09:30 — **CONFIRMED**

- Slot defined: `{ id: 'mon-0845', label: 'Mon 8:45am ET', weekday: 'Mon', hourEt: 8, minuteEt: 45 }` — `src/config/liveDraftSlots.js:36` (**VERIFIED**).
- Fire cron is a standalone `*/10 * * * *` entry — `vercel.json` → `/api/cron/live-draft-fire` (**VERIFIED**), so the fire lands at **08:50**.
- The anchor is that same Monday: `deriveBattleStartWeek` takes the `dow === 1 && minutes < MARKET_OPEN_MIN` arm → `mondayEtDate = date` — `api/_utils/liveDraftFormation.js:191-207` (**VERIFIED**).
- On completion, `computeHandoffWrites` picks the target: `anchorDateReached(startAnchor, nowEtDate) ? BATTLE : AWAITING_OPEN` — `api/_utils/trainingLifecycle.js:352` (**VERIFIED**). Same-day anchor ⇒ **inline `BATTLE`**.
- Completion is fast, not slow: 4 seats × 3 picks = 12 turns at `PICK_CLOCK_MS: 20000` (`src/constants/leagueTournament.js:982`, `:71-72`) = **240 s worst case**, and `driveSlotDraftAutopick` resolves *every* overdue turn in one pass (`api/_utils/liveDraftLifecycle.js:20-27`) (**VERIFIED**).

**Correction to the addendum's timing:** the pod reaches `battle` at roughly **08:50–09:00 ET**, not ~09:15. The e2e proves 08:47 in-test. This makes the gap *wider*, not narrower — it changes nothing about the verdict.

**Test anchor drift:** the cited e2e is at **`api/_utils/liveDraftLifecycle.e2e.test.js:354-369`**, not `:353-364`.

### L2 — the Monday pipeline runs before the slot, on both DST arms — **CONFIRMED, and stronger than stated**

- Schedule: `*/10 11,12,13,14,21,22,23 * * 1-5` → `/api/cron/tournament-orchestrator` (`vercel.json`) (**VERIFIED**).
- Routing: any Monday tick with ET minutes < noon → `MONDAY_PIPELINE` — `api/_utils/tournamentOrchestrator.js:125-134` (**VERIFIED**).
- Short-circuit: `isDutyComplete(...)` → `already_complete` — `:1035-1038` (**VERIFIED**; the addendum's anchor is exact).
- Marker key is per-ET-date, per-duty: `${etDate}:${duty}` — `:137-139`, set by `markDutyComplete` `:182-193` (**VERIFIED**).

Computed with the repo's own `getEtParts` (`Intl`, `America/New_York`):

| DST arm | First Monday tick | Last Monday-morning tick | Slot fire | Pod reaches `battle` |
|---|---|---|---|---|
| **EDT** (e.g. 2026-07-13, 2026-09-14) | **11:00 UTC = 07:00 ET** | 14:50 UTC = 10:50 ET | 08:50 ET | ~09:00 ET |
| **EST** (e.g. 2026-01-12) | **11:00 UTC = 06:00 ET** | 14:50 UTC = 09:50 ET | 08:50 ET | ~09:00 ET |

**The marker is set before the slot's draft window opens on both arms** — 1 h 45 m early in summer, 2 h 45 m early in winter. There is no DST arm on which the slot wins the race.

### L3 — the agent layer exists only inside the Monday pipeline — **CONFIRMED**

All three agent-layer steps are inside `runMondayPipeline`, behind `if (group.status !== GROUP_STATUS.BATTLE) continue;` at `:589` (**VERIFIED**):

| Step | Line | Call |
|---|---|---|
| 2 — agent boards | `:594` | `produceGroupBoards` |
| 3 — agent draft + 24-held | `:607` | `resolveAgentDraftForGroup` |
| 4 — deploy fan-out | `:621-632` | `seatsFromDraftStream` → `attachRiderSix` → `fanOutDeploys` |

And the Tue–Fri catch-up genuinely depends on Monday's stream:
- `seatsFromDraftStream` returns **`null`** when the stream doc is absent — `:461-464` (**VERIFIED**).
- `buildIncumbentSeats` guards on it: `if (draftSeats) { … }` — `:727-735` (**VERIFIED**). Null ⇒ zero catch-up seats.
- With no battles and no stream, `seats` is `[]`; `fanOutDeploys` loops `seats.length` times — `:377` (**VERIFIED**) — so it does **nothing and logs nothing**. `attachRiderSix` (`:...`) likewise no-ops.

**I actively tried to refute L3 and could not.** Every other candidate path was checked and excluded:

| Candidate path | Verdict | Evidence |
|---|---|---|
| Training activation sweep (`sweepTrainingActivation`, also calls boards/draft/deploy at `:810`, `:822`) | **excluded** — filters `g.isTraining === true` (`:876-877`); a slot pod is competitive, never `isTraining` (`liveDraftLifecycle.js:33`) | VERIFIED |
| `runWeekdayFanout` Tue–Fri | **produces nothing** — see above; still counts the pod in `summary.groups`, so the Tue marker is set on a silent no-op | VERIFIED |
| Any other cron creating an agent battle | **none exist** — `createAgentBattle` is called only from `api/agent/decide.js:912`, `:1458`, reached only via `fanOutDeploys` | VERIFIED |
| `agent-evaluate` (`*/15`) | evaluates existing battles; creates none | VERIFIED |
| Ledger reconciliation | both sides empty ⇒ **0 divergences, no alert** (`tournamentAgentLedger.js`, `reconcileAllTournamentLedgers`) | VERIFIED |
| A later tick catching the pod | **no** — every Monday tick after the marker returns `already_complete` before reaching the pipeline (`:1035`) | VERIFIED |

### L4 — therefore the pod plays the week with an empty agent layer — **CONFIRMED**

### 3.5 The one precondition (not in the addendum, and it matters)

The marker is set **only if the pipeline saw at least one group**. Zero groups returns a quiet skip *before* `markDutyComplete` — `:1053-1057` (**VERIFIED**) — and satisfaction additionally requires no deferrals, no errors, no cooled/failed deploys (`isDutySatisfied`, `:901-914`, **VERIFIED**).

So the bug requires **≥1 other eligible group present at an earlier Monday tick**. In practice that is close to guaranteed, and for a reason worth stating plainly:

> `flipAwaitingOpenPods` runs at `:986-993` — **before** the duty short-circuit at `:1035` — and it flips **competitive** pods too, not just training ones (the log line branches on `pod.isLiveDraft === true ? 'competitive' : 'training'`, `trainingLifecycle.js:...`; **VERIFIED**, and exercised by the e2e at `liveDraftLifecycle.e2e.test.js:389-397`). The Wed/Sat/Sun slot pods therefore land in `battle` **in the 07:00 tick itself**, are processed by the Monday pipeline in that same tick, and set the marker.

**The other slot pods are what strand the Monday one.** Any week in which a `wed-1900`, `sat-1200` or `sun-1900` pod plays sets the marker at 07:00 and closes the door on `mon-0845`.

Two things follow that are counter-intuitive and should be said out loud:

1. **The bug is *more* likely in a small league, not less.** A busy Monday (many groups, ≥20 s deploy pacing, 270 s budget) hits `deferredToNextTick > 0`, the marker is withheld, and a later tick sweeps the pod up by accident. A quiet beta Monday with one other pod completes cleanly at 07:00 and strands it. **The current beta state is the exposed state.**
2. **If `mon-0845` is the only pod in the league that week, the bug does not occur** — 07:00 sees zero groups, no marker, and the 09:10 tick picks the pod up normally. This is the sole benign case.

---

## 4. Is there any recovery?

### 4.1 Automatic — none
No later tick, no cron, no scheduled path. Verified exhaustively in the L3 table.

### 4.2 Manual, per group — partial
`POST /api/tournament/produce-agent-boards` then `POST /api/tournament/resolve-agent-draft` (both admin-secret gated; `api/tournament/produce-agent-boards.js:1-15`, `resolve-agent-draft.js:1-18`, **VERIFIED**) will create the boards and the draft stream. They do **not** deploy — but once the stream exists, the **Tue–Fri catch-up path revives** (`seatsFromDraftStream` now returns seats at `:727-735`), so the pod deploys from Tuesday onward. **Monday's agent day is lost permanently either way.**

### 4.3 Manual, whole-duty — works, with a sharp edge (`run-duty` + `simulatedNow`)

This is the requested check, and the answer is a genuine asymmetry:

| Call | `simulated` | Marker key read | Result |
|---|---|---|---|
| `{ duty: 'monday_pipeline' }` | `false` | `2026-09-14:monday_pipeline` (**production**) | **`already_complete` — does nothing.** No recovery. |
| `{ duty: 'monday_pipeline', simulatedNow: '<ISO>' }` | `true` | `sim:2026-09-14:monday_pipeline` | **Marker miss → the real pipeline runs against real data → the pod gets boards, draft and deploys.** |

`api/tournament/run-duty.js:61` sets `simulated: simulatedNow != null` (**VERIFIED**); `runOrchestratorTick` passes it to `isDutyComplete(state, routed.etDate, duty, { simulated })` at `:1035`, and `dutyMarkerKey` prefixes `sim:` at `:137-139` (**VERIFIED**). The namespacing was built so a smoke run can never pre-satisfy a real duty (`tournamentOrchestrator.test.js:278-281`); **it happens to work in reverse as the only whole-duty recovery lever.**

**Sharp edge — state this to whoever operates it.** `simulatedNow` is also the clock the pipeline *runs on*: it flows into `produceGroupBoards(…, { now })`, into `fanOutDeploys`' `formatEtDate(now)` today's-battle idempotency guard, and into cooldown timestamps. Recovery therefore requires `simulatedNow` ≈ **the real current instant**. A convenience date (yesterday, "the Monday") would mis-stamp the battle's ET date and corrupt the guard that prevents double-deploys. `run-duty` also passes `includeDevGroups: true` (`:64-66`), widening the pass to dev groups.

---

## 5. What the user layer does — banked, scored, locked, and silent

### 5.1 It banks normally, with `agentPoints: 0`
The pod is `status: 'battle'` and fully eligible for the nightly banking branch (`bankAllTournamentGroups`, `api/_utils/tournamentBanking.js:401-413`, ridden by `/api/cron/snake-draft-daily-scores` at `15 21 * * 1-5`; **VERIFIED**).

### 5.2 The degrade guard is documented not to fire — this is the heart of it
`fetchGroupAgentScores` returns a plain `{}` when a group has no battles, and the module docstring says what that means (`tournamentBanking.js:61-89`, `:98-99`, **VERIFIED**):

> *"An **empty map is a real zero** (no battles yet — pre-deploy groups)."*

The three arms at `:312-323` (**VERIFIED**) then resolve as follows for a stranded pod: `agentScores` is `{}` not `null`, so the read-failure arm is skipped; the per-owner-hole arm requires `carry !== 0`, and the carry is 0 every day because the prior day was also 0 — so it is skipped too; control falls to `agentPoints = agentScores[uid] || 0` ⇒ **0**, with **no `agentScoresCarried` stamp and no warning**.

That flag is the *only* thing standing between a missing agent half and a permanent lock (`isFinalSnapshotDegraded`, `src/constants/leagueTournament.js:1378-1380`, gated at `tournamentAdvancement.js:338-343`, `:469-471`, `:646`; **VERIFIED**). A *carried* agent layer pauses the week for manual review. A **never-created** one sails straight through. The distinction is invisible downstream.

### 5.3 Proof by execution
Five banking days driven through the real `computeBankingUpdate` with `agentScores = {}`:

```
day1  agentScoresCarried=(absent)  warnings=[]
        u1: totalPoints=45  agentPoints=0  compositePoints=67.5
...
day5  agentScoresCarried=(absent)  warnings=[]

isWeekBanked            : true
isFinalSnapshotDegraded : false      <-- the ONLY finalization guard on a missing agent half
  u1: getWeeklyScore=45  getWeeklyComposite=67.5   (= 1.5 x user + 0 agent)
```

**Answers to the three questions as asked:**
- **Does it bank, score and complete normally with `agentPoints` absent or zero?** Yes — `agentPoints: 0` is written explicitly (not absent), five clean days, no warnings, `isWeekBanked` true.
- **What does `getWeeklyComposite` return for such a seat?** `entry.compositePoints`, which is `computeComposite(0, totalPoints)` = **`1.5 × userPoints`** — the user half alone, with `USER_LAYER_K: 1.5` (`src/constants/leagueTournament.js:1119`, `:1340-1345`; **VERIFIED**).
- **What does the rank writer apply?** `applyGroupWeekToRanks` (`api/_utils/tournamentRank.js:53-119`, **VERIFIED**) feeds that halved composite into `computeRankBreakdown` (`raw = weeklyComposite × RP_PER_POINT + placementBonus`) and commits it through `applyRankWeek`, which **permanently ratchets `floorRp`**. The `appliedGroups.{groupId}` guard at `:76` makes it **once-only: a later correction can never re-apply the week.**

And it changes outcomes. Same user layer, same week, agent half present vs. absent:

```
WITH the agent layer      : u1 > u2 > u3 > u4   composites {u1:72.5, u2:60, u3:10, u4:2}
WITHOUT it (stranded pod) : u1 > u3 > u4 > u2   composites {u1:67.5, u2:-30, u3:0,  u4:0}

RANKING CHANGED?  true
ADVANCERS  with: u1, u2      without: u1, u3      <-- different bracket, permanently
PERMANENT RP  u2: -30 vs +126  (delta -156.00)
```

**In plain terms: a player whose agent carried their week finishes last instead of second, misses the bracket, and takes a 156-point permanent rank swing — and no log line, warning, flag or test ever says anything was wrong.**

---

## 6. Test coverage — none, and the nearest test locks the behavior in

| Question | Finding |
|---|---|
| Any test of a `mon-0845` pod's agent layer? | **No.** The three `mon-0845` tests (`liveDraftLifecycle.e2e.test.js`, `liveDraftFormation.test.js`, `liveDraftLifecycle.test.js`) contain **zero** references to `tournamentOrchestrator`, `runMondayPipeline`, `produceGroupBoards`, `resolveAgentDraftForGroup` or `agentPoints` (**VERIFIED** by grep across all three). |
| Does the orchestrator suite know slot pods exist? | **No.** `tournamentOrchestrator.test.js` has **zero** occurrences of `isLiveDraft`, `slot`, `liveDraft` or `LIVE_DRAFT` (**VERIFIED**). The two sides of this defect are tested in separate universes that never meet. |

**Nearest test — `api/_utils/tournamentOrchestrator.test.js:861-873`** (**VERIFIED**), *"a satisfied duty sets the marker; the next tick is an idempotent no-op"*:

```js
const first  = await runOrchestratorTick(db, { now: MON_MORNING_EDT, fetchImpl, pacingMs: 0 });
expect(first.complete).toBe(true);
expect(first.deploys.deployed).toBe(4);
const second = await runOrchestratorTick(db, { now: new Date('2026-06-15T12:10:00Z'), … });
expect(second.status).toBe('already_complete');
expect(fetchImpl).toHaveBeenCalledTimes(4);       // no re-deploys behind the marker
```

**What it does not assert — and this is the gap:** the fixture is *static across both ticks*. No group changes status between them. The test proves the marker suppresses **re-**work on a pod already handled; it says nothing about a pod that becomes `battle` **between** the two ticks, which is the entire defect. Its final assertion — *"no re-deploys behind the marker"* — is the intended behavior and the bug's mechanism expressed in the same line. Any fix must keep that assertion green while adding the missing one.

**Nearest e2e — `liveDraftLifecycle.e2e.test.js:354-369`:** proves the inline `BATTLE` flip at 08:47 and stops there. It never constructs an orchestrator, a marker, or an agent layer.

---

## 7. Blast radius — and the evidence that would settle it

**Firestore is not reachable from this session.** What I could establish from the repo:

| Fact | Value | Evidence |
|---|---|---|
| `LEAGUE_LIVE_DRAFT` | **`true`** | `src/config/featureFlags.js:443` (VERIFIED) |
| Continuously true on `main` since | **2026-07-17** (`daa6b72d`) | full value-per-commit walk after `--unshallow` (VERIFIED) |
| Slot picker reachable by users | **Yes** — `SlotCenter.jsx:26` gates `LiveDraftPicker` on the flag; mounted in `LeagueLobbyDesktop.jsx:240` / `LeagueLobbyRedesign.jsx:160` | VERIFIED |
| Exposed Mondays to date | **8**: 2026-07-20, 07-27, 08-03, 08-10, 08-17, 08-24, 08-31, 09-07 | computed |
| Cron budget at HEAD | **39/40** — matches BUILD_RULES §6 exactly | `vercel.json` (VERIFIED) |

So the path has been open and user-reachable for **eight weeks**. Whether anyone walked it is a Firestore question.

### The queries that settle it

Candidate pod doc ids are deterministic — `slotGroupId()` = `lds_mon-0845_<fireEtDate>` (`api/_utils/liveDraftFormation.js:82`, `:91-93`; **VERIFIED**):

`lds_mon-0845_2026-07-20`, `…_07-27`, `…_08-03`, `…_08-10`, `…_08-17`, `…_08-24`, `…_08-31`, `…_09-07`

**Step 1 — did any exist?** `tournamentGroups` where `isLiveDraft == true` and `slotId == 'mon-0845'` (or fetch the eight ids directly). None ⇒ blast radius is zero to date and this is a latent defect. Any hit ⇒ continue.

**Step 2 — for each hit, the stranded signature.** All five together confirm it; any one alone is suggestive:

| # | Location | Stranded reads as |
|---|---|---|
| 1 | `agentBattles` where `groupId == <id>` | **zero documents** |
| 2 | `tournamentGroups/<id>/agentBoards` | **empty subcollection** |
| 3 | `tournamentGroups/<id>/streams/agentDraft` | **document absent** (this is the one the Tue–Fri catch-up needs) |
| 4 | `tournamentGroups/<id>.dailyScores.day1…day5` | every `closeScores.*.agentPoints == 0` **and `agentScoresCarried` absent on all five** — the silent signature |
| 5 | `tournamentOrchestrator/state.duties['<that Monday>:monday_pipeline'].completedAt` | a timestamp at **~11:00 UTC**, i.e. *hours before* the pod's `updatedAt` / `startAnchor` flip |

**Step 3 — the damage, if any hit.** For each affected pod read `tournamentRanks/{odUserId}.appliedGroups.<groupId>` for the four seats: it records `weeklyComposite`, `placement` and `delta` as applied. That is the permanent, already-committed rank effect — and because `appliedGroups` is a once-only guard (`tournamentRank.js:76`), **it cannot be corrected by re-running anything.** Any remediation there is a deliberate founder decision, not an automated heal.

**One more place to look:** Vercel logs for `/api/cron/tournament-orchestrator` on those Mondays. A `duty=monday_pipeline — COMPLETE (marker set)` line at ~11:00 UTC followed by `already complete` lines through 14:50 UTC, on a Monday where `live-draft-fire` logged a `mon-0845` completion at ~13:00 UTC, is the defect on the record.

---

## 8. Fix shapes — three bounded options, no code

**Fence status, all three (BUILD_RULES §1): CLEAR.** None of `tournamentOrchestrator.js`, `liveDraftLifecycle.js`, `trainingLifecycle.js` or `liveDraftSlots.js` is on the §1 fence list. The orchestrator already imports `flattenPortfolioServer` from the fenced `agentScoring.js` as a permitted read-only call (`:86`), and nothing here changes the scoring engine or the `createAgentBattle` doc shape — so **no fence contact as a concept either**, provided a fix only re-runs the existing pipeline for an additional pod and does not alter what the deploy sends. Option C touches no fenced concern at all.

| | **A — Monday pipeline re-checks later ticks** | **B — the inline flip triggers the pipeline for that pod** | **C — move or remove the slot** |
|---|---|---|---|
| **Shape** | Split the marker: keep it suppressing re-work, but let a Monday tick still process a `battle` group that has no `streams/agentDraft`. Narrowest form: before the `isDutyComplete` return at `:1035`, run a bounded "newly-battle, no-stream" pass — the same posture as the training sweeps already sited above that line (`:971-1030`). | On completion, when the anchor is today, hand the pod straight to the agent-layer steps — mirroring `activateTrainingPod`, which is exactly this for training pods. | Retime `mon-0845` to before the first tick (e.g. Sun evening, or a Monday hour ≥ 11:00 UTC is impossible pre-open — so realistically *move to Sunday* or drop it). |
| **Files** | `api/_utils/tournamentOrchestrator.js` (+ its test) | `api/_utils/liveDraftLifecycle.js`, `api/_utils/tournamentOrchestrator.js` (export a per-group entry; `activateTrainingPod` is the precedent), + tests | `src/config/liveDraftSlots.js` only (founder-editable by design, `:7-9`) |
| **Fenced file?** | No | No | No |
| **Risk to the duty marker** | **Highest — this is the load-bearing invariant.** The two-grain idempotency design is stated at `:29-40`; a careless widening re-deploys behind the marker and breaks `tournamentOrchestrator.test.js:861-873`. Any change must keep `expect(fetchImpl).toHaveBeenCalledTimes(4)` green. Mitigation: gate the new pass on the *natural* guard (`streams/agentDraft` absent), which is per-entity and already the pipeline's resumability idiom, rather than loosening the marker itself. | **None — does not touch the marker.** Risk moves elsewhere: a second writer into the agent layer means racing the 09:00–10:50 ticks. The existing natural guards (stream-exists short-circuit, today's-battle guard in `fanOutDeploys:381-386`, `decide.js`'s one-active-battle check) are designed for exactly this and are what make `activateTrainingPod` safe. Cost: the pod's boards/deploys run inside the fire cron's `maxDuration: 60`, well under the orchestrator's 300 s — **sizing needs checking before this is chosen.** | **None.** Zero code risk. |
| **Cost** | Fixes the general class: *any* pod reaching `battle` after the marker, not just this slot. | Fixes this slot precisely and gives it a same-day agent layer — the best outcome for the player. | **Does not fix the underlying defect**; it removes the only currently-reachable trigger. Also forfeits the S3 pre-open margin the slot was designed around (`liveDraftSlots.js:27-30`). |
| **Cron budget (§6, 39/40)** | +0 | +0 | +0 |

**My recommendation for founder review: B as the fix, C as the same-day mitigation if any pod is confirmed affected, A as the durable backstop.** B restores the intended product behavior (the pod plays a full week with both layers from Monday) and leaves the duty marker — the invariant that has been paid for twice — untouched. A is worth doing regardless, because the defect class is broader than this slot: *any* future path that lands a ranked pod in `battle` after 07:00 ET on a Monday inherits it. A also deserves a deliberate decision about whether a pod that flips at 10:45 should get a partial agent day or wait — that is a product question, not a code one.

**Non-negotiable for whichever is chosen:** the missing test. A case that ticks the orchestrator, sets the marker, *then* moves a pod to `battle`, then ticks again — and asserts the agent layer exists. Today that assertion does not exist anywhere in the repo, which is why eight weeks passed without anyone finding out.

---

## 9. Noticed along the way — report-only, for separate tasking (BUILD_RULES §3)

- **O1 — stale comment, `api/_utils/tournamentOrchestrator.js:969-970` and `:983-985`.** Both say *"AWAITING_OPEN is training-only, so ranked/legacy are never seen."* This is **false at HEAD**: `flipAwaitingOpenPods` flips competitive slot pods too, and its own log line branches on `pod.isLiveDraft`. The comment predates Competitive Live Draft. It is load-bearing prose — it is precisely what would tell a future reader that the 07:00 tick cannot promote a competitive pod, which is the mechanism that sets the marker and strands `mon-0845`. Fixing the comment is arguably a prerequisite for anyone reasoning about the fix.
- **O2 — a silent no-op deserves a log line.** `runWeekdayFanout` processes a `battle` group with no battles and no draft stream and emits **nothing** — no seat, no error, no warning (`:672-696` with `seats = []`). One line (*"group X: no incumbents and no draft stream — nothing to deploy"*) would have surfaced this defect on the first Tuesday. Cheap, and independent of which fix is chosen.
- **O3 — the degrade guard has a blind spot by construction.** `isFinalSnapshotDegraded` catches a *carried* agent layer but not a *never-created* one, because `{}` is defined as "a real zero" (`tournamentBanking.js:98-99`). That definition is correct for a pre-deploy group mid-Monday and wrong for a group that has banked five days with no agent battles. Worth a founder decision: should a **day-5** snapshot with `agentPoints == 0` for **all four seats** and **zero `agentBattles`** be treated as degraded, and pause the lock the way a carry does? That is a broader ruling than N1 and should not be folded into this fix.

---

## 10. STOP

Report complete. No branch, no commit, no code changed; project state untouched. Awaiting founder review before any fix is tasked.

*Report file (outside the repo tree): `/home/user/2026-09-12_N1_MON0845_AGENT_LAYER_DISCOVERY.md` — for `docs/audits/`.*
