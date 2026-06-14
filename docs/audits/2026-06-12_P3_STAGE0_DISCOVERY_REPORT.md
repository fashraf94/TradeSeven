# P3 — Tournament Orchestrator: Stage 0 Discovery + Proposals A–D (Read-Only)

**Branch:** `claude/blissful-dijkstra-5f105v` · **HEAD:** `53d892e7cf335a79d2b8a4ef65e7d6d0afb54102` (merge of PR #487) · **Tree:** clean (`git status` empty) · **Date:** 2026-06-12
**Writes performed:** none to the repo. This report file lives outside the repo tree (`/home/user/`), per BUILD_RULES §3. No git history deepening was needed.

**Preamble notes:**
- **P2's report §8 is not retrievable as a document.** Phase reports live outside the repo tree; only the three June-10 audits were transcribed into `docs/audits/`, and the GitHub tooling available to this session does not return PR body text for #486/#487. I therefore re-verified §8's two facts **directly against code at my HEAD** (the stronger standard BUILD_RULES asks for anyway): `reserveBulk`'s acquisition-as-held semantics (`api/_utils/tournamentAgentLedger.js:408-475`, VERIFIED) and the round-end ledger lifecycle (reconciliation scopes to `battle`-status groups, `:629-637`, VERIFIED). Both are detailed in §2 below.
- The June-10 discovery's `decide.js` anchors turned out **not** to have drifted — but every one was re-read in this session regardless; all citations below are at my HEAD.

---

## 1. Executive verdict table

| # | Question | Verdict | Key citation |
|---|---|---|---|
| 1 | Deploy endpoint mechanics unchanged at HEAD? | **Yes — all June-10 anchors exact.** One new pricing fact: `lastDeployedAt` is written *before* battle creation, so a failed deploy still consumes the 2-min cooldown. | `api/agent/decide.js:407` VERIFIED |
| 2 | P1a/P2 surfaces as expected? | **Yes.** Boards shape, snake-resolution stream, `reserveBulk` (all-or-nothing, lands as `held`/`draft`), reconciliation scoped to `battle` groups, `vercel.json` = 37 entries. | §2 below, all VERIFIED |
| A | Cron topology | **Propose:** one `*/10`-cadence entry over morning + Friday-evening UTC hours, ET-aware dispatcher, per-duty + per-entity idempotency, defer-to-next-tick (no self-reinvocation). | §3 |
| B | CPU padding | **Propose:** flagged CPU player entries + deterministic ranked boards + **system-owned passive agents** (real battles, prescribed six, excluded from triggered eval). Honest costs/consequences analyzed; founder engagement expected. | §4 |
| C | Board production prompt | **Propose:** new non-fenced tournament prompt module. Blocking find: `sanitizeRuleText` is **module-private** in both fenced prompt files — reuse-by-calling is impossible; propose replication under a port-contract test. | §5 |
| D | Size/split | **Propose: split.** P3 as scoped ≈ 15–18 files / 4–5k lines. Seam: P3a Monday pipeline (boards + agent draft + acquisition) / P3b orchestration (cron + fan-out + advancement + champion + CPU). | §6 |

---

## 2. Re-verification findings (all read in this session)

### 2.1 Deploy endpoint (`api/agent/decide.js`) — Stage 0 item 1

| Mechanic | Finding | Citation | Status |
|---|---|---|---|
| Invocation shape | `POST /api/agent/decide`, body `{agentId, duration?}`; `duration` defaults `'1d'` | `decide.js:50-57, :618` | VERIFIED |
| Auth | **None.** `applySecurityMiddleware` = headers + CORS + rate limit only. No `CRON_SECRET`, no token. (P4 contract item.) | `decide.js:47` | VERIFIED |
| Rate limiter | 3 req/min per IP | `decide.js:47` | VERIFIED |
| `maxDuration` | 60s | `decide.js:34` | VERIFIED |
| `deployingAt` lock | 429 if lock < 2 min old; stale lock (>2 min) proceeds; set `:90`, cleared `:408` (success) and `:678` (catch) | `decide.js:73-79` | VERIFIED |
| Per-agent cooldown | `lastDeployedAt` < 2 min → 429. **Written at step 10 (`:407`), *before* battle creation** — a deploy failing after step 10 still consumes the cooldown. Fan-out retry must wait ≥2 min; a ≥10-min tick cadence prices this in automatically. | `decide.js:82-87, :407` | VERIFIED |
| One-battle-per-agent | Query is `status=='active'` only → **completed battles never block**; a truly-active battle short-circuits (`battleCreated:false`, re-syncs `activeBattleId`); an expired-but-active battle is marked `completed`/`expired` and creation proceeds | `decide.js:415-419, :431-465, :426-429, :467-473` | VERIFIED |
| Failure semantics | Catch clears `deployingAt`, returns 500, no server-side retry (SDK `maxRetries:2` covers Anthropic calls only, `:40`). Partial states: (a) fail after `:396-410` → fresh `lastDecision` + cooldown ticking, no battle; (b) fail between `createAgentBattle` (`:615`) and `activeBattleId` write (`:627`) → self-heals at next deploy via `:433`. First-message failure never blocks (`:634`, `:833-1015`). | `decide.js:674-687` | VERIFIED |
| Deploy response | Returns `agentBattleId`, `expiresAt`, full portfolio | `decide.js:661-673` | VERIFIED |
| Battle doc | `gameMode: 'baggerbomb_agent'` stamped in fenced `createAgentBattle`; duration hardwired `fullday`; portfolio = `star/core/support` + bench | `api/_utils/agentBattleService.js:74, :13, :89-103` (read-only) | VERIFIED |

### 2.2 P1a/P2 surfaces — Stage 0 item 2

- **`boards/{odUserId}` shape** — `{odUserId, board[ranked symbols], prefillAsSuggested, delta, roundNumber, bracketGameId|baseLayerWeek, committedAt}`, assembled by the pure `buildBoardCommit` (`api/_utils/tournamentBoards.js:68-102`); resolution reads `groupRef.collection('boards').doc(id)` (`api/tournament/resolve-user-draft.js:151`). VERIFIED.
- **`resolveSnakeDraft` event-stream pattern** — pure deterministic snake (fwd/rev/fwd), events `{pickNumber, round, odUserId, symbol, boardRank, fallback, passedOver}` (`resolve-user-draft.js:65-124, :115`); own earlier picks advance the board pointer silently, only others' takes are `passedOver` (`:93-105`); board exhaustion falls back to the highest-ranked remaining pool name (`:107-111`); the stream doc `streams/userDraft` commits **in the same transaction** as the group mutation (`:179-183`); `forming→battle` atomic. The agent draft mirrors all of this, ledger-aware. VERIFIED.
- **`reserveBulk` semantics (P2 §8 fact 1)** — all-or-nothing transaction; entries land directly as **`held` with source `'draft'`** (never TTL'd reservations), so the multi-minute fan-out faces no expiry pressure and a failed deploy never costs an agent its drafted names; conflicts fail the whole batch with zero writes; duplicate inputs throw; re-run idempotent (preserves `since`/`source`). **No production caller — dormant, P3 wires it** (`api/_utils/tournamentAgentLedger.js:408-475`, esp. `:417-421, :461-469`). VERIFIED.
- **Round-end ledger lifecycle (P2 §8 fact 2)** — nightly reconciliation queries `status=='battle'` groups only (`tournamentAgentLedger.js:629-632`); a group moved to `complete` simply drops out — its ledger becomes an inert record. Derived truth = latest battle per agent **including completed** (`:527-533`, by design — held set persists overnight); holders with no battles yet are preserved as `unverifiable_holder` (the Monday reserve-before-deploy window, `:575-581`). Rides `api/cron/snake-draft-daily-scores.js:488` (banking at `:476`). VERIFIED.
- **`vercel.json`** — **37** schedule entries (`grep -c '"path"'`). P3 adds at most 1 → ≤38. VERIFIED.
- **Eval-cron idioms available** — `maxDuration:60` / `TIME_BUDGET_MS 50s` / defer-remainder-to-next-tick (`api/cron/agent-evaluate.js:60-64, :153-160`); cron auth = `x-vercel-cron: '1'` OR `Bearer CRON_SECRET` (`:100-104`); 300s `maxDuration` precedents (`api/cron/compute-briefs.js:23`, `compute-index-intelligence.js:50`); multi-tick cadence precedent `*/10` (snake-draft-autopick, `vercel.json:30-31`). VERIFIED.
- **ET pattern of record** — `api/_utils/tournamentTime.js` (`getEtParts`/`formatEtDate`/`isMarketOpenAt`, Intl-parts, injectable `now`, `:44-73`); claims-window template re-verified (`api/cron/process-draft-claims.js` — `getClaimProcessingWindow` / `isAlreadyProcessedForDay`, drifted lines, logic unchanged). VERIFIED.
- **Admin/dev idioms** — `requireAdminSecret`/`isAdminSecretValid` (header/Bearer; `ADMIN_SECRET`→`CRON_SECRET` fallback; never query-string — `api/_utils/adminSecretAuth.js:19-49`); P1b time-controls honored only with the secret (`bypassTradingDay` `api/tournament/bank-daily-scores.js:34-44`; `forceMarketState`, `devBypassWindow` — `src/screens/TournamentDevScreen.jsx:10-14, :128, :173, :214, :230`). Dev screen reachable only via `?tournamentDev=1` (`src/App.jsx:2196-2197, :9576-9580`). VERIFIED.
- **Group lifecycle + scoring reads** — forward-only `LEGAL_TRANSITIONS` incl. the reserved `forming→drafting→battle` multi-step path for P3 (`api/_utils/tournamentGroupService.js:25-30`); `createGroup` factory (`:47-52`); `getWeeklyScore` = **final day's snapshot, never a sum** (`src/constants/leagueTournament.js:207-214`); `deriveCurrentTradingDay` (`:229-233`). VERIFIED.
- **Seed endpoint's CPU fake** — placeholders `dev-user-1..3` (`api/admin/seed-tournament-group.js:25`), staggered-slice boards `userPool.slice(i*3, i*3+depth)` (`:92-93`), `seeded:true` marker (`:101`). VERIFIED.
- **P2 eval wiring (context for fan-out/ledger interplay)** — `resolveTournamentContext` at `agent-evaluate.js:406`; reserve/confirm/release around the five swap sites (`:229, :252, :299`; swap sites `:1109, :1599, :2115, :2221, :2324`); discriminator contract = joint `gameMode:'baggerbomb_tournament'` + `groupId` stamp, P4's to write (`tournamentAgentLedger.js:196-199, :211-217`; `leagueTournament.js:42`). VERIFIED.

### 2.3 New findings that shape the proposals

1. **`sanitizeRuleText` is not exported.** It is module-private in *both* fenced prompt files (`api/_utils/agentPromptAssembly.js:245-265`; `agentEvalPromptAssembly.js:340`). The task's "with `sanitizeRuleText` called" is literally impossible without a fenced edit (adding `export` is an edit). VERIFIED. → Proposal C.
2. **The exported Sonnet strategy builders carry tiered-game framing.** `buildStrategySystemPrompt` embeds the tiered GAME RULES text (star 2x / core 1.5x / crypto — `agentPromptAssembly.js:17-32`); `buildStrategyUserPrompt` hardcodes the 25–35-ticker `submit_strategy` ask (`:136-140`). Calling them for a flat-6 tournament board would misbrief the model. The neutral pieces — `formatMarketCSV` (`:190-205`, fenced file but exported → calling permitted) and non-fenced `archetypeScoring.js` (`computeArchetypeRankings`, `ARCHETYPE_TEMPERATURES`, `ARCHETYPE_CONSTRAINTS`, `:68-107`) — are cleanly reusable. VERIFIED. → Proposal C.
3. **No internal self-HTTP precedent exists in `api/`.** Every in-repo `fetch(url)` targets external APIs. The fan-out's deploy-call URL construction is new ground — `process.env.VERCEL_PROJECT_PRODUCTION_URL` (Vercel system env) or a dedicated env var. ASSUMED until built; flagged as a build-stage decision. → Proposal A.
4. **`cpuOpponentGenerator` is `Math.random`-based** (`api/_utils/cpuOpponentGenerator.js:37-45, :81-84`) — fine for casual CPU opponents, unsuitable for tournament CPU boards (the agent draft is VOD-replayable and must be reproducible). → Proposal B.
5. **A real group with an uncommitted user board stalls the Monday pipeline** — `resolveSnakeDraft` throws `boards_missing` (`resolve-user-draft.js:70-72`). User-board autopick is P5 territory (draft systems); the P3 dispatcher should **defer that group with a loud log**, not improvise a fallback. Founder attention: if launch needs the fallback earlier, it should be tasked explicitly.

No out-of-task bugs found. (Items 1–5 are constraints/design facts, not defects.)

---

## 3. Proposal A — cron topology + internal dispatcher

**One schedule entry (37 → 38):**

```
{ "path": "/api/cron/tournament-orchestrator", "schedule": "*/10 11,12,13,14,21,22,23 * * 1-5" }
```

`maxDuration: 300` (precedented). The UTC hour set covers, in both DST seasons, an ET **morning window** (~07:30–09:25, pre-open) and an ET **Friday-evening window** (~16:45–19:55). Firing frequency is free; only the entry count is budgeted.

**ET-aware dispatcher** (new non-fenced `api/_utils/tournamentOrchestrator.js` + thin cron handler): converts each firing via `getEtParts` (Intl pattern, injectable clock — the `tournamentTime.js` house idiom) and routes to duties:

| ET window | Day | Duty |
|---|---|---|
| Morning (07:30–09:25) | Mon | **Advancement catch-up check** (re-run Friday's duty if it didn't complete — idempotent), then **Monday pipeline** per eligible group: resolve user draft (committed boards required; else defer + loud log) → produce agent boards (Proposal C) → resolve agent draft → `reserveBulk` all 24 → deploy fan-out **[P4-gated]** |
| Morning (07:30–09:25) | Tue–Fri | **Incumbent fan-out**: per agent, read the latest tournament battle's six (`flattenPortfolioServer`, fenced export, read-only) → deploy prescribed six **[P4-gated]** |
| Evening (16:45–19:55) | Fri | **Round advancement + champion**: verify day-5 banked for every group (banking lands ~17:15 ET via the nightly cron — earlier ticks no-op "banking pending"), lock top two by `getWeeklyScore`, compose next-round groups (+ CPU padding per Ruling B), write bracket state, champion recap at the terminal round |

**Idempotency, two grains.** (1) Per-duty/per-ET-date markers on a dispatcher state doc (`tournamentOrchestrator/state`), the `lastProcessedDay` spirit. (2) Per-entity natural guards so a re-run mid-duty is harmless: today's-battle-exists (deploy), group `status` (draft resolution), `streams/agentDraft` doc exists (agent draft), 24 symbols held (acquisition), bracket round fields (advancement). Every Monday-pipeline step is **individually resumable**: a group can advance partway through the pipeline in one tick and finish on the next.

**Time-budget posture — sequential with pacing + defer-to-next-tick (the eval-cron idiom), explicitly *not* a self-reinvocation chain.** Worst-case Monday group post-P4 ≈ 4 board calls (~15s each) + 4 deploys (≤60s each) ≈ 5 min — more than one tick's budget for >1 group, which is exactly what the 10-min multi-tick ladder absorbs: ~12 morning ticks × ~270s budget ≈ 54 min of compute, comfortable for a 16-player bracket (4 groups) plus base-layer load. Pacing ≥20s between deploy calls keeps a single egress IP under the 3/min limit until P4's internal-caller exemption lands. **Failure handling:** no tight retry, ever — a failed deploy defers to the next tick (≥10 min > the 2-min cooldown, which a failed deploy *does* consume, §2.1). Self-reinvocation was rejected: unbounded-invocation risk, a second auth surface, and no in-repo precedent; the multi-tick ladder achieves the same throughput with idempotent re-entry.

**Logging:** every tick logs `[Orchestrator] {etDate} {etTime} duty={duty} …` decisions + per-group step outcomes — a morning reconstructable from logs alone.

**Deploy-call plumbing (build-stage decision, flagged now):** no internal self-HTTP precedent exists (§2.3.3). Propose `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` with an env-var override, sending `Authorization: Bearer CRON_SECRET` + an ownership assertion body field on every call from day one (the P4 contract's consumer half).

**Open sub-question for the ruling:** at P3, does the Friday duty also recompose **base-layer** (non-bracket) groups for the next week (V1.2 §5 weekly reshuffle), or only complete them? Default proposal: complete them; recomposition machinery is the same code path but I'd scope it per your call.

---

## 4. Proposal B — CPU padding model

Three layers to decide. CPU **player identity** and **boards** are cheap; the **agent layer** is the genuine fork.

**Identity — flagged player entries, not auth users.** `odUserId: 'cpu-{n}'` entries in `players`/`groupMembers` with an `isCpu` flag (V1.2 carries "CPUs inline and marked" on the leaderboard, so the flag must survive into aggregation rows at P6). The seeder's placeholder pattern already proves the group machinery is identity-agnostic.

**CPU user boards — deterministic, ranking-derived.** Upgrade the seeder's staggered-slice (`seed-tournament-group.js:92-93`) to per-CPU offset slices of the ranked pool — deterministic (reproducible VOD playback), collides with human boards enough to produce real snipes. `Math.random` selection (the casual CPU generator) is unsuitable (§2.3.4). CPU claims/flips: none at V1 — CPUs hold their drafted three (watch-not-prevent; a difficulty dial later).

**CPU agent layer — the fork. Three options analyzed honestly:**

- **B1 — system-owned passive agents (recommended).** One real `agents` doc per CPU player (`ownerId` = a system marker), deterministic ranked board (no model call) entering the **same agent draft**, deploying through the **same prescribed-six path** (post-P4, prescribed deploys skip Sonnet/Haiku anyway → marginal model cost ≈ 0), **excluded from triggered evaluation** (they hold their six all day — no swaps, no Haiku cost, no eval-budget pressure beyond the cheap no-trigger pass). *Consequences:* full structural scoring symmetry (CPU composite has a real 6-unit agent layer); passive agents never swap, so their agent score is pure price drift of a deterministic six — a mild, predictable difficulty handicap (acceptable for padding; a hot week still advances a CPU). *Cost:* needs a CPU/passive marker readable by non-fenced eval code — stamped at deploy, so it rides P4's stamp work (**contract item #5 below**).
- **B2 — defer CPU agent battles; CPU groups score user-layer only.** Cheapest build. *Consequence, stated plainly:* a CPU composite caps at 4.5 effective units vs a human's 10.5 — humans in padded groups advance essentially by default, and the spectator surface shows missing agent battles. Acceptable only if CPU groups are explicitly a filler tier at V1; it breaks "one format everywhere."
- **B3 — fully agentic CPUs (Sonnet boards + live swaps).** Real token + eval-tick costs multiplying with CPU fraction, colliding head-on with the P5 eval-scaling risk (June-10 discovery). Not recommended at V1; B1 graduates toward this as a difficulty dial later.

**Recommendation: B1**, with B2 as the explicit fallback if you want zero CPU presence in the agent market at V1. Either way the **scoring-symmetry consequence should be ratified in writing** — it lands in P6's aggregation assumptions.

---

## 5. Proposal C — board production prompt (rider #2)

**Verdict: a new non-fenced tournament prompt module — reuse-by-calling only the neutral exports.** The exported Sonnet strategy builders are wrong for this ask (tiered GAME RULES framing + hardcoded 25–35 shortlist contract, §2.3.2). The board prompt module calls: `formatMarketCSV` (fenced file, exported — calling permitted, named in the PR), `computeArchetypeRankings` / `ARCHETYPE_TEMPERATURES` / `ARCHETYPE_CONSTRAINTS` (non-fenced).

**The sanitizer constraint (blocking find, §2.3.1):** `sanitizeRuleText` is module-private in both fenced files. Two routes:
- **C-i (recommended): replicate** the ~20-line sanitizer into the new module **under a port-contract test** (the precedented route — threshold-math replication; consistency-battery pattern). Lets the board prompt safely include the equipped watchlist's user-authored `name`/`thesis` — real strategic context at board time.
- **C-ii: exclude all user-authored free text** (validated symbols/enums only — watchlist tickers yes, thesis no). Zero replication, thinner context.

**Output contract (single tool-forced Sonnet call per agent):** `submit_board` tool → `{ board: [15–20 ranked tickers], rationale: {ticker: one-line snippet}, userPicksReaction: [{symbol, stance}] }`. The stance lines are **rider #6's P3-capturable half** (deploy-time half = P4 contract item #4). Validation: dedupe, depth bounds from `TOURNAMENT_TUNING`, symbols ∈ ranked universe, pad from archetype ranking if short (the `decide.js:236-244` padding spirit).

**Persistence (rider #2, awaited):** `tournamentGroups/{id}/agentBoards/{agentId}` — `{agentId, odUserId, board, rationale, userPicksStance, roundNumber, producedAt, model, fallback}`. Separate subcollection from the user `boards` (different key-space and writer); the P1a recursive rules block already grants spectator reads. The **USER PICKS block** comes from the exported pure `getOwnUserPicks` (`tournamentAgentLedger.js:144-161`) — symbols + live-leg direction, no free text.

**Model/tokens:** `claude-sonnet-4` (house default for agent strategy, `decide.js:195`), temperature `ARCHETYPE_TEMPERATURES[archetype].sonnet`, `max_tokens` ~1500–2000; input dominated by the market CSV (~2–3k tokens). Four calls per group, Mondays only — negligible cost.

**Degrade posture:** any failure (API, tool-miss, validation) → deterministic fallback board = top-N `computeArchetypeRankings` symbols, `fallback: true`, stance lines omitted, loud log. **Boards always exist before the agent draft.**

---

## 6. Proposal D — size/split

Projected full-P3 footprint: ~6 new `api/_utils` + `api/cron` modules, ~6 co-located test files, `vercel.json`, dev-screen extension, possibly one admin helper — **≈15–18 files, ~4,000–5,000 lines with tests**. Roughly double the `/code-review` threshold and two distinct review concerns in one PR.

**Recommended split at the natural seam:**
- **P3a — Monday pipeline:** agent board production (Ruling C) → agent draft resolution + `streams/agentDraft` playback record → `reserveBulk` wiring → dev-surface board/stream display → smoke through "watch the ledger fill via reconcile-ledger." Needs only Ruling C; can start immediately.
- **P3b — orchestration:** cron entry + dispatcher (Ruling A) → deploy fan-out (P4-gated) → round advancement + champion + bracket state doc → CPU padding (Ruling B) → dispatcher dev buttons → the full founder smoke script.

P3b consumes P3a's modules; rulings A/B can land while P3a builds. If you prefer one phase, the scope is buildable but the PR will be large and the review heavier.

---

## 7. P4 contract (running list — accumulates into P4's shopping list)

1. **(from P2)** Stamp `groupId` alongside `gameMode: 'baggerbomb_tournament'` in `createAgentBattle` for tournament deploys — the resolver's joint-stamp contract (`tournamentAgentLedger.js:196-199, :211-217`; static guard encodes it).
2. **Prescribed-portfolio entry path** in `decide.js`: accept a provided six, skip Sonnet/Haiku selection, validate + create (Spec §0.1 / §1.4).
3. **Deploy-endpoint auth enforcement:** verify `CRON_SECRET` for internal callers and exempt them from the 3/min/IP rate limit; require Firebase user-token ownership for client calls (Spec §0.3). P3's orchestrator **sends** these credentials from day one; P4 makes `decide.js` **check** them (founder ruling: one fence entry; security workstream logs the sequencing).
4. **Rider #6, deploy-time half:** USER PICKS reaction capture at deploy (board-time half captured at P3 per Proposal C).
5. **(conditional on Ruling B1)** The prescribed path stamps a CPU/passive-evaluation marker on CPU battles so non-fenced eval code can skip triggered evaluation for them.
6. **(carry)** The `flat6` mode config itself (Spec §1.4) — the gate P3's deploy step waits on, with its loud "P4 pending" log.

---

## 8. HARD STOP

Discovery complete. No repo files created, modified, or staged; nothing committed or pushed; the branch sits at `53d892e` untouched. Awaiting founder rulings on **A** (topology — incl. the base-layer sub-question), **B** (CPU model: B1 recommended), **C** (C-i sanitizer replication recommended), **D** (split recommended). Compact approval like "A as proposed / B1 / C-i / D-split" is sufficient to start the build stage.
