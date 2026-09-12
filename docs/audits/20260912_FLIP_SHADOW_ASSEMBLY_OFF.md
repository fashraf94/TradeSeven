# Flip — `SHADOW_ASSEMBLY_ENABLED` → `false` (dark, corpus preserved)

**Fence confirmation (`docs/BUILD_RULES.md` §1, re-read at this HEAD):** no fenced file is touched. The §1 list at `BUILD_RULES.md:13-25` names eleven files — `api/agent/decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js` — and none appears in this branch's diff (VERIFIED, `git diff --name-only` filtered against the list). `api/_utils/agentEvalPromptAssembly.js` is **not edited**. The flip removes *calls to* the fenced builders; it changes nothing that reaches them, so the `EXA_RETRIEVAL_ENABLED`-style "a flip is fence contact" carve-out (`BUILD_RULES.md:32`) does not apply and the §2 one-line-flip convenience does.

---

## 0. Executive verdict

| | |
|---|---|
| **Prescribed change** | Five items. All five landed, nothing else. |
| **Conditional sixth item** | **Did not apply** — `claude/eval-transport-hygiene` has not merged. See §6. |
| **Fenced files touched** | **None.** |
| **Full suite** | `Test Files 655 passed \| 3 skipped (658)` / `Tests 12359 passed \| 64 skipped (12423)` — **exit code 0**. |
| **`flagPinGuard.test.js` / `shadowAssemblyCapture.test.js`** | Green (22 tests, exit 0). |
| **Lint on touched files** | **6 errors → 6 errors** (did not rise). |
| **Diff scope** | Five files, one flag value line, no fenced file, no other flag. |
| **Correction to the prescribed smoke** | One step as written cannot pass. See §8. |

---

## 1. Session preamble (BUILD_RULES §2 / §3)

- **`git fetch origin` run as the first step** (§3): yes — `0e04833d..27f42c07  main -> origin/main` plus 20 new remote branch refs. Recorded here per the stale-ref rule.
- **Branch:** `claude/flip-shadow-assembly-off`, cut fresh from `origin/main`. Not the session default name; one task, one branch (§2).
- **HEAD at cut:** `27f42c07` ("Merge pull request #841 from fashraf94/fashraf94-patch-17") — identical to `origin/main` at fetch time.
- **Tree at cut:** clean.
- **Environment note:** `node_modules/` was empty in this container; `npm install` was run (1131 packages) before any test or lint could execute. No dependency was added, removed or pinned — `package.json` and `package-lock.json` are untouched and are not in the diff.
- **Anchor re-verification (§3):** the Phase 0 report's anchors are stated at `701859c6`. Every site was re-read at this HEAD before editing. **No drift** — `featureFlags.js:1348`, `shadowAssemblyCapture.test.js:107-114`, `flagPinGuard.test.js:58-88`, `shadowAssemblyCapture.js:4-6` and `agent-evaluate.js:10-13` were all exactly where the report placed them.

## 2. Commits

| Commit | What |
|---|---|
| `8ad08140` | `git cherry-pick 004a6bd9` — the Phase 0 report (`docs/audits/20260912_PHASE0_SHADOW_ASSEMBLY.md`, +263), clean, from `claude/phase0-shadow-assembly`. The report does not exist on `main`; the cherry-pick is what puts the flip's basis in the same PR. |
| `a9962b31` | The flip — the five items, nothing else. |
| *(this file)* | The report. |

## 3. Diff stat

The flip commit `a9962b31`:

```
 api/_utils/shadowAssemblyCapture.js      | 18 ++++++++++---
 api/_utils/shadowAssemblyCapture.test.js | 19 ++++++++------
 api/cron/agent-evaluate.js               |  9 ++++---
 src/config/featureFlags.js               | 43 ++++++++++++++++++++++----------
 src/config/flagPinGuard.test.js          |  3 +++
 5 files changed, 66 insertions(+), 26 deletions(-)
```

The cumulative branch (`git diff --stat origin/main...HEAD`) adds only the cherry-picked Phase 0 report on top of that: 6 files, 329 insertions, 26 deletions. Well under the §2 review threshold (≥10 files or ≥1500 lines), so the mandatory adversarial review is not engaged.

