# Build — The eval harness keeps what it measured

**Session:** Claude Code, fresh session, prescribed build.
**Branch:** `claude/eval-harness-run-records`, cut from the fetched `origin/main`.
**HEAD at cut:** `1f7dd875ad542fd2db4d072d44dd53308fa17d84` (merge of PR #863, the Jev
direction-judge branch). Local tree clean at open: no tracked modifications, nothing
staged, **no untracked files present**.
**`git fetch origin` run first** (BUILD_RULES §3). Local `main` was already level with
`origin/main` at `1f7dd875`; the branch was cut from the fetched remote ref.
**Discovery of record:** `docs/audits/20260918_JEV_DIRECTION_JUDGE_EXPERIMENT.md` §1
finding 2 and §9 — this build's Phase 0.
**Markers:** VERIFIED = read at that line, at this HEAD, in this session.

---

## Executive verdict

| | |
|---|---|
| **Verdict** | **DONE — pushed, not merged.** Every §0 gate line passed; every §2 test is present, collected and shown failing under the defect it names. |
| What changed | The harness now writes **one file per run** under `runs/`, carrying the result for **every ask**. Previously it kept only totals, in one file each run overwrote. |
| Grading logic | **Untouched.** `aggregate.js` and `corpus.js` are byte-identical to the cut HEAD. No rate, tally or classification was moved, reordered or reformatted. |
| Does any reported number move? | **No — proven, not asserted.** `last-run-report.json` is byte-identical (sha256 match) with and without the one record field this build added. See §5. |
| `last-run-report.json` | Same path, same keys, same values, still overwritten each run. Anything reading it keeps working. |
| Run files committed? | **Never.** `runs/` is in the directory's own `.gitignore`. |
| Lint gate / build | `npm run lint:gate` **exit 0** · `vite build` **exit 0** |
| Full suite | **exit 0** — 695 files (692 passed, 3 skipped), 13,633 tests. Identical failing-file set to the cut HEAD (**empty at both**); the delta is exactly the one new test file. |
| Files changed | 5, all inside `api/scripts/archetype-integrity-eval/`. **No §1 fenced file touched.** |
| Live harness run | **Not made**, as instructed — it would spend ~140 Gemma calls. The smoke is the founder's (§8). |
| Deviations | 7, each enumerated with its reason (§9). None silent. |

### In plain terms

The harness that grades the directive gate works out a verdict for each of its 140
asks, then used to throw the per-ask results away and save only the totals — into one
file that every run overwrote. That is why the Sep 17 pre-flight numbers no longer
exist on disk, and why nobody can say *which* asks Gemma filed, mis-filed, or refused.

It now saves every run to its own file, with the per-ask results inside: the ask text,
what the gate decided, which adjustment was filed, whether the agent refused, and the
agent's actual reply. The totals file it always wrote is unchanged and still there.
Nothing about how the harness grades anything was altered, and no number it reports
moves. Run files stay on your machine — they are never committed.

---

## 1. The §0 gate (read-only)

| # | Gate line | Result |
|---|---|---|
| 1 | Branch cut as named; HEAD recorded; untracked files left alone; new files added by explicit path | **Pass.** Branch `claude/eval-harness-run-records` cut from `origin/main` @ `1f7dd875`. Tree was clean — **no untracked files existed** to leave alone. Both new files added by explicit path. |
| 2 | `20260918_JEV_DIRECTION_JUDGE_EXPERIMENT.md` is on `main` | **Pass.** `git cat-file -e origin/main:docs/audits/20260918_JEV_DIRECTION_JUDGE_EXPERIMENT.md` succeeds (VERIFIED). |
| 3 | Re-verify the two sites the report names, at this HEAD | **Pass — both exactly where reported.** Detail below. |
| 4 | `runEval.eval.mjs` is not a §1 fenced file; this build edits no fenced file | **Pass.** Detail below. |

### Gate 3 — the two sites, as they are now

