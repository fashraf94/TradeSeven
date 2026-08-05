// api/_utils/tournamentGroupService.test.js
//
// Group lifecycle + creation-shape tests.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentGroupService module below is the runtime guard for its
// api/ -> src/ import of src/constants/leagueTournament.js — it explodes in
// this Node test environment if a browser-only dependency ever enters that
// transitive graph. Never mock this import.

import { describe, it, expect } from 'vitest';
import {
  LEGAL_TRANSITIONS,
  assertTransition,
  createGroup,
  getGroup,
  transitionStatus,
  expireGroup,
  voidGroup,
  fetchEligibleGroupsByStatus,
  getPlayer,
} from './tournamentGroupService.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';

const NOW = '2026-06-15T13:30:00.000Z';

function makePlayers() {
  return [
    { odUserId: 'user-a', picks: [] },
    { odUserId: 'user-b', picks: [] },
    { odUserId: 'user-c', picks: [] },
    { odUserId: 'user-d', picks: [] },
  ];
}

function makeGroupArgs(overrides = {}) {
  return {
    players: makePlayers(),
    userPool: ['NVDA', 'AMD', 'TSLA'],
    roundNumber: 1,
    baseLayerWeek: '2026-W25',
    now: NOW,
    ...overrides,
  };
}

// Minimal Firestore stand-in (harness precedent:
// api/cron/baggerbomb-v4-daily-scores.test.js makeDb). Captures writes;
// serves one stored doc; runTransaction passes a tx whose update is captured.
function makeDb({ storedDoc = null } = {}) {
  const captured = { collection: null, sets: [], updates: [] };
  const ref = {
    id: 'group-1',
    set: async (data) => { captured.sets.push(data); },
    get: async () => ({
      exists: storedDoc != null,
      id: 'group-1',
      data: () => storedDoc,
    }),
  };
  const db = {
    collection: (name) => {
      captured.collection = name;
      return { doc: () => ref };
    },
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      update: (_r, data) => { captured.updates.push(data); },
    }),
  };
  return { db, captured };
}

// ==================== TRANSITION TABLE ====================

describe('status lifecycle (P1 table + League Training Slice 1/2 additive edges)', () => {
  const ALL = Object.values(GROUP_STATUS);
  const LEGAL = [
    ['forming', 'drafting'],
    ['forming', 'battle'], // P1 single-shot resolution path
    ['forming', 'awaiting_open'], // Training Slice 1: on-demand resolve-to-awaiting
    ['awaiting_open', 'battle'], // Training Slice 1: the next-market-open flip
    ['drafting', 'battle'], // P1-reserved + Training Slice 2 inline completion-flip (today-anchor)
    ['drafting', 'awaiting_open'], // Training Slice 2: the interactive-draft completion handoff
    ['battle', 'complete'],
    ['forming', 'expired'], // Training-Pod P0 R2: expire a stale/abandoned pre-BATTLE pod
    ['drafting', 'expired'], // Training-Pod P0 R2
    ['awaiting_open', 'expired'], // Training-Pod P0 R2
    ['battle', 'voided'], // L-A: poisoned-cohort void — the only BATTLE exit besides complete
  ];

  it('exactly these pairs are legal — every other pair throws (forward-only)', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const legal = LEGAL.some(([f, t]) => f === from && t === to);
        if (legal) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(/illegal transition/);
        }
      }
    }
  });

  it('unknown statuses are rejected, never silently allowed', () => {
    expect(() => assertTransition('paused', 'battle')).toThrow(/unknown status/);
  });

  it('table covers every GROUP_STATUS value', () => {
    expect(Object.keys(LEGAL_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });
});

// ==================== CREATE / READ ====================

