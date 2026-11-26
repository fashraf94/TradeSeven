# Discovery — the research universe census (read-only)

**Date:** 26 Nov 2026 · **Asked by:** the Explore content chat (Fable), for the founder · **Branch:** `claude/research-universe-census` (local worktree branch `claude/research-universe-census-e7bd9c`) · **Base:** `origin/main` @ `22b01810`.

**Preamble.**
- `git fetch origin` ran first. `HEAD` = `origin/main` = `22b01810cba93c28de53342f1634a542bebfd56c`, clean tree.
- `docs/BUILD_RULES.md` was read first.
- **Read-only.** No code, flag or Firestore change, no model call and no EODHD call. The only file added is this report.
- Local Node imports of pure data modules (`rankingConfig.js`, `assets.js`, `sectors.js`, `fantasyTimesTickers.js`, `mandateCandidateUniverse.js`) were used to count lists. They make no network call and no write.
- **What "VERIFIED" means here.** Every `file:line` was read at this HEAD in this session, either by me or by one of four read-only reader agents working on the same tree (idea book, scheduled jobs, research surfaces, client side and directory). I re-read every headline anchor myself: the refusal lines, the rank formulas, the cron schedules and time limits, the count pins, the fenced read sites and the Work an idea universe threading.
- **"ASSUMED"** marks estimates (latency, document size), vendor billing and anything not seen in code.
- **"Founder to confirm on the EODHD dashboard"** marks anything that depends on the EODHD plan.

---

## 0. Verdict

| Question | Answer |
|---|---|
| Can research be split from play without touching the 228? | **Yes.** Every research and idea-book refusal of Corning (GLW) is a membership test against `ALL_TICKERS` or a map built from it. Each can be pointed at a second, larger list while the game keeps the first. |
| Would adding GLW to `ALL_TICKERS` itself be safe? | **No.** It enters the ranked pool that the fenced `decide.js` drafts from (`decide.js:344`, `:1405`, `:472-481`). That is fence contact under BUILD_RULES §1 (Part F). It also moves every peer percentile in its sector, every list-wide RS, ATR and bandwidth percentile, the live-poll symbol set, the Wire version locks, and the pinned test counts (§2.7). |
| Does the larger list fit the nightly jobs if they simply loop it? | **No.** At 1,000 stocks, `indexIntelligence/stockRankings` (one Firestore document) passes 1 MiB at about 690 stocks (ASSUMED sizing, from the repo's own test). The rankings commit grows with the square of sector size, and the jobs add about 85,000 EODHD calls a day. Fetch-on-touch is the only shape that fits (Part D). |
| Cost of serving one research stock on request | **About 11 calls**: fundamentals 10, plus one 378-day price history 1. The daily close is already downloaded for every US stock by the bulk call and thrown away (`compute-rankings.js:206-215`). An eight-stock comparison of new names costs about **88**; repeats are free if kept. |
| Can both idea-book desks pick "most US stocks"? | **Not by widening a list.** The desks can only pick names priced in the session's close snapshot. That snapshot is capped at 300 symbols, with about 164 left after the Mandate's 136 candidates, shared by every book (Part C). **Founder decision:** how a research stock becomes a desk candidate. |
| Is there already a US stock directory with name, sector and industry? | **None.** The largest partial lists are hand-typed maps of 140 names (`src/config/stockData.js:85`) and 24 names (`src/data/supplyChainIntelligence.js`, which does hold GLW). No code calls EODHD's exchange symbol list, bulk fundamentals or screener (Part E). |

---

## 1. In plain terms

**Today, when a player or a story reaches for Corning:**
- **Search.** The research search box does not offer it; it searches a 54-name list.
- **Work an idea.** Opened from a story that names GLW, the symbol is replaced with "(symbol not in the app's records)" before the model sees it. If the model writes "GLW" back, the whole step fails. Corning can appear only as a named "lead", never as a company on the idea card.
- **Explore.** A story that tags GLW is refused at the publish check ("not in the game's 228-stock list"). Corning can sit in the prose, or as a lead with no symbol (which the page then does not draw).
- **Research modal.** It opens on GLW and shows live fundamentals, but the Compete tab says "not in the MarketClash ranking universe (~220 S&P 500 stocks)". The chart read answers `invalid_symbol`. There are no analyst estimates.
- **Idea book.** The founder's door refuses it as `name_not_in_universe`. Neither desk is ever shown it. If a desk names it anyway, it is refused as `name_not_a_candidate`.

**What has to exist before a player can research Corning:**
1. A **research list**: a directory of symbols with name, sector and industry, mapped to the app's 11 sector ids. It is separate from the 228.
2. Every research door must ask that list instead of `ALL_TICKERS`: Work an idea, Explore, search, the modal's endpoints and Signal Drop.
3. **Its numbers on first touch:** one fundamentals call gives all ten stored measures, one price history gives returns and charts, and the daily close comes free from the bulk download. They are kept in their own store, so the 228's peer ranks never move.
4. **Founder decision:** whether a research stock shows a rank against the 228's sector peers (computed read-only), or shows no rank.

**What more has to exist before each idea-book desk can pick it:**
- **For both desks:**
  - the idea book's "is this a stock?" and "what sector is it?" tests must accept a research stock;
  - the stock must be priced in the session's close snapshot, which today happens only for the Mandate's own 136-name list, held names, and names already reserved by an idea.
- **Founder decision:** how a research stock gets into a desk's candidate list. One example is "names the player researched or saved", within the snapshot's 300-symbol room.
- **Running cost:** an open idea needs prices, splits and dividends, and market value every day. That is about 16 calls a day per held stock (ASSUMED per-ticker billing). "Fetch once and keep" does not hold for a held name.
- **Shadow desk (medium and long ideas):** needs nothing more. It reads only symbol, sector and last close.
- **Archetype desk (short ideas):** needs nothing more today. It reads the same three fields; no measured threshold, chart setup or intraday data is wired into the idea book.

---

## 2. The sort table (Part A)

**Group key.**
- **GAME:** stays on the 228.
- **RESEARCH:** must accept a research stock.
- **IDEA BOOK:** must accept one for one or both desks.
- **SHARED:** one piece of code serves two groups.

"GLW today" is traced from the code. In the last column, "No GAME effect" means no game read changes, provided `rankingConfig.js` and `src/data/assets.js` `STOCKS` stay untouched.

### 2.1 The list and its copies

| # | file:line | What it does with the list | GLW today | Group | Smallest change · GAME effect |
|---|---|---|---|---|---|
| A1 | `api/_utils/rankingConfig.js:18-85` `STOCK_UNIVERSE`; `:381` `ALL_TICKERS`; `:453-485` `TICKER_TO_SECTOR/TYPE/INDUSTRY` (278 keys: 228 stocks + 11 sector ETFs + 28 industry ETFs + 11 retired); `:100-103` `RETIRED_STOCKS`/`isRetiredStock`; `:114` `STOCK_INDUSTRIES` (239) | The one list and its label maps | Absent from all | SHARED (every group) | **Leave it.** Add a separate research directory (Part G). Any edit here changes GAME (Part F). |
| A2 | `src/constants/sectors.js:4-` `SECTORS[].topHoldings` | Hand copy for the client's sector views. 226 names: 215 of the 228 plus the 11 retired, missing SHOP, PLTR, SNOW, BE, CRWV, COIN, AFRM, HOOD, DKNG, GME, GEV, RKLB, PWR (Node count) | Absent | RESEARCH (sector views) | Research lookups fall back to the directory. No GAME effect. |
| A3 | `src/data/assets.js:8-82` `STOCKS` | 54 names (the header at `:5` says 50) with name and sector. Includes TGT, which is not in the 228 | Absent | SHARED (GAME battle builder and free-agent pool; RESEARCH search box) | **Never widen.** Point research search at the directory instead (rows S9–S12). |
| A4 | `api/_utils/fantasyTimesTickers.js:7-28` `FANTASYTIMES_TICKERS`, `:31` `SECTOR_MAP` | 54 reporter names (the header at `:3` says 50). On the Wire generation surface (`wireGenerationSurface.js:81`) | Absent | SHARED (FantasyTimes reading surface; Wire stories reach the agent channel) | None needed for the rulings. Leave. |
| A5 | `api/_utils/stockIntelligenceData.js:39` `TICKERS` (66), built by `scripts/buildStockData.js` | Doug and Kim's earnings list, and the earnings-claims ingest (`api/fantasytimes/ingest-earnings.js:7`, `:95-99`) | No claims, no recap | SHARED (FantasyTimes and Work an idea's stored claims) | Claims for one stock on request already exist (`api/fantasytimes/test-ingestion.js:80-91`, CRON_SECRET-gated). No GAME effect. |
| A6 | `api/_utils/mandateCandidateUniverse.js:80` `CANDIDATE_UNIVERSE` (136) | The Mandate and idea-book close-snapshot candidate set. 131 overlap the 228; ADI, EA, TGT, BRK.B and PYPL do not | Never priced | SHARED (Mandate books and IDEA BOOK) | See Part C and decision D5. |
| A7 | `api/_utils/draftStockList.js:6` (75); `src/services/draftAssets.js:14,55,94` (75) | Snake Draft pools | Not draftable | GAME | None. |
| A8 | `src/data/onboardingStockTiers.js:26` (24) | Starter watchlist for a new agent (`AgentCreationFlow.jsx:285-300`) | Not offered | GAME | None. |
| A9 | `src/services/optionsBotService.js:34` (10) | Admin options bot | n/a | GAME | None. |

