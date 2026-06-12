// api/_utils/p4Equivalence.battery.test.js
//
// P4 — THE FENCE ENTRY, Commit 1: the tiered-mode equivalence battery
// (founder-approved Fence-Edit Map §10; June 10 discovery P6.2 enumeration).
//
// THIS COMMIT CONTAINS ZERO FENCE EDITS. The battery PHOTOGRAPHS today's
// tiered-mode behavior against the untouched fence code, so every subsequent
// P4 slice can prove the governing invariant: tiered-mode behavior is
// byte-identical before and after the fence entry. It must be green at every
// P4 commit, no exceptions.
//
// What it photographs:
//   1. Cross-copy scoring-constants equality (canonical src vs server mirror)
//      — the contract-#7 collapse precondition AND its postcondition.
//   2. calculateAssetScoreServer over the full P6.2 grid (long/short × tier ×
//      badge-history × thresholdPriceChange-vs-fallback × extremes), asserted
//      EQUAL to canonical calculateAssetScoreV3 case-by-case and value-
//      snapshotted (file snapshot) — closes the audit's coverage gap (the
//      consistency test covered only detectRedZone/isSwapLocked).
//   3. flattenPortfolioServer / flattenBenchServer parity with the canonical
//      client flatten (tier/allocation/slotIndex attach, null-slot handling).
//   4. Prompt-text photographs: GAME RULES / TIER RULES / eval SCORING RULES
//      verbatim inline + full-output file snapshots on fixed inputs.
//   5. createAgentBattle battle-doc photograph (fake clock + capture db):
//      inline asserts on the load-bearing fields (gameMode literal, the
//      written-never-read scoring snapshot, no groupId/isCpu keys) + full-doc
//      file snapshot.
//   6. Source tripwires for decide.js's module-private portfolio functions
//      (validatePortfolio / enrichPortfolio / buildFallbackPortfolio) — not
//      exported today, so Commit 1 photographs their SOURCE (the sanitizer-
//      tripwire extraction pattern); the slice that adds `export` updates
//      these to behavioral photographs in the same commit.
//   7. PORTFOLIO_TOOL schema photograph (counts inline + full file snapshot).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the imports of
// src/utils/baggerBombUtils.js and src/constants/baggerBombScoring.js below
// ARE the runtime guard for the api→src import surface this phase ratifies —
// they explode in the Node test env if a browser-only dep ever enters that
// graph. NEVER mock them.
//
// Timezone note: the createAgentBattle expiry photograph assumes a UTC test
// environment (TZ pinned below), matching Vercel production.

process.env.TZ = 'UTC';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONVICTION_MULTIPLIERS as serverConviction,
  THRESHOLD_POINTS as serverPoints,
  THRESHOLD_MULTIPLIERS as serverMultipliers,
  calculateAssetScoreServer,
  flattenPortfolioServer,
  flattenBenchServer,
} from './agentScoring.js';
import {
  CONVICTION_MULTIPLIERS as canonicalConviction,
  THRESHOLD_POINTS as canonicalPoints,
  THRESHOLD_MULTIPLIERS as canonicalMultipliers,
} from '../../src/constants/baggerBombScoring.js';
import {
  calculateAssetScoreV3,
  flattenPortfolio,
  flattenBench,
} from '../../src/utils/baggerBombUtils.js';
import { buildStrategySystemPrompt, buildPortfolioSystemPrompt } from './agentPromptAssembly.js';
import { buildEvalSystemPrompt } from './agentEvalPromptAssembly.js';
import { createAgentBattle } from './agentBattleService.js';
import { PORTFOLIO_TOOL, STRATEGY_TOOL } from './agentToolSchema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// ==================== 1. CONSTANTS — cross-copy equality ====================

