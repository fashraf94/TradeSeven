// @vitest-environment jsdom
//
// Research Modal Build A — MOTION (spec §4.4; BUILD_RULES §11): tokens only.
// The bead's move takes `smooth`, the banked moment `bouncy` (the one loud
// animation), and with reduced motion both are `instant` — the banked moment
// a static state. framer-motion is a recorder of the transition each motion
// element is handed, so the rows read the token, not a guess at timing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fm = vi.hoisted(() => ({ reduced: false, seen: [] }));
vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const make = (tag) => function MotionRecorder({ transition, initial, animate, ...rest }) {
    fm.seen.push({ tag, transition, initial, animate });
    const dom = {};
    for (const [k, v] of Object.entries(rest)) dom[k] = v;
    return ReactMod.createElement(tag, dom);
  };
  return { motion: new Proxy({}, { get: (_, tag) => make(String(tag)) }), useReducedMotion: () => fm.reduced };
});

import FuseChart from './FuseChart.jsx';
import RedZone from './RedZone.jsx';
import { previewLadder, measuredLadder, toGo } from './ladder.js';
import { traceParts } from './bombView.js';
import { smooth, bouncy, instant } from '../../../theme/motion.js';

const ladder = measuredLadder({ measured: { measured: true, baselinePrice: 100, targets: [['bagger', 102], ['doubleBagger', 103], ['tenBagger', 104], ['bust', 98], ['crash', 97], ['meltdown', 96]].map(([key, price]) => ({ key, price })), crossedTiers: ['bagger'] } });
const fuse = () => renderToStaticMarkup(<FuseChart ladder={ladder} live={102.5} decimals={2} go={toGo(ladder, 102.5)} />);
const moment = () => renderToStaticMarkup(<RedZone ladder={ladder} go={toGo(ladder, 102.5)} live={102.5} decimals={2} mode="banked" trace={traceParts([], [])} clock={null} scoredText={null} moment={{ key: 'bagger', atMs: null, price: 102.1 }} nowMs={Date.now()} />);

beforeEach(() => { fm.seen.length = 0; fm.reduced = false; });

describe('motion tokens only', () => {
  it('the bead moves on `smooth`', () => { fuse(); const beads = fm.seen.filter((s) => s.tag === 'circle'); expect(beads.length).toBe(2); for (const b of beads) expect(b.transition).toBe(smooth); });
  it('the banked moment pops on `bouncy`', () => { moment(); const m = fm.seen.find((s) => s.tag === 'div'); expect(m.transition).toBe(bouncy); });
  it('reduced motion: every transition is `instant`, and the banked moment is a static state', () => {
    fm.reduced = true; fuse(); moment();
    expect(fm.seen.length).toBeGreaterThan(0);
    for (const s of fm.seen) expect(s.transition).toBe(instant);
  });
  it('a preview\'s Fuse uses the same tokens', () => {
    const p = previewLadder({ previousClose: 100, threshold: 2 });
    renderToStaticMarkup(<FuseChart ladder={p} live={101} decimals={2} go={toGo(p, 101)} />);
    for (const s of fm.seen) expect(s.transition).toBe(smooth);
  });
  it('no inline transition literal and no CSS animation loop in any Bomb mode file', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const f of readdirSync(dir).filter((n) => /\.(js|jsx)$/.test(n) && !/\.test\./.test(n))) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/transition=\{\{/);
      expect(src, f).not.toMatch(/@keyframes|animation:\s*['"`]/);
    }
  });
});
