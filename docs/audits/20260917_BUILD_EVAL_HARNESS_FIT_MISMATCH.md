# Build — The eval harness counts `fit_mismatch` as its own thing

**Branch:** `claude/eval-harness-fit-mismatch` · cut fresh from `origin/main` @ `ac5f8ebf`
**Session preamble (BUILD_RULES §2 / §3):** `git fetch origin` ran first (`origin/main` moved `398c528e..ac5f8ebf`). Tree clean at branch cut. No `--unshallow`.
**Flag:** none. No production code, no fenced file, no flag value moved. `DIRECTIVE_FIT_CHECK_ENABLED` stays `false` in the repo.
**Files:** 6 · **+766 / −35** (327 of those insertions are the captured golden JSON). Below the §2 review threshold.

---

## Executive verdict

| Item | Verdict |
|---|---|
| **1. The bucket** — `fitMismatchRate` as its own rate | **DONE** |
| ” — excluded from the false-refusal numerator | **DONE** |
| ” — wrong-id rate no longer moves when a turn becomes `fit_mismatch` | **DONE**, and proved by an invariance row, not just asserted |
| ” — every existing metric byte-identical on a `fit_mismatch`-free corpus | **DONE** — golden captured from `origin/main`'s module |
| **2. The pre-flight override** | **DONE without touching `directiveGate.js`** — `EVAL_FIT_CHECK=1` extends the `vi.mock` the harness already uses. No STOP needed. |
| **3. Tests** — shown failing first; golden; mutation | **DONE** — 7 mutations applied, **7 caught**; the "before" demo reds on 4 rows |
| **4. Then run it** | ⛔ **BLOCKED — cannot run in this environment.** No `OPENROUTER_API_KEY`, and `openrouter.ai` is not in the egress allowlist. **No numbers are reported, because none were measured.** See §4. |
| **5. Full suite** | **13 464 passed / 64 skipped, exit 0**; `lint:gate` exit 0 |
| PR | **not opened** (brief: "Push. No PR. STOP.") |

**The one thing the founder still needs and does not have: the three rates from a real corpus run.** Everything that produces them is built, wired and tested; the run itself needs a machine with an OpenRouter key and network egress. §4 is the exact command.

---

## 1. The defect, and why it made the run unreadable

Under the flag the gate has a third terminal outcome. The proposal named a **valid** id, membership **passed**, and the reply never said the canonical sentence — so nothing is filed. On the wire that is `committed: false`, and the harness read every `committed: false` as "the model refused a legitimate ask."

It is not. It is **"the model chose an id and then paraphrased it."** Two different failures, one field.

Scored as a refusal, a single turn moved the two rates that gate the flip in opposite directions:

| | at HEAD, when a turn becomes `fit_mismatch` | |
|---|---|---|
| `falseRefusalRate` = (`validFlexTotal` − `validFlexCommitted`) / `validFlexTotal` | goes **UP** — the turn joins the numerator | wrong |
| `wrongIdRate` = `validFlexWrongId` / `validFlexCommitted` | can go **DOWN** — the turn leaves the denominator | wrong, and worse: it leaves carrying its own wrong id, so *exactly the commits the fit check exists to catch* go uncounted |

Two numbers moving against each other on the same turn cannot be read. Neither can a run made of them.

## 2. The fix

### `isFitMismatch(r)`

```js
export const isFitMismatch = (r) =>
  !r.callFailed && r.committed !== true && r.archetypeGate?.status === 'fit_mismatch';
```

Reads the gate's own `outcome` object, under the key production persists it as (`api/agent/chat.js:1056` — `archetypeGate: gateOutcome`, where `gateOutcome = gate.outcome`, `:854`). One field, one shape, harness and production — no second source. The `committed !== true` guard makes an incoherent record (both committed *and* `fit_mismatch`) count once, never twice, in the rate's denominator.

### The three rate changes

| rate | before | after |
|---|---|---|
| `falseRefusalRate` | `(total − committed) / total` | `(total − committed − fitMismatch) / total` |
| `wrongIdRate` | `wrongId / committed` | `wrongId / (committed + fitMismatch)` — **and the numerator counts a `fit_mismatch` turn's wrong id too** |
| `fitMismatchRate` | — | `fitMismatch / (committedTotal + fitMismatch)` |