describe('P4 battery — scoring constants, canonical vs server mirror', () => {
  it('CONVICTION_MULTIPLIERS are value-identical and carry today\'s tiered values', () => {
    expect(serverConviction).toEqual(canonicalConviction);
    expect(serverConviction).toEqual({ star: 2.0, core: 1.5, support: 1.0 });
  });

  it('THRESHOLD_POINTS are value-identical and carry the canonical asymmetric values', () => {
    expect(serverPoints).toEqual(canonicalPoints);
    expect(serverPoints).toEqual({
      bagger: 15, doubleBagger: 30, tenBagger: 50,
      bust: -10, crash: -20, meltdown: -35,
    });
  });

  it('THRESHOLD_MULTIPLIERS are value-identical and carry the canonical breakpoints', () => {
    expect(serverMultipliers).toEqual(canonicalMultipliers);
    expect(serverMultipliers).toEqual({
      bagger: 1.0, doubleBagger: 1.5, tenBagger: 2.0,
      bust: -1.0, crash: -1.5, meltdown: -2.0,
    });
  });

  it('the battle-doc scoring snapshot values written by createAgentBattle match canonical (asserted in §5 photograph)', () => {
    // Cross-referenced in the doc photograph below; this line records the link.
    expect(true).toBe(true);
  });
});

// ==================== 2. calculateAssetScoreServer — the P6.2 grid ====================

const GRID_DIRECTIONS = [undefined, 'short'];
const GRID_TIERS = ['star', 'core', 'support', undefined]; // undefined → verified support fallback
const GRID_HISTORIES = [
  {},
  { maxMultiplier: 1.6, minMultiplier: 0 },     // badge-laden upside history
  { maxMultiplier: 0, minMultiplier: -1.2 },    // bust-laden downside history
];
const GRID_THRESHOLD_ARMS = [null, 4.1];        // fallback arm vs previousClose arm
const GRID_EXTREMES = [{}, { highChange: 6.0, lowChange: -2.6 }];
const GRID_PRICE_CHANGES = [3.2, -4.5];
const GRID_BASE_ATR = 2.5;

function buildGrid() {
  const cases = [];
  for (const direction of GRID_DIRECTIONS) {
    for (const tier of GRID_TIERS) {
      for (const history of GRID_HISTORIES) {
        for (const thresholdPriceChange of GRID_THRESHOLD_ARMS) {
          for (const extremes of GRID_EXTREMES) {
            for (const priceChange of GRID_PRICE_CHANGES) {
              cases.push({
                label: `dir=${direction ?? 'long'} tier=${tier ?? 'none'} hist=${JSON.stringify(history)} tpc=${thresholdPriceChange} ext=${JSON.stringify(extremes)} pc=${priceChange}`,
                asset: { symbol: 'TEST', baseATR: GRID_BASE_ATR, tier, direction },
                priceChange,
                history,
                extremes,
                thresholdPriceChange,
              });
            }
          }
        }
      }
    }
  }
  return cases;
}

describe('P4 battery — calculateAssetScoreServer vs canonical calculateAssetScoreV3 (full grid)', () => {
  const grid = buildGrid();

  it(`covers the P6.2 enumeration (${grid.length} cases: 2 directions × 4 tiers × 3 histories × 2 baseline arms × 2 extremes × 2 price moves)`, () => {
    expect(grid.length).toBe(192);
  });

  it('server and canonical scorer agree on every grid case', () => {
    for (const c of grid) {
      // Fresh copies per call — both scorers may reassign their params.
      const server = calculateAssetScoreServer(
        { ...c.asset }, c.priceChange, { ...c.history }, { ...c.extremes }, c.thresholdPriceChange
      );
      const canonical = calculateAssetScoreV3(
        { ...c.asset }, c.priceChange, { ...c.history }, { ...c.extremes }, c.thresholdPriceChange
      );
      expect(server, c.label).toEqual(canonical);
    }
  });

  it('invalid priceChange arms (null / NaN / Infinity) agree and zero out, preserving the tier multiplier echo', () => {
    for (const bad of [null, NaN, Infinity]) {
      for (const tier of GRID_TIERS) {
        const asset = { symbol: 'TEST', baseATR: GRID_BASE_ATR, tier };
        const server = calculateAssetScoreServer({ ...asset }, bad, {}, {}, null);
        const canonical = calculateAssetScoreV3({ ...asset }, bad, {}, {}, null);
        expect(server).toEqual(canonical);
        expect(server.totalPoints).toBe(0);
        expect(server.tierMultiplier).toBe(serverConviction[tier] || serverConviction.support);
      }
    }
  });

  it('value photograph: the server scorer\'s full grid output is frozen', async () => {
    const results = grid.map(c => ({
      label: c.label,
      result: calculateAssetScoreServer(
        { ...c.asset }, c.priceChange, { ...c.history }, { ...c.extremes }, c.thresholdPriceChange
      ),
    }));
    await expect(JSON.stringify(results, null, 1)).toMatchFileSnapshot(
      './__p4_snapshots__/calculateAssetScoreServer.grid.snap.json'
    );
  });
});