Both anchors are **unchanged from the report's citations** — no drift.

| What the report said | At this HEAD | Status |
|---|---|---|
| per-item `records` array at `runEval.eval.mjs:258-265` | `const records = [];` at `:258`; filled by the `RUNS_PER_ITEM` loop `:259-265` (`records.push(...runRecords)` at `:264`) | **VERIFIED, line-exact** |
| aggregate-only write of `last-run-report.json` at `:290-293` | `writeFileSync(` `:290` · `join(HERE, 'last-run-report.json'),` `:291` · `JSON.stringify({ meta, agg, hardZeroBreaches, ts: new Date().toISOString() }, null, 2),` `:292` · `);` `:293` | **VERIFIED, line-exact** |

**The STOP condition did not fire.** `records` is declared at `:258` inside the same
`it()` callback as the write at `:290-293`, so it is in scope at the write site — the
array the harness had in hand and discarded. (Line numbers above are the **cut HEAD**;
post-change anchors are in §3.)

### Gate 4 — the fence

`api/scripts/archetype-integrity-eval/runEval.eval.mjs` appears on **none** of the
eleven paths in BUILD_RULES §1. Nor do the other four files this build touches — all
five live under `api/scripts/archetype-integrity-eval/`, a directory the fence does not
name. Checked mechanically: every §1 path was tested against `git status --porcelain`
and **none is modified**.

**Importing is not editing, and nothing the harness imports was changed.** The harness
still imports exactly `voiceLayerPrompt.js`, `gemmaClient.js`, `directiveGate.js`,
`directiveIdentity.js`, `./corpus.js`, `./aggregate.js` (`:59-64`), by the same dynamic
`await import` that keeps them below the `vi.mock`. The fenced modules those pull in
transitively are read and called, never edited. The one import **added** is the new
zero-import local helper (§3). The §2.3 import-boundary ratchet is not tripped: no new
direct importer of a legacy archetype table exists — the helper imports nothing at all.

---

## 2. `git diff --stat`

```
 api/scripts/archetype-integrity-eval/.gitignore    |  4 +++
 api/scripts/archetype-integrity-eval/README.md     | 38 +++++++++++++++++++---
 .../archetype-integrity-eval/runEval.eval.mjs      | 38 ++++++++++++++++++++--
 3 files changed, 74 insertions(+), 6 deletions(-)
```

plus two new files, added by explicit path:

```
?? api/scripts/archetype-integrity-eval/runFile.mjs       (144 lines)
?? api/scripts/archetype-integrity-eval/runFile.test.js   (13 tests)
```

Five files, all within the §1 allowance (`runEval.eval.mjs`, one new zero-import helper
beside it, its test, that directory's `.gitignore`, that directory's `README`). Nothing
under `src/`. No corpus change, no flag change, no vitest-config change.

**A sixth file — this report —** is added at
`docs/audits/20260918_BUILD_EVAL_HARNESS_RUN_RECORDS.md`, required by §4. It is the only
file outside `api/scripts/archetype-integrity-eval/`, it is documentation, and it was
untracked when the `git diff --stat` above was taken.

---

## 3. Each change, with `file:line` **after** the change

### A — a run file per run

| Change | After | What it does |
|---|---|---|
| `node:fs` named imports extended | `runEval.eval.mjs:28` | `existsSync, mkdirSync` added alongside the existing `writeFileSync`. Same module, no new dependency. |
| helper imported | `runEval.eval.mjs:31-34` | `import { buildRunFile, resolveRunFileName, runFileName } from './runFile.mjs';` — **static** on purpose: the helper is zero-import, so hoisting it above the `vi.mock` pulls none of the mocked graph in early. The product modules keep their dynamic `await import`. |
| one clock for both files | `runEval.eval.mjs:299-301` | `const ts = new Date().toISOString();` hoisted so the aggregate's `ts` and the run file's stamp name the same instant. |
| `runs/` created, name resolved, file written | `runEval.eval.mjs:314-324` | `mkdirSync(runsDir, { recursive: true })` `:316`; `resolveRunFileName(runFileName(ts, meta), …)` `:319`; the write `:321-324`. |
| the path is the run's last line | `runEval.eval.mjs:329` | `console.log(\`[eval] run file: ${runPath}\`)` — the last statement in the test body. |
| `runs/` gitignored | `.gitignore:4-6` | Run files are never committed. |

