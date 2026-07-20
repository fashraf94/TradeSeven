# Discovery — G2: The `activeBattleId` Conflict (READ-ONLY)

**Date:** July 20, 2026 · **Repo:** `fashraf94/TradeSeven` · **Ledger:** `LAUNCH_READINESS_WATCH_LEDGER.md` G2 — 🚩 pre-launch must-fix
**Branch:** `claude/active-battle-id-conflict-xrflqu` · **HEAD:** `6802670cb8aafc28b9fc976d9bf678fb56efd0be` (== `origin/main` by SHA) · **Tree:** clean
**Guards satisfied:** `git fetch origin` run first (BUILD_RULES §3); no project-state writes; every claim carries `file:line` + VERIFIED/ASSUMED. **No fix, no writes — STOP for founder review.**

Method note: findings were produced by a read-only investigation and independently re-verified (five adversarial verifier passes, all CONFIRMED; only minor wording corrections, folded in below).

---

## Executive verdict (founder read-first)

| # | Question | Verdict |
|---|----------|---------|
| **1** | **How long is the user absent?** | **One day (Monday), not the week.** The Tue–Fri redeploy automatically re-seats the skipped member — the blocking casual battle has expired by Tuesday, so the pod battle is created then. *Whole-week absence is only reachable if the user keeps re-deploying casual battles every day.* |
| **1** | **What does the user see?** | **Nothing — silent.** Their agent layer is **omitted** from the pod (no error, no zero, no notice). The skip is triply invisible: no battle, no shadow-log, and the orchestrator even counts it as a "successful deploy." |
| **1** | **Scoring impact?** | **Composite survives.** The user half still scores at **1.5×**; the missing agent half banks a clean **0 for Monday only** (not a week-locking hole). |
| **2** | **What does "1d" mean?** | **Not 24h.** Battle mode is `'fullday'`, so a casual deploy expires at the **next market close** (4 PM ET, or 8 PM ET with crypto) — an end-of-trading-day boundary. |
| **2** | **Which deploy moments collide?** | **Fri 4 PM ET → the first Monday-morning tick (~6–7 AM ET).** Exposed: **Fri-after-close, Saturday, Sunday.** Safe: **Wed/Thu** (expire same day) and **Mon 8:45 AM** (the pod already deployed ~6–7 AM; a casual deploy then is *blocked by the pod battle* instead — the reverse direction, already safe). |
| **3** | **Who sets `activeBattleId`?** | **Exactly four sites, all in the fenced `decide.js`** (`:553, :700, :1104, :1164`). Cleared only by the eval cron on completion (`agent-evaluate.js:3595/:3625`). **Training is NOT a second source** (it writes the *clone*, never the real agent). Reverse direction already safe. |
| **4** | **Where can a fix live?** | **No non-fenced *server* block exists on the user's own deploy path** — `decide.js` is the route handler and it's fenced. Options: **(A) League-precedence force-complete = fenced** `decide.js` edit (founder-gated, destroys the casual battle); **(B) client-side block = non-fenced but UX-only**; **(C) recovery already exists** non-fenced and turns week→day automatically. A non-fenced *orchestrator* force-complete (Candidate 4) is possible but also destroys the casual battle. |

**Bottom line for the launch call:** G2 is **"annoying, self-healing by Tuesday,"** not **"your competitive week is void"** — *provided* the user deploys a single casual battle. The genuinely dangerous property is **silence**, not duration: a user absent from Monday's pod is told nothing, and even founder telemetry reads "deployed." The one true server-side integrity fix (block or force-complete) is **fenced (founder-gated)**; every non-fenced option is either UX-only or destroys the user's in-flight casual battle.

---

## The confirmed mechanism (one-paragraph trace)