// ==================== 2b. D2 per-asset tierMultiplier override (P4 slice i) ====================

describe('P4 battery — per-asset tierMultiplier override (flat6 mechanism, D2)', () => {
  it('an explicit tierMultiplier: 1 yields flat scoring on every tier, identically in both scorers', () => {
    for (const tier of GRID_TIERS) {
      const asset = { symbol: 'TEST', baseATR: GRID_BASE_ATR, tier, tierMultiplier: 1 };
      const server = calculateAssetScoreServer({ ...asset }, 3.2, {}, {}, null);
      const canonical = calculateAssetScoreV3({ ...asset }, 3.2, {}, {}, null);
      expect(server).toEqual(canonical);
      expect(server.tierMultiplier).toBe(1);
      expect(server.basePoints).toBe(Math.round(3.2 * 10 * 1));
    }
  });

  it('the override echoes through the invalid-priceChange guard arm in both scorers', () => {
    const asset = { symbol: 'TEST', baseATR: GRID_BASE_ATR, tier: 'star', tierMultiplier: 1 };
    const server = calculateAssetScoreServer({ ...asset }, NaN, {}, {}, null);
    const canonical = calculateAssetScoreV3({ ...asset }, NaN, {}, {}, null);
    expect(server).toEqual(canonical);
    expect(server.tierMultiplier).toBe(1);
    expect(server.totalPoints).toBe(0);
  });

  it('absence of the override resolves to the tier lookup exactly as photographed (tiered invariant)', () => {
    // The same case appears in the frozen grid snapshot; this pins the
    // override\'s negative space explicitly.
    const star = calculateAssetScoreServer({ symbol: 'TEST', baseATR: GRID_BASE_ATR, tier: 'star' }, 3.2, {}, {}, null);
    expect(star.tierMultiplier).toBe(2.0);
    expect(star.basePoints).toBe(Math.round(3.2 * 10 * 2.0));
    const none = calculateAssetScoreServer({ symbol: 'TEST', baseATR: GRID_BASE_ATR }, 3.2, {}, {}, null);
    expect(none.tierMultiplier).toBe(1.0);
  });

  it('bonus points are never scaled by the override (flat badges, both scorers)', () => {
    const asset = { symbol: 'TEST', baseATR: 2.5, tier: 'star', tierMultiplier: 1 };
    // +2.0x ATR move: bagger+doubleBagger+tenBagger = 15+30+50 = 95 flat.
    const server = calculateAssetScoreServer({ ...asset }, 5.0, {}, {}, null);
    const canonical = calculateAssetScoreV3({ ...asset }, 5.0, {}, {}, null);
    expect(server).toEqual(canonical);
    expect(server.bonusPoints).toBe(95);
    expect(server.basePoints).toBe(50); // 5.0% × 10 × 1
  });
});

// ==================== 3. Flatten parity ====================

const FLATTEN_FIXTURE_PORTFOLIO = {
  star: [
    { symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false },
    { symbol: 'TSLA', name: 'Tesla', baseATR: 4.0, isCrypto: false },
  ],
  core: [
    { symbol: 'MSFT', name: 'Microsoft', baseATR: 1.9, isCrypto: false },
    null, // null slot — both flatteners must skip it identically
  ],
  support: [
    { symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false },
    { symbol: 'PG', name: 'P&G', baseATR: 1.0, isCrypto: false },
    { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true },
  ],
};

const FLATTEN_FIXTURE_BENCH = {
  stocks: [
    { symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false },
    null,
    { symbol: 'JPM', name: 'JPMorgan', baseATR: 1.6, isCrypto: false },
  ],
  crypto: { symbol: 'ETH', name: 'Ethereum', baseATR: 5, isCrypto: true },
};

