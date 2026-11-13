# Build — the research modal: questions that follow the row, and the Battle chart

**Date:** Fri Nov 13, 2026 · **Heads:** PR 1 `978ff348`, PR 2 code `f4974b51` (this report is the commit on top) · **Model:** Opus · **Prompt:** the founder's build prompt of Nov 13 (QF-0 – QF-10, BC2-1 – BC2-7).
**Smoke preview:** https://trade-seven-bgfrpzenj-fais-projects-bc179554.vercel.app/?sheetFixture=held_up (smoke branch `claude/research-modal-shell-smoke` @ `7c754d82`, never merged) — states: `?sheetFixture=held_up` · `held_down` · `bench_book` · `battle_3day` · `battle_1day_six` (and the shell's earlier eight).
**Preamble:** `git fetch origin` run first and again before the final checks; `origin/main` @ `d9b4e3c1` throughout (#1049 merged). Both PRs are cut from it and tested as the tree merged with it (main never moved).

| | PR 1 — the questions follow the row | PR 2 — the Battle chart |
|---|---|---|
| Branch · head | `claude/research-modal-questions` @ `978ff348` | `claude/research-modal-battle-chart` @ `f4974b51` (cut from PR 1's head; PR 1 merged in) |
| PR | [#1055](https://github.com/fashraf94/TradeSeven/pull/1055) | [#1056](https://github.com/fashraf94/TradeSeven/pull/1056) (base `main`; merge after #1055) |
| Files · lines (own diff) | 24 files, +1,426 / −128 | 14 files, +1,095 / −38 (33 with PR 1) |
| Full suite (Linux, TZ=UTC, 8 workers) | 1438 files / 31,945 passed, 0 failed (exit 0) | 1442 files / 31,990 passed, 0 failed (exit 0) |
| `test:rules` | 42 files / 784 passed (exit 0) | 42 files / 784 passed (exit 0) |
| `lint:gate` · minified build | exit 0 · exit 0 | exit 0 · exit 0 (and re-run on the pushed head after this report commit) |
| Mode-off goldens (4) | byte-identical to main (files untouched; rows pass) | byte-identical to main (files untouched; rows pass) |
| Mutants | **24 / 24 killed** (14 own + 10 from lens D) | **37 / 37 killed** (21 own + 16 from lens D) |
| §2 review | 4 lenses + 2 refuters: **17 CONFIRMED**, **3 REFUTED**; lens D 15 test findings, all given rows | 4 lenses + 1 refuter: **13 CONFIRMED**, **7 REFUTED**; lens D 11 test findings, given rows |
| Fence | no fenced file edited; `calculateAssetScoreV3`, `committedStockContext`, `swappableNames` called | no fenced file edited |
| Flag | `RESEARCH_MODAL_SHEET_MODE` stays `'allowlist'` | same |

PR 1 then PR 2, ready for the founder's merge · `'on'` after the live check.

## 1. QF-0 — what a swap-out does to a held measured stock's points (written before any code)

### In plain words

- **A swap-out locks the position's whole score at the exit price — the gain part and every rung it crossed.** The number is frozen into the battle record. The lock uses the price quoted at the swap itself, not the last check's price, so the sheet says what a swap *at the last check's price* would have locked, and names the check.
- **Holding keeps the gain part moving with the price; rungs are lifetime.** A rung once crossed stays crossed for that position, and its points stay in the score. A crossed *downside* rung (Bust, Crash, Meltdown) is lifetime too, with its negative points.
- **No archetype or preset names a take-profit rule.** The exit rules a pack can quote are the preset's risk levers (the bust buffer, the VWAP-failure count and dead band, the trailing stop past a gain in ATRs) and the archetype's forced rotation (the quiet-check count). The risk manager's `LOCK` verdict ("hold — close to the next rung") is the nearest thing, and it says hold.
- **QF-0 passed: a swap-out does lock the position's points. No STOP.**

### The facts, cited (VERIFIED — read in this session at `d9b4e3c1`)

| # | Fact | Citation |
|---|---|---|
| 1 | A measured ("corrected") battle's every swap goes through `executeCorrectedStockSwap`; the cron's six score-bearing swap sites all call `executeSwapServer`, which routes there. | `api/_utils/agentSwapExecution.js:227-229` (fenced; read only); `api/cron/agent-evaluate.js:2290, 4046, 5433, 5708, 6188, 6548` |
| 2 | The outgoing stock is scored at the **swap's own exit quote** (`scoreCorrectedPosition(live, { ...out, tier }, 'agent', prices, at, { fillStandIn: false })`). | `api/_utils/stockThresholdAdmission.js:258, 263` |
| 3 | `closedTrade.lockedPoints = score.totalPoints`. | `stockThresholdAdmission.js:269` |
| 4 | The same points close the position's score component (`status: 'closed'`, hashed). | `stockThresholdAdmission.js:276` |
| 5 | A measured battle's banked score is the sum of the agent's closed components, not `trades[].lockedPoints` (the legacy sum at `agent-evaluate.js:1401-1403` is replaced at `:1427-1430`). | `stockThresholdAdmission.js:173, 175` |
| 6 | `totalPoints = round(gain × 10 × tierMultiplier + calculatePoints(crossedTiers))`. | `src/utils/baggerBombUtils.js:538-543`; `api/_utils/agentScoring.js:225-226` |
| 7 | `crossedTiers` holds both sides, so a lock's "rungs" = upside banked + downside hit. | `src/utils/stockThresholdModel.js:72-74`; `src/constants/baggerBombScoring.js:14-28` |
| 8 | Rungs are lifetime (a history that loses a tier is refused). | `stockThresholdModel.js:69-75` |
| 9 | Each check rescores at that check's quote: the gain part moves, the rungs stay. | `agent-evaluate.js:1421-1430` |
| 10 | The committed context's `multiplier` = rungs from entry; `penaltyProximity.distance` the distance to the next downside rung, same unit. | `stockThresholdModel.js:76, 81-84` |
| 11 | No `takeProfit` field anywhere; the preset `risk` levers and `hftConfig.forcedRotation` are the exit rules. | `api/_utils/agentPresetConfig.js:13-21, 34-39, 52-57`; `api/_utils/agentArchetypeConfig.js:9-15, 49 … 199` |

## 2. PR 1 — the questions follow the row, as built

Spec of record: `docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md` §11 (§11.4 = the review round).

| ID | As built |
|---|---|
| **QF-1** | `packs.questionSetOf` → `{ questions, notOnLadder }`. Held measured: `take_profit` when the committed context's rungs from entry are > 0 (gain > 0), else `weakest_spot`; then the standing two. Not held: `better_than_stalled` (*Is this better than our weakest holding?*), then the standing two. Held, not measured (crypto, a legacy-scored battle): the standing two and *{SYM} isn't on the measured ladder, so only the standing questions apply.* `useSheetView` decides it once per opening (one entry per `sheetKey`) and keeps it, the standing order included; a pick outside the set is refused. |
| **QF-2** | `Sheet/book.js`: the agent's held measured stocks ranked by the committed context's `multiplier` **as printed** (one decimal), ties to the nearer next downside rung, then book order. Crypto and legacy named *not on the ladder*; a measured stock the check could not score named *no check yet*. On screen: *EQIX is −0.4 rungs from entry, the lowest of your 6 stocks · at the Wed 12:45 check · not on the ladder: ETH*. |
| **QF-3** | `weakest_spot`: its place (`book_rank`), its move since entry, its quiet count against the rotation rule (`quiet_ticks`, or *{Archetype} doesn't rotate out of quiet names*), the last check, and the best **available** bench name (`swappable.swappableNames`: bench or hot bench, not held, not cooling down, same class) by `arch_scores`, with its rank and its rung size (*estimated rung size: ATR reading 2.8%* — the rankings row's `techRaw.atrPercent`, BS-4's reading, dropped outside its 96-hour window). |
| **QF-4** | `take_profit`: *Swapped out at the Wed 12:45 check's $103.41, it would lock +68: +53 from the gain, +15 banked* (`book.lockNowOf` calls `calculateAssetScoreV3` with the committed context — never a copy; the split is the scorer's own `basePoints` and `calculatePoints` per side, *−10 from downside rungs* when one was hit); the next rung up (`toGo`); *$2.45 (2.37%) down to entry at $100.75 · $4.47 (4.33%) down to the next downside rung, Bust (−10) at $98.73* (`toGoDown`, displayed values); the exit rule and the risk verdict; the bench alternative. |
| **QF-5** | **The id `better_than_stalled` is kept:** `chat.js:1144` writes it on every research exchange, and a client from before the deploy would send it to the new server. Only its text and pack changed. The compare is the bench door's incumbent when one was passed **and the agent still holds it**, else QF-2's weakest (never the opened stock itself). The stalled list joins only when the archetype rotates. |
| **QF-6** | `QUESTION_IDS` + `weakest_spot`, `take_profit`; `ITEM_KINDS` + `book_rank`, `quiet_ticks`, `bench_alternative`, `lock_now`, `rung_down`; the server validates against the same lists. `book_rank`, `quiet_ticks`, `lock_now` are re-read by the server; on the CPU's row of a ticker the agent also holds, the server re-reads as that row too. |
| **QF-7** | `voiceLayerPrompt.js` (non-fenced, already registered): one line after the answer rule for `weakest_spot` and `take_profit` only (`RESEARCH_ASK_QUESTION_GUIDE`), each saying the answer makes no trade, the player decides, and the archetype keeps its own rules. No new prompt module. |
| **QF-8** | `agentNameOf` (moved unchanged into `src/screens/battleView/agentName.js`, re-exported by `cockpit2bModel.js`) for every name the sheet shows: *Shadow*, never *shadow*; no name → the archetype, never "Your Agent". |
| **QF-9** | Every string in `sheetCopy.js`, scanned by `sheetCopy.honesty.test.jsx` with each branch of every new argument. |
| **QF-10** | Spec §11 (QF-0, the rulings as built, the pack cut, the review round). |

**The pack cut (a reading).** The idea and what you told it are never cut, so with both a pack has three places left. The items that answer a question are never cut either (`ANCHOR_KINDS`: take profit — the lock, the next rung, the downside; weakest — its place and the bench alternative; better than our weakest — the incumbent or the weakest), and they still sit in the archetype's order, so an answering item can sit last.

**Readings for the founder (PR 1).**
1. **Up means gain > 0 (the letter).** A position that prints *0.0 rungs* but sits a few cents above its fill asks *Should we take profit?* Its pack shows a positive gain and no rungs figure. The review's suggestion to decide on the printed number was refuted on the letter; it is a looser reading, put to you.
2. **No committed context at open** (just after any swap, until the next check scores the roster): every held measured stock opens on *Is this our weakest spot?* with no ranked book. The rule's "else".
3. **The standing order is frozen with the set**, so a lead that flips while the modal is open does not reorder the two standing questions.
4. **The pack cut** above.

## 3. PR 2 — the Battle chart, as built

Spec of record: §12 (§12.1 = the review round).

| ID | As built |
|---|---|
| **BC2-1** | *1D · 1W · Battle* on the stock the battle opened, when the battle names its sessions (`timing.tradingDays`; every production battle does). Candles over the sessions up to today, each day's own regular session from the market calendar (an early close ends at 1:00 PM ET), with the entry line. Loaded on the tap (or a timed item's *see on chart*), never on open or on opening the Chart view. A way back to 1D / 1W while loading, on an error and on *no bars yet*. |
| **BC2-2** | One trading day → 5-minute bars; two or more → 30-minute bars (by the battle's length). `TIMEFRAME_CONFIG['5m']` added (EODHD intraday 5m, fixed 5 days); the server caches it **five minutes** (not TECHNICAL's hour), the client as intraday; `30m` is 💣's own request (20 days, its cache). One request per stock per bar size, asked again only when Battle is shown after its bars are five minutes old (the old bars stay drawn meanwhile). A daily fallback is refused. |
| **BC2-3** | On Battle each marker sits on the bar that holds its instant (the last bar starting at or before it; before the first bar → the first bar, its label its own time). On 1D and 1W a day's markers merge into one (`day:YYYY-MM-DD`; 1W on the week bar holding the day); the open day's caption is its count (*Wed · 6*) or the tapped item's own marker. The library's own hit test takes a tap on the counted marker, and the chips under the chart (*6 on Wed · Battle ›*) do too — a phone's dot is small. |
| **BC2-4** | *See on chart* on a timed item opens Battle with its caption; a price item keeps the current pill. The Chart view opened by its pill never starts on Battle (1D / 1W as §3). A stock change resets it. |
| **BC2-5** | The next rung each way at 💣's displayed prices (`rungShown`, the strings `bombView.rungFacts` prints), titled and tagged on the axis: *next rung +30 · $103.78*, *Bust −10 · $98.73*. Held measured stocks only. Battle's price scale takes in the entry and rung lines (they fell off screen at first render). No trend lines, no daily SMA on Battle. |
| **BC2-6** | Strings in `SHELL_COPY` / `SHEET_COPY` (honesty-scanned); `--ft-*` tokens through `ST`; rung lines `gold` / `neg`; no new motion; the chart's own red and green candles. |
| **BC2-7** | Spec §12 and §12.1. |

**Readings for the founder (PR 2).**
1. **30-minute bars can be up to an hour behind** (💣's own series and its documented server cache). On a multi-day battle a record item after the last bar sits on that bar, labelled with its own time. The 5-minute bars of a one-day battle are at most about five minutes behind.
2. **"Tapping it opens Battle at that day"** shows the whole battle (a one-day battle is 78 bars, a five-day one 65), the day in view with the rest.
3. **An instant after a close, or between sessions,** sits on the last bar before it.
4. **1W puts one dot per day on the week bar**, so a three-day battle shows three dots on one bar; 1D shows one per day.
5. **Opening the Chart view on its own** keeps §3's 1W memory; "starts on 1D" is read as "never on Battle".
6. **The 5-minute request covers five calendar days**, fine while battles are live only (a one-day battle opened a week later shows *No battle bars yet*).

## 4. Checks

Each on the PR's final head, which is its tree merged with `origin/main` (`d9b4e3c1`, unmoved). Linux runs in WSL worktrees `~/pd-ci-rmq` (PR 1) and `~/pd-ci-rmbc` (PR 2), each with its own `npm ci` (lock `40382e64edb6`, main's), CI Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, one suite at a time. Exit codes and the `Test Files` lines read from the logs, never piped.

| Check | PR 1 @ `978ff348` | PR 2 @ `f4974b51` |
|---|---|---|
| Full suite | exit 0 in 416 s · `Test Files 1438 passed | 10 skipped (1448)` · `Tests 31945 passed | 120 skipped (32065)` | exit 0 in 615 s · `Test Files 1442 passed | 10 skipped (1452)` · `Tests 31990 passed | 120 skipped (32110)` |
| `npm run test:rules` (Java 21, the emulator) | 42 files / 784 passed (exit 0) | 42 files / 784 passed (exit 0) |
| `npm run lint:gate` | exit 0 | exit 0 |
| `npm run build` (minified) | exit 0 | exit 0 (and re-run on the pushed head after this report commit) |
| Mode-off goldens: `AssetResearchModal.sheetModeOff`, `AgentBattleScreen.sheetModeOff`, `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff` | files untouched vs main; rows pass in the suite | same |

Earlier runs, for the record: PR 1 @ `b386d6cf` 1 failed (the api-graph extension guard — fixed `cf316e8a`); PR 1 @ `40b7d741` 2 failed (the tokens/motion battleView list — fixed `9eeb00a9`); PR 2 @ `101d4c42` 31,966 passed, 0 failed; PR 2 @ `971febc4` lint 0, build 0, rules 784/784.

**Rows that must exist** — all present and mutation-proved:
- PR 1: a held stock up shows *take_profit* first; a held stock down *weakest_spot*; a bench name *better_than_stalled* (`questions.test.js`, `useSheetView.questions.jsdom.test.jsx`); the set kept across ticks, a later check and navigation; QF-2's six-stock ranking with crypto and legacy excluded; the lock = QF-0's rule on a decimal fixture with a crossed Bust (+50: +45 gain, +15 banked, −10); the server accepts the new ids and refuses an unknown one; *Shadow*, never *shadow*.
- PR 2: one-day → `5m` (5 days), three-day → `30m` (20 days); six markers on one day on six bars on Battle and one counted marker on 1D; *see on chart* from a timed item opens Battle; the rung lines equal 💣's `rungFacts` strings; opening the Chart view sends no intraday request (`AssetResearchModal.battleChart.jsdom.test.jsx`, `battleChart.test.js`, `historical.battle.test.js`).

## 5. Mutations

Each mutant is one exact replacement in its own snapshot tree, run against the rows named, judged by exit code, and the file restored byte for byte (SHA-256 compared after every mutant: all restored).

**PR 1 — 24 / 24 killed.**

| id | defect | killed by |
|---|---|---|
| M1 | the question set follows ticks (re-decided every render) | useSheetView.questions "decided once" |
| M2 | a held stock gets `better_than_stalled` | questions, hook rows, modal rows |
| M3 | "weakest" ranks by raw % instead of rungs | questions QF-2 |
| M4 | a legacy / crypto position ranked (as lowest) | questions QF-2 |
| M5 | the server refuses `take_profit` | researchAsk |
| M6 | *shadow* in lowercase | useSheetView.questions QF-8 |
| M7 | the answering items cut | questions anchors, snapshot |
| M8 | the lock's gain copied from the live price | questions QF-4 |
| M9 | the downside hit dropped from the lock | questions QF-4 |
| M10 | the tie to book order | questions tie row |
| M11 | the stalled list without rotation | questions QF-5, packs |
| M12 | the bench alternative ignores cooldown | questions QF-3 |
| M13 | the prompt guide on every question | honesty QF-7 |
| M14 | the compare ignores the weakest | questions QF-5 |
| D-M1 | up when exactly at entry | questions M1 |
| D-M3 | the lock's pin dropped | questions M3/M18 |
| D-M6 | `weakest_spot` reads no rankings | hook rows M6/M7 |
| D-M7 | `better_than_stalled` reads no rankings | hook rows M6/M7 |
| D-M10 | the downside pins the exact rung | questions §9 |
| D-M18 | the place pins any subject | questions M3/M18 |
| D-M20 | unscored named off the ladder | questions M20 |
| D-M26 | rank by raw rungs | questions M26 |
| D-M12 | a bench tie to the later name | questions M12 |
| D-M19 | the entry gap from raw prices | questions §9 |

Lens D's other PR 1 survivors, recorded: M4 (`max` → `min` of the check instants) and M5 (`observedAt` → `providerAsOf`) are equivalent — every valid context of one commit carries the same check instant; M9 / M17 / M22 are guards on states no path reaches today; M13 (−0 normalisation) equivalent.

**PR 2 — 37 / 37 killed.** The prompt's three: markers by day on Battle (P7), Battle loading on open (P8), a rung line's price differing from 💣's (P9). The rest: bar size by days elapsed (P10), the daily fallback accepted (P11), the session filter (P12 fallback, P12b calendar), a pre-first-bar instant dropped (P13), no 1D merge (P14), see-on-chart not opening Battle (P15), the Chart pill keeping Battle (P16), rung lines on 1D (P17), the day chip a no-op (P18), a re-request on every return (P19), the server's `5m` config (P20), the pill on a navigated stock (P22), no way back while loading (P23), stale bars never re-asked (P24), the early close (P25), `5m` on TECHNICAL's hour (P26), the merge without sessions (P27); lens D's: the stock reset (D6), the ET axis (D8), time of day (D9), the OHLC header (D10), the client cache class (D13), the week bar (D14), the 1W caption (E4), the 4 PM cutoff (D18), duplicate bars (D19), *none yet* (D20), Retry (D21), each fallback guard (D22, D23), the back button (D24), chips under Battle (D25), the server key's days (E5).

Lens D's other PR 2 survivors, recorded: D5 and D30 equivalent; D7 (`pinsShown` — no reader anywhere); D4 (a one-marker day's own label), D11 / D12 (SMA / raw daily data handed on Battle — the mock chart cannot observe them; the code passes null), D27 / D28 (line and marker colours), D29 (a click handler not unsubscribed — a leak at most) have no row.

## 6. The review (BUILD_RULES §2)

Both PRs cross the threshold (PR 1 24 files; PR 2 14 files of its own). Four lenses each — domain, wiring and lifecycle, the off path / server / prompt, test integrity (the mutating lens, last, on its own tree) — every lens on its own `git archive` snapshot, read-only on git and on the working tree. Every finding went to a refuter told to refute it with a repro.

**PR 1** — **17 CONFIRMED, 3 REFUTED** across lenses A–C (two refuters), plus lens D's 15 test findings, each proved by a mutant. Every confirmed must-fix and should-fix is built (`40b7d741`, `9eeb00a9`, `978ff348`; spec §11.4).

| id | finding | verdict | disposition |
|---|---|---|---|
| A1 | the set decided on raw rungs while the rank uses the printed number | **REFUTED** (the prompt's letter is gain > 0) | kept; comment corrected; reading 1 |
| A2 | a stale incumbent (no longer held) drops the compare entirely | CONFIRMED | fixed: no incumbent → the weakest |
| A3 | a measured stock with no context left out silently — "your 5 stocks" for 6 | CONFIRMED | fixed: *no check yet: CAT* |
| A4 | the bench rung size printed as fact; BS-4 labels the same number an estimate | CONFIRMED | fixed: *estimated rung size: ATR reading* |
| A5 | after a swap no context exists until the next check: every stock opens on weakest | CONFIRMED (note) | reading 2 |
| A6 | the bench rank on raw scores, printed rounded | CONFIRMED (note) | fixed: rank of the printed score |
| A7 | `check_read`'s −0.45× beside `book_rank`'s −0.4 (two roundings, ASCII hyphen) | CONFIRMED (note) | §9 found on the way |
| A8 | an unreadable model stamp reads "isn't on the measured ladder" | CONFIRMED (note) | kept (only a corrupt stamp reaches it) |
| A9 | "the 6th lowest of your 6 stocks" | CONFIRMED | fixed: *the highest* |
| B1 | the frozen set held one slot: navigate away and back re-decided it, orphaning an answer | CONFIRMED | fixed: one entry per `sheetKey` |
| B2 | the standing order frozen even when standing was null at open | **REFUTED** (the spec freezes it) | reading 3 |
| B3 | the rankings read fired for a pre-set question the set lacks | CONFIRMED (note) | fixed: on the shown question |
| B9 | `cockpit2bModel`'s graph (+16 modules, ~99 KB unminified) pulled in for `agentNameOf` | CONFIRMED (note) | fixed: `agentName.js` |
| C1 | `atrReading.js`'s extensionless firebase import now in the api/ graph (CI red) | CONFIRMED (the suite) | fixed `cf316e8a` |
| C2 | the CPU's row of a held ticker: true items `not_on_record`; compared with itself | CONFIRMED | fixed: the server re-reads that row too; never itself |
| C3 | the take-profit instruction names a rung the cut could drop | CONFIRMED | fixed: `rung_distance` anchored |
| C4 | `better_than_stalled`'s prompt not byte-identical; an old client's Capital Preserver stalled item unverified | text **REFUTED** (QF-5 changes it); old bundle CONFIRMED (note) | kept; clears as clients reload |
| C5 | the server's incumbent comes from the client's (stale) incumbent item | CONFIRMED (note) | fixed with A2 |
| — | `agentName.js` not on the tokens/motion guards' battleView list (PR 2 lens C, on PR 1's file) | CONFIRMED (the suite) | fixed `9eeb00a9` |

Lens D (test integrity) — the rows that could not fail, all given rows (`978ff348`) and proved by mutants D-M1 – D-M26 (§5): exactly-at-entry, the printed-rank tie, the rankings read on the production path (the screen never hands `rankings`), off-cent displayed values, the pins, the off-ladder list, re-keying, bench ties, the reachable compare across archetypes, the anchors row's bench-alternative skip removed.

**PR 2** — **13 CONFIRMED, 7 REFUTED** across lenses A–C (one refuter), plus lens D's 11 test findings, proved by 16 mutants. Every confirmed must-fix and should-fix is built (`65d91da3`, `2edbb2cb`, `8e531e2a`, `101d4c42`, `142818f5`, `f4974b51`; spec §12.1).

| id | finding | verdict | disposition |
|---|---|---|---|
| A1 / B5 / C2 | stale bars: the server cached 5m an hour and the client asked once per modal life, so a live session's later record piled onto the cached last bar | CONFIRMED (must-fix) | fixed: 5m cached five minutes; Battle re-asks after five; 30m kept (reading 1) |
| A2 / C5 | crypto could get a Battle pill on stock-session bars | **REFUTED** (R-35: no shell for crypto) | guard kept anyway |
| A3 | early-close days kept post-market bars | CONFIRMED | fixed: each day's calendar session |
| A4 | a missing session's instant lands on the next day's first bar | CONFIRMED (note) | kept |
| A5 | UTC+ zones drop 1D / 1W markers while the chips show them | **REFUTED** (Tokyo draws them) | pre-existing note in §9 |
| A6 | 1W stacks one dot per day on the week bar | CONFIRMED (note) | reading 4 |
| A7 | the 5m window is five calendar days | CONFIRMED (note) | reading 6 |
| B1 | one state slot + a modal-life `asked` set: back on a stock whose Battle loaded earlier → stuck loading | CONFIRMED (must-fix) | fixed: answers per key |
| B2 | no way out while Battle loads | CONFIRMED | fixed: the back button |
| B3 | the pill on a stock reached by navigation (a request for a stock with no record) | CONFIRMED | fixed: the battle's own stock only |
| B4 | S/R on Battle depended on caching | CONFIRMED | fixed: off while loading |
| B6 | a ref written in render for the symbol reset | CONFIRMED (note) | fixed: the same-render state pattern |
| B7 | `timeframe: 'battle'` reaches the sheet off the Chart view | **REFUTED** on consequence | fixed anyway (harmless) |
| C1 | `agentName.js` off the guards' list (PR 1's file) | CONFIRMED | fixed on PR 1 |
| C3 | 1D merged without the battle's sessions | **REFUTED** (every battle names them) | the merge now comes with the pill anyway |
| C4 | `pinsShown` wrong on 1W | **REFUTED** (no reader) | — |
| C6 | the marker effect's deps omitted the pill | **REFUTED** (re-runs regardless) | deps listed anyway |