### 2.2 Scheduled jobs

| # | file:line | What it does | GLW today | Group | Smallest change · GAME effect |
|---|---|---|---|---|---|
| C1 | `api/cron/compute-rankings.js:199-215`, `:242-262`, `:1466-1471`, `:1550-1552` | Fetches fundamentals for the 228. Ranks them within each sector (`:802-936`). Writes `peerRankings/{t}` (`:1327`), `sectorRankings/latest` (`:1415`), `scannerSummary/latest` (`:1425`) and `priceHistory/{sector}` | Never fetched; its bulk-download row is discarded at `:210` | SHARED (GAME: `compute-index-intelligence.js:1315` reads its ranks into `compositeScore`; RESEARCH: modal, Work an idea) | Do not add to its loop. Use a separate on-request writer into a separate collection. No GAME effect. |
| C2 | `api/cron/compute-index-intelligence.js:50`, `:741`, `:874-899`, `:924-944`, `:1278-1294`, `:1309-1386`, `:1506-1524` | OHLCV and live quotes for the 228. List-wide RS, ATR and bandwidth percentiles. Writes `indexIntelligence/stockRankings` (one document) and `stockTechnicalScores/{sym}` | Never ranked | GAME (agent ranked pool, CPU pool, tournament boards, measured-threshold membership) | None. Research price history is fetched per stock instead. |
| C3 | `api/cron/compute-estimates.js:134-195`, `:327-382`, `:433-468` | Calendar trends and earnings for the 228 in chunks of 30. Writes `estimatesCache/latest`; `emsPercentile` is within the sector | Absent; `/api/stocks/earnings-estimates` answers 404 (`earnings-estimates.js:69-76`) | SHARED (RESEARCH: Work an idea opening `store.js:291`, the modal; GAME-adjacent: the rankings scanner `compute-rankings.js:1519`) | Fetch one stock's estimates on request into the research store. No GAME effect. |
| C4 | `api/cron/compute-institutional-intelligence.js:69-123`, `:179`, `:213-259` | Holders for the 228. Writes `institutionalHoldings/{sym}` and the list-relative `institutionalAggregates/latest` | Absent | SHARED (GAME: the fenced `agentPromptAssembly.js` and `agentEvalPromptAssembly.js` read both; RESEARCH: `SmartMoneyTab.jsx`, `InstitutionalView.jsx`) | Optional on-request holders (10 calls) into the research store. Never add to the aggregate. |
| C5 | `api/_utils/intraday/universe.js:16` `UNIVERSE_STOCKS` (244); `pollRunner.js:175`, `:212` | The every-5-minute live-quote sweep | Not swept | GAME (live battle prices) | None. |
| C6 | `api/_utils/setupEvidenceSweep/sweep.js:38`, `:154` (`symbols = ALL_TICKERS`, capped at 400 by `constants.js:58`) | Daily chart-evidence records per stock | No record | SHARED (RESEARCH: chart read `api/research/setup-read.js`; GAME: agent setup labels `api/_utils/setupMenuLabels/reads.js`) | `sweep()` already takes `symbols`. Add touched research stocks under the 400 cap (decision D7). Never removes a game stock. |
| C7 | `api/fantasytimes/scan-movers.js:10`, `:309`; `generate-pulse.js:11`, `:187` | Movers and pulse over the 54 names | Not scanned | SHARED (as A4) | None. |

### 2.3 Game runtime (stays on the 228)

| # | file:line | What it does | GLW today | Group | Smallest change |
|---|---|---|---|---|---|
| G1 | `api/agent/decide.js:344`, `:1405` (reads `indexIntelligence/stockRankings`), `:472-481` (`rankedEquippedTickers`); `api/_utils/watchlistEquip.js:116-117` | The agent's candidate pool is the ranked list; equipped names outside it are dropped from candidates. The Sonnet prompt still sees the full watchlist (`:475-478`) | Not a candidate; visible in the prompt only through a watchlist (Found §4) | GAME (fenced file) | None. |
| G2 | `api/_utils/tournamentAgentBoards.js:412-415`; `tournamentAgentDraft.js:250-253` | Tournament agent boards and draft read the ranked list | Not offered | GAME | None. |
| G3 | `api/_utils/stockThresholdAdmission.js:34-37` | A measured battle needs every stock in the current ranked list (`current_ranked_membership_missing`) | Refused | GAME | None. |
| G4 | `api/_utils/wireValidator.js:21`, `:69-71` (`isInWireUniverse`); `api/_utils/wireGenerationSurface.js:138-139` (value locks), `:227-258` (`assessTickerUniverseCaveat`); `api/_utils/wireContracts.js:53-60`, `:186-195` | Wire story validation; any change to `ALL_TICKERS` or `TICKER_TO_SECTOR` forces a generation version bump (and a validator bump) | Off-universe in Wire | GAME (agent channel) | None. |
| G5 | `api/_utils/fantasyTimesConsensus.js:9`, `:222`, `:416` | Catalyst weight 1.0 if in the list, else 0.3; earnings-attribution filter | Weight 0.3 | GAME (Wire generation surface) | None. |
| G6 | `api/_utils/filmRoom/debriefChecks.js:232` (`DIRECTORY_SYMBOLS`), `:281` | A debrief naming a directory symbol not allowed for the tape is refused | Not a directory symbol | GAME (Film Room) | None. |
| G7 | `api/_utils/filmTape/candleInputs.js:85`; `tapeAssemble.js:1254-1272`; `candlePass.js:41`; `src/utils/filmRoomSubject.js:108-113` | Sector ETF candles and comparables for held names; subject-line sector | No sector | GAME (Film Room) | None. |
| G8 | `api/_utils/seasonRuleRegistry.js:8-20` | Sector name for season rules, falling back to the fundamentals sector | Fundamentals sector | GAME (season mode, scrapped per C-19; `api/season/create-entry.js`) | None. |
| G9 | `src/components/Research/BattleResearch/result.js:34`, `:226-231` | Battle research sector of a held name | null (`'na'`, `:313-316`) | GAME (battle names only) | None. |
| G10 | `src/components/BaggerBomb/SlotBasedBuilder.jsx:197`; `BenchSelector.jsx:60`; `PortfolioBuilderBaggerBomb.jsx:208,338,433`; `src/services/freeAgentRotationService.js:43`; `src/services/eodhdAPI.js:1090-1105` (`POPULAR_STOCK_SYMBOLS` feeds `App.jsx:3577` battle-builder prices and `MarketBriefing.jsx:52`) | Battle builders and pools over `STOCKS` (54) | Not offered | GAME (the eodhdAPI briefing half is research) | None. Never widen `STOCKS`. |

### 2.4 Research

