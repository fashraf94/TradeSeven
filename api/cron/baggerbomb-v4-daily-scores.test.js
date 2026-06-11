// api/cron/baggerbomb-v4-daily-scores.test.js
//
// Canonical-scorer parity tests for the V4 nightly banking cron.
//
// The cron's banked output must match calculateAssetScoreV3 — the same
// function the client-side primary banker (dailyScoringV4Service.js) uses.
// These fixtures lock the values that the old local scorer got wrong:
// cumulative badge stacks (15/45/95, not flat 15/30), asymmetric busts
// (-10/-65, not -7.5/-15), and direction handling (a winning short banks
// positive). The dependency-surface guard asserts the local flat constants
// can never silently return.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bankBattleScores } from './baggerbomb-v4-daily-scores.js';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';

// ==================== HARNESS ====================

// Minimal Firestore stand-in: captures the single update() the cron issues.
function makeDb(captured) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        update: async (updates) => {
          captured.collection = name;
          captured.docId = id;
          captured.updates = updates;
        },
      }),
    }),
  };
}

// Battle fixture. No timing block → getCurrentTradingDayV4 returns day 1 and
// totalDays defaults to 3, so banking always proceeds deterministically.
function makeBattleDoc({ portfolio, history = {}, thresholds = {}, startingPrices }) {
  return {
    id: 'battle-fixture-1',
    data: () => ({
      _v: 4,
      state: { startingPrices, dailyScores: {} },
      creator: { portfolio, history },
      opponent: { portfolio: { star: [], core: [], support: [] }, history: {} },
      thresholds,
    }),
  };
}

const emptyTiers = { star: [], core: [], support: [] };

// Run one single-asset battle through the cron's banking path and return the
// banked creator day-entry plus the captured updates.
async function bankSingleAsset({ asset, tier, baseATR, openPrice, closePrice, history = {} }) {
  const portfolio = { ...emptyTiers, [tier]: [asset] };
  const battleDoc = makeBattleDoc({
    portfolio,
    history,
    thresholds: { [asset.symbol]: { threshold: baseATR } },
    startingPrices: { [asset.symbol]: openPrice },
  });
  const captured = {};
  const result = await bankBattleScores(makeDb(captured), battleDoc, { [asset.symbol]: closePrice });
  expect(result.status).toBe('recorded');
  return { banked: captured.updates['state.dailyScores.day1'].creator, captured };
}

// The cron's input mapping, replicated for direct canonical comparison:
// priceChange from entry, thresholdPriceChange from day-open, no extremes.
function canonicalExpectation({ asset, tier, baseATR, openPrice, closePrice, history = {} }) {
  const priceChange = ((closePrice - openPrice) / openPrice) * 100;
  return calculateAssetScoreV3(
    { ...asset, tier, baseATR },
    priceChange,
    history.maxMultiplier != null ? history : { maxMultiplier: 0, minMultiplier: 0 },
    {},
    priceChange
  );
}

function expectBankedMatchesCanonical(banked, fixture) {
  const expected = canonicalExpectation(fixture);
  const entry = banked.assetScores[0];
  expect(entry.basePoints).toBe(expected.basePoints);
  expect(entry.bonusPoints).toBe(expected.bonusPoints);
  expect(entry.totalPoints).toBe(expected.totalPoints);
  expect(entry.badges).toEqual(expected.badges);
  expect(banked.activeScore).toBe(Math.round(expected.totalPoints * 100) / 100);
}

// ==================== FIXTURES ====================

