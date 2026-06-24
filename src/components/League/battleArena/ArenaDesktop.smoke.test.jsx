// src/components/League/battleArena/ArenaDesktop.smoke.test.jsx
//
// Render smoke for the desktop arena. The repo ships no jsdom/RTL setup, but
// react-dom/server renders the full component tree WITHOUT a DOM (effects don't
// run, so ResizeObserver / rAF / matchMedia are never touched) — enough to catch
// a runtime throw on mount across every state × mode, which the build + lint
// cannot. Asserts the surface actually composed (key copy + substantial output).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ArenaDesktop } from './ArenaDesktop';

describe('ArenaDesktop render smoke', () => {
  for (const state of ['awaiting', 'live', 'complete']) {
    for (const mode of ['training', 'ranked']) {
      it(`mounts in ${state} / ${mode} without throwing`, () => {
        const html = renderToString(<ArenaDesktop state={state} mode={mode} onBack={() => {}} />);
        expect(html).toContain('Your three');     // the your-three dock composed
        expect(html).toContain('watch-only');      // the agent-six dock composed
        expect(html.length).toBeGreaterThan(2000); // real surface, not an early bail
      });
    }
  }
});
