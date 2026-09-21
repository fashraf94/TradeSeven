// api/_utils/intraday/view.test.js — contract §8.2 (schema, definitions, receipt-only replay), §9.1 (shadow lines stored).
import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
// BUILD_RULES §4 dependency-surface guard: view.js imports the client's
// src/data/intradayDiagnosticCopy.js (zero-import, Node-clean). This REAL
// import of the consuming module IS the runtime guard — it explodes in the
// Node test env if a browser dep ever enters that graph. Never mocked.
import { buildIntradayView, replayFromView, INTRADAY_DEFINITIONS_V1, INTRADAY_ENTRY_FIELDS, validateSnapshot, strikeFromView } from './view.js';
import { runSweepCalc } from './sweepCalc.js';
import { snapshotRef, definitionsRef } from './intradayStore.js';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../../src/data/intradayDiagnosticCopy.js';
import * as CONFIG from '../intradayConfig.js';
import { SEP17, etDateOfEdt, sessionOfFixture, obsAt } from '../__fixtures__/intradaySessions.js';

/** A snapshot built by the real sweep calculation: 3 actionable names over 45 minutes, one crypto. */
function makeSnapshot() {
  const actionable = new Set(['AAPL', 'MSFT', 'NVDA']);
  let prev = {}; let uni = { accumulators: {} }; let docs = {}; let last = null;
  for (let s = 0; s <= 45; s++) {
    const observations = {};
    for (const [i, sym] of ['AAPL', 'MSFT', 'NVDA'].entries()) {
      const p = 100 + i * 50 + Math.sin(s / 5 + i) * 1.5;
      observations[sym] = obsAt(SEP17, s, { sym, price: Number(p.toFixed(4)), volume: 10_000 * (s + 1), high: p + 1, low: p - 1, open: 100 + i * 50, extra: { averageVolume: 5_000_000, previousClose: 99 + i * 50, change: 1, changePercent: 1, size: 100 } });
    }
    observations.BTC = { ...obsAt(SEP17, s, { sym: 'BTC', price: 60000 + s, volume: 5, high: 60100, low: 59900, open: 60000 }), source: 'eodhd_live_v1_crypto' };
    last = runSweepCalc({ prevSnapshotSymbols: prev, universeState: uni, actionableDocs: docs, observations, actionableSet: actionable, cryptoSet: new Set(['BTC']), session: SEP17, etDateOf: etDateOfEdt, sessionOf: sessionOfFixture, nowMs: SEP17.openMs + s * 60_000 + 16 * 60_000, sweepId: `sw${s}`, generation: s + 1, config: CONFIG });
    prev = last.snapshotSymbols; uni = last.universeState; docs = last.actionableDocs;
  }
  const sweepAt = SEP17.openMs + 45 * 60_000 + 16 * 60_000;
  return { sweepId: 'sw45', generation: 46, sweepAt, lastSuccessfulSweepAt: sweepAt, calcVersion: CONFIG.CALC_VERSION, anomalies: last.anomalies, counters: last.counters, symbols: last.snapshotSymbols, lease: null };
}
const SNAP = makeSnapshot();
const EVAL_AT = SNAP.sweepAt + 30_000;
const et = (ms) => new Date(ms).toISOString().slice(11, 16);

