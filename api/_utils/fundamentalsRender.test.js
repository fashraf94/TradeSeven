// api/_utils/fundamentalsRender.test.js
//
// Fundamental Wire Commit 2 — the REAL-FLAGS file: the merge-dark contract.
// (On-state behavior + goldens live in fundamentalsRender.flagOn.test.js —
// the evalIdentityBlocks.test.js / .flagOn split convention.)
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL imports of
// fundamentalsRender.js and the fenced assemblers are the runtime guard for
// the api→src featureFlags edge and the module's transitive import surface —
// they explode in the Node test env if a browser dep ever enters that graph.
// The flags module is NEVER mocked here.

import { describe, it, expect, vi } from 'vitest';

// Infra seam only (the fenced eval assembler imports it at top level;
// nothing here reaches Firestore). Flags stay REAL.
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

import { FUNDAMENTAL_MIRROR_ENABLED } from '../../src/config/featureFlags.js';
import {
  DRAFT_FUNDAMENTALS_COLUMNS,
  draftFundamentalsHeaderSuffix,
  draftFundamentalsNamesSuffix,
  renderDraftFundamentalsCells,
  buildFundamentalsBlock,
} from './fundamentalsRender.js';
import { formatMarketCSV, buildStrategySystemPrompt } from './agentPromptAssembly.js';
import { buildLiveContextBlock } from './agentEvalPromptAssembly.js';
import { makeEvalBattle } from './__fixtures__/controlsPromptFixtures.js';

const FULL_FUNDAMENTALS = Object.freeze({
  trailingPE: { value: 42.1, sectorMedian: 28 },
  priceBookMRQ: 8.3,
  revenueGrowthPct: 11.6,
  marketCapClass: 'large',
  earningsRevisions30d: 2.1,
  beatRate: 75,
  surpriseMagPercentile: 82,
  computedAt: Date.parse('2026-07-24T11:01:00Z'),
});

const STOCK_WITH = Object.freeze({
  symbol: 'NVDA', sectorName: 'Technology', fundamentalScore: 90,
  technicalScore: 88, baggerBombFit: 95, atrPercentile: 0.81,
  archetypeScore: 9.1, fundamentals: FULL_FUNDAMENTALS,
});

function benchBattle() {
  const battle = makeEvalBattle();
  battle.portfolio.bench = {
    stocks: [{ symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.0 }],
    crypto: null,
  };
  return battle;
}

const RANKINGS_WITH = Object.freeze({
  NVDA: {
    symbol: 'NVDA', sectorName: 'Technology',
    industryName: 'Semiconductors & Semiconductor Equipment',
    technicalScore: 88, technicalRank: 3,
    fundamentals: FULL_FUNDAMENTALS,
  },
});
// Same entry with the fundamentals key stripped — the ONLY difference.
const RANKINGS_WITHOUT = Object.freeze({
  NVDA: (({ fundamentals, ...rest }) => rest)(RANKINGS_WITH.NVDA),
});

const liveContext = (rankingsMap) => buildLiveContextBlock(
  benchBattle(), {}, {}, [], [], [], [],
  { vwap: {}, riskStatus: null, rankingsMap }, null,
);

describe('merge-dark contract — the flag is OFF at HEAD and every export is inert', () => {
  it('the flag ships false (merge-dark pin)', () => {
    expect(FUNDAMENTAL_MIRROR_ENABLED).toBe(false);
  });

  it('all helpers return their inert value even against full data', () => {
    expect(draftFundamentalsHeaderSuffix()).toBe('');
    expect(draftFundamentalsNamesSuffix()).toBe('');
    expect(renderDraftFundamentalsCells(STOCK_WITH)).toBe('');
    expect(buildFundamentalsBlock(
      [{ symbol: 'NVDA' }], { stocks: [{ symbol: 'AMD' }], crypto: null }, RANKINGS_WITH,
    )).toBeNull();
    expect(DRAFT_FUNDAMENTALS_COLUMNS).toEqual(['PE_VS_SECT', 'REVG_PCT', 'MCAP_CLS']);
  });

  it('formatMarketCSV is byte-identical with and without mirrored fundamentals', () => {
    const { fundamentals, ...stripped } = STOCK_WITH;
    const withF = formatMarketCSV([STOCK_WITH]);
    const withoutF = formatMarketCSV([stripped]);
    expect(withF).toBe(withoutF);
    expect(withF).toBe('TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH\nNVDA|Technology|90|88|95|0.81|9.1');
  });

  it('the strategy system prompt label carries no fundamentals column names while dark', () => {
    const out = buildStrategySystemPrompt('CSV_HERE', null, null);
    expect(out).toContain('STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH):');
    expect(out).not.toContain('PE_VS_SECT');
  });

  it('buildLiveContextBlock is byte-identical whether or not the doc carries fundamentals', async () => {
    const withF = await liveContext(RANKINGS_WITH);
    const withoutF = await liveContext(RANKINGS_WITHOUT);
    expect(withF).toBe(withoutF);
    expect(withF).not.toContain('FUNDAMENTALS (');
  });
});
