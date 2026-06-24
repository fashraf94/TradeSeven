# User-Capability + Screener — Read-Only Extract
### FantasyTrades · grounding for archetype hand-off (Zone 4) · 2026-06-24

**Repo:** `/home/user/TradeSeven` · **HEAD:** `f8c2316` · **Mode:** read-only map. No edits, no build, no plan changes. Citations are `file:line` + VERIFIED (read this session) / ASSUMED.

---

## Executive verdict — honesty of each candidate hand-off, by mode

The question behind this extract: every *"that's your lever to pull"* line assumes the user has levers. Here is what's real, so we author honestly.

| Hand-off line | Standard (non-tournament) battle | Tournament battle |
|---|---|---|
| **"Go do that trade yourself" (short / hedge / buy / sell)** | ❌ **Dishonest** — the user has **no trade lever at all** | ✅ **Honest** — flip (long↔short) + claim are real, user-authed |
| **"Pick that stock yourself"** | ❌ Dishonest — agent owns 100% of selection | ⚠️ **Partly** — only via a *ranked board* (setup); direct pick is training-only/dark-gated |
| **"Coach me a directive / equip a watchlist"** | ✅ **Honest** — the only real standard-mode user levers (both advisory) | ✅ Honest |
| **"Go run that screen yourself" (standalone, bring results back manually)** | ✅ **Honest now** — the screener is live | ✅ Honest now |
| **"I'll reason over your screen results here in chat"** | ❌ **Dishonest today** — future-build | ❌ Dishonest today — future-build |

**Bottom line for Zone 4:** the "point at your own levers" hand-off is **tournament-only**. In standard battles the user is a spectator-owner who can *coach* (chat directive) and *pre-load* (watchlist) but cannot trade — so a "do it yourself" line there promises a lever that doesn't exist. The screener is a real lever a user can run, but the agent **cannot ingest its results in chat today** (that round-trip is a small future build).

---

## Part 1 — User capability surface

### A. Standard / tiered (non-tournament) battle → **watch + coach only**

Once an agent deploys, **the agent owns 100% of stock selection and every trade executes server-side** (cron Haiku + an autonomous risk layer via `executeSwapServer`, `agent-evaluate.js:1046-1057`). The user is `ownerId` — a spectator-owner, not a trader (`agentBattleService.js:100`).

| User action | Where | What it mechanically does | Status |
|---|---|---|---|
| Chat a directive | `chat.js:130`, written `:458-470` | Gemma may extract a tactical directive → `battle.directive`, injected into Haiku's eval prompt (`agentEvalPromptAssembly.js:936`) as **advisory** text Haiku can override. Budget 10 turns. | LIVE (indirect) |
| Equip a watchlist **before** deploy | `agentBattleService.js:167-169`; equip blocked mid-battle `equip-watchlist.js:33` | Biases the agent's candidate universe at draft — does **not** dictate picks. | LIVE (pre-deploy) |
| `strategyPreset` knob | `firestore.rules:208-211`; `agent-evaluate.js:461` | Tunes the agent's risk posture (aggressive/balanced/defensive). | LIVE (knob) |
| Film-room / grades / bookmarks | `chat.js:183`; `firestore.rules:208-211` | Review-time metadata; no trading. | LIVE (metadata) |
| **Buy / sell / swap / short / hedge / flip / claim / double-down** | — | **None exist in standard mode.** The agent API dir has only `decide, chat, debate, reflect, set-opponent, change-archetype, equip/unequip-watchlist, …` — no user-trade endpoint. The owner-writable Firestore whitelist (`firestore.rules:208-211`) contains **no ticker/position field**. | ❌ absent |
| Approve / veto a proposed trade | — | **Built but launch-guarded dead.** `executionMode` is hard-coded `'autopilot'` (`agentBattleService.js:201`); the proposal lifecycle force-resolves as `auto_executed` with no user veto (`agent-evaluate.js:2252-2265`, real logic annotated "PRESERVED FOR POST-LAUNCH … Unreachable"). Client UI unmounted (`AgentBattleScreen.jsx:18,26,1013`; backlog `AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md:85-89`). | ❌ dead (copilot/manual) |

### B. Tournament battle → **real user levers (a two-market game)**

