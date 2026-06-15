// api/_utils/tournamentBanking.test.js
//
// Daily banking under the cumulative snapshot model (founder ruling #1):
// settlement of null baselines and bank-pending closed legs from the open,
// cumulative per-pick scoring, ET-date idempotency, derived day indexing,
// ascending waiver write (ruling #3), and the transactional persistence shape.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentBanking module below is the runtime guard for its api/ -> src/
// imports (leagueTournament.js via this module and tournamentUserScoring's
// baggerBombUtils.js) — it explodes in this Node test environment if a
// browser-only dependency ever enters that transitive graph. Never mock
// this import.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { computeBankingUpdate, bankGroup, bankAllTournamentGroups, fetchGroupAgentScores } from './tournamentBanking.js';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';

const NOW = new Date('2026-06-10T21:15:00Z'); // 17:15 ET → etDate 2026-06-10
const NOW_ISO = NOW.toISOString();
const ET_DATE = '2026-06-10';
const OPTS = { nowIso: NOW_ISO, etDate: ET_DATE, atrPercentiles: null, recordedBy: 'cron' };

function leg(overrides = {}) {
  return {
    direction: 'long',
    baselinePrice: null,
    baselineSource: 'draft_resolution',
    openedAt: 'T0',
    thresholdHistory: [],
    ...overrides,
  };
}

function pick(symbol, legs) {
  return { symbol, legs, flipCountToday: 0 };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    players: [
      { odUserId: 'u1', picks: [pick('NVDA', [leg()])] },
      { odUserId: 'u2', picks: [pick('AMD', [leg()])] },
      { odUserId: 'u3', picks: [pick('TSLA', [leg()])] },
      { odUserId: 'u4', picks: [] },
    ],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

const QUOTES = {
  NVDA: { open: 100, current: 103, previousClose: 99, timestamp: 1 },  // +3% → bagger, 45 pts
  AMD: { open: 50, current: 49, previousClose: 50, timestamp: 1 },     // −2% → −20 pts
  TSLA: { open: 200, current: 200, previousClose: 200, timestamp: 1 }, // flat → 0
};

// Firestore stand-in (harness precedent: tournamentGroupService.test.js
// makeDb), extended with a status query for the cron orchestrator.
function makeDb({ groupDoc = null, queryDocs = [], rankingsDoc = null } = {}) {
  const captured = { updates: [], queries: [] };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
  };
  const db = {
    collection: (name) => ({
      doc: () => (name === 'indexIntelligence'
        ? { get: async () => ({ exists: rankingsDoc != null, data: () => rankingsDoc }) }
        : groupRef),
      where: (...args) => {
        captured.queries.push([name, ...args]);
        return {
          get: async () => ({
            forEach: (cb) => queryDocs.forEach(d => cb({ id: d.id, data: () => d.data })),
          }),
        };
      },
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (_ref, data) => { captured.updates.push(data); },
    }),
  };
  return { db, captured };
}

afterEach(() => vi.unstubAllEnvs());

// ==================== computeBankingUpdate (pure) ====================