A competitive slot pod deploys the user's **real** agent (no clone — `LAUNCH_READINESS_WATCH_LEDGER.md:18`; training clones, competitive does not). The pod sits in `AWAITING_OPEN` and is flipped to `BATTLE` on its Monday anchor by `flipAwaitingOpenPods`, which **deliberately does not filter `isTraining`** so it flips *both* training and competitive slot pods (`trainingLifecycle.js:554-572`, esp. the "do NOT add an isTraining filter, or slot pods would strand in AWAITING_OPEN forever" comment at `:555-559`). On the same Monday-morning tick, `runMondayPipeline` deploys the pod's agents (`tournamentOrchestrator.js:954-957`; competitive pods are *included* — the ranked duties pass `excludeTraining:true`, `:445-446,:579`) via `fanOutDeploys` → `POST /api/agent/decide` with `gameMode=FLAT6` → **`runPrescribedTournamentDeploy`** (`decide.js:229-231, :1029`). Before creating the tournament battle it queries `agentBattles` where `agentId==agentId AND status=='active'` (`decide.js:1091-1095`); finding the user's still-active casual battle it **early-returns `battleCreated:false`** (`decide.js:1096-1113`) and creates **no** tournament battle. The user is absent from their own pod at open.

---

## Track A — Severity: how long is the user absent?

### A1. The Tue–Fri redeploy **does** recover the user → **day-one gap, not whole-week absence** (VERIFIED)

The recovery mechanism is `buildIncumbentSeats` (`tournamentOrchestrator.js:641-669`), used by the Tue–Fri duty `runWeekdayFanout` (`:573`, call at `:612`). It builds seats from **two** sources:

1. **Incumbents** — agents that already have a tournament battle, from `latestTournamentBattlesByAgent` (`:645-655`).
2. **Draft-stream catch-up** — for **any** agent whose id is *not* in the incumbent map, it falls back to that agent's drafted picks from the durable agent-draft stream and pushes a catch-up seat (`:656-665`; `counters.catchupSeats`, whose sibling `summary.mondayCatchupSeats` at `:614` is literally named for this).

Why the skipped member lands in bucket #2, not #1: `latestTournamentBattlesByAgent` filters to `gameMode === TOURNAMENT_GAME_MODE` **and** `groupId == groupId` (`:280-295`, filter at `:288`). The blocking casual battle has neither the tournament gameMode nor a `groupId`, so it is **invisible** to the incumbent map — the Monday-skipped member is genuinely absent from `latest.keys()` and correctly receives a catch-up seat (VERIFIED, `:288`).

The catch-up seat's draft data always exists: the Monday pipeline writes the draft stream (`picksByAgent`, one entry per agent) at draft-resolution **before** the deploy stage (`tournamentAgentDraft.js:101` init, `:271-273` write; pipeline step order `orchestrator.js:537` before `:551`). The deploy-stage skip never touches the stream, so a skipped agent is still enumerated by `seatsFromDraftStream` (`:391-409`). (Verifier correction: the stream holds one seat *per agent* for all **four** seats — `GROUP_SIZE=4`, `leagueTournament.js:71` — each carrying six *symbols*; the earlier "six seats" wording was imprecise and does not affect the conclusion.)

`fanOutDeploys` then re-POSTs for the catch-up seat — its "today's battle exists" guard reads the same tournament-only map, in which the skipped agent has no entry, so the guard passes and a deploy is issued (`:331-338, :365`). That re-POST routes back into `runPrescribedTournamentDeploy` (`FLAT6_GAME_MODE === TOURNAMENT_GAME_MODE === 'baggerbomb_tournament'`, `agentGameModes.js:37`).

**Contingency (VERIFIED):** recovery is not unconditional — the Tuesday re-POST re-runs the same active-battle check (`decide.js:1091-1113`). It succeeds **only because the casual battle has expired by then**: a `'fullday'` casual battle deployed before Monday's close expires **Monday 4 PM ET** (see Track B), which is past by the Tuesday pre-noon fan-out. `decide.js:1115-1119` then marks the expired battle `completed` and proceeds to `createAgentBattle` (`:1146`). So recovery lands **Tuesday** in the common case.

