# Launch-Readiness Watch Ledger (P9 inherits this)

**Created:** P8 (2026-06-13), at the integration sweep. **Owner of action:** P9 (flag flip + launch checklist).
**Status of the build at creation:** P0–P8 merged/in-flight; League is feature-complete behind `TOURNAMENT_TAB_ENABLED` (still `false`). The P8 integration sweep found **no producer/consumer seam mismatch** (the seam map is in `docs/audits/2026-06-13_P8_STAGE0_SWEEP_REPORT.md`).

This file is the consolidated list of known, founder-acknowledged, **deferred** items the build carried to launch — the things P9 must check, deploy, or watch. It is a record, not a backlog of bugs: each item is launch-safe at V1 scale with a stated trigger for when it stops being so. Nothing here blocks the flag flip **except the items marked 🚩 BLOCKING**.

---

## 🚩 BLOCKING gates for the flag flip (P9 must clear these first)

### G1 — Deploy the Firestore rules for the tournament collections
Every client read in `LeagueScreen` (group, claims, boards, streams, ledger, bracket, leaderboard, rank) depends on rules blocks that are **in the repo but carry "inert until manual Console deploy."** If they are not deployed before `TOURNAMENT_TAB_ENABLED` flips, every client read 403s.
- Blocks (all in `firestore.rules`): `tournamentGroups` (`:302`), `tournamentGroups/{groupId}/{document=**}` (`:312`), `tournamentBrackets` (`:322`), `tournamentLeaderboards` (`:334`), `tournamentRanks` (`:339`).
- **Action:** confirm all five are deployed in the Firebase Console, then flip the flag.

### G2 — Agent single-battle lock: a vs-CPU deploy during a pre-battle slot pod blocks the pod's Monday agent deploy — ⬇️ MITIGATED 2026-07-20 (non-fenced items shipped; fenced integrity fix deferred, founder-gated — no longer a hard blocker)
A user's real agent carries ONE `activeBattleId` (set at deploy in `api/agent/decide.js:700`/`:1164`, cleared at completion in `api/cron/agent-evaluate.js:3595`/`:3625`). A competitive live-draft slot pod deploys the **real** agent — seats are keyed by `odUserId` with **no clone** (`api/_utils/liveDraftFormation.js:459,488`; training pods clone via `ensureTrainingClones`, competitive pods do not) — and it sits in **AWAITING_OPEN** after the draft until the Monday battle anchor (`api/_utils/liveDraftLifecycle.test.js:191,198,253,302`; the flip is `flipAwaitingOpenPods`, `api/_utils/tournamentOrchestrator.js:888-910`). If the user deploys that same agent to a vs-CPU battle during AWAITING_OPEN (duration defaults to `'1d'` — `api/agent/decide.js:691`, `api/_utils/agentBattleService.js:272`), the battle is still active at the Monday deploy. The tournament deploy (`runPrescribedTournamentDeploy`, via POST `/api/agent/decide` with `gameMode=FLAT6` — `decide.js:229-231,1029`; orchestrator dispatch `tournamentOrchestrator.js:225,677`) queries for **any** active `agentBattle` (`decide.js:1091-1095`) and, finding the vs-CPU one, **early-returns `battleCreated:false`** (`decide.js:1103-1113`) — the pod's own agent battle is never created, so the user's agent layer is absent from their League pod.
- **Scope:** independent of the removed League "While you wait" BaggerBomb CTA. The vs-CPU deploy is the Command Center's own deploy path, so the conflict exists for **any** user who deploys vs-CPU while holding a pre-battle slot pod. A UI status gate on one surface does not close it.
- **Severity — RESOLVED (2026-07-20 discovery, `docs/audits/20260720_G2_ACTIVEBATTLEID_CONFLICT_DISCOVERY.md`):** a **day-1 gap, not a whole-week absence.** The Tue–Fri weekday fan-out re-seats a Monday-*skipped* member via the draft-stream **catch-up** — `buildIncumbentSeats` (`tournamentOrchestrator.js:641-668`) adds a catch-up seat for any agent absent from the incumbent map, and that map (`latestTournamentBattlesByAgent`, `:280-295`) is `groupId`+tournament-`gameMode` scoped, so the vs-CPU battle is invisible and the skipped agent correctly gets seated. By Tuesday the blocking `'fullday'` vs-CPU battle has expired (next market close) so the redeploy creates the tournament battle. The **user layer still scores** — composite = agentScore + **1.5×**userScore, the agent half a clean 0 for the missed Monday only (`leagueTournament.js:662`, banked at `tournamentBanking.js:308`), NOT week-locking. **Exposed window:** Friday market close → the first Monday orchestrator tick (~6–7am ET; cron `vercel.json:163`); Wed/Thu deploys expire same-day and are safe. **The dangerous property was silence, not duration** (no battle, no shadow-log, and the orchestrator scored the skip as a successful deploy).
- **Mitigations shipped this pass (non-fenced, 2026-07-20):** **(1) Kill the silence** — `fanOutDeploys` now reads the deploy response body and counts a `battleCreated:false` 200 as a **`skipped`** (not `deployed`), warning loudly with group/owner/reason (`tournamentOrchestrator.js:324,383-390`); the new count rides the cron summary + `TournamentDevScreen`. **(2) Honest CTA warning** — the Command-Center deploy shows a NON-blocking heads-up when the user holds a competitive pod (FORMING/DRAFTING/AWAITING_OPEN/BATTLE) and a casual deploy now would still be live at the pod's next session — window-test predicate `casualDeployMissesPodSession` (`src/constants/leagueTournament.js`) driven from `CommandDashboard.jsx`. Neither touches the fence.
- **Integrity fix — DEFERRED (fenced, founder-gated):** the only server-side chokepoint on the user's own deploy is the **fenced** `decide.js` handler (`decide.js:81`) — no non-fenced server point exists in front of it, so the shipped client warning is UX, not integrity. Two options, **both destructive**: (a) **block the casual deploy** at the tournament deploy — *preferred; preventing beats punishing* — or (b) **force-complete** the in-flight vs-CPU battle before deploying (kills the user's battle + its result). Either edits the fenced `decide.js:1096-1120` via the sanctioned fence entry (BUILD_RULES §1). Given the day-1-self-heal severity + the mitigations, this **no longer blocks the flip**; **revisit if beta shows it biting.**
- **Origin:** found during the Seated Waiting Room build (2026-07-19, `docs/audits/20260719_SEATED_WAITING_ROOM_PHASE0_DISCOVERY.md` §12); severity + fenced/non-fenced fix-site map resolved by the 2026-07-20 discovery (`docs/audits/20260720_G2_ACTIVEBATTLEID_CONFLICT_DISCOVERY.md`).