describe('P4 battery — flatten parity, server vs canonical client', () => {
  it('flattenPortfolioServer matches client flattenPortfolio (tier/allocation/slotIndex attach, null-skip)', () => {
    const server = flattenPortfolioServer(FLATTEN_FIXTURE_PORTFOLIO);
    const client = flattenPortfolio(FLATTEN_FIXTURE_PORTFOLIO);
    expect(server).toEqual(client);
    // Photograph the attach values directly: today's tiered allocations.
    expect(server.map(a => [a.symbol, a.tier, a.allocation, a.slotIndex])).toEqual([
      ['NVDA', 'star', 20, 0],
      ['TSLA', 'star', 20, 1],
      ['MSFT', 'core', 15, 0],
      ['KO', 'support', 10, 0],
      ['PG', 'support', 10, 1],
      ['BTC', 'support', 10, 2],
    ]);
  });

  it('flattenPortfolioServer on null/empty input returns []', () => {
    expect(flattenPortfolioServer(null)).toEqual([]);
    expect(flattenPortfolioServer({})).toEqual([]);
    expect(flattenPortfolio(null)).toEqual([]);
  });

  it('flattenBenchServer matches client flattenBench (benchType attach, null-skip)', () => {
    const server = flattenBenchServer(FLATTEN_FIXTURE_BENCH);
    const client = flattenBench(FLATTEN_FIXTURE_BENCH);
    expect(server).toEqual(client);
    expect(server.map(a => [a.symbol, a.benchType])).toEqual([
      ['AMD', 'stock'],
      ['JPM', 'stock'],
      ['ETH', 'crypto'],
    ]);
  });
});

// ==================== 4. Prompt-text photographs ====================

const PROMPT_MARKET_CSV = 'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH\nNVDA|Technology|90|88|95|0.81|9.1';
const PROMPT_STORIES = '1. [Reporter/beat] "Headline" (2h ago)';
const PROMPT_BRIEF = 'Lean into semis momentum; fade defensives.';
const PROMPT_SHORTLIST_CSV = PROMPT_MARKET_CSV;
const PROMPT_CRYPTO_LIST = 'BTC (Bitcoin, ATR ~5%)\nETH (Ethereum, ATR ~5%)';

// The GAME RULES block — agentPromptAssembly.js buildStrategySystemPrompt,
// captured VERBATIM (tiered text of record; flat6 must never alter this).
const GAME_RULES_VERBATIM = `GAME RULES:
- Portfolio tiers: Star (2 stocks, 2x multiplier), Core (2 stocks, 1.5x), Support (2 stocks + 1 crypto, 1x)
- Bench: 3 stocks + 1 crypto (swap reserves)
- Scoring: priceChange × 10 × tierMultiplier + threshold bonuses
- Star amplifies gains AND losses — only put high-conviction plays here
- BaggerBomb bonuses: +15 (1x ATR), +30 (1.5x ATR), +50 (2x ATR)
- Bust penalties: -10 (1x ATR), -20 (1.5x ATR), -35 (2x ATR)`;

// The TIER RULES block — buildPortfolioSystemPrompt, captured VERBATIM.
const TIER_RULES_VERBATIM = `TIER RULES:
- star: exactly 2 stocks (2x multiplier — highest conviction plays)
- core: exactly 2 stocks (1.5x multiplier — balanced picks)
- support_stocks: exactly 2 stocks (1x multiplier — foundation/stability)
- support_crypto: exactly 1 crypto from the available list
- bench_stocks: exactly 3 stocks (swap reserves that hedge your active picks)
- bench_crypto: exactly 1 crypto (different from support crypto)`;

// The eval-side SCORING RULES block — buildEvalSystemPrompt, captured VERBATIM.
const EVAL_SCORING_RULES_VERBATIM = `━━━ SCORING RULES ━━━

Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10 × tierMultiplier
Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x`;

// The eval-side TIER IMPACT framing — captured VERBATIM.
const EVAL_TIER_IMPACT_VERBATIM = `5. TIER IMPACT AWARENESS:
   - Star swaps affect score at 2.0x — high reward but high cost if wrong.
   - Support swaps are low-impact (1.0x) — safer to experiment.
   - Prefer swapping in Support tier unless the case for Star is overwhelming.`;

