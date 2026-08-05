# Read-only trace: agent → active battle → agent-evaluate pickup, + shortest path to 4 battles (one per archetype)

**Session preamble (BUILD_RULES §2/§3):** branch `claude/agent-active-battle-trace-xe7ukp`; HEAD `85eeca6f` (== `origin/main` after `git fetch origin`); clean tree. Read-only: no writes to project state. All citations VERIFIED = read this session at HEAD `85eeca6f`.

---

## Executive verdict

| Question | Answer |
|---|---|
| What does the cron treat as an "active battle"? | Any `agentBattles` doc with `status == 'active'`. That's the entire pickup filter. |
| Who writes `status: 'active'`? | Exactly one function: `createAgentBattle` (agentBattleService.js:115) — fenced doc-shape, but **callable**. |
| Who calls it in production? | Two sites, both in `api/agent/decide.js`: the **self-select** deploy (:891) and the **prescribed-tournament** deploy (:1433). |
| How many archetypes? | Six (`VALID_ARCHETYPES`): momentum_chaser, contrarian, diversifier, degen, analyst, guardian. |
| Shortest path to 4 battles, one-per-archetype (recommended) | Create 4 agent docs via `buildCpuAgentDoc(1..4)` (4 distinct archetypes by construction) → `POST /api/agent/decide {agentId, ownerOdUserId}` ×4 with `Bearer $CRON_SECRET`. Yields exactly 4 `status:'active'` battles. |
| Fully deterministic alternative (no AI, no market data) | One Node script that calls the exported `createAgentBattle` ×4 with a hand-built `lastDecision.portfolio`. |
| agent-evaluate cadence | `*/15 13–21 UTC Mon–Fri` (vercel.json:135). Expiry runs every tick; **evaluation only when market open**. |

---

## Part 1 — How the cron picks up an active battle

1. **Cron entry.** `api/cron/agent-evaluate.js` runs on `*/15 13,14,15,16,17,18,19,20,21 * * 1-5` (vercel.json:134-135). Auth = `x-vercel-cron` header / `Bearer CRON_SECRET` (house pattern).
2. **The pickup query.** The handler calls `findActiveAgentBattles(db)` (agent-evaluate.js:201), which is:
   ```js
   // agentBattleService.js:39-46
   db.collection('agentBattles').where('status', '==', 'active').get()
   ```
   **That single equality filter is the entire definition of "picked up."** No other field gates entry into the loop.
3. **Expiry split (runs regardless of market hours).** For each active battle, if `expiresAt < now` it is completed via `completeBattle` (agent-evaluate.js:204-232); otherwise it's pushed to `activeBattles` for evaluation (:234).
4. **Market-hours gate applies to *evaluation only*.** After expiry handling, `if (!isMarketOpen()) return {skipped, reason:'market_closed'}` (agent-evaluate.js:274-277). So an active battle is *found and expiry-checked* every tick, but only *scored / Haiku-swapped* during market hours.
5. **Empty short-circuit.** `if (activeBattles.length === 0) return {message:'No active agent battles'}` (agent-evaluate.js:292-293).
6. **Processing.** Survivors are fair-rotation sorted (:313-315) and run through `processAgentBattle` under a time budget (:317-331).

**Consequence:** to make the cron "pick up" battles you only need docs with `status:'active'`. To make it *evaluate* them you additionally need the market open and (for real scoring) usable prices.

## Part 2 — How an agent *gets into* an active battle

`status:'active'` is written in exactly one place — `createAgentBattle` (agentBattleService.js:63, `status:'active'` at :115). It throws if `agentData.lastDecision.portfolio` is missing (:93-95) and stamps `agentContext.archetype = agentData.archetype` (:166). Its two production callers:

### Path A — self-select ("casual"/tiered) deploy
- **Entry:** `POST /api/agent/decide` with body `{ agentId }` (decide.js:93, 108-111). Client callers authenticate with a Firebase ID token + ownership; **internal callers** use `Authorization: Bearer $CRON_SECRET` and are rate-limit-exempt (decide.js:80-82, 98-101, 161-171). No `gameMode` → legacy path (decide.js:292 fork is skipped).
- **Guards:** deploy lock `deployingAt<120s` → 429; per-agent cooldown `lastDeployedAt<120s` → 429 (decide.js:174-188). **No market-hours gate on creation** (decide.js has no `isMarketOpen`).
- **Work:** runs the AI decision (strategy + portfolio), then the **one-active-battle-per-agent guard** (decide.js:690-694) — a live battle short-circuits with `battleCreated:false`.
- **Preconditions:** `indexIntelligence/stockRankings` must exist (decide.js:297-298) and pricing must pass the **baseline gate** (decide.js:821-834) — else 503 `pricing_unavailable`.
- **Create + wire-up:** `createAgentBattle(...)` (decide.js:891) → `agentRef.update({ activeBattleId: battleResult.id })` (decide.js:906). Tiered battle, embeds a CPU opponent.

