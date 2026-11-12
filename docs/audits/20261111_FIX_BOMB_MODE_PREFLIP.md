# Fix: Bomb mode before the flip — honest cents, one red, the rule's %, the red zone's layout

**BP-7 in one line:** the modal's "live" price comes from the same EODHD endpoint the scorer reads (`/api/real-time`), but it is a separate fetch (the Battle View's 60-second poll through `/api/stocks/prices`, cached up to 2 minutes), not the stored quote. The one exception: when the poll has no price for the stock, the modal shows the stored scored price (`stockRewardContexts…currentPrice`).

**Date:** 2026-11-11 (fix prompt of Wed Nov 11). **Model:** Claude Opus 5.5, one local Claude Code session in the desktop app's worktree `.claude/worktrees/bomb-preflip-fixes-8630a5`, on branch **`claude/bomb-preflip-fixes`**, cut from `origin/main` `5d58a4c2` (the merge of #1041).

**Preamble.**
- `git fetch origin` ran first. `origin/main` was `5d58a4c2`, the merge of PR #1041, so the precondition held. The worktree was clean.
- Read first, as the brief asks:
  - #1041's report `docs/audits/20261111_BUILD_BOMB_BOTH_DIRECTIONS.md` (§1.1, §6.4 D3 and D4, §9 items 4 and 5, §10 Q1–Q6, §12);
  - the spec's "Refinement — both directions";
  - BUILD_RULES §1, §2, §9, §10 and §11;
  - every source file in `src/components/Research/BombMode/`.
- **Fenced files (BUILD_RULES §1): none edited.** None are called by the change. BP-7 *read* `api/cron/agent-evaluate.js` and `api/_utils/marketDataCache.js`. Reading is permitted.
- **No production read was needed.** BP-7 is answered from the code (§1). No EODHD, Anthropic or OpenRouter call was made.
- PR #1042 was not touched. Its one commit `d920c1a5` was applied, uncommitted, in a scratch WSL tree for the flip-on-top run (§6).

**The founder merges. Nothing reaches players until he does.**

## Executive verdict