**Why the numerator changed too, though the brief named only the denominator.** The brief's stated purpose is *"so that rate no longer moves when a turn becomes `fit_mismatch`."* Keeping the turn in the denominator alone does not achieve that — it would drop out of the numerator (which was gated on `r.committed`) and the rate would fall. The id the model chose is exactly as observable on a `fit_mismatch` turn as on a committed one, so the turn keeps its place in **both** halves. That is what makes the invariance exact, and a row proves it by flipping each committed record in turn and asserting the rate is unchanged every time.

**Why `fitMismatchRate` is category-blind.** The gate runs the fit check after the membership check and never looks at the corpus category (`directiveGate.js:148-162`). So "turns that reached the fit check" is `committedTotal + fitMismatch` across every category, not just `valid_flex`. The two `valid_flex` rates keep their `valid_flex` scoping via a separate `validFlexFitMismatch` counter.

### What deliberately did NOT change

- **`validFlexAcceptanceRate`** still divides by `validFlexTotal`. A turn that becomes a `fit_mismatch` genuinely did not get its directive filed, so acceptance falling is honest.
- **`coreHeldRate` / `cleanNullRate`.** A `fit_mismatch` on a should-not-commit ask still wrote null, and a null write held the core — *why* it wrote null does not change *that* it wrote null. A row states this.
- **Both hard zeros.** A `fit_mismatch` is a null write whose `directiveStatus` is `'no_change'`, so it breaches neither. A row asserts the hard zeros are untouched by the corpus-level swap.

## 3. The pre-flight override — step 2 resolved, no STOP

The brief said: *if the gate reads the flag directly, add a harness-only override that does not touch `directiveGate.js`'s production reads; if that cannot be done without changing the gate, STOP and report.*

**It can, and the harness was already doing the same thing for a different flag.** `runEval.eval.mjs` forces OBSERVE with `vi.mock('../../../src/config/featureFlags.js', …)`. `directiveGate.js:36` and `voiceLayerPrompt.js` import `DIRECTIVE_FIT_CHECK_ENABLED` by name from that same module and read it **at call time** inside the functions that gate on it, so extending that one mock lights both halves of the mechanism through the ordinary ESM live binding:

```js
const { fitCheckOn } = vi.hoisted(() => ({ fitCheckOn: process.env.EVAL_FIT_CHECK === '1' }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ARCHETYPE_INTEGRITY_MODE: 'observe',
  DIRECTIVE_FIT_CHECK_ENABLED: fitCheckOn,
}));
```

Default OFF, so an unqualified run keeps reproducing the pre-flip baseline. **No file under `api/_utils/` or `api/agent/` changed.**

### Proved end to end, hermetically

Run in the session scratchpad with a stubbed model (this artifact is not committed — say the word and it becomes a seventh file):

| | `EVAL_FIT_CHECK` unset | `EVAL_FIT_CHECK=1` |
|---|---|---|
| prompt: menu carries `[cautious register]` | `false` | **`true`** |
| prompt: ack asks for the canonical word for word | `false` | **`true`** |
| gate on a **quoting** reply | `committed` | `committed` |
| gate on a **paraphrasing** reply | `committed` | **`fit_mismatch`** |
| `falseRefusalRate` | 0 | **0** |
| `fitMismatchRate` | 0 | **0.5** |

Both halves light together, the paraphrase is refused, and it lands in `fitMismatchRate` — not in the refusal rate. The wiring is correct; only the live corpus is missing.

### Declared scope note

The brief's file list says *"`aggregate.js` and its tests only"*, and step 2 cannot be satisfied inside `aggregate.js` — the flag override and the `archetypeGate` stamp both live in the runner. Without the stamp, `aggregate.js` could never see the status at all. So `runEval.eval.mjs` and `README.md` are in the diff, deliberately, and named here rather than left to be discovered. Both are harness files; neither ships.

## 4. ⛔ Step 4 — the run, and why there are no numbers

**The pre-flight run was attempted and it failed. No rates are reported, because none were measured.** Fabricating them would defeat the entire point of the task.

