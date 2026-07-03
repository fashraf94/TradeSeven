/**
 * Correlation Intelligence — driver-asset registry (Build Spec V1.2 + Fix 1).
 *
 * This registry is the tool's OWN driver universe: none of these symbols
 * except TNX.INDX is fetched anywhere else on main (Phase 0 discovery), and
 * nothing here piggybacks on Index Intelligence or season evaluation.
 *
 * FIX 1 (founder-verified on the Vercel preview, Jul 2 2026): the original
 * V1.2 commodity symbols (BZ.COMM / CL.COMM / GC.COMM / DX.COMM) do not exist
 * on EODHD's /api/eod endpoint (confirmed 404s in preview function logs).
 * Commodities/DXY are therefore served via ETF PROXIES on the proven `.US`
 * path — same endpoint, same response shape, same trading calendar as the
 * equity groups (which also removes most holiday join-mismatch), zero new
 * fetch code. Known cost: futures-roll drag in the oil ETFs — acceptable at
 * 20/60d daily-return horizons and labeled honestly in `label`/`unit`/
 * `betaInterpretation`. True-spot commodity series via EODHD's FRED-sourced
 * /api/commodities endpoint (1–2 business-day publication lag, monthly-only
 * gold, no DXY) is the documented post-V0 upgrade path — unsuitable for
 * same-day joins today.
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
 * TNX.INDX stays: proven daily in production via compute-index-intelligence.
 *
 * VIX stays VIX.INDX pending live verification — there is NO acceptable ETF
 * proxy for VIX at these horizons (VXX/VIXY roll structure distorts even
 * daily behavior). If VIX.INDX 404s on re-smoke, that is an open item for a
 * founder decision, never a silent substitution. VIX stays 'pct' (decision
 * on record): percent change is the conventional VIX series and preserves
 * the strongly-negative SPX/QQQ relationship used as a smoke tripwire.
 */
export const CORRELATION_DRIVERS = {
  BRENT: {
    symbol: 'BNO.US',
    label: 'Brent Crude (BNO proxy)',
    returnMode: 'pct',
    unit: '% change of BNO ETF',
    betaInterpretation: 'group % move per 1% move in BNO (Brent oil ETF proxy)',
  },
  WTI: {
    symbol: 'USO.US',
    label: 'WTI Crude (USO proxy)',
    returnMode: 'pct',
    unit: '% change of USO ETF',
    betaInterpretation: 'group % move per 1% move in USO (WTI oil ETF proxy)',
  },
  GOLD: {
    symbol: 'GLD.US',
    label: 'Gold (GLD proxy)',
    returnMode: 'pct',
    unit: '% change of GLD ETF',
    betaInterpretation: 'group % move per 1% move in GLD (gold ETF proxy)',
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
    symbol: 'UUP.US',
    label: 'US Dollar (UUP proxy)',
    returnMode: 'pct',
    unit: '% change of UUP ETF',
    betaInterpretation: 'group % move per 1% move in UUP (dollar index ETF proxy)',
  },
  SPX: {
    symbol: 'SPY.US',
    label: 'S&P 500 (SPY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% S&P move (SPY)',
  },
};