---

## Document-and-watch items (launch-safe now; each has a trigger)

### W1 — `subscribeMyGroup` has no composite index (ledger item 3)
`src/services/tournamentGroupService.js:145-160` queries `groupMembers array-contains uid` with **client-side** status filtering and **no `limit`** — it reads *every* group the player was ever in (completed included), growing monotonically over a career. Deliberate, to dodge a composite index (founder note 3).
- **Launch-safe:** early-round players are in 1–few groups.
- **Trigger:** a long-lived player accumulates many completed groups (order tens) → noticeable read cost / latency.
- **Fix when triggered:** add the composite index (`groupMembers array-contains` + `status in [forming,battle]`) and switch the query to server-side status filtering. **This is a Console index deploy — flag it in the PR; never improvise the index from a session.**

### W2 — Seasonal leaderboard is one whole-doc month board (ledger item 4)
`api/_utils/tournamentLeaderboard.js` read-modify-writes one `tournamentLeaderboards/{YYYY-MM}` doc per upsert. At ~250–400 bytes/entry the Firestore **1 MiB doc cap** lands around **3–5k active players/month**, at which point every upsert for that month fails together (header `:31-37`).
- **Launch-safe:** V1 scale is tens of rows (one bracket + base layer).
- **Trigger:** approaching open registration / a few-thousand monthly actives.
- **Fix when triggered:** land the designed **per-entry subcollection sharding** *before* open registration.

### W3 — Claim/flip transaction read budget (ledger item 2) — verified bounded
Documented here so it is not re-litigated. The claims resolution transaction is **per group** (`process-draft-claims.js` loops `processClaimsForTournamentGroup`, one tx each — never a combined cross-group batch). Per-group reads: `groupRef` + `pendingQuery` (≤12 pending docs at 4-player × 3-cap) + `ledger` ≈ **14 reads**, ~14 writes. The flip tx is ≤2 reads. Both sit far under Firestore's practical per-transaction constraints (10 MiB total, reads-before-writes), and the budget is bounded by group size, **not** registration scale. The `subscribeClaims limit(20)` cap-count is bounded (≤12 pending) because the pending cap is **transaction-enforced** at placement — the cap-check, duplicate-check, and the write share one `runTransaction` (`place-claim.js:125-142`), so parallel submissions cannot both land over the cap (claims resolution honors it as a backstop). **No code change; re-confirm only if group size or pending-cap config grows materially.** (Locked-by-construction; a per-group read-budget test can be added if desired.)

