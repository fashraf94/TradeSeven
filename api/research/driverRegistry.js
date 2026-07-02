/**
 * Correlation Intelligence — driver-asset registry (Build Spec V1.2, pinned).
 *
 * This registry is the tool's OWN driver universe: none of these symbols
 * except TNX.INDX is fetched anywhere else on main (Phase 0 discovery), and
 * nothing here piggybacks on Index Intelligence or season evaluation.
 *
 * returnMode:
 *   'pct'  — simple daily percent returns on adjusted close.
 *   'diff' — first differences of the (scaled) level. Percent change of a
 *            yield is misleading, so TNX uses yield-point differences.
 *
 * TNX quirk (indexIntelligence.js classifyYieldRegime precedent): EODHD's
 * TNX.INDX level is the yield × 10 (e.g. 43.5 = 4.35%). `scale: 0.1` is
 * applied to LEVELS, BEFORE differencing, so every TNX number downstream —
 * diffs, inflections, forward numbers — reads in actual yield points.
 *
 * VIX stays 'pct' (decision on record): percent change is the conventional
 * VIX series and preserves the strongly-negative SPX/QQQ relationship used as
 * a smoke tripwire. Mixed-unit concerns are handled by surfacing `unit` and
 * `betaInterpretation` in the response and UI — never by changing the series.
 */
export const CORRELATION_DRIVERS = {
  BRENT: {
    symbol: 'BZ.COMM',
    label: 'Brent Crude',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% Brent move',
  },
  WTI: {
    symbol: 'CL.COMM',
    label: 'WTI Crude',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% WTI move',
  },
  GOLD: {
    symbol: 'GC.COMM',
    label: 'Gold',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% gold move',
  },
  VIX: {
    symbol: 'VIX.INDX',
    label: 'VIX',
    returnMode: 'pct',
    unit: '% change of VIX index',
    betaInterpretation: 'group % move per 1% VIX move (percent change of the index, not vol points)',
  },
  TNX: {
    symbol: 'TNX.INDX',
    label: '10Y Yield',
    returnMode: 'diff',
    scale: 0.1,
    unit: 'yield points (pp)',
    betaInterpretation: 'group % move per 1.0 percentage-point yield change',
  },
  DXY: {
    symbol: 'DX.COMM',
    label: 'US Dollar Index',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% DXY move',
  },
  SPX: {
    symbol: 'GSPC.INDX',
    label: 'S&P 500',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% S&P move',
  },
};
