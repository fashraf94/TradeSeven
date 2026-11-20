# Build report — the checks on the page, the Chart view first

**Date:** Thursday 19 November 2026. **Built by:** Claude Code (Opus), from the build prompt *The checks on the page, the Chart view first* (the AssetResearch planning chat, 19 Nov 2026). **Spec of record:** `docs/specs/CHART_READ_SPEC_V1.md`, amended to V1.1 in PR B. **Base:** `origin/main` at `eb34d2fd` (#1095), fetched first and again before the push (unchanged, so no merge).

## 1. Verdict

| | |
|---|---|
| **What ships** | Two PRs, each with `main` as its base, merged A then B. **A** (`claude/chart-read-fixes`): the wording rulings FX-1, FX-2, FX-3, FX-6; FX-4 (1W with SMA on); FX-8 (the three mark-drawing faults); FX-10 (two faults at 320 px, for everyone). **B** (`claude/chart-read-on-the-page`, contains A): the checks on the page under a pinned chart with two heights (CP-1), the Chart view first (CP-2), today so far (CP-3), the spec V1.1, this report. |
| **Held for a ruling** | **FX-9** (today's candle by the market's day) — built and tested on `claude/chart-read-fx9-market-day`, in neither PR: it changes candles for devices in US time zones west of New York for 1 – 5 hours each night (the prompt's stop condition). Question Q-1. |
| **CP-2's cost** | A cold-cache open on Chart makes **0** more provider requests than one on Analysis (1 each; warm 0 each): the 1D/400-day daily series is fetched by every shell open already. Built. |
| **Flag off** | Byte-identical: a differential renders the real modal with `CHART_READ_MODE` `'off'` on a browse and a battle mount through 22 steps (`document.body` with React ids renumbered, every chart-library call, every request, the focused element): `main` vs B's head, **0 differences** (a fixture's random receipt id masked — `main` differs from itself there); positive control (one flag-off padding changed) **17 differences**. |
| **Never** | A verdict computed, a model call, a provider call, a write, a stop or a target. No flag changes value. No fenced file edited or called. |
| **Goldens moved by FX-9 and FX-10** | **None.** FX-10's two changes need a measured price scale or a Battle pill's control bar, which no existing golden carries; FX-9 ships in neither PR. |
| **Review** | Two lenses (fidelity and wording; off means off and the layout), each with a refuter on its own snapshot tree. 14 findings: 8 confirmed, 3 partly refuted, 3 refuted. 9 fixed in this build, each with a row that failed first (5 jsdom, 3 pure, 10 Edge); 3 go to the founder (Q-2 – Q-4). |
| **Mutation** | 79 mutants: 77 killed, 2 equivalent (FX2-c, PG2-f). Two more fixes (L2B-4, L2B-5) are proven by Edge rows that fail on the pre-fix code. |
| **Real browser** | Headless Edge at 390 × 844, 320 × 640, 1280 × 800 (and 844 × 390): **153 rows, 0 failing** — the page at the top and in the checks for valid · Pullback, not in an uptrend and stretched; one change of height each way; marks on their bars after the change of height, a pan, a zoom and a rotation; FX-8's three layouts; no sideways scroll; tap targets; reduced motion; focus; FX-10 at 320; and the 10 rows for the review's fixes, each failing on the pre-fix code. |
| **Checks** | The full Linux suite (WSL, Node 20.20.2, `TZ=UTC`, 8 workers, `flock`): A `c3a013ee` 35,890 passed, 0 failed; B `4ed771ce` 35,935 passed, 0 failed. `lint:gate` and `vite build` on the pushed heads (§9). |
| **For the founder** | Seven questions (§8), readings R-13 – R-26 (§7), the live checklist (§10). |

## 2. Phase 0 — the eight findings

Read at `eb34d2fd`. Full text with citations: PR A's description; the points in short:

1. **What an open on the Chart view costs (CP-2).** Every shell open sets the hook to 1D (`AssetResearchModal.jsx:359`) and fetches `fetchHistoricalOHLCV(sym,'1d',{days:400})` at mount (`useResearchData.js:330`) — the 1D window and the 400-day daily series are one request; the five-day request runs only off 1D (`:395`); `askDailySeries` returns on 1D (`:434`). Analysis stays mounted under every view (`AssetResearchModal.jsx:940`). A Chart open adds the read route (60 s memory cache, else 1 – 3 Firestore reads, `private, no-store`, never the provider: `setup-read.js:37-46, 55, 149`) and the sector-rank `getDoc` (Firestore). Sector Context fetches only when opened (`CollapsibleSection.jsx:64`). **Provider requests per open: Analysis 0 warm / 1 cold; Chart 0 warm / 1 cold → CP-2 built.**
2. **The opening rule.** `openingView` (`shellView.js:26`), `bombOnlyOpensOnBomb` (`:41`), `viewOnShellAppear` (`:60`); `sheetOpensOnBomb`, `shellView`, `openTab`, `initialTimeframe` (`AssetResearchModal.jsx:251-260, 359`). At today's flags the shell is on only for the agent Battle View's mounts whose per-battle verdict is true (`sheetGate.js:31-53` → `cockpit-status` `allowlisted` = `isCockpitOwnerAllowlisted(owner = viewer)`) — the same players the read route admits. Every mount and its opening today: PR A's description, table.
3. **The sheet as built** — `ChartReadSheet.jsx` (dialog, focus trap, document Escape capture, measured rise), `sheetOf`, the wiring (`readSheetFor`, `readLit`, `readExpanded`, the 42 % plot, the hidden action row and band and Technical content) and what each test pinned: PR A's description.
4. **How a mark's square and label are placed.** `layoutRuleMarks` (`ruleMarksPrimitive.js:37`): squares at the tick's left end, stepped only off other squares — mark 3's tick (centred five bars back) crosses mark 2's square; a bracket's square at `x1 + 3`, past the latest bar. `axisLabels` (`:83`): a label per lit mark at its own y; the library stacks close labels but moves their ticks with them. All three reproduced on fixtures (8 rows, failing first).
5. **The header's price.** `$` + `priceText(enrichedAsset.price)` (`ChartHeader.jsx:112`; the shell's `ShellHeader.jsx` alike); `enrichedAsset` from `sheetPrice` (`AssetResearchModal.jsx:346`): the accepted observation in a held battle view, else `wsPrice` / the fetched price.
6. **Whether today's regular session has opened.** `getSessionForDate(etDate).openMs` (`marketCalendar.js:117`): holidays and weekends not trading days, early closes, null outside 2026 – 2027.
7. **The local-midnight row.** `useResearchData.js:758-791` (device midnight `:764-765`, the row dated `:773` by that midnight's UTC date; the weekend by the device's weekday). Tabulated (`fx9-windows.txt`): east of UTC the row is dated the previous day for most of the ET day; at UTC tomorrow's bar from 19:30 ET; **US zones west of ET differ from an ET device between midnight ET and their own midnight (1 – 5 h)**; New York identical. The 1W branch has the same bug class (reported, not fixed).
8. **The honesty test** walks every string and template of `chartReadCopy.js` by parameter name (`sheetCopy.honesty.test.jsx:113-160`); new parameters need a sample there (`price`, `side` added); today so far gets its own sweep for *holds*, *passes*, *would*, *count*.