### W4 — streams/boards collection literals (ledger item 6) — value-consistent, no split
The user-board collection `'boards'` and the user-draft stream `'streams'`/`'userDraft'` are referenced by **string literal** at several writers/readers (`commit-board.js:67`, `seed-tournament-group.js:108`, `tournamentCpu.js:143`, `tournamentBoardAutoCommit.js:124,182`, `resolve-user-draft.js:145,173`, client `subscribeOwnBoard`). All values **agree today — there is no live split** (verified). There is no `USER_BOARDS_SUBCOLLECTION` constant.
- **Risk:** future-rename hazard only (a rename of one literal would split a collection). Not a current defect.
- **Disposition:** document-and-watch (founder ruling, P8). If converged later, define `USER_BOARDS_SUBCOLLECTION` in the zero-import schema module, replace the literals, and lock the value with a test (the convergence spans ~6 writer/reader files, where a typo is severe — do it deliberately, not casually).

### W5 — ET-today client helpers not converged (ledger item 5, client half)
The server `toIso` copies were converged at P8 (→ `tournamentTime.toIso`). The **client** ET-today helpers (`etToday` `TournamentDevScreen.jsx:182`, `etTodayStr` `ClaimFlipWindow.jsx:30`, `toEtDate` `flat6BattleEnrichment.js:42`, `etMonthKey` `tournamentSurfaces.js:112`) are **intentionally left**: converging across the client/server SDK boundary is not clean (`tournamentTime` is server-side via `marketSchedule`), and `flat6BattleEnrichment` keeps its copy deliberately node-clean. The ~30 ET-date inlines elsewhere in `src/` predate the tournament (out of scope). Low priority; revisit only if a client-side ET-date drift bug appears.

---

### W6 — Lobby CPU agents share the `cpu-agent-{n}` namespace with dev-bracket smokes (P10a)
The self-serve lobby allocates CPU numbers from a **monotonic global counter** (`tournamentLobby/__cpuSequence`) so concurrent live formations never collide (`tournamentLobbyService.js` `claimLobbyForFormation`). Dev-bracket smokes (`seed-tournament-bracket.js`, `isDev`) still allocate `cpu-agent-{n}` starting at 1 — the **same agent-doc namespace**.
- **Launch-safe:** the lobby counter is monotonic and dev brackets are founder-serialized smokes (not run during live beta formation); once the counter passes the dev low range, no overlap is possible.
- **Trigger:** a founder runs a dev-bracket smoke **concurrently** with live beta lobby formation, in the brief window where the lobby counter is still in the dev low range.
- **Fix when triggered:** start the lobby counter at a documented offset above the dev range (a one-line change to the `__cpuSequence` lazy-init). Not actioned at V1.

### W7 — Open registration trips W2 (the leaderboard 1 MiB cap) — the lobby is the on-ramp (P10a)
The self-serve lobby is the path toward the population that fires **W2** (the whole-doc monthly leaderboard caps around 3–5k actives/month). Beta is invited/tens-scale (safe).
- **Trigger:** approaching **open** (uninvited) registration / a few-thousand monthly actives.
- **Fix when triggered:** land W2's per-entry subcollection sharding **before** open registration. (W1's `subscribeMyGroup` index is the same scale class.)

### W8 — `subscribeMyLobby` reads all open/forming lobbies (no membership index) (P10b)
`src/services/tournamentGroupService.js` `subscribeMyLobby` queries `tournamentLobby` by `status in [open,forming]` and filters membership **client-side** via the pure `selectActiveLobby`. The lobby `members` is an array of **objects** (`{odUserId, displayName, joinedAt}`) — there is no scalar member-id field to `array-contains` on — so it reads **every** currently-open/forming lobby, not just the caller's.
- **Launch-safe:** FIFO V1 keeps a handful of open lobbies at once; authenticated reads of all lobbies are already permitted by the deployed `tournamentLobby` rules block (join-by-id/by-code needs them).
- **Trigger:** the count of simultaneously-open lobbies grows (busy beta / a backlog of half-full lobbies) → every front-door mount reads them all.
- **Fix when triggered:** denormalize a scalar `memberIds` array onto the lobby doc (maintained in `createLobbyDoc`/`joinLobby`) and switch to `memberIds array-contains uid` (the `subscribeMyGroup` shape). **Touches the P10a engine + likely a composite index — flag the index in the PR, never improvise it.** (Same scale class as W1.)

