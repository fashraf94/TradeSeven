// api/_utils/trainingLifecycle.v2threading.test.js
//
// Archetype Rank Interface V2 — the draft core's universe + mode threading
// (spec §4 census path 7, P-4 / P-8), proven BEHAVIOURALLY (§2 review finding
// CT-1: every pre-existing suite passed with the universe nulled at the call
// site, because their fixtures made the archetype fit equal the pool head).
// Here the fit is deliberately NOT the pool head, so a broken thread — a
// nulled universe, a dropped context, a silent fallback — flips the assertion.
// Flag OFF (the shipped state): V1 math ranks; the opts ride through untouched.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL import of
// trainingLifecycle.js — never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  chooseHumanPick,
  applyTrainingPick,
  readStockUniverseContext,
} from './trainingLifecycle.js';
import { GROUP_STATUS, PICKS_PER_PLAYER } from '../../src/constants/leagueTournament.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import { makeInMemoryDb as makeDb } from './__fixtures__/inMemoryFirestore.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// The universal board is S0..S19 in doc order; the pool head is S0. Under V1's
// analyst vector (fund .40 / tech .30 / bbFit .15 / atr .05 / sectorDiversity
// .10, one sector ⇒ diversity 0 for all) S7 is the runaway archetype fit.
const POOL = Array.from({ length: 20 }, (_, i) => `S${i}`);
const universeStocks = () => POOL.map((symbol) => (symbol === 'S7'
  ? { symbol, sectorName: 'Technology', fundamentalScore: 95, technicalScore: 95, baggerBombFit: 95, atrPercentile: 0.5, compositeScore: 40 }
  : { symbol, sectorName: 'Technology', fundamentalScore: 10, technicalScore: 10, baggerBombFit: 10, atrPercentile: 0.5, compositeScore: 60 }));
const rankingsDoc = (extra = {}) => ({ stocks: universeStocks(), axes_universe_size: 20, universe_median_return1W: -0.6, ...extra });

const DRAFT_MEMBERS = ['u1', 'cpu-1', 'cpu-2', 'cpu-3'];
const DRAFT_PLAYERS = [
  { odUserId: 'u1', picks: [] },
  { odUserId: 'cpu-1', picks: [], isCpu: true },
  { odUserId: 'cpu-2', picks: [], isCpu: true },
  { odUserId: 'cpu-3', picks: [], isCpu: true },
];
function seedDrafting(rankings) {
  const seed = {
    'tournamentGroups/d1': {
      status: GROUP_STATUS.DRAFTING, isTraining: true, roundNumber: 1, baseLayerWeek: 1,
      groupMembers: DRAFT_MEMBERS, players: DRAFT_PLAYERS.map((p) => ({ ...p, picks: [] })), userPool: [...POOL],
    },
    'tournamentGroups/d1/draft/state': {
      status: 'drafting', snakeOrder: generateSnakeOrder(4, PICKS_PER_PLAYER), currentPickIndex: 0,
      pool: [...POOL], taken: [], picksByUser: Object.fromEntries(DRAFT_MEMBERS.map((id) => [id, []])), events: [],
      humanArchetype: 'analyst', humanId: 'u1', startedAt: '2026-06-17T12:00:00.000Z', lastActivityAt: '2026-06-17T12:00:00.000Z',
    },
  };
  if (rankings) seed['indexIntelligence/stockRankings'] = rankings;
  return makeDb(seed);
}
const BEFORE_OPEN = new Date('2026-06-17T13:00:00.000Z');