describe('P4 battery — tiered prompt text photographed verbatim', () => {
  it('buildStrategySystemPrompt carries the GAME RULES block byte-for-byte (no-archetype arm)', async () => {
    const out = buildStrategySystemPrompt(PROMPT_MARKET_CSV, PROMPT_STORIES, undefined);
    expect(out).toContain(GAME_RULES_VERBATIM);
    await expect(out).toMatchFileSnapshot('./__p4_snapshots__/buildStrategySystemPrompt.noArchetype.snap.txt');
  });

  it('buildStrategySystemPrompt carries the GAME RULES block byte-for-byte (archetype arm)', async () => {
    const out = buildStrategySystemPrompt(PROMPT_MARKET_CSV, PROMPT_STORIES, 'momentum_chaser');
    expect(out).toContain(GAME_RULES_VERBATIM);
    await expect(out).toMatchFileSnapshot('./__p4_snapshots__/buildStrategySystemPrompt.momentumChaser.snap.txt');
  });

  it('buildStrategySystemPrompt null-stories arm renders the fallback line unchanged', () => {
    const out = buildStrategySystemPrompt(PROMPT_MARKET_CSV, null, undefined);
    expect(out).toContain('No recent stories available.');
  });

  it('buildPortfolioSystemPrompt carries the TIER RULES block byte-for-byte', async () => {
    const out = buildPortfolioSystemPrompt(PROMPT_BRIEF, PROMPT_SHORTLIST_CSV, PROMPT_CRYPTO_LIST, '', null);
    expect(out).toContain(TIER_RULES_VERBATIM);
    await expect(out).toMatchFileSnapshot('./__p4_snapshots__/buildPortfolioSystemPrompt.snap.txt');
  });

  it('buildEvalSystemPrompt carries the SCORING RULES and TIER IMPACT blocks byte-for-byte', async () => {
    const out = buildEvalSystemPrompt('TestAgent', 'analyst');
    expect(out).toContain(EVAL_SCORING_RULES_VERBATIM);
    expect(out).toContain(EVAL_TIER_IMPACT_VERBATIM);
    await expect(out).toMatchFileSnapshot('./__p4_snapshots__/buildEvalSystemPrompt.analyst.snap.txt');
  });
});

// ==================== 5. createAgentBattle — battle-doc photograph ====================

const FROZEN_NOW = new Date('2026-06-10T14:00:00Z'); // Wed June 10 2026, 10:00 ET — market open, EDT

function makeCaptureDb() {
  const captured = { doc: null };
  const db = {
    collection: (name) => ({
      add: async (doc) => {
        captured.doc = doc;
        captured.collection = name;
        return { id: 'battle-photo-1' };
      },
    }),
  };
  return { db, captured };
}

const PHOTO_AGENT = {
  id: 'agent-photo-1',
  ownerId: 'user-photo-1',
  name: 'Photo Agent',
  archetype: 'analyst',
  config: { risk: 60 },
  activeRules: [{ id: 'r1', text: 'Stay diversified', category: 'risk' }],
  equippedBundleIds: ['b1'],
  consolidatedInsight: 'Patience pays.',
  deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 5 }] },
  lastDecision: {
    portfolio: FLATTEN_FIXTURE_PORTFOLIO,
    bench: FLATTEN_FIXTURE_BENCH,
    innerMonologue: { strategy: 'Photograph strategy.' },
    strategyBrief: 'Photograph brief.',
    shortlist: ['NVDA', 'TSLA', 'MSFT'],
    watchlist: { active: ['NVDA'], hotBench: ['AMD'], monitoring: [], lastRefreshed: '2026-06-10T13:00:00.000Z', totalStocks: 2 },
  },
};

const PHOTO_THRESHOLDS = {
  NVDA: { threshold: 3.1, rallyThreshold: 4.65, moonshotThreshold: 6.2 },
  BTC: { threshold: 5, rallyThreshold: 7.5, moonshotThreshold: 10 },
};
const PHOTO_PRICES = { NVDA: 120.5, TSLA: 250.1, MSFT: 410.0, KO: 62.2, PG: 165.3, BTC: 67000, AMD: 160.4, JPM: 199.9, ETH: 3500 };
const PHOTO_SECTORS = { NVDA: 'Technology', TSLA: 'Consumer Cyclical', MSFT: 'Technology', KO: 'Consumer Defensive', PG: 'Consumer Defensive', AMD: 'Technology', JPM: 'Financial Services' };