### W9 — Duplicate P10a phase-report file in `docs/audits/` (P10b housekeeping)
`docs/audits/` carries the P10a phase report **twice** — `2026-06-13_P10A_PHASE_REPORT.md` and `20260613_P10A_PHASE_REPORT.md` (byte-identical, 11,215 bytes). A filename-convention slip, not a content issue.
- **Disposition (founder ruling, P10b):** **keep the dated `2026-06-13_P10A_PHASE_REPORT.md` form** (matches every other audit file); remove the `20260613_` duplicate in a housekeeping pass. Left untouched in P10b to keep the surface PR free of unrelated file churn.

## Cross-cron timing & calendar awareness (operate-and-watch)

### O1 — Holiday-week advancement waits for founder intervention
A 4-trading-day week banks only day-4, so the ruled day-5 `isWeekBanked` check never satisfies and Friday advancement no-ops "banking pending" indefinitely (`tournamentAdvancement.js:35-38`). **By design — not a bug.** On any holiday-shortened week, the founder must either bank manually or apply a founder-cited rule change. P9 launch calendar should note upcoming short weeks.

### O2 — Banking → advancement is deferral-coupled (verified composes)
Friday advancement requires day-5 banking (lands ~17:15 ET nightly); the Friday duty fires in the evening UTC window. If banking hasn't landed, advancement defers and re-ticks; Monday runs an advancement catch-up. No action — documented so the first live Friday's "banking pending" logs are understood as normal.

---

## Security-pass agenda (P9 owns; enumerated here so nothing is missed)

1. **🚩 G1 (above)** — deploy the five tournament rules blocks before the flip.
2. **Claim-window enforcement** — server-authoritative: `place-claim.js:65-70` (403 `window_closed`), day-5 cutoff `:101-102`, pending cap **transaction-enforced** (`place-claim.js:125-142` — cap-check + duplicate-check + write share one `runTransaction`, so parallel submissions cannot both land over the cap; claims resolution honors it as a backstop). Flip cap server-enforced inside the flip transaction (`flip.js:150`). Client mirror is display-only (parity-locked).
3. **The WHY projection** — non-owner active reads are concealed **server-side** via `api/tournament/battle-view.js` + the `projectTournamentBattle` allowlist; full WHY at completion. Re-verify the allowlist still covers the doc shape at P9.
4. **Client mutation callers** — the only client writers are `src/services/tournamentActions.js` (`placeClaim`/`flipPick` → authed endpoints); `tournamentGroupService.js` is reads-only by contract. Deploy auth: `decide.js` internal `CRON_SECRET` + ownership assertion (`:129-136`); `TOURNAMENT_ONLY_FIELDS` refused from browser callers (`:46-53`).
5. **Known best-effort gaps** — the eliminated-interstitial localStorage pointer (`roundBoundaryAck.js`) is best-effort by design. (The earlier "advisory claim-cap race" is closed: the placement transaction at `place-claim.js:125-142` makes the cap authoritative — see item 2.) Documented, not a leak.

---

## Canonical-open user-layer capture — deferred items (Phases 1–6, added 2026-07-01)

Reconciliation of the `/code-review` on the canonical-open span. The build is
merge-dark (`LEAGUE_CANONICAL_OPEN_CAPTURE` still `false`); these are the
low-severity findings + carried fast-follows acknowledged as launch-safe, plus
one item the founder must decide before the prod flag walk.

### W7 — #1 close-out lost-points corner — ✅ RESOLVED (bounded fresh-open fallback)
~~A canonical-round leg with a **real** baseline (e.g. an in-hours flip settled before the first sweep captured its symbol) that later closes while the market is **closed** banks nothing and stays bank-pending.~~
- **Founder decision (2026-07-01):** implement the **bounded fresh-open fallback**. In the close-out (`api/_utils/tournamentBanking.js`), a leg with a real, **non-canonical** baseline (`baselineSource !== canonical_open_capture`) whose symbol has **no snapshot** now closes at the day's fresh `open`, exactly as legacy did — recovering its realized P&L. A canonical-CAPTURED leg always has a snapshot, so a captured baseline can never bank against a re-fetch; a null-baseline void leg is skipped. Tested: recovers the P&L, byte-for-byte equal to legacy for this close-out, and a captured leg still closes at its frozen snapshot (fallback does not leak). Closed.

