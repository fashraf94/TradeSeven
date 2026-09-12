# CC Phase 0 Addendum — Read-Only Discovery for Backing Beta V1.2 (§13 Q1–Q5)

**Date:** 2026-09-12 · **Repo:** fashraf94/TradeSeven · **Branch:** `main` · **HEAD:** `701859c6fd663ae9fd4ee617706033861d37bf50` · **Scope:** spec V1.2 §13 questions 1–5, V1.2-vs-code contradictions beyond the Phase 0 report, baseline. Q6 is founder-supplied and not attempted. §15 rulings are the founder's and are not reopened here.

Every citation is `file:line` on `main` at the HEAD above, tagged **confirmed** (read in this session), **inferred**, or **not found**.

---

## 0. Git verification

| Check | Result |
|---|---|
| `git checkout main && git pull` | Fetched `origin` first (BUILD_RULES §3): `main` fast-forwarded `0e04833d..701859c6`; ≈130 remote branches listed, none checked out. |
| Branch | `main` |
| HEAD | `701859c6fd663ae9fd4ee617706033861d37bf50` (merge of PR #837, "Add files via upload") |
| `git status --porcelain` | empty at start; re-verified empty after every read batch and at the end |
| `docs/FANTASYTRADES_BACKING_BETA_SPEC_V1_2.md` | present on `main` (308 lines) |
| `docs/audits/2026-09-10_BACKING_BETA_PHASE0_DISCOVERY.md` | **not found at that path.** The Phase 0 report is on `main` at **`docs/PHASE0_BACKING_BETA_DISCOVERY_20260910.md`** (378 lines, committed in `52485aeb`, merged by PR #837 = this HEAD's parent). Its header reads "Date 2026-09-10 · HEAD `65237e47…`", the sha V1.2 line 6 cites for "CC Phase 0 report (2026-09-10, `main` @ `65237e47`)". No file of the brief's name exists in the tree, the index, or any remote branch (all scanned). I treated the found file as the prior report and proceeded: the hard-stop condition guards against running without the prior report, and it is present. If the founder meant a different document, the §13 answers below stand on the code alone. |
| Writes to repo | none: no file staged, edited, or created; no commit; no push; no package install; `.env`, Vercel, Firestore untouched. Disclosure (the Phase 0 precedent): the harness had created and pushed `claude/vibrant-carson-b1e5d3` at container start, before the first command (reflog: harness checkout, then this session's `checkout main`). It sits at `701859c6`, identical to `main`, zero commits beyond it; this session did not use it. |
| Packages | `node_modules/` absent; nothing installed; `npx` not run (Phase 0's npx auto-fetch was deliberately not repeated). |
| Outside reads | GitHub API, read-only, for the §5 baseline: PR #837 / #836 check runs and one job log. |

---

## Executive verdict

| # | Finding | Severity | Where |
|---|---|---|---|
| A1 | **Base-layer completion writes no lock.** The group doc receives only `status: 'complete'` + `updatedAt`; per-seat placement and composite go to four `tournamentRanks` docs (CPUs included) and the month leaderboard row; the composite of record stays in `dailyScores.day5`. `complete` is terminal and every scorer refuses a non-`battle` group, so a completed base group cannot be re-scored by any code path. | Design-shaping, clean | `tournamentAdvancement.js:307-361`; `tournamentGroupService.js:51-61,115-129`; `tournamentRank.js:53-121`; `tournamentBanking.js:375` |
| A2 | **The settlement signal is a group-doc predicate, not a lock:** `status === 'complete' && isTraining !== true && baseLayerWeek != null && isWeekBanked(group)`. Training pods reach `complete` with no ladder effects; banking precedes finality. No sweep revisits a completed base group, so the co-tenant hook must sit after the transition, and settle-on-read + admin re-run are the only retries. Phase 0 V2's "third half of `runWeekSideEffects`" would gate completion on settlement. | Design-shaping | `tournamentAdvancement.js:324-329,349-354`; `trainingLifecycle.js:696-718` |
| A3 | **Slot pods contradict §4 twice.** Their user drafts complete Wed 19:00 / Sat 12:00 / Sun 19:00 ET, before the Sunday 23:59 close, and the picks land on the authed-readable group doc. Their seats are humans-only and mutable until fire (CPUs added at fire), and the last human leaving **deletes** the group doc. | Contradicts §4, §6 | `liveDraftSlots.js:32-37`; `liveDraftLifecycle.js:324-346`; `trainingLifecycle.js:330-359`; `liveDraftFormation.js:394-399,444-448`; `firestore.rules:531-533` |
| A4 | **No `active` status exists.** The enum is forming / drafting / awaiting_open / battle / complete / expired / voided; the live status is `battle`, and slot pods pass through `drafting` and `awaiting_open` before Monday. | Contradicts §5/§6 wording | `leagueTournament.js:84-116` |
| A5 | **18+ / eligibility: nothing exists.** No age, date of birth, terms, or consent field anywhere; signup stores email, username, display name; `users/{uid}` is owner-writable, so a client-side flag there would not be authoritative. | §11 gate 2 must build | `authService.js:52-106,293-322`; `firestore.rules:161-168`; `authMiddleware.js:15-42` |
| A6 | **Composite storage confirmed:** `dailyScores.day5.closeScores[uid].compositePoints = round2(agentPoints + 1.5 × totalPoints)`; read through `getWeeklyComposite` (day-clamped). Tie equality is strict `===` on the stored values, no epsilon, no re-rounding. | Confirms §1/§3 | `tournamentBanking.js:309-333`; `leagueTournament.js:802-804,832-834,845-849,1305-1319,1340-1345` |
| A7 | **A viewer-independent week query already exists on the client** (`subscribeBaseLayerGroups`, index `(baseLayerWeek, updatedAt)`); no server endpoint lists groups. A server pod list needs **zero new indexes** if it reuses that query and filters status / isDev / isTraining in memory (the house pattern). The spec's `(status, weekKey)` names a field that does not exist. | Shapes PR 2 | `tournamentGroupService.js:315-333`; `firestore.indexes.json:407-420`; `api/_utils/tournamentGroupService.js:301-314` |
| A8 | **The §2 anchor holds with qualifications.** `baseLayerWeek` is the ISO week of the ET battle Monday on both paths; battles begin on the first Monday tick (~07:00 EDT / 06:00 EST); a holiday Monday moves the first battle to Tuesday; the label is one-way and re-stampable. `closesAt` must come from a derived Monday date, not from the week label; lobby pods carry no Monday date. | Complicates §2/§4 | `tournamentLobbyService.js:283-285,372`; `liveDraftFormation.js:191-208,232-236`; `resolve-user-draft.js:207-209`; `leagueTournament.js:888-898,938-945` |
| A9 | **A human team's `agentId` is not on the group doc before Monday.** It is resolved at board production from `agents where ownerId == uid` (clones excluded), with a synthetic fallback when the user has no agent. The pool's `teams[].agentId` at open needs the same lookup, or the team should key on `odUserId`. | Contradicts §1/§6 | `tournamentAgentBoards.js:307-338`; `tournamentOrchestrator.js:461-467,595-599` |
| A10 | **Baseline:** `node_modules/` absent, nothing installed. CI on the PR that produced this HEAD is green: `Test Files  652 passed | 6 skipped (658)`. | Report-only | §5 |

---

## 1. Seed set read

Read in full: `docs/FANTASYTRADES_BACKING_BETA_SPEC_V1_2.md` (§13 is the scope; §15 not reopened), `docs/PHASE0_BACKING_BETA_DISCOVERY_20260910.md`, `docs/FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`, `docs/BUILD_RULES.md`, the `docs/README.md` reading order, and two directly relevant audits: `docs/audits/BASE_LAYER_WEEK_FORMATION_VS_BATTLE_WEEK_BACKLOG_2026-08-28.md` (with its superseding banner) and `docs/audits/20260901_D-LOBBYWEEK_BUILD_REPORT.md`. Phase 0's questions are not re-answered; its citations are re-verified in §4. Every claim below was re-read in code at this HEAD.

---

## 2. §13 answers

### Q1. Base-layer finality

**What the Friday duty does for a base-layer group** (`api/_utils/tournamentAdvancement.js`, confirmed). `runFridayAdvancement` (`:236-432`) reads every `status == 'battle'` group with four seats, dev groups excluded by default (`fetchEligibleGroupsByStatus`, `api/_utils/tournamentGroupService.js:301-314`), returns early while `TOURNAMENT_ADVANCEMENT_FROZEN` (`:282-301`; the flag is `false`, `src/config/featureFlags.js:1143`), then loops base-layer groups (`bracketGameId == null`, `:308`) inside a per-group try/catch (`:310-359`):

| Step | Condition / write | Cite |
|---|---|---|
| 1 | Skip while day 5 is not banked ("banking pending"; counted, withholds the duty marker) | `:311-315`; marker rule `tournamentOrchestrator.js:910-915` |
| 2 | Training pod → `status: 'complete'` with **no** rank or leaderboard write | `:324-329` |
| 3 | Degraded day-5 snapshot (`agentScoresCarried`) → refused, stays `battle`, manual review, no self-heal | `:338-342`; `leagueTournament.js:1378-1385` |
| 4 | `runWeekSideEffects`, **rank half:** `lockTopTwo` (composite desc, seat-order tiebreak) → `applyGroupWeekToRanks` | `:349`, `:478-486`; `tournamentRank.js:53-121` |
| 5 | **leaderboard half:** `upsertLeaderboardForGroups(db, [group])`; the month doc's `entries.{uid}.weeks.{groupId}` row is SET | `:500`; `tournamentLeaderboard.js:308-422` |
| 6 | Only if both halves were clean → `transitionStatus(group.id, 'complete')` | `:350-354` |

**What lands on disk:**

- **Rank doc** `tournamentRanks/{odUserId}` (dev groups: `dev-{odUserId}`, `leagueTournament.js:866-868`), one transaction per seat, **CPU seats included** (frozen ratchet for CPUs, `tournamentRank.js:84`): `appliedGroups.{groupId} = { groupId, weeklyComposite: round2(composite), placement (1-based, from the same ranking), cpuOpponents, raw, guard, delta, rpAfter, appliedAt }`, the same event appended to `history` (cap 20), whole-doc `tx.set`, once-only guard on `appliedGroups[groupId]` (`tournamentRank.js:70-105`). **This is the only place a base-layer placement is written.**
- **Leaderboard row** `tournamentLeaderboards/{YYYY-MM}` (`dev-YYYY-MM` for dev), month = ET month of `dailyScores.day1.recordedDate` (`tournamentLeaderboard.js:76-78`): `weeks.{groupId} = { points: getWeeklyComposite, userPoints, roundNumber, baseLayerWeek, final: true, updatedAt }` (`:190-211`). Placement keys (`placement`, `placementPoints`, `compositeMargin`) are emitted only under `WEEKLY_LADDER_PLACEMENT_ENABLED`, which is `false` (`:194`, `:398-401`; `featureFlags.js:1202`). Note: the **nightly** aggregation had already written this same row with `final: true` at day-5 banking, hours before the duty (`final = isWeekBanked || complete`, `:191`; nightly host `snake-draft-daily-scores.js:543-549`; battle-only query `:436`). The leaderboard's `final` is therefore a banking-time flag, not a finality signal.
- **Group doc:** `transitionStatus` writes exactly `{ status: 'complete', updatedAt: now }` (`tournamentGroupService.js:126`). No `completedAt`, no placements, no composite copy. The composite of record stays where banking left it (Q4).

**Timestamps.** The group doc's completion time is its `updatedAt` at the transition (nothing writes a completed group afterward, see permanence); the rank event carries `appliedAt`; the leaderboard row `updatedAt`. All are the duty tick's `nowIso`.

**When.** The Friday duty routes on Fridays at/after 12:00 ET (`tournamentOrchestrator.js:122-130`) on the 21–23 UTC cron arms (`vercel.json:177-178`) = 17:00–19:50 EDT / 16:00–18:50 EST; day-5 banking lands at `15 21` UTC = 17:15 EDT / 16:15 EST (`vercel.json:49-50`; `snake-draft-daily-scores.js:481-487`), so the first completing tick is normally ~17:20 EDT. A Friday that stayed banking-pending, errored, or was frozen completes on the **Monday catch-up** (`runMondayPipeline` calls `runFridayAdvancement` first, `tournamentOrchestrator.js:505`) from ~07:00 EDT / 06:00 EST, or via the admin `run-duty` endpoint.

**Permanence. Is a completed base group re-scorable? No, by construction, at this HEAD:**

- `complete` is terminal: `LEGAL_TRANSITIONS[complete] = []` (`tournamentGroupService.js:58`); `transitionStatus` throws on any further move (`:125`). `voidGroup` is legal only from `battle` (`:248-256`).
- `dailyScores` has one writer, `bankGroup`, which refuses `status !== 'battle'` (`tournamentBanking.js:375`) and, even in `battle`, refuses a sixth day (`:136-138`); the nightly pass queries `battle` only (`:403-405`); the admin bank endpoint refuses non-battle (`bank-daily-scores.js:71-72`).
- The mutation endpoints read this session refuse a non-`battle` group: flip (`api/tournament/flip.js:139`), CPU claims (`place-cpu-claims.js:50`), claim processing (`process-claims.js:38`), ledger reconcile (`reconcile-ledger.js:45`), training activation (`activate-training-pod.js:68`).
- Rank application is once-only per (seat, group). The leaderboard SET is idempotent from frozen inputs (a re-upsert reproduces identical values).
- One-off scripts that mention `dailyScores` only read it (`scripts/lifecycle-void-precheck.js:33-51`; `lifecycle-void-apply.js:7,61` voids via `voidGroup`; `lc-fork-adjudication.js:88-97`; `lobbyweek-stamp-precheck.js:73-78`), confirmed by grep; no script writes it.

The only way to change a completed base group's result is an out-of-band Admin SDK edit.

**The single signal settlement should key on.** There is no lock record for base-layer groups: no bracket entry, no `finalScores`, no `sideEffectsAt`, no `completedAt`. The one durable single-doc signal is the group's terminal status, qualified:

```js
group.status === 'complete'
  && group.isTraining !== true      // training pods complete with zero ladder effects
  && group.baseLayerWeek != null    // base layer, not a bracket game (the factory XOR)
  && isWeekBanked(group)            // day-5 snapshot present (the clamped reader)
```

with composites read through `getWeeklyComposite(group, odUserId)` for every `groupMembers` id. Why not `status == 'complete'` alone: training pods reach `complete` via the nightly `completeBankedTrainingPods` (`trainingLifecycle.js:696-718`) and the Friday plain finish (`:324-329`) without ever writing rank or leaderboard, and the `isTraining` omission idiom means the test must be `!== true`. Why not banking: `isWeekBanked` is satisfied at 17:15 ET Friday while the group is still `battle`, and a banked group can then be refused as degraded (`:338-342`), withheld by the freeze (`:282-301`), or voided (`voidGroup`); the banking clamp's own log names this state "the finalizer appears STALLED" (`tournamentBanking.js:462-468`). At this HEAD, `complete` on a non-training base-layer group is reachable only after the rank and leaderboard halves landed clean and the composites became immutable, which is exactly the property settlement needs.

Optional cross-check for the `resolving → resolved` re-read: `tournamentRanks/{rankDocId(seat)}.appliedGroups[groupId]` exists for each seat. It is written before the transition, so it can also exist briefly for a group still in `battle` whose completion was deferred (`:350-353`); hence a cross-check, not the key. Do not key on the leaderboard `final` flag or on `updatedAt`.

**Where the co-tenant hook must sit, given the above** (design consequence, not a ruling): after `transitionStatus` at `:354`, inside the existing per-group try/catch (`:310-359`), with its own catch and its own counter, never `summary.errors` (that withholds the Friday marker, `tournamentOrchestrator.js:902`, and re-ticks a duty that can no longer see the completed group). It must **not** be a third half of `runWeekSideEffects`: that would gate completion on settlement through `clean` (`:350-353`), contradicting D-o. Because a completed base group leaves the `battle` query, the duty never revisits it; the bracket sweep's retry-for-free (`:412-417`) has no base-layer analog. Settle-on-read and the admin re-run are therefore the only retries, as V1.2 §7 already states; the `resolving` re-read is a re-read of the group-doc predicate above. The Monday catch-up (`:505`) and `run-duty` run the same function, so settlement can also land Monday morning. Confidence: confirmed.

### Q2. Base-layer pod lifecycle

Both production paths are live: `LEAGUE_LOBBY_ENABLED = true` (`featureFlags.js:149`) and `LEAGUE_LIVE_DRAFT = true` (`:443`). Confirmed unless tagged.

**Group-doc fields that matter.** `createdAt` is stamped on both paths as an ISO string (`leagueTournament.js:1553` via the factory; slot pods `liveDraftFormation.js:325`). There is **no `weekKey`** (not found); the field is **`baseLayerWeek`**, an ISO-8601 label like `2026-W38` (`isoWeekString`, `leagueTournament.js:888-898`), produced from the ET **battle Monday** on both paths. Slot pods additionally carry `battleStartWeek { mondayEtDate, anchorEtDate, anchorIso }` (`:317`), `scheduledDraftAt` (`:316`), `isLiveDraft: true` (`:314`), and, after their draft completes, `startAnchor` (`trainingLifecycle.js:356`). Lobby pods carry none of those; the ranked resolution path passes no `startAnchor` (`resolve-user-draft.js:183-186`).

**Path 1, lobby (single-shot, pre-committed boards).**

| Stage | When | Cite |
|---|---|---|
| Formation | Synchronous in the request: the 4th human join, the creator's "Start now", or Quick Play (1 human + 3 CPUs). Any day, any hour. | `lobby-join.js:47-50`; `lobby-form.js` header; `quickPlay` `tournamentLobbyService.js:409-417` |
| Group doc | `status: 'forming'`, `roundNumber: 1`, `baseLayerWeek = battleWeekKeyFor(now)` = `deriveBaseLayerWeek(deriveBattleStartWeek(now))` | `tournamentLobbyService.js:361-380` (`:372`, `:374`), helper `:283-285`; the lobby doc gets the same key `:108-110` |
| Battle Monday rule | Monday before 09:30 ET → that same Monday; Monday at/after 09:30 → next Monday; Tue–Sun → the upcoming Monday. Holiday Monday → the anchor advances to the first trading day; the label stays that Monday's week. | `liveDraftFormation.js:191-208` |
| User draft | Boards committed (re-committable) while forming; resolved by the orchestrator's **first Monday tick** ≥ 11:00 UTC (07:00 EDT / 06:00 EST); missing boards auto-committed; `forming → battle`; `baseLayerWeek` re-stamped to the week actually resolving. | `commit-board.js:3-5`; `tournamentOrchestrator.js:122-130,554-588`; `resolve-user-draft.js:207-209` |
| Agent draft | Same tick: agent boards → agent draft → 24-held check | `tournamentOrchestrator.js:594-618` |
| First battle | Same tick: deploy fan-out (≥20 s pacing) creates `agentBattles` docs `status: 'active'`, `groupId`, `createdAt`/`activatedAt` | `:628-630`; fenced `agentBattleService.js:129-143` (read-only) |

So a lobby pod formed mid-week battles **the next Monday**; the user and agent drafts are not visible until that Monday ~07:00 ET, and the first battle doc exists minutes later (Phase 0 V6 holds). Edge, inferred: a pod formed Monday before 09:30 is stamped for the same Monday but is resolved that day only if it exists before the Monday duty marker is set (the first clean tick; later ticks short-circuit, `tournamentOrchestrator.js:1035-1038`); otherwise it lingers in `forming` (there is no expiry backstop for a non-training lobby pod, `resolve-user-draft.js:190-191`) and the restamp corrects its week the following Monday.

**Path 2, live-draft slots (competitive).**

| Stage | When | Cite |
|---|---|---|
| Claim | Any time; the first claim creates a `forming` group at the deterministic id `lds_<slotId>_<fireEtDate>` for the slot's **next** occurrence, with `scheduledDraftAt`, `battleStartWeek`, `baseLayerWeek`, humans-only `players` (1–4; no CPUs pre-fire). Guarded by the one-competitive-game-per-battle-week rule. | `liveDraftFormation.js:342-406` (id `:91-93`, guard `:362-364`), doc `:308-328`, seat model `:33-40` |
| Slots | Wed 19:00, Sat 12:00, Sun 19:00, Mon 08:45 ET | `src/config/liveDraftSlots.js:32-37` |
| Release | A seat can be released until the fire instant; the **last human leaving deletes the doc** | `:429-436`, `:444-448` |
| User draft | The `live-draft-fire` cron (`*/10 * * * *`) fires due groups: CPU fill + `userPool` stamp, `forming → drafting`; humans pick live, overdue turns autopick; on completion the handoff writes `players[].picks`, `userPool`, `startAnchor` and moves `drafting → battle` if the anchor date is today, else `→ awaiting_open` | `vercel.json:181-182`; `live-draft-fire.js:56-80`; `liveDraftLifecycle.js:104-115,177-260,324-346`; `trainingLifecycle.js:330-359` (target `:352`, update `:356`) |
| Monday flip | `awaiting_open → battle` on the orchestrator's weekday-morning tick when the anchor date arrives; deliberately not training-filtered; runs before the duty dispatch | `trainingLifecycle.js:583-612`; `tournamentOrchestrator.js:971-993` |
| Agent draft + first battle | The same Monday tick's pipeline takes the now-`battle` pod through boards → agent draft → deploys | `tournamentOrchestrator.js:514-527,589-632` |

So a slot pod claimed mid-week also battles **the next Monday** (Wed → the following Monday; Sun 19:00 → the next-day Monday; Mon 08:45 → that same Monday, completing by ~09:15 and flipping inline to `battle`). The difference from the lobby path: the **user draft is complete days earlier**, Wednesday evening, Saturday noon, or Sunday evening, and the picks sit on the group doc from then on.

**`baseLayerWeek` is re-stampable and one-way.** Three sites rewrite it after formation, for pods that lingered past their stamped Monday: the lobby resolution (`resolve-user-draft.js:207-209`), the slot fire (`liveDraftLifecycle.js:248-253`) and the slot completion (`:337-340`). The label has no inverse in the codebase (searched for week-label-to-Monday helpers: **not found**; the three `getMondayOfWeek*` helpers at `fetchEarningsCalendarEODHD.js:69`, `promote-discover-themes.js:24`, `discover/current-events.js:27` take a date, not a label).

**Does V1.2 §2's assumption hold?** Yes as an anchor, on both paths: the backing week ending Sunday 23:59 ET maps to pods whose `baseLayerWeek` is the ISO week of the following Monday, and the read side agrees by construction (`currentBaseLayerWeek` walks back to the ET Monday, `leagueTournament.js:938-945`; `useRealLeagueState.js:59-61`). Four qualifications:

1. Battles begin on the first Monday tick (~07:00 EDT / 06:00 EST), not at the 09:30 open; the battle-doc belt in §4 fires then.
2. A holiday Monday moves the first battle (and the first banking day) to Tuesday while the week label stays the Monday's.
3. `closesAt` cannot be computed from `baseLayerWeek` alone. Use `battleStartWeek.mondayEtDate` on slot pods and `deriveBattleStartWeek(createdAt)` (the exported helper pair in `liveDraftFormation.js`) on lobby pods, or add a zero-import label-to-Monday helper.
4. A pod can linger past its Monday (no expiry for lobby pods; a late slot fire). Its pool would have closed by clock with no battle doc in existence, and the pod then battles a later week: an admin-refund case, not a normal lifecycle.

Confidence: confirmed except the Monday-pre-open edge (inferred from the marker logic).

### Q3. 18+ / eligibility

**None exists. Confirmed by search; nothing found.**

- **Signup** stores email, password, username (`src/firebase/authService.js:25-45`) and writes `users/{uid}` with `auth { uid, email, createdAt, lastLoginAt }`, `profile { username, displayName, avatarUrl, bio }`, `stats`, `settings { notifications, privacy }`, `achievements`, `metadata { referralCode, premiumTier, flags: {} }`, `archived` (`:52-106`); Google sign-in writes the same shape (`:293-322`). No date of birth, age, adult flag, terms acceptance, or consent timestamp. The `acceptedAt` hits in the tree are battle-challenge acceptances (`src/App.jsx:3239,4322,4384`; `firebaseService.js:601`), not terms.
- **Copy:** no terms-of-service, privacy, disclaimer, EULA, or "must be 18" string in `src/` (grep, non-test); `index.html` and `public/` carry no legal page; no age-gate document in `docs/` (grep).
- **Server auth** is Firebase ID-token verification only (`api/_utils/authMiddleware.js:15-42`); no custom claim is read anywhere.
- **Tournament entry gates:** flag + auth (`lobbyEndpoint.js:83-93`; `liveDraftEndpoint.js:80-86`), the one-competitive-game-per-battle-week guard (`tournamentLobbyService.js:298-300,413`; `liveDraftFormation.js:362-364`), and, training only, `no_agent` (`lobby-quickplay-training.js:53`). Nothing age-related.
- **Rules:** `users/{userId}` is owner-create, owner-update, authed-read (`firestore.rules:161-168`). Consequence for §11 gate 2: an age or eligibility flag stored on `users/{uid}` would be client-writable and therefore not authoritative; the codebase's own precedent keeps server-authoritative state off that doc (`firestore.rules:560-561`, the rank comment). An authoritative gate needs a server-written field under a `write: if false` rule (the `tournamentRanks` pattern) or a server-only subcollection, plus the attestation flow itself.

### Q4. Composite storage

- **Where:** `tournamentGroups/{groupId}.dailyScores.day{N}.closeScores[odUserId] = { totalPoints, picks[], agentPoints, compositePoints }`, banked once per ET trading day by the single writer (`api/_utils/tournamentBanking.js:325-333`; day entry `{ closeScores, recordedAt, recordedBy, recordedDate, agentScoresCarried? }` `:346-354`). Day 5 is `dailyScores.day5`.
- **Formula and rounding:** `compositePoints = round2(computeComposite(agentPoints, totalPoints))` (`:332`) = `round2(agentPoints + 1.5 × totalPoints)` (`computeComposite`, `leagueTournament.js:832-834`; `USER_LAYER_K: 1.5`, `:1119`); `agentPoints` and `totalPoints` are each `round2` first (`:324`, `:309`); `round2 = parseFloat(x.toFixed(2))` (`leagueTournament.js:802-804`). `agentPoints` is the sum of `scoreState.currentScore` across the group's `agentBattles` per owner (`tournamentBanking.js:52-61`).
- **The reader to use:** `getWeeklyComposite(group, odUserId)` (`leagueTournament.js:1340-1345`) returns `entry.compositePoints` from the **clamped** final day (`getLatestBankedDayEntry`, max day ≤ 5, `:1305-1319`, the L-B guard against stalled-finalizer extra days), falling back to an unrounded `computeComposite(agentPoints, totalPoints)` only on pre-P6 docs with no `compositePoints`. `isWeekBanked` = clamped `dayN ≥ 5` (`:1353-1363`).
- **Tie equality:** two seats are tied iff `getWeeklyComposite(group, a) === getWeeklyComposite(group, b)`. Strict equality is correct and is exactly what the tournament's own comparator uses (`rankByScores`, `value(b) - value(a)` then seat order, `:845-849`; missing/non-finite ranks as 0, `:846`). Both values are `round2` outputs, so equal two-decimal strings are bit-identical doubles; no epsilon and no re-rounding (the rank writer re-applies `round2` idempotently, `tournamentRank.js:87`). Winning set = every `groupMembers` id whose value equals the maximum. Guard with `Number.isFinite` and read through the helper, never raw `dailyScores.day5`, so the clamp and the legacy fallback are inherited.
- **Refinement to Phase 0 C6:** at this HEAD bracket `finalScores` are the same `round2` values (`lockTopTwo` → `getWeeklyComposite`, `tournamentAdvancement.js:103-113`); "not `round2`" applies only to pre-P6 docs via the fallback.

Confidence: confirmed.

### Q5. Pod-list query

**Existing, viewer-independent (client):** `subscribeBaseLayerGroups(baseLayerWeek)`: `where('baseLayerWeek','==',W)`, `orderBy('updatedAt','desc')`, `limit(30)` (12 × 2.5 over-fetch), then the pure `selectBaseLayerField` drops `isTraining === true` and `voided`, sorts by recency, caps 12 (`src/services/tournamentGroupService.js:315-333`; `leagueTournament.js:751,771-779`). The hook calls it with `currentBaseLayerWeek(new Date())`, independent of `myGroup` (`useRealLeagueState.js:59-61,91-95`), and feeds THE FIELD (`leagueAdapter.js:385-446`, filter `:416`). Composite index `tournamentGroups (baseLayerWeek ASC, updatedAt DESC)` (`firestore.indexes.json:407-420`), Console-created per the comment (`tournamentGroupService.js:298-300`). So "this week's base groups independent of the viewer" already exists on the client; Phase 0 R6's empty-funnel finding holds for the **bracket**, not the field.

Its gaps for backing: (1) not status-scoped, so it returns forming, drafting, awaiting_open, battle, complete, and expired groups of the week alike; (2) not `isDev`-scoped (D-DEVFIELD, `20260901_D-LOBBYWEEK_BUILD_REPORT.md` §5): the dev seeder stamps a formation-week label and `isDev: true` (`seed-tournament-group.js:76,81`), so a dev group with a matching week leaks; (3) keyed to the week **in progress**, whereas backing needs the **upcoming** battle week; (4) capped at 12 by recency; (5) `useMemo([])` week staleness (D-WEEKMEMO); (6) a client read of full group docs, not a sealed projection.

**Existing server reads:** `fetchEligibleGroupsByStatus(db, status, { includeDev, excludeTraining })`: `where('status','==',status)` (auto single-field index) with in-memory `players.length === 4`, `isDev`, `isTraining` filters (`api/_utils/tournamentGroupService.js:301-314`); not week-scoped, and it excludes partial slot pods. `findDueSlotGroups`: `status == forming` plus in-memory `isLiveDraft` / `scheduledDraftAt` (`liveDraftLifecycle.js:104-115`). `getSlotOccupancy` → `GET /api/tournament/slot-schedule`: one doc read per slot at the deterministic id of its next occurrence, returning human count and seat names (`liveDraftFormation.js:473-503`; `slot-schedule.js:14-19`; flag + auth `liveDraftEndpoint.js:80-86`), the only existing server feed of forming pods, slot pods only. No endpoint lists groups (`api/tournament/*` with a `.where(` is only `battle-view.js:43`, on `agentBattles`).

**Minimal index for a pod-list endpoint: zero new indexes**, if the endpoint (Admin SDK) reuses the field's query, `where('baseLayerWeek','==',W).orderBy('updatedAt','desc')` (already indexed), and filters `status ∈ {forming, drafting, awaiting_open, battle}` plus `isDev !== true`, `isTraining !== true`, `status !== 'voided'` in memory, the house pattern of `fetchEligibleGroupsByStatus`. Only if a status filter must live in the query: `where('baseLayerWeek','==',W).where('status','in',[...])` with no `orderBy` is equality-only and can be served by index merging (inferred); with `orderBy('updatedAt')` it needs a new composite `(baseLayerWeek ASC, status ASC, updatedAt DESC)`. The spec's `(status, weekKey)` names a field that does not exist. Two design notes: the week to query is the **next** battle Monday's label (`deriveBaseLayerWeek(deriveBattleStartWeek(now))`, the writers' own pair, `liveDraftFormation.js:191-236`, noting that this pair returns the same Monday before 09:30 ET on a Monday, whose pools closed the night before); and partial slot pods (1–3 humans, deletable) need a rule (A3).

Confidence: confirmed except the index-merge remark (inferred).

---

## 3. V1.2-vs-code contradictions (beyond the Phase 0 report)

Each row quotes the spec, cites the code, states the consequence. Numbered A-Cn to avoid colliding with Phase 0's Cn.

**A-C1. §4 "Drafts are not visible during the window — close precedes the Monday tick that resolves them."** True for lobby pods, **false for slot pods**: the Wed 19:00, Sat 12:00 and Sun 19:00 slots (`liveDraftSlots.js:33-35`) complete the user draft the same day (`liveDraftLifecycle.js:324-346`), and the handoff writes `players[].picks` onto the group doc (`trainingLifecycle.js:334-342,356`), which any signed-in client can read (`firestore.rules:531-533`; the redesign's pod view renders every pod's picks, `leagueAdapter.js:223-233`). The agent six still resolve Monday. **Consequence:** for a slot pod, a backer can see each human's three-stock user layer before the Sunday close. A ruling is needed: disclose it, close slot-pod pools at the slot's `scheduledDraftAt`, or exclude slot pods from V1.

**A-C2. §4 "Opens when the pod forms (`forming`) … Hash-at-open is captured at materialization"; §6 `teams[] {playerId, agentId, archetypeId, isCpu, hashAtOpen}` fixed at open.** A slot pod is humans-only until fire: seats join up to four and can leave (`liveDraftFormation.js:394-399,453-458`), CPUs are added at fire (`liveDraftLifecycle.js:133-165`), and the last human leaving **deletes the group doc** (`liveDraftFormation.js:444-448`). **Consequence:** a pool keyed `groupId` can outlive its group, and a stake can name a team that left. Either materialize slot-pod pools only at/after fire (`drafting` or later), or re-validate `players[]` in the stake transaction and add a `group_deleted → refunded` path; `humanTeams` must be recomputed at close.

**A-C3. §5 and §6 "status ∈ {forming, active}".** There is no `active` status. The enum is `forming`, `drafting`, `awaiting_open`, `battle`, `complete`, `expired`, `voided` (`leagueTournament.js:84-116`); the live status is `battle`, and slot pods sit in `drafting` then `awaiting_open` between their draft and Monday. **Consequence:** the pod list and the stake window must name the real statuses ("backing open" = forming | drafting | awaiting_open with no battle doc); `expired` and `voided` are terminal and excluded.

**A-C4. §6 indexes "groups `(status, weekKey)` for the pod list".** The field is `baseLayerWeek`, and the existing composite is `(baseLayerWeek, updatedAt)` (`firestore.indexes.json:407-420`). **Consequence:** Q5, zero new indexes with the in-memory filter; a new composite only if the status filter goes into the query with an order.

**A-C5. §1 team identity `(groupId, playerId, agentId)` and §6 `teams[].agentId` at open.** The group doc carries `players[].odUserId` (not `playerId`) and **no agent id for human seats**. The agent is resolved at Monday board production by `agents where ownerId == uid`, excluding training and casual clones, with a synthetic `dev-agent-{uid}` when the user has none (`tournamentAgentBoards.js:307-338`); the pipeline then refuses the group (`tournamentOrchestrator.js:595-599`). The durable seat→agent map is the agent-draft stream, which exists only after Monday's step 3 (`seatsFromDraftStream`, `:461-467`). **Consequence:** at pool open the human team's `agentId` needs the same owner lookup, and it can change before Monday if the user replaces their agent (inferred); or the team keys on `(groupId, odUserId)` with `agentId` recorded from the stream at settlement. CPU seats are deterministic (`cpu-agent-{n}`).

**A-C6. §2 "stakes … target pods whose battles begin the following Monday"; §4 `closesAt` at Sunday 23:59 ET; §6 pool `weekKey`.** `baseLayerWeek` is a one-way label (`isoWeekString`, no inverse: not found) and is re-stamped for lingering pods (`resolve-user-draft.js:207-209`; `liveDraftLifecycle.js:248-253,337-340`). **Consequence:** `closesAt` must be derived from a Monday date (`battleStartWeek.mondayEtDate` on slot pods, `deriveBattleStartWeek(createdAt)` on lobby pods) and settlement must read the group's current week, not the pool's open-time copy. A pod that lingers past its Monday battles a later week after its pool closed by clock: an admin-refund case the §7 list should name.

**A-C7. §7 "co-tenant in the Friday duty's base-group completion path … never gating group completion" versus Phase 0 V2 "resolution should ride `runWeekSideEffects` as a third half".** The two are incompatible on the base layer: a third half gates completion via `clean` (`tournamentAdvancement.js:349-353`), and the base loop has no lock, no stamp, no sweep. **Consequence:** the hook goes after `:354`, own try/catch, own counter; V1.2's own fallbacks (settle-on-read, admin re-run) are the only retries; Phase 0 V2's "retries for free" applies to bracket games only (`:412-417`).

**A-C8. §7 refund paths "insufficient at close; group VOIDED → refunded; admin refund".** Two more terminal shapes exist: `expired` (reachable from forming / drafting / awaiting_open, `tournamentGroupService.js:52-54`; today only training cleanup calls it) and the **deleted** slot-pod doc (A-C2). `voided` is reachable only from `battle` (`:57`, `:248-256`), i.e. after the pool closed, mid-week. **Consequence:** `refunded` must be reachable from a missing group doc and from `expired`, and the void path is an in-week event on a closed pool.

**A-C9. §2 net BP "attributed to the ET month of the pod's week, the monthly ladder's key".** The ladder's key is the ET month of the **day-1 banking date** (`monthKeyForGroup`, `tournamentLeaderboard.js:76-78`), i.e. the battle Monday (or a holiday Tuesday), never the backing week's Sunday. **Consequence:** wording only. Say "the ET month of the pod's first banked day" so a month-straddling week attributes the way the ladder does.

**A-C10. §5 "This week's pods … for the week".** The field's week is the week in progress (`currentBaseLayerWeek`, `leagueTournament.js:938-945`); backing pools are for the **upcoming** battle week. **Consequence:** the pod-list endpoint keys on next Monday's label (Q5), and the lobby desk chip must not point at the current field.

**A-C11. §11 gate 2 / §13 Q3.** No eligibility state exists, and `users/{uid}` is owner-writable (`firestore.rules:163-166`). **Consequence:** the gate is a build, and it must be server-written to be authoritative (Q3).

**A-C12. §4 belt "refuses the moment any `agentBattles` doc exists for the pod (`activatedAt`)": confirmed, one nuance.** `agentBattles.groupId` equality is the house query (`battle-view.js:43`; `tournamentOrchestrator.js:329-333`; auto-indexed single field) and `activatedAt` is stamped at creation (fenced `agentBattleService.js:139-140`, read-only). The orchestrator re-checks `gameMode === 'baggerbomb_tournament'` in memory (`:337`; constant `leagueTournament.js:67`); the belt should do the same. Not a contradiction.

**A-C13. §7 "covered by the `TOURNAMENT_ADVANCEMENT_FROZEN` belt".** Holds only for a hook placed inside `runFridayAdvancement` after the early return (`:282-301`). Settle-on-read and the admin endpoint must check the flag themselves (Phase 0 R3 said the same).

**A-C14. §6 "Dev namespace: `isDev` groups route to `dev-` pool ids".** Necessary but not sufficient: the pod list must also **exclude** dev groups from production viewers (the field does not, D-DEVFIELD), and rank/leaderboard resolve `dev` from the group flag (`tournamentAdvancement.js:349`, `:550`).

---

## 4. Phase 0 citations re-verified at this HEAD

Re-read this session and **holding**: `tournamentAdvancement.js:18-19, 103-113, 236-432 (base loop 307-361), 282-301, 456-518, 523-529, 539-561, 630-700 (lock 651-665, complete 682)`; `tournamentRank.js:53-121, 129-152, 81-84`; `tournamentLeaderboard.js:40-46, 74-78, 160-183, 190-211, 308-422 (382, 391), 430-444`; `tournamentBanking.js:366-394, 402-482`; `api/_utils/tournamentGroupService.js:301-314`; `tournamentOrchestrator.js:103, 122-130, 133-140, 182-191, 329-344, 497-639 (505, 515-516, 553-632), 901-917, 947-1066 (1047-1048)`; `tournamentTime.js:125-132, 142-152`; `tournamentLobbyService.js:349-380 (364, 372)`; `liveDraftFormation.js:313-314`; `leagueTournament.js:84-116 (VOIDED 115), 802-804, 832-834, 845-849, 853-856, 860-868, 888-898, 1305-1319, 1340-1345, 1353-1363, 1378-1385, 1489-1556 (XOR 1524-1528)`; `firestore.rules:161-168, 224-225, 531-583`; `firestore.indexes.json` agentBattles `[ownerId, status, completedAt]` (entry 15) and `[agentId, resolvedAgentManifest.equippedConfigHash]` (entry 18); `vercel.json:43-199` (39 entries; orchestrator `:177-178`); `useRealLeagueState.js:86, 99`; `seed-tournament-group.js:76,81`; fenced `agentBattleService.js:129-143` (read-only).

Drift or refinement:
- `tournamentGroupService.js:320-324` (client field query) is now `:320-325`; `where` at `:322`. Trivial.
- Phase 0 C6 "finalScores are composites rounded by `computeComposite`, not `round2`": at HEAD `compositePoints` is `round2` at banking (`tournamentBanking.js:332`) and `getWeeklyComposite` returns it as stored; the unrounded value arises only through the legacy fallback (`leagueTournament.js:1344`). Q4.
- Phase 0 V6 "ranked groups carry no `startAnchor`": true for lobby pods; slot pods carry `startAnchor` after draft completion (`trainingLifecycle.js:356`), so `isPreOpenOnBattleDay` works for them.
- Phase 0 R6 (a viewer with no group sees an empty funnel): holds for the bracket; the base-layer field is viewer-independent (Q5). V1.2 §5 cites R6 as the reason a pod source must be built; the client source exists, the **server** endpoint does not.
- Phase 0 V2 "resolution should ride `runWeekSideEffects` as a third half": correct for bracket games, wrong for base-layer groups (A-C7).

Not re-verified this session (outside Q1–Q5): `LeagueSpectate.jsx`, `deskHonesty.test.js`, `flagPinGuard.test.js`, `agent-evaluate.js`, `resolvedAgentManifest.js`, `tournamentBattleView.js`, `leagueSignals.js`, and the P6b `SpectatorView` anchors.

---

## 5. Baseline

`node_modules/` is absent in this container; the brief forbids installing, so the suite was not run and `npx` was not invoked. CI on `main` is the baseline. The unit workflow runs on pull requests only (`.github/workflows/tests.yml:16-19`; `npm run test:run -- --maxWorkers=2` at `:55`), so the run of record is PR #837's, the PR this HEAD merges (head `52485aeb`, docs-only). Check run `vitest (unit)` id 103600467450: **conclusion success**, 2026-09-12 18:28–18:32 UTC. Verbatim from its log:

```
 Test Files  652 passed | 6 skipped (658)
      Tests  12336 passed | 87 skipped (12423)
   Duration  177.33s
```

PR #836 (the last code PR, `69d18ec8`) was also green: `vitest (unit)` success, 2026-09-10 05:44–05:47 UTC (log not pulled).

---

## 6. Noticed along the way — report-only, left for separate tasking (BUILD_RULES §3)

- **N1 (inferred, needs verification).** A `mon-0845` slot pod whose draft completes after the Monday duty marker is set gets no agent boards, agent draft, or deploys that Monday: later ticks short-circuit on the marker (`tournamentOrchestrator.js:1035-1038`), and the Tue–Fri fan-out's catch-up needs an agent-draft stream that only Monday's pipeline writes (`:727-735`, `:461-467`). The e2e test proves the inline `battle` flip before 09:30 (`liveDraftLifecycle.e2e.test.js:353-364`), but no test read here covers the agent layer of that pod against an already-set marker. A ranked pod could play a week with an empty agent layer. Not this arc.
- **N2.** `seed-tournament-group.js:76` still stamps the formation week (`isoWeekString(new Date())`), D-SEEDWEEK, already logged in the D-LOBBYWEEK report; relevant to any dev smoke of the pod list.
- **N3.** THE FIELD does not exclude `isDev` (D-DEVFIELD, already logged); the pod list must.
- **N4.** No week-label-to-Monday helper exists; pool `closesAt` needs one or the date-based derivation (A-C6).
- **N5.** `users/{uid}` is owner-writable (`firestore.rules:163-166`): any eligibility state must live elsewhere (Q3).

---

## 7. STOP

Report delivered as a single message in this session and as a byte-identical file outside the repo tree (session scratchpad), offered for download. No branch used, no commit, no repo file touched, no package installed, no fixes. Founder review comes next; nothing proceeds until then.
