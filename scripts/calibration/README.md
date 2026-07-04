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
one with **`export-agent-battles.js`** (below) or any read-only admin export; the
aggregation script never touches the database.

### `export-agent-battles.js` — produce `export.json`

Read-only export of `agentBattles` → a local JSON file for the aggregation step.
Reads Firestore, writes **only** a local file, never mutates the DB. Creds via
`FIREBASE_ADMIN_CREDENTIALS` in `.env.local` (the `rule-compat-cleanup.js` convention).

```sh
node scripts/calibration/export-agent-battles.js                    # completed → ./export.json
node scripts/calibration/export-agent-battles.js --from 2026-03-01 --to 2026-06-01
node scripts/calibration/aggregate-real-battles.js --input export.json
```

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

**`gate-replay-harness.js`** — drives TWO production-faithful paths: **(A)** Knob-A
forced rotation (stagnation counter; not wake-gated), and **(H)** a **uniform,
exogenous haiku-proposal stream** (identical across archetypes, a function of the
universe only) run through the real **wake** (`evaluateTriggers`) →
`hurdleFloor.byReason.haiku_decision` → **swap-window** gates as the cron layers them.
The haiku path gives Guardian (forced-rotation-disabled) a real tempo floor, so the
**8A ratio gates are falsifiable** rather than vacuously true. Both paths share one
`trades[]` + one swap-window counter.

Per archetype × preset it captures: full hurdle verdicts incl. `blockReason`;
forced-rotation **fires vs executed vs vetoed vs capped**; haiku **proposals / woken /
wake-starved / hurdle-blocked / capped / executed**; the **total tempo** (8A metric);
swap-window cap hits; the **wake-starvation rate** on the wake-gated haiku path
(Decision 2 — a proposal whose hurdle would clear but whose tick did not wake Haiku;
`wake-but-never-clears` is monitor-only) — recorded **FAILED-STRUCTURAL** (the 8C
divergence; a fenced-`evaluateTriggers` unification item, **not** a B3 knob-tuning
target); and the fresh-vs-frozen ATR deltas. Emergencies are not synthesized (so 8B
stagnation-share + emergency-bypass frequency stay with B1's real data).
`replayRealBattles` honestly reports zero gate-replay coverage from recorded battles
(no per-tick/candidate state) — synthetic is the instrument.

```sh
node scripts/calibration/gate-replay-harness.js          # the "before" picture (table)
node scripts/calibration/gate-replay-harness.js --json    # machine-readable
```

## `calibrate-knobs.js` (Phase B3 — the calibration run)

Proposes tuned per-archetype `hftConfig` values and **verifies** them through the B2
harness. It **edits no fenced file** — the tuned table is emitted as data (proposed
for the Tier-2 fence bundle). Verifies the ordering/ratio gates **per preset
(trend / chop / stress; flatline excluded)** across a **proposal-rate sweep
(0.5× / 1× / 2×)** and flags any gate that flips across rates as a mechanism finding;
widens degen↔mc separation; and verifies provisional **dial bands**
(`Measured / Standard / Aggressive`) across the full archetype × dial cross-product on
total tempo (Capital Preserver @ Aggressive stays slower than Speculator @ Measured).
8B is **real-data only** (B1); wake-starvation is carried **FAILED-STRUCTURAL** (F2),
never tuned toward.

```sh
node scripts/calibration/calibrate-knobs.js          # proposed table + gate/sweep/band verdict
node scripts/calibration/calibrate-knobs.js --json
```

## Tests

```sh
npx vitest run scripts/calibration/
```

Each test file imports `agentRiskManager.js` (and, for B2, `hurdleAtr.js` +
`agentTriggerGate.js`). That passing load in the Node test env is the BUILD_RULES §4
dependency-surface guard — it fails if a browser dep ever enters the graph. Never mock it.
