# Gate 1's instruments — the build review record

**Date:** September 8, 2026
**Branch:** `fix/voice-grounding-gates`
**Base:** `02e06f1a` (current `origin/main` at build start)
**Reviewed:** `f842f234` (the build), then the three fix commits on this branch — the documentation lens's, the two code lenses', and the drift lens's (this one).
**Trigger:** BUILD_RULES §2 — the cumulative branch diff is 2,386 lines, over the 1,500-line threshold at which review is mandatory.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | Lenses run | **Four.** Domain correctness · lifecycle & failure modes · documentation accuracy · reuse & drift. |
| 2 | Findings | **25 raised · 25 CONFIRMED · 0 refuted.** Two P1, eight P2, fifteen P3/documentation. |
| 3 | The two P1s | **Both fixed.** Each would have let gate 1 PASS on the regression it exists to catch. |
| 4 | Rows that could not fail | **Nine**, found by mutation. All nine now red under the defect they name. |
| 5 | Mutation totals | **20 run, 20 killed** on the fixed tree (the pre-fix battery was 31 run / 22 killed / 9 survived). |
| 6 | `vite build` | Exit 0, before and after the fixes. |
| 7 | Full suite | **618 files · 11,082 pass · 64 skipped · 0 failing.** A FULL-repo figure, after the fixes. |
| 8 | Fence (§1) | **Zero contact.** No fenced file edited; the scripts call non-fenced builders and clients only. |
| 9 | §2.3 ratchet | **Not tripped** — no new direct importer of a legacy archetype table. |
| 10 | Process defect | **One, mine.** All four lenses were given ONE shared snapshot; three mutated it concurrently. See §6. |

**The headline:** the arc's whole point is that the narrator must not claim what the record cannot back. These two scripts are the instruments that decide whether the flag may flip — and both of them could report a clean gate on a run where nothing worked. A replay the model *rejected* carried a latency (the time to the rejection), so a new prompt that OpenRouter refuses outright — the most likely failure of a materially longer prompt — read as an 11× latency **win** with zero timeouts and 100% schema adherence. And the latency baseline the whole comparison rests on was diluted by three unrelated endpoints that write the same shadow stream: 1.9% where the truth was 10.0%. Neither was visible to any test I had written.

---

## 2. Method

- **Four independent lenses**, each given one dimension and told to produce a concrete repro for every finding or drop it. Reviewers worked on snapshot trees, read-only on git and on the working tree (BUILD_RULES §2, the Sep 2 reviewer-isolation ruling).
- **Every finding carries a repro that was actually run** — a failing assertion, a CLI transcript with its exit code, or a rendered report table. Nothing was accepted on argument alone.
- **The two headline findings were independently re-derived by the coordinator** before being acted on: the four-writer stream was re-verified by grepping every `logConversation` call site and reading each caller's `battleId`; the phase-dependent guard-site list was re-measured by running the shipped `findGuardedVocabulary` over the real `buildFirstMessagePrompt` output per phase.
- **Mutation-checked on the fixed tree.** Twenty mutations, one per fix, each restored by file copy — never `git checkout --`, which in this same session silently reverted an unstaged change and is the hazard BUILD_RULES §2's reviewer-isolation ruling was written for.
- **An explicit `vite build`**, because no test in the repo imports `App.jsx`.

---

## 3. CONFIRMED — P1, fixed in `2f74cedf`

### P1-1 · A replay the model REJECTED counted as a fast one

`api/scripts/voice-grounding-harness.js` — `summarizeSide`.

`replay` returns `{ raw: null, latencyMs, timedOut: false, error: 'OpenRouter 429: …' }` for every non-abort failure. `summarizeSide` excluded `timedOut` but not `error`, so the **time to the rejection** entered the p50/p95/max sample; the side was excluded from `schemaChecked` (a silent `0/0`) and counted in no error tally, and `renderReport` had no error row at all. Found independently by two lenses. The rendered gate table for a run in which every new-prompt call was rejected:

```
| Replays sent     | 4 / 4        | 4 / 4    |
| Latency p50      | 1402 ms      | 120 ms   |
| Timeouts         | 0 (0.0%)     | 0 (0.0%) |
| Schema adherence | 4/4 (100.0%) | 0/0 (—)  |
```

Exit code 0. Gate 1 passes, reading an 11× improvement, on a run where the new prompt was never answered once.

