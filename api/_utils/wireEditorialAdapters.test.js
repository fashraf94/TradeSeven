// api/_utils/wireEditorialAdapters.test.js
// Phase 2 N3.3 — deterministic verdict adapters. Matrix rows:
//   P2-7  — adapter verdict deterministic: a known-wrong declared value is
//           VERIFIED_WRONG regardless of any model text anywhere.
//   P2-8  — NOT_VERIFIABLE never passes silently: missing operands →
//           NOT_VERIFIABLE with a reason code, counted.
//   P2-23 — unknown snapshot shape → NOT_VERIFIABLE(unknown_shape); not a
//           throw, not a skip.
//   P2-38 — R4-M1 binding rule fixtures: AAPL+BTC (off-universe) ·
//           mismatched primaryTicker · duplicate mentions · ticker +
//           market-scoped basis.
//   P2-39 — preview shapes → UNVERIFIABLE(circular) regardless of value
//           agreement.
//   P2-40 — consensus operand source: the GENERATING-DAY bucket via the
//           writers' UTC-date expression, never the Wire marketDate.
// Plus the LOCKED §6 tolerance boundaries and the gate-bearing critical
// partition (status/direction inversion · subject mismatch · wrong-subject
// index_move).

import { describe, it, expect } from 'vitest';
import {
  adaptStory,
  detectSnapshotShape,
  parseOperand,
  bindingEntitySet,
  bindsToPrimaryTicker,
  consensusJoinDate,
  EDITORIAL_VERDICTS,
} from './wireEditorialAdapters.js';

const { VERIFIED_CORRECT, VERIFIED_WRONG, NOT_VERIFIABLE } = EDITORIAL_VERDICTS;

// ── Fixture builders ───────────────────────────────────────────────────────
const entryOf = (eventType, factsOver = {}, over = {}) => ({
  storyId: over.storyId ?? 's1',
  reporter: over.reporter ?? 'alex',
  publishedAt: over.publishedAt ?? '2026-07-28T18:00:00Z',
  quarantined: false,
  agentFacts: {
    eventType,
    tickers: factsOver.tickers ?? ['NVDA'],
    primaryTicker: factsOver.primaryTicker ?? 'NVDA',
    offUniverseTickers: factsOver.offUniverseTickers ?? [],
    subjectRef: factsOver.subjectRef ?? null,
    direction: factsOver.direction ?? null,
    magnitude: factsOver.magnitude ?? null,
    figures: factsOver.figures ?? [],
    qualifiers: [], digest: 'd', chainId: 's1',
    schemaVersion: 'wire-1.6', digestRendererVersion: '1.0.0', validatorVersion: '1.6.0',
  },
});

const mag = (value, unit, basis) => ({ value, unit, basis });

const S2_DOC = (percentChange = 3.1, over = {}) => ({
  primaryTicker: over.primaryTicker ?? 'NVDA',
  dataSnapshot: { price: 150.5, change: 4.5, percentChange, atrMultiple: 2.1, direction: percentChange >= 0 ? 'up' : 'down' },
});

const S1_DOC = (legs = {}) => ({
  primaryTicker: null,
  dataSnapshot: {
    period: 'midday', marketDirection: 'mixed', avgIndexChange: 0.1,
    spy: { price: 620, change: 1.2, changePercent: legs.spy ?? 0.2 },
    qqq: { price: 560, change: -7.9, changePercent: legs.qqq ?? -1.4 },
    dia: { price: 440, change: 0.9, changePercent: legs.dia ?? 0.2 },
    iwm: { price: 230, change: 0.5, changePercent: legs.iwm ?? 0.2 },
    topMovers: [],
  },
});

const S3_DOC = (actual, estimate, eventName = 'CPI m/m') => ({
  primaryTicker: null,
  dataSnapshot: { eventName, category: 'inflation', actual, estimate, previous: '0.2%', impact: 'high', spy: null, qqq: null },
});