## 3. What was built

### PR A — the fixes

| Ruling | Where | What |
|---|---|---|
| FX-1 (Q-1) | `chartRead.js` `CHANGE_TABLE` | A new first row `backWithinLimit`: the previous record `invalid · extended` whose `patternsSatisfied` holds today's valid pattern → *Since {Mon}: back within the stretch limit.*; the two *New since* rows exclude that pair in their own condition. |
| FX-2 (Q-2) | `chartRead.js` `regimeChangeParts`; `chartReadCopy.js` `regimeSecond`, `regimeChange`, `notDowntrend` | The second line from the failed rows, in the checks' order, joined as nouns; *This is not a downtrend call.* unless `regime` is `downtrend`. |
| FX-3 (Q-3) | `chartReadCopy.js`, `chartRead.js` | *(the latest close isn't in yet)*; no RD-8 footnote while behind; *No read for this stock*. |
| FX-4 (Q-4) | `chartProps.js` `weeklyAveragesHideMarks`; `StockChart.jsx` `onToggleSMA`; the modal's `smaOn` | On 1W with SMA on, marks 1 – 3 not drawn, lit or unlit; one quiet line in the checks' head; SMA off or 1D brings them back. |
| FX-6 (Q-6) | `chartReadCopy.js` `other` | The breakout's and no pattern's *what separates them*; the downtrend's other reading (`regime_downtrend`). |
| FX-8 | `ruleMarksPrimitive.js` | Squares after every line; each beside its own mark, clear of other marks' lines where it can be, never on another square, inside the pane; a mark wholly off the pane draws no square; close lit labels stacked a label apart at fixed coordinates with a leader from each price. |
| FX-10 | `StockChart.jsx`, `OHLCDisplay.jsx` | The bar wraps with the Battle pill; the OHLC row bounded by the measured price scale and wrapping. |

### PR B — the checks on the page

| Ruling | Where | What |
|---|---|---|
| CP-1, PG-1 | `ChartReadChecks.jsx` (new), `ChartReadSheet.jsx` (removed), `chartRead.js` `checksOf` | The checks are a `<section>` of the Chart view; no dialog, focus trap, Escape, 42 % plot, hidden action row or `readSheetFor`. |
| PG-2 | `AssetResearchModal.jsx` | Pinned (`[data-chart-pin]`, sticky) where the view has room; full at the top, compact (a third of the view, ≥ 180 px) in the checks; one change of height each way; the page eases by the difference; no scroll anchoring while pinned. |
| PG-3 | `chartProps.js`, `marks.js` | The default set at full height; every mark compact (the Rule chip pressed and disabled); a tapped check's marks always, lit. |
| PG-4 – PG-10 | the modal, `ChartReadChecks.jsx`, `ChartReadBand.jsx` | Tap lights and clears, scrolls nothing; the read opens nothing; collapsed patterns; quiet states never pinned; the Battle chart's checks on the page; the sector rank read once on render; one column. |
| CP-2 | `Sheet/shellView.js` `opensOnChart`, `resolveOpeningView`, `openingView`; `researchModalFlags.js` `RESEARCH_MODAL_OPENING_VIEW = 'chart'` (pinned by `researchModalOpeningView.test.js`); `AgentBattleScreen.jsx` `openedFromResearch` | OV-1 – OV-5. |
| CP-3 | `chartRead.js` `todayLineOf`; `chartReadCopy.js` `today`; `ChartReadBand.jsx`; the modal (`sessionOpened`, `headerPrice`) | TD-1 – TD-6. |
| Focus order | the modal (`readPinH`, `onChartFocus`); `ChartReadChecks.jsx` | Rows keep the pinned chart's height as scroll margin; keyboard focus anywhere under the pin is brought out. |

## 4. The review (BUILD_RULES §2)

Two lenses on `git archive` snapshots of B at `2c1b658c`, each finding handed to a refuter on its own snapshot; fixes then went in with rows that failed first (jsdom or Edge). Mutation on separate snapshots (`rev-mut` at `2c1b658c`, `rev-mut2` at `6d40d36e`).

| Id | Sev | Finding | Refuter | Disposition |
|---|---|---|---|---|
| L1-1 | low-med | Today so far can name mark (5) or (6) when, at full height, that mark is neither drawn nor printed | PARTLY REFUTED — naming undrawn marks is the ruling's design (mark 2 is named in every state; TD-5 forbids changing a mark); what stands: mark 6 is in no check row, so its value is never printed | Q-2 |
| L1-2 | low | The header (`toFixed`) and the marks (half up) round a half cent differently: the same double at 207.135 prints $207.13 and $207.14, and the line says *below* | REFUTED — the line compares what is printed (§9; R-15); comparing raw doubles is what §9 forbids | — |
| L1-3 | low | Under $1 the header prints four places: "at" (equal to the cent) can never hold | CONFIRMED, latent (only large caps are read) | Fixed: the line needs a header printed to the cent (R-24); row; mutant R10 killed |
| L1-4 | low | Seven files cite the spec "V1.1", but the reviewed tree's spec is V1 | REFUTED — V1.1 is B's next commit | — |
| L1-5 | low | On the Battle chart the checks say *tap a check to light its mark*, but nothing lights there | PARTLY REFUTED — pre-existing in the V1 sheet; PG-5 / PG-8's letter; the row itself does light | Q-3 |
| L1-6 | low | 1W with SMA on and fewer than 20 weekly bars: no average drawn, yet the note says the drawn averages are weekly | PARTLY REFUTED — unreachable in the ranked universe; the refuter's side note CONFIRMED: while 1W loads, the daily bars and averages are still drawn under the note | Fixed: the note only once the weeks are drawn (R-25); row; mutant R11 killed |
| L2B-1 | med-high | FX-8's clamp pulls the squares (and the bracket) of marks wholly OFF the pane into it: after a pan or a zoom they pile along the edges, on one another (21 pairs) | CONFIRMED (a real drag pan; a price-scale drag too) | Fixed in A: such a mark draws no square and its bracket is not pulled in; no square ever on another (R-19); 3 pure rows, 4 Edge rows; mutants R1, R2 killed |
| L2B-2 | med | While compact, the chart's own placeholders (Battle's loading box, 1D loading / error) are full height: the pin grew back to 590 px of a 662 px view | CONFIRMED | Fixed: the placeholders take the plot's height now (R-17); jsdom row, Edge row; mutant R6 killed |
| L2B-3 | med | No upper bound against the view: on a phone on its side (a 159 px view) the pinned chart covers the view and the checks are never visible | CONFIRMED (the wheel sub-claim REFUTED: over the control row it scrolls) | Fixed: pin only with room for the compact chart and 160 px of page (R-17); jsdom rows, Edge row; mutants R4, R5 killed; the threshold is Q-4 |
| L2B-4 | med | Only the check rows have a scroll margin: other focusables (record-day chips, the Technical content) take keyboard focus under the pinned chart | CONFIRMED | Fixed: keyboard focus anywhere under the pin is brought out (`:focus-visible` only — a tap scrolls nothing) (R-22); Edge row (failed pre-fix) |
| L2B-5 | low-med | The compaction test read the checks' transformed position: a small scroll right after returning to full flipped it back | CONFIRMED | Fixed: measured untransformed (R-17); 2 Edge rows (failed pre-fix); mutant R12 killed |
| L2B-6 | low-med | The height was decided only on scroll: a read landing after the player scrolled pinned the chart full height over the page | CONFIRMED | Fixed: also decided when the pinned checks first show (R-17); jsdom row, Edge row; mutant R8 killed |
| L2B-7 | low | When the read is asked for but not shown, the Chart view's DOM has two neutral wrappers and handlers vs `main` | REFUTED as a defect — static, no box of their own; `'off'` byte-identical; documented | Reading R-26 |
| L2B-8 | low | No row asserts that a door outside Battle Research carries no `openedFromResearch` | CONFIRMED gap (the stated mechanism refuted: the modal is a props recorder there; the opening is covered in the shell test) | Row added (the bench door) |

