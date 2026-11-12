// @vitest-environment jsdom
//
// Bomb mode before the flip (2026-11-11, founder rulings on #1041's Q1–Q6):
//   BP-1  every rung price rounded toward its award (ladder.rungShown): upside UP,
//         downside DOWN, a whole display unit stays put (float slack 1e-9);
//         every surface prints the same string (BUILD_RULES §9); a truth sweep.
//   BP-2  one red: the Danger Zone draws in --ft-neg, the downside levels' red.
//   BP-3  a rung's % is the rule's % (k × the threshold), Details' measured %.
//   BP-4  the red zone (side up) gets the Danger Zone's layout fixes, at 320 and 375 px.
//   BP-5  the baseline label is painted over the ghost line, with a background halo.
// The AMZN fixture is the founder's Nov 10 position (fill $270.22 at 3.954943 %).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FuseChart from './FuseChart.jsx';
import BombSheet, { levelRows } from './BombSheet.jsx';
import RedZone from './RedZone.jsx';
import { RedZoneChip } from './BombPlot.jsx';
import { measuredLadder, previewLadder, v4Ladder, rungShown, rungPct, toGo, toGoDown, RUNG_SHOWN_SLACK } from './ladder.js';
import { sheetLine, rungFacts } from './bombView.js';
import { priceDecimals } from '../priceFormat.js';
import { amznRecord, AMZN_SCORING_PCT } from './__fixtures__/bombBattles.js';

const doc = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
const amzn = (over = {}) => { const r = amznRecord(over); return measuredLadder({ measured: r.measured, entryAtMs: r.entry.atMs }); };
const at = (l, key) => l.rungs.find((r) => r.key === key);
const NOW = Date.parse('2026-11-10T18:02:30.000Z');
const viewOf = (ladder, live, over = {}) => {
  const go = toGo(ladder, live);
  const goDown = toGoDown(ladder, live);
  const lead = over.lead ?? null;
  return { ladder, go, goDown, lead, live, decimals: 2, marketOpen: true, bankedTimes: {}, hitTimes: {}, sheetScored: null, sheetLine: sheetLine({ ladder, lead, decimals: 2, clockLabel: '1:15' }), ...over };
};
const fuse = (ladder, live, { width = 375, height = 354, ghost = [] } = {}) => doc(renderToStaticMarkup(
  <FuseChart ladder={ladder} live={live} decimals={2} go={toGo(ladder, live)} goDown={toGoDown(ladder, live)} ghost={ghost} width={width} height={height} />,
));

// ── BP-1 ──────────────────────────────────────────────────────────────────────
describe('BP-1 — rungShown: every rung rounded toward its award', () => {
  const up = (price) => ({ key: 'bagger', k: 1, price });
  const down = (price) => ({ key: 'bust', k: -1, price });
  it('an exact Bust of $97.625 shows $97.62 (at or below $97.62 is at or below the target; $97.63 would not be)', () => {
    expect(rungShown(down(97.625), 2)).toBe(97.62);
  });
  it('an upside target of $286.255 shows $286.26', () => {
    expect(rungShown(up(286.255), 2)).toBe(286.26);
  });
  it('not only halfway prices: $286.2506 shows $286.26 (nearest and half-even both say $286.25); $254.1894 down shows $254.18', () => {
    expect(rungShown(up(286.2505704619), 2)).toBe(286.26);
    expect(rungShown(up(291.5940939492), 2)).toBe(291.6);
    expect(rungShown(down(254.1894295381), 2)).toBe(254.18);
    expect(rungShown(down(248.8459060508), 2)).toBe(248.84);
  });
  it('a target already on a whole cent stays put, both sides (280.91 is 28091.000000000004 cents in floating point)', () => {
    expect(280.91 * 100).not.toBe(28091); // the case is real
    for (const p of [280.91, 259.53, 100, 0.2049]) {
      const d = priceDecimals(p);
      expect(rungShown(up(p), d), `up ${p}`).toBe(p);
      expect(rungShown(down(p), d), `down ${p}`).toBe(p);
    }
  });
  it('float noise within 1e-9 (relative) is on the unit: 259.5300000001 and 259.5299999999 print $259.53 on either side', () => {
    for (const p of [259.5300000001, 259.5299999999]) {
      expect(rungShown(up(p), 2), `up ${p}`).toBe(259.53);
      expect(rungShown(down(p), 2), `down ${p}`).toBe(259.53);
    }
    expect(RUNG_SHOWN_SLACK).toBe(1e-9);
  });
  it('a sub-cent asset at its own decimals: up rounds up, down rounds down', () => {
    expect(rungShown(up(0.000012345), 8)).toBe(0.00001235);
    expect(rungShown(down(0.000012345), 8)).toBe(0.00001234);
    expect(rungShown(up(0.20491), 4)).toBe(0.205);
    expect(rungShown(down(0.20499), 4)).toBe(0.2049);
  });
  it('the AMZN fixture: $280.91, $286.26, $291.60 up; $259.53, $254.18, $248.84 down', () => {
    const l = amzn();
    expect(['bagger', 'doubleBagger', 'tenBagger', 'bust', 'crash', 'meltdown'].map((k) => rungFacts(l, at(l, k), 2).priceText))
      .toEqual(['$280.91', '$286.26', '$291.60', '$259.53', '$254.18', '$248.84']);
  });
});