### W8 — #8 settlement tag dropped in the points headline view
`src/components/League/battleArena/StarCell.jsx` emits the est/banked tag + dashed underline only in the `mult` headline branch; toggling the arena to `pts` view keeps the settlement caption but drops the tag/underline.
- **Launch-safe:** user stars render `mult` by default. **Fix when triggered:** also emit the tag/underline in the `pts` branch.

### W9 — #9 close-only claim guard is HTTP-layer only (defense-in-depth)
The canonical in-hours claim guard lives in `api/tournament/place-claim.js`; the shared placement core and the CPU path (`api/_utils/tournamentCpuClaims.js`) carry no canonical guard.
- **Launch-safe:** the prod CPU host fires after the close (guard would no-op); the only in-hours CPU trigger is admin/training/preview-only.
- **Fix when triggered:** move the guard into the shared placement core so every caller inherits it (pairs with the batch-resolver item in W12).

### W10 — #10/#11 the sweep is unconditional cron work (not byte-identical flag-off)
`api/cron/agent-evaluate.js:153` runs the sweep every open arm regardless of the flag (an extra `fetchEligibleGroupsByStatus` query + a `canonicalOpenSweep` response field); flag-off it filters to zero canonical rounds (no writes), flag-on it can consume up to ~15s of the cron's 50s agent-battle budget.
- **Launch-safe:** no functional impact flag-off; no 60s breach flag-on.
- **Watch after the flip:** agent-evaluate deferral rate; if material, run the sweep after the battle loop or on its own budget.

### W11 — smaller nits (docketed, no action at V1)
- **#12** sweep `captured`/`pending` summary counts are per-leg not per-symbol (`canonicalOpenSweep.js`) — telemetry inflation only, no settlement impact.
- **#13** `createLeg` does not enum-validate the new `captureState` (`leagueTournament.js`) — latent; no caller passes a non-null value.
- **#15** `buildArenaModel.js:105` `toLocaleDateString('en-CA')` diverges from the codebase's `Intl.formatToParts` ET-date idiom — byte-identical in the full-ICU browser target; small-ICU only. (#14 provenance-comment accuracy was corrected in this pass — no longer outstanding.)

### W12 — carried fast-follows from the build
- **Flag-1 fast-follow:** `official` cards showing the literal banked figure (a meter data-source switch); the shipped `official` uses the live/frozen multiplier with official chrome, the banked figure living in standings.
- **Batch-resolver defense-in-depth:** a market-state guard on `api/_utils/tournamentClaims.js:235` (the null-baseline leg creator) — currently schedule-protected (runs ~9:25am ET, before the open). Pairs with W9.
- **2026 NYSE holiday / early-close list:** annual maintenance of the year-list used by `isMarketHoliday`/`isEarlyCloseDay`.
- **Two pre-existing suite failures** (separate tasking, not caused by this build): `buildArenaModel` ask-chips flag-off (`LEAGUE_AGENT_CHAT_ENABLED` on in tests) and `ruleConflictReconciler` DETECT/INJECT flag-default-off.

---

## Out-of-build pointers (NOT tournament items — separate tickets)

### X1 — 🎫 [HIGH] Live training-game short scoring (separate ticket, founder-opened)
`BaggerBombTrainingBattleViewV4.jsx:396-420` carries the **same** short double-negation that P8 fixed in `AgentBattleScreen` (ledger item 1) — pre-negate at `:396-398`/`:406-408`, then forward `direction` to `calculateAssetScoreV3` at `:417`. Unlike AgentBattleScreen (long-only agents → dormant), **users can select crypto shorts** in the training game (`AssetPickerModal.jsx:155`), so this may be a **live scoring sign-flip**. This is a shipped-game correctness bug, **not** a tournament-build item. Founder is opening a separate ticket: verify reachability, then apply the same fix (call the scorer without `direction`). (`BaggerBombTrainingBattleViewV3.jsx` is unaffected — no such code.)

### X2 — [LOW] `seed-tournament-group.js` pool floor re-confirm (dev-only)
P3b flagged a 12-vs-15 floor mismatch in the dev group seeder; P5 reported fixing seed floors. Dev/admin endpoint only (no production risk). Worth a one-line re-confirmation in a future tidy pass; not actioned.