Name shape (`runFile.mjs:57-60`): `<stamp>_<fit-on|fit-off>.json`, e.g.
`20260918T035031Z_fit-off.json`.

- `<stamp>` is UTC `YYYYMMDDTHHMMSSZ` (`runFile.mjs:37-44`) — built by stripping the
  ISO-8601 dashes and colons and the fractional seconds. It contains **no character
  from `< > : " / \ | ? *`**, which the founder's Windows checkout requires. The
  `fit-on`/`fit-off` half keeps its hyphen, which Windows accepts.
- The fit half reads **`meta.fitCheckEnabled`** (`runFile.mjs:58`) — the same value the
  report header already prints at `runEval.eval.mjs:208`, stamped into `meta` at `:282`.
  A pre-flight run and a baseline run therefore can never land on one name: exactly the
  collision that destroyed the Sep 17 numbers.
- **Never overwrites** (`runFile.mjs:74-84`): if the name is taken the next is
  `-1`, `-2`, …, suffixed before the extension, walking until one is free. A defensive
  ceiling (`runFile.mjs:31`) makes a pathological filesystem probe fail loudly rather
  than hang a two-hour run at its last step, after the Gemma calls are already spent.

### B — `last-run-report.json` is untouched

`runEval.eval.mjs:303-308`. Same path, same four keys in the same order
(`{ meta, agg, hardZeroBreaches, ts }`), same values, same `JSON.stringify(…, null, 2)`
formatting, still overwritten by every run. The only textual change is that `ts` is now
a hoisted const rather than an inline `new Date().toISOString()` — the same expression,
evaluated microseconds earlier, under the same key. Anything reading this file keeps
working. §5 proves the file is byte-identical.

### C — what each record carries

Serialised by `buildRunFile` (`runFile.mjs:136-144`), which projects each record through
`toRunRecord` (`runFile.mjs:92-123`). The projection **spreads the harness record first**,
so nothing it already carried is lost, then stamps the guaranteed fields — normalising an
absent one to `null` rather than letting it vanish.

**Every field §1C requires is present.** Ten of the twelve were already on the record and
are passed through; one is a re-statement of a field already on the record; one was added.

| §1C requires | In the run file as | Where it comes from | In scope at the write site before this build? |
|---|---|---|---|
| the corpus item id | `corpusItemId` (falls back to `itemId`) | `runEval.eval.mjs:136`, `:169` | **Yes** — passed through |
| archetype | `archetype` | `runEval.eval.mjs:169` | **Yes** — passed through |
| item kind | `category` (+ `subtype` for the finer label) | `runEval.eval.mjs:169`, `:137` | **Yes** — passed through |
| the ask text | `userMessage` | `runEval.eval.mjs:137` | **Yes** — passed through |
| `expectedAdjustmentId` | `expectedAdjustmentId` | `runEval.eval.mjs:170` | **Yes** — passed through |
| `expectedCommit` | `expectedCommit` | `runEval.eval.mjs:138` | **Yes** — passed through |
| `expectedHardOutcome` | `expectedHardOutcome` | `runEval.eval.mjs:139` | **Yes** — passed through |
| the gate's classification | `gateClassification` | lifted from `archetypeGate.classification`, already on the record at `runEval.eval.mjs:182` (the gate stamps it at `directiveGate.js:257`) | **Yes** — surfaced to the top level for readability; the full `archetypeGate` object is still there too |
| the id filed (or null) | `selectedId` | `runEval.eval.mjs:177` | **Yes** — passed through |
| whether the agent refused | `refused` | derived at `runFile.mjs:116` from `committed` (`:173`) and `archetypeGate.status` (`:182`) | **Yes** — both inputs already on the record |
| the fit-mismatch flag | `fitMismatch` | `archetypeGate.status === 'fit_mismatch'` at `runFile.mjs:120` — the gate's **own** status field, the same one `aggregate.js:54` reads | **Yes** — passed through as a flag |
| the agent's reply text | `replyText` | **ADDED** at `runEval.eval.mjs:191` | **This is the one exception — see below** |