**Fixed:** errored sides are excluded from the latency exactly as timeouts are; `answered` and `Transport errors` are rows of their own; a run with no answered new-prompt replay exits 1 and says the latency figures are meaningless.

### P1-2 · `shadow/conversations/` has four writers, and three of them diluted the timeout rate

`api/scripts/gemma-latency-report.js` — `summarize`.

The header asserted the stream was `chat.js`'s. It is not: `logConversation` is also called by `api/forge/watchlist-analysis.js:570` (`set_analysis`), `api/forge/workshop-chat.js:444` and `:590` (`workshop`), and `api/screener/chat.js:398` (`research`). None stamps `gemmaLatencyMs`, so no percentile ever moved — but all of them landed in `records`, in `turnErrors`, and in the **denominator of `timeoutRate`**, the headline number the Sep 3 timeout change is judged on.

```
TRUE voice-turn day : records 20 · timeouts 2 · timeoutRate 10.0% · turnErrors 2
WHAT THE SCRIPT SAID: records 105 · timeouts 2 · timeoutRate  1.9% · turnErrors 7
```

The error scales with unrelated product traffic, so it drifts silently.

**Fixed:** `isVoiceTurnRecord` discriminates on `battleId` — `chat.js` is the only writer that sets a real one; the other three hard-code `null`. The excluded records are reported as `otherStreamRecords` in the table footer and the `--json` object, never dropped in silence.

---

## 4. CONFIRMED — P2, fixed in `2f74cedf`

| # | Finding | Why it mattered | Fix |
|---|---|---|---|
| P2-1 | **`latency(ok)` dropped completed calls.** It excluded every `turnError`, but `chat.js` files that on the parse-failure path (the model answered in full, just not in JSON) and on a post-call throw — both are the model's own response time, and typically the slow tail. | It read p95 **3,760 ms** where the truth was **≈11,750 ms**. This is the baseline gate 1's harness is compared against, so the entire comparison inherited the error. | Renamed `latency(answered)`; excludes aborts only. |
| P2-2 | **The forward-language scorer missed clauses of ≤5 words.** `normalizeForEcho` keeps `.` (so `$145.50` survives), which glued the terminator to the clause's last word; for a short clause the shingle fallback *is* the exact check, so there was no fallback. | `"I'll rotate."` scored **zero** against a reply that repeated it verbatim and kept going. This is Sol's confirm-pass dimension — the one thing gate 1 adds over the old lint. | The clause's trailing terminator is stripped. |
| P2-3 | **`FORWARD_MARKER_RE` fired on the plain words "ill" and "id"**, and missed `we will`, comma conditionals, and `plan is to`. | A false positive is worse than a miss: it inflates the clause set the OLD control column is scored against too, and tells the founder a purely historical sentence is a promise. | The apostrophe is required; the missing forms added. |
| P2-4 | **`schemaAdherence` could not see the regression it exists to catch.** Four shapes scored `valid`: a missing `_scratchpad` (both formats say it MUST come first), `hasDirective:true` with no directive, legacy string chips, and a directive chip with no id. | §6.2 — chips minted by id — is the point of the rework, and "schema adherence" that cannot see a legacy string chip is measuring nothing. | `_scratchpad` required; directive-when-claimed required; the chip shape checked on the grounded side only, since the old prompt still asks for strings. |
| P2-5 | **`--dry-run` attributed one persisted reply to BOTH columns.** Under `'shadow'` — the mode the harness's own header names — `chat.js` sends the OLD prompt, so `agentMessage` is the old side's. | The report printed identical replies and identical lint counts side by side and called one of them the grounded prompt's. | The reply goes to the column that produced it, derived from the record's `voiceGroundingMode`; the banner matches. |
| P2-6 | **The entrypoint guard was not realpath-safe.** Node realpaths the ESM main module for `import.meta.url` but leaves `process.argv[1]` as spelled, so any symlinked component made the equality false. | Both CLIs did nothing and exited 0. A clean exit and no report is the worst failure a founder-run gate can have. | `realpathSync` on both sides. Verified by CLI through a symlinked directory. |
| P2-7 | **A total GCS read failure was indistinguishable from a quiet week** — all-zeros rows, exit 0, and `--json` carrying no error signal at all. | The p50 the script exists to produce was silently absent rather than flagged. | `readRange` counts and returns `daysFailed`/`filesFailed`; the footer and `--json` carry them; a range where every day failed exits 1. |
| P2-8 | **`--out` was touched only after the replay was spent.** At the default `--pairs 20` that is 42 live model calls discarded because of a typo in a path. | | The directory is created before anything is spent, and a write failure dumps the report to stdout rather than losing it. |

