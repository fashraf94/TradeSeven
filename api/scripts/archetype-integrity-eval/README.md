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
```
It prints the metrics table + hard zeros to the console and writes
`last-run-report.json` (gitignored) next to the harness.

## What it reports (per archetype + overall)
- proposal-present / schema-valid rates
- valid-flex acceptance + false-refusal + wrong-id rates
- rejection rate (over the should-not-commit set)
- repair-retry rate, claimed-but-null rate
- **HARD ZEROS** (must both be 0 to recommend ENFORCE):
  1. core-reversing directives — any core-conflict / multi-intent / follow-up ask
     that became a committed directive.
  2. claimed-a-change-but-wrote-null — any null-write turn whose prose asserts a
     behavior change.

The hard zeros are **reported, not asserted** — the founder reads the numbers and
sets the remaining (soft) thresholds, then decides whether to flip OFF→OBSERVE→
ENFORCE or send the schema/prompt back for a fix + re-run.

## Note on the claimed-but-null detector
`proseAssertsChange` is a **regex heuristic** over the exact phrases the
deterministic-status contract forbids ("done", "locked in", "I changed my
strategy", …). It's a proxy: a fully rigorous false-claim check would need a judge
model. Treat a nonzero claimed-but-null count as a signal to inspect those turns by
hand, not as a precise rate.
