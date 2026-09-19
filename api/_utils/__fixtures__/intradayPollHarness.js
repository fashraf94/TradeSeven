// api/_utils/__fixtures__/intradayPollHarness.js
// Test-only fakes for the poller and validator runners: a calendar over the
// fixture sessions, a deterministic Live v2 / Live v1 / 1-minute-bars vendor,
// and a battle list. Zero product imports beyond the fixture sessions.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSession } from './intradaySessions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_BARS = JSON.parse(readFileSync(path.resolve(HERE, '../../../docs/audits/fixtures/AAPL_2026-09-17_1m.json'), 'utf8'));

const DATES = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-21'];
const SESSIONS = {};
DATES.forEach((d, i) => { SESSIONS[d] = makeSession(d, { previousEtDate: i > 0 ? DATES[i - 1] : null }); });
SESSIONS['2026-09-19'] = { etDate: '2026-09-19', isTradingDay: false, isEarlyClose: false, openMs: null, closeMs: null, sessionLenMin: null, previousEtDate: '2026-09-18' };
SESSIONS['2026-09-20'] = { etDate: '2026-09-20', isTradingDay: false, isEarlyClose: false, openMs: null, closeMs: null, sessionLenMin: null, previousEtDate: '2026-09-18' };

export const calendar = {
  getSessionForDate: (d) => SESSIONS[d] || null,
  getPreviousSessionDate: (d) => SESSIONS[d]?.previousEtDate ?? null,
};
export const sessionOf = (d) => SESSIONS[d] || null;

/** Shift the founder fixture (Sep 17) onto another session date. */
export function barsForDate(etDate, { drop = [], sparseFromMinute = null } = {}) {
  const s = SESSIONS[etDate];
  const base = SESSIONS['2026-09-17'];
  const delta = (s.openMs - base.openMs) / 1000;
  return FIXTURE_BARS
    .map((r) => ({ ...r, timestamp: r.timestamp + delta, datetime: undefined }))
    .filter((r, i) => !drop.includes(i) && (sparseFromMinute === null || i >= sparseFromMinute));
}

/**
 * A deterministic vendor. `barsByDate` maps a date → bars (or null for
 * unpublished); `onRequest(url)` observes every call and may return a
 * replacement response.
 */
export function makeVendor({ barsByDate = {}, priceOf = (sym, t) => 100 + (sym.charCodeAt(0) % 7) + Math.sin(t / 300_000) * 0.5, omit = [], onRequest = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push(url);
    const hook = onRequest ? await onRequest(url, opts) : null;
    if (hook) return hook;
    const nowMs = fetchImpl.now();
    if (url.includes('/us-quote-delayed')) {
      const syms = decodeURIComponent(url.match(/s=([^&]*)/)[1]).split(',');
      const data = {};
      for (const vendor of syms) {
        const sym = vendor.replace(/\.US$/, '').replace(/-/g, '.');
        if (omit.includes(sym)) continue;
        // A 15-minute delayed feed, clamped to the open (pre-open trades are §5.5 rejects; the fake stays in-session).
        const priceAsOf = Math.max(fetchImpl.sessionOpenMs, nowMs - 15 * 60_000 - (nowMs % 60_000));
        const p = priceOf(sym, priceAsOf);
        data[vendor] = { symbol: vendor, lastTradePrice: Number(p.toFixed(4)), lastTradeTime: priceAsOf, size: 100, open: p, high: p + 1, low: p - 1, volume: Math.floor((priceAsOf - fetchImpl.sessionOpenMs) / 60_000) * 1000 + 1000, averageVolume: 5_000_000, previousClosePrice: p - 0.5, change: 0.5, changePercent: 0.5, timestamp: Math.floor((nowMs - 60_000) / 1000) };
      }
      return { ok: true, status: 200, json: async () => ({ data }) };
    }
    if (url.includes('/real-time/')) {
      const m = url.match(/real-time\/([^?]+)/);
      const first = m[1];
      const rest = (url.match(/s=([^&]*)/) || [null, ''])[1];
      const codes = [first, ...(rest ? rest.split(',') : [])];
      const ts = Math.floor((nowMs - 60_000) / 1000);
      return { ok: true, status: 200, json: async () => codes.map((code) => ({ code, timestamp: ts, open: 60000, high: 60100, low: 59900, close: 60000 + (ts % 100), volume: 5, previousClose: 59900, change: 100, change_p: 0.1 })) };
    }
    if (url.includes('/intraday/')) {
      const from = Number(url.match(/from=(\d+)/)[1]);
      const date = Object.keys(SESSIONS).find((d) => SESSIONS[d].openMs && Math.floor(SESSIONS[d].openMs / 1000) === from);
      const bars = barsByDate[date];
      if (bars === null || bars === undefined) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => bars };
    }
    return { ok: false, status: 404 };
  };
  fetchImpl.now = () => Date.now();
  fetchImpl.sessionOpenMs = SESSIONS['2026-09-17'].openMs;
  fetchImpl.calls = calls;
  return fetchImpl;
}

export const battleWith = (held, bench = [], crypto = null) => ({
  id: 'b1', status: 'active', strategyPreset: 'balanced',
  portfolio: { star: held.slice(0, 2).map((s) => ({ symbol: s })), core: held.slice(2, 4).map((s) => ({ symbol: s })), support: held.slice(4).map((s) => ({ symbol: s })), bench: { stocks: bench.map((s) => ({ symbol: s })), crypto: crypto ? { symbol: crypto, isCrypto: true } : null } },
});
