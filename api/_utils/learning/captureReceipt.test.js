// api/_utils/learning/captureReceipt.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  captureSwapReceipt, buildRawReceipt, extractPredicateInputs, receiptIdFor,
} from './captureReceipt.js';

// A spy Firestore whose every method records the call. Optionally EXPLODES if
// touched, to prove the flag-off path never reaches Firestore.
function makeSpyDb({ explode = false } = {}) {
  const sets = [];
  const touched = { any: false };
  const guard = () => {
    touched.any = true;
    if (explode) throw new Error('Firestore was touched while the flag is OFF');
  };
  const docApi = (path) => ({
    collection: (c) => { guard(); return collApi(`${path}/${c}`); },
    set: async (data) => { guard(); sets.push({ path, data }); },
  });
  const collApi = (path) => ({ doc: (id) => { guard(); return docApi(`${path}/${id}`); } });
  return {
    sets,
    touched,
    collection: (c) => { guard(); return collApi(c); },
  };
}

function validRaw(overrides = {}) {
  return {
    db: makeSpyDb(),
    agentId: 'agent-1',
    battleId: 'battle-1',
    battleDay: 3,
    timestamp: '2026-07-12T14:30:00.000Z',
    receiptSeq: 7,
    symbolIn: 'NVDA',
    symbolOut: 'AMD',
    source: 'haiku',
    exitReason: 'haiku_decision',
    haikuSwapReason: 'haiku_decision',
    resolvedTier: 'core',
    resolvedSlotIndex: 1,
    entryMark: 145.5,
    entryATR: 2.6,
    outgoingEntryPrice: 92.1,
    outgoingBaseATR: 3.1,
    thresholdHistory: { maxMultiplier: 1.4, minMultiplier: -0.3, badges: [] },
    outgoingSwappedInAt: '2026-07-11T15:00:00.000Z',
    outgoingSwappedInDay: 2,
    archetypeIntegrityMode: 'observe',
    snapshotIn: {
      volatility: { bbPercentB: 0.97 }, levels: { distanceToResistancePct: 0.6 },
      smaStack: { distTo52wkHigh: 4.0 },
      volume: { ratio: 2.0 }, momentum: { upDayVolRatio: 1.3, macdAboveSignal: true, macdFreshBullishCross: true },
    },
    regimeIn: 'directional_expansion',
    techDocIn: { mode: 'intraday', updatedAt: '2026-07-12T14:00:00.000Z' },
    snapshotOut: {
      volatility: { bbPercentB: 0.50 }, levels: { distanceToResistancePct: 7.0 },
      smaStack: { distTo52wkHigh: 9.0 },
      volume: { ratio: 1.0 }, momentum: { upDayVolRatio: 1.0, macdAboveSignal: false, macdFreshBullishCross: false },
    },
    regimeOut: 'choppy',
    techDocOut: { mode: 'intraday', updatedAt: '2026-07-12T14:00:00.000Z' },
    capturedAt: '2026-07-12T14:30:01.000Z',
    ...overrides,
  };
}

describe('captureSwapReceipt — NO-OP when the flag is off', () => {
  it('returns flag_off and never touches Firestore', async () => {
    const db = makeSpyDb({ explode: true }); // any Firestore access throws
    const res = await captureSwapReceipt({ ...validRaw(), enabled: false, db });
    expect(res).toEqual({ emitted: false, reason: 'flag_off' });
    expect(db.touched.any).toBe(false);
    expect(db.sets).toHaveLength(0);
  });

  it('does no receipt-building work when off (db explode proves zero Firestore ops)', async () => {
    const db = makeSpyDb({ explode: true });
    // Even with deliberately malformed inputs, off = immediate return, no throw.
    const res = await captureSwapReceipt({ enabled: false, db, source: 'not-a-source' });
    expect(res.emitted).toBe(false);
    expect(db.touched.any).toBe(false);
  });
});