describe('computeBankingUpdate — first banking day', () => {
  it('settles every null baseline at the open and writes day1 cumulative snapshots', () => {
    const update = computeBankingUpdate(battleGroup(), QUOTES, OPTS);

    expect(update.skipped).toBe(false);
    expect(update.dayKey).toBe('day1');

    for (const player of update.players) {
      for (const p of player.picks) {
        expect(p.legs[0].baselinePrice).toBe(QUOTES[p.symbol].open);
      }
    }

    const { closeScores } = update.dayEntry;
    expect(closeScores.u1.totalPoints).toBe(45);  // +3% on 2.5 ATR: 30 base + 15 bagger
    expect(closeScores.u2.totalPoints).toBe(-20);
    expect(closeScores.u3.totalPoints).toBe(0);
    expect(closeScores.u4).toEqual({ totalPoints: 0, picks: [], agentPoints: 0, compositePoints: 0 });
    expect(update.dayEntry).toMatchObject({ recordedAt: NOW_ISO, recordedBy: 'cron', recordedDate: ET_DATE });

    // picks entries carry writer-readable fields
    expect(closeScores.u1.picks).toEqual([
      { symbol: 'NVDA', direction: 'long', totalPoints: 45, bankedPoints: 0, livePoints: 45 },
    ]);
  });

  it('ascending waiver priority — lowest cumulative standing first (ruling #3, flat array)', () => {
    const update = computeBankingUpdate(battleGroup(), QUOTES, OPTS);
    expect(update.waiverPriority).toEqual(['u2', 'u3', 'u4', 'u1']);
  });

  it('appends the live leg history (thresholdHistory bridge) and never mutates the input group', () => {
    const group = battleGroup();
    const update = computeBankingUpdate(group, QUOTES, OPTS);

    const nvdaLeg = update.players[0].picks[0].legs[0];
    expect(nvdaLeg.thresholdHistory).toHaveLength(1);
    expect(nvdaLeg.thresholdHistory[0].recordedAt).toBe(NOW_ISO);
    expect(nvdaLeg.thresholdHistory[0].maxMultiplier).toBeCloseTo(1.2, 12);

    // input untouched (deep copy)
    expect(group.players[0].picks[0].legs[0].baselinePrice).toBeNull();
    expect(group.players[0].picks[0].legs[0].thresholdHistory).toHaveLength(0);
  });
});

describe('computeBankingUpdate — idempotency and day indexing', () => {
  it('skips when any day entry already carries today\'s ET date', () => {
    const group = battleGroup({
      dailyScores: { day3: { closeScores: {}, recordedDate: ET_DATE } },
    });
    expect(computeBankingUpdate(group, QUOTES, OPTS))
      .toEqual({ skipped: true, reason: 'already_recorded', dayKey: 'day3' });
  });

  it('derives the next day index from the existing entries (day1+day2 → day3)', () => {
    const group = battleGroup({
      dailyScores: {
        day1: { closeScores: {}, recordedDate: '2026-06-08' },
        day2: { closeScores: {}, recordedDate: '2026-06-09' },
      },
    });
    expect(computeBankingUpdate(group, QUOTES, OPTS).dayKey).toBe('day3');
  });
});

