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

---

# Merge section — brought forward to `main` @ `a7ba95ce` (2026-09-18)

*Appended six days after the flip was pushed. The branch sat behind one merge conflict while `main` moved 102 commits: the lint gate, the transport hygiene, the index hygiene, the directive fit-check build, the cautious register, the threshold lint, the eval harness. The Sep 18 live battle confirmed the capture was still running — `shadowGateAggregates` grew on every tick — so the flip is still wanted, unchanged.*

## M0. Verdict

| | |
|---|---|
| **Conflict** | One file, `src/config/flagPinGuard.test.js`, in the `DARK_BY_DESIGN` block. Purely additive on both sides. |
| **Resolution** | All four entries and `main`'s comment block kept. `main`'s text byte-identical to `origin/main`; the branch's entry appended to the entry list. |
| **Auto-merged clean** | `api/cron/agent-evaluate.js`, `src/config/featureFlags.js`. |
| **Re-verified items that drifted** | **None drifted in substance.** Four of four still true at the merged tree; only line numbers moved. |
| **Addendum items already present** | **None.** All four were outstanding; all four are now applied. |
| **Fenced files touched** | **None** (re-confirmed at this HEAD against the §1 list, mechanically). |
| **Full suite** | `690 passed \| 3 skipped (693)` / `13526 passed \| 64 skipped (13590)` — **exit code 0**. |
| **`npm run lint:gate`** | **exit code 0** (the gate did not exist when this branch was cut). |
| **`vite build`** | **exit code 0**. |
| **Production diff** | Exactly **one** non-comment line in the whole branch diff: the flag value. |

## M1. Preamble

- **`git fetch origin` run as the first git command of the session** (§3): `origin/main` advanced `398c528e..a7ba95ce`, plus a batch of remote branch refs new to this container. Recorded per the stale-ref rule.
- **Branch:** `claude/flip-shadow-assembly-off` — the existing branch, brought forward. No new branch was cut; PR #844 updates from the push.
- **HEAD at checkout:** `68bf31a1`. **Tree:** clean.
- **Merge target:** `origin/main` @ `a7ba95cec2269f599d6eeb7e2fe6a7820f9a395e` ("Merge pull request #862 … claude/flip-directive-fit-check"). Merge base `27f42c07` — the branch's own cut point, 102 commits behind.
- **Environment:** `node_modules/` was again empty; `npm ci` was run (exit 0) before any test, lint or build. `package.json` / `package-lock.json` untouched and not in the diff.
- **Merge commit:** `a08539c6`. **Addendum commit:** `b8e0800d`.

## M2. What the conflict was

Both sides appended to the `DARK_BY_DESIGN` map in `src/config/flagPinGuard.test.js`, at the same place — immediately after the `BATTLE_VIEW_CONTROLLER_ENABLED` intentionally-absent note, which was the end of the object on the branch. Git could not know the two additions were independent, so it marked the whole tail region.

- **The branch adds one entry:** `SHADOW_ASSEMBLY_ENABLED`, with the re-flip-needs-a-bounded-capture rationale.
- **`main` adds three entries and a comment block:** `ELIGIBILITY_ATTESTATION_ENABLED`, `DIRECTIVE_FIT_CHECK_ENABLED`, `BACKING_BETA_ENABLED`, then the note recording why `ANTICIPATION_THRESHOLD_LINT_MODE` is deliberately absent and must stay absent — it is a string tri-state (`'off' | 'shadow' | 'on'`), so `buildFlagMap`'s `*_ENABLED = true|false` scan never sees it and the integrity test would fail the key outright.

**Nothing here was an either/or**, exactly as briefed: four independent dark-runway registrations and one explanatory note about a fifth that must never become a registration.

Simulated read-only with `git merge-tree --write-tree` before touching the working tree; it reported this one conflict and clean auto-merges for the other two files, which is what the real merge then did.

## M3. How it resolved

`main`'s block is taken **verbatim, in `main`'s order** — nothing from `main` is reordered, reworded or re-indented. Verified mechanically rather than by eye: the resolved file diffed against `origin/main`'s copy is **+2 lines and nothing else**, those two lines being the branch's entry.

The branch's `SHADOW_ASSEMBLY_ENABLED` entry is appended to the **entry list** — after `BACKING_BETA_ENABLED`, ahead of `main`'s trailing `ANTICIPATION_THRESHOLD_LINT_MODE` note (`flagPinGuard.test.js:158-159`). Two placements were available and both are functionally identical; this one keeps every real key together and leaves `main`'s closing note last, where it was deliberately put ("Noted HERE anyway so a flip is loud in the place a reader looks for the dark runway"). The branch's one-line blank separator was dropped so the entry matches the spacing of the three entries above it.

