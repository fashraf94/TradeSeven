// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomRoute.untaped.jsdom.test.jsx
//
// Build B Amendment A RB-5 — A BATTLE THE TAPE DOES NOT COVER OPENS THE LEGACY
// FILM ROOM. The tape writer tapes only tiered battles (BA-3; Astra's B1 review
// §2): a tournament battle's tape is `skipped_mode`, so at FILM_ROOM_V2_MODE
// 'on' v2 showed its player "This battle mode is not taped." where the legacy
// screen used to be. The route now gives such a battle the legacy screen with
// App's own props, exactly as at 'off' — the same photographs as
// FilmRoomRoute.golden.jsdom.test.jsx (captured from the pre-build commit),
// under the same mocks, clock and zone:
//   a tournament battle, any mode       → the legacy screen, byte for byte, no verdict asked
//   tiered, absent or unknown mode      → v2 at 'on', with the props it had before
//   the mode test                       → resolveModeConfig's answer, never a mode name
// The goldens are never regenerated here.

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
// Counts legacy MOUNTS (not renders): a ref set on a component's first render is new only on a mount.
const legacy = vi.hoisted(() => ({ mounts: 0 }));
vi.mock('../../hooks/useAgentBattle', async () => {
  const { HOOK_RESULT } = await import('../__golden__/filmRoomGoldenFixture');
  const { useRef } = await import('react');
  return { default: function useAgentBattle() { const seen = useRef(false); if (!seen.current) { seen.current = true; legacy.mounts += 1; } return HOOK_RESULT; } };
});
// Both screens passed through untouched, each recording the props it is given.
const received = vi.hoisted(() => ({ legacy: [], v2: [] }));
vi.mock('../FilmRoomScreen', async (importOriginal) => {
  const real = await importOriginal();
  const { createElement } = await import('react');
  const Legacy = real.default;
  return { ...real, default: function FilmRoomScreen(props) { received.legacy.push(props); return createElement(Legacy, props); } };
});
vi.mock('./FilmRoomScreenV2', async (importOriginal) => {
  const real = await importOriginal();
  const { createElement } = await import('react');
  const V2 = real.default;
  return { ...real, default: function FilmRoomScreenV2(props) { received.v2.push(props); return createElement(V2, props); } };
});
// The mode table itself, passed through; a row may substitute an answer to prove the route asks the table.
const table = vi.hoisted(() => ({ override: null, asked: [] }));
vi.mock('../../constants/agentGameModes', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    resolveModeConfig: (gameMode) => {
      table.asked.push(gameMode);
      return table.override ? table.override(gameMode, real) : real.resolveModeConfig(gameMode);
    },
  };
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
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../constants/agentGameModes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no scrollIntoView; the legacy chat calls it on mount. A no-op, identically in the capture harness.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};

const strip = (h) => h.replace(/<!-- -->/g, '');
// Under jsdom import.meta.url is not a file URL; vitest runs from the repo root.
const golden = (name) => readFileSync(path.join(process.cwd(), 'src', 'screens', '__golden__', name), 'utf8');

/** A tournament battle as App hands it to the route: the golden's battle, in the mode the writer skips. */
const TOURNAMENT = Object.freeze({ ...BATTLE_PROP, gameMode: 'baggerbomb_tournament' });

const realFetch = globalThis.fetch;
let container; let root; let fetches;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(PINNED_NOW));
  resetFilmRoomVerdicts();
  legacy.mounts = 0;
  received.legacy = [];
  received.v2 = [];
  table.override = null;
  table.asked = [];
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
const remount = (mode) => { act(() => root.unmount()); root = createRoot(container); resetFilmRoomVerdicts(); legacy.mounts = 0; received.legacy = []; received.v2 = []; fetches = []; flags.mode = mode; };
const answer = (body, status = 200) => { globalThis.fetch = vi.fn(async (url) => { fetches.push(url); return { ok: status === 200, status, json: async () => body }; }); };
const expectAppProps = (props, battle, onBack, label) => {
  expect(props.length, label).toBeGreaterThan(0);
  for (const p of props) {
    expect(Object.keys(p).sort(), label).toEqual(['battle', 'onBack']);
    expect(p.battle, label).toBe(battle);
    expect(p.onBack, label).toBe(onBack);
  }
};

