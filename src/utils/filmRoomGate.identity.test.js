// src/utils/filmRoomGate.identity.test.js
//
// Film Room D2 item 14 — Build D Amendment D DD-3 (Astra's N3, N4): THE identity record a Film Room answer belongs to —
// the battle id and the nullable owner, two fields compared with strict equality (filmRoomGate.js filmRoomIdentityOf,
// sameFilmRoomIdentity). The screen's verdict, its front-seen marker and its "Game flow" return read it
// (FilmRoomFlow.d2carried.jsdom.test.jsx holds the reproductions).

import { describe, it, expect } from 'vitest';
import { filmRoomIdentityOf, sameFilmRoomIdentity } from './filmRoomGate.js';

describe('DD-3 — one identity record', () => {
  it('the record: the battle id (the legacy rule — agentBattleId, else id) and the owner, null when the battle names none', () => {
    expect(filmRoomIdentityOf({ id: 'b1', ownerId: 'u1' })).toEqual({ battleId: 'b1', ownerId: 'u1' });
    expect(filmRoomIdentityOf({ agentBattleId: 'b2', id: 'x', ownerId: 'u1' })).toEqual({ battleId: 'b2', ownerId: 'u1' });
    expect(filmRoomIdentityOf({ id: 'b1' })).toEqual({ battleId: 'b1', ownerId: null });
    expect(filmRoomIdentityOf({ id: 'b1', ownerId: 7 })).toEqual({ battleId: 'b1', ownerId: null });
    expect(filmRoomIdentityOf(null)).toEqual({ battleId: null, ownerId: null });
  });
  it('N4: a missing owner and the owner string "null" are two identities (a joined string made them one)', () => {
    const missing = filmRoomIdentityOf({ id: 'b1' });
    const literal = filmRoomIdentityOf({ id: 'b1', ownerId: 'null' });
    expect(`${missing.battleId}|${missing.ownerId}`).toBe(`${literal.battleId}|${literal.ownerId}`);   // what D1 compared
    expect(sameFilmRoomIdentity(missing, literal)).toBe(false);
  });
  it('the same identity only when both fields are strictly equal; no record is no identity', () => {
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: 'u1' }, { battleId: 'b1', ownerId: 'u1' })).toBe(true);
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: null }, { battleId: 'b1', ownerId: null })).toBe(true);
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: 'u1' }, { battleId: 'b1', ownerId: 'u2' })).toBe(false);
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: 'u1' }, { battleId: 'b2', ownerId: 'u1' })).toBe(false);
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: undefined }, { battleId: 'b1', ownerId: null })).toBe(false);
    expect(sameFilmRoomIdentity(null, { battleId: 'b1', ownerId: null })).toBe(false);
    expect(sameFilmRoomIdentity({ battleId: 'b1', ownerId: null }, null)).toBe(false);
  });
});