const S5_DOC = (over = {}) => ({
  primaryTicker: 'NVDA',
  dataSnapshot: {
    symbol: 'NVDA', epsActual: over.epsActual ?? 1.05, epsEstimate: over.epsEstimate ?? 1.00,
    outcome: 'beat', surprise: 5.0, priceMove: over.priceMove ?? 4.2, magnitude: null,
  },
});

const S7_DOC = () => ({
  primaryTicker: 'XLK',
  dataSnapshot: {
    columnType: 'sector_rotation', topSectors: [],
    sectorPerformance: [
      { symbol: 'XLK', price: 240, changePercent: 1.8 },
      { symbol: 'XLF', price: 45, changePercent: -0.3 },
    ],
  },
});

// ── P2-7: deterministic verdicts + §6 boundaries ───────────────────────────
describe('P2-7 — quoteDelta (S2), locked tolerances', () => {
  const run = (declared, percentChange, factsOver = {}) => adaptStory({
    entry: entryOf('market_mover', { magnitude: mag(declared, 'pct', 'price_vs_prior_close'), ...factsOver }),
    storyDoc: S2_DOC(percentChange),
    bucket: null,
  });

  it('a known-wrong declared value is VERIFIED_WRONG — no prose consulted, no judge in the loop', () => {
    const a = run(8.2, 3.1);
    expect(a.results[0].verdict).toBe(VERIFIED_WRONG);
    expect(a.storyVerdict).toBe(VERIFIED_WRONG);
    expect(a.results[0].expected).toBe(3.1);
  });

  it('±0.05 pp half-step: 3.15 vs 3.1 passes; 3.16 fails (same sign → plain derivation error, not critical)', () => {
    expect(run(3.15, 3.1).results[0].verdict).toBe(VERIFIED_CORRECT);
    const wrong = run(3.16, 3.1);
    expect(wrong.results[0].verdict).toBe(VERIFIED_WRONG);
    expect(wrong.results[0].critical).toBeNull();
    expect(wrong.criticalCodes).toEqual([]);
  });

  it('|declared| ≥ 10 switches to ±0.5% relative', () => {
    expect(run(15.05, 15.0).results[0].verdict).toBe(VERIFIED_CORRECT); // 0.05 ≤ 0.075
    expect(run(15.2, 15.0).results[0].verdict).toBe(VERIFIED_WRONG);   // 0.2 > 0.075
  });

  it('status inversion (sign flip beyond tolerance) is CRITICAL', () => {
    const a = run(3.1, -3.1);
    expect(a.results[0]).toMatchObject({ verdict: VERIFIED_WRONG, critical: 'status_inversion' });
    expect(a.criticalCodes).toContain('status_inversion');
  });

  it('declared direction contradicting the recomputed sign is CRITICAL (direction_inversion)', () => {
    const a = run(3.1, -3.1, { direction: 'up' });
    expect(a.results[0].critical).toBe('direction_inversion');
  });

  it('doc↔facts subject mismatch is CRITICAL independent of value checks', () => {
    const a = adaptStory({
      entry: entryOf('market_mover', { magnitude: mag(3.1, 'pct', 'price_vs_prior_close') }),
      storyDoc: S2_DOC(3.1, { primaryTicker: 'AMD' }),
      bucket: null,
    });
    expect(a.results[0].verdict).toBe(VERIFIED_CORRECT); // value itself fine
    expect(a.criticalCodes).toContain('subject_mismatch');
  });
});