`api/cron/agent-evaluate.js` and `src/config/featureFlags.js` auto-merged with no conflict: `main`'s 102 commits added 311 and 246 lines to those files respectively, none of it inside the flip's hunks.

## M4. Re-verification of the other four items at the merged tree

The Sep 12 anchors were a week old. Every item was re-read at the merged tree. **None drifted in substance; three moved line numbers** because `main` grew `featureFlags.js` by 246 lines and `agent-evaluate.js` by 311.

| Item | Sep 12 anchor | At the merged tree | Verdict |
|---|---|---|---|
| 1. The value is `false` | `featureFlags.js:1365` | **`featureFlags.js:1482`** — `export const SHADOW_ASSEMBLY_ENABLED = false;` | **VERIFIED**, line moved |
| 2. The pin matches | `shadowAssemblyCapture.test.js:107-119` | **`:119`** — `expect(SHADOW_ASSEMBLY_ENABLED).toBe(false)`; `// Pinned by:` pointer intact at `featureFlags.js:1481` | **VERIFIED** (`main` never touched this file) |
| 3. The registry entry | `flagPinGuard.test.js:153-154` | **`:158-159`** | **VERIFIED**, line moved by the resolution itself |
| 4. The "dark" header comments | `shadowAssemblyCapture.js:4-6`, `agent-evaluate.js:10-13` | **`shadowAssemblyCapture.js:4-12`**, **`agent-evaluate.js:10-16`** | **VERIFIED** — see below |
| 5. The corpus caveat | `shadowAssemblyCapture.js:14-18` | **`:14-18`**, unmoved | **VERIFIED** |

**On item 4, stated precisely because the count matters.** The handover says "the three dark header comments (`shadowAssemblyCapture.js`, `agent-evaluate.js`)". Every candidate in those two files was re-read, and all are true at the merged tree:

1. **`shadowAssemblyCapture.js:4-12`** — the module header's DARK paragraph. Claims zero reads, zero writes, no new `shadowDiffs`. True: the flag is `false` and all three call sites are gated.
2. **`agent-evaluate.js:10-16`** — the import-site header. It makes a **countable** claim — "the THREE flag-gated call sites below — the per-tick `runShadowTickCapture`, the completion-time `receiptCoverage` stamp, and `writeBattleSettlementRecord`". Re-counted at the merged tree: **exactly three**, at `:3090`, `:4652`, `:4808`, and each matches the site it names. `main` added neither a fourth nor removed one.
3. **The three call-site `// P2.6 (dark…)` comments** (`:3085-3089`, `:4647-4651`, `:4803-4807`) already read correctly under flag-off and needed no edit.
4. **The flag's own docblock** (`featureFlags.js:1451-1480`) survived the auto-merge intact. Two of its factual claims were re-checked against 102 commits of `main` rather than assumed:
   - *"api/ and src/ have zero readers"* of the corpus — **still true**: every `shadowDiffs` / `battleSettlements` / `shadowGateAggregates` match in `api/` and `src/` at the merged tree is a comment, not code.
   - *"three deadline-less awaits"* — **still true**: the transport hygiene build bounded only the decider's build, and `shadowAssemblyCapture.js:194` / `:198` are still unbounded `await buildLiveContextBlock` calls. This is precisely why addendum item 4 exists.

**No item stopped applying at this HEAD, so there was nothing to STOP on.**

## M5. The addendum — which items were already present

**None of the four had landed.** The Sep 12 report's own §9 predicted this: it filed items 1–3 as "found, not fixed … ideally folded into this PR before merge rather than left to rot", and §6/§10 left item 4 to "whichever of the two PRs lands second". They were still outstanding six days later, and all four are applied in `b8e0800d`.

| Addendum item | Already present? | Applied at |
|---|---|---|
| The test header's "is ON" | **No** — only the `it()` label inside the block was flipped on Sep 12; the header bullet was not | `shadowAssemblyCapture.test.js:6-9` |
| `describe('P2.6 activation')` | **No** | **`:107`** — now `describe('P2.6 flag state')` |
| The harness's re-flip advice | **No** | `paired-eval-harness.js:352` (the named string), plus two same-defect twins in the same file — `:264` and the header Prerequisites line at `:18-26` |
| The `PROMPT_BUILD_CEILING_MS` SCOPE comment | **No** | `agentEvalTransport.js:25-33` |

**The branch-ordering question from §6 is now closed.** `claude/eval-transport-hygiene` merged as PR #839 (`2a373360`), so this flip lands **second** — which, per §6's own rule, puts the SCOPE-comment edit in this PR. The file exists on `main` and the paragraph is at `:25-30` there, exactly where §6 said it would be on that branch. Rewritten (`:25-33`) to say the decider's build is now the tick's only unbounded-build exposure, that the capture's two rebuilds are **gone rather than fixed**, and that a re-flip reopens them — which is what the `DARK_BY_DESIGN` entry already obliges a re-flip brief to bound. The two statements now point at each other instead of contradicting.

