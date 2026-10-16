// @vitest-environment jsdom
//
// Research modal honesty fixes — the Technical tab's labels say what their
// numbers are (build report docs/audits/20261015_BUILD_RESEARCH_MODAL_HONESTY_FIXES.md).
//   F5  the volume average is over 30 daily sessions, or says how many
//   F6  "52-week" only when the daily bars cover 52 weeks; otherwise the span
//   F7  no RSI reading → "—"; the zone word reads the displayed one-decimal number
//   F8  "cross" only when the histogram changed sign within the last 5 bars
//   F9  a level's distance carries its sign and unit
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

const ASSET = { symbol: 'AAPL', price: 100 };
const QUIET = { rsi: 50, macd: null, macdHistogram: [], sma50: null };

async function render(props) {
  await act(async () => { root.render(<TechnicalTabV2 asset={ASSET} indicators={QUIET} levels={null} dailyData={null} {...props} />); });
}
/** The text of the row whose label element reads exactly `label`. */
function rowText(label) {
  const el = [...container.querySelectorAll('span')].find((s) => s.textContent === label);
  return el ? el.parentElement.textContent : null;
}
/** The value printed beside a volume bar's label. */
function volumeValue(label) {
  const el = [...container.querySelectorAll('span')].find((s) => s.textContent === label);
  return el ? el.parentElement.lastElementChild.textContent : null;
}

/** `n` weekday daily bars ending on `lastDate`, NEWEST-FIRST (API order). */
function weekdayBars(n, lastDate, fill) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00Z`);
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const i = out.length; // 0 = newest
      out.push({ date: d.toISOString().slice(0, 10), open: 100, high: 101, low: 99, close: 100, volume: 1000, ...fill(i) });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

describe('F5 — volume average over daily sessions', () => {
  it('40 daily bars: the average is over the newest 30 and labeled "30d Avg"', async () => {
    // newest 20 at 1M, next 10 at 3M, oldest 10 at 9M: 30-session mean 1.67M
    // (a 20-bar mean would read 1.0M, a 40-bar mean 3.5M).
    const bars = weekdayBars(40, '2026-10-14', (i) => ({ volume: i < 20 ? 1e6 : i < 30 ? 3e6 : 9e6 }));
    await render({ dailyData: bars });
    expect(volumeValue('30d Avg')).toBe('1.7M');
  });

  it('25 daily bars: the average is over all 25 and the label says "25d Avg"', async () => {
    const bars = weekdayBars(25, '2026-10-14', (i) => ({ volume: i < 5 ? 1e6 : 2e6 })); // mean 1.8M
    await render({ dailyData: bars });
    expect(volumeValue('25d Avg')).toBe('1.8M');
    expect(container.textContent).not.toContain('30d Avg');
  });
});

describe('F6 — the range is "52-week" only when it is', () => {
  it('300 daily bars: the range is the trailing 52 weeks and is labeled "52-week range"', async () => {
    // Bars older than 52 weeks (index ≥ 262 here) carry extremes that must not count.
    const bars = weekdayBars(300, '2026-10-14', (i) => (
      i === 280 ? { high: 999, low: 1 } : i === 10 ? { high: 150 } : i === 200 ? { low: 60 } : {}
    ));
    await render({ dailyData: bars });
    expect(container.textContent).toContain('52-week range');
    expect(container.textContent).toContain('$60.00');
    expect(container.textContent).toContain('$150.00');
    expect(container.textContent).not.toContain('$999.00');
    expect(container.textContent).not.toContain('$1.00');
  });

  it('120 daily bars: the range covers all 120 and its label names the span, not "52-week"', async () => {
    const bars = weekdayBars(120, '2026-10-14', (i) => (i === 119 ? { high: 180, low: 40 } : {}));
    await render({ dailyData: bars });
    expect(container.textContent).not.toContain('52-week');
    // 120 weekday bars span 30 Apr → 14 Oct, 167 days ≈ 5.5 months.
    expect(container.textContent).toContain('Range (5 mo)');
    expect(container.textContent).toContain('$40.00');
    expect(container.textContent).toContain('$180.00');
  });
});

describe('F7 — RSI shows a reading or nothing', () => {
  it('rsi null → "—", no zone word, no gauge dot', async () => {
    await render({ indicators: { ...QUIET, rsi: null } });
    expect(rowText('RSI (14)')).toBe('RSI (14)—');
    expect(container.textContent).not.toContain('Neutral');
    expect(container.textContent).not.toContain('50.0');
    expect(container.querySelector('[data-testid="rsi-dot"]')).toBeNull();
  });

  it('rsi 69.96 → "70.0" and Overbought (the zone reads the displayed number)', async () => {
    await render({ indicators: { ...QUIET, rsi: 69.96 } });
    expect(rowText('RSI (14)')).toBe('RSI (14)70.0Overbought');
  });

  it('rsi 30.04 → "30.0" and Oversold', async () => {
    await render({ indicators: { ...QUIET, rsi: 30.04 } });
    expect(rowText('RSI (14)')).toBe('RSI (14)30.0Oversold');
  });
});

describe('F8 — MACD says "cross" only when one happened', () => {
  it('histogram positive for 6 bars → "Above signal line"', async () => {
    const h = [0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
    await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.5, histogram: 0.5 }, macdHistogram: h } });
    expect(rowText('MACD Signal')).toBe('MACD Signal Above signal line');
  });

  it('negative → positive 2 bars ago → "Bullish cross · 2d ago"', async () => {
    const h = [0.3, 0.2, 0.1, -0.1, -0.2, -0.3];
    await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.7, histogram: 0.3 }, macdHistogram: h } });
    expect(rowText('MACD Signal')).toBe('MACD Signal Bullish cross · 2d ago');
  });

  it('positive → negative on the latest bar → "Bearish cross · latest session"; negative throughout → "Below signal line"', async () => {
    await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, 0.1, 0.2, 0.3, 0.4, 0.5] } });
    expect(rowText('MACD Signal')).toBe('MACD Signal Bearish cross · latest session');
    await render({ indicators: { ...QUIET, macd: { macd: -1, signal: -0.8, histogram: -0.2 }, macdHistogram: [-0.2, -0.1, -0.2, -0.3, -0.4, -0.5] } });
    expect(rowText('MACD Signal')).toBe('MACD Signal Below signal line');
  });

  it('a flip older than the 6-bar window is not a cross', async () => {
    await render({ indicators: { ...QUIET, macd: { macd: 1, signal: 0.5, histogram: 0.5 }, macdHistogram: [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, -0.1] } });
    expect(rowText('MACD Signal')).toBe('MACD Signal Above signal line');
  });

  it('null MACD → "—"', async () => {
    await render({ indicators: { ...QUIET, macd: null, macdHistogram: [] } });
    expect(rowText('MACD Signal')).toBe('MACD Signal—');
  });
});

describe('F9 — level distance carries its unit', () => {
  it('a level 2.97% below renders "-2.97%"; one 3.10% above renders "+3.10%"', async () => {
    const levels = {
      support: [{ price: 97.03, strength: 'STRONG', distanceFromCurrent: '-2.97' }],
      resistance: [{ price: 103.1, strength: 'MODERATE', distanceFromCurrent: '3.10' }],
      currentPrice: 100,
    };
    await render({ levels });
    expect(container.textContent).toContain('-2.97%');
    expect(container.textContent).toContain('+3.10%');
  });
});
