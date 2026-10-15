// @vitest-environment jsdom
//
// Research modal follow-up, display agreement (BUILD_RULES §9; build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_F3_FOLLOWUP.md):
//   D-1  a level's distance and its support/resistance side are measured from
//        the price the "Current" row shows, not the newest daily close
//   D-4  the first volume bar is labeled "Today" only when its bar is the
//        current session's; otherwise "Last session · <its date>"
// The REAL tab; only the sector-summary network call is stubbed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/sectorDataService', () => ({ getQuickSectorSummary: () => Promise.resolve(null) }));

import TechnicalTabV2 from './TechnicalTabV2';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

const QUIET = { rsi: 50, macd: null, macdHistogram: [], sma50: null };

async function render(props) {
  await act(async () => {
    root.render(<TechnicalTabV2 asset={{ symbol: 'AAPL', price: 100 }} indicators={QUIET} levels={null} dailyData={null} onLevelHighlight={() => {}} {...props} />);
  });
}
/** Each level row (clickable while onLevelHighlight is set), top to bottom: price text, distance text, price color. */
function levelRows() {
  const rows = [...container.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer');
  return rows.map((row) => {
    const spans = row.querySelectorAll('span');
    return { price: spans[0].textContent, distance: spans[spans.length - 1].textContent, color: spans[0].style.color };
  });
}

// detectLevels measured these from the newest daily close, $485.05.
const CLOSE_LEVELS = {
  support: [
    { price: 480.0, strength: 'MODERATE', distanceFromCurrent: '-1.04' },
    { price: 470.62, strength: 'STRONG', distanceFromCurrent: '-2.97' },
  ],
  resistance: [
    { price: 490.0, strength: 'WEAK', distanceFromCurrent: '1.02' },
  ],
  currentPrice: 485.05,
};

describe('D-1 — levels are placed and measured from the displayed price', () => {
  it('a level at $470.62 with the close at $485.05 and $475.60 shown reads -1.05% (from 475.60), not -2.97%', async () => {
    // (470.62 − 475.60) / 475.60 = −1.0471 % → "-1.05%" at two decimals.
    await render({ asset: { symbol: 'AAPL', price: 475.6 }, levels: CLOSE_LEVELS });
    expect(container.textContent).toContain('Current$475.60');
    const row = levelRows().find((r) => r.price === '$470.62');
    expect(row.distance).toBe('-1.05%');
    expect(container.textContent).not.toContain('-2.97%');
  });

  it('a level between the close and the displayed price flips side: $480 (support from the close) is resistance above $475.60', async () => {
    const picked = [];
    await render({ asset: { symbol: 'AAPL', price: 475.6 }, levels: CLOSE_LEVELS, onLevelHighlight: (v) => picked.push(v) });
    const rows = [...container.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer');
    const texts = rows.map((r) => r.querySelector('span').textContent);
    // Resistance (above) renders above support, farthest first: $490, $480 | $470.62.
    expect(texts).toEqual(['$490.00', '$480.00', '$470.62']);
    for (const r of rows) await act(async () => { r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(picked).toEqual([
      { price: 490, type: 'RESISTANCE' },
      { price: 480, type: 'RESISTANCE' },
      { price: 470.62, type: 'SUPPORT' },
    ]);
    const r480 = levelRows().find((r) => r.price === '$480.00');
    expect(r480.distance).toBe('+0.93%'); // (480 − 475.60) / 475.60 = +0.925 %
  });

  it('the other way: $490 (resistance from the close) is support below a displayed $495', async () => {
    const picked = [];
    await render({ asset: { symbol: 'AAPL', price: 495 }, levels: CLOSE_LEVELS, onLevelHighlight: (v) => picked.push(v) });
    const rows = [...container.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer');
    for (const r of rows) await act(async () => { r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    // No level is above $495; support is closest first, two shown.
    expect(picked).toEqual([
      { price: 490, type: 'SUPPORT' },
      { price: 480, type: 'SUPPORT' },
    ]);
    expect(levelRows().map((r) => r.distance)).toEqual(['-1.01%', '-3.03%']);
  });

  it('no displayed price: the stored sides, and no distance (nothing on screen to measure from)', async () => {
    await render({ asset: { symbol: 'AAPL', price: 0 }, levels: CLOSE_LEVELS });
    const rows = levelRows();
    expect(rows.map((r) => r.price)).toEqual(['$490.00', '$480.00', '$470.62']);
    expect(rows.map((r) => r.distance)).toEqual(['', '', '']);
  });
});

/** `n` weekday daily bars ending on `lastDate`, NEWEST-FIRST (API order). */
function weekdayBars(n, lastDate, fill = () => ({})) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00Z`);
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const i = out.length;
      out.push({ date: d.toISOString().slice(0, 10), open: 100, high: 101, low: 99, close: 100, volume: 1000, ...fill(i) });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
/** The label and value of the first volume bar. */
function firstVolumeRow() {
  const grid = [...container.querySelectorAll('div')].find((d) => d.style.display === 'grid');
  const row = grid.firstElementChild;
  return { label: row.firstElementChild.textContent, value: row.lastElementChild.textContent };
}

describe('D-4 — the first volume bar is labeled by its own date', () => {
  it('newest bar dated the current session → "Today"', async () => {
    await render({ dailyData: weekdayBars(30, '2026-10-15', (i) => ({ volume: i === 0 ? 2.5e6 : 1e6 })), sessionDate: '2026-10-15' });
    expect(firstVolumeRow()).toEqual({ label: 'Today', value: '2.5M' });
  });

  it('during the session the newest bar is yesterday\'s → "Last session · Oct 14"', async () => {
    await render({ dailyData: weekdayBars(30, '2026-10-14', (i) => ({ volume: i === 0 ? 2.5e6 : 1e6 })), sessionDate: '2026-10-15' });
    expect(firstVolumeRow()).toEqual({ label: 'Last session · Oct 14', value: '2.5M' });
    expect(container.textContent).not.toContain('Today');
  });
});
