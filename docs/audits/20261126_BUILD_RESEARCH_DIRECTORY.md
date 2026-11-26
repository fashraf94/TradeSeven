# Build report — research universe, Build 1: the stock directory

**Date:** 26 Nov 2026 · **Asked by:** the Explore content chat (Fable), for the founder · **PR branch:** `claude/research-directory` (local worktree branch `claude/research-directory-7d5447`) · **Base:** `origin/main` @ `22b01810`, merged forward to `ab5dad60` before the final checks.

**Preamble.**
- `git fetch origin` ran first. `HEAD` = `origin/main` = `22b01810cba93c28de53342f1634a542bebfd56c`, clean tree. Fetched again before the final checks: `main` had moved to `ab5dad60` (PR #1116, Practice Field B4), which touches nothing this build reads; it was merged in (`8f3eb4f4`) and every final check ran on the merged tree.
- Read first: `docs/BUILD_RULES.md`; the census `docs/audits/20261126_RESEARCH_UNIVERSE_CENSUS.md` Parts E, F and G, read from `origin/claude/research-universe-census` @ `fd909746` (it is not on `main`); `scripts/fetch-ticker-industries.js`.
- **EODHD calls:** the plan probe (6 requests) and one run of the generator (64 requests). Calls spent: **312** in all (probe 6, generator 306). Every later rebuild of the directory, including the one after the review, was made from that run's saved data with no network call. No fundamentals or bulk-fundamentals call was made.
- No Firestore read or write, no model call, no scheduled-job change. No secret, uid or email appears in this report, the code or the PR.
- **VERIFIED** means read or measured in this session at the commit named; **ASSUMED** marks anything not seen.

---

## 0. Verdict

| Question | Answer |
|---|---|
| Was the directory built? | **Yes.** **2,259** US-listed companies at about $1 billion and up, each with a name, a house sector id and an industry (`api/_utils/researchDirectory.js`, generated). A pure accessor answers "is this on the research list, is it a research stock, and what sector is it in?" (`api/_utils/researchUniverse.js`). |
| Does a player see any change? | **No.** Nothing imports either module; a test fails if any code file in the repo names them. The client bundle built from this branch is byte-identical to `main`'s (§9). |
| Is the game list untouched? | **Yes.** The PR adds 9 new files and edits none. `ALL_TICKERS` is still 228; `rankingConfig.js`, `assets.js`, `sectors.js`, `vercel.json`, every cron and every fenced file are unchanged. |
| EODHD plan (§2) | Daily limit **100,000** (plus 500 extra). Used today before the probe: **8,349**. Screener **in the plan**. One screener request cost **5** (measured). |
| Calls spent | Probe **6**, generator **306** (61 screener pages × 5, exchange list 1; the user endpoint is free). Counted and measured agree. |
| Sector mismatches against the 228 | **3** of the 227 the screener returned: ADP, BE, PKG (§5). The house map wins for the 228. |
| The 11 retired stocks | **All 11 absent by symbol.** But the companies behind MMC and EQR are in the directory under new symbols (MRSH, VMRK), and PARA is now a different company (§5). |
| The knowledge base's seven companies | All present: GLW, HPE, ANET, MRVL, COHR, CIEN in **XLK**; VRT in **XLI** (§5). |
| Stopped on a ruling | Nine questions, none blocking (§6): closed-end funds, EODHD data errors (shells, debentures, wrong sectors), venues, share classes, what "research stock" means, names for the 228, symbols the game uses otherwise, the retired stocks. |
| Review | Two lenses, each with a refuter: **18 findings, 17 confirmed, 1 confirmed in part**. 9 fixed in code with a test that failed first; the rest recorded (§8). Mutation battery **55 of 55** killed. |
| Tests | 5 new test files, **231 rows**. Full suite: §9. |

---

## 1. In plain terms

- The game keeps its one list of 228 stocks. Nothing about it changed.
- Beside it there is now a **directory**: 2,259 companies listed on the NYSE, NASDAQ or NYSE American and worth about $1 billion or more, foreign companies listed here included. Each has a name, one of the game's 11 sectors and an industry.
- A small module answers three questions for any symbol: is it on the research list (the 228 or the directory), is it a research stock (a directory company), and what sector is it in.
- **Nothing uses it yet.** Later builds connect Work an idea, Explore, search and the idea book one at a time.
- To refresh it, re-run `scripts/build-research-directory.mjs` once a month (RU-4). One run costs about 300 EODHD calls.
- The sectors and industries are EODHD's own words, not the GICS words the game uses. They mostly agree; where they don't (payment companies, packaging, bitcoin miners), the directory shows EODHD's.

---

## 2. The plan probe (build prompt §2)

Six requests, made before any code was written. The key was never printed.

| Request | Measured | EODHD's published cost |
|---|---|---|
| User endpoint (×4) | **0** each (the used-calls figure did not move between two back-to-back reads) | — |
| Screener, `exchange = us`, market value ≥ $1B, `limit=1` | **5** (8,349 → 8,354) | 5 a request |
| Exchange symbol list, `US` | **1** (8,354 → 8,355, read together with one free user request) | 1 a request |
| Calendar | not called | 1 a request |
| Fundamentals | not called | 10 a request |
| Live (real-time) request | not called | billed **per symbol**: a batch of 100 costs 100 (the census marked this as assumed; recorded here as EODHD publishes it, not measured) |

**Plan facts (VERIFIED, EODHD user endpoint, 26 Nov 2026):** subscription monthly, paid; daily limit 100,000; extra limit 500; used today 8,349 before the probe and 8,661 after the generator run. Neither stop condition held: the screener is in the plan, and about 91,600 calls remained.

**Screener row fields (VERIFIED):** `code`, `name`, `last_day_data_date`, `adjusted_close`, `refund_1d`, `refund_1d_p`, `refund_5d`, `refund_5d_p`, `exchange` (always `US`), `currency_symbol`, `market_capitalization`, `earnings_share`, `dividend_yield`, `sector`, `industry`, `avgvol_1d`, `avgvol_200d`. The build uses code, name, sector, industry and market value.

**Exchange symbol list fields (VERIFIED):** `Code`, `Name`, `Country`, `Exchange`, `Currency`, `Type`, `Isin`; 50,435 rows. Venues seen: NMFQS, PINK, NASDAQ, NYSE, NYSE ARCA, BATS, OTCQB, US, OTCGREY, OTCQX, OTCCE, **AMEX**, OTCMKTS, **NYSE MKT**, OTC, OTCBB, OTCPK, TXSE. NYSE American appears under both AMEX and NYSE MKT. Types seen: FUND, Common Stock, ETF, Mutual Fund, Warrant, Preferred Stock, Unit, Notes, INDEX, BOND, ETC. ADRs (TSM, NVO, SHEL, ASML) are typed Common Stock; closed-end funds are mostly typed FUND.

---

## 3. What was built

All paths are new files. No existing file was edited.

### 3.1 The generator — `scripts/build-research-directory.mjs`

- **Source.** The screener (`exchange = us`, market value ≥ `FLOOR_USD` = $1,000,000,000, largest first, 100 a page; `:67`, `:191`), joined by code to the exchange symbol list for US (`fetchSources`, `:464`).
- **Paging below the offset limit** (`fetchAllScreenerRows`, `:208`). A pass reads offsets 0 to 900 (`:216`, `MAX_OFFSET` 999). A full pass is followed by one bounded **at or below** the smallest market value it saw, so a row tied at the edge is never lost. The run ends when a page returns fewer rows than asked (`:237`). It stops, and writes nothing, if a row comes back inside a pass at any value but the pass's bound, meaning the screener's order moved between two pages and another row may have been skipped (`:228`), or if a pass adds no new row (`:246`).
- **Filters** (`buildDirectory`, `:259`), in order, each recording the reason a row is dropped:
  1. a well-formed symbol;
  2. at or above the floor (`:305`);
  3. one of the 228: kept aside for the sector check, never written (`:306`);
  4. in the exchange list;
  5. listed on NYSE, NASDAQ or NYSE American, i.e. `NYSE`, `NASDAQ`, `AMEX` or `NYSE MKT` (`:79`, `:312`);
  6. on NYSE or NYSE American, a root of at most 4 letters (`:89-91`, `:313`): EODHD labels some OTC lines "NYSE" (FJIKY, GALDY, RSHGY), and NYSE and NYSE American roots are 1 to 4 letters;
  7. type Common Stock (`:81`, `:314`);
  8. a sector that maps to a house id (`:316`);
  9. a name, from the screener first, then the exchange list (`:318-322`);
  10. not a sector fund, industry fund, index symbol or Practice Field fund (`EXCLUDED_SYMBOLS`, `:120`, `:323`).
- **Sector map** (`EODHD_SECTOR_TO_HOUSE_ID`, `:99`) and **key loader** (`parseEnvFile`, `:430`) are **copied** from `scripts/fetch-ticker-industries.js:81-101` and `:108-128`. That script cannot be imported: it starts a 228-symbol fundamentals fetch at import. A test reads it as text and fails if either copy drifts.
- **Spelling** (`houseSpelling`, `:138`): upper case, a dot becomes a hyphen (`BRK-B`), and the symbol must match the shape `resolveSymbol` accepts.
- **Call ceiling** (`createCallBudget`, `:168`): 1,500; screener 5, exchange list 1, user 0 (`:71-73`). A request that would take the run above 1,500 is refused before it is sent (`:176`). The run also records the spend EODHD measured, and warns if it is above its own count (`:552`): a warning, not a stop, because the key is shared with the app's own jobs.
- **Count stop** (`checkCount`, `:339`): under 1,000 or over 5,000 writes nothing (`:575`).
- **Output** (`renderDirectoryModule`, `:349`): one entry per line, sorted by symbol (code-point order), LF; a header with the date, the count, the floor, the rules, the per-sector counts and "do not edit by hand". No market value is stored.
- **Run files** (outside the repo): `raw.json` (every screener row with its market value, the pass log, the exchange list) and `run-report.json` (every dropped row with its reason, the checks in §5, the spend). `--from-raw` rebuilds from a saved fetch with no network call.
- Importing the script makes no call: `main()` runs only when the script is invoked directly, compared as real paths so a run through a junction or symlink works too (`:603`).

### 3.2 The directory — `api/_utils/researchDirectory.js`

Generated 26 Nov 2026 (market values from the screener's latest close, mostly 25 Nov; the 26th was a market holiday): 2,259 entries, `symbol: [name, house sector id, industry]`, frozen, no imports. Exports `RESEARCH_DIRECTORY_META` and `RESEARCH_DIRECTORY`.

**Sector and industry are the screener's own words** (Morningstar-style: "Banks - Regional", "Software - Application"), not the GICS words `STOCK_INDUSTRIES` holds for the 228. The header says so.

### 3.3 The accessor — `api/_utils/researchUniverse.js`

Imports `rankingConfig.js` and `researchDirectory.js` only (`:20-21`). Pure.

| Export | Answer |
|---|---|
| `researchUniverse` (`:31`) | `{ has, retired }`, the shape of `gameUniverse`. `has` is true for the 228 and every directory entry; `retired` answers exactly as `gameUniverse.retired`. |
| `isResearchStock(sym)` (`:37`) | True for a directory entry, false for the 228 (§6, Q4). |
| `researchSectorOf(sym)` (`:42`) | The house map for the 228; otherwise the directory's; `null` when not held. A fund the house map labels (XLK, SMH) gets `null`. |
| `researchNameOf(sym)`, `researchIndustryOf(sym)` (`:48`, `:53`) | From the directory; `null` when not held, the 228 included (§6, Q5). |
| `RESEARCH_DIRECTORY_COUNT` (`:57`) | 2,259. |

**No flag.** Nothing imports either module; `researchUniverse.boundary.test.js` pins that off switch for every code file in the repo.

---

## 4. The run

| Pass | Pages | Rows | New | Repeats |
|---|---|---|---|---|
| 1 | 10 | 1,000 | 1,000 | 0 |
| 2–6 | 10 each | 1,000 each | 999 each | 1 each (the edge row) |
| 7 | 1 | 68 | 67 | 1 |

6,062 distinct screener rows at or above $1B. Every pass after the first repeated exactly its one edge row (IRM, MNHVF, SIGI, HIW, NZF, QUBT), each at the pass's bound; no tie group straddled a page edge, so the new in-pass repeat stop would not have fired. The market was closed for Thanksgiving, so values were static.

| Outcome | Rows |
|---|---|
| **Kept** | **2,259** |
| One of the 228 (sector check only) | 227 |
| Dropped: listing venue | 3,377 (pink sheets 2,854; other OTC 461; NYSE ARCA 50; US 5; BATS 3; preferred or ETF on OTC 4) |
| Dropped: OTC-shaped code labelled NYSE | 14 (AXICY, CSANY, FJIKY, GALDY, GRTUF, HMKIY, LOTMY, MNFYY, NPXYY, NRKBY, PUGBY, RSHGY, SHMXY, TYHOY) |
| Dropped: type | 182 (preferred 118, closed-end funds typed FUND 40, notes 21, ETF 2, warrant 1) |
| Dropped: sector maps to no house sector | 3 (DTB and DTG, DTE debt series; NIQ Global Intelligence, no sector) |
| Dropped: other reasons | 0 |
| **Total** | **6,062** |

**Per sector:** XLK 344 · XLV 342 · XLF 391 · XLE 137 · XLY 243 · XLP 93 · XLI 319 · XLB 123 · XLU 61 · XLRE 112 · XLC 94.

**Screener sector strings** (all rows): Industrials 1,027; Financial Services 983; Consumer Cyclical 660; Healthcare 631; Technology 601; Basic Materials 458; Consumer Defensive 376; Real Estate 374; Energy 314; Communication Services 298; Utilities 240; *(empty)* 77; Other 16; Financials 7. Unmapped: *(empty)* and Other. No new mapping was added.

**Kept, checked:**
- Every kept row is priced in dollars, and no industry is empty.
- 16 share-class symbols, all real common classes: AKO-A, AKO-B, BF-A, BF-B, BH-A, BIO-B, BRK-A, CIG-C, GEF-B, HEI-A, LEN-B, MKC-V, MOG-A, TAP-A, UHAL-B, WSO-B.
- 8 names carry an accent or a curly apostrophe (Macy’s, Grupo Aeroméxico); none carries a control, zero-width or bidi character.

**Names are EODHD's.** The screener's name equals the exchange list's name for every kept row, so the two sources cannot cross-check each other. Some names are abbreviated at the source ("Applied Opt" for AAOI, "Agios Pharm", "A10 Network"), some are stale ("Blackstone Group Inc", "Marvell Technology Group Ltd"), and about 200 carry a listing suffix ("Common Stock", "Ordinary Shares", "ADR"). Fuller names come with fundamentals (Build 2).

**Sector vocabulary, examples** (EODHD's words against GICS): packaging companies in XLY (GICS Materials); mortgage REITs in XLRE (GICS Financials); payment processors mostly in XLK, with PYPL in XLF and GPN in XLI (GICS Financials); UBER and LYFT in XLK (GICS Industrials); bitcoin miners split between XLF (MARA, RIOT, CLSK, IREN, WULF, HUT) and XLK (CIFR, CORZ).

---

## 5. Checks against the 228, the retired 11 and the knowledge base

**The 228.** The screener returned 227 at or above $1B. **FMC** (NYSE) was not returned, so it is below the floor today. Mapped sector against the house sector:

| Symbol | Screener sector | Maps to | House |
|---|---|---|---|
| ADP | Technology | XLK | XLI |
| BE | Industrials | XLI | XLK |
| PKG | Consumer Cyclical | XLY | XLB |

The other 224 agree. For the 228 the house map wins (`researchSectorOf`), so these three never show a directory sector. (For BE, GICS itself files Bloom Energy in Industrials; the house value is the outlier. Outside this build.)

**The 11 retired stocks.** By symbol, all 11 are absent from the directory, and `researchUniverse.retired` answers as `gameUniverse.retired` does. By company (matched on ISIN in the exchange list), the picture differs:

| Symbol | By symbol | The company today |
|---|---|---|
| MMC | absent (no longer listed) | **in the directory as MRSH** (Marsh & McLennan Companies, same ISIN) |
| EQR | absent (no longer listed) | **in the directory as VMRK** ("Vivmark Residential", same ISIN) |
| PARA | absent: the symbol now belongs to **Parabolic Technologies** (NASDAQ), a different company, below the floor | Paramount's line is in the directory as SKYD (Paramount Skydance; from general knowledge, ASSUMED) |
| AVB, CTRA, EA, HES, IPG, K, WBA, WBD | absent (no longer listed) | no listing found by symbol or issuer code |

If Parabolic passes $1B in a later run, PARA enters the directory while `retired('PARA')` stays true, so `resolveSymbol` refuses it. A later build rules on that (build prompt §3.2; §6, Q9).

**The knowledge base's seven companies** (reported, not pinned):

| Symbol | Name | Sector | Industry |
|---|---|---|---|
| GLW | Corning Incorporated | XLK | Electronic Components |
| HPE | Hewlett Packard Enterprise Co | XLK | Communication Equipment |
| ANET | Arista Networks | XLK | Computer Hardware |
| MRVL | Marvell Technology Group Ltd | XLK | Semiconductors |
| COHR | Coherent Corp | XLK | Scientific & Technical Instruments |
| CIEN | Ciena Corp | XLK | Communication Equipment |
| VRT | Vertiv Holdings Co | XLI | Electrical Equipment & Parts |

---

## 6. Stopped on a ruling

Built to the letter of the prompt; each looser or stricter reading is a question, not a change. None blocks the merge. Where a cheap rule exists, it is named.

| # | Question | As built | Rows |
|---|---|---|---|
| Q1 | **Closed-end funds that EODHD types "Common Stock"** (sector Financial Services) pass every filter, while 40 of the same kind typed FUND are dropped. RU-3 says funds are left out, assuming a fund has no sector. Drop them? No clean rule exists (BXSL and MSDL are business development companies with "Fund" in their names), so a named list would be needed. | Kept | 14: BCAT, BTT, CET, DXYZ, ECAT, FSCO, GAM, HQH, NBXG, PDO, PSUS, RVT, STEW, TY. Business development companies (ARCC, BXSL, CSWC, FSK, GBDC, HTGC, MAIN, MSDL, OBDC, OCSL, OTF, TRIN, TSLX) also pass; they are listed operating companies. |
| Q2 | **EODHD data errors that pass the filters.** Correct them with a small named override list that the generator applies and the monthly run reviews? | Kept as EODHD gives them | **Shells:** LION (Lionsgate Studios, a real studio) and VYLR (Vylor Inc., about $46B, no 200-day volume) are filed XLF "Shell Companies". **Wrong sector:** XXI (Twenty One Capital, a bitcoin treasury company) is filed XLP "Education & Training Services". **Debt typed Common Stock:** DTW (a DTE debenture, filed XLRE "REIT - Residential") and AFGE (an American Financial Group debenture). A rule exists for the debt (no EPS and an ISIN issuer code shared with a listed common stock; it flags exactly DTW and AFGE in this run), but it is a heuristic. |
| Q3 | **Large companies on other venues.** Cboe Global Markets (CBOE, about $37B) lists on BATS, which is not NYSE, NASDAQ or NYSE American. Allow BATS? | Dropped | CBOE; also 5 Common Stock rows on the generic venue `US` (TXR, GUNN, LYCA, EROC, ASBH; four with no trading history) and 3 Empire State Realty partnership units on NYSE ARCA. NIQ Global Intelligence (NYSE, $5B) is dropped because EODHD gives it no sector. |
| Q4 | **What "research stock" means.** The founder's notes for later builds use it for a directory company ("a research stock shows its own numbers and no rank"; "research stocks stay out of watchlists"). So `isResearchStock` is true only for a directory entry, and `researchUniverse.has` covers the 228 too. Confirm? | Directory only | — |
| Q5 | **Names and industries for the 228.** `researchNameOf` and `researchIndustryOf` read the directory, so they return `null` for the 228 (the prompt: "from the directory; null when not held"). Fall back to the game's own data (`STOCK_INDUSTRIES`, GICS; `rankingConfig.js` has no name map)? | `null` | 228 |
| Q6 | **Share classes EODHD types wrongly.** MOG-B (Moog Class B) and AGM-A (Farmer Mac Class A) are common shares typed "Preferred Stock", so they are dropped (MOG-A and AGM are kept). Preferred-share ADRs are inconsistent: CIG, BBD, ITUB and GGB are typed Common Stock and kept; PBR-A and AXIA-PC are typed Preferred and dropped. With the OTC rule, AXIA Energia (about $20B) has no entry at all. A rule "a single-letter class suffix is common" restores AGM-A and MOG-B but also PBR-A, a real preferred. | As typed | 2 dropped commons; 6 preferred ADR lines |
| Q7 | **Symbols the game uses for other things.** `CASH` is the game's cash-position placeholder (`src/constants/cryptoPool.js:28-29`) and a directory company (Pathward Financial, XLF). `LTC`, `BCH` and `SUI` are crypto in the legacy `src/data/assets.js` list and directory companies (LTC Properties, Banco de Chile, Sun Communities). The BaggerBomb crypto pool and `agentCryptoAssets.js` do not overlap. A battle-facing caller must separate asset classes before asking the accessor. Exclude them from the directory, or leave it to that caller? | In the directory | 4 |
| Q8 | **Other share classes of game stocks** are directory companies: BRK-A (game has BRK-B), FOX (FOXA), LEN-B (LEN), NWSA (NWS). A search for the company finds a game stock and a research stock. | In the directory | 4 |
| Q9 | **The retired stocks** (build prompt §3.2, deferred): MMC's and EQR's companies are in the directory under new symbols (MRSH, VMRK); PARA's symbol is now another company. | Recorded only | 3 |

---

## 7. Tests

| File | Rows | What it pins |
|---|---|---|
| `scripts/build-research-directory.test.js` | 91 | **Spelling.** **The copies:** the sector map and key loader equal the originals in `fetch-ticker-industries.js` (read as text). **Filters:** every rule on fixtures, with every row accounted for, including the OTC-shaped code on NYSE, AMEX and NYSE MKT and a 5-letter NASDAQ code kept. **Paging:** past the offset limit with ties at the pass edge; the real constants over 2,345 rows; the short-page end; a row swapped across a page edge (stop); a screener that ignores the bound (stop); more ties than a pass can read (no-progress stop). **Spend:** the ceiling at 1,500; a run aborted at the 299th screener page with nothing written; the spend warning. **Count stop.** **The generated module:** header, order and round trip. **The script:** importing it makes no call; a run through a junction runs; the key is cut from error lines. |
| `api/_utils/researchUniverse.test.js` | 101 | **The module itself:** imports only the two modules and is pure. **Shape:** the `gameUniverse` shape; all 228 and every entry held; prototype keys and junk refused; `retired` as `gameUniverse`; `resolveSymbol` works with it. **Answers:** the sector, name and industry rules; the count. **KB:** the seven companies present with a house sector (sectors not pinned). |
| `api/_utils/researchUniverse.precedence.test.js` | 3 | On a planted directory: the house map wins for one of the 228; a retired stock the directory holds is held, retired and refused by `resolveSymbol` (as built). |
| `api/_utils/researchDirectory.test.js` | 18 | Every entry well formed; no duplicate line; sorted; three fields and no market value; no symbol from the 228, sector funds, industry funds, every index list or the Practice Field funds; the header's count, date, floor and per-sector counts match the data; data only. |
| `api/_utils/researchUniverse.boundary.test.js` | 18 | **The off switch:** no code file in the repo but the two modules, their tests, the generator and its test names either module or the generator. This covers api/, src/, scripts/, the other code folders and the root configs, matched case-insensitively. **Planted rows:** a static import, a dynamic import, a re-export, a require, a path without extension, a case variant, a comment, a file named for it, a root vite config, a hand-run script, an importer of the generator, a hyphenated file name. **Loading:** the accessor leaves every `rankingConfig` export unchanged and the 228 at 228. |

**Mutation battery** (BUILD_RULES §2), on the merged head in its own snapshot tree:
- 55 mutants across the generator, the accessor, the scanner and the generated data. **55 killed**, each by the row that names its defect; no load failure and no survivor.
- The first round on the first commit (42 mutants) found two that "died" only by hanging: the no-progress stop removed, and screener requests not counted. Their fake pages resolve as microtasks and starve vitest's timer, so both fakes now refuse past a request cap, and both mutants fail in about 3 seconds.

---

## 8. Review

BUILD_RULES §2 applied: the generated file alone passes 1,500 lines. There were two lenses, each read-only on its own `git archive` snapshot. Every finding then went to a separate refuter on a fresh snapshot, told to refute it with a concrete repro. The coordinator applied fixes test-first: each new row failed on the unfixed code, then passed.

**Lens 1, the game is untouched.**
- No game read, rank, pin, Wire hash, scheduled job or player-visible screen can change.
- The diff is 8 added files, 0 modified.
- No file imports the new modules; the Wire generation surface hashes an explicit list and is unaffected.
- The existing pins pass: 17 files, 598 rows (the 8 named in the prompt, `practiceFieldSlots.test.js`, three other `ALL_TICKERS` pinners, the new files).
- Of the 160 directory-walking guard tests run on Windows, the same 14 fail at base and at head with identical messages. They are Windows path-separator reds and one 5-second timeout, a known Windows-only class; the Linux suite (§9) is the record.
- Tailwind's own scanner gives byte-identical CSS with and without the new files.

**Lens 2, the directory is right.**
- A rebuild from the saved data is byte-identical, and every screener row is accounted for.
- The 40-entry eye check (20 seeded-random, 20 with the lowest market value) found 39 OK and 1 questionable (IREN: sector vocabulary).
- The lens noted that the sample would have passed every important finding below, so a clean eye check is not evidence of a clean directory; the findings came from whole-data scans.

| # | Sev. | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | nit | The off-switch scan covered only api/ and src/; an importer in scripts/ or a root vite config (even reached from src/ through scripts/) passed | CONFIRMED | **Fixed**: the scan covers every code file in the repo (dot-folders, node_modules, build output and docs skipped) |
| L1-2 | nit | The scan's names missed the generator, so an api/ importer of its fetch and writer passed | CONFIRMED | **Fixed**: the names cover `research-directory` forms; generator and its test allowed |
| L1-3 | nit | CASH, LTC, BCH, SUI and TGT are directory companies the game uses otherwise | CONFIRMED in part; **TGT REFUTED** (XLP matches the house's own filing of Target's peers DG and DLTR) | Recorded: §6 Q7 |
| L1-4 | nit | Run through a junction or symlink, the script exited 0 silently | CONFIRMED | **Fixed**: real-path comparison |
| L2-1 | important | 14 OTC lines labelled "NYSE" were kept (FJIKY, GALDY, TYHOY …), breaking "not OTC" | CONFIRMED (the rule drops exactly 28 rows across the whole exchange list, none a real NYSE common stock) | **Fixed**: root over 4 letters on NYSE, AMEX or NYSE MKT is dropped; 2,273 → 2,259 |
| L2-2 | important | Two debentures typed Common Stock kept (DTW, AFGE) | CONFIRMED (source mislabel) | Recorded: Q2 |
| L2-3 | important | 14 closed-end funds typed Common Stock kept | CONFIRMED | Recorded: Q1 |
| L2-4 | important | MOG-B and AGM-A (common) typed Preferred, dropped | CONFIRMED | Recorded: Q6 |
| L2-5 | important | Source sectors wrong: LION, XXI, VYLR | CONFIRMED | Recorded: Q2 |
| L2-6 | important | The retired-stock landing was by symbol only; MMC and EQR live on as MRSH and VMRK | CONFIRMED | **Report corrected** (§5); Q9 |
| L2-7 | nit | CBOE, NIQ and the venue-`US` rows dropped by the letter | CONFIRMED | Recorded: Q3 |
| L2-8 | nit | Preferred-share ADRs inconsistent | CONFIRMED | Recorded: Q6 |
| L2-9 | nit | Other share classes of game stocks in the directory (refuter added NWSA) | CONFIRMED | Recorded: Q8 |
| L2-10 | nit | Sectors follow EODHD's vocabulary, not GICS | CONFIRMED | **Header line added**; examples in §4 |
| L2-11 | nit | Paging counted any repeat as an edge repeat; a tie swapped across a page edge would lose a row silently | CONFIRMED (not hit in this run) | **Fixed**: a repeat at any value but the pass's bound stops the run |
| L2-12 | nit | Measured spend never compared with counted | CONFIRMED (as a warning, since the key is shared) | **Fixed**: warning, recorded in the run files |
| L2-13 | nit | Names abbreviated, stale or suffixed | CONFIRMED | Recorded: §4 |
| L2-14 | nit | Header said the floor applied "on the day generated"; values are the screener's latest close | CONFIRMED | **Fixed**: wording |

**Found by the coordinator, outside both lenses:** the generator's test file held literal zero-width and right-to-left-override characters where escape sequences (a backslash, the letter u and a code point) had been written (the editing tool turned the escapes into the characters). The file is ASCII again and every new file was scanned for such bytes.

**Split:** 18 findings; 17 CONFIRMED, 1 CONFIRMED in part (L1-3, whose TGT claim was REFUTED). Nine fixed in code, each with a row that failed before the fix; one corrected in this report; the rest are the questions in §6.

---

## 9. Verification

All at the merged head `8f3eb4f4` (the build, its review fixes, and `main` @ `ab5dad60`).

| Check | Result |
|---|---|
| Full suite, Linux (WSL; `TZ=UTC`, `--maxWorkers=8`, under the shared suite lock; private worktree with its own `npm ci` of this lockfile) | **exit 0** · `Test Files 1676 passed \| 14 skipped (1690)` · 39,176 rows, 0 failed · 307 s. All 231 new rows ran, the junction row included. |
| `npm run lint:gate` (whole repo, WSL) | exit 0 |
| ESLint, default config, on the new files | exit 0 |
| `vite build`, `main` @ `ab5dad60` and the same tree with this branch's files added, built in one tree | **byte-identical** `dist/` (`diff -rq`: no difference; 123 asset files) |
| Mutation battery (§7) | 55 of 55 killed |
| Offline rebuild of the directory from the run's saved data | byte-identical to the committed file |
| New files: control, zero-width or bidi characters | none in code; the directory holds only 8 accented letters and curly apostrophes in company names |

**An earlier full-suite run is on record and set aside:** at the first commit, run while a mutation battery, two vite builds and both review lenses loaded the machine, the suite took 610 s and failed 15 rows in 5 files (film-tape amendment and review, Practice Field confirmation, a battle-screen quote test, backing-dark). None of those files loads the new modules. The rows were timeouts (8 to 45 s against their limits) and two timing-sensitive assertions. The quiet run above is the record.

**Not verified here:** crons do not run on preview, and nothing in this build is scheduled. The generator ran once against EODHD (26 Nov 2026); later rebuilds used its saved data.

---

## 10. Found outside the task

Reported for separate tasking; none was fixed (BUILD_RULES §3).

1. **The shared WSL clone `~/pd-ci` lacks `three` and `unpdf`.** Its `node_modules` matches its own older lockfile, not `main`'s. This build's suite ran in a private worktree with its own `npm ci`.
2. **About 20 repo scripts compare `import.meta.url` with `process.argv[1]` directly**, so they exit silently when run through a junction or symlink (fixed here for the new script only).
3. **`src/data/assets.js:44` files Target as Consumer Discretionary**, while the house files its discount-store peers (DG, DLTR) in XLP. Target is not one of the 228.

---

## 11. Recorded for later builds (rulings of Nov 26, not built here)

- A research stock shows its own numbers and no rank at first.
- Kept numbers refresh after 7 days.
- A research stock becomes an idea-book candidate when a saved thesis names it.
- Research stocks stay out of watchlists.

---

*Report path: `docs/audits/20261126_BUILD_RESEARCH_DIRECTORY.md`.*