At first render the rung and entry lines sat off Battle's price scale (an intraday range inside one rung step), seen in the phone render, not the jsdom rows. Fixed: Battle's scale takes them in, and the rung lines carry their axis tag.

Lens D (test integrity) — 36 mutants on the reviewed head, 28 survived; given rows (`142818f5`, `f4974b51`) and re-run: 16 / 16 killed (§5). The rest are recorded there as equivalent, unreachable or unobservable in the mock chart.

## 7. Renders (375 × 812, headless Edge, the smoke page, animations off)

`C:/Users/fashr/Documents/FantasyTrades/ResearchModal/QuestionsBattleChart/`:

| File | What it shows |
|---|---|
| `1_held_up_questions.png` / `_pack.png` | AAPL held, up: *Should we take profit?* first; its pack — the bench alternative, the lock (+68: +53 from the gain, +15 banked), the next rung, the downside, the exit rule |
| `2_held_down_questions.png` / `_pack.png` | EQIX, the weakest: *Is this our weakest spot?*; its pack — the move, the quiet count, the bench alternative (ORCL, estimated rung size 2.8 %), *the lowest of your 6 stocks*, the last check |
| `3_bench_questions.png` / `_pack.png` | MSFT on the bench: *Is this better than our weakest holding?*, compared with EQIX |
| `4_battle_1day_six.png` | Battle, 5-minute bars, six markers on six bars, the entry line, *next rung +30 · $103.78* and *Bust −10 · $98.73* |
| `5_chart_1d_counted.png` | 1D: one counted marker (*Wed · 6*) and the chip *6 on Wed · Battle ›* |
| `6_battle_3day.png` | Battle on a three-day battle, 30-minute bars |

