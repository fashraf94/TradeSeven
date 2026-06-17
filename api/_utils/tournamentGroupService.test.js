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
  getPlayer,
} from './tournamentGroupService.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

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