describe('bankBattleScores — canonical scorer parity', () => {
  it('banks a sub-threshold long stock with no badges', async () => {
    const fixture = {
      asset: { symbol: 'AAPL', name: 'Apple' },
      tier: 'star',
      baseATR: 2.5,
      openPrice: 100,
      closePrice: 101, // +1% = 0.4x ATR — no threshold crossed
    };
    const { banked } = await bankSingleAsset(fixture);
    expect(banked.assetScores[0].badges).toEqual([]);
    expect(banked.assetScores[0].bonusPoints).toBe(0);
    expect(banked.assetScores[0].basePoints).toBe(20); // 1% * 10 * 2.0 star
    expectBankedMatchesCanonical(banked, fixture);
  });

  it.each([
    // [closePrice, atrMultiple, expectedBadges, expectedBonus] — cumulative, not flat
    [102, '1.0x', ['bagger'], 15],
    [103, '1.5x', ['bagger', 'doubleBagger'], 45],
    [104, '2.0x', ['bagger', 'doubleBagger', 'tenBagger'], 95],
  ])('banks the cumulative badge stack at %s ATR (close %i → +%i bonus)', async (closePrice, _label, expectedBadges, expectedBonus) => {
    const fixture = {
      asset: { symbol: 'TSLA', name: 'Tesla' },
      tier: 'star',
      baseATR: 2.0,
      openPrice: 100,
      closePrice,
    };
    const { banked } = await bankSingleAsset(fixture);
    expect(banked.assetScores[0].badges).toEqual(expectedBadges);
    expect(banked.assetScores[0].bonusPoints).toBe(expectedBonus);
    expectBankedMatchesCanonical(banked, fixture);
  });

  it.each([
    // Asymmetric bust penalties — -10 at -1.0x, cumulative -65 at -2.0x
    [98, '-1.0x', ['bust'], -10],
    [96, '-2.0x', ['bust', 'crash', 'meltdown'], -65],
  ])('banks asymmetric bust penalties at %s ATR (close %i → %i bonus)', async (closePrice, _label, expectedBadges, expectedBonus) => {
    const fixture = {
      asset: { symbol: 'NVDA', name: 'Nvidia' },
      tier: 'core',
      baseATR: 2.0,
      openPrice: 100,
      closePrice,
    };
    const { banked } = await bankSingleAsset(fixture);
    expect(banked.assetScores[0].badges).toEqual(expectedBadges);
    expect(banked.assetScores[0].bonusPoints).toBe(expectedBonus);
    expectBankedMatchesCanonical(banked, fixture);
  });

  it('banks a long crypto position on canonical math', async () => {
    const fixture = {
      asset: { symbol: 'BTC', name: 'Bitcoin', isCrypto: true, direction: 'long' },
      tier: 'support',
      baseATR: 5.0,
      openPrice: 50000,
      closePrice: 52500, // +5% = 1.0x ATR
    };
    const { banked } = await bankSingleAsset(fixture);
    expect(banked.assetScores[0].badges).toEqual(['bagger']);
    expect(banked.assetScores[0].totalPoints).toBe(65); // 5%*10*1.0 + 15
    expectBankedMatchesCanonical(banked, fixture);
  });

  it('banks a winning short crypto day as POSITIVE points', async () => {
    const fixture = {
      asset: { symbol: 'ETH', name: 'Ethereum', isCrypto: true, direction: 'short' },
      tier: 'support',
      baseATR: 5.0,
      openPrice: 100,
      closePrice: 95, // price down 5% — the short WINS
    };
    const { banked } = await bankSingleAsset(fixture);
    const entry = banked.assetScores[0];
    expect(entry.totalPoints).toBeGreaterThan(0);
    expect(entry.totalPoints).toBe(65); // negated +5% → 50 base + 15 bagger
    expect(entry.badges).toEqual(['bagger']);
    // Banked priceChange stays the raw price move (mirrors the primary banker).
    expect(entry.priceChange).toBe(-5);
    expectBankedMatchesCanonical(banked, fixture);
  });

  it('feeds canonical bonusPoints into the bankedBadgePoints breakdown', async () => {
    const fixture = {
      asset: { symbol: 'TSLA', name: 'Tesla' },
      tier: 'star',
      baseATR: 2.0,
      openPrice: 100,
      closePrice: 104, // 2.0x — full positive stack
    };
    const { captured } = await bankSingleAsset(fixture);
    const breakdown = captured.updates['state.bankedBadgePoints.creator.breakdown.day1'];
    expect(breakdown.points).toBe(95);
    expect(breakdown.badges.TSLA).toEqual(['bagger', 'doubleBagger', 'tenBagger']);
  });
});

// ==================== DEPENDENCY-SURFACE GUARD ====================

describe('cron file scoring source', () => {
  const cronSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'baggerbomb-v4-daily-scores.js'),
    'utf8'
  );

  it('contains no local scoring constants or local scorer', () => {
    expect(cronSource).not.toMatch(/THRESHOLD_BADGE_MAP/);
    expect(cronSource).not.toMatch(/-7\.5/);
    expect(cronSource).not.toMatch(/CONVICTION_MULTIPLIERS\s*=/);
    expect(cronSource).not.toMatch(/function calculateAssetScore\(/);
  });

  it('sources the canonical scorer the client primary banker uses', () => {
    expect(cronSource).toMatch(
      /import \{ calculateAssetScoreV3 \} from '\.\.\/\.\.\/src\/utils\/baggerBombUtils\.js'/
    );
  });
});