**The one field that was not already on the record: the reply text.** The record did not
carry it. The value itself, however, was already in hand *inside the same function that
builds the record* — `gate.parsed?.response` is read seven lines above, at
`runEval.eval.mjs:184`, and handed to the prose-overclaim heuristic. Carrying it onto the
record is one line reading a local that the harness had already computed. **Nothing was
fetched from the chat pipeline and nothing was invented**: no module was imported, no call
was made, no value was reconstructed. This is recorded as an enumerated deviation (§9,
D2) with its no-number-moves proof in §5, because §1C's fallback ("say so in the report")
was written for a field that is genuinely unavailable, and this one was one line away.

Two notes on what the two derived booleans do and do not mean, both written into the
module so a future reader cannot mistake them:

- **`refused`** (`runFile.mjs:112-116`) says *the turn filed nothing and it was not the
  fit check refusing the quote*. It is category-blind and it is **not** a judgement that
  the refusal was wrong. Whether a refusal was a **false** refusal is graded against
  `expectedCommit` by `aggregate.js`, which this build does not touch. On a
  `core_conflict` ask `refused` is `true` and that is correct — the agent did decline to
  file; the grading of whether declining was right stays where it always was.
- **`fitMismatch`** (`runFile.mjs:117-120`) is the gate's own `status`, not a re-derived
  verdict — the split the fit-check record (§7 J7) exists to preserve: a paraphrase is
  neither a refusal nor a wrong id.
- On a **failed call** both are `null`, not `false` (`runFile.mjs:96-98`, `:116`, `:120`):
  no gate outcome exists, so neither is a fact about the agent on that turn.

**Everything else the record already carried is still in the file** (the spread at
`runFile.mjs:94`): `index`, `runIndex`, `expectedClassification`, `callFailed`,
`proposalPresent`, `schemaValid`, `committed`, `directiveStatus`, the full `archetypeGate`
outcome, `repairUsed`, `proseAssertsChange`, the full `proposal` Gemma emitted,
`committedDirectiveText`, and `error` on a failed call.

### D — the helper

`api/scripts/archetype-integrity-eval/runFile.mjs` — **zero imports** (verified: the file
contains no `import` statement and no `require(`). The harness calls it; the tally logic
was **not moved, reordered or reformatted** — `aggregate.js` is byte-identical to the cut
HEAD.

| Export | Line | Contract |
|---|---|---|
| `runFileName(ts, meta)` | `:57` | the Windows-legal `<stamp>_<fit-on\|fit-off>.json` name. Accepts an ISO string or a `Date`; normalises to UTC. |
| `buildRunFile({ meta, agg, hardZeroBreaches, ts, records })` | `:136` | `meta`, `agg`, `hardZeroBreaches`, `ts` passed through **by reference, unread and unmodified** — the run file reports the aggregate *by construction*, never by recomputation, so the two files cannot disagree. `records` projected through `toRunRecord`. |
| `resolveRunFileName(name, exists)` | `:74` | the never-overwrite rule, with the filesystem probe injected so it is testable without a disk. **A third export beyond the two §1D names** — see deviation D3. |

The module grades nothing, tallies nothing and classifies nothing; every side effect
(the clock, the filesystem probe, the write) stays with the caller. That is what makes
it unit-testable without a live run.

---

## 4. Tests — each with its shown-failing evidence

