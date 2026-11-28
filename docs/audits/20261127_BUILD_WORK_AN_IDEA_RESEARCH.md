# Build report: research universe, Build 3b (Work an idea accepts research companies)

**Date:** Friday 27 Nov 2026 · **Asked by:** the Explore content chat (Fable), for the founder · **Base:** `origin/main` @ `a037e022` (#1123)

**PRs, in merge order** (each with `main` as its base):
- **A** `claude/work-an-idea-card-and-currency`: prompt §3 (the currency) and §4 (the opening card), every Work an idea player.
- **B** `claude/work-an-idea-research`: prompt §5–§7 and this report. Cut from A and contains A's commits. The switch is `'off'`.
- **C** `claude/work-an-idea-research-founder`: prompt §8, the switch to `'founder'`. Cut from B and contains B's commits.

**Preamble.** In this report "§N" is a section of this report; "prompt §N" and "section N.M" are the build prompt's.
- **Fetch first.** `git fetch origin` ran first: `HEAD` = `origin/main` = `a037e02230a8d552955d0e7114bfaa81462f2c72`, clean tree.
- **`main` moved during the build** to `4550a13e` (#1125, Explore Build 2). It shares one file with this build, `src/config/flagPinGuard.test.js`, in a different hunk (an Explore note); nothing else of #1125 touches a file this build changes. The final checks ran on throwaway merges of B's and C's heads with that `main` (§7).
- **No provider call, no model call, no production read or write.** Fixtures are Build 2's and 3a's; the 228's screener names for the offline collision count came from Build 1's saved fetch on this machine.
- **No secret, uid, email or player text** appears in this report, the code or the PRs.
- **VERIFIED** means read at the line or measured in this session; **ASSUMED** marks anything not seen.

---

## 0. Verdict

| Check | Result |
|---|---|
| Off means off: game-list sessions with the switch off | **Byte-identical** to PR A's tip: every answer, prompt, shadow-log record, write and stored document (the golden, §5) |
| Full Linux suite, C + `main` | **exit 0**: 1,707 files passed, 14 skipped; 39,833 rows passed (§7) |
| Full Linux suite, B + `main` | 1,706 passed, **1 timed out**: `backingBetaFlags.test.js`, a whole-repo importer walk, at 5.45 s against its 5 s. No file of this build is in its lists. It **passes alone** on the same tree (2.9 s) (§7) |
| `lint:gate`, C + `main` | **exit 0** |
| `vite build`, C + `main` | **exit 0**. None of the server-only name data (the research directory, the everyday names, the 228's names) is in the client bundle |
| Review (two lenses, each with a refuter) | 12 findings, **none refuted**. Each fix went in with a row that failed first (61 rows); the rest are recorded (§6) |
| Mutation battery | 44 mutants, **43 killed**. The survivor is equivalent on today's data (§6) |
| Equip guard | **Built**, not the fallback. Saved ideas only (Q-3) |
| Fenced files | **None edited**. No fenced function is called by any changed source |
| Provider, model, production | **No provider call, no model call, no production read or write** |
| Rulings | 8 questions, **none blocks a merge** (§9) |

---

## 1. In plain terms

- **Before:** Work an idea only knew the game's 228 stocks. If the partner found that Corning matters to an idea, Corning stayed a "lead" and could never be one of the idea's companies.
- **After, for a player the switch admits** (PR C: the founder only):
  - The partner names a company in words ("Corning"); the server looks it up in the research directory and finds Corning (GLW). It becomes one of the idea's companies, marked **"Research only · not in the game"**.
  - Its own numbers show on the investigation (revenue and earnings against a year earlier, margins, free cash flow, debt), with **no rank**. A company that reports in another currency has the three cross-currency measures left blank, and the row says which currency it reports in.
  - The thesis card can hold it, and the idea saves with it.
  - The saved idea says **"Holds a research-only company. It can't be equipped to a battle agent."**, and "Use it in my next game" is refused with that reason. Research and battles stay separate.
- **For every Work an idea player (PR A):** the opening card now shows a company's sector and its rank among its sector peers ("Ranked 4 of 22 in Industrials"), exactly as the rankings job stored it. A research record of a company that reports in another currency no longer stores wrong cash-flow numbers.
- **What never changes:** the game's 228-stock list, what a battle agent can trade, any rank, and any investigation opened on the game list. With the switch off, every answer, prompt and stored record is byte-identical to PR A's (a golden test proves it).

---

## 2. Read first (build prompt §2): the findings

Every line number is `main` @ `a037e022`'s, read in this session (**VERIFIED**) unless marked.

**1. Rules and earlier work.** Read `docs/BUILD_RULES.md`, the Build 1, 2 and 3a reports, and the census rows R1–R7 and Part B1 (from `origin/claude/research-universe-census`, not on `main`).

**2. Where the universe is used in Work an idea.** `api/forge/shared-research.js` passed a universe **zero** times, so every helper fell back to `gameUniverse`. The calls that take one:

| Helper (declared at) | Called from the route at |
|---|---|
| `resolveSymbol` (`companies.js:36`) | `:139` (candidateSymbolsOf), `:368` (targetOf), `:748` (build-step names) |
| `companiesOf` (`companies.js:121`) | `:146` (companiesFor), `:574` (ledger adopt), `:593` (cardCtxIn), `:833` (builder adopt) |
| `namesInScopeOf` (`opening.js:60`) | `:334` |
| `openingFindingsOf` (`opening.js:122`) | `:305` (framed open), `:343` (item / drop), `:605` (own words) |
| `dropTopicOf` (`opening.js:53`) | `:351` |
| `validateFrame` (`stepSchema.js:399`) | `:239` |
| `validateStepTurn` (`stepSchema.js:432`) | `:493`; and from `validateBuildTurn` (`thesisSchema.js:281`, passes its ctx) |
| `validateBuildTurn` (`thesisSchema.js:263`) | `:755` |
| `strayTickersOf` (`stepSchema.js:160`), `maskStrayTickers` (`:173`), `retrievalLabelOf` (`:369`) | inside the validators and `opening.js`, each already passing the universe it was handed |
| `lineFailOf` (`thesisWords.js:78`), `namesAListedCompany` (`thesisSchema.js:534`) | inside `validateBuildTurn`, passing its universe |
| `stepPrompt.js` | `UNIVERSE_LINE` (`:43`) built at module load from `ALL_TICKERS`; `seen` (`:124`) masks with the default universe — neither takes one |

**3. How identity is decided today.** `identityOf` (`stepSchema.js:466-480`): a symbol from the candidate; else **`resolveSymbol(companyName)` at `:468` — any company name is upper-cased and tried as a symbol**; then, when a company name is given, `isSameCompany` (`companies.js:88-96`) must hold — `c.toUpperCase() === symbol` (`:91`), or every word of the written core name is a word of the stored name; with no company name, `namesCompany(fact)` (`:68-75`) must hold. A mismatch keeps no symbol (`identity_mismatch` / `identity_unnamed`). **Found in the golden run:** on a game-list session today, a company named "Well" becomes Welltower (WELL, one of the 228) by `:468` + `:91`. That stays as it is on the game list (section 5.7 changes research sessions only).

**4. How a mode is stamped at open.** `sharedResearchBuilderMode()` (`gate.js:84-90`) reads `SHARED_RESEARCH_BUILDER_MODE` in a try/catch (any failure → 'off'), and the route reads it once at open (`shared-research.js:315` own words, `:342` item/drop) to stamp `shape: 'builder'` (`store.js:461`, `openOwnWords`); every later branch keys on the session's own shape, never the flag. The research universe follows this exactly.

**5. The founder check.** `MANDATE_FOUNDER_UIDS`, read at call time by **`readPracticeFieldFounderList()`** (`api/_utils/practiceField/playerList.js:52`, zero imports, never throws, the founder list's one parser — ruling B4-5). `founderAllowlist()` (`founderControls.js:93`) delegates to it. **Not** `isPracticeFieldFounder` (`:121`): it is false whenever `PRACTICE_FIELD_MODE` is 'off'. This build reuses `readPracticeFieldFounderList`.

**6. The save.** `adoptIdea` (`store.js:820`) and `adoptThesis` (`:894`) end in `commitAdoption` (`:746`): the tickers are `splitRetiredTickers(capTickersArray(selected…))` (`watchlistValidation.js:35`, `:78`) — upper-cased, capped at 12 characters, **only retired symbols dropped**; the list is written `committed` with its `tickers`, and `buildSharedResearchVersion` (`hypothesisRecords/model.js:397`) checks the list, the record and the kept findings, **never a symbol**. Nothing in the save refuses or drops a research-only symbol, so RU-17 needs no save change. What gates a symbol is upstream: the ledger's symbols must be `companies.supported` (`:832-834`), the card's names must be supported (`thesis.js` card ops, `thesisAdoptionOf` `:877-878`).

**7. Every way a symbol reaches an equipped list.**
- `api/agent/equip-watchlist.js` — the one equip route. Its list checks are `equippableWatchlist` (`:72-80`: exists, not deleted, the caller's, committed), called by **both loadouts** (BaggerBomb `:98`, League `:197`) before the idempotent answer; its refusal table is `SENTINEL_TO_HTTP` (`:46-55`). **Not a fenced file**: the guard is built here (section 7), no fallback needed.
- `api/tournament/lobby-quickplay-training.js:76-93` — a practice clone's loadout spec can name a watchlist; **closed while `PER_GAME_LOADOUT_ENABLED` is true** (it is: `perGameLoadoutFlags.js:39`), because the spec is then ignored.
- `api/_utils/trainingClone.js:75` — a clone copies the ranked agent's `equippedWatchlistId` (a list that passed the equip check when equipped).
- **Editing a list after it is equipped**: `api/forge/watchlists/[id].js` refuses edits to a committed list (`:228`), but `[id]/uncommit.js` reopens it with no equip check, `PATCH` sets `tickers` to any symbol of up to 12 characters (`:163-170`, retired symbols refused only), and `[id]/commit.js` recommits it; the agent's `equippedWatchlistId` still points at it. Not closed by this build (reported, §8 point 2).
- **Ruling F2 (Oct 25) is narrower than the prompt reads it.** `rankedEquippedTickers` (`watchlistEquip.js:116`) is applied only on the BaggerBomb (tiered) path: `decide.js:480` (fenced, read only) at creation and `agent-evaluate.js:1726` at refresh. The League/tournament path folds the **whole** equipped list (`agent-evaluate.js:1727`, and `foldEquippedTickers` `watchlistEquip.js:77` keeps off-universe equipped tickers and adds them to the valid set). So for a research-only symbol: on BaggerBomb it would be watched (it stays in the Sonnet prompt and the battle's snapshot) but never a candidate; on League it could become a candidate. That is why the equip guard runs for every loadout.

**8. The opening card's two blanks.** Confirmed: `readRankingRows` (`store.js:303-314`) read `peerRankings/{sym}.sector` (`:310`); the rankings job writes `sectorId` and `sectorName` (`compute-rankings.js:959-960`), never `sector`. It also read `stockRankings/{sym}` (`:306`); **no code writes a top-level `stockRankings` collection** (every `stockRankings` in `api/` is the document `indexIntelligence/stockRankings`). A `peerRankings` document holds: `ticker`, `name`, `sectorId`, `sectorName`, `compositeScore`, `compositeRank`, `totalPeers`, `metricsAvailable`, `tier`, `dnaBadge`, `pillars`, `metrics`, `debtRiskBadge`, `scanner`, `leaderboard`, `sectorSummary`, `computedAt` (its time; there is no `updatedAt`), `expiresAt` (`compute-rankings.js:956-1012`).

**9. The currency.** The filter takes `Financials` whole (`rankingConfig.js:813-814`: `Highlights,Valuation,Technicals,Earnings,Financials,SharesStats,General::Name`), so each statement's own **`Financials.Income_Statement.currency_symbol`, `Financials.Cash_Flow.currency_symbol` and `Financials.Balance_Sheet.currency_symbol`** come back — Build 2 measured TSM's as `TWD` (its report §7.2). `General::CurrencyCode` is the listing currency (USD for TSM) and is not used. No saved GLW/TSM response was found on this machine (Build 1's saved screener fetch holds no fundamentals), and the test fixtures carry no currency field; no provider call was made.

**10. The pins.** `prompt.honesty.test.js` pins the rulebook §4 lines and §5 method text byte for byte, the registry entry, and no forbidden pattern in the step/frame system prompts. `prompt.builder.test.js` pins rulebook §6 (THESIS_BUILDER_RULES) byte for byte, the builder prompt's order (§4 without lines 1 and 7, §6, method), the builder user turn's masking and goal lines. `promptBudget.test.js` pins `fitPrompt`'s trimming. None pins a whole prompt's bytes, so PR B adds one: `shared-research.universeOff.golden.test.js` records every system and user prompt (and every answer, write and stored document) at PR A's tip, before any PR B code.

---

## 3. PR A: what was built

### 3.1 Companies that report in another currency (RU-19)

`api/_utils/researchMeasures.js` only; `stockMeasures.js` (the game's math) is untouched.

| Change | Where |
|---|---|
| `reportingCurrencyOf(data)`: each statement's own `currency_symbol` (Income_Statement, Cash_Flow, Balance_Sheet), a three-letter code upper-cased; when they disagree, the first that is not USD; `null` when none names one. Never the listing currency. | `researchMeasures.js` (new export) |
| The record gains `reportsIn` and `heldBack`. Not USD → `fcfYield`, `fcfMargin`, `priceSalesTTM` stored as `null` and named under `heldBack`; USD or unknown → nothing held back. | `buildRecord` |
| `MEASURES_SHAPE_VERSION` 1 → 2, so a version 1 record is fetched again on its next touch (Build 2's own `planResearchFetch` rule). | `researchMeasures.js` |
| An unavailable record with no earlier numbers carries `reportsIn: null, heldBack: []`. | `buildUnavailableRecord` |
| `scripts/research-stock.mjs` prints `reports in: TWD; held back (left blank): fcfYield, fcfMargin, priceSalesTTM…`, `reports in: USD; nothing held back`, `reports in: unknown…`, or `not recorded (shape version 1…)`; a held-back measure prints `held back (reports in TWD)` instead of a number. | `currencyLine`, `renderRecord` |

Tests (`researchMeasures.test.js`, `scripts/research-stock.test.js`): a USD filer unchanged; a TWD filer's three measures blank and why; no currency treated as before and said unknown; mixed statements; never the listing currency; a version 1 record refetched; a version 2 record kept 7 days; the script's four lines.

### 3.2 The opening card's sector and rank (RU-21)

| Change | Where |
|---|---|
| `readRankingRows` reads `peerRankings/{sym}` only: `name`, `sectorName`, `compositeRank`, `totalPeers` (whole numbers only), `metrics`, `computedAt`. The read of a top-level `stockRankings/{sym}` is gone. | `api/_utils/sharedResearch/store.js` |
| `storedRowsOf` shapes `peer: { sector, metrics, asOf }` and `ranking: { rank, of, sector, asOf }` — the rank exactly as stored, `null` when the document holds no whole rank within its peer count or no sector name. | `api/_utils/sharedResearch/opening.js` |
| The card line: name and symbol, the sector, **"Ranked {n} of {total} in {sector}"**, "As of {date}"; a row with no rank leaves that line out. Every word in `sharedResearchCopy.js` (`storedRank`). | `parts.jsx` `StoredRow` (Work.jsx renders it) |

Display agreement (BUILD_RULES §9): `rank` and `of` are `compositeRank` and `totalPeers` as stored; a rank of 2.6, 0, or past the peer count is no rank (a test row each).

Tests: a row with sector and rank; a sector and no rank (five shapes); a symbol with no document; the old `stockRankings` read gone (the reads recorded, a planted `stockRankings` document never read); the route's rows from a job-shaped document; the client line; the copy guard sweep (the new function walks with the table).

**One ruled difference recorded in an existing golden.** `shared-research.b6a.ftParity.test.js` compares every answer with `main`'s; its seed carried `sector` and a `stockRankings` document, so its rows move. The rows are now compared apart and pinned to the new shape; everything else still equals `main`'s.

**Where the card shows.** The opening card renders in the ledger's Work screen only, and only before the first answer. Every investigation opened since the builder switch went on (Nov 18) is a thesis builder, whose screen has no card, so the fix reaches ledger investigations opened before then. Recorded as found (§11 point 1).

---

## 4. PR B: what was built

### 4.1 The switch and the stamp (section 5.1)

- `SHARED_RESEARCH_UNIVERSE_MODE` (`src/config/sharedResearchFlags.js`): `'off' | 'founder' | 'on'`, merged `'off'`, pinned in `sharedResearchFlags.test.js` and noted in `flagPinGuard.test.js`'s dark block, as the builder switch is.
- `universeModeNow()` reads it at call time inside a try/catch: any other value, a missing export or a read that throws is `'off'` (the route suites that mock the flag module without the new export therefore run exactly as before).
- `'founder'`: `readPracticeFieldFounderList().includes(uid)`.
- **Stamped once, at open** (own words, an item or a drop, and a framed observation's open — not its framing): `universe: 'research'` on a research session only. A game-list session gains no field, so its stored record is unchanged. `sessionViewOf` carries `universe: 'research'` only on a research session.

### 4.2 One place decides the universe (section 5.2)

`api/_utils/sharedResearch/sessionUniverse.js` (pure): `universeOf(session)` is `gameUniverse` itself for a game-list session, or the research session's universe — the research list's `{ has, retired }` plus `research`, `strictCase`, `lookupName`, `sameCompany` and `eligibilityOf`. Each helper reads these optionally, so the game universe, which has none, behaves exactly as before. The route hands it to every call of §2 point 2 (and the three prompt renderers and `targetBlockOf`); names go through `researchRows.js` `namesFor(db, symbols, session)`. **`shared-research.universeCallSites.test.js`** parses the route and eight helper modules (`store.js` and `explore.js` added by review L1-4) and fails on any call of a universe-taking function that names no universe; every one of its 76 call sites (47 in the route), its universe removed, is flagged (a mutant per site, in the file).

### 4.3 What the partner is told (section 5.3)

- A game-list session's prompts are byte-identical (the golden, §5).
- A research session's step and builder system prompts keep the same game list and gain one line, after it: *"For any company not on the list, write its name in words and leave the symbol empty. The server looks the company up. Never write a ticker from memory in a sentence."* (`RESEARCH_NAMES_RULE`). The directory's symbols are never added (a route row: no GLW, no TSM in the system prompt).
- Text the partner sees is masked against the session's universe (`seenIn(universe)`): on a research session "Corning (GLW)" in a retrieved title is shown as written; on a game-list session it reads "(symbol not in the app's records)".

### 4.4 Names (section 5.4)

`namesFor`: a game stock's `peerRankings/{sym}.name` (store.js `readNames`, unchanged); a research stock's kept research record's name, else the directory's (`researchNameOf`). A game-list session calls `readNames` itself.

### 4.5 Everyday names (section 5.5, RU-20)

`api/_utils/sharedResearch/everydayNames.js`, 29 entries, each with its reason: Google → GOOGL, Facebook → META, TSMC / Taiwan Semi / Taiwan Semiconductor → TSM, J&J / Johnson and Johnson → JNJ, P&G / Procter and Gamble → PG, AmEx → AXP, BofA → BAC, JPMorgan → JPM, Goldman → GS, Disney → DIS, Exxon / ExxonMobil → XOM, Lilly → LLY, Raytheon → RTX, Toyota → TM, Honda → HMC, AB InBev → BUD, Uber → UBER, Palantir → PLTR, Micron → MU, Marvell → MRVL, Arista → ANET, Spotify → SPOT, Mercado Libre → MELI, Pinduoduo → PDD.
On research sessions only: `sameCompany` accepts a listed everyday name for its symbol, and the lookup reads the list. Tests: at most 40, each maps to one symbol on the research list (not retired), no name twice, no name is another directory company's core name or (as far as code holds the 228's names, `src/config/stockData.js`) another game company's, no name is another company's symbol, no product or division words, each resolves through the lookup to its own symbol, and **each works through the real step validator** (review L2-3 found "TSMC" and "JP Morgan" failed the step's ticker scan: "TSMC" may now stand in a research session's text, "JP Morgan" left the list).

**Safe for game-list sessions too?** Yes, as far as identity goes: each name maps to exactly one company and collides with no other listed company's name or symbol. But it would change game-list sessions (a "Google" fact with GOOGL would keep its symbol where it is dropped today), so it is a behaviour change needing its own one-line PR and ruling, not a free addition. One asymmetry to rule with it: Alphabet has two game symbols; "Google" maps to GOOGL only, so "Google" offered with GOOG stays a mismatch.

### 4.6 Finding a research company by its name (section 5.6)

**The lookup** (`sessionUniverse.js` `lookupName`). A name's lookup key is its core name (`coreNameOf`), with the directory's share-type tails dropped ("ADR", "American Depositary Shares", "Class A Ordinary Shares", "Common Stock", "New York Registry Shares", "SAB de CV", "LP", "LLC", "Corp"), NFKC, lower case, apostrophes dropped ("Moody's" = "Moodys"), other punctuation as spaces.
- **Only a directory core name or a listed everyday name can give a symbol.**
- **It gives one only when exactly one company could be meant.** That counts every company whose name it is and every company whose name *begins* with it, the 228 included.
  - "Viking" is Viking Holdings' whole name and Viking Therapeutics' first word, so it is neither.
  - "Vertex" is Vertex Inc's name and Vertex Pharmaceuticals' first word (a game company).
  - "Compass Group" reduces to "compass", which several companies begin with.
  - None of these resolves. Review L2-1; the build prompt's plain letter, one exact match, would have attached each to the wrong company.
- **The 228's names** come from `api/_utils/sharedResearch/gameCompanyNames.js`, a data file of Build 1's screener names (227, plus FMC by hand), used for this ambiguity only. A game company is never found by its name: its symbol is on the partner's list.
- **Exactly one company → its symbol**, then the identity check runs as for any symbol. None, or more than one → no symbol (a lead, as today).
- **Offline count** (Build 1's screener names):
  - 0 game names equal a directory core name;
  - 16 directory core names are shared by share classes or two banks (Zillow, Brown-Forman, Moog, Heico, First Bancorp…), so they resolve to none;
  - 24 directory companies' whole names are another directory company's leading words (the refuter's count), so they resolve to none.

**Identity on a research session** (`sameCompany`, the research half of `isSameCompany`; `identityOf` in `stepSchema.js`):
- **A listed everyday name is its symbol's company.**
- **A research-only company is named only by its whole core name**, and only when no other company could be meant by it.
  - Never a part of its name: "Apple" is not Apple Hospitality REIT.
  - Never its symbol alone: "BYD", "CSL" and "CMS" are the Chinese carmaker, the Australian plasma company and the Medicare agency before they are Boyd Gaming's, Carlisle's and CMS Energy's symbols (review L2-2).
  - Never with no company named: GOLD offered for a Barrick fact keeps no symbol, `identity_unnamed` (review L2-4).
- **One of the 228 is identified as on the game list**: its symbol written in capitals, unless that word is another company's name, or the game list's every-word rule.
- **A name read as a ticker and a name found by the lookup that point at two different companies give neither** (`identity_ambiguous:X|Y`). Example: "HP" is Helmerich & Payne's symbol and HP Inc's name.
- **The price is recall, never a wrong company.** A company whose whole short name is another's first word (Viking Holdings, Compass Inc, Prudential plc, Crown Holdings, Brookfield…) stays a lead under that short name, even when its symbol is offered. Its full name works when nothing else begins with it ("Viking Therapeutics", "Prudential Financial").

### 4.7 Symbols that are also words (section 5.7)

**How a name is read as a ticker on a research session** (`nameAsTickerOf`; used by `stepSchema.js` identityOf, `thesisSchema.js` why reasons and the route's candidates):
- Only when written in capitals.
- A single capital letter only when it is one of the game's own symbols. "A" is Agilent and "U" is Unity in the directory.
- A research-only company still needs its real name (§4.6). So "the word in capitals with that company's real name" names it, and the word in capitals alone does not.
- `namesAListedCompany`, the dead-end reply check, counts a one- or two-letter word only when it is a game symbol. "A supplier…" and "IT budgets…" never read as a company.
- The game list is unchanged: "Well" still becomes WELL there (§2 point 3).

**The table: 37 word-like directory symbols**, each run through the real step validator. For each one: prose naming it in words names no company; the word in capitals alone names no company; its symbol with its real name names it. The symbols are CASH, KEY, OPEN, ALL, AN, BILL, CAR, COLD, DOC, EAT, EYE, FAST, FIVE, FUN, GO, HAS, HOPE, IT, KEYS, LIFE, MAIN, MAN, MOD, OUT, PAY, REAL, RUN, SKY, TEAM, TECH, TEN, WAY, YOU, CALM, FLY, STEP and SITE.

**Also tested:**
- A and U, the single letters.
- ON: ON Semiconductor's symbol and the first word of On Holding's name, so neither.
- POST: Post Holdings' whole name.

### 4.8 Eligibility stays the game's (section 5.8)

`eligibilityOf`: one of the 228 (not retired) `'eligible'`; a research-only company `'research'`; anything else `'outside'`. `ELIGIBILITY_LABELS.research` = "Research only · not in the game" (`src/constants/sharedResearch.js`). **Every reader of `eligibility`:**

| Reader | What it does with `'research'` |
|---|---|
| `api/_utils/sharedResearch/companies.js` `companiesOf` | writes it (the research session's `eligibilityOf`; the game list as before) |
| `api/_utils/sharedResearch/adoptPreview.js:108` | passes it through to the ledger's preview companies; gates nothing (a company is adoptable by its carried-findings count, never by eligibility) |
| `src/components/SharedResearch/parts.jsx:164` (`CompanyCard`) | shows `ELIGIBILITY_LABELS[...]`: "Research only · not in the game" (before this build an unknown value fell to the "Symbol · not in the app's records" label) |
| `src/components/SharedResearch/sharedResearchView.js` `holdsResearchOnlyIn` (new) | the saved idea's research-only line |
| tests and fixtures (`answers.json`, `companies.test.js`) | `'eligible'` only |

No server gate reads `eligibility`; nothing treats `'research'` as eligible (a mutant that makes it `'eligible'` is killed, §6).

### 4.9 A research company's numbers on the investigation (section 6)

`api/_utils/sharedResearch/researchRows.js`:
- **Fetched through `fetchResearchStock` (Build 2), unchanged**: the 200-a-day ceiling, one fetch per symbol per UTC day, the 7-day keep, the once-a-day retry.
- **At most 10 research companies per investigation** (`fetchableOf`): the names in scope at open, then each research company in the order its first Source-backed relationship finding entered the record. Findings are appended and never removed, so the first ten never change; an eleventh is never fetched, whatever is superseded later. Its row says **"Its numbers were not fetched: an investigation fetches numbers for at most 10 research companies."**
- **When:** at open (names in scope), on every read of a research session, and after a step. Each starts a fetch only within 18 s of its request's start and aborts one still under way at 26 s (`RESEARCH_FETCH_START_BY_MS`, `RESEARCH_FETCH_ABORT_AT_MS`; review L2-5 added the limit to reads and opens), so the answer still leaves inside the function's 30 s. An aborted request is stored as Build 2's `network_error`: that company's numbers wait a day for their next try. A step's rows never fail its answer (review L2-6).
- **The rows** of a research session: the names in scope at open and the idea's supported companies; a game stock's row is PR A's; a research company's: name and symbol, its sector (the house sector's name), "Research only · no rank", the date fetched, and each kept measure that is not null (revenue and earnings against a year earlier, gross and profit margin, free cash flow margin and yield, price to sales, debt to equity, current ratio, interest coverage, net debt to EBITDA); the RU-19 currency line once; "These numbers are more than 7 days old." when stale.
- **A failed, refused or over-ceiling fetch** (or no key in the environment) never fails the step or the open: the row says **"Its numbers are not available today."**
- **The analyst-estimates finding at open was not built**: a ruling question (§9, Q-1).
- Client: on a research session only, the builder card holds **"What the records already hold"** (a fold-out) with these rows — the founder's ruling of Nov 27 in this session ("Add rows to builder"); the ledger's Work screen shows research rows in its opening card. A research session's step answers carry `storedRows`; a game-list session's carry none, as before.

### 4.10 Saving, and keeping research out of battles (section 7)

1. **Saving works, unchanged** (§2 point 6): the card holds GLW, the thesis saves, the list holds GLW, and the confirm line reads "Saved as an idea · Corning Incorporated · …" (a route row).
2. **The saved idea says what it is**: "Holds a research-only company. It can't be equipped to a battle agent." on the thesis-ready card, the thesis-saved screen and the ledger's saved idea, worked out each time from the companies' `eligibility`.
3. **The equip guard was built** (not the fallback): `api/agent/equip-watchlist.js` `equippableWatchlist` — run by every loadout, before the idempotent answer — refuses **a saved idea** (a list Work an idea saved: its `sourceSharedResearchSessionId` marker) holding a research-only company: code `research_only_list`, HTTP 400, message **"This idea holds a research-only company and can't be equipped to a battle agent."** Each symbol is spelled as the house spells it (upper case, a dot as a hyphen) before `isResearchStock`. A fund on neither list (KRE) is equipped as today. **A Forge list equips as before, whatever it holds** (review L1-1: as first built, the guard refused any list holding a directory company — TSM, UBER, ASML, ARM… — with the switch off, which PR B, "seen by nobody", must not do; a ruling question, Q-3). The Work an idea screens show the refusal's words in their equip-failed notice.
4. **Other paths** (reported, not chased): §2 point 7 and §8 point 2.

### 4.11 The boundary

`researchUniverse.boundary.test.js` allows exactly the new importers — `sessionUniverse.js`, `researchRows.js` (also on the fetch module's list), `api/agent/equip-watchlist.js` — and their tests, and still fails on any other file. The switch's own name contains "RESEARCH_UNIVERSE"; it is set aside before the scan, so files that only name the switch (the flag module, its pin, the flag guard's note, route tests' mocks) pass, and a file naming the switch and anything else still fails (planted rows).

---

## 5. Tests (build prompt §9)

No row calls the provider, a model or Firestore: the route runs on the atomic in-memory Firestore double (`srFirestore.js`), the model and the search are seams, and research fetches run against a fake `fetch`.

**Off means off.** `api/forge/shared-research.universeOff.golden.test.js` pins five investigations through the real route, with ids and clock pinned:
- **What it runs:**
  - a builder from own words: a failed step, then to a saved thesis, with a stale save refused first, and the read after;
  - a builder from a story;
  - a ledger from a story: a step, an examine, a direction, a replay, a failed refresh, a refused card op, the preview, the save and the read after;
  - a framed ledger, its step and its close;
  - a SignalDrop;
  - the open list and Explore's read.
- **What it pins:** every answer, every model call's system and user text and schema, every search's arguments, every shadow-log record, every write, and every stored document.
- **Where the golden came from:** written by this file at **PR A's tip**, before any PR B code. It was widened twice after the review (shadow log, more paths, a stray ticker in a question) and regenerated there each time.
- **It matches key by key with:**
  - the switch `'off'`;
  - `'founder'` for a player not on the list;
  - the switch turned `'on'` after each investigation opened (a game-list session opened before the switch behaves the same after it).

**The research session** (`api/forge/shared-research.research.route.test.js`, 15 rows; `api/_utils/sharedResearch/sessionUniverse.test.js`, 121 rows):
- **Stamping:**
  - the stamp at open, by switch value and uid;
  - a framed ledger stamped at open, not at its framing;
  - the stamp never changes.
- **Corning, own words to a saved thesis:**
  - "Corning" in words with no symbol ends as a verified relationship carrying GLW, supported and marked `research`;
  - the card holds GLW, the thesis saves, the list holds GLW, and the confirm line names Corning;
  - the saved read says `research`.
- **Identity:**
  - "Google" → GOOGL;
  - two directory companies → neither;
  - a wrong offered symbol dropped;
  - the 37-row word table, single letters, ON and POST;
  - a ticker on neither list still fails the step;
  - the review's identity rows (Viking, Vertex, Prudential, Compass Group, BYD, CSL, CMS, GOLD, APLE, TSMC, every everyday name through the validator, Moody's, the dead-end reply).
- **Stored rows:**
  - a research company's row;
  - a TWD filer's held-back measures;
  - the 11th company not fetched, and never fetched later;
  - a refused fetch, an over-ceiling fetch and a missing key each leave the step intact;
  - a game stock's PR A row on a research session.
- **The prompts:** the rule added once; no directory symbol added; the research ticker unmasked on a research session and masked on a game-list one.
- **Side by side:** the founder's research session and another player's game-list session, with the same model answer.

**Every call site** (`api/forge/shared-research.universeCallSites.test.js`):
- It parses the route and eight helper modules with `@babel/parser`.
- It fails on any call of a universe-taking function that names no universe.
- Every one of its sites is mutation-proved in the file itself: each site's universe is removed in turn, and the test checks that site is flagged.
- It also checks that names go through the session's name source.

**The equip guard** (`api/agent/equip-watchlist.researchOnly.test.js`), for every loadout (League, BaggerBomb, absent):
- **Refused:** a saved idea holding a research-only company, including an already-equipped one.
- **Equipped as today:**
  - a saved idea of game stocks;
  - a list with a fund outside both lists (KRE);
  - a Forge list holding TSM or GLW.

**Research rows** (`researchRows.test.js`), **everyday names** (`everydayNames.test.js`), **the game names data** (`gameCompanyNames.test.js`), **the client** (`SharedResearchSheetBody.research.jsdom.test.jsx`):
- Client, research session: the builder's rows, the measures and their formats, the held-back line once, not fetched / not available, the research-only line.
- Client, game-list session: none of it renders.
- Client, equip refusal: research_only_list's words in the equip notice; any other failure shows the notice as before.

**The boundary** (`researchUniverse.boundary.test.js`): exactly the new importers allowed (and the switch's own name set aside), and planted rows prove any other mention still fails.

**Unchanged pins, passing:**
- `rankingConfig.test.js`, `wireGenerationSurface.test.js` (Linux), the measures golden (`compute-rankings.measuresGolden.test.js`) and the research-universe suites;
- the three prompt files (`prompt.honesty.test.js`, `prompt.builder.test.js`, `promptBudget.test.js`).

**Rows that failed first.**
- Prompt §3 and §4: every new row fails on `main` (written with the change).
- The review's rows: **61 rows fail on `6556d21f`** (the code before the fixes) and pass after. They are the word table's "capitals alone" ×37, Viking / Prudential / Vertex / Compass Group, BYD / CSL / CMS, GOLD / APLE / GLW unnamed, TSMC ×2, JP Morgan, Moody's, the dead-end "IT", the Forge-list equip ×3, the marker row, ON / POST, and store.js / explore.js in the call-site scan.

---

## 6. Review (BUILD_RULES §2)

The cumulative diff passes the threshold (48 files before the review), so the review ran as the prompt asks: two lenses, each with a refuter.
- **Isolation:** each lens and each refuter worked on its own `git archive` snapshot of `6556d21f`, read only on git and on the working tree, with `node_modules` as a junction removed afterwards.
- **Fixes:** I applied them test-first: 61 rows failed before (§5).

### Lens 1: off means off, and the game is untouched

| # | Sev. | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | important | The equip guard reads neither the switch nor where a list came from: with the switch `'off'`, a Forge list holding a directory symbol (TSM, UBER, ASML, ARM, SOFI…) is refused where `main` equips it | **CONFIRMED IN PART**: real (first equip and idempotent re-equip both move 200 → 400), but rated low. No screen can put a directory symbol on a list while the switch is off (Forge search, the Screener, SignalDrop, Discover themes and Work an idea are all game-only, and the rules forbid client writes to `watchlists`); only a hand-built POST or PATCH can. Gating the guard on the switch would be wrong: a list saved under `'founder'` must stay refused after a rollback | **Fixed** anyway: the guard refuses a **saved idea** only (its session marker), never by the switch, so a list saved under `'founder'` stays refused after a rollback; a Forge list equips as before. Q-3 |
| L1-2 | test gap | The golden mocks the shadow log, so its records are not pinned (a mutant field in `modelCallRecord` passed) | **CONFIRMED** (low) | **Fixed**: the golden records every shadow-log record; regenerated at PR A's tip |
| L1-3 | test gap | The golden never drives examine, direction or refresh, a replayed step, the failure paths, a ledger close, a refused card op or the `?list=` reads; a mutant unmasking the examine target on game sessions passed | **CONFIRMED**, wider than reported (the mutant passed 1,100+ rows) | **Fixed**: the golden drives each, with a stray ticker in the ledger's question; the mutant is killed (battery) |
| L1-4 | nit | The call-site scan leaves out `store.js` (the card's free action) and `explore.js` | **CONFIRMED** (no behaviour effect: the universe sets only `eligibility` there) | **Fixed**: both call sites pass the session's universe, and both modules are in the scan |
| L1-5 | latent | The practice clone's loadout spec (`lobby-quickplay-training.js`) equips a list with no research-only check | **CONFIRMED** (dead while `PER_GAME_LOADOUT_ENABLED` is true; the file names that flag as a rollback switch) | Recorded (§8 point 2) |
| L1-6 | nit | `equipIdea` marks the idea `ready` before the equip is refused | **CONFIRMED IN PART**: the order is `main`'s; reachable only once PR C admits the founder | Recorded (§8 point 2) |
| — | pre-existing | Editing an equipped list (uncommit → PATCH → commit) and `firestore.rules:357-360` agent create both bypass any equip check | **CONFIRMED** as not this build's (the files are unchanged from `main`) | Recorded (§8 point 2, §11 point 5) |

### Lens 2: identity is right

| # | Sev. | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L2-1 | important | A short name that is one directory company's whole name attaches to it when another company is meant ("Viking", "Prudential", "Compass Group", "Vertex") | **CONFIRMED** (premise corrected: PRU is a directory company, not a game stock; 24 directory names are another's leading words); the build followed the prompt's letter | **Fixed** (§4.6): a name another company could be meant by is no company; the 228's names added as data for this. A stricter reading than the letter: Q-4 |
| L2-2 | important | A capitals abbreviation of a non-listed company becomes a directory symbol ("BYD" → Boyd Gaming, "CSL", "CMS"); on the game list these failed closed | **CONFIRMED**; mandated by prompt §5.7's letter and pinned by the build's own row | **Fixed**: a research-only company is never identified by its symbol alone (§4.6, §4.7). Q-4 |
| L2-3 | minor | "TSMC" and "JP Morgan" fail the step's ticker scan, so two list entries could never work | **CONFIRMED** (2 of 30 fail) | **Fixed**: "TSMC" may stand on a research session; "JP Morgan" removed; every entry run through the validator |
| L2-4 | minor | A wrong symbol with no company named is kept by a case-insensitive word match (GOLD on "Barrick mines gold") | **CONFIRMED**; contradicts the build's own whole-name rule | **Fixed**: `identity_unnamed` for a research-only symbol with no company named |
| L2-5 | moderate | Reads and opens fetch with no time limit | **CONFIRMED IN PART** (one hung request is the realistic trigger) | **Fixed**: the same start-by / abort limits as a step |
| L2-6 | nits | (a) "Moody's"; (b) an aborted fetch waits a day for everyone; (c) common-word research names trip `names_another_company`; (d) two-letter symbols in a dead end's reply; (e) a read error after a saved step | all **CONFIRMED**; (e) in part (the base already rethrew one such read) | (a) **fixed**; (b) recorded (Build 2's failure rule; §9 Q-7); (c) recorded, fails safe; (d) **fixed**; (e) **fixed** for the new read |

**Split:** lens 1 found 6 (one important), its refuter confirmed 4 and confirmed 2 in part; lens 2 found 6 (two important), its refuter confirmed all, one in part. Nothing was refuted. **Fixed, each with a row that failed first:** L1-1 to L1-4, L2-1 to L2-5, L2-6 (a), (d) and (e). **Recorded:** L1-5, L1-6, L2-6 (b) and (c), and the two pre-existing equip paths.

### Mutation battery

On the final code, each mutant in its own run against a snapshot, judged by exit code and failing rows, every file restored byte for byte:
- **44 mutants: 43 killed.**
- **Coverage:**
  - the switch and the stamp;
  - the lookup, its prefix rule and the game names;
  - the capitals and single-letter rules;
  - the research-only identity rules, the ambiguity note and the everyday names;
  - eligibility, the prompts and the masking;
  - the 10-fetch limit, the deadline and the catch;
  - the equip guard, its spelling and its saved-idea gate;
  - the currency hold-back and the shape version;
  - the rank bounds and the old sector read;
  - the client's rows gate, the equip code, the research-only line, the held-back line and the null measures;
  - the framed open's stamp, a step's rows on a game session, the examine prompt's masking and a shadow-record field.
- **Three first-round survivors got rows:**
  - an ambiguous whole name offered with its own symbol (VIK with "Viking");
  - the examine target block's masking on the game list, now pinned by a stray ticker in the golden's ledger question;
  - a game-session step answer carrying rows.
- **The one survivor, M07, is equivalent on today's data.** It removes the "another company's name" check on a game symbol written in capitals, and no game symbol's word is another company's name today.

---

## 7. Verification

**Where.**
- WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, each full suite under `flock /tmp/pd-suite.lock`.
- Runs were on throwaway merges of each branch head with `main` @ `4550a13e` (#1125), the `main` of the moment.
- The linked `node_modules` was installed from the same lockfile (hash `6d01297094c2` on both sides).

| Run | Tree | Result |
|---|---|---|
| Full suite, B | `e4f97e09` + `main` = `4c1b8c11` | Test Files 1 failed, 1,706 passed, 14 skipped (1,721). Tests 1 failed, 39,832 passed, 202 skipped |
| The one failure, alone | the same tree | `src/config/backingBetaFlags.test.js` "EVERY importer of the backing modules is enumerated" timed out in the suite: 5,454 ms against the default 5 s. It walks the whole repository for importers of the backing modules; no file of this build is one. Alone: **13 of 13 passed**, that row in 2.9 s |
| Full suite, C | `4e2d7c0f` + `main` = `a450662f` | **exit 0**. Test Files 1,707 passed, 14 skipped (1,721). Tests 39,833 passed, 202 skipped |
| `npm run lint:gate` | C + `main` | **exit 0** |
| `npm run build` | C + `main` | **exit 0**. A search of `dist` for strings only the server data holds (two directory names, a name from `gameCompanyNames.js`, the everyday names' export) finds none |

**Also checked:**
- **On Windows** (this worktree), every new and amended test file of this build passes.
- One known exception: `src/constants/eligibility.test.js` reds on a CRLF checkout (§11 point 7).

**Not run, and why:**
- **The rules suite (`test:rules`).** `firestore.rules`, `firestore.indexes.json` and `test/rules/` are unchanged, and no rules test imports a module this build changes.
- **A real browser.** The builder rows, the research-only line and the equip refusal's words are proven in jsdom (`SharedResearchSheetBody.research.jsdom.test.jsx`) only. The founder's checklist (§10) is the first look on a phone.

---

## 8. Answers the build prompt asks for

1. **PRs, in merge order:** A (`claude/work-an-idea-card-and-currency`), then B (`claude/work-an-idea-research`), then C (`claude/work-an-idea-research-founder`). Their numbers are in each PR's description; this report is committed before they open.
2. **The equip guard was built**, not the fallback: `api/agent/equip-watchlist.js` is not fenced.
   - It refuses a saved idea holding a research-only company, for every loadout.
   - Other paths by which a research-only symbol can reach an equipped list, none added by this build:
     - **Editing a list after it is equipped:** `[id]/uncommit.js` (no equip check), then `PATCH /api/forge/watchlists/[id]` (any symbol up to 12 characters; retired symbols refused only), then `[id]/commit.js`. The agent's `equippedWatchlistId` still points at the list, which is read live at deploy. On League the whole list is folded in (`foldEquippedTickers`); on BaggerBomb F2 keeps an off-list symbol watched but never a candidate. **To close it:** refuse the uncommit, the PATCH or the recommit of a saved idea (or of any equipped list) when it would hold a research-only company. That is one check in a non-fenced route.
     - **Agent create:** `firestore.rules:357-360` lets a client set `equippedWatchlistId` to any list it owns, uncommitted included. **To close it:** a rules change, and the rules suite with it.
     - **The practice clone's loadout spec** (`api/tournament/lobby-quickplay-training.js:76-93`): it checks exists, owned and committed, but not research-only. It is closed while `PER_GAME_LOADOUT_ENABLED` is true and reopens on a rollback. **To close it:** the same `holdsResearchOnly` / `isSavedIdea` check.
     - **A clone copying the ranked agent's equipped list** (`trainingClone.js:75`): it carries a list that passed the guard when it was equipped, so it is open only through the edit path above.
     - **The "ready" step before equip** (`src/services/sharedResearchService.js` `equipIdea`): a research-only idea is moved to `ready` before the equip is refused. Nothing is equipped. **To close it:** skip "Use it in my next game" for an idea that holds a research-only company.
3. **Every reader of `eligibility`** and what it does with `research`: §4.8. None treats it as eligible.
4. **The everyday names**, 29 of them: §4.5. **Safe for game-list sessions?** As identity, yes: no collision with any listed name or symbol, and each entry is tested through the validator. But it would change game-list sessions, so it needs its own one-line change and ruling (§4.5). The GOOG/GOOGL asymmetry should be ruled with it.
5. **Game-list prompts and answers are byte-identical with the switch off.** The golden (§5) proves every answer, prompt, shadow-log record, write and stored document against PR A's tip, for 'off', for 'founder' with another player, and for a switch turned on after open. The golden covers the Work an idea route; the equip route is pinned by its own rows: every list other than a saved idea holding a research-only company equips exactly as before, whatever the switch.
6. **Stopped on a ruling:** §9.
7. **The founder's checklist:** §10.

---

## 9. Stopped on a ruling

None blocks a merge. Each item was built to the stricter or narrower reading named, or left out where noted.

| # | Question | As built |
|---|---|---|
| **Q-1** | **The analyst-estimates finding at open (prompt §6) needs a new source kind.** `findingRecordKinds.js` is closed and "grows only with a new schema version". A bump to record schema version 3 changes every newly minted record, game sessions too, against prompt §9's off-means-off. In this build the case is unreachable: stories and drops carry only the 228 (`storyCheck.js:215`; SignalDrop's validation), so no research company is in scope at open. | **Not built.** Rule at Build 4, when Explore stories may tag a research company: bump the schema, or cite the research record some other way? |
| Q-2 | **The builder shows research rows** — not named in the prompt, ruled by the founder in this session ("Add rows to builder"). | Built on research sessions only |
| Q-3 | **The equip guard covers saved ideas only** (review L1-1). Prompt §7.3's letter is "a list that holds a research-only company"; built as first written it refused any Forge list holding a directory company (TSM, UBER, ASML…) with the switch off, which PR B — "seen by nobody" — must not do. RU-18 itself says "a saved idea". | Saved ideas (the session marker). Should every list holding a directory company be refused? |
| Q-4 | **Identity is stricter than prompt §5.6–§5.7's letter** (review L2-1, L2-2, L2-4). The letter ("exactly one match gives the symbol"; "a name in capitals is read as a ticker") attaches "Viking" to the cruise line and "BYD" to Boyd Gaming. | A research-only company is named only by its whole name when nothing else could be meant, never by its symbol alone. Some short names stay leads (§4.6) |
| Q-5 | **The builder's own words still say "the game's list".** Prompt §5.3 allows one added rule. The builder rules (rulebook §6, pinned byte for byte), the find_names goal line and the companies contract still say names come from "the game's list" or "the game universe". The partner may hesitate to name a research company, though the server resolves one when it does (the route rows show it). | One rule added, the rest unchanged. A research-session wording for those lines? |
| Q-6 | **Reads fetch.** A GET of a research session fetches missing numbers (it writes `researchMeasures` and `researchFetchDays`), within the step's time limits. A game-list GET is unchanged. | As built |
| Q-7 | **An aborted fetch waits a day for every player** (Build 2's failure rule, applied to the abort at 26 s). | As built |
| Q-8 | **Everyday names on game-list sessions** (§4.5). | Research sessions only |

---

## 10. The founder's checklist (after PR C is live; on a phone)

1. Open the app. In the Command Center, open **Work an idea**. Under **Bring your own starting point**, write your own words about Corning, for example: "Corning's glass is in the fiber inside every AI data center". Tap **Start my thesis**.
2. Tap **Map the segments**. On the card, pick the segment about fiber or glass.
3. Tap **Find the listed companies**. The partner should name Corning. Open the names choices: **Corning Incorporated · GLW**, marked **"Research only · not in the game"**. If the partner names no company, try **Find the listed companies** once more, or steer it ("look at Corning"): it still reads "the game's list" in its own rules (Q-5).
4. On the card, open **What the records already hold**. Corning's row reads Technology · **Research only · no rank** · the day fetched, then its own numbers. There is no rank line.
5. Set the names to Corning. Tap **Find the reasons**, confirm the why, pick what would prove it wrong, and pick the time frame.
6. Tap **Save thesis**. The saved screen names Corning and carries **"Holds a research-only company. It can't be equipped to a battle agent."**
7. Optional: in the Forge, the saved list holds GLW. Then go back to the saved idea in Work an idea.
8. Tap **Use it in my next game**. You should see **"This idea holds a research-only company and can't be equipped to a battle agent."** Your agent is unchanged.

---

## 11. Found outside the task (reported, not fixed; BUILD_RULES §3)

1. **The opening card (PR A) shows only on ledger investigations, and only before the first answer.** Every investigation opened since the builder switch went on (Nov 18) is a builder, whose screen had no card. Research sessions now have the builder rows (Q-2); game-list builders still show no stored rows.
2. **A company name that holds a capital word on no list fails the whole step**, on either list ("AAR Corp", "AT&T", "LVMH": `stray_ticker`). Pre-existing, and somewhat more likely on research sessions, where names are written in words.
3. **On a game-list session, the company name "Well" becomes Welltower (WELL)** (`stepSchema.js:468` + `companies.js:91`). Pre-existing; section 5.7 changes research sessions only.
4. **The hub's loadout sheets show no equip refusal of any kind.** `LoadoutSheets.jsx` and `LoadoutBookSheet.jsx` log it to the console and close; `watchlistEquipUI.js` maps a 400 to "Could not equip the watchlist. Try again." Work an idea's own screens now show the research refusal's words.
5. **`firestore.rules:357-360`** lets a client set an agent's `equippedWatchlistId` to any list it owns at create (§8 point 2).
6. **Lint:** a full `eslint` (not `lint:gate`) reports existing errors in files this build does not touch: `builderParts.jsx` fast-refresh exports, `stepSchema.js:806` (a useless escape), and unused variables in five test files.
7. **Windows only:** `src/constants/eligibility.test.js` reds on a CRLF checkout (the known class); it passes on Linux.
