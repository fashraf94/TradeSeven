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
// Real banking module (never mocked — dependency-surface guard applies):
// the standing-invariant test below runs claims and banking end-to-end.
import { computeBankingUpdate } from './tournamentBanking.js';
// Real CPU heuristic (Slice 4): the training full-path test below has the CPU
// "place" via the actual drop-worst/desirable-add decision, not a hand-built
// claim — so the inherited engine is exercised against a genuine CPU contest.
import { chooseCpuClaim } from './tournamentCpuClaims.js';

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
    // claims → claim-doc refs; streams/ledger (P6b double-down reads) →
    // non-existent docs so detection degrades to no events cleanly.
    collection: (sub) => ({
      where: () => pendingQuery,
      doc: (id) => (sub === 'claims'
        ? { __claimId: id }
        : { get: async () => ({ exists: false, data: () => null }) }),
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
      set: () => {}, // ledger doubleDowns write (only when a double-down fires)
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
        // canonical-open capture provenance — present-null on a fresh leg
        baselineCapturedAt: null,
        baselinePriceTimestamp: null,
        captureJobId: null,
        baselineSession: null,
        instrumentId: null,
        captureState: null,
      }],
      flipCountToday: 0,
    });
  });

  it('the dropped pick\'s realized value is PRESERVED (ruling #1): banked legs survive, the live leg closes bank-pending', async () => {
    const group = battleGroup();
    // u1's NVDA carries +45 banked across a closed leg and a live leg with accrual.
    group.players[0].picks[0] = {
      symbol: 'NVDA',
      legs: [
        { direction: 'short', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [], closedAt: 'T1', bankedScore: 45 },
        { direction: 'long', baselinePrice: 98, baselineSource: 'flip_market_open', openedAt: 'T1', thresholdHistory: [] },
      ],
      flipCountToday: 1,
      flipCountDate: '2026-06-09',
    };
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    await processClaimsForTournamentGroup(db, group, { now: NOW });

    const u1 = captured.groupUpdates[0].players.find(p => p.odUserId === 'u1');
    expect(u1.picks[0].symbol).toBe('COIN'); // roster slot holds the won name
    expect(u1.droppedPicks).toHaveLength(1);

    const dropped = u1.droppedPicks[0];
    expect(dropped.symbol).toBe('NVDA');
    expect(dropped.legs[0].bankedScore).toBe(45); // banked value intact
    // The live leg closed bank-pending at execution — banked at the next
    // session open by the banking pass (the pre-open exit price).
    expect(dropped.legs[1].closedAt).toBe(NOW_ISO);
    expect('bankedScore' in dropped.legs[1]).toBe(false);
  });

  it('STANDING INVARIANT (end-to-end, ruling #1): with prices held constant, a claim NEVER decreases cumulative standing', async () => {
    // The only variable between the two banking computations is the claim
    // itself: every price is identical (and open === current, so the live
    // leg's accrual converts 1:1 into the exit leg's banked score).
    const quotes = {
      NVDA: { open: 104, close: 104, current: 104, previousClose: 100, timestamp: 1 },
      COIN: { open: 50, close: 50, current: 50, previousClose: 50, timestamp: 1 },
    };
    const bankOpts = { nowIso: NOW_ISO, etDate: '2026-06-10', atrPercentiles: null, recordedBy: 'cron' };

    const group = battleGroup();
    // u1's NVDA carries realized value (+45 banked) AND live accrual (98 → 104).
    group.players[0].picks[0] = {
      symbol: 'NVDA',
      legs: [
        { direction: 'short', baselinePrice: 90, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [], closedAt: 'T1', bankedScore: 45 },
        { direction: 'long', baselinePrice: 98, baselineSource: 'flip_market_open', openedAt: 'T1', thresholdHistory: [] },
      ],
      flipCountToday: 0,
    };

    const before = computeBankingUpdate(group, quotes, bankOpts)
      .dayEntry.closeScores.u1.totalPoints;
    expect(before).toBeGreaterThan(45); // banked + live accrual both present

    // Real claims transaction approves: drop NVDA, add COIN.
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });
    expect(result.status).toBe('processed');
    expect(result.approved).toBe(1);

    const groupAfter = { ...group, ...captured.groupUpdates[0] };
    const after = computeBankingUpdate(groupAfter, quotes, bankOpts)
      .dayEntry.closeScores.u1.totalPoints;

    expect(after).toBeGreaterThanOrEqual(before); // the invariant
    expect(after).toBe(before); // and at held prices, exactly: nothing was erased
  });

  it('claims_disabled: the pause switch is honored in-transaction (covers the manual trigger path)', async () => {
    const group = battleGroup({
      claimSystem: { enabled: false, currentWaiverPriority: [], processingLog: [] },
    });
    const { db, captured } = makeDb({ groupDoc: group, claims: [claim('c1', 'u1', 'NVDA', 'COIN')] });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });
    expect(result).toEqual({ status: 'skipped', reason: 'claims_disabled', processed: 0 });
    expect(captured.claimUpdates).toHaveLength(0);
    expect(captured.groupUpdates).toHaveLength(0);
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