describe("RB-5 — a tournament battle opens the legacy Film Room, byte for byte, exactly as at 'off'", () => {
  it("'on': the first paint and the settled screen equal the 'off' photographs, and equal the same battle at 'off'; v2 never mounts, no verdict is asked", async () => {
    const pages = {};
    for (const mode of ['off', 'on']) {
      remount(mode);
      const onBack = () => {};
      const first = strip(renderToString(<FilmRoomRoute battle={TOURNAMENT} onBack={onBack} />));
      legacy.mounts = 0;     // the server render above runs the hook once too; count the mount alone
      act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={onBack} />));
      await settle();
      pages[mode] = { first, settled: container.innerHTML };
      expect(first, mode).toBe(golden('filmRoom.legacy.firstPaint.html'));
      expect(container.innerHTML, mode).toBe(golden('filmRoom.legacy.mounted.html'));
      expect(container.querySelector('[data-screen="film-room-v2"]'), mode).toBeNull();
      expect(received.v2, mode).toEqual([]);
      expect(legacy.mounts, mode).toBe(1);
      expect(fetches, mode).toEqual([]);
    }
    expect(pages.on).toEqual(pages.off);
  });

  it("'on': still the photograph once everything has settled — the legacy screen is mounted once, never swapped for v2", async () => {
    flags.mode = 'on';
    act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={() => {}} />));
    await settle();
    await settle(30);
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expect(container.querySelector('[data-screen="film-room-v2"]')).toBeNull();
    expect(legacy.mounts).toBe(1);
  });

  it("the legacy screen gets App's props THEMSELVES — the same battle object and the same onBack, nothing added — at 'on', 'allowlist' and 'off', with an origin given", async () => {
    for (const mode of ['on', 'allowlist', 'off']) {
      remount(mode);
      if (mode === 'allowlist') answer({ on: true, allowlisted: true });     // an admitted owner: still the legacy screen
      const onBack = () => {};
      const onReturn = () => {};
      expect(strip(renderToString(<FilmRoomRoute battle={TOURNAMENT} onBack={onBack} origin="battleHistory" onReturn={onReturn} />)), mode).toBe(golden('filmRoom.legacy.firstPaint.html'));
      received.legacy = [];
      act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={onBack} origin="battleHistory" onReturn={onReturn} />));
      await settle();
      expect(container.innerHTML, mode).toBe(golden('filmRoom.legacy.mounted.html'));
      expectAppProps(received.legacy, TOURNAMENT, onBack, mode);
      expect(received.v2, mode).toEqual([]);
    }
  });

  it("'allowlist', an owner the server admits: the legacy screen and NO verdict asked — the 'off' page, request and all", async () => {
    flags.mode = 'allowlist';
    answer({ on: true, allowlisted: true });
    act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={() => {}} />));
    await settle();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expect(fetches).toEqual([]);
    expect(legacy.mounts).toBe(1);
  });

  it("'allowlist': the owner's admitted verdict, cached from a tiered battle, never carries v2 onto their tournament battle", async () => {
    flags.mode = 'allowlist';
    answer({ on: true, allowlisted: true });
    act(() => root.render(<FilmRoomRoute battle={BATTLE_PROP} onBack={() => {}} />));
    expect(await waitForV2()).toBeTruthy();
    expect(fetches).toEqual(['/api/agent/cockpit-status?battleId=golden-film-battle']);
    const onBack = () => {};
    const other = Object.freeze({ ...TOURNAMENT, id: 'golden-tournament', agentBattleId: 'golden-tournament' });
    received.legacy = [];
    act(() => root.render(<FilmRoomRoute battle={other} onBack={onBack} />));
    await settle();
    expect(container.querySelector('[data-screen="film-room-v2"]')).toBeNull();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expectAppProps(received.legacy, other, onBack, 'tournament after tiered');
    expect(fetches).toEqual(['/api/agent/cockpit-status?battleId=golden-film-battle']);   // nothing asked for the tournament battle
  });
});