describe('P4 battery — createAgentBattle battle-doc photograph (fake clock, capture db)', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  async function photograph() {
    const { db, captured } = makeCaptureDb();
    const result = await createAgentBattle(db, PHOTO_AGENT, PHOTO_THRESHOLDS, PHOTO_PRICES, {
      duration: '1d',
      sectorMap: PHOTO_SECTORS,
      opponent: { portfolio: { star: [], core: [], support: [] }, bench: { stocks: [], crypto: null }, username: 'CPU Opponent', odUserId: 'cpu' },
      equippedWatchlist: null,
    });
    return { result, captured };
  }

  it('writes to agentBattles with today\'s load-bearing fields exactly', async () => {
    const { result, captured } = await photograph();
    const doc = captured.doc;

    expect(captured.collection).toBe('agentBattles');
    expect(result).toEqual({ id: 'battle-photo-1', expiresAt: '2026-06-11T00:00:00.000Z' });

    // The hardcoded mode of record — P4's createAgentBattle slice must keep
    // this default EXACTLY for non-tournament callers.
    expect(doc.gameMode).toBe('baggerbomb_agent');
    // No tournament fields exist on a tiered doc — the joint-stamp contract's
    // negative space.
    expect('groupId' in doc).toBe(false);
    expect('isCpu' in doc).toBe(false);

    // The written-never-read scoring snapshot — today's exact values.
    expect(doc.scoring.tierMultipliers).toEqual({ star: 2.0, core: 1.5, support: 1.0 });
    expect(doc.scoring.pointValues).toEqual({
      bagger: 15, doubleBagger: 30, tenBagger: 50,
      bust: -10, crash: -20, meltdown: -35,
    });
    expect(doc.scoring.thresholds).toEqual(PHOTO_THRESHOLDS);

    // Crypto in support[2] drives the Night-Game close: 20:00 ET = 00:00Z EDT.
    expect(doc.expiresAt).toBe('2026-06-11T00:00:00.000Z');
    expect(doc.timing).toEqual({
      tradingDays: ['2026-06-10'],
      currentTradingDay: 1,
      timezone: 'America/New_York',
      localOpen: '09:30',
      localClose: '20:00',
      lastDailyResetAt: null,
    });

    // Sector attach + null-slot preservation in the portfolio copy.
    expect(doc.portfolio.star.map(a => [a.symbol, a.sector])).toEqual([
      ['NVDA', 'Technology'], ['TSLA', 'Consumer Cyclical'],
    ]);
    expect(doc.portfolio.core[1]).toBe(null);
    expect(doc.portfolio.support[2]).toMatchObject({ symbol: 'BTC', sector: 'Crypto', isCrypto: true });
    expect(doc.portfolio.startingPrices).toEqual(PHOTO_PRICES);

    // No per-asset tierMultiplier override exists on tiered docs (the D2
    // mechanism's negative space — flat6 docs will carry it; tiered never).
    const allAssets = [...doc.portfolio.star, ...doc.portfolio.core, ...doc.portfolio.support].filter(Boolean);
    for (const asset of allAssets) {
      expect('tierMultiplier' in asset).toBe(false);
    }

    expect(doc.status).toBe('active');
    expect(doc.duration).toBe('fullday');
    expect(doc.executionMode).toBe('autopilot');
  });

  it('full-doc photograph (file snapshot)', async () => {
    const { captured } = await photograph();
    await expect(JSON.stringify(captured.doc, null, 1)).toMatchFileSnapshot(
      './__p4_snapshots__/createAgentBattle.tieredDoc.snap.json'
    );
  });

  it('a no-crypto portfolio closes at 16:00 ET (the flat6 expiry path already exists)', async () => {
    const { db, captured } = makeCaptureDb();
    const noCryptoAgent = {
      ...PHOTO_AGENT,
      lastDecision: {
        ...PHOTO_AGENT.lastDecision,
        portfolio: {
          star: FLATTEN_FIXTURE_PORTFOLIO.star,
          core: [FLATTEN_FIXTURE_PORTFOLIO.core[0], { symbol: 'JPM', name: 'JPMorgan', baseATR: 1.6, isCrypto: false }],
          support: [FLATTEN_FIXTURE_PORTFOLIO.support[0], FLATTEN_FIXTURE_PORTFOLIO.support[1]],
        },
        bench: { stocks: [], crypto: null },
      },
    };
    await createAgentBattle(db, noCryptoAgent, {}, {}, { duration: '1d', sectorMap: PHOTO_SECTORS });
    expect(captured.doc.expiresAt).toBe('2026-06-10T20:00:00.000Z'); // 16:00 ET EDT
    expect(captured.doc.timing.localClose).toBe('16:00');
  });
});

