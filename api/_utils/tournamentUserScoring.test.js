// api/_utils/tournamentUserScoring.test.js
//
// Three contracts in one suite:
//
// 1. PORT-CONTRACT BATTERY: buildThresholds must reproduce the fenced
//    threshold math at api/agent/decide.js:584-592 (both fallback arms:
//    2.5 stock / 5.0 crypto), and scoreLeg must be IDENTICAL to a direct
//    calculateAssetScoreV3 call with thresholdPriceChange: null (founder
//    ruling #2 — the null-fallback arm is the primary path), across
//    direction long/short × threshold crossings × history states.
//
// 2. SOURCE-TEXT TRIPWIRE: decide.js is fenced and READ-ONLY. This suite
//    reads its source text and asserts the ported formulas are byte-intact —
//    if the fence ever drifts, this breaks loudly and the port gets re-vetted.
//    The file itself is never edited.
//
// 3. DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
//    tournamentUserScoring module below is the runtime guard for its
//    api/ -> src/ import of src/utils/baggerBombUtils.js — it explodes in
//    this Node test environment if a browser-only dependency ever enters
//    that transitive graph. Never mock this import.

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';
import {
  buildThresholds,
  loadAtrPercentiles,
  resolveBaseATR,
  scoreLeg,
  scorePick,
} from './tournamentUserScoring.js';

// ==================== SOURCE-TEXT TRIPWIRE ====================

describe('fence tripwire — decide.js port sources are byte-intact', () => {
  const decideSource = readFileSync(new URL('../agent/decide.js', import.meta.url), 'utf8');

  it('the threshold-construction block (decide.js:584-592) is unchanged', () => {
    const fencedBlock = [
      '    const thresholds = {};',
      '    for (const asset of allAssets) {',
      '      const baseATR = asset.baseATR || (asset.isCrypto ? 5.0 : 2.5);',
      '      thresholds[asset.symbol] = {',
      '        threshold: baseATR,',
      '        rallyThreshold: baseATR * 1.5,',
      '        moonshotThreshold: baseATR * 2.0,',
      '      };',
      '    }',
    ].join('\n');
    expect(decideSource).toContain(fencedBlock);
  });

  it('the baseATR enrichment formula (decide.js:794) is unchanged', () => {
    expect(decideSource).toContain('baseATR: (stock.atrPercentile || 0.5) * 8');
  });
});

// ==================== PORT-CONTRACT: buildThresholds ====================

describe('buildThresholds — port contract vs decide.js:584-592', () => {
  it('explicit baseATR: threshold / ×1.5 rally / ×2.0 moonshot', () => {
    expect(buildThresholds([{ symbol: 'NVDA', baseATR: 4 }])).toEqual({
      NVDA: { threshold: 4, rallyThreshold: 6, moonshotThreshold: 8 },
    });
  });

  it('absent baseATR, stock arm: 2.5 fallback', () => {
    expect(buildThresholds([{ symbol: 'AMD' }])).toEqual({
      AMD: { threshold: 2.5, rallyThreshold: 3.75, moonshotThreshold: 5 },
    });
  });

  it('absent baseATR, crypto arm: 5.0 fallback', () => {
    expect(buildThresholds([{ symbol: 'BTC', isCrypto: true }])).toEqual({
      BTC: { threshold: 5, rallyThreshold: 7.5, moonshotThreshold: 10 },
    });
  });

  it('baseATR 0 is falsy and takes the fallback arm (|| semantics, as fenced)', () => {
    expect(buildThresholds([{ symbol: 'X', baseATR: 0 }]).X.threshold).toBe(2.5);
    expect(buildThresholds([{ symbol: 'Y', baseATR: 0, isCrypto: true }]).Y.threshold).toBe(5);
  });

  it('maps multiple assets independently', () => {
    const out = buildThresholds([
      { symbol: 'NVDA', baseATR: 3.2 },
      { symbol: 'BTC', isCrypto: true },
      { symbol: 'AMD' },
    ]);
    expect(Object.keys(out)).toEqual(['NVDA', 'BTC', 'AMD']);
    expect(out.NVDA.rallyThreshold).toBeCloseTo(4.8, 12);
  });
});

