// research/level-study/tests/_synthetic-labels.js
//
// Synthetic fixtures for the Session-6 labeler tests (lib/labels.js). Not matched by the
// `tests/*.test.js` discovery glob, so it is never auto-run.
//
// Convention: anchor = 100, atrDaily = 1 → 1 ATR == 1 price unit, so P/C/W and every ATR-unit grid
// value reads directly off the prices (a low of 99.68 is 0.32 ATR of penetration; a close of 100.30
// is C = +0.30). The tight defaults keep each fixture expressing the RELATIONSHIP under test rather
// than magic numbers. Bars carry full, independent OHLC on the adjusted basis so a rejection wick
// (deep low, hold-side close) can be built exactly.

const ANCHOR = 100;

function hhmm(etMinutes) {
  const h = Math.floor(etMinutes / 60), m = etMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * One 5-min regular bar with fully-independent OHLC (adjusted basis). Defaults make a flat bar at
 * `c`. epoch is deterministic (ET minutes treated as the UTC label, as the S4 fixtures do).
 */
export function lbar(etDate, etMinutes, { o, h, l, c, v = 1000, f = 1 } = {}) {
  const close = c;
  const open = o ?? close;
  const high = h ?? Math.max(open, close);
  const low = l ?? Math.min(open, close);
  const epoch = Math.floor(Date.parse(`${etDate}T${hhmm(etMinutes)}:00Z`) / 1000);
  return {
    epoch, etDate, etMinutes, role: 'regular', closingAuction: false,
    open, high, low, close, volume: v, adjFactor: f,
    adjOpen: open * f, adjHigh: high * f, adjLow: low * f, adjClose: close * f,
    warmup5m: false,
  };
}

/** A session object shaped as the labeler consumes it: { etDate, regular, sessionCloseAdj }. */
export function sess(etDate, bars, { sessionCloseAdj } = {}) {
  const regular = [...bars].sort((a, b) => a.etMinutes - b.etMinutes);
  return {
    etDate,
    regular,
    sessionCloseAdj: sessionCloseAdj != null ? sessionCloseAdj : (regular.length ? regular[regular.length - 1].adjClose : null),
  };
}

/** A full flat session at `price` from 09:30 (570) to 15:55 (955) — the neutral backdrop. */
export function flatSession(etDate, price = ANCHOR, opts = {}) {
  const bars = [];
  for (let et = 570; et <= 955; et += 5) bars.push(lbar(etDate, et, { c: price, ...opts }));
  return sess(etDate, bars);
}

/** { sessions, dateToIdx } from an ascending array of session objects. */
export function ordered(sessions) {
  const s = [...sessions].sort((a, b) => (a.etDate < b.etDate ? -1 : a.etDate > b.etDate ? 1 : 0));
  return { sessions: s, dateToIdx: new Map(s.map((x, i) => [x.etDate, i])) };
}

/** A labelable touch event with sane defaults (support, anchor 100, atr 1, eligible). */
export function mkEvent(overrides = {}) {
  const eventDate = overrides.eventDate || '2024-03-05';
  const touchEtMinutes = overrides.touchEtMinutes ?? 690;
  const touchAt = new Date(Date.parse(`${eventDate}T${hhmm(touchEtMinutes)}:00Z`)).toISOString();
  return {
    eventId: overrides.eventId || `TST_ev_${eventDate}_${touchEtMinutes}`,
    symbol: overrides.symbol || 'TST',
    sector: overrides.sector || 'XLK',
    side: overrides.side || 'support',
    eventDate,
    touchAt,
    touchEtMinutes,
    zoneLow: overrides.zoneLow ?? (ANCHOR - 0.25),
    zoneHigh: overrides.zoneHigh ?? (ANCHOR + 0.25),
    atrDaily: overrides.atrDaily ?? 1,
    familyTier: overrides.familyTier || 'F2',
    disposition: overrides.disposition || 'touch',
    hourlyClassEligible: overrides.hourlyClassEligible ?? true,
    ...overrides,
  };
}

export { ANCHOR };