describe('computeBankingUpdate — settlement of flip debris', () => {
  it('banks a bank-pending closed leg at today\'s open; the new leg scores from its own baseline', () => {
    const quotes = { NVDA: { open: 104, current: 105, previousClose: 100, timestamp: 1 } };
    const group = battleGroup({
      players: [
        {
          odUserId: 'u1',
          picks: [pick('NVDA', [
            { ...leg({ baselinePrice: 100 }), closedAt: 'T1' }, // market-closed flip, bank-pending
            leg({ direction: 'short' }),                        // new leg, unsettled
          ])],
        },
        { odUserId: 'u2', picks: [] },
        { odUserId: 'u3', picks: [] },
        { odUserId: 'u4', picks: [] },
      ],
    });

    const update = computeBankingUpdate(group, quotes, OPTS);
    const [closedLeg, newLeg] = update.players[0].picks[0].legs;

    // banked from 100 → 104 (the next session's open is the close-out price)
    const expected = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, 4, {}, {}, null
    ).totalPoints;
    expect(closedLeg.bankedScore).toBe(expected);
    expect(newLeg.baselinePrice).toBe(104);

    const score = update.dayEntry.closeScores.u1;
    expect(score.picks[0].bankedPoints).toBe(expected);
    expect(score.totalPoints).toBe(score.picks[0].bankedPoints + score.picks[0].livePoints);
  });

  it('an overnight open-and-closed leg banks 0 by construction (zero exposure)', () => {
    const group = battleGroup({
      players: [
        { odUserId: 'u1', picks: [pick('NVDA', [{ ...leg(), closedAt: 'T1' }, leg()])] },
        { odUserId: 'u2', picks: [] },
        { odUserId: 'u3', picks: [] },
        { odUserId: 'u4', picks: [] },
      ],
    });
    const update = computeBankingUpdate(group, QUOTES, OPTS);
    const [closedLeg] = update.players[0].picks[0].legs;
    expect(closedLeg.baselinePrice).toBe(100);
    expect(closedLeg.bankedScore).toBe(0);
  });

  it('a missing quote leaves legs unsettled (0 contribution, warning) but still records the day', () => {
    const quotes = { NVDA: QUOTES.NVDA, AMD: QUOTES.AMD }; // TSLA absent
    const update = computeBankingUpdate(battleGroup(), quotes, OPTS);

    expect(update.skipped).toBe(false);
    const tslaLeg = update.players[2].picks[0].legs[0];
    expect(tslaLeg.baselinePrice).toBeNull(); // settles on the next pass
    expect(update.dayEntry.closeScores.u3.totalPoints).toBe(0);
    expect(update.warnings.some(w => w.includes('TSLA'))).toBe(true);
  });

  it('a SETTLED live leg with no usable quote scores 0 with a warning — a regression vector, never silent', () => {
    const group = battleGroup({
      players: [
        { odUserId: 'u1', picks: [pick('TSLA', [leg({ baselinePrice: 200 })])] },
        { odUserId: 'u2', picks: [] },
        { odUserId: 'u3', picks: [] },
        { odUserId: 'u4', picks: [] },
      ],
    });
    const update = computeBankingUpdate(group, { NVDA: QUOTES.NVDA }, OPTS); // TSLA absent
    expect(update.dayEntry.closeScores.u1.totalPoints).toBe(0);
    expect(update.warnings.some(w => w.includes('TSLA') && w.includes('live leg scored 0'))).toBe(true);
  });
});

describe('computeBankingUpdate — dropped picks (claim execution) keep counting', () => {
  it('settles a dropped pick\'s bank-pending exit leg at the open and keeps its banked value in the standing', () => {
    const quotes = { NVDA: { open: 104, current: 105, previousClose: 100, timestamp: 1 }, COIN: { open: 50, current: 50, previousClose: 50, timestamp: 1 } };
    const group = battleGroup({
      players: [
        {
          odUserId: 'u1',
          picks: [pick('COIN', [leg()])], // the won name, unsettled
          droppedPicks: [{
            symbol: 'NVDA',
            legs: [
              { ...leg({ baselinePrice: 90 }), closedAt: 'T1', bankedScore: 45 },
              { ...leg({ baselinePrice: 100 }), closedAt: 'T2' }, // exit leg, bank-pending
            ],
            flipCountToday: 0,
          }],
        },
        { odUserId: 'u2', picks: [] },
        { odUserId: 'u3', picks: [] },
        { odUserId: 'u4', picks: [] },
      ],
    });

    const update = computeBankingUpdate(group, quotes, OPTS);
    const u1 = update.dayEntry.closeScores.u1;

    // The exit leg banked from 100 → 104 (the pre-open exit settles at the open).
    const exitBanked = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, 4, {}, {}, null
    ).totalPoints;
    const droppedEntry = u1.picks.find(p => p.dropped);
    expect(droppedEntry).toMatchObject({ symbol: 'NVDA', bankedPoints: 45 + exitBanked, livePoints: 0, dropped: true });
    expect(u1.totalPoints).toBe(45 + exitBanked); // COIN just settled, 0 live
    expect(update.players[0].droppedPicks[0].legs[1].bankedScore).toBe(exitBanked);
  });
});