Every render names the agent *Shadow* (stored *shadow*). Segoe UI and Consolas drew here; SF Pro on an iPhone is unmeasured.

## 8. The founder's live checklist (after both merge, in a live agent battle, on an iPhone)

1. **A held stock that's up:** the first question is *Should we take profit?* Its pack says what a swap-out would lock and what holding risks.
2. **Your weakest held stock:** *Is this our weakest spot?* Its pack names where it ranks and the best bench alternative. Ask once; the answer engages with changing it.
3. **A bench stock:** *Is this better than our weakest holding?*
4. **Chart → Battle:** the record's dots spread across the day at their own times, with the next rung each way.
5. **Chart → 1D:** one counted marker for today. Tap it (or its chip), and Battle opens.
6. ***Shadow*** with a capital S everywhere.

## 9. Found on the way (not fixed — for separate tasking)

- `SHEET_COPY.checkReadAtr` prints an ASCII hyphen (*-0.45×*) where the sheet otherwise uses "−" (bare `toFixed(2)`); visible next to the new *−0.4 rungs* in *Is this our weakest spot?*.
- `useResearchData.js:741/773`: in UTC+ zones the 1D / 1W "today" key comes from a local-midnight `toISOString()`; the held (controlled) path is clean, the non-held path may drop today's marker for a player in Europe or Asia (refuter: not reproduced in Tokyo). Pre-existing.
- Windows-only rows (backslash paths): `archetypeRegistry` ratchet, `agentReadCensus`, `agentSafeWireEntry` — green on Linux.

## 10. WSL

Trees `~/pd-ci-rmq` and `~/pd-ci-rmbc` (worktrees of `~/pd-ci`, each with its own install), runs under `~/pd-rmq-runs`. No other session's tree was touched. Their sizes before removal: `~/pd-ci-rmq` 838 MB, `~/pd-ci-rmbc` 839 MB, `~/pd-rmq-runs` 88 MB (≈ 1.7 GiB in all). They are removed under the suite lock after PR 2's pushed-head build; the session message reports the space freed.
