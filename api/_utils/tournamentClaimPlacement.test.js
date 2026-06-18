// api/_utils/tournamentClaimPlacement.test.js
//
// Direct unit coverage of the shared placement core (Slice 4 B1) — the
// canonical validation + transactional write reused by the human endpoint AND
// the CPU path. place-claim.test.js locks the HTTP wrapping; this locks the
// core in isolation so the CPU path inherits a tested contract.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import below is the
// runtime guard for this module's api/ -> src/ import of
// src/constants/leagueTournament.js — it explodes in this Node test env if a
// browser-only dependency ever enters that transitive graph. Never mock it.

import { describe, it, expect } from 'vitest';
import { validateClaimPlacement, commitClaimPlacement, normalizeSymbol } from './tournamentClaimPlacement.js';

const NOW = new Date('2026-06-10T21:00:00Z'); // Wed 17:00 ET

function pick(symbol) {
  return { symbol, legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }], flipCountToday: 0 };
}
function group(overrides = {}) {
  return { status: 'battle', userPool: ['COIN', 'PLTR', 'SHOP'], dailyScores: {}, ...overrides };
}
const player = { odUserId: 'u1', picks: [pick('NVDA'), pick('AMD'), pick('TSLA')] };

describe('normalizeSymbol', () => {
  it('trims and uppercases strings; empty string for non-strings', () => {
    expect(normalizeSymbol(' nvda ')).toBe('NVDA');
    expect(normalizeSymbol(null)).toBe('');
    expect(normalizeSymbol(42)).toBe('');
  });
});

describe('validateClaimPlacement (legacy order, minus categories)', () => {
  it('passes a valid drop/add and returns the derived currentDay', () => {
    expect(validateClaimPlacement({ group: group(), player, dropSymbol: 'NVDA', addSymbol: 'COIN', now: NOW }))
      .toEqual({ ok: true, currentDay: 1 });
  });
  it('rejects identical or empty symbols (invalid_symbols)', () => {
    expect(validateClaimPlacement({ group: group(), player, dropSymbol: 'NVDA', addSymbol: 'NVDA', now: NOW }).error).toBe('invalid_symbols');
    expect(validateClaimPlacement({ group: group(), player, dropSymbol: '', addSymbol: 'COIN', now: NOW }).error).toBe('invalid_symbols');
  });
  it('rejects a missing player (not_member)', () => {
    expect(validateClaimPlacement({ group: group(), player: null, dropSymbol: 'NVDA', addSymbol: 'COIN', now: NOW }).error).toBe('not_member');
  });
  it('rejects a drop not on the roster', () => {
    expect(validateClaimPlacement({ group: group(), player, dropSymbol: 'META', addSymbol: 'COIN', now: NOW }).error).toBe('drop_not_on_roster');
  });
  it('rejects an add not in the pool', () => {
    expect(validateClaimPlacement({ group: group(), player, dropSymbol: 'NVDA', addSymbol: 'GOOG', now: NOW }).error).toBe('not_in_pool');
  });
  it('rejects on the last day (derived day 5+)', () => {
    const day5 = group({ dailyScores: { day4: { closeScores: {}, recordedDate: '2026-06-09' } } });
    expect(validateClaimPlacement({ group: day5, player, dropSymbol: 'NVDA', addSymbol: 'COIN', now: NOW }).error).toBe('battle_last_day');
  });
});

describe('commitClaimPlacement (cap + duplicate + awaited write)', () => {
  function makeDb({ pending = [] } = {}) {
    const captured = { added: [] };
    const q = {
      where: () => q,
      get: async () => ({ size: pending.length, forEach: (cb) => pending.forEach(c => cb({ data: () => c })) }),
      doc: () => ({ id: 'claim-x' }),
    };
    const db = {
      collection: () => ({ doc: () => ({ collection: () => q }) }),
      runTransaction: async (fn) => fn({ get: async (x) => x.get(), set: (_r, d) => captured.added.push(d) }),
    };
    return { db, captured };
  }
  it('writes the pending claim doc and returns its id', async () => {
    const { db, captured } = makeDb();
    const r = await commitClaimPlacement(db, { groupId: 'g1', odUserId: 'u1', username: 'Fai', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 2, now: NOW });
    expect(r.claimId).toBe('claim-x');
    expect(captured.added[0]).toMatchObject({
      odUserId: 'u1', username: 'Fai', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 2,
      status: 'pending', denialReason: null, processedAt: null,
    });
  });
  it('rejects at the 3-cap', async () => {
    const { db } = makeDb({ pending: [{}, {}, {}] });
    expect((await commitClaimPlacement(db, { groupId: 'g1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', now: NOW })).rejected).toBe('claim_cap_reached');
  });
  it('rejects an exact duplicate', async () => {
    const { db } = makeDb({ pending: [{ dropSymbol: 'NVDA', addSymbol: 'COIN' }] });
    expect((await commitClaimPlacement(db, { groupId: 'g1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', now: NOW })).rejected).toBe('duplicate_claim');
  });
});
