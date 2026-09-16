# Build — The threshold lint: no promise on a signal the tick did not hold

**Fence line, first (confirmed at THIS HEAD):** every file this build edits is **outside** the BUILD_RULES §1 fence. Checked mechanically against §1's own bullet list at `docs/BUILD_RULES.md`: `api/cron/agent-evaluate.js`, `api/_utils/anticipationThresholdLint.js` (new), `api/_utils/voiceLayerPrompt.js`, `api/_utils/agentEvalToolSchema.js`, `api/cron/compute-index-intelligence.js`, `api/cron/voice-layer-cache.js` and `src/config/featureFlags.js` — **none fenced**. `api/_utils/tickStamps.js` is not fenced either and is **not edited at all**. `api/_utils/agentEvalPromptAssembly.js` **is** fenced: it was **READ** (to cite renderers and to re-assert the C-20 VWAP pin) and **CALLED** in tests, **never edited** — its copy of the threshold example at `:501` (and `:704`, the standard variant, found at this HEAD) is listed in §7 for the fenced follow-up and pinned as still-present.

**Date:** 2026-09-16 · **Branch:** `claude/threshold-lint-4pwvm4`, cut from `origin/main` at HEAD
**HEAD at cut:** `dcb08ea1ace9174551f0580002ac7a15402cc5ae` (merge of PR #854) · **Tree at open:** clean
**Branch HEAD at report:** `bb4caa0d46d24a674ad89e8c596bf804f606f9fe`
**Preamble (BUILD_RULES §3):** `git fetch origin` was the first step of the session; `origin/main` moved `398c528e → dcb08ea1`, and the local branch was already at that fetched ref (`git rev-list --left-right --count origin/main...HEAD` → `0 0`). The container is a **shallow clone** and was **not** unshallowed; every commit this build needed (`70ba90a1`, `origin/claude/phase0-signal-language`) was already reachable. No Firestore read or write, no EODHD call, no network beyond git and `npm ci`.
**Markers:** every codebase claim below carries `file:line` at the **branch HEAD** and is **VERIFIED** (read at that line in this session) unless marked ASSUMED.

---

## 1. Executive verdict

| | |
|---|---|
| **What shipped** | A lint that rejects an agent's "I'll act if X" promise when X is a signal that check did not hold — **dark**, then measured in **shadow**, then enforced **on**. Plus the removal of a persisted `rsPercentile: 50` placeholder and two prompt sentences that described states the platform no longer produces. |
| **Flag** | `ANTICIPATION_THRESHOLD_LINT_MODE` — a string tri-state `'off' \| 'shadow' \| 'on'`, **shipped `'off'`**. Pinned directly (`src/config/anticipationThresholdLintFlags.test.js`), noted in `flagPinGuard.test.js`'s `DARK_BY_DESIGN` block. |
| **Fence contact** | **None shipped** — no fenced file edited, and `tickStamps.js` carries a comment-only correction (zero behaviour). **But one prescribed edit was HELD OUT because it *is* fence contact**: the brief's `?? null` on the game-mode fit inputs moves `baggerBombFit`, which the §1-fenced `agentPromptAssembly` renders as the agent's `BB_FIT` menu column and the §1-fenced `archetypeScoring` folds into its rankings. **§5.2 — needs a founder ruling.** |
| **Invariant held** | An accepted threshold is **byte-identical** to what the decider wrote. This build **rejects; it never rewrites.** Pinned by row B-2 in all three modes, and shown failing under a "rewrite to remove the absent clause" mutant. |
| **Disclosed behaviour change** | Commit C changes what the decider is **shown**: a bench stock with no relative-strength reading is no longer shown a fabricated median, in either RS field. **No score, rank, menu or fit moves** — `baggerBombFit` is bit-for-bit what it was before this branch (§5.2). |
| **Verification** | Full suite **exit 0** (13,028 passed / 64 skipped / 684 files) · `npm run lint:gate` **exit 0** · `vite build` **exit 0**. |
| **Review** | BUILD_RULES §2 threshold exceeded — run and recorded in §5: 4 lenses + a refuter each + a mutating lens last, on isolated `git archive` trees. **19 findings: 3 refuted outright (2 of them reverting changes this build had already made), 1 escalated to fence contact, 6 holes found in the build's own tests and closed.** |
| **Status** | Pushed. No PR, no merge. **STOP.** |

**Commits, in order**

| | SHA | What |
|---|---|---|
| 0 | `7acb051e` | Phase 0 report, cherry-picked from `claude/phase0-signal-language` (`abb30fe3`) — one file, 292 lines |
| A | `14662e1e` | The pure module + its tests |
| B | `5929d5c2` | The flag + the two cron call sites + the cron tests + three pin reconciliations |
| C | `e83e64a3` | `rsPercentile ?? 50` → `?? null` (disclosed) + its tests |
| D | `bb4caa0d` | Two non-fenced copy corrections + pin and goldens reconciliation + its tests |
| — | `32b54f1c` | The build report (§5 pending) |
| R1 | `03147dcc` | Review fixes — the vocabulary hardening, the gates, the symbol normalisation |
| R2 | `8ef7fe6b` | Refutation outcomes — two reverts, the fence contact held out |
| R3 | *(this commit)* | Mutation-lens fixes — two tautologies replaced, six coverage holes closed, the byte arithmetic corrected, §5 written |

**Diff stat (cumulative, `git diff --stat origin/main...HEAD`)**

```
 api/_utils/__fixtures__/voiceGroundingOffGoldens.json     |  16 +-
 api/_utils/agentEvalToolSchema.js                         |   2 +-
 api/_utils/anticipationThresholdLint.js                   | 286 ++++++++++++
 api/_utils/anticipationThresholdLint.test.js              | 376 +++++++++++++++
 api/_utils/thresholdLintCopy.test.js                      |  99 ++++
 api/_utils/voiceLayerPrompt.grounding.goldens.test.js     |  26 +-
 api/_utils/voiceLayerPrompt.js                            |   2 +-
 api/_utils/voiceLayerPrompt.test.js                       |  23 +-
 api/cron/agent-evaluate.js                                |  96 +++-
 api/cron/agent-evaluate.thresholdLint.test.js             | 374 ++++++++++++++
 api/cron/agent-evaluate.tickStamps.pins.test.js           |  14 +-
 api/cron/compute-index-intelligence.js                    |  37 +-
 api/cron/compute-index-intelligence.rsPercentileNull.test.js | 237 +++++++++
 api/cron/voice-layer-cache.js                             |   7 +-
 docs/audits/20260915_PHASE0_SIGNAL_LANGUAGE.md            | 292 ++++++++++++
 src/config/anticipationThresholdLintFlags.test.js         |  73 +++
 src/config/featureFlags.js                                |  40 +++
 src/config/flagPinGuard.test.js                           |  14 +
 18 files changed, 1986 insertions(+), 28 deletions(-)
```

Six of those are production code (`anticipationThresholdLint.js`, `agent-evaluate.js`, `compute-index-intelligence.js`, `voice-layer-cache.js`, `voiceLayerPrompt.js`, `agentEvalToolSchema.js`), one is the flag module, one is a golden fixture, one is the inherited Phase 0 report, and nine are tests.

---

## 2. The defect, and what the lint answers

Phase 0 §5. Of the four thresholds the Sep 14 agent wrote, **two cite a signal it was not shown** on the book as the brief pins it — QCOM on the bench, CRWD held:

> A correction to §5's own headline, found by the review. §5 says *"three of the four"*, but that count comes from reading threshold #1 as a **held** name. §5 is internally inconsistent about QCOM's class: reading #2 calls it *"a held name"* while reading #3 says *"RVOL observable only if QCOM was on the bench"* — same symbol, same tick, opposite classes, and neither is marked VERIFIED or ASSUMED. The brief resolves it explicitly (*"QCOM bench, CRWD held after the swap"*) and prescribes the three verdicts the tests assert, so this build follows the brief. On the **held** reading the count is three, and the suite covers that reading too (the class-asymmetry row: the same sentence against CRWD → `absent: ['VWAP', 'RSI']`). The four rows below are the bench reading.


| # | The threshold (Phase 0 §5, verbatim) | Symbol class | Verdict |
|---|---|---|---|
| 1 | *"holds above the daily VWAP and the RSI pulls back below 75, I'd consider rotating it into Core"* | QCOM, **bench** | `absent: ['VWAP']` — the intraday fetch is held-only, so a bench name never has a VWAP reading. RSI **is** rendered for bench. |
| 2 | *"QCOM holds above the daily VWAP and the 5-minute MACD shows a positive histogram signal (S12), and RSI pulls back below 75 (S10)"* | QCOM, **bench** | `absent: ['VWAP', 'MACD_5M', 'MACD_HISTOGRAM']` — the 5-minute MACD and the histogram *value* are two different absences, and the sentence names both. (The brief prescribed two; the third is the review's `MACD_HISTOGRAM` split — §6 D-6.) |
| 3 | *"QCOM breaks above 181.62 resistance and RVOL sustains above 1.2x"* | QCOM, **bench** | `ok` — levels and RVOL are both rendered for bench. |
| 4 | *"CRWD falls below -0.5x ATR (approximately -$118.72)"* | CRWD, **held** | `ok` — the ATR Mult column is on every held row. |

And the same RSI sentence against a **held** symbol → `absent: ['RSI']`: `techScoresMap` is consumed only by the bench block, so the agent has no RSI for the names it holds (`agentEvalPromptAssembly.js:1535-1547`, `:1606-1628` — VERIFIED, read-only).

Daily VWAP is computed and then **discarded by the freshness gate** on every check since 2026-06-12 (`agent-evaluate.js:978-980` calling `isVwapSessionUsable`, `agentVwapFloor.js:36-38` — VERIFIED). The prompt itself put two of the three names in the agent's mouth through the equipped Forge rules, and the anticipation guidance forbids inventing indicators for `signalSummary` while saying only *"Must be specific"* for `threshold`.

**What the player sees:** *"I'll act if X"*, with no way to learn that X was never watched. The threshold is persisted twice, re-read by nothing, and voiced by Gemma under the shipping `'shadow'` grounding mode.

---

## 3. The changes, commit by commit, with `file:line` after

### Commit A — the module (`14662e1e`)

`api/_utils/anticipationThresholdLint.js` — pure, **zero-import**, Node-clean (the `agentVwapFloor.js` pattern). 286 lines.

| Export | Line | What |
|---|---|---|
| `SIGNAL_NAMES` | `:31` | Every name the module can put in a `present` set or an `absent` list, frozen. |
| `NEVER_PRESENT_SIGNALS` | `:62` | `['MACD_5M', 'RSI_5M', 'VWAP_5M', 'SMA_20_LEVEL']` — never present for any symbol under any input. |
| `THRESHOLD_SIGNAL_VOCABULARY` | `:94` | The table, as a data constant so this report can list it. |
| `buildPresentSignals(...)` | `:171` | `Map<symbol, Set<signalName>>` from the in-memory tick objects. |
| `namedSignals(threshold, vocabulary?)` | `:237` | Every signal the sentence names, declaration order, deduped. |
| `lintThreshold({ threshold, symbol, present, vocabulary? })` | `:280` | `{ ok: true }` or `{ ok: false, absent: [...] }`. |

**The present-signals rules, following Phase 0 §5's table exactly** (`:171-227`):

*Held* — `ATR` always (the ACTIVE POSITIONS CSV's ATR Mult / ATR% cells are unconditional); `VWAP` iff `momentumData.vwap[sym]?.vwapDeviation != null` (the same `!= null` the momentum snapshot renders on); `BB_WIDTH` iff the rankings row carries `bBandwidthPercentile`; `NR7` iff the row carries `nr7Flag` (**`false` is a reading** — "no contraction today" — which is why the evidence stamp records it as `false` rather than null); `LEVELS` iff the row has a `levels` object; `REGIME` iff `momentumData.regimes[sym]` is a non-empty string. **Never** `RSI`, `MACD_CROSS`, `RVOL`, `BB_PCT_B`, `RS_PERCENTILE`.

*Bench* — `RSI` iff `factors.rsi != null`; `MACD_CROSS` iff `factors.macdAboveSignal != null`; `BB_PCT_B` iff `tech.bbPercentB != null`; `RVOL` iff `tech.volumeProfile?.ratio != null`; `RS_PERCENTILE` iff `factors.rsPercentile != null`; `LEVELS` iff the rankings row has `levels`. **Never** `VWAP` (the intraday fetch is `fetchIntradayBatch(portfolioSymbols, …)`, held-only — `agent-evaluate.js:947`), and never `ATR` (that cell is a held-row cell).

A symbol in **both** lists is treated as held. A symbol the tick rendered nothing for gets an empty set, so every named signal in its threshold is absent — the honest read.

**The vocabulary table as shipped** (`:94-105`) — declaration order is the order `absent` is emitted in:

| # | Signal | Pattern | Match order |
|---|---|---|---|
| 1 | `VWAP` | `/\bVWAP\b/gi` | 1 |
| 2 | `MACD_5M` | `/5[- ]?min(ute)?\s+MACD\|MACD\s+histogram/gi` | **0** |
| 3 | `RSI_5M` | `/5[- ]?min(ute)?\s+RSI/gi` | **0** |
| 4 | `VWAP_5M` | `/5[- ]?min(ute)?\s+VWAP/gi` | **0** |
| 5 | `RVOL` | `/\bRVOL\b\|relative volume\|volume ratio/gi` | 1 |
| 6 | `RSI` | `/\bRSI\b/gi` | 1 |
| 7 | `SMA_20_LEVEL` | `/\b(the )?20[- ]day\b/gi` | 1 |
| 8 | `MACD_CROSS` | `/\bMACD\b/gi` | 1 |
| 9 | `BB_PCT_B` | `/%B\|percent B/gi` | 1 |
| 10 | `RS_PERCENTILE` | `/rsPercentile\|relative strength percentile/gi` | 1 |

**Two orderings ride one table, deliberately** (`:107-127`). **Declaration** order is the brief's listing order and the order `absent` comes out in, so the shipped table and this report read the same way. **Match** order is `matchFirst` ascending: the three 5-minute rows match first and **consume** the spans they matched (blanked to equal-length spaces, so later rows still see a correctly-shaped string), which is how the brief's *"(not 5-minute)"* qualifier on `MACD_CROSS` is encoded — as precedence, rather than as a negative lookaround repeated on every general row. Declaring the table in the brief's order and matching the specific rows first is the one place the shipped table's shape differs from a literal reading of the brief; see **D-3** in §6.

**Signals the table does not name — ATR multiples, a named resistance level, the regime, NR7, BB width — are accepted by omission.** No row claims them, so no mention of them can land in `absent`. That is what makes fixtures 3 and 4 green.

### Commit B — the flag and the two call sites (`5929d5c2`)

**The flag** — `src/config/featureFlags.js:2429` (`ANTICIPATION_THRESHOLD_LINT_MODE = 'off'`) and `:2432` (`ANTICIPATION_THRESHOLD_LINT_MODES`, frozen). Docstring at `:2394-2428` carries the walk, the flip map and the `// Pinned by:` pointer.

**The splice** — `api/cron/agent-evaluate.js`:

| Site | Line | What |
|---|---|---|
| flag import | `:79` | added to the existing `featureFlags.js` import, beside `TICK_STAMPS_ENABLED` |
| module import | `:96` | `import { buildPresentSignals, lintThreshold } from '../_utils/anticipationThresholdLint.js'` |
| the gate | `:2188-2189` | `lintEnforcing = MODE === 'on'`; `lintActive = lintEnforcing \|\| MODE === 'shadow'` — an unknown mode is **inactive**, the only state that changes nothing |
| the linted array | `:2190` | `let lintedAnticipationCandidates = haikuResult?.anticipationCandidates` — at `'off'` **the same reference**, so both sites are byte-identical |
| the map, once per tick | `:2192-2198` | from `momentumData`, `technicalScoresMap`, `momentumData.rankingsMap`, `assetScores.map(s => s.symbol)` and `flattenBenchServer(battle.portfolio?.bench).map(a => a.symbol)` — the same objects the prompt was built from, and the same bench expression the stamp itself uses at `:2850` |
| the breadcrumb | `:2216-2235` | `logAnticipation` with `errorStep: 'threshold_absent_signal'`, the `absent` list, `errorReason: 'absent_VWAP+MACD_5M'`, `lintMode`, `dropped`, and the four-field candidate — the `grounding_dedupe` (`voiceLayerAnticipation.js:80-92`) / `cron_budget_skip` (`agent-evaluate.js:3084` pre-change) shape |
| **site 1** — the queue | `:2249-2255` | iterates `lintedAnticipationCandidates` instead of `haikuResult.anticipationCandidates`; the admission rule (`object && symbol`) is unchanged |
| **site 2** — the stamp | `:2921` | `anticipationCandidates: lintedAnticipationCandidates` |

Items both sites already drop (not an object, or no `symbol`) pass through the lint untouched — the lint adds no admission rule of its own. The `heard`/`saw` verbs are untouched; a dropped candidate is simply not a fact on the record.

**Pins reconciled in the same commit (BUILD_RULES §2):**

- `src/config/anticipationThresholdLintFlags.test.js` — the direct pin. `VOICE_GROUNDING_MODE` (`voiceGroundingFlags.test.js:54`) / `MANDATE_TRANSPORT_MODE` (`mandateFlags.test.js:44`) are the precedent: a string tri-state is invisible to `flagPinGuard`'s `*_ENABLED` scan, and its `DARK_BY_DESIGN` integrity test rejects a non-boolean key, so the flag is pinned **here** and **noted** there.
- `src/config/flagPinGuard.test.js` — the `DARK_BY_DESIGN` runway note (a comment, not a key; the new suite asserts both that the name is not a key and that the note is present).
- `api/cron/agent-evaluate.tickStamps.pins.test.js` — the argument-list pin named `anticipationCandidates: haikuResult?.anticipationCandidates`; it now names `lintedAnticipationCandidates` **and** binds it to the decider's own output in the same source window, so the pin keeps its meaning rather than merely moving.

### Commit C — the placeholder (`e83e64a3`) — **DISCLOSED**

| Site | Line | Before → after |
|---|---|---|
| the reading | `compute-index-intelligence.js:1013` | `rsPercentileMap[d.sym] ?? 50` → `?? null` |
| the **scoring input** | `:1038` | `rsPercentile,` → `rsPercentile: rsPercentile ?? 50,` (explicitly split out) |
| the published factor | `:1123` | `factors: { ...scoreResult.factors, rsPercentile }` after the `...scoreResult` spread |
| game-mode fit | `:1327-1328` | `?? 50` → `?? null` on `rsVsSpy` and `sectorRS` |
| the last reader | `voice-layer-cache.js:607` | `factors.rsPercentile ?? 50` → `?? null` |

`rs20.percentile` follows the same local (`:1084` pre-change / the same expression post-change); it has **no reader anywhere in the tree** (grep over `api/` and `src/` for `rs20`, VERIFIED).

### Commit D — two non-fenced copy corrections (`bb4caa0d`)

- `api/_utils/voiceLayerPrompt.js:1888`, `DATA_CONFIDENCE_RULE` — dropped *"— typically today during market hours, or the prior session when EODHD's data hasn't refreshed"*; the sentence now reads *"Intraday signals (session VWAP, 5-min SMA20) describe the current trading session."* Since the June 12 gate a prior session is never **published** — the entry is discarded, not carried — so the clause described a state the gate abolished, and told Gemma to be comfortable narrating one.
- `api/_utils/agentEvalToolSchema.js:180`, the `threshold` field's own example — *"If it holds above the 20-day on the next test"* → *"If it holds above +0.5x ATR through the next check."* The 20-day is rendered as a **level** for no symbol class (the bench trend line carries short/intermediate/long labels and `sma200_position` only). The schema was teaching the decider to promise on a signal it cannot see — and the lint this arc ships would then reject the model for doing exactly what the schema asked. *"Must be specific"* and the too-vague counter-example both survive, plus a new *"built on something you were shown this check."*

**Not edited:** the fenced twin at `agentEvalPromptAssembly.js:501` and `:704`. Row D-1c pins it as still present in **both** variants, so the follow-up cannot be quietly forgotten.

**Pins and goldens reconciled in the same commit:** `voiceLayerPrompt.test.js:3107` (now asserts both halves — the current-session claim present, the abolished one absent) and `__fixtures__/voiceGroundingOffGoldens.json`. The goldens are the voice-layer grounding arc's **dark contract** (its `'off'`/`'shadow'` bytes, captured at `70ba90a1`), and they pin `DATA_CONFIDENCE_RULE`. The corrected sentence was applied **in place** as a literal substring replacement — **8 of the 16 captured prompts** carry the rule, **8 changed, −784 bytes = 8 × 98**, nothing else in the file moved (the per-site delta is 96 *characters* but 98 *bytes* — the em-dash is 3 UTF-8 bytes; commit `bb4caa0d`'s message and the test header both published −768 = 8 × 96, conflating the two, and the header is corrected — the proof was sound, the number was not) (verified by parsing both versions and asserting `before[k].replace(old, new) === after[k]` for every changed key and equality for every other key). A whole-file regeneration from this tree would have re-baselined that contract onto whatever the grounded module renders — which the file's own header explicitly forbids — so it was **not** done. The provenance and the arithmetic are written into the goldens test's header and its `describe` title.

---

## 4. Tests — every guard shown failing under its defect

Nine test files, **1,159 new test lines**. Every row below was run at the branch HEAD and again against the pre-change source; the "shown failing" column is a real observed run, not a claim.

| Row | File | Green | Shown failing against | Result |
|---|---|---|---|---|
| **A-1** | `api/_utils/anticipationThresholdLint.test.js` | 35/35 | *(see the mutation block below)* | 10/10 vocabulary rows killed |
| **A-2** | same file | — | two module mutations | 3 rows red under M1, 1 row red under M2 |
| **B-1** | `api/cron/agent-evaluate.thresholdLint.test.js` | 13/13 | the **pre-change cron** (`origin/main`) | **5 of 13 red** |
| **B-2** | same file | — | a **"rewrite the threshold" mutant** | **5 red, including both B-2 rows** |
| **C-1** | `api/cron/compute-index-intelligence.rsPercentileNull.test.js` | 15/15 | the **pre-change crons** (`origin/main`) | **5 of 15 red** (all five source pins) |
| **D-1** | `api/_utils/thresholdLintCopy.test.js` | 7/7 | the **pre-change copy** (`origin/main`) | **4 of 7 red** |
| **F-1** | `src/config/anticipationThresholdLintFlags.test.js` | 5/5 | — | `flagPinGuard.test.js` green (6/6) |

### A-1 — the four Sep 14 thresholds, and the mutation check

The fixtures are the four sentences **verbatim from Phase 0 §5's quotation**, which is the only in-tree record of them (the battle document is in Firestore, not the repo — stated in the test file's header). The present-signals map is reconstructed from that tick's record: `vwapDev: null` on every held name, QCOM bench, CRWD held after the swap.

The mutation block is the BUILD_RULES §2 "a row that cannot fail is not a guard" check, and it runs the **real** matcher with one vocabulary row deleted — never a copy of the matching logic (the `vocabulary` parameter on `namedSignals` / `lintThreshold` is that seam). One killer fixture per row, each **red today** and **green with only that row deleted**:

```
✓ VWAP: red today, green with the row deleted
✓ MACD_5M: red today, green with the row deleted
✓ RSI_5M: red today, green with the row deleted
✓ VWAP_5M: red today, green with the row deleted
✓ RVOL: red today, green with the row deleted
✓ RSI: red today, green with the row deleted
✓ SMA_20_LEVEL: red today, green with the row deleted
✓ MACD_CROSS: red today, green with the row deleted
✓ BB_PCT_B: red today, green with the row deleted
✓ RS_PERCENTILE: red today, green with the row deleted
✓ the killer table covers every shipped row, one for one
```

Three of those killers are only killable with the right symbol class, which is itself a check on the model: `MACD_5M` and `RSI_5M` need a **bench** symbol (so the general row passes on the mutant), and `VWAP_5M` needs a **held** symbol that actually has a VWAP reading.

### A-2 — `buildPresentSignals`, shown failing

Run against the module with two deliberate mutations:

- **M1 — the held block also reads `techScoresMap`** (the class asymmetry collapses):
  `× HELD, everything present … — and NEVER a bench-only signal`
  `× HELD, nothing present: ATR alone …`
  `× a symbol in BOTH lists is held …` — 3 failed / 32 passed.
- **M2 — `'rsPercentile' in factors` instead of `!= null`** (the `?? 50` world, where a null counts as present):
  `× BENCH: each field gates its own signal, one at a time` — 1 failed / 34 passed.

M2 is the row that makes commit C a **prerequisite** rather than a nicety: with the placeholder still writing `50`, `RS_PERCENTILE` would read present for a symbol that has no measurement, and the lint would accept a threshold citing it.

### B-1 / B-2 — the cron walk

The suite runs the **real `processAgentBattle`** through the full-Haiku path on the `tickStampsHarness` fixtures, with the book remapped to the Sep 14 book (QCOM bench with a full technical doc including `volumeProfile.ratio`, CRWD held) and `fetchIntradayBatch` returning `{}` — so every held name stamps `vwapDev: null`, as the record has it. `TICK_STAMPS_ENABLED` is mocked true so the second persistence site actually composes; the lint mode is a live getter so one module graph walks all three states. The shared `tickStampsHarness.js` is **not modified** — the remapped rankings and tech docs are composed locally.

- `'off'` → all four at both sites, **no log record**; and the tick really is the Sep 14 tick (every held name's `evidence[sym].vwapDev` is null).
- `'shadow'` → all four at both sites, **exactly two records** with `absent: ['VWAP']` and `absent: ['VWAP', 'MACD_5M']`, `dropped: false`, `errorReason` `absent_VWAP` / `absent_VWAP+MACD_5M`; the two that pass are never logged.
- `'on'` → **two persisted at both sites** (the ATR one and the levels/RVOL one), two gone from the queue **and** from the `candidates[]` stamp, two records with `dropped: true`, and the dropped sentences appear nowhere in either site's payload. Plus: the class asymmetry end to end (the same RSI sentence dropped on the held name, kept on the bench name); every candidate failing → **no `candidates` key at all** and no dispatch; a symbol-less item passes through untouched.

**Shown failing first** against the pre-change cron (`git show origin/main:api/cron/agent-evaluate.js` swapped into the tree): **5 of 13 red** — the three `'on'` rows, the `'shadow'` record row, and the B-2 reference-identity row. The four `'off'` rows **pass**, which is the byte-identity claim stated the other way round.

**B-2 — the pin.** Every persisted threshold at both sites, in all three modes, is byte-identical to one the decider wrote; the survivors under `'on'` are the decider's **own objects** (`expect(dispatched[0]).toBe(candidates[2])`), and the lint mutated nothing it was handed. **Mutant:** replacing the drop with *"split on `and`, keep the clauses that lint clean, re-join"* — the exact second honesty problem the invariant forbids. **5 red, including both B-2 rows.**

### C-1 — the placeholder

Fifteen rows, of two kinds, and the file says why neither alone is enough: the per-symbol doc assembly lives inside the cron's `handler`, which needs EODHD + Firebase credentials and live network, so it cannot be exercised (the intraday suite beside it says the same).

- **Five source pins** over both crons — the three expressions, the two game-mode inputs, and the absence of the `?? 50` forms they replaced. The `voice-layer-cache.js` row scans **comment-stripped** source, because the D-120 docstring beside that site quotes the old expression on purpose.
- **Ten behavioural rows** through the real collaborators: **the defect reproduced** (the pre-change composition publishes `50`, and the **real fenced** `buildBenchTechnicalBlock` renders `rsPercentile=50 (outperforming)` from it); the null publication; a reading unchanged (including `0`); **no score moves** (`technicalScore`, `rsVsSpyScore`, `sectorRSScore` and `factors.sectorRSPercentile` all byte-identical to the pre-change scorer output) **and** the demonstration that a null scoring input *would* have moved them (`rsVsSpyScore → 0`); the game-mode redistribution through the real `computeGameModeFits`; and the two readers (the fenced bench block omits the clause; `buildScoutAlerts` raises no alert and prints no fabricated median, and the `>= 85` gate is unchanged).

**Shown failing first** against the pre-change crons: **all five source pins red.**

### D-1 — the copy

Seven rows: the two corrections; the field still doing its job (`Must be specific`, the too-vague counter-example, the type); no `20-day` anywhere in the tool schema; the fenced twin still present **twice**; and the C-20 honesty pin re-asserted over the honesty suite's **own** archetype × game-mode matrix (`momentum_chaser, contrarian, diversifier, degen, analyst, guardian` × `baggerbomb_agent, baggerbomb_tournament`) so the row cannot pass on a narrower set than the pin it mirrors. **Shown failing first** against the pre-change copy: **4 of 7 red.**

The fenced honesty suite itself (`agentEvalPromptAssembly.honesty.test.js`, including the `:74-78` row that requires the string `VWAP` in every eval prompt) is **green, 17/17** — this build removes the word from no fenced assembler.

### F-1 — the flag pin

`ANTICIPATION_THRESHOLD_LINT_MODE` pinned `'off'`; the live value is one of the three walked states and the list is frozen; the docstring carries the `Pinned by:` pointer; the flag is **not** a `DARK_BY_DESIGN` key but **is** noted there; and the cron gates enforcement on the `'on'` literal, never on `!== 'off'` (so `'shadow'` can never drop). `flagPinGuard.test.js` green, 6/6.

---

## 5. The BUILD_RULES §2 adversarial review

**Threshold.** §2 makes review mandatory at ≥10 files OR ≥1500 lines on the cumulative branch diff. This branch is **18 files / ~2,000 lines** — over both.

**Setup (§2 reviewer isolation, the Sep 2 2026 founder ruling).** Eight agents over four lenses plus a refuter per lens, each on its **own path-distinct `git archive` extraction** under the session scratchpad with `node_modules` symlinked, every one **read-only on git and on the shared working tree**. The **mutating lens ran last, on its own tree**, and verified its own cleanliness afterwards (`diff -rq` against a pristine copy, `md5sum` against `git archive`, `git status --porcelain` empty on the shared tree).

**Process honesty, recorded because a reviewer raised it:** the shared working tree was clean when the lenses started and carried in-flight fixes by the time the refuters finished. Reviewers were unaffected in substance — every one worked from a `git archive` snapshot and pinned its verdicts to a named SHA — but the sequencing is worth stating: lens verdicts are against `32b54f1c`, refuter verdicts against `32b54f1c`, and the mutating lens against `8ef7fe6b`.

| Lens | Dimension | SHA reviewed |
|---|---|---|
| L1 | Domain correctness — is the lint's model of "present" and "named" true of the shipped prompt? | `32b54f1c` |
| L2 | Wiring, lifecycle, the flag-off guarantee | `32b54f1c` |
| L3 | The disclosed decider-input change | `32b54f1c` |
| L4 | Test integrity (**mutating**, last) | `8ef7fe6b` |

### 5.1 The CONFIRMED / REFUTED split

Every finding was handed to a refuter instructed to **refute it with a concrete repro**. Two were refuted outright and the changes made for them were **reverted**; one was escalated into fence contact. Severity is stated for the `'on'` state, since nothing here changes behaviour while the flag ships `'off'`.

| # | Finding | Refuter verdict | Disposition |
|---|---|---|---|
| L1-F1 | The 5-minute rows required a literal `min`, so `5m MACD`, `five-minute MACD`, `5-min. MACD`, `MACD on the 5-minute chart` fell through to the DAILY row and were **accepted** | **CONFIRMED-BUT-NARROWED** — real, but no bypass form appears anywhere in the text the model is shown (the Forge rules use exactly the canonical forms the table matched) | **FIXED.** One shared intraday-timeframe pattern, any minute timeframe, prefix or suffix position. More correct than the brief's "5-minute": no indicator is computed on *any* intraday timeframe. |
| L1-F2 | `/\b(the )?20[- ]day\b/` over-matched `20-day high` / `range` / `average volume`, censoring honest promises | **REFUTED.** `nearestResistance` is the AVERAGE of a ≥2-swing-high cluster over a 20-**bar** lookback, not a 20-day high; RVOL's 20-day denominator is never disclosed (the prompt renders `RVOL=1.34` alone); the only "20-day" the agent ever sees is the threshold instruction's own bad example | **REVERTED.** The ignored-span row is removed and the refutation written where it sat. A model writing "20-day high" is inventing the window. |
| L1-F3 | Ordinary synonyms leaked past every row | **CONFIRMED-BUT-NARROWED** — only `RSI14` and plural `VWAPs` have a plausible generative path; the class fails **open**, toward the pre-lint status quo | **FIXED** (all of them — each is cheap and fail-safe). |
| L1-F4 | `MACD histogram` folded into `MACD_5M` mislabelled a DAILY-histogram promise — the exact phrase the prompt plants in strategy S3 — and the verdict flipped on word adjacency | **CONFIRMED-BUT-NARROWED** — the **verdict** is correct (no histogram value is rendered on any timeframe); the **label** and the **adjacency false-accept** are the defects | **FIXED.** `MACD_HISTOGRAM` is its own name. This is the finding that most protects the smoke walk: the `absent` lists are the evidence the flip decision rests on. |
| L1-F5 / L2-F6 | The NR7 and LEVELS present-gates asserted what the renderers do not do | **CONFIRMED-BUT-NARROWED** — factually wrong, **zero** verdict impact today, but a live trap: adding an NR7 or LEVELS row would ship two false-accept paths in that same commit | **FIXED.** NR7 rides truthy (there is no "NR7: NO" line); LEVELS rides a non-null side. |
| L1-F6 / L2-F7 | `candidate.symbol` is free-texted, so `qcom` or `QCOM ` meant an empty present set and a **total** drop under `'on'` | **CONFIRMED-BUT-NARROWED** — not total (a threshold naming no signal still passes), and the model demonstrably emits canonical tickers, since `symbolOut`/`symbolIn` are used raw as exact-match keys on the **trade** path | **FIXED** — `trim().toUpperCase()` on both sides, plus non-strings. |
| L1-F7 | The fixtures put QCOM on the bench; §5 reads threshold #1 as a held name | **REFUTED as a build defect.** §5 is internally inconsistent — reading #2 calls QCOM held, reading #3 says "only if QCOM was on the bench" — and neither is marked VERIFIED or ASSUMED. The brief resolves it and the build follows the brief | **No change** — but the refuter found a real defect *in this report*: the executive lead said "three" above a table showing two. **Corrected** in §2, with both readings stated. |
| L1-F11 | The span blanking is quadratic | **CONFIRMED-BUT-NARROWED** — worse than measured, but `EVAL_MAX_OUTPUT_TOKENS = 2048` caps the whole tool-use JSON, so one threshold can never approach the first measured point. The real Sep 14 sentence takes **3.6 µs** | **Recorded, not fixed.** No reachable input. |
| L2-F1 | At `'on'` a drop is a deletion from a durable record whose only receipt is a fire-and-forget GCS write, and an all-dropped entry is byte-indistinguishable from one with no candidates | **CONFIRMED-BUT-NARROWED.** The §5 invocation is **refuted** — §5's prohibition is scoped to a closed 9-row catalog that a lint breadcrumb is not on — and both cited precedents genuinely apply. But the nearer precedent (`cron_budget_skip`) carries a `console.log` and the drop path had none | **PARTLY FIXED** (the console line), **and a flip precondition recorded** — see §5.3. |
| L2-F2 | The flag read sits outside the fail-safe | **REFUTED** — four unguarded flag reads already sit earlier on the identical path inside the same try, so a bare mock explodes ~1,000 lines upstream. No new exposure, and no throw path exists with production inputs | **No change.** |
| L2-F3 | The log record omits a join key | **REFUTED** — battles are single-day at ~26 ticks, so the `evaluations[]` 150-cap cannot collide `evalId`, and `_loggedAt` already joins | **Field KEPT, rationale corrected.** It is the instant of the *check* rather than of the log write, which is the join this record wants. |
| L2-F4 | Five present-set names no vocabulary row emits | **CONFIRMED as fact, REFUTED as defect** — documented as "accepted by omission" in the module's own docblock | **No change.** |
| L2-F5 | Stale JSDoc on the composer | **CONFIRMED** | **FIXED**, both rungs (`@param` and the header's "the decider's own anticipation output"). |
| L3-F1 | The headline "it is shown nothing" is false — `sector RS=50` survives and is now the **sole** relative-strength line | **CONFIRMED**, severity narrowed to MEDIUM (strictly less misleading than before: the verdict word `(outperforming)` is gone) | **FIXED.** `factors.sectorRSPercentile` publishes the reading. This **reverses the D-2 deferral** that stood in the first draft of this report. |
| L3-F2 | "No score, rank or menu moves" contradicts the `baggerBombFit` disclosure three bullets later; the move is measurable | **CONFIRMED, severity UNDERSTATED** — the move reaches two §1-**FENCED** consumers | **CHANGE HELD OUT.** See §5.2. |
| L3-F3 | `sectorRS: … ?? … ?? null` — the first operand was never nullish, so that half was a no-op on dead operands | **CONFIRMED** (10,404 combinations, 0 nullish) | Superseded: the L3-F1 fix makes the operand reachable, which is what deepened the fence contact from ±8 to ±9. |
| L3-F4 | `CompeteTab.jsx` renders a fabricated `11/22` RS bar beside the new `—` | **CONFIRMED-BUT-NARROWED** — §9's *letter* is met (the band and its number share one source); it is a fabricated score beside an absent reading, and the Sector RS row is clean | **Reported, not fixed** (§7) — a client file outside the brief's scope, and the fix is a display decision. |
| L3-F5 | Four `file:line` cites in commit C's message are pre-commit numbers | **CONFIRMED**, all four exact (+7 / +14 / +29 / +5) | **Corrected in this report** (§3 carries post-commit anchors). The commit is pushed and is not rewritten. |
| L3-F6 | Two stale `?? 50` comments in `voice-layer-cache.js` | **CONFIRMED** (and `:155` correctly excluded — it is a deliberate past-tense record) | **FIXED** — they contradicted this branch's own claim. |
| L3-F7 | `rs50.percentile: 0` hardcoded, adjacent to the line this build made honest | **CONFIRMED-BUT-NARROWED** — already triaged as F14(c) in a prior audit | **Reported, not fixed** (§7). |

### 5.2 The fence contact, and why one prescribed edit did not ship

The brief prescribed `?? 50 → ?? null` on the game-mode fit inputs (now `compute-index-intelligence.js:1327-1328`). It works, and it is more honest. The review measured what follows, and the refuter reproduced it independently:

- `rsVsSpy` carries **21.41%** of the normalised technical half; Δfit = `0.7 × 0.2141 × (T − 50)`, measured range **−8 … +8** before the L3-F1 fix and **±9** after it (that fix makes the `sectorRS` operand reachable too).
- Measured consequences: a **baggerBombRank inversion**, and a **game_fit scout alert** that fires where it previously did not (`voice-layer-cache.js:647`).
- And the value does not stay local. **Verified at this HEAD:**
  - `api/_utils/agentPromptAssembly.js:247` renders it as the **`BB_FIT` column of the agent's stock-universe menu** — §1 **FENCED**;
  - `api/_utils/archetypeScoring.js:124` folds it into `computeArchetypeRankings` at weights **0.10–0.30** — §1 **FENCED**; a +7 move was measured to invert three archetype orderings.

BUILD_RULES §1: *"The scoring engine … fenced as concepts, not just files: changes that alter their behavior from non-fenced call sites are fence contact too. If your task seems to require fence contact that isn't in its prompt, **STOP and report** — never improvise it."* The brief did not identify this edit as fence contact, and neither did Phase 0.

**So it is held out and reported for a founder ruling.** Holding the neutral midpoint costs nothing the disclosure promised: `factors.rsPercentile` and `factors.sectorRSPercentile` are published as honest readings — that is what the decider is *shown* — and `baggerBombFit` is now **bit-for-bit what it was before this branch** (pinned by C-1, and the held-out `?? null` shape is pinned as differing by ≥5).

**What the founder decides:** whether to ship the `?? null` fit inputs as a separate, fence-reviewed change. The honesty argument for it is real; the cost is a measured move in the agent's own menu and in a fenced scorer.

### 5.3 The `'on'` flip precondition (L2-F1)

At `'shadow'` nothing is dropped, so this cannot bite before the second flip. **The `'on'` flip PR must not ship without a durable drop receipt**, because at `'on'` the lint deletes from `evaluations[].candidates[]` — the primary record — and an entry where every candidate was dropped is byte-indistinguishable from one where the model emitted none (asserted by the build's own row). The shape the review and its refuter both landed on: a `cronErrors`-shaped capped `cronState` array of `{timestamp, evalId, symbol, absent}` riding the existing `finalUpdate` — **no new write op**, and no test churn while the flag is `'off'`. This branch ships the cheaper half now: a `console.log` naming the mode, symbol and absent list, matching the `cron_budget_skip` precedent it copies, guarded by two rows.

### 5.4 The mutation pass (L4) — and what it found in these tests

59 mutations, each restored between runs. Baseline 405/405 across the nine affected suites; `vite build` exit 0 in the reviewer's tree.

**Strong results:** the A-1 killer table is **exclusively one-to-one across the full 11 × 11 cross-product** — every fixture goes green under exactly one row deletion, its own. The B-2 byte-identity rows are killable in all three modes and catch a `signalSummary` normalisation that B-1 does not, so they are not redundant. The F-1 flag pin reds exactly one row on `'off' → 'shadow'` and on `'off' → 'on'`, leaving the four state-agnostic contracts green. The goldens were verified **byte-exact**: the reviewer reconstructed the pre-edit file by reversing the substitution and matched `bb4caa0d^` by sha256.

**And it found six holes, all now closed:**

| Hole | What nothing caught | Closed by |
|---|---|---|
| Two **tautologies** at C-1 `:191` / `:203` — `expect(fit(null ?? 50, …)).toBe(fit(50, 50))` constant-folds to `f(x) === f(x)` | A total destruction of `computeGameModeFits` reddened **one** row in that block | Both sides now come from a real `publishedFactors*` result, so the objects genuinely differ (50 vs null) and the `?? 50` absorbing that is the claim. Plus an explicit anti-vacuity anchor row. |
| **H-4a** — re-adding `rsPercentileMap[sym] = 50` upstream restores the entire defect commit C removes, at 405/405 green | The source pins are substring scans | A "exactly one write into `rsPercentileMap`, and it is the percentile forEach" assertion. |
| **H-4b** — a duplicate `factors:` key later in the same object literal wins at runtime while `indexOf` keeps pinning the first | — | An "exactly one `factors:` key" assertion; positive pins moved to comment-stripped source with negative twins. |
| **H-1** — five `!= null` gates had no null-reading row, and production writes literal `null` to two of them (`macdAboveSignal`, `bbPercentB`) | `!= null → !== undefined` reddened nothing | Five null-reading rows. |
| **H-2** — the normalised→raw key indirection was untested; removing it reddens nothing but drops a lowercase held symbol under `'on'` | Every fixture fed already-uppercase lists | A row that builds the map from lowercase lists. |
| **H-3** — deleting the console breadcrumb reddened nothing | — | Two rows, one per mode, shown failing with the line deleted. |
| **H-5** — the killer block's own escape hatch: honouring the caller's declaration list but reusing the default *match* list keeps all 11 killers green for the wrong reason | — | A row asserting the mutant table drives the match order. |

**And one published number was wrong.** The goldens note and commit `bb4caa0d`'s message stated the in-place edit was **−768 bytes = 8 × the sentence delta**. The real delta is **−784 = 8 × 98**: the sentence shrinks by 96 *characters* but 98 *bytes*, because the em-dash it carried is 3 UTF-8 bytes. The proof was sound and independently re-verified byte-exact; the arithmetic presented *as* the proof was not. Corrected in the test header and in §3 here; the commit message is pushed and is not rewritten.

**Also corrected:** the A-1 class-asymmetry row was **misleading**. Its fixture gave CRWD no tech document, so "a held name has no RSI" held by absence of data rather than by the bench-only rule — and it survived an inversion of the very rule it named. CRWD now carries a full tech doc, so the row fails when the asymmetry is inverted.

### 5.5 Honest statement of what the C-1 suite does and does not prove

The mutating lens's sharpest point, and it stands: the per-symbol document assembly lives inside `compute-index-intelligence.js`'s `handler`, which needs EODHD and Firebase credentials and live network, so **no behavioural row executes the cron**. C-1 proves that `computeTechnicalScore`, `computeGameModeFits`, the fenced bench renderer and `buildScoutAlerts` behave as described, and that specific expressions are present in the cron text. It does **not** prove the cron composes them correctly. The source pins are now hardened against the two evasions the lens found, and they scan comment-stripped code with negative twins — but they remain source pins, and this report does not claim otherwise.

## 6. Deviations from the brief, each with its reason

Nine, none improvised silently. D-1 through D-5 were taken during the build; D-6 through D-9 came out of the §2 review, and D-2 is a deviation the review **reversed**.

### D-1 — Commit C splits the scoring input from the published reading (the brief says only `?? 50` → `?? null` at `:1006`)

**What the brief prescribed:** `api/cron/compute-index-intelligence.js:1006` … `?? 50` → `?? null`.
**What shipped:** the READING is `?? null` (`:1013`), and the value handed to `computeTechnicalScore` is `rsPercentile ?? 50` (`:1038`), with the honest null restored onto `factors` after the spread (`:1123`).

**Why.** `computeTechnicalScore` turns that argument into a 0-22 band **by arithmetic**: `Math.round((rsPercentile / 100) * 22)` (`api/_utils/indexIntelligence.js:413` — VERIFIED). `null / 100` is `0`, so a naive null would score every unmeasured symbol **0 of 22** — worst in the universe, not "unknown" — and, through `sectorRSPct` (`:416`), up to 15 more points. `technicalScore` feeds `technicalRank`, `sectorTechnicalRank`, `compositeScore` and `baggerBombFit`, and `baggerBombFit` is what builds the agent's hotBench (`agent-evaluate.js:1008-1012`). A silent, systematic demotion of thin-data symbols in the agent's own candidate menu is a far larger behaviour change than the one the brief disclosed, and it would be a **second fabrication** (worst-in-class) replacing the first (median).

The brief's stated purpose is about what the decider is **shown** — *"from a fabricated median to nothing"* — and the split delivers exactly that while leaving every score byte-identical. Row C-1 proves both halves: `technicalScore`, `rsVsSpyScore`, `sectorRSScore` and `factors.sectorRSPercentile` all equal the pre-change scorer output, **and** a null scoring input would have moved them (`rsVsSpyScore → 0`).

### D-2 — `factors.sectorRSPercentile` is published honestly too *(reversed by the review)*

The first draft of this build deferred it, on the reasoning that its value was byte-identical before and after and that widening was BUILD_RULES §3 scope creep. **The review overturned that, and it was right.** With `rsPercentile` nulled, the bench block omits its clause — leaving `Relative strength: sector RS=50` standing **alone** as the only relative-strength line the decider sees, the fabrication with nothing beside it to cross-check. That makes this commit's own disclosure ("it is shown nothing") false. One field, the same override; reproduced through the real fenced renderer by two independent agents. See §5.1 L3-F1.

### D-3 — the vocabulary table carries an explicit match precedence

The brief lists the table with `/\bVWAP\b/i` first and annotates only `MACD_CROSS` with *"(not 5-minute)"*. Taken as an evaluation order that is self-defeating: `/\bVWAP\b/` would consume *"the 5-minute VWAP"* before the `VWAP_5M` row ever ran, and `VWAP_5M` could never fire. The shipped table keeps the **brief's order as the declaration order** (so `absent` comes out `['VWAP', 'MACD_5M']` exactly as the brief's fixture expects, and so this report can list it as written) and adds a `matchFirst` field that runs the three 5-minute rows first with span consumption. This is the brief's "(not 5-minute)" rule, generalised to the two rows that need it too.

### D-4 — the branch name carries a session suffix

The brief says `claude/threshold-lint`. The harness pinned `claude/threshold-lint-4pwvm4` and instructed "NEVER push to a different branch without explicit permission", so the work is on that branch. It is the task-prescribed name with the harness's own suffix — **not** the session default name the brief forbids. One task, one branch, cut from `origin/main` at HEAD.

### D-5 — `ANTICIPATION_THRESHOLD_LINT_MODES` is exported alongside the flag

Not named in the brief. It is one frozen three-element array mirroring `VOICE_GROUNDING_MODES` (`featureFlags.js:2140`), and it exists so row F-1 can assert the live value is one of the walked states in the same shape the grounding pin uses. Inert to every runtime path.
### D-6 — `MACD histogram` is its own signal, not folded into `MACD_5M`

The brief's table maps `/MACD\s+histogram/` → `MACD_5M`. The review showed that mislabels the **daily** histogram — the exact phrase the eval system prompt hands the model in strategy S3 (`agentEvalPromptAssembly.js:421` / `:625`) — as a 5-minute violation. The verdict was always right (no histogram value is rendered on any timeframe) but the *name* was wrong, and the `absent` lists are precisely the evidence the founder reads before flipping to `'on'`. Splitting it also removed a verdict that flipped on word adjacency. **Consequence:** Sep 14 fixture #2 reports three names where the brief prescribed two.

### D-7 — the 5-minute rows catch any intraday timeframe, not only "5-minute"

The brief's three patterns required a literal `min`. The review showed `5m`, `five-minute`, `5-min.` and `MACD on the 5-minute chart` all fell through to the daily row and were **accepted**. The rows now share one intraday-timeframe pattern. This is also strictly more correct than the brief: Phase 0 §5 establishes that **no** indicator is computed on **any** intraday timeframe, not just five minutes.

### D-8 — the game-mode fit inputs keep `?? 50`, against the brief

The brief prescribed `:1298-1299` (now `:1327-1328`) go to `?? null`. **Held out as fence contact** under BUILD_RULES §1, with the measurement in §5.2 and a founder ruling requested. This is the one piece of the prescribed build that did not ship.

### D-9 — `tickStamps.js` carries a comment-only edit

The brief says this file stays untouched, and §5 of the brief asks the diff to show "no `tickStamps.js` behaviour change". Two stale doc lines now name the linted array instead of `haikuResult.anticipationCandidates`. The diff is comments only; no behaviour changes and the composer is untouched. Left stale, they would have been literally false at `'on'` — the exact defect class commit D exists to fix.


---

## 7. Found outside the task — reported, not fixed (BUILD_RULES §3)

1. **`factors.sectorRSPercentile` carries the same placeholder.** `indexIntelligence.js:416` resolves `sectorRSPct = sectorRSPercentile != null ? sectorRSPercentile : rsPercentile`, so a symbol with neither reading publishes the neutral input and the bench block renders `sector RS=50` (`agentEvalPromptAssembly.js:1678-1680`). Unchanged by this build (D-2), and on the same rendered line the build just cleaned.
2. **The voice-layer grounding goldens' regeneration recipe no longer runs.** The header of `api/_utils/voiceLayerPrompt.grounding.goldens.test.js` prescribes regenerating inside a `git archive 70ba90a1` tree; at this HEAD the harness imports `ELICITATION_INSTRUCTIONS` from `../agent/chat.js` (`:80`), which `70ba90a1` does **not** export, so `renderAll` throws *"Cannot convert undefined or null to object"* at `:219` and all 18 rows skip. **Verified in a scratch extraction this session.** The dark contract still holds (the bytes are intact); what is broken is the documented way to re-derive them. Repairing it — pinning the snapshot forward, or sourcing that one table from a fixture — is its own task. Recorded in the test's header.
3. **The 20-day example also lives in Gemma's anticipation instructions.** `voiceLayerPrompt.js:3662` and `:3689` carry *"If it holds above the 20-day on the next test"* in the narrator's own guidance and few-shot. Non-fenced, and the same defect Commit D fixed in the tool schema, but outside the brief's named scope for that commit.
4. **The fenced twin of the threshold instruction.** `agentEvalPromptAssembly.js:501` (tiered) and `:704` (standard) — both prompt variants carry the same *"If it holds above the 20-day on the next test"* sentence. The brief names `:501`; `:704` was found at this HEAD. Fenced; the follow-up, pinned as still-present by row D-1c.
5. **`api/_utils/agentEvalPromptAssembly.js` renders the threshold guidance twice.** Related to item 4 and worth naming separately: the tiered and standard variants duplicate the anticipation block verbatim, so any future correction there is a two-site change.

6. **`CompeteTab.jsx` now shows a fabricated RS bar beside an absent reading** (review L3-F4, CONFIRMED). `src/components/draft/CompeteTab.jsx:48-49` drives the "RS vs SPY" row's bar and `11/22` from `techData.rsVsSpyScore` — the placeholder re-expressed through the scorer — while its `format` reads `factors.rsPercentile`, now `—`. Pre-change the row read `11/22  P50`: consistent but fabricated. **This build creates the disagreement**, and the fix is a display decision in a client file the brief does not scope: dash the bar and the score when the reading is null. The Sector RS row at `:50-51` is clean. §9's *letter* is met (the band and its number share one source), so this is the fabrication family rather than the label-drift family.

7. **`compute-index-intelligence.js:1099` hardcodes `rs50: { …, percentile: 0 }`** for every symbol — a legitimate-looking bottom-rank percentile, applied universally, now sitting on the line adjacent to the one this build made null-honest. Zero readers in the tree. Already triaged as F14(c) in `docs/audits/RANKS_ARCHETYPE_AUDIT_PHASE0_FINDINGS.md`.

8. **The threshold lint's `absent` list is not yet on the entry.** At `'on'` a drop shrinks `evaluations[].candidates[]` and the only receipts are a console line and a fire-and-forget GCS record. §5.3 states this as a precondition on the `'on'` flip PR rather than a defect here, since `'shadow'` drops nothing.

9. **The `?? null` game-mode fit inputs**, held out as fence contact — §5.2. This is the one item that needs a founder decision rather than a future task.

Three pre-existing lint errors in files this build touched are unchanged and pre-date it (`agent-evaluate.js` `getPresetAdjustedStrategies` + two `_e`; `compute-index-intelligence.js:430` `range252`) — verified identical against `origin/main`. `npm run lint:gate`, the binding gate, is exit 0.

---

## 8. Disclosure, smoke and handover

### The disclosure, for the PR body (the founder pastes it)

> Adds a lint that rejects an agent's "I'll act if X" promise when X is a signal that check did not hold — dark, then measured in shadow, then enforced. An accepted promise is never reworded. Separately, a bench stock with no relative-strength reading is no longer shown to the decider as "50th percentile"; it is shown nothing. Two prompt sentences that described states the platform no longer produces are corrected.

Two notes on that text, both from the review:

- *"it is shown nothing"* is now **true in both RS fields**. It was not in the first draft: `sector RS=50` survived and became the only relative-strength line the decider saw (§5.1 L3-F1).
- **Nothing else moves.** No score, no rank, no menu, no fit. The brief's `?? null` on the game-mode fit inputs *would* have moved `baggerBombFit` by up to ±9 and inverted rankings inside two §1-fenced modules, so it was held out for your ruling (§5.2). If you take that change later, its disclosure needs one more line: *a symbol with no relative-strength reading scores its BaggerBomb fit on the factors it actually has, which moves its position in the agent's own menu and can fire a scout alert that did not fire before.*

### The smoke is the walk

Crons do not run on Vercel preview (BUILD_RULES §6), so nothing here is preview-testable. The walk is three founder PRs, in order, each its own one-line change:

1. **Flip to `'shadow'`** (its own PR — moves the pin row in `src/config/anticipationThresholdLintFlags.test.js` in the same commit, and updates the `DARK_BY_DESIGN` note in `flagPinGuard.test.js`). Then **one live battle**, then read the shadow log stream `shadow/anticipation/<date>/` for records with `errorStep: 'threshold_absent_signal'`.
   **What "reads right" looks like:** the `absent` lists should be **VWAP**, the **intraday** signals (`MACD_5M` / `RSI_5M` / `VWAP_5M`), **`MACD_HISTOGRAM`**, **`SMA_20_LEVEL`** and **held-name RSI** — never `ATR` or `LEVELS`. A record naming ATR or a level means the present-signals map is wrong, and the flip to `'on'` should wait. Expect `SMA_20_LEVEL` and `MACD_HISTOGRAM` to appear: the fenced prompt still plants both phrases (§7 items 3-4), so the shadow log will show the agent following instructions this build could not reach.
   **Two preconditions on the `'on'` PR**, not on `'shadow'`: the durable drop receipt (§5.3), and — if the shadow log shows `SMA_20_LEVEL` in volume — the fenced follow-up first, since otherwise `'on'` drops the sentence the prompt's own example teaches.
2. **Flip to `'on'`** (its own PR, same reconciliation). The next battle's anticipation feed then carries only checkable promises, and `evaluations[].candidates[]` on that battle holds **no threshold naming an absent signal**.
3. **Commit C's smoke is independent of the flag** and lands with this merge: the next pre-market `compute-index-intelligence` run writes `rsPercentile: null` (not `50`) into `stockTechnicalScores/{SYM}.factors` for any symbol outside the RS sort, and the bench block in the next eval prompt omits the `rsPercentile=` clause for that symbol rather than calling it "outperforming".

### Handover

Pushed to `claude/threshold-lint-4pwvm4`. **No PR opened, no merge, no CI watched** (BUILD_RULES §2 — the founder opens PRs and merges; delivery ends at *pushed*). The two flips are the founder's, one PR each.

**STOP.**