### Path B — prescribed-tournament deploy (FLAT6)
- **Entry:** same URL, body `{ agentId, gameMode:'baggerbomb_tournament', groupId, prescribedPortfolio:[6 symbols], ownerOdUserId, isCpu?, userPicks*... }`. **Internal caller only** — the tournament-only fields are refused for client callers (decide.js:137-143). Forks at decide.js:292-294 → `runPrescribedTournamentDeploy` (decide.js:1277).
- **Work:** requires `groupId` (joint-stamp, :1283), validates the six against the ranked universe (:1297), enriches (`enrichPrescribedPortfolio`, :1252), same one-active-battle guard (:1339-1343) + baseline gate (:1398), **no AI, no CPU opponent** (founder D4).
- **Create + wire-up:** `createAgentBattle(..., {gameMode:FLAT6, groupId, isCpu, tournament:{...}})` (decide.js:1433) → `activeBattleId` writeback (:1454).
- **Who calls it in prod:** the orchestrator. `buildDeployRequest` (tournamentOrchestrator.js:223-243) posts to `/api/agent/decide` with `Bearer CRON_SECRET`; the deploy loop (tournamentOrchestrator.js:330-405) reads the body and **only counts `battleCreated:true` as `deployed`** (a 200 with `battleCreated:false` is surfaced as `skipped`, per the G2 audit, :377-397). Live: `TOURNAMENT_DEPLOY_ENABLED = true` (tournamentOrchestrator.js:98). Triggered by the `tournament-orchestrator` cron (vercel.json:162-163) or manually via `POST /api/tournament/run-duty` (run-duty.js).

### End-to-end diagram
```
              ┌── Path A: POST /api/agent/decide {agentId}  (AI self-select, tiered)
 deploy ──────┤                                                   │
              └── Path B: POST /api/agent/decide {gameMode:FLAT6,  │  createAgentBattle()
                   groupId, prescribedPortfolio[6]} (orchestrator) ┘  status:'active'  (agentBattleService.js:115)
                                                                          │  + agentRef.activeBattleId = battle.id
                                                                          ▼
   agent-evaluate cron  ──  findActiveAgentBattles(db)  where status=='active'  (agentBattleService.js:39)
   (*/15 13-21 UTC M-F) ──  expiry sweep (always) → market-hours gate → processAgentBattle
```

## Part 3 — The archetypes

`VALID_ARCHETYPES = Object.keys(ARCHETYPE_CONFIGS)` (agentArchetypeConfig.js:247) = **momentum_chaser, analyst, diversifier, contrarian, degen, guardian** (six). CPU/system agents get archetypes by a frozen round-robin `CPU_ARCHETYPE_ORDER[(n-1)%6]` (leagueTournament.js:367-378):

| CPU n | archetype |
|---|---|
| 1 | momentum_chaser |
| 2 | contrarian |
| 3 | diversifier |
| 4 | degen |
| (5) | analyst |
| (6) | guardian |

**CPUs 1–4 are four distinct archetypes by construction** (leagueTournament.js:363-364) — the natural "one per archetype" set for four battles.

---

## Part 4 — Shortest path to stand up four battles, one per archetype

There is **no single endpoint** that stands up agent battles: `seed-tournament-group` seeds only the user layer (a `tournamentGroups` doc), and `seed-tournament-bracket` seeds groups + CPU agents + user boards — neither writes `agentBattles`. Battles come only from the two `decide.js` create paths above. Ranked options:

### ✅ Recommended — self-select on 4 purpose-built agents (exactly 4, controlled archetypes)
1. Create four agent docs with distinct archetypes. Reuse the existing factory so config/ownerId are valid by construction:
   - `agents/cpu-agent-1..4` via `ensureCpuAgents(db,[1,2,3,4],nowIso)` (tournamentCpu.js:101-116), or write `buildCpuAgentDoc(n)` (tournamentCpu.js:63-93) directly. Archetypes = momentum_chaser / contrarian / diversifier / degen; `ownerId='cpu-{n}'`, `isCpu:true`.