describe('computeBankingUpdate — the cumulative model in motion', () => {
  it('day-2 snapshot = banked closed leg + live leg from its baseline (not a daily delta)', () => {
    const group = battleGroup({
      players: [
        {
          odUserId: 'u1',
          picks: [pick('NVDA', [
            { ...leg({ baselinePrice: 90 }), closedAt: 'T1', bankedScore: 45 },
            leg({ baselinePrice: 110 }),
          ])],
        },
        { odUserId: 'u2', picks: [] },
        { odUserId: 'u3', picks: [] },
        { odUserId: 'u4', picks: [] },
      ],
      dailyScores: { day1: { closeScores: { u1: { totalPoints: 45, picks: [] } }, recordedDate: '2026-06-09' } },
    });
    const quotes = { NVDA: { open: 111, current: 113.3, previousClose: 110, timestamp: 1 } };

    const update = computeBankingUpdate(group, quotes, OPTS);
    expect(update.dayKey).toBe('day2');

    const livePc = ((113.3 - 110) / 110) * 100;
    const liveExpected = calculateAssetScoreV3(
      { symbol: 'NVDA', baseATR: 2.5, direction: 'long' }, livePc, {}, {}, null
    ).totalPoints;
    const score = update.dayEntry.closeScores.u1;
    expect(score.totalPoints).toBe(45 + liveExpected); // cumulative standing, banked + live
    expect(score.picks[0]).toMatchObject({ bankedPoints: 45, livePoints: liveExpected });
  });
});

// ==================== bankGroup (transactional wrapper) ====================

describe('bankGroup', () => {
  it('writes players + the dot-pathed day entry + waiver order in one update', async () => {
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    const result = await bankGroup(db, 'group-1', QUOTES, { now: NOW, recordedBy: 'manual' });

    expect(result.skipped).toBe(false);
    expect(result.dayKey).toBe('day1');
    expect(captured.updates).toHaveLength(1);

    const update = captured.updates[0];
    expect(Object.keys(update).sort()).toEqual([
      'claimSystem.currentWaiverPriority',
      'dailyScores.day1',
      'players',
      'updatedAt',
    ]);
    expect(update['dailyScores.day1'].recordedBy).toBe('manual');
    expect(update['claimSystem.currentWaiverPriority']).toEqual(['u2', 'u3', 'u4', 'u1']);
    expect(update.updatedAt).toBe(NOW_ISO);
  });

  it('a same-ET-date re-run skips with zero writes (idempotency is never bypassable)', async () => {
    const banked = battleGroup({
      dailyScores: { day1: { closeScores: {}, recordedDate: ET_DATE } },
    });
    const { db, captured } = makeDb({ groupDoc: banked });
    const result = await bankGroup(db, 'group-1', QUOTES, { now: NOW });
    expect(result).toMatchObject({ skipped: true, reason: 'already_recorded' });
    expect(captured.updates).toHaveLength(0);
  });

  it('missing group / non-battle group skip cleanly', async () => {
    expect(await bankGroup(makeDb().db, 'group-1', QUOTES, { now: NOW }))
      .toEqual({ skipped: true, reason: 'group_not_found' });
    expect(await bankGroup(makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db, 'group-1', QUOTES, { now: NOW }))
      .toEqual({ skipped: true, reason: 'not_battle' });
  });

  it('banks an isTraining group normally — the flag is irrelevant to banking (Next-Arc Slice 3.0)', async () => {
    const { db, captured } = makeDb({ groupDoc: battleGroup({ isTraining: true }) });
    const result = await bankGroup(db, 'gt', QUOTES, { now: NOW, recordedBy: 'cron' });
    expect(result.skipped).toBe(false);
    expect(result.dayKey).toBe('day1');
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0]['dailyScores.day1']).toBeDefined();
  });
});

// ==================== bankAllTournamentGroups (cron orchestrator) ====================

