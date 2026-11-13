# Build T0b — keep the manager's written reason on every Mandate decision

**Date:** 12 Nov 2026 (the session ran past midnight UTC into 13 Nov) · **Built by:** Claude Code (Opus) · **For:** the founder, and Astra's review of T0a, T0b and T0c as a set
**Base:** stacked on T0a. Branch cut from `origin/claude/practice-field-t0a-sector-cap` at `eb4d9b56` (draft PR #1046); `origin/main` at `c37baa0d`. Both fetched at session start and again before the push; unchanged throughout.
**Branch:** `claude/practice-field-t0b-decision-rationale`. **Draft PR:** against the T0a branch, so its diff shows only this build; it retargets to `main` once #1046 merges. Not merged; CI not watched.
**Commits:** `71f20b00` the build · `e309fe26` the tripwire on the full Linux closure · `e1aea3fd` the review fixes · `f530604a` the bounded-prefix cut · `2de10f9c` one test row · `d18f5dc3` the tripwire calibrated by the refuters · `0b66bf64` the first report · `c76acd5d` the prefix row pinned without a clock (code head) · the report commit that carries this text.
**Inputs:** the T0b build prompt; concept V6.1 §2, §8, §9 and rulings 16–17; Astra's V5 review B7 (rationale, permissions and conviction) and V6 review C6-10 (about nominations; its "store the reason" applies there, and was read for consistency). Fenced files were not touched; no flag, Firestore, model or EODHD call was made.

| Question | Verdict |
|---|---|
| Is the reason kept on every decision record written from a model answer? | Yes, on both paths, including refused decisions; bounded and labelled. On the live direct path a malformed or missing answer still writes no record at all (question 1) |
| Can a record grow past Firestore's limit? | No: every long string is capped where the record is built; worst case 5,484 bytes |
| Does anything read the stored reason? | No: a tripwire, per-file pins and canary rows guard it; the honesty registry is unchanged |
| Tests | Full Linux suite exit 0 (1,406 files); lint gate exit 0; 49 / 49 mutants killed |
| Review | Three lenses, two refuters: no must-fix; should-fix findings fixed |
| For the founder | Five questions (§6); the first concerns the live direct path |

## 1. In plain terms

**What was missing.** Every time the Mandate engine asks its model for a decision, the model must write two to five sentences of reason and may give a 0–100 conviction number. The engine kept both for a moment and then threw them away: the decision record had no field for either. The Practice Field's idea book will show the agent's reason beside every move, so the reason has to be kept.

**What now happens.** Every decision record carries seven new fields:

| Field | What it holds |
|---|---|
| `rationale` | The model's reason, word for word, or empty (`null`) when there is none. At most 1,200 characters, cut between whole characters (an emoji or an accented letter is never split) |
| `rationaleStatus` | `present` (kept whole), `truncated` (cut to the limit) or `absent` (no reason stored; the record's existing failure reason says why) |
| `convictionDiagnostic` | The model's own 0–100 number, rounded and kept within 0–100, or empty. Named "diagnostic" because it is self-reported and uncalibrated: never a probability, never shown as confidence |
| `modelId` | Which model wrote the reason (from the frozen settings the book runs on). Empty means no model answer stood behind the record when it was written |
| `generationConfigVersion` | A fingerprint of the frozen model settings (model, temperature, length limit) that produced the reason |
| `rationaleAt` | When the reason arrived |
| `rationaleAtBasis` | Which clock `rationaleAt` came from: the direct answer's arrival, the provider's batch finish time, or (only if that is unreadable) the time the engine collected it |

**Both ways the engine talks to the model** — one call at a time ("direct", which production uses today) and in batches — write the same fields. A decision the engine refuses (the rules said no, the result was stale, or it arrived too late) keeps the reason, so the screen can show why the agent wanted to act and why the engine said no. A batch answer the engine could not use (the book was deleted, its frozen rules could not be read, or the answer was malformed) also keeps its reason when one was in the answer. Where there is no answer at all (the provider errored, the answer never came, the book's term ended first), the record says `absent` and its existing failure reason explains why; it never stores an empty string pretending to be text.

**Size.** A decision record now has three strings the model or the provider can make long: the reason, the ticker the model names, and the failure reason. All three are capped where the record is built (1,200, 32 and 200 characters), so no caller can store more. Real tickers are at most 5 characters and real failure reasons about 48. A test builds the worst possible record, feeding all three far past their caps: it measures 5,484 bytes by Firestore's own size rules, about 0.5% of the 1 MiB limit (the test asserts under 8 KiB).

**Nothing reads it.** Nothing in this build shows, fetches or feeds the stored reason anywhere: not a prompt, not memory, not consolidation, not a screen. A new test watches for it (§4). The Mandate honesty registry's inputs are unchanged: `api/_utils/__fixtures__/mandatePromptRegistry.js` (with its closed input list `MANDATE_PROMPT_INPUT_SOURCES`), `api/_utils/__fixtures__/promptHonestyRegistry.js`, `mandatePromptAssembly.js`, `mandateContextBlock.js` and the model-visible tool `mandateDecisionTool.js` are byte-identical to T0a's head. The book's owner can already read decision records from their own client by rule (`firestore.rules:1457–1460`, unchanged); that is access, not a reader in code, and ruling 16 binds any future screen ("never shown as confidence").

**What it does not do.** It does not check the "two to five sentences" (that is an instruction to the model; a one-sentence reason is still a reason). It does not change the tool the model sees. It does not add a record where the engine wrote none before: on the direct path, a malformed or missing answer still leaves no record at all (§6, question 1).

**Tests.** The full suite passes on Linux at the code head (1,406 test files, 31,095 tests, exit 0), as does the lint gate. The new tests drive present, absent and truncated reasons through both paths, a clamped and an empty conviction, refused decisions that keep their reason, the size bound and the no-reader tripwire. Each of 49 deliberate re-breakings of the build (dropping the reason on a path, mislabelling a status, removing a cap, planting a reader) turns at least one test red. A three-lens review with two refuters found no must-fix; its should-fix findings are fixed, and five questions for you are in §6.

## 2. Changes by `file:line`

All anchors are at `c76acd5d`, the code head (the product files are unchanged since `d18f5dc3`).

**The limits** — `api/_utils/mandateConfig.js:68` `MANDATE_RATIONALE_MAX_CHARS = 1200` (UTF-16 units, the JavaScript string length; at most 3,600 bytes once stored); `:74` `MANDATE_DECISION_TICKER_MAX_CHARS = 32`; `:75` `MANDATE_DECISION_FAIL_CONDITION_MAX_CHARS = 200`. The file sits on the Mandate prompt path; the new lines are constants and a comment and reach no prompt.

**The rules for the fields** — `api/_utils/mandateRationale.js` (new, pure, Node-clean):
- `:43` the three statuses, with what `absent` covers; `:53` the three time bases; `:56` the field list.
- `:88` `cutAtGrapheme`: the longest run of whole characters within the limit. It segments only the first limit + 2 units (`:92`): every character-boundary rule needs one character of look-ahead, so the cut is the same as on the whole text, at a fixed cost. A single "character" longer than the limit falls back to a cut that never splits a surrogate pair and is never empty.
- `:114` `boundRationale`: a non-string or blank reason is `absent` (`null`); outer spaces are dropped and a broken UTF-16 character becomes U+FFFD (`:119`), the two stated exceptions to "word for word"; longer than the limit is `truncated`.
- `:132` `capStoredString` (ticker and failure reason); `:147` `convictionDiagnosticOf` (the normaliser's own rule, so applying it twice changes nothing); `:158` `generationConfigVersionOf` (`seat_` + 16 hex characters of the canonical hash of the frozen model seat); `:169` `responseAttribution`; `:183` `rationaleRecordInputs`.

**The record** — `api/_utils/mandateSchema.js` `buildDecision`: `:285` bounds the reason itself, so every writer's record is bounded by construction; `:290` caps `ticker`; `:312` caps `failCondition`; `:325–331` the seven fields, added at `schemaVersion` 1 (the precedent the file records for later additions). Records with no model answer (close-pass expiry, rollover and escape cancels, the corporate-action forced exit, every answer-less batch outcome) take the defaults: `absent`, all attribution empty.

**The execution boundary** — `api/_utils/mandateExecution.js`: `disposeSubmission` takes `rationale`, `conviction` and `attribution` (`:368`, written at `:404`); `executeDecision` takes `attribution` (`:447`), builds the reason inputs once (`:454`) and writes them on every terminal (`:483`, executed at `:627`). A replay of an already-claimed record never adds a reason to it; the claim stays exactly-once. No write, revision bump, counter or gate change was added.

**The direct path** — `api/cron/mandate-evaluate.js`: `runBookEval` takes an injectable `clock` (`:94`, default the real time); the attribution is built after the model call returns (`:203–205`) and passed to execution (`:228`).

**The batch path** — `api/_utils/mandateBatchTransport.js` `processSucceededResult`: the model's decision input is read once, up front (`:315–319`; the read is pure and needs neither book nor rules), and its reason rides the book-missing (`:331`, `:337`), missing-rules (`:355`), malformed-answer (`:373`) and execution (`:415`) outcomes; the attribution uses the re-read frozen seat and the provider's batch finish time, threaded in at `:680`. The order of outcomes, billing, leases and health bookkeeping are unchanged.

**Fenced files read, none edited.** `git diff eb4d9b56 c76acd5d` touches no BUILD_RULES §1 file and no flag. No fenced function is called by the new code; no legacy archetype table is newly imported (`archetypeImportBoundaryBaseline.json` unchanged). The protected-store write-site census is unchanged: no write call was added or moved.

**Tests changed or added**
- New: `api/_utils/mandateRationale.test.js` (the bound, the cut, conviction, attribution, the builder, the size bound at `:266–299`, answer-less records) and `api/_utils/mandateRationale.imports.test.js` (the tripwire, §4).
- `api/cron/mandate-evaluate.test.js:385–470`: the direct path — present, absent, truncated, conviction clamped and empty, gated and refused keep the reason, the clock read after the answer, and a canary row.
- `api/_utils/mandateBatchTransport.test.js:702–826`: the batch path — present, truncated, absent, gated, refused and expired keep the reason; a malformed answer, missing rules and a deleted book keep the reason in hand; no tool use, a provider error and a missing row are `absent` with empty attribution; a 6,000-character ticker is stored capped at 32; the time-basis fallback; a canary row.
- `api/_utils/mandateMoneyRounding.scan.test.js:75`: the conviction clamp's one `Math.round` joins the money-path rounding baseline under the existing "clamp — not money" classification (the same rule's site in `mandateDecisionTool.js` is already listed).

## 3. Tests

**The record run** — Linux (WSL Ubuntu), a private worktree of the shared CI clone at `c76acd5d`, Node 20.20.2 (CI's version), the install matching the lockfile (`40382e64edb6`), under the shared suite lock:

```bash
TZ=UTC flock /tmp/pd-suite.lock npx vitest run --maxWorkers=8
```

Exit code **0**, 265 s. Read directly from the log:

```
 Test Files  1406 passed | 9 skipped (1415)
      Tests  31095 passed | 107 skipped (31202)
```

Earlier full runs, same command: `e309fe26` (before the review fixes) and `d18f5dc3` both exited 0 with `Test Files  1406 passed | 9 skipped (1415)`, and so did `0b66bf64` (`d18f5dc3` plus the first report).

The 39 Mandate test files, run alone on Linux, pass at `e309fe26`, `f530604a`, `d18f5dc3` and `c76acd5d` (673 tests at the last two). They did not pass at two commits, both fixed before the next:
- `71f20b00`: two files red. The first tripwire, on the full Linux import graph, met the pure record modules and an unrelated log stream named "decisions" (§4 explains the edges and the pin); the money-path rounding scan needed the conviction clamp in its baseline. Fixed at `e309fe26`.
- `e1aea3fd`: two rows timed out under load: the whole-input character segmentation, which cost about 3 s on Node 20 (fixed at `f530604a`), and a file scan that read every file twice (fixed at `d18f5dc3`).

The lint gate (`npm run lint:gate`, `eslint . --config eslint.gate.config.js --max-warnings 0`) exited 0 at `d18f5dc3` and at `c76acd5d`. The production build (`npx vite build`) exited 0 at `0b66bf64`. The build, the lint gate and a full suite run on the pushed head, which adds only this report and its index row; their results are in the PR description.

**Windows note.** On this Windows checkout, five Mandate test files fail for reasons that predate T0b and are path-related: four closure scans (the walker issue in §6, now including the new tripwire's three-hop self-check, which fails loudly as intended) and `mandateNativeEsm.smoke.test.js` (it imports a `C:\` path). CI runs Linux, where all pass.

## 4. The no-reader tripwire

`api/_utils/mandateRationale.imports.test.js` (the `*.imports.test.js` precedent) has two scans; the canary rows on both paths are its runtime half.

1. **Every prompt assembler under `api/`** — each module in the battle registry and the Mandate registry, plus every `api/` module with "prompt" in its path — and everything they import, followed through the whole import graph. None may name the decisions store, none may name a field only this build writes, and none may reach a module that writes decision records. Two pure modules are reached legitimately, through a pre-T0b chain (the Mandate prompt → the price snapshot → corporate actions → the record shapes → the new rules module). They may be imported there only through those two pinned import lines, with exactly the pinned names, and their own imports must stay free of any database access.
2. **All of `api/` and `src/`** — every mention of the decisions store is pinned per file at its reviewed count (four writers, plus one unrelated Cloud Storage log stream that happens to be called "decisions"), and the new field names appear only in the five writer files. A future reader — a screen, a memory pass, a helper inside a writer whose result feeds a prompt — moves a pinned count, which is a deliberate review event.
3. **Canary rows** (`mandate-evaluate.test.js:443`, `mandateBatchTransport.test.js:793`): a unique reason, sent through an executed and a gated decision on the direct path and an executed one on the batch path, is found in exactly one stored place — its decision record — not in what the handler or the harvest returns, and not in the next Mandate prompt built from the stored book.

**The pins against other branches.** Scan 2's per-file counts would turn red after a merge if another branch added a decisions-store mention. All 1,157 local and remote branch heads were checked before the push: only the five pinned files ever contain one, and `main`, T0a and T0c hold exactly the pinned counts. Fifteen stale branches carry an older `mandateExecution.js` with one mention.

**Stated blind spots** (in the file's header): "rationale" is an ordinary word and cannot be banned by name; prompts built inline outside the prompt-named modules are covered by scan 2 and the canaries, not scan 1; the import walk follows static `import … from` and `export … from` lines only; a store name built at run time evades the pin; scan 2 covers `api/` and `src/`, not `scripts/`.

## 5. The §2 self-review, with refuters

The cumulative diff crosses the review threshold (11 files), so the BUILD_RULES §2 review ran in full: three independent lenses, each on its own read-only `git archive` snapshot of `e309fe26`, then two refuters on fresh snapshots, each told to refute every finding with a concrete repro. The mutating lens (the mutation battery) ran last, on its own WSL worktree.

| Lens | Findings | After refutation | Disposition |
|---|---|---|---|
| A — the bound and the fields | 3 should-fix, 6 notes | A1 confirmed; A3 confirmed (severity disputed; its "failure reason is model-written" half refuted: provider-written); A4(b) and A6's second half refuted; the rest confirmed as notes | A1, A3 fixed; A4(a), A6 first half, A7 worded; A2, A5, A8 → §6 |
| B — wiring and lifecycle | 1 should-fix, 6 notes | B1 confirmed (its read-error half predates T0b); B2 confirmed, its "cannot be told apart" refuted (status, failure reason and model id separate the cases); B3–B7 confirmed as notes | B1 fixed; B2 worded; B3, B4, B6 → §6; B5, B7 noted |
| C — no reader, honesty, fence | 5 should-fix, 5 notes | C1–C5 confirmed (C5's false pass is Windows-only); C8 severity disputed; C10's scope half refuted | C1–C5 fixed; C6–C8, C10 worded |

No must-fix was found. No fenced file, flag, prompt input or tool text changed. Each lens's own canary or path walk found no reader at `e309fe26`.

**What the fixes changed** (`e1aea3fd`, `f530604a`, `2de10f9c`, `d18f5dc3`, `c76acd5d`):
- *Reasons in hand kept (A1/B1).* The batch harvest now reads the model's decision input before anything else, so a book-missing or missing-rules outcome keeps the reason instead of labelling it `absent`.
- *Size by construction (A3).* The ticker and failure reason are capped where the record is built; the size test feeds all three long strings past their caps.
- *Tripwire (C1–C5).* Canary rows; store mentions pinned per file (catches a store name held in a constant, a nested call, and a new reader inside a writer); the exemption became two pinned import lines (catches a formatter routed through another module); the self-check reaches three hops (a shallow walk now fails loudly).
- *Found in the fix pass.* On Node 20 (CI's runtime) the character-boundary engine took 3.5 s on a 2-million-character input, and the record is built inside the execution transaction. The cut now looks at the first limit + 2 units only (2 ms), with the same result; a row pins the look-ahead.
- *Calibrated by the refuters.* The field-name check became "only the writers" (one writer names the fields in comments only); prompt roots match "prompt" anywhere in the path; `.cjs` files are scanned; the scan rows read each file once and carry a 30-second limit (a loaded run crossed 5 s).
- *Wording.* What `absent` covers; the batch time bases (the fallback is the fire's start time, not an upper bound); conviction as uncalibrated self-reported confidence; the two stated non-verbatim edits.
- *A final check before the push.* The look-ahead row first pinned the cut's cost with a wall clock, which caught whole-input segmentation only on Node 20 (22 ms on Node 22) and could fail on a stalled runner; it now spies on what is segmented (`c76acd5d`). The same check corrected three over-statements in the first report (`0b66bf64`): a verdict row that left out the direct path's record-less answers, a claim that the Mandate tests passed at every commit, and the batch canary's scope.

**Refuted, with the reason.** A3's "the failure reason is model-controlled": every suffix is a fixed string or a provider error type. A4(b): the time basis already said `batch_ended` is a batch-level time. A6's empty-model-id case: unreachable, because the request builder refuses an empty model; the one-line consistency edit stays. B2's "cannot be told apart": status, failure reason and model id never collide. C10's scope half: the header already stated `api/` and `src/`. A7's "not stated": the trimming and U+FFFD were in the function's doc; only the status line was loose (now fixed).

**Mutation.** 49 mutants, run at `c76acd5d` on their own WSL worktree, each judged by the test run's exit code and its JSON report (a crashed worker cannot read as a kill), each file restored from `git show HEAD:` and the tree checked clean after every one: **49 / 49 killed** in one run. They cover the bound and the cut (10, including no look-ahead and half a character of look-ahead), conviction (1), the seat fingerprint and model id (2), the builder's bounds and defaults (4), each path's reason and attribution (17: execution boundary 3, direct 3, batch 11), the caps (3), and the tripwire (12: eleven planted readers, the review's C1–C4 exploits among them, and the walk cut to one level, C5). At `d18f5dc3` one mutant was first reported BROKEN, not survived (its anchor predated the `||` edit); with the anchor corrected it was killed there too. The first 35 were also all killed at `e309fe26`, before the fixes.

**Not covered.** The fix pass had no fresh review lens of its own; it was checked by the suite, the mutants and the refuters' calibration. The reason's behaviour against the live provider is untested (no model calls by rule).

## 6. Found outside the task, and questions for the founder

**Questions** (each is a reading this build took; none blocks it):
1. **Direct transport keeps no record of a malformed or missing answer** (`api/cron/mandate-evaluate.js:206`, `:209`, pre-existing). Production runs direct today (`src/config/featureFlags.js:1983`), so on the live path such a reason is dropped with no record, while batch now keeps it. Writing a record there would move the book's revision and liveness counters, so it was not added. Should a later build write one?
2. **Records claimed before any answer existed** (the batch age-out, the eval sweep's gate expiry, close-pass expiry, rollover and escape cancels, drain) stay `absent` with no model id, even when a paid answer arrives later: the record is claimed exactly once, and adding to it later would break that. This build reads "an expired decision keeps its rationale" as the expiry the engine decides on an answer it holds (tested). Is that the intended reading, or should a late answer's reason be logged elsewhere?
3. **An answer cut off at the token limit is still executed, and its reason would be labelled `present`** (no `stop_reason` check on either path; pre-existing). The tool asks for the reason last and the limit is 600 tokens. Should a later build refuse a cut-off answer, or at least mark its reason `truncated`?
4. **`generationConfigVersion`**: no version name existed for the model settings, so it is a fingerprint of the frozen seat (`seat_` + 16 hex). It is fully determined by the book's frozen-rules reference, which the record already carries. The alternative, a version stamped into the frozen rules, would change every frozen-rules fingerprint (production holds none today, per T0a's census). Keep as built?
5. **Indexing** (optional): the reason (up to 3.6 KB) gets Firestore's default single-field indexes. Exempting it in `firestore.indexes.json` would need a deploy; not done here.

**Found, not fixed** (for separate tasking):
- Batch harvest: a read error on the frozen rules is swallowed and cached as "no rules" for the whole fire (`api/_utils/mandateBatchTransport.js:675`), so a blip turns every paid answer on those rules into a terminal failure that counts toward quarantine. The submit-snapshot read leaves the batch open instead (the INV-P5-7 rule). Pre-existing (P5).
- Rollover and escape write the decision record without checking whether it already exists (`api/_utils/mandateRollover.js:224`, `api/_utils/mandateEscape.js:166`); the close pass and the execution boundary check first. In the stale-gate state an ops restore can create, an executed record (now with its reason) would be overwritten by a cancellation. Pre-existing.
- The import walker used by the closure tests (`api/_utils/__fixtures__/mandateEvalPathClosure.js:34`) returns Windows paths with backslashes and stops after one level on Windows; the closure tests (including the new tripwire's self-check) fail on Windows only. One-line fix: `relative(…).split(sep).join('/')`. CI runs Linux, where the walk is complete.
- A model answer containing a "thinking" block beside a valid decision is rejected whole (`api/_utils/mandateModelCall.js:134`). Unreachable on today's seat; a future seat that thinks by default would fail every answer.
- The batch time parser accepts non-string values (`toMs`, `mandateBatchTransport.js:495`): a malformed provider end time of `true` or `0` would read as 1970 and give a negative turnaround. The provider's contract is a string or nothing.
- The prompt-template version on every record is always empty (`mandate-evaluate.js:178`, pre-existing); the generation fingerprint does not cover prompt text.
