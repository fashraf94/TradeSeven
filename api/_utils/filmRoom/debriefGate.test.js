// api/_utils/filmRoom/debriefGate.test.js
//
// Film Room D2 item 1 — the server gate for the agent's words (D2 spec §8, DW-9), as cardsGate.test.js proves the cards':
// the mode read at CALL time and failing closed, and per-owner admission through the cockpit's server-side allowlist —
// the real reader (api/_utils/callRecords/mode.js), driven through the environment variable exactly as production sets it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', throws: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_DEBRIEF_MODE() { if (state.throws) throw new Error('hermetic mock omitted the name'); return state.mode; },
}));

const { filmRoomDebriefMode, filmRoomDebriefOnFor } = await import('./debriefGate.js');

const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
beforeEach(() => { state.mode = 'off'; state.throws = false; process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1'; });
afterEach(() => { if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE; });

describe('the mode — read at call time; unknown or unreadable → off', () => {
  // the cases are written out literally — never generated from the production constant (a dropped mode must fail a row)
  it('off → off', () => { state.mode = 'off'; expect(filmRoomDebriefMode()).toBe('off'); });
  it('allowlist → allowlist', () => { state.mode = 'allowlist'; expect(filmRoomDebriefMode()).toBe('allowlist'); });
  it('on → on', () => { state.mode = 'on'; expect(filmRoomDebriefMode()).toBe('on'); });
  it('an unknown value — ON, empty, true, undefined, null, "allow" — → off', () => {
    for (const v of ['ON', '', true, undefined, null, 'allow', ' on']) { state.mode = v; expect(filmRoomDebriefMode(), String(v)).toBe('off'); }
  });
  it('a mock that throws on the name reads off, and admits nobody', () => {
    state.throws = true;
    expect(filmRoomDebriefMode()).toBe('off');
    expect(filmRoomDebriefOnFor('owner-1')).toBe(false);
  });
  it('the mode is read at CALL time: a change between two calls is seen by the second', () => {
    state.mode = 'off';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(false);
    state.mode = 'allowlist';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(true);
  });
});

describe('per-owner admission', () => {
  it("'off': nobody, the allowlisted owner included", () => {
    state.mode = 'off';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(false);
    expect(filmRoomDebriefOnFor('owner-2')).toBe(false);
  });
  it("'allowlist': only an owner the cockpit's server-side allowlist admits — read at call time", () => {
    state.mode = 'allowlist';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(true);
    expect(filmRoomDebriefOnFor('owner-2')).toBe(false);
    expect(filmRoomDebriefOnFor('')).toBe(false);
    expect(filmRoomDebriefOnFor(null)).toBe(false);
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-2';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(false);
    expect(filmRoomDebriefOnFor('owner-2')).toBe(true);
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect(filmRoomDebriefOnFor('owner-2')).toBe(false);
  });
  it("'on': every owner with a uid; a malformed uid never", () => {
    state.mode = 'on';
    process.env.COCKPIT_ALLOWLIST_UIDS = '';
    expect(filmRoomDebriefOnFor('owner-1')).toBe(true);
    expect(filmRoomDebriefOnFor('someone-else')).toBe(true);
    expect(filmRoomDebriefOnFor('')).toBe(false);
    expect(filmRoomDebriefOnFor(null)).toBe(false);
    expect(filmRoomDebriefOnFor(42)).toBe(false);
  });
  it('a mode handed in is the mode judged (the pass reads it once per run)', () => {
    state.mode = 'off';
    expect(filmRoomDebriefOnFor('owner-1', 'allowlist')).toBe(true);
    expect(filmRoomDebriefOnFor('owner-2', 'allowlist')).toBe(false);
    expect(filmRoomDebriefOnFor('owner-2', 'on')).toBe(true);
    expect(filmRoomDebriefOnFor('owner-1', 'nonsense')).toBe(false);
  });
});
