# Build — The cautious register comes from the charter, not from a policy field

**Branch:** `claude/cautious-register` · cut fresh from `origin/main` @ `ac5f8ebf` (after `claude/directive-fit-check` merged at `45b6ee24`)
**Session preamble (BUILD_RULES §2 / §3):** `git fetch origin` ran first — `origin/main` moved `398c528e..ac5f8ebf`. Tree clean at branch cut. No `--unshallow`; no other git history operation.
**Flag:** none new. The annotations stay behind `DIRECTIVE_FIT_CHECK_ENABLED`, which stays `false`.
**Files:** 7 · **+512 / −96**. Below the §2 review threshold (≥10 files OR ≥1500 lines) — no mandatory adversarial review. Mutation-checked anyway; see §5.

---

## THE SIX ROWS — for the founder to bless

**This is the one place the founder's word is the source. The build proposes; the founder rules.**
Each list is read from that archetype's own `ARCHETYPE_DEF_*_2026-06-24.md` at the repo root — the sentence beginning "More cautious" — **one id per clause, in the charter's clause order**, so the ids read in the same order as the prose the prompt renders one block above them.

| # | Archetype | The charter's own sentence (quoted verbatim, `file:line`) | Proposed ids |
|---|---|---|---|
| 1 | **`degen`** (Speculator) | *"for Speculator that means **tighten the (still-wide) stop** / **hunt slightly-less-extreme volatility** / **size down** — never 'buy stable quality' or 'go to cash.'"* — `ARCHETYPE_DEF_SPECULATOR_2026-06-24.md:47` | `SP-01, SP-02, SP-06` |
| 2 | **`diversifier`** | *"**tighten the cap** / **widen the spread** / **rebalance sooner** — never 'concentrate into safe names'"* — `ARCHETYPE_DEF_DIVERSIFIER_2026-06-24.md:49` | `DV-01, DV-02, DV-03` |
| 3 | **`contrarian`** | *"for Contrarian that means **tighten the stop** / **demand deeper washout** / **require a clearer turn** — never 'buy defensive sectors' or 'go to cash.'"* — `ARCHETYPE_DEF_CONTRARIAN_2026-06-24.md:59` | `CN-03, CN-01, CN-02` |
| 4 | **`analyst`** (Fundamental Investor) | *"**raise the quality bar** / **demand a cleaner technical setup** / **hold conviction longer** — never 'chase a hot chart' or 'drop the quality standard.'"* — `ARCHETYPE_DEF_FUNDAMENTAL_INVESTOR_2026-06-24.md:54` | `FI-01, FI-02, FI-03` |
| 5 | **`momentum_chaser`** (Trend Follower) | *"the archetype-honest response to user nervousness is to **raise its own bar** (**stronger confirmation**, **cleanest breakouts only**, **lean harder on the technical leg**, **size down**) — not to buy defensive sectors."* — `ARCHETYPE_DEF_TREND_FOLLOWER_TEMPLATE_2026-06-24.md:47` | `TF-02, TF-01, TF-07, TF-05` |
| 6 | **`guardian`** (Capital Preserver) ⚠️ | *"**raise the quality bar** / **tighten the volatility ceiling** / **demand cleaner balance sheets** — not trade faster or chase a hedge into junk."* — `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md:47` | `CP-01, CP-02` |

### The one row that needs a ruling, not just a blessing — row 6

**Three clauses, two ids.** "Demand cleaner balance sheets" is not a third dial; it restates the first. `CP-01`'s own canonical text reads **"Raise the quality bar (demand cleaner fundamentals)"**, and balance sheets *are* fundamentals. No other id on the Capital Preserver menu names that dial — `CP-08` is *"Require a stronger fundamental **catalyst** before adding"*, which is a reason to act, not a measure of cleanliness.

So the build proposes **two**, and says so rather than padding to three. Founder's call:

- **(a) Ship `CP-01, CP-02`** *(what is committed)* — strictly faithful to the sentence; the register is shorter for `guardian` than for the rest, which is honest: its charter says "its caution already IS the identity."
- **(b) Add `CP-08`** — the charter's *next* sentence says *"getting more cautious = being even more selective at entry, even more patient at hold."* Read as clauses, that is `CP-08` (more selective at entry) and `CP-03` (more patient at hold). Taking only the first would give `CP-01, CP-02, CP-08` — which is, coincidentally, exactly what the retired policy derivation produced.
- **(c) Add both `CP-08` and `CP-03`** — treats the whole "More cautious" paragraph as the source rather than its first sentence.

The brief says *the sentence beginning "More cautious"*, so (a) is committed. (b) or (c) is a one-line data edit in `src/data/archetypeAdjustments.js:152` plus the two hand-transcribed test tables; the validator and the renderer need no change.

### Two smaller notes on the table

- **Clause order, not menu order.** `contrarian` renders `CN-03, CN-01, CN-02` and `momentum_chaser` renders `TF-02, TF-01, TF-07, TF-05`. That looks scrambled against the menu and is deliberate: it is the charter's own priority order, and it mirrors the PROTECTED BIAS prose rendered eight lines above. Say the word and both sort to menu order.
- **`diversifier` is confirmed, not assumed.** The brief asked for the review's read (`DV-01, DV-02, DV-03`) to be checked against the charter. It is exact — the charter's three clauses are "tighten the cap / widen the spread / rebalance sooner" and the three canonicals are "Tighten the concentration cap (thinner per sector)", "Widen the spread (target more sectors)", "Rebalance a creeping sector sooner".

---

## Executive verdict

| Item | Verdict |
|---|---|
| The field (`cautiousRegister` on all six archetypes, from the charter) | **DONE** — `src/data/archetypeAdjustments.js:66, 93, 120, 152, 180, 207` |
| The renderer reads the field, nothing derived | **DONE** — `api/_utils/voiceLayerPrompt.js:2761-2790` |
| `[concentration: …]` removed entirely | **DONE** — zero occurrences of `[concentration` in any prompt at any flag state, pinned by a row |
| `[opposite of {id}]` unchanged | **CONFIRMED** — reads `ADJUSTMENT_CONFLICT_GROUPS`, byte-identical logic |
| The validator (3 rules) | **DONE** — `api/_utils/archetypeRegistry.js:207-250`, each rule shown failing |
| SP-01 now carries the tag | **YES** — `More cautious, in character: SP-01, SP-02, SP-06.` |
| Flag-off bytes identical (147-hash golden) | **UPHELD** — 147 whole-prompt hashes + both slice goldens pass untouched |
| Full suite | **13 467 passed / 64 skipped, exit 0** |
| `lint:gate` | **exit 0** |
| `vite build` | **exit 0** |
| Mutation check | **8 / 8 caught** |
| Fence (§1) | **NO CONTACT** — zero intersection between the 7-file diff and the §1 list |
| PR | **not opened** (brief: "Push. No PR. STOP.") |

---

## 1. What was wrong, restated

The fit-check build derived `[cautious register]` from `policy`: `riskDirection === 'lower' && concentrationDirection === 'neutral' && timeHorizonDirection === 'neutral'`.

That derivation **cannot** reproduce the charter, and the proof is structural, not statistical: `SP-02`, `SP-06` and `SP-07` carry byte-identical direction triples *and* the same `coreAlignment`, so **no function of those fields can include two of them and exclude the third** — while the Speculator charter names `SP-01, SP-02, SP-06`. The only field separating the three is `forbiddenOpposite`, free prose naming the reversal, which is deliberately never rendered and would be a second source for the same fact if it were read as a dial.

