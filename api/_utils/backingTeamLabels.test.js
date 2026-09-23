// api/_utils/backingTeamLabels.test.js
//
// D-af (Amendment C §C1) — the ONE team-label resolver: a team is named by
// its primary agent, the player's display name secondary; fallback the
// player's display name, then "Unnamed team"; never a raw account id.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the module
// below is the runtime guard for its api/ -> src/ imports
// (src/constants/leagueTournament.js, src/constants/backing.js). Never mock it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  OWNER_LOOKUP_CHUNK,
  looksLikeAccountId,
  primaryAgentDocFrom,
  resolveTeamLabels,
} from './backingTeamLabels.js';
import { UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';
import { cpuDisplayName } from './tournamentLeaderboard.js';

// Firebase-uid-shaped seat ids (28 alphanumerics), the production shape.
const ADA = 'AdaLovelace0000000000000001a';
const BO = 'BoDiddley00000000000000002bb';
const CY = 'CyHarrison000000000000003ccc';
expect([ADA, BO, CY].every((id) => /^[A-Za-z0-9]{28}$/.test(id))).toBe(true);

/**
 * A counting Firestore double: doc gets, `==` / `in` queries, and — unless
 * `getAll: false` — the Admin SDK's batched `getAll`. Every read is logged so
 * the batching rows can count them.
 */
function fakeDb(docs = {}, { getAll = true, failAgents = false, failUsers = false } = {}) {
  const log = [];
  const read = (path) => {
    const data = docs[path];
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => (data === undefined ? undefined : structuredClone(data)) };
  };
  const fail = (path) => (failAgents && path.startsWith('agents')) || (failUsers && path.startsWith('users'));
  const docRef = (path) => ({
    path,
    get: async () => { log.push(['get', path]); if (fail(path)) throw new Error('unavailable'); return read(path); },
  });
  const query = (col, filters) => ({
    where: (field, op, value) => query(col, [...filters, { field, op, value }]),
    get: async () => {
      log.push(['query', col, filters.map((f) => `${f.field} ${f.op} ${JSON.stringify(f.value)}`).join(' & ')]);
      if (fail(col)) throw new Error('unavailable');
      // DOCUMENT-ID ORDER, as Firestore answers a query with no orderBy — the
      // order board production's `qs.docs.find(...)` inherits, so a double
      // answering in insertion order would make the parity row below
      // compare two different selections.
      const out = Object.keys(docs)
        .filter((p) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes('/'))
        .sort()
        .map((p) => ({ id: p.slice(col.length + 1), data: () => structuredClone(docs[p]) }))
        .filter((d) => filters.every((f) => (f.op === 'in' ? f.value.includes(d.data()[f.field]) : d.data()[f.field] === f.value)));
      return { docs: out, empty: out.length === 0, size: out.length, forEach: (cb) => out.forEach(cb) };
    },
  });
  const db = {
    log,
    collection: (col) => ({ doc: (id) => docRef(`${col}/${id}`), where: (field, op, value) => query(col, [{ field, op, value }]) }),
  };
  if (getAll) {
    db.getAll = async (...refs) => {
      log.push(['getAll', refs.map((r) => r.path)]);
      if (refs.some((r) => fail(r.path))) throw new Error('unavailable');
      return refs.map((r) => read(r.path));
    };
  }
  return db;
}

const WORLD = () => ({
  // Ada: a primary agent AND a profile.
  'agents/agt-ada-1': { ownerId: ADA, name: 'Shadow' },
  [`users/${ADA}`]: { username: 'ada', displayName: 'Ada L.' },
  // Bo: a profile, no agent at all.
  [`users/${BO}`]: { displayName: 'Bo' },
  // Cy: neither an agent nor a profile.
});

afterEach(() => vi.restoreAllMocks());

