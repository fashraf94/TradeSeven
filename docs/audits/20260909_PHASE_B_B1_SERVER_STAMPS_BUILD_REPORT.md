# Phase B — B1 (server half) build report: the tick stamps, built dark

**Date:** September 9, 2026 · **Branch:** `claude/phase-b-server-tick-stamps-lo6jwb` (harness-assigned; recorded) off `origin/main` @ `4a8ae54a`.
**Scope (the session brief):** B1, server half only, per `docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md` §1.1–1.4, §1.6 and §3 — the flag, the Heard stamp, the lean evidence stamp, the candidates; the flag-off golden; the size row; the decider's whitelist pin; the mid-tick filing fixture. **No client or narrator rendering** (Sol's pass). B2 (§2) not this session.
**Basis:** the spec (committed here, byte-exact) and `docs/audits/20260908_PHASE_B_TICK_STAMPS_PHASE0_DISCOVERY.md` (cherry-picked here). Every `file:line` below was read at this branch's HEAD (`e1d19a42`) in this session (VERIFIED) unless marked ASSUMED.
**Review:** BUILD_RULES §2 mandatory (14 files / 2,709 lines at review time) — done; the adversarial multi-lens record is `docs/audits/20260909_PHASE_B_B1_SERVER_STAMPS_REVIEW.md` (same directory): 35 findings, 30 CONFIRMED · 4 PARTIAL · 1 REFUTED; 27 fixed or documented on the branch in `e1d19a42`, 8 recorded for the founder or separate tasking. Two HIGH findings, both fixed (§5.1–5.2).

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

| Item | Value |
|---|---|
| `git fetch origin` | **Run first.** Pulled 18 refs the container had never seen (`fix/*`, `flag/*`, `flip/*`, `ops/*`, `smoke/character-pane`, `ui-redesign`, `ui-redesign-backup`, tag `backup-with-research`). `origin/main` was already at `4a8ae54a`. |
| Branch / HEAD at open | `claude/phase-b-server-tick-stamps-lo6jwb` @ `4a8ae54a5f0d89915dbe15cee63d4b506e36bd7f` = `origin/main`; clean tree; the branch already existed on `origin` at the same SHA. |
| Docs commit 1 | `ba71ff6a` — `git cherry-pick 0cf2b886` from `origin/claude/phase-b-tick-stamps-phase0-04izpk` **succeeded** (one docs-only commit on top of `4a8ae54a`; no conflict; the fallback was not needed). The attached discovery report is **byte-identical** to the committed `docs/audits/20260908_PHASE_B_TICK_STAMPS_PHASE0_DISCOVERY.md` (`cmp` clean). That branch was **not merged**. |
| Docs commit 2 | `6c103868` — the attached spec committed **byte-exact** to `docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md` (`cmp` clean). |
| Build commits | `0bc604f1` (the build) · `b952f783` (the fail-safe) · `e1d19a42` (the §2 review fixes) · the record commit carrying this report and the review record. |
| Interim push | The branch was pushed once at `b952f783` (an interim push while the review ran, so the ephemeral container could not lose the work) and finally at the record commit. No PR opened; not watching CI. |
| Untouched, as briefed | `origin/claude/flat6-evaluation-rendering-1pouzh` (src/ only) and `origin/claude/phase-c-discovery-audit-xmiltc` (docs) — neither touched nor merged. No anchor this build cites moves under the flat6 branch (it edits `decisionRecord.js` / `voiceLayerGrounding.js` / `Flat6BattleView.jsx`; this build touches none). |
| Environment | The container carried no `node_modules`; `npm ci` installed 1,131 packages (28 s) before the first test run. No Firestore credentials (`GCS_CREDENTIALS` / `FIREBASE_*` unset) — every tick in the harness runs against the in-memory doc store; the shadow logger warns and no-ops. `rsync` absent — snapshots were `git archive` extractions. |
| Fence (BUILD_RULES §1) | **No fenced file edited** (`git diff --name-only origin/main..HEAD` carries none). Read to cite: `api/_utils/agentEvalPromptAssembly.js` (the resolveControls call at `:1229-1238`; `formatRecentEvals` `:1389-1402`; the render sites the evidence mirrors — `buildPortfolioCSV` `:1458-1487`, `buildBenchCSV` `:1492-1513`, `buildBenchTechnicalBlock` `:1535-1547`, `renderBenchRSLine` `:1664-1684`, `buildRegimeContext` `:1762-1774`, `buildRiskStatusBlock` `:1784-1804`, `buildMomentumSnapshot` `:1826-1863`), `api/_utils/agentScoring.js` (`:36-69`, `:224-300`), `api/_utils/agentRiskManager.js` (`:89-196`), `api/_utils/agentEvalToolSchema.js` (`:157-192`, fence-adjacent). Fenced exports **called**, never edited: `formatRecentEvals` (the whitelist pin's behavioral twin) and `flattenBenchServer` (already imported by the cron; now also the stamp's bench set). One fenced module is **doubled in one test file only** (`agent-evaluate.tickStamps.gates.test.js` mocks `buildLiveContextBlock` to throw) — a test double, not an edit. No new import entered a fenced assembler; the C-20 honesty registry is untouched. |
| Report copy | Both records were written to the session scratchpad first (byte-identical) and committed from there (§3). |

