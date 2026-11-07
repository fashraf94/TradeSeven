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
import FuseChart, { toGoParts, monoWidth, textBox } from './FuseChart.jsx';
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
    expect(fuse(held(), 105.47).querySelector('[data-fuse-togo]').textContent).toContain('LIVE $105.47'); // …and the pill carries it (refuter C, X-F4)
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
    expect(halo(104)).toBeGreaterThan(halo(102.5));
    expect(halo(102)).toBe(0.2); // 3.9 % away: already the floor (refuter C, X-F3)
    expect(halo(100)).toBe(0.2);
  });
});

// The boxes the placement rules use (mono width; a font size above the baseline, a quarter below).
const boxOf = (t) => textBox(Number(t.getAttribute('x')), Number(t.getAttribute('y')), t.textContent, Number(t.getAttribute('font-size')), Number(t.getAttribute('letter-spacing') || 0), t.getAttribute('text-anchor') || 'start');
const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const leftLabels = (d) => [d.querySelector('svg > text'), d.querySelector('[data-fuse-baseline]'), ...d.querySelectorAll('[data-fuse-rung] text')].map(boxOf);
const pillBoxOf = (d) => { const r = d.querySelector('[data-fuse-togo] rect'); const x = Number(r.getAttribute('x')); const y = Number(r.getAttribute('y')); return { x0: x, x1: x + Number(r.getAttribute('width')), y0: y, y1: y + Number(r.getAttribute('height')) }; };

describe('the pill fits its ghost area and covers no label (D2 and its refuter)', () => {
  it('a long in-band label at 320 / 360 / 375 px: every line fits the pill, and the pill covers no title, caption or baseline', () => {
    const ladder = held(['bagger', 'doubleBagger']);
    for (const w of [320, 360, 375]) for (const h of [280, 324]) {
      const d = doc(renderToStaticMarkup(<FuseChart ladder={ladder} live={111.9} decimals={2} go={toGo(ladder, 111.9)} width={w} height={h} />));
      const pill = pillBoxOf(d);
      for (const t of d.querySelectorAll('[data-fuse-togo] text')) expect(boxOf(t).x0, `${w}×${h}`).toBeGreaterThanOrEqual(pill.x0 - 1e-9);
      expect(leftLabels(d).reduce((s, b) => s + area(pill, b), 0), `${w}×${h}`).toBe(0);
    }
  });
  it('at 430 px it is one line at 9 px', () => {
    const d = fuse(held(['bagger', 'doubleBagger']), 111.9, 430);
    expect(d.querySelectorAll('[data-fuse-togo] text')).toHaveLength(1);
    expect(d.querySelector('[data-fuse-togo]').getAttribute('data-pill-font')).toBe('9');
  });
  it('right of the rail, the live label clears every rung label block (points + price) and the down ticks (refuter C, V-L2)', () => {
    const ladder = held([]);
    let right = 0;
    for (const live of [101, 102, 103, 104.2, 105.2, 106.2, 107, 108.3, 109.4, 110.6, 98.5, 95.5]) {
      const d = doc(renderToStaticMarkup(<FuseChart ladder={ladder} live={live} decimals={2} go={toGo(ladder, live)} width={390} height={324} />));
      const texts = [...d.querySelectorAll('[data-fuse-live-label] text')];
      if (!texts.length || texts[0].getAttribute('text-anchor') !== 'start') continue;
      right += 1;
      const label = texts.map(boxOf);
      const box = { x0: label[0].x0, x1: Math.max(label[0].x1, label[1].x1), y0: label[0].y0, y1: label[1].y1 };
      const others = [...d.querySelectorAll('[data-fuse-rung-label] text, [data-fuse-down] text')].map(boxOf);
      expect(others.reduce((s, b) => s + area(box, b), 0), String(live)).toBe(0);
    }
    expect(right).toBeGreaterThanOrEqual(3);
  });
  it('the live label pushed left of the rail covers no rung title — a title carrying its seen check time included (D7 and its refuter)', () => {
    const ladder = held(['bagger']);
    const at = Date.parse('2026-10-14T17:45:00.000Z');
    for (const live of [106.45, 106.75, 107.05]) {
      const d = doc(renderToStaticMarkup(<FuseChart ladder={ladder} live={live} decimals={2} go={toGo(ladder, live)} bankedTimes={{ bagger: at }} width={320} height={280} />));
      expect(d.querySelector('[data-fuse-banked-at="bagger"]')).not.toBeNull();
      const label = [...d.querySelectorAll('[data-fuse-live-label] text')].map(boxOf);
      const box = { x0: Math.min(...label.map((b) => b.x0)), x1: Math.max(...label.map((b) => b.x1)), y0: label[0].y0, y1: label[1].y1 };
      expect(leftLabels(d).reduce((s, b) => s + area(box, b), 0), String(live)).toBe(0);
    }
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
  it('…at the left end too: a long label over the first rung stays inside the sheet\'s left edge (refuter C, X-S1)', () => {
    const big = measuredLadder({ measured: { measured: true, baselinePrice: 100000, targets: [['bagger', 106000], ['doubleBagger', 109000], ['tenBagger', 112000], ['bust', 94000], ['crash', 91000], ['meltdown', 88000]].map(([key, price]) => ({ key, price })), crossedTiers: [] } });
    const go = toGo(big, 106100);
    const view = { ladder: big, go, live: 106100, decimals: 2, sheetLine: sheetLine({ ladder: big, decimals: 2 }), sheetScored: null };
    const d = doc(renderToStaticMarkup(<BombSheet view={view} />));
    const el = d.querySelector('[data-sheet-togo]');
    const w = monoWidth(el.textContent, 8.5, 0.5);
    expect(el.textContent.length).toBeGreaterThanOrEqual(40);
    expect(Number(el.getAttribute('x')) - w / 2).toBeGreaterThanOrEqual(14 - 1e-9);
  });
});