// ============================================================================
describe('the chain — agent name, player secondary, then the player, then "Unnamed team" (§C1)', () => {
  it('a human with a primary agent is named by the AGENT, the player secondary', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: ADA }]);
    expect(teamLabelFor({ odUserId: ADA })).toEqual({ label: 'Shadow', secondary: 'ada' });
  });

  it('no agent → the PLAYER\'S display name is the label, with no secondary', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: BO }]);
    expect(teamLabelFor({ odUserId: BO })).toEqual({ label: 'Bo', secondary: null });
  });

  it('neither → the neutral "Unnamed team" — NEVER the account id', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: CY }]);
    expect(teamLabelFor({ odUserId: CY })).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null });
    expect(JSON.stringify(teamLabelFor({ odUserId: CY }))).not.toContain(CY);
  });

  it('a CPU seat is its agent name — the one CPU label format, and it costs no read', async () => {
    const db = fakeDb(WORLD());
    const { teamLabelFor } = await resolveTeamLabels(db, [{ odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-1' }]);
    expect(teamLabelFor({ odUserId: 'cpu-3', isCpu: true })).toEqual({ label: cpuDisplayName('cpu-3'), secondary: null });
    expect(teamLabelFor({ odUserId: 'cpu-1' }).label).toBe(cpuDisplayName('cpu-1'));
    expect(teamLabelFor({ odUserId: 'cpu-1' }).label).toMatch(/^CPU — /);
    expect(db.log).toEqual([]);
  });

  it('the pod\'s own seat name is the player name when the caller has one — no profile read for that seat', async () => {
    const db = fakeDb(WORLD());
    const { teamLabelFor } = await resolveTeamLabels(db, [{ odUserId: ADA, seatName: 'Ada (slot)' }]);
    expect(teamLabelFor({ odUserId: ADA, seatName: 'Ada (slot)' })).toEqual({ label: 'Shadow', secondary: 'Ada (slot)' });
    expect(db.log.flatMap(([, p]) => (Array.isArray(p) ? p : [p])).some((p) => String(p).startsWith('users/'))).toBe(false);
  });

  it('username first, then displayName — the leaderboard\'s and the client\'s order', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb({ [`users/${BO}`]: { username: 'bo_d', displayName: 'Bo' } }), [{ odUserId: BO }]);
    expect(teamLabelFor({ odUserId: BO }).label).toBe('bo_d');
  });
});

// ============================================================================
describe('after settlement — the RECORDED agent names the team (§C1)', () => {
  it('settlement\'s recorded agentId wins over the owner\'s CURRENT primary agent', async () => {
    const world = { ...WORLD(), 'agents/agt-ada-0': { ownerId: ADA, name: 'Old Guard' } };
    // The owner's primary is now agt-ada-0 (it sorts first); the week was played by agt-ada-1.
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(world), [{ odUserId: ADA, agentId: 'agt-ada-1' }]);
    expect(teamLabelFor({ odUserId: ADA, agentId: 'agt-ada-1' })).toEqual({ label: 'Shadow', secondary: 'ada' });
  });

  it('a recorded agent that is GONE falls to the player — never relabelled with an agent that did not play the week', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: ADA, agentId: 'agt-deleted' }]);
    expect(teamLabelFor({ odUserId: ADA, agentId: 'agt-deleted' })).toEqual({ label: 'ada', secondary: null });
  });

  it('board production\'s SYNTHETIC id (`dev-agent-{uid}`) is never shown — it has no document, so the player names the team', async () => {
    const synthetic = `dev-agent-${BO}`;
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: BO, agentId: synthetic }]);
    const out = teamLabelFor({ odUserId: BO, agentId: synthetic });
    expect(out).toEqual({ label: 'Bo', secondary: null });
    expect(JSON.stringify(out)).not.toContain(BO);
  });
});