| User action | Where | What it does | Limits |
|---|---|---|---|
| **Board commit** (setup-time stock selection) | `commit-board.js:35-88`; `tournamentBoards.js:68-102`; UI `BoardEditor.jsx` | Rank a **15–20-name board** drawn from `group.userPool`; the user's 3 actual holdings are the deterministic snake-draft output of that board (`resolve-user-draft.js resolveSnakeDraft`, all opening **LONG**). | only while `group.status===FORMING` |
| **FLIP long↔short** (this is how a user goes SHORT) | `flip.js:72-271` | Reverse the direction of **one held pick** — does **not** add a new ticker, reverses one already held. | ≤5/day/pick (`FLIP_CAP_PER_DAY`); `status===BATTLE` |
| **CLAIM** (overnight roster swap) | `place-claim.js:45-124` | Drop a held pick, add a `userPool` name — the **only** mid-battle path that changes *which* tickers the user holds. | ≤3 pending/cycle; window 4:00 PM–9:24 AM ET; not on last day |
| Double-down | `flip.js:209-232`; `tournamentAgentLedger.js:211-281` | **Derived marker**, not a button: fires when a user flips onto a symbol their own agent already holds — the concrete user-layer↔agent-layer coupling. | n/a |
| Direct "click this exact stock" | `training-pick.js:76-124` | A live on-the-clock interactive pick — **but dark-gated** (`LEAGUE_NEXT_ARC_ENABLED`/`?nextArc=1`, `:80-82`) and **training-pods only** (no-stakes, excluded from ranked). | ❌ not live in ranked play |

*Banking, claim-resolution, draft-resolution, ledger reconcile are all admin/cron-secret server passes — never user actions.*

### C. The "own stocks" gap — answered

- **Standard mode:** the user selects **nothing**. Stock selection is entirely the agent's (Sonnet shortlist + Haiku portfolio, `decide.js:293-393`). The closest influence is the advisory chat directive or a pre-deploy watchlist — neither is selecting/buying a position.
- **Tournament mode:** the user *does* select their own stocks, but **indirectly and bounded** — they rank a board from `group.userPool` and the engine assigns the 3 finalists by snake draft. Direct free choice exists only in dark-gated training pods.
- **There is no mode where a user freely buys arbitrary stocks** (e.g. "go load up on high-beta names yourself") separate from the agent. The nearest real surface is the tournament board, capped to the group pool. So a "go find the juice yourself and buy it" hand-off has **no honest live target** — only the bounded board (tournament setup) or the screener-as-research (below).

---

## Part 2 — The screener ("Research Engine")

A four-phase feature, each file self-labeled as a phase of one engine.

### What / where / wired — **WIRED, live-reachable**
| Piece | File | Role |
|---|---|---|
| Deterministic filter core | `api/_utils/screenStocks.js` | Pure (no net/model/Firestore): validates a spec against an inline allowlist, AND-filters, ranks, projects rows. Also `screenIndustries` (rollup). |
| NL chat endpoint | `api/screener/chat.js` | `POST /api/screener/chat`. **Gemma** translates the user's plain-language request → structured `screenSpec`, runs the core against the daily `indexIntelligence/stockRankings`. Own `researchSessions` collection — **no agent, no battle**. |
| UI front door | `src/components/Search/ScreenerView.jsx` | Single-screen research console; reached at **Search → "Screen" tab** (`SearchDiscover.jsx:12,17`; routed `App.jsx:55,9476-9488`). Has a manual **"Save as watchlist"** hand-off. |
| Presentation adapter | `src/components/Search/screenerAdapter.js` | Maps results → existing RankRow components + plain-language transparency strings. |

**Caveat (G1):** "wired" rests on a Vercel file-route convention inference (no route exclusion in `vercel.json`), not a runtime observation; and the endpoint **503s if the daily `stockRankings` doc isn't computed** (`api/screener/chat.js:278-283`). Treat as real-now with a data-freshness dependency.

