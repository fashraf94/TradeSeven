// api/_utils/intraday/intradaySizing.test.js — contract §7.3 sizing, as a
// standing guard: a generated 255-symbol snapshot, one actionable document at
// 420 sweeps, and the publish transaction at 30 and at 255 actionable
// symbols, measured with Firestore's documented byte accounting against the
// 1 MiB document and 10 MiB transaction ceilings. The 30-actionable
// transaction must stay under 8 MiB (the contract's STOP line). The numbers
// are printed so the build report can quote them.
import { describe, it, expect } from 'vitest';
import { runSweepCalc } from './sweepCalc.js';
import { serializeActionable, firestoreDocBytes } from './intradayStore.js';
import * as CONFIG from '../intradayConfig.js';
import { SEP17, etDateOfEdt, sessionOfFixture, obsAt } from '../__fixtures__/intradaySessions.js';

const MiB = 1024 * 1024;
const UNIVERSE = Array.from({ length: 255 }, (_, i) => `U${String(i).padStart(3, '0')}`);

function simulate(actionableCount, sweeps) {
  const actionable = new Set(UNIVERSE.slice(0, actionableCount));
  let universeState = { accumulators: {} };
  let actionableDocs = {};
  let prevSnapshotSymbols = {};
  let last = null;
  for (let s = 0; s < sweeps; s++) {
    const observations = {};
    const universeSweep = s % 5 === 0;
    for (let i = 0; i < UNIVERSE.length; i++) {
      const sym = UNIVERSE[i];
      if (!universeSweep && !actionable.has(sym)) continue;
      const price = 100 + i * 0.37 + Math.sin(s / 7 + i) * 0.8;
      observations[sym] = obsAt(SEP17, s, {
        sym, price: Number(price.toFixed(4)), volume: 100_000 * (s + 1) + i, high: price + 1, low: price - 1, open: 100 + i * 0.37,
        extra: { averageVolume: 40_000_000, previousClose: 99 + i * 0.37, change: 1.11, changePercent: 1.12, size: 100 },
      });
    }
    last = runSweepCalc({
      prevSnapshotSymbols, universeState, actionableDocs, observations, missing: [], fetchAnomalies: {},
      actionableSet: actionable, cryptoSet: new Set(), session: SEP17, etDateOf: etDateOfEdt, sessionOf: sessionOfFixture,
      nowMs: SEP17.openMs + s * 60_000 + 16 * 60_000, sweepId: `sw${s}`, generation: s + 1, config: CONFIG,
    });
    prevSnapshotSymbols = last.snapshotSymbols;
    universeState = last.universeState;
    actionableDocs = last.actionableDocs;
  }
  return last;
}