// ============================================================================
describe('the owner lookup is board production\'s, clones excluded', () => {
  it('takes the FIRST non-clone agent in document-id order', () => {
    const docs = [
      { id: 'b-agent', data: () => ({ name: 'B' }) },
      { id: 'a-agent', data: () => ({ name: 'A' }) },
    ];
    expect(primaryAgentDocFrom(docs)).toEqual({ id: 'a-agent', data: { name: 'A' } });
  });

  it('skips a training clone, a casual clone, and a clone BY ID even when they sort first', () => {
    const docs = [
      { id: 'a0', data: () => ({ name: 'Training', isTrainingClone: true }) },
      { id: 'a1', data: () => ({ name: 'Casual', isCasualClone: true }) },
      { id: 'casual-agent-x', data: () => ({ name: 'CasualById' }) },
      { id: 'training-agent-g-x', data: () => ({ name: 'TrainingById' }) },
      { id: 'z-real', data: () => ({ name: 'Real' }) },
    ];
    expect(primaryAgentDocFrom(docs)?.data.name).toBe('Real');
    expect(primaryAgentDocFrom(docs.slice(0, 4))).toBeNull();
    expect(primaryAgentDocFrom([])).toBeNull();
  });

  it('agrees with board production\'s own resolveGroupAgents on the same documents (§C1: "the same owner lookup")', async () => {
    const { resolveGroupAgents } = await import('./tournamentAgentBoards.js');
    const world = {
      'agents/m-real': { ownerId: ADA, name: 'Shadow' },
      'agents/a-clone': { ownerId: ADA, name: 'Clone', isTrainingClone: true },
      'agents/b-casual': { ownerId: ADA, name: 'Casual', isCasualClone: true },
      'agents/c-second': { ownerId: BO, name: 'Second' },
      'agents/b-first': { ownerId: BO, name: 'First' },
    };
    const db = fakeDb(world);
    const board = await resolveGroupAgents(db, { id: 'g', groupMembers: [ADA, BO] });
    const { primaryAgentFor, teamLabelFor } = await resolveTeamLabels(db, [{ odUserId: ADA }, { odUserId: BO }]);
    for (const seat of board) {
      expect(primaryAgentFor(seat.odUserId)?.id, seat.odUserId).toBe(seat.agentId);
      expect(teamLabelFor({ odUserId: seat.odUserId }).label).toBe(seat.agent.name);
    }
  });
});

// ============================================================================
describe('NEVER A RAW ACCOUNT ID — every candidate name is refused when it is one', () => {
  it('a profile whose name IS the uid, or a uid\'s shape, or a CPU id, is not a name', async () => {
    for (const username of [CY, 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', 'cpu-4', '   ']) {
      const { teamLabelFor } = await resolveTeamLabels(fakeDb({ [`users/${CY}`]: { username } }), [{ odUserId: CY }]);
      expect(teamLabelFor({ odUserId: CY }), username).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null });
    }
  });

  it('an agent whose name IS its own id or the owner\'s uid is not a name', async () => {
    for (const name of ['agt-cy', CY]) {
      const world = { 'agents/agt-cy': { ownerId: CY, name }, [`users/${CY}`]: { username: 'cy' } };
      const { teamLabelFor } = await resolveTeamLabels(fakeDb(world), [{ odUserId: CY }]);
      expect(teamLabelFor({ odUserId: CY }), name).toEqual({ label: 'cy', secondary: null });
    }
  });

  it('a seat name that is an id is ignored — the profile answers instead', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD()), [{ odUserId: BO, seatName: BO }]);
    expect(teamLabelFor({ odUserId: BO, seatName: BO })).toEqual({ label: 'Bo', secondary: null });
  });

  it('looksLikeAccountId: the two production id shapes and the named ids, and nothing else', () => {
    expect(looksLikeAccountId(ADA)).toBe(true);
    expect(looksLikeAccountId('cpu-12')).toBe(true);
    expect(looksLikeAccountId('agt-1', ['agt-1'])).toBe(true);
    expect(looksLikeAccountId('')).toBe(true);
    expect(looksLikeAccountId(null)).toBe(true);
    expect(looksLikeAccountId('Shadow')).toBe(false);
    expect(looksLikeAccountId('CPU — Contrarian')).toBe(false);
    expect(looksLikeAccountId('cpu-lover')).toBe(false);
  });

  it('an empty or malformed seat still answers a word', async () => {
    const { teamLabelFor } = await resolveTeamLabels(fakeDb({}), []);
    expect(teamLabelFor({})).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null });
    expect(teamLabelFor({ odUserId: 'cpu-x', isCpu: true })).toEqual({ label: 'CPU', secondary: null });
  });
});

