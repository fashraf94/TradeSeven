// api/_utils/huddle/players.test.js
//
// Huddle S1 — who gets a huddle (spec V1.1 §5.4): every human owner with an active game, a game completed in the last five
// sessions, or a deploy in that window, CPU seats out; and the optional HUDDLE_PLAYER_UIDS scope, so the founder's smoke
// on a preview (which shares the production database) makes one huddle, not one per active player (V1.1 §9).

import { describe, it, expect } from 'vitest';
import { enumerateActivePlayers, playerScopeOf } from './players.js';

function memoryDb({ active = [], completed = [], deployed = [] }) {
  const docs = (rows) => ({ size: rows.length, docs: rows.map((r) => ({ data: () => r })) });
  return {
    collection: (name) => ({
      where: (field) => ({
        get: async () => (name === 'agents' ? docs(deployed) : field === 'status' ? docs(active) : docs(completed)),
      }),
    }),
  };
}
const DB = memoryDb({
  active: [{ ownerId: 'u-b' }, { ownerId: 'cpu-1', isCpu: true }],
  completed: [{ ownerId: 'u-a' }],
  deployed: [{ ownerId: 'u-c' }],
});

describe('enumerateActivePlayers', () => {
  it('unscoped: every human owner, sorted; CPU seats out', async () => {
    const r = await enumerateActivePlayers(DB, { etDate: '2026-11-09', env: {} });
    expect(r.uids).toEqual(['u-a', 'u-b', 'u-c']);
    expect(r.skippedCpu).toBe(1);
    expect(r.scoped).toBe(0);
  });

  it('HUDDLE_PLAYER_UIDS keeps only the listed players (blank means unscoped)', async () => {
    const r = await enumerateActivePlayers(DB, { etDate: '2026-11-09', env: { HUDDLE_PLAYER_UIDS: ' u-b , u-z ' } });
    expect(r.uids).toEqual(['u-b']);
    expect(r.scoped).toBe(2);
    expect(playerScopeOf({ HUDDLE_PLAYER_UIDS: '  ' })).toBeNull();
    expect(playerScopeOf({})).toBeNull();
  });
});