2. For each n in 1..4:
   ```
   POST /api/agent/decide
   Authorization: Bearer $CRON_SECRET          # internal caller → rate-limit exempt
   { "agentId": "cpu-agent-<n>", "ownerOdUserId": "cpu-<n>" }
   ```
   Internal + no tournament fields ⇒ legacy self-select path (decide.js:161-171, 292); ownership asserted (:166). Each call runs the AI, then `createAgentBattle` ⇒ one `status:'active'` tiered battle (decide.js:891-906).
3. `agent-evaluate` picks all four up next tick (`status=='active'`).
- **Preconditions:** `indexIntelligence/stockRankings` populated + EODHD pricing usable (baseline gate, decide.js:821), `CLAUDE_API_KEY`, `CRON_SECRET`. Per-agent 2-min cooldown is *per agent* — four distinct agents don't collide.
- **Why not `create-profile`:** it only *derives* an archetype via Haiku and does **not** persist an agent (create-profile.js:203) — you can't force the archetype through it.

### ⚙️ Deterministic alternative — one script, direct `createAgentBattle` (no AI, no market data)
`createAgentBattle` is fenced doc-shape but **callable** (BUILD_RULES §1). A one-off Node script:
```js
for (const n of [1,2,3,4]) {
  const agentData = { id:`cpu-agent-${n}`, ...buildCpuAgentDoc(n, now),
    lastDecision: { portfolio: { star:[A,B], core:[C,D], support:[E,F] },  // 6 real symbols
                    bench:{ stocks:[], crypto:null } } };
  const thresholds   = { /* {symbol:{threshold,rallyThreshold,moonshotThreshold}} */ };
  const startingPrices = { /* {symbol: price} */ };
  await createAgentBattle(db, agentData, thresholds, startingPrices, { duration:'1d', sectorMap });
}
```
Writes four `status:'active'` docs directly; the cron picks them up on the next tick. Needs no `stockRankings`, no EODHD, no Anthropic. Caveat: you supply `portfolio`/`thresholds`/`startingPrices` yourself (`createAgentBattle` throws without `lastDecision.portfolio`, agentBattleService.js:93-95). Using the exported factory keeps the doc shape intact — no fence edit.

### 🏛️ Most faithful (existing dev buttons only, but >4 battles) — tournament seed + run-duty
1. `POST /api/admin/seed-tournament-bracket` `{ founderUserId, games: 2 }` (admin secret) → dev groups + CPU agents; **game 2 = 4 pure CPUs (degen/analyst/guardian/momentum_chaser)** + committed boards (seed-tournament-bracket.js).
2. `POST /api/tournament/run-duty` `{ duty:'monday_pipeline', simulatedNow:'<a Monday ISO>' }` (admin secret) → board production + agent-draft + prescribed deploy over dev groups (`includeDevGroups:true`, run-duty.js:64; `TOURNAMENT_DEPLOY_ENABLED=true`).
- Yields tournament `status:'active'` battles for the CPU agents. **Caveat:** deploys *all* dev groups → ~8 battles for `games:2` (game 1 also needs the founder's own agent + board), so it's not a clean "exactly four." Heaviest machinery; also depends on the ranked universe.

---

## Caveats / notes for whoever executes this
- **Fence:** `decide.js`, `agentBattleService.js` (incl. `createAgentBattle` doc shape), `agentArchetypeConfig.js` are §1-fenced — *reading/calling is fine, editing is not.* None of the paths above edit fenced code.
- **Preview/pricing dependency:** Paths A and the tournament path both need `indexIntelligence/stockRankings` present and prices usable; on Vercel preview the rankings cron doesn't run (the seeders themselves 503 with "rankings cron may not have run"). Only the deterministic script sidesteps this.
- **Verification:** don't trust a 200 from `decide` as proof of a battle — check `battleCreated:true` / the returned `agentBattleId` (the G2 lesson, tournamentOrchestrator.js:377). Confirm by querying `agentBattles where status=='active'`.
- **Out-of-scope defects found:** none requiring a fix; no bug filed (BUILD_RULES §3).
