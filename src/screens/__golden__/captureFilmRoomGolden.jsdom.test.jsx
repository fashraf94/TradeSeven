// @vitest-environment jsdom
//
// src/screens/__golden__/captureFilmRoomGolden.jsdom.test.jsx
//
// THE CAPTURE HARNESS for the legacy Film Room goldens beside this file (Film
// Room A2, Amendment E BA-40: where v2 does not resolve on, the legacy screen
// renders byte-identical to the PRE-BUILD commit). Committed so a regeneration
// is reproducible from a NAMED commit (the captureFlagOffGolden precedent).
//
// It is SKIPPED unless FILM_ROOM_GOLDEN_OUT_DIR is set, so the normal suite
// never writes a golden. To regenerate (only when the legacy render is meant to
// change):
//   1. check out the commit whose legacy output is the truth (the pre-build
//      commit c1822e39 for A2) in a scratch tree
//   2. copy THIS file and ./filmRoomGoldenFixture.js into it at the same paths
//   3. FILM_ROOM_GOLDEN_OUT_DIR=/abs/out npx vitest run src/screens/__golden__/captureFilmRoomGolden.jsdom.test.jsx
//   4. run it TWICE and cmp the outputs (determinism); copy them over the two
//      .html files here and record the source commit and their sha256 in the PR
//
// The same mocks, clock, zone and normalisation as
// src/screens/filmRoomV2/FilmRoomRoute.golden.jsdom.test.jsx. TZ is pinned to
// UTC before anything formats a time, so the photograph is the same on every
// platform.

process.env.TZ = 'UTC';

import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { PINNED_NOW, BATTLE_PROP } from './filmRoomGoldenFixture';

vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../../hooks/useMasteryProfile', () => ({ default: () => null }));
vi.mock('../../hooks/useAgentBattle', async () => {
  const { HOOK_RESULT } = await import('./filmRoomGoldenFixture');
  return { default: () => HOOK_RESULT };
});

import FilmRoomScreen from '../FilmRoomScreen';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no scrollIntoView; the legacy chat calls it on mount. A no-op, identically in the golden test.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};
const OUT = process.env.FILM_ROOM_GOLDEN_OUT_DIR;
const strip = (h) => h.replace(/<!-- -->/g, '');

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(PINNED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe.skipIf(!OUT)('capture the legacy Film Room goldens (pre-build commit)', () => {
  it('writes the first paint (renderToString) and the settled mount (innerHTML)', async () => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, 'filmRoom.legacy.firstPaint.html'), strip(renderToString(<FilmRoomScreen battle={BATTLE_PROP} onBack={() => {}} />)));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<FilmRoomScreen battle={BATTLE_PROP} onBack={() => {}} />));
    for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    writeFileSync(path.join(OUT, 'filmRoom.legacy.mounted.html'), container.innerHTML);
    act(() => root.unmount());
    container.remove();
  });
});