describe('§8.2 the view schema', () => {
  it('carries the header fields, presetBand, providedToDecision: false, per-symbol facts with per-indicator verdicts, shadowLines, and missing symbols', () => {
    const view = buildIntradayView({ snapshot: SNAP, symbols: ['AAPL', 'BTC', 'ZZZZ'], evalId: 'eval_7', battleId: 'b1', presetId: 'balanced', presetBand: 0.5, evaluatedAt: EVAL_AT, timeText: et });
    expect(view).toMatchObject({ evalId: 'eval_7', battleId: 'b1', sweepId: 'sw45', generation: 46, calcVersion: CONFIG.CALC_VERSION, policyVersion: 1, evaluatedAt: EVAL_AT, presetId: 'balanced', presetBand: 0.5, providedToDecision: false, missingSymbols: ['ZZZZ'] });
    const a = view.symbols.AAPL;
    expect(a.strikeKey).toMatch(/^[0-9a-f]{16}$/);
    expect(a.observationId).toMatch(/^[0-9a-f]{16}$/);
    expect(a.source).toBe('eodhd_live_v2');
    expect(a.collectionStalled).toBe(false);
    expect(Object.keys(a.price)).toEqual(['value', 'priceAsOf', 'snapshotTs', 'previousClose', 'change', 'changePercent', 'size']);
    expect(Object.keys(a.indicators)).toEqual(['vwap', 'sessionHL', 'volume', 'volumePace', 'sma20_5m', 'macd5m', 'rsi5m']);
    // calcVersion 2: the cutoffs are confirmed, so the estimate is no longer
    // experimental and the verdict is ELIGIBLE, aged from the indicator's own
    // cutoff (§8.3) — the last accepted trade, not the sweep and not
    // availableAt. The bucket indicators are still warming (46 min = 9
    // completed buckets).
    const lastAcceptedAsOf = a.indicators.vwap.estimateCutoff;
    expect(a.indicators.vwap.verdict).toEqual({ state: 'eligible', reason: null, consumer: 'display', ageMs: EVAL_AT - lastAcceptedAsOf });
    expect(a.indicators.vwap).toMatchObject({ method: 'sampled_estimate', experimental: false, volumeCutoffAsOf: lastAcceptedAsOf });
    expect(lastAcceptedAsOf).toBeLessThan(SEP17.closeMs);
    expect(a.indicators.sma20_5m.verdict).toMatchObject({ state: 'ineligible', reason: 'warmup' });
    expect(a.indicators.sma20_5m.quality).toMatchObject({ warmupMet: false, gaps: 0 });
    // §5.4's restored pace formula runs now that the cutoff exists: 46 min of
    // a 390-minute session, measured AT the volume cutoff.
    expect(a.indicators.volumePace.verdict).toMatchObject({ state: 'eligible', reason: null });
    expect(a.indicators.volumePace.elapsedAtCutoffMin).toBe((lastAcceptedAsOf - SEP17.openMs) / 60_000);
    expect(a.indicators.sessionHL.verdict).toMatchObject({ state: 'eligible', reason: null });
    expect(a.indicators.volume.verdict).toMatchObject({ state: 'eligible', reason: null });
    // Nothing is display_only for a cutoff reason any more.
    expect(Object.values(a.indicators).map((i) => i.verdict.state)).not.toContain('display_only');
    // Crypto: price facts, vwap ineligible by definition.
    expect(view.symbols.BTC.indicators.vwap).toMatchObject({ value: null, method: 'n/a', reason: 'no_session_anchor', verdict: { state: 'ineligible', reason: 'no_session_anchor' } });
    // Missing: every verdict says so.
    expect(view.symbols.ZZZZ.missing).toBe(true);
    expect(view.symbols.ZZZZ.indicators.vwap.verdict.reason).toBe('not_in_snapshot');
    // Shadow lines are stored, prefixed by symbol, never empty for a present symbol.
    expect(view.shadowLines.some((l) => l.startsWith('AAPL: VWAP est.'))).toBe(true);
    // calcVersion 2: an eligible line reads "· as of HH:MM" off the
    // indicator's own cutoff. The display_only phrasing is gone with the
    // cutoff reasons that produced it.
    expect(view.shadowLines.some((l) => /^AAPL: VWAP est\. [\d.]+ · as of \d\d:\d\d$/.test(l))).toBe(true);
    // …for a STOCK. Crypto keeps its null cutoffs (§5.7: no session anchor,
    // so the vendor aggregates have no session instant to be cumulative to),
    // which is why this is scoped to AAPL rather than the whole block.
    const aaplLines = view.shadowLines.filter((l) => l.startsWith('AAPL: '));
    expect(aaplLines.some((l) => l.includes('cutoff unconfirmed'))).toBe(false);
    expect(aaplLines.some((l) => l.includes('experimental'))).toBe(false);
    expect(view.shadowLines.some((l) => l.startsWith('BTC: ') && l.includes('cutoff unconfirmed'))).toBe(true);
    expect(INTRADAY_ENTRY_FIELDS).toEqual(['intradaySnapshotId', 'intradayGeneration', 'intradayViewRef', 'intradayViewStatus', 'intradayEvaluatedAt', 'intradayPolicyVersion', 'decisionStartedAt', 'decisionCompletedAt']);
  });
  it('marks every symbol collectionStalled when the last successful sweep is older than the stall window at the check', () => {
    const late = buildIntradayView({ snapshot: SNAP, symbols: ['AAPL'], evalId: 'e', battleId: 'b', presetId: 'balanced', presetBand: 0.5, evaluatedAt: SNAP.lastSuccessfulSweepAt + CONFIG.COLLECTION_STALL_MS + 1 });
    expect(late.symbols.AAPL.collectionStalled).toBe(true);
    expect(late.symbols.AAPL.indicators.vwap.verdict.reason).toBe('collection_stalled');
  });
  it('validateSnapshot distinguishes no_snapshot from snapshot_invalid', () => {
    expect(validateSnapshot(null)).toEqual({ ok: false, reason: 'no_snapshot' });
    expect(validateSnapshot({ sweepId: 's' })).toEqual({ ok: false, reason: 'snapshot_invalid' });
    expect(validateSnapshot({ sweepId: 's', generation: 'x', symbols: {} })).toEqual({ ok: false, reason: 'snapshot_invalid' });
    expect(validateSnapshot(SNAP)).toEqual({ ok: true });
  });
  it('the definitions document is immutable, versioned to calcVersion 1, and names the venue as vendor_unconfirmed', () => {
    expect(Object.isFrozen(INTRADAY_DEFINITIONS_V1)).toBe(true);
    expect(INTRADAY_DEFINITIONS_V1.calcVersion).toBe(1);
    for (const d of Object.values(INTRADAY_DEFINITIONS_V1.indicators)) {
      expect(Object.keys(d)).toEqual(['name', 'params', 'timeframe', 'units', 'session', 'adjust', 'venue']);
      expect(d.venue).toBe('vendor_unconfirmed');
    }
  });
});