describe('createGroup', () => {
  it('writes the factory doc to tournamentGroups and returns {id, doc}', async () => {
    const { db, captured } = makeDb();
    const { id, doc } = await createGroup(db, makeGroupArgs());
    expect(id).toBe('group-1');
    expect(captured.collection).toBe('tournamentGroups');
    expect(captured.sets).toHaveLength(1);
    expect(captured.sets[0]).toEqual(doc);
    expect(doc.status).toBe(GROUP_STATUS.FORMING);
    expect(doc.groupMembers).toEqual(['user-a', 'user-b', 'user-c', 'user-d']);
  });

  it('factory guards propagate — invalid shapes never reach the write', async () => {
    const { db, captured } = makeDb();
    await expect(createGroup(db, makeGroupArgs({ players: makePlayers().slice(0, 2) })))
      .rejects.toThrow(/exactly 4/);
    expect(captured.sets).toHaveLength(0);
  });

  it('threads isTraining through to the written doc (Next-Arc Slice 3.0)', async () => {
    const { db, captured } = makeDb();
    const { doc } = await createGroup(db, makeGroupArgs({ isTraining: true }));
    expect(doc.isTraining).toBe(true);
    expect(captured.sets[0].isTraining).toBe(true);
  });
});

describe('getGroup', () => {
  it('returns {id, ...data} when present, null when absent', async () => {
    const stored = { status: 'forming', roundNumber: 1 };
    expect(await getGroup(makeDb({ storedDoc: stored }).db, 'group-1'))
      .toEqual({ id: 'group-1', status: 'forming', roundNumber: 1 });
    expect(await getGroup(makeDb().db, 'group-1')).toBeNull();
  });
});

// ==================== TRANSITION EXECUTION ====================

describe('transitionStatus', () => {
  it('legal transition updates status + updatedAt transactionally', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'forming' } });
    await expect(transitionStatus(db, 'group-1', 'battle', NOW)).resolves.toBe('battle');
    expect(captured.updates).toEqual([{ status: 'battle', updatedAt: NOW }]);
  });

  it('illegal transition throws and writes nothing', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'complete' } });
    await expect(transitionStatus(db, 'group-1', 'battle', NOW)).rejects.toThrow(/illegal transition/);
    expect(captured.updates).toHaveLength(0);
  });

  it('missing group and missing now both throw', async () => {
    await expect(transitionStatus(makeDb().db, 'group-1', 'battle', NOW))
      .rejects.toThrow(/not found/);
    await expect(transitionStatus(makeDb({ storedDoc: { status: 'forming' } }).db, 'group-1', 'battle'))
      .rejects.toThrow(/now is required/);
  });
});

// ==================== EXPIRE (Training-Pod P0 R2) ====================

describe('expireGroup', () => {
  it('expires a FORMING pod: writes EXPIRED + marker fields atomically', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'forming', updatedAt: '2026-06-10T00:00:00.000Z' } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale_forming', by: 'cleanup', now: NOW });
    expect(res).toEqual({ groupId: 'group-1', expired: true, status: 'expired' });
    expect(captured.updates).toEqual([{
      status: 'expired', expiredAt: NOW, expiredReason: 'stale_forming', expiredBy: 'cleanup', updatedAt: NOW,
    }]);
  });

  it('expires DRAFTING and AWAITING_OPEN pods (the other two pre-BATTLE states)', async () => {
    for (const status of ['drafting', 'awaiting_open']) {
      const { db, captured } = makeDb({ storedDoc: { status } });
      const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW });
      expect(res.expired).toBe(true);
      expect(captured.updates[0].status).toBe('expired');
    }
  });

  it('REFUSES to expire a BATTLE pod — the expire-vs-advance race is closed by construction (skip, no write)', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'battle' } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW });
    expect(res).toEqual({ groupId: 'group-1', expired: false, status: 'battle', reason: 'not_expirable_from_battle' });
    expect(captured.updates).toHaveLength(0);
  });

  it('is idempotent: re-expiring an EXPIRED pod (and a COMPLETE pod) is a no-op skip, not an error', async () => {
    for (const status of ['expired', 'complete']) {
      const { db, captured } = makeDb({ storedDoc: { status } });
      const res = await expireGroup(db, 'group-1', { reason: 'retry', by: 'sweep', now: NOW });
      expect(res.expired).toBe(false);
      expect(res.reason).toBe(`not_expirable_from_${status}`);
      expect(captured.updates).toHaveLength(0);
    }
  });

  it('version precondition: skips when expectedStatus no longer matches (pod advanced since the caller read it)', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'battle', updatedAt: NOW } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW, expectedStatus: 'awaiting_open' });
    expect(res).toEqual({ groupId: 'group-1', expired: false, status: 'battle', reason: 'status_changed' });
    expect(captured.updates).toHaveLength(0);
  });

  it('version precondition: skips when expectedUpdatedAt no longer matches (pod mutated since the caller read it)', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'drafting', updatedAt: '2026-06-15T14:00:00.000Z' } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW, expectedStatus: 'drafting', expectedUpdatedAt: '2026-06-10T00:00:00.000Z' });
    expect(res.expired).toBe(false);
    expect(res.reason).toBe('version_changed');
    expect(captured.updates).toHaveLength(0);
  });

  it('B2 progressVersion precondition: skips a DRAFTING pod whose version moved since classification (a pick landed) — an active draft never expires', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'drafting', progressVersion: 6 } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW, expectedStatus: 'drafting', expectedProgressVersion: 5 });
    expect(res).toEqual({ groupId: 'group-1', expired: false, status: 'drafting', reason: 'progress_changed' });
    expect(captured.updates).toHaveLength(0);
  });

  it('B2 progressVersion precondition: expires when the version is unchanged (no draft activity since classification)', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'drafting', progressVersion: 5 } });
    const res = await expireGroup(db, 'group-1', { reason: 'stale', by: 'sweep', now: NOW, expectedStatus: 'drafting', expectedProgressVersion: 5 });
    expect(res.expired).toBe(true);
    expect(captured.updates[0].status).toBe('expired');
  });

  it('missing group → {expired:false, reason:not_found}, no write; missing now → throws', async () => {
    const missing = makeDb();
    await expect(expireGroup(missing.db, 'group-1', { now: NOW })).resolves.toEqual(
      { groupId: 'group-1', expired: false, status: null, reason: 'not_found' });
    expect(missing.captured.updates).toHaveLength(0);
    await expect(expireGroup(makeDb({ storedDoc: { status: 'forming' } }).db, 'group-1', {}))
      .rejects.toThrow(/now is required/);
  });
});

