# BaggerBomb card and score-display repair, October 19, 2026

| Question | Verdict |
| --- | --- |
| Why did the cards lose their design? | VERIFIED in source. PR #958 added a separate, largely unstyled renderer for measured-stock positions. Its exact labels match the submitted screenshot. |
| Is a repair prepared? | Yes. The measured route now uses the existing TacticalRow design, with measured facts supplied directly to its display elements. |
| Does this undo the threshold correction? | No. Model admission, scoring arithmetic, persisted evidence, thresholds, receipts, and backend writers have no diff. |
| Is the production screen repaired? | No deployment claimed. Deliver through a draft PR for preview review and founder merge. |
| Is “Comparison unavailable” solved? | A reproducible display rejection is fixed: changing only Firestore map-key order hid valid totals and the bar. Desktop and mobile regression tests now pass. The affected live battle still needs the updated deployment check. |
| Validation | Original card repair: 1,054 tests. Score follow-up: 162 tests across seven suites, including desktop/mobile header rendering. Five score regressions fail the pre-fix code. Production build and lint gate pass. |
| Remaining acceptance | View the affected measured battle in the Vercel preview at desktop and phone widths. Pixel verification was unavailable in this environment. |

## Provenance and scope

Fetched origin before comparing against main. Created the isolated branch `codex/baggerbomb-measured-cards` from current main `f6400a652dcb583fdf74cec34c7629ebc423dfef`, with a clean starting tree. No other task's working tree was edited. The founder reviewed the source diagnosis in the prior exchange and asked this chat to diagnose and fix the issue.

The authoritative visual reference is the existing TacticalRow component. This is a repair of its measured-stock integration, not a redesign. The submitted screenshots show the symptoms. Later screenshots identify preview commit `b89c2f9` and battle `vrLxfQxi2cTHu9IWAb3v`. The complete saved battle document has not been read. The user confirmed Cockpit UID access is scoped to Production, explaining its absence from this preview.

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

## Score-display follow-up, 21:03 Chicago request

Fetched origin again before checking remote state. PR #984 remained open and draft, with remote head `b89c2f91d6ce53dd88010dc6d0c4094a1a460f5b`. The local card commit `861e531` has the identical tree. The user explicitly requested completing the missing-score fix in this task.

VERIFIED, `src/utils/stockThresholdModel.js:39`: the saved roster token serializes the model map with ordinary JSON.stringify, retaining insertion order. Firestore sorts map fields while the serialized token remains a string. Firebase documents this behavior at https://firebase.google.com/docs/firestore/manage-data/data-types.

VERIFIED by reproduction: create a committed score frame through the existing scorer and patch writer, then change only the model map's key order. Before the fix, both saved totals remain 20, both row contexts remain valid, but `validCommittedStockScores` changes from true to false. The screen then removes both totals and the bar at `src/screens/AgentBattleScreen.jsx:1711`. No altered score or absent quote is needed to reproduce the symptom.

VERIFIED repair, `src/utils/stockThresholdModel.js:98`: parse the stored roster token and compare its complete contents using the existing stable object serializer. Preserve array order, all identity fields, persisted token format, and every other evidence check. Malformed tokens still fail. This restores reads of existing committed scores without a migration, recalculation or database write.

VERIFIED, `src/utils/stockThresholdModel.js:110`: the shared committed-score validator retains model, roster version, score version, total equality, component, context, receipt and history validation. This also corrects consumers of the shared validator, including result eligibility when the only difference is map-key order. No scoring arithmetic, score writer or fenced production function changed.

VERIFIED, `src/screens/battleView/shadowCpuQuoteIntegrity.js:652`: the existing stored pair still requires finite scores and a valid, nonfuture lastScoredAt. The fix adds no browser estimate or zero fallback.

### Follow-up verification

- Before implementation: five failures across the two modified suites. Two detect key-order rejection directly. Three mount the full screen and show the missing header totals at desktop 1600px, mobile 390px, and completed mobile 375px. The other 41 tests pass.
- After implementation: 162 tests pass across seven suites covering the model, mounted screen, frontend/backend readers, corrected writer, evaluator and expiry path.
- VERIFIED mounted-screen assertions at `src/screens/AgentBattleScreen.stockResearch.jsdom.test.jsx:106`: both saved scores and the score bar render. Active games use last-scored comparison and completed games use final comparison. A changed total still shows unavailable.
- Negative cases reject malformed tokens, changed model admission time, roster version, position, slot, array order, extra identity fields, totals, score version, contexts and components.
- Explicit production build and required lint gate pass. Existing CSS/chunk warnings remain. Diff whitespace check passes.
- Cumulative PR remains nine files and below 1,500 changed lines. No independent agent review was run. Full repository suite was not rerun.

The reproduced defect matches the reported pattern of valid stock rows with missing header totals. Its presence in the specific live document remains unverified because no authenticated battle snapshot was available. Confirm the affected battle on the updated preview or Production deployment before claiming the live incident resolved. No user-run diagnostic script is required to deploy this repair.

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
