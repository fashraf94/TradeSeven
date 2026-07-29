// api/_utils/fundamentalsRender.flagOn.test.js
//
// Fundamental Wire Commit 2 — flag ON: rendering behavior, the on-state file
// goldens, and the fenced integration through the real assemblers.
// (evalIdentityBlocks.flagOn.test.js precedent — the sibling
// fundamentalsRender.test.js keeps the flags module REAL and is the
// BUILD_RULES §4 dependency-surface guard, so this file may mock it.)
//
// Flag-off inertness is asserted here via call-time flips — and since the
// Jul 25 2026 flip (`c45f936c`) this file is the ONLY place that covers it:
// the real-flag sibling can no longer reach the off state, and it may not
// mock the flags module (it is the BUILD_RULES §4 dependency-surface guard).
// The P4 battery's real-flag file snapshots are now the ON-state texts of
// record, not the off-state lock; no off-state prompt text is snapshotted
// anywhere, by design — inertness is asserted as equivalence, not as bytes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { flagState } = vi.hoisted(() => ({ flagState: { mirror: true } }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FUNDAMENTAL_MIRROR_ENABLED() {
    return flagState.mirror;
  },
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const {
  draftFundamentalsHeaderSuffix,
  draftFundamentalsNamesSuffix,
  renderDraftFundamentalsCells,
  buildFundamentalsBlock,
} = await import('./fundamentalsRender.js');
const { formatMarketCSV, buildStrategySystemPrompt } = await import('./agentPromptAssembly.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
const { buildBoardSystemPrompt } = await import('./tournamentAgentBoards.js');
const { makeEvalBattle } = await import('./__fixtures__/controlsPromptFixtures.js');
// F2: the shared C-20 signal lists — same fixture the honesty sweep reads.
const { FORBIDDEN_SIGNALS } = await import('./__fixtures__/promptHonestyRegistry.js');

const FRESH_MS = Date.parse('2026-07-24T11:01:00Z');
const STALE_MS = Date.parse('2026-07-23T11:01:00Z');

const fullFundamentals = () => ({
  trailingPE: { value: 42.1, sectorMedian: 28 },
  priceBookMRQ: 8.3,
  revenueGrowthPct: 11.6,
  marketCapClass: 'large',
  earningsRevisions30d: 2.1,
  beatRate: 75,
  surpriseMagPercentile: 82,
  computedAt: FRESH_MS,
});

const RANKINGS = {
  NVDA: {
    symbol: 'NVDA', sectorName: 'Technology',
    industryName: 'Semiconductors & Semiconductor Equipment',
    fundamentals: fullFundamentals(),
  },
  // Stale vintage + beatRate ABSENT (D2 suppression upstream) + no median.
  JPM: {
    symbol: 'JPM', sectorName: 'Financials', industryName: 'Banks',
    fundamentals: {
      trailingPE: { value: 12.4 },
      priceBookMRQ: 1.9,
      revenueGrowthPct: -4.2,
      marketCapClass: 'large',
      computedAt: STALE_MS,
    },
  },
  // Ranking entry exists, mirror absent (peerRankings drop-out) — the
  // industry header still renders for r-07; the line says so honestly.
  KO: { symbol: 'KO', sectorName: 'Consumer Staples', industryName: 'Beverages' },
};

function battleWithBench(symbols) {
  const battle = makeEvalBattle();
  battle.portfolio.bench = {
    stocks: symbols.map((symbol) => ({ symbol, name: symbol, baseATR: 2.5 })),
    crypto: { symbol: 'BTC', isCrypto: true, name: 'Bitcoin' },
  };
  return battle;
}

beforeEach(() => {
  flagState.mirror = true;
});

describe('draft/board suffix helpers (D4: hard cap 3, one suffix source for all five label sites)', () => {
  it('emits the 3-column vocabulary, and flips inert at call time', () => {
    expect(draftFundamentalsHeaderSuffix()).toBe('|PE_VS_SECT|REVG_PCT|MCAP_CLS');
    expect(draftFundamentalsNamesSuffix()).toBe('/PE_VS_SECT/REVG_PCT/MCAP_CLS');
    flagState.mirror = false;
    expect(draftFundamentalsHeaderSuffix()).toBe('');
    expect(draftFundamentalsNamesSuffix()).toBe('');
  });
});

describe('renderDraftFundamentalsCells — derived forms, "-" null token, never a default', () => {
  it('full data → ratio-vs-sector, stored growth, class initial', () => {
    // 42.1 / 28 = 1.5035… → 2dp ratio carries the comparison basis in one number.
    expect(renderDraftFundamentalsCells({ fundamentals: fullFundamentals() })).toBe('|1.50|11.6|L');
  });

  it('missing pieces render "-" per cell — absent is absent', () => {
    expect(renderDraftFundamentalsCells({})).toBe('|-|-|-');
    expect(renderDraftFundamentalsCells({ fundamentals: {} })).toBe('|-|-|-');
    // Value without a median cannot claim a sector comparison.
    expect(renderDraftFundamentalsCells({ fundamentals: { trailingPE: { value: 12.4 } } })).toBe('|-|-|-');
    expect(renderDraftFundamentalsCells({
      fundamentals: { revenueGrowthPct: -4.2, marketCapClass: 'small' },
    })).toBe('|-|-4.2|S');
    expect(renderDraftFundamentalsCells({ fundamentals: { marketCapClass: 'mid' } })).toBe('|-|-|M');
  });

  it('a zero survives (0% growth is a report, not an absence)', () => {
    expect(renderDraftFundamentalsCells({ fundamentals: { revenueGrowthPct: 0 } })).toBe('|-|0.0|-');
  });
});

describe('fenced integration — the CSV and both labels light together', () => {
  const stock = {
    symbol: 'NVDA', sectorName: 'Technology', fundamentalScore: 90,
    technicalScore: 88, baggerBombFit: 95, atrPercentile: 0.81,
    archetypeScore: 9.1, fundamentals: fullFundamentals(),
  };
  const bare = { symbol: 'ZZZZ' };

  it('formatMarketCSV appends header columns and per-row cells; bare rows degrade to "-"', async () => {
    const csv = formatMarketCSV([stock, bare]);
    expect(csv).toBe(
      'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS\n'
      + 'NVDA|Technology|90|88|95|0.81|9.1|1.50|11.6|L\n'
      + 'ZZZZ|Unknown|-|-|-|-|-|-|-|-'
    );
    await expect(csv).toMatchFileSnapshot('./__fundwire_snapshots__/marketCSV.mirrorOn.snap.txt');
  });

  it('strategy + board labels carry the same vocabulary as the header (§9 single source)', () => {
    expect(buildStrategySystemPrompt('CSV', null, null))
      .toContain('STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS):');
    expect(buildBoardSystemPrompt('CSV', null))
      .toContain('STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH|PE_VS_SECT|REVG_PCT|MCAP_CLS):');
  });

  it('the two "-"-convention prose sentences enumerate the new names', () => {
    // buildStrategyUserPrompt's equipped-watchlist lines and the portfolio
    // prompt's equippedNote both render through draftFundamentalsNamesSuffix —
    // asserted at the helper level above; here we pin the joined vocabulary
    // string the model actually reads.
    expect(`FUND/TECH/BB_FIT/ATR/ARCH${draftFundamentalsNamesSuffix()}`)
      .toBe('FUND/TECH/BB_FIT/ATR/ARCH/PE_VS_SECT/REVG_PCT/MCAP_CLS');
  });
});

describe('buildFundamentalsBlock — held + bench, honest staleness, r-07 industry header', () => {
  const held = [{ symbol: 'NVDA' }];
  const bench = battleWithBench(['JPM', 'KO', 'MISSING']).portfolio.bench;

  it('renders the full block (golden)', async () => {
    const block = buildFundamentalsBlock(held, bench, RANKINGS);
    await expect(block).toMatchFileSnapshot('./__fundwire_snapshots__/fundamentalsBlock.on.snap.txt');
  });

  it('structure: subheads, industry headers, per-metric fragments', () => {
    const block = buildFundamentalsBlock(held, bench, RANKINGS);
    expect(block).toContain('FUNDAMENTALS (held + bench; a missing metric is NOT REPORTED — never zero):');
    expect(block).toContain('HELD:');
    expect(block).toContain('BENCH:');
    expect(block).toContain('NVDA (Technology / Semiconductors & Semiconductor Equipment): PE=42.1 (sect med 28)');
    expect(block).toContain('beat rate=75%');
    expect(block).toContain('surprise pctl=82');
    // r-07 substrate: the industry renders for held AND candidates.
    expect(block).toContain('JPM (Financials / Banks):');
  });

  it('honest absences: suppressed beatRate never re-appears; a mirror-less symbol says so; unknown symbols and crypto are skipped', () => {
    const block = buildFundamentalsBlock(held, bench, RANKINGS);
    const jpmLine = block.split('\n').find((l) => l.startsWith('JPM'));
    expect(jpmLine).not.toContain('beat rate');       // D2 suppression upstream — never invented here
    expect(jpmLine).toContain('PE=12.4');             // value without median: no sect-med claim
    expect(jpmLine).not.toContain('sect med');
    expect(jpmLine).toContain('rev growth=-4.2%');
    expect(block).toContain('KO (Consumer Staples / Beverages): no fundamentals reported');
    expect(block).not.toContain('MISSING');           // no ranking entry — no placeholder row
    expect(block).not.toContain('BTC');               // crypto skipped
  });

  it('vintage: block header carries the newest day; only OLDER entries are marked', () => {
    const block = buildFundamentalsBlock(held, bench, RANKINGS);
    expect(block).toContain('Fundamentals data as of 07-24 (UTC); older entries are marked.');
    const jpmLine = block.split('\n').find((l) => l.startsWith('JPM'));
    const nvdaLine = block.split('\n').find((l) => l.startsWith('NVDA'));
    expect(jpmLine).toContain('as of 07-23');
    expect(nvdaLine).not.toContain('as of');
  });

  it('returns null when nothing renders, and flips inert at call time', () => {
    expect(buildFundamentalsBlock([], { stocks: [], crypto: null }, {})).toBeNull();
    expect(buildFundamentalsBlock([{ symbol: 'MISSING' }], { stocks: [], crypto: null }, RANKINGS)).toBeNull();
    flagState.mirror = false;
    expect(buildFundamentalsBlock(held, bench, RANKINGS)).toBeNull();
  });

  it('C-20 runtime sweep (F2): the RENDERED flag-on outputs name no forbidden signal', () => {
    // The source-level sweep in agentEvalPromptAssembly.honesty.test.js
    // guards the module text; this guards the assembled output — including
    // anything interpolated from doc data — on every on-state surface.
    const rendered = [
      buildFundamentalsBlock(held, bench, RANKINGS),
      formatMarketCSV([{ symbol: 'NVDA', sectorName: 'Technology', fundamentals: fullFundamentals() }]),
      draftFundamentalsHeaderSuffix(),
    ];
    for (const text of rendered) {
      for (const [label, re] of FORBIDDEN_SIGNALS) {
        expect(re.test(text), `${label} leaked into a flag-on render`).toBe(false);
      }
    }
  });
});

describe('live-context integration through the real fenced assembler', () => {
  // Full flattened-score shape (buildPortfolioCSV reads badges/multiplier/
  // priceChange/baseATR unconditionally).
  const heldScore = { symbol: 'NVDA', badges: [], priceChange: 1.2, multiplier: 0.4, baseATR: 3.0 };

  it('the block renders after the bench sections and before trigger/decision context', async () => {
    const battle = battleWithBench(['JPM', 'KO']);
    const out = await buildLiveContextBlock(
      battle, {}, {}, [heldScore], [], [], [],
      { vwap: {}, riskStatus: null, rankingsMap: RANKINGS }, null,
    );
    const benchIdx = out.indexOf('BENCH (available for swap):');
    const fundIdx = out.indexOf('FUNDAMENTALS (held + bench');
    expect(benchIdx).toBeGreaterThan(-1);
    expect(fundIdx).toBeGreaterThan(benchIdx);
    expect(out).toContain('NVDA (Technology / Semiconductors & Semiconductor Equipment): PE=42.1 (sect med 28)');
  });

  it('flag-off through the same assembler: byte-identical to a mirror-less doc (inertness, not a new snapshot)', async () => {
    flagState.mirror = false;
    const battle = battleWithBench(['JPM', 'KO']);
    const args = (map) => [battle, {}, {}, [heldScore], [], [], [], { vwap: {}, riskStatus: null, rankingsMap: map }, null];
    const withF = await buildLiveContextBlock(...args(RANKINGS));
    const strippedMap = Object.fromEntries(
      Object.entries(RANKINGS).map(([k, { fundamentals, ...rest }]) => [k, rest]),
    );
    const withoutF = await buildLiveContextBlock(...args(strippedMap));
    expect(withF).toBe(withoutF);
    expect(withF).not.toContain('FUNDAMENTALS (');
  });
});