```
$ EVAL_FIT_CHECK=1 npx vitest run --config vitest.eval.config.mjs

[gemmaClient] gemma_latency {"ms":101,"outcome":"http_error","status":403,
                             "model":"google/gemma-4-26b-a4b-it","maxTokens":800}
Error: [eval] Gemma preflight FAILED: OpenRouter 403: Host not in allowlist:
       openrouter.ai. Add this host to your network egress settings to allow access.
       This harness needs OPENROUTER_API_KEY set AND outbound access to openrouter.ai.
exit 1
```

Two independent blockers, both verified at this HEAD:

1. **`OPENROUTER_API_KEY` is unset** in this container.
2. **`openrouter.ai` is not in the egress allowlist** — a direct probe returns `CONNECT tunnel failed, response 403`.

This is not new and not a regression: the harness README has said so since Phase H (*"The CI/sandbox where this was built has **neither** … the harness's live numbers must come from an environment that has both"*), and the harness's own preflight is designed to fail fast with exactly this diagnostic rather than burn 140 calls.

**What the founder runs, on a machine with a key and egress:**

```bash
OPENROUTER_API_KEY=… EVAL_FIT_CHECK=1 npx vitest run --config vitest.eval.config.mjs
# smoother, ~3× the calls and ~3× the time:
OPENROUTER_API_KEY=… EVAL_FIT_CHECK=1 EVAL_RUNS_PER_ITEM=3 npx vitest run --config vitest.eval.config.mjs
```

≈140 Gemma calls per pass. It prints the three flip rates on their own line and writes `last-run-report.json` (gitignored) next to the harness.

**How to read what comes back — the sentence the brief asked for, stated in advance since the number is not in hand:**

> **If `fitMismatchRate` is not small, the prompt is still teaching the paraphrase and the flip waits.**

A high `fit_mismatch` rate is **not** the gate misfiring — the gate is doing exactly what it was built to do. It is the prompt failing to get the model to say the sentence it selected. And the fit-check review already named two live reasons to expect a nonzero rate before the prompt is touched again, **both still open on `main`**:

- **A2** — the flag-ON prompt still ships four few-shots (`CONFIRMATION_EXAMPLE` + three phase examples) that model a confirmation quoting no canonical, in the *higher-attention* slot, *before* the demand. Feeding the prompt its own worked answer yields `fit_mismatch`.
- **A3** — `TWO_LEG_SIGNAL_RULE`, pushed under the same guard as the menu, prescribes "tighten the stop," a near-miss of a sentence the gate demands verbatim.

So a first pre-flight reading a high rate most likely indicts A2/A3, not the mechanism. That is a judgement for the founder on the numbers, not a prediction to bank.

## 5. Tests

| Row | What it pins |
|---|---|
| **BEFORE/AFTER** | two wrong-id turns, one committed and one paraphrased: `falseRefusal 0` (was 0.5), `wrongId` over **2** turns not 1, `fitMismatch 0.5` |
| **THE INVARIANT** | flips each committed record in turn to a `fit_mismatch` with the same id; `wrongIdRate` and `falseRefusalRate` unchanged every time, `fitMismatchRate` rises to say what happened |
| lands nowhere else | not a commit, not a false refusal, not either hard zero |
| category-blind | a `core_conflict` paraphrase counts in `fitMismatchRate`, not in the two `valid_flex` rates; still "held the core" |
| right id, paraphrased | in the wrong-id **denominator**, not its numerator |
| `isFitMismatch` | reads the gate record; a call failure, a plain refusal, a missing record and an incoherent record all handled; the denominator never double-counts |
| n/a vs 0 | no `fit_mismatch` → `0`; nothing reached the check → `null`, not `0` |
| per archetype | the rate splits per bucket as well as overall |
| **the golden** | every pre-build key, at every bucket, byte-identical — counts, rates, third-path, hard zeros, and the breach dump |
| **exact new keys** | `committedTotal`, `fitMismatch`, `validFlexFitMismatch`, `fitMismatchRate` — and nothing else appeared, and nothing disappeared |
| **MUTATION** | converting the golden corpus's one refusal into a `fit_mismatch` moves exactly the three rates it should and leaves the hard zeros alone |

**The golden was captured from the true pre-build module** — `git show origin/main:api/scripts/archetype-integrity-eval/aggregate.js`, written to a temp path, run over the fixture, then deleted. It was never regenerated from the code it guards; a golden regenerated from its own subject proves nothing (the discipline the fit-check build set).

