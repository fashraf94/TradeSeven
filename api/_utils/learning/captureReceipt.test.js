// api/_utils/learning/captureReceipt.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  captureSwapReceipt, buildRawReceipt, extractPredicateInputs, receiptIdFor, toMillis,
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

    // TRIPWIRE (Phase A.5 reframe): outcome-blind labels are allowed, but no
    // outcome-derived / estimator / scoring token may appear.
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

  it('extractPredicateInputs pulls the predicate + level fields from a snapshot', () => {
    const pi = extractPredicateInputs(
      { volatility: { bbPercentB: 0.8 }, levels: { distanceToResistancePct: 3.2, nearestResistance: 190, nearestSupport: 173, distanceToSupportPct: -2.9 }, smaStack: { distTo52wkHigh: 5.5 },
        volume: { ratio: 1.7 }, momentum: { upDayVolRatio: 1.1, macdAboveSignal: false, macdFreshBullishCross: false } },
      'choppy',
      { mode: 'premarket', updatedAt: 'ts' },
    );
    expect(pi).toEqual({
      bbPercentB: 0.8, distanceToResistancePct: 3.2, distTo52wkHigh: 5.5,
      volumeRatio: 1.7, upDayVolRatio: 1.1, macdAboveSignal: false, macdFreshBullishCross: false,
      regime: 'choppy', nearestResistance: 190, nearestSupport: 173, distanceToSupportPct: -2.9,
      dataMode: 'premarket', dataUpdatedAt: 'ts',
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

// ── Phase A.5: predicate classification, staleness, provenance, swapContext ──
describe('toMillis — normalize timestamp to epoch-ms', () => {
  it('handles Firestore Timestamp / ISO string / number / null / unparseable', () => {
    expect(toMillis({ toMillis: () => 1_700_000_000_000 })).toBe(1_700_000_000_000);
    expect(toMillis('2026-07-12T14:00:00.000Z')).toBe(Date.parse('2026-07-12T14:00:00.000Z'));
    expect(toMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis('not-a-date')).toBeNull();
    expect(toMillis(NaN)).toBeNull();
    expect(toMillis({})).toBeNull(); // no toMillis, not a string/number
  });
});

describe('buildRawReceipt — predicate classification (outcome-blind)', () => {
  const TECH_MS = Date.parse('2026-07-12T14:00:00.000Z');
  const DECISION_MS = Date.parse('2026-07-12T14:30:00.000Z');

  it('records both D1 rule labels + drNullReason per symbol', () => {
    const r = buildRawReceipt(validRaw()); // dR=0.6 present, pB=0.97, d52=4.0 → 2 ext → EXTENDED
    expect(r.predicateClassification.symbolIn.d1ClassAsSpecced).toBe('EXTENDED');
    expect(r.predicateClassification.symbolIn.d1ClassDrAbstain).toBe('EXTENDED'); // dR present → delegates
    expect(r.predicateClassification.symbolIn.drNullReason).toBe('present');
    // symbolOut: pB=0.50 (room), dR=7.0 (room), d52=9.0 (room) → ROOM
    expect(r.predicateClassification.symbolOut.d1ClassAsSpecced).toBe('ROOM');
  });

  it('dR null + nearestSupport present → blue_sky; abstain diverges from as-specced', () => {
    const raw = validRaw({
      // pB extended, d52 neutral, dR MISSING but support present (blue sky).
      snapshotIn: {
        volatility: { bbPercentB: 0.97 }, smaStack: { distTo52wkHigh: 4.0 },
        levels: { distanceToResistancePct: null, nearestSupport: 173.5, nearestResistance: null },
        volume: { ratio: 2.0 }, momentum: { upDayVolRatio: 1.3, macdAboveSignal: true, macdFreshBullishCross: false },
      },
    });
    const c = buildRawReceipt(raw).predicateClassification.symbolIn;
    expect(c.drNullReason).toBe('blue_sky');
    expect(c.d1ClassAsSpecced).toBe('UNSCORABLE'); // any null → UNSCORABLE
    expect(c.d1ClassDrAbstain).toBe('INDETERMINATE'); // abstain: only pB extended (1 of 2)
  });

  it('staleness = decisionAtMs − techDocUpdatedAtMs; symbolHourKey buckets on the predicate-compute hour', () => {
    const c = buildRawReceipt(validRaw()).predicateClassification.symbolIn;
    expect(c.techDocUpdatedAtMs).toBe(TECH_MS);
    expect(c.predicateStalenessMs).toBe(DECISION_MS - TECH_MS); // 30 min
    expect(c.symbolHourKey).toBe(`NVDA:${Math.floor(TECH_MS / 3_600_000)}`);
    expect(c.techDocPath).toBe('stockTechnicalScores/NVDA');
  });

  it('null chains: techDoc missing → staleness/symbolHourKey null (never NaN or SYM:NaN)', () => {
    const r = buildRawReceipt(validRaw({ techDocIn: null }));
    const c = r.predicateClassification.symbolIn;
    expect(c.techDocUpdatedAtMs).toBeNull();
    expect(c.predicateStalenessMs).toBeNull();
    expect(c.symbolHourKey).toBeNull();
  });

  it('timestamp missing → decisionAtMs null → staleness null', () => {
    const r = buildRawReceipt(validRaw({ timestamp: null }));
    expect(r.predicateProvenance.decisionAtMs).toBeNull();
    expect(r.predicateClassification.symbolIn.predicateStalenessMs).toBeNull();
  });

  it('derived staleness null does NOT leak into dataQuality.nullFlags (allowlist)', () => {
    const r = buildRawReceipt(validRaw({ techDocIn: null }));
    expect(r.predicateClassification.symbolIn.predicateStalenessMs).toBeNull();
    // The derived sub-object is a sibling, never scanned by collectNullFlags.
    expect(r.dataQuality.nullFlags.some((f) => f.includes('predicateStalenessMs'))).toBe(false);
    expect(r.dataQuality.nullFlags.some((f) => f.includes('predicateClassification'))).toBe(false);
  });

  it('collectNullFlags: a blue-sky nearestResistance:null is NOT flagged, but a scorable-input null IS', () => {
    const raw = validRaw({
      snapshotIn: {
        volatility: { bbPercentB: 0.9 }, // present
        smaStack: {}, // distTo52wkHigh MISSING → scorable null → flagged
        levels: { distanceToResistancePct: null, nearestResistance: null, nearestSupport: 100 }, // dR is scorable → flagged; nearestResistance is context → NOT
        volume: { ratio: 1.0 }, momentum: { upDayVolRatio: 1.0, macdAboveSignal: true },
      },
    });
    const flags = buildRawReceipt(raw).dataQuality.nullFlags;
    expect(flags).toContain('predicateInputs.symbolIn.distTo52wkHigh'); // scorable null flagged
    expect(flags).toContain('predicateInputs.symbolIn.distanceToResistancePct'); // scorable null flagged
    expect(flags.some((f) => f.includes('nearestResistance'))).toBe(false); // context null NOT flagged
    expect(flags.some((f) => f.includes('regime'))).toBe(false); // regime null NOT flagged
  });

  it('swapContext + provenance carry the M8 truncation inputs', () => {
    const r = buildRawReceipt(validRaw({ tradeCountAtDecision: 6, tradesLenAtDecision: 6, rankingsComputedAtMs: TECH_MS }));
    expect(r.swapContext).toEqual({ tradeCountAtDecision: 6, tradesLenAtDecision: 6 });
    expect(r.predicateProvenance.rankingsComputedAtMs).toBe(TECH_MS);
    expect(r.predicateProvenance.rankingsDocPath).toBe('indexIntelligence/stockRankings');
    // receiptSeq === tradeCountAtDecision + 1 invariant (checkable now).
    expect(r.receiptSeq).toBe(r.swapContext.tradeCountAtDecision + 1);
  });

  it('TRIPWIRE: populated classification + techDocPath contains no banned/outcome token', () => {
    const json = JSON.stringify(buildRawReceipt(validRaw())).toLowerCase();
    for (const banned of ['mpe', 'effectivereach', 'regret', 'bootstrap', 'estimate', 'clopper', 'narration', 'smd', '"score"']) {
      expect(json, `banned token ${banned}`).not.toContain(banned);
    }
    // The techDocPath value embeds "Scores" but must not trip the quoted-"score" check.
    expect(json).toContain('stocktechnicalscores/nvda');
    expect(json).not.toContain('"score"');
  });
});