describe('chooseHumanPick — the autopick is the archetype fit, not the pool head', () => {
  const base = { symbol: null, autopick: true, pool: POOL, taken: new Set(), archetype: 'analyst', gameMode: 'training' };

  it('returns the fit (S7) with fallback:false when the universe flows through', () => {
    expect(chooseHumanPick({ ...base, universe: universeStocks(), universeSize: 20, universeMedianReturn1W: -0.6 }))
      .toEqual({ symbol: 'S7', boardRank: null, fallback: false, passedOver: [] });
  });

  it('a nulled / empty universe degrades to the pool head with fallback:true (the R3 path — the mutation CT-1 caught)', () => {
    expect(chooseHumanPick({ ...base, universe: null })).toEqual({ symbol: 'S0', boardRank: null, fallback: true, passedOver: [] });
    expect(chooseHumanPick({ ...base, universe: [] })).toEqual({ symbol: 'S0', boardRank: null, fallback: true, passedOver: [] });
  });

  it('skips a taken fit and respects the pool', () => {
    expect(chooseHumanPick({ ...base, universe: universeStocks(), taken: new Set(['S7']) }).symbol).not.toBe('S7');
    expect(chooseHumanPick({ ...base, universe: universeStocks(), pool: POOL.filter((s) => s !== 'S7') }).symbol).not.toBe('S7');
  });
});

describe('readStockUniverseContext — the doc-level V2 context (P-8 / P-13)', () => {
  it('returns stocks + universeSize + universeMedianReturn1W from a post-Phase-A doc', async () => {
    const { db } = makeDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    const ctx = await readStockUniverseContext(db);
    expect(ctx.stocks).toHaveLength(20);
    expect(ctx.universeSize).toBe(20);
    expect(ctx.universeMedianReturn1W).toBe(-0.6);
  });

  it('a pre-Phase-A doc yields undefined context fields; a present-but-null median stays null; a missing doc yields null stocks', async () => {
    const pre = await readStockUniverseContext(makeDb({ 'indexIntelligence/stockRankings': { stocks: universeStocks() } }).db);
    expect(pre.stocks).toHaveLength(20);
    expect(pre.universeSize).toBeUndefined();
    expect(pre.universeMedianReturn1W).toBeUndefined();
    const nul = await readStockUniverseContext(makeDb({ 'indexIntelligence/stockRankings': rankingsDoc({ universe_median_return1W: null }) }).db);
    expect(nul.universeMedianReturn1W).toBeNull();
    const missing = await readStockUniverseContext(makeDb({}).db);
    expect(missing).toEqual({ stocks: null, universeSize: undefined, universeMedianReturn1W: undefined });
    const broken = await readStockUniverseContext({ collection: () => { throw new Error('boom'); } });
    expect(broken).toEqual({ stocks: null, universeSize: undefined, universeMedianReturn1W: undefined });
  });
});

describe('applyTrainingPick — the autopick reads the universe (and its context) through the lifecycle', () => {
  it('autopicks the archetype fit S7 (fallback:false) when the rankings doc is present', async () => {
    const { db, store } = seedDrafting(rankingsDoc());
    const r = await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    expect(r).toMatchObject({ complete: false, currentPickIndex: 7 });
    const state = store.get('tournamentGroups/d1/draft/state');
    expect(state.picksByUser.u1).toEqual(['S7']);
    expect(state.events[0]).toMatchObject({ odUserId: 'u1', symbol: 'S7', fallback: false });
  });

  it('with no rankings doc the autopick falls back to the pool head S0 (fallback:true) — the two outcomes are distinguishable', async () => {
    const { db, store } = seedDrafting(null);
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN });
    const state = store.get('tournamentGroups/d1/draft/state');
    expect(state.picksByUser.u1).toEqual(['S0']);
    expect(state.events[0]).toMatchObject({ odUserId: 'u1', symbol: 'S0', fallback: true });
  });

  it('an injected `stocks` universe (the sweep path) is honoured without a doc read', async () => {
    const { db, store, readLog } = seedDrafting(null);
    await applyTrainingPick(db, 'd1', { odUserId: 'u1', autopick: true, now: BEFORE_OPEN, stocks: universeStocks(), universeSize: 20, universeMedianReturn1W: -0.6 });
    expect(store.get('tournamentGroups/d1/draft/state').picksByUser.u1).toEqual(['S7']);
    expect(readLog.some(([, path]) => path === 'indexIntelligence/stockRankings')).toBe(false);
  });
});
