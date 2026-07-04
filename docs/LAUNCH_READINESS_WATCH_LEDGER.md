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

---

*Maintained as current state (like `BUILD_RULES.md`). When an item's trigger fires and it is resolved, strike it here in the same PR with the founder decision cited.*