// ============================================================================
describe('BATCHED PER RESPONSE — no per-row reads', () => {
  it('one getAll for the recorded agents, one owner query, one getAll for the profiles — however many rows name them', async () => {
    const world = { ...WORLD(), 'agents/agt-bo': { ownerId: BO, name: 'Bolt' } };
    const db = fakeDb(world);
    const seats = [
      { odUserId: ADA }, { odUserId: ADA }, { odUserId: BO }, { odUserId: CY },
      { odUserId: BO, agentId: 'agt-bo' }, { odUserId: 'cpu-1' }, { odUserId: 'cpu-2' },
    ];
    const { teamLabelFor } = await resolveTeamLabels(db, seats);
    expect(db.log.filter(([kind]) => kind === 'query')).toHaveLength(1);
    expect(db.log.filter(([kind]) => kind === 'get')).toHaveLength(0);
    const getAlls = db.log.filter(([kind]) => kind === 'getAll');
    expect(getAlls).toHaveLength(2);                       // agents by id, profiles by id
    expect(getAlls.map(([, paths]) => paths)).toContainEqual(['agents/agt-bo']);
    // De-duplicated: each profile read once, even though ADA and BO recur.
    expect(getAlls.find(([, paths]) => paths[0].startsWith('users/'))[1].sort()).toEqual([`users/${ADA}`, `users/${BO}`, `users/${CY}`]);
    // …and every later call is pure.
    const before = db.log.length;
    expect(teamLabelFor({ odUserId: BO, agentId: 'agt-bo' })).toEqual({ label: 'Bolt', secondary: 'Bo' });
    expect(db.log.length).toBe(before);
  });

  it('the owner lookup is chunked to Firestore\'s `in` limit', async () => {
    const owners = Array.from({ length: OWNER_LOOKUP_CHUNK + 1 }, (_, i) => `owner${String(i).padStart(23, '0')}`);
    const db = fakeDb({});
    await resolveTeamLabels(db, owners.map((odUserId) => ({ odUserId })));
    expect(db.log.filter(([kind]) => kind === 'query')).toHaveLength(2);
  });

  it('without getAll (a plain handle) the same reads run as parallel gets — same answers', async () => {
    const db = fakeDb(WORLD(), { getAll: false });
    const { teamLabelFor } = await resolveTeamLabels(db, [{ odUserId: ADA }, { odUserId: BO }, { odUserId: CY }]);
    expect(teamLabelFor({ odUserId: ADA })).toEqual({ label: 'Shadow', secondary: 'ada' });
    expect(teamLabelFor({ odUserId: BO })).toEqual({ label: 'Bo', secondary: null });
    expect(teamLabelFor({ odUserId: CY })).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null });
  });
});

// ============================================================================
describe('a failed read degrades a rung — it never throws, and it never answers an id', () => {
  it('the agents collection unreadable → the player names the team', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD(), { failAgents: true }), [{ odUserId: ADA }, { odUserId: ADA, agentId: 'agt-ada-1' }]);
    expect(teamLabelFor({ odUserId: ADA })).toEqual({ label: 'ada', secondary: null });
    expect(teamLabelFor({ odUserId: ADA, agentId: 'agt-ada-1' })).toEqual({ label: 'ada', secondary: null });
  });

  it('the profiles unreadable → the agent names the team, and a seat with neither is "Unnamed team"', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { teamLabelFor } = await resolveTeamLabels(fakeDb(WORLD(), { failUsers: true }), [{ odUserId: ADA }, { odUserId: BO }]);
    expect(teamLabelFor({ odUserId: ADA })).toEqual({ label: 'Shadow', secondary: null });
    expect(teamLabelFor({ odUserId: BO })).toEqual({ label: UNNAMED_TEAM_LABEL, secondary: null });
  });
});