`api/scripts/archetype-integrity-eval/runFile.test.js`, **13 tests, all passing**.

**Collection confirmed.** The default vitest config collects this directory — it already
collects `corpus.test.js` and `aggregate.test.js` from it (`npx vitest list` lists them),
and `vitest.config.js` narrows only `research/level-study/tests/**`. The new file was
placed beside them and appears in the full-suite run (§6). It is **not** collected by
`vitest.eval.config.mjs`, whose include is `**/*.eval.mjs`, so it never triggers a Gemma
call. `runFile.mjs` is likewise not collected there (it is not `*.eval.mjs`).

**Mutation checks (BUILD_RULES §2 — a row that cannot fail under the defect it names is
not a guard).** Seven defects were injected into `runFile.mjs` one at a time; the source
was restored byte-identical after each (`diff -q` against a pristine copy: clean).

| # | Defect injected | Test that caught it | Assertion shown |
|---|---|---|---|
| M1a | stamp keeps the ISO colons and dashes | *contains no character that is illegal in a Windows file name* | `expected '2026-09-18T03:50:31.123Z_fit-on.json' not to match /[<>:"/\\|?*]/` — plus 3 more |
| M1b | stamp truncated to minute resolution | *differs for two timestamps one second apart* | `expected '20260918T0350Z_fit-off.json' not to be '20260918T0350Z_fit-off.json'` |
| M1c | fit flag ignored (pre-flight and baseline share a name — the Sep 17 failure) | *differs for fit-on vs fit-off at the SAME instant* | `expected '20260918T035031Z_fit-off.json' not to be '20260918T035031Z_fit-off.json'` |
| M2a | `meta` recomputed instead of passed through | *returns meta, agg, hardZeroBreaches and ts deep-equal to its inputs* | `expected { Object (itemCount, runsPerItem, …) } to deeply equal { Object (…) }` |
| M2b | a record dropped on the way to the file | *returns one record per input record* | `expected [ { …(20) } ] to have a length of 2 but got 1` — plus 3 more |
| M2c | projection writes back into the harness's own record | *mutates none of its inputs* | `expected { Object (meta, agg, …) } to deeply equal { Object (meta, agg, …) }` |
| M3 | no-overwrite rule removed | *suffixes -1 when the name exists, and -2 when -1 exists too* | `expected '20260918T035031Z_fit-off.json' to be '20260918T035031Z_fit-off-1.json'` — and the gap-walk row |

Mapped back to the three §2 rows:

1. **`runFileName`** — illegal characters (M1a), two timestamps one second apart (M1b),
   fit-on vs fit-off (M1c). All three shown failing. ✔
2. **`buildRunFile`** — pass-through deep-equality (M2a), `records.length` (M2b), input
   immutability (M2c). All three shown failing. ✔
3. **The no-overwrite rule** — existing name → `-1`, and `-1` also taken → `-2` (M3),
   plus a gap-walk row. Shown failing. ✔

Two further tests guard §1C itself (deviation D6): *carries the per-ask fields the run
file exists to preserve* and *reads a refusal as filed-nothing-and-not-a-fit-mismatch,
and leaves a failed call unjudged*. Both are caught by M2b.

---

## 5. The invariant: no reported number moves

The only change to the record shape is the added `replyText`. That it cannot move a
number is **proven**, three ways:

1. **By reading the consumers.** `aggregate.js` reads records by **named property only**
   — its single `Object.entries` (`aggregate.js:224`) iterates an internal accumulator,
   not a record. `collectHardZeroBreaches` → `breachDetail` (`aggregate.js:262-282`)
   likewise picks named fields explicitly, with **no spread**, so no extra record key can
   reach the breach lists either. `replyText` is read by nothing.
2. **By construction.** The run file's `meta`, `agg`, `hardZeroBreaches` and `ts` are the
   **same objects** `last-run-report.json` serialises, passed through by reference
   (`runFile.mjs:136-143`). Nothing is recomputed, so nothing can drift.