describe('bankAllTournamentGroups', () => {
  it('PRODUCTION INERTNESS: zero tournament groups is a clean no-op — no fetches, no writes', async () => {
    const { db, captured } = makeDb({ queryDocs: [] });
    const summary = await bankAllTournamentGroups(db, { now: NOW });
    expect(summary).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0, agentScoreFailures: 0 });
    expect(captured.updates).toHaveLength(0);
    expect(captured.queries).toEqual([['tournamentGroups', 'status', '==', 'battle']]);
  });

  it('ignores groups failing the in-code player-count mirror check', async () => {
    const malformed = battleGroup({ players: battleGroup().players.slice(0, 2) });
    const { db, captured } = makeDb({ queryDocs: [{ id: 'g1', data: malformed }] });
    const summary = await bankAllTournamentGroups(db, { now: NOW });
    expect(summary.groups).toBe(0);
    expect(captured.updates).toHaveLength(0);
  });

  it('with prices unavailable, errors out the run instead of banking zero snapshots', async () => {
    vi.stubEnv('EODHD_API_KEY', ''); // fetchBatchQuotes degrades to {}
    const group = battleGroup();
    const { db, captured } = makeDb({ groupDoc: group, queryDocs: [{ id: 'g1', data: group }] });
    const summary = await bankAllTournamentGroups(db, { now: NOW });
    expect(summary).toMatchObject({ groups: 1, processed: 0, errors: 1 });
    expect(captured.updates).toHaveLength(0);
  });

  it('INCLUDES isTraining groups in the selection — training banks its own closes (Next-Arc Slice 3.0)', async () => {
    vi.stubEnv('EODHD_API_KEY', ''); // fetchBatchQuotes degrades; the run aborts AFTER selection
    const training = battleGroup({ isTraining: true });
    const { db } = makeDb({ groupDoc: training, queryDocs: [{ id: 'gt', data: training }] });
    const summary = await bankAllTournamentGroups(db, { now: NOW });
    expect(summary.groups).toBe(1); // selected by the query — isTraining is NOT filtered out
  });
});

// ==================== P6a — COMPOSITE SNAPSHOTS (ruling A-1) ====================

describe('computeBankingUpdate — agentPoints + compositePoints (P6a)', () => {
  it('writes the agent cumulative and the composite of record per player, signed', () => {
    const agentScores = { u1: 30, u2: -12.5, u3: 0 }; // u4 absent → 0
    const update = computeBankingUpdate(battleGroup(), QUOTES, { ...OPTS, agentScores });
    const { closeScores } = update.dayEntry;

    expect(closeScores.u1).toMatchObject({ totalPoints: 45, agentPoints: 30, compositePoints: 97.5 }); // 30 + 1.5×45
    expect(closeScores.u2).toMatchObject({ totalPoints: -20, agentPoints: -12.5, compositePoints: -42.5 }); // negatives preserved
    expect(closeScores.u3).toMatchObject({ agentPoints: 0, compositePoints: 0 });
    expect(closeScores.u4).toMatchObject({ agentPoints: 0, compositePoints: 0 });
    expect(update.warnings).not.toContain('agent scores unavailable — prior snapshot agentPoints carried forward');
  });

  it('waiver priority STAYS user-layer under composite divergence (ruling A-2)', () => {
    // u1 leads on user points but trails on composite; the wire must not care.
    const agentScores = { u1: -100, u2: 200, u3: 0 };
    const update = computeBankingUpdate(battleGroup(), QUOTES, { ...OPTS, agentScores });
    expect(update.waiverPriority).toEqual(['u2', 'u3', 'u4', 'u1']); // ascending USER totals: −20, 0, 0, 45
  });

  it('CARRY-FORWARD: a failed battle read (null) keeps the prior agentPoints, loudly', () => {
    const group = battleGroup({
      dailyScores: {
        day1: {
          recordedDate: '2026-06-09',
          closeScores: { u1: { totalPoints: 10, agentPoints: 25, compositePoints: 40, picks: [] } },
        },
      },
    });
    const update = computeBankingUpdate(group, QUOTES, { ...OPTS, agentScores: null });
    expect(update.dayEntry.closeScores.u1.agentPoints).toBe(25); // carried, not zeroed
    expect(update.dayEntry.closeScores.u2.agentPoints).toBe(0);  // no prior → 0
    expect(update.warnings).toContain('agent scores unavailable — prior snapshot agentPoints carried forward');
  });
});

