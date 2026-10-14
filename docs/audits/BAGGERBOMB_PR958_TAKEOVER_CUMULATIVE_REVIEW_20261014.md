# PR 958 takeover: R1 repair and cumulative adversarial review

October 14, 2026, America/Chicago. Opus / Claude Code takeover of the existing task, branch and PR. The founder merges; activation is a later decision.

| Question | Verdict |
| --- | --- |
| R1 (corrected exit banked from the entry marker) | **CONFIRMED and REPAIRED.** Reproduced at `0abec7e5` in the common writer and through the evaluator (risk exit, then a model swap of the fresh lifetime in one tick). An outgoing stock now needs a dated post-entry quote; exit price, gain, points, bank component and capture come from that one quote. |
| Dormant merge | **READY, subject to the hosted run.** `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = false` and registry `activationAuthorized: false` are unchanged. With the flag off no corrected game can be created, and the only change that reaches live unstamped behavior (K2-4) narrows a race the PR had widened. On the merge with current main (Linux, Node 20.20.2, `CI=true TZ=UTC`): 20,314 passed / 0 failed; `lint:gate` and `vite build` pass. |
| Activation | **BLOCKED.** Three owner decisions (K2-1 settlement of an expired battle without evidence, K2-2 the post-entry lower bound under the delayed quote feed, K3-1 whether calibrated risk runs on an unavailable reward frame), contact expansion for six readers outside the §6 list (K3-3) and the research chart redraw (K1-1b), then live provider/publication/cron observation. Section 8 lists them. |
| Review | Three isolated lenses (K1 domain/display, K2 lifecycle/writers, K3 dispatch/separation/guards), three refuting verifiers (KV1–KV3), one mutation lens (KM) last on its own tree. 21 distinct findings plus 2 duplicates. 20 confirmed (8 of those with a correction); 1 refuted as stated (K3-6, whose residual was repaired). 14 are repaired here (K1-1 only partly). 8 stay open: 3 owner decisions (K2-1, K2-2, K3-1), 3 contact expansions (K3-3, K1-5, and the K1-1 chart redraw) and 2 minor items tied to those decisions (K2-5, K2-6). |

## 1. Preamble and provenance