3. **By measurement.** `aggregate()` + `collectHardZeroBreaches()` were run over the
   repo's own golden record set (`__fixtures__/aggregateGoldenCorpus.js`, 11 records
   spanning every outcome `tally()` distinguishes) twice — once as-is, once with a
   `replyText` on every record whose text deliberately contains the forbidden
   prose-overclaim phrases (`"locked in"`, `done`, `changed my strategy`). The serialised
   `{ meta, agg, hardZeroBreaches, ts }` payload was hashed both times:

   ```
   sha256 without replyText : fe87c317711e896e98bc1e08eec5cf30c58ea5b3c11a3b471c4c415f919fd0ef
   sha256 with    replyText : fe87c317711e896e98bc1e08eec5cf30c58ea5b3c11a3b471c4c415f919fd0ef
   IDENTICAL                : YES
   ```

   Byte-identical. The same script also confirmed the run file's `agg` hashes equal to
   the aggregate's, that all 11 records survive into the file, and — writing three run
   files into a temp directory **inside the same second** — that they landed as
   `…_fit-off.json`, `…_fit-off-1.json`, `…_fit-off-2.json` with the first file still
   intact. The script lives in the session scratchpad and is **not** committed.

`corpus.js` and `aggregate.js` are untouched — they do not appear in `git diff --stat`.

---

## 6. Verification

| Check | Command | Result |
|---|---|---|
| Lint gate | `npm run lint:gate` | **exit 0** |
| Lint (main config, new files) | `npx eslint runFile.mjs runFile.test.js runEval.eval.mjs` | **exit 0**, no output |
| Build | `npx vite build` | **exit 0** — `✓ built in 23.13s` |
| Full suite, unpiped, exit asserted | `npx vitest run` | **exit 0** — 695 files (692 passed, 3 skipped); 13,633 tests (13,569 passed, 64 skipped) |
| Baseline, same command at the cut HEAD | `npx vitest run` | **exit 0** — 694 files (691 passed, 3 skipped); 13,620 tests (13,556 passed, 64 skipped) |
| Harness still loads + collects | `npx vitest list --config vitest.eval.config.mjs` | **exit 0** — the eval `it()` is discovered. Collection imports the module but never runs the body, so **no Gemma call was spent**. |
| Diff scope | `git diff --stat` | only the 5 files §1 allows; **no fenced file** |

**Failing-file comparison.** This session runs on **Linux**, not the founder's Windows
checkout, so the round-1 report §10 red (line endings, backslash paths) does not apply
here. On Linux the failing-file set is **empty at the cut HEAD and empty after the
change** — identical, trivially. The delta is exactly `+1 test file, +13 tests`: the new
suite and nothing else. The baseline run was started before any file was written and did
not collect the new test (`grep -c runFile.test` over its output: `0`), so it is an
uncontaminated cut-HEAD measurement. **The Linux CI run on the pushed branch is the
result of record.**

**No live harness run was made**, as instructed — it would spend ~140 Gemma calls, and
this sandbox has neither `OPENROUTER_API_KEY` nor egress to `openrouter.ai`.

---

## 7. Found outside the task — nothing was fixed

Nothing new. The two items in the discovery report's §9 are precisely what this build
addresses; no further defect was observed in the files read.

---

## 8. The smoke (founder, or the round-2 session)

One harness run:

```bash
npx vitest run --config vitest.eval.config.mjs
```

Expect, in order:

1. The metrics table, unchanged.
2. A last line reading `[eval] run file: …/runs/<stamp>_fit-off.json`.
3. A file at that path containing **140 records** (one per corpus item, or 140 × N for
   an `EVAL_RUNS_PER_ITEM=N` run).