describe('BP-1 — a truth sweep: every shown upside price ≥ its exact target, every shown downside price ≤ it', () => {
  it('a property grid of fills × thresholds × decimals: the line "reaches $X" / "at or below $X" is true at X, and X is within one display unit', () => {
    const fills = [0.00001234, 0.000987, 0.0123, 0.2049, 0.99996, 1.07, 3.33, 9.99, 20.07, 45.88, 97.625, 99.99, 136.68, 155.6, 270.22, 325.73, 488.41, 1234.56, 64321.5];
    for (let i = 0; i < 120; i += 1) fills.push(Number((1 + i * 7.31 + (i % 7) * 0.013).toFixed(2)));
    const pcts = [0.4, 0.5, 1.123457, 2.375, 3.554943, 3.954943, 4.365161, 5.135255, 8];
    let checked = 0;
    for (const fill of fills) for (const pct of pcts) {
      const targets = [['bagger', 1], ['doubleBagger', 1.5], ['tenBagger', 2], ['bust', -1], ['crash', -1.5], ['meltdown', -2]].map(([key, k]) => ({ key, price: fill * (1 + (k * pct) / 100) }));
      const l = measuredLadder({ measured: { measured: true, baselinePrice: fill, scoringPct: pct, targets, crossedTiers: [] } });
      for (const d of new Set([priceDecimals(fill), 2, 4, 6])) {
        const unit = 10 ** -d;
        for (const r of l.rungs) {
          const shown = rungShown(r, d);
          const slack = RUNG_SHOWN_SLACK * r.price;
          if (r.k > 0) expect(shown >= r.price - slack, `up ${r.key} ${fill}@${pct} d${d}: ${shown} < ${r.price}`).toBe(true);
          else expect(shown <= r.price + slack, `down ${r.key} ${fill}@${pct} d${d}: ${shown} > ${r.price}`).toBe(true);
          expect(Math.abs(shown - r.price) < unit + slack, `within a unit ${r.key} ${fill}@${pct} d${d}`).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(20000);
  });
});

describe('BP-1 — every surface prints the rung\'s one string (BUILD_RULES §9), with the moved cents in play', () => {
  // +15 banked and Bust hit, so the next rungs are +30 ($286.2506 → $286.26) and Crash ($254.1894 → $254.18).
  const l = amzn({ crossedTiers: ['bagger', 'bust'] });
  it('toGo / toGoDown measure from the shown rung', () => {
    expect(toGo(l, 280).rungShown).toBe(286.26);
    expect(toGo(l, 280).distance).toBe(6.26);
    expect(toGoDown(l, 258).rungShown).toBe(254.18);
    expect(toGoDown(l, 258).distance).toBe(3.82);
  });
  it('the Fuse, the bar, the table, the sheet lines and both zones\' goal tags print $286.26 and $254.18', () => {
    const f = fuse(l, 270);
    expect(f.querySelector('[data-fuse-price="doubleBagger"]').textContent).toBe('$286.26');
    expect(f.querySelector('[data-fuse-price="crash"]').textContent).toBe('$254.18');
    const s = doc(renderToStaticMarkup(<BombSheet view={viewOf(l, 270)} />));
    expect(s.querySelector('[data-sheet-price="doubleBagger"]').textContent).toBe('$286.26');
    expect(s.querySelector('[data-sheet-price="crash"]').textContent).toBe('$254.18');
    expect(s.querySelector('[data-level-sub="doubleBagger"]').textContent).toBe('+5.93% · $286.26');
    expect(s.querySelector('[data-level-sub="crash"]').textContent).toBe('−5.93% · $254.18');
    expect(sheetLine({ ladder: l, lead: 'up', decimals: 2 })).toBe('+15 banked. Next: $286.26 at a check');
    expect(sheetLine({ ladder: l, lead: 'down', decimals: 2 })).toBe('Bust −10 hit · next below: Crash at $254.18');
    const fresh = amzn({ crossedTiers: ['bagger'] });
    expect(sheetLine({ ladder: amzn({ crossedTiers: ['bust'] }), lead: 'up', decimals: 2 })).toBe('Needs $280.91 at a check for +15 · Crash at $254.18');
    expect(sheetLine({ ladder: fresh, lead: 'down', decimals: 2 })).toBe("Bust (−10) if it's at or below $259.53 at a check · +30 needs $286.26");
    const trace = { line: [], dots: [], lastBarMs: null, intervalMin: null };
    const rz = doc(renderToStaticMarkup(<RedZone ladder={l} go={toGo(l, 285.5)} live={285.5} decimals={2} mode="approaching" trace={trace} clock={null} scoredText={null} nowMs={NOW} />));
    expect(rz.querySelector('[data-rz-goal-tag="up"]').textContent).toContain('$286.26');
    const dz = doc(renderToStaticMarkup(<RedZone side="down" ladder={l} go={toGoDown(l, 255)} live={255} decimals={2} mode="danger" trace={trace} clock={null} scoredText={null} nowMs={NOW} />));
    expect(dz.querySelector('[data-rz-goal-tag="down"]').textContent).toContain('$254.18');
  });
  it('the table\'s live marker is placed against the PRINTED price: live $286.25 sits under +30 ($286.26), live $286.26 over it', () => {
    const order = (live) => levelRows(viewOf(l, live)).map((r) => r.key);
    expect(order(286.25)).toEqual(['tenBagger', 'doubleBagger', 'live', 'bagger', 'baseline', 'bust', 'crash', 'meltdown']);
    expect(order(286.26)).toEqual(['tenBagger', 'live', 'doubleBagger', 'bagger', 'baseline', 'bust', 'crash', 'meltdown']);
    expect(order(254.19)).toEqual(['tenBagger', 'doubleBagger', 'bagger', 'baseline', 'bust', 'live', 'crash', 'meltdown']);
    expect(order(254.18)).toEqual(['tenBagger', 'doubleBagger', 'bagger', 'baseline', 'bust', 'crash', 'live', 'meltdown']);
  });
  it('the bricks at the fill still read 6 both ways (the brick unit is measured from the shown +1 rung)', () => {
    const eog = measuredLadder({ measured: { measured: true, baselinePrice: 155.6, scoringPct: 3.6, targets: [['bagger', 1], ['doubleBagger', 1.5], ['tenBagger', 2], ['bust', -1], ['crash', -1.5], ['meltdown', -2]].map(([key, k]) => ({ key, price: 155.6 * (1 + (k * 3.6) / 100) })), crossedTiers: [] } });
    expect(rungShown(eog.next, 2)).toBe(161.21);
    expect([toGo(eog, 155.6).bricks, toGoDown(eog, 155.6).bricks]).toEqual([6, 6]);
  });
});

// ── BP-2 ──────────────────────────────────────────────────────────────────────
describe('BP-2 — one red: the Danger Zone draws in the downside levels\' red (--ft-neg)', () => {
  const l = amzn();
  const hit = amzn({ crossedTiers: ['bust'] });
  const trace = { line: [{ t: Date.parse('2026-11-10T18:00:00.000Z'), c: 260.9 }, { t: Date.parse('2026-11-10T18:01:00.000Z'), c: 260.7 }], dots: [{ atMs: Date.parse('2026-11-10T18:01:30.000Z'), price: 260.6 }], lastBarMs: Date.parse('2026-11-10T18:01:00.000Z'), intervalMin: 1 };
  const dz = (ladder, live, mode, hitTimes = {}) => renderToStaticMarkup(<RedZone side="down" ladder={ladder} go={toGoDown(ladder, live)} live={live} decimals={2} mode={mode} trace={trace} clock={{ state: 'countdown', label: '1:15' }} scoredText="live · scored" hitTimes={hitTimes} nowMs={NOW} />);
  const states = [
    ['live', dz(l, 260.62, 'danger')],
    ['closed', dz(l, 260.62, 'dangerClosed')],
    ['below the rung', dz(l, 258.9, 'danger')],
    ['after a hit', dz(hit, 255.2, 'danger', { bust: Date.parse('2026-11-10T18:15:00.000Z') })],
    ['chip', renderToStaticMarkup(<RedZoneChip mode="danger" />)],
    ['chip closed', renderToStaticMarkup(<RedZoneChip mode="dangerClosed" />)],
  ];
  it('no Danger Zone node uses --ft-red, in any state (the view, the closed view, below the rung, after a hit, the chip)', () => {
    for (const [name, html] of states) expect(html, name).not.toContain('--ft-red');
  });
  it('its goal line, numeral, goal tag and chip are --ft-neg', () => {
    const d = doc(states[0][1]);
    expect(d.querySelector('[data-rz-goal="down"]').getAttribute('style')).toContain('--ft-neg');
    expect(d.querySelector('[data-rz-distance] div').getAttribute('style')).toContain('--ft-neg');
    expect(d.querySelector('[data-rz-goal-tag="down"] span').getAttribute('style')).toContain('--ft-neg');
    expect(states[4][1]).toContain('--ft-neg');
  });
  it('the red zone keeps Build A\'s heat (the --ft-red / amber mix) — BT.risk stays only there', () => {
    const rz = renderToStaticMarkup(<RedZone ladder={l} go={toGo(l, 280.2)} live={280.2} decimals={2} mode="approaching" trace={trace} clock={null} scoredText={null} nowMs={NOW} />);
    expect(rz).toContain('color-mix(in srgb, var(--ft-red) 55%, var(--ft-amber))');
  });
});

// ── BP-3 ──────────────────────────────────────────────────────────────────────
describe('BP-3 — a rung\'s % is the rule\'s %: k × the threshold', () => {
  const details = { scoringPctDecimal: '3.954943', targets: [], currentPrice: 268.09, providerAsOf: '2026-11-10T17:44:00.000Z', positionId: 'pos-amzn', receiptHash: 'a'.repeat(64), inputRef: 'stockThresholdInputs/snap-1', modelId: 'stock_measured_atr14_fullday_v2' };
  it('the table\'s +15 % equals Details\' measured % at two decimals (+3.95%, not the +3.96% worked back from the prices)', () => {
    const s = doc(renderToStaticMarkup(<BombSheet view={viewOf(amzn(), 268.09, { details })} />));
    expect(AMZN_SCORING_PCT).toBe(Number(details.scoringPctDecimal));
    expect(s.querySelector('[data-level-sub="bagger"]').textContent).toBe(`+${Number(details.scoringPctDecimal).toFixed(2)}% · $280.91`);
    expect(s.querySelector('[data-bomb-details]').textContent).toContain('Frozen measured %: 3.954943% (exact)');
  });
  it('the AMZN ladder: +3.95%, +5.93%, +7.91% and −3.95%, −5.93%, −7.91% in the Fuse titles and the table', () => {
    const l = amzn();
    const f = fuse(l, 268.09);
    const s = doc(renderToStaticMarkup(<BombSheet view={viewOf(l, 268.09)} />));
    for (const [key, label, pct] of [['bagger', 'BAGGERBOMB', '+3.95%'], ['doubleBagger', 'DOUBLE BAGGER', '+5.93%'], ['tenBagger', 'TENBAGGER', '+7.91%'], ['bust', 'BUST', '−3.95%'], ['crash', 'CRASH', '−5.93%'], ['meltdown', 'MELTDOWN', '−7.91%']]) {
      expect(f.querySelector(`[data-fuse-rung="${key}"] text`).textContent, key).toBe(`${at(l, key).label.toUpperCase()} · ${pct}`);
      expect(s.querySelector(`[data-level-sub="${key}"]`).textContent.startsWith(`${pct} · `), key).toBe(true);
      expect(label.length).toBeGreaterThan(0);
    }
  });
  it('a preview prints k × its threshold', () => {
    const p = previewLadder({ previousClose: 154.76, threshold: 3.6 });
    expect(rungFacts(p, at(p, 'doubleBagger'), 2).pctText).toBe('+5.40%');
    expect(rungFacts(p, at(p, 'meltdown'), 2).pctText).toBe('−7.20%');
  });
  it('a V4 ladder (levels given as prices) keeps the move from the displayed baseline to the displayed level', () => {
    const v = v4Ladder({ levels: { baseline: 100, baggerBomb: 103.004, doubleBagger: 104.5, tenBagger: 106, bust: 96.996, crash: 95.5, meltdown: 94 } });
    expect(v.threshold).toBe(null);
    expect(rungPct(v, at(v, 'bagger'), 2)).toBeCloseTo(3.01, 12); // $103.004 shows $103.01 (up)
    expect(rungPct(v, at(v, 'bust'), 2)).toBeCloseTo(-3.01, 12); // $96.996 shows $96.99 (down)
  });
  it('to-go %s still come from displayed values (the pill\'s % is the distance over the shown live price)', () => {
    const go = toGo(amzn(), 268.09);
    expect(go.pctShown).toBe(Number((((280.91 - 268.09) / 268.09) * 100).toFixed(2)));
  });
});

// ── BP-4 ──────────────────────────────────────────────────────────────────────
describe('BP-4 — the red zone gets the Danger Zone\'s layout: one text column, the plot under it, the goal held in the plot', () => {
  const ladder = amzn();
  const empty = { line: [], dots: [], lastBarMs: null, intervalMin: null };
  const H = 354;
  const draw = (live, { width = 375, trace = empty, mode = 'approaching', moment = null, l = ladder } = {}) => doc(renderToStaticMarkup(
    <RedZone ladder={l} go={toGo(l, live)} live={live} decimals={2} mode={mode} trace={trace} clock={{ state: 'countdown', label: '1:15' }} scoredText="live $280.20 · scored $280.10 at the 1:00 check" moment={moment} nowMs={NOW} width={width} height={H} />,
  ));
  const goalY = (d) => Number(d.querySelector('[data-rz-goal="up"]').getAttribute('y')) + 2;
  const traceYs = (d) => (d.querySelector('[data-rz-trace-line]')?.getAttribute('d').match(/,[\d.]+/g) || []).map((s) => Number(s.slice(1)));
  for (const width of [320, 375]) {
    it(`${width} px: the tags, the numeral and its sub-line sit in ONE flow column (approaching and closed)`, () => {
      for (const mode of ['approaching', 'closed']) {
        const d = draw(280.2, { width, mode });
        const col = d.querySelector('[data-rz-tags]').parentElement;
        expect(col.contains(d.querySelector('[data-rz-distance]')), mode).toBe(true);
        expect(d.querySelector('[data-rz-distance]').getAttribute('style'), mode).not.toMatch(/position:\s*absolute/);
      }
    });
    it(`${width} px: the plot starts under the column (without a measure, at 110 px): a trace that fell 0.6 % or more over the hour never reaches the numeral's band`, () => {
      // From $280.90 (on the rung) down to $279.10 over the hour — the trace's start is drawn at the window's top.
      const bars = [...Array(60)].map((_, i) => ({ t: Date.parse('2026-11-10T17:02:00.000Z') + i * 60000, c: Number((280.9 - i * 0.03).toFixed(2)) }));
      const trace = { line: bars, dots: [], lastBarMs: bars[bars.length - 1].t, intervalMin: 1 };
      const d = draw(279.1, { width, trace });
      const ys = traceYs(d);
      expect(ys.length).toBe(60);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(110);
      expect(Math.max(...ys)).toBeLessThanOrEqual(H - 70);
      expect(goalY(d)).toBeGreaterThanOrEqual(110);
    });
    it(`${width} px: live at or over the rung (on it, 0.8 % and 1.5 % over +15): the goal line is still drawn inside the plot`, () => {
      for (const live of [280.91, 283.16, 285.13]) {
        const y = goalY(draw(live, { width }));
        expect(y, String(live)).toBeGreaterThanOrEqual(110);
        expect(y, String(live)).toBeLessThanOrEqual(H - 70);
      }
    });
    it(`${width} px: live over the rung with a trace that never fell to it: the trace's low is drawn ABOVE the goal line (the goal is the window's floor, not clamped onto the trace)`, () => {
      const bars = [...Array(30)].map((_, i) => ({ t: Date.parse('2026-11-10T17:30:00.000Z') + i * 60000, c: Number((281.8 + i * 0.08).toFixed(2)) }));
      const trace = { line: bars, dots: [], lastBarMs: bars[bars.length - 1].t, intervalMin: 1 };
      const d = draw(284.2, { width, trace });
      expect(Math.max(...traceYs(d))).toBeLessThan(goalY(d) - 1); // $281.80 sits clearly over +15 $280.91
    });
    it(`${width} px: the goal's tag stays inside the plot, under the column`, () => {
      for (const live of [279.6, 280.91, 285.13]) {
        const top = Number(draw(live, { width }).querySelector('[data-rz-goal-tag="up"]').getAttribute('style').match(/top:([\d.]+)px/)[1]);
        expect(top, String(live)).toBeGreaterThanOrEqual(110);
        expect(top + 22, String(live)).toBeLessThanOrEqual(H - 70);
      }
    });
  }
  it('the banked moment keeps Build A\'s plot: no numeral, the moment centred at the same place as before (top 46)', () => {
    const banked = amzn({ crossedTiers: ['bagger'] });
    const d = draw(281.4, { l: banked, mode: 'banked', moment: { key: 'bagger', keys: ['bagger'], points: 15, atMs: Date.parse('2026-11-10T18:00:00.000Z'), price: 281.4 } });
    expect(d.querySelector('[data-rz-distance]')).toBeNull();
    const m = d.querySelector('[data-rz-banked-moment]');
    expect(m.getAttribute('style')).toContain(`top:${(46 + (H - 70)) / 2 - 56}px`);
    expect(d.querySelector('[data-redzone-state]').getAttribute('data-redzone-state')).toBe('banked');
  });
  it('the closed view keeps its behaviour: frozen state, the market-closed tag, the numeral in ink', () => {
    const d = draw(280.2, { mode: 'closed' });
    expect(d.querySelector('[data-redzone-state]').getAttribute('data-redzone-state')).toBe('closed');
    expect(d.querySelector('[data-rz-tags]').textContent).toContain('Market closed');
    expect(d.querySelector('[data-rz-distance] div').getAttribute('style')).toContain('--ft-ink-2');
  });
});

// ── BP-5 ──────────────────────────────────────────────────────────────────────
describe('BP-5 — the baseline label reads cleanly over the 30-minute line', () => {
  it('it is painted after the ghost line and its check dots, with a halo in the plot\'s background (paint-order: stroke), at the same place', () => {
    const ghost = [...Array(14)].map((_, i) => ({ timestamp: Date.parse('2026-11-10T14:30:00.000Z') / 1000 + i * 1800, close: 270.22 + (i % 3) * 0.4 - 0.4 }));
    const d = fuse(amzn(), 268.09, { ghost });
    const label = d.querySelector('[data-fuse-baseline]');
    const paths = [...d.querySelectorAll('[data-fuse-ghost]')];
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(p.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const style = label.getAttribute('style');
    expect(style).toContain('paint-order:stroke');
    expect(style).toContain('stroke:var(--ft-bg-dashboard)');
    expect(style).toContain('fill:var(--ft-ink-2)');
    expect(label.getAttribute('stroke')).toBeNull(); // §10: the halo's colour goes through style, never an attribute
    expect(Number(label.getAttribute('y')) + 5).toBeCloseTo(Number(d.querySelector('[data-fuse-rung="bagger"] line').getAttribute('y1')) + (Number(d.querySelector('[data-fuse-rung="bust"] line').getAttribute('y1')) - Number(d.querySelector('[data-fuse-rung="bagger"] line').getAttribute('y1'))) / 2, 6);
  });
});