Before the review, the build's own Edge check found and fixed three defects jsdom could not see (§5).

**Disclosure:** the scratch vite servers that served the snapshot trees (the build's and the lens-2 refuter's) shared the parent install through a junction, so their dependency pre-bundling rewrote `node_modules/.vite/deps` in the main checkout's install (a cache vite rebuilds on its next start). Nothing else outside the snapshots was written by a reviewer.

### 4.1 The mutation battery

Battery 1 (`mutants.mjs.txt`, 66 mutants over FX-1 – FX-10 and CP-1 – CP-3 at `2c1b658c`): 59 killed at first; 5 survivors (FX1-d, FX8-d, FX8-h, TD-i, CHK-a) got rows and were killed on re-run; 2 equivalent — **FX2-c** (`fast.result !== true` for `=== false`: an `unknown` uptrend row cannot reach the regime state — its chain is `unknown`, the record is `unshown`) and **PG2-f** (the scroll handler without its `checksShown` guard: with no checks the refs are null and nothing compacts). Battery 2 (`mutants2-list.mjs.txt`, 13 mutants over the review's fixes at `6d40d36e`): 13 killed. Each judged by the JSON report of its targeted files (a file that fails to load would be BROKEN, not killed; none was).

## 5. The real browser

Headless Edge (playwright-core), a scratch fixture page in a snapshot of B with the flags forced on in that tree only (`fixture-page.jsx.txt`; fixtures from the store's own evaluator, `fixture-gen.test.js.txt`): `measure.mjs.txt` (143 rows, `browser-report.json`) and `measure-review.mjs.txt` (10 rows, `browser-report-review.json`) — **153 rows, 0 failing**. The 10 review rows were run once more against the pre-fix code: all 10 failed there.

What it found that jsdom could not (fixed in this build, each with a row): the browser's **scroll anchoring** undid the first compaction (240 → 0 → full → compact); a **5 px focus overlap** (the control row is 56 px with the Rule chip, not 44); squares **parked far from their own marks** in the crowded compact chart; and the review's L2B-1 – L2B-6.

Screenshots in this folder: the page at the top, in the checks and with a check lit (`A-390-*`, `A-320-*`, `A-1280-*`, `C-390-*`, `EXT-390-checks`), FX-8 (`FX8-pair-390`, `FX8-pair-1280`, `FX8-bracket-390`), the battle mount at 320 (`F1-320`, `F2-320` Battle), rotation (`A-rotated`), the review's fixes (`L2B1-compact-panned`, `L2B2-battle-loading-compact`, `L2B3-landscape`, `L2B6-read-lands-after-scroll`).

## 6. Off means off

The differential (`off-differential.jsdom.test.jsx.txt`) runs in two trees — `origin/main` (`eb34d2fd`) and B's head — with `CHART_READ_MODE` `'off'` and the opening view at `'chart'`: a browse mount (open, Chart, 1W, SMA, S/R, 1D, Analysis, Chart, Escape) and a battle mount (open, Chart, 1W, SMA, S/R, 1D, a record-day chip, Battle, back, Analysis, 💣, Chart, Escape) — 22 steps, each recording `document.body`'s HTML (React ids renumbered), every chart-library call, every request and the focused element. `main` vs B: **0 differences** once the 💣 view's receipt hash and input id are masked (that fixture draws them at random: `main` differs from itself at exactly that place). Positive control: one flag-off padding changed — **17 differences**. Run at B's reviewed head (`2c1b658c`) and again at its final code head (`4ed771ce`, after the review's fixes): 0 differences both times.

## 7. Readings (approve-by-default; spec §1.3)

| # | Reading |
|---|---|
| R-13 | OV-2's "opened from Battle Research" is the screen's own `openedFromResearch` (any row from the surface — state 2's question, state 1's list, the reference holding) or a research question's `research`; `sheetContext.rankings` is a general channel and is not read for it. |
| R-14 | A late shell appearance (`viewOnShellAppear`) is not an open: unchanged. |
| R-15 | "At" compares the header's printed digits with the mark's printed cents, as decimals (equal to the cent with a 2-decimal header); a mark is compared at its printed cent, never its raw double. |
| R-16 | Today so far shows on a behind read (TD-1 does not exclude it) and on the Battle chart under the lead. |
| R-17 | The chart pins only where the view holds the compact chart and 160 px of page; compacts when the checks reach its lower edge (measured untransformed; decided on scroll and when the pinned checks first show); full again at the top; no scroll anchoring while pinned; its placeholders take the current height. |
| R-18 | The chart changes height at once (one rebuild); the page eases by the difference (`smooth`; reduced motion `instant`). |
| R-19 | FX-8's squares: drawn after every line; beside their own mark; never on another square; inside the pane; none for a mark wholly off the pane. In the crowded compact chart a square can sit over another mark's tick, and one or two can sit a few squares out at their own height. |
| R-20 | FX-8's labels: stacked a label apart at fixed coordinates, each with a leader from its own price (the prompt's first option). |
| R-21 | FX-10: the OHLC row bounded by the measured price scale; the bar wraps wherever it carries the Battle pill. |
| R-22 | Focus order: rows keep the pinned chart's measured height as scroll margin; keyboard focus anywhere under the pin is brought out (`:focus-visible` only, so a tap scrolls nothing). |
| R-23 | The Rule chip is pressed and disabled while compact (V1's L3-7 rule). |
| R-24 | Today so far needs a header printed to the cent (unreachable today: only large caps are read). |
| R-25 | FX-4's note shows only once the weekly bars are drawn. |
| R-26 | When the read is asked for but not shown, the chart and the page each sit in a neutral wrapper (nothing remounts when the read lands); with the flag off, today's markup exactly. |

## 8. Questions for the founder

| # | Question |
|---|---|
| Q-1 | **FX-9 (stopped on its condition).** Using the ET session date fixes the wrong last candle east of UTC and at UTC (`fx9-windows.txt`), but changes candles for US devices west of New York between midnight ET and their own midnight (Central 1 h, Mountain 2 h, Pacific 3 h, Alaska 4 h, Hawaii 5 h each night): there, today's code patches the previous session's bar; the ET date draws today's (pre-open) bar, the one a New York device draws; and Friday night drops Friday's patch. Holidays stay as they are on a New York clock today (a synthetic holiday bar). Ship FX-9 as built (`claude/chart-read-fx9-market-day` at `74d79a9c`, one commit on A's head, 42 rows: 6 clocks × 7 instants), or hold it? |
| Q-2 | **Today so far names mark 6** (*below {Wed}'s 20-session low (6)*) although mark 6 is in no check row — its value is never printed, and at full height it is drawn only in valid · Pullback (L1-1, partly refuted: naming undrawn marks is the ruling's design — mark 2 is named in every state — but mark 6 is the one whose number the screen never prints). Keep as ruled, or drop the (6) clause? (Drawing or lighting it would break TD-5.) |
| Q-3 | **On the Battle chart** the checks keep *tap a check to light its mark*, but nothing lights there (the one stub only; MK-5). Pre-existing in the V1 sheet; PG-5 / PG-8's letter. Keep, drop the hint on Battle, or a Battle wording? (L1-5.) |
| Q-4 | **A short view does not pin** (R-17; review L2B-3): the chart pins only where the view holds the compact chart and 160 px of page. On a phone on its side (a 159 px view) the pinned chart had left no room for the checks at all; there, and in a short desktop window (1280 × 560: a 312 px view, where pinned it left 75 px), the chart now scrolls with the page at full height, so a tapped check's mark can be out of view. Approve the 160 px, or another threshold or rule? |
| Q-5 | **The crowded compact chart** (R-19): with all seven marks in a few dollars, a square can sit over another mark's tick (the tick passes under it) and one or two squares sit a few squares out along their own height — never on another square, never across a number. Acceptable? |
| Q-6 | **OV-2's Battle Research openings** (R-13): every row opened from the Battle Research surface opens on Analysis — state 2's question rows, state 1's list rows and the reference holding. Approve? |
| Q-7 | **The OHLC row and *prices unadjusted*** are drawn over the plot's top edge, so a mark near the top can sit under them (seen in the fixtures; pre-existing since V1). For separate tasking, or leave? |

## 9. Checks

Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8` under `flock`), each in a private worktree of `~/pd-ci` at the exact commit, `node_modules` linked to an install with the same lockfile hash (`e457c10d0317`). `origin/main` re-fetched before the push: still `eb34d2fd`, so no merge.

| Head | Commit | Full suite | `lint:gate` | `vite build` |
|---|---|---|---|---|
| A (first) | `effef093` | 35,884 passed, 0 failed | — | — |
| B (reviewed) | `2c1b658c` | 3 failed — load timeouts while the Windows-side review and mutation ran (`workspace.test.js` 5.2 s, `leagueRawIds.guard` 7.6 s and 5.1 s; the same rows 0.8 – 2.2 s in A's run; files this build does not touch) → rerun on a quiet machine below | 0 problems | built |
| **A (final, pushed)** | `c3a013ee` | **35,890 passed, 0 failed** | 0 problems | built |
| **B (final code)** | `4ed771ce` | **35,935 passed, 0 failed** | — | — |
| **B (pushed)** | this report's commit | documentation only on `4ed771ce` | in PR B's description | in PR B's description |

On Windows five files fail on every head and on `main` alike (time zone and CRLF: `StockChart.controlledSession`, `backingBetaFlags`, `shadowCpuQuoteIntegrityFlags`, `AgentBattleScreen.controller`, `AgentBattleScreen.flagOff.golden`); all pass on Linux. FX-9's branch (`74d79a9c`, one commit on A's head `c3a013ee`) passes its own 42 rows and the hook's other files (81 rows); it is not part of either suite above.

## 10. Live checklist (founder, on a phone, after A and B merge and deploy)

1. Signed in on an allowlisted account, open a ranked stock from one of your agent battles: it opens on the **Chart view** at 1D, with *Setup check · daily* and one sentence under the chart.
2. During market hours (after 9:30 ET): under the read, *Today so far: $… — above / below … 20-day (1) …*, its price the same as the header's.
3. Below that, the checks themselves — *The uptrend n of 3* and the groups — with *tap a check to light its mark* above them; no pull-up sheet.
4. Scroll down slowly: once the checks reach the chart, the chart shrinks to about a third of the screen and stays at the top; scroll back to the very top and it grows back.
5. While scrolled into the checks, tap *50-day rising over five sessions*: marks 2 and 3 thicken on the chart and their prices show on the right scale, stacked apart if they are close; tap again and they clear.
6. Tap 1W, then SMA: marks 1 – 3 disappear and the checks' head says *On 1W the drawn averages are weekly; marks 1 to 3 are on 1D.*; tap 1D and they return.
7. On a battle with a Battle pill, on a narrow phone: the pills wrap onto two rows and nothing runs off the right edge; the OHLC row's *Vol* stays left of the price scale.
8. Open a stock from Battle Research (a research question's row): it opens on Analysis, as before.

## 11. For separate tasking (found, not fixed)

- **The 1W live candle** (`useResearchData.js`, the 1W branch) dates the current week from the device's local Monday through `toISOString` — FX-9's bug class on 1W.
- **The OHLC row and the basis note overlay** the plot's top edge and can cover a mark near it (Q-7).
- **The placeholders assume a 44 px control row** (a wrapped battle bar is ~91 px), so the loading box is shorter than the chart it stands in for (pre-existing).