// ── indexProxy (S1) + wrong-subject probe ─────────────────────────────────
describe('indexProxy (S1) — ETF legs, VIX hole, wrong-subject probe', () => {
  const run = (declared, subjectRef, legs) => adaptStory({
    entry: entryOf('index_move', {
      tickers: [], primaryTicker: null, subjectRef,
      magnitude: mag(declared, 'pct', 'index_vs_prior_close'),
    }, { reporter: 'kai' }),
    storyDoc: S1_DOC(legs),
    bucket: null,
  });

  it('verifies against the OWN subject leg within ±0.15 pp (proxy slack)', () => {
    expect(run(-1.4, 'NDX').results[0].verdict).toBe(VERIFIED_CORRECT);
    expect(run(-1.26, 'NDX').results[0].verdict).toBe(VERIFIED_CORRECT); // 0.14 ≤ 0.15
    expect(run(-1.24, 'NDX').results[0].verdict).toBe(VERIFIED_WRONG);   // 0.16 > 0.15
  });

  it('N3.4 wrong-subject: declared move fails its own leg but matches ANOTHER index → CRITICAL wrong_subject_index_move', () => {
    const a = run(-1.4, 'SPX'); // spy +0.2; the -1.4 is qqq's move
    expect(a.results[0]).toMatchObject({ verdict: VERIFIED_WRONG, critical: 'wrong_subject_index_move' });
    expect(a.results[0].caveats.join()).toContain('matches:NDX');
  });

  it('own-leg failure matching NO other leg stays an ordinary derivation error (same sign, beyond tolerance)', () => {
    const a = run(0.45, 'SPX'); // spy +0.2 → 0.25 beyond ±0.15; matches no other leg
    expect(a.results[0].verdict).toBe(VERIFIED_WRONG);
    expect(a.results[0].critical).toBeNull();
  });

  it('VIX has no proxy leg → NOT_VERIFIABLE(no_proxy_instrument); pts unit unsupported', () => {
    expect(run(-1.4, 'VIX').results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'no_proxy_instrument' });
    const pts = adaptStory({
      entry: entryOf('index_move', { tickers: [], primaryTicker: null, subjectRef: 'SPX', magnitude: mag(-88, 'pts', 'index_vs_prior_close') }, { reporter: 'kai' }),
      storyDoc: S1_DOC(), bucket: null,
    });
    expect(pts.results[0].reason).toBe('unit_unsupported');
  });
});

// ── econPrint (S3) + P2-40 ─────────────────────────────────────────────────
describe('econPrint (S3) — strict parse + generating-day bucket (P2-40)', () => {
  it('recomputes the deviation from parsed Sonar strings (±0.05 native)', () => {
    const a = adaptStory({
      entry: entryOf('econ_print', { tickers: [], primaryTicker: null, subjectRef: 'CPI', magnitude: mag(0.1, 'pct', 'print_vs_expected') }, { reporter: 'neta' }),
      storyDoc: S3_DOC('0.4%', '0.3%'),
      bucket: null,
    });
    expect(a.results[0]).toMatchObject({ verdict: VERIFIED_CORRECT, expected: 0.1 });
    expect(a.results[0].operands.source).toBe('dataSnapshot');
  });

  it('unparseable snapshot strings fall through to the GENERATING-DAY economics[] row', () => {
    const a = adaptStory({
      entry: entryOf('econ_print', { tickers: [], primaryTicker: null, subjectRef: 'CPI', magnitude: mag(0.1, 'pct', 'print_vs_expected') }, { reporter: 'neta' }),
      storyDoc: S3_DOC('hot print', 'about 0.3'),
      bucket: { economics: [{ event: 'CPI m/m', actual: '0.4%', expected: '0.3%', impact: 'high' }] },
    });
    expect(a.results[0].verdict).toBe(VERIFIED_CORRECT);
    expect(a.results[0].operands.source).toBe('consensus_bucket');
  });

  it('parse failure with no bucket row → NOT_VERIFIABLE(unparseable_operand), counted (P2-8)', () => {
    const a = adaptStory({
      entry: entryOf('econ_print', { tickers: [], primaryTicker: null, subjectRef: 'CPI', magnitude: mag(0.1, 'pct', 'print_vs_expected') }, { reporter: 'neta' }),
      storyDoc: S3_DOC('hot', 'cool'),
      bucket: { economics: [] },
    });
    expect(a.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'unparseable_operand' });
    expect(a.notVerifiableReasons).toContain('unparseable_operand');
  });

  it('consensusJoinDate is the writers\' UTC expression — an after-hours ET publish joins the NEXT UTC day, never the Wire marketDate', () => {
    // 2026-07-28T00:30:00Z is Jul 27 EVENING in ET (the Wire marketDate
    // would snap to 2026-07-27); the writers key the bucket by UTC.
    expect(consensusJoinDate('2026-07-28T00:30:00Z')).toBe('2026-07-28');
    expect(consensusJoinDate(new Date('2026-07-28T18:00:00Z'))).toBe('2026-07-28');
    expect(consensusJoinDate('garbage')).toBeNull();
    // Review fix: a missing timestamp has no join key. new Date(null) is
    // epoch 0 (1970-01-01), NOT NaN, so without the nullish guard these
    // would silently return '1970-01-01' and persist it as audit provenance.
    expect(consensusJoinDate(null)).toBeNull();
    expect(consensusJoinDate(undefined)).toBeNull();
  });
});