describe('§8.2 receipt-only replay — with intradaySnapshots/latest deleted', () => {
  it('reconstructs every strike computation and every displayed line from the stored view plus its definitions document alone', async () => {
    const { db, store } = makeInMemoryDb();
    await snapshotRef(db).set(SNAP);
    await definitionsRef(db, 1).set(INTRADAY_DEFINITIONS_V1);
    const view = buildIntradayView({ snapshot: SNAP, symbols: ['AAPL', 'MSFT', 'BTC'], evalId: 'eval_3', battleId: 'b1', presetId: 'aggressive', presetBand: 0.7, evaluatedAt: EVAL_AT, timeText: et });
    await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_3').set(view);
    // The snapshot is gone.
    await snapshotRef(db).delete();
    expect(store.has('intradaySnapshots/latest')).toBe(false);
    const storedView = (await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_3').get()).data();
    const defs = (await definitionsRef(db, 1).get()).data();
    const replay = replayFromView(storedView, defs, { nowMs: EVAL_AT, timeText: et });
    // Strikes: estDev from the stored price and estimate; the strike key is the stored one.
    for (const sym of ['AAPL', 'MSFT']) {
      const rec = storedView.symbols[sym];
      const expected = ((rec.price.value - rec.indicators.vwap.value) / rec.indicators.vwap.value) * 100;
      expect(replay.symbols[sym].strike.estDev).toBeCloseTo(expected, 9);
      expect(replay.symbols[sym].strike.isVwapStrike).toBe(expected < -0.7);
      expect(replay.symbols[sym].strike.strikeKey).toBe(rec.strikeKey);
      // calcVersion 2: the estimate is eligible, so the replayed strike is too.
      expect(replay.symbols[sym].strike.eligible).toBe(true);
    }
    // Crypto has no session anchor (§5.7), so it stays ineligible either way.
    expect(replay.symbols.BTC.strike).toEqual({ estDev: null, isVwapStrike: false, strikeKey: storedView.symbols.BTC.strikeKey, eligible: false });
    // Lines: identical to the ones the view rendered at the check (shadow lines carry the symbol prefix).
    for (const sym of ['AAPL', 'MSFT', 'BTC']) {
      expect(replay.symbols[sym].lines).toEqual(storedView.shadowLines.filter((l) => l.startsWith(`${sym}: `)).map((l) => l.slice(sym.length + 2)));
      expect(replay.symbols[sym].header).toBe(INTRADAY_DIAGNOSTIC_HEADER);
      expect(replay.symbols[sym].definition.vwap.venue).toBe('vendor_unconfirmed');
    }
    // Verdicts at the check equal the stored ones; at a later instant they flip while the view is unchanged.
    expect(replay.symbols.AAPL.verdicts).toEqual(Object.fromEntries(Object.entries(storedView.symbols.AAPL.indicators).map(([k, v]) => [k, v.verdict])));
    const later = replayFromView(storedView, defs, { nowMs: EVAL_AT + 3 * 3600_000, timeText: et });
    // Addendum A2: a null cutoff is no longer ageless. Three hours on, the
    // same stored view replays as stale rather than as a current diagnostic —
    // this row asserted the opposite before A2, and that was review finding
    // R-3 in test form.
    expect(later.symbols.AAPL.verdicts.sessionHL).toMatchObject({ state: 'ineligible', reason: 'stale' });
    // Within the display window it still renders — and at calcVersion 2, with
    // a confirmed HL cutoff, it renders as ELIGIBLE rather than display_only.
    const soon = replayFromView(storedView, defs, { nowMs: EVAL_AT + 10 * 60_000, timeText: et });
    expect(soon.symbols.AAPL.verdicts.sessionHL.state).toBe('eligible');
    expect(JSON.stringify(storedView)).toBe(JSON.stringify((await db.collection('agentBattles').doc('b1').collection('intradayViews').doc('eval_3').get()).data()));
  });
  it('refuses a definitions document of another calcVersion', () => {
    const view = buildIntradayView({ snapshot: SNAP, symbols: ['AAPL'], evalId: 'e', battleId: 'b', presetId: 'balanced', presetBand: 0.5, evaluatedAt: EVAL_AT });
    expect(() => replayFromView(view, { ...INTRADAY_DEFINITIONS_V1, calcVersion: 2 }, { nowMs: EVAL_AT })).toThrow(/calcVersion/);
    expect(strikeFromView({ price: { value: 99 }, indicators: { vwap: { value: 100 } }, strikeKey: 'k' }, 0.5)).toEqual({ estDev: -1, isVwapStrike: true, strikeKey: 'k' });
  });
});

describe('§8.3 the build-1 flip test on a persisted view', () => {
  it('a stored eligible verdict flips to stale as nowMs crosses the display limit, the persisted view unchanged', () => {
    // Fabricate a confirmed cutoff (as if VOLUME_CUTOFF_FIELD were set) on a stored record.
    const view = buildIntradayView({ snapshot: SNAP, symbols: ['AAPL'], evalId: 'e', battleId: 'b', presetId: 'balanced', presetBand: 0.5, evaluatedAt: EVAL_AT });
    const rec = structuredClone(view.symbols.AAPL);
    rec.indicators.sessionHL.cutoff = EVAL_AT - 60_000;
    const frozen = JSON.stringify(rec);
    const fresh = replayFromView({ ...view, symbols: { AAPL: rec } }, INTRADAY_DEFINITIONS_V1, { nowMs: EVAL_AT });
    const stale = replayFromView({ ...view, symbols: { AAPL: rec } }, INTRADAY_DEFINITIONS_V1, { nowMs: EVAL_AT - 60_000 + 45 * 60_000 + 1 });
    expect(fresh.symbols.AAPL.verdicts.sessionHL.state).toBe('eligible');
    expect(stale.symbols.AAPL.verdicts.sessionHL).toMatchObject({ state: 'ineligible', reason: 'stale' });
    expect(JSON.stringify(rec)).toBe(frozen);
  });
});
