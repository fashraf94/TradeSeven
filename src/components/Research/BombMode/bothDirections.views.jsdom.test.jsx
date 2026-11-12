// @vitest-environment jsdom
//
// Bomb mode refinement (2026-11-10) — the views in both directions:
//   BD-3  the Fuse at full scale (one scale; the downside drawn like the upside;
//         HIT; two pills, the lead strong; the halo and the rail fill by side;
//         ticks both sides; legibility at 375 px at the phone chart heights);
//   BD-4  the bar (one scale; prices on the baseline and each side's next rung;
//         one to-go line, lead first) and the lead-aware "what has to happen";
//   BD-5  the Danger Zone view and its chip;
//   BD-6  the levels table (seven rows by price, the live marker, the states,
//         display agreement with the Fuse and the bar, the Details);
//   BD-8  the chip names the check; BD-9 the entry line's time.
// The AMZN fixture is the founder's Nov 10 position in production shape
// (build report §1.1): fill $270.22 at 3.954943 %, live $268.09.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuseChart, { textBox, FUSE_TOP_K, FUSE_BOTTOM_K } from './FuseChart.jsx';
import BombSheet, { sheetToGo, levelRows } from './BombSheet.jsx';
import RedZone from './RedZone.jsx';
import { RedZoneChip } from './BombPlot.jsx';
import { measuredLadder, previewLadder, toGo, toGoDown } from './ladder.js';
import { sheetLine, scoredChipText, rungFacts } from './bombView.js';
import { BOMB_COPY } from './bombCopy.js';
import { amznRecord } from './__fixtures__/bombBattles.js';

const doc = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
const amzn = (over = {}) => { const r = amznRecord(over); return measuredLadder({ measured: r.measured, entryAtMs: r.entry.atMs }); };
const fuse = (ladder, live, { width = 375, height = 354, lead = null, hitTimes = {}, bankedTimes = {} } = {}) => doc(renderToStaticMarkup(
  <FuseChart ladder={ladder} live={live} decimals={2} go={toGo(ladder, live)} goDown={toGoDown(ladder, live)} lead={lead} hitTimes={hitTimes} bankedTimes={bankedTimes} width={width} height={height} />,
));
const viewOf = (ladder, live, over = {}) => {
  const go = toGo(ladder, live);
  const goDown = toGoDown(ladder, live);
  const lead = over.lead ?? null;
  return { ladder, go, goDown, lead, live, decimals: 2, marketOpen: true, bankedTimes: {}, hitTimes: {}, sheetScored: null, sheetLine: sheetLine({ ladder, lead, decimals: 2, clockLabel: '1:15' }), ...over };
};
const textOf = (el) => (el ? el.textContent : null);