// ==================== PORT-CONTRACT: scoreLeg ≡ calculateAssetScoreV3 ====================

const pc = (baseline, price) => ((price - baseline) / baseline) * 100;

function makeLeg({ direction = 'long', baselinePrice = 100, thresholdHistory = [] } = {}) {
  return { direction, baselinePrice, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory };
}

describe('scoreLeg — identity with the canonical scorer, thresholdPriceChange null', () => {
  it('long, bagger crossing: identical to the direct call; bagger badge + flat bonus', () => {
    const leg = makeLeg();
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 103 });
    const direct = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, pc(100, 103), {}, {}, null
    );
    expect(result).toEqual(direct);
    expect(result.badges).toEqual(['bagger']);
    expect(result.basePoints).toBe(30); // 3% × 10 × 1.0 (tier absent → support)
    expect(result.bonusPoints).toBe(15);
    expect(result.totalPoints).toBe(45);
  });

  it('short, profitable: raw priceChange passed through — the scorer negates, never this module', () => {
    const leg = makeLeg({ direction: 'short' });
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 95 });
    const direct = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'short' }, pc(100, 95), {}, {}, null
    );
    expect(result).toEqual(direct);
    // -5% raw → +5% effective → multiplier 2.0: all three positive tiers cross.
    expect(result.badges).toEqual(['bagger', 'doubleBagger', 'tenBagger']);
    expect(result.totalPoints).toBe(50 + 95);
  });

  it('short, losing: negative crossings (bust) via the same identity', () => {
    const leg = makeLeg({ direction: 'short' });
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 103 });
    const direct = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'short' }, pc(100, 103), {}, {}, null
    );
    expect(result).toEqual(direct);
    expect(result.badges).toEqual(['bust']);
    expect(result.totalPoints).toBe(-30 - 10);
  });

  it('carried history state: badges from a past peak persist through a reversal', () => {
    const leg = makeLeg({
      thresholdHistory: [
        { maxMultiplier: 1.1, minMultiplier: 0, recordedAt: 'D1' },
        { maxMultiplier: 1.6, minMultiplier: 0, recordedAt: 'D2' }, // last element = current
      ],
    });
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 100.5 });
    const direct = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' },
      pc(100, 100.5), { maxMultiplier: 1.6, minMultiplier: 0, recordedAt: 'D2' }, {}, null
    );
    expect(result).toEqual(direct);
    expect(result.badges).toEqual(['bagger', 'doubleBagger']); // earned at the 1.6 peak, kept
    expect(result.bonusPoints).toBe(45);
    expect(result.history.maxMultiplier).toBe(1.6);
  });

  it('fresh history state: empty thresholdHistory means {}', () => {
    const leg = makeLeg({ thresholdHistory: [] });
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 101 });
    expect(result.badges).toEqual([]);
    expect(result.history).toEqual({ maxMultiplier: pc(100, 101) / 2.5, minMultiplier: 0 });
  });

  it('the null arm is the live path: threshold multiplier tracks the leg baseline, not any previousClose', () => {
    const leg = makeLeg();
    const result = scoreLeg({ symbol: 'NVDA', baseATR: 2.5, leg, price: 103 });
    expect(result.multiplier).toBeCloseTo(pc(100, 103) / 2.5, 12);
    // Contrast arm: an explicit thresholdPriceChange would diverge — proving
    // scoreLeg pins the null fallback (baggerBombUtils.js:575-578).
    const contrast = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, pc(100, 103), {}, {}, 10
    );
    expect(contrast.multiplier).toBe(4);
    expect(result.multiplier).not.toBe(contrast.multiplier);
  });

  it('unscoreable legs return null: missing/zero baseline, missing price', () => {
    expect(scoreLeg({ symbol: 'X', baseATR: 2.5, leg: makeLeg({ baselinePrice: null }), price: 100 })).toBeNull();
    expect(scoreLeg({ symbol: 'X', baseATR: 2.5, leg: { ...makeLeg(), baselinePrice: 0 }, price: 100 })).toBeNull();
    expect(scoreLeg({ symbol: 'X', baseATR: 2.5, leg: makeLeg(), price: undefined })).toBeNull();
  });
});