Measured across all six, with both counts stated precisely (the record's table gave only the first):

| archetype | derived from `policy` | the charter | |
|---|---|---|---|
| `degen` | SP-02, SP-06, SP-07 | **SP-01**, SP-02, SP-06 | drops the first-named |
| `contrarian` | CN-01, CN-02, CN-06, CN-07 | **CN-03**, CN-01, CN-02 | drops the first-named; adds two |
| `analyst` | FI-01, FI-02, FI-07, FI-08 | FI-01, FI-02, **FI-03** | drops the third-named; adds two |
| `diversifier` | DV-06 | DV-01, DV-02, DV-03 | **entirely disjoint** |
| `guardian` | CP-01, CP-02, CP-08 | CP-01, CP-02 | superset — over-names CP-08 |
| `momentum_chaser` | TF-01, TF-02, TF-05, TF-06, TF-07, TF-08 | TF-02, TF-01, TF-07, TF-05 | superset — over-names TF-06, TF-08 |

**Four of six dropped a move the charter names** — the damaging half, because a player asking for "more cautious" was pointed away from it. **Six of six were not the charter** — the two the review called "agrees" agree only as supersets. Both counts are now pinned as executable rows (`src/data/archetypeAdjustments.test.js`, *the retired `policy` derivation cannot reproduce the charter*).

And `[concentration: tighter]` rendered `policy.concentrationDirection`, which the data module's own standing drafting rule says **tracks the constraint verb, not the book outcome**. The identical string therefore meant "more concentrated" on `SP-04` and "more spread" on `DV-01`, while `DV-05` — the one DV id that genuinely concentrates — carried no tag at all. A tag that points two ways is worse than no tag, so it is gone; the dial the model actually needs is `[opposite of …]`, which reads the **adjudicated** groups.

## 2. The changes

### `src/data/archetypeAdjustments.js` (+59)

`cautiousRegister: [ids]` on each of the six archetypes, each with the charter `file:line` it was read from in a comment beside it, plus a module-header block stating why the field exists and that the founder owns the mapping. New accessor:

```js
export const getCautiousRegister = (codeId) =>
  ARCHETYPE_ADJUSTMENTS[codeId]?.cautiousRegister ?? [];
```

Directive-adjacent read path, so **no analyst fallback** (ADOPT #4): an unknown archetype yields `[]` and the prompt renders no cautious-register line rather than another archetype's.

### `api/_utils/voiceLayerPrompt.js` (+28 / −41)

`renderMenuAnnotations` now tests `getCautiousRegister(codeId).includes(adjustment.id)`. `renderCautiousRegisterLine(codeId)` returns the same list — so the per-line tag and the summary line are **one list by construction**, not one predicate rendered twice. The `[concentration: …]` branch is deleted. `[opposite of …]` is untouched. Both functions still return `''` first thing when the flag is off.

### `api/_utils/archetypeRegistry.js` (+55)

`validateCautiousRegister({ archetypeId, register, allowlistIds, conflictGroups })` — exported **pure**, wired into `validateRegistryCompleteness`. Three rules:

1. every id is on **that** archetype's own menu (a typo or a cross-archetype id points the model at something it may not select);
2. the list is non-empty (every charter has the sentence, so an empty list means the field was never authored — and the prompt would silently drop the line rather than fail);
3. no two ids in one list share a conflict group (otherwise the register offers both ends of one dial as "more cautious" — the very §9 disagreement the field exists to end).

Exported pure so the three failure modes are testable with synthetic input: mocking `src/data/archetypeAdjustments.js` inside the registry's own suite would also fake the identityHash lock, which needs the real content.

**The field is deliberately NOT surfaced on `getArchetypeDefinition`.** Doing so changes `computeIdentityHash()` and forces an `ARCHETYPE_IDENTITY_VERSION` bump plus two new snapshot artifacts (`v{N}` and the candidate `v{N+1}`) for a fact no registry consumer reads yet. That is not speculation — mutation **M8** applies exactly that change and reds both snapshot locks. A row states the choice so a later reader does not "fix" it without minting the versions.

### `src/config/featureFlags.js` (+11 / −4) — declared scope note

Outside the brief's file list, and done deliberately. The `DIRECTIVE_FIT_CHECK_ENABLED` docstring named `[concentration: tighter|wider]` and said the annotations were *"derived from the data module's own `policy`"*. Both sentences become false in this commit. Leaving a knowingly-wrong docstring at the flag is the C-20 prose-honesty defect this repo has paid for before, so the comment is corrected **in the same commit as the code it describes**. Three sentences, comment-only, no behavior. Revert it if you would rather it were separately tasked.

## 3. The flag-off invariant

Unchanged, and proved by the goldens the fit-check build captured from the true pre-build module:

- **147 whole-prompt hashes** (7 modes × grounded × 8 archetypes × 3 phases × fixtures) — pass, untouched.
- Both **slice goldens** (archetype block, phase rules) — pass, untouched.
- The `[concentration` absence row asserts across the **whole prompt at BOTH flag states**, not just the menu block — a flag-gated absence would let the tag return on a flip.

Why it holds by construction: no new flag; both renderers return `''` before reading anything when `DIRECTIVE_FIT_CHECK_ENABLED` is false; and a new sibling key on `ARCHETYPE_ADJUSTMENTS[codeId]` touches neither `zones` nor `adjustments`, the only two things `buildArchetypeIntegrityBlock` renders.

## 4. Tests

| Row | File | What it pins |
|---|---|---|
| A-1 Speculator line table | `voiceLayerPrompt.fitCheck.test.js` | **SP-01 now carries `[cautious register]`**; SP-07 does not; SP-04/SP-05 carry only `[opposite of …]` |
| the cautious-register line | ” | `More cautious, in character: SP-01, SP-02, SP-06.` |
| Contrarian | ” | `CN-03` tagged; `CN-06`/`CN-07` bare; line is `CN-03, CN-01, CN-02` |
| **A4, CLOSED** (the former LIMIT row, inverted) | ” | all six agree with the charter — the same six hand-transcribed expectations, now asserted to AGREE |
| tag ≡ summary | ” | every `[cautious register]` tag and the summary line name the same ids, all six archetypes |
| `[concentration` absent | ” | zero occurrences in the whole prompt at **both** flag states |
| DV rows | ” | `DV-01/02/03` carry the tag; **`DV-06` does not** |
| charter table | `archetypeAdjustments.test.js` | the six lists, hand-transcribed from the charters, not read back from the module |
| no fallback | ” | `getCautiousRegister` unknown → `[]`, never analyst's |
| the retired derivation | ” | 4 of 6 drop a charter move; 6 of 6 differ; SP-02/06/07 triples byte-identical |
| validator × 3 | `archetypeRegistry.test.js` | **shown failing** under a bad id, an empty list, and a conflicting pair |
| full-validator mutation | ” | a doctored live register surfaces through `validateRegistryCompleteness`, then restores exactly |
| identityHash | ” | the field is not on the definition, and the hash still matches the committed snapshot |

The LIMIT row that pinned the disagreement is **deleted, not fixed** — as its own comment instructed. Its six hand-written expectations survive as the agreement row.

## 5. The mutation check (BUILD_RULES §2 — "a row that cannot fail is not a guard")

Run on a `git archive HEAD` extraction under the session scratchpad with `node_modules` symlinked, read-only on git and on the working tree (Sep 2 2026 reviewer-isolation ruling). **8 applied, 8 caught.**

| # | Mutation | Caught by |
|---|---|---|
| M1 | revert the tag to the retired policy derivation | 4 rows — SP-01, SP-07, Contrarian, tag≡summary |
| M2 | bring back `[concentration: …]` | 4 rows — the both-flag-states row, SP-04, SP-05, the dial row |
| M3 | drop `SP-01` from the charter list | 5 rows across both files |
| M4 | give the summary line its own derivation (the "one predicate, two renders" split) | 5 rows — incl. tag≡summary |
| M5 | delete the conflict-group rule | 2 rows |
| M6 | delete the non-empty rule | 2 rows |
| M7 | delete the menu-membership rule | 2 rows |
| M8 | surface `cautiousRegister` on `getArchetypeDefinition` | 3 rows — **both snapshot locks**, confirming §2's design claim |

## 6. Verification, run and recorded

```
npx vitest run           → 690 files passed | 3 skipped (693)
                           13467 tests passed | 64 skipped (13531)     exit 0
npm run lint:gate        → eslint . --config eslint.gate.config.js --max-warnings 0   exit 0
npm run build            → vite build, ✓ built in 17.68s                exit 0
git diff --stat HEAD~1   → 7 files, +512 / −96
```

`npm ci` was run first — the container had no `node_modules`.

## 7. Fence and ratchet

- **§1 fence — NO CONTACT.** None of the 7 changed files is on the §1 list. `voiceLayerPrompt.js`, `archetypeRegistry.js`, `archetypeAdjustments.js` and `featureFlags.js` are all non-fenced. `archetypeRegistry.js` continues to *read* the fenced `agentArchetypeConfig.js` / `archetypeScoring.js`, which §1 expressly permits; nothing here edits them.
- **§2.3 import-boundary ratchet — no trip.** `api/_utils/voiceLayerPrompt.js` is already in `archetypeImportBoundaryBaseline.json:26`, and the ratchet is file-level, not symbol-level — adding `getCautiousRegister` to an existing import creates no new importer. The ratchet test passes.
- **§4 dependency surface — intact.** No new module edge. Both test files' imports of the data module remain the unmocked runtime guard.
- **Prompt-honesty registry — unchanged.** `voiceLayerPrompt.js` is already in `PROMPT_CONTRIBUTING_MODULES`; the honesty sweep passes.
- **Flag-pin guard — unchanged.** No flag value moved.

## 8. What this does NOT close

- **D-3, the flip-order hazard, still stands.** `VOICE_GROUNDING_MODE` must not walk to `'canary'`/`'on'` while `DIRECTIVE_FIT_CHECK_ENABLED` is `true`. Untouched here and out of scope; its LIMIT row still passes.
- **A2 and A3 still stand** — the few-shots and `TWO_LEG_SIGNAL_RULE` still teach a paraphrase. Their LIMIT rows are untouched.
- **J7, the eval harness, is a separate branch** — `claude/eval-harness-fit-mismatch`, built in the same session, its own report.
- **A7/C2 still stands** — a `fit_mismatch` remains invisible to the player while nobody is grounded.

## 9. Found outside the task — reported, not fixed (BUILD_RULES §3)

None. No defect was found outside this task's scope during the build.

## 10. Disclosure for the PR body, when the founder opens one

> Changes `src/data/archetypeAdjustments.js`, `api/_utils/voiceLayerPrompt.js`, `api/_utils/archetypeRegistry.js`, `src/config/featureFlags.js` (comment only) and three test files. **No §1-fenced file is edited.** Fenced functions called: none — `archetypeRegistry.js` reads the fenced `agentArchetypeConfig.js` (`ARCHETYPE_CONFIGS`, `KNOB_CONFIG_VERSION`, `VALID_ARCHETYPES`) and `archetypeScoring.js` (`ARCHETYPE_WEIGHTS`, `ARCHETYPE_TEMPERATURES`, `ARCHETYPE_CONSTRAINTS`) exactly as it already did, read-only. `DIRECTIVE_FIT_CHECK_ENABLED` stays `false`; flag-off prompt bytes are byte-identical, proved by 147 pre-build whole-prompt hashes. Below the §2 review threshold (7 files / 608 lines); mutation-checked 8/8 regardless. Crons untouched.
