// api/_utils/voiceLayerPrompt.test.js
// Tier 0 Item 1: bench data exposure — buildBenchBriefsBlock unit tests.

import { describe, it, expect } from 'vitest';
import { buildBenchBriefsBlock, buildMarketSnapshotContext } from './voiceLayerPrompt.js';

// ==================== TESTS ====================

describe('buildBenchBriefsBlock — empty / missing', () => {
  it('returns null when marketSnapshot is missing', () => {
    expect(buildBenchBriefsBlock(null)).toBeNull();
    expect(buildBenchBriefsBlock(undefined)).toBeNull();
  });

  it('returns null when benchBriefs is missing', () => {
    expect(buildBenchBriefsBlock({})).toBeNull();
  });

  it('returns null when benchBriefs is empty (no orphan header)', () => {
    expect(buildBenchBriefsBlock({ benchBriefs: [] })).toBeNull();
  });
});

describe('buildBenchBriefsBlock — render shapes', () => {
  it('renders a single stock brief with full data', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'AMD',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: 2.34,
        price: 150.5,
        cooldownActive: false,
        cooldownUntil: null,
        trendSummary: 'Strong uptrend. Above all major SMAs.',
        momentumSummary: 'RSI healthy, not extended. MACD expanding.',
      }],
    });

    expect(out).toContain('YOUR BENCH (available for swap):');
    expect(out).toContain('AMD (stock, Technology) — +2.34%');
    expect(out).toContain('Trend: Strong uptrend. Above all major SMAs.');
    expect(out).toContain('Momentum: RSI healthy, not extended. MACD expanding.');
    expect(out).not.toContain('locked until');
  });

  it('drops the ±N% segment for crypto with price: null', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'BTC-USD',
        assetClass: 'crypto',
        sector: 'Crypto',
        changePercent: null,
        price: null,
        cooldownActive: false,
        cooldownUntil: null,
      }],
    });

    expect(out).toContain('BTC-USD (crypto, Crypto)');
    expect(out).not.toMatch(/BTC-USD.*%/);
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Momentum:');
  });

  it('renders a "locked until" segment when cooldown is active', () => {
    const future = '2026-05-05T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'PLTR',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: -1.2,
        price: 38.5,
        cooldownActive: true,
        cooldownUntil: future,
      }],
    });

    expect(out).toContain('PLTR (stock, Technology) — -1.2%');
    expect(out).toContain(`locked until ${future}`);
  });

  it('does not render "locked until" when cooldownActive is false (even if cooldownUntil set)', () => {
    const past = '2026-04-01T15:00:00.000Z';
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'AMD',
        assetClass: 'stock',
        sector: 'Technology',
        changePercent: 0.5,
        price: 150,
        cooldownActive: false,
        cooldownUntil: past,
      }],
    });
    expect(out).not.toContain('locked until');
  });

  it('omits Trend: / Momentum: lines when fields are missing', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [{
        symbol: 'XYZ',
        assetClass: 'stock',
        sector: 'Unknown',
        changePercent: 1.0,
        price: 10,
        cooldownActive: false,
        cooldownUntil: null,
      }],
    });

    expect(out).toContain('XYZ (stock, Unknown) — +1%');
    expect(out).not.toContain('Trend:');
    expect(out).not.toContain('Momentum:');
  });

  it('renders multiple briefs separated by blank lines', () => {
    const out = buildBenchBriefsBlock({
      benchBriefs: [
        { symbol: 'AMD', assetClass: 'stock', sector: 'Technology', changePercent: 1, price: 150, cooldownActive: false, cooldownUntil: null },
        { symbol: 'BTC-USD', assetClass: 'crypto', sector: 'Crypto', changePercent: null, price: null, cooldownActive: false, cooldownUntil: null },
      ],
    });
    expect(out.split('\n\n').length).toBeGreaterThanOrEqual(2);
    expect(out).toContain('AMD');
    expect(out).toContain('BTC-USD');
  });
});

// ==================== MARKET SNAPSHOT CONTEXT — SECTOR RS RENDERING ====================

// Tier 0 Item 5: rendering tests for the three sector-RS lines added under the
// existing `Breadth:` line in the MARKET RIGHT NOW block.

