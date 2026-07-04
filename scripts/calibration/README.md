# scripts/calibration

Offline tooling for the **Knob Calibration** workstream (Stream D `hftConfig` knobs:
`forcedRotation`, `hurdleFloor`, `swapWindow`). These scripts import the FENCED pure
functions from `api/_utils/agentRiskManager.js` (read/call is permitted) and never
edit fenced files, never write Firestore, and never change production behavior.

## `aggregate-real-battles.js` (Phase B1)

Aggregates the real-data half of the §5.2 acceptance metrics from a local JSON
export of `agentBattles` documents.

**Produces (per archetype, keyed off `battle.agentContext.archetype`):**
- baseline trade counts (§5.2 item 1)
- executed non-emergency rotations per battle — **median = Gate 8A tempo metric**
- stagnation share of non-emergency rotations — **Gate 8B**
- emergency-bypass frequency, reason-attributed (§5.2 item 3)

**Does NOT produce** the hurdle-floor rejection rate or vetoed forced-rotation fire
frequency — those events never persist to `trades[]`, so the **B2 gate-replay harness**
synthesizes them. The report marks them explicitly under `notCovered`.

**Censoring (B1 rider):** `battle.trades[]` is capped at the last 50 entries
(`agentSwapExecution.js:345`). Battles at that cap — or whose `scoreState.tradeCount`
exceeds the retained array — are flagged `censored`; their counts are **FLOOR values**
(lower bounds), never reported as exact.

**Unknown/missing reason (B1 taxonomy rider):** a trade whose `exitReason` is neither
an emergency reason nor a recognized non-emergency reason (`stagnation`,
`haiku_decision`, `gameplan_rotation`) is counted as non-emergency by default-deny,
which **inflates the 8A tempo metric**. Pre-V1.4-taxonomy (Mar–May) battles can carry
such reasons, so the report surfaces the unknown/missing share (`unknownReason`, per
battle + overall, with a `byReason` breakdown and a `taxonomyNote`) as a visible number
for the B3 run's judgment.

### Usage

```sh
# Human table (default)
node scripts/calibration/aggregate-real-battles.js --input export.json

# Machine-readable
node scripts/calibration/aggregate-real-battles.js --input export.json --format json --out metrics.json
```

`--input` is a JSON file: an array of battle docs, or `{ "battles": [...] }`. Produce
one with your own **read-only** admin export; this script never touches the database.

## `gate-replay-harness.js` + `synthetic-universe.js` (Phase B2)

Synthesizes the §5.2 metrics that recorded battle data **cannot** yield (B1 covers
the real-data half). Drives synthetic states through the REAL pure gates —
`resolveHurdleAtr`/`buildFreshAtrPercentileMap` (Task A, from `main`),
`clearsHurdleFloor`/`getRecentSwapCount`/`evaluateRisk` (fenced — called only), and
`evaluateTriggers` (the wake gate).

**`synthetic-universe.js`** — deterministic seeded PRNG (no `Math.random`, no `Date`).
Held names use a `stagnant` motion (so forced rotation fires); the **preset**
(`trend` / `chop` / `flatline` / `stress`) shapes the bench's opportunity landscape.
Per-tick `atrPercentile` drifts so the fresh ATR differs from the frozen swap-in ATR
(A1's effect is measurable).

**`gate-replay-harness.js`** — per archetype × preset, captures: full hurdle verdicts
incl. `blockReason`; forced-rotation **fires vs executed vs vetoed vs capped**;
swap-window cap hits; the **wake-starvation rate** (Decision 2 gate — a hurdle-clearing
swap opportunity whose chosen candidate would not fire the `bench_outperformance` wake;
PASS < 5% + no stress worsening; `wake-but-never-clears` is monitor-only); and the
fresh-vs-frozen ATR deltas. Emergencies are not synthesized (so 8B stagnation-share and
emergency-bypass frequency stay with B1's real data). `replayRealBattles` honestly
reports that recorded battles carry no per-tick/candidate state to gate-replay
(coverage 0) — synthetic is the instrument.

```sh
node scripts/calibration/gate-replay-harness.js          # the "before" picture (table)
node scripts/calibration/gate-replay-harness.js --json    # machine-readable
```

## Tests

```sh
npx vitest run scripts/calibration/
```

Each test file imports `agentRiskManager.js` (and, for B2, `hurdleAtr.js` +
`agentTriggerGate.js`). That passing load in the Node test env is the BUILD_RULES §4
dependency-surface guard — it fails if a browser dep ever enters the graph. Never mock it.