// ==================== CUMULATIVE PICK SCORE ====================

describe('scorePick — cumulative: banked closed legs + live leg from its baseline', () => {
  it('sums closed-leg bankedScore with the live leg score', () => {
    const pick = {
      symbol: 'NVDA',
      legs: [
        { ...makeLeg({ direction: 'short' }), closedAt: 'T1', bankedScore: 45 },
        makeLeg({ baselinePrice: 110 }),
      ],
      flipCountToday: 1,
    };
    const out = scorePick({ pick, baseATR: 2.5, quote: { current: 113.3 } });
    const liveExpected = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, pc(110, 113.3), {}, {}, null
    ).totalPoints;
    expect(out.bankedPoints).toBe(45);
    expect(out.livePoints).toBe(liveExpected);
    expect(out.totalPoints).toBe(45 + liveExpected);
  });

  it('bank-pending closed legs (no bankedScore yet) contribute 0 until banking settles them', () => {
    const pick = {
      symbol: 'NVDA',
      legs: [
        { ...makeLeg(), closedAt: 'T1' }, // market-closed flip: bankedScore omitted
        makeLeg({ baselinePrice: null }), // new leg unsettled
      ],
    };
    const out = scorePick({ pick, baseATR: 2.5, quote: { current: 105 } });
    expect(out).toEqual({ totalPoints: 0, bankedPoints: 0, livePoints: 0, liveLegResult: null });
  });

  it('a missing quote leaves the live leg unscored, banked points intact', () => {
    const pick = {
      symbol: 'NVDA',
      legs: [{ ...makeLeg(), closedAt: 'T1', bankedScore: 12 }, makeLeg()],
    };
    const out = scorePick({ pick, baseATR: 2.5, quote: undefined });
    expect(out.totalPoints).toBe(12);
    expect(out.liveLegResult).toBeNull();
  });
});

// ==================== baseATR SOURCING ====================

describe('resolveBaseATR / loadAtrPercentiles — input enrichment (decide.js:794 formula)', () => {
  it('applies (atrPercentile || 0.5) * 8; missing rows take the formula default', () => {
    const map = { NVDA: 0.75, AMD: undefined };
    expect(resolveBaseATR('NVDA', map)).toBe(6);
    expect(resolveBaseATR('nvda', map)).toBe(6);
    expect(resolveBaseATR('AMD', map)).toBe(4);   // row without percentile
    expect(resolveBaseATR('TSLA', map)).toBe(4);  // row absent entirely
  });

  it('rankings unavailable → null, so the port-contract fallback applies downstream', () => {
    expect(resolveBaseATR('NVDA', null)).toBeNull();
    expect(buildThresholds([{ symbol: 'NVDA', baseATR: resolveBaseATR('NVDA', null) }]).NVDA.threshold).toBe(2.5);
  });

  it('loadAtrPercentiles reduces stockRankings.stocks; null on missing doc, bad shape, or read failure', async () => {
    const makeDb = (doc, { throws = false } = {}) => ({
      collection: () => ({
        doc: () => ({
          get: async () => {
            if (throws) throw new Error('firestore down');
            return { exists: doc != null, data: () => doc };
          },
        }),
      }),
    });

    expect(await loadAtrPercentiles(makeDb({
      stocks: [{ symbol: 'nvda', atrPercentile: 0.75 }, { symbol: 'AMD' }, { name: 'no symbol' }],
    }))).toEqual({ NVDA: 0.75, AMD: undefined });

    expect(await loadAtrPercentiles(makeDb(null))).toBeNull();
    expect(await loadAtrPercentiles(makeDb({ stocks: 'not-an-array' }))).toBeNull();
    expect(await loadAtrPercentiles(makeDb(null, { throws: true }))).toBeNull();
  });
});
