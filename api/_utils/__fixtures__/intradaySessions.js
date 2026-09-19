// api/_utils/__fixtures__/intradaySessions.js
// Test-only calendar sessions for the intraday suites. Sep 2026 is EDT
// (UTC−4): 09:30 ET = 13:30Z, 16:00 ET = 20:00Z, 13:00 ET = 17:00Z.
// Zero imports on purpose.

export function makeSession(etDate, { early = false, previousEtDate = null } = {}) {
  const [y, m, d] = etDate.split('-').map(Number);
  const openMs = Date.UTC(y, m - 1, d, 13, 30, 0);
  const closeMs = early ? Date.UTC(y, m - 1, d, 17, 0, 0) : Date.UTC(y, m - 1, d, 20, 0, 0);
  return {
    etDate,
    isTradingDay: true,
    isEarlyClose: early,
    openMs,
    closeMs,
    sessionLenMin: (closeMs - openMs) / 60_000,
    previousEtDate,
  };
}

/** Sep 17 2026 (Thu) with Sep 16 as the previous session. */
export const SEP17 = makeSession('2026-09-17', { previousEtDate: '2026-09-16' });
export const SEP16 = makeSession('2026-09-16', { previousEtDate: '2026-09-15' });
export const SEP18 = makeSession('2026-09-18', { previousEtDate: '2026-09-17' });

/** A pure ET-date function for the fixtures' dates (EDT). */
export function etDateOfEdt(ms) {
  const d = new Date(ms - 4 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export const sessionOfFixture = (etDate) => {
  const map = { '2026-09-16': SEP16, '2026-09-17': SEP17, '2026-09-18': SEP18 };
  return map[etDate] || null;
};

/** A Live-v2-shaped observation at an ET-minute offset from the open. */
export function obsAt(session, minuteFromOpen, { sym = 'AAPL', price = 100, volume = 1000, high = null, low = null, open = null, snapshotLagMs = 15 * 60_000, availableLagMs = 16 * 60_000, extra = {} } = {}) {
  const priceAsOf = session.openMs + minuteFromOpen * 60_000;
  return {
    sym, price, priceAsOf, snapshotTs: priceAsOf + snapshotLagMs, availableAt: priceAsOf + availableLagMs,
    volume, high, low, open, averageVolume: null, previousClose: null, change: null, changePercent: null, size: null,
    source: 'eodhd_live_v2', ...extra,
  };
}