// ==================== VOID (L-A poisoned-cohort disposition) ====================

describe('voidGroup', () => {
  it('voids a BATTLE group: writes VOIDED + marker fields atomically to tournamentGroups', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'battle', updatedAt: NOW } });
    const res = await voidGroup(db, 'group-1', { reason: 'poisoned_cohort', by: 'admin', now: NOW, expectedStatus: 'battle', expectedUpdatedAt: NOW });
    expect(res).toEqual({ groupId: 'group-1', voided: true, status: 'voided' });
    expect(captured.collection).toBe('tournamentGroups');
    expect(captured.updates).toEqual([{
      status: 'voided', voidedAt: NOW, voidedReason: 'poisoned_cohort', voidedBy: 'admin', updatedAt: NOW,
    }]);
  });

  it('REFUSES every non-BATTLE status — VOIDED is reachable ONLY from BATTLE (skip, no write)', async () => {
    for (const status of ['forming', 'drafting', 'awaiting_open', 'complete', 'expired']) {
      const { db, captured } = makeDb({ storedDoc: { status, updatedAt: NOW } });
      const res = await voidGroup(db, 'group-1', { reason: 'x', by: 'admin', now: NOW, expectedStatus: status, expectedUpdatedAt: NOW });
      expect(res).toEqual({ groupId: 'group-1', voided: false, status, reason: `not_voidable_from_${status}` });
      expect(captured.updates).toHaveLength(0);
    }
  });

  it('REFUSES a training pod even from BATTLE — VOIDED is the ranked-cohort disposition (skip, no write)', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'battle', isTraining: true, updatedAt: NOW } });
    const res = await voidGroup(db, 'group-1', { reason: 'x', by: 'admin', now: NOW, expectedStatus: 'battle', expectedUpdatedAt: NOW });
    expect(res).toEqual({ groupId: 'group-1', voided: false, status: 'battle', reason: 'training_not_voidable' });
    expect(captured.updates).toHaveLength(0);
  });

  it('is idempotent: re-voiding an already-VOIDED group is a no-op skip, not an error', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'voided', updatedAt: NOW } });
    const res = await voidGroup(db, 'group-1', { reason: 'retry', by: 'admin', now: NOW, expectedStatus: 'voided', expectedUpdatedAt: NOW });
    expect(res).toEqual({ groupId: 'group-1', voided: false, status: 'voided', reason: 'not_voidable_from_voided' });
    expect(captured.updates).toHaveLength(0);
  });

  it('precondition: skips (status_changed) when the doc moved status since the pre-check — no stale mutation', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'complete', updatedAt: NOW } });
    const res = await voidGroup(db, 'group-1', { now: NOW, expectedStatus: 'battle', expectedUpdatedAt: NOW });
    expect(res).toEqual({ groupId: 'group-1', voided: false, status: 'complete', reason: 'status_changed' });
    expect(captured.updates).toHaveLength(0);
  });

  it('precondition: skips (version_changed) when updatedAt moved since the pre-check — no stale mutation', async () => {
    const { db, captured } = makeDb({ storedDoc: { status: 'battle', updatedAt: '2026-08-05T00:00:00.000Z' } });
    const res = await voidGroup(db, 'group-1', { now: NOW, expectedStatus: 'battle', expectedUpdatedAt: '2026-06-01T00:00:00.000Z' });
    expect(res).toEqual({ groupId: 'group-1', voided: false, status: 'battle', reason: 'version_changed' });
    expect(captured.updates).toHaveLength(0);
  });

  it('MANDATORY pins (founder ruling): throws when expectedStatus OR expectedUpdatedAt is absent — never a silent skip', async () => {
    await expect(voidGroup(makeDb({ storedDoc: { status: 'battle', updatedAt: NOW } }).db, 'group-1', { now: NOW, expectedUpdatedAt: NOW }))
      .rejects.toThrow(/expectedStatus and expectedUpdatedAt are REQUIRED/);
    await expect(voidGroup(makeDb({ storedDoc: { status: 'battle', updatedAt: NOW } }).db, 'group-1', { now: NOW, expectedStatus: 'battle' }))
      .rejects.toThrow(/expectedStatus and expectedUpdatedAt are REQUIRED/);
  });

  it('missing group → {voided:false, reason:not_found}, no write; missing now → throws', async () => {
    const missing = makeDb();
    await expect(voidGroup(missing.db, 'group-1', { now: NOW, expectedStatus: 'battle', expectedUpdatedAt: NOW }))
      .resolves.toEqual({ groupId: 'group-1', voided: false, status: null, reason: 'not_found' });
    expect(missing.captured.updates).toHaveLength(0);
    await expect(voidGroup(makeDb({ storedDoc: { status: 'battle' } }).db, 'group-1', { expectedStatus: 'battle', expectedUpdatedAt: NOW }))
      .rejects.toThrow(/now is required/);
  });
});