| # | Area | Status | What the player sees | Before |
|---|---|---|---|---|
| 1 | **The PR** | Ready for the founder's merge. Its number and head are in §12. | Everything below, on the allowlist until #1042. | — |
| 2 | **BP-1 Honest cents** | Built | Every rung price is rounded toward its award, so "Bust (−10) if it's at or below $X" is true at X. AMZN shows **$286.26, $291.60, $254.18, $248.84**; $280.91 and $259.53 are unchanged. | Nearest cent: $286.25, $291.59, $254.19, $248.85. Four of six lines were false at their own cent. |
| 3 | **BP-2 One red** | Built | The Danger Zone uses the downside levels' red (`--ft-neg`). | Two nearly identical reds. |
| 4 | **BP-3 The rule's %** | Built | +3.95 %, +5.93 %, +7.91 % (and the mirror). These agree with Details' "3.954943 %". | +3.96 %, worked back from two rounded prices. |
| 5 | **BP-4 The red zone's layout** | Built | The red zone's big number sits in a text column with the plot under it. No trace crosses it, and the goal line stays in the plot. | A falling trace could run through the number, and the goal could leave the plot. |
| 6 | **BP-5 The ghost line** | Built | The entry label reads cleanly over the 30-minute line. | The line was drawn across the label. |
| 7 | **BP-6 Spec, BP-8 #1041's report** | Done | — | — |
| 8 | **BP-7 Where "live" comes from** | Answered (§1) | — | — |
| 9 | **Outside Bomb mode** (BP-1) | **Unchanged.** Four live surfaces print a cent different from 💣 on four rungs (§3). | — | — |
| 10 | Suites on Linux | **All green** on the final code merged with `main`: suite 1397 files / 30,627 rows; `test:rules` 41 / 741; `lint:gate` and the minified build exit 0; the mode-off goldens byte-identical (§5). | — | — |
| 11 | **The flip on top** (#1042's `d920c1a5`) | **All green:** suite 1397 / 30,627, `test:rules` 41 / 741. No row went red (§6). | — | — |
| 12 | Mutation | **22 of 22 killed**: the brief's six plus one per fix and review survivor. All restored byte for byte (§7). | — | — |
| 13 | Review (§2) | **Run:** four lenses and four refuters. 22 findings. Fixed: two real defects this PR introduced (A1, a printed cent the scorer would not honour, about once in 35,000 rungs; D4, a brick count one more than the rail on the AMZN fixture) and every test gap. The slack reading is ruled: keep as built (§10 item 0). | — | — |
| 14 | Phone renders | 375×812, mounted in Edge: 0 overlaps, page width 375 (§9) | — | — |

---

## 1. BP-7: where the modal's "live" price comes from (read-only, from the code)

**Answer.** In a live agent battle the research modal is mounted on the shipped (legacy) path. Its "live" price is `wsPrice || asset.price`. The 💣 view takes the same number, `shownAsset.price`.

`wsPrice` is the Battle View's `effectivePrices[symbol]`. The WebSocket transport is disabled server-side, so that price comes from the screen's 60-second REST poll: `stockAPI.getMultipleStockPrices` → `/api/stocks/prices` → **EODHD `/api/real-time/{symbols}.US`**. The quote is cached in three places: the browser for 2 minutes, the server's memory for 60 s, and the CDN for `s-maxage` 60 s plus stale-while-revalidate 30 s.

The scorer at a check (`agent-evaluate`) fetches each symbol with `getStockAnalysisData(sym, { forceRefresh: true })` → `fetchRealTimePrice` → **EODHD `/api/real-time/{symbol}`**, with no cache. It stores that quote as the context's `currentPrice` and `quoteEvidence`.

**So it is the same EODHD endpoint, but a separate fetch, not the stored quote.**
- The one exception: a measured held stock's `asset.price` is the committed context's `currentPrice`, read back from the battle document. The modal shows it whenever the poll has no price for the stock.
- The `controlledQuote` path is dark (`SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false`). If it were on, the same poll would feed it.
- EODHD stamps its real-time quotes about 16 minutes behind (#1041 §1.1). So between checks a poll can return the very quote a check stored, which fits the founder's screen ($268.09 live = the 1:00 check's $268.09). It could also have been the stored-price fallback. The code alone cannot say which happened on Nov 10, and Firestore does not record what the client held. **ASSUMED** either way.

| Step | Where (VERIFIED: read this session) |
|---|---|
| The modal's price: `controlledMode ? controlledPrice : (wsPrice) \|\| currentAsset.price` → `shownAsset` | `src/components/draft/AssetResearchModal.jsx:311-316` |
| 💣 takes `live: shownAsset?.price` | `AssetResearchModal.jsx:423`, `:455` |
| The Battle View mounts the modal with `wsPrice={effectivePrices[sym]}` (legacy mount and gated mount) | `src/screens/AgentBattleScreen.jsx:4257`, `:4273` |
| The controlled path is off | `src/config/featureFlags.js:3124` (`SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false`) |
| The poll runs every 60 s | `AgentBattleScreen.jsx:148` (`PRICE_POLL_INTERVAL = 60000`) |
| The client price service calls `/api/stocks/prices` | `src/services/eodhdAPI.js:137`, `:173` |
| The server route calls EODHD real-time | `api/stocks/prices.js:94` (`https://eodhd.com/api/real-time/${symbolList}`) |
| The server's price cache | `api/_utils/serverCache.js:114` (`PRICE: { sMaxAge: 60, staleWhileRevalidate: 30, memoryTTL: 60 }`) |
| A measured held row's own price is the committed context's | `src/utils/researchAssetBuilder.js:72` (`price: asset.currentPrice`) |
| The scorer fetches each symbol with `forceRefresh: true` | `api/cron/agent-evaluate.js:1211-1218` |
| …through EODHD real-time, uncached | `api/_utils/marketDataCache.js:780-794` |

The WebSocket gate is unconditional: `api/ws-config.js:40` always returns `{ available: false, transport: 'rest' }`. The browser's `prices` cache is the 2-minute LIGHT tier (`src/services/cacheService.js:39`, `:68`; the comment there still says 5 minutes). Both VERIFIED.

---

## 2. The rows as built

The founder's rulings on #1041's questions: **Q1** keep as built (the chip names the check from `quoteEvidence.observedAt`); **Q2** build it (BP-1); **Q3** keep (one field, the fill quote's time, for the sheet's Entry marker and for 💣); **Q4** keep as built; **Q5** one red (BP-2); **Q6** the rule's % (BP-3). All six are recorded in the spec (BP-6).

| ID | What the player sees | Built (file) | Rows |
|---|---|---|---|
| **BP-1** | Every rung price is rounded toward its award. Upside rungs round **up**, downside rungs round **down**, and a price already on a whole cent stays put. So "Needs $X at a check" and "Bust (−10) if it's at or below $X" are true at X. AMZN: +15 $280.91, **+30 $286.26**, **+50 $291.60**; Bust $259.53, **Crash $254.18**, **Meltdown $248.84**. Details keeps the exact targets. Its note reads: *"Prices are rounded toward the award (up for the upside, down for the downside), so a price that reaches the shown number scores. Awards use the exact targets."* | `ladder.js rungShown(rung, decimals)` with `RUNG_SHOWN_SLACK = 1e-9` (relative, on the scaled price). It keeps a whole unit only when that unit passes the scorer's own comparison (review A1, §10 item 0). Brick counts use `brickCount`: within one display unit of a whole brick, the count is that brick (review D4). Callers: `toGo` / `toGoDown` (so distances, %s and bricks come from the shown rung); `shownBrickUnit` (the shown +1 rung, so the fill still reads 6 bricks both ways); `bombView.rungFacts` (the Fuse's prices, the bar's prices, the table's `±x.xx% · $price`); `BombSheet.levelRows` (the live marker is placed against each row's **printed** price); every rung in `bombView.sheetLine`; `RedZone`'s goal tags, both sides. `bombCopy.detailsCents`. | `preflip.views.jsdom.test.jsx` "BP-1" (13 rows): $97.625 → $97.62 (down); $286.255 → $286.26 (up); non-halfway prices ($286.2506 → $286.26, $254.1894 → $254.18); a whole cent stays put on both sides (280.91 is 28091.000000000004 cents in floating point); the slack keeps a true cent (a Bust of 259.5300000001 and a +15 of 259.5299999999 → $259.53) and **never a false one** (review A1: the scorer's 101.11000000000001 → $101.12, 98.92999999999999 → $98.92, 75.95000006 → $75.96, 68.84999994 → $68.84); sub-cent decimals; the AMZN six. **Truth sweep:** 139 fills × 9 thresholds × up to 4 decimals (≥ 20,000 rung prints): every shown upside price ≥ its exact target and every shown downside price ≤ it, **strictly, in the scorer's own float comparison**, each within one display unit. **Every surface prints one string:** with +15 banked and Bust hit, the Fuse, the bar, the table, both sheet lines and both zones' goal tags print $286.26 and $254.18. The live marker sits under +30 at $286.25 and over it at $286.26. EOG at its fill still reads 6 bricks both ways. |
| **BP-2** | The Danger Zone (goal line, big number, goal tag, quote dots, chip) is drawn in the downside levels' red, `--ft-neg`. | `RedZone.jsx` `accent = down ? BT.red : HEAT`; the goal line and the goal tag use `BT.red`; the heat gradient's `<defs>` render only on the red zone. `BombPlot.jsx RedZoneChip` uses `BT.red`. `BT.risk` (`--ft-red`) stays only inside `HEAT` (the red zone's heat mix), as in Build A. | Row RN5 rewritten: the numeral is `--ft-neg`, not amber, not `--ft-red`. BD-5's goal-line row rewritten to `--ft-neg`. New: **no Danger Zone node uses `--ft-red`** (the view live, closed, below the rung, after a hit, and the chip in both states). Its goal line, numeral, tag and chip are `--ft-neg`. The red zone keeps Build A's heat mix. |
| **BP-3** | Each rung's % is the rule's %: `k ×` the threshold. AMZN: +3.95 %, +5.93 %, +7.91 % and −3.95 %, −5.93 %, −7.91 % in the Fuse titles and the table. These agree with Details' "3.954943 %". | `ladder.js rungPct`: `k × ladder.threshold` when the ladder has one. A measured ladder's threshold is `record.measured.scoringPct`, which `selectBombRecord` now carries from the same committed context Details reads (`committed.scoringPct`). A preview's is the Bomb tab's threshold. A V4 ladder (`threshold: null`) keeps the move from the displayed baseline to the displayed level. | **The table's +15 % equals Details' measured % at two decimals** (`+3.95% · $280.91`). AMZN's six % in the Fuse and the table; a preview at 3.6 % (+5.40 %, −7.20 %); a V4 ladder from displayed prices; to-go % unchanged. `selectBombRecord.test` +1: the record carries `ctx.scoringPct`, which equals `Number(details.scoringPctDecimal)`, and the ladder's +15 % is that number. |
| **BP-4** | The red zone (upside) gets the Danger Zone's layout. The tags, the big number and its sub-line form one text column, and the plot starts under it, so a trace never crosses the number. The goal line is the window's top edge and is held inside the plot, even with the price over the rung. Its tag sits under the goal line, inside the plot. The banked moment and the closed view are unchanged. | `RedZone.jsx`: the column is measured on both sides (`useLayoutEffect`). The plot's top is `max(46, column bottom + 10)`; it stays at 46 during the banked moment, Build A's plot. For the upside, `lo` also includes the goal, and `goalY` is clamped into the plot on both sides. The distance block moved into the column. The upside goal tag sits at `goalY + 8` if it fits, else above the goal. | `preflip.views` "BP-4" (14 rows, at **320 and 375 px**), mirroring the Danger Zone's D1–D4 rows: the tags, numeral and sub-line share one flow column (approaching and closed); the plot starts under the column (110 px before a measure), so a trace falling 0.6 % over the hour stays below it; with live on, 0.8 % over and 1.5 % over the rung, the goal line is in the plot; with live over the rung and a trace that never fell to it, the trace's low sits above the goal line; the goal tag stays in the plot. The banked moment is still centred at Build A's place (top 46). The closed view keeps its state, its tag and its ink numeral. #1041's row "the red zone keeps Build A's layout" is inverted (§4). |
| **BP-5** | The entry label on the Fuse reads cleanly over the 30-minute ghost line. | `FuseChart.jsx`: the baseline label is painted after the ghost paths and check dots, with a halo in the plot's background: `stroke: BT.bg`, `strokeWidth: 3`, `paintOrder: 'stroke'`, all through `style` (§10). Same x, y and size. | `preflip.views` "BP-5" (1 row): the label follows every ghost path in the DOM; its style carries `paint-order:stroke` and `stroke:var(--ft-bg-dashboard)`; there is no `stroke` attribute; it sits at the baseline. |
| **BP-6** | — | The spec's new section, "The founder's rulings on the both-directions report, and the pre-flip fixes (2026-11-11)": Q1–Q6 and BP-1 to BP-5 as built. BP-2 supersedes BD-5's "`BT.risk`", and BP-3 supersedes BD-1's and BD-3's "rung % from the displayed prices". | — |
| **BP-8** | — | #1041's report: §5 names the real files: `mutants-brief.result.json`, `mutants-review.result.json` and `mutants-review-RD4-RD5.result.json`. §12 says what was deleted (the eight reviewers' snapshot trees, PR 2's Windows worktree, both WSL trees and their runs folder) and what survives (`review/lensD-out`, `refC-out`, `refD-out`, `pr1.diff`, `mut/out-*`, `phone/`, `prod/`, `wsl/` in that session's scratchpad, and the PNGs and result files in `BombBothDirections/`). The facts come from a directory listing taken on Nov 11. §11 gains checklist items 10 and 11. | — |

## 3. BP-1: every other surface that prints a rung price for a measured position (unchanged)

Nothing outside `src/components/Research/BombMode/` changed in code. AMZN's exact targets (fill $270.22 × (1 + k × 3.954943 %)) are 280.907047, 286.250570, 291.594094, 259.532953, 254.189430 and 248.845906. **💣 now prints $280.91, $286.26, $291.60, $259.53, $254.18, $248.84.**

| # | Surface | Where | Seen by a player? | Rounding | AMZN string | Differs from 💣 by a cent? |
|---|---|---|---|---|---|---|
| 1 | The old stats table `StockRewardDetails` in the research modal's 💣 tab (Bomb mode off) | `src/components/draft/ResearchTabs/BaggerBombTab.jsx:53` (`$${stockSummary(t.target)}`) | Yes, with Bomb mode off. Today that is everyone off the allowlist. | half-even (`stockSummary`, `src/utils/stockThresholdModel.js:149-150`) | $280.91 · $286.25 · $291.59 · $259.53 · $254.19 · $248.85 | **Yes: +30, +50, Crash, Meltdown** |
| 2 | The same `StockRewardDetails` inside Battle View → Why? (Bomb mode off) | `AgentBattleScreen.jsx` → `BaggerBombTab.jsx:53` | Yes, with Bomb mode off. With it on, BD-7's "See all levels ›" replaces it. | half-even | same as #1 | **Yes: the same four** |
| 3 | `StockRewardDetails`' "exact $" list | `BaggerBombTab.jsx:89` | Yes (collapsed) | none (raw number) | `exact $286.2505704619` etc. | No: unrounded in both places (💣's Details prints the same raw value) |
| 4 | The old bomb chart's axis tag on a crossed or spectated tier line (Bomb mode off) | `src/components/Research/StockChart.jsx:550-560`; levels from `chartUtils.js:206` | Yes, with Bomb mode off | lightweight-charts' formatter, nearest | 280.91 · 286.25 · 291.59 · 259.53 · 254.19 · 248.85 | **Yes: the same four** |
| 5 | The old chart's spectate badge "$d from $X • SPECTATING" (Bomb mode off) | `StockChart.jsx:1172` (`closest.price?.toFixed(2)`) | Yes, with Bomb mode off | `toFixed(2)`, nearest | "from $286.25", … | **Yes: the same four** |
| 6 | Build C's sheet: "Next rung +N at $X · $gap (p%) to go" and "SYM $gap from +N" | `src/components/Research/Sheet/packs.js:421-425`, `:518-543` | Not yet: the sheet is dark (`RESEARCH_MODAL_SHEET_MODE = 'off'`) | **Bomb mode's own `toGo`**, so it follows BP-1 | $286.26 (was $286.25) | No: it agrees with 💣 by construction. Its strings **moved** with this PR, though its file did not change. Its golden and three rows are rewritten (§4). |
| 7 | Build C's sheet: the tapped item's price pin, "next rung · $X" / "top banked rung · $X" | `packs.js:426`, `:456` (`pricePin(go.rung.price)`) → `sheetCopy.js:207` (`money` → nearest) | Not yet (dark) | nearest, on the exact price | "next rung · $286.25" | **Yes, upside +30 and +50.** Inside the sheet itself, the fact reads $286.26 beside a pin titled $286.25 (§10). |
| 8 | Build C's sheet: the red-zone open decision (`opensInRedZone`) | `Sheet/sheetOpen.js:42-53` | No string. It picks the tab. | follows `toGo` / `toGoDown` | — | Moves with 💣 at the cent edge (its band-edge row is rewritten, §4) |
| 9 | Agent prompt rows: ACTIVE POSITIONS "next exact $…", the LOCK detail, the trigger-gate detail | `api/_utils/agentEvalPromptAssembly.js:1433`, `agentRiskManager.js:151`, `agentTriggerGate.js:74-75` (fenced; read only) | No: prompt only | raw float | `next exact $280.90704697460006` | No cent print (ASSUMED: the model may echo a rounded price in its rationale) |

Checked and found to print no rung price for a measured position:
- the row's proximity text (`measuredProximity`, % only);
- TacticalRow's heat and ChamberFuse (multiples only);
- the Why? panel's "Bagger $ · Bust $" line (`deriveTierPrices` returns null for a measured row, `selectWhyState.js:422`);
- the score popover (a measured row opens research instead);
- the bagger moment, footer and bubble (% or points);
- the voice layer (%);
- reflections (fill only);
- the cockpit, Command Center, Huddle, Fantasy Times and the feeds (none reads the targets or `scoringPct`).

**The surfaces that now differ from 💣 by a cent** are #1, #2, #4 and #5. All four are live today with Bomb mode off, and they show the nearest cent on +30, +50, Crash and Meltdown. #1042 (`'on'`) replaces them for every live agent battle. They stay wherever Bomb mode is off (the draft, acquire and watchlist modals have no held ladder). #7 differs inside Build C's dark sheet.

*Method: a read-only subagent inventoried the surfaces. I re-read the cited lines for #1, #5, #6 and #7 and recomputed every AMZN string. The cockpit, feed and prompt rows are the subagent's, marked VERIFIED there.*

## 4. Existing rows rewritten (and why)

Each rewrite follows a ruling that changes what the row pins. None was loosened to pass.

| File | Row | Was | Now | Ruling |
|---|---|---|---|---|
| `bombView.test.js` | the held line, two after-bank lines (EOG) | `$161.20`, `$150.00`, `$164.00` | `$161.21`, `$149.99`, `$164.01` (exact 161.2016, 149.9984, 164.0024) | BP-1 |
| `bothDirections.test.js` | rungPct | the move from the displayed prices (+3.956 %) | `k × scoringPct` (+3.954943 %, ±2 × for the outer rungs) | BP-3 |
| `ladder.test.js` | toGo in displayed values | rung $160.33, distance $0.07 | rung $160.34 (exact 160.33136, rounded up), distance $0.08 | BP-1 |
| `bothDirections.views` | the downside Fuse rows; the +15 title; the table's subs | −3.96 %, $254.19, $248.85; +3.96 % | −3.95 %, $254.18, $248.84; +3.95 % | BP-1, BP-3 |
| `bothDirections.views` | after-hit and banked lines | Crash $254.19; Next $286.25 | Crash $254.18; Next $286.26 | BP-1 |
| `bothDirections.views` | Details | the half-even note | the ruled note, pinned to its text | BP-1 |
| `bothDirections.views` | the Danger Zone's goal line; RN5 (the numeral) | `--ft-red` | `--ft-neg`, and not `--ft-red` | BP-2 |
| `bothDirections.views` | "the red zone keeps Build A's layout" | the numeral placed absolutely by the goal | the numeral in the flow column (inverted) | BP-4 |
| `useBombView.bothDirections` | two hook sheet lines | Crash $254.19 | Crash $254.18 | BP-1 |
| `AssetResearchModal.bombModeOn` | the record is the modal's `bombData.measured` | without `scoringPct` | with `scoringPct: ctx.scoringPct` | BP-3 |
| `AssetResearchModal.bombModeOn` | the red zone enters; C3 checking…; A3 band edge | $0.40 / 0.24 %; $161.20 / $150.00; live $163.18 | $0.41 / 0.25 %; $161.21 / $149.99; live $163.19 (still $0.82, 0.5025 % → 0.50 %: the same subject, the edge one cent over) | BP-1 |
| `Sheet/packs.facts.test.js` + golden | the rung compare; the rung distance; 12 golden lines | $0.37; $103.77, $1.50 (1.47 %) | $0.38; $103.78, $1.51 (1.48 %). The golden was regenerated, and only those 12 lines changed. | BP-1 (Build C's sheet uses Bomb mode's `toGo`, §9) |
| `Sheet/sheetOpen.test.js` | FQ-9 band edge | $103.25 in, $103.24 out | $103.26 in, $103.25 out (the shown rung is $103.78) | BP-1 |

## 5. Checks

All checks ran on Linux: WSL Ubuntu, Node 20.20.2, `TZ=UTC`, lockfile `40382e64edb6`, with `node_modules` linked to `~/pd-af0`'s install of that lockfile. The tree was this session's detached worktree `~/pd-ci-bombpre`. Each exit code is the run's own (nothing piped through `tail`), and the `Test Files` lines are vitest's own.

| Check | Tree | Result |
|---|---|---|
| Full suite, `vitest run --maxWorkers=8` under `flock /tmp/pd-suite.lock` | **`433d875f`**: the final code, merged with `origin/main` (#1038) | **exit 0** · `Test Files 1397 passed \| 9 skipped (1406)` · `Tests 30627 passed \| 107 skipped (30734)` · 236 s |
| `npm run test:rules` (Temurin JDK 21) | `433d875f` | **exit 0** · `Test Files 41 passed (41)` · `Tests 741 passed (741)` |
| `npm run lint:gate` | `433d875f` | **exit 0** |
| Minified build (`vite build`) | `433d875f` | **exit 0** |
| The mode-off goldens: `AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff`, `AgentBattleScreen.sheetModeOff` (plus `AssetResearchModal.sheetModeOff`) | in the suite above | **green, and byte-identical:** `git diff 5d58a4c2 HEAD` is empty for every `*ModeOff*` golden file and test |
| First pass, before the review (for the record) | `f37cdb32` | suite exit 0 · `1396 passed \| 9 skipped (1405)` · `30612 passed`; rules exit 0 · `41 / 741`; lint:gate exit 0; build exit 0 |
| The pushed head (this report and the spec on top of `433d875f`) | — | Docs only after `433d875f`. `lint:gate` and the minified build re-ran on the pushed commit; results are in the PR description. |

## 6. The flip on top

#1042's one commit, `d920c1a5` (`'allowlist'` → `'on'` with its pins and kill-switch mocks), was applied uncommitted (`git cherry-pick -n`) on this PR's head in a second scratch tree, `~/pd-ci-bombpref`. #1042's branch was not touched.

| Tree | Full suite | `test:rules` |
|---|---|---|
| **`433d875f` + `d920c1a5`** (final) | **exit 0** · `Test Files 1397 passed \| 9 skipped (1406)` · `Tests 30627 passed \| 107 skipped (30734)` · 241 s | **exit 0** · `41 passed (41)` · `741 passed (741)` |
| `f37cdb32` + `d920c1a5` (first pass) | exit 0 · `1396 passed \| 9 skipped (1405)` · `30612 passed` | exit 0 · `41 / 741` |

**No row went red with the flip on top**, so there was no STOP. #1042 stays a draft for the founder's merge after this PR and his phone check.

## 7. Mutation

The runner is #1041's `mutate.mjs` (session scratchpad), extended to take several edits per mutant. It works on a `git archive` snapshot of the final head `433d875f`. For each mutant it does four things:
1. a control run of the mutant's test files, unmutated, which must exit 0;
2. every edit, each of which must land exactly once (else BROKEN);
3. the run;
4. a byte-for-byte restore, checked by SHA-256.

Killed means a non-zero exit **and** failed rows in the JSON report; a crashed worker is never a kill. **22 of 22 killed on the final head, all restored.** Afterwards, every changed source file in the snapshot was also diffed against `433d875f`: 0 differences.

**The brief's six:**

| # | Mutant | Edit | Result | First row that caught it |
|---|---|---|---|---|
| 1 | Upside rungs round half-even | `rungShown`: the upside rounds half-even (and its truth guard goes with it) | **KILLED** 19 of 145 | `bombView.test` "held, up leading: Needs $X …" (`$161.20`); `preflip` "$286.2506 → $286.26" |
| 2 | Downside rungs round up | `rungShown`: the downside uses `Math.ceil` (and its guard goes with it) | **KILLED** 23 of 145 | the same; `preflip` "an exact Bust of $97.625 shows $97.62" |
| 3 | The Danger Zone draws in `--ft-red` | `RedZone` `accent = down ? BT.risk : HEAT` | **KILLED** 3 of 101 | `bothDirections.views` RN5 (rewritten): "the numeral is `--ft-neg` … not `--ft-red`" |
| 4 | The table's % comes from the displayed prices | `rungPct`: the `k × threshold` branch removed | **KILLED** 9 of 148 | `bothDirections.test` "rungPct (BP-3)"; `preflip` "the table's +15 % equals Details' measured % at two decimals" |
| 5 | The red zone's trace runs through its big number | `RedZone`: the red zone's plot top back to 46 | **KILLED** 8 of 101 | `preflip` "320 px: the plot starts under the column …" (and 375 px) |
| 6 | The red zone's goal leaves the plot | `RedZone`: Build A's window (the goal not in `lo`) and no clamp | **KILLED** 7 of 101 | `preflip` "320 px: live at or over the rung … the goal line is still drawn inside the plot" |

**Further mutants, one per fix and per review survivor:**

| ID | Mutant | Result |
|---|---|---|
| P3b / P3c | The Danger Zone chip / goal line in `--ft-red` | KILLED 2 / 3 of 101 |
| P4b | The selector drops `scoringPct` | KILLED 2 of 61 |
| P6a | The goal dropped from the red zone's floor only; the clamp holds the line at the edge, at the wrong price. **It survived the first battery**, so a row was added (the floor label names $280.91) | KILLED 2 of 101 |
| P7 | The baseline label's halo removed | KILLED 1 of 43 |
| P8 | Review A1's guard removed (the slack keeps a false cent) | KILLED 2 of 145 |
| L37, L34, L35, L16, L23, L43, L12, L29 | Lens C's eight survivors (§8: C1–C7), each against its new row | KILLED, each 1 row |
| D1m | Review D1 undone (the banked moment's tag uses the new formula). **It survived its first row**, whose goal sat at the top where both formulas agree; the row now also covers the goal on the floor. | KILLED 1 of 43 |
| D4m | Review D4 undone (no display-unit tolerance in the brick count) | KILLED 2 of 142 |

The per-mutant results are in `mutants.result.json` beside this report's copy.

## 8. The review (BUILD_RULES §2)

**Why:** at the review head `90c5ea04`, the diff against `5d58a4c2` was 22 files, +556 / −132. That passes the 10-file threshold; the line count (688) does not. After the fixes and with this report, the diff against `origin/main` is 23 files, +1,006 / −136.

**How:**
- Four lenses (A display honesty, B wiring and the off path, C test integrity, D phone layout and tokens), each on its own `git archive` snapshot of `90c5ea04` with `node_modules` junctioned, read-only on git and on the worktree.
- One refuter per lens, on a fresh snapshot, told to refute every finding with a repro.
- Lens D and its refuter measured real boxes in headless Edge (components mounted with `createRoot`, so the red zone's column is measured): 28,800 red-zone renders per font for lens D and 7,280 for the refuter, in two faces (Consolas, and Courier New at 0.6 em standing in for SF Mono).
- Lens C planted 45 mutants and its refuter re-ran every survivor against 31 files / 663 rows.
- The fixes are in `10c0398d`, `e43259f0`, `d19175c0`, `c3a93cdd` and `433d875f`. Each fix's row was mutation-checked (§7).

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| **A1** | `rungShown`'s 1e-9 slack kept a whole cent the scorer would not honour. Fill $100 at 1.11 % gives a +15 target of 101.11000000000001; the line read "Needs $101.11", yet a check at $101.11 does not bank it. Mostly this is real decimal excess, not float noise: $72.40 at 4.903315 % puts +15 at exactly 75.95000006. About 1 in 33,700 upside rungs and 1 in 40,800 downside rungs (2,000,000 random positions). The truth sweep could not catch it because it asserted with the slack. | **CONFIRMED**, and worse than reported | **Fixed** (`10c0398d`, `e43259f0`). The slack keeps a whole unit only when that unit passes the scorer's own float comparison (`high >= target` up, `low <= target` down); otherwise the price steps one unit toward the award. The truth sweep is now strict, and rows pin 101.11 → $101.12, 98.93 → $98.92, 75.95 → $75.96 and 68.85 → $68.84. **Ruled 2026-11-11: keep as built** (§10 item 0). |
| A2 | The live price is still nearest-rounded, so "At +15 · a check decides" can show while live is a fraction of a cent under the exact target (AMZN live 280.906 shows $280.91). | CONFIRMED. EODHD real-time prices carry 3–4 decimals (KO 92.015, NVDA 217.4973). | Reported (§10 item 4). Older than this PR; BP-1 narrows it to half a cent. The line says "a check decides". |
| A3 | `k × scoringPct` printed with `toFixed(2)` rounds ties in binary (1.005 → +1.00 %), while Details prints "1.005000 %". | CONFIRMED: about 1 in 2,000 rungs | Nit, reported. |
| A4 / B2 | A stale comment in `bombCopy.js` ("rungPct from the DISPLAYED prices"). | CONFIRMED | **Fixed** (`10c0398d`). |
| A5 | With a fill finer than a cent, the downside count at the baseline can read 7 against the rail's 6. | CONFIRMED and pre-existing (fills are raw real-time closes: 124 of 391 AAPL 1-minute closes have 3–4 decimals) | Note. D4's fix also covers most of it (§10). |
| B1 | Build C's dark sheet: its rung fact now prints $103.78 (Bomb mode's `toGo`), while its tapped price pin labels the exact line "next rung · $103.77", with a 103.77 axis tag. | **PARTLY**: the rung pin is CONFIRMED (both on one screen once the sheet is on); the banked pin is REFUTED (its fact prints no price) | **Reported, not fixed:** the brief says change nothing outside Bomb mode, and the sheet is dark. **Ruled 2026-11-11: a must-fix before `RESEARCH_MODAL_SHEET_MODE` leaves `'off'`**, carried by the two-view shell build (§10 item 2). |
| B3 | BP-4 puts the red zone's plot under its column, as the Danger Zone's already was. The plot is ~121 px at the 300 px desktop height, ~60 px on a 650-px-tall laptop window, ~20 px on a landscape phone. | PARTLY: the halving is confirmed; the inversion (top ≥ bottom) is unreachable | Note (§10 item 5). The Danger Zone has had the same numbers since #1041. |
| C1 | No row measured the red zone's column: every BP-4 row renders statically. Mutant M37 (the measure gated to the down side again) survived. | CONFIRMED | **Fixed** (`d19175c0`): a mounted row with stubbed offsets (a 150 px column puts the plot top at 160). |
| C2 | The up goal tag's clamp was tested only at H 354. M34 (Build A's formula) and M35 (no clamp) survived. | CONFIRMED | **Fixed:** rows at H 240 and H 200. |
| C3 | The preview % row checked only the two rungs where both formulas agree. M12 survived. | CONFIRMED | **Fixed:** +15 and Bust added (+3.60 %, not +3.61 %). |
| C4 | "Bust (−10) if it's at or below $X" was never pinned with a moving cent. M16 survived. | CONFIRMED | **Fixed:** EOG $155.60 at 3.6 % → "at or below $149.99". |
| C5 | The red zone's heat row checked only the gradient. M43 survived. | CONFIRMED | **Fixed:** the numeral's style is pinned. |
| C6 | The live marker's printed baseline was untested for a sub-cent fill. M23 survived. | CONFIRMED | **Fixed:** a $270.2249 fill row. (M22's in-slack case no longer exists after A1.) |
| C7 | The BP-5 row drew no check dots. M29 survived. | CONFIRMED | **Fixed:** two check dots, painted before the label. |
| C8 | Three rows passed for the wrong reason. (a) The to-go % row. (b) "A trace that never fell to it": the refuter's R1 (the goal dropped from the floor) survived all 663 rows. (c) The BP-3 titles echoed the ladder's own labels. | PARTLY; (b) is worse | (a) Covered by `ladder.test` and `packs.facts`. (b) **Fixed** by the P6a row, added before this review finished: the floor label names the goal's $280.91 (R1 = P6a, killed). (c) **Fixed:** literal titles. |
| C9 | M06, M14 (missing-decimals fallbacks), M11 (`legacyLadder`) and M26 survive. | PARTLY: unreachable, not equivalent | No row. Every production caller passes decimals; `legacyLadder` has no production caller. |
| D1 | In the banked moment the moment itself was unchanged, but the goal tag moved 18–19 px. At H 280 with a spike-up trace it lands on the "BANKED · …" line in 18 pairs (base sat on the numeral there instead). | CONFIRMED that it changed; overall better than base (192 vs 282 overlaps of 480) | **Fixed** (`d19175c0`, `c3a93cdd`): while the moment shows, the tag keeps Build A's place. The goal clamp stays (base drew the goal below the view). |
| D2 | With live more than 1 % over the rung, the goal sits on the dashed floor and the floor label prints the rung's price ("Floor $280.91 · −1.5 %"). Base printed $281.19, with the goal drawn off the plot. | PARTLY: as described; the spec already documents the goal | Note. The floor label and the tag print the same $280.91 (one source). |
| D3 | The BP-5 halo hides the ghost line on the glyphs (98.9 % fewer ghost pixels on the ink) but not in the gaps between words. | CONFIRMED | Nit. The words read cleanly; a background box would hide the gaps too. |
| **D4** | **BP-1 made a brick count read one more than the rail.** AMZN at its fill with +15 banked was $16.04 from +30 ($286.26): 9.003 bricks, printed "10 bricks", with the rail drawing +30 on brick 9. | **PARTLY: the refuter refuted "pre-existing".** Over 9,600 cases, 804 disagreements were new in this PR (and 2,758 were fixed by it). | **Fixed** (`433d875f`). Within one display unit of a whole brick (capped at half a brick), the count is that brick, and it is never 0 while the distance is positive. At live = fill over 38,400 ladders the count now disagrees with the rail 36 times, all where a brick is under a cent ($5 at 0.8 %). `main` had 5,888 and the review head 2,178. Rows: AMZN reads 9 both ways; a 9,600-case grid with bricks ≥ 1 cent agrees every time; a cent short of +15 reads 1. |
| D5 | `tokens.guard` and `motion.guard` list no BombMode file, so their green says nothing about this diff. | CONFIRMED. `bombMotion.jsdom` does scan BombMode for motion. | Note. The review scanned the diff itself: 0 hex/rgb/hsl, 0 colour presentation attributes, and the halo's colours go through `style`. |

**Totals:** 22 findings (A1–A5, B1–B3, C1–C9, D1–D5). All 22 CONFIRMED or PARTLY; none fully REFUTED. Two halves were refuted: B1's banked pin, and D4's "pre-existing". **Fixed:** A1, A4 / B2, C1–C7, C8 (b, c), D1, D4. **Reported:** A2, A3, A5, B1, B3, C9, D2, D3, D5.

Lens B and refuter B also checked these and found them clean:
- the four mode-off goldens (20 of 20; their golden files are byte-identical to `5d58a4c2`);
- nothing outside BombMode renders differently with Bomb mode off;
- no comparison or memo key on `record.measured` is broken by the new `scoringPct`;
- `scoringPct` is always positive and equals `Number(scoringPctDecimal)` when the context is valid (`stockThresholdModel.js:48`);
- the zone machines, the pill, the sheet line and `sheetOpen` read one source;
- the layout effect settles after one extra render and never loops.

Lens D and refuter D measured these clean:
- the red zone, side up: 0 trace points or circles in the numeral, the goal line always inside the plot, 0 tags over the column. On the same matrix, base fails all three (the trace crosses its numeral in 9,162 renders).
- the Danger Zone: the same elements and boxes as base (≤ 0.9 px apart, from Crash's cent), every colour `#ef4444` → `#ff4d5e`, and no `--ft-red` anywhere;
- the Fuse: the baseline label at the identical place in all 3,900 AMZN renders, with identical overlap lists;
- the sheet and table at 320–430 px: no horizontal scroll, no overlap;
- Details open: the new note fits.

## 9. Phone renders (375×812)

The real components were **mounted** with `createRoot` from the final code: an esbuild bundle in a 375-px page with `tokens.css` and the app's font stack. Mounting runs the layout effects, so the red zone measures its text column. They were drawn in headless Edge (playwright-core, `msedge.exe`, 375×812 at 2×). Measured on the drawn page, in all five: **0 text overlaps, 0 clipped labels, page `scrollWidth` 375.**

| File | State | Measured |
|---|---|---|
| `1-down-leading.png` | AMZN at $268.09: the red pill leads; the levels read +7.91 % · $291.60 … −7.91 % · $248.84 | The baseline label has `paint-order: stroke` and a background-coloured halo; the ghost line passes behind it |
| `2-up-leading.png` | AMZN at $277.50: the gold pill leads | — |
| `3-red-zone-falling.png` | The red zone at $279.75 (0.41 % under +15), with a trace falling from $280.70 over the hour | The column ends at 99 px and the plot starts at 109 (the goal line). The trace stays at 118–164 px, below the numeral (40–80 px). The goal tag is inside the plot. |
| `4-danger-zone.png` | The Danger Zone at $260.40, 0.33 % above Bust | The numeral, goal line, tag and chip are rgb(255, 77, 94) = `--ft-neg`, the same as the levels' downside rows. Nothing crosses the numeral. |
| `5-levels-details-open.png` | +15 banked, live $283.10; the levels table with Details open | `+15 banked. Next: $286.26 at a check`; `+3.95% · $280.91`; the new Details note, inside the column |

Copies are in `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/BombPreflip/`.

## 10. Found on the way, and the founder's rulings on the readings

**Readings, built one way and put to the founder. He ruled on each on 2026-11-11:**

0. **BP-1's float slack, read as "only where the cent is true"** (review A1). The ruling allows a 1e-9 relative slack "so 259.5300000001 prints $259.53". It also says every price is rounded "in the direction that makes it true", and its Details note promises that "a price that reaches the shown number scores". Read literally, the slack breaks the note about once in 35,000 rungs. Example: $72.40 at 4.903315 % puts +15 at exactly 75.95000006, and "Needs $75.95" would be false at $75.95. **Built:** the slack keeps a whole cent only when that cent passes the scorer's own comparison. Your example still holds as a Bust: 259.5300000001 prints $259.53. As an upside rung it prints $259.54, the true cent. Nothing on the AMZN fixture moves. **Tie-break:** with the literal slack, the strict truth sweep fails (mutant P8: the guard removed fails both the sweep and the A1 row). So the slack as written and "every shown price is true" cannot both hold. **Ruled: keep as built.** The slack keeps a whole cent only where the scorer would award at that cent.

0b. **Brick counts within one display unit of a whole brick** (review D4). This is a display rule the brief did not ask for. BP-1's up-rounding made AMZN at its fill with +15 banked read "10 bricks to +30", while the rail draws +30 on brick 9 ($16.04 is 9.003 bricks). **Built:** within one display unit of a whole brick (capped at half a brick) the count is that brick, and never 0 while the distance is positive. It bends "bricks rounded up" by at most a cent. At live = fill the count now disagrees with the rail in 36 of 38,400 ladders, all where a brick is under a cent. `main` had 5,888. **Ruled: keep as built.** Within one display unit of a whole brick, the count is that brick.

1. **BP-3's "(Fuse titles at one decimal, the table at two)".** At `main` the Fuse titles already print at **two** decimals (`BUST · −3.96%`, BD-3), and the Fuse, the bar and the table print one string per rung (BD-6, §9). The brief's own examples are two-decimal (+3.95 %, +5.93 %, +7.91 %). **Built:** only the number's source changed (`k × threshold`); every rung % still prints at two decimals in all three places. Printing the Fuse at one decimal would show `+4.0%` in the Fuse beside `+3.95%` in the table. That is a §9 disagreement, so it was not built without a ruling. **Ruled: keep two decimals everywhere.** The brief's "one decimal" was a planning error, not a ruling.

**Found on the way (reported, not fixed):**

2. **Build C's dark sheet now disagrees with itself by a cent on the upside** (§3 #7). Its rung facts come from Bomb mode's `toGo`, so they moved to $286.26. Its tapped price pin (`packs.js:426`, `pricePin(go.rung.price)` → `sheetCopy.pinLine`) prints the exact price at the nearest cent, $286.25. The sheet is dark (`RESEARCH_MODAL_SHEET_MODE = 'off'`), and the brief says to change nothing outside Bomb mode, so it is reported. The fix is one line: pin `go.rungShown`. **Ruled: not fixed in this PR.** It is a **must-fix before `RESEARCH_MODAL_SHEET_MODE` leaves `'off'`**, and the two-view shell build will carry it.
3. **Four live surfaces with Bomb mode off print the nearest cent** (§3 #1, #2, #4, #5): the old stats table, the Why? panel's old table, and the old chart's axis tags and spectate badge. For AMZN they differ from 💣 on +30, +50, Crash and Meltdown. #1042 replaces them in every live agent battle.
4. **"At +15 · a check decides" compares a nearest-cent live price with an up-rounded rung** (review A2). The shown rung is now ≥ the exact target, but the live price is still rounded to the nearest cent, and EODHD's real-time prices carry 3–4 decimals. So "At +15" can show while live is a fraction of a cent under the target: AMZN's +15 is exactly $280.907047, and a live $280.906 also shows $280.91. Before this PR the gap could be up to a full cent; now it is at most half. The line already says "a check decides", and BP-1 did not rule on the live price. Reported only.
5. **The red zone's plot is shorter now** (review B3). It starts under its text column, as the Danger Zone's has since #1041. That is ~121 px at the 300 px desktop chart height, ~60 px on a 650-px-tall laptop window and ~20 px on a landscape phone (the chart is 135 px there). Portrait phones get ≥ 280 px. If short screens matter, a minimum chart height for both zones would be a separate task.
6. **Smaller notes, reported, not fixed:**
   - A3: a rung % rounds a binary tie (1.005 → +1.00 %), about once in 2,000 rungs.
   - A5: a sub-cent fill can still read 7 bricks to Bust at the baseline in rare cases.
   - D3: the halo leaves the ghost line visible in the gaps between words, not on the letters.
   - D5: `tokens.guard` does not list BombMode files. The review scanned this diff by hand: no hex, no colour attributes.

## 11. The phone checklist (added to #1041 §11)

10. **A rung's price ends in the cent that makes its line true.** An upside rung is rounded up, a downside rung down. For example AMZN's Crash shows **$254.18**, not $254.19, and its +30 shows $286.26. The Fuse, the bar, the levels table and "What has to happen" all print the same number.
11. **The downside levels and the Danger Zone are the same red.** Compare the Bust row's red in the levels table with the Danger Zone's goal line and big number.

## 12. The PR, what ran where, and cleanup

- **The PR:** branch `claude/bomb-preflip-fixes`, cut from `5d58a4c2`, with `origin/main` (`1e041a02`, #1038) merged in before the final checks. Its number and head are in the session's closing message and the PR description. **Ready for the founder's merge. #1042 is still a draft and untouched.**
- **Windows:** this worktree. Targeted vitest and ESLint ran from the parent checkout's `node_modules` by absolute path.
- **WSL:** `~/pd-ci-bombpre` (this PR) and `~/pd-ci-bombpref` (this PR plus `d920c1a5`, uncommitted). Both are detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0`. Runs went under `~/pd-bombpre-runs`, and no other session's tree was touched. **After the last check, both trees, their `node_modules` links and `~/pd-bombpre-runs` are removed under the suite lock** (`unlink`, `git -C ~/pd-ci worktree remove --force`, `worktree prune`). The space freed is in the PR description.
- **Production:** no read was needed (BP-7 is answered from the code). No EODHD or model call was made.
- **Review:** eight subagents (four lenses, four refuters), each on its own `git archive` snapshot in this session's scratchpad (`review/snap-*`). Their harnesses and results stay under `review/lens*-out` and `review/ref*-out`; the snapshot trees are removed, junctions first.
- **Other read-only subagents:** one traced BP-7 and one inventoried BP-1's surfaces outside Bomb mode. I re-read the cited lines before using either answer (§1, §3).
- **Mutation:** `mutate.mjs`, `mutants-final.json` and `mut-final/`. The render harness is `phone/` (entry, build, shoot). All of it is in this session's scratchpad.