describe("RB-5 — a tiered battle, or one whose mode is absent or unknown, keeps v2 exactly as before", () => {
  const CASES = [
    ['tiered', Object.freeze({ ...BATTLE_PROP, gameMode: TIERED_GAME_MODE })],
    ['absent', BATTLE_PROP],
    ['null', Object.freeze({ ...BATTLE_PROP, gameMode: null })],
    ['unknown', Object.freeze({ ...BATTLE_PROP, gameMode: 'baggerbomb_someday' })],
    ['not a string', Object.freeze({ ...BATTLE_PROP, gameMode: 42 })],
  ];

  it("'on': v2, given the props it was given before — the battle itself, the return, the origin and the viewer; the legacy screen never mounts, no verdict asked", async () => {
    for (const [label, battle] of CASES) {
      remount('on');
      const onBack = () => {};
      const onReturn = () => {};
      act(() => root.render(<FilmRoomRoute battle={battle} onBack={onBack} origin="battleHistory" onReturn={onReturn} />));
      expect(await waitForV2(), label).toBeTruthy();
      expect(received.v2.length, label).toBeGreaterThan(0);
      for (const p of received.v2) {
        expect(Object.keys(p).sort(), label).toEqual(['backTo', 'battle', 'onBack', 'viewerId']);
        expect(p.battle, label).toBe(battle);
        expect(p.onBack, label).toBe(onReturn);
        expect(p.backTo, label).toBe('battleHistory');
        expect(p.viewerId, label).toBe('golden-owner');
      }
      expect(received.legacy, label).toEqual([]);
      expect(legacy.mounts, label).toBe(0);
      expect(fetches, label).toEqual([]);
    }
  });

  it("'allowlist', admitted: v2 for each — the verdict is still asked for a battle the tape covers", async () => {
    for (const [label, battle] of CASES) {
      remount('allowlist');
      answer({ on: true, allowlisted: true });
      act(() => root.render(<FilmRoomRoute battle={battle} onBack={() => {}} />));
      expect(await waitForV2(), label).toBeTruthy();
      expect(fetches, label).toEqual(['/api/agent/cockpit-status?battleId=golden-film-battle']);
    }
  });
});

describe("RB-5 — the route asks the writer's mode table (resolveModeConfig), never a mode name", () => {
  it("it asks the table with the battle's own gameMode", async () => {
    flags.mode = 'on';
    act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={() => {}} />));
    await settle();
    expect(table.asked.length).toBeGreaterThan(0);
    expect(table.asked.every((m) => m === 'baggerbomb_tournament')).toBe(true);
  });

  it("a mode the table answers untaped opens the legacy screen, whatever its name — and a mode it answers tiered opens v2", async () => {
    // The table, changed as a later build might change it: the tiered mode answers flat, the tournament mode tiered.
    table.override = (gameMode, real) => {
      if (gameMode === TIERED_GAME_MODE) return real.MODE_CONFIGS[FLAT6_GAME_MODE];
      if (gameMode === FLAT6_GAME_MODE) return real.MODE_CONFIGS[TIERED_GAME_MODE];
      return real.resolveModeConfig(gameMode);
    };
    remount('on');
    const onBack = () => {};
    const tiered = Object.freeze({ ...BATTLE_PROP, gameMode: TIERED_GAME_MODE });
    act(() => root.render(<FilmRoomRoute battle={tiered} onBack={onBack} />));
    await settle();
    expect(container.innerHTML).toBe(golden('filmRoom.legacy.mounted.html'));
    expectAppProps(received.legacy, tiered, onBack, 'tiered answered flat');
    remount('on');
    act(() => root.render(<FilmRoomRoute battle={TOURNAMENT} onBack={() => {}} />));
    expect(await waitForV2()).toBeTruthy();
    expect(received.legacy).toEqual([]);
  });
});