describe('BD-3 — the Fuse in both directions (the founder\'s AMZN at $268.09)', () => {
  const d = fuse(amzn(), 268.09, { lead: 'down' });
  it('the downside rungs are drawn like the upside: a line across the plot, the title with its %, the points and price right of the rail', () => {
    for (const [key, title, pts, price] of [['bust', 'BUST · −3.95%', '−10', '$259.53'], ['crash', 'CRASH · −5.93%', '−20', '$254.18'], ['meltdown', 'MELTDOWN · −7.91%', '−35', '$248.84']]) {
      const g = d.querySelector(`[data-fuse-rung="${key}"][data-side="down"]`);
      expect(g.querySelector('line')).not.toBeNull();
      expect(textOf(g.querySelector('text'))).toBe(title);
      const right = d.querySelector(`[data-fuse-down="${key}"]`);
      expect(right.querySelector('text').textContent).toBe(pts);
      expect(textOf(right.querySelector(`[data-fuse-price="${key}"]`))).toBe(price); // at 354 px every price is drawn (review N6)
    }
    expect(textOf(d.querySelector('[data-fuse-rung="bagger"] text'))).toBe('BAGGERBOMB · +3.95%');
  });
  it('"Below · compressed" is gone; the faint red tint below the baseline stays', () => {
    expect(d.body.textContent).not.toMatch(/compressed/i);
    expect([...d.querySelectorAll('rect')].some((r) => (r.getAttribute('style') || '').includes('--ft-neg') && (r.getAttribute('style') || '').includes(' 4%'))).toBe(true);
  });
  it('one vertical scale: the same pixels per threshold above and below the baseline; the window shows all six rungs', () => {
    const y = (key) => Number(d.querySelector(`[data-fuse-rung="${key}"] line`).getAttribute('y1'));
    const yEntry = Number(d.querySelector('[data-fuse-baseline]').getAttribute('y')) + 5;
    expect(y('bust') - yEntry).toBeCloseTo(yEntry - y('bagger'), 6);
    expect(y('meltdown') - yEntry).toBeCloseTo(yEntry - y('tenBagger'), 6);
    expect(y('tenBagger')).toBeGreaterThan(38);
    expect(y('meltdown')).toBeLessThan(354 - 22);
    expect(FUSE_TOP_K).toBe(2.22);
    expect(FUSE_BOTTOM_K).toBe(-2.12);
  });
  it('two pills: the lead (down) strong in red at 9 px, the other quiet; each names its own side\'s distance', () => {
    const down = d.querySelector('[data-fuse-togo="down"]');
    const up = d.querySelector('[data-fuse-togo="up"]');
    expect(down.getAttribute('data-togo-lead')).toBe('1');
    expect(up.getAttribute('data-togo-lead')).toBe('0');
    expect(down.textContent).toBe('3.2% · 5 BRICKS TO BUST −10'); // the founder's own numbers (one decimal from 1 % up, Build A's rule)
    expect(up.textContent).toBe('4.8% · 8 BRICKS TO +15');
    expect(down.getAttribute('data-pill-font')).toBe('9');
    expect(Number(up.getAttribute('data-pill-font'))).toBeLessThanOrEqual(8);
    expect(down.querySelector('text').getAttribute('style')).toContain('--ft-neg');
    expect(up.querySelector('text').getAttribute('style')).toContain('--ft-ink-3');
  });
  it('the downside pill sits below its rung, the upside pill above its rung (at a roomy height)', () => {
    const r = fuse(amzn(), 268.09, { lead: 'down', height: 404 });
    const pillY = (side) => Number(r.querySelector(`[data-fuse-togo="${side}"] rect`).getAttribute('y'));
    const lineY = (key) => Number(r.querySelector(`[data-fuse-rung="${key}"] line`).getAttribute('y1'));
    expect(pillY('down')).toBeGreaterThan(lineY('bust'));
    const upRect = r.querySelector('[data-fuse-togo="up"] rect');
    expect(Number(upRect.getAttribute('y')) + Number(upRect.getAttribute('height'))).toBeLessThan(lineY('bagger'));
  });
  it('the halo follows the lead side and is red when the downside leads; the rail fills red from the baseline down to the bead', () => {
    expect(d.querySelector('[data-fuse-bead]').getAttribute('data-halo-side')).toBe('down');
    expect(d.querySelector('[data-fuse-bead] circle').getAttribute('style')).toContain('bombFuseHaloDown');
    expect(d.querySelector('[data-fuse-fill="down"]')).not.toBeNull();
    expect(d.querySelector('[data-fuse-fill="up"]')).toBeNull();
    const up = fuse(amzn(), 277.5);
    expect(up.querySelector('[data-fuse-bead]').getAttribute('data-halo-side')).toBe('up');
    expect(up.querySelector('[data-fuse-fill="up"]')).not.toBeNull();
  });
  it('brick ticks on both sides (5 each way between the baseline and ±2, rungs excepted)', () => {
    const ticks = [...d.querySelectorAll('[data-fuse-brick]')].map((t) => Number(t.getAttribute('data-fuse-brick')));
    expect(ticks.filter((b) => b > 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 7, 8, 10, 11]);
    expect(ticks.filter((b) => b < 0).sort((a, b) => b - a)).toEqual([-1, -2, -3, -4, -5, -7, -8, -10, -11]);
  });
  it('a hit rung is solid and says HIT — with the check when the modal saw it, else without', () => {
    const seen = fuse(amzn({ crossedTiers: ['bust'] }), 257, { lead: 'down', hitTimes: { bust: Date.parse('2026-11-10T18:15:00.000Z') } });
    const g = seen.querySelector('[data-fuse-rung="bust"]');
    expect(g.getAttribute('data-rung-state')).toBe('hit');
    expect(g.querySelector('line').getAttribute('stroke-dasharray')).toBeNull();
    expect(textOf(g.querySelector('text'))).toBe('BUST · HIT 1:15');
    expect(textOf(fuse(amzn({ crossedTiers: ['bust'] }), 257, { lead: 'down' }).querySelector('[data-fuse-rung="bust"] text'))).toBe('BUST · HIT');
    expect(seen.querySelector('[data-fuse-down="bust"]').getAttribute('data-down-hit')).toBe('1');
  });
});

// Every label box in the plot, as the placement rules size them (mono: 0.6 em a glyph), pill rects for pills.
function labelBoxes(d) {
  const boxes = [];
  for (const t of d.querySelectorAll('svg text')) {
    if (t.closest('[data-fuse-togo]') || t.closest('[data-bomb-preview-chip]')) continue;
    const group = t.closest('[data-fuse-rung-label], [data-fuse-down], [data-fuse-live-label]');
    boxes.push({ ...textBox(Number(t.getAttribute('x')), Number(t.getAttribute('y')), t.textContent, Number(t.getAttribute('font-size')), Number(t.getAttribute('letter-spacing') || 0), t.getAttribute('text-anchor') || 'start'), group, base: Number(t.getAttribute('y')), what: t.textContent });
  }
  for (const r of d.querySelectorAll('[data-fuse-togo] rect, [data-bomb-preview-chip] rect')) {
    const x = Number(r.getAttribute('x')); const y = Number(r.getAttribute('y'));
    boxes.push({ x0: x, x1: x + Number(r.getAttribute('width')), y0: y, y1: y + Number(r.getAttribute('height')), group: null, what: `pill ${r.parentNode.getAttribute('data-fuse-togo') || 'chip'}` });
  }
  return boxes;
}
const overlaps = (boxes) => {
  const out = [];
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i]; const b = boxes[j];
    // One rung's own points STACKED over its own price is one block (the model's quarter-em descent meets
    // the price's cap by 0.75 px); on the SAME line (an inline price) they must not touch (review C9).
    if (a.group && a.group === b.group && a.base !== b.base) continue;
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w > 0 && h > 0) out.push(`${a.what} × ${b.what}`);
  }
  return out;
};