**Two twins were fixed beyond the one string named**, and it is worth being explicit about why. The handover named `:346` (now `:352`). The DR-13 branch at `:264` carried the same instruction in different words ("let the #671 flip accumulate divergent diffs"), and the file **header** listed `SHADOW_ASSEMBLY_ENABLED` among the flags a reader should have on. Fixing one sentence and leaving two that say the same thing — one of them in the header, the first thing a reader sees — would have reproduced the exact failure this addendum exists to correct: three "dark" comments survived seven weeks of the flag being ON because nobody swept the neighbours. All three now say the corpus is frozen and that a fresh one is a founder flip PR with a capture-bounding brief, never a local flag edit. The two empty-set messages also name what a reader *can* do (widen `--battle`/`--limit`, or `--synthetic`), so they stay actionable rather than merely forbidding.

**Not touched, reported instead (§3):** `scripts/PAIRED_EVAL_HARNESS_README.md` carries the same class of staleness in at least four places (`:4-5`, `:31`, `:77-78` — "preferred once the SHADOW_ASSEMBLY_ENABLED flip, PR #671, has accumulated divergent shadowDiffs"). It is a separate document, not named in the addendum, and editing it starts a doc sweep this task did not ask for. One small task whenever the founder wants it.

## M6. Verification at the merged tree

**Full suite** — `npx vitest run`, unpiped; output redirected to a file so the exit code reported is the suite's own, never a pipeline's:

```
 Test Files  690 passed | 3 skipped (693)
      Tests  13526 passed | 64 skipped (13590)
   Duration  118.50s
```

**Exit code: 0.**

**The three directly affected suites** — `flagPinGuard.test.js`, `shadowAssemblyCapture.test.js`, `agentEvalTransport.test.js`: `3 passed (3)` / `51 passed (51)`, **exit code 0**. `agentEvalTransport.test.js` is included because the addendum edits that module; its 29 rows are unaffected, as a comment-only change should leave them.

**`npm run lint:gate`: exit code 0.** This replaces the Sep 12 record's "6 errors → 6 errors (did not rise)" hand-count — the gate did not exist on `main` when this branch was cut, and it is now a hard check this branch passes outright.

**`npx vite build`: exit code 0.** Built in 15.22s. (The >500 kB chunk advisory is pre-existing and repo-wide.)

**Diff scope** — `git diff origin/main --stat`:

```
 api/_utils/agentEvalTransport.js                 |  13 +-
 api/_utils/shadowAssemblyCapture.js              |  18 +-
 api/_utils/shadowAssemblyCapture.test.js         |  28 ++-
 api/cron/agent-evaluate.js                       |   9 +-
 docs/audits/20260912_FLIP_SHADOW_ASSEMBLY_OFF.md | 187 ++++++++++++++++
 docs/audits/20260912_PHASE0_SHADOW_ASSEMBLY.md   | 263 +++++++++++++++++++++++
 scripts/paired-eval-harness.js                   |  16 +-
 src/config/featureFlags.js                       |  43 ++--
 src/config/flagPinGuard.test.js                  |   2 +
```

**No fenced file** — checked mechanically, not by eye: each of the eleven §1 paths was run through `git diff --quiet origin/main -- <path>`; all eleven are unchanged.

**No production source beyond the flag and the comments** — proved rather than asserted. Filtering the production diff (`agentEvalTransport.js`, `shadowAssemblyCapture.js`, `agent-evaluate.js`, `featureFlags.js`) down to non-comment, non-blank changed lines yields exactly two:

```
-export const SHADOW_ASSEMBLY_ENABLED = true;
+export const SHADOW_ASSEMBLY_ENABLED = false;
```

One flag value. Everything else in the branch diff is a comment, a test label, a console string, or a doc.

## M7. Smoke, unchanged

The Sep 12 smoke (§8) and its correction stand: crons do not run on Vercel preview, the flag-off state is **silent by construction** (the gate is in the cron, so the module emits nothing), and the flip must be read off the absence of writes. On the next production battle after the founder merges and deploys:

1. **`shadowGateAggregates[]` stops growing between ticks** — the signal the Sep 18 battle showed still growing, which is what re-confirmed this flip was wanted.
2. **No new `agentBattles/{id}/shadowDiffs` documents appear.**

Both are absence-signals on the battle document; neither needs a log line.

---

*Merged forward and pushed. **No PR opened** — #844 already exists and updates from this push. Claude does not drive it toward merge: no CI watching, no autofix, no review request, no merge (BUILD_RULES §2). STOP.*