// ==================== LEAGUE TRAINING (SLICE 4, 5-A) ====================
//
// The inherited engine has never executed against a live pod; this proves it
// end-to-end on an isTraining pod — place (human + a REAL CPU decision,
// contested) → resolve (waiver priority decides) → drop-to-pool → bank
// (claim_execution baseline settles at the open; the dropped pick is retained).
describe('League Training (5-A): the inherited engine on an isTraining pod, end to end', () => {
  it('human + CPU contest the same name → resolve → drop-to-pool → bank settles the won leg at the open', async () => {
    const group = battleGroup({
      isTraining: true,
      groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'],
      players: [
        { odUserId: 'u1', picks: [pickState('NVDA'), pickState('AMD'), pickState('TSLA')] },
        { odUserId: 'cpu-1', isCpu: true, picks: [pickState('META'), pickState('AAPL'), pickState('MSFT')] },
        { odUserId: 'cpu-2', isCpu: true, picks: [pickState('AMZN'), pickState('GOOG'), pickState('NFLX')] },
        { odUserId: 'cpu-3', isCpu: true, picks: [pickState('AVGO'), pickState('CRM'), pickState('ORCL')] },
      ],
      userPool: ['COIN', 'PLTR', 'SHOP', 'UBER'],
      // u1 has the lower standing → first on the wire (ruling #3, ascending).
      claimSystem: { enabled: true, currentWaiverPriority: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'], processingLog: [] },
    });

    // The CPU "places" via the REAL heuristic: its worst pick is MSFT (-8); its
    // ranked board over this pool heads on COIN — so it contests the human.
    const cpuChoice = chooseCpuClaim({
      player: group.players[1],
      closeScoresEntry: { picks: [{ symbol: 'META', totalPoints: 9 }, { symbol: 'AAPL', totalPoints: 4 }, { symbol: 'MSFT', totalPoints: -8 }] },
      userPool: ['COIN', 'PLTR', 'SHOP', 'UBER'],
      cpuN: 1,
    });
    expect(cpuChoice).toEqual({ dropSymbol: 'MSFT', addSymbol: 'COIN' });

    const claims = [
      claim('h1', 'u1', 'NVDA', 'COIN', 1),                              // human
      claim('c1', 'cpu-1', cpuChoice.dropSymbol, cpuChoice.addSymbol, 1), // CPU (contests COIN)
    ];
    const { db, captured } = makeDb({ groupDoc: group, claims });
    const result = await processClaimsForTournamentGroup(db, group, { now: NOW });
    expect(result).toMatchObject({ status: 'processed', approved: 1, denied: 1 });

    const byId = Object.fromEntries(captured.claimUpdates.map(u => [u.id, u]));
    expect(byId.h1.status).toBe('approved');                            // u1 wins COIN on priority
    expect(byId.c1).toMatchObject({ status: 'denied', denialReason: 'claimed_by_higher_priority' });

    const after = captured.groupUpdates[0];
    const u1 = after.players.find(p => p.odUserId === 'u1');
    expect(u1.picks[0]).toMatchObject({ symbol: 'COIN', legs: [{ baselinePrice: null, baselineSource: 'claim_execution' }] });
    expect(u1.droppedPicks.map(p => p.symbol)).toEqual(['NVDA']);
    expect(after.userPool).toEqual(['PLTR', 'SHOP', 'UBER', 'NVDA']);   // COIN out, NVDA back to pool

    // Bank the resolved pod: the claim_execution null baseline settles to the
    // open, and the dropped NVDA is retained for scoring (cumulative model).
    const groupAfter = { ...group, ...after };
    const quotes = {
      COIN: { open: 50, close: 50, current: 50, previousClose: 50, timestamp: 1 },
      NVDA: { open: 100, close: 100, current: 100, previousClose: 100, timestamp: 1 },
      AMD: { open: 80, close: 80, current: 80, previousClose: 80, timestamp: 1 },
      TSLA: { open: 200, close: 200, current: 200, previousClose: 200, timestamp: 1 },
    };
    const banked = computeBankingUpdate(groupAfter, quotes, { nowIso: NOW_ISO, etDate: '2026-06-10', atrPercentiles: null, recordedBy: 'cron' });
    const u1Banked = banked.players.find(p => p.odUserId === 'u1');
    const coin = u1Banked.picks.find(p => p.symbol === 'COIN');
    expect(coin.legs[0].baselinePrice).toBe(50);                       // settled to the open
    expect(u1Banked.droppedPicks.map(p => p.symbol)).toEqual(['NVDA']); // dropped pick retained
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