describe('BD-3 — legibility at a 375-px phone at the phone chart heights: no two label boxes overlap', () => {
  // The measured phone plot heights (Build A report §7: 324 / 354 / 404 px at 320×700 / 390×760 / 430×860;
  // at 375×812 the modal's 100vh container gives ≈ 375).
  const HEIGHTS = [280, 324, 354, 375, 404];
  const CASES = [
    ['up leading (AMZN at $277.50)', amzn(), 277.5, 'up'],
    ['down leading (AMZN at $268.09)', amzn(), 268.09, 'down'],
    ['at the baseline (6 bricks each way)', amzn(), 270.22, 'up'],
    ['near Bust (the Danger Zone price, drawn on the Fuse)', amzn(), 260.4, 'down'],
    ['Bust hit, Crash next', amzn({ crossedTiers: ['bust'] }), 257, 'down'],
    ['+15 banked, +30 next', amzn({ crossedTiers: ['bagger'] }), 283.1, 'up'],
    ['a preview (yesterday\'s close $99, 2 %)', previewLadder({ previousClose: 99, threshold: 2 }), 98.4, 'down'],
  ];
  it.each(CASES)('%s', (_, ladder, live, lead) => {
    for (const height of HEIGHTS) {
      const d = fuse(ladder, live, { lead, height, hitTimes: { bust: Date.parse('2026-11-10T18:15:00.000Z') }, bankedTimes: { bagger: Date.parse('2026-11-10T18:15:00.000Z') } });
      expect(overlaps(labelBoxes(d)), `375×${height}`).toEqual([]);
      // …and every label ends inside the plot (review C9: no right-edge bound before)
      for (const b of labelBoxes(d)) expect(b.x1, `375×${height} ${b.what}`).toBeLessThanOrEqual(375 + 1e-9);
      // every rung keeps its name and its points
      for (const r of ladder.rungs) {
        expect(d.querySelector(`[data-fuse-rung="${r.key}"] text`), `${r.key} title @${height}`).not.toBeNull();
        expect(d.querySelector(`[data-fuse-rung-label="${r.key}"] text, [data-fuse-down="${r.key}"] text`), `${r.key} points @${height}`).not.toBeNull();
      }
    }
  });
  it('when one side\'s blocks would collide, its non-next rungs drop their price line first, then the next rung\'s price moves onto its points\' line — never a name or the points (280 px, the modal\'s floor)', () => {
    const roomy = fuse(amzn(), 268.09, { lead: 'down', height: 404 });
    expect(roomy.querySelector('[data-fuse-price="crash"]')).not.toBeNull(); // roomy: every price, under its points
    const d = fuse(amzn(), 268.09, { lead: 'down', height: 280 });
    expect(d.querySelector('[data-fuse-price="crash"]')).toBeNull(); // a non-next rung on a crowded side drops its price
    expect(d.querySelector('[data-fuse-price="tenBagger"]')).toBeNull();
    const bust = d.querySelector('[data-fuse-price="bust"]'); // the next rung keeps its price, on its points' line
    expect(bust.textContent).toBe('$259.53');
    expect(Number(bust.getAttribute('y'))).toBe(Number(d.querySelector('[data-fuse-down="bust"] text').getAttribute('y')));
    expect(Number(bust.getAttribute('x'))).toBeGreaterThan(Number(d.querySelector('[data-fuse-down="bust"] text').getAttribute('x')));
    expect(d.querySelector('[data-fuse-down="crash"] text').textContent).toBe('−20');
    expect(textOf(d.querySelector('[data-fuse-rung="crash"] text'))).toBe('CRASH · −5.93%');
    expect(overlaps(labelBoxes(d))).toEqual([]);
  });
});

describe('BD-4 — the bar at full scale and the one to-go line', () => {
  const view = viewOf(amzn(), 268.09, { lead: 'down' });
  const d = doc(renderToStaticMarkup(<BombSheet view={view} />));
  it('Meltdown at the left end, TenBagger at the right, the baseline at its true place on one scale', () => {
    const x = (key) => Number(d.querySelector(`[data-sheet-rung="${key}"] circle`).getAttribute('cx'));
    const xEntry = Number(d.querySelector('[data-sheet-price="baseline"]').getAttribute('x'));
    expect(x('meltdown')).toBeLessThan(x('crash'));
    expect(x('tenBagger')).toBeGreaterThan(x('doubleBagger'));
    expect(xEntry - x('bust')).toBeCloseTo(x('bagger') - xEntry, 6);
    expect(xEntry - x('meltdown')).toBeCloseTo(x('tenBagger') - xEntry, 6);
  });
  it('every rung shows its points; prices only on the baseline and each side\'s next rung', () => {
    expect([...d.querySelectorAll('[data-sheet-points]')].map((e) => e.textContent).sort()).toEqual(['+15', '+30', '+50', '−10', '−20', '−35'].sort());
    expect([...d.querySelectorAll('[data-sheet-price]')].map((e) => [e.getAttribute('data-sheet-price'), e.textContent])).toEqual([['baseline', '$270.22'], ['bagger', '$280.91'], ['bust', '$259.53']]);
  });
  it('the downside marks are red', () => {
    expect(d.querySelector('[data-sheet-rung="bust"] circle').getAttribute('style')).toContain('--ft-neg');
    expect(d.querySelector('[data-sheet-fill="down"]')).not.toBeNull();
  });
  it('one to-go line, the lead first in its color and weight, the other quieter: ↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15', () => {
    const line = d.querySelector('[data-sheet-togo]');
    expect(line.textContent.replace(/\u00a0/g, ' ')).toBe('↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15'); // the ruling's example, to the character
    // review D9: no-break spaces after each arrow and before the joining "·" — a wrap never strands either
    expect(line.textContent).toBe('↓\u00a03.2% · 5 bricks to Bust −10\u00a0· ↑\u00a04.8% · 8 to +15');
    const lead = line.querySelector('[data-sheet-togo-lead="down"]');
    expect(lead.getAttribute('style')).toMatch(/font-weight:\s*700/);
    expect(lead.getAttribute('style')).toContain('--ft-neg');
    expect(line.querySelector('[data-sheet-togo-other="up"]').getAttribute('style')).toContain('--ft-ink-3');
  });
  it('up leading: ↑ first', () => {
    const t = sheetToGo(amzn(), toGo(amzn(), 277.5), toGoDown(amzn(), 277.5), 'up');
    expect(`${t.lead.text} · ${t.other.text}`).toBe('↑ 1.2% · 2 bricks to +15 · ↓ 6.5% · 11 to Bust −10');
  });
  it('inside the 0.5 % band the lead carries the live number (R-11′(d))', () => {
    const t = sheetToGo(amzn(), toGo(amzn(), 260.4), toGoDown(amzn(), 260.4), 'down');
    expect(t.lead.text).toBe('↓ 0.33% · 1 brick to Bust −10 · live $260.40');
    expect(t.other.text).not.toMatch(/live/);
  });
});

