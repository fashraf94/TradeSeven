# BaggerBomb measured-card repair, October 19, 2026

| Question | Verdict |
| --- | --- |
| Why did the cards lose their design? | VERIFIED in source. PR #958 added a separate, largely unstyled renderer for measured-stock positions. Its exact labels match the submitted screenshot. |
| Is a repair prepared? | Yes. The measured route now uses the existing TacticalRow design, with measured facts supplied directly to its display elements. |
| Does this undo the threshold correction? | No. Model admission, scoring arithmetic, persisted evidence, thresholds, receipts, and backend writers have no diff. |
| Is the production screen repaired? | No deployment claimed. Deliver through a draft PR for preview review and founder merge. |
| Is “Comparison unavailable” solved? | No. Its source conditions are traced and tested. The affected battle's saved score evidence and deployment identity are still needed. |
| Validation | 1,054 passing tests across 18 suites, explicit Vite production build, lint gate. Five new regression cases fail unchanged main. |
| Remaining acceptance | View the affected measured battle in the Vercel preview at desktop and phone widths. Pixel verification was unavailable in this environment. |

## Provenance and scope

Fetched origin before comparing against main. Created the isolated branch `codex/baggerbomb-measured-cards` from current main `f6400a652dcb583fdf74cec34c7629ebc423dfef`, with a clean starting tree. No other task's working tree was edited. The founder reviewed the source diagnosis in the prior exchange and asked this chat to diagnose and fix the issue.

The authoritative visual reference is the existing TacticalRow component. This is a repair of its measured-stock integration, not a redesign. The submitted screenshot is the observed symptom. Its actual deployed SHA, battle ID, and activation/control history have not been verified.

## Source diagnosis

VERIFIED at base `f6400a6`: `src/screens/AgentBattleScreen.jsx:197` introduced StockDispatchRow. On a measured row it returned a grid of unstyled article/button/paragraph/details elements, instead of TacticalRow. This removed the allocation badge, card spacing, price display, gauge, normal Why interaction and points handling. The literal “Why? Measured reward” and “no earned tiers” match the screenshot. The PR #958 file patch was read to verify origin.

VERIFIED at base: `src/utils/stockThresholdModel.js:27` dispatches using the saved `scoring.stockThresholdModel`, not a current admission flag. An already stamped battle retains this route after admission is switched off. A newly visible renderer therefore does not require a fresh UI edit. Whether this explains the exact timing for the user's battle remains unverified.

VERIFIED: PR #983 changed only dry-run scripts and documentation. PR #982 did not change the battle card renderer. These recent PRs did not introduce the observed markup.

## Repair

Line anchors below refer to this branch's source.

- VERIFIED, `src/screens/AgentBattleScreen.jsx:197`: StockDispatchRow delegates to TacticalRow. The normal Why state controls its panel. The measured target detail accompanies the player's open Why panel.
- VERIFIED, `src/screens/AgentBattleScreen.jsx:211`: measured points open the already measured-aware research view with the correct side/position identity. They do not open the legacy ATR score popover. Legacy points retain their existing handler.
- VERIFIED, `src/components/BaggerBomb/TacticalRow.jsx:43`: measured availability follows committed reward context. Missing evidence withholds price change, current price, points, gauge and badges, with a clear status message.
- VERIFIED, `src/components/BaggerBomb/TacticalRow.jsx:106`, `:139`, `:763`: proximity and visual heat use the measured context. Calibrated ATR and legacy daily targets do not drive measured paint.
- VERIFIED, `src/components/BaggerBomb/TacticalRow.jsx:580` and `src/components/BaggerBomb/ChamberFuse.jsx:222`: the gauge uses the committed multiplier directly. Lit segments use committed crossed tiers, including retained hits after retreat. It does not infer new awards from browser arithmetic or emit legacy crossing callbacks on the measured route.
- VERIFIED: unstamped/crypto rows continue through their original path. Existing frozen markup tests pass. Mixed cash/measured rows retain one allocation badge.

No fenced production function was edited or newly invoked by production code. Test fixtures call `scoreCorrectedPosition` and `correctedScorePatch` from stockThresholdAdmission, which invoke the existing fenced `calculateAssetScoreServer` adapter. No flags, API handlers, Firebase rules, package files or scoring constants were changed. No production database/provider calls or writes were performed.

## Comparison status

VERIFIED, `src/screens/AgentBattleScreen.jsx:1711`: the measured branch only passes stored scores into the comparison selector when `validCommittedStockScores` accepts the frame.

VERIFIED, `src/utils/stockThresholdModel.js:98`: acceptance checks the model, roster, version, totals, component content, committed contexts and position receipts/history.

VERIFIED, `src/screens/battleView/shadowCpuQuoteIntegrity.js:652`: the stored pair also requires finite scores and a valid, nonfuture `lastScoredAt`.

A fixture generated through the real corrected scorer/writer produces an available comparison. Removing its score evidence or timestamp correctly produces unavailable. These tests do not establish the production battle's failure reason. The screenshot alone does not establish whether the safeguard is working correctly or rejecting valid evidence.

The user's earlier `snapshot-28e6375731e68cf22dd3a0224bb1057f.json` was inspected. Its captured roster is different, and its projected battle fields omit the score evidence. It cannot answer the live comparison question.

Next investigation: identify the affected battle and deployed commit, then make one bounded read of the battle document. Evaluate each validation predicate against that same snapshot. Report the first failure and distinguish a writer defect, incomplete quote/evidence frame, or display rejection. Do not bypass evidence checks or insert zero scores to hide the message.

## Validation

Node 24.19.0, Linux, `TZ=UTC`, existing lockfile dependencies, two Vitest workers.

- 12-suite regression group: 872 passed. Includes quote availability, stock model/reader/render integration, new card behavior, TacticalRow price/proximity, flag pins and theme/motion guards.
- Six additional screen suites: 182 passed. Controller, responsive layout, pane-off frozen output, reduced-motion bagger behavior, pane interactions and measured research modal.
- Total: 1,054 passed, zero failures, across 18 distinct suites. Full repository suite was not run.
- New seven-case card regression run against an isolated unchanged-main archive: five fail and two pass. The failures cover missing structure, missing gauge, inferred award segments, unavailable/recovery rendering, and unconditional Why content. This demonstrates detection of the original defect.
- Explicit `npm run build`: passed. Existing chunk-size warnings remain.
- `npm run lint:gate`: passed.
- Ordinary ESLint on touched files: the same 12 errors and 12 warnings as base. Compared by file, rule, severity and message with embedded line numbers normalized. Zero new diagnostics. This is distinct from the passing required lint gate.
- `git diff --check`: passed.

The existing measured render tests now explicitly set `whyOpen` before asserting expanded details. The CPU research test targets the restored card's symbol instead of the removed raw article/button. Arithmetic and evidence assertions remain intact.

## Limits and preview review

Local Chromium and Headless Shell downloads returned unusable archives. The available cloud browser could not reach the isolated local fixture server. No desktop or phone screenshot pass is claimed.

Before merge, view a measured battle on the preview at desktop and phone widths. Confirm aligned cards, prices and gauges, readable spacing, the center tier badge, player Why open/close, CPU symbol and points research identity, and the crypto row. Verify unavailable data shows a status rather than zero values. The branch retains the existing design and has DOM/behavior coverage, but a browser pixel review remains required for this visual bug.

No merge, production activation, CI polling, review requests or automatic follow-up changes. The founder owns the preview decision and merge.