// ==================== 6. decide.js private portfolio functions — source tripwires ====================

// validatePortfolio / enrichPortfolio / buildFallbackPortfolio are module-
// private in fenced decide.js (no export), so Commit 1 photographs their
// SOURCE TEXT (the tournamentPromptSanitizer tripwire pattern). The P4 slice
// that adds `export` to them updates these snapshots in the SAME commit and
// adds behavioral photographs alongside — that transition is the one place
// the before/after proof is source+diff rather than behavior+behavior
// (recorded in the Fence-Edit Map §10.7).

function extractDecideFunction(name) {
  const source = fs.readFileSync(path.join(here, '../agent/decide.js'), 'utf8');
  const match = source.match(new RegExp(`(?:export )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`${name} not found in decide.js`);
  return match[0];
}

describe('P4 battery — decide.js portfolio-function source tripwires', () => {
  it('validatePortfolio source is frozen', async () => {
    await expect(extractDecideFunction('validatePortfolio')).toMatchFileSnapshot(
      './__p4_snapshots__/decide.validatePortfolio.source.snap.txt'
    );
  });

  it('enrichPortfolio source is frozen', async () => {
    await expect(extractDecideFunction('enrichPortfolio')).toMatchFileSnapshot(
      './__p4_snapshots__/decide.enrichPortfolio.source.snap.txt'
    );
  });

  it('buildFallbackPortfolio source is frozen', async () => {
    await expect(extractDecideFunction('buildFallbackPortfolio')).toMatchFileSnapshot(
      './__p4_snapshots__/decide.buildFallbackPortfolio.source.snap.txt'
    );
  });

  it('validatePortfolio still hard-codes the tiered counts and duplicate rejection (anchor assertions)', () => {
    const src = extractDecideFunction('validatePortfolio');
    expect(src).toContain("if (result.star?.length !== 2) errors.push('Star must have exactly 2 stocks');");
    expect(src).toContain("if (result.bench_stocks?.length !== 3) errors.push('Bench must have exactly 3 stocks');");
    expect(src).toContain("if (!result.support_crypto) errors.push('Missing support crypto');");
    expect(src).toContain("errors.push('Duplicate symbols detected');");
  });
});

// ==================== 7. Tool schemas — photograph ====================

describe('P4 battery — deploy tool schemas photographed', () => {
  it('PORTFOLIO_TOOL keeps today\'s tiered counts (2/2/2/3 + two crypto fields)', () => {
    const p = PORTFOLIO_TOOL.input_schema.properties;
    expect([p.star.minItems, p.star.maxItems]).toEqual([2, 2]);
    expect([p.core.minItems, p.core.maxItems]).toEqual([2, 2]);
    expect([p.support_stocks.minItems, p.support_stocks.maxItems]).toEqual([2, 2]);
    expect([p.bench_stocks.minItems, p.bench_stocks.maxItems]).toEqual([3, 3]);
    expect(PORTFOLIO_TOOL.input_schema.required).toEqual([
      'star', 'core', 'support_stocks', 'support_crypto', 'bench_stocks', 'bench_crypto', 'innerMonologue',
    ]);
  });

  it('full schema photographs (file snapshots)', async () => {
    await expect(JSON.stringify(PORTFOLIO_TOOL, null, 1)).toMatchFileSnapshot(
      './__p4_snapshots__/PORTFOLIO_TOOL.snap.json'
    );
    await expect(JSON.stringify(STRATEGY_TOOL, null, 1)).toMatchFileSnapshot(
      './__p4_snapshots__/STRATEGY_TOOL.snap.json'
    );
  });
});
