// api/_utils/huddle/players.test.js
//
// Huddle — who gets a huddle (spec V1.1 §5.4): every human owner with an active game, a game completed in the last five
// sessions, or a deploy in that window, CPU seats out — INTERSECTED with the Huddle's own cohort, HUDDLE_PLAYER_UIDS
// (Amendment E §E7). The cohort fails closed: unset or blank enqueues no one and reads nothing.

import { describe, it, expect } from 'vitest';
import { enumerateActivePlayers } from './players.js';

function memoryDb({ active = [], completed = [], deployed = [] }) {
  const reads = [];
  const docs = (rows) => ({ size: rows.length, docs: rows.map((r) => ({ data: () => r })) });
  return {
    reads,
    collection: (name) => ({
      where: (field) => ({
        get: async () => {
          reads.push(`${name}.${field}`);
          return name === 'agents' ? docs(deployed) : field === 'status' ? docs(active) : docs(completed);
        },
      }),
    }),
  };
}
const rows = () => ({
  active: [{ ownerId: 'u-b' }, { ownerId: 'cpu-1', isCpu: true }],
  completed: [{ ownerId: 'u-a' }],
  deployed: [{ ownerId: 'u-c' }],
});

describe('enumerateActivePlayers — the cohort (E7)', () => {
  it('cohort UNSET: no one, and nothing is read', async () => {
    const db = memoryDb(rows());
    const r = await enumerateActivePlayers(db, { etDate: '2026-11-09', env: {} });
    expect(r.uids).toEqual([]);
    expect(db.reads).toEqual([]);
  });

  it('cohort EMPTY or blank: no one, and nothing is read', async () => {
    for (const raw of ['', '   ', ' , ,']) {
      const db = memoryDb(rows());
      const r = await enumerateActivePlayers(db, { etDate: '2026-11-09', env: { HUDDLE_PLAYER_UIDS: raw } });
      expect(r.uids, JSON.stringify(raw)).toEqual([]);
      expect(db.reads).toEqual([]);
    }
  });

  it('a cohort with no active player in it: the active players are read, and no one is enqueued (all outside)', async () => {
    const r = await enumerateActivePlayers(memoryDb(rows()), { etDate: '2026-11-09', env: { HUDDLE_PLAYER_UIDS: 'u-z' } });
    expect(r.uids).toEqual([]);
    expect(r.outsideCohort).toBe(3);
  });

  it('INSIDE: only the cohort members who are active players, sorted; CPU seats out; an inactive cohort member is not enqueued', async () => {
    const r = await enumerateActivePlayers(memoryDb(rows()), { etDate: '2026-11-09', env: { HUDDLE_PLAYER_UIDS: ' u-c , u-b , u-z ' } });
    expect(r.uids).toEqual(['u-b', 'u-c']);
    expect(r.skippedCpu).toBe(1);
    expect(r.outsideCohort).toBe(1);
  });

  it('an explicit cohort set wins over the env', async () => {
    const r = await enumerateActivePlayers(memoryDb(rows()), { etDate: '2026-11-09', env: {}, cohort: new Set(['u-a', 'u-b', 'u-c']) });
    expect(r.uids).toEqual(['u-a', 'u-b', 'u-c']);
  });
});
