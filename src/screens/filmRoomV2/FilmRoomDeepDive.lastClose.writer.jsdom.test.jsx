// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomDeepDive.lastClose.writer.jsdom.test.jsx
//
// The follow-up pass before 'on' — THE LAST-CLOSE LABEL AGAINST THE MARKERS
// (A2A2-2's refuters: an evidence marker can sit over the last close's label).
// The label never shares a box with an evidence marker, the swap labels' row
// or an axis gutter. lastCloseTop chooses its band; this file checks the
// chart's own geometry at the two plot widths the visual check lays out —
//   390 × 844   the plot is 226 px wide (measured in headless Edge; 390 − 2 × 12 main − 2 × 14 card
//               − 2 × 1 border − 64 − 46)
//   1440 × 900  the plot is 712 px wide (measured; 1240 − 2 × 24 main − 320 facts − 20 gap − 2 × 14 card
//               − 2 × 1 border − 64 − 46)
// — on a writer-built day (the REAL close and candle passes) where INTC's
// 2:45 PM evidence quote is planted at its own last close, so a marker falls
// beside the close at the label's height. jsdom has no layout: the boxes come
// from the chart's own positions (px heights, % widths) and the label's width
// bound; the real-layout measurement in headless Edge is the build report's
// §9 visual check.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomDeepDive, { lastCloseTop, lastCloseLabelPx } from './FilmRoomDeepDive';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { mounter, sep23Tape, sep23Series, sweepNumbers } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const WIDTHS = { 390: 226, 1440: 712 };
const HEIGHT = { 390: 250, 1440: 340 };

/** The label's box and every marker's box, in px, on a plot `w` wide. */
function boxes(w) {
  const lab = m.q('[data-axis-record="lastClose"]');
  const text = lab.querySelector('[data-num-text]').textContent;
  const width = lastCloseLabelPx(text);
  const top = parseFloat(lab.style.top);
  let left;
  if (lab.style.right) left = w - (Number(lab.style.right.match(/^calc\((-?[\d.]+)% \+ 2px\)$/)[1]) / 100) * w - 2 - width;
  else left = (Number(lab.style.left.match(/^calc\((-?[\d.]+)% \+ 4px\)$/)[1]) / 100) * w + 4;
  const label = { left, right: left + width, top, bottom: top + 13 };
  const markers = m.qa('[data-evidence-marker]').map((b) => {
    const l = (Number(b.style.left.match(/^calc\((-?[\d.]+)% - 12px\)$/)[1]) / 100) * w - 12;
    const t = parseFloat(b.style.top);
    return { id: b.getAttribute('data-evidence-marker'), left: l, right: l + 24, top: t, bottom: t + 24 };
  });
  return { label, markers };
}
const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

let planted;
beforeAll(async () => {
  const fx = await sep23Day();
  const lastClose = sep23Series.find((s) => s.symbol === 'INTC').bars.at(-1).c;
  const e = fx.battle.evaluations.find((v) => v.evalId.endsWith(':e19'));
  e.evidence.INTC.px = lastClose;   // the platform's quote at 2:45 PM, planted at INTC's own last close
  planted = await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() });
});