function fullMarketContextCache(overrides = {}) {
  return {
    marketContext: {
      regime: 'bull',
      regimeDetail: 'SPY above 50-day MA. Strong uptrend.',
      spyChange: 0.41,
      vixLevel: null,
      volatilityRegime: 'normal',
      breadthTier: 'moderate',
      breadthDetail: 'SPY +0.41% but RSP -0.19% — rally driven by mega-caps.',
      topSector: 'Technology',
      topSectorChange: 1.49,
      worstSector: 'Energy',
      worstSectorChange: -1.34,
      yieldRegime: 'neutral',
      leadershipSignal: 'tech_leads',
      divergenceSignal: 'rotation',
      breadthQualitySignal: 'narrow_leadership',
      breadthSpyVsRspGap: 0.6,
      ...overrides,
    },
  };
}

describe('buildMarketSnapshotContext — sector RS rendering', () => {
  it('renders all three new lines with expected format and order on full data', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    expect(out).toContain('Breadth quality: narrow_leadership (SPY vs RSP: +0.6%)');
    expect(out).toContain('Leadership: tech_leads');
    expect(out).toContain('Divergence: rotation');
  });

  it('omits the Divergence line when divergenceSignal === "none"', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ divergenceSignal: 'none' }));
    expect(out).not.toContain('Divergence:');
    expect(out).toContain('Leadership: tech_leads');
  });

  it('renders the Divergence line for any non-"none" signal', () => {
    for (const sig of ['rotation', 'narrow_participation', 'small_cap_momentum']) {
      const out = buildMarketSnapshotContext(fullMarketContextCache({ divergenceSignal: sig }));
      expect(out).toContain(`Divergence: ${sig}`);
    }
  });

  it('omits the Breadth quality line when breadthQualitySignal is null', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({
      breadthQualitySignal: null,
      breadthSpyVsRspGap: null,
    }));
    expect(out).not.toContain('Breadth quality:');
    expect(out).toContain('Leadership: tech_leads');
  });

  it('omits the SPY vs RSP parenthetical when breadthSpyVsRspGap is null', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({
      breadthQualitySignal: 'narrow_leadership',
      breadthSpyVsRspGap: null,
    }));
    expect(out).toContain('Breadth quality: narrow_leadership');
    expect(out).not.toContain('SPY vs RSP:');
  });

  it('renders breadthSpyVsRspGap with + sign for positive values', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: 0.6 }));
    expect(out).toContain('SPY vs RSP: +0.6%');
  });

  it('renders breadthSpyVsRspGap with - sign for negative values', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: -0.4 }));
    expect(out).toContain('SPY vs RSP: -0.4%');
  });

  it('renders breadthSpyVsRspGap of 0 as "0.0"', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ breadthSpyVsRspGap: 0 }));
    expect(out).toContain('SPY vs RSP: 0.0%');
  });

  it('places new lines immediately after Breadth: and before Sector leaders:', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    const lines = out.split('\n');
    const breadthIdx = lines.findIndex(l => l.startsWith('Breadth:'));
    const breadthQualityIdx = lines.findIndex(l => l.startsWith('Breadth quality:'));
    const leadershipIdx = lines.findIndex(l => l.startsWith('Leadership:'));
    const divergenceIdx = lines.findIndex(l => l.startsWith('Divergence:'));
    const sectorLeadersIdx = lines.findIndex(l => l.startsWith('Sector leaders:'));

    expect(breadthIdx).toBeGreaterThan(-1);
    expect(breadthQualityIdx).toBe(breadthIdx + 1);
    expect(leadershipIdx).toBe(breadthQualityIdx + 1);
    expect(divergenceIdx).toBe(leadershipIdx + 1);
    expect(sectorLeadersIdx).toBe(divergenceIdx + 1);
  });

  it('always renders the Leadership line (defaults to "mixed" when signal absent)', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache({ leadershipSignal: undefined }));
    expect(out).toContain('Leadership: mixed');
  });

  it('regression guard: existing lines (Regime/SPY/Breadth/Sector/Yields) unchanged', () => {
    const out = buildMarketSnapshotContext(fullMarketContextCache());
    expect(out).toContain('MARKET RIGHT NOW:');
    expect(out).toContain('Regime: bull — SPY above 50-day MA. Strong uptrend.');
    expect(out).toContain('SPY: +0.41% | Volatility: normal');
    expect(out).toContain('Breadth: moderate — SPY +0.41% but RSP -0.19% — rally driven by mega-caps.');
    expect(out).toContain('Sector leaders: Technology (+1.49%)');
    expect(out).toContain('Sector laggards: Energy (-1.34%)');
    expect(out).toContain('Yields: neutral');
  });

  it('returns null when marketSnapshot has no marketContext', () => {
    expect(buildMarketSnapshotContext(null)).toBeNull();
    expect(buildMarketSnapshotContext({})).toBeNull();
  });
});