**The fixture corpus** is the varied 11-record set that already lived inline in this file's order-independence block, lifted to `__fixtures__/aggregateGoldenCorpus.js` so one array feeds the order-independence rows, the golden, and the new rows. It contains **zero** `fit_mismatch` records — which is what makes it a golden — and a row asserts that.

## 6. Shown failing first, and the mutation sweep

On a copy of the working tree under the session scratchpad, `node_modules` symlinked, read-only on git (§2 reviewer-isolation). **7 applied, 7 caught.**

| # | Mutation | Reds |
|---|---|---|
| **D1** | **THE "BEFORE"** — `fit_mismatch` scored the old way (a false refusal, dropped from the wrong-id denominator) | **4 rows**: BEFORE/AFTER, THE INVARIANT, lands-nowhere-else, MUTATION CHECK |
| D2 | left OUT of the wrong-id denominator only | 3 rows |
| D3 | kept IN the false-refusal numerator only | 4 rows |
| D4 | `fitMismatchRate` denominator narrowed to `valid_flex` | 2 rows |
| D5 | `isFitMismatch` loses the `committed` guard | 1 row |
| D6 | a new metric silently added | the exact-new-keys row |
| D7 | an existing metric quietly moved (`cleanNullRate`) | the golden row |

**D1 is the brief's "shown failing first."** Against the old scoring the new rows red on `falseRefusalRate`, on the wrong-id counts, and on `fitMismatchRate` — they are unreachable without the split.

## 7. Verification

```
npx vitest run           → 690 files passed | 3 skipped (693)
                           13464 tests passed | 64 skipped (13528)   exit 0
npm run lint:gate        → exit 0
git diff --cached --stat → 6 files, +766 / −35
EVAL_FIT_CHECK=1 npx vitest run --config vitest.eval.config.mjs  → exit 1, blocked (§4)
```

`npm ci` was run first — the container had no `node_modules`. `vite build` was not run for this branch: nothing here reaches the client bundle (the §2 build requirement exists because no test imports `App.jsx`, and this diff touches no `src/` file). It was run and passed on the sibling `claude/cautious-register` branch.

## 8. Fence, scope, and what is still open

- **§1 fence — NO CONTACT.** All six changed files are under `api/scripts/`; none is on the §1 list, and none is production code. `aggregate.js` continues its one read-only import of `src/data/archetypeAdjustments.js` (`getAllowlist`), unchanged.
- **§2.3 import ratchet — no trip.** No new importer; the one import is unchanged.
- **No cron, no flag flip, no `vercel.json` change.**
- **Still open, and not this task's:** the harness cannot exercise the **grounded** prompt (D-3's flip-order hazard), because the corpus runs the shipped assembly. `EVAL_FIT_CHECK=1` with `VOICE_GROUNDING_MODE` walked would be a *different* pre-flight, and D-3 says those two flags must not be lit together until one of the two fixes lands. Nothing here changes that.

## 9. Found outside the task — reported, not fixed (BUILD_RULES §3)

**One, low severity, pre-existing.** `runEval.eval.mjs` is excluded from the default suite by filename convention (no `.test.`/`.spec.`), so **nothing in CI type-checks or executes it** — a syntax error or a broken import in the harness surfaces only when someone runs the live eval, which needs a key and egress. That is how it has always been and it is not a regression; a hermetic smoke row that imports the module and asserts the record shape would close it. Filed for separate tasking, not fixed here.

## 10. Disclosure for the PR body, when the founder opens one

> Changes six files, all under `api/scripts/archetype-integrity-eval/`. **No production code, no §1-fenced file, no flag value.** Fenced functions called: none. `aggregate.js` splits `fit_mismatch` into its own rate, out of the false-refusal numerator and into the wrong-id population (numerator and denominator), so that rate no longer moves when a turn becomes one. Every pre-existing metric is byte-identical on a `fit_mismatch`-free corpus, proved by a golden captured from `origin/main`'s own module. `runEval.eval.mjs` gains a harness-only `EVAL_FIT_CHECK=1` override (an extension of the `vi.mock` it already used for OBSERVE) and stamps the gate's `outcome` on each record. **The live pre-flight run has NOT been performed** — this sandbox has no `OPENROUTER_API_KEY` and `openrouter.ai` is blocked; the command and how to read its output are in §4 of the build record.