Also fixed, P3: a malformed `GCS_CREDENTIALS` threw a raw `SyntaxError` and killed the dry run the header promises works without credentials (now a sentence, and the dry run continues); `filesRead` counted files *attempted*; `readRange` held every record of every day in memory to keep 20 pairs at ~52 KB each (it streams per day now); a multi-line rationale was truncated at its first newline (the boundary is derived from the renderer's own block constants); and the harness's claim that "a timeout here means what it means in production" over-reached, because production **clamps** the per-call budget to what remains of the turn deadline — the report now states the budget is nominal and an optimistic lower bound, with `--budget-ms` to gate on a realistic number.

### The reuse/drift lens — five P3s, no false reuse

The lens that verifies the scripts' headers do not *claim* reuse where there is a copy came back clean on the substance: **every functional reuse claim held.** `quantile`, `REPLY_LINT_RE`, `GEMMA_TIMEOUT_MS`, `callGemmaVoice`, the motive labels and the four rationale-boundary constants, the shared stream reader, and the production prompt builder are all genuinely imported — there is no percentile math, no model id, no temperature, no URL and no `fetch` in either file. Five P3s, all fixed:

| # | Finding | Fix |
|---|---|---|
| P3-9 | **The report retyped `REPLY_LINT_RE`'s phrase list as prose**, and hardcoded "a 5-word run" beside a configurable window. The counts move; the sentence describing them did not, and nothing failed. | Both interpolated — `${REPLY_LINT_RE.source}` and one `ECHO_SHINGLE` constant. The display-agreement rule (§9) applied to a report. |
| P3-10 | **The clamp's worked example was arithmetically wrong**, in the header and in the founder-facing report: "a 5s prologue aborts at 14s". `TURN_DEADLINE_MS − GEMMA_TIMEOUT_MS` is 5,000 ms, so a 5s prologue is where the clamp *begins* to bite; 14s needs a 10s prologue. The qualitative claim was right; the numbers were not. | The report states the threshold arithmetically from the two imported constants; the header's example uses a 10s prologue. |
| P3-11 | **`schemaAdherence` reported a wrong reason.** `hasDirective:true` with a bare STRING directive was called `hasDirective_without_directive` — but `normalizeDirective` (chat.js:143-151) accepts a string and files it. That is a format deviation, not the false receipt spec §6.3 exists to prevent. | Three reasons, each true of its case: `directive_not_an_object` (production files it), `directive_without_text` and `hasDirective_without_directive` (production files nothing). |
| P3-12 | **A dead `'canary'` branch encoding the wrong rule.** The record carries the RESOLVED mode, and `resolveVoiceGroundingMode` only ever yields `off`/`shadow`/`on` — under a canary flag a non-allowlisted caller is sent the OLD prompt. | Branch removed; the rule stated correctly, with a row that pins resolution. |
| P3-13 | **Four constants are hardcoded copies** — bucket, project, stream, and the timeout reason. Values verified identical to `shadowLogger.js:18/33/71` and `chat.js:897`; none is exported, so no import exists, and the comments never claim one. | **Not fixed** — see §7.3. |

**Fence and ratchet, independently confirmed clean.** No fenced file edited. Two fenced functions are CALLED, both through the non-fenced `buildVoiceLayerPrompt` and both §1-permitted: `getArchetypeLabel` (`agentArchetypeConfig.js`) and `computeTimeRemaining` (`agentEvalPromptAssembly.js`). The §2.3 import-boundary ratchet is **not tripped** — neither file is a new *direct* importer of a legacy archetype table; the reaches are transitive through `voiceLayerPrompt.js`, already in the baseline, and `archetypeRegistry.test.js` passes with both files present. The §1 flag-split prose rule imposes no obligation: the harness is a leaf that nothing but its own test imports, so it cannot splice into a fenced assembler.

---

## 5. CONFIRMED — rows that could not fail

BUILD_RULES §2: *a row that cannot fail under the defect it names is not a guard.* The pre-fix battery ran 31 mutations and **9 survived**. Every one is now red:

| # | The mutation that survived | What the row asserts now |
|---|---|---|
| S1 | `setUTCDate/getUTCDate` → `setDate/getDate` in `dateKeyForOffset` | Unfixable by assertion — a UTC CI runner cannot tell the two apart, and the defect is a silent off-by-one DAY across DST on a founder's laptop. **Fixed at the source instead:** epoch arithmetic, no mutable `Date` step, so the mutation class is gone; a source tripwire pins it. |
| S2 | Swap the `all` and `answered` column groups in `formatReport` | The rendered table is tokenized and each cell read back against its own statistic. |
| S3 | A per-day row prints the OVERALL numbers | Same row: a day's cells must be that day's. |
| S4 | `lintHits.length > 0` → `> 1` | A pair with exactly ONE lint hit — the boundary the only lint-bearing fixture never crossed. |
| S5 | Delete five of the eleven forward markers | One row per marker form, fifteen sentences. |
| S6 | Drop the `i` flag from the reply lint | Replies that open a sentence with the phrase (`Watching AVGO…`, `KEEP AN EYE…`). |
| S7 | Delete the emphasis strip in `normalizeForEcho` | Emphasis GLUED to its neighbours (`the **bold**text case`) — standing alone the punctuation flattener masks it. |
| S8 | `list.reduce` → `called.reduce` for the lint and echo counts | A dry run, where every side is skipped and these are its only two numbers. |
| S9 | Swap `oldSummary`/`newSummary` in `renderReport` | The old side answers and the new side is rejected, so the two columns cannot be confused. |

**Mutation totals on the fixed tree: 20 run, 20 killed** (fifteen for the correctness and lifecycle fixes, five for the drift fixes). Restores were done by file copy, never `git checkout --`.

---

## 6. Process notes

- **One shared snapshot for four reviewers was my error.** All four were pointed at the same tree and told they could edit it for mutation checks; three did, concurrently. One lens watched two source files change under it mid-run and reported non-deterministic failures (3 runs → 0, 2, 1 different failures), correctly identified them as contamination, rebuilt a private tree and re-ran everything there. Its findings stand because it re-derived them in isolation; the mutation table above was re-run by the coordinator on a clean tree regardless. **Reviewer isolation means a tree per reviewer, not a tree per review** — the Sep 2 ruling says "a snapshot tree", and four agents sharing one is not that.
- **`git checkout -- <file>` cost me an unstaged change**, exactly as the Sep 2 ruling warns: reverting a mutation on `api/agent/chat.js` restored the base file and erased the edit under review. Caught immediately (the mutation's own result was still valid), re-applied, and every subsequent restore was a file copy.
- **The container restarted mid-review**, killing the reuse/drift lens. It was re-run on a private snapshot, narrowed to drift only since the test-integrity half was already covered by the correctness lens's battery. A stop-hook committed and pushed the documentation fixes during shutdown; that commit carries the hook's own author line rather than this session's attribution trailers.
- **Lint is not a gate in this repo and was not treated as one.** `npx eslint` reports 1,718 pre-existing problems tree-wide, including `'process' is not defined` in every `api/` file (the config declares only browser globals). The two new scripts add only that same pre-existing class. Filed for separate tasking, not fixed here (BUILD_RULES §3).

---

## 7. Recorded, not fixed — for the founder

1. **`api/agent/ensure-opener.js`'s header says the flag defaults to `false`.** It is `true` (`src/config/featureFlags.js:1112`) — the lazy opener is the live path. Nothing in this PR depends on the docstring, but it is the same "a header comment is not evidence a handler runs" class BUILD_RULES §6 warns about, and it points the opposite way from §8's (correct) reasoning that the lazy opener is live. One line, in a file this PR does not touch.
2. **The report's memory profile is bounded but not small.** Streaming removed the range-wide ceiling; a single very busy DAY is still read whole before it is summarized. Acceptable for a founder-run local tool; a per-file reducer is the next step if a day ever gets large enough to matter.
3. **Four constants are copies, deliberately.** `BUCKET_NAME`, `PROJECT_ID`, the stream name and `'gemma_timeout'` are hardcoded in the reader with comments that say "same as shadowLogger.js" — never "imported", because none of them is exported and no import is available. Values verified identical. Exporting them from `shadowLogger.js` would remove the copy class (this is the third copy of the bucket/project pair, after `sample-voice-layer-terms.js`), but that edits a module every capture path in the repo depends on, to fix a drift risk in values that have never changed. Left for a task that owns that module.
4. **The forward-language scorer measures REPETITION, not paraphrase**, and says so in the report. A model that restates the rationale's conditional in its own words scores zero. That is the honest limit of what code can prove here — spec §9 gate 2, the founder's read of the twenty pairs, is what catches the rest, which is why the report puts them side by side.