describe('BD-4 — "What has to happen" is lead-aware', () => {
  const l = amzn();
  it('up leads: Needs $280.91 at a check for +15 · Bust at $259.53 · next check 1:15', () => {
    expect(sheetLine({ ladder: l, lead: 'up', clockLabel: '1:15', decimals: 2 })).toBe('Needs $280.91 at a check for +15 · Bust at $259.53 · next check 1:15');
  });
  it('down leads: Bust (−10) if it\'s at or below $259.53 at a check · +15 needs $280.91 · next check 1:15', () => {
    expect(sheetLine({ ladder: l, lead: 'down', clockLabel: '1:15', decimals: 2 })).toBe("Bust (−10) if it's at or below $259.53 at a check · +15 needs $280.91 · next check 1:15");
    expect(sheetLine({ ladder: l, lead: 'down', checking: true, decimals: 2 })).toBe("Bust (−10) if it's at or below $259.53 at a check · +15 needs $280.91 · checking…");
  });
  it('after a hit: Bust −10 hit at the 1:15 check · next below: Crash at $254.18 — the check only when the modal saw it (BA-4)', () => {
    const hit = amzn({ crossedTiers: ['bust'] });
    expect(sheetLine({ ladder: hit, lead: 'down', hitTimes: { bust: Date.parse('2026-11-10T18:15:00.000Z') }, decimals: 2 })).toBe('Bust −10 hit at the 1:15 check · next below: Crash at $254.18');
    expect(sheetLine({ ladder: hit, lead: 'down', decimals: 2 })).toBe('Bust −10 hit · next below: Crash at $254.18');
  });
  it('the banked and all-banked lines stay', () => {
    expect(sheetLine({ ladder: amzn({ crossedTiers: ['bagger'] }), lead: 'up', decimals: 2 })).toBe('+15 banked. Next: $286.26 at a check');
    expect(sheetLine({ ladder: amzn({ crossedTiers: ['bagger', 'doubleBagger', 'tenBagger'] }), lead: 'up', decimals: 2 })).toBe('+95 banked · every rung is banked');
  });
});

