# Scouting Focus — Replay Harness (Stage-0 Gate)

**Throwaway, offline measurement harness. NOT production, NOT shipped, NOT to be merged.**
Its only job: prove whether a "Scouting Focus" actually moves the agent's draft picks,
before anything user-facing is built.

## Boundary (respected)
The archetype ranking engine is **fenced**. This harness never edits it. It imports and
**consumes read-only**:
- `computeArchetypeRankings()` — `api/_utils/archetypeScoring.js` (the real ranking)
- `screenStocks()` — `api/_utils/screenStocks.js` (the real screener)

The post-rank tilt (focus = bounded promotion) lives **only in this harness**.

## Run
```
node scratch/scouting-focus-replay/harness.mjs   # writes FINDINGS.md, prints summary
node scratch/scouting-focus-replay/debug.mjs      # inspect one synthetic state
```

## Files
- `universe.mjs` — synthetic daily universe generator (real symbols/sectors from
  `STOCK_UNIVERSE`, synthetic per-stock metrics in the cron's shape, 5 regimes × 2 seeds).
- `focuses.mjs` — hardcoded screenSpecs per focus + the riskiest pairs.
- `harness.mjs` — tilt (band gate + one-tier cap), draft models A & B, metrics, sweep, report.
- `FINDINGS.md` — generated results (the deliverable).
- `debug.mjs` — single-state inspector.

## Data caveat (snapshot answer)
The live ranked universe is a **single overwritten Firestore doc** `indexIntelligence/stockRankings`
(no date-keyed history) → **point-in-time**; and unreachable in this sandbox (no creds/fixtures).
So per-stock metrics are **synthetic**. The 5 regimes × 2 seeds are a robustness *proxy*, not
historical days — regime-robustness from real data is out of reach until snapshots are retained.
See `FINDINGS.md` for the full write-up.
