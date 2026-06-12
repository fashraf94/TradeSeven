# P3b Phase Report — Orchestration (Cron · Dispatcher · Fan-out · Advancement · Champion · CPU)

**Date:** June 12, 2026
**Branch:** `claude/quirky-meitner-q4xruh` (fresh off current `main` @ `0962f25`, the P3a merge)
**Commits:** `1` build + `1` code-review fixes (7-angle `/code-review` ran at high effort — mandatory at this size: 21 files / ~3,400 lines)
**Stage 0′:** both proposed shapes ratified by the founder before any writes (bracket-state doc; CPU system-agent specifics, including the two named non-fenced edits).

---

## 1. Executive verdict table

| # | Item | Verdict |
|---|---|---|
| 1 | Cron entry + ET dispatcher (Ruling A verbatim) | **SHIPPED** — exactly 1 new `vercel.json` entry (38/40), `*/10 11,12,13,14,21,22,23 * * 1-5`, handler maxDuration 300, both DST arms test-locked. |
| 2 | Monday pipeline | **SHIPPED** — advancement catch-up → user draft (finding-#5 defer, loud) → boards (synthetic refused **every tick**) → agent draft → 24-held check → deploy fan-out (P4-gated). |
| 3 | Tue–Fri incumbent fan-out | **SHIPPED** — latest tournament battle's six via the fenced-exported `flattenPortfolioServer` (read-only); battle-less agents fall back to Monday's drafted six (post-P4 retry-all-week). |
| 4 | Friday advancement + champion | **SHIPPED** — day-5 banked → top-two lock by `getWeeklyScore` (final snapshot, never a sum) → completion → next-round composition with CPU padding → terminal-round champion + spec-§3 recap. Base-layer groups: complete only (ruled). |
| 5 | CPU system agents (Ruling B1) | **SHIPPED** — real `agents/cpu-agent-{n}` docs, lazy get-or-create, archetype round-robin, deterministic ranked-slice user boards through the real board-commit core, no-model agent boards, per-round-unique numbering. |
| 6 | Bracket-state doc | **SHIPPED** — `tournamentBrackets/{bracketId}` per the ratified shape; firestore.rules read block added (manual Console deploy required, the standing caveat). |
| 7 | Deploy step | **BUILT COMPLETE, P4-GATED** — `Bearer CRON_SECRET` + ownership assertion on every call from day one; the gate logs a loud "P4 pending" line per would-be call; the live branch is test-covered via injection before P4 ever flips it. |
| 8 | Dev surface + smoke arc | **SHIPPED** — bracket seeder, duty buttons with the simulated duty clock, bracket card, duty-result card; the full-arc smoke script is steps 10–14 in the screen header. |
| 9 | Production inertness | **TEST-LOCKED** — zero groups + zero active brackets = one quiet skip line, zero writes, every duty. |
| 10 | Fence | **NO CONTACT** — verified by the review's altitude angle: zero fenced files in the diff; fenced exports *called* read-only: `flattenPortfolioServer`, `getArchetypeConfig`, `getArchetypeLabel`, `formatMarketCSV` (P3a, unchanged). |
| 11 | Tests | **2,451 passing** across 109 files (≈100 new assertions in five batteries); client build clean. |

## 2. What the founder should know in three sentences

The orchestrator is live-at-merge but inert: every tick it either routes to a duty or logs one quiet skip line, and with no tournament groups it writes nothing. Deploys do not happen anywhere — the deploy step is fully built (credentials, ownership assertion, pacing, cooldowns, all test-covered) behind a code gate that only P4's fence entry flips, so until then Monday mornings end with loud "P4 pending" log lines and held ledgers, exactly as ruled. The full bracket arc — seed → Monday → five banked days → Friday advancement → terminal round → champion recap — is drivable end-to-end on preview from the dev surface with the simulated clock, and simulated runs can never contaminate the real cron's day markers (they live in a separate namespace — a review catch).

## 3. The code-review pass (mandatory; 7 angles, high effort)

All confirmed findings were fixed in the second commit and test-locked. The ones worth knowing about:

| Finding | Severity | Fix |
|---|---|---|
| Synthetic-board refusal was one-shot: tick 2 counted the persisted synthetic board as a plain "skip" and the pipeline would have drafted it | **Severe** (P3a contract violation) | The skip path now classifies pre-existing boards; refusal holds every tick (test-locked both ticks). |
| Simulated-clock smoke runs wrote **future-dated duty markers** into the production state doc — the real Monday would have silently never run | **Severe** | Simulated runs read/write markers in a `sim:` namespace; re-click idempotency preserved; pruning handles both namespaces. |
| A crash after groups completed but before composition/champion landed orphaned the bracket forever (the battle-group query could no longer see the work) | **Severe** | Round finalization is driven off the bracket doc; an active-bracket sweep resumes lock/composition/champion from the bracket alone (test-locked for both windows). |
| Deploy pacing reset per group — post-P4, back-to-back cross-group sends could breach the 3/min limit the 20s floor prices | High (post-P4) | Pacing is duty-scoped; the floor holds across groups (test-locked with real timestamps). |
| A Monday-failed agent vanished from Tue–Fri fan-out for the whole week (no battle → no incumbent seat) | High (post-P4) | Weekday fan-out falls back to the draft stream's prescribed six for battle-less agents. |
| State-doc writes could lose a concurrent run's marker/cooldown (stale whole-doc set) | Medium | Marker and cooldown writes are transactional; expired cooldowns pruned. |
| Pool-floor guards (12) sat below the CPU board commit's real precondition (15) — a degraded rankings doc would wedge advancement in a throw loop | Medium | Floors raised to `BOARD_DEPTH_MIN` at both new call sites. |
| Banking's trading-day guard read the real clock while banking the simulated instant | Medium | The guard evaluates the (possibly simulated) instant. |
| Plus: silent empty-portfolio seat drops made loud; complete→complete races tolerated; materialization guarded by game-index contiguity; `currentRound` restored on recovery merges; assorted convergence (shared eligibility query, one simulatedNow parser, the CPU id codec co-located in the schema module, in-memory bracket maintenance, hoisted state reads). | — | All in commit 2. |

**Reported, NOT fixed (outside P3b's task, per BUILD_RULES §3):** the P1a dev seeder (`api/admin/seed-tournament-group.js:66`) guards its pool at 12 names but its placeholder boards need 15 — the same floor-mismatch class fixed at the two new call sites. One-line fix; separate tasking.

## 4. Ruled items honored verbatim

One cron entry; ET-aware dispatcher with two-grain idempotency (per-duty/per-ET-date markers + natural guards — a mid-duty crash finishes next tick, test-locked); sequential with ≥20s pacing; ~270s defer-to-next-tick; failed deploys defer ≥10 min with the cooldown consumed even on failure; never self-reinvokes; finding-#5 defer-with-loud-log; base-layer complete-only; `synthetic > 0` refusal; Ruling B1 in full; champion recap = the spec-§3 one-screen default with `finalComposite: null` until P6 backfills.

## 5. Known edges (docketed, not improvised)

- **Holiday weeks:** a 4-day trading week banks only day4; the ruled day-5 check never satisfies, so advancement waits for founder intervention (manual banking or a founder-cited rule change). Named in the module header.
- **Crons don't run on Vercel preview** (BUILD_RULES §6): verification = the five unit batteries + observation of the first production ticks (expect quiet skip lines only, zero groups). Say-don't-claim: nothing here was "preview-tested" as a cron; the duty logic was smoke-driven through `POST /api/tournament/run-duty`.
- **firestore.rules** for `tournamentBrackets` requires the manual Console deploy (standing caveat; inert until deployed — the dev bracket card is the first reader).
- **One concurrent bracket at V1:** CPU numbering is unique per round within a bracket; a second concurrent bracket would need a namespace extension (flagged at Stage 0′).

## 6. P4 contract — final pre-P4 state (the fence entry's shopping list)

The canonical 7-item register is the P3a report §6 as amended (contract #6 also collapses the `agentEvalPromptAssembly` twin — zero sanitizer copies after P4). **P3b adds no items and removes none.** It concretizes the intake the fence entry must accept, all live in code today:

1. **Prescribed-portfolio entry path** — the deploy must accept the payload `buildDeployRequest` already sends (`api/_utils/tournamentOrchestrator.js:214-233`): `{ agentId, ownerOdUserId, groupId, gameMode: 'baggerbomb_tournament', prescribedPortfolio: [six], isCpu? }` — skip self-selection, validate + create.
2. **Internal-caller auth** — `Authorization: Bearer CRON_SECRET` honored, rate-limit exempt, and the **ownership assertion verified** (`agent.ownerId === ownerOdUserId`) per Spec §0.3.
3. **Joint battle stamp** — `gameMode` + `groupId` on `createAgentBattle` (the standing contract with `resolveTournamentContext`, `tournamentAgentLedger.js:226-236`).
4. **CPU/passive marker stamped at deploy** (contract #5) — the payload carries `isCpu` from day one.
5. **The gate flip** — `TOURNAMENT_DEPLOY_ENABLED` (`tournamentOrchestrator.js:78`) flips to `true` in the same PR as the fence entry, never earlier. The live branch (pacing, cooldowns, budget deferral, HTTP handling) is already test-covered via injection — P4-day runs no never-executed code.
6. **Deploy-time half of rider #6** (USER PICKS reaction at deploy) — per the P3a module header, `tournamentAgentBoards.js:1-26`.
7. **Sanitizer collapse** — `tournamentPromptSanitizer.js` port → canonical import (amended #6).

Until the flip: tournament battles don't exist (CPU and human alike); weekday fan-out logs one quiet "P4 pending" line per group; reconcile-ledger reports drafted holds as `unverifiable_holder` — all by design.

## 7. Hand-off facts for P5+

- The bracket doc is the spectator read surface: one subscription per bracket (`subscribeBracket`, `src/services/tournamentGroupService.js`), seats carry `isCpu`, `finalScores` snapshot the lock, `recap.finalComposite` is P6's to backfill.
- `players[].isCpu` is the contract flag for every downstream row (P6 aggregation/leaderboard "CPUs marked"); the `cpu-` prefix is a readable secondary signal only; the id codec (`cpuUserId`/`cpuNFromUserId`) lives in the schema module — never re-parse it locally.
- The smoke arc is dev-screen steps 10–14; banking five days in one sitting uses the duty clock riding `bank-daily-scores` as `simulatedNow` (per simulated-ET-date idempotency intact).
- Duty markers: real namespace `{etDate}:{duty}`, simulated `sim:{etDate}:{duty}`, retention 14 days, on `tournamentOrchestrator/state` (no client read rule — server-only).
