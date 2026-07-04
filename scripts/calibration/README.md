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

### Usage

```sh
# Human table (default)
node scripts/calibration/aggregate-real-battles.js --input export.json

# Machine-readable
node scripts/calibration/aggregate-real-battles.js --input export.json --format json --out metrics.json
```

`--input` is a JSON file: an array of battle docs, or `{ "battles": [...] }`. Produce
one with your own **read-only** admin export; this script never touches the database.

### Tests

```sh
npx vitest run scripts/calibration/aggregate-real-battles.test.js
```

The test's import of `agentRiskManager.js` is the BUILD_RULES §4 dependency-surface
guard (it fails in the Node test env if a browser dep ever enters the graph) — never mock it.