describe('fetchGroupAgentScores — the agent-layer read', () => {
  function battlesDb(docs) {
    const runQuery = (field, value) => async () => ({
      forEach: (cb) => docs
        .filter(d => d[field] === value)
        .forEach(d => cb({ id: d.id, data: () => d })),
    });
    return {
      collection: (name) => ({
        where: (field, _op, value) => ({
          get: runQuery(field, value),
          // Field mask (the ledger precedent) — the fake returns full docs,
          // a superset of any projection.
          select: () => ({ get: runQuery(field, value) }),
        }),
        doc: () => { throw new Error('unused'); },
      }),
    };
  }

  it('sums scoreState.currentScore per ownerId across the group battles (Mon–Fri chain)', async () => {
    const db = battlesDb([
      { id: 'b1', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u1', scoreState: { currentScore: 10 } },
      { id: 'b2', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u1', scoreState: { currentScore: -4 } },
      { id: 'b3', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u2', scoreState: { currentScore: 7 } },
    ]);
    const byOwner = await fetchGroupAgentScores(db, 'g1');
    expect(byOwner).toEqual({ u1: 6, u2: 7 });
  });

  it('ignores half-stamped docs (joint-stamp safety) and scoreless docs count 0', async () => {
    const db = battlesDb([
      { id: 'b1', groupId: 'g1', gameMode: 'baggerbomb_agent', ownerId: 'u1', scoreState: { currentScore: 99 } },
      { id: 'b2', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u2' },
    ]);
    const byOwner = await fetchGroupAgentScores(db, 'g1');
    expect(byOwner).toEqual({ u2: 0 });
  });

  it('a poisoned (non-numeric) currentScore is skipped loudly, never aborts the read', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = battlesDb([
      { id: 'b1', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u1', scoreState: { currentScore: '12.5' } },
      { id: 'b2', groupId: 'g1', gameMode: 'baggerbomb_tournament', ownerId: 'u1', scoreState: { currentScore: 4 } },
    ]);
    const byOwner = await fetchGroupAgentScores(db, 'g1');
    expect(byOwner).toEqual({ u1: 4 });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('computeBankingUpdate — per-owner carry-forward (code review)', () => {
  it('an owner with a prior NON-ZERO standing missing from a successful read carries, loudly; zero-prior owners bank 0 quietly', () => {
    const group = battleGroup({
      dailyScores: {
        day1: {
          recordedDate: '2026-06-09',
          closeScores: {
            u1: { totalPoints: 10, agentPoints: 25, compositePoints: 40, picks: [] },
            u2: { totalPoints: 0, agentPoints: 0, compositePoints: 0, picks: [] },
          },
        },
      },
    });
    // The read SUCCEEDED but u1's battles vanished (mis-stamp/deletion).
    const update = computeBankingUpdate(group, QUOTES, { ...OPTS, agentScores: { u2: 7, u3: 1 } });
    expect(update.dayEntry.closeScores.u1.agentPoints).toBe(25); // carried, never regressed to 0
    expect(update.dayEntry.closeScores.u2.agentPoints).toBe(7);
    expect(update.dayEntry.agentScoresCarried).toBe(true);
    expect(update.warnings.some(w => w.startsWith('u1: agent battles missing'))).toBe(true);
  });

  it('a NaN prior never perpetuates; the day-1 null-read arm banks 0 and says so', () => {
    const poisoned = battleGroup({
      dailyScores: {
        day1: {
          recordedDate: '2026-06-09',
          closeScores: { u1: { totalPoints: 1, agentPoints: NaN, compositePoints: NaN, picks: [] } },
        },
      },
    });
    const carried = computeBankingUpdate(poisoned, QUOTES, { ...OPTS, agentScores: null });
    expect(carried.dayEntry.closeScores.u1.agentPoints).toBe(0); // finite-guarded

    const day1 = computeBankingUpdate(battleGroup(), QUOTES, { ...OPTS, agentScores: null });
    expect(day1.warnings).toContain('agent scores unavailable — no prior snapshot, agentPoints banked 0');
    expect(day1.dayEntry.agentScoresCarried).toBe(true);
  });
});
