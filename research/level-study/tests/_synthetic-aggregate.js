// research/level-study/tests/_synthetic-aggregate.js
//
// Synthetic fixtures for the Session-7 aggregation tests (lib/stats.js, lib/aggregate.js, lib/packets.js).
// Not matched by the `tests/*.test.js` discovery glob, so it is never auto-run.
//
// The builders fabricate joined records and stat cells directly, so each test expresses the RELATIONSHIP
// under test (a floor boundary, a clustering effect, a stability flip) rather than magic numbers. No data
// files are read — everything is deterministic and in-memory.

/** A stat "cell" row: { date, symbol, sector, y }. y is 0/1 for rates or numeric for medians. */
export function row(date, symbol, sector, y) { return { date, symbol, sector, y }; }

/**
 * A cell with exactly `n` rows spread over `ud` unique dates, with `nOnes` rows having y=1. Dates are
 * distributed as evenly as possible across `ud` calendar days (2024-01-01…), symbols round-robin over
 * `symbols`. Lets a test dial n and uniqueDates INDEPENDENTLY (the S5-A2 two-floor boundary).
 */
export function cellOf({ n, ud, nOnes = 0, symbols = ['S0', 'S1', 'S2', 'S3', 'S4'], sectors = ['X0', 'X1'] }) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const dateIdx = i % ud; // first `ud` rows each get a distinct date, then wrap
    const date = `2024-01-${String(dateIdx + 1).padStart(2, '0')}`;
    rows.push(row(date, symbols[i % symbols.length], sectors[i % sectors.length], i < nOnes ? 1 : 0));
  }
  return rows;
}

/** A canonical joined record with sane defaults; override any field. */
export function rec(o = {}) {
  const eventDate = o.eventDate || '2024-03-05';
  return {
    eventId: o.eventId || `TST_${Math.random().toString(36).slice(2, 8)}`,
    symbol: o.symbol || 'AAA',
    sector: o.sector || 'XLK',
    side: o.side || 'support',
    eventDate,
    familyTier: o.familyTier || 'F2',
    disposition: o.disposition || 'touch',
    touchEtMinutes: o.touchEtMinutes ?? 600,
    hasIntradayApproach: o.hasIntradayApproach ?? true,
    hourlyClassEligible: o.hourlyClassEligible ?? true,
    hourly_class: o.hourly_class ?? 'DRIFT_HOLD',
    rvol_bucket: o.rvol_bucket ?? 'MID',
    extension_bucket: o.extension_bucket ?? 'MID',
    momo_regime: o.momo_regime ?? 'NEUTRAL',
    base_count: o.base_count ?? 1,
    move_origin: o.move_origin ?? 'NO_GAP',
    tod_bucket: o.tod_bucket ?? 'midday',
    vol_regime_pctile: o.vol_regime_pctile ?? 0.5,
    spy_direction_at_touch: o.spy_direction_at_touch ?? 'up',
    held_EOD_entry: o.held_EOD_entry ?? true,
    clean_bounce_touch: o.clean_bounce_touch ?? false,
    clean_bounce_entry: o.clean_bounce_entry ?? false,
    mfe_eod_entry: o.mfe_eod_entry ?? 0.6,
    mae_eod_entry: o.mae_eod_entry ?? -0.25,
    fraction_elapsed: o.fraction_elapsed ?? 0.3,
    ...o,
  };
}

/** Build `n` records sharing a template, with round-robin dates/symbols so cells clear the floors. */
export function recs(n, template = {}, { symbols = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'], startDate = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(rec({
      ...template,
      eventId: `${template.eventId || 'E'}_${i}`,
      symbol: symbols[i % symbols.length],
      sector: `SEC${i % 3}`,
      eventDate: `2024-0${((i % 6) + 1)}-${String(((i % 20) + startDate)).padStart(2, '0')}`,
    }));
  }
  return out;
}
