// api/_utils/tournamentClaims.test.js
//
// Tournament claims resolution — the legacy queue/rotation algorithm with
// the tournament sibling shape. Headline locks:
//
// - THE NAMING-HAZARD TEST (P1 docket #1): a fixture group carries BOTH a
//   decoy legacy-shaped `dailyData` and a real `dailyScores`, ordered so the
//   two disagree — waiver priority must follow dailyScores. A regression to
//   the legacy field name flips the order and fails loudly.
// - Transactional resolution (founder adjustment at the P1b go): fresh
//   in-transaction reads; claim outcomes + roster/pool mutation +
//   idempotency mark + the waiver-snapshot log entry (rider #5 "resolved")
//   commit atomically.
// - The legacy isAlreadyProcessedForDay guard imported AS-IS, fed by the
//   banking-derived day clock.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentClaims module below is the runtime guard for its api/ -> src/
// import of src/constants/leagueTournament.js — it explodes in this Node
// test environment if a browser-only dependency ever enters that transitive
// graph. Never mock this import.

import { describe, it, expect } from 'vitest';
import {
  calculateTournamentWaiverPriority,
  fetchEligibleTournamentGroups,
  processClaimsForTournamentGroup,
} from './tournamentClaims.js';

const NOW = new Date('2026-06-10T13:25:00Z'); // 9:25 AM ET Wed → etDate 2026-06-10
const NOW_ISO = NOW.toISOString();

function pickState(symbol, overrides = {}) {
  return {
    symbol,
    legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }],
    flipCountToday: 0,
    ...overrides,
  };
}

function battleGroup(overrides = {}) {
  return {
    id: 'group-1',
    status: 'battle',
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [pickState('NVDA'), pickState('AMD'), pickState('TSLA')] },
      { odUserId: 'u2', picks: [pickState('META'), pickState('AAPL'), pickState('MSFT')] },
      { odUserId: 'u3', picks: [pickState('AMZN'), pickState('GOOG'), pickState('NFLX')] },
      { odUserId: 'u4', picks: [pickState('AVGO'), pickState('CRM'), pickState('ORCL')] },
    ],
    userPool: ['COIN', 'PLTR', 'SHOP', 'UBER'],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

