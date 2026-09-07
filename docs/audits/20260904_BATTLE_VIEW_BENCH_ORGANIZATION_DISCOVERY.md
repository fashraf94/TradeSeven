# Bench organization — the two-question discovery (V1)

**Date:** September 4, 2026
**Branch:** `claude/character-pane-phase-a3-rulings-rq17ta`
**Task:** the smoke rulings §3 — two facts, read-only. **Nothing built.**
**Method:** every claim below is VERIFIED — read at the cited line in this session. `git fetch origin` was run at session start; `origin/main` is `8e63ea65`.

---

## 1. Executive verdict

| Q | Question | Answer |
|---|---|---|
| 1 | A readable sector per bench symbol on the client? | **FOUND — but only for part of the roster.** The persisted bench carries a real `sector`; the hot bench and the equipped watchlist carry bare strings. |
| 2 | The archetype's fit score per symbol, without a new endpoint? | **NOT FOUND for the bench.** The one client-reachable source scores the top-10 of the universe plus the equipped watchlist, and needs an id the Battle View does not have. |
| — | Is the watchlist's "ranked by composite score" the same number? | **No — and it is closer to the opposite.** `compositeScore` enters `archetypeScore` **inverted**. |

**Which branch of the ruling this lands on:** neither "both FOUND" nor "only the score". Sector is *partly* found; the score is not. Under the ruling as written — *"If neither: the shape fix stands"* — the shape fix stands, and there is a real half-option worth the founder's line (§5).

---

## 2. Q1 — sector per bench symbol

### FOUND: the persisted bench, on the battle doc

`createAgentBattle` stamps a sector onto every persisted bench entry:

- `api/_utils/agentBattleService.js:160-163` — `bench: { stocks: deepCopyArrayWithSector(bench?.stocks, sectorMap), crypto: … }`
- `api/_utils/agentBattleService.js:399-406` — the helper: `const sector = sectorMap[item.symbol] || (item.isCrypto ? 'Crypto' : 'Unknown'); return { ...item, sector };`

It reaches the client whole — `src/hooks/useAgentBattle.js:32` sets `{ id: snapshot.id, ...snapshot.data() }`, no field selection. So `battle.portfolio.bench.stocks[i].sector` is readable **today, with no new call**.

Two honesty caveats, both load-bearing:

1. **`'Unknown'` is a real value, not an absence.** A symbol missing from `sectorMap` at creation is persisted as the string `'Unknown'`. A grouping built on this must render that as its own group and never as a guess.
2. **It is a creation-time snapshot.** The sector is stamped once, at `createAgentBattle`; nothing re-stamps it during the battle.

### NOT FOUND: the other two thirds of the roster

`selectBenchRoster` (`src/screens/battleView/selectBench.js:87-105`) unions three sources. Only the first carries a sector:

| Source | Shape | Sector? |
|---|---|---|
| `portfolio.bench.stocks` + `.crypto` | objects | **Yes** — as above |
| `watchlist.hotBench` | **bare strings** | No — `api/_utils/watchlistEquip.js:107-111` states it: *"hotBench is a flat array of symbol strings everywhere in the codebase (decide.js, agent-evaluate.js, agentSwapExecution.js)… entries are bare strings"* |
| `agentContext.equippedWatchlist.tickers` | **bare strings** | No — the snapshot is `{name, thesis, tickers}` (`api/_utils/agentPromptAssembly.js:64`), written at `api/_utils/resolvedAgentManifest.js:143` |

The hot bench is rebuilt by the cron every tick, so this is not a rare gap — it is most of the roster on most days.

### The client fallback map, and why it is not a substitute

`src/utils/sectorUtils.js:1-15` builds a symbol→sector cache from `SECTORS` (`src/constants/sectors.js:4`), exposed as `resolveSectorInfo(stock)` (`:45`).

**Measured coverage: 236 symbols across 12 sector groups.** It is a *top-holdings* list per sector ETF, not a universe taxonomy — `src/constants/sectors.js:11` is `topHoldings: ['AAPL', 'MSFT', …]`. A bench name outside those 236 resolves to nothing.

So the map would silently produce a third bucket — "no sector" — distinct from the doc's `'Unknown'`, and the two would disagree for the same symbol depending on which source it arrived from. **That is a §9 display-agreement violation by construction**: one displayed fact, two sources that drift.

### There is no archetype→sector preference to order groups by

Checked and absent. The only archetype/sector interactions are:
- `sectorConcentrationCap` — a **count cap** per archetype (`api/_utils/agentArchetypeConfig.js:66, 95, 122, 151, 182, 214`), 2–4. A limit, not a preference.
- `sectorDiversity` — a **dimension inside the ranking**, rewarding *underrepresented* sectors (`api/_utils/archetypeScoring.js:127-128`). It says nothing about which sector this archetype likes.

`sectorPreferences` exists (`src/services/fantasyTimesClient.js:60`) but is **the user's**, for Fantasy Times story filtering — not the agent's.