describe('§7.3 sizing (Firestore byte accounting)', () => {
  it('measures the four documents/transactions and holds the ceilings', () => {
    const sweeps = 420;
    const r30 = simulate(30, sweeps);
    const snapshotDoc = {
      sweepId: 'sw419', generation: 420, sweepAt: 1, lastSuccessfulSweepAt: 1, lease: null, calcVersion: CONFIG.CALC_VERSION,
      anomalies: r30.anomalies, counters: r30.counters, symbols: r30.snapshotSymbols,
    };
    const snapshotBytes = firestoreDocBytes('intradaySnapshots/latest', snapshotDoc);
    const calcStateBytes = firestoreDocBytes('intradayCalcState/2026-09-17', { etDate: '2026-09-17', accumulators: r30.universeState.accumulators, generation: 420, updatedAt: 1 });
    const actionableBytes = Object.entries(r30.actionableDocs).map(([sym, d]) => firestoreDocBytes(`intradayCalcState/2026-09-17/actionable/${sym}`, serializeActionable(d, 420)));
    const oneActionable = Math.max(...actionableBytes);
    const publish30 = snapshotBytes + calcStateBytes + actionableBytes.reduce((a, b) => a + b, 0);
    expect(Object.keys(r30.snapshotSymbols)).toHaveLength(255);
    expect(r30.actionableDocs.U000.log).toHaveLength(sweeps);

    const r255 = simulate(255, sweeps);
    const actionable255 = Object.entries(r255.actionableDocs).map(([sym, d]) => firestoreDocBytes(`intradayCalcState/2026-09-17/actionable/${sym}`, serializeActionable(d, 420)));
    const snapshot255 = firestoreDocBytes('intradaySnapshots/latest', { ...snapshotDoc, anomalies: r255.anomalies, counters: r255.counters, symbols: r255.snapshotSymbols });
    const publish255 = snapshot255 + calcStateBytes + actionable255.reduce((a, b) => a + b, 0);

    const report = {
      snapshot_255_symbols_bytes: snapshotBytes,
      calcState_255_bytes: calcStateBytes,
      actionable_doc_420_sweeps_bytes: oneActionable,
      publish_tx_30_actionable_bytes: publish30,
      publish_tx_255_actionable_bytes: publish255,
      snapshot_pct_of_1MiB: Number((100 * snapshotBytes / MiB).toFixed(1)),
      actionable_pct_of_1MiB: Number((100 * oneActionable / MiB).toFixed(1)),
      publish30_pct_of_10MiB: Number((100 * publish30 / (10 * MiB)).toFixed(1)),
      publish255_pct_of_10MiB: Number((100 * publish255 / (10 * MiB)).toFixed(1)),
    };
    // eslint-disable-next-line no-console
    console.log('[intraday sizing §7.3]', JSON.stringify(report));
    expect(snapshotBytes).toBeLessThan(MiB);
    expect(oneActionable).toBeLessThan(MiB);
    expect(publish30).toBeLessThan(8 * MiB); // the contract's STOP line
    expect(publish255).toBeGreaterThan(0);

    // Addendum A4 — the crossing is a STANDING assertion, not a number in a
    // report that drifts (the build report's §3 table had already drifted in
    // four of five rows by the time the review re-measured it).
    //
    // The relationship has a fixed component (the snapshot shell plus the 255
    // non-actionable symbol facts), so fit the line properly rather than
    // dividing: a naive publish255/255 is ~1.6 symbols optimistic.
    const perSymbol = (publish255 - publish30) / (255 - 30);
    const fixed = publish30 - 30 * perSymbol;
    const crossingAt10MiB = (10 * MiB - fixed) / perSymbol;
    // eslint-disable-next-line no-console
    console.log('[intraday sizing §7.3] crossing', JSON.stringify({ perSymbol: Math.round(perSymbol), fixed: Math.round(fixed), crossingAt10MiB: Number(crossingAt10MiB.toFixed(1)) }));
    // The fit must agree with the directly measured single document.
    expect(Math.abs(perSymbol - oneActionable) / oneActionable).toBeLessThan(0.05);
    // The founder must have decided the generation-pointer question by here.
    // If this row ever drops below 75, the actionable set has outgrown the
    // one-transaction publish and §7.3's reserved design is due.
    //
    // MOVED 81 → 76 by calcVersion 2 (measured, not estimated). Confirming
    // the cutoffs (§15 items 1 and 2) turned `estimateCutoff` and
    // `volumeCutoffAsOf` from `null` into real epoch-ms integers on EVERY one
    // of a symbol's 420 log entries, and the log is a JSON STRING (§7.2, G9):
    // `"estimateCutoff":null` is 9 characters shorter than
    // `"estimateCutoff":1789654200000`, twice per entry, ~7.5 KB per symbol
    // per session. The crossing moved because the RECORD got more truthful,
    // not because the actionable set grew — it is still ~2.5× the contract's
    // modelled scale (30 actionable ≈ 7 concurrent battles at held ∪ bench).
    // The failure mode also stays named rather than silent: addendum A4's
    // PUBLISH_MAX_BYTES refuses at ~68 actionable symbols, BELOW the
    // crossing, so an over-limit sweep is one logged `publish_oversize` line
    // and never a wedged transaction. Flagged for the founder in the
    // calcVersion 2 report.
    expect(crossingAt10MiB).toBeGreaterThanOrEqual(75);
    // And the refusal ceiling must sit below the crossing, or it never fires.
    expect(CONFIG.PUBLISH_MAX_BYTES).toBeLessThan(10 * MiB);
  }, 60_000);
});