// Firestore stand-in with a claims subcollection: tx.get serves the group
// ref and the pending-claims query; tx.update routes claim-doc vs group-doc
// writes into separate capture arrays.
function makeDb({ groupDoc = null, claims = [] } = {}) {
  const captured = { claimUpdates: [], groupUpdates: [] };
  const pendingQuery = { __pendingClaims: true };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
    collection: () => ({
      where: () => pendingQuery,
      doc: (id) => ({ __claimId: id }),
    }),
  };
  const db = {
    collection: () => ({
      doc: () => groupRef,
      where: () => ({
        get: async () => ({
          forEach: (cb) => (groupDoc ? [{ id: 'group-1', data: () => groupDoc }] : []).forEach(cb),
        }),
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (refOrQuery) => {
        if (refOrQuery === pendingQuery) {
          return {
            empty: claims.length === 0,
            size: claims.length,
            forEach: (cb) => claims.forEach(({ id, ...data }) => cb({ id, data: () => data })),
          };
        }
        return refOrQuery.get();
      },
      update: (ref, data) => {
        if (ref.__claimId) captured.claimUpdates.push({ id: ref.__claimId, ...data });
        else captured.groupUpdates.push(data);
      },
    }),
  };
  return { db, captured };
}

function claim(id, odUserId, dropSymbol, addSymbol, rank = 1) {
  return { id, odUserId, dropSymbol, addSymbol, rank, status: 'pending' };
}

// ==================== WAIVER PRIORITY ====================

describe('calculateTournamentWaiverPriority', () => {
  it('NAMING-HAZARD LOCK (docket #1): orders by dailyScores even when a decoy legacy dailyData disagrees', () => {
    const group = battleGroup({
      // Decoy in the LEGACY shape and field name — ascending order would be
      // u1, u2, u3, u4 if anything ever read it.
      dailyData: {
        day1: {
          closeScores: {
            u1: { totalPoints: 0 }, u2: { totalPoints: 10 },
            u3: { totalPoints: 20 }, u4: { totalPoints: 30 },
          },
        },
      },
      // The real tournament record orders the opposite way.
      dailyScores: {
        day1: {
          closeScores: {
            u1: { totalPoints: 30, picks: [] }, u2: { totalPoints: 20, picks: [] },
            u3: { totalPoints: 10, picks: [] }, u4: { totalPoints: 0, picks: [] },
          },
          recordedDate: '2026-06-09',
        },
      },
    });
    expect(calculateTournamentWaiverPriority(group)).toEqual(['u4', 'u3', 'u2', 'u1']);
  });

  it('uses the latest snapshot (cumulative standings), ascending — lowest claims first (ruling #3)', () => {
    const group = battleGroup({
      dailyScores: {
        day1: { closeScores: { u1: { totalPoints: 0 }, u2: { totalPoints: 50 }, u3: { totalPoints: 10 }, u4: { totalPoints: 20 } } },
        day2: { closeScores: { u1: { totalPoints: 40 }, u2: { totalPoints: 5 }, u3: { totalPoints: 30 }, u4: { totalPoints: 10 } } },
      },
    });
    expect(calculateTournamentWaiverPriority(group)).toEqual(['u2', 'u4', 'u3', 'u1']);
  });

  it('no scores yet → reverse draft order; stored currentWaiverPriority always wins', () => {
    expect(calculateTournamentWaiverPriority(battleGroup())).toEqual(['u4', 'u3', 'u2', 'u1']);

    const stored = battleGroup({
      claimSystem: { enabled: true, currentWaiverPriority: ['u3', 'u1', 'u4', 'u2'], processingLog: [] },
      dailyScores: { day1: { closeScores: { u1: { totalPoints: 99 } } } },
    });
    expect(calculateTournamentWaiverPriority(stored)).toEqual(['u3', 'u1', 'u4', 'u2']);
  });
});

// ==================== ELIGIBILITY ====================

describe('fetchEligibleTournamentGroups', () => {
  it('mirrors the legacy in-code checks: claimSystem.enabled + exactly 4 players', async () => {
    const eligible = battleGroup();
    expect(await fetchEligibleTournamentGroups(makeDb({ groupDoc: eligible }).db)).toHaveLength(1);

    const disabled = battleGroup({ claimSystem: { enabled: false } });
    expect(await fetchEligibleTournamentGroups(makeDb({ groupDoc: disabled }).db)).toHaveLength(0);

    const short = battleGroup({ players: battleGroup().players.slice(0, 2) });
    expect(await fetchEligibleTournamentGroups(makeDb({ groupDoc: short }).db)).toHaveLength(0);
  });
});

// ==================== RESOLUTION ====================

describe('processClaimsForTournamentGroup — queue/rotation (legacy algorithm, tournament shape)', () => {
  it('contention: higher waiver priority wins; the loser front-retries their next-ranked claim', async () => {
    const group = battleGroup({
      // u2 has the lower standing → first pick on the wire.
      claimSystem: { enabled: true, currentWaiverPriority: ['u2', 'u1', 'u3', 'u4'], processingLog: [] },
    });
    const claims = [
      claim('c1', 'u1', 'NVDA', 'COIN', 1),
      claim('c2', 'u1', 'NVDA', 'PLTR', 2),
      claim('c3', 'u2', 'META', 'COIN', 1),
    ];
    const { db, captured } = makeDb({ groupDoc: group, claims });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });

    expect(result).toMatchObject({ status: 'processed', total: 3, approved: 2, denied: 1 });

    const byId = Object.fromEntries(captured.claimUpdates.map(u => [u.id, u]));
    expect(byId.c3).toMatchObject({ status: 'approved', denialReason: null });          // u2 wins COIN
    expect(byId.c1).toMatchObject({ status: 'denied', denialReason: 'claimed_by_higher_priority' });
    expect(byId.c2).toMatchObject({ status: 'approved', denialReason: null });          // u1 front-retried into PLTR

    const groupUpdate = captured.groupUpdates[0];
    const u1 = groupUpdate.players.find(p => p.odUserId === 'u1');
    const u2 = groupUpdate.players.find(p => p.odUserId === 'u2');
    expect(u1.picks.map(p => p.symbol)).toEqual(['PLTR', 'AMD', 'TSLA']);
    expect(u2.picks.map(p => p.symbol)).toEqual(['COIN', 'AAPL', 'MSFT']);

    // Won names leave the pool; dropped names return to it.
    expect(groupUpdate.userPool).toEqual(['SHOP', 'UBER', 'META', 'NVDA']);
  });

  it('a won name is a FRESH pick state: long, null baseline, claim_execution, empty history', async () => {
    const group = battleGroup();
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    await processClaimsForTournamentGroup(db, group, { now: NOW });

    const u1 = captured.groupUpdates[0].players.find(p => p.odUserId === 'u1');
    expect(u1.picks[0]).toEqual({
      symbol: 'COIN',
      legs: [{
        direction: 'long',
        baselinePrice: null,
        baselineSource: 'claim_execution',
        openedAt: NOW_ISO,
        thresholdHistory: [],
      }],
      flipCountToday: 0,
    });
  });

  it('approval rotates the user to the back; denial keeps them at the front', async () => {
    const group = battleGroup({
      claimSystem: { enabled: true, currentWaiverPriority: ['u1', 'u2', 'u3', 'u4'], processingLog: [] },
    });
    const claims = [
      claim('c1', 'u1', 'NVDA', 'COIN', 1),
      claim('c2', 'u1', 'AMD', 'PLTR', 2),
      claim('c3', 'u2', 'META', 'SHOP', 1),
    ];
    const { db, captured } = makeDb({ groupDoc: group, claims });
    await processClaimsForTournamentGroup(db, group, { now: NOW });

    // Back-rotation: u1's second claim resolves AFTER u2's first.
    const logResults = captured.groupUpdates[0]['claimSystem.processingLog'].at(-1).results;
    expect(logResults.map(r => `${r.odUserId}:${r.addSymbol}:${r.status}`)).toEqual([
      'u1:COIN:approved',
      'u2:SHOP:approved',
      'u1:PLTR:approved',
    ]);
  });

  it('drop_not_on_roster denies and front-retries the next claim', async () => {
    const group = battleGroup();
    const claims = [
      claim('c1', 'u1', 'GHOST', 'COIN', 1), // GHOST is not on u1's roster
      claim('c2', 'u1', 'NVDA', 'PLTR', 2),
    ];
    const { db, captured } = makeDb({ groupDoc: group, claims });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });

    expect(result).toMatchObject({ approved: 1, denied: 1 });
    const byId = Object.fromEntries(captured.claimUpdates.map(u => [u.id, u]));
    expect(byId.c1).toMatchObject({ status: 'denied', denialReason: 'drop_not_on_roster' });
    expect(byId.c2).toMatchObject({ status: 'approved' });
  });
});

