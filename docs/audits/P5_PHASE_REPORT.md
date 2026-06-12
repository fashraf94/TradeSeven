# P5 — Draft Systems: Phase Report (Playback Theater · Board-Commit Surface · Deadline Auto-Commit)

**Phase:** P5 (Spec §4; first user-facing phase)
**Branch:** `claude/dreamy-carson-nqrf2h` · cut from `main` @ `0e714dd` (= origin/main, PR #491) · tip `e88e3c9`
**Date:** June 12, 2026
**Stage 0 artifact:** `P5_STAGE0_REPORT.md` (delivered this session; proposals A/B/C ratified as proposed; B's deadline = pipeline encounter, founder-ratified; four build notes; one scope addition — the seeder pool floor).
**Commits:** 7 (docs housekeeping · auto-commit · playback layer · theater · surface · smoke script · code-review fixes), committer-identity signed, suite green at every commit.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | All three deliverables landed? | **YES** — playback theater (two acts, one component, real dev-group streams), board-commit surface (real flow in the flagged tab, P1a service called unchanged), deadline auto-commit (server prefill twin, Monday-duty integration, flag + feed entry, floor). |
| 2 | The docketed pre-launch requirement closed? | **YES** — the uncommitted-board defer is gone; the Monday pipeline auto-commits at the encounter and proceeds in the same tick. The loud defer survives only as the fallback when auto-commit cannot produce a valid board. |
| 3 | Zero fence contact? | **YES** — no fenced file edited; no fenced export is called by any new P5 code (the floor uses non-fenced `archetypeScoring.js`). Fence-grep proof rides the PR. |
| 4 | Zero new cron entries? | **YES** — 38/40 untouched; the auto-commit rides the existing Monday duty. |
| 5 | Riders honored? | **YES** — rider #1 fires on auto-commits through the same `buildBoardCommit` core, stamped `autoCommitted: true`, with the feed entry in ONE awaited transaction (no fire-and-forget anywhere). |
| 6 | All new UI behind `TOURNAMENT_TAB_ENABLED`, tokens-native? | **YES** — League tab content flag-gated (flag stays false); zero `HOLO_COLORS` imports; founder note 4 (siblings in motion, not in palette) executed; BoardEditor's stray hex cleaned to tokens. |
| 7 | Founder build notes 1–4? | **ALL HONORED** — every new motion gates on `useReducedMotion` (the DataStrike posture); the viewer's seats carry the teal you-highlight (stage, log, end card); the my-group index is flag-don't-improvise (recorded in code comment + §6); S3 ratified as written. |
| 8 | `/code-review` (mandatory at 23 files / ~2.4k lines)? | **RUN** — 7 angles, 19 verified candidates → 6 fixed, rest dispositioned (§5). |
| 9 | Tests | **2,568 passing** (2,525 at P4 + 43 new across five batteries); client build clean; lint delta = baseline classes only (§6). |
| 10 | Housekeeping commit? | **DONE** — P4 pair `git mv`'d (R100, identical blobs); P3 trio added byte-exact from founder-supplied originals (sha256-verified); README table updated. |

## 2. What the founder should know in three sentences

Monday now has its show: the playback theater replays both drafts pick-by-pick at the tuning-ledger 5-second clock — snipes name who took what and when, the double-down gets its purple moment, fallbacks stay honest — and it runs today on the dev group's real P4-smoke streams from the dev screen. The board flow is real: prefill → curate → a confirmation that states the lock semantics plainly → commit through the unchanged P1a endpoint, with re-commit until the draft runs, all living in the League tab that stays invisible until P9. And the launch blocker is closed: a player who never commits gets their suggested board auto-committed at the first Monday tick (flagged for the signal corpus, announced in the group feed, floored from their agent's taste when they have no watchlist), and the group's Monday proceeds instead of stalling.

## 3. The deliverables (file:line at tip `e88e3c9`)

**Deadline auto-commit (closes the docketed pre-launch requirement).**
- `src/utils/boardPrefillCore.js` (new, zero-import): the ONE prefill core — equipped-first merge, dedupe, **∩ userPool** (previously living only in the BoardEditor consumer — the fork risk Stage 0 flagged as S4), depth slice, and the generalized floor (`padBoardToFloor`).
- `api/_utils/tournamentBoardAutoCommit.js` (new): `deriveServerBoardPrefill` (the Admin-SDK twin, mirrored field-for-field with the client — equivalence battery + a static wiring guard lock the no-forks contract) and `autoCommitMissingBoards` (per missing member: derive → floor (LOUD, lazily-read rankings) → `buildBoardCommit` → one transaction writing the flagged board doc + the `board_auto_commit` feed entry, capped by the new shared `GROUP_FEED_CAP`). Idempotent; a player commit landing in the race window WINS and is counted `raced`, never `autoCommitted`.
- `api/_utils/tournamentOrchestrator.js`: the finding-#5 catch now heals (auto-commit → same-tick resolution retry via the shared `resolveUserDraftAndRefresh`); the loud defer is the fallback only; summary gains `autoCommitted`; `isDutySatisfied` semantics unchanged.
- Client convergence: `assembleBoardPrefill(uid, { userPool })` and BoardEditor both route through the core.
- **Founder scope addition executed with one nuance (§4):** the seeder pool floor.

**Playback theater.**
- `src/utils/draftPlayback.js` (new, zero-import): one parser for both streams (the P3a parity, re-verified at Stage 0), snipe attribution (same-market taker with pick number · rival-user-pick cross-layer block per Spec §1.3 · honest `unavailable`), double-down detection, and the clock-free `playbackReducer` (play/pause/TICK/SCRUB/skip/SEED).
- `src/components/Tournament/DraftPlaybackTheater.jsx` (new): poster → staged reveals → final-rosters end card; act banner with the agents' stance lines; native range-input scrub (gesture-correct on mobile, no custom gesture code); `PLAYBACK_MS_PER_PICK` consumed from the tuning ledger (it already existed — Stage 0 surprise S1).
- New client reads (`tournamentGroupService.js`): `subscribeUserDraftStream`, `subscribeOwnBoard`, `subscribeMyGroup`; `USER_DRAFT_STREAM_DOC_ID` added to the schema module (additive; P1a literals untouched per the SYNC WARNING).

**Board-commit surface.**
- `BoardEditor.jsx`: confirmation sheet (lock semantics stated before the rider-#1 write); `initialBoard`/`initialPrefill` seed the re-commit path from the committed board while carrying the ORIGINAL prefill snapshot (the delta keeps measuring against the suggestion).
- `src/components/Tournament/BoardCommitFlow.jsx` (new): committed-state display — ranked list, committedAt, the **auto-committed badge** with an edit nudge while forming, locked copy after.
- `src/screens/LeagueScreen.jsx`: the placeholder becomes the tournament home (forming → board flow; battle → theater + locked board + group feed). The dev-screen commit button remains for smoke.

## 4. The seeder floor — executed with a flagged nuance

The founder pulled the P3b-reported one-liner into P5 as "12 → BOARD_DEPTH_MIN". Executed at `api/admin/seed-tournament-group.js` — but **BOARD_DEPTH_MIN (15) alone still under-guards**: the placeholder boards are *staggered* slices (`userPool.slice(i*3, i*3+15)`), so the third placeholder needs **21** pool names (a 15-name pool leaves its slice at 12 and the endpoint 500s anyway). The guard therefore covers the real precondition: `SEED_POOL_FLOOR = BOARD_DEPTH_MIN + 2×PICKS_PER_PLAYER = 21` when seeding boards; boardless seeding keeps resolution's floor (12). One test locks the deepest slice at exactly-floor pools. This honors the instruction's intent (seeded pools satisfy the commit floor) rather than its literal value — flagged here for ratification by merge.

## 5. Code review (mandatory; 7 finder angles → 19 verified candidates)

**Fixed in `e88e3c9`:**

| Finding | Fix |
|---|---|
| A race-window player commit was counted as `committed`, letting the duty summary's `autoCommitted` over-count defaulted boards | `raced` counted apart; the retry gates on `covered = committed + raced`; the corpus signal (flag + feed) was already honest and is now matched by the log/summary. |
| The theater's running pick log rendered beneath the end card (a dead `+ 1` in the condition) | `showEndCard` computed once; the log rides under the stage only. |
| `stockRankings` was read even when no member needed the floor | Lazy read — only the first short prefill pays the I/O. |
| The orchestrator's resolve+fresh-read block was duplicated across the straight path and the retry | Extracted `resolveUserDraftAndRefresh` — one body, no drift. |
| The feed cap lived as my local constant AND flip.js's inline `slice(-50)` | `GROUP_FEED_CAP` in the schema module; both writers converge. |
| `isDutySatisfied` test fixture lacked the new summary field | `autoCommitted: 0` added. |

**Refuted (with the disproving mechanism):** `timeline.acts[0]/[1]` unsafe access (both acts are constructed unconditionally by `buildPlaybackTimeline`); act-2 actor mislabeling (`actorLabel` appends "'s agent" on act 2 by construction); `auto.floored` undefined in the log (the summary always initializes it); the feed-write race across concurrent auto-commits (each per-member transaction reads the feed fresh in-tx; Firestore serializes contending transactions; the board-existence check makes losers no-ops); stale `group.players` in the theater (both mount points pass a live-subscription group); the seeder-vs-production floor "inconsistency" (different endpoints guard their own preconditions — the seeder its staggered slices, the pipeline its commit floor).

**Accepted costs (documented, not changed):** the three symbol cleaners (`cleanSymbols` / `extractTickerSymbols` / `normalizeSymbols`) have deliberately different contracts — the twin-equivalence requirement pins `cleanSymbols` to the client's permissive semantics; the server prefill reads mirror the client's BY DESIGN (the twin — drift is locked out by the shared core + wiring guard, not by sharing I/O code across SDKs); the in-memory Firestore fake is per-battery by house precedent; the timeline memo keyed on the live `group` object recomputes per snapshot (36-event rebuild, negligible; noted for P7's bigger surfaces); `resolveUserDraftForGroup` keeps its summary return shape (changing it touches the P1a endpoint contract for one saved read); `autoCommitted` stays a writer-side spread per the seeder's `seeded: true` precedent (the rider core stays flag-agnostic).

## 6. Known edges + notes for the founder

- **Lint baseline:** one `no-unused-vars` flag on the theater's `motion` import is baseline-class — the eslint config doesn't connect JSX member expressions (`<motion.div>`) to imports; `DataStrike.jsx` carries the identical pre-existing error. The orchestrator's `process` flags predate P5 (untouched lines). Zero new fixable problems.
- **My-group Firestore index:** `subscribeMyGroup` uses one `array-contains` filter with client-side status filtering precisely to avoid a composite index. If the console still prompts during smoke, the report path is: flag it, founder deploys the index from the console prompt — never improvised from a session (founder note 3, honored in code comment and here).
- **League tab on-flag smoke rides P9** — the flag stays false; P5's smokable surfaces are the dev-screen cards (steps 15–17).
- **Crons don't run on preview** (BUILD_RULES §6): the auto-commit was exercised through `run-duty` + unit/integration batteries; the first production Monday with a real uncommitted board is the live observation point. Nothing here is claimed "preview-tested" as a cron.
- The grace-tick alternative to the ratified deadline remains a one-line ET-time guard in `tournamentBoardAutoCommit.js` if ever wanted (rejection rationale recorded in the PR).

## 7. Founder smoke script (Vercel preview; dev screen header steps 15–17)

**15 — Playback:** attach the P4-smoke group; the Playback theater card opens on the poster; play → both acts at the 5s clock (snipes, double-down chip, fallbacks); pause/scrub/skip; teal you-highlight on your seats.
**16 — Surface:** on a forming group, commit through the new confirmation flow; rider-#1 doc lands exactly as before; re-commit while forming.
**17 — Auto-commit:** **use the BRACKET seeder** (the unambiguous choice the founder asked confirmed: its CPU seats are real B1 agents with boards committed at seed, so the founder's seat is the only one owed — the group seeder's placeholders have no agent docs and refuse at the synthetic-board step by design, never reaching a full Monday). Don't commit your board; run the Monday duty on the dev clock → `autoCommitted: 1` in the duty summary, the flagged board doc (+ `floored` if you carry no equipped watchlist), the `board_auto_commit` feed entry, and the pipeline proceeding to the full Monday (both drafts, 24 held, live deploys). Re-click: `already_complete`, no duplicate feed entry.

## 8. Housekeeping commit (`54f919f`)

`git mv` (R100, identical blob SHAs — the no-content-edit proof): `2026-06-12_P4_PHASE_REPORT.md`, `2026-06-12_P4_STAGE0_FENCE_EDIT_MAP.md`. Added byte-exact from founder-supplied session uploads (sha256-verified; the P3 trio never landed on GitHub — the founder confirmed the upload didn't happen): `2026-06-12_P3_STAGE0_DISCOVERY_REPORT.md`, `2026-06-12_P3A_PHASE_REPORT.md`, `2026-06-12_P3B_PHASE_REPORT.md`. `docs/README.md` table updated (the sanctioned-edit exception), provenance noted per row.

## 9. Out-of-task observations (report, don't fix — BUILD_RULES §3)

None new this phase. (The P3b-reported seeder floor was founder-pulled INTO P5 scope and is executed, §4.)