### X3 — Cron overhead pass (2026-07-04) — deferred cron-infra items
From the read-only cron audit (30 LIVE · 2 DEAD, 38/40). This pass **removed** the phantom `read-across-check` entry (no handler file existed — 404 every fire) and **merged** `pre-market-warmup` into `process-draft-claims` (they shared the `25 13,14` schedule), reclaiming **2 slots → 36/40**. Four items were deliberately deferred, not actioned:
- **Season Mode decommission** — superseded by the League; `api/cron/season-daily-evaluate.js` / `api/cron/season-pit-stop-manage.js` exist and are **still referenced by live code** (`api/season/log-lockin.js:7`, `api/season/create-entry.js:25,123`, `src/components/Season/PitStopLockInBar.jsx:8`) but are **unscheduled** in `vercel.json` (intentionally not running; consume 0 slots). Candidate for a **full, scoped decommission pass** — trace every live reference before removing; do **not** fold into cron work.
- **Nightly scoring triad merge** — `baggerbomb-v4-daily-scores` + `compute-daily-baggerbomb-levels` + `agent-daily-scores` (documented order 01:15 → 01:30 → 01:45): **mergeable only via a behavior-preserving core-extraction refactor of banking routes; worth 2 slots; do as a scoped pass under slot pressure, not opportunistically.** (All three are monolithic `export default handler` routes with no extractable core; `agent-daily-scores` calls fenced scorers — read/call only, never edit. A merge needs `/code-review`, an explicit run-order assertion, and a `maxDuration`/timeout check for three sequential EODHD+Firestore orchestrations in one invocation.)
- **`compute-briefs`** — parked pre-provisioning for the `/api/stocks/analysis` route (Phase 2C), which has **no live caller** (`api/_utils/stockBriefService.js:5` self-annotates "Phase 2C, future"). **Kept deliberately** — one-slot gain not worth the blast radius; the manual admin twin `api/admin/generate-briefs.js:142` can regenerate `stockBriefs` on demand. Revisit if the Phase-2C analysis feature is confirmed dead.
- **`pre-market-warmup` dead price-warm half** — **stripped in this pass (intentional).** It wrote a per-serverless-instance in-memory cache invisible to `api/stocks/prices`, keyed per-symbol vs that route's composite key, so it never served a live read. The load-bearing half (FantasyTimes consensus seeding via `seedConsensus`/`flushExpiredCatalysts`) was preserved by folding it into `process-draft-claims` under an `isPreMarketWindow()` guard.

### X4 — 🎫 [MED] `snake-draft-autopick` 500 Fatal — DIAGNOSED (missing composite index); pod-starvation link REFUTED (2026-07-22, diagnosed 2026-07-23)
Observed in production during the **Training-Pod P0 R1 verification** (~09:40–09:45 UTC window, 2026-07-22, founder dashboard): `/api/cron/snake-draft-autopick` (`vercel.json:30`, `*/10 * * * *`) threw a **500 Fatal error during autopick**. **Originally flagged as a candidate root cause for the creation-side pod starvation** the Training-Pod P0 surfaced (advancement machinery + orchestrator healthy, yet ~zero pods enter the pipeline). NOT a Training-Pod P0 branch item.
- **DIAGNOSIS (RESOLVED — read-only discovery `claude/snake-draft-autopick-500-discovery`, 2026-07-23):** the Fatal is a **missing Firestore composite index** — `drafts (status ASC, startedAt ASC)`, required by the stale-cancel query at `api/cron/snake-draft-autopick.js:395-398` (`.where('status','==','active').where('startedAt','<',staleThreshold)`) — that is **never declared** in `firestore.indexes.json`. Equality + inequality on different fields → `FAILED_PRECONDITION`, propagated to the top-level catch (`:477-487`) → 500. The sibling query at `:386-389` (`status`+`pickDeadline`) succeeds because **its** composite IS declared (`firestore.indexes.json:100-113`).
- **Provenance:** introduced by **PR #580 / merge `26327394`, 2026-07-10 ~22:50 UTC** — the SAME PR that added the query pair AND the `(status, pickDeadline)` composite, but **forgot** the `(status, startedAt)` twin. `git log -S'startedAt' -- firestore.indexes.json` returns **empty** (the field has never appeared in the index manifest's history). Latent since ship.
- **Frequency:** **every run, deterministic** — no early return precedes the stale query (`:391` logs, `:394` computes the threshold), and a missing-index error is structural (throws even with zero active/stale drafts). 100% of invocations 500; the cron cannot complete a single run.
- **Pod-starvation link — REFUTED:** `snake-draft-autopick` operates **only** on `db.collection('drafts')` (the legacy client-created snake-draft game; `src/hooks/useDraft.js:326 createDraft`). It never reads/writes `tournamentGroups` (tournament pods) or `agentBattles` (mastery corpus), and imports no orchestrator/group module; on completion it flips `status:'battle'` on the **draft doc itself**, creating no pod/group/agentBattle. A failed autopick **cannot** abort tournament pod/group creation. The orchestrator's "zero groups" is `tournamentGroups` creation-side and disjoint from this cron. **This is a real but separate legacy-game bug.** (Full report: scratchpad `SNAKE_DRAFT_AUTOPICK_500_DISCOVERY.md`.)
- **PROCESS NOTE (repeatable):** **every new Firestore query that combines equality + inequality (or equality + orderBy) on different fields needs a matching composite declaration added to `firestore.indexes.json` in the same change** — add an index-declaration check to code review for new/changed queries. PR #580 shipped one composite and missed its twin in the same file.
- **FIX ON HOLD — founder call pending:** the fix is one index declaration + `firebase deploy --only firestore:indexes`, BUT held pending a founder decision on whether **legacy PvP stays live**: fix the one line **vs.** retire the cron and reclaim a cron slot (**37/40**). Do not apply until ruled.
- **Disposition:** diagnosed, refuted as a starvation cause; **fix held for founder go/no-go** (fix-one-line vs. retire-and-reclaim-slot).