describe('the last-close label never shares a box with an evidence marker (writer-built, at 390 and 1440)', () => {
  it('the planted day: INTC\'s 2:45 PM marker sits at the last close\'s height, beside the line\'s end', () => {
    const doc = planted.series.find((s) => s.symbol === 'INTC');
    const k = planted.tape.checks.findIndex((c) => c.evidenceAt === '2026-09-23T18:45:07.000Z');
    expect(planted.tape.checks[k].evidence.INTC.px).toBe(doc.bars.at(-1).c);
  });

  for (const vw of [390, 1440]) {
    it(`${vw}: the label's box meets no marker's box — where the old place (just above the line's end) met the planted one at 390`, () => {
      m.render(<FilmRoomDeepDive tape={planted.tape} seriesState={{ status: 'ready', series: planted.series }} sym="INTC" onSym={() => {}} desktop={vw === 1440} />);
      const w = WIDTHS[vw];
      const { label, markers } = boxes(w);
      const planted245 = markers.find((mk) => planted.tape.checks[Number(mk.id)].evidenceAt === '2026-09-23T18:45:07.000Z');
      expect(planted245).toBeTruthy();
      for (const mk of markers) expect(meets(label, mk), `marker ${mk.id}`).toBe(false);
      // the scenario is real: the label's old band (16 px above the line's end) meets the planted marker at 390
      const endY = planted245.top + 12;
      const old = { ...label, top: endY - 16, bottom: endY - 3 };
      if (vw === 390) expect(meets(old, planted245)).toBe(true);
      // and it stays inside the plot: no axis gutter, no time axis
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.right).toBeLessThanOrEqual(w);
      expect(label.top).toBeGreaterThanOrEqual(0);
      expect(label.bottom).toBeLessThanOrEqual(HEIGHT[vw]);
      expect(sweepNumbers(m.container, { tape: planted.tape, ...Object.fromEntries(planted.series.map((s) => [`series:${s.symbol}`, s])) })).toEqual([]);
    });
  }

  it('the label\'s box is the box the chooser places: exactly 13 px from its top — flex, line-height 1 — never a line box the page\'s font sets (found by the real-layout measurement: an inline box stood 21 px tall, its figures 8 px down)', () => {
    m.render(<FilmRoomDeepDive tape={planted.tape} seriesState={{ status: 'ready', series: planted.series }} sym="INTC" onSym={() => {}} />);
    const lab = m.q('[data-axis-record="lastClose"]');
    expect([lab.style.display, lab.style.alignItems, lab.style.height, lab.style.lineHeight]).toEqual(['flex', 'center', '13px', '1']);
  });

  it('every symbol of the committed Sep-23 day, at both widths: no label meets a marker, or the swap labels\' row', () => {
    for (const sym of sep23Series.map((s) => s.symbol).filter((s) => !['SPY', 'RSP'].includes(s) && !s.startsWith('XL'))) {
      for (const vw of [390, 1440]) {
        m.render(<FilmRoomDeepDive tape={sep23Tape} seriesState={{ status: 'ready', series: sep23Series }} sym={sym} onSym={() => {}} desktop={vw === 1440} />);
        if (!m.q('[data-axis-record="lastClose"]')) continue;
        const { label, markers } = boxes(WIDTHS[vw]);
        for (const mk of markers) expect(meets(label, mk), `${sym} ${vw} marker ${mk.id}`).toBe(false);
        if (m.q('[data-swap-label]')) expect(label.top, `${sym} ${vw} swap row`).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('lastCloseTop — the band it chooses', () => {
  const base = { endX: 1000, endY: 100, before: true, labelPx: 60, maxTop: 237, floorTop: 214 };
  it('no marker near: the usual place, 16 px above the line\'s end', () => {
    expect(lastCloseTop(base)).toBe(84);
    expect(lastCloseTop({ ...base, markers: [{ x: 100, y: 90 }] })).toBe(84);   // far to the left: never near
  });
  it('a near marker at the line\'s height: the nearest clear band — above it first, then below', () => {
    const top = lastCloseTop({ ...base, markers: [{ x: 900, y: 100 }] });
    expect(top + 13 <= 87 || top >= 113).toBe(true);
    expect(top).toBe(74);   // 84 is blocked; the band ending at the marker's box top is the nearest
  });
  it('near markers above and below: a band between them, else beyond them, else under the price area', () => {
    const between = lastCloseTop({ ...base, markers: [{ x: 950, y: 70 }, { x: 950, y: 130 }] });
    expect(between >= 83 && between + 13 <= 117).toBe(true);
    const crowd = Array.from({ length: 12 }, (_, i) => ({ x: 950, y: 10 + i * 20 }));
    expect(lastCloseTop({ ...base, markers: crowd })).toBe(214);
  });
  it('the swap labels\' row is a band when the symbol has one', () => {
    expect(lastCloseTop({ ...base, endY: 20 })).toBe(4);
    expect(lastCloseTop({ ...base, endY: 20, swapRow: true })).toBeGreaterThanOrEqual(15);
  });
  it('"near" is judged at the narrowest plot: a marker the label could reach at 150 px is near, one it cannot is not', () => {
    // before: the label spans 62 px left of the line's end → up to (60 + 2 + 12) px = 493 units at 150 px
    expect(lastCloseTop({ ...base, markers: [{ x: 1000 - 490, y: 100 }] })).not.toBe(84);
    expect(lastCloseTop({ ...base, markers: [{ x: 1000 - 500, y: 100 }] })).toBe(84);
    // after: the label starts 4 px right of the line's end
    const after = { ...base, endX: 300, before: false };
    expect(lastCloseTop({ ...after, markers: [{ x: 300 + 500, y: 100 }] })).not.toBe(84);
    expect(lastCloseTop({ ...after, markers: [{ x: 300 + 510, y: 100 }] })).toBe(84);
  });
});
