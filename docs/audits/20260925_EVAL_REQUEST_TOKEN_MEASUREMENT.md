# Eval request token measurement — keyed run

**Date:** 2026-09-25
**Script:** `scripts/measure-eval-request-tokens.mjs`, run with `ANTHROPIC_API_KEY` set (`messages.countTokens`, no inference)
**Output ceiling at the time of the run:** 2,048 (the run predates the 2,048 → 3,072 change, `bdf277a7`)

## Verdict

| Question | Answer |
|---|---|
| Input fits the 12,000 budget, declarations ON? | Yes. 11,851 real tokens, margin 149 (98.8% used) |
| Maximal declarations block, real tokens | 1,463 (chars/4 estimated 1,085) |
| At 2,048, does the maximal block fit a mean/p99/max response? | No. All three truncate (−322 / −655 / −836) |
| At 3,072, does the maximal block fit a mean/p99/max response? | Yes. All six rows fit, and the tightest (max response + maximal block) has 188 tokens left |

## Keyed run output (verbatim)

The paste starts at the title line. The leading blank line and the `═` rule above it were not in the capture.

```
  EVAL REQUEST — REAL INPUT TOKEN COUNT (declarations off vs on)
══════════════════════════════════════════════════════════════════════════════
  model         claude-haiku-4-5-20251001        api/_utils/agentEvalTransport.js:48
  input budget  12,000 tokens        api/_utils/composition.m7e2eBudget.test.js:62
  output cap    2,048 tokens         api/_utils/agentEvalTransport.js:59
  ledger cap    50,000 tokens        input + output ceiling must fit under this
  request       api/cron/agent-evaluate.js:2767-2782
  fixture       api/_utils/composition.m7e2eBudget.test.js:34-154  (sha256 e70410e9750e… verified)

  The "[AgentEval] Failed to fetch institutional context" warning printed
  above is EXPECTED: it is the suite's own firebaseAdmin mock refusing a
  Firestore read (section 1), and it is how the fixture gets its stated
  scope. The vitest suite prints the same line.

── ASSEMBLED BYTES (local, no API) ───────────────────────────────────────────
  component                                      chars       chars/4
  system  buildEvalSystemPrompt                 16,349         4,088
  user    identity block                         6,260         1,565
  asst    ack                                       78            20
  user    live context                           5,140         1,285
  tools   declarations OFF                       8,539         2,135
  tools   declarations ON                       13,166         3,292

  TOTAL   declarations OFF                      36,366         9,093
  TOTAL   declarations ON                       40,993        10,250
  delta   the declarations cost                 +4,627        +1,157

  chars/4 is the repo's estimate convention, NOT a measurement
  (composition.m7e2eBudget.test.js:21-23). It does not cover tool_choice.

── MEASUREMENT — messages.countTokens ────────────────────────────────────────
  variant                                         REAL       chars/4    est. error
  declarations OFF                              10,600         9,093        +1,507
  declarations ON                               11,851        10,250        +1,601
  DIFFERENCE — the declarations cost            +1,251        +1,157           +94

── MARGIN against the 12,000-token input budget ──────────────────────────────
  variant                                         REAL        margin   budget used
  declarations OFF                              10,600         1,400         88.3%
  declarations ON                               11,851           149         98.8%

  budget-of-record, declarations OFF: 10,600 < 12,000  →  PASS
  budget-of-record, declarations ON : 11,851 < 12,000  →  PASS
  ledger form,      declarations OFF: 10,600 in + 2,048 out = 12,648 < 50,000  →  PASS  (headroom 37,352)
  ledger form,      declarations ON : 11,851 in + 2,048 out = 13,899 < 50,000  →  PASS  (headroom 36,101)

── OUTPUT SIDE — the largest output the fixtures produce at shadow ───────────
  Input size says nothing about output headroom, so this is the separate
  number. The blocks come from api/_utils/__fixtures__/tickStampsHarness.js.
  `declarations` is the LAST schema property, so a response that hits the
  2,048-token ceiling cuts it before any earlier field.

  fixture output block                           chars     chars/4        REAL
  maximal declarations (§3.2 caps)               4,338       1,085       1,463
  typical declarations (2 shots, 1 watch)          498         125         153
  LARGEST: swap result + maximal block           5,015       1,254       1,638

  Truncation headroom against the 2,048-token ceiling, crossed with the
  DR-13 production baseline (agentEvalTransport.js:50-58 — observed BEFORE
  declarations existed: mean 907, p99 1,240, max 1,421):

  response + block  (REAL tokens)                   headroom       verdict
  mean response + typical block                          988          fits
  mean response + maximal block                         -322     TRUNCATES
  p99 response + typical block                           655          fits
  p99 response + maximal block                          -655     TRUNCATES
  max response + typical block                           474          fits
  max response + maximal block                          -836     TRUNCATES

  A negative row is stated, not hidden: shadow reports each such tick as a
  truncation event (stop_reason === 'max_tokens'). These are fixture upper
  bounds crossed with a pre-declarations production distribution — the real
  shadow truncation RATE still has to come from shadow observation.
```

## Headroom recomputed at 3,072

These rows are computed by hand, not printed by the script. They use the same formula as the script (`ceiling − observed response − block`) with the same real block counts from the run above (typical 153, maximal 1,463) and the same DR-13 baseline (mean 907, p99 1,240, max 1,421). Only the ceiling changes, to 3,072 (`EVAL_MAX_OUTPUT_TOKENS`, `api/_utils/agentEvalTransport.js:64`).

| response + block (REAL tokens) | headroom at 2,048 | headroom at 3,072 | verdict at 3,072 |
|---|---:|---:|---|
| mean response + typical block | 988 | 2,012 | fits |
| mean response + maximal block | −322 | 702 | fits |
| p99 response + typical block | 655 | 1,679 | fits |
| p99 response + maximal block | −655 | 369 | fits |
| max response + typical block | 474 | 1,498 | fits |
| max response + maximal block | −836 | 188 | fits |

The same caveat as the script applies. These are fixture upper bounds crossed with a production distribution observed before `declarations` existed. The real shadow truncation rate still has to come from shadow observation.
