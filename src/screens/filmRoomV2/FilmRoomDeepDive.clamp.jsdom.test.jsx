// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.clamp.jsdom.test.jsx
//
// Film Room B2.1 A8 — the two clamps (A2F2-4: swap labels inside the chart at
// phone widths; B6: the wide last-close label inside the plot at 320 px). jsdom
// lays nothing out, so these rows prove the ARITHMETIC the chart is given and,
// with stubbed boxes, that it reaches the DOM; the layout itself was measured
// in headless Edge at 280 / 320 / 360 / 390 / 1440 px (the build report's
// table): before, every phone case left the chart; after, none does.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FilmRoomDeepDive, { swapLabelLayout, lastCloseLeftPx, lastCloseLabelPx } from './FilmRoomDeepDive';
import { mounter, sep23Tape, sep23Series, clone, sweepNumbers, sweepWords } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

describe('lastCloseLeftPx — B6: the label\'s box inside the measured plot', () => {
  it('null where nothing lays the plot out: the CSS anchors stand', () => {
    expect(lastCloseLeftPx({ endX: 300, before: false, labelPx: 95, plotPx: 0 })).toBeNull();
  });
  it('Astra\'s B6: a line ending mid-session on a 156 px plot, "7,500,000.00" — the box ends at the plot\'s edge, never past it', () => {
    const labelPx = lastCloseLabelPx('7,500,000.00');
    const left = lastCloseLeftPx({ endX: 400, before: false, labelPx, plotPx: 156.4 });
    expect(left + labelPx).toBeLessThanOrEqual(156.4);
    expect(left).toBeCloseTo(156.4 - labelPx, 5);
  });
  it('review SPR-L-6 — a label that fits at its anchor keeps the CSS anchor (null): labelPx is an upper bound, and placing by it moved every label off its line\'s end', () => {
    expect(lastCloseLeftPx({ endX: 200, before: false, labelPx: 50, plotPx: 300 })).toBeNull();
    expect(lastCloseLeftPx({ endX: 900, before: true, labelPx: 50, plotPx: 300 })).toBeNull();
  });
  it('a label its anchor would put out of the plot is clamped inside: before the end, at 0; after it, against the right edge', () => {
    expect(lastCloseLeftPx({ endX: 100, before: true, labelPx: 50, plotPx: 300 })).toBe(0);
    expect(lastCloseLeftPx({ endX: 900, before: false, labelPx: 50, plotPx: 300 })).toBeCloseTo(250, 5);
  });
});

describe('swapLabelLayout — A2F2-4: every label inside the chart region', () => {
  it('null until every label has a width at a measured plot', () => {
    expect(swapLabelLayout({ labels: [{ i: 0, lineX: 100, right: true, w: 120 }], plotPx: 0 })).toBeNull();
    expect(swapLabelLayout({ labels: [{ i: 0, lineX: 100, right: true, w: 0 }], plotPx: 300 })).toBeNull();
  });
  it('a right-anchored label that would leave the region\'s left edge is moved in: its "Exit ·" and clock stay on screen', () => {
    const l = swapLabelLayout({ labels: [{ i: 2, lineX: 120, right: true, w: 260 }], plotPx: 300 });
    expect(l.lane).toBe(false);
    expect(l.at[2]).toBe(-64);   // the region's left edge (the price axis's gutter)
    expect(l.at[2] + 260).toBeLessThanOrEqual(300 + 46);
  });
  it('a left-anchored label that would leave the right edge is moved in; one with room keeps its anchor', () => {
    const l = swapLabelLayout({ labels: [{ i: 0, lineX: 250, right: false, w: 200 }, { i: 1, lineX: 40, right: false, w: 100 }], plotPx: 300 });
    expect(l.at[0]).toBe(346 - 200);
    expect(l.at[1]).toBe(46);
  });
  it('a label wider than the whole region (a 320 px phone): every label goes to the lane above the plot, each from its clamped place', () => {
    const l = swapLabelLayout({ labels: [{ i: 0, lineX: 140, right: true, w: 312 }], plotPx: 158 });
    expect(l.lane).toBe(true);
    expect(l.regionW).toBe(64 + 158 + 46);
    expect(l.at[0]).toBe(-64);
  });
});