describe('processClaimsForTournamentGroup — guards and rider #5', () => {
  it('idempotency: the legacy guard (imported as-is) skips an already-processed derived day', async () => {
    // day2 banked yesterday → today is derived day 3; lastProcessedDay 3 → skip.
    const group = battleGroup({
      dailyScores: { day2: { closeScores: {}, recordedDate: '2026-06-09' } },
      claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [], lastProcessedDay: 3 },
    });
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });

    expect(result).toEqual({ status: 'already_processed', day: 3, processed: 0 });
    expect(captured.claimUpdates).toHaveLength(0);
    expect(captured.groupUpdates).toHaveLength(0);
  });

  it('no pending claims → no_claims, zero writes; missing/non-battle groups skip', async () => {
    const empty = makeDb({ groupDoc: battleGroup(), claims: [] });
    expect(await processClaimsForTournamentGroup(empty.db, battleGroup(), { now: NOW }))
      .toEqual({ status: 'no_claims', processed: 0 });
    expect(empty.captured.groupUpdates).toHaveLength(0);

    expect(await processClaimsForTournamentGroup(makeDb().db, { id: 'group-1' }, { now: NOW }))
      .toMatchObject({ status: 'skipped', reason: 'group_not_found' });

    const forming = makeDb({ groupDoc: battleGroup({ status: 'forming' }) });
    expect(await processClaimsForTournamentGroup(forming.db, battleGroup(), { now: NOW }))
      .toMatchObject({ status: 'skipped', reason: 'not_battle' });
  });

  it('rider #5 "resolved": one transactional group write — roster, pool, lastProcessedDay, and the waiver-snapshot log entry', async () => {
    const group = battleGroup({
      dailyScores: {
        day1: { // derived day 2; ascending standings → u4, u3, u2, u1
          closeScores: {
            u1: { totalPoints: 30 }, u2: { totalPoints: 20 },
            u3: { totalPoints: 10 }, u4: { totalPoints: 0 },
          },
          recordedDate: '2026-06-09',
        },
      },
    });
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    await processClaimsForTournamentGroup(db, group, { now: NOW });

    expect(captured.groupUpdates).toHaveLength(1);
    const update = captured.groupUpdates[0];
    expect(Object.keys(update).sort()).toEqual([
      'claimSystem.lastProcessedDay',
      'claimSystem.processingLog',
      'players',
      'updatedAt',
      'userPool',
    ]);
    expect(update['claimSystem.lastProcessedDay']).toBe(2);

    const logEntry = update['claimSystem.processingLog'].at(-1);
    expect(logEntry).toMatchObject({ day: 2, processedAt: NOW_ISO });
    expect(logEntry.waiverPriority).toEqual(['u4', 'u3', 'u2', 'u1']); // the order snapshot (priority context)
    expect(logEntry.results).toEqual([
      { odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', status: 'approved', reason: null },
    ]);
  });
});