### X5 — [MED] `fantasytimes/ingest-econ` 500 (2026-07-22)
Observed in the same verification window (~09:40–09:45 UTC, 2026-07-22): `/api/fantasytimes/ingest-econ` (`vercel.json:119`) returned a **500**. Unrelated to the Training-Pod P0 branch and with no known tournament-surface impact; recorded here so it is not lost.
- **Next step (separate ticket):** inspect the failing invocation's logs / the ingest source; triage independently.
- **Disposition:** separate ticket, founder-flagged; not actioned on the P0 branch.

---

## Entry-Flow Consolidation triage (2026-07-18, founder-ruled)

From the consolidation build's `/code-review` (findings verbatim in the build
report; fixed items — the training-block, release-navigation, guard-placement,
kill-switch, and CTA-label findings — are in the branch and not ledgered here).

### 🚩 E1 — PRE-BRACKET GATE: eliminated players lose the round-boundary route
The `MyGameBar` gate (`onOpenMyGame && activeGroup`) is the redesign's only
non-claim door into `LeagueParticipantView`, whose `RoundBoundaryView` branch
exists precisely for `group === null` (localStorage `bracketGameId` recovery).
`selectMyGroup` excludes COMPLETE, so an ELIMINATED (or champion-terminal)
bracket player has no route to their "you're eliminated / champion"
acknowledgment; advancers self-heal (their next FORMING group re-shows the bar).
- **Launch-safe today:** nothing triggers it — no bracket is live and base-layer
  groups carry no `bracketGameId`.
- **Trigger (a GATE, not a watch):** **before the first bracket season locks**,
  this must be resolved — the regression arms now and bites when a bracket round
  completes.
- **Fix shapes (founder to pick at the pre-bracket pass):** widen the bar gate
  with the remembered `bracketGameId` (`activeGroup || getRememberedBracketGameId()`),
  or add a dedicated result-pending affordance in the lobby.

### E2 — Regular-side battle-week model (closes the guard's regular-vs-regular hole)
`formGroupFromLobby` stamps `baseLayerWeek = isoWeekString(now)` (formation
week) while the guards key on the battle week — so regular-vs-regular
same-battle-week double entry passes both guards (pre-existing; the consolidation's
mirror guard reliably catches slot pods, its specced target), the freshly formed
regular group files itself under the formation-week cohort (the pre-registered
"Quick Play cohort-week quirk"), and Monday 09:30–12:00 ET formations sit in a
residual mis-key window (the guard's 9:30 Monday cutoff vs the pipeline's
ET-noon resolution deadline).
- **Trigger:** before slot + regular entries coexist at real scale, or with the
  first user-visible cohort/leaderboard mis-filing.