**No competing backstop exists** and none blocks the retry:
- The training backstop `sweepTrainingActivation` is `isTraining`-scoped (`:806-807`) and `runWeekdayFanout` excludes training (`:579`) — disjoint populations, so the weekday-fan-out catch-up **is** the entire recovery path for competitive pods (VERIFIED).
- No per-week idempotency blocks Tuesday: duty markers are per-ET-**date** (`dutyMarkerKey = ${etDate}:${duty}`, `:135-137`), so each weekday runs a fresh fan-out.
- No failure cooldown is set on the skip: `decide.js` returns **HTTP 200** with `battleCreated:false`, which `fanOutDeploys` scores as a success (`response.ok`, `:370-375`) and never enters the cooldown branch (`:377-379`) — so nothing gates the next day.

**Whole-week absence is reachable but requires sustained behavior** (VERIFIED open-question): if the user re-deploys a fresh casual battle every day (e.g., each evening after 4 PM ET, giving next-trading-day expiry), `decide.js:1103` re-skips every weekday and the member is absent all week. A single deploy does not do this. (Edge: a casual battle deployed *Monday after 4 PM* expires Tuesday 4 PM, slipping recovery to Wednesday.)

### A2. What the user sees → **silent omission** (VERIFIED); scoring → **survives at 1.5× user half** (VERIFIED)

**Render — the agent layer is omitted, not zeroed or errored.** The pod arena reads the member's battle via `useMyTournamentBattle(groupId)`, whose query is `ownerId==uid AND groupId==groupId` (`src/hooks/useMyTournamentBattle.js:34-38`). The casual battle has no `groupId`, so it never matches; `pickCurrentTournamentBattle` returns `null` on the empty set (`src/constants/leagueTournament.js:643-655`, no throw). With `myBattle=null`, the live arena is gated out (`LeagueParticipantView.jsx:202`, `if (... && myBattle && ...)`) and the classic `Flat6BattleView` is gated out (`:276`, `!isForming && myBattle &&`). `Flat6BattleView` has no agent-pending empty state, so the agent layer is simply **dropped — no zero placeholder, no error boundary** (VERIFIED). On a *rival's* view the affected user still appears as a seat scored from `getWeeklyComposite` (`buildArenaModel.js:138`) — they look like a low-scoring member, never a missing one.

**Notification — fully swallowed (triply silent):**
1. No battle created (the bug).
2. **No shadow-log** — `logDecision` is called only on the legacy path (`decide.js:556, :714`); `runPrescribedTournamentDeploy` never calls it, so the prescribed skip leaves no diagnostic trace.
3. **The orchestrator counts it as a successful deploy** — `fanOutDeploys` only checks `response.ok` (`:370`); the 200 skip passes, it logs `deployed [...]` and does `out.deployed++` (`:374-375`), never inspecting `battleCreated` in the body. The Monday deploy is server-to-server with `Bearer CRON_SECRET` (`:228`), so the user's browser never receives the response at all.

**Scoring — the composite is salvageable.** `computeComposite(agentPoints, userPoints) = (agentPoints||0) + 1.5*(userPoints||0)` (`src/constants/leagueTournament.js:662-664`; `USER_LAYER_K = 1.5` at `:894`). A missing agent half is a clean `0`, not a throw or NaN. Banking writes `agentPoints=0` for the never-deployed member (`tournamentBanking.js:308`, `compositePoints = 1.5×totalPoints` at `:318`); day-1 `priorAgent` is undefined so `carry=0` and the degraded-carry arm (`:301-306`) does **not** fire — `isFinalSnapshotDegraded` stays false, so it does **not** block week-lock (VERIFIED). Reconciled with A1: the agent half is `0` **for Monday**, then scores Tue–Fri once the catch-up battle exists — **one lost day of agent points, not a lost week** (this corrects the initial "hard 0 for the whole week" phrasing; the whole-week 0 is the sustained-redeploy worst case only).

---

## Track B — Expiry semantics vs. the Monday open (the collision window)

### What `'1d'` means (VERIFIED)