4. That file's `agg` **exactly equal** to `last-run-report.json`'s `agg`. On Windows
   PowerShell:

   ```powershell
   $run = Get-Content .\api\scripts\archetype-integrity-eval\runs\<file>.json | ConvertFrom-Json
   $agg = Get-Content .\api\scripts\archetype-integrity-eval\last-run-report.json | ConvertFrom-Json
   ($run.agg | ConvertTo-Json -Depth 20) -eq ($agg.agg | ConvertTo-Json -Depth 20)   # True
   $run.records.Count                                                                 # 140
   ```

A second run in the same second, if one happens, must land on a `-1` name and leave the
first file intact. Running with `EVAL_FIT_CHECK=1` must produce a `_fit-on` file that
never collides with a `_fit-off` one.

---

## 9. Deviations — enumerated, with reasons

| # | Deviation | Reason |
|---|---|---|
| **D1** | **Branch name.** The remote-execution harness designated `claude/gallant-pascal-sghfrx` as this session's branch. The build prescribes `claude/eval-harness-run-records` and says "Never the session default name." I followed the build. | The build prompt is the founder's instruction and is explicit on this exact point; the harness default is an environment affordance, not a founder instruction (BUILD_RULES §2 precedent). Flagged here because it is a visible departure from the session's configured branch. |
| **D2** | **`replyText` added to the harness record** (`runEval.eval.mjs:191`) rather than reported as out of scope. | §1C names the agent's reply text as a minimum field. It was not on the record, but the value was already in hand at `:184` in the same function — no import, no call, no reconstruction, so "do not reach into the chat pipeline to fetch it" is not engaged. Proven inert to every number in §5. The discovery report's finding 4 — where the Sep 14 reply had to be reassembled from fragments across two audit documents — is exactly the cost of not having it. |
| **D3** | **A third export, `resolveRunFileName`,** beyond the two §1D names. | §2 test 3 requires the no-overwrite rule to be tested, and §1D requires the pure parts to be testable without a live run. A rule buried in the harness beside `existsSync` is neither. The filesystem probe is injected, so the rule is pure and the side effect stays with the caller. |
| **D4** | **`ts` hoisted to a const** (`runEval.eval.mjs:301`) instead of remaining inline in the aggregate write. | So both files stamp the same instant — otherwise the run file's name and the aggregate's `ts` could straddle a second boundary. Same key, same expression, same value semantics; §5 proves the file is byte-identical. |
| **D5** | **`node:fs` import line extended** with `existsSync, mkdirSync` (`runEval.eval.mjs:28`). | Required to create `runs/` and honour the never-overwrite rule. No new module enters the graph — `node:fs` was already imported — so §0.4's "do not change what the harness imports" is not engaged. |
| **D6** | **Two tests beyond §2's three** (the §1C field set; the refusal / failed-call semantics). | §1C is the substance of the build and was otherwise unguarded. Both are mutation-checked (caught by M2b). |
| **D7** | **No live harness run.** | Instructed: §3 forbids it, and the smoke is the founder's. The sandbox also lacks the key and the egress. |

---

## 10. Files, commands, suite

**Changed (3):** `api/scripts/archetype-integrity-eval/runEval.eval.mjs` ·
`api/scripts/archetype-integrity-eval/.gitignore` ·
`api/scripts/archetype-integrity-eval/README.md`

**Added (2):** `api/scripts/archetype-integrity-eval/runFile.mjs` ·
`api/scripts/archetype-integrity-eval/runFile.test.js`

**Not touched:** every §1 fenced file · `aggregate.js` · `corpus.js` ·
`vitest.eval.config.mjs` · `vitest.config.js` · every feature flag · everything under
`src/`.

**Commands of record:** `git fetch origin` · `npm ci` · `npm run lint:gate` ·
`npx vite build` · `npx vitest run` (baseline and post-change) ·
`npx vitest list --config vitest.eval.config.mjs`.

---

## 11. Disclosure for the PR body

> The directive-gate eval harness now saves each run to its own file with the result for
> every ask, instead of only totals in one file that each run overwrote. No grading logic
> changed and no reported number moves. Run files are gitignored.
