// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomRoute.golden.jsdom.test.jsx
//
// Film Room A2 item 10 — WHERE v2 DOES NOT RESOLVE ON, THE LEGACY FILM ROOM,
// BYTE FOR BYTE (Amendment E BA-40). The two goldens under
// src/screens/__golden__/ (filmRoom.legacy.firstPaint.html and
// filmRoom.legacy.mounted.html) were captured from the PRE-BUILD commit
// c1822e39 — not from this tree — by captureFilmRoomGolden.jsdom.test.jsx run
// twice (identical) in a Linux clone. This file renders the CURRENT 'filmRoom'
// route (FilmRoomRoute) under the same mocks, clock, zone and normalisation
// and asserts string equality with the photograph:
//   FILM_ROOM_V2_MODE 'off'                          → the legacy screen, no request
//   'allowlist', owner NOT admitted                  → the legacy screen at every
//                                                      paint (first paint and settled)
//   'allowlist' with a failed verdict                → the legacy screen
//   'allowlist', owner admitted / 'on'               → v2, not the legacy screen
// Regenerate the goldens ONLY when the legacy render is meant to change, by the
// capture harness's procedure — never by pasting this tree's output.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { PINNED_NOW, BATTLE_PROP } from '../__golden__/filmRoomGoldenFixture';

const flags = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_V2_MODE() { return flags.mode; },
}));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: auth.user })) }));
vi.mock('../../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('../../hooks/useAgentBattle', async () => {
  const { HOOK_RESULT } = await import('../__golden__/filmRoomGoldenFixture');
  return { default: () => HOOK_RESULT };
});
// v2's Firestore reads, should v2 mount: a tape that does not exist (denied, as the rules answer).
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...s) => ({ path: s.join('/') }),
  getDoc: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); },
  collection: () => ({}), query: () => ({}), where: () => ({}), getDocs: async () => ({ docs: [] }),
  onSnapshot: () => () => {},
}));

import FilmRoomRoute from './FilmRoomRoute';
import { resetFilmRoomVerdicts } from '../../utils/filmRoomGate';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no scrollIntoView; the legacy chat calls it on mount. A no-op, identically in the capture harness.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};

const strip = (h) => h.replace(/<!-- -->/g, '');
// Under jsdom import.meta.url is not a file URL; vitest runs from the repo root.
const golden = (name) => readFileSync(path.join(process.cwd(), 'src', 'screens', '__golden__', name), 'utf8');

const realFetch = globalThis.fetch;
let container; let root; let fetches;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(PINNED_NOW));
  resetFilmRoomVerdicts();
  flags.mode = 'off';
  auth.user = { uid: 'golden-owner', getIdToken: async () => 'token' };
  fetches = [];
  globalThis.fetch = vi.fn(async (url) => { fetches.push(url); return { ok: true, status: 200, json: async () => ({ on: false, allowlisted: false }) }; });
  globalThis.localStorage?.clear?.();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

const settle = async (n = 10) => { for (let i = 0; i < n; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
/** v2 is a lazy chunk: its first load in a file can take longer than a fixed number of turns — poll, bounded. */
const waitForV2 = async (limitMs = 10_000) => {
  const until = performance.now() + limitMs;
  while (!container.querySelector('[data-screen="film-room-v2"]') && performance.now() < until) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return container.querySelector('[data-screen="film-room-v2"]');
};
const mountRoute = async () => { act(() => root.render(<FilmRoomRoute battle={BATTLE_PROP} onBack={() => {}} />)); await settle(); };
const answer = (body, status = 200) => { globalThis.fetch = vi.fn(async (url) => { fetches.push(url); return { ok: status === 200, status, json: async () => body }; }); };

describe('BA-40 — the legacy Film Room, byte for byte, wherever v2 does not resolve on', () => {
  it('the goldens are the pre-build photographs (not empty, not this tree\'s)', () => {
    expect(golden('filmRoom.legacy.firstPaint.html')).toContain('Loading Film Room…');
    expect(golden('filmRoom.legacy.mounted.html').length).toBeGreaterThan(5000);
    expect(golden('filmRoom.legacy.mounted.html')).toContain('Rotated MSFT into NFLX on the breakout and held into the close.');
  });

  it("'off': the first paint and the settled screen equal the photographs; no verdict is asked", async () => {
    flags.mode = 'off';
    expect(strip(renderToString(<FilmRoomRoute battle={BATTLE_PROP} onBack={() => {}} />))).toBe(golden('filmRoom.legacy.firstPaint.html'));
    await mountRoute();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expect(fetches).toEqual([]);
  });

  it("'allowlist', an owner the server does not admit: the legacy screen at the first paint and once the verdict lands — one request", async () => {
    flags.mode = 'allowlist';
    answer({ on: true, allowlisted: false });
    expect(strip(renderToString(<FilmRoomRoute battle={BATTLE_PROP} onBack={() => {}} />))).toBe(golden('filmRoom.legacy.firstPaint.html'));
    await mountRoute();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expect(fetches).toEqual(['/api/agent/cockpit-status?battleId=golden-film-battle']);
  });

  it("'allowlist', a verdict that fails (403, 500, a malformed body, no user): the legacy screen", async () => {
    flags.mode = 'allowlist';
    for (const [body, status] of [[{ error: 'forbidden' }, 403], [{}, 500], [{ on: true }, 200]]) {
      resetFilmRoomVerdicts();
      answer(body, status);
      await mountRoute();
      expect(container.innerHTML, String(status)).toBe(golden('filmRoom.legacy.mounted.html'));
    }
    resetFilmRoomVerdicts();
    auth.user = null;
    await mountRoute();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
  });

  it("'allowlist', an owner the server admits: v2 at the same route — the legacy screen is gone", async () => {
    flags.mode = 'allowlist';
    answer({ on: false, allowlisted: true });
    await mountRoute();
    expect(await waitForV2()).toBeTruthy();
    expect(container.textContent).not.toContain('Loading Film Room…');
    expect(container.innerHTML).not.toBe(golden('filmRoom.legacy.mounted.html'));
  });

  it("'on': v2 for every owner, with no verdict asked", async () => {
    flags.mode = 'on';
    await mountRoute();
    expect(await waitForV2()).toBeTruthy();
    expect(fetches).toEqual([]);
  });
});
