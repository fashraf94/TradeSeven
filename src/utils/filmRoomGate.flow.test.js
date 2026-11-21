// src/utils/filmRoomGate.flow.test.js
//
// Film Room D1 item 1 — the FLOW gate (Build D spec §2; FL-14): the mode read
// at call time and failing closed, the pure per-owner resolution, and the one
// cached verdict the cards already read — the flow, asking through the same
// reader with the same owner, never sends a second request. The screen's own
// rows (a verdict for another battle never stands for this one; the mounted
// screen's requests) are FilmRoomFlow.gate.jsdom.test.jsx's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ flow: 'off', throws: false, cards: 'off', v2: 'off' }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { if (flags.throws) throw new Error('hermetic mock omitted the name'); return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return flags.cards; },
  get FILM_ROOM_V2_MODE() { return flags.v2; },
}));
const auth = vi.hoisted(() => ({ user: { getIdToken: async () => 'token-1' } }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: auth.user }) }));

import {
  resolveFilmRoomFlowMode, filmRoomFlowOn, readFilmRoomVerdict, resetFilmRoomVerdicts, resolveFilmRoomCardsForBattle,
  resolveFilmRoomCardsMode, resolveFilmRoomV2Mode, filmRoomCardsOn,
} from './filmRoomGate';

const realFetch = globalThis.fetch;
beforeEach(() => { flags.flow = 'off'; flags.throws = false; flags.cards = 'off'; flags.v2 = 'off'; auth.user = { getIdToken: async () => 'token-1' }; resetFilmRoomVerdicts(); });
afterEach(() => { globalThis.fetch = realFetch; });

describe('the flow mode — read at call time, unknown or unreadable → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['Allowlist', 'off'], ['', 'off'], [true, 'off'], [null, 'off'], [undefined, 'off'], ['toString', 'off']])('%s → %s', (value, want) => {
    flags.flow = value;
    expect(resolveFilmRoomFlowMode()).toBe(want);
  });

  it('a mock that throws on the name reads off', () => {
    flags.throws = true;
    expect(resolveFilmRoomFlowMode()).toBe('off');
  });

  it('read at CALL time — a change of the value is seen by the next call', () => {
    flags.flow = 'on';
    expect(resolveFilmRoomFlowMode()).toBe('on');
    flags.flow = 'allowlist';
    expect(resolveFilmRoomFlowMode()).toBe('allowlist');
  });

  it('its own flag: neither the cards mode nor the v2 mode stands in for it, and it stands in for neither', () => {
    flags.cards = 'on'; flags.v2 = 'on'; flags.flow = 'off';
    expect(resolveFilmRoomFlowMode()).toBe('off');
    flags.cards = 'off'; flags.v2 = 'off'; flags.flow = 'on';
    expect(resolveFilmRoomFlowMode()).toBe('on');
    expect(resolveFilmRoomCardsMode()).toBe('off');
    expect(resolveFilmRoomV2Mode()).toBe('off');
  });
});

describe('filmRoomFlowOn — per owner, pure', () => {
  it("'on' for every owner; 'allowlist' only with a definite yes — false and a pending verdict (undefined) read off; 'off' never", () => {
    expect(filmRoomFlowOn('on', undefined)).toBe(true);
    expect(filmRoomFlowOn('on', false)).toBe(true);
    expect(filmRoomFlowOn('allowlist', true)).toBe(true);
    expect(filmRoomFlowOn('allowlist', false)).toBe(false);
    expect(filmRoomFlowOn('allowlist', undefined)).toBe(false);
    expect(filmRoomFlowOn('off', true)).toBe(false);
    expect(filmRoomFlowOn('off', undefined)).toBe(false);
  });

  it('an unknown mode is off whatever the verdict — and a truthy verdict that is not `true` admits nobody', () => {
    for (const mode of ['ON', 'yes', '', null, undefined, 1, true]) {
      expect(filmRoomFlowOn(mode, true), String(mode)).toBe(false);
    }
    for (const verdict of [1, 'true', {}, [true]]) expect(filmRoomFlowOn('allowlist', verdict), JSON.stringify(verdict)).toBe(false);
  });

  it('the composition the screen makes: an unknown flag value resolves off, so even an admitted owner gets the off screen', () => {
    flags.flow = 'ALLOWLIST';
    expect(filmRoomFlowOn(resolveFilmRoomFlowMode(), true)).toBe(false);
  });
});

describe('the verdict — the one the cards read, from its cache: no second request for a battle', () => {
  const battle = { id: 'b-1', ownerId: 'owner-1' };
  const ownerOpts = { ownerId: 'owner-1' };

  it('the cards ask first (allowlist); the flow, reading the same verdict for the same owner, is answered from the cache', async () => {
    flags.cards = 'allowlist';
    const request = vi.fn(async () => ({ ok: true, allowlisted: true }));
    const readVerdict = (id, o) => readFilmRoomVerdict(id, { ...o, request });
    expect(await resolveFilmRoomCardsForBattle(battle, { readVerdict })).toBe(true);
    expect(filmRoomFlowOn('allowlist', await readVerdict('b-1', ownerOpts))).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asked together (both still on the way), the two share the one request; a definite no also answers both', async () => {
    flags.cards = 'allowlist';
    let answer;
    const request = vi.fn(() => new Promise((r) => { answer = r; }));
    const readVerdict = (id, o) => readFilmRoomVerdict(id, { ...o, request });
    const cards = resolveFilmRoomCardsForBattle(battle, { readVerdict });
    const flow = readVerdict('b-1', ownerOpts);
    await Promise.resolve();
    answer({ ok: true, allowlisted: false });
    expect(await cards).toBe(false);
    expect(filmRoomFlowOn('allowlist', await flow)).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('the control: asked under ANOTHER key (no owner named) the cache splits and a second request goes out — the screen must pass the owner the cards pass', async () => {
    const request = vi.fn(async () => ({ ok: true, allowlisted: true }));
    await readFilmRoomVerdict('b-1', { ownerId: 'owner-1', request });
    await readFilmRoomVerdict('b-1', { ownerId: null, request });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('cards off, flow allowlist: the cards ask nothing, so the flow\'s ask is the only one — once per owner', async () => {
    flags.cards = 'off';
    const request = vi.fn(async () => ({ ok: true, allowlisted: false }));
    const readVerdict = (id, o) => readFilmRoomVerdict(id, { ...o, request });
    expect(filmRoomCardsOn(resolveFilmRoomCardsMode(), undefined)).toBe(false);
    expect(await resolveFilmRoomCardsForBattle(battle, { readVerdict })).toBe(false);
    expect(request).toHaveBeenCalledTimes(0);
    expect(await readVerdict('b-1', ownerOpts)).toBe(false);
    expect(await readVerdict('b-1', ownerOpts)).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
