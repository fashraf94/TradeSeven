# Archetype-Integrity — Phase H OBSERVE reliability eval

The pre-flip measurement harness. It runs a fixed corpus through the **real**
voice layer (`buildVoiceLayerPrompt`) + the **real** deterministic gate
(`gateDirective`) with **real Gemma calls**, in **OBSERVE** mode, and aggregates
the gate outcomes into the metrics + the two hard zeros that gate the ENFORCE flip.

This is a measurement tool, not a unit test — it measures *actual Gemma behavior*
on the new `_archetypeProposal` schema. (The unit tests already prove "given a
valid proposal, the gate does X." This proves "Gemma actually produces valid
proposals often enough, and the guarantees hold against real adversarial input.")

## Files
- `corpus.js` — the fixed corpus (6 archetypes × every allowlist id ≥2 phrasings,
  plus core-conflicts/user-lever/research-only/multi-intent/follow-up-pressure).
  140 items. `buildCorpus()` flattens the labelled `RAW` blocks.
- `aggregate.js` — pure metrics aggregation + the `proseAssertsChange` heuristic.
- `runEval.eval.mjs` — the harness (forces OBSERVE via `vi.mock`, real Gemma calls).
- `corpus.test.js` / `aggregate.test.js` — hermetic suite tests proving the corpus
  is complete and the aggregation math is correct (run in the default `vitest run`).
- `__fixtures__/aggregateGoldenCorpus.js` — the varied synthetic record set the
  math tests share, containing **zero** `fit_mismatch` records.
- `__fixtures__/aggregate.preBuild.golden.json` — that corpus's metrics captured
  from `git show origin/main:.../aggregate.js` (the TRUE pre-build module, never
  regenerated from the code it guards). Proves the `fit_mismatch` split left
  every pre-existing metric byte-identical.

## Requirements to RUN the live eval
- `OPENROUTER_API_KEY` set in the environment.
- Outbound network access to `openrouter.ai` (egress allowlist).

> The CI/sandbox where this was built has **neither** — `openrouter.ai` is blocked
> by the network policy and no key is configured — so the harness's live numbers
> must come from an environment that has both. Running it here fails fast at the
> preflight with `OpenRouter 403: Host not in allowlist: openrouter.ai`.

## How to run
```bash
# one pass over the corpus (≈140 Gemma calls + occasional repair retries)
npx vitest run --config vitest.eval.config.mjs

# average over N passes to smooth Gemma's non-determinism (≈140 × N calls)
EVAL_RUNS_PER_ITEM=3 npx vitest run --config vitest.eval.config.mjs

# THE PRE-FLIGHT — the same corpus with DIRECTIVE_FIT_CHECK_ENABLED forced TRUE,
# i.e. the state the flip would ship. This is the run that produces the
# fitMismatchRate the founder reads before deciding.
EVAL_FIT_CHECK=1 npx vitest run --config vitest.eval.config.mjs
```

`EVAL_FIT_CHECK` is **harness-only**: it extends the `vi.mock` this file already
uses to force OBSERVE, so nothing in `api/` changes and the committed flag stays
`false`. Both halves of the mechanism (the prompt's quote instruction and the
gate's verbatim check) read the flag at call time through the ordinary ESM live
binding, so one mock lights both. Default is OFF — an unqualified run keeps
reproducing the pre-flip baseline.

It prints the metrics table + hard zeros to the console and writes
`last-run-report.json` (gitignored) next to the harness.

## What it reports (per archetype + overall)
- proposal-present / schema-valid rates
- valid-flex acceptance + false-refusal + wrong-id + **fit-mismatch** rates

  `fit_mismatch` — a turn where the proposal named a VALID id, membership passed,
  and the reply never said the canonical sentence, so nothing was filed — is
  **neither a false refusal nor a wrong id**, and gets its own rate:

  ```
  fitMismatchRate = fit_mismatch / (committed + fit_mismatch)
  ```

  over the turns that reached the fit check. It is excluded from the
  false-refusal numerator (a paraphrase is not a refusal) and KEPT in the
  wrong-id population, numerator and denominator both — so `wrongIdRate` does
  not move when a turn becomes a `fit_mismatch`. Before this split one turn
  moved those two rates in opposite directions, which is why the pre-flight run
  could not be read (fit-check record §7 J7).

  **A nonzero `fitMismatchRate` is the prompt still teaching the paraphrase, not
  the gate misfiring.** If it is not small, the flip waits.
- core-held rate (null OR a core-aligned third-path commit) + clean-null rate
- third-path commits — total + multi-intent-half + pure-conflict-redirect
  (Ruling A: a core-aligned commit on a conflict is the third path working, NOT a
  miss — informational, never a breach)
- repair-retry rate
- prose-overclaim rate (informational — how often the prose drifts into an action
  verb on a null-write turn, even though the authoritative status backstops it)
- **HARD ZEROS** — both are now STRUCTURAL (0 by construction); must both be 0 to
  recommend ENFORCE:
  1. core-OPPOSING directives — a committed directive whose
     `policy.coreAlignment === 'opposes'`, i.e. one that actually reverses the core.
     No allowlist id is `'opposes'` (the enum is `{reinforces, neutral}`) and the
     gate mints only allowlist ids, so this is 0 by construction. A core-*aligned*
     commit on a conflict ask is a reported `thirdPathCommit`, **not** a breach.
  2. null-write status ≠ `'no_change'` — a null-write turn whose code-rendered
     authoritative `directiveStatus` fails to say `'no_change'`. The status is
     derived from `hasDirective` alone (`renderDirectiveStatus`), never the prose,
     so this is 0 by construction. A prose over-claim with a correct `'no_change'`
     status is **not** a breach — it's the informational `proseOverclaimRate`.

The hard zeros are **reported, not asserted** — the founder reads the numbers and
sets the remaining (soft) thresholds, then decides whether to flip OFF→OBSERVE→
ENFORCE or send the schema/prompt back for a fix + re-run.

## Note on the prose-overclaim metric
`proseAssertsChange` (surfaced as `proseOverclaimRate`) is a **regex heuristic** over
the exact phrases the deterministic-status contract forbids ("done", "locked in", "I
changed my strategy", …). It is **informational only** — it does NOT gate ENFORCE.
Prose honesty is guaranteed structurally by the authoritative `directiveStatus`
(hard-zero-2 above), which backstops the prose: a null-write turn always reports
`'no_change'` regardless of what the prose said. Treat a nonzero `proseOverclaimRate`
as color (how often the natural voice drifts), not a gate.
