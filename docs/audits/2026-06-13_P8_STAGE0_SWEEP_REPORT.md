# P8 — Stage 0: Integration Sweep · Hygiene Ledger Triage · Catalog #9 Ruling Request

**Phase:** P8 (integration sweep + hygiene ledger). **Stage 0 = read-only discovery → HARD STOP.**
**Branch:** `claude/sharp-clarke-lztgcb` · **HEAD:** `9e05b51844b462830cf65b3109dabf6d07cedb55` (= origin/main `9e05b51`, post-P7-B+C/PR #501) · **tree:** clean.
**Date:** 2026-06-13.
**Repo state:** shallow clone (`git rev-parse --is-shallow-repository` = true). No history deepening was needed for this sweep; none performed (BUILD_RULES §3 preamble).
**Posture:** zero writes to project state. Every claim below carries a `file:line` + VERIFIED (read at HEAD this session) / ASSUMED marker.

---

## 0. Executive verdict (read this first)

| # | Question P8 must answer | Verdict |
|---|---|---|
| **A** | **Do the eight phases compose? Any producer/consumer seam mismatch?** | **NO MISMATCH FOUND.** All 11 traced seams agree field-for-field; the one place a mismatch could hide (the `gameMode` string) is a single aliased constant, test-locked. The system is integrated, not eight islands. |
| B | Flag-flip blast radius mapped for P9? | **YES** — `TOURNAMENT_TAB_ENABLED` (client, still `false`) is the only launch flip; `TOURNAMENT_DEPLOY_ENABLED` is **already `true`** (flipped at P4). Map in §2. One P9 gate: the firestore.rules must be Console-deployed before the flip. |
| C | Dev/prod boundary holds at every production duty? | **YES** — `isDev` exclusion + `dev-` namespacing verified at every writer; no laundering path found. §3. |
| D | Idempotency composes under the real cron cadence? | **YES** — two-grain markers + `sim:` isolation + per-entity natural guards; the banking→advancement cross-cron timing is handled by the deferral pattern. §4. |
| E | Hygiene ledger items 1–7 triaged with dispositions? | **YES** — §5. 1 fix-now (correctness), 1 clean-converge, 1 ride-the-write (catalog #9), the rest document-and-watch. |
| F | A NEW finding outside P8 scope? | **YES — potential LIVE scoring bug.** The same short double-negation as ledger item 1 also sits in `BaggerBombTrainingBattleViewV4.jsx`, where users **can** select crypto shorts. Report-for-separate-tasking (BUILD_RULES §3). §5.1 + §7. |

**The one sentence for the founder:** the League composes cleanly end-to-end with no broken handoffs — so P8 is the small, confident pass it was meant to be (one real correctness fix, one tidy convergence, the ninth signal capture, and a written watch-list for P9), plus one bug we found *next door* in the live training game that deserves its own ticket.

---

## 1. THE INTEGRATION SWEEP — the seam map (core deliverable)

The full weekly lifecycle, traced as one trace. Each row is a producer→consumer handoff with the **field written = field read** confirmed on both sides at HEAD.

### 1.1 The Monday pipeline → deploy → engine chain

| Seam | Producer (writes) | Consumer (reads) | Verdict |
|---|---|---|---|
| Agent boards → agent draft | `tournamentAgentBoards.js:398` writes to `collection(AGENT_BOARDS_SUBCOLLECTION)` | `tournamentAgentDraft.js:220` reads `collection(AGENT_BOARDS_SUBCOLLECTION).get()` | **MATCH** (same constant `'agentBoards'`, schema `:42`) |
| Agent draft → Monday prescribed-six | `tournamentAgentDraft.js:202` writes stream `{picksByAgent, events}` to `STREAMS/agentDraft` | `tournamentOrchestrator.js:389-407 seatsFromDraftStream` reads `stream.picksByAgent` + `stream.events[].agentId/odUserId` | **MATCH** |
| Orchestrator deploy → engine route | `buildDeployRequest` (`tournamentOrchestrator.js:220-240`) sends `gameMode: TOURNAMENT_GAME_MODE`, `prescribedPortfolio`, `groupId`, `ownerOdUserId`, `isCpu`, rider-#6 fields | `decide.js:195` routes `if (req.body.gameMode === FLAT6_GAME_MODE)`; `TOURNAMENT_ONLY_FIELDS` (`:46-53`) is exactly that payload | **MATCH — see §1.5 (the critical alias)** |
| decide.js → battle doc joint stamp | `decide.js:1107-1109` (`runPrescribedTournamentDeploy`) → `createAgentBattle` (`agentBattleService.js:102-106`) stamps `gameMode` + `groupId` (+`isCpu`) | downstream filters (banking/reconcile/incumbent) | **MATCH** (joint-stamp contract, hard-errors on half-stamp: `agentBattleService.js:65-66`, `decide.js:993-995`) |
| Tue–Fri incumbent fan-out | reads latest battle's `portfolio` via fenced `flattenPortfolioServer` (`tournamentOrchestrator.js:598`) | `latestTournamentBattlesByAgent:278-293` re-checks `gameMode===TOURNAMENT_GAME_MODE` in memory | **MATCH** (a stray stamp can't leak a casual battle) |

### 1.2 The nightly banking → composite → aggregation chain

| Seam | Producer | Consumer | Verdict |
|---|---|---|---|
| Agent score read | `createAgentBattle` stamps `groupId`+`gameMode` | `fetchGroupAgentScores` (`tournamentBanking.js:56-83`) queries `agentBattles.where(groupId).select('gameMode','ownerId','scoreState.currentScore')`, re-checks `gameMode` | **MATCH** |
| Banking → composite snapshot | `computeBankingUpdate:245-253` writes `closeScores[uid] = {totalPoints, picks, agentPoints, compositePoints}` (+`agentScoresCarried` on degrade `:271-273`) | `getWeeklyScore` (`leagueTournament.js:684` reads `.totalPoints`), `getWeeklyComposite` (`:697` reads `.compositePoints`), `isFinalSnapshotDegraded` (`:720` reads `.agentScoresCarried`) | **MATCH** |
| Composite math home | `computeComposite` (`leagueTournament.js:373`) = `agentPoints + K×userPoints` | banking `:252`, `getWeeklyComposite` `:698` | **ONE HOME** (k=`USER_LAYER_K`) |
| Nightly branch order | `snake-draft-daily-scores.js`: banking `:478` → reconcile `:494` (threads `heldByGroup`) → leaderboard `:511` (consumes it) | each in its own try/catch (`:477/493/510`); reconcile failure ⇒ `heldByGroup={}` ⇒ feeds degrade, no cascade | **FIRE-WALLED, ordered** |

### 1.3 The Friday advancement → bracket → side-effects → round-boundary chain

| Seam | Producer | Consumer | Verdict |
|---|---|---|---|
| Lock → bracket game entry | `lockTopTwo:94-104` → `advanceCohort:570-582` writes `rounds.{rk}.games.{gid}.{advancers, finalScores (composite), finalUserScores, completedAt}` | — | — |
| Bracket entry → career rank | (above) | `applyLockedGameToRanks` (`tournamentRank.js:129-152`) reads `entry.finalScores/seats/advancers/groupId`; completeness-guarded `:138-142` | **MATCH** |
| Bracket entry → leaderboard final | `runWeekSideEffects:419-436` calls `upsertLeaderboardForGroups([group])` | `buildGroupWeekRows` reads group `dailyScores` via `getWeeklyComposite/Score` | **MATCH** |
| Side-effects completion gate | `stampEntrySideEffects:444-450` writes `sideEffectsAt` after BOTH halves clean | sweep `:345` + champion gate `:653` key on its absence | **MATCH** (no orphan window) |
| Bracket → round-boundary UI | `createBracketDoc:231` writes `totalRounds`; advancement writes `champion`/`recap`/game `finalScores`/`advancers`/`completedAt`/`seats` | `roundBoundary.js resolveRoundBoundary` reads `game.advancers/finalScores/seats/completedAt`, `bracket.champion.odUserId/totalRounds` | **MATCH** (defensive `?? null` where a field may be absent) |
| Advancer → fresh round | composition writes `rounds.r{N+1}` + new `forming` group docs (`:718-756`) | client `subscribeMyGroup` surfaces the new forming group independently | **MATCH** |

### 1.4 Claims / flips (user layer)

| Seam | Producer | Consumer | Verdict |
|---|---|---|---|
| Claim placement | `place-claim.js` (authed, server-enforced window `:67-70`, day-5 `:101`, pending cap `:129`) → `claims/{id}` | `subscribeClaims` (`tournamentGroupService.js:57`, `limit(20)`) | **MATCH** (see item 2) |
| Claim resolution | `processClaimsForTournamentGroup` per-group tx (`tournamentClaims.js:117`) → roster/pool + `claimSystem.processingLog` + double-down feed | banking, group subscription | **MATCH** |
| Flip | `flip.js` atomic tx (`:135-252`) → leg mutation + `feed` event + double-down | group subscription | **MATCH** |
| Double-down (D-1) | flip/claims write `ledger.doubleDowns` + `feed` `double_down` entry in the SAME tx (`flip.js:229`, `tournamentClaims.js:283`) | `feedEventText` renders both sides (`tournamentSurfaces.js`); champion recap reads `doubleDowns` (`tournamentAdvancement.js:185`) | **MATCH** |

### 1.5 The one place a mismatch could have hidden — VERIFIED CLEAN

The orchestrator sends `gameMode: TOURNAMENT_GAME_MODE`; the engine routes on `FLAT6_GAME_MODE`; the battle is stamped `FLAT6_GAME_MODE`; every downstream filter (banking, reconcile, incumbent fan-out, completion disposition) keys on `TOURNAMENT_GAME_MODE`. **If those two named constants resolved to different strings, the entire prescribed-deploy → score → advance chain would silently break** (the deploy would fall through to the legacy self-select path; battles would never be counted).

- `leagueTournament.js:60` — `export const TOURNAMENT_GAME_MODE = 'baggerbomb_tournament';` **VERIFIED**
- `agentGameModes.js:37` — `export const FLAT6_GAME_MODE = TOURNAMENT_GAME_MODE;` (a literal alias) **VERIFIED**
- Test-locked both sides: `leagueTournament.test.js:125`, `agentGameModes.test.js:29` assert `=== 'baggerbomb_tournament'`. **VERIFIED**
- (Historical note: P4 already caught and fixed `agent-evaluate.js resolveCompletionDisposition` comparing the hardcoded literal instead of the constant — see `2026-06-12_P4_PHASE_REPORT.md:60`.)

**Conclusion: the seams compose.** This is the deliverable the phase exists to produce, and the result is the good one.

---

## 2. THE FLAG-FLIP BLAST RADIUS (the map P9 inherits)

There are **two** gates, and they are decoupled. The important, possibly-surprising fact:

> **`TOURNAMENT_DEPLOY_ENABLED` is already `true`** (`tournamentOrchestrator.js:95`, flipped in the P4 fence-entry PR, test-locked `p4Flips.test.js:30`). The production orchestrator cron is **live but inert**: with zero non-dev tournament groups it writes nothing (`runOrchestratorTick:721-725` quiet skip). So the production deploy machinery is *already running in production* — the dev-group exclusion (§3) is the only thing keeping smoke groups from going live. P9's flip is the **client** flag only.

### `TOURNAMENT_TAB_ENABLED` — the launch flip (currently `false`)
Defined: `src/config/featureFlags.js:78` (hardcoded constant, no env override). Everything it gates:
- `App.jsx:9563-9570` — the `'league'` screen route + `<LeagueScreen/>` mount (unreachable when false).
- `BottomNav.jsx:10-12` — bottom-nav "League" item (nav 4→5).
- `DesktopSidebar.jsx:14-16` — sidebar "League" item (6→7).
- (Dev-screen smoke surfaces in `TournamentDevScreen.jsx` are NOT gated by this flag — they're the current smoke path.)

When it flips, `LeagueScreen` mounts and subscribes: `subscribeMyGroup`, `subscribeRank`, `subscribeBracket`, `subscribeLeaderboard`, claim/flip window, battle view, round-boundary. **All of these are client Firestore reads** that depend on the rules blocks in §6 being **deployed**.

### The interaction (no longer a risk, because DEPLOY is already true)
At P9, with DEPLOY already `true`, flipping TAB exposes surfaces backed by **live** orchestrator data (real groups deploy real battles). The "data-less surface" concern only existed in the hypothetical reverse order; it does not apply. The real P9 gate is the rules deploy (§6) + the 5-days-clean reconciliation P9 owns.

---

## 3. DEV / PRODUCTION BOUNDARY (verified at every production duty)

The boundary is `isDev` on the group/bracket + `dev-` namespacing on derived doc ids. No laundering path found.

- **The one eligibility home:** `fetchEligibleGroupsByStatus(...{includeDev=false})` (`tournamentGroupService.js:102-110`) — production excludes `isDev`. Production cron passes nothing ⇒ `includeDevGroups=false` (`tournament-orchestrator.js:46` → `runOrchestratorTick:428`). The dev surface opts in (`run-duty.js:64`).
- **Sweep loophole closed:** the active-bracket sweep additionally skips dev brackets on production ticks (`tournamentAdvancement.js:335`).
- **Namespacing:** `leaderboardDocId`/`rankDocId` (`leagueTournament.js:401-409`) apply the `dev-` prefix; both side-effect halves route from ONE resolved `dev` decision (`tournamentAdvancement.js:471, :592`; leaderboard override `tournamentLeaderboard.js:241`).
- **Inheritance (the historical bug class) is locked:** a materialized bracket inherits `isDev` from its cohort (`tournamentAdvancement.js:518`); composed next-round groups inherit from the bracket (`:741`). Test-locked (`p4Flips.test.js:73,75`; `tournamentAdvancement.test.js:728`).
- **Sim duty markers** are `sim:`-namespaced (`tournamentOrchestrator.js:133`) so a smoke run can't pre-satisfy a real future duty.
- **CPU seats** (`cpu-` codec, `leagueTournament.js:253-280`) are orthogonal — CPUs exist in both dev and prod, marked `isCpu`, protected by the CPU-farm guard, NOT a dev/prod boundary.

**One pre-existing superset note (not a leak):** the nightly leaderboard aggregation queries dev-inclusively by design and namespaces inside (`tournamentLeaderboard.js:318` + `:241`). Verified correct — routing, not the query, is the protection.

---

## 4. IDEMPOTENCY UNDER THE REAL CRON CADENCE

Every writer is individually idempotent and they compose:
- Orchestrator: two-grain markers (per-duty/per-ET-date) + natural guards; transactional marker writes (`tournamentOrchestrator.js:177-200`); `sim:` isolation.
- Banking: per-`recordedDate` skip (`tournamentBanking.js:115-118`).
- Leaderboard: idempotent SET of `entries.{uid}.weeks.{groupId}`, month total recomputed (`tournamentLeaderboard.js:286`).
- Rank: once-only per `appliedGroups.{groupId}` (`tournamentRank.js:76`).
- Advancement: natural guards (`advancers`, `lockedAt`, `champion`, `rounds.r{N+1}`, `sideEffectsAt`); resumable from the bracket doc alone.
- Claims: `isAlreadyProcessedForDay` (imported as-is).

**The cross-cron timing seam** (a real one): Friday advancement needs day-5 banked, but banking lands ~17:15 ET on the nightly handler while the Friday duty fires in the evening UTC window. Handled by deferral: advancement no-ops "banking pending" until `isWeekBanked` (`tournamentAdvancement.js:259, :553`), and Monday runs an advancement catch-up (`tournamentOrchestrator.js:433`). Composes correctly. **Holiday-week edge** (4 trading days ⇒ day-5 never satisfies ⇒ waits for founder intervention) is documented, not improvised (`tournamentAdvancement.js:35-38`) — a P9 launch-calendar awareness item.

---

## 5. HYGIENE LEDGER TRIAGE (items 1–7)

### 5.1 — Item 1: AgentBattleScreen short double-negation — **VERIFIED still-live (dormant). DISPOSITION: FIX NOW.**
- The bug is real: `AgentBattleScreen.enrichAsset` pre-negates `priceChange` (`:562-564`) and `thresholdPriceChange` (`:610-612`) for shorts, THEN passes `{...asset}` (carrying `direction`) into `calculateAssetScoreV3` (`:626-632`), which negates AGAIN (`baggerBombUtils.js:540-544`). Net: a short scores as a long. **VERIFIED.**
- **Reachability: dormant.** The only battles `AgentBattleScreen` renders are agent-deployed battles (`BattleViewScreen.jsx:23`, gated on `agentDeployed===true`); agent portfolios never carry `direction:'short'` (agents are long-only — `decide.js enrichPortfolio`, `cpuOpponentGenerator.js`). VERIFIED via dedicated reachability trace.
- **Not fenced:** `AgentBattleScreen.jsx` and `baggerBombUtils.js` are NOT on the fence list. The scorer is *called*, not copied. Safe to edit.
- **Recommended fix (safe for the live tiered game): correct the double-negation.** Remove the two pre-negation blocks; let the canonical scorer own direction once (the exact discipline `flat6BattleEnrichment.js:84-90` already follows). For the long path (every real battle today) this is **byte-identical** (the `if short` branches never fire). Add a test that (a) locks the long path unchanged and (b) asserts a short now scores with the correct sign. Cost: ~6 lines + 1 test. The guard-and-throw alternative is available but strictly worse (it leaves shorts unsupported and the screen already has the rendering for them).
- **⚠️ NEW, HIGHER-SEVERITY, OUT-OF-SCOPE FINDING (report-don't-fix, BUILD_RULES §3):** the **identical** double-negation exists in `BaggerBombTrainingBattleViewV4.jsx:396-420` (pre-negate `:396-398`/`:406-408`, then `{...asset}`→`calculateAssetScoreV3:417`), and **users CAN select crypto shorts** there (`AssetPickerModal.jsx:155`). If user crypto shorts route through that view's `enrichAsset` in production, this is a **live scoring sign-flip in the training game** — not dormant. This is outside the tournament build (not a P8 ledger item). **Recommend a separate ticket to verify reachability and fix.** (`BaggerBombTrainingBattleViewV3.jsx` has no such code — unaffected.)

### 5.2 — Item 2: claim/flip transaction read-budget — **VERIFIED. DISPOSITION: DOCUMENT-AND-TEST (no code change).**
- **Flip tx:** ≤2 reads (`flip.js:136` group; `:217` ledger, only when the user has an own agent) + 2 writes. The expensive reads (quote, ATR, owner-agent map) are pre-transaction (`:107-131`).
- **Claims tx is PER GROUP** (`process-draft-claims.js:573-582` loops, one `processClaimsForTournamentGroup` tx each — never a combined cross-group batch). Per-group reads: `groupRef` (`:118`) + `pendingQuery` (`:135`, ≤12 docs at 4-player×3-cap) + `ledger` (`:142`) ≈ **14 reads**, ~14 writes. Bounded by group size, NOT by registration scale.
- Firestore's practical per-transaction constraints (10 MiB total, reads-before-writes ordering) are satisfied with large headroom. The `subscribeClaims limit(20)` cap-count concern (`tournamentGroupService.js:61`) is bounded (≤12 pending) AND server-authoritative (`place-claim.js:129` advisory cap; the server `409` is the authority). **Document the headroom; add a test asserting the per-group read set stays bounded. No restructure.**

### 5.3 — Item 3: `subscribeMyGroup` composite index — **VERIFIED still-live. DISPOSITION: DOCUMENT-AND-WATCH (launch-safe).**
- `subscribeMyGroup` (`tournamentGroupService.js:145-160`) uses a single `array-contains` on `groupMembers` + **client-side** status filter, **no `limit`** — it reads *every* group the player was ever in (including COMPLETE), growing monotonically over a career. Deliberate, to avoid a composite index (comment `:139-143`; founder note 3).
- **Launch-safe** (a player has 1–few groups in early rounds). **Trigger to docket:** when a long-lived player accumulates many completed groups (order tens), add the composite index (`groupMembers array-contains` + `status in [...]`) — a **Console deploy** (flag in the PR; never improvise the index). Document in the watch ledger.

### 5.4 — Item 4: leaderboard sharding — **VERIFIED still-live. DISPOSITION: DOCUMENT-AND-WATCH.**
- One whole-doc month board, read-modify-written per upsert (`tournamentLeaderboard.js:264-299`). The 1 MiB Firestore doc cap lands at ~3–5k players/month (header `:31-37`). At V1 launch scale (tens of rows) this is a conscious non-issue.
- **Trigger:** approaching open registration / ~few-k monthly actives ⇒ land the designed per-entry subcollection sharding **before** open registration. Document in the watch ledger (this is the P6a/P6b/P8 carried checklist item).

### 5.5 — Item 5: `toIso` / ET-helper convergence — **DISPOSITION: CONVERGE (server) + DOCUMENT (client).**
- **Clean converge (server, same runtime):** four byte-identical private `toIso` copies remain — `tournamentAgentBoards.js:70`, `tournamentAgentDraft.js:67`, `tournamentBoardAutoCommit.js:52`, `tournamentAgentLedger.js:71` — all reproducing `tournamentTime.toIso` (`:68`). Replace each with `import { toIso } from './tournamentTime.js'` (no cycle: tournamentTime imports only marketSchedule). The post-P6a modules already do this. Cost: 4 one-line edits; suite stays green. (The comment at `tournamentTime.js:62-66` explicitly dockets exactly this.)
- **Document and leave (client / cross-runtime):** client ET-today helpers — `etToday` (`TournamentDevScreen.jsx:182`), `etTodayStr` (`ClaimFlipWindow.jsx:30`), `toEtDate` (`flat6BattleEnrichment.js:42`), `etMonthKey` (`tournamentSurfaces.js:112`). Converging across the client/server SDK boundary is NOT clean (tournamentTime is server-side via marketSchedule), and `flat6BattleEnrichment` keeps its copy **deliberately** to stay node-clean (`:25-27`). The ~30 ET-date inlines elsewhere in `src/` predate the tournament and are out of scope. Leave; note in the ledger.

### 5.6 — Item 6: streams/boards literals (the P3a SYNC WARNING) — **VERIFIED value-consistent (no split). DISPOSITION: DOCUMENT-AND-WATCH (converge optional).**
- The user-board collection `'boards'` is referenced **entirely by literal**: writers `commit-board.js:67`, `seed-tournament-group.js:108`, `tournamentCpu.js:143`, `tournamentBoardAutoCommit.js:182`; readers `resolve-user-draft.js:145`, `tournamentBoardAutoCommit.js:124`, client `subscribeOwnBoard:127`. The user-draft stream uses literal `'streams'`/`'userDraft'` at the writer (`resolve-user-draft.js:173`) vs constants at the reader. **All values agree today — there is NO live split** (VERIFIED). (Agent boards/streams already use the constants consistently.)
- It is a *future-rename hazard*, not a current defect. Convergence (define `USER_BOARDS_SUBCOLLECTION`, replace literals, lock the value with a test) spans ~6 writer/reader files where a typo would split a collection (severe). Given it's value-correct now and the blast radius is non-trivial, **recommend document-and-watch**; converge only if the founder wants the tidiness in this pass (it would ride a value-locking test).

### 5.7 — Item 7 / Catalog #9 — round-boundary Film Room tagging — **DISPOSITION: BUILD per founder ruling (see §8).**
- The producing surface is the awaited durable write `chat.js:445-448` (`battleRef.update({ chatExchanges: arrayUnion(exchange), ... })`). The forbidden `:418` shadow log is `logConversation(...).catch(()=>{})` — correctly NOT the target. **VERIFIED.**
- The `exchange` object is built at `chat.js:428-441`. The cheap Pattern-A form spreads tournament context onto it when `battle.gameMode === TOURNAMENT_GAME_MODE`.
- **Design wrinkle the founder must rule on (§8):** the battle doc carries `gameMode` + `groupId` (`agentBattleService.js:106`) but **not** `bracketGameId` / `roundNumber`. So tagging all three from `chat.js` requires either (a) a group-doc read per tournament chat exchange (+1 read, rides the awaited write, no new cron/collection), or (b) stamping them at deploy — which is **fence contact** (`createAgentBattle` doc shape) and therefore a STOP. The zero-cost option is **tag-only with `groupId`** (already on the battle); `bracketGameId`/`roundNumber` are recoverable downstream by joining `groupId` → the group doc (which carries both).

---

## 6. SECURITY-PASS AGENDA — enumerated for P9 to inherit (out of P8 scope to *execute*)

1. **firestore.rules deploy gate (BLOCKING for the flag flip):** all five tournament blocks exist in `firestore.rules` — `tournamentGroups` (`:302`), recursive subcollections `{document=**}` (`:312`), `tournamentBrackets` (`:322`), `tournamentLeaderboards` (`:334`), `tournamentRanks` (`:339`) — every one carrying "inert until **manual Console deploy**." P9 must confirm they are deployed *before* `TOURNAMENT_TAB_ENABLED` flips, or every client read 403s.
2. **Claim-window enforcement:** server-authoritative at `place-claim.js:65-70` (`getTournamentClaimWindow` → 403 `window_closed`), day-5 cutoff `:101-102`, pending cap `:129` (advisory — parallel submissions can both land; resolution still honors it). Flip cap server-enforced (`flip.js:150`). The client mirror is display-only (`tournamentSurfaces.getClaimWindowDisplay`, parity-locked).
3. **The WHY projection:** non-owner active reads are concealed **server-side** via the Admin-SDK endpoint `api/tournament/battle-view.js` + `projectTournamentBattle` **allowlist** (`tournamentBattleView.js`); full WHY at completion. Verify the allowlist still covers the doc shape at P9.
4. **Client mutation callers:** the only client writers are `src/services/tournamentActions.js` (`placeClaim`/`flipPick` → authed `place-claim`/`flip`); `tournamentGroupService.js` is reads-only by contract. Deploy auth: `decide.js` internal `CRON_SECRET` + ownership assertion (`:129-136`), and `TOURNAMENT_ONLY_FIELDS` refused from browser callers (`:46-53`).
5. **Known best-effort gaps (already documented):** the eliminated-interstitial localStorage pointer (`roundBoundaryAck.js`) is best-effort by design; the advisory claim-cap race.

---

## 7. OUT-OF-TASK OBSERVATIONS (report-don't-fix, BUILD_RULES §3)

1. **[HIGH] Live training-game short scoring** — `BaggerBombTrainingBattleViewV4.jsx:396-420` carries the same double-negation as item 1, and shorts ARE user-selectable there. Potential live sign-flip. Separate ticket; verify reachability first. (Details §5.1.)
2. **[LOW] `seed-tournament-group.js` pool floor** — P3b flagged a 12-vs-15 floor mismatch; P5 reported fixing seed floors. Dev-seeder only (admin endpoint). Worth a one-line re-confirmation but dev-only risk; noted, not actioned.

---

## 8. FOUNDER RULINGS REQUESTED AT THIS STOP

1. **Catalog #9 — tag-only vs re-cadence?** Recommend **tag-only** (stamp context onto the review exchanges that already happen; pure signal capture, zero behavior change to a live surface). Re-cadence (changing WHEN the review fires to align with round boundaries) is a behavior change to the live Film Room chat — not recommended for V1.
2. **Catalog #9 — which tag shape?** Given the battle doc lacks `bracketGameId`/`roundNumber` (§5.7): **(a)** tag-only with `groupId` (zero extra read; derive the rest downstream) [recommended], or **(b)** read the group doc to denormalize all three onto the exchange (+1 awaited read per tournament chat exchange). NOT option (c) stamping at deploy (fence contact → STOP).
3. **Item 1 fix approach** — confirm **correct-the-double-negation + test** (recommended; byte-identical for longs) vs guard-and-throw.
4. **Item 6 literals** — confirm **document-and-watch** (value-correct today) vs converge-now-with-a-value-lock-test.
5. **Items 3 & 4 (index / sharding)** — confirm **document-and-watch** with the stated triggers (recommended; both launch-safe), vs land the my-group composite index now (a Console deploy).

---

## 9. PROPOSED WORK-PLAN (post-go, per approved triage) — commit order

> No new cron. No new collection. Flag stays `false`. Riders awaited. Catalog #9 rides the existing awaited chat write. New index/sharding = Console-deploy flag in the PR (none expected if 3/4 are document-and-watch).

1. **Commit 1 — Item 1 (correctness, highest priority):** correct `AgentBattleScreen.enrichAsset` double-negation; add the long-path-locked + short-sign test. (`AgentBattleScreen.jsx`, `flat6BattleEnrichment.test.js`-style sibling.)
2. **Commit 2 — Item 5 (clean convergence):** four server `toIso` copies → `tournamentTime.toIso`.
3. **Commit 3 — Catalog #9 (per the §8 ruling):** Pattern-A field spread on the `chatExchanges` exchange object + test.
4. **Commit 4 — the watch ledger (`docs/`):** a single committed `docs/` launch-readiness watch-list (items 2, 3, 4, 6 + the §6 security agenda + the §7 out-of-task pointers + the firestore.rules deploy gate) — the artifact P9 cites.
5. **Plus:** this Stage 0 sweep report → `docs/audits/` and a P8 phase report at close. `/code-review` at max effort. PR per house shape with the **integration-sweep §1 as a first-class section** (seam map is a deliverable, not an appendix), stating cron/rules/Console-deploy status explicitly.

---

*Prepared at the P8 Stage 0 HARD STOP. Awaiting founder rulings (§8) and go before any writes.*