**Scope checks, all VERIFIED:**
- Exactly one `export const` line changed anywhere in the diff: `-export const SHADOW_ASSEMBLY_ENABLED = true;` / `+export const SHADOW_ASSEMBLY_ENABLED = false;`. **No other flag is touched.**
- No fenced file in `git diff --name-only` (§1 list, checked mechanically).
- `runShadowTickCapture`'s guard is unchanged; the cron is unchanged beyond its header comment. `shadowAssemblyCapture.js`'s executable body is unchanged — its diff is comment-only.
- Nothing deleted: not the module, not `scripts/paired-eval-harness.js`, not a historical document, not an index.

## 4. The five items, at their post-edit `file:line`

### 1. The value — `src/config/featureFlags.js:1365`

`export const SHADOW_ASSEMBLY_ENABLED = false;` (was `true` at `:1348` pre-edit).

Docstring rewritten at **`:1334-1362`**. The old text opened "When FALSE (DEFAULT, merge-dark)…" and called TRUE "preview smoke only in Phase 2" — neither was true of the shipped state, and **no "merge-dark default" language survives**. The replacement states: dark since 2026-09-12 (this flip), having shipped TRUE from 2026-07-24 (PR #671); what the shadow captured (the DR-10 stage-1 corpus — the three eval-prompt parts built twice per battle-tick, live `agentContext` versus the frozen manifest overlay, diffed, written awaited to `shadowDiffs/{tickId}` with the §6.3 aggregates on `finalUpdate` and the §6.4 settlement at completion); why it is off (one offline consumer, `scripts/paired-eval-harness.js`, run once on 2026-07-31 for the DR-13 identity-block flip, which shipped; the manifest-read migration the corpus was built to gate has no build and was re-routed by the composition arc; zero `api/`/`src/` readers; the aggregates and settlement records never read; three deadline-less awaits before `battleRef.update(finalUpdate)`); that nothing the decider sees changes; and that the historical corpus is preserved and stays queryable by the harness.

The `// Pinned by: shadowAssemblyCapture.test.js` pointer is retained at **`:1364`** — the guard's item-4 test reads the comment window between the previous `export const` and the export line and fails if the pointer is missing or stale (`flagPinGuard.test.js:323-338`).

### 2. The pin — `api/_utils/shadowAssemblyCapture.test.js:107-119`

The ON pin is now an OFF pin, in the same commit as the value (BUILD_RULES §2 flip reconciliation; `flagPinGuard.test.js` reds otherwise). Assertion at **`:118`**: `expect(SHADOW_ASSEMBLY_ENABLED).toBe(false);`. The `it` name now reads "is OFF — the deliberate flip-off this suite guards", and the comment records both flips, the reason for this one, and that a re-flip must edit this assertion **and** drop the `DARK_BY_DESIGN` entry in the same commit.

### 3. The registry — `src/config/flagPinGuard.test.js:153-154`

`SHADOW_ASSEMBLY_ENABLED` added to `DARK_BY_DESIGN` with a one-line reason in the form the other entries carry. This was **required, not optional**: the flag went `true` on 2026-07-24, the day after it was introduced `false`, and never entered the registry — the guard was codified 2026-08-11, after the flip (`BUILD_RULES.md:53`). It is now a registered dark flag, so a contradiction prints the runway note and the "if the flip is deliberate, update the pin and drop the entry in the same commit; if not, revert the flag" message rather than the generic one, and a re-flip must go through the ceremony.

The guard's own integrity test (`:309-321`) requires a listed flag to exist in a registered module, ship `false`, and carry a non-empty note — all three hold, and that test is green.

### 4. The stale "dark" comments

Both were false from 2026-07-24 (the day the flag went `true`) until this commit, and both were flagged without reconciliation — on 2026-08-06 (`20260806_COMPOSITION_BUILD_V09_PHASE0_DISCOVERY.md:141`) and on 2026-09-02 (`COMMAND_CENTER_ARC_FOUNDATION.md:58`). Comment-only, both.

- **`api/_utils/shadowAssemblyCapture.js:3-12`** — now: dark since 2026-09-12, the wiring never calls in, shipped TRUE 2026-07-24 → 2026-09-12, corpus preserved and still queryable by the harness, why it was turned off, pointer to the flag for the full rationale.
- **`api/cron/agent-evaluate.js:10-16`** — same, for the cron side. **This one also carried a factual error beyond the staleness:** it said "the **two** flag-gated call sites below" when there are **three** — `runShadowTickCapture` (`:2870` pre-edit), the `receiptCoverage` stamp (`:4432`), and `writeBattleSettlementRecord` (`:4588`) (VERIFIED, `grep -n "if (SHADOW_ASSEMBLY_ENABLED"`). The replacement says THREE and names each by function rather than by line number, so it cannot drift the way the Phase 0 report's own anchors did.

### 5. The corpus caveat — `api/_utils/shadowAssemblyCapture.js:14-18`

One paragraph in the module header, citing Phase 0 §7: the "live" side of every historical document is a **rebuild** performed in this module — after the tick's swaps and after the lock transaction refreshed `battle.controlEpochLog` / `regimeAtStart` — **not the string that was sent to the decider**. It directs a reader of the 530 documents to treat them as a structural live-vs-manifest diff, never as the captured prompt the model saw. Anyone mining the corpus needs this before trusting it as "captured live contexts", which is how the DR-10 spec line describes it.

## 5. Verification

**Full suite** — `npx vitest run`, run unpiped so the exit code is the suite's own (never through `tail` or `head`; the log was written to a file and read afterwards):

```
 Test Files  655 passed | 3 skipped (658)
      Tests  12359 passed | 64 skipped (12423)
   Duration  128.16s
```

**Exit code: 0.** (Ten `FAIL` strings appear in the log; all ten are test *names* or deliberate fail-closed `console.error` output from passing tests — e.g. `[shadowAssembly] shadowDiff write FAILED for b1/t1: boom` from the create-only refusal row. Zero failing files, zero failing tests.)

**The two named suites** — `npx vitest run src/config/flagPinGuard.test.js api/_utils/shadowAssemblyCapture.test.js`: `Test Files 2 passed (2)`, `Tests 22 passed (22)`, **exit code 0**. Both green.

**Lint.** `npm run lint` is red at HEAD as stated — 1734 problems (1615 errors, 119 warnings) repo-wide. On the five touched files:

| File | Errors before | Errors after |
|---|---|---|
| `api/_utils/shadowAssemblyCapture.js` | 1 | 1 |
| `api/_utils/shadowAssemblyCapture.test.js` | 0 | 0 |
| `api/cron/agent-evaluate.js` | 5 | 5 |
| `src/config/featureFlags.js` | 0 | 0 |
| `src/config/flagPinGuard.test.js` | 0 | 0 |
| **Total** | **6** | **6** |

**It did not rise.** Same six diagnostics, same rules, identical in kind — five `no-undef` / `no-unused-vars` in the cron and one `no-undef` (`process`) in the module; only their line numbers shifted, by the comment edits. Repo-wide is unchanged by construction: eslint counts per file, only these five files changed, and each one's count is identical.

## 6. Disclosure — the conditional sixth item did not apply

**`claude/eval-transport-hygiene` has NOT merged.** VERIFIED at this HEAD: its tip is `8cea76cf`, `git merge-base --is-ancestor 8cea76cf origin/main` reports not-merged, and three commits (`270c1c61`, `d775537f`, `8cea76cf`) sit in `origin/main..origin/claude/eval-transport-hygiene`.

**So `api/_utils/agentEvalTransport.js` was left alone**, as the task directs. Worth stating precisely, because the file name alone is misleading: `agentEvalTransport.js` *does* exist on `main` (since PR #787), but the comment the task describes is not at `:25-30` here. At this HEAD `:25-30` is the unrelated `EVAL_MAX_OUTPUT_TOKENS` docstring. The D2 SCOPE paragraph — the one that names the two unbounded shadow rebuilds — exists only on the unmerged branch, where it sits at `:25-30` of that branch's copy alongside `PROMPT_BUILD_CEILING_MS` (`:33`) and reads:

> SCOPE, stated so this is not read as more than it is: it bounds the DECIDER'S build only … The shadow capture rebuilds the same block twice more per tick (shadowAssemblyCapture.js buildShadowDiffRecord, both awaited before battleRef.update), and those two are NOT bounded by this constant. A Firestore hang there still costs the write. Bounding them is a separate task; it is not fixed here.

**This gets fixed in whichever PR lands second** — the two are independent and can merge in either order. If this flip lands first, that paragraph is already stale when the transport PR merges and should be rewritten there to say the ceiling now bounds the only prompt build per tick because the shadow capture is dark. If the transport PR lands first, the same one-paragraph edit belongs in this PR before the founder merges it. Either way it is comment-only and nothing behavioural depends on it.

## 7. Invariant — nothing the decider sees changes

The flip removes three things that happen *beside* the decider's own build, all downstream of it:

- the second and third `buildLiveContextBlock` calls (`shadowAssemblyCapture.js:182-185`, `:186-189` — the live-side rebuild and the manifest-overlaid build),
- the awaited `.create()` to `shadowDiffs/{tickId}` (`:250`, called `:355`),
- the `receiptCoverage` / `battleSettlements` write at completion.

It removes nothing from the decider's path: its prompt build (`agent-evaluate.js:2016-2019`), its model call, its decision, the swaps, the stamps, `finalUpdate` and `battleRef.update` are all untouched by this diff. The two `finalUpdate` fields the capture used to attach — `shadowGateAggregates` and `shadowTerminalGates` — simply stop being set; they rode an existing write and were never read by anything (Phase 0 §3.1). No new write op appears or disappears on the decider's side.

## 8. Smoke — production, after the founder merges and deploys

Crons do not run on Vercel preview (BUILD_RULES §6), so this flip shows nothing until merge + deploy. On the first production tick after deploy:

1. **No new `agentBattles/{id}/shadowDiffs/{tickId}` document** is created for that tick, for any active battle. (The definitive signal.)
2. **`shadowGateAggregates[]` on each active battle doc has the same length it had at the previous tick** — and likewise `shadowTerminalGates[]`. No growth.
3. **No `battleSettlements/{battleId}` document and no `receiptCoverage` stamp** for any battle that completes on or after the deploy.
4. Everything the decider produces is unchanged in kind: the evaluation entry, the statusFeed entries, the counters and the swaps all land exactly as before.

### Correction to the prescribed smoke — step 1 as written cannot pass

The handover prescribes "the module's skip log line appears once per active battle." **There is no such line, and there cannot be one, because the flag gate is in the cron, not in the module.** VERIFIED at this HEAD: `agent-evaluate.js:2870` is `if (SHADOW_ASSEMBLY_ENABLED) { await runShadowTickCapture({...}) }`, so with the flag `false` `runShadowTickCapture` is **never entered** and the module emits nothing. Its only skip log — `console.log('[shadowAssembly] battle … has no manifest — capture skipped (pre-manifest battle)')` at `shadowAssemblyCapture.js:345` — is the *pre-manifest* skip reached from inside the module, i.e. only when the flag is ON.

This is by design and is exactly what the module header claims ("the wiring never calls in here … zero reads, zero writes"); Phase 0 §5.2 records the same property from the other direction ("the module logged nothing"). **The flag-off state is silent by construction.** Adding a skip log would mean changing the module's guard or the cron beyond its comment, both of which this task explicitly excludes, so no log line was added.

**Read the flip off the absence of the writes (steps 1–3 above), not off a log line.** If the founder wants a positive per-tick signal that the capture is dark, that is a separate one-line task with its own PR.

### On `buildMs` / `callMs`

The handover notes these should be "unchanged in kind … if the transport build has landed." It has not: `buildMs` and `callMs` do not exist anywhere in non-test `api/` code at this HEAD (VERIFIED grep; they are added on the unmerged `claude/eval-transport-hygiene`). So there is nothing to observe for them in this smoke. When that branch does land, the expectation stated in the handover is the right one and the reasoning is worth keeping: **`buildMs` measures the decider's own build, which is not what this flip removed**, so it should look the same after this flip as before it. What should improve is the tail of the total per-battle time before `battleRef.update` — the two removed rebuilds and the removed `.create()` were sequential and unbounded ahead of it.

## 9. Found, not fixed (BUILD_RULES §3 — reported for separate tasking)

Everything here is outside the prescribed five items and is **not in the diff**.

1. **Two labels in `shadowAssemblyCapture.test.js` go stale as a consequence of this flip**, and are outside the prescribed `:107-114`:
   - **`:6-8`** — the file header lists the suite's locks, and lock 1 still reads "SHADOW_ASSEMBLY_ENABLED is ON (the deliberate Phase 2 flag-flip … the P2.6 merge-dark exit criterion held until that flip)". The assertion it describes now pins `false`.
   - **`:106`** — the enclosing `describe('P2.6 activation')`, which now contains a deactivation pin.

   Both are comment/label-only, neither affects a test outcome, and `flagPinGuard.test.js` does not read them (it matches the `expect(...).toBe(...)` line and the flag's own docstring). I left them because the task bounded item 2 to `:107-114` and item 4 enumerated exactly two comment sites, neither of which is this file — and because "anything else you find goes in the report, not in the diff." **Flagging them explicitly because this is precisely the defect class item 4 exists to clear:** a comment that says "ON" above an assertion that says `false` is the same shape as the three comments this commit just reconciled, and leaving it unreconciled is how those three survived seven weeks. It is a two-line comment edit whenever the founder wants it — ideally folded into this PR before merge rather than left to rot.

   `:218` ("… for every downgrade since SHADOW_ASSEMBLY_ENABLED went true") is **not** in this category: it is a historical statement about when a production shape was recorded, and stays true.

2. **`scripts/paired-eval-harness.js:346`** prints "nothing to replay — accumulate divergent diffs first (SHADOW_ASSEMBLY_ENABLED preview smoke)" on an empty corpus. That advice is now unreachable without a founder flip. Harmless — the historical corpus is non-empty, so the branch is not hit in the mode that matters — but the sentence is misleading to a future reader. One-line comment task.

3. **Phase 0's own open items stand, unchanged by this flip** and recorded here so they are not lost with the flag: no repo-tracked collection-group index for `shadowDiffs` (§7.5 — the harness's default mode needs one and `firestore.indexes.json` has no `COLLECTION_GROUP` entry); the ≥60 divergent diffs from the first week that no document analyses (§7.4); and the fact that the capture ran on `budget_skipped` ticks (§7.2), which the flip moots rather than fixes. If a future manifest-migration brief needs a *fresh* corpus, it should bound the capture first — Phase 0 §6 option (b) — rather than re-flipping this flag as-is; the `DARK_BY_DESIGN` note now says so at the registry.

4. **The composition closure sheet names `shadowAssemblyCapture.js:126` as a place to decorate advisory data** (Phase 0 §3.3). That arc reads `resolvedAgentManifest.compositionCompat` through the fenced assembler, not through this module's projection, so the flip does not block it. No action; noted so nobody reads the dark flag as a blocker.

## 10. Disclosure for the PR body

*(the founder pastes this; reproduced verbatim from the handover, with the one conditional resolved)*

> Turns off the shadow assembly capture — the DR-10 stage-1 corpus, a per-battle-tick rebuild-and-diff of the eval prompt written since 2026-07-24 with one offline consumer, run once on 2026-07-31 for a flip that shipped; the migration it validated has no build. Removes two prompt rebuilds and one awaited Firestore write from before the battle write on every tick — for an agent with institutional rules, four to six sequential round trips — closing the last unbounded await on the eval path. Nothing the decider sees changes. The 530-document historical corpus stays queryable by `scripts/paired-eval-harness.js`. The flag now sits in `DARK_BY_DESIGN`; a re-flip requires the ceremony.

Add, since the branch ordering resolved: `claude/eval-transport-hygiene` had not merged when this branch was cut, so `api/_utils/agentEvalTransport.js` is untouched here; its D2 SCOPE comment naming the two unbounded shadow rebuilds is reconciled in whichever of the two PRs lands second.

---

*Pushed, not merged. No PR opened — the founder opens PRs. Claude does not drive this PR toward merge: no CI watching, no autofix, no review request, no merge (BUILD_RULES §2). STOP.*