A casual (vs-CPU) deploy sends no `gameMode`, so it flows through the legacy path (`decide.js:229`) and calls `createAgentBattle` with `duration = req.body.duration || '1d'` (`decide.js:691`). But `AGENT_BATTLE_DURATION_MODE === 'fullday'` (`agentBattleService.js:23`), which **discards** the `'1d'`: expiry becomes `computeFullDayExpiry(portfolio)` (`:92-96`) and the stored `duration` field is hard-coded `'fullday'` (`:113`). `computeFullDayExpiry` → `getNextMarketClose` (`:337`), whose close is **16:00 ET** for stocks, **20:00 ET** with crypto, **13:00 ET** on early-close days (`marketSchedule.js:234-237`).

> **Concrete answer:** `'1d'` means **"until the next market close" (an end-of-trading-day boundary)** — *not* wall-clock 24h and *not* a calendar day.

### What counts as "non-expired" (VERIFIED)

The prescribed-deploy query filters `agentId==agentId AND status=='active'`, limit 1 (`decide.js:1091-1095`). `isExpired` is truthy only when `expiresAt` is present **and strictly `< now`** (`:1100`); otherwise the deploy early-returns `battleCreated:false` (`:1103-1113`). Two consequences:
- A `status:'completed'` (uncleaned) battle **cannot block** — it doesn't match the `status=='active'` filter at all.
- An **active-but-expired** battle does **not** block — it is marked `completed`/`expired` (`:1115-1119`) and the deploy proceeds. Only a **non-expired active** battle blocks. (Real casual docs always carry a concrete `expiresAt` ISO string — `agentBattleService.js:117` — so the comparison branch always runs.)

### The collision arithmetic — which deploy moments are exposed (VERIFIED by re-derivation)

`getNextMarketClose` returns *today's* close only if it is a weekday, non-holiday, **and** now is before that close; otherwise it rolls forward to the **next trading day's** close (`marketSchedule.js:241` vs `:247-256`). The Monday pipeline first-fires at the **first morning orchestrator tick** — cron `*/10 11,12,13,14,21,22,23 * * 1-5` UTC (`vercel.json:163`) = **06:00 ET (EST) / 07:00 ET (EDT)** for the morning arm, all "morning" ticks routing to `MONDAY_PIPELINE` (`tournamentOrchestrator.js:111,:121-123`), idempotent per day. So the exposed window **closes at ~06:00–07:00 ET Monday**, not 09:30.

| Casual deploy moment | `expiresAt` | Still active at the Monday pipeline? | Verdict |
|---|---|---|---|
| **Wed / Thu afternoon** | that day 4 PM ET | No — days past | **SAFE** |
| **Fri after 4 PM ET** | Mon 4 PM ET (rolls fwd) | Yes | **EXPOSED** (window opens exactly at Fri 16:00:00 ET) |
| **Saturday** | Mon 4 PM ET | Yes | **EXPOSED** |
| **Sunday 7 PM ET** | Mon 4 PM ET | Yes | **EXPOSED** |
| **Mon 8:45 AM ET** | Mon 4 PM ET | Pipeline already ran (~6–7 AM) | **NOT exposed** — a casual deploy this late is instead *blocked by the pod battle* (reverse direction, safe — Track C) |