/** Stub every box: the plot `plotPx` wide, each swap label `labelPx` wide (one line), everything else 0. */
function stubBoxes(plotPx, labelPx) {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const width = this.hasAttribute?.('data-plot') ? plotPx : this.hasAttribute?.('data-swap-label') ? labelPx : 0;
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} };
  });
}
const docs = (tape) => ({ tape, ...Object.fromEntries(sep23Series.map((s) => [`series:${s.symbol}`, s])) });

describe('the chart applies them where the boxes are measured', () => {
  it('a 158 px plot (a 320 px phone), PANW\'s 312 px label: the label sits in the lane above the plot, inside the region, wrapped — every word kept', () => {
    const stub = stubBoxes(158, 312);
    try {
      m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'ready', series: sep23Series }} sym="PANW" onSym={() => {}} />);
      const lane = m.q('[data-swap-lane]');
      expect(lane).not.toBeNull();
      expect(lane.nextElementSibling.hasAttribute('data-plot')).toBe(true);
      const label = lane.querySelector('[data-swap-label]');
      expect(label.textContent).toBe('Entry · 3:00 PM · in for ETN · by platform rule · stagnation');
      expect(label.style.whiteSpace).toBe('normal');
      expect(parseFloat(label.style.marginLeft)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(label.style.marginLeft) + parseFloat(label.style.maxWidth)).toBeLessThanOrEqual(64 + 158 + 46 + 0.01);
      expect(m.q('[data-plot] [data-swap-label]')).toBeNull();
      expect(sweepNumbers(m.container, docs(sep23Tape))).toEqual([]);
      expect(sweepWords(m.container, docs(sep23Tape))).toEqual([]);
    } finally {
      stub.mockRestore();
    }
  });

  it('a 712 px plot (desktop), a 260 px label: on the plot\'s top row, placed in px, inside the region', () => {
    const stub = stubBoxes(712, 260);
    try {
      m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'ready', series: sep23Series }} sym="PANW" onSym={() => {}} desktop />);
      expect(m.q('[data-swap-lane]')).toBeNull();
      const label = m.q('[data-plot] [data-swap-label]');
      expect(label.style.left).toMatch(/^-?[\d.]+px$/);
      const left = parseFloat(label.style.left);
      expect(left).toBeGreaterThanOrEqual(-64);
      expect(left + 260).toBeLessThanOrEqual(712 + 46);
    } finally {
      stub.mockRestore();
    }
  });

  it('B6 through the chart: INTC ending after 19 buckets at 7,500,000 on a 156 px plot — the last close placed in px, inside the plot', () => {
    const series = clone(sep23Series);
    const d = series.find((s) => s.symbol === 'INTC');
    d.bars = d.bars.slice(0, 19).map((b) => ({ ...b, o: 7500000, h: 7500000, l: 7500000, c: 7500000 }));
    d.sessionOpen.value = 7500000;
    const stub = stubBoxes(156, 0);
    try {
      m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'ready', series }} sym="INTC" onSym={() => {}} />);
      const lab = m.q('[data-axis-record="lastClose"]');
      expect(lab.style.left).toMatch(/^[\d.]+px$/);
      expect(parseFloat(lab.style.left) + lastCloseLabelPx('7,500,000.00')).toBeLessThanOrEqual(156);
    } finally {
      stub.mockRestore();
    }
  });

  it('unmeasured (jsdom, the goldens): the CSS anchors, style for style as before', () => {
    m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'ready', series: sep23Series }} sym="PANW" onSym={() => {}} />);
    expect(m.q('[data-swap-lane]')).toBeNull();
    expect(m.q('[data-swap-label]').getAttribute('style')).toMatch(/^position: absolute; top: 0px; right: calc\([\d.]+% \+ 6px\); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;/);
    expect(m.q('[data-axis-record="lastClose"]').style.left || m.q('[data-axis-record="lastClose"]').style.right).toMatch(/^calc\(/);
  });
});