describe('BD-6 — the levels table under the bar', () => {
  const view = viewOf(amzn(), 268.09, { lead: 'down' });
  const d = doc(renderToStaticMarkup(<BombSheet view={view} />));
  const rows = () => [...d.querySelectorAll('[data-level], [data-level-live]')];
  it('seven rows top to bottom by price, the live marker between the baseline and Bust: Live $268.09 · −0.8%', () => {
    expect(rows().map((e) => e.getAttribute('data-level') ?? 'live')).toEqual(['tenBagger', 'doubleBagger', 'bagger', 'baseline', 'live', 'bust', 'crash', 'meltdown']);
    expect(d.querySelector('[data-level-live]').textContent).toBe('Live $268.09 · −0.8%');
    expect(d.querySelector('[data-level="baseline"]').textContent).toBe('Entry $270.22 · Tue 11:00 AM');
  });
  it('each row: the emoji and name over `±x.xx% · $price`; the points (bold, in color) over the state', () => {
    const r = d.querySelector('[data-level="bagger"]');
    expect(r.textContent).toContain('💣 BaggerBomb');
    expect(d.querySelector('[data-level-sub="bagger"]').textContent).toBe('+3.95% · $280.91');
    expect(d.querySelector('[data-level-points="bagger"]').textContent).toBe('+15');
    expect(d.querySelector('[data-level-sub="bust"]').textContent).toBe('−3.95% · $259.53');
    expect(d.querySelector('[data-level-points="bust"]').textContent).toBe('−10');
    expect(d.querySelector('[data-level-points="bust"]').getAttribute('style')).toMatch(/font-weight:\s*800/);
  });
  it('the states: next · N bricks on each side\'s next rung; ✓ banked 1:15 (green); hit 1:15 (red); nothing on the rest', () => {
    expect(d.querySelector('[data-level-state-text="bagger"]').textContent).toBe('next · 8 bricks');
    expect(d.querySelector('[data-level-state-text="bust"]').textContent).toBe('next · 5 bricks');
    expect(d.querySelector('[data-level-state-text="crash"]')).toBeNull();
    const at = Date.parse('2026-11-10T18:15:00.000Z');
    const both = doc(renderToStaticMarkup(<BombSheet view={viewOf(amzn({ crossedTiers: ['bagger', 'bust'] }), 268.09, { lead: 'down', bankedTimes: { bagger: at }, hitTimes: { bust: at } })} />));
    expect(both.querySelector('[data-level-state-text="bagger"]').textContent).toBe('✓ banked 1:15');
    expect(both.querySelector('[data-level-state-text="bagger"]').getAttribute('style')).toContain('--ft-pos');
    expect(both.querySelector('[data-level-state-text="bust"]').textContent).toBe('hit 1:15');
    expect(both.querySelector('[data-level-state-text="bust"]').getAttribute('style')).toContain('--ft-neg');
    expect(both.querySelector('[data-level-state-text="crash"]').textContent).toBe('next · 8 bricks'); // $268.09 − $254.18 = $13.91 = 7.8 bricks → 8
  });
  it('the market closed: the marker says Last', () => {
    const closed = doc(renderToStaticMarkup(<BombSheet view={viewOf(amzn(), 268.09, { marketOpen: false })} />));
    expect(closed.querySelector('[data-level-live]').textContent).toBe('Last $268.09 · −0.8%');
  });
  it('DISPLAY AGREEMENT (§9): a rung prints the same price and % in the Fuse, the bar and the table', () => {
    const ladder = amzn();
    const f = fuse(ladder, 268.09, { lead: 'down', height: 404 });
    for (const r of ladder.rungs) {
      const facts = rungFacts(ladder, r, 2);
      expect(d.querySelector(`[data-level-sub="${r.key}"]`).textContent).toBe(`${facts.pctText} · ${facts.priceText}`);
      expect(textOf(f.querySelector(`[data-fuse-rung="${r.key}"] text`))).toContain(facts.pctText);
      const fusePrice = f.querySelector(`[data-fuse-price="${r.key}"]`);
      if (fusePrice) expect(fusePrice.textContent).toBe(facts.priceText);
      const barPrice = d.querySelector(`[data-sheet-price="${r.key}"]`);
      if (barPrice) expect(barPrice.textContent).toBe(facts.priceText);
    }
    // …and the to-go numbers: the Fuse's pills and the bar's line from the same toGo / toGoDown
    expect(f.querySelector('[data-fuse-togo="down"]').textContent).toBe(d.querySelector('[data-sheet-togo-lead="down"]').textContent.slice(2).toUpperCase());
    expect(levelRows(view).find((x) => x.key === 'bust').stateText).toBe(`next · ${toGoDown(ladder, 268.09).bricks} bricks`);
  });
  it('fits 375 px: no fixed widths, every long line may wrap', () => {
    const html = renderToStaticMarkup(<BombSheet view={view} />);
    expect(html).not.toMatch(/width:\s*\d{3,}px/);
    expect(d.querySelector('[data-level="baseline"] span span').getAttribute('style')).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('BD-6 — Details, collapsed, StockRewardDetails\' facts moved unchanged', () => {
  const details = { scoringPctDecimal: '3.954943', targets: [{ key: 'bagger', label: 'BaggerBomb', target: 280.90704218846 }], currentPrice: 268.09, providerAsOf: '2026-11-10T17:44:00.000Z', positionId: 'pos-amzn', receiptHash: 'a'.repeat(64), inputRef: 'stockThresholdInputs/snap-1', modelId: 'stock_measured_atr14_fullday_v2' };
  it('a measured position: collapsed, with the frozen %, each exact target, the scored quote and time, the references and the cents note', () => {
    const d = doc(renderToStaticMarkup(<BombSheet view={viewOf(amzn(), 268.09, { details })} />));
    const el = d.querySelector('details[data-bomb-details]');
    expect(el).not.toBeNull();
    expect(el.hasAttribute('open')).toBe(false);
    expect(el.textContent).toBe(['Details', 'Frozen measured %: 3.954943% (exact)', 'BaggerBomb: exact $280.90704218846', 'Quote $268.09 as of 2026-11-10T17:44:00.000Z', 'Position pos-amzn', `Receipt ${'a'.repeat(64)}`, 'Input stockThresholdInputs/snap-1', 'Model stock_measured_atr14_fullday_v2', BOMB_COPY.detailsCents].join(''));
    // BP-1: the note says how Bomb mode rounds (toward the award), not half-even.
    expect(BOMB_COPY.detailsCents).toBe('Prices are rounded toward the award (up for the upside, down for the downside), so a price that reaches the shown number scores. Awards use the exact targets.');
  });
  it('no Details on a preview', () => {
    const p = previewLadder({ previousClose: 99, threshold: 2 });
    expect(doc(renderToStaticMarkup(<BombSheet view={viewOf(p, 98.4)} />)).querySelector('[data-bomb-details]')).toBeNull();
  });
});

describe('BD-5 — the Danger Zone view', () => {
  const ladder = amzn();
  const goDown = toGoDown(ladder, 260.62);
  const trace = { line: [{ t: Date.parse('2026-11-10T18:00:00.000Z'), c: 260.9 }, { t: Date.parse('2026-11-10T18:01:00.000Z'), c: 260.7 }], dots: [], lastBarMs: Date.parse('2026-11-10T18:01:00.000Z'), intervalMin: 1 };
  const scored = { price: 260.65, atMs: Date.parse('2026-11-10T17:44:00.000Z'), checkAtMs: Date.parse('2026-11-10T18:00:28.000Z') };
  const render = (mode, hitTimes = {}, l = ladder, g = goDown) => doc(renderToStaticMarkup(<RedZone side="down" ladder={l} go={g} live={260.62} decimals={2} mode={mode} trace={trace} clock={{ state: 'countdown', label: '1:15' }} scoredText={scoredChipText({ live: 260.62, scored, always: true, nowMs: Date.parse('2026-11-10T18:02:00.000Z') })} hitTimes={hitTimes} nowMs={Date.parse('2026-11-10T18:02:00.000Z')} />));
  it('the red zone\'s layout: the distance as the big number, `to Bust −10 · 0.42%`, the clock and the scored chip naming the check', () => {
    const d = render('danger');
    expect(d.querySelector('[data-bomb-view="dangerzone"]').getAttribute('data-dangerzone-state')).toBe('live');
    expect(d.querySelector('[data-rz-distance]').textContent).toBe('$1.09to Bust −10 · 0.42%');
    expect(d.querySelector('[data-rz-clock]').textContent).toContain('1:15');
    expect(d.querySelector('[data-rz-scored]').textContent).toBe('live $260.62 · scored $260.65 at the 1:00 check');
  });
  it('the goal line is the downside rung in the downside levels\' red (--ft-neg since BP-2), with no amber heat', () => {
    const d = render('danger');
    expect(d.querySelector('[data-rz-goal="down"]').getAttribute('style')).toContain('--ft-neg');
    expect(d.querySelector('[data-bomb-view] > svg').innerHTML).not.toContain('url(#bombRzHeat)');
    expect(d.body.textContent).toContain('📉 Bust · −10 pts · $259.53');
  });
  it('the chip reads Danger zone', () => {
    expect(doc(renderToStaticMarkup(<RedZoneChip mode="danger" />)).body.textContent).toBe('Danger zone');
    expect(doc(renderToStaticMarkup(<RedZoneChip mode="approaching" />)).body.textContent).toBe('Red zone');
  });
  it('a hit plays no moment: one quiet line `Bust · −10 · hit at the 1:15 check` (the check only when seen), no takeover', () => {
    const hitL = amzn({ crossedTiers: ['bust'] });
    const d = render('danger', { bust: Date.parse('2026-11-10T18:15:00.000Z') }, hitL, toGoDown(hitL, 255.2));
    expect(d.querySelector('[data-dz-hit-line]').textContent).toBe('Bust · −10 · hit at the 1:15 check');
    expect(d.querySelector('[data-rz-banked-moment]')).toBeNull();
    expect(render('danger', {}, hitL, toGoDown(hitL, 255.2)).querySelector('[data-dz-hit-line]')).toBeNull();
  });
  it('closed: the frozen view, as red zone (c)', () => {
    const d = render('dangerClosed');
    expect(d.querySelector('[data-bomb-view="dangerzone"]').getAttribute('data-dangerzone-state')).toBe('closed');
    expect(d.body.textContent).toContain(BOMB_COPY.marketClosed('1:01 PM'));
  });
});

describe('BD-8 — the scored chip names the check (production shape: provider time 12:44, read at 1:00:28)', () => {
  const rec = amznRecord();
  const now = Date.parse('2026-11-10T18:02:30.000Z'); // Tue 1:02:30 PM ET, the founder's screen
  it('the 1:00 check, not the quote\'s minute', () => {
    const chip = scoredChipText({ live: 268.09, scored: rec.scored, decimals: 2, always: true, nowMs: now });
    expect(chip).toBe('live $268.09 · scored $268.09 at the 1:00 check');
    expect(chip).not.toMatch(/12:44|12:30/);
  });
  it('a check from an earlier session names its day: at Mon\'s 3:45 check', () => {
    const scored = { price: 270.1, atMs: Date.parse('2026-11-09T20:29:00.000Z'), checkAtMs: Date.parse('2026-11-09T20:45:40.000Z') };
    expect(scoredChipText({ live: 268.09, scored, decimals: 2, always: true, nowMs: now })).toBe("live $268.09 · scored $270.10 at Mon's 3:45 check");
  });
  it('no slot (a read outside the schedule): today\'s wording — the time', () => {
    const scored = { price: 270.1, atMs: Date.parse('2026-11-10T13:05:00.000Z'), checkAtMs: Date.parse('2026-11-10T13:06:00.000Z') }; // 8:06 AM ET, before the open
    expect(scoredChipText({ live: 268.09, scored, decimals: 2, always: true, nowMs: now })).toBe('live $268.09 · scored $270.10 at 8:05');
  });
});

describe('BD-9 — the entry line shows the fill quote\'s time', () => {
  it('AMZN: entered 11:16 AM on a quote EODHD stamps 11:00 AM → Entry $270.22 · Tue 11:00 AM', () => {
    expect(doc(renderToStaticMarkup(<BombSheet view={viewOf(amzn(), 268.09)} />)).querySelector('[data-bomb-sheet-baseline]').textContent).toBe('Entry $270.22 · Tue 11:00 AM');
  });
  it('an overnight entry (SYK: battle created Mon 10:21 PM, fill = Mon\'s 4:05 PM trade) → Mon 4:05 PM', () => {
    const syk = amznRecord({ symbol: 'SYK', fill: 325.73, enteredAt: '2026-11-10T03:21:18.150Z', quoteAsOf: '2026-11-09T21:05:00.000Z' });
    const l = measuredLadder({ measured: syk.measured, entryAtMs: syk.entry.atMs });
    expect(doc(renderToStaticMarkup(<BombSheet view={viewOf(l, 323.04)} />)).querySelector('[data-bomb-sheet-baseline]').textContent).toBe('Entry $325.73 · Mon 4:05 PM');
  });
});

// ── Review fixes (2026-11-11), lens A ─────────────────────────────────────────
describe('review A1 — the printed brick count at the baseline is the rung\'s own 6, on both sides', () => {
  it('AMZN at its fill: 6 bricks to +15 and 6 to Bust (the exact unit printed 7)', () => {
    const l = amzn();
    expect(toGo(l, 270.22).bricks).toBe(6);
    expect(toGoDown(l, 270.22).bricks).toBe(6);
  });
  it('a sweep of fills and measured %s: at live = fill the count reads 6 both ways, every time', () => {
    for (const fill of [20.07, 45.88, 99.99, 136.68, 270.22, 325.73, 488.41]) for (const pct of [1.123457, 2.375, 3.559142, 3.954943, 4.365161, 5.135255]) {
      const targets = [['bagger', 1], ['doubleBagger', 1.5], ['tenBagger', 2], ['bust', -1], ['crash', -1.5], ['meltdown', -2]].map(([key, k]) => ({ key, price: fill * (1 + (k * pct) / 100) }));
      const l = measuredLadder({ measured: { measured: true, baselinePrice: fill, targets, crossedTiers: [] } });
      expect([toGo(l, fill).bricks, toGoDown(l, fill).bricks], `${fill} @ ${pct}`).toEqual([6, 6]);
    }
  });
});

describe('review A6 — ties are broken in each rung\'s award direction; the live % colour follows the printed %', () => {
  it('live ON the +15 price: the marker sits above +15 (reaching it is the upside\'s condition); ON Bust: below Bust', () => {
    const order = (live) => levelRows(viewOf(amzn(), live)).map((r) => r.key);
    expect(order(280.91)).toEqual(['tenBagger', 'doubleBagger', 'live', 'bagger', 'baseline', 'bust', 'crash', 'meltdown']);
    expect(order(259.53)).toEqual(['tenBagger', 'doubleBagger', 'bagger', 'baseline', 'bust', 'live', 'crash', 'meltdown']);
  });
  it('a live price that prints +0.0% is not painted red', () => {
    const d = fuse(amzn(), 270.219);
    const pct = [...d.querySelectorAll('[data-fuse-live-label] text')][1];
    expect(pct.textContent).toBe('+0.0% · LIVE');
    expect(pct.getAttribute('style')).toContain('--ft-teal');
  });
});

describe('review A9 — every rung below hit says so, like every rung banked above', () => {
  it('the bar\'s line and the Fuse\'s quiet pill', () => {
    const l = amzn({ crossedTiers: ['bust', 'crash', 'meltdown'] });
    const t = sheetToGo(l, toGo(l, 250), toGoDown(l, 250), 'up');
    expect(t.other.text).toBe(`↓ ${BOMB_COPY.downEveryRungHit}`);
    expect(fuse(l, 250).querySelector('[data-fuse-togo="down"]').textContent).toBe(BOMB_COPY.downEveryRungHit.toUpperCase());
  });
});

// ── Review fixes (2026-11-11), lens D ─────────────────────────────────────────
describe('review D1–D4 — the Danger Zone\'s text is one column, and its goal stays in the plot', () => {
  const ladder = amzn();
  const scored = { price: 260.71, atMs: Date.parse('2026-11-10T17:44:00.000Z'), checkAtMs: Date.parse('2026-11-10T18:00:28.000Z') };
  const trace = { line: [], dots: [], lastBarMs: null, intervalMin: null };
  const draw = (live, over = {}) => doc(renderToStaticMarkup(<RedZone side="down" ladder={over.ladder ?? ladder} go={toGoDown(over.ladder ?? ladder, live)} live={live} decimals={2} mode={over.mode ?? 'danger'} trace={trace} clock={{ state: 'countdown', label: '1:15' }} scoredText={scoredChipText({ live, scored, always: true })} hitTimes={over.hitTimes ?? {}} nowMs={Date.parse('2026-11-10T18:02:30.000Z')} width={375} height={over.height ?? 354} />));
  it('the tags, the numeral, its sub-line and the hit line sit in ONE flow column (a wrapped tag row pushes the numeral down; nothing is pinned over it)', () => {
    const hit = amzn({ crossedTiers: ['bust'] });
    const d = draw(254.7, { ladder: hit, mode: 'dangerClosed', hitTimes: { bust: Date.parse('2026-11-10T18:15:00.000Z') } });
    const col = d.querySelector('[data-rz-tags]').parentElement;
    expect(col.contains(d.querySelector('[data-rz-distance]'))).toBe(true);
    expect(col.contains(d.querySelector('[data-dz-hit-line]'))).toBe(true);
    expect(d.querySelector('[data-rz-distance]').getAttribute('style')).not.toMatch(/position:\s*absolute/);
  });
  it('the plot starts under the column (without a measure, at 110 px), so no trace or goal is drawn in the text\'s band', () => {
    for (const live of [260.05, 259.53, 257.46, 255.64]) {
      const goal = Number(draw(live).querySelector('[data-rz-goal="down"]').getAttribute('y')) + 2;
      expect(goal, String(live)).toBeGreaterThanOrEqual(110);
      expect(goal, String(live)).toBeLessThanOrEqual(354 - 70);
    }
  });
  it('live at or below the rung (0.8 %, 1.5 % under Bust): the goal line is still drawn inside the plot', () => {
    for (const live of [257.46, 255.64]) {
      const y = Number(draw(live).querySelector('[data-rz-goal="down"]').getAttribute('y')) + 2;
      expect(y, String(live)).toBeGreaterThanOrEqual(110);
      expect(y, String(live)).toBeLessThanOrEqual(284);
    }
  });
  it('live under the rung with a trace that never reached it: the trace\'s high is drawn BELOW the goal line, not on it (review D4 — the goal is the window\'s top, not clamped onto the trace)', () => {
    const bars = [...Array(30)].map((_, i) => ({ t: Date.parse('2026-11-10T17:30:00.000Z') + i * 60000, c: Number((258.2 - i * 0.08).toFixed(2)) }));
    const t = { line: bars, dots: [], lastBarMs: bars[bars.length - 1].t, intervalMin: 1 };
    const d = doc(renderToStaticMarkup(<RedZone side="down" ladder={ladder} go={toGoDown(ladder, 255.64)} live={255.64} decimals={2} mode="danger" trace={t} clock={null} scoredText={null} nowMs={Date.parse('2026-11-10T18:02:30.000Z')} width={375} height={354} />));
    const goalY = Number(d.querySelector('[data-rz-goal="down"]').getAttribute('y')) + 2;
    const ys = d.querySelector('[data-rz-trace-line]').getAttribute('d').match(/,[\d.]+/g).map((s) => Number(s.slice(1)));
    expect(Math.min(...ys)).toBeGreaterThan(goalY + 1); // $258.20 sits clearly under Bust $259.53
  });
  it('the numeral is in the downside levels\' red (--ft-neg, BP-2: one red), never the red zone\'s amber heat (review N5, rewritten)', () => {
    const style = draw(260.05).querySelector('[data-rz-distance] div').getAttribute('style');
    expect(style).toContain('--ft-neg');
    expect(style).not.toContain('--ft-amber');
    expect(style).not.toContain('--ft-red');
  });
  it('the red zone (side up) now has the same column (BP-4): its numeral is in the flow column, not placed by the goal', () => {
    const up = doc(renderToStaticMarkup(<RedZone ladder={ladder} go={toGo(ladder, 280.2)} live={280.2} decimals={2} mode="approaching" trace={trace} clock={null} scoredText={null} nowMs={Date.parse('2026-11-10T18:02:30.000Z')} />));
    expect(up.querySelector('[data-rz-distance]').getAttribute('style')).not.toMatch(/position:\s*absolute/);
    expect(up.querySelector('[data-rz-tags]').parentElement.contains(up.querySelector('[data-rz-distance]'))).toBe(true);
  });
});

describe('review D5 — a crowded side\'s inline price never runs past the plot\'s edge', () => {
  it('a sub-cent ladder at 280 px: the moved price ends inside W (at 7 px), or is dropped', () => {
    const p = previewLadder({ previousClose: 0.00001234, threshold: 8 });
    for (const width of [320, 375, 430]) {
      // In the price's OWN decimals (8): "$0.00001135", 11 characters (the shared helper prints 2, which always fits).
      const d = doc(renderToStaticMarkup(<FuseChart ladder={p} live={0.0000133} decimals={8} go={toGo(p, 0.0000133)} goDown={toGoDown(p, 0.0000133)} width={width} height={280} />));
      const bust = d.querySelector('[data-fuse-price="bust"]');
      expect(bust.textContent).toBe('$0.00001135'); // the case is real: the next rung's price is moved inline
      expect(bust.getAttribute('y')).toBe(d.querySelector('[data-fuse-down="bust"] text').getAttribute('y'));
      for (const t of d.querySelectorAll('[data-fuse-price]')) {
        const box = textBox(Number(t.getAttribute('x')), Number(t.getAttribute('y')), t.textContent, Number(t.getAttribute('font-size')));
        expect(box.x1, `${width}: ${t.textContent}`).toBeLessThanOrEqual(width - 2 + 1e-9);
      }
    }
  });
});

describe('review D6 — the bar\'s banked points carry no ✓ (the green disc marks them), so all three fit at 320', () => {
  it('every upside rung banked: "+15", "+30", "+50" in green, each on a check disc', () => {
    const l = amzn({ crossedTiers: ['bagger', 'doubleBagger', 'tenBagger'] });
    const d = doc(renderToStaticMarkup(<BombSheet view={viewOf(l, 293)} />));
    expect(['bagger', 'doubleBagger', 'tenBagger'].map((k) => d.querySelector(`[data-sheet-points="${k}"]`).textContent)).toEqual(['+15', '+30', '+50']);
    for (const k of ['bagger', 'doubleBagger', 'tenBagger']) expect(d.querySelector(`[data-sheet-rung="${k}"]`).getAttribute('data-rung-banked')).toBe('1');
  });
});

describe('review D7 — near the baseline at 320×280 the live label clears the baseline label', () => {
  it('live 0.15–0.4 thresholds above the baseline: no label box overlaps (320×280 and 375×280)', () => {
    for (const width of [320, 375]) for (const live of [271.82, 272.3, 272.9, 273.43, 274.0, 274.49]) {
      const d = fuse(amzn(), live, { width, height: 280 });
      expect(overlaps(labelBoxes(d)), `${width} @ ${live}`).toEqual([]);
    }
  });
});
