# FLIP — `DIRECTIVE_FIT_CHECK_ENABLED` false → true — **HALTED, NOT SHIPPED**

**Session:** Claude Code, Opus. Fresh session, 2026-09-18.
**Branch:** `claude/flip-directive-fit-check`, cut from `origin/main` after `git fetch origin`.
**Outcome:** **STOP.** The flip's own prescribed stop condition fired. The flag is
still `false`; this branch carries this report and nothing else.

---

## 1. Executive verdict

| | |
|---|---|
| **Was the flip shipped?** | **No.** The flag is `false` at `src/config/featureFlags.js:887` — unchanged from `main`. |
| **Why stopped** | The task said: *"If the suite reds on a row the map does not name, STOP and report."* It does — **4 rows**, in a file the map never mentions and a file whose count is short by one. |
| **Precondition** | **PASSED.** `VOICE_GROUNDING_MODE = 'shadow'` (`featureFlags.js:2254`, VERIFIED). The flip-order hazard is not the blocker. |
| **The trap** | The measured total is **19 rows across 6 files** — *the map's exact headline numbers*. Only the composition differs. A flipper checking "19/6" against the map would have concluded it matched and proceeded. |
| **Root cause** | The map was measured 2026-09-16. **Three commits merged into `main` after that** and moved the flip's red set. The map's own note says *"re-measure before flipping"* — re-measuring is what caught this. |
| **Not bookkeeping** | One unnamed red is a real prompt-coherence defect on the unknown-archetype path (§5.2). It is a founder ruling, not a test edit. |
| **Suite health** | `main` is green at the cut: **13526 passed / 64 skipped**, exit **0**. Nothing here is a pre-existing failure. |

**What the founder needs to decide:** §7.

---

## 2. Preamble (BUILD_RULES §2, §3)