describe('captureSwapReceipt — writes a RAW receipt when the flag is on', () => {
  it('awaits an Admin-SDK write to learningReceipts/{battleId}/receipts/{id} with raw fields only', async () => {
    const raw = validRaw();
    const res = await captureSwapReceipt({ ...raw, enabled: true });
    expect(res.emitted).toBe(true);
    expect(res.receiptId).toBe(receiptIdFor('agent-1', 7));

    expect(raw.db.sets).toHaveLength(1);
    const { path, data } = raw.db.sets[0];
    expect(path).toBe('learningReceipts/battle-1/receipts/agent-1_seq7');

    // Raw identity/decision fields present.
    expect(data).toMatchObject({
      agentId: 'agent-1', battleId: 'battle-1', receiptSeq: 7,
      symbolIn: 'NVDA', symbolOut: 'AMD', source: 'haiku', exitReason: 'haiku_decision',
      entryMark: 145.5, entryATR: 2.6,
    });
    // Predicate inputs carried raw for both symbols.
    expect(data.predicateInputs.symbolIn.bbPercentB).toBe(0.97);
    expect(data.predicateInputs.symbolOut.regime).toBe('choppy');
    expect(data.predicateInputs.symbolIn.dataMode).toBe('intraday');
    // The one live version stamp; the rest null.
    expect(data.versions.archetypeIntegrityMode).toBe('observe');
    expect(data.versions.detectorVersion).toBeNull();

    // TRIPWIRE: absolutely no derived/estimator/scoring field may appear.
    const json = JSON.stringify(data).toLowerCase();
    for (const banned of ['mpe', 'effectivereach', 'regret', 'bootstrap', 'estimate', 'clopper', 'narration', 'smd', '"score"']) {
      expect(json, `banned token ${banned}`).not.toContain(banned);
    }
  });

  it('FAILS CLOSED on an out-of-enum source: excludes + logs, never writes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = validRaw({ source: 'gameplan' }); // near-miss of gameplan_meeting
    const res = await captureSwapReceipt({ ...raw, enabled: true });
    expect(res.emitted).toBe(false);
    expect(res.reason).toBe('invalid');
    expect(raw.db.sets).toHaveLength(0); // never written
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a write error is logged and swallowed — never breaks the trade', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ set: async () => { throw new Error('boom'); } }) }) }) }),
    };
    const res = await captureSwapReceipt({ ...validRaw(), enabled: true, db });
    expect(res.emitted).toBe(false);
    expect(res.reason).toBe('write_error');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('buildRawReceipt / extractPredicateInputs — pure, raw only', () => {
  it('flags null predicate inputs in dataQuality.nullFlags', () => {
    const r = buildRawReceipt({
      agentId: 'a', battleId: 'b', receiptSeq: 1, symbolIn: 'X', symbolOut: 'Y',
      source: 'haiku', exitReason: 'haiku_decision',
      snapshotIn: { volatility: { bbPercentB: 0.9 } }, // most fields missing
      snapshotOut: {},
    });
    expect(r.dataQuality.nullFlags).toContain('predicateInputs.symbolIn.distTo52wkHigh');
    expect(r.dataQuality.nullFlags).toContain('predicateInputs.symbolOut.bbPercentB');
    // bbPercentB present for symbolIn → not flagged
    expect(r.dataQuality.nullFlags).not.toContain('predicateInputs.symbolIn.bbPercentB');
  });

  it('extractPredicateInputs pulls exactly the predicate fields from a snapshot', () => {
    const pi = extractPredicateInputs(
      { volatility: { bbPercentB: 0.8 }, levels: { distanceToResistancePct: 3.2 }, smaStack: { distTo52wkHigh: 5.5 },
        volume: { ratio: 1.7 }, momentum: { upDayVolRatio: 1.1, macdAboveSignal: false, macdFreshBullishCross: false } },
      'choppy',
      { mode: 'premarket', updatedAt: 'ts' },
    );
    expect(pi).toEqual({
      bbPercentB: 0.8, distanceToResistancePct: 3.2, distTo52wkHigh: 5.5,
      volumeRatio: 1.7, upDayVolRatio: 1.1, macdAboveSignal: false, macdFreshBullishCross: false,
      regime: 'choppy', dataMode: 'premarket', dataUpdatedAt: 'ts',
    });
  });

  it('guardrail-replay: unstored fields are null, never fabricated', () => {
    const r = buildRawReceipt(validRaw());
    expect(r.guardrailReplay.highWaterMark).toBeNull();
    expect(r.guardrailReplay.trailActivation).toBeNull();
    expect(r.guardrailReplay.trailStepLevel).toBeNull();
    // But the raw fields that DO exist are captured.
    expect(r.guardrailReplay.outgoingBaseATR).toBe(3.1);
    expect(r.guardrailReplay.thresholdHistory).toEqual({ maxMultiplier: 1.4, minMultiplier: -0.3, badges: [] });
  });
});
