# PR-d — Watchlist-Framing Corpus Eval (WS3, spec §5.1)

The measurement half of PR-d: does the canonical §5.1 framing actually move the
model's treatment of watched names vs today's copy? It runs the FIXED 36-item
corpus (6 archetypes × 6 scenarios) through the **real** `buildStrategyUserPrompt`
under **both** framings — A = the frozen pre-PR-d "eligibility nudge", B = the
canonical §5.1 text — with real OpenRouter calls, and reports the A→B
distribution deltas per scenario. **Founder-read; no hard thresholds pre-launch.**

## Status — IMPORTANT

**This harness has NEVER been live-run.** It was authored in the build sandbox,
which has **no `OPENROUTER_API_KEY`** and **no egress to `openrouter.ai`**
(Phase-0 §5.7 constraint — same as the archetype-integrity eval). The hermetic
corpus tests (`corpus.test.js`) run in the default suite and prove the corpus is
complete; the live numbers must come from **Flash's local run**.

## How to run (Flash)

From the project root, on the `claude/release2-pr-d-held` branch:

```bash
# one pass over the corpus (36 items × 2 framings = 72 calls)
OPENROUTER_API_KEY=<key> npx vitest run --config vitest.watchlisteval.config.mjs

# smooth the model's non-determinism over N passes (72 × N calls)
OPENROUTER_API_KEY=<key> EVAL_RUNS_PER_ITEM=3 npx vitest run --config vitest.watchlisteval.config.mjs
```

Optional: `EVAL_MODEL=<openrouter-model-id>` (default: the house Gemma id from
`gemmaClient.js`), `EVAL_CONCURRENCY=<n>` (default 6 — stays under rate limits).

It prints the scenario × framing table and writes `last-run-report.json`
(gitignored) next to this README — attach that file to the PR-d gate review.

## The six scenarios (§5.1)

| Scenario | The probe | Honest treatment under §5.1 |
|---|---|---|
| `off_style_watched` | A watched name that is off-style for the archetype | Evaluated under archetype criteria; poor fit stated, not silently included |
| `missing_data` | A watched name absent from the scored universe ('-' scores) | Data gap stated in reasoning; neither auto-in nor auto-out |
| `full_watchlist` | 8 watched names of very mixed quality | No wholesale inclusion; per-name merit |
| `already_held` | A watched name the book already holds | No double-weighting an incumbent |
| `conflicting_chat_pressure` | The watchlist thesis is a mandate ("you MUST include") | The framing wins: attention, never a mandate |
| `equal_ranked_alternatives` | A watched name score-identical to a non-watched one | Attention may break the tie, WITH the tie stated |

## What to read in the deltas (expected direction, not thresholds)

- `full_watchlist` / `off_style_watched`: **inclusion pressure DOWN** under B
  (the old copy said "Include every user-equipped ticker…").
- `missing_data` / `off_style_watched`: **reason-stated UP** under B ("state
  this in your reasoning").
- `equal_ranked_alternatives`: inclusion roughly stable (attention is still
  real) — the interesting read is whether the reason mentions the tie.
- `parseFailed` should be near zero in both variants — if it is not, the
  numbers are noise; raise `EVAL_RUNS_PER_ITEM` or flag the model choice.

## Gate reminder (changelog #12)

PR-d merges only when: Release-1 watch closed AND (promotion → +1
maximum-battle-duration quiet after the final Release-1 deploy | reversion →
fresh watch against restored values + quiet period) AND zero mixed-generation
battles active. The corpus-eval report is an input to that review, not a
bypass of it.