- `git fetch origin` ran first, and again before the final checks and before the push. PR 958 was open, non-draft and unmerged; the remote head was `0abec7e521b5bc9c7a568fd030b775e46e51b084` at takeover and stayed there until this push. The original base is `abe6870df5c0f7ca5bb1f6936607006e55acbe4a`. `origin/main` was `d5d8fa9b26613b6ea711c4c6520715d29cb8bacd` at takeover: seven commits past the base, adding only `docs/audits/20261013_EXPERIMENT_ARCHETYPE_ABLATION_AND_GATE_CENSUS.md` and `scripts/experiments/archetypeAblationReplay.mjs`, with no overlap with this PR. During the session main moved to `6d75a324f8390a6f351a48d0da716da8dc5661f4` (PR #961, the dark crypto-slot prompt). That PR touched three files this PR also edits, and `src/config/featureFlags.js` conflicted (both sides append a dark flag). main was merged into the branch through the app's base-sync tool at `8ba5d1945e1fe3575c1ad325b16dc5b3328126ca`, keeping both flags; `agentEvalPromptAssembly.js` and `flagPinGuard.test.js` merged cleanly. The final checks ran on that merge commit, the tree GitHub tests.
- Work ran in an app-managed worktree whose local branch is `claude/baggerbomb-thresholds-takeover-324d11`, reset to the PR head while clean. Commits were pushed by refspec to `codex/baggerbomb-stock-thresholds-dormant-v1`. The Codex worktree that had the PR branch checked out was clean at the same head and idle; it was not written to. Nothing else wrote this branch during the session.
- Authorization: the owner's October 14 handover continues the October 13 dormant-implementation approval (`docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md`) and authorizes in-scope repairs, tests and review records. No policy, flag, registry, control, production data, catalog, migration or merge change was made.

Commits added by this takeover, on top of `0abec7e5`:

| Commit | Content |
| --- | --- |
| `0d07608d` | R1: corrected exits require dated post-entry evidence |
| `483d99ca` | K1-1/2/3/4/6/7: research, Why, prompt and capture read the pinned context |
| `a9d3b978` | K2-4/3/7/1b, K3-8: tournament legacy-GC re-read, crypto re-entry reset, landed-swap refresh, stranded-battle log, flag-off row |
| `d87217c7` | K3-7/K3-6: corrected roster re-read after the stamp; creation refusal keeps its cause |
| `d1036fef` | test-only: two repository guards tripped by the new test files (§7) |
| `cc049e16` | test-only: rows closing the mutation lens's ten surviving-mutant gaps |
| `8ba5d194` | merge of `origin/main` `6d75a324` (one conflict, flags file, both kept) |
| this record | docs only |

Before this record, the branch's own changes against the original base are 49 files, +2,894/−74 (`abe6870d..cc049e16`). Against current main they are 49 files, +2,895/−74 (`6d75a324..8ba5d194`; the extra line is the blank line separating the two flags). The takeover delta is 21 files, +792/−54 (`0abec7e5..cc049e16`).

## 2. Inherited assumptions checked

| Handover statement | Result |
| --- | --- |
| Admission false at `src/config/featureFlags.js` ~3201; registry not activation-authorized | VERIFIED `featureFlags.js:3201` at `0abec7e5` (`:3245` after the main merge, value unchanged `false`); `stockThresholdPolicyRegistry.js:7` `activationAuthorized: false`. |
| R1 anchors (`stockThresholdAdmission.js` ~135-139, ~226-235, ~255-259; `agentSwapExecution.js` ~226-228) | VERIFIED at `0abec7e5`: marker-first at `:132-141`, exit validation `:227-231`, marker set `:255-259`, dispatch `agentSwapExecution.js:226-228`. |
| R1 four-control reproduction | VERIFIED byte-for-byte (accept/0/$110; refuse/0 writes; accept/0/$110; accept/295/$110). |
| "Exact evaluator-route reachability still requires your integrated replay" | DONE. The second swap needs a candidate the risk picker did not have; a catalyst story adds one after the risk loop (`agent-evaluate.js` catalyst block), and the model's swap of the fresh MSFT lifetime reached the writer. At head: trade entry 103.27, exit 106, `lockedPoints` 0, `lockedGainPct` 0, context `entry_commit`. |
| Main 7 commits do not touch the PR | VERIFIED (two files, no overlap; no new census/guard tests). |
| The handover's "equality counts" boundary rule | Applies to tier crossing. The post-entry quote rule is a separate, pre-existing predicate (`stockThresholdModel.js:63`: `asOf >= enteredAt`), kept unchanged; see §3. |

## 3. R1: reproduction, repair and evidence

**Mechanism at `0abec7e5`.** `scoreCorrectedPosition` used the position-bound `stockEntryCommit` marker whenever it matched, before looking at any quote. The swap writer banked the outgoing lifetime through that helper while validating the exit quote only for `asOf <= now`. A lifetime entered and rotated out in one tick (one price map) therefore banked its own fill: 0 points, 0% gain, while the trade row recorded the tick quote as `exitPrice`.

**Repair (non-fenced `api/_utils/stockThresholdAdmission.js`).**
- `scoreCorrectedPosition` (`:135-142`) scores the posted quote first through the one existing predicate in `stockRewardContext`. The marker stands in only when that context is `missing_post_entry_quote` (the swap tick's quotes predate the fill), and only when `entryCommit` is allowed.
- The exit path (`:232`) calls it with `{ entryCommit: false }`: no qualified post-entry quote means `missing_post_entry_quote` before any write.
- `exitPrice` (`:239`), `lockedGainPct`, `lockedPoints`, `rewardContext` and the bank component (`:246`, now with `exitPrice` and `exitQuoteAsOf`) come from that one context; crypto keeps its typed quote.

**Predicate note.** Re-scoring the same quote after a commit needs `asOf >= history.observedAt`, so the rule stays non-strict. Its consequence for a frozen-clock fixture (a tick quote stamped exactly at the entry instant counts as post-entry) is shown in the evaluator row at lag 0. In real time a tick's quote is fetched before the swap commits, so it is dated earlier. The one existing fixture that dated a pre-swap quote at the entry instant (`stockThresholdAdmission.test.js`, CPU-ticker row) was re-dated one second earlier, with its assertion unchanged and a comment saying why.

| Replay | Head `0abec7e5` | Repaired |
| --- | --- | --- |
| Writer, pre-entry exit quote, marker present | accepted, banks 0, exit $110 | refused `missing_post_entry_quote`, 0 writes; held valuation still entry 0 |
| Writer, pre-entry quote, no marker | refused, 0 writes | unchanged |
| Writer, later quote 14:04, marker present | accepted, banks 0, exit $110 | banks 295, exit $110, gain 10%, context `post_entry_quote` |
| Writer, later quote, no marker | banks 295 | unchanged |
| Evaluator, risk exit then catalyst model swap, quote 1 s before the tick | second swap banks 0 at exit 106 | second swap refused `missing_post_entry_quote`; MSFT lifetime kept; one component |
| Same, quote at the frozen tick instant | banks 0 at exit 106 | banks 68 from the 106 quote; trade, component and capture all say 106 |

New rows: held precedence (pre-entry, same instant, later, absent), pre-entry exit with zero writes, gain (+295) and loss (−90, −1.5x crossed at equality), absent and fallback exit quote with zero writes, contended retry that banks once and a stale replay that cannot bank again, all through the real `executeSwapServer` corrected route; evaluator sequencing at lag 1 s and 0 s; crypto swap-out exit evidence.

## 4. Review method and isolation

Each reviewer and verifier worked in its own LF `git archive` extraction under the session scratchpad, with `node_modules` as a junction. All were read-only on git and the shared worktree, and ran only targeted vitest files. Reviewers who briefly swapped a file to compare with base restored it and proved the restore by sha256 (K2: `decide.js`; KV2: `decide.js`, `stockThresholdAdmission.js`; KV3: `agent-evaluate.js`, `stockThresholdAdmission.js`; K3: two files, `diff -rq` clean). One reviewer accidentally wrote two `git show` copies to `/tmp` and deleted them at once. The coordinator did the same once with a scratch backup (`/tmp/sta.bak`), removed at once. Both are disclosed here. The coordinator's own R1 replay and self-mutations ran in separate trees. The mutation lens ran last, on its own tree at `d1036fef`. Lens ids are K1-n/K2-n/K3-n, verifier ids KV1-n/KV2-n/KV3-n, mutation lens KM-n. R1 keeps the handover's id.

## 5. Findings and dispositions

| Id | Finding | Verifier | Disposition |
| --- | --- | --- | --- |
| R1 | Corrected exit banked from the entry marker | coordinator writer and evaluator replays; KV2 re-ran its own rows against the repair; KM mutated it | CONFIRMED; repaired `0d07608d` |
| K1-1 | Held research modal's default bomb chart redrew targets from the previous close and marked "HIT" from whole-session (incl. pre-entry) candles beside the exact context | KV1 CONFIRMED (two independent mechanisms; 1-ulp expression drift) | Repaired within §6 `483d99ca`: `researchAssetBuilder.js:72` and the gated `heldResearch` twin hand the chart no threshold, so it shows no second target set (StockChart's existing 1D fallback). Redrawing the six exact targets on the chart needs `AssetResearchModal.jsx`/`StockChart.jsx`, outside §6 (open, §8). |
| K1-2 | A held corrected name opened bare (cockpit chip, chat ticker, trade card) showed the legacy calibrated table | KV1 CONFIRMED-WITH-CORRECTION (the claimed fetch override does not fire on this screen) | Repaired `483d99ca`: `stableResearchAsset` (`AgentBattleScreen.jsx:2715`) resolves to the enriched pinned row, player first |
| K1-3 | Why tier line rounded half-up, unlabelled, beside labelled half-even exact targets | KV1 CONFIRMED | Repaired `483d99ca`: `deriveTierPrices` (`selectWhyState.js:419`) returns null on the pinned route |
| K1-4 | Corrected prompt rows dropped Tier/Sector/Entry (the 2x star conviction fact) | KV1 CONFIRMED | Repaired in the sanctioned §6 prompt contact `483d99ca`: `buildPortfolioCSV` (`agentEvalPromptAssembly.js:1489` after the main merge) keeps the identity columns; legacy rows byte-identical |
| K1-5 | Bagger moment never fires for corrected stocks | KV1 CONFIRMED-WITH-CORRECTION (two causes) | Open: `deriveBaggerMoment.js` is outside §6 (§8) |
| K1-6 | Target ≤ $0 (pct > 50) read "unearned" | KV1 CONFIRMED-WITH-CORRECTION (cosmetic; "-0.00" is consistent half-even) | Repaired `483d99ca`: labelled unreachable |
| K1-7 | Corrected swap captures recorded the calibrated guardrail history as null | KV1 CONFIRMED-WITH-CORRECTION (null only; tape shows it as honestly missing) | Repaired `483d99ca`: `closedTrade.outgoingRiskHistory` (`stockThresholdAdmission.js:243`) rides the capture's `stockRewardContract`. The symbol-keyed legacy field stays null so the tape's legacy ghost scorer is not fed a corrected lifetime. Same as K3-4. |
| K2-1 | An expired corrected battle whose last frame is unavailable is never settled; the agent is locked out | KV2 CONFIRMED (introduced; the spec §5 says no general lifecycle repair) | **Open, owner decision** (§8) |
| K2-1b | That battle was counted as `completionSkipped` ("another writer completed it") | KV2 CONFIRMED | Repaired `a9d3b978`: logged and counted as an error |
| K2-2 | With the documented 15–20 min delayed REST feed, the first tick after every corrected entry is unavailable | KV2 CONFIRMED (mechanism proven from source; delay documented, not measured live) | **Open, owner decision** (§8) |
| K2-3 | Typed crypto re-entering a corrected game kept its prior thresholdHistory | KV2 CONFIRMED-WITH-CORRECTION (latent: every live route enforces the 24 h cooldown) | Repaired `a9d3b978`: whole-map reset as the legacy writer does (a dotted path would split `.CC`) |
| K2-4 | The tournament helper's settlement snapshot, moved to its start, widened the window in which legacy GC overwrites a completion the cron committed (live unstamped path) | KV2 CONFIRMED-WITH-CORRECTION (race pre-existing at base, narrower) | Repaired in the owner-approved guard contact `a9d3b978`: `runPrescribedTournamentDeploy` (`decide.js:1456`) re-reads at the original position; a supported/invalid model never falls into legacy GC (`:1468`). Golden comparison strips the two exact-shape queries (count asserted). |
| K2-5 | Corrected held exits skip `finalizeCronState` (feed beats, evaluation entry, lock release) | KV2 CONFIRMED (lock inert: 120 s vs 15 min) | Open, minor; shape depends on the K3-1 decision |
| K2-6 | Landed-trade recovery path sets no entry marker | KV2 CONFIRMED (unchanged by R1 repair) | Open, minor; disappears under the K2-2 fill-time option |
| K2-7 | Post-commit corrected roster read inside the executor try recorded a landed trade as "Swap execution failed" | KV2 CONFIRMED | Repaired `a9d3b978`/`d87217c7`: the re-read runs after the try, just before the final write |
| K3-1 | Any unavailable corrected operand (either side) suppresses the whole calibrated risk pass for the tick | KV3 CONFIRMED-WITH-CORRECTION (one fresh entry blocks a valid bust exit on another position; base already skips a tick on missing/fallback quotes) | **Open, owner decision** coupled to K2-2 (§8) |
| K3-3 | Voice cache/chat prompt, reflection, film tape, bagger moment and pattern logger read legacy stores on corrected games ("You 0 — Opponent 0 (TIED)" for unavailable totals) | KV3 CONFIRMED (all six, exposed not introduced) | **Open, contact expansion** (§8) |
| K3-4 | = K1-7 | KV3 | Repaired with K1-7 |
| K3-5 | = K1-2 | KV3 | Repaired with K1-2 |
| K3-6 | With the selector on, unselected creation errors are rewritten as stock refusals | KV3 REFUTED as stated (every production non-tournament creation is selected); residual: the original error was dropped | Residual repaired `d87217c7`: `createAgentBattle` (`agentBattleService.js:336`) attaches `cause` |
| K3-7 | Pin 3's count bump was justified wrongly; `refreshCorrectedRoster` sat in the prompt→stamp window, so the stamp's `fundAsOf` came from the post-swap bench | KV3 CONFIRMED (executed) | Repaired `d87217c7`: re-read moved after the stamp; pin 3 names it; stamps-on row |
| K3-8 | The flag-off creation row passed `{}` and could not fail | KV3 CONFIRMED-WITH-CORRECTION (agentBattleService.test does not kill the mutant) | Repaired `a9d3b978` |

Negative controls that held (lens + verifier evidence): six-place half-even at every policy example and binary64 neighbour, string/number agreement, `quantized_zero`, no bounds, receipt replay refusing one-ulp drift; all six targets cross at equality and not one ulp short; LOCK band identical to legacy at its edges; server/client score parity; retained tiers after retracement; pre-entry, older-than-history and future quotes unavailable; CPU and agent contexts separate for one ticker; 12 invalid-stamp variants unavailable at every reader/writer with no legacy fallback; 14 legacy golden/parity suites green; a 2,248-case risk grid differing only on LOCK; executor-metadata guard still kills a tainted belief; contended creation and swap retries write once; the real Admin SDK accepts the evaluator's proxied ref offline.

## 6. Fenced edits and sanctioned functions

Edits to calibration-fence files in this takeover, all inside adopted contacts:

| Fenced file / function | Edit | Authority |
| --- | --- | --- |
| `api/_utils/agentEvalPromptAssembly.js` / `buildPortfolioCSV` | corrected rows keep identity columns (K1-4) | spec §6 prompt contact (`:1470`) |
| `api/agent/decide.js` / `runPrescribedTournamentDeploy` | legacy active-battle re-read; non-legacy never legacy-GC'd (K2-4) | owner-approved tournament guard contact |
| `api/_utils/agentBattleService.js` / `createAgentBattle` | refusal keeps `cause` (K3-6) | spec §6 creation contact (`:309`/`:323`) |

Non-fenced edits: `stockThresholdAdmission.js` (`scoreCorrectedPosition`, `executeCorrectedStockSwap`), `agent-evaluate.js` (`processAgentBattle` refresh placement, expiry-loop branch; §6 evaluator contact), `researchAssetBuilder.js`, `AgentBattleScreen.jsx` (`stableResearchAsset`, gated `heldResearch`), `selectWhyState.js` (`deriveTierPrices`), `BaggerBombTab.jsx` (`StockRewardDetails`). Fenced functions called and not edited: `executeSwapServer` (dispatch only), `calculateAssetScoreServer`, `evaluateRisk`, `applyGuardrails`. Not edited: `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`, `compositionGenerationFence.js`, scoring constants, the adopted policy/rule tuple, flags, Firestore rules, workflow and test configuration. No legacy golden regenerated, no skip broadened, no guard exempted. Test-integrity changes, each reasoned in its file: the CPU-ticker fixture's quote re-dated (§3); the golden pair strips one more exact-shape query; pin 3 gains a forbidden name and a corrected comment; the flag-off row now uses an in-scope document; unused imports removed from the evaluator suite; the `executeSwapServer` consumer allowlist (`agent-evaluate.test.js`) gains the new stamps-on suite, a test consumer with its reason, as this PR already did for two sibling suites.

## 7. Verification

Runtime of record: WSL Ubuntu, Node 20.20.2 / npm 10.8.2 (the reconciliation's cached official runtime), a private clone, lockfile `npm ci`, `CI=true TZ=UTC`, Git-byte LF. Final checks ran on the merge commit `8ba5d194`, which contains current main.

| Check | Result |
| --- | --- |
| `npm run test:run -- --maxWorkers=2` at `8ba5d194` | **20,314 passed / 0 failed / 88 skipped**; 953 files passed, 7 skipped (407 s) |
| `npm run lint:gate` at `8ba5d194` | exit 0 |
| `npm run build` (`vite build`) at `8ba5d194` | exit 0, 3,963 modules, 13.95 s; four CSS-syntax warnings, identical in a build of main `6d75a324` |
| First full run (`d87217c7` merged with main `d5d8fa9b`) | 20,255 passed / **2 failed** / 88 skipped. Both failures were repository guards tripped by new test files (the `executeSwapServer` consumer allowlist, and the `async (importOriginal)` flags-mock form). Fixed in `d1036fef`; no runtime cause. |
| Broad `eslint .` (not a CI gate) | main `6d75a324`: 976 errors / 127 warnings; `8ba5d194`: 977 / 127. The +1 is the branch's `export function enrichHeldPosition` Fast Refresh rule. PR head at takeover `0abec7e5`: 989 / 127. |
| Focused stock-threshold suites (Windows LF snapshot of `8ba5d194`) | 131 passed across 9 files; the PR head had 97 across 5 files. All 45 `agent-evaluate*` files: 1,057 passed at `a9d3b978`. |
| Firestore rules suite | not run: no rules change |

Mutation evidence:

| Set | Result |
| --- | --- |
| Coordinator R1 self-check (own tree) | 8 mutants: 6 killed; 2 equivalent (exit price read from the same decision quote; widened fallback that hits the same validators first) |
| Coordinator K3-8 flag gate | killed by the rewritten row; the old row survived it |
| Mutation lens KM (own tree, last) | 53 mutants across every repair: 39 killed by the shipped rows; 4 equivalent (KM-2, KM-10, KM-32; KM-23 is the gated twin, unreachable while `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED` is false, a latent gap if that flag flips); 10 real assertion gaps |
| Gap closure (`cc049e16`) | the 10 gap mutants rerun against the shipped suites: **10/10 killed**; every mutated file restored byte-exact |

Evaluator-level replays and their logs (R1 at head and repaired) are in §3. Live provider, publication, cron and browser behavior were not observed (§8).

## 8. Activation blockers and owner decisions

These do not affect the dormant merge: with admission false no corrected game can exist.

1. **Decision packet A (K2-2 → K2-1, K3-1, K2-5, K2-6).** The post-entry rule compares a quote's provider time with the wall-clock commit instant. On the documented 15–20 min delayed feed (`agentSwapExecution.js:319`, `filmTape/tapeReplay.js:41`), every first tick after an entry is unavailable. That tick then skips calibrated risk for every position (K3-1), and if it is the last frame, the battle never settles (K2-1). Options:
   - (a) Bound "post-entry" by the fill quote's own provider time (`fillQuote.quoteAsOf`), so movement after the fill's market observation counts. One predicate in `stockThresholdModel.js:63` plus `initialRewardHistory`; most unavailability disappears.
   - (b) Keep wall-clock entry, and run the calibrated risk pass on an unavailable frame while gating only reward-dependent stages.
   - (c) Both.
   Separately, decide how an expired battle without evidence ends: a final rescore pass at expiry, or a terminal "result unavailable" completion (no stats, no reflection; the disposition already exists at `agent-evaluate.js:6675`).
2. **Contact expansion B (K3-3, K1-1b, K1-5).** Voice cache/chat prompt, reflection, film tape, pattern logger and bagger moment must resolve the pinned model or render unavailable, and the research chart should draw the context's six targets rather than none. All are outside §6.
3. **Live qualification.** Provider timestamp latency and the presence of `price.timestamp` in EODHD real-time payloads (`decisionQuote` needs it), publication and close+15 behavior, the shared control document and epoch rollback, and the first production cron runs (crons do not run on preview).

## 9. Out-of-scope observations

- UNVERIFIED, code reading only: the evaluator's legacy `thresholdHistory.${symbol}` score-patch keys would split a `.CC` crypto symbol into a nested Firestore field path, while the legacy swap writer writes the whole map. This is pre-existing and unchanged here; it is worth a separate check against stored crypto battles.
- Default `npm run lint` (not the CI gate) still reports pre-existing repository debt. This takeover removed 12 of the 13 broad-lint errors the branch had introduced; the remaining one is the `react-refresh/only-export-components` rule on the branch's `export function enrichHeldPosition` in `AgentBattleScreen.jsx`, a dev-only Fast Refresh warning.
- `readCorrectedInputs` replays every receipt on each commit, several per tick (cost only).

Evidence lives outside the repository, in the session scratchpad and the downloadable handover named in the PR description: repro scripts and logs, lens and verifier reports, mutation JSON and the Linux logs.
