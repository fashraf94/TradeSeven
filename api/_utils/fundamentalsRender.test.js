// api/_utils/fundamentalsRender.test.js
//
// Fundamental Wire Commit 2 — the REAL-FLAGS file: the ACTIVATED contract.
// (Render-detail behavior + the block/CSV goldens live in
// fundamentalsRender.flagOn.test.js — the evalIdentityBlocks.test.js /
// .flagOn split convention.)
//
// FUNDAMENTAL_MIRROR_ENABLED was flipped false→true Jul 25 2026 (`c45f936c`,
// founder flag-flip commit). This file was the merge-dark lock; converted to
// the on-state lock per the #671 SHADOW_ASSEMBLY_ENABLED pattern — the flag
// pin flips with the flag, in the same spirit that made the flip loud.
//
// OFF-STATE COVERAGE: deliberately NOT re-created here with a stub. This file
// is the §4 dependency-surface guard, so the flags module can never be
// mocked in it and a call-time flip is impossible. The inertness contract
// (every helper returns ''/null; both assemblers byte-identical to a
// mirror-less doc) is already owned by the call-time flips in the sibling
// fundamentalsRender.flagOn.test.js — which may mock the flags module
// precisely because this file does not (DR-13 injection-test split).
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

describe('activated contract — the flag is ON at HEAD and every export renders', () => {
  it('the flag ships true — the deliberate flip this suite guards', () => {
    // Flipped false→true in the founder flag-flip commit `c45f936c`
    // (Jul 25 2026), after the production-shaped render smoke the flag's
    // docstring required. Reverting is likewise a deliberate act: it must
    // edit this assertion — and regenerate the P4 battery goldens — in the
    // same commit, exactly as this reconciliation did (#671 pattern).
    expect(FUNDAMENTAL_MIRROR_ENABLED).toBe(true);
  });

  it('all helpers render their on-state value against full data', () => {
    expect(draftFundamentalsHeaderSuffix()).toBe('|PE_VS_SECT|REVG_PCT|MCAP_CLS');
    expect(draftFundamentalsNamesSuffix()).toBe('/PE_VS_SECT/REVG_PCT/MCAP_CLS');
    // 42.1 / 28 = 1.5035… → 2dp; growth as stored; class initial.
    expect(renderDraftFundamentalsCells(STOCK_WITH)).toBe('|1.50|11.6|L');
    expect(buildFundamentalsBlock(
      [{ symbol: 'NVDA' }], { stocks: [{ symbol: 'AMD' }], crypto: null }, RANKINGS_WITH,
    )).toContain('NVDA (Technology / Semiconductors & Semiconductor Equipment): PE=42.1 (sect med 28)');
    expect(DRAFT_FUNDAMENTALS_COLUMNS).toEqual(['PE_VS_SECT', 'REVG_PCT', 'MCAP_CLS']);
  });

  it('formatMarketCSV now DIVERGES on mirrored fundamentals, null-honestly', () => {
    const { fundamentals, ...stripped } = STOCK_WITH;
    const withF = formatMarketCSV([STOCK_WITH]);
    const withoutF = formatMarketCSV([stripped]);
    expect(withF).not.toBe(withoutF);
    expect(withF).toBe(
      'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS\n'
      + 'NVDA|Technology|90|88|95|0.81|9.1|1.50|11.6|L',
    );
    // A mirror-less row keeps the columns and reports absence — never a default.
    expect(withoutF).toBe(
      'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS\n'
      + 'NVDA|Technology|90|88|95|0.81|9.1|-|-|-',
    );
  });

  it('the strategy system prompt label carries the fundamentals column names', () => {
    const out = buildStrategySystemPrompt('CSV_HERE', null, null);
    expect(out).toContain(
      'STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS):',
    );
  });

  it('buildLiveContextBlock renders the FUNDAMENTALS block, and a mirror-less doc says so honestly', async () => {
    const withF = await liveContext(RANKINGS_WITH);
    const withoutF = await liveContext(RANKINGS_WITHOUT);
    expect(withF).not.toBe(withoutF);
    expect(withF).toContain('FUNDAMENTALS (held + bench; a missing metric is NOT REPORTED — never zero):');
    expect(withF).toContain('NVDA (Technology / Semiconductors & Semiconductor Equipment): PE=42.1 (sect med 28)');
    // The ranking entry still exists without the mirror — the r-07 industry
    // header renders and the line reports the absence rather than omitting
    // the symbol or substituting a neutral value.
    expect(withoutF).toContain(
      'NVDA (Technology / Semiconductors & Semiconductor Equipment): no fundamentals reported',
    );
    expect(withoutF).not.toContain('PE=');
  });
});
