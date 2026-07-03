/**
 * Correlation Intelligence — driver-asset registry (Build Spec V1.2 + Fix 1;
 * V2 Build 1 — category taxonomy + registry expansion).
 *
 * This registry is the tool's OWN driver universe: none of these symbols
 * except TNX.INDX is fetched anywhere else on main (Phase 0 discovery), and
 * nothing here piggybacks on Index Intelligence or season evaluation.
 *
 * CATEGORY TAXONOMY (V2 Build 1): every entry carries a `category` field, one
 * of 'macro' | 'sector' | 'factor' | 'risk' | 'digital'. The client driver
 * select renders these as grouped <optgroup> sections in a pinned order
 * (Macro, Sectors, Style factors, Risk & rates, Digital, then a UI-only Custom
 * section for pair mode — see CorrelationLab.jsx). Category is metadata for
 * grouping only; the engine reads it nowhere.
 *
 * VERIFIED-LIVE-BEFORE-MERGE PROTOCOL (the BZ.COMM lesson): a symbol only
 * earns a spec lock after one live preview run returns 200 with sane numbers.
 * The V1.2 commodity symbols (BZ.COMM/CL.COMM/GC.COMM/DX.COMM) 404'd on EODHD's
 * /api/eod endpoint and were replaced by ETF proxies (Fix 1 below) precisely
 * because they were locked before a live check. Every driver added in this
 * build is run once against a fixed group on preview before merge; any
 * 404/422 driver_unavailable is reported for symbol correction, never merged
 * silently.
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
  // ── Macro (existing 7 — values unchanged, category added) ──
  BRENT: {
    symbol: 'BNO.US',
    label: 'Brent Crude (BNO proxy)',
    returnMode: 'pct',
    unit: '% change of BNO ETF',
    betaInterpretation: 'group % move per 1% move in BNO (Brent oil ETF proxy)',
    category: 'macro',
  },
  WTI: {
    symbol: 'USO.US',
    label: 'WTI Crude (USO proxy)',
    returnMode: 'pct',
    unit: '% change of USO ETF',
    betaInterpretation: 'group % move per 1% move in USO (WTI oil ETF proxy)',
    category: 'macro',
  },
  GOLD: {
    symbol: 'GLD.US',
    label: 'Gold (GLD proxy)',
    returnMode: 'pct',
    unit: '% change of GLD ETF',
    betaInterpretation: 'group % move per 1% move in GLD (gold ETF proxy)',
    category: 'macro',
  },
  VIX: {
    symbol: 'VIX.INDX',
    label: 'VIX',
    returnMode: 'pct',
    unit: '% change of VIX index',
    betaInterpretation: 'group % move per 1% VIX move (percent change of the index, not vol points)',
    category: 'macro',
  },
  TNX: {
    symbol: 'TNX.INDX',
    label: '10Y Yield',
    returnMode: 'diff',
    scale: 0.1,
    unit: 'yield points (pp)',
    betaInterpretation: 'group % move per 1.0 percentage-point yield change',
    category: 'macro',
  },
  DXY: {
    symbol: 'UUP.US',
    label: 'US Dollar (UUP proxy)',
    returnMode: 'pct',
    unit: '% change of UUP ETF',
    betaInterpretation: 'group % move per 1% move in UUP (dollar index ETF proxy)',
    category: 'macro',
  },
  SPX: {
    symbol: 'SPY.US',
    label: 'S&P 500 (SPY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% S&P move (SPY)',
    category: 'macro',
  },

  // ── Sectors (SPDR sector ETFs, .US) ──
  XLE: {
    symbol: 'XLE.US',
    label: 'Energy sector (XLE)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Energy sector (XLE)',
    category: 'sector',
  },
  XLF: {
    symbol: 'XLF.US',
    label: 'Financials (XLF)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Financials (XLF)',
    category: 'sector',
  },
  XLK: {
    symbol: 'XLK.US',
    label: 'Technology (XLK)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Technology (XLK)',
    category: 'sector',
  },
  XLV: {
    symbol: 'XLV.US',
    label: 'Healthcare (XLV)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Healthcare (XLV)',
    category: 'sector',
  },
  XLI: {
    symbol: 'XLI.US',
    label: 'Industrials (XLI)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Industrials (XLI)',
    category: 'sector',
  },
  XLY: {
    symbol: 'XLY.US',
    label: 'Consumer Disc. (XLY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Consumer Disc. (XLY)',
    category: 'sector',
  },
  XLP: {
    symbol: 'XLP.US',
    label: 'Consumer Staples (XLP)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Consumer Staples (XLP)',
    category: 'sector',
  },
  XLU: {
    symbol: 'XLU.US',
    label: 'Utilities (XLU)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Utilities (XLU)',
    category: 'sector',
  },
  XLB: {
    symbol: 'XLB.US',
    label: 'Materials (XLB)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Materials (XLB)',
    category: 'sector',
  },

  // ── Style factors (single-factor ETFs, .US) ──
  MTUM: {
    symbol: 'MTUM.US',
    label: 'Momentum factor (MTUM)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Momentum factor (MTUM)',
    category: 'factor',
  },
  VLUE: {
    symbol: 'VLUE.US',
    label: 'Value factor (VLUE)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Value factor (VLUE)',
    category: 'factor',
  },
  QUAL: {
    symbol: 'QUAL.US',
    label: 'Quality factor (QUAL)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Quality factor (QUAL)',
    category: 'factor',
  },
  USMV: {
    symbol: 'USMV.US',
    label: 'Low-volatility factor (USMV)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Low-volatility factor (USMV)',
    category: 'factor',
  },

  // ── Risk & rates (credit / duration / breadth, .US) ──
  HYG: {
    symbol: 'HYG.US',
    label: 'High-yield credit (HYG)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in High-yield credit (HYG)',
    category: 'risk',
  },
  TLT: {
    symbol: 'TLT.US',
    label: 'Long-duration Treasuries (TLT)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Long-duration Treasuries (TLT)',
    category: 'risk',
  },
  IWM: {
    symbol: 'IWM.US',
    label: 'Small caps (IWM)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Small caps (IWM)',
    category: 'risk',
  },
  RSP: {
    symbol: 'RSP.US',
    label: 'Equal-weight S&P (RSP)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Equal-weight S&P (RSP)',
    category: 'risk',
  },

  // ── Digital ──
  // BTC-USD.CC is the registry's ONE non-.US/.INDX symbol (crypto convention:
  // stocks/historical.js:166, crypto/prices.js:40). BTC-USD.CC trades 7 days a
  // week; the endpoint's inner-join on date drops every non-equity (weekend/
  // holiday) session automatically, so expected joinedCloses matches the EQUITY
  // trading calendar (~504 over a 2y lookback, not ~730). That is correct
  // behavior, not data loss. Driver symbols are never re-normalized (they carry
  // their own suffix), so this reaches EODHD as BTC-USD.CC verbatim.
  BTC: {
    symbol: 'BTC-USD.CC',
    label: 'Bitcoin (BTC)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Bitcoin (BTC)',
    category: 'digital',
  },
};
