// research/level-study/tests/_synthetic-intraday.js
//
// Synthetic 5-min sessions + registry fixtures for the Session-4 event-detection tests.
// Not matched by the `tests/*.test.js` discovery glob, so it is never auto-run.
//
// Convention for these fixtures: family anchor = 100, unit = 1 → episode zone [99.75, 100.25]
// (anchor ± 0.25·u). Support separation upward begins above 100.25; a full-1.0·u separation is
// adjClose ≥ 101.25. Prices are the adjusted 5-min closes; the tight bar range (±0.02) keeps
// adjClose the sole driver of intersect/separation.

function hhmm(etMinutes) {
  const h = Math.floor(etMinutes / 60), m = etMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** One regular 5-min bar centred on `price`. epoch is deterministic (Date.parse of the ISO label). */
export function bar(etDate, etMinutes, price, { h = 0.02 } = {}) {
  const epoch = Math.floor(Date.parse(`${etDate}T${hhmm(etMinutes)}:00Z`) / 1000);
  return {
    epoch, etDate, etMinutes, role: 'regular', closingAuction: false,
    open: price, high: price + h, low: price - h, close: price, volume: 1000, adjFactor: 1,
    adjOpen: price, adjHigh: price + h, adjLow: price - h, adjClose: price, warmup: false,
  };
}

/** A 5-min session from a price path (one bar per 5 minutes starting 09:30 = etMin 570). */
export function session5m(etDate, prices, opts = {}) {
  const { startMin = 570, h = 0.02, isFullDay = true, earlyClose = false, hasAuction = true } = opts;
  const regular = prices.map((p, i) => bar(etDate, startMin + i * 5, p, { h }));
  const sessionCloseAdj = regular.length ? regular[regular.length - 1].adjClose : null;
  return { etDate, isFullDay, earlyClose, hasAuction, sessionCloseAdj, regular };
}

/** Build a fiveMinByDate Map (date -> session) from an array of sessions. */
export function fiveMinMap(sessions) {
  return new Map(sessions.map((s) => [s.etDate, s]));
}

// ── Registry fixture builders (data/levels/{sym}.json shape) ─────────────────

/** A synthetic family record (lineage.js foundFamily shape; S4-relevant fields). */
export function mkFamily(familyId, opts = {}) {
  const {
    bornDate = '2023-06-01', roleState = 'support', status = 'live',
    retiredDate = null, mergedInto = null, mergedDate = null, anchor = 100,
  } = opts;
  return {
    familyId, symbol: familyId.split('_')[0], bornDate, status, anchor,
    retiredDate, mergedInto, mergedDate,
    roleLog: [{ date: bornDate, role: roleState }],
    touchHistory: [], sequenceIndex: 0, s4Hooks: { episode: null, rearm: null, cooldown: null },
  };
}

/** A per-session registry snapshot for a family (provides refSnapshot + point-in-time anchor). */
export function snap(familyId, date, opts = {}) {
  const {
    anchor = 100, centroid = anchor, tier = 'F1', methods = ['swing_sr_clusters'],
    firstTradableDate = date, side = 'support',
  } = opts;
  return {
    snapshotId: `${familyId}_${date}_snap_${centroid.toFixed(2)}`,
    date, centroid, side, tier, methods, firstTradableDate,
    familyId, familyAnchor: anchor,
    zoneLow: centroid - 0.25, zoneHigh: centroid + 0.25,
  };
}

/** A registry session { date, atr, refClose, unit, snapshots }. */
export function regSession(date, snapshots, opts = {}) {
  const { atr = 4, refClose = 100, unit = 1 } = opts;
  return { date, atr, refClose, unit, snapshots };
}

/** Assemble the full registry consumed by detectEvents(). Auto-builds a study-start checkpoint. */
export function mkRegistry(symbol, families, sessions, opts = {}) {
  const { studyStart = '2023-07-10', events = [] } = opts;
  const famObj = {};
  for (const f of families) famObj[f.familyId] = f;
  const dates = sessions.map((s) => s.date).slice().sort();
  const checkpoint = opts.checkpoint || {
    date: studyStart,
    warmupSessionsReplayed: 550,
    liveFamilies: families
      .filter((f) => f.status === 'live')
      .map((f) => ({ familyId: f.familyId, anchor: f.anchor, status: f.status, roleLog: f.roleLog }))
      .sort((a, b) => (a.familyId < b.familyId ? -1 : 1)),
    warmupFamilyCounts: { live: families.filter((f) => f.status === 'live').length, retired: 0, merged: 0 },
  };
  return {
    symbol, configVersion: 3, basis: 'adjusted',
    window: {
      configured: { start: studyStart, end: '2026-07-10' },
      actualFirstSession: opts.actualFirstSession || dates[0] || null,
      actualLastSession: opts.actualLastSession || dates[dates.length - 1] || null,
    },
    studyStartCheckpoint: checkpoint,
    sessions, families: famObj, events,
  };
}