- `git fetch origin` run as the first step of the session — **recorded per §3**.
- HEAD at cut: **`972b632e645bd728b7182b82b74a5473e31e1998`** (`origin/main`, PR #861).
- Working tree at cut: **clean**.
- Branch `claude/flip-directive-fit-check` created from `origin/main`. One task, one branch (§2).
- `npm ci` was required — the container had no `node_modules`. Exit 0.
- No fenced file was read into, edited, or called by this work. **No production source file was touched** (§1).

---

## 3. The precondition — PASSED

> Standing rule: the fit check is never lit while grounding is at `'canary'` or `'on'`.

`src/config/featureFlags.js:2254` — `export const VOICE_GROUNDING_MODE = 'shadow';` — **VERIFIED.**

`'shadow'` resolves to `'shadow'` for every uid, so `grounded` is false for everyone and the
shipped (transformed) prompt is what is sent. Flipping the fit check alone, today, is coherent
with respect to the grounding walk. This is the §6 D-3 hazard from the build record, and it is
**not** what stopped this task.

---

## 4. The re-derivation — measured against the tree, not trusted

Two full-suite runs, both unpiped to a file with the exit code captured directly
(`> file 2>&1; echo $?` — a redirect, so nothing is truncated and the exit code is the
runner's own, not a pipeline's).

**Run 1 — baseline, flag at `false` (the cut):**

```
 Test Files  690 passed | 3 skipped (693)
      Tests  13526 passed | 64 skipped (13590)
EXIT=0
```

**Run 2 — flag flipped to `true`, nothing else changed:**

```
 Test Files  6 failed | 684 passed | 3 skipped (693)
      Tests  19 failed | 13507 passed | 64 skipped (13590)
EXIT=1
```

Every count below was then reproduced by running each file in isolation, so none is an
artefact of suite ordering or cross-file state.

### 4.1 Map versus tree

Map of authority: `src/config/featureFlags.js:867-874` — the corrected map, the one the
build record's §7.5 D3 finding says replaced the wrong one written in commit A.

| File | Map says | **Measured** | |
|---|---|---|---|
| `api/_utils/voiceLayerPrompt.grounding.goldens.test.js` | 6 | **6** | match |
| `api/_utils/directiveGate.test.js` | 4 | **4** | match |
| `src/config/flagPinGuard.test.js` | 2 | **2** | match |
| `src/config/directiveFitCheckFlags.test.js` | 1 | **1** | match |
| `api/_utils/voiceLayerPrompt.test.js` | 2 | **3** | **+1 unnamed** |
| `api/_utils/voiceLayerPrompt.grounding.test.js` | *(absent)* | **3** | **file entirely unnamed** |
| `api/agent/chat.test.js` | 4 | **0** | **named, but green** |
| **Total** | **19 / 6 files** | **19 / 6 files** | **totals agree; composition does not** |

`api/agent/chat.test.js` was run alone with the flag lit: **82 passed, exit 0.** It appears in
the flipped run's output 52 times, but only in `stdout`/`stderr` noise from passing rows —
never in a `FAIL` line. VERIFIED.

**The stop condition:** 4 rows red that the map does not name — the three in
`voiceLayerPrompt.grounding.test.js`, and the third row in `voiceLayerPrompt.test.js`.

### 4.2 Why the map drifted

The map is dated 2026-09-16 and was measured on the build branch. Three commits reached
`main` afterwards and changed which rows move under the flip:

| Commit | What it did |
|---|---|
| `3179d3db` | **the §7.6 addendum** — *"the quote attaches to the DIRECTIVE, not the confirmation"*. This is the one that moved the rows: it relocated the quote demand from the archetype-gated confirmation rule into the **output-format contract**, which every prompt renders. |
| `2ab78c4b` | *"the cautious register comes from the charter, not from a policy field"* — closes the build record's §6 D-1 / §7 A4+A5 (**blocker 1**). Merged as PR #859. |
| `d32adaa0` | *"the harness counts `fit_mismatch` as its own thing"* — closes §7 J7 (**blocker 2**). Merged as PR #860. |

The map is not sloppy; it is **stale by two days**, and it told its reader so. Re-measuring is
what the map asked for and what caught this.

---

## 5. The two unnamed reds, characterised

These are not goldens that want re-baselining. Both say something.

### 5.1 `voiceLayerPrompt.grounding.test.js` — the vocabulary guard loses its premise (3 rows)

`§4 — the vocabulary guard: 30 sites, absent from every grounded surface, present in the off
surface they name`. Sites 9, 10 and 11 assert three acknowledgement phrases are **present in
the ungrounded ("off") battle surface** — that presence is the guard's whole premise, the thing
that proves the grounded surface legitimately *excludes* them rather than the guard string being
a dead letter. Under the flip the three phrases leave the off surface:

- site 9 — `"I'll flag it if I see it"`
- site 10 — `"That's the lean I'm taking into the open unless you push back"`
- site 11 — `"my risk rules act on their own meanwhile"`

The test's own failure message states the consequence exactly: *"the guard string is not a
guard."* Moving these in lockstep means **deciding what the three sites should assert once the
acknowledgement rule is transformed** — a judgement call about a guard belonging to the
grounding walk, not a mechanical edit. The grounding walk is out of this task's scope.

### 5.2 `voiceLayerPrompt.test.js` — the apparatus reaches an archetype that has no menu (1 row)

**This is the substantive one.**

`api/_utils/voiceLayerPrompt.test.js:3824-3832`, row *"unknown archetype + flag-ON → no
apparatus at all (ADOPT #4 voice/gate consistency)"*, with `ARCHETYPE_INTEGRITY_MODE = 'enforce'`
and archetype `'strategist'`. The six known archetypes are `momentum_chaser, contrarian, degen,
guardian, diversifier, analyst` (`src/data/archetypeAdjustments.js`, VERIFIED) — `'strategist'`
is genuinely unknown.

The row makes three assertions. Under the flip **the first two still pass** and the third fails:

| Assertion | Under the flip |
|---|---|
| `not.toContain('IMMUTABLE CORE')` | passes — no menu apparatus |
| `not.toContain('THIRD PATH')` | passes — no menu apparatus |
| `not.toContain('_archetypeProposal')` | **fails** |

So the menu is **not** rendered, and the instruction to fill `_archetypeProposal` **is**. The
mechanism: `applyFitCheckOutputRule` (`api/_utils/voiceLayerPrompt.js:981-984`) is gated on
`DIRECTIVE_FIT_CHECK_ENABLED` **alone** — no known-archetype check — and the rule it appends
(`:973-979`) tells the agent its `response` must carry the canonical text of the id it puts in
`_archetypeProposal.selectedAdjustmentId`, *"word for word, exactly as YOUR MENU spells it"*.

An agent on an unknown archetype is therefore told to quote from a menu it was never given.

Why this matters for the flip decision rather than for a test file: the build record's own
headline risk (`docs/audits/20260916_BUILD_DIRECTIVE_FIT_CHECK.md:20`) is that the realistic
failure mode is **not** a mis-filed directive but that *"directive filing quietly stops"*. An
agent instructed to quote a menu that does not exist in its prompt is a plausible path to
exactly that, on exactly the path nobody watches. Whether that is acceptable, and whether the
fix is to gate the output rule on a resolved archetype, is a founder ruling. Production code is
explicitly out of this task's scope, so it was **reported, not fixed** (BUILD_RULES §3).

### 5.3 The two remaining `voiceLayerPrompt.test.js` rows (the 2 the map did name)

*"flag-OFF is byte-identical across battle / review / workshop (golden)"* and *"flag-OFF stays
byte-identical even when a capabilitiesManifest is passed (E2 null-default guard)"*. Both red
because the output-format contract gains the quote line even on the `ARCHETYPE_INTEGRITY_MODE`-off
path — the same unconditional gate as §5.2. These are the expected lockstep moves.

---

## 6. Collateral checks (run with the flip applied, before reverting)

Kept because they are useful to whoever does flip this, and they cost nothing:

| Check | Exit |
|---|---|
| `npm run lint:gate` | **0** |
| `npx vite build` | **0** (`✓ built in 15.41s`) |

So the flip breaks neither the lint gate nor the build. What it breaks is 19 test rows, 4 of
which nobody has decided about.

---

## 7. What the founder needs to decide

1. **The unknown-archetype leak (§5.2).** Should `applyFitCheckOutputRule` be gated on a
   resolved archetype, so an agent without a menu is not told to quote one? This is production
   code and needs its own tasking. It is the one finding here that could affect live behaviour.
2. **The three vocabulary-guard sites (§5.1).** What should sites 9–11 assert once the
   acknowledgement rule is transformed? They belong to the grounding walk.
3. **Re-issue the flip with a corrected map** once 1 and 2 are settled. The measured map as of
   this HEAD is the table in §4.1, right-hand column. It should be written to
   `featureFlags.js:867-874` in the flip commit, replacing the stale one.
4. **Blockers 1 and 2 appear closed** by `2ab78c4b` and `d32adaa0` (§4.2), and blocker 3 (the
   grounding order) is satisfied today. The build record's `DO NOT FLIP` line
   (`20260916_BUILD_DIRECTIVE_FIT_CHECK.md:22`) has not been updated to say so — worth
   reconciling so the next flipper is not stopped by a list that is already spent.

---

## 8. What was deliberately not done

- **The flip is not shipped.** `DIRECTIVE_FIT_CHECK_ENABLED` is `false`; the working tree is
  byte-identical to `origin/main` apart from this report.
- **No test row was moved.** Moving 15 named rows while 4 unnamed ones are undecided would
  produce a branch that looks reconciled and is not.
- **No production code**, no other flag, no prompt text, no threshold-lint mode, no
  cautious-register rows (already landed in `2ab78c4b`).
- **No pin / `DARK_BY_DESIGN` reconciliation** — with the flag back at `false` the pin and the
  entry are correct as they stand, and `flagPinGuard.test.js` is green.
- **No PR** (the founder opens PRs). No merge. No CI watching.

**The disclosure text prepared for the PR body is deliberately not reproduced here**, because
its pre-flight numbers (*"refusals rise from 6.5% to about 9%"*) were produced by the eval
harness, and `d32adaa0` changed how that harness scores a `fit_mismatch` two days ago — the
`falseRefusalRate` those numbers came from is not the one the harness computes at this HEAD.
Re-run the corpus before publishing a refusal rate.

---

## 9. Verification summary

| Claim | Evidence | Marker |
|---|---|---|
| `VOICE_GROUNDING_MODE` is `'shadow'` | `src/config/featureFlags.js:2254` | VERIFIED |
| Flag ships `false`, unchanged | `src/config/featureFlags.js:887`; `git diff origin/main` empty for source | VERIFIED |
| Baseline green, exit 0 | 13526 passed / 64 skipped | VERIFIED |
| Flip reds 19 rows / 6 files, exit 1 | 19 failed / 13507 passed | VERIFIED |
| Per-file counts | each file re-run in isolation | VERIFIED |
| `chat.test.js` green under the flip | 82 passed, exit 0 | VERIFIED |
| Unknown-archetype leak | `voiceLayerPrompt.test.js:3824-3832`; `voiceLayerPrompt.js:973-984` | VERIFIED |
| `'strategist'` is not a known archetype | `src/data/archetypeAdjustments.js` — the six keys | VERIFIED |
| Map location | `src/config/featureFlags.js:867-874` | VERIFIED |
| `lint:gate` 0, `vite build` 0 under the flip | captured before revert | VERIFIED |
| Blockers 1 & 2 closed post-map | `2ab78c4b`, `d32adaa0` commit messages | VERIFIED |
| Diff stat: no production source file | §8 | VERIFIED |