**Exposed window = `[Friday 16:00 ET, first Monday-morning orchestrator tick ≈ 06:00 ET EST / 07:00 ET EDT)`.** The exposure is a function of the *target trading day*, not elapsed time: any deploy whose `getNextMarketClose` rolls to Monday is exposed. (The task's "Mon 8:45" example lands just **past** the window; it was reclassified from "exposed" by the completeness-critic pass and re-verified against the cron.)

Wrinkles (none flip a stocks verdict): **crypto** (8 PM close) only *amplifies* the already-exposed cases (Mon 8 PM instead of 4 PM); a Friday 16:00–20:00 ET crypto deploy is actually **safe** (same-day 8 PM close). **Early-close (1 PM)** and **holiday Mondays** shift the timeline rather than change the Fri-close-opens-the-window conclusion (`marketSchedule.js:236, :250, :207`).

---

## Track C — All claimants of `activeBattleId`

**Exactly four non-null setters, all in the fenced `decide.js`** (VERIFIED), each keyed on `agentRef = agents/{request.agentId}` (`decide.js:123`):

| Setter | Site | Trigger | Value | Live at Monday open? |
|---|---|---|---|---|
| #1 | `decide.js:553` | Legacy CC deploy, sync-to-existing early-return | existing battle id | **Yes** — casual battle non-expired through Mon close |
| #2 | `decide.js:700` | Legacy CC deploy, new battle | new casual battle id | **Yes** — this is the pointer that later blocks the pod |
| #3 | `decide.js:1104` | Prescribed tournament deploy, sync-to-existing early-return | existing battle id | **Yes** — *the bug's return path* (competitive → writes the **real** agent) |
| #4 | `decide.js:1164` | Prescribed tournament deploy, new tournament battle | new tournament battle id | **Yes** — created `status:'active'`, fullday expiry |

**Clearers — only two, both in the eval cron on completion:** `agent-evaluate.js:3595` (tournament/no-stats branch) and `:3625` (stats branch), keyed on `battle.agentId` (`:3592`). They fire **only** when the cron finds a `status=='active'` battle past `expiresAt` (`findActiveAgentBattles` is `status=='active'`-only; trigger at `agent-evaluate.js:153`). A battle whose `expiresAt` is still future keeps `activeBattleId` set — that is the collision window.

**Training is NOT a second collision source** (VERIFIED): a training pod's human seat resolves to a **distinct clone agentId** (`resolveGroupAgents` → `trainingCloneDocId`, `tournamentAgentBoards.js:311`; ranked seats exclude clones via `isTrainingClone !== true` at `:326`). The clone doc is seeded `activeBattleId: null` (`trainingClone.js:113`). Because the four setters write `agents/{request.agentId}` and a training deploy carries the clone id, **the real ranked agent's `activeBattleId` is never touched during training** (matches the ledger's "training clones, competitive doesn't").

**Reverse direction already safe** (VERIFIED): every battle is created `status:'active'` (`agentBattleService.js:107`) with fullday expiry. A live **tournament** battle (real agent) trips the legacy CC deploy's own gate (`decide.js:535-585`) and early-returns `battleCreated:false` — so a user whose agent is in a League battle **cannot start** a Command-Center deploy over it.

**Client cannot set it** (VERIFIED): `activeBattleId` is in `SETTINGS_GUARDED_FIELDS` and `updateAgent` throws if present (`src/services/agentService.js:158-168`). All writes are the four server-side sites.

**Bonus finding (report-for-separate-tasking, BUILD_RULES §3):** a **narrow stale-pointer window** exists. `decide.js` marks the prior battle `completed` **without** clearing `activeBattleId` (`:1115-1119`; legacy mirror `:588-592`), relying on the subsequent setter to overwrite. If `createAgentBattle` then throws, `activeBattleId` is left pointing at a now-`completed` battle, and the cron never re-clears it (it only sees `status=='active'`). The equip/change guards treat any truthy `activeBattleId` as battle-locked (`equip-lean.js:115` and siblings), so the agent stays falsely locked until the next successful deploy overwrites the pointer. Not part of G2; flagged for separate triage.

---

## Track D — Where can a fix live? (fenced vs. non-fenced)

The Command-Center deploy chain is: client `deployAgent` (`src/services/agentDeploy.js:14`) → `POST /api/agent/decide` **directly** (`:26`, no intermediate service) → Vercel file-routing → `api/agent/decide.js`, whose **default export is the entire handler** (`decide.js:81`). There is **no `vercel.json` rewrite and no edge middleware** in front of it. `decide.js` is **fence item #1** (`BUILD_RULES.md:15`).

| # | Candidate fix | Exact site | Fenced? | Notes / cost |
|---|---|---|---|---|
| 1 | **Block the conflicting deploy, server-side** | inside `decide.js` (the only server chokepoint; `:89` middleware is generic/pod-unaware and called *from within* the fenced handler) | **FENCED** | The clean "you battle Monday — deploying now locks you out" guard **must** live in the fenced handler. **No non-fenced server point exists on the user's own deploy path.** |
| 1b | **Block the conflicting deploy, client-side** | `agentDeploy.js` / Command-Center CTA; the "user has a Monday pod" signal exists non-fenced at `leagueTournament.js:92` | **non-fenced, but UX-only** | Not integrity — bypassable by a direct API call. Effective for a normal user; pairs well with (A) as defense-in-depth. |
| 2 | **League takes precedence — force-complete the blocker at the tournament deploy** | `decide.js:1096-1120` | **FENCED** (founder-gated) | Lost: the user's in-flight casual battle **and its result**. |
| 3 | **Improve/rely on Tue–Fri recovery** | `tournamentOrchestrator.js:657` (`buildIncumbentSeats`) | **non-fenced** | **Already exists** and turns week→day automatically (Track A1). Mitigation, not a fix; leaves Monday absent. No-loss. |
| 4 | **League precedence executed non-fenced (orchestrator pre-deploy force-complete)** | `fanOutDeploys` before the `fetchImpl` POST, `tournamentOrchestrator.js:363` | **non-fenced** | The orchestrator holds `db`; it could set the blocking battle `status='completed'` before POSTing, so the fenced check passes. **Critical nuance:** the gate is the *battle collection* (`status=='active'`), **not** `agent.activeBattleId` — so a fix must complete the **battle doc**, not null the field (`decide.js:1092`). Same loss as (2): destroys the casual battle. |

### Recommendation

1. **Ship a non-fenced client-side guard now (1b):** in the Command-Center deploy CTA, when the user's agent belongs to an `AWAITING_OPEN`/Monday-anchored competitive pod, **warn or block** the casual deploy ("Deploying now will lock your agent out of Monday's League pod"). Non-fenced, no fence entry, no data loss, and it prevents the collision for the ordinary user — the realistic launch actor. It is UX, not integrity; state that plainly.
2. **Kill the silence regardless of which fix is chosen (non-fenced, high value / low risk):** have `fanOutDeploys` parse the 200 response body and, on `battleCreated:false`, count it as a *conflict* (not `deployed++`) and log it loudly for founder attention (`tournamentOrchestrator.js:370-375`). This converts a triply-silent absence into a visible, monitorable event — the single most dangerous property of G2 today.
3. **Decide the integrity fix as an explicit founder call.** True server-side integrity is **fenced** either way: (A) block inside `decide.js`, or (2) force-complete inside `decide.js`. The non-fenced orchestrator variant (4) achieves precedence without a fence edit but still **destroys the user's in-flight casual battle** — the same product loss as (2), just relocated. If League-always-wins is the product intent, (4) is the non-fenced way to get it; if preserving the casual battle matters, only the client guard (1b) + existing Tue recovery (3) avoid the loss, at the cost of a one-day Monday gap.

**Founder-gated boundary (explicit):** any fix that blocks or force-completes *inside* `decide.js` touches the calibration fence (BUILD_RULES §1) and is allowed only via the sanctioned fence entry. This discovery does not make that edit; it isolates the decision so it can be made deliberately.

---

## Deliverable summary

1. **Severity:** **day-one (Monday) gap**, auto-recovered Tuesday by the existing draft-stream catch-up (whole-week only under sustained daily re-deploys). **User sees nothing** — agent layer omitted, triply silent. **Composite survives** at 1.5× user half; agent half a clean 0 for Monday only.
2. **Expiry/window:** `'1d'` = next market close (`'fullday'` mode), not 24h. **Exposed = Fri-after-4 PM ET through the first Monday-morning tick (~6–7 AM ET): Fri-close, Sat, Sun.** Wed/Thu safe; Mon 8:45 AM is past the window (reverse-safe).
3. **Claimants:** four setters (`decide.js:553/700/1104/1164`), two clearers (`agent-evaluate.js:3595/3625`); training writes the clone, not the real agent; reverse direction safe; client cannot set it. Bonus: a narrow stale-pointer edge for separate tasking.
4. **Fix sites:** **no non-fenced server block on the user's deploy path** (`decide.js` is the fenced handler). Recommend a **non-fenced client guard + non-fenced silence-removal now**; the true integrity fix (block or force-complete) is a **fenced, founder-gated** call — or accept the day-one gap that already self-heals.

**STOP. No fix applied. No project-state writes.**