**So sector groups could be built but not ordered by conviction.** Their order would be arbitrary (alphabetical, or the doc's).

---

## 3. Q2 — the archetype's fit score per bench symbol

### What `archetypeScore` is

`computeArchetypeRankings(stocks, archetype, opts)` — `api/_utils/archetypeScoring.js:108-142`. A weighted blend over six dimensions, clamped 0–100, one decimal:

```
fundamentalScore · technicalScore · baggerBombFit · atrPercentile
inverseComposite = 100 - compositeScore
sectorDiversity  = (maxSectorCount - count[sector]) / maxSectorCount * 100
```

**Two facts that decide this question:**

1. **It is computed over the WHOLE UNIVERSE, not per symbol.** `sectorDiversity` reads `sectorCounts` across the entire input array (`:112-118`), so a symbol's score is a function of the universe it was ranked in. There is no "score this one name" call, and one cannot be faked from a single row.
2. **`api/_utils/archetypeScoring.js` is §1-FENCED** (BUILD_RULES §1, added July 24 2026 — *"the 'scoring engine' concept named explicitly"*). Reading is permitted; **a new direct importer from `src/` also trips the §2.3 import-boundary ratchet** and must be recorded in `api/_utils/archetypeImportBoundaryBaseline.json` in the same commit. The client cannot compute this number.

### The one client-reachable source, and its two gaps

`GET /api/agent/scouting-board` — `api/agent/scouting-board.js`. Genuinely cheap and genuinely read-only (`:8` — *"performs NO Firestore writes"*): one `.get()` on `indexIntelligence/stockRankings` (`:86`), `maxDuration: 10` (`:23`), rate limit 30/min (`:59`). `SCOUTING_BOARD_ENABLED = true` (`src/config/featureFlags.js:900`). It already returns **both** numbers the founder wants: `sectorName` and `archetypeScore` (`:124-125`, `:142-143`).

It still does not answer this question, for two independent reasons:

**Gap 1 — it does not score the bench.** The response covers exactly two groups:
- `ranked` — the top **10** of the universe (`BOARD_SIZE = 10`, `:25`; `:122`)
- `watchlist.inUniverse` — the equipped watchlist's tickers, below the top-10, with their real score (`:139-145`)
- `watchlist.offUniverse` — equipped tickers outside the universe: **`{ symbol }` only, no score** (`:147`)

The persisted bench and the hot bench are covered only where they coincide with the top-10. A bench of five names would typically get a score for none of them.

**Gap 2 — the Battle View does not have `watchlistId`.** The client call is `?archetype=…&watchlistId=…` from `agent.equippedWatchlistId` (`src/components/Dashboard/ScoutingBoardSheet.jsx:86, :98`). The battle doc carries the **resolved snapshot** — `{name, thesis, tickers, snapshotAt}` — and not the id (`api/_utils/resolvedAgentManifest.js:143`, `api/_utils/agentBattleService.js:199`). `archetype` is available (`agentContext.archetype`); the id is not, so the Battle View would need a second read of the agent doc before it could even ask.

**Cost, latency, cache** — for the record, since the question asks:
- **Cost:** one Firestore document read per call, then a full in-memory rank of the universe.
- **Latency:** budgeted at 10s; the rank is `O(n log n)` over the universe on every call.
- **Cache:** **none.** `ScoutingBoardSheet.jsx:110-116` re-fetches on every open and on every archetype/watchlist change. Nothing memoises the response, and the Battle View re-renders on every subscription tick.

### "Ranked by composite score" is NOT this number

It is closer to the opposite. `compositeScore` enters `archetypeScore` **inverted** — `inverseComposite: 100 - (s.compositeScore ?? 50)` (`api/_utils/archetypeScoring.js:126`) — as one of six weighted terms. For any archetype whose weights give `inverseComposite` a positive weight, a *higher* composite score pushes the archetype score **down**.

They are also different objects: `compositeScore` is a per-stock ranking field and is **nullable** — the scouting board deliberately gives it no reason chip for exactly that reason (`api/agent/scouting-board.js:29-32`: *"the nullable dimensions (fundamentalScore / compositeScore) are deliberately chip-less in V1"*). `archetypeScore` is always present because every dimension has a `?? 50` default.

**Showing one labelled as the other would be a §9 display-disagreement of the first kind**, and would tell the player their agent likes a name for the reason it likes it least.

---

## 4. What could be built, honestly, if the founder wants it

Stated so the founder's line has something concrete to answer. **None of this is built.**

| Option | What it needs | Honest? |
|---|---|---|
| **A. Sector groups on the persisted bench only** | Nothing new — the field is on the doc | Yes, but it groups a minority of the roster and leaves the hot bench and the watchlist ungrouped |
| **B. Sector groups over the whole roster** | A sector for hot-bench and watchlist names. The cheapest real source is `stockRankings.sectorName`, which the scouting board already reads (`compute-index-intelligence.js:1143, 1192`) — but reaching it from the Battle View is a new read | Yes, and it is one source for every name — no drift |
| **C. Sector groups via the client `SECTORS` map** | Nothing new | **No.** 236-symbol coverage, and a second source for a fact the doc already carries — §9 |
| **D. `fit 86` per bench name** | A per-symbol score the universe-wide rank cannot give, from a fenced module, for names the endpoint does not return | **No, not without a new endpoint** — which the ruling excludes |

**The recommendation, if asked:** option **B**, and only after a founder line — it is a new read on a hot screen, and §3's instruction was to report, not to build. Option A is available for free but delivers a bench that is half-grouped, which may read worse than the flat list it replaces.

---

## 5. What this changes about the shape fix

Nothing. The sentence-first Bench and the roster chip row shipped this session stand on their own, and the chip is already the right unit to group later: grouping is a matter of splitting one wrapped chip row into several under sector headings, with no change to the selector's contract beyond adding a sector to each roster entry.

---

## 6. Debts noticed, not fixed (BUILD_RULES §3)

1. **`hotBench` and `equippedWatchlist.tickers` are bare strings while `portfolio.bench.stocks` are objects with a sector.** Every consumer that wants a fact per bench name has to branch on which list a name arrived from. Worth a decision — not a fix on this branch.
2. **`ScoutingBoardSheet` has no response cache.** Re-opens re-rank the universe. Fine at a sheet's cadence; it would not be fine on a subscription-driven screen, which is part of why option D above is not free.
