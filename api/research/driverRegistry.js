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
 * TIER (V3 Sub-build 3 — the liquidity gate + extended tier): every entry
 * carries a `tier` field, 'core' | 'extended'. The original 25 are 'core' — the
 * default scan universe. The 'extended' drivers are opt-in only (the
 * comparison-tax rule: more drivers dim existing signals), gated behind
 * CORRELATION_EXTENDED_DRIVERS_ENABLED, and are two-gate verified (EODHD
 * availability + liquidity/data-quality) via the driver-audit tool
 * (api/research/driver-audit.js) BEFORE they were locked here — the CEW/BZ.COMM
 * lesson made structural. EMLC replaces the shell CEW (which failed Gate 2 in
 * external review: ≈1.8–3.3k avg volume with zero-volume days). CRITICAL: the
 * scan's docId salt AND driverUniverseHash derive from the EFFECTIVE scanned
 * set, not the whole registry (correlation-scan.js), so a core-only scan is
 * byte-identical to the pre-extended-tier state — the dark merge orphans no
 * cached scans and manufactures zero not_comparable days.
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
    tier: 'core',
  },
  WTI: {
    symbol: 'USO.US',
    label: 'WTI Crude (USO proxy)',
    returnMode: 'pct',
    unit: '% change of USO ETF',
    betaInterpretation: 'group % move per 1% move in USO (WTI oil ETF proxy)',
    category: 'macro',
    tier: 'core',
  },
  GOLD: {
    symbol: 'GLD.US',
    label: 'Gold (GLD proxy)',
    returnMode: 'pct',
    unit: '% change of GLD ETF',
    betaInterpretation: 'group % move per 1% move in GLD (gold ETF proxy)',
    category: 'macro',
    tier: 'core',
  },
  VIX: {
    symbol: 'VIX.INDX',
    label: 'VIX',
    returnMode: 'pct',
    unit: '% change of VIX index',
    betaInterpretation: 'group % move per 1% VIX move (percent change of the index, not vol points)',
    category: 'macro',
    tier: 'core',
  },
  TNX: {
    symbol: 'TNX.INDX',
    label: '10Y Yield',
    returnMode: 'diff',
    scale: 0.1,
    unit: 'yield points (pp)',
    betaInterpretation: 'group % move per 1.0 percentage-point yield change',
    // V2 Build 4 — conditional-correlation direction labels: "days {noun}
    // rose/fell". Optional field; drivers without it fall back to `label`.
    // TNX pins the spec copy ("days the 10Y yield rose/fell") because a
    // diff-mode up-day means the YIELD rose — a bare "+" would be dishonest.
    directionNoun: 'the 10Y yield',
    category: 'macro',
    tier: 'core',
  },
  DXY: {
    symbol: 'UUP.US',
    label: 'US Dollar (UUP proxy)',
    returnMode: 'pct',
    unit: '% change of UUP ETF',
    betaInterpretation: 'group % move per 1% move in UUP (dollar index ETF proxy)',
    category: 'macro',
    tier: 'core',
  },
  SPX: {
    symbol: 'SPY.US',
    label: 'S&P 500 (SPY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% S&P move (SPY)',
    category: 'macro',
    tier: 'core',
  },

  // ── Sectors (SPDR sector ETFs, .US) ──
  XLE: {
    symbol: 'XLE.US',
    label: 'Energy sector (XLE)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Energy sector (XLE)',
    category: 'sector',
    tier: 'core',
  },
  XLF: {
    symbol: 'XLF.US',
    label: 'Financials (XLF)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Financials (XLF)',
    category: 'sector',
    tier: 'core',
  },
  XLK: {
    symbol: 'XLK.US',
    label: 'Technology (XLK)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Technology (XLK)',
    category: 'sector',
    tier: 'core',
  },
  XLV: {
    symbol: 'XLV.US',
    label: 'Healthcare (XLV)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Healthcare (XLV)',
    category: 'sector',
    tier: 'core',
  },
  XLI: {
    symbol: 'XLI.US',
    label: 'Industrials (XLI)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Industrials (XLI)',
    category: 'sector',
    tier: 'core',
  },
  XLY: {
    symbol: 'XLY.US',
    label: 'Consumer Disc. (XLY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Consumer Disc. (XLY)',
    category: 'sector',
    tier: 'core',
  },
  XLP: {
    symbol: 'XLP.US',
    label: 'Consumer Staples (XLP)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Consumer Staples (XLP)',
    category: 'sector',
    tier: 'core',
  },
  XLU: {
    symbol: 'XLU.US',
    label: 'Utilities (XLU)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Utilities (XLU)',
    category: 'sector',
    tier: 'core',
  },
  XLB: {
    symbol: 'XLB.US',
    label: 'Materials (XLB)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Materials (XLB)',
    category: 'sector',
    tier: 'core',
  },

  // ── Style factors (single-factor ETFs, .US) ──
  MTUM: {
    symbol: 'MTUM.US',
    label: 'Momentum factor (MTUM)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Momentum factor (MTUM)',
    category: 'factor',
    tier: 'core',
  },
  VLUE: {
    symbol: 'VLUE.US',
    label: 'Value factor (VLUE)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Value factor (VLUE)',
    category: 'factor',
    tier: 'core',
  },
  QUAL: {
    symbol: 'QUAL.US',
    label: 'Quality factor (QUAL)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Quality factor (QUAL)',
    category: 'factor',
    tier: 'core',
  },
  USMV: {
    symbol: 'USMV.US',
    label: 'Low-volatility factor (USMV)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Low-volatility factor (USMV)',
    category: 'factor',
    tier: 'core',
  },

  // ── Risk & rates (credit / duration / breadth, .US) ──
  HYG: {
    symbol: 'HYG.US',
    label: 'High-yield credit (HYG)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in High-yield credit (HYG)',
    category: 'risk',
    tier: 'core',
  },
  TLT: {
    symbol: 'TLT.US',
    label: 'Long-duration Treasuries (TLT)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Long-duration Treasuries (TLT)',
    category: 'risk',
    tier: 'core',
  },
  IWM: {
    symbol: 'IWM.US',
    label: 'Small caps (IWM)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Small caps (IWM)',
    category: 'risk',
    tier: 'core',
  },
  RSP: {
    symbol: 'RSP.US',
    label: 'Equal-weight S&P (RSP)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Equal-weight S&P (RSP)',
    category: 'risk',
    tier: 'core',
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
    tier: 'core',
  },

  // ══ Extended tier (V3 Sub-build 3 — opt-in, two-gate verified) ═══════════
  // All .US ETFs on the proven equity path. Standard pct / '% change' /
  // {label}-templated betaInterpretation (no scale). These enter a scan ONLY
  // when CORRELATION_EXTENDED_DRIVERS_ENABLED is on AND the user opts in — the
  // effective-universe rule keeps the default scan's fingerprint unchanged.
  SMH: {
    symbol: 'SMH.US',
    label: 'Semiconductors (SMH)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Semiconductors (SMH)',
    category: 'sector',
    tier: 'extended',
  },
  CPER: {
    symbol: 'CPER.US',
    label: 'Copper (CPER proxy)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Copper (CPER proxy)',
    category: 'macro',
    tier: 'extended',
  },
  FXY: {
    symbol: 'FXY.US',
    label: 'Japanese Yen (FXY)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in Japanese Yen (FXY)',
    category: 'macro',
    tier: 'extended',
  },
  TIP: {
    symbol: 'TIP.US',
    label: 'TIPS duration (TIP)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in TIPS duration (TIP)',
    category: 'risk',
    tier: 'extended',
  },
  EMLC: {
    // Honestly labeled: an EM local-currency BOND proxy — it carries local-rates
    // exposure, not a clean FX read. Replaces the shell CEW (failed Gate 2).
    symbol: 'EMLC.US',
    label: 'EM local-currency bonds (EMLC)',
    returnMode: 'pct',
    unit: '% change',
    betaInterpretation: 'group % move per 1% move in EM local-currency bonds (EMLC)',
    category: 'macro',
    tier: 'extended',
  },
};
