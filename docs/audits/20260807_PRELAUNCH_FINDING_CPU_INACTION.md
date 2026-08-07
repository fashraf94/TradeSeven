# Pre-launch finding — CPU inaction is a dominant strategy (competitive balance)

**Date:** 2026-08-07 · **Status:** FILED — do NOT fix now (pre-launch backlog item).
**Provenance:** surfaced by the L-C fork-adjudication read-only pass (`scripts/lc-fork-adjudication.js`, the `[FINDING · competitive balance]` detector) on the voided cohort `lds_wed-1900_2026-07-22`. Independent of the scoring-anomaly FORK — this is a game-design imbalance, not a scoring defect.

## Observation (from the run)

In the decomposed cohort, per seat across all 8 fullday day-docs:

| Seat | trades | Σ locked (swap churn) | note |
|---|---|---|---|
| `cpu-40` | 0 | 0 | won the week on **pure `activeScore`** |
| `cpu-41` | 0 | 0 | — |
| human seat A | (swaps) | **−1319** | realized swap losses |
| human seat B | (swaps) | **−1080** | realized swap losses |

The two CPU seats never traded and paid zero swap churn; the two human seats each carried ~ −1000 to −1300 of realized `lockedPoints` losses from swapping. `cpu-40` won on `activeScore` alone.

*(Locked/trade counts for the CPU seats are code-guaranteed zero, see below; the human `Σlocked` magnitudes are the values reported from the run and are re-derivable from `Σ trades[].lockedPoints` per seat.)*

## Mechanism (verified in code)

- **CPU tournament seats are PASSIVE by contract.** `agent-evaluate.js:888-912`: when `battle.isCpu === true` the eval "scores + threshold history persist … but everything triggered is skipped — no momentum fetch, **no risk swaps**, no trigger gate, no Haiku." So a CPU seat's `trades[]` stays empty and its `scoreState.bankedScore` (= `Σ trades[].lockedPoints`, `agent-evaluate.js:853`) stays 0. Its score is pure `activeScore` — base + live badge bonus on its **static** starting portfolio.
- **CPU markers.** `tournamentCpu.js:61-68` stamps `ownerId: 'cpu-{n}'` + `isCpu: true`; `tournamentCpu.js:24` — "claims/flips: CPUs simply never call those endpoints — watch-not-play."
- **Swapping realizes losses.** A human-owned agent swaps via the eval path; each swap locks `lockedPoints = round(scoreResult.totalPoints)` for the departed leg (the swap-execution scorer). When a swapped-out leg is underwater, that realized value is negative and accumulates into `bankedScore`. So **activity is taxed and inactivity is not**: a seat that never swaps can never post a realized swap loss.

Net: against a field that includes passive CPU seats, **"do nothing" is a dominant strategy** — the CPU cannot lock a loss, so on any week where the human agents' swaps net negative (as here), a static CPU book out-survives them. `cpu-40` winning on `activeScore` alone is that dynamic realized.

## Why it matters (pre-launch)

A ranked ladder that seats real players against passive CPUs rewards the CPU's structural inability to lose churn, not skill. This is orthogonal to the scoring anomaly (it holds even if the base/bonus model is perfectly correct), and it is a **competitive-balance / game-design** call, not a bug fix.

## Not fixing now — options for later (founder's call)

Recorded, not actioned. Candidate directions (non-exhaustive, no recommendation asserted here):
1. Give CPU seats a comparable churn pressure (a modeled swap cadence or a holding-cost) so inaction isn't free.
2. Exclude passive CPU seats from the ranked standings (CPUs as pace-setters/fillers only, not eligible to "win").
3. Re-weight the composite so realized swap losses are not strictly worse than never trading (e.g. credit skillful holds).

Each changes competitive dynamics materially and is a design decision, deliberately deferred.

## Reproduce

`node scripts/lc-fork-adjudication.js` — the per-doc census ([B.3]) shows `trades=0` on the CPU seats, and the `[FINDING · competitive balance]` block lists any CPU seat with 0 trades / 0 locked across all its docs and its pure-`activeScore` standing.