---

## 1. Executive verdict

| # | Item | Verdict | In one line |
|---|---|---|---|
| 1 | `TICK_STAMPS_ENABLED` | **BUILT — dark** | `false` at `src/config/featureFlags.js:2237` with docstring + flip map + `// Pinned by:` (`:2236`); `DARK_BY_DESIGN` entry `flagPinGuard.test.js:96`; the pin `tickStampsFlags.test.js:30`. Read at call time inside the stamp block's fail-safe (`agent-evaluate.js:2712`), a plain boolean; a bare-factory mock omitting the name THROWS under vitest, so every cron suite that mocks the flags spreads `importOriginal` (pinned by a scan). |
| 2 | Heard (D-110) | **BUILT** | The cron's own `resolveControls` call at `agent-evaluate.js:2722-2732` — the fenced argument list **byte for byte** (pinned, dedent-normalized) — on the in-memory `battle`; `deriveHeardStamp` → `{ directiveThreadId, suppressed }`; absent without a directive; `suppressed` ∈ `malformed` / `mode_not_enforce` / `epoch_killed` (the resolver's own words), each proved end to end; gated on **`promptBuilt`** — set after the prompt's three parts are built and immediately before the transport call (review A-4: `haikuAttempted` alone is set before the build). Never the model's echo. |
| 3 | The evidence (D-111) | **BUILT — lean, eight fields** | `composeEvidenceStamp`: per held position the values the prompt RENDERED for it — `px`, `chg` (the row's Gain% from entry), `atrX`, `vwapDev`, `bbPct`, `nr7`, `regime`, `risk` — at the renderer's own `toFixed(2)`; `risk.reason` only when non-HOLD; bench, story ids, `epsRev30d`/`sectorRs` cut; **`rsPct` NOT stamped** (the prompt renders it for bench names only — review A-2; §5.2). `composeVintages`: ONE block per entry — `quote:'tick'`, `vwap:'tick'`, **`techAt` an instant, `fundAsOf` a UTC date equal to the FUNDAMENTALS block's header (held + bench), `rankingsAt` an instant; no cadence word anywhere** ("weekly" by the founder's ruling, "daily" by review A-3). |
| 4 | The candidates (D-112) | **BUILT** | `composeCandidatesStamp`: the model's raw items admitted by the dispatch queue's own rule (an object with a truthy `symbol`), four fields plus `signalSource` when sent, `rationale` cut; `threshold` persisted — its render withholding stays D-103's (no renderer built here). Absent when none. Uncapped, as the queue is (§5.8). |
| 5 | Flag-off golden | **BYTE-IDENTICAL — the whole write** | The composed entry AND the entire finalUpdate (25 entry keys, 33 update keys) captured from the **pre-stamp** cron (`git show 4a8ae54a:api/cron/agent-evaluate.js` in a scratch tree) through the real `processAgentBattle` and verified there; identical after the splice and after the review's hoist (`agent-evaluate.tickStamps.flagOff.test.js`, hermetic explicit-false flag; the generating run fails on purpose and refuses CI). One byte changed in either stored copy → red (mutations M11a/b). Reviewer C re-derived the same golden independently by reverse-patching the diff. |
| 6 | Size row | **≤ 1.1 KB per entry** | Firestore-rule bytes (discovery §3 method) for seven held positions: heard + evidence + vintages = **922** on the real all-HOLD entry, **949** on the unit fixture (one LOCK reason) — ≤ 1,100 asserted on both; heard 47, evidence 769, vintages 109; one candidate 189–240 (≤ 300 asserted; ~1 KB/day by the fenced instruction's 1–3 per day — an entry carrying three would be ≈ 1.6 KB). Worst case (UUID thread, longest regime words, every risk non-HOLD) **1,166** — a 1,300 ceiling is asserted so a field addition cannot cross it silently. |
| 7 | The decider's whitelist | **PINNED** | `formatRecentEvals` reads exactly `decision, evalId, hypothesis, rationale, symbolIn, symbolOut, tier, timestamp` by dot access and no other way (`agentEvalPromptAssembly.js:1389-1402`); `battle.evaluations` reaches the fenced file through that one call (`:1279`) in no other form; behavioral twin: identical bytes with and without the stamps; `agentTriggerGate.js:22` reads `.length` only. A fenced twin reading `ev.heard` reddens the pin (M10, in a snapshot copy). |
| 8 | Mid-tick filing | **PROVED on the in-memory thread** | The fixture mutates **the doc**, not the object, inside the model call; the prompt carried the old directive; the stamp names the rendered thread; ZERO doc reads happen after the prompt is built (the read count at the model call equals the final count) — a re-read before the resolution reddens four rows (M2). A real autopilot SWAP tick proves the evidence is the pre-swap book while the doc carries the swap. |
| 9 | Fail-safe + prompt gate | **ADDED** (house precedent) | `try { if (TICK_STAMPS_ENABLED && promptBuilt) { … } } catch` (`agent-evaluate.js:2711-2759`): a composer fault OR a `resolveControls` fault at the stamp site logs loud and the entry goes out unstamped — the write is never lost; a prompt-builder throw stamps nothing (`agent-evaluate.tickStamps.gates.test.js`; M13, N8; review D-2 / A-4). |
| 10 | Tests | **76 new rows, 7 files; full suite green; build green** | `tickStamps.test.js` 37 · `flagOff` 4 · `flagOn` 16 · `gates` 3 · `modeNotEnforce` 1 · `pins` 11 · `tickStampsFlags` 4 (+ the `DARK_BY_DESIGN` entry). Full suite on the final tree: `Test Files 629 passed \| 3 skipped (632)` · `Tests 11224 passed \| 64 skipped (11288)` · **exit 0** (181 s). `vite build` ✓ exit 0 (41 s). ESLint clean on every new / changed file (the cron's five pre-existing errors are §6.1). |
| 11 | Mutation checks | **20 / 20 CAUGHT on the final tree** (13 originals re-anchored + 3 regression mutants for the review's fixes + Reviewer D's N7 / N8 / N23) | §4 — run in `git archive` snapshots, never the working tree; the fenced twin (M10) only ever in the snapshot copy. Reviewer D's 18 new mutations found the two gaps (N7, N8) that the fixes closed. |
| 12 | §2 review | **DONE — 35 findings · 30 CONFIRMED · 4 PARTIAL · 1 REFUTED · 27 fixed/documented in `e1d19a42`** | Four lenses (domain · wiring/persistence · dark contract/rules · test integrity) + three refuters; the split, every disposition and the post-fix re-checks are in `20260909_PHASE_B_B1_SERVER_STAMPS_REVIEW.md`. The dark-merge contract drew no finding. |
| 13 | Client + narrator | **NOT BUILT — by instruction** | Nothing under `src/` (except the flag files) or `voiceLayerGrounding.js` changed; the readers render on presence (spec §1.5) in Sol's pass. §8 lists what the server now guarantees them. |

**Founder decisions needed before the flip** are in §5 (eight items; none blocks the merge; each is one line to reverse).

---

## 2. Build map (HEAD `e1d19a42` anchors)

### 2.1 The flag — `src/config/featureFlags.js:2195-2237`
Docstring (what the three stamps are; FALSE at merge; the flip is the smoke because crons do not run on preview; read at call time inside the fail-safe; the true bare-factory rule; the flip map), `// Pinned by: tickStampsFlags.test.js` (`:2236`), `export const TICK_STAMPS_ENABLED = false;` (`:2237`). `flagPinGuard.test.js:96-97` — the `DARK_BY_DESIGN` note. `src/config/tickStampsFlags.test.js` — the dark pin (`:30`), the plain-boolean shape, the scan of every cron suite that imports `agent-evaluate.js` and mocks the flags (must spread `importOriginal`), the docstring pointer.

### 2.2 The composer — `api/_utils/tickStamps.js` (new; pure; ZERO imports; Node-clean)
| Export | Line | Contract |
|---|---|---|
| `TICK_STAMP_KEYS` | `:85` | `['heard','evidence','vintages','candidates']` |
| `EVIDENCE_FIELDS` | `:87` | `['px','chg','atrX','vwapDev','bbPct','nr7','regime','risk']` |
| `VINTAGE_FIELDS` | `:91` | `['quote','vwap','techAt','fundAsOf','rankingsAt']` |
| `CANDIDATE_FIELDS` | `:93` | `['symbol','direction','signalSummary','threshold','signalSource']` |
| `HEARD_SUPPRESSED_REASONS` | `:98` | the resolver's three directive reasons (asserted equal to `SUPPRESSION_REASONS`) |
| `round2` (private) | `:102` | `Number(v.toFixed(2)) \|\| 0` — the renderer's own primitive; negative zero folded |
| `deriveHeardStamp(resolution)` | `:128` | effective → `{ id, suppressed: null }`; 'directive' descriptor → `{ id, suppressed: reason }`; neither → `null` (key absent) |
| `composeEvidenceStamp({assetScores, prices, momentumData, stockRegimes, riskStatus})` | `:182` | iterates `assetScores` (the CSV's own rows — bench cannot enter); `risk` via `composeRisk` (`:150`) |
| `composeVintages({heldSymbols, benchAssets, rankingsMap, techScoresMap, rankingsComputedAtMs})` | `:242` | `techAt` = newest held tech `updatedAt`; `fundAsOf` = newest `fundamentals.computedAt` over held + non-crypto bench (the FUNDAMENTALS block's rule) as `YYYY-MM-DD` UTC; `rankingsAt` = the rankings doc's `computedAt` as ISO; nulls when absent |
| `composeCandidatesStamp(items)` | `:275` | the queue's admission rule; `signalSource` present only when a non-empty string; `null` when none |
| `composeTickStamps({promptBuilt, controlResolution, anticipationCandidates, assetScores, prices, momentumData, stockRegimes, riskStatus, benchAssets, rankingsComputedAtMs})` | `:317` | `{}` unless `promptBuilt === true` (`:329`); else `heard?` · `evidence` · `vintages` · `candidates?` in that order |

Sources per field — each the value a RENDERED line carried (the fenced render sites, read to cite): `px` ← `prices[sym].current` (`$Current`, `toFixed(2)`); `chg` ← `assetScores[i].priceChange` (`Gain%`, `formatPct` 2dp — the position's change from ENTRY); `atrX` ← `assetScores[i].multiplier` (`ATR Mult`, `toFixed(2)`); `vwapDev` ← `momentumData.vwap[sym].vwapDeviation` (INTRADAY MOMENTUM, `toFixed(2)`); `bbPct`/`nr7` ← `momentumData.rankings[sym]` (INTRADAY MOMENTUM); `regime` ← `stockRegimes[sym]` (STOCK REGIMES); `risk` ← `riskStatus[sym]` (RISK STATUS: `action`, `reason` code when non-HOLD — the prompt renders a LOCK's `detail` sentence, the stamp keeps the code; on an all-HOLD tick no block renders and HOLD is stamped by the block's absence).

### 2.3 The splice — `api/cron/agent-evaluate.js`
- `:79` — `TICK_STAMPS_ENABLED` joins the existing `featureFlags.js` named import (api → src, already guarded by `agent-evaluate.test.js`'s real-flags import).
- `:83-88` — `import { composeTickStamps } from '../_utils/tickStamps.js'`.
- `:1973` — `let promptBuilt = false;` beside `haikuAttempted` (which keeps its existing consumers: `totalHaikuCalls`, `lastEvalStartedAt`).
- `:2014-2020` — the prompt's three parts hoisted into consts in the request's order (`buildEvalSystemPrompt` → `buildAgentIdentityBlock` → `await buildLiveContextBlock`), then `promptBuilt = true;`, then `anthropic.messages.create(...)` receives them. Same builders, same argument lists, same order as when they sat inline in the request literal; a builder throw lands in the same catch as before with `promptBuilt` still false.
- `:2654-2693` — the composed entry (`const evaluation = {…}`), **unchanged** (the pre-Phase-B literal: 25 keys).
- `:2696-2759` — the stamp block: `try { if (TICK_STAMPS_ENABLED && promptBuilt) { … } } catch (stampErr) { … }` — the `resolveControls` call (`:2722-2732`, the fenced argument list), `rankingsComputedAtMs` from the tick's own `rankingsResult` snapshot (`:2734-2736`), `Object.assign(evaluation, composeTickStamps({… benchAssets: flattenBenchServer(battle.portfolio?.bench) …}))` (`:2737-2751`), the fail-safe (`:2753-2759`: logged loud, the entry goes out unstamped).
- `:2801` — `const evaluations = [...(battle.evaluations || []), evaluation].slice(-150)` (unchanged) → `:2893` `await battleRef.update(finalUpdate)` (unchanged). Keys on the entry only; **no top-level battle key**.
- Everything else in the cron is byte-identical to `origin/main` (the diff is the import lines, the `promptBuilt` declaration, the hoist and the block).

Drift from the discovery's anchors at this HEAD: the entry `:2629-2671` → `:2654-2693`; the write `:2805` → `:2893`; the Haiku gate `:1980` → `:1986`; the queue `:2055-2061` → `:2075-2081` (six import lines, the `promptBuilt` declaration and the hoist above; the block below).

### 2.4 The tests
| File | Rows | What it guards |
|---|---|---|
| `api/_utils/tickStamps.test.js` | 37 | the module surface (eight fields; `rsPct` pinned out); Heard via the REAL `resolveControls` (null / effective / the three suppressed words incl. the reachable non-string-id `'unknown'` / lean-only); evidence (held only, eight fields, the rendered sources incl. `chg` = Gain%, the `toFixed(2)` rows, null honesty, `risk.reason` rule, dedupe); vintages (`techAt`, `fundAsOf` held + non-crypto bench, never "weekly"/"daily", nulls, Timestamp-likes; **`fundAsOf` proved equal to the REAL `buildFundamentalsBlock` header date**); candidates (four + tag, omit-not-undefined, threshold persisted, null when none); `composeTickStamps` (the `promptBuilt` gate, order, presence, no `undefined`); the size rows (the discovery §3 rule; ≤ 1,100 / worst ≤ 1,300 / candidate ≤ 300; the table printed inside the row) |
| `api/cron/agent-evaluate.tickStamps.flagOff.test.js` | 4 | THE GOLDEN: the real cron, flag explicitly false, the entry AND the whole finalUpdate byte-identical to the pre-splice capture; 25 keys in source order; none of the four; `GENERATE_TICK_STAMPS_GOLDEN=1` writes and then FAILS on purpose (never green in the same run; refuses CI) |
| `api/cron/agent-evaluate.tickStamps.flagOn.test.js` | 16 | flag explicitly true, end to end: Heard (in-memory thread vs the echo; absent without a directive; absent on `budget_skipped` — every stamp; present on `timeout`; `epoch_killed`; `malformed` via a type-corrupt directive); THE MID-TICK FILING FIXTURE with zero reads after the prompt; evidence from the real sources (the fenced scorer's Gain% and multiple, the persisted VWAP table, rankings/tech docs, the real risk manager's `LOCK`); vintages; **a real autopilot SWAP tick (pre-swap evidence, the doc carries the swap, Heard unchanged)**; candidates + the dispatch queue; 25 + stamps in order, byte-identical prefix, the persisted store carries the stamped entry; no new top-level key; the size row on the real entry |
| `api/cron/agent-evaluate.tickStamps.gates.test.js` | 3 | the composer throws → unstamped write, lock released, logged; `resolveControls` throws AT THE STAMP SITE only → the same; `buildLiveContextBlock` throws → the model never called, the failure HOLD written, NO stamp (the `promptBuilt` gate) |
| `api/cron/agent-evaluate.tickStamps.modeNotEnforce.test.js` | 1 | `ARCHETYPE_INTEGRITY_MODE: 'observe'` end to end: the assembler withholds the directive, the stamp says `mode_not_enforce`, the prompt carries no directive block |
| `api/cron/agent-evaluate.tickStamps.pins.test.js` | 11 | the argument-list pin (dedent-normalized; the fenced block as the anti-vacuous golden; one call; both files bind the same names from the same modules); brace-matched containment of the gate inside the try with the catch directly after; `promptBuilt` declared, flipped once after the three builders and before the transport, the composer's argument list (never `haikuAttempted`); the no-re-read window (incl. `Object.assign(battle`, pinned at two in the file); `battle.directive` never assigned in any form; the whitelist (dot reads only; no bracket / destructuring / spread / whole-object; `battle.evaluations` in one form only; no `.heard` etc. access anywhere in the fenced file); the behavioral twin; the trigger gate `.length` |
| `src/config/tickStampsFlags.test.js` | 4 | the dark pin; plain boolean; the bare-factory scan of cron suites; the docstring pointer + flip map + the true rule |
| `api/_utils/__fixtures__/tickStampsHarness.js` | — | the end-to-end harness: frozen clock 2026-09-09 15:00Z; the seven-position book with a directive; quotes; rankings docs (bench AMD's fundamentals the newest) and technical docs (with `updatedAt`); five RTH candles; HOLD and SWAP model results; the mock db with a mutable doc store, deep-copied recorded writes, `undefined` rejection like the SDK, and read counts; the Firestore size rule; `undefinedPaths` |

---

## 3. What a decided entry now carries (flag ON)

```
{ …the 25 pre-Phase-B keys, byte-identical…,
  heard:      { directiveThreadId: 'thread-…', suppressed: null | 'malformed' | 'mode_not_enforce' | 'epoch_killed' },   // absent when no directive was active
  evidence:   { NVDA: { px: 123.6, chg: 2.57, atrX: 0.83, vwapDev: 0.95, bbPct: 15, nr7: true,
                        regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' } },
                TSLA: { …, risk: { action: 'HOLD' } }, …one record per held position, never a bench name },
  vintages:   { quote: 'tick', vwap: 'tick', techAt: '2026-09-09T14:29:55.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-09T14:30:00.000Z' },
  candidates: [ { symbol, direction, signalSummary, threshold, signalSource? } ] }                                          // absent when none
```
On a `budget_skipped` entry, and on an entry whose prompt build threw, none of the four keys exists (the prompt was never built). On a `timeout` / `truncated_response` entry `heard`, `evidence` and `vintages` exist and `candidates` does not (the prompt was built and sent; no decision).

---

## 4. Mutation checks (BUILD_RULES §2) — 20 / 20 CAUGHT on the final tree

Run in `git archive HEAD` snapshots under the session scratchpad, one file mutated at a time, restored from a pristine archive after each (the snapshot diffed byte-identical to the archive at the end; the working tree stayed clean throughout). The fenced twin (M10) was mutated **only in the snapshot copy** — the working tree's fenced file was never touched. The first run (13 mutants, pre-review) and Reviewer D's 18 new mutants are in the review record §4; this is the post-fix run.

| # | Defect introduced | Reddened |
|---|---|---|
| M1 | cron: the gate removed (`if (true)`) | golden bytes · 25-keys row · pins containment |
| M2 | cron: a doc re-read before the resolution | mid-tick fixture · SWAP row · the no-re-read window · pins containment |
| M3 | cron: the argument list drifts (`standingLeans: []`) | the argument-list pin · its anti-vacuous twin |
| M4 | module: the `promptBuilt` gate dropped | unit `promptBuilt false` row (the e2e budget_skipped rows stay green because the cron's own gate also holds — belt and braces) |
| M5 | module: `rationale` leaks into the candidates | 8 rows |
| M6 | module: `fund: 'weekly'` stamped | 7 rows |
| M7 | module: `risk.reason` on HOLD | the reason rule · the e2e sources row |
| M8 | module: `undefined` `signalSource` | 7 rows (incl. the mock write's own rejection) |
| M9 | module: a suppressed directive stamped as Heard | 8 rows (unit ×5, e2e `epoch_killed`, e2e `malformed`, `mode_not_enforce`) |
| M10 | fenced twin (snapshot only): `formatRecentEvals` reads `ev.heard` | the whitelist pin · the single-reader pin |
| M11a | golden: one byte of the stored ENTRY | the byte row · the anti-vacuous golden row |
| M11b | golden: one byte inside the stored finalUpdate (a statusFeed line) | the byte row |
| M12 | module: `fundAsOf` as epoch ms | 6 rows (incl. the header-agreement row) |
| M13 | cron: the fail-safe rethrows | both gates fail-safe rows |
| M14 | module: `chg` from the quote's session change (the pre-review defect) | 3 rows |
| M15 | module: `Math.round` rounding (the pre-review primitive) | the `toFixed` row |
| M16 | cron: `promptBuilt` set before the build (the pre-review gate) | pins ordering row · the gates prompt-build row |
| N7 | cron (D-1): the stamp block moved AFTER `battleRef.update(finalUpdate)` | 14 rows (the deep-copied recorded writes now see it) |
| N8 | cron (D-2): the try wraps only `Object.assign` | pins containment · the gates `resolveControls` row |
| N23 | cron (D-3): the gate hollowed, the block unconditional | pins containment · golden bytes · 25-keys row |

---

## 5. Build decisions for the founder (none blocks the merge; each is one line to reverse)

1. **`chg` is the ACTIVE POSITIONS row's Gain% from entry** (`assetScores[i].priceChange`), not the quote's session `changePercent` the discovery B8 named. Reviewer A (HIGH) and Reviewer C found — and two refuters confirmed on the whole rendered prompt — that the session change appears on no line naming a held symbol; the prompt renders it for bench rows and the macro header only. The spec's label ("what the decider saw") decided it; D-111 names the field, not its source. Reverse: one source line + four expectation values. Recorded so the client label says *since entry*, never *today*.
2. **`rsPct` is NOT stamped — eight fields, not nine.** `rsPercentile` renders only in BENCH TECHNICAL CONTEXT (`buildBenchTechnicalBlock` iterates the bench); a held name's technical read reaches the decider as the `regime` word, which is stamped. Stamping it would be exactly the "never stamp what the decider did not see" hazard the spec names for ARCH score and `thresholdProximity`. Deviation from the ruled nine names — a D-111 amendment. Reverse: one line + the field list. (Separate tasking: the fenced system prompt tells the model it "can see … rsPercentile" for ACTIVE HOLDINGS — `agentEvalPromptAssembly.js:493`, `:696` — which the live block never renders for held names.)
3. **`techAt` (an instant) replaces `tech: 'daily'`.** `stockTechnicalScores` is rewritten hourly during RTH by `compute-index-intelligence?mode=intraday` in the same batch as `stockRankings.computedAt` (`vercel.json` `0 14-20 * * 1-5`), so "daily" is the same class of unsupported cadence word the brief struck for "weekly". `techAt` is the newest held technical doc's `updatedAt` — the cron already holds `doc.data()`, no new I/O. Reverse: two lines.
4. **`fundAsOf` = the FUNDAMENTALS block's header date — the newest vintage across HELD + NON-CRYPTO BENCH**, proved equal to the real `buildFundamentalsBlock` header by construction (§9). The spec's "held" wording disagreed with the rendered header on a mixed-vintage tick (review A-6). The cron passes `flattenBenchServer(battle.portfolio?.bench)`. Reverse: drop the bench argument. `fundAsOf` still describes no stamped fundamentals number (they were cut by ruling) — it records the vintage of the FUNDAMENTALS block the decider saw, so a reader can compare it with the cache's.
5. **The gate is `promptBuilt`, not `haikuAttempted`.** `haikuAttempted` is set before the prompt is built; a builder throw (caught by the same try as a Haiku failure) would have stamped Heard + evidence on a tick whose prompt never existed — reproduced by two refuters, once through a natural production fault (a `trades[]` record with `lockedPoints: null`). `promptBuilt` flips after the three prompt parts are built and immediately before `messages.create`. The spec §1.2 / D-110 wording ("gated on `haikuAttempted`") needs the one-word amendment ("gated on the prompt having been built and handed to the transport"). `haikuAttempted` is untouched for its existing consumers.
6. **The evidence and vintages share Heard's gate** — the build decision the brief did not rule. Reviewer A's verdict for the founder: endorse. The label is the claim ("what the decider saw at the {slot} check"); on a `budget_skipped` tick `buildLiveContextBlock` never ran, so evidence there would be a claim about a prompt that never existed; every reader is presence-gated (§1.5), so such an entry stays on today's D-65/D-69 absence lines; "engine facts on every entry" is a different product claim that would need its own label (and would invite the narrator to reason from numbers the decider never saw — Sol's target 2). **If the founder prefers the spec's letter**, the change is one condition (`tickStamps.js:329`) and the cron gate, plus two test rows.
7. **The fail-safe** (`try/catch` around the whole block, the flag read inside it) is not in the spec; it is the house pattern for additive stamps (`regimeAtStart`, the control-epoch telemetry). Proved: a composer fault, or a `resolveControls` fault at the stamp site, costs the tick nothing but the stamps. Note (V2/V3): even without it the outer catch releases the eval lock — what would be lost is the finalUpdate (scores, the entry, the counters).
8. **`candidates` is uncapped** in count and string length (the tool schema has no `maxItems`; the dispatch queue is equally uncapped; the fenced instruction expects 1–3 per day). A cap (e.g. the first five) would be a spec-level rule under D-112; not built. Twenty verbose items would be ≈ 17 KB on one entry (Reviewer B's ceiling).
9. **Ledger rows D-110 → D-115 are NOT appended.** Spec §6 says *append after D-109*; the ledger's D-106 → D-109 rows sit in `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_3.md:180-183` (appended with that spec's commit, `dfec828d`). The brief fixed the docs work at two commits, so the append was left for the founder's call — one table paste, and a spec V1.1 errata line with it (§6.2).

---

## 6. Found outside the task (BUILD_RULES §3 — for separate tasking, not fixed)

1. **`api/cron/agent-evaluate.js` fails `npm run lint` on `origin/main` already** — five errors identical before and after this change (line-shifted): an unused import `getPresetAdjustedStrategies` (`:54`), `process` undefined (`:154`, `:177` here), two unused `_e` catch bindings (`:1079`, `:1910`). Cause: `eslint.config.js` declares `globals.browser` only, so every `api/` file that names `process` or `Buffer` fails lint; CI runs `npm run test:run`, not lint (`.github/workflows/`). The new files were written lint-clean under that config (`globalThis.process`, `TextEncoder`).
2. **Spec V1.1 errata** (review C-4 + the fixes): §1.3 `fund:'weekly'` → the ruled shape (`fundAsOf` a date; `techAt` an instant; no cadence word); §1.3 nine fields → eight (`rsPct` cut) and `chg` = Gain% from entry; §1.2 "67 bytes" → 47–74 by thread-id length, and "gated on `haikuAttempted`" → "gated on the prompt having been built"; §1.4 "beside `hypothesis`" → trailing keys after `haikuError`. The spec text was committed byte-exact as instructed and still shows the old wording; the D-110 → D-115 ledger append (§5.9) is the natural place for the errata.
3. **Discovery hazard 20 is moot** (review C-7, REFUTED by V2 after Reviewer B's read): `runShadowTickCapture`'s envelope never carries the evaluation entry (`resolveTerminalGate` reads two fields), so the stamps do not enlarge the shadow capture. The discovery's `:389` should say so.
4. **A phantom CSV row on risk-swap ticks** (review A-11, reproduced live by V1): `assetScores` is a `const` computed before the risk layer and never recomputed, so after a risk swap the decider's ACTIVE POSITIONS CSV renders the swapped-OUT symbol (sector/tier falling back to `Unknown`/`support`) and no row for the swapped-in holding. Pre-existing fenced behaviour; the stamp mirrors the render ("stamped set = rendered set" is the honest label).
5. **The fenced system prompt's rsPercentile / WARNING claims** (reviews A-2, V1): it tells the model it "can see … rsPercentile" for ACTIVE HOLDINGS (rendered for bench names only) and names a "WARNING risk status" the risk manager never produces (`agentEvalPromptAssembly.js:493`, `:696`). Fenced prose.
6. **`cronState.totalHaikuCalls` counts a prompt-build throw as an attempt** (V1): the counter keys on `haikuAttempted`, which is set before the build.
7. **`marketDataCache.js:598` materialises `change_p \|\| 0`** (review A-12), so a missing daily change reads as a flat session downstream (moot for the stamp after §5.1, since `chg` no longer reads it).
8. **The L1 learning capture logs an error on a SWAP tick against a minimal db double** (`db.collection(...).doc(...).collection is not a function`, swallowed) — the mock's gap, not production's; noted so the SWAP row's console noise is understood.

---

## 7. Verification of record

| Check | Result |
|---|---|
| The seven new suites (76 rows) | green — re-run after every edit; `agent-evaluate.test.js`, `controlPromptRenderer.test.js`, `agentEvalPromptAssembly.honesty.test.js`, `flagPinGuard.test.js` green alongside |
| Full suite (final tree, `e1d19a42`) | `Test Files 629 passed \| 3 skipped (632)` · `Tests 11224 passed \| 64 skipped (11288)` · **exit 0** (181.4 s); the exit code asserted and the `Test Files` line read from the log. (The pre-review tree ran `627 \| 3 (630)` · `11213 \| 64 (11277)`, exit 0.) |
| `vite build` (final tree) | ✓ built in 41.41 s · **exit 0** (the chunk-size warnings are pre-existing) |
| ESLint | clean on all 12 new / changed files under the repo config; the cron's five pre-existing errors unchanged (§6.1) |
| Mutation checks | 20 / 20 CAUGHT on the final tree (§4); 13 / 13 pre-review; Reviewer D's 18 (16 caught, 2 gaps → fixed) |
| §2 review | 35 findings · 30 CONFIRMED · 4 PARTIAL · 1 REFUTED · 27 fixed / documented in `e1d19a42` · 8 recorded (`20260909_PHASE_B_B1_SERVER_STAMPS_REVIEW.md`) |
| Commits on the branch | `ba71ff6a` · `6c103868` · `0bc604f1` · `b952f783` · `e1d19a42` · the record commit |

---

## 8. For Sol's pass — what the server now guarantees the readers

- **Presence, not the flag:** a reader never imports `TICK_STAMPS_ENABLED`; it renders when `evaluation.heard` / `.evidence` / `.vintages` / `.candidates` exist. Pre-flip entries, every `budget_skipped` entry and any entry whose prompt build threw carry none of them; `evidence` and `vintages` are all-or-nothing with each other.
- **Heard's one claim:** `heard.directiveThreadId` with `suppressed === null` = *this thread was in the decider's prompt at this check*. `suppressed` non-null = a directive existed but the assembler withheld it — **not Heard**; the card must not say so (whether it says *why not* is Sol's §7.1 question; the three words are `malformed`, `mode_not_enforce`, `epoch_killed`; a type-corrupt id reads `'unknown'`). The slot is the entry's `timestamp` through the shared D-83 formatter, never the minute. `deriveHeard(evaluations)`: last entry wins per thread.
- **The mid-tick case:** a filing that lands during a tick is stamped on the NEXT decided entry, not this one — the receipt for the newer thread appears one check later; the older thread keeps its last Heard as a past fact.
- **The evidence's label:** *what the decider saw at the {slot} check* — the numbers the prompt RENDERED for the held name: `px` (price), `chg` (the row's gain **since entry**, not today's move), `atrX` (the ATR multiple the row carried), `vwapDev`, `bbPct`, `nr7`, `regime`, `risk` (the risk manager's verdict; `reason` only when non-HOLD; for a LOCK the prompt showed a sentence, the stamp keeps the code). No `rsPct`. Absent metrics are `null`, never 0 — render nothing, never a placeholder number.
- **The vintages:** one block per entry; `fundAsOf` is a date (say *as of {date}* — it is the FUNDAMENTALS block's own header date), `techAt` and `rankingsAt` are instants (the technical docs and the rankings doc the tick read — the same hourly run); `quote`/`vwap` are this tick's.
- **The candidates:** `threshold` is persisted and **never rendered in the narrator's voice** (D-103 — `voiceLayerAnticipation.js:118-120`); `signalSummary` only through the lint-checked composer; Bench renders the fact of the flag (`direction === 'potential_entry'` ∩ the roster), keyed by the entry's slot.
- **The flip** (`featureFlags.js:2237`) is the founder's own PR after B1 merges: move the pin (`tickStampsFlags.test.js:30`), drop the `DARK_BY_DESIGN` entry (`flagPinGuard.test.js:96`); the hermetic cron suites do not move (Reviewer C simulated the flip: exactly those three rows redden). Crons do not run on preview — the first stamped production check is the smoke: a decided entry carrying `heard` / `evidence` / `vintages`, and the battle document's size against the discovery §3 arithmetic (~+0.9–1.0 KB per entry; the shadow capture is unaffected, §6.3).

---

## 9. STOP

B1 server half complete and pushed. No client or narrator rendering; no B2; no fenced edit; no PR opened; not watching CI (BUILD_RULES §2 — the founder reads CI, decides, merges).

*Three facts on every check's record, written by the hand that writes the record — and, while the flag is off, not one byte of that write has moved.*