| # | file:line | What it does | GLW today | Group | Smallest change · GAME effect |
|---|---|---|---|---|---|
| R1 | `api/_utils/sharedResearch/companies.js:23`, `:28-33` (`gameUniverse = { has, retired }`), `:36` `resolveSymbol`, `:121` `companiesOf` | Resolves symbols in Work an idea | `resolveSymbol` gives null; Corning becomes a lead marked `identity_unresolved` (`:151`, `:159`) | RESEARCH (feeds IDEA BOOK names) | A `researchUniverse` with the same `{has, retired}` shape. No GAME effect. |
| R2 | `api/_utils/sharedResearch/opening.js:28`, `:53`, `:60`, `:122`, `:132-133`, `:156-157` | Names in scope, opening findings, drop topic | Dropped from scope; headline masked | RESEARCH | Already takes `universe`; the caller must pass it. No GAME effect. |
| R3 | `api/_utils/sharedResearch/stepSchema.js:160` `strayTickersOf`, `:173` `maskStrayTickers`, `:369`, `:399` `validateFrame`, `:433`, `:455-456` | Masks stray symbols; fails a step that writes one (`stray_ticker`) | Whole step fails (`shared-research.js:497`) | RESEARCH | Already takes `universe`. No GAME effect. |
| R4 | `api/_utils/sharedResearch/stepPrompt.js:24`, **`:43`** `UNIVERSE_LINE`, **`:124`** `seen` | The model's "game universe" line, fixed when the module loads; text masker with the default universe | Masked before the model sees it | RESEARCH | **No `universe` parameter.** The line must become a function of the universe, and `:124` must pass it. Prompt size is a design question (D8). No GAME effect. |
| R5 | `api/_utils/sharedResearch/thesisSchema.js:44`, `:263-264`, `:475-477`, `:534`; `thesisWords.js:22`, `:78-80` | Idea card names must be supported symbols; a line naming a stray symbol fails | Cannot be a card name | RESEARCH → IDEA BOOK | Already take `universe`. No GAME effect. |
| R6 | `api/forge/shared-research.js` (handler) | Calls every validator above | — | RESEARCH | **Passes `universe` zero times** (`grep -c` = 0). It must thread the research universe through. No GAME effect. |
| R7 | `api/_utils/sharedResearch/store.js:291` (estimates), `:295` (claims, `ticker ==` only), `:306` (`peerRankings/{s}` and `stockRankings/{s}`), `:317-325` (names) | Stored facts and rows for names in scope | No rows, no name | RESEARCH | Also read the research store. No GAME effect. |
| R8 | `api/_utils/explore/storyCheck.js:24`, `:33`, `:79` `listedTicker`, `:215`, `:216`, `:221-222`, `:261`, `:303` (K-4(f)) | Refuses a story symbol outside the 228; a lead may carry `symbol: null` with a name | Refused (`tickers`, `about`, leads, groups) | RESEARCH | `checkStories(entries, {…})` (`:427`) already takes options (`storedKeys`). Add a `listed` predicate that defaults to the game list; `scripts/explore-publish.mjs:60` passes the research one. No GAME effect. |
| R9 | `api/stocks/peer-rankings.js:16`, `:60-72` | Peer rank card | 404 "not in the rankings universe (~220 S&P 500 stocks)" | RESEARCH | Fall through to the research store (rank per decision D3). No GAME effect. |
| R10 | `api/stocks/sector-rankings.js:19`, `:117-120` | Sector table with the stock's sector highlighted | 200, no highlight | RESEARCH | Highlight from the directory's sector id. No GAME effect. |
| R11 | `api/research/setup-read.js:44`, `:58` `RANKED`, `:92` | Chart read, records only (RR-1: never acquires) | 400 `invalid_symbol` | RESEARCH | Accept research stocks that the sweep covers (row C6, D7). No GAME effect. |
| R12 | `api/stocks/analysis.js:189-190`; `api/stocks/fundamentals.js:46`, `:106-109`; `api/research/correlation.js:103`, `correlation-scan.js:103`, `:267`, `driver-audit.js:33`, `:187` | Live EODHD reads; format checks only | Served (pillars null in analysis) | RESEARCH | None. |
| R13 | `api/_utils/screenStocks.js:23`, `:190`; `api/screener/chat.js` | The screener over the `stockRankings` rows | Never a row | SHARED (RESEARCH screener over a GAME document) | Leave on the 228, or screen a research store later. No GAME effect if left. |
| R14 | `api/_utils/tickerValidation.js:6`, `:31` `validateTickers` | Signal Drop and watchlist-dialogue validation against `TICKER_TO_SECTOR` | `unsupported` | SHARED (RESEARCH: Signal Drop → Work an idea; GAME: `watchlist-dialogue.js:429` proposals → equipped watchlists → agent prompt) | Add a `universe` argument. Signal Drop passes the research one; the dialogue stays on the game list unless ruled (D6). |
| R15 | `api/forge/parse-signal.js:296-356` | Validates a drop; logs `off_universe_ticker_seen`; stores `validated` without GLW | GLW dropped | RESEARCH | Follows R14. |
| R16 | `api/_utils/injectionGuard.js:16`, `:86`, `:140` | Signal Drop expansion sector check | Off-universe guard passes the expansion through | SHARED (as R14) | Sector from the directory for research stocks. Could change which names are proposed for watchlists. |
| R17 | `api/_utils/watchlistValidation.js:13`, `:35-56`, `:71`, `:83`; `api/forge/watchlists.js:292-301`; `api/forge/watchlists/[id].js:163-170`, `:237-239` | Watchlist save: shape checks and the retired refusal only | **Accepted** by a direct API save | SHARED (research watchlist and the agent's equipped list) | Already open. Whether that is intended is decision D6. |
| R18 | `src/components/Forge/Watchlist/tickerSearchMatch.js:9-22` | Watchlist add search over the 267 `TICKER_TO_TYPE` keys (no company-name search) | No match | SHARED (as R17) | Append directory entries. Client only. |
| R19 | `src/components/Forge/Watchlist/groupWatchlistTickers.js:21-24`, `:45-83` | Groups a watchlist by sector and industry | Shown as unsupported (`WatchlistEditor.jsx:367-369`) | SHARED (as R17) | Directory lookup before "off universe". Display only. |
| R20 | `src/components/Search/companyMatch.js:7-15` (`SearchOverlay.jsx:26`, `Explore/ExploreSearch.jsx:38`) | **The research search box**, over `STOCKS` (54) | No result (and 175 of the 228 are not offered either) | RESEARCH | Search the directory by symbol and name. No GAME effect. |
| R21 | `src/components/Search/ExploreView.jsx:38`, `:142`, `:156`; `InstitutionalView.jsx:50-58`; `RankingsView.jsx:110`; `ScreenerView.jsx:240`; `Forge/Watchlist/WatchlistAnalysisView.jsx:202-205`; `FantasyTimes/FantasyTimesFeed.jsx:217-219`; `StoryDetail.jsx:665-667` | Name and sector joins against `STOCKS` | Name shows as "GLW" | RESEARCH | Directory lookup. No GAME effect. |
| R22 | `src/components/Research/TechnicalTabV2.jsx:5`, `:483-486`, `:515-517`; `src/services/sectorDataService.js:201-205`, `:479-485`, `:512-513` | A stock's sector by scanning `topHoldings` | "Sector not identified" (true today for 13 of the 228 as well) | RESEARCH | Fall back to `TICKER_TO_SECTOR`, then the directory. No GAME effect. |
| R23 | `src/components/draft/AssetResearchModal.jsx:24`, `:236`; `CompeteTab.jsx:200-203` | The modal opens on any asset; `SECTORS` is only an ETF test | Opens; Compete tab: "not in the MarketClash ranking universe" | RESEARCH | A "not ranked" or research-rank state. No GAME effect. |
| R24 | `src/components/Research/HoldingsTab.jsx:3`, `:43`, `:56`; `SectorETFRanksTab.jsx:4`, `:31-36`; `Search/InstitutionalCards.jsx:4`, `:401`; `discover/DiscoverPanel.jsx:47`, `:87`; `SectorDetailModal.jsx:43`, `:112`; `SectorRail.jsx:67`, `:380`; `src/utils/sectorUtils.js:1`, `:45-71` | Keyed by sector fund, not by stock | n/a | RESEARCH | None. |

### 2.5 Idea book

| # | file:line | What it does | GLW today | Group | Smallest change · GAME effect |
|---|---|---|---|---|---|
| I1 | `api/_utils/practiceField/symbols.js:15`, `:23`, `:33-35` `isUniverseStock`, `:44` `isFundSymbol`, `:51-56` `mandateSectorOf` | Is it a pickable stock, and its Mandate sector (`STOCK_UNIVERSE` name → bridge) | Not a stock; sector null | IDEA BOOK (both desks and the founder's door) | Accept a research stock, with its sector from the directory's house sector id through the same bridge. Practice Field only. No GAME effect. |
| I2 | `api/_utils/practiceField/contract.js:34`, `:152` (`name_not_in_universe`), `:153` (`sector_unknown`), `:192` (sector fund), `:202` (frozen basket) | Contract checks on names and comparison | **Refused at `:152`** (founder path) | IDEA BOOK | Follows I1. |
| I3 | `api/_utils/practiceField/agentSources.js:40`, `:76`, `:80` | A desk's candidate list: symbols in the close snapshot ∩ `isUniverseStock` | Never listed | IDEA BOOK (both desks) | Follows I1, but GLW must also be in the snapshot (D5). |
| I4 | `api/_utils/practiceField/agentDrafting.js:129-130` | A drafted name must be a candidate | **Refused `name_not_a_candidate`** (agent path) | IDEA BOOK | None; follows I3. |
| I5 | `src/data/practiceFieldSectorBridge.js:5`, `:15-27` | House sector name → Mandate sector | n/a (keyed by sector name) | IDEA BOOK | None. |

### 2.6 Scripts, dev tools and dead code

| # | file:line | What it does | Group |
|---|---|---|---|
| X1 | `scripts/fetch-ticker-industries.js:58-60`, `:165`, `:215`, `:220`, `:278` | Fetches EODHD `GicIndustry` and `GicSector` for the list and prints the `STOCK_INDUSTRIES` literal | Directory builder (Part E) |
| X2 | `scripts/collect-threshold-export.js:7`, `:75`; `collect-threshold-identities.js:9`, `:20`; `stock-threshold-pilot-control.mjs:37`, `:43` | Measured-threshold operations | GAME |
| X3 | `scripts/census-setup-evidence-sweep.mjs:35`, `:91` | Day-after check of the sweep (takes `symbols`) | SHARED (as C6) |
| X4 | `scripts/experiments/setup-frequency/*.mjs` (`analyze.mjs:27`, `:182`; `exportProduction.mjs:40`, `:244`; `fetchBars.mjs:30`, `:50`; `lib.mjs:13`, `:26-30`; `replay.mjs:23`, `:73`) | Offline experiment over the 228 | None (offline) |
| X5 | `api/scripts/sample-voice-layer-terms.js:28`, `:116`; `test-voice-layer-phase-2-5.js:35`, `:245` | Voice-layer collision checks | GAME dev tools |
| X6 | `api/_utils/storySignals.js:12`, `:97`, `:120`, `:175`; `src/services/fantasyTimesDetector.js:8`; `src/services/baggerBombRecommendationEngine.js:6`, `:187` | List reads in modules with **no importer** | Dead (Found §6) |
| X7 | `src/config/setupEvidenceSweepFlags.js:16` | Comment only | — |

### 2.7 Tests that pin the list

These move if the list moves; they are part of the Part F case.

| Test | Pin |
|---|---|
| `api/_utils/rankingConfig.test.js:27`, `:187` | `ALL_TICKERS` length 228 |
| `rankingConfig.test.js:142-143`, `:226` | `TICKER_TO_SECTOR`, `TICKER_TO_TYPE`, `TICKER_TO_INDUSTRY` 278 |
| `rankingConfig.test.js:156`; `:73`, `:103`, `:111`, `:203`, `:251` | 11 sectors; industry ETFs 28, `INDUSTRY_ETFS` 11 |
| `api/_utils/stockThresholdBroadRelease.test.js:349-355`, `:358` | 228; per-sector `{ XLK: 28, XLV: 22, XLF: 22, XLE: 17, XLY: 22, XLP: 20, XLI: 23, XLB: 20, XLU: 20, XLRE: 18, XLC: 16 }`; retired keys |
| `api/_utils/intraday/universe.test.js:13-14` | `UNIVERSE_STOCKS` 244 |
| `api/_utils/setupEvidenceSweep/sweep.test.js:136-154` | the real `ALL_TICKERS`, 228 |
| `api/_utils/wireGenerationSurface.test.js:46` against `wireGenerationBaseline.json:37-38` | value hashes of `ALL_TICKERS` and `TICKER_TO_SECTOR` |
| `src/data/practiceFieldSlots.test.js:136`, `:143-148` | every `ALL_TICKERS` stock resolves to a Mandate sector; bridge matches the candidate seed |
| `api/_utils/practiceField/admission.test.js:118-119`, `:657`, `:669`, `:682`; `agentIsolation.test.js:120` | `name_not_in_universe` for WBA and ZZZZ; coverage room from `CANDIDATE_UNIVERSE.length` |

Synthetic counts that do not move: `indexIntelligenceHygiene.test.js:279` (239); `compute-index-intelligence.fundamentalsMirror.test.js:218-225` (×239); `intradaySizing.test.js:15`, `:60` (255); the jsdom "of 228" strings built from fixtures.

---

## 3. Part B — what a stock needs in order to exist in each place

### B1. Work an idea

| Per-stock data | Read at | Source | Only for the 228? | One stock on request? |
|---|---|---|---|---|
| Membership (is it a company?) | `companies.js:28-41` | `ALL_TICKERS` | Yes | Yes, from a directory |
| Company name | `store.js:317-325` | `peerRankings/{sym}.name`, written by `compute-rankings.js:135` and `:1355` from EODHD `General::Name` | Yes (ranked stocks only, `:1326`) | Yes: the same fundamentals call (10) |
| Ten stored measures and peer rows | `store.js:306-313` | `peerRankings/{sym}.metrics` (`compute-rankings.js:1365-1388`) | Yes | Raw values yes (one fundamentals call). Ranks need peers (D3). |
| Ranking row | `store.js:306`, `:312` | `stockRankings/{sym}`: **no writer exists** (Found §1) | — | — |
| Analyst estimates | `store.js:291`; fact built at `opening.js:170` | `estimatesCache/latest.stocks[sym]` from `compute-estimates.js:458` (loop `:434`) | Yes | Yes: `calendar/trends` for one symbol (cost founder to confirm), or the fundamentals `Earnings.Trend` block (ASSUMED to carry the same fields) |
| Stored claims | `store.js:295` (`ticker ==`) | `ingestedClaims`, via `ingest-earnings.js:95-99` over the 66 | Yes (66) | Yes: `test-ingestion.js?action=ingest_earnings&ticker=` (needs an earnings row in the last 30 days) |
| Retrieval | `retrieval.js` | Web search; no per-stock store | No | — |

**Functions that already take `universe`** (all default `gameUniverse`):
- `resolveSymbol` (`companies.js:36`), `companiesOf` (`:121`)
- `dropTopicOf` (`opening.js:53`), `namesInScopeOf` (`:60`), `openingFindingsOf` (`:122`)
- `strayTickersOf` (`stepSchema.js:160`), `maskStrayTickers` (`:173`), `retrievalLabelOf` (`:369`), `validateFrame` (`:399`), the step validator (`:433`)
- the build validator (`thesisSchema.js:263-264`), `namesAListedCompany` (`:534`, required)
- `lineFailOf` (`thesisWords.js:78`)

**The gaps:**
- `stepPrompt.js:43` and `:124`.
- `shared-research.js`, which never passes one.
- **There is no "compare measures" code on `main`.** `storyCheck.js:320` notes "the list is not built yet (`src/constants/compareMeasures.js`)", and `scripts/explore-publish.mjs:73` has `STORED_MEASURE_KEYS = null`. The nearest existing code is `readRankingRows` and `storedRowsOf`.

### B2. Explore story check and publish step

- **The check.** `storyCheck.js` reads no per-stock store. Its only per-stock fact is membership (`:79`).
- **The publish step.** `scripts/explore-publish.mjs` reads the story files and `exploreStories` (`storyWriter.js:33`, `:62`), fetches each source link to match quotes, and writes `exploreStories/{id}`.
- **Where per-stock content lives.** Values sit inside the story itself: `cells[].{symbol,value}`. A stored measure names a `storedKey` only, never a value.
- **Needed for GLW:** the membership predicate (row R8). The stored-measure key list, when it lands, must be keys that a research stock can also fill (the ten measures can; ranks need D3).

### B3. Stored measures and peer ranks

- **Readers.** `api/stocks/peer-rankings.js` and `sector-rankings.js` read `peerRankings/{sym}` and `sectorRankings/latest`. Both are written only by `compute-rankings.js` for the 228.
- **The ten measures.** Each is computed from **one stock's own** fundamentals response; none needs another stock to compute:

| Measure | Computed at (`compute-rankings.js`) | Inputs |
|---|---|---|
| `revenueGrowthYOY` | `:628` | `Highlights.QuarterlyRevenueGrowthYOY` |
| `earningsGrowthYOY` | `:629` | `Highlights.QuarterlyEarningsGrowthYOY` |
| `profitMarginTTM` | `:633` | `Highlights.ProfitMarginTTM` |
| `grossMargin` | `:634-636` | GrossProfitTTM ÷ RevenueTTM |
| `fcfYield` | `:667-669` | (OCF + capex, last 4 quarters) ÷ market cap × 100 |
| `fcfMargin` | `:672-674` | FCF ÷ RevenueTTM × 100 |
| `debtToEquity` | `:441-447` | Latest yearly balance sheet |
| `currentRatio` | `:450-454` | Latest yearly balance sheet |
| `interestCoverage` | `:457-475` | EBIT ÷ interest expense; 100 when the company holds net cash |
| `netDebtEbitda` | `:478-497` | −1 when the company holds net cash |

- **What needs the whole list.**
  - Rank and percentile: within the sector, `Math.round(((n-1-idx)/(n-1))*100)` (`:836-838`).
  - Pillar averages of percentiles (`:858-869`), composite rank and `totalPeers` (`:902-904`), the sector leaderboard (`:911-922`) and sector medians (`:925-934`).
  - `sectorRankings` breadth (`:946-1008`).
- **The raw value is stored apart from the rank:** `metrics.{field}` (`:1365-1388`) against `pillars.{p}.dimensions.{key}` = `{ value, rank, percentile, sectorMedian }` (`:1339-1344`).
- **Catches for an on-request writer.**
  - `extractMetrics` (`:622`) and `extractBalanceSheetMetrics` (`:426`) are not exported.
  - Units are mixed: `fcfYield` and `fcfMargin` are ×100, while `grossMargin` is a fraction.

### B4. Analyst estimates

- `compute-estimates.js` loops the 228 in chunks of 30: `calendar/trends` (`:138`) and `calendar/earnings` over a 2-year lookback (`:165-176`).
- Each stock's own fields: forward estimates, RSR, EMS, surprise streak (`:258-317`).
- Fields relative to the list: `emsPercentile` within the sector (`:358-382`) and `sectorDiffusion` (`:324-352`).
- One stock on request: yes, a one-symbol request (cost per request: founder to confirm on the EODHD dashboard). Its `emsPercentile` would need D3's answer.

### B5. Stored earnings-call claims

- **Writer.** `storeClaims` (`ingestedClaims.js:28`), from `ingestionPipeline.js:108`.
- **Driver.** `ingest-earnings.js`, which keeps only calendar rows whose symbol is in the 66 (`:95-99`).
- **Per claim.** The earnings-calendar row, a Sonar summary and a Haiku extraction.
- **GLW:** none. An on-request path exists (row A5); it is model-cost bearing.

### B6. Research modal and stock search

| Endpoint or view | Per-stock data | GLW |
|---|---|---|
| Search box (`companyMatch.js:7-15`) | `STOCKS` (54) | not offered |
| `api/stocks/fundamentals.js:46` and analysis, earnings, earnings-history, historical, prices, options-iv, eod-close | Live EODHD | served |
| `api/stocks/earnings-estimates.js:69-76` | `estimatesCache/latest` | 404 |
| `api/stocks/peer-rankings.js:60-72` | `peerRankings/{sym}` | 404 |
| `api/research/setup-read.js:58`, `:92` | `setupEvidence` records from the sweep | 400 |
| `SmartMoneyTab.jsx`, `InstitutionalView.jsx` | `institutionalHoldings/{sym}`, `institutionalAggregates/latest` | none |
| `TechnicalTabV2.jsx:483-486` | sector from `SECTORS.topHoldings` | "Sector not identified" |

### B7. Watchlists and Signal Drop

- **Signal Drop.** `validateTickers` (`tickerValidation.js:31`) puts GLW in `unsupported`. `parse-signal.js:303-315` logs it. The stored drop excludes it (`:356`). The follow-up dialogue sees validated names only (`signalDropPrompt.js:277-290`; `watchlist-dialogue.js:429-430`).
- **Watchlist save.** It checks shape only (`watchlistValidation.js:35-56`) and refuses retired names, so a direct API save of GLW is accepted.

### B8. FantasyTimes reporters

| Reporter | Driven by |
|---|---|
| Kai (pulse), Alex (movers) | `FANTASYTIMES_TICKERS` (54) |
| Doug (recaps, previews), Kim (columns) | `stockIntelligenceData.TICKERS` (66) (`generate-recap.js:240`; `submit-earnings-batch.js:131`; `generate-column.js:120`) |
| Alex's mover story | Any posted symbol (`generate-mover.js:519-524`) |
| Vera (deep dive) | Extracted tickers unfiltered (`ingest-deepdive.js:59-71`); deep dives are refused as a Work an idea source (`store.js:166`) |
| Consensus | `ALL_TICKERS` (row G5) |

None of these is named in the rulings; nothing is proposed for them.

---

## 4. Part C — the idea book

### C1. Admission: every check, in run order

**Agent path (both desks)**

| # | Check | file:line | Outcome for GLW |
|---|---|---|---|
| 1 | The close snapshot's build set: quarterly-held, then the 136 candidates, then coverage-only | `mandateUniverseSnapshot.js:81-127` | Never priced |
| 2 | A drafting close keeps the default candidates | `sweep.js:205-216` | — |
| 3 | `candidatesOf`: this session's snapshot (`:69`), built with candidates (`:72`), `isUniverseStock` (`:76`), complete price (`:77`), priced at this close (`:79`) | `agentSources.js:69-80` | Dropped silently |
| 4 | The prompt lists only those candidates | `agentPrompt.js:147-148` | — |
| 5 | The slot belongs to this desk and is empty | `agentDrafting.js:106-107` | — |
| 6 | **Every name must be a candidate** | **`agentDrafting.js:129-130`** | **`name_not_a_candidate`** (first refusal if a desk names it) |
| 7 | The sizing probe, then `admitIdea` (section below) | `agentDrafting.js:135-140` | — |

**`admitIdea` (the founder's door enters here):**
- Contract shape (`admission.js:355` → `contract.js:102-139`).
- **Names: `name_not_in_universe` at `contract.js:152`**, the first refusal on this path, then `sector_unknown` (`:153`).
- Mode (`admission.js:357`); book, epoch and close owed (`:157-164`); marks for held names (`:169-170`); slot and holder (`:173-181`); calendar (`:184-185`); capital and the **sector cap through `mandateSectorOf`** (`:221-250`); coverage fit (`:274-276`).
- Entry, the next session: an eligible mark for every name, comparison and SPY (`entry.js:230-233`; `marks.js:70-95`), and a cost tier (`entry.js:234`; `fills.js:71-74`).
- Both desks use the same selector (`agentRun.js:345`, `:545`). Both refusals show the player "the name is not on the price list" (`bookViewCopy.js:145-146`).
- There is no player entry box. Ideas enter through the desks, the founder's door (`founderControls.js:247`, `:254`) or the CLI (`scripts/practice-field-founder.mjs:552`).

### C2. Per-stock data an open idea needs every day

None of this comes from a job that loops the 228. It is fetched per symbol once an idea reserves the symbol in coverage (`practiceFieldCoverage/current`; `coverage.js:4-8`, `:58-65`; passed to the snapshot as `coverageTickers`, `sweep.js:186-187`, `:199`, `:215-216`).

| Data | Source | 228-only? | EODHD per stock per day |
|---|---|---|---|
| Fill and close prices | `mandateUniverseSnapshots/{date}_{slot}` (open30, midday, preClose) and `{date}_close`, built by `ensureUniverseSnapshot` (`mandateUniverseSnapshot.js:641-748`) from `real-time` batches (`tournamentPrices.js:64`), called from `mandate-evaluate.js:419`, `:885` | No (candidates ∪ held ∪ coverage) | 4 quotes. The code counts one call per 100-symbol chunk (`mandateConfig.js:126`); whether a batch bills per ticker: **founder to confirm on the EODHD dashboard** |
| Splits and dividends | `mandateUniverseDaily/{date}` via `splits/` and `div/` (`mandateUniverseSnapshot.js:442-445`, `:473`, `:477-625`) | No | 2 requests (price: founder to confirm) |
| Corporate-action backfill | `practiceFieldCaBackfill/{SYM}` (`caBackfill.js:11`, `:66-78`, `:116`) | No; only on a coverage gap | 0 normally |
| Friction tier | **Market value only** (`mandateFrictionModel.js:29-37`, `:52-56`; tiers `mandateConfig.js:196-202`), from a cached fundamentals call (`mandateUniverseSnapshot.js:483`, `:543-549`; cache 24 h `marketDataCache.js:36`, filter `:385`). A missing value blocks entry (`entry.js:234`) | No | ≤ 10, once a day (0 if already cached) |
| Mandate sector | `mandateSectorOf` (`symbols.js:51-56` → `practiceFieldSectorBridge.js:15-27`). The fundamentals sector is never used (`symbols.js:7-10`) | **Yes, only the 228**; no fetch supplies it today | 0 |
| Coverage records | `practiceFieldCoverage/current` (`coverage.js:8`), written in admission, entry and release transactions (`admission.js:448`; `entry.js:371`); `caCoveredThrough` from the daily document (`dailyCoverage.js:21-26`) | No | 0 |

- **Running cost per held stock:** ≤ 16 calls a day (4 + 2 + ≤ 10), ASSUMED per-ticker billing. The code's own counter is `mandateUpstreamCalls/{date}`, with a ceiling of 100,000 (`mandateConfig.js:120`).
- **Capacity:**
  - Shared build cap: 300 symbols (`mandateConfig.js:94`).
  - `coverageFits` always counts the 136 candidates, leaving about **164** reserved symbols across all books (`coverage.js:17-20`, `:122-127`).
  - Snapshot budget: 800 KB (`mandateConfig.js:99`).
  - At most 200 agent candidates (`agentSources.js:57`); 40,000-byte prompt ceiling (`agentConfig.js:40`).

### C3. Shadow desk (medium and long ideas)

- **Code.** `runDeskCheck` (`agentRun.js:83`, `:238`), called from `api/cron/mandate-evaluate.js:1052`; brief `SHADOW_BRIEF` (`agentConfig.js:118-122`).
- **When it picks.** It sees only `{ symbol, sector: mandateSectorOf(sym), lastClose }` per candidate (`agentSources.js:80`), plus the book, prior notes and saved theses (`agentPrompt.js:36-38`; `agentSources.js:196-227`). No rankings, no measures, no market data cache: `agentIsolation.imports.test.js:16` bans the deployed agent's modules.
- **When it reviews.** The idea's own rows (`agentRun.js:372`; `close.js:1443`) and prior notes (`agentSources.js:119-130`). None of this is list-bound.
- **What fails for GLW.** Only the candidate list (`agentSources.js:76`, and the snapshot build set). A saved thesis naming GLW still reaches the model (`agentSources.js:182`), but a draft from it is refused at `agentDrafting.js:129-130`.

### C4. Archetype desk (short ideas)

The same selector and the same three fields; no saved theses (`agentConfig.js:96`). The prompt says it has no chart evidence (`agentPrompt.js:89`).

| Need | Used by the idea book today? | If wired in later |
|---|---|---|
| Measured threshold (`measuredStockThreshold.js`) | **No** ("Stage 1 only … no runtime scoring/admission consumers", `:1`) | On request per symbol: 1 `eod` (15 bars), 1 `fundamentals?filter=General`, 1 `real-time` (`stockThresholdMeasurementProvider.js:40-41`, `:54-64`). It needs exactly 15 bars (`measuredStockThreshold.js:73-74`, `:94-99`). The *battle* gate also needs ranked membership (`stockThresholdAdmission.js:34-37`), which is GAME. |
| Setup evaluation (`setupEvaluator/`, `setupEvidence/`, `setupEvidenceSweep/`) | **No** | Pre-measured daily for the 228 by the sweep, but acquirable on request for any well-formed symbol (`setupEvidence/index.js:53`; `key.js:38-39`): 1 `eod` over 130 calendar days (`acquire.js:43`, `:56-58`), needing 55 completed bars (`setupEvaluator/thresholds.js:84`) |
| Intraday data | **No** intraday bars anywhere in the idea book; fills use the slot snapshots' real-time quotes (`marks.js:70-95`) | — |

### C5. The second line and the comparison fund

- **SPY does not depend on the stock list.** It is a constant (`src/data/practiceFieldFunds.js:32`), stamped on every idea (`admission.js:321`), always in coverage (`coverage.js:63`), and priced at a fixed fund tier (`symbols.js:70-74`). The fund list imports nothing (`practiceFieldFunds.js:34-50`).
- **Where the comparison does depend on it:**
  - `sector_fund` needs `mandateSectorOf(name) === fund.represents` (`contract.js:192`), so a stock with no sector can never match.
  - `frozen_basket` members must pass `isUniverseStock` (`contract.js:202`).
  - `same_stock_held` has no list dependency (`contract.js:183-186`).
- **Confirmed:** the SPY line is list-free. A sector-fund comparison needs I1's sector change.

---

## 5. Part D — the scheduled jobs and the call budget

### D1. The jobs

**Method.**
- Schedules come from `vercel.json`; time limits from each handler's `export const config` (the `vercel.json` `functions` block has no `maxDuration`).
- Published costs: 1 per end-of-day or live request, 5 per intraday or technical, 10 per fundamentals.
- Latency is not measured anywhere in the repo, so wall times are **ASSUMED**: 1.5 s per batch of 10 fundamentals, 1 s per other request or batch. Sleep floors are VERIFIED from code.
- Real figures are in the Vercel logs: "Rankings cron complete in", "Estimates cron complete in", and index-intelligence `stageTimings`.

| Job | Schedule · limit | Pacing | Per-stock calls | Calls per run: 228 · 1,000 · 2,500 | Fits at 1,000 · 2,500 | Output |
|---|---|---|---|---|---|---|
| `compute-rankings` | `0 11 * * 1-5` (`vercel.json:69-70`) · 180 s (`:13`) | Batches of 10, 250 ms apart (`:141-142`) | 1 fundamentals = 10 (`:118`) | 2,292 · 10,012 · 25,012, plus 12 ETF `eod` and the bulk call (`:1489-1491`; cost per the prior census 100, founder to confirm) | No (≈ 175 s by time, and a ≈ 8.6 MiB single-batch commit, ASSUMED) · No | **Relative** (sector percentiles, ranks, medians, leaderboard) |
| `compute-estimates` | `0 10 * * 6` (`:81-82`) · 180 s (`:15`) | Chunks of 30, 500 ms apart, 2 retries (`:70-72`, `:152`, `:195`) | 2 requests per 30 stocks (cost founder to confirm) | 16 · 68 · 168 requests | Yes · No (time, and the one-document size ≈ 1 MiB near 1,700, ASSUMED) | Mostly **own**; `emsPercentile` and diffusion relative |
| `compute-index-intelligence` | `30 10,11 * * 1-5` + `0 14-20 * * 1-5` (`:149-154`) = 9 full runs a weekday · 300 s (`:75`) | `fetchBatch(ALL_TICKERS, 10, 500)` (`:891`); real-time in 20s | 1 `eod` (378 days) + 1 real-time in intraday runs | Premarket 245 · 1,017 · 2,517; intraday 489 · 2,033 · 5,033; **per weekday 3,913 · 16,265 · 40,265** | **No** · No: `indexIntelligence/stockRankings` is one document at about 1,515 B per stock (`fundamentalsMirror.test.js:222-225` sizing + mirror), over 1 MiB at about 690 stocks; a breach "fails the WHOLE … batch" (`:1551-1554`) | **Relative** (list-wide RS, ATR, bandwidth percentiles; composite) |
| `compute-institutional-intelligence` | `0 1,2 * * 1` (`:177-178`) · 120 s, guard at 110 s (`:87`, `:356`) | Sequential, 100 ms per stock (`:84`, `:200`) | 1 holders fundamentals = 10 on a cache miss (7-day cache, `marketDataCache.js:40`, `:455`) | ≤ 2,280 · ≤ 10,000 · ≤ 25,000 a week | No · No (the sleep alone caps a run near 1,100) | `institutionalHoldings` **own**; `institutionalAggregates` **relative** |
| `intraday-poll` | `* 13-21 * * 1-5` (`:165-166`) · 60 s (`intraday-poll.js:26`) | 20 per request, concurrency 4 (`intradayConfig.js:25`, `:161`) | 1 live unit per universe sweep, 84 sweeps a day | 244 · 1,016 · 2,516 per sweep; **20,496 · 85,344 · 211,344 a day** | Edge (`intradaySnapshots/latest` ≈ 96% of 1 MiB, from the measured 252,689 B at 255 symbols, `docs/audits/20260919_BUILD1_INTRADAY.md:64`) · No | **Own** |
| `setup-evidence-sweep` | `30 12,22,23 * * 1-5` (`:225-226`) · 300 s (`:22`) | 4 workers, serialized reservation (`sweep.js:247`, `:319`) | 1 `eod` (130 days) per session | ≈ 228 · 400 cap · 400 cap (`constants.js:58`) | No (600 never measured) · No | **Own** |
| `scan-movers`, `generate-pulse` | `*/15 13-20` (`:129-130`); 6 entries (`:85-94`) · 60 s | concurrency 8 | not on `ALL_TICKERS` (54 fixed) | 54 · 54 · 54 per run | unaffected | Own |

**Daily effect of simply enlarging the list** (weekday calls added, excluding the bulk call and the weekly jobs):

| Job | +1,000 | +2,500 |
|---|---|---|
| Rankings | +7,720 | +22,720 |
| Index | +12,352 | +36,352 |
| Intraday universe tier | +64,848 | +190,848 |
| Sweep | +172 | +172 |
| **Total** | **about +85,000** | **about +250,000** |

- The prior call census put today's server load near 86,000 a day against a 100,000-a-day plan (`docs/audits/20261007_EODHD_CALL_CENSUS.md` executive verdict). Both figures are carried from that audit, not re-derived; the plan size is for the founder to confirm on the EODHD dashboard.

**Growth trap (VERIFIED).** `compute-rankings` decides whether to backfill price history from the *first sector only* (`:230-233`). A newly added name never backfills, so its `sixMonthReturn` stays null for about six months (`:775-777`).

### D2. Cost of serving one research stock on request

| Need | Call | Calls | Code |
|---|---|---|---|
| Ten stored measures and the name | `/fundamentals/` with `EODHD_FUNDAMENTALS_FILTER` | 10 | `compute-rankings.js:118`; `rankingConfig.js:813-814` |
| Analyst estimates | 0 if the same response's `Earnings.Trend` carries the fields `compute-estimates` reads (ASSUMED; no fixture shows it), else 1 `calendar/trends` (+1 `calendar/earnings` for surprise history) | 0–2 requests (founder to confirm) | `compute-estimates.js:138`, `:176`, `:258-317`; `compute-rankings.js:376-400` |
| Price history | `/eod/` over 378 days (covers 6-month returns, 55-bar setups, 15-bar thresholds) | 1 | `compute-index-intelligence.js:144-147` |
| One daily close | Already in the daily bulk download (`compute-rankings.js:1489-1491`) and discarded at `:206-215`; or 1 `real-time` | 0–1 | — |
| Holders (optional) | `/fundamentals/?filter=Holders` | 10 | `marketDataCache.js:455` |
| **One stock** | | **≈ 11** (+0–2 calendar, +10 holders) | |
| **Eight-stock comparison, all new** | 8 × 11 | **≈ 88** (≈ 96 with live closes; +1–2 calendar requests, since 8 fit one 30-symbol chunk) | |

- Names already in the 228 cost 0 in a comparison (stored).
- A kept research stock costs 0 on repeat views, until the refresh policy (D4) says refetch: 11 calls each time.

---

## 6. Part E — a stock directory

1. **Is there a list of US symbols beyond the 228 with name, sector and industry? None at directory scale.** The partial, hand-typed lists:

| File | What it holds |
|---|---|
| `src/config/stockData.js:85` `COMPANY_NAMES` and `:151` `COMPANY_SECTORS` | 140 names, 33 outside the 228; 137 sectors; no industry |
| `src/data/supplyChainIntelligence.js:132-139` | 24 companies; **holds GLW** ("Corning Incorporated"), with house slugs `technology` / `specialty_materials`, not GICS |
| `api/_utils/supplyChainLookup.js:47` | `'CORNING': 'GLW'` |
| `api/_utils/mandateCandidateUniverse.js:33-80` | 136 symbols with a sector seed, no names |
| `src/data/assets.js:8` | 54 |
| `stockIntelligenceData.js` `STOCK_DATA` | 20 |

   No directory JSON or CSV exists in `src/data`, `scripts/` or `public/`, and `api/_data` does not exist.

2. **Where names, sectors and industries come from for the 228:**
   - **Sector membership is typed by hand:** `STOCK_UNIVERSE` (228) plus `RETIRED_STOCKS` (11), and the hand copy `src/constants/sectors.js` (226), which `rankingConfig.js:7-8` says to "keep in sync" and is not.
   - **Industries were generated once from EODHD and pasted:** `STOCK_INDUSTRIES` (239), from `scripts/fetch-ticker-industries.js` (`General.GicIndustry`, `:215`; `GicSector`, `:220`; one full fundamentals call per symbol, `:165`).
   - **Names are read from EODHD at runtime:** `General::Name` in `compute-rankings.js:118`, `:135`, then `peerRankings.name`.
   - **Other hand-typed name maps:**
     - `src/App.jsx:744` `COMPANY_NAMES` (~46)
     - `api/stocks/earnings-historical-range.js:34` (~59)
     - `STOCKS` (54), `SECTOR_MAP` (54)
     - draft pools (75)
     - onboarding (24)
     - supply chain (24)
     - `STOCK_DATA` (20, built from knowledge-package files, not EODHD)
   - **Sector vocabulary warning:** EODHD's fundamentals `Sector` is Morningstar-flavoured and misses about 40% of the GICS names (`seasonRuleRegistry.js:10-14`). A directory must map `GicSector` (as `fetch-ticker-industries.js:220` reads it) onto the 11 house sector ids.

3. **EODHD endpoints already called that could build a directory:**

| Endpoint | In code? | Note |
|---|---|---|
| `/exchange-symbol-list/` | **Not called anywhere** | Founder to confirm on the EODHD dashboard |
| `/bulk-fundamentals/` | **Not called anywhere** | Founder to confirm on the EODHD dashboard |
| EODHD `/screener` | **Not called anywhere** (`/screener` hits are the app's own route, `api/screener/chat.js`) | Founder to confirm on the EODHD dashboard |
| `/search/` | **Not called anywhere** | Founder to confirm on the EODHD dashboard |
| `/fundamentals/` with `General` | `marketDataCache.js:385`, `:417-419` (Name, Sector, Industry); `api/stocks/fundamentals.js:46`, `:106-109`; `scripts/fetch-ticker-industries.js:165`; `scripts/collect-threshold-identities.js:12` | Per symbol, 10 each. A 2,500-name build is about 25,000 calls once |
| `/eod-bulk-last-day/US` | `compute-rankings.js:1490` | Every US close, daily. Whether rows carry names or market value: founder to confirm on the EODHD dashboard (ASSUMED no). It could supply the size floor's price leg, not the market value |

---

## 7. Part F — what must not change

Adding a stock to `ALL_TICKERS` (or only to `TICKER_TO_SECTOR`) changes these GAME reads. This is the case against editing the one list.

### F1. The fenced agent's ranked pool (fence contact)

- **The chain.** `ALL_TICKERS` → `compute-index-intelligence.js:891` fetches it → `:1524` writes it into `indexIntelligence/stockRankings` → read by:
  - `decide.js:344` and `:1405`, the candidate pool, with `rankedEquippedTickers` at `:472-481`;
  - `tournamentAgentBoards.js:412`;
  - `tournamentAgentDraft.js:250`;
  - the CPU pool (`rankingConfig.js:90-96` names "the CPU's pool and the agent's ranked pool").
- **Why it is fence contact.** A new stock becomes draftable by the agent. BUILD_RULES §1 fences the scoring engine and agent behaviour "as concepts"; a change reached through a non-fenced file is still fence contact.
- **The same holds for** the institutional aggregates read by the fenced `agentPromptAssembly.js` and `agentEvalPromptAssembly.js` (row C4): "top institutions by stocks held" is computed over the list.

### F2. Ranks and tiers of the 228 move

| Use | file:line | Why it moves |
|---|---|---|
| Sector peer percentile | `compute-rankings.js:836-838` | The denominator is the count of sector peers with data. Corning would join a 28-name sector and re-space all 28 |
| `compositeRank`, `totalPeers`, `tier` | `:902-906` | |
| Leaderboard embedded in every peer document | `:911-922` | |
| Sector medians, breadth and composites | `:925-934`, `:946-1008` | |
| List-wide RS percentile | `compute-index-intelligence.js:924-926` | Normalized by list length |
| Sector RS percentile | `:930-944` | |
| ATR percentile | `:1278-1282` | |
| Bandwidth percentile | `:1290-1294` | |
| Composite from fundamentals and technical rank | `:1315-1317` | |
| `emsPercentile` and `sectorDiffusion` | `compute-estimates.js:324-382` | |

These feed the BaggerBomb fit and rank fields that `decide.js`, the screener and the voice layer read (`baggerBombRank` readers: `gameModeScoring.js`, `voice-layer-cache.js`, `voiceLayerPrompt.js`, `screenStocks.js`).

### F3. Thresholds

A listed stock becomes eligible for measured battles (`stockThresholdAdmission.js:34-37`).

### F4. The live symbol set and the call budget

- `UNIVERSE_STOCKS` grows (`intraday/universe.js:16`), adding 84 live units a day per stock.
- `compute-index-intelligence` adds 1 call per stock to each premarket run and 2 to each intraday run: 16 a weekday.
- The setup sweep competes for its 400-request cap (`constants.js:58`).
- `compute-rankings` adds one fundamentals call (10) per stock per weekday.

### F5. Wire and Film Room

- **Wire.**
  - `ALL_TICKERS` and `TICKER_TO_SECTOR` are hashed by value (`wireGenerationSurface.js:138-139`; baseline `wireGenerationBaseline.json:37-38`). Any change forces `WIRE_GENERATION_VERSION` forward.
  - A `TICKER_TO_SECTOR` change also forces `WIRE_VALIDATOR_VERSION` (`:227-258`), and the BR-3 precedent shows the bump (`wireContracts.js:186-195`).
  - Wire validation membership changes (`wireValidator.js:69-71`), as does consensus weighting (`fantasyTimesConsensus.js:222`, `:416`).
- **Film Room.** The debrief's `DIRECTORY_SYMBOLS` grows (`debriefChecks.js:232`, `:281`), and tapes gain sector candles and comparables (`candleInputs.js:85`; `tapeAssemble.js:1271`).

### F6. Watchlists into agents

- A `TICKER_TO_SECTOR` addition validates the name in Signal Drop and in watchlist-dialogue proposals (`tickerValidation.js:31`; `watchlist-dialogue.js:429`).
- It becomes searchable in the Forge add box (`tickerSearchMatch.js:18`).
- An equipped watchlist feeds the agent's prompt (`decide.js:475-478`).

### F7. Pinned counts

The tests in §2.7 pin 228, 278, 244, the per-sector counts and the value hashes; each turns red on an edit to the list.

### The opposite case

Nothing found argues that editing the one list is safe.

One finding cuts the other way and is reported here: **off-list names can already reach a GAME read today.**
- A direct API watchlist save accepts any well-formed symbol (`watchlistValidation.js:35-56`).
- An equipped watchlist's full list reaches the agent's Sonnet prompt (`decide.js:475-478`).
- Only the candidate list is filtered to ranked names (`:480`).

So a research list that feeds watchlists would reach the agent's words even without touching `ALL_TICKERS` (decision D6).

---

## 8. Part G — a proposed split (PROPOSAL, not ruled)

**Shape.**
- **The game list stays exactly as it is.**
- **A research universe = the 228 ∪ a directory.** It lives in a new data-only module, `api/_utils/researchDirectory.js`: generated, committed and reviewed like `STOCK_INDUSTRIES`, with symbol, name, house sector id and GICS industry.
- **A pure accessor,** `api/_utils/researchUniverse.js`, exports:
  - `researchUniverse` with the `gameUniverse` shape (`{ has, retired }`);
  - `researchSectorOf(sym)`, which returns a house sector id;
  - `isResearchStock(sym)`.
- **Both modules are Node-clean,** so `src/` can import them (BUILD_RULES §4).
- **The directory never enters `rankingConfig.js`.**
- **Per-stock numbers for a research stock** go to their own collections (for example `researchMeasures/{sym}`, `researchPrices/{sym}`), written on first touch. `peerRankings`, `stockRankings`, `estimatesCache` and `institutionalAggregates` are never written for them.

**Functions that already take a universe or symbol list as a parameter:**
- The thirteen in §3 B1 (Work an idea).
- `checkStories(entries, { storedKeys, … })` (`storyCheck.js:427`, an options bag where a predicate can go).
- `sweep({ symbols })` (`setupEvidenceSweep/sweep.js:154`) and `runSweepCensus(reader, { symbols })` (`scripts/census-setup-evidence-sweep.mjs:91`).
- `runPoll({ universeStocks })` (`intraday/pollRunner.js:175`, GAME; not to be used).
- `sectorOf(symbol, { tickers, universe })` (`src/utils/filmRoomSubject.js:108`, GAME).

**Proposed builds, in order, each dark behind its own flag:**

| # | Build | Files (count) | Owner chat | Leaves untouched |
|---|---|---|---|---|
| G1 | **Directory and accessor.** Generator script (`scripts/build-research-directory.mjs`, from whichever EODHD source the plan allows, D1), `researchDirectory.js`, `researchUniverse.js` and tests; `GicSector` → house sector id map; flag `RESEARCH_UNIVERSE_ENABLED` (false) | ~5, all new, plus `featureFlags.js` | rankings | `rankingConfig.js` and every cron; no Wire version bump (nothing on the generation surface moves) |
| G2 | **Research numbers on request.** Move `extractMetrics` and `extractBalanceSheetMetrics` out of `compute-rankings.js` into a shared pure module (behaviour-identical; prove with a golden over the 228). A `fetchResearchStock(sym)` that writes `researchMeasures/{sym}` (10 measures + name, 10 calls), price history (1 call) and estimates (0–2), with a `fetchedAt` for the refresh rule (D4). An optional read-only sector rank against the stored peers (D3) | ~5 (one GAME file edited for the move only) | rankings | `peerRankings`, `stockRankings`, `sectorRankings`, `estimatesCache` contents |
| G3 | **Work an idea.** `shared-research.js` threads the universe to every validator. `stepPrompt.js:43` becomes a function of the universe (or lists only the names in scope, D8) and `:124` passes it. `store.js` reads `researchMeasures`. Flag: per-player resolution like `CHART_READ_MODE` | ~4 | Work an idea | The game list; the 13 validators keep their `gameUniverse` default |
| G4 | **Explore.** A `listed` predicate in `checkStories` options (default: the game list); `explore-publish.mjs` passes the research one when its flag is on | 2–3 | Explore | Published stories (re-checked only on the next publish) |
| G5 | **Research modal, search and chart.** `companyMatch.js` searches the directory (lazy-loaded); `peer-rankings.js`, `earnings-estimates.js` and `sector-rankings.js` fall through to the research store; `TechnicalTabV2.jsx` sector fallback; `setup-read.js` accepts research stocks the sweep covers, with the sweep fed touched research stocks under its 400 cap (D7) | ~7 | Explore (founder to confirm the modal's owner) | `STOCKS` and every battle builder |
| G6 | **Signal Drop.** `validateTickers(tickers, universe)`; `parse-signal.js` passes the research universe; `watchlist-dialogue.js` and `injectionGuard.js` stay on the game list unless D6 rules otherwise | 2–3 | Work an idea | Watchlist equip and the agent |
| G7 | **Idea book.** `symbols.js`: `isUniverseStock` and `mandateSectorOf` accept a research stock (sector from G1 through the existing bridge); `contract.js:202` follows; the candidate source gains research names per D5, reserved into coverage so the snapshot prices them | ~4–6 | idea book | `CANDIDATE_UNIVERSE`, Mandate books, the 300-symbol cap (unless D5 raises it) |

**Total:** about 30 files across seven builds; each build is under BUILD_RULES' 10-file review threshold.

**Not proposed:** widening any cron's loop (Part D), or touching `STOCKS`, `rankingConfig.js`, the intraday universe or the Wire maps (Part F).

### Founder decisions needed before build prompts can be written

| # | Decision |
|---|---|
| D1 | **Size floor and source.** US-listed and about $1 billion market value: how many names (ASSUMED 2,000–3,000)? Which EODHD source builds it (exchange symbol list plus per-symbol fundamentals at about 10 calls each, or bulk fundamentals or screener if the plan includes them): **founder to confirm on the EODHD dashboard**. How often is it rebuilt? |
| D2 | **Sector mapping.** Map EODHD `GicSector` onto the 11 house sector ids. What happens to names without one (ADRs, SPACs, funds): excluded? |
| D3 | **Ranks for a research stock.** (a) Rank it read-only against the stored raw metrics of the 228's sector peers. It never appears in their leaderboards and the 228 never move. Or (b) show no rank, only its own values. |
| D4 | **"Fetched first time, then kept."** How stale may kept numbers be before a re-fetch (about 11 calls each)? |
| D5 | **How a research stock becomes a desk candidate.** Desks can only pick names priced in the close snapshot (300 symbols, about 164 free, shared by every book). Options: names a player researched or saved; a capped rotating sample; or raise the cap (≈ 16 calls a day per held name, ASSUMED). This bounds what "most US stocks" can mean for the desks. |
| D6 | **May a watchlist or Signal Drop proposal hold a research stock?** An equipped watchlist reaches the agent's prompt (`decide.js:475-478`). It is already possible by direct save. |
| D7 | **Chart evidence for research stocks.** Either the sweep covers touched research stocks (within 400 a session), or RR-1 is relaxed to allow acquire-on-read in `setup-read.js`. |
| D8 | **Work an idea's prompt.** It lists every allowed symbol (`stepPrompt.js:43`). At 2,500 names that is about 12 KB per step (ASSUMED, about 5 characters a symbol). Alternative: list only the names in scope. |
| D9 | **EODHD plan facts:** daily limit; bulk-download cost; calendar endpoint cost; whether batched real-time bills per ticker; whether exchange symbol list, bulk fundamentals and screener are included. All **founder to confirm on the EODHD dashboard**. |

---

## 9. Found outside the task

Reported for separate tasking; none was fixed (BUILD_RULES §3).

1. **`stockRankings/{symbol}` is read but never written.** `sharedResearch/store.js:306` reads `db.collection('stockRankings').doc(s)`. The only writer writes the single document `indexIntelligence/stockRankings` (`compute-index-intelligence.js:1524`). The ranking half of Work an idea's stored rows is therefore null for every stock (production contents ASSUMED empty).
2. **Berkshire can never be an agent candidate.** `CANDIDATE_UNIVERSE` spells it `BRK.B` (`mandateCandidateUniverse.js:54`); the house list spells it `BRK-B`, so `isUniverseStock` fails (`agentSources.js:76`). Only 131 of the 136 candidates can ever be drafted (ADI, EA, TGT, BRK.B, PYPL fail).
3. **The comment at `agentSources.js:56`**, "the house universe is about 136 names", mixes up the Mandate's 136 with the house 228.
4. **New names never backfill price history.** The backfill decision reads the first sector only (`compute-rankings.js:230-233`), so a newly added name's `sixMonthReturn` stays null for about six months (`:775-777`). The batch comment "up to 500 ops per batch, we have ~221 + 2" (`:1322`) is also stale.
5. **Stale counts shown to players.**
   - "~220 S&P 500 stocks": `api/stocks/peer-rankings.js:69`, `src/components/draft/CompeteTab.jsx:202`, `compute-rankings.js:2`.
   - Stale header counts: `fantasyTimesTickers.js:3` and `assets.js:5` say 50 (both are 54); `compute-institutional-intelligence.js` "~269"; `compute-index-intelligence.js:592`, `:1542` (239/256).
6. **Modules with no importer:**
   - `api/_utils/storySignals.js`;
   - `src/services/fantasyTimesDetector.js`;
   - `src/services/baggerBombRecommendationEngine.js`;
   - unmounted (ASSUMED): `BenchSelector`, `PortfolioBuilderBaggerBomb`, `Dashboard/Watchlist/AddToWatchlistModal`.
7. **The Explore page draws no object leads.** `exploreView.js:44-45` keeps strings only (`textOf`), and `:139` maps leads through it. The pilot fixture writes leads as `{ symbol, name }` objects (`ai-buildout.json:32-36`), so its leads are not drawn.
8. **The `sectors.js` copy has drifted.** `src/constants/sectors.js` is missing 13 of the 228 and still holds the 11 retired names, so `TechnicalTabV2.jsx:515-517` says "Sector not identified" for SHOP, PLTR, CRWV and others. `rankingConfig.js:7-8` says the copies are kept in sync.
9. **The research search box covers 53 of the 228.** It searches `STOCKS` (54, including TGT, which is not in the 228), so 175 of the 228 are not offered (`companyMatch.js:7-15`).
10. **The early-morning index-intelligence run fires twice.** Both `30 10` and `30 11` UTC run in full, with no Eastern-time, trading-day or holiday guard in the handler (`vercel.json:149-150`; no `Intl`/`timeZone`/trading-day check in `compute-index-intelligence.js`). Already recorded in the Oct 7 call census.
11. **Work an idea counts only `ticker == symbol` claims** (`store.js:295`), never a claim's `linkedTickers` (`ingestedClaims.js:207-208`).
12. **Watchlists accept any well-formed symbol by direct API save**, and an equipped list reaches the agent's prompt in full (`decide.js:475-478`); see Part F's opposite case.

---

*Prepared read-only at `22b01810`. Report path: `docs/audits/20261126_RESEARCH_UNIVERSE_CENSUS.md`.*
