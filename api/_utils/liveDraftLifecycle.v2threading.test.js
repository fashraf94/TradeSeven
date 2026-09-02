// api/_utils/liveDraftLifecycle.v2threading.test.js
//
// Archetype Rank Interface V2 — census path 7b (the competitive live draft
// reusing the shared draft core, P-4): the universe + doc-level context read by
// readStockUniverseContext must reach chooseHumanPick at BOTH call sites
// (driveSlotDraftAutopick and applyCompetitivePick). Proven behaviourally with
// a fixture whose archetype fit is NOT the pool head (§2 review finding CT-1:
// the pre-existing fixture is monotone and one-sector, so a nulled universe
// passed unnoticed). Flag OFF: V1 math ranks; opts ride through untouched.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL import of
// liveDraftLifecycle.js — never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { driveSlotDraftAutopick, applyCompetitivePick } from './liveDraftLifecycle.js';
import { GROUP_STATUS, PICKS_PER_PLAYER, TRAINING_TUNING } from '../../src/constants/leagueTournament.js';
import { generateSnakeOrder } from '../../src/services/draftAssets.js';
import { makeInMemoryDb as makeDb } from './__fixtures__/inMemoryFirestore.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const POOL = Array.from({ length: 20 }, (_, i) => `S${i}`);
// Pool head S0; the V1 analyst fit is S7 (see trainingLifecycle.v2threading.test.js).
const universeStocks = () => POOL.map((symbol) => (symbol === 'S7'
  ? { symbol, sectorName: 'Technology', fundamentalScore: 95, technicalScore: 95, baggerBombFit: 95, atrPercentile: 0.5, compositeScore: 40 }
  : { symbol, sectorName: 'Technology', fundamentalScore: 10, technicalScore: 10, baggerBombFit: 10, atrPercentile: 0.5, compositeScore: 60 }));

const GROUP_ID = 'lds_wed-1900_2026-07-08';
const MEMBERS = ['human-1', 'human-2']; // two humans, no CPU seats — the second turn stays on the clock
const STARTED = new Date('2026-07-08T23:00:00.000Z');
const PICK_CLOCK_MS = TRAINING_TUNING.PICK_CLOCK_MS;
const FIRST_DEADLINE = new Date(STARTED.getTime() + PICK_CLOCK_MS);

function seed(withRankings) {
  const data = {
    [`tournamentGroups/${GROUP_ID}`]: {
      status: GROUP_STATUS.DRAFTING, isLiveDraft: true, roundNumber: 1, baseLayerWeek: '2026-W28',
      slotId: 'wed-1900', scheduledDraftAt: STARTED.toISOString(),
      battleStartWeek: { mondayEtDate: '2026-07-13', anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' },
      groupMembers: [...MEMBERS], players: MEMBERS.map((id) => ({ odUserId: id, picks: [] })),
      seatNames: Object.fromEntries(MEMBERS.map((id) => [id, id])), userPool: [...POOL], dailyScores: {},
    },
    [`tournamentGroups/${GROUP_ID}/draft/state`]: {
      status: 'drafting', snakeOrder: generateSnakeOrder(MEMBERS.length, PICKS_PER_PLAYER), currentPickIndex: 0,
      pool: [...POOL], taken: [], picksByUser: Object.fromEntries(MEMBERS.map((id) => [id, []])), events: [],
      archetypeByUser: { 'human-1': 'analyst', 'human-2': 'analyst' },
      startedAt: STARTED.toISOString(), lastActivityAt: STARTED.toISOString(), turnDeadline: FIRST_DEADLINE.toISOString(),
    },
  };
  if (withRankings) data['indexIntelligence/stockRankings'] = { stocks: universeStocks(), axes_universe_size: 20, universe_median_return1W: -0.6 };
  return makeDb(data);
}
const stateOf = (store) => store.get(`tournamentGroups/${GROUP_ID}/draft/state`);

describe('driveSlotDraftAutopick — the overdue human turn autopicks the archetype fit', () => {
  it('picks S7 (fallback:false) when the rankings doc is present; the next turn stays on its clock', async () => {
    const { db, store } = seed(true);
    const r = await driveSlotDraftAutopick(db, GROUP_ID, { now: new Date(FIRST_DEADLINE.getTime() + 1000) });
    expect(r).toMatchObject({ complete: false, autopicked: 1 });
    const state = stateOf(store);
    expect(state.picksByUser['human-1']).toEqual(['S7']);
    expect(state.events[0]).toMatchObject({ odUserId: 'human-1', symbol: 'S7', fallback: false, liveSource: 'autopick' });
    expect(state.currentPickIndex).toBe(1);
  });

  it('with no rankings doc the same turn falls back to the pool head S0 (fallback:true)', async () => {
    const { db, store } = seed(false);
    const r = await driveSlotDraftAutopick(db, GROUP_ID, { now: new Date(FIRST_DEADLINE.getTime() + 1000) });
    expect(r).toMatchObject({ complete: false, autopicked: 1 });
    expect(stateOf(store).picksByUser['human-1']).toEqual(['S0']);
    expect(stateOf(store).events[0]).toMatchObject({ symbol: 'S0', fallback: true });
  });
});

describe('applyCompetitivePick — an explicit autopick reads the universe through the lifecycle', () => {
  it('autopicks S7 (fallback:false) with the doc present, S0 (fallback:true) without it', async () => {
    const withDoc = seed(true);
    await applyCompetitivePick(withDoc.db, GROUP_ID, { odUserId: 'human-1', autopick: true, now: new Date(STARTED.getTime() + 5000) });
    expect(stateOf(withDoc.store).picksByUser['human-1']).toEqual(['S7']);
    expect(stateOf(withDoc.store).events[0]).toMatchObject({ symbol: 'S7', fallback: false });

    const noDoc = seed(false);
    await applyCompetitivePick(noDoc.db, GROUP_ID, { odUserId: 'human-1', autopick: true, now: new Date(STARTED.getTime() + 5000) });
    expect(stateOf(noDoc.store).picksByUser['human-1']).toEqual(['S0']);
    expect(stateOf(noDoc.store).events[0]).toMatchObject({ symbol: 'S0', fallback: true });
  });
});