// ── earnings (S5) ──────────────────────────────────────────────────────────
describe('earnings (S5) — eps/revenue/priceMove', () => {
  const dougEntry = (magnitude, factsOver = {}) =>
    entryOf('earnings_recap', { magnitude, ...factsOver }, { reporter: 'doug' });

  it('eps usd surprise: ±$0.005 half-cent band', () => {
    const ok = adaptStory({ entry: dougEntry(mag(0.05, 'usd', 'eps_vs_consensus')), storyDoc: S5_DOC(), bucket: null });
    expect(ok.results[0]).toMatchObject({ verdict: VERIFIED_CORRECT, expected: 0.05 });
    const off = adaptStory({ entry: dougEntry(mag(0.06, 'usd', 'eps_vs_consensus')), storyDoc: S5_DOC(), bucket: null });
    expect(off.results[0].verdict).toBe(VERIFIED_WRONG);
  });

  it('eps pct surprise: recomputed from the same cent-rounded operands, ±0.5 pp', () => {
    const a = adaptStory({ entry: dougEntry(mag(5.0, 'pct', 'eps_vs_consensus')), storyDoc: S5_DOC(), bucket: null });
    expect(a.results[0].verdict).toBe(VERIFIED_CORRECT); // (1.05-1.00)/1.00 = 5.0%
    const inverted = adaptStory({ entry: dougEntry(mag(-5.0, 'pct', 'eps_vs_consensus')), storyDoc: S5_DOC(), bucket: null });
    expect(inverted.results[0].critical).toBe('status_inversion'); // a beat declared as a miss
  });

  it('revenue deviation from the bucket results row; nullable → NOT_VERIFIABLE(missing_operand)', () => {
    const bucket = { earnings: { results: { NVDA: { result: 'beat', epsActual: 1.05, epsEstimate: 1.0, revenueActual: 35.4e9, revenueEstimate: 35.0e9 } } } };
    const ok = adaptStory({ entry: dougEntry(mag(0.4e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket });
    expect(ok.results[0].verdict).toBe(VERIFIED_CORRECT);
    const missing = adaptStory({ entry: dougEntry(mag(0.4e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket: { earnings: { results: { NVDA: { revenueActual: null, revenueEstimate: null } } } } });
    expect(missing.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'missing_operand' });
  });

  it('§6 revenue band is 0.5% of the LEVEL, not the deviation (review fix) — a two-sig-fig-billions deviation within level tolerance is CORRECT', () => {
    // level 35.4e9 → band = 0.5% × 35.4e9 = 0.177e9. Recomputed deviation
    // 0.4e9; a reporter declares 0.42e9 (revenue rounded to 35.42B, well
    // within two-sig-fig rounding of a 35B print). |0.42e9 − 0.4e9| = 0.02e9.
    // Level-relative: 0.02e9 ≤ 0.177e9 → CORRECT. Deviation-relative (the
    // BUG): band would be 0.5% × 0.4e9 = 0.002e9 → 0.02e9 ≫ 0.002e9 → WRONG.
    const bucket = { earnings: { results: { NVDA: { revenueActual: 35.4e9, revenueEstimate: 35.0e9 } } } };
    const near = adaptStory({ entry: dougEntry(mag(0.42e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket });
    expect(near.results[0].verdict).toBe(VERIFIED_CORRECT);
    expect(near.results[0].tolerance).toBeCloseTo(0.177e9, 0);
    // A deviation error beyond the LEVEL band is still WRONG (band didn't go slack).
    const far = adaptStory({ entry: dougEntry(mag(0.7e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket });
    expect(far.results[0].verdict).toBe(VERIFIED_WRONG); // |0.7e9−0.4e9|=0.3e9 > 0.177e9
  });

  it('recorded exception: a declared value matching the revenue LEVEL is ambiguous_referent — refused, never WRONG', () => {
    const bucket = { earnings: { results: { NVDA: { revenueActual: 35.4e9, revenueEstimate: 35.0e9 } } } };
    const level = adaptStory({ entry: dougEntry(mag(35.4e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket });
    expect(level.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'ambiguous_referent' });
    // …while a plainly wrong deviation is still WRONG:
    const wrong = adaptStory({ entry: dougEntry(mag(0.9e9, 'usd', 'revenue_vs_consensus')), storyDoc: S5_DOC(), bucket });
    expect(wrong.results[0].verdict).toBe(VERIFIED_WRONG);
  });

  it('price_vs_prior_close verifies against priceMove ONLY (declared-referent rule) with the ambiguity caveat stamped', () => {
    const a = adaptStory({ entry: dougEntry(mag(4.25, 'pct', 'price_vs_prior_close')), storyDoc: S5_DOC({ priceMove: 4.2 }), bucket: null });
    expect(a.results[0].verdict).toBe(VERIFIED_CORRECT); // ±0.10
    expect(a.results[0].caveats).toContain('ambiguous_referent_priceMove');
  });
});

// ── catalystQuote (S1-adjacent kai single-ticker) ──────────────────────────
describe('catalystQuote — abs/sign rule over the generating-day catalysts row', () => {
  const kaiBreak = (figures, direction = 'down') =>
    entryOf('technical_break', {
      tickers: ['NVDA'], primaryTicker: 'NVDA', direction,
      magnitude: null, figures,
    }, { reporter: 'kai' });

  it('|declared| vs |operand| ±0.10 with direction matched separately', () => {
    const bucket = { catalysts: { NVDA: { direction: 'down', percentChange: 5.1, atrMultiple: 2.4, catalyst: 'x', source: 'scan', confidence: 'high' } } };
    const a = adaptStory({ entry: kaiBreak([{ value: -5.15, unit: 'pct', basis: 'price_vs_prior_close' }]), storyDoc: S1_DOC(), bucket });
    expect(a.results[0].verdict).toBe(VERIFIED_CORRECT);
    expect(a.results[0].caveats).toContain('abs_sign_rule');

    const flipped = adaptStory({ entry: kaiBreak([{ value: 5.1, unit: 'pct', basis: 'price_vs_prior_close' }], 'up'), storyDoc: S1_DOC(), bucket });
    expect(flipped.results[0].critical).toBe('direction_inversion');
  });

  it('no catalyst row that day → NOT_VERIFIABLE(missing_operand) with the presence-conditional caveat', () => {
    const a = adaptStory({ entry: kaiBreak([{ value: -5.1, unit: 'pct', basis: 'price_vs_prior_close' }]), storyDoc: S1_DOC(), bucket: { catalysts: {} } });
    expect(a.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'missing_operand' });
    expect(a.results[0].caveats).toContain('catalyst_presence_conditional');
  });
});

// ── sectorQuote (S7) ───────────────────────────────────────────────────────
describe('sectorQuote (S7) — five-of-eleven coverage', () => {
  it('a stored ETF verifies strict; an unstored one is missing_operand', () => {
    const kim = (ticker) => entryOf('sector_rotation', {
      tickers: [ticker], primaryTicker: ticker,
      magnitude: mag(1.8, 'pct', 'price_vs_prior_close'),
    }, { reporter: 'kim' });
    const ok = adaptStory({ entry: kim('XLK'), storyDoc: S7_DOC(), bucket: null });
    expect(ok.results[0].verdict).toBe(VERIFIED_CORRECT);
    expect(ok.results[0].caveats).toContain('proxy_e_coverage');
    const gone = adaptStory({ entry: kim('XLE'), storyDoc: S7_DOC(), bucket: null });
    expect(gone.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'missing_operand' });
  });
});

// ── P2-38: the R4-M1 binding fixtures ──────────────────────────────────────
describe('P2-38 — binding entity set (typed-only) + rule', () => {
  it('AAPL + BTC (off-universe) → two entities → unbindable', () => {
    const facts = { tickers: ['AAPL'], offUniverseTickers: ['BTC'], subjectRef: null, primaryTicker: 'AAPL' };
    expect(bindingEntitySet(facts)).toEqual(['AAPL', 'BTC']);
    expect(bindsToPrimaryTicker(facts, 'price_vs_prior_close')).toMatchObject({ ok: false, reason: 'entity_count:2' });
    // …and through the adapter: the declaration lands NOT_VERIFIABLE(unbindable).
    const a = adaptStory({
      entry: entryOf('market_mover', { tickers: ['AAPL'], offUniverseTickers: ['BTC'], primaryTicker: 'AAPL', magnitude: mag(3.1, 'pct', 'price_vs_prior_close') }),
      storyDoc: S2_DOC(3.1, { primaryTicker: 'AAPL' }),
      bucket: null,
    });
    expect(a.results[0].verdict).toBe(NOT_VERIFIABLE);
    expect(a.results[0].reason).toMatch(/^unbindable:/);
  });

  it('duplicate mentions dedupe to one entity → binds', () => {
    const facts = { tickers: ['NVDA', 'nvda'], offUniverseTickers: ['NVDA'], subjectRef: 'NVDA', primaryTicker: 'NVDA' };
    expect(bindingEntitySet(facts)).toEqual(['NVDA']);
    expect(bindsToPrimaryTicker(facts, 'price_vs_prior_close').ok).toBe(true);
  });

  it('mismatched primaryTicker → unbindable', () => {
    const facts = { tickers: ['AMD'], offUniverseTickers: [], subjectRef: null, primaryTicker: 'NVDA' };
    expect(bindsToPrimaryTicker(facts, 'price_vs_prior_close')).toMatchObject({ ok: false, reason: 'primary_ticker_mismatch' });
  });

  it('single ticker + market-scoped basis → basis_not_ticker_scoped (binding never applies)', () => {
    const facts = { tickers: ['NVDA'], offUniverseTickers: [], subjectRef: null, primaryTicker: 'NVDA' };
    expect(bindsToPrimaryTicker(facts, 'print_vs_expected')).toMatchObject({ ok: false, reason: 'basis_not_ticker_scoped' });
    expect(bindsToPrimaryTicker(facts, 'index_vs_prior_close').ok).toBe(false);
  });
});

// ── P2-39 / P2-23 ──────────────────────────────────────────────────────────
describe('P2-39 — preview shapes are CIRCULAR regardless of value agreement', () => {
  it('doug earnings_preview (S6): declared value EQUAL to the bucket estimate still lands circular', () => {
    const a = adaptStory({
      entry: entryOf('earnings_preview', { magnitude: mag(1.23, 'usd', 'consensus_estimate') }, { reporter: 'doug' }),
      storyDoc: { primaryTicker: 'NVDA', dataSnapshot: { symbol: 'NVDA', reportDate: '2026-08-05', epsEstimate: 1.23, revenueEstimate: 4.5e9 } },
      bucket: { earnings: { results: { NVDA: { epsEstimate: 1.23 } } } },
    });
    expect(a.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'circular' });
    expect(a.storyVerdict).toBe(NOT_VERIFIABLE);
  });

  it('neta econ_preview (S4): same rule', () => {
    const a = adaptStory({
      entry: entryOf('econ_preview', { tickers: [], primaryTicker: null, subjectRef: 'CPI', magnitude: mag(0.3, 'pct', 'consensus_estimate') }, { reporter: 'neta' }),
      storyDoc: { primaryTicker: null, dataSnapshot: { weekHighlight: 'CPI week', totalEvents: 7, highImpactCount: 2 } },
      bucket: null,
    });
    expect(a.results[0].reason).toBe('circular');
  });
});

describe('P2-23 — unknown shape', () => {
  it('a novel snapshot → NOT_VERIFIABLE(unknown_shape) on every declaration; never a throw', () => {
    const a = adaptStory({
      entry: entryOf('market_mover', { magnitude: mag(3.1, 'pct', 'price_vs_prior_close') }),
      storyDoc: { primaryTicker: 'NVDA', dataSnapshot: { somethingNew: true, v2Field: [1, 2] } },
      bucket: null,
    });
    expect(a.shape).toBe('unknown');
    expect(a.results[0]).toMatchObject({ verdict: NOT_VERIFIABLE, reason: 'unknown_shape' });
    expect(a.storyVerdict).toBe(NOT_VERIFIABLE);
  });

  it('a missing dataSnapshot classifies unknown too (counted, not skipped)', () => {
    const a = adaptStory({ entry: entryOf('market_mover', { magnitude: mag(3.1, 'pct', 'price_vs_prior_close') }), storyDoc: null, bucket: null });
    expect(a.shape).toBe('unknown');
    expect(a.results).toHaveLength(1);
  });
});

// ── P2-8 exclusion semantics + shape detection + parse table ──────────────
describe('P2-8 — NOT_VERIFIABLE is a counted class, never a silent pass', () => {
  it('a story with ONLY unverifiable declarations is storyVerdict NOT_VERIFIABLE with reasons enumerated', () => {
    const a = adaptStory({
      entry: entryOf('gap_event', { magnitude: mag(2.0, 'pct', 'gap_vs_prior_close') }),
      storyDoc: S2_DOC(3.1), bucket: null,
    });
    expect(a.storyVerdict).toBe(NOT_VERIFIABLE);
    expect(a.notVerifiableReasons).toEqual(['missing_operand']);
  });

  it('a story with one verified and one unverifiable declaration is VERIFIED (the NV leg stays counted)', () => {
    const a = adaptStory({
      entry: entryOf('gap_event', {
        magnitude: mag(2.0, 'pct', 'gap_vs_prior_close'),
        figures: [{ value: 3.1, unit: 'pct', basis: 'price_vs_prior_close' }],
      }),
      storyDoc: S2_DOC(3.1), bucket: null,
    });
    expect(a.storyVerdict).toBe(VERIFIED_CORRECT);
    expect(a.notVerifiableReasons).toContain('missing_operand');
  });
});

describe('shape detection (F-M5) + operand parse table', () => {
  it('detects all seven recorded shapes', () => {
    expect(detectSnapshotShape(S1_DOC().dataSnapshot)).toBe('S1');
    expect(detectSnapshotShape(S2_DOC().dataSnapshot)).toBe('S2');
    expect(detectSnapshotShape(S3_DOC('0.4%', '0.3%').dataSnapshot)).toBe('S3');
    expect(detectSnapshotShape({ weekHighlight: 'x', totalEvents: 3, highImpactCount: 1 })).toBe('S4');
    expect(detectSnapshotShape(S5_DOC().dataSnapshot)).toBe('S5');
    expect(detectSnapshotShape({ symbol: 'NVDA', reportDate: '2026-08-05', epsEstimate: 1.2, revenueEstimate: null })).toBe('S6');
    expect(detectSnapshotShape(S7_DOC().dataSnapshot)).toBe('S7');
    expect(detectSnapshotShape({})).toBe('unknown');
  });

  it('parseOperand: strict grammar only', () => {
    expect(parseOperand('3.7%')).toBe(3.7);
    expect(parseOperand('-0.2 %')).toBe(-0.2);
    expect(parseOperand('212K')).toBe(212_000);
    expect(parseOperand('2.5B')).toBe(2.5e9);
    expect(parseOperand('1,234')).toBe(1234);
    expect(parseOperand(0.4)).toBe(0.4);
    expect(parseOperand('N/A')).toBeNull();
    expect(parseOperand('about 0.3')).toBeNull();
    expect(parseOperand('3.7% m/m')).toBeNull();
    expect(parseOperand(null)).toBeNull();
  });
});