- **Fix (its own task, per the build-spec ledger):** migrate the regular write
  site to a battle-week `baseLayerWeek` (aligning the cohort key with the
  pipeline's actual resolution Monday), then the guard hole and the residual
  window close together. Touches the regular formation path; needs its own tests.

### E3 — Entry-flow hygiene set (behavior-neutral, one small follow-up task)
Verified-real, behavior-neutral cleanups deferred from the consolidation:
one shared `useMyGroup(uid)` hook for the byte-duplicated `activeGroup`
subscription (which also doubles the same member query `subscribeMyTrainingPod`
already streams); `AutoDraftFallback` onto the tested `tournamentActionMachine`
lifecycle; Spectate's `onEnter` (now dead-equal to `onBack`) collapsed; the
four-site `MyGameBar` gate and the `BracketFunnelSection` pass-through each
into one place; SlotCenter's footnote onto the `Eyebrow` atom; the guard's
per-human queries under `Promise.all`; a drift note on the hand-maintained
`PICKER_TOKENS` map. Also accepted as-is (founder ruling): the in-game user's
brief picker flash + one uncached slot-schedule read per lobby visit
(at-precedent with the training-pod subscription; "fixing" it would trade away
the SSR smoke coverage of the no-game center).

### E4 — Two stale-flag test failures on main (separate small task)
`liveDraftFormation.test.js` ("first claim… stamped self-sufficiently", asserts
`baselinePolicy` absent) and the `liveDraftLifecycle.e2e` capstone fail on clean
main: `LEAGUE_CANONICAL_OPEN_CAPTURE` was flipped `true` without updating their
flag-off expectations. Verified pre-existing by stash-run at the consolidation
base. Fix: update the two assertions to the flag-on expectation (accounts for
the known-baseline drift: 47 files/6 tests → 49/8).

---

## G2 non-fenced mitigation pass — carried items (2026-07-20)

From the G2 fix-spec (non-fenced items shipped; discovery at `docs/audits/20260720_G2_ACTIVEBATTLEID_CONFLICT_DISCOVERY.md`). The fenced integrity fix is recorded on the **G2** entry above.

### G2-a — Dangling `activeBattleId` pointer (Phase 0 read-only finding; self-heals — watch, not blocking)
If `createAgentBattle` throws mid-deploy **after** the deploy has already marked a prior *expired* battle `completed` (`decide.js:588-592` legacy / `:1115-1119` prescribed), the handler's top-level catch clears only `deployingAt`, **not** `activeBattleId` (`decide.js:747-760`) — leaving the agent pointed at a now-`completed` battle. The eval-cron clearers fire only for `status=='active'` battles (`findActiveAgentBattles`, `agentBattleService.js:31-38`; clears at `agent-evaluate.js:3595`/`:3625`), so **the cron never reaps it.**
- **Why it's launch-safe (NOT a permanent lockout):** neither the server deploy nor the client CTA gates on `activeBattleId` — both key on the agentBattles **collection** (`decide.js:535-539`/`:1091-1095`; client `isLive` from the `status=='active'` listener, `App.jsx:3872-3874`). So the **next deploy self-heals** the pointer (finds nothing active → creates a battle → overwrites the pointer at `:700`/`:1164`), and the orchestrator re-deploys competitive agents Tue–Fri regardless. Bounded harm: the customization/equip endpoints (`equip-lean.js:115` + siblings) falsely report `battle_active` until that next deploy.
- **Trigger / escalate:** a future change that makes a deploy path gate on `activeBattleId` (removing the self-heal), or a report of a stuck "in battle" agent that a re-deploy does not clear.
- **Reaper (if wanted):** **non-fenced** — a sweep in `api/cron/agent-evaluate.js` clearing an `activeBattleId` whose referenced battle is missing or not `status=='active'`. Must NOT live in `decide.js` (fenced).

### G2-b — Stale comment: "AWAITING_OPEN is training-only" (doc imprecision, no behavior impact)
`tournamentOrchestrator.js:893-899` comments that the awaiting-open flip is training-only. The authoritative `flipAwaitingOpenPods` header contradicts it: it deliberately does **not** filter `isTraining`, so it flips **both** training pods AND competitive slot pods ("do NOT add an isTraining filter, or slot pods would strand in AWAITING_OPEN forever" — `trainingLifecycle.js:554-572`, esp. `:555-559`). Competitive pods do use AWAITING_OPEN (lifecycle `liveDraftFormation.js:256-258`).
- **Disposition:** comment-only imprecision — same stale-comment class corrected in the live-draft build. Fix in a housekeeping pass; do not churn the file for a comment alone.

---

*Maintained as current state (like `BUILD_RULES.md`). When an item's trigger fires and it is resolved, strike it here in the same PR with the founder decision cited.*