// ==================== EXPIRED INERTNESS (review Q5) ====================

describe('EXPIRED is inert across the server status queries', () => {
  it('fetchEligibleGroupsByStatus never surfaces an EXPIRED pod to a BATTLE / FORMING / AWAITING_OPEN duty', async () => {
    const four = [{ isCpu: false }, { isCpu: true }, { isCpu: true }, { isCpu: true }];
    const { db } = makeInMemoryDb({
      'tournamentGroups/x': { status: 'expired', isTraining: true, players: four },
      'tournamentGroups/b': { status: 'battle', isTraining: true, players: four },
    });
    // The one shared duty query is exact-equality — every caller passes a live
    // status, never EXPIRED, so a retired pod is invisible to every duty surface.
    expect((await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE)).map(g => g.id)).toEqual(['b']);
    expect(await fetchEligibleGroupsByStatus(db, GROUP_STATUS.FORMING)).toEqual([]);
    expect(await fetchEligibleGroupsByStatus(db, GROUP_STATUS.AWAITING_OPEN)).toEqual([]);
    expect(await fetchEligibleGroupsByStatus(db, GROUP_STATUS.DRAFTING)).toEqual([]);
  });
});

// ==================== MEMBERSHIP ====================

describe('getPlayer', () => {
  const group = { players: makePlayers() };

  it('finds a member, null for outsiders and degenerate groups', () => {
    expect(getPlayer(group, 'user-c')).toEqual({ odUserId: 'user-c', picks: [] });
    expect(getPlayer(group, 'user-z')).toBeNull();
    expect(getPlayer({}, 'user-a')).toBeNull();
    expect(getPlayer(null, 'user-a')).toBeNull();
  });
});
