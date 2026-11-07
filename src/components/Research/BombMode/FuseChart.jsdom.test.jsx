// @vitest-environment jsdom
//
// Research Modal Build A — the Fuse's and the sheet's label rules (spec §4.3;
// Amendment A R-11′(d); review lens C C6, lens D D1/D2). jsdom computes no
// layout, so these rows pin the RULES the code places labels by (which label
// draws, which line a pill uses, where a label is clamped); the measured boxes
// at 320/390/430 px are the browser record in the build report.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuseChart, { toGoParts, monoWidth } from './FuseChart.jsx';
import BombSheet from './BombSheet.jsx';
import { previewLadder, measuredLadder, toGo } from './ladder.js';
import { sheetLine } from './bombView.js';

const doc = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
const held = (crossed = []) => measuredLadder({ measured: { measured: true, baselinePrice: 100, targets: [['bagger', 106], ['doubleBagger', 109], ['tenBagger', 112], ['bust', 94], ['crash', 91], ['meltdown', 88]].map(([key, price]) => ({ key, price })), crossedTiers: crossed } });
const fuse = (ladder, live, width = 390) => doc(renderToStaticMarkup(<FuseChart ladder={ladder} live={live} decimals={2} go={toGo(ladder, live)} width={width} height={324} />));

describe('R-11′(d): inside the band the live label yields to the rung label; the pill carries the live number', () => {
  it('in band (0.38 %): no live label; the pill names the live price', () => {
    const d = fuse(held(), 105.6);
    expect(d.querySelector('[data-fuse-live-label]')).toBeNull();
    expect(d.querySelector('[data-fuse-togo]').textContent).toContain('LIVE $105.60');
  });
  it('the band reads the DISPLAYED % (review A3): 0.5025 % shows as 0.50 % and is in band', () => {
    const go = toGo(held(), 105.47);
    expect(go.pct).toBeGreaterThan(0.5);
    expect(go.pctShown).toBe(0.5);
    expect(fuse(held(), 105.47).querySelector('[data-fuse-live-label]')).toBeNull();
  });
  it('out of band (1.9 %): the live label draws; the pill does not repeat the price', () => {
    const d = fuse(held(), 104);
    expect(d.querySelector('[data-fuse-live-label]').textContent).toContain('$104.00');
    expect(d.querySelector('[data-fuse-togo]').textContent).not.toContain('LIVE');
  });
});

describe('the halo brightens as the distance shrinks', () => {
  it('closer → brighter; 3 % or more → the faint floor', () => {
    const halo = (live) => Number(fuse(held(), live).querySelector('[data-fuse-bead]').getAttribute('data-halo'));
    expect(halo(105.6)).toBeGreaterThan(halo(104));
    expect(halo(104)).toBeGreaterThan(halo(102));
    expect(halo(100)).toBe(0.2);
  });
});

describe('the pill fits its ghost area (D2)', () => {
  it('at 320 px a long in-band label goes to two lines; at 430 px it is one', () => {
    const ladder = held(['bagger', 'doubleBagger']);
    const lines = (w) => fuse(ladder, 111.9, w).querySelectorAll('[data-fuse-togo] text').length;
    expect(lines(320)).toBe(2);
    expect(lines(430)).toBe(1);
  });
  it('a preview at or over a rung says only "At +15" — no check scores a stock nobody holds', () => {
    const p = previewLadder({ previousClose: 100, threshold: 6 });
    expect(toGoParts(p, toGo(p, 106.2)).base).toBe('At +15');
    expect(fuse(p, 106.2).querySelector('[data-fuse-togo]').textContent).not.toMatch(/CHECK/);
    expect(toGoParts(held(), toGo(held(), 106.2)).base).toBe('At +15 · a check decides');
  });
});

describe('the sheet keeps its to-go label whole inside the sheet (D1)', () => {
  it('the label is centred over the next rung but clamped by its own drawn width', () => {
    const ladder = held(['bagger', 'doubleBagger']); // next = +50 at the rail's right end
    const go = toGo(ladder, 111.9);
    const view = { ladder, go, live: 111.9, decimals: 2, sheetLine: sheetLine({ ladder, decimals: 2 }), sheetScored: null };
    const d = doc(renderToStaticMarkup(<BombSheet view={view} />));
    const el = d.querySelector('[data-sheet-togo]');
    const w = monoWidth(el.textContent, 8.5, 0.5);
    const W = Number(d.querySelector('svg').getAttribute('width'));
    expect(Number(el.getAttribute('x')) + w / 2).toBeLessThanOrEqual(W - 4 + 1e-9);
    expect(Number(el.getAttribute('x')) - w / 2).toBeGreaterThanOrEqual(14 - 1e-9);
  });
});
