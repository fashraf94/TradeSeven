// api/_utils/learning/captureReceipt.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  captureSwapReceipt, buildRawReceipt, extractPredicateInputs, receiptIdFor, toMillis,
  resolveEntrySnapshot, classifyEntryAtrSource, classifyEvidence, EVIDENCE_CLASSES,
} from './captureReceipt.js';
import { classifyD2, D2_CLASSES } from './detectorClassifiers.js';

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

// A tech-doc Firestore mock supporting collection(c).doc(id).get() — for the
// Fix 1 refetch path (resolveEntrySnapshot). Records reads; can return a doc,
// a missing doc, or throw.
function makeTechDocDb({ doc = null, throwOnGet = false } = {}) {
  const reads = [];
  return {
    reads,
    collection: (c) => ({
      doc: (id) => ({
        get: async () => {
          reads.push({ collection: c, id });
          if (throwOnGet) throw new Error('firestore get boom');
          return doc
            ? { exists: true, data: () => doc }
            : { exists: false, data: () => undefined };
        },
      }),
    }),
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

// ── L1 Capture — exclude non-evidence (CPU/training) agents (Fix 1 + Fix 2) ──
describe('classifyEvidence + captureSwapReceipt — non-evidence exclusion', () => {
  it('classifyEvidence: isCpu is authoritative; agentId prefixes are the secondary/training signal', () => {
    expect(classifyEvidence({ isCpu: true, agentId: 'agent-1' })).toBe('cpu'); // boolean wins over a live-looking id
    expect(classifyEvidence({ isCpu: false, agentId: 'cpu-agent-15' })).toBe('cpu'); // secondary cpu-agent- prefix
    expect(classifyEvidence({ agentId: 'training-agent-grp7-u3' })).toBe('training');
    expect(classifyEvidence({ agentId: 'agent-abc123' })).toBe('live_agent');
    expect(classifyEvidence({ agentId: '' })).toBe('unknown'); // no attributable id
    expect(classifyEvidence({})).toBe('unknown');
    expect(classifyEvidence()).toBe('unknown');
    // Every result is a member of the published taxonomy.
    for (const args of [{ isCpu: true }, { agentId: 'training-agent-x' }, { agentId: 'z' }, {}]) {
      expect(EVIDENCE_CLASSES).toContain(classifyEvidence(args));
    }
  });

  it('a CPU agent (isCpu) writes NO receipt — early return before buildRawReceipt, Firestore untouched', async () => {
    const db = makeSpyDb({ explode: true }); // any Firestore access throws
    const res = await captureSwapReceipt({ ...validRaw(), isCpu: true, enabled: true, db });
    expect(res).toEqual({ emitted: false, reason: 'non_evidence', evidenceClass: 'cpu' });
    expect(db.touched.any).toBe(false);
    expect(db.sets).toHaveLength(0);
  });

  it('a training-clone agent writes NO receipt (training-agent- id prefix)', async () => {
    const raw = validRaw({ agentId: 'training-agent-grp7-u3' });
    const res = await captureSwapReceipt({ ...raw, enabled: true });
    expect(res).toEqual({ emitted: false, reason: 'non_evidence', evidenceClass: 'training' });
    expect(raw.db.sets).toHaveLength(0);
  });

  it('a cpu-agent- id with no isCpu flag is still excluded (secondary signal)', async () => {
    const raw = validRaw({ agentId: 'cpu-agent-9' });
    const res = await captureSwapReceipt({ ...raw, enabled: true });
    expect(res.emitted).toBe(false);
    expect(res.reason).toBe('non_evidence');
    expect(res.evidenceClass).toBe('cpu');
    expect(raw.db.sets).toHaveLength(0);
  });

  it('a live agent writes a receipt STAMPED evidenceClass: live_agent', async () => {
    const raw = validRaw(); // agentId 'agent-1' → live_agent
    const res = await captureSwapReceipt({ ...raw, enabled: true });
    expect(res.emitted).toBe(true);
    expect(raw.db.sets).toHaveLength(1);
    expect(raw.db.sets[0].data.evidenceClass).toBe('live_agent');
  });

  it('buildRawReceipt stamps evidenceClass from identity, and an explicit override wins', () => {
    expect(buildRawReceipt(validRaw()).evidenceClass).toBe('live_agent');
    expect(buildRawReceipt(validRaw({ agentId: 'cpu-agent-2' })).evidenceClass).toBe('cpu');
    expect(buildRawReceipt(validRaw({ isCpu: true })).evidenceClass).toBe('cpu');
    // The caller-computed value is authoritative (guard and stamp never disagree).
    expect(buildRawReceipt(validRaw({ evidenceClass: 'live_agent', agentId: 'cpu-agent-2' })).evidenceClass).toBe('live_agent');
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

  it('marks the entry vs exit-context role as a first-class field (symbolIn=entry, symbolOut=exit_context)', () => {
    const r = buildRawReceipt(validRaw());
    expect(r.predicateClassification.symbolIn.role).toBe('entry');
    expect(r.predicateClassification.symbolOut.role).toBe('exit_context');
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

// ── Fix 1 — dark-path refetch of the entry tech doc (resolveEntrySnapshot) ──
describe('resolveEntrySnapshot — entry tech-doc refetch + provenance', () => {
  const REFETCH_TECH_DOC = {
    bbPercentB: 0.42,
    factors: { distTo52wkHigh: 3.3, upDayVolRatio: 1.25, macdAboveSignal: true },
    volumeProfile: { ratio: 1.9 },
    updatedAt: '2026-07-15T14:00:00.000Z',
  };
  const rankingsMap = { CRWD: { levels: { nearestResistance: 707.17, distanceToResistancePct: 242.52 } } };

  it('primary_fetch: tech doc already present → used as-is, NO Firestore read', async () => {
    const db = makeTechDocDb({ throwOnGet: true }); // would throw if touched
    const primaryTechDoc = { mode: 'ignored', updatedAt: 'x' };
    const r = await resolveEntrySnapshot({
      db, symbol: 'NVDA', primarySnapshotIn: { volatility: { bbPercentB: 0.9 } }, primaryTechDoc,
      momentumData: { rankingsMap }, technicalScoresMap: { NVDA: primaryTechDoc },
    });
    expect(r.entrySnapshotSource).toBe('primary_fetch');
    expect(r.techDocIn).toBe(primaryTechDoc);
    expect(db.reads).toHaveLength(0); // guarded: no refetch when already resolved
  });

  it('capture_refetch: tech doc null but exists → snapshotIn populates from the refetched doc', async () => {
    const db = makeTechDocDb({ doc: REFETCH_TECH_DOC });
    const r = await resolveEntrySnapshot({
      db, symbol: 'CRWD', primarySnapshotIn: { levels: { distanceToResistancePct: 242.52 } }, primaryTechDoc: null,
      momentumData: { rankingsMap }, technicalScoresMap: {},
    });
    expect(r.entrySnapshotSource).toBe('capture_refetch');
    expect(db.reads).toEqual([{ collection: 'stockTechnicalScores', id: 'CRWD' }]);
    expect(r.techDocIn).toBe(REFETCH_TECH_DOC);
    // Tech-doc-sourced fields now populate (were null before the refetch).
    expect(r.snapshotIn.volatility.bbPercentB).toBe(0.42);
    expect(r.snapshotIn.smaStack.distTo52wkHigh).toBe(3.3);
    expect(r.snapshotIn.momentum.macdAboveSignal).toBe(true);
    // Rankings-sourced level fields still present (from momentumData.rankingsMap).
    expect(r.snapshotIn.levels.distanceToResistancePct).toBe(242.52);
  });

  it('refetch_missing: tech doc null and does not exist → nulls preserved, honest label', async () => {
    const db = makeTechDocDb({ doc: null }); // exists:false
    const primarySnapshotIn = { levels: { distanceToResistancePct: 242.52 } };
    const r = await resolveEntrySnapshot({
      db, symbol: 'CRWD', primarySnapshotIn, primaryTechDoc: null,
      momentumData: { rankingsMap }, technicalScoresMap: {},
    });
    expect(r.entrySnapshotSource).toBe('refetch_missing');
    expect(r.techDocIn).toBeNull();
    expect(r.snapshotIn).toBe(primarySnapshotIn); // unchanged nulls
  });

  it('refetch_error: a failed read degrades to nulls, records refetch_error, never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = makeTechDocDb({ throwOnGet: true });
    const primarySnapshotIn = { levels: { distanceToResistancePct: 242.52 } };
    const r = await resolveEntrySnapshot({
      db, symbol: 'CRWD', primarySnapshotIn, primaryTechDoc: null,
      momentumData: { rankingsMap }, technicalScoresMap: {},
    });
    expect(r.entrySnapshotSource).toBe('refetch_error');
    expect(r.techDocIn).toBeNull();
    expect(r.snapshotIn).toBe(primarySnapshotIn);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a refetched entry receipt carries entrySnapshotSource + a populated symbolIn snapshot end-to-end', () => {
    // Simulate the capture site after a successful refetch: pass the rebuilt
    // snapshotIn + techDocIn + source into buildRawReceipt.
    const snapshotIn = {
      volatility: { bbPercentB: 0.42 }, smaStack: { distTo52wkHigh: 3.3 },
      levels: { distanceToResistancePct: 242.52, nearestResistance: 707.17 },
      volume: { ratio: 1.9 }, momentum: { upDayVolRatio: 1.25, macdAboveSignal: true },
    };
    const r = buildRawReceipt(validRaw({
      symbolIn: 'CRWD',
      snapshotIn, techDocIn: REFETCH_TECH_DOC, entrySnapshotSource: 'capture_refetch',
    }));
    expect(r.predicateClassification.symbolIn.entrySnapshotSource).toBe('capture_refetch');
    expect(r.predicateInputs.symbolIn.bbPercentB).toBe(0.42);
    expect(r.predicateInputs.symbolIn.distTo52wkHigh).toBe(3.3);
    // techDocUpdatedAtMs now resolves (was null when the entry was unfetched).
    expect(r.predicateClassification.symbolIn.techDocUpdatedAtMs).toBe(Date.parse('2026-07-15T14:00:00.000Z'));
  });

  it('default per-symbol source: techDoc present → primary_fetch, absent → null (legacy callers)', () => {
    const present = buildRawReceipt(validRaw()); // techDocIn/Out present
    expect(present.predicateClassification.symbolIn.entrySnapshotSource).toBe('primary_fetch');
    expect(present.predicateClassification.symbolOut.entrySnapshotSource).toBe('primary_fetch');
    const absent = buildRawReceipt(validRaw({ techDocIn: null }));
    expect(absent.predicateClassification.symbolIn.entrySnapshotSource).toBeNull();
  });
});

// ── Fix 1b — dataMode sourced from the sibling rankings doc ──
describe('dataMode — sibling-rankings-doc source (Defect 1b)', () => {
  it('extractPredicateInputs: explicit dataMode overrides a tech doc that has NO mode', () => {
    const pi = extractPredicateInputs(
      { volatility: { bbPercentB: 0.8 } },
      'choppy',
      { updatedAt: 'ts' }, // NO mode field — the production reality
      'intraday',          // sibling-doc mode
    );
    expect(pi.dataMode).toBe('intraday');
    expect(pi.dataUpdatedAt).toBe('ts');
  });

  it('extractPredicateInputs: omitted dataMode falls back to techDoc.mode (byte-identical legacy)', () => {
    const pi = extractPredicateInputs({ volatility: { bbPercentB: 0.8 } }, 'choppy', { mode: 'premarket', updatedAt: 'ts' });
    expect(pi.dataMode).toBe('premarket');
  });

  it('buildRawReceipt: raw.dataMode populates BOTH symbols even when tech docs lack mode', () => {
    const r = buildRawReceipt(validRaw({
      dataMode: 'intraday',
      techDocIn: { updatedAt: '2026-07-15T14:00:00.000Z' },  // no mode
      techDocOut: { updatedAt: '2026-07-15T14:00:00.000Z' }, // no mode
    }));
    expect(r.predicateInputs.symbolIn.dataMode).toBe('intraday');
    expect(r.predicateInputs.symbolOut.dataMode).toBe('intraday');
  });

  it('edge: raw.dataMode null stays null — never fabricated, never falls back to a phantom techDoc.mode', () => {
    const r = buildRawReceipt(validRaw({
      dataMode: null,
      techDocIn: { mode: 'stale_should_be_ignored', updatedAt: 'x' },
    }));
    expect(r.predicateInputs.symbolIn.dataMode).toBeNull();
  });

  it('D2 intraday correction ENGAGES once dataMode populates (the whole point of the fix)', () => {
    // A receipt whose entry has volumeRatio=1.0 (a neutralized intraday placeholder),
    // upDayVolRatio=1.1 (<1.2 fail), macdAboveSignal=true.
    const snap = {
      volatility: { bbPercentB: 0.5 }, levels: { distanceToResistancePct: 5.0 }, smaStack: { distTo52wkHigh: 5.0 },
      volume: { ratio: 1.0 }, momentum: { upDayVolRatio: 1.1, macdAboveSignal: true, macdFreshBullishCross: false },
    };
    const withMode = buildRawReceipt(validRaw({ snapshotIn: snap, dataMode: 'intraday', techDocIn: { updatedAt: 'x' } }));
    const noMode = buildRawReceipt(validRaw({ snapshotIn: snap, dataMode: null, techDocIn: { updatedAt: 'x' } }));

    const d2WithMode = classifyD2(withMode.predicateInputs.symbolIn);
    const d2NoMode = classifyD2(noMode.predicateInputs.symbolIn);

    // Intraday: volume.ratio is relabeled MISSING → volume family UNKNOWN → UNSCORABLE.
    expect(d2WithMode.class).toBe(D2_CLASSES.UNSCORABLE);
    expect(d2WithMode.volume).toBe('UNKNOWN');
    // Null dataMode (the bug): volume.ratio 1.0 read as observed → volume FAIL, so
    // the classification differs — proving the correction only fires once dataMode populates.
    expect(d2NoMode.volume).toBe('FAIL');
    expect(d2WithMode.class).not.toBe(d2NoMode.class);
  });
});

// ── Fix 2a — entryAtrSource provenance (classifyEntryAtrSource) ──
describe('classifyEntryAtrSource — which executeSwapServer branch produced entryATR', () => {
  it('scored_threshold: entryATR equals a present scoring threshold', () => {
    expect(classifyEntryAtrSource({ entryATR: 4.2, scoredThreshold: 4.2, benchBaseATR: 8, isCrypto: false }))
      .toBe('scored_threshold'); // precedence: threshold wins even when benchBaseATR also present
  });

  it('bench_proxy: no scored threshold, entryATR equals benchAsset.baseATR (the hotBench atrPercentile×8 proxy)', () => {
    expect(classifyEntryAtrSource({ entryATR: 8, scoredThreshold: undefined, benchBaseATR: 8, isCrypto: false }))
      .toBe('bench_proxy');
  });

  it('default_fallback: no threshold, no bench baseATR → 2.5 (stock) / 5.0 (crypto)', () => {
    expect(classifyEntryAtrSource({ entryATR: 2.5, scoredThreshold: undefined, benchBaseATR: undefined, isCrypto: false }))
      .toBe('default_fallback');
    expect(classifyEntryAtrSource({ entryATR: 5.0, scoredThreshold: undefined, benchBaseATR: 0, isCrypto: true }))
      .toBe('default_fallback');
  });

  it('unknown: entryATR null, or matches no capture-scope candidate (honest, never guessed)', () => {
    expect(classifyEntryAtrSource({ entryATR: null, benchBaseATR: 8 })).toBe('unknown');
    expect(classifyEntryAtrSource({ entryATR: 7.76, scoredThreshold: undefined, benchBaseATR: 8, isCrypto: false }))
      .toBe('unknown'); // value diverges from every candidate
  });

  it('buildRawReceipt carries entryAtrSource on the receipt without changing entryATR', () => {
    const r = buildRawReceipt(validRaw({ entryATR: 8, entryAtrSource: 'bench_proxy' }));
    expect(r.entryATR).toBe(8);       // value untouched (accept the proxy)
    expect(r.entryAtrSource).toBe('bench_proxy');
  });

  it('TRIPWIRE holds with the new provenance fields populated (scored_threshold has no quoted "score")', () => {
    const r = buildRawReceipt(validRaw({ entryAtrSource: 'scored_threshold', entrySnapshotSource: 'capture_refetch' }));
    const json = JSON.stringify(r).toLowerCase();
    for (const banned of ['mpe', 'effectivereach', 'regret', 'bootstrap', 'estimate', 'clopper', 'narration', 'smd', '"score"']) {
      expect(json, `banned token ${banned}`).not.toContain(banned);
    }
    expect(json).toContain('scored_threshold');
  });
});