### Inputs — NL-primary, structured under the hood (the real vocabulary)
The user types **natural language**; **Gemma** (`api/screener/chat.js:35-36,218`, via `buildVoiceLayerPrompt mode:'research'`) translates it into a `screenSpec` = `{ filters:[{field,op,value}], rankBy:{field,direction}, limit }`. An agent could legitimately coach only what the core executes:
- **Fields** (`screenStocks.js:29-38`): `symbol, sectorId/Name, industryName, fundamentalScore/Rank, technicalScore/Rank, sectorTechnicalRank/Total, compositeScore, baggerBombFit/Rank, atrPercentile, dailyRange, nr7Flag, bBandwidthPercentile, momentumScore/Rank, sma200_position, trend, recentAction, return1W/1M/3M/YTD/12M`.
- **Nested** (`:41-56`): `arch_scores.<archetype>` (the 6 codes — e.g. `arch_scores.degen` = "screen like a Speculator") and `momentumFactors.<key>` (12 keys: residualMomentum, intermediateRS, acceleration, heat, quality, …).
- **Ops** (`:58-60`): `gt, gte, lt, lte, eq, neq, in, between, isTrue, isFalse`. `rankBy` any field + asc/desc; default limit 10, max 25.
- **Honesty discipline (matches our gate philosophy):** any predicate naming an absent field / unsupported op / malformed value is **dropped into `rejectedFilters[]`, never silently faked** (`screenStocks.js:19-21`). So an agent can never coach a screen the engine can't run — bad criteria surface as rejections.

### Outputs
`{ results, appliedSpec, rejectedFilters, matchCount, universeSize, computedAt }` (`screenStocks.js:386-394`). `results` are **projected rows** (not bare tickers): always carry `symbol, sectorName, industryName, compositeScore, baggerBombFit, momentumScore` + any referenced field. The endpoint adds `sessionId, message, suggestedActions, dataAsOf` (`api/screener/chat.js:301-315`).

### The loop-closing question — **chat-reasoning loop is FUTURE-BUILD**
| Loop | Status | Where it lands |
|---|---|---|
| Screen → **agent reasons over results in live CHAT** | **FUTURE-BUILD** | no input channel: `chat.js:146` accepts only `{agentId,battleId,message}`; the sanitizer strips `{}` (`:154`) so pasted JSON is mangled; all context server-fetched; screener is state-isolated ("NO agent, NO battle", `api/screener/chat.js:13-14`) |
| Paste tickers as text into chat `message` | Weakly real | raw string only, **no screen facts attached** |
| Screen → save watchlist → equip → **next DRAFT** | **REAL-NOW (indirect)** | `ScreenerView.jsx:268-301` → manual equip (no auto, blocked mid-battle, `:265-267`) → `decide.js:254-273` folds into the candidate pool **at next deploy, not chat** — `chat.js` never reads `equippedWatchlistId` |

**Cleanest insertion point if you build the chat loop (small–moderate, ~2 files):** add a `researchSessionId` body param to `chat.js:146`, have the endpoint read `researchSessions/{id}.latestSpec` (+ attach results) server-side, and thread it into `buildVoiceLayerPrompt` (`chat.js:276`) as a new `buildScreenContextBlock(...)` in the battle branch — **mirroring the already-proven `researchContext`/`analysisContext` "reason over facts" precedent** (`voiceLayerPrompt.js:2476-2479`). Passing a session id (not client ticker blobs) keeps the agent reasoning over server-validated facts.

---

## What this means for authoring Zone 4 (hand-off targets)

1. **Default hand-off must branch on mode.** Author the "your own lever" line **tournament-only**: *"you could flip that long/short yourself"* (flip), *"you could claim a swap for it overnight"* (claim), *"rank it on your board"* (setup). In standard mode, the honest equivalents are advisory: *"keep coaching me — lock that as a directive"* or *"equip a watchlist before we deploy."* This is exactly the manifest gating already specced (§4.3): hand off only to a lever the per-battle manifest marks present.
2. **"Go research it yourself" is honest in both modes** — the screener is live, and the agent may name real fields/ops/recipes (e.g. *"screen `atrPercentile gt 0.8`, rank by `momentumScore`"*). But **stop short of "bring it back and I'll reason over it"** — that round-trip isn't built. Frame it as "go explore the screen," not "hand me the results."
3. **No "go buy the juice yourself" anywhere** — there's no free user stock-buy; the tournament board (pool-bounded) is the closest, and standard mode has none.

---

## Caveats / flags
- **G1** — screener "wired" is a deploy-convention inference, not a runtime check; plus the `stockRankings` 503 freshness dependency.
- **Dark-gated** — tournament lobby (`LEAGUE_LOBBY_ENABLED`) and interactive direct-pick draft (`LEAGUE_NEXT_ARC`/training) are not live in ranked play; don't hand off to them as if they were.
- **copilot/manual** — built but launch-guarded dead; if/when they ship, standard-mode users *gain* an approve/veto trade lever and the standard-mode hand-off calculus changes.

*End of extract. Read-only — no edits, no plan changes.*
