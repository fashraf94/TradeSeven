// @vitest-environment jsdom
//
// src/screens/battleView/Cockpit2b.reducedMotion.jsdom.test.jsx
//
// Cockpit Build 2b (spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md §9, §11 "reduced
// motion"): the Now card's change, a chip's expansion and the bench sheet's
// entrance use motionToken('smooth'), and `instant` with no entrance under
// reduced motion. framer is stubbed to RECORD the props each motion element is
// handed (framer latches prefers-reduced-motion in module scope, so this file
// stands alone — the AgentBattleScreen.cockpit.reducedMotion precedent).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const record = (Tag) => ReactMod.forwardRef(({ initial, animate, transition, exit, layout, ...rest }, ref) => ReactMod.createElement(Tag, {
    ...rest,
    ref,
    'data-motion-initial': JSON.stringify(initial ?? null),
    'data-motion-transition': JSON.stringify(transition ?? null),
  }));
  return { motion: new Proxy({}, { get: (_, tag) => record(tag) }), AnimatePresence: ({ children }) => children };
});

import Cockpit2b from './Cockpit2b';
import CockpitBenchSheet from './CockpitBenchSheet';
import { buildCockpitFeed } from './cockpitModel';
import { benchSheetOf } from './cockpit2bModel';
import { motionToken } from '../../theme/motion';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = (iso) => Date.parse(iso);
const NOW = T('2026-10-21T17:20:00.000Z');
const CLOSE = T('2026-10-21T20:00:00.000Z');
let seq = 0;
const call = (over = {}) => {
  seq += 1;
  return {
    callId: `b:e:call:${seq}`, kind: 'called_shot', evalId: 'e', mintedAt: T('2026-10-21T16:00:40.000Z') + seq, mintedMode: 'on',
    symbol: `S${seq}`, direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO',
    condition: { side: 'above', level: 100 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', evidence: { priceAsOf: '2026-10-21T16:00:20.000Z' }, state: 'open', stateChangedAt: NOW, playerResponse: null, ...over,
  };
};

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const props = (el) => ({ initial: JSON.parse(el.getAttribute('data-motion-initial')), transition: JSON.parse(el.getAttribute('data-motion-transition')) });

function screen(reducedMotion) {
  const calls = [call(), call()];
  const feed = buildCockpitFeed({ calls, events: [], evaluations: [], directive: null, nowMs: NOW, v2: true });
  act(() => {
    root.render(<Cockpit2b feed={feed} records={{ calls }} agent="Shadow" nowMs={NOW} reducedMotion={reducedMotion} flow={{ request: vi.fn(), confirm: null, heldKey: null }} />);
  });
  click(container.querySelector('[data-cockpit-chip]'));
}

describe('reduced motion', () => {
  it('motion allowed: the Now card and the expanded chip enter on the smooth token', () => {
    screen(false);
    const now = props(container.querySelector('[data-cockpit-now]'));
    expect(now.transition).toEqual(JSON.parse(JSON.stringify(motionToken('smooth', { reducedMotion: false }))));
    expect(now.initial).toEqual({ opacity: 0, y: 6 });
    expect(props(container.querySelector('[data-cockpit-chip-expanded]')).initial).toEqual({ opacity: 0 });
  });

  it('reduced: no entrance (initial false) and the instant token, card and chip alike', () => {
    screen(true);
    for (const sel of ['[data-cockpit-now]', '[data-cockpit-chip-expanded]']) {
      const p = props(container.querySelector(sel));
      expect(p.initial, sel).toBe(false);
      expect(p.transition, sel).toEqual(JSON.parse(JSON.stringify(motionToken('smooth', { reducedMotion: true }))));
    }
    expect(motionToken('smooth', { reducedMotion: true })).toEqual(motionToken('instant'));
  });

  it('the bench sheet\'s entrance is the shared layer\'s: smooth, or instant with none under reduced motion', () => {
    const sheet = benchSheetOf({ status: 'loading' });
    act(() => { root.render(<CockpitBenchSheet sheet={sheet} onClose={() => {}} reducedMotion />); });
    const p = props(container.querySelector('[data-cockpit-bench-sheet]'));
    expect(p.initial).toBe(false);
    expect(p.transition).toEqual(JSON.parse(JSON.stringify(motionToken('smooth', { reducedMotion: true }))));
  });
});
