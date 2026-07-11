// Characterize A1-A6 from captured fixtures. Emits summary.json for the report.
import fs from 'node:fs/promises';
import path from 'node:path';

const PROBE = ['AAPL','NVDA','MSFT','KO','PG','JNJ','TSLA','AMD','COIN','AFRM','HOOD','RKLB','SPY','XLK','XLE','SPHB','SPLV'];
const SAMPLE_5M = ['AAPL','TSLA','AFRM','XLK'];
const STUDY_START = '2023-07-10';
const WARMUP_SESSIONS_MIN = 550;
const MIN_36MO_DEPTH = '2023-07-10';

const load = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

// ── A1: earliest available 5m timestamp per symbol (from depth-probe fixtures) ──
const A1 = [];
for (const sym of PROBE) {
  const bars = await load(`fixtures/depth-probe/${sym}_5m_2023-06.json`);
  const first = bars[0]?.datetime ?? null;
  const last = bars[bars.length-1]?.datetime ?? null;
  A1.push({
    symbol: sym,
    depth_probe_first: first,
    depth_probe_last: last,
    depth_probe_count: bars.length,
    verdict_36mo: first && first <= '2023-07-10 00:00:00' ? 'PASS' : 'FAIL',
  });
}

// ── A2: sessions in daily EOD before study start (2023-07-10) ──
const A2 = [];
for (const sym of PROBE) {
  const bars = await load(`fixtures/daily/${sym}_eod_2018-01-01_2026-07-10.json`);
  const before = bars.filter(b => b.date < STUDY_START).length;
  A2.push({
    symbol: sym,
    daily_first: bars[0]?.date ?? null,
    daily_last: bars[bars.length-1]?.date ?? null,
    total_sessions: bars.length,
    sessions_before_study_start: before,
    verdict_550_warmup: before >= WARMUP_SESSIONS_MIN ? 'PASS' : 'FAIL',
    shortfall: Math.max(0, WARMUP_SESSIONS_MIN - before),
  });
}

// ── A3: cross-grain invariant — daily.close (raw) vs 5m last regular bar close ──
// For each equity probe with a recent 5m sample month, iterate over trading days,
// compare last-regular-bar close (19:55 UTC bar) to daily close for that date.
const TOL = 0.001; // 0.1%
const A3 = [];
for (const sym of SAMPLE_5M) {
  const intraday = await load(`fixtures/sample-5m/${sym}_5m_2026-06.json`);
  const daily = await load(`fixtures/daily/${sym}_eod_2018-01-01_2026-07-10.json`);
  const dailyByDate = Object.fromEntries(daily.map(d => [d.date, d]));

  // Group intraday by session date (UTC), take last regular-session bar (19:55 UTC — bar-open labeling)
  const bySession = {};
  for (const b of intraday) {
    const date = b.datetime.slice(0,10);
    (bySession[date] ??= []).push(b);
  }
  const comparisons = [];
  for (const [date, bars] of Object.entries(bySession)) {
    const daily = dailyByDate[date];
    if (!daily) continue;
    // Find last regular-session bar: 19:55 UTC (bar-open labeling for 19:55-20:00 slot)
    const lastRegular = bars.find(b => b.datetime.endsWith('19:55:00'));
    if (!lastRegular) continue;
    const diff = lastRegular.close - daily.close;
    const relDiff = diff / daily.close;
    comparisons.push({
      date,
      daily_close: daily.close,
      intraday_last_regular_close: lastRegular.close,
      diff_pct: (relDiff*100).toFixed(4),
      within_tol: Math.abs(relDiff) <= TOL,
    });
  }
  const nSessions = comparisons.length;
  const nWithin = comparisons.filter(c => c.within_tol).length;
  A3.push({
    symbol: sym,
    sessions_compared: nSessions,
    within_0_1_pct: nWithin,
    verdict: nSessions >= 20 && nWithin === nSessions ? 'PASS'
             : nSessions >= 20 && nWithin/nSessions >= 0.95 ? 'PARTIAL'
             : 'FAIL',
    sample_comparisons: comparisons.slice(0, 5),
    outliers: comparisons.filter(c => !c.within_tol).slice(0, 5),
  });
}

// ── A3 split-adjacent: NVDA 2024-06-10 10-for-1 split ──
const nvdaSplit = await load('fixtures/split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json');
const nvdaDaily = await load('fixtures/daily/NVDA_eod_2018-01-01_2026-07-10.json');
const nvdaDailyByDate = Object.fromEntries(nvdaDaily.map(d => [d.date, d]));
const nvdaBySession = {};
for (const b of nvdaSplit) {
  const date = b.datetime.slice(0,10);
  (nvdaBySession[date] ??= []).push(b);
}
const nvdaSplitComparisons = [];
for (const [date, bars] of Object.entries(nvdaBySession)) {
  const d = nvdaDailyByDate[date];
  if (!d) continue;
  const lastRegular = bars.find(b => b.datetime.endsWith('19:55:00'));
  if (!lastRegular) continue;
  nvdaSplitComparisons.push({
    date,
    daily_close_raw: d.close,
    daily_adjusted_close: d.adjusted_close,
    intraday_last_regular_close: lastRegular.close,
    ratio_intraday_to_dailyRaw: (lastRegular.close / d.close).toFixed(4),
    ratio_intraday_to_dailyAdj: (lastRegular.close / d.adjusted_close).toFixed(4),
  });
}

// ── A4: timestamp semantics evidence (from AAPL 5m sample) ──
const aaplSample = await load('fixtures/sample-5m/AAPL_5m_2026-06.json');
const A4 = {
  gmtoffset_all_zero: aaplSample.every(b => b.gmtoffset === 0),
  first_bar: aaplSample[0],
  last_bar: aaplSample[aaplSample.length-1],
  first_session_first_5_bars: aaplSample.slice(0, 5).map(b => b.datetime),
  first_session_last_5_bars: aaplSample.filter(b => b.datetime.startsWith('2026-06-01')).slice(-5).map(b => b.datetime),
  bars_outside_regular_session: aaplSample.filter(b => {
    const hhmm = b.datetime.slice(11, 16);
    // Regular session in UTC during EDT: 13:30 - 19:55 (bar-open); post-session synthetic at 20:00
    return hhmm < '13:30' || hhmm > '20:00';
  }).length,
  bars_at_20_00: aaplSample.filter(b => b.datetime.endsWith('20:00:00')).length,
  first_bars_per_day: [...new Set(aaplSample.map(b => b.datetime.slice(0,10)))].slice(0, 5).map(date => {
    const day = aaplSample.filter(b => b.datetime.startsWith(date));
    return { date, first: day[0].datetime, last: day[day.length-1].datetime, count: day.length };
  }),
};

// ── A5: synthetic close-print bars — volume=null + O=H=L=C ──
const A5 = [];
for (const sym of SAMPLE_5M) {
  const bars = await load(`fixtures/sample-5m/${sym}_5m_2026-06.json`);
  const synth = bars.filter(b => b.volume === null && b.open === b.high && b.high === b.low && b.low === b.close);
  const sessions = new Set(bars.map(b => b.datetime.slice(0,10))).size;
  const nullVol = bars.filter(b => b.volume === null).length;
  const flat = bars.filter(b => b.open === b.high && b.high === b.low && b.low === b.close).length;
  const at2000 = bars.filter(b => b.datetime.endsWith('20:00:00'));
  A5.push({
    symbol: sym,
    total_bars: bars.length,
    sessions: sessions,
    synthetic_bars: synth.length,
    per_session_avg: (synth.length / sessions).toFixed(2),
    null_volume_bars: nullVol,
    flat_ohlc_bars: flat,
    bars_at_20_00_UTC: at2000.length,
    all_synth_at_2000: synth.every(b => b.datetime.endsWith('20:00:00')),
    identification_rule: 'datetime ends 20:00:00 AND volume === null AND open===high===low===close',
    sample_synth: synth.slice(0, 3),
  });
}

// ── Volume anomalies — bars with 0 volume (not null) or cumulative-volume issues ──
const volumeAnomalies = {};
for (const sym of SAMPLE_5M) {
  const bars = await load(`fixtures/sample-5m/${sym}_5m_2026-06.json`);
  const zeroVol = bars.filter(b => b.volume === 0).length;
  const negVol = bars.filter(b => typeof b.volume === 'number' && b.volume < 0).length;
  volumeAnomalies[sym] = { zero_volume_bars: zeroVol, negative_volume_bars: negVol };
}

// ── A6: earnings table (trailing 24mo) ──
const earningsRaw = await load('fixtures/_recon/R3_earnings_AAPL_NVDA_TSLA_24mo.json');
const futureEarn = await load('fixtures/earnings/AAPL_NVDA_TSLA_future_2026Q3.json');
const A6 = {
  endpoint_top_level_keys: Object.keys(earningsRaw),
  accepts_symbol_list: true,
  bulk_response_bytes: Buffer.byteLength(JSON.stringify(earningsRaw)),
  total_records_24mo: earningsRaw.earnings.length,
  fields: earningsRaw.earnings[0] ? Object.keys(earningsRaw.earnings[0]) : [],
  by_symbol: {},
  scheduled_vs_reported_distinguishable: true,
  scheduled_identification_rule: 'actual === null → scheduled; actual !== null → reported',
  scheduled_sample: futureEarn.earnings,
};
for (const sym of ['AAPL','NVDA','TSLA']) {
  A6.by_symbol[sym] = earningsRaw.earnings
    .filter(e => e.code === `${sym}.US`)
    .map(e => ({
      report_date: e.report_date,
      fiscal_quarter_end: e.date,
      before_after_market: e.before_after_market,
      actual_eps: e.actual,
      estimate_eps: e.estimate,
      surprise_pct: e.percent,
    }));
}

// ── A7: budget arithmetic with measured S ──
const S_CAL_DAYS = 600; // API-enforced max period length
const D = 'whole';       // daily returns whole in one call (R2: 1365 records in 1 call)
const N_36MO_CAL_DAYS = 1095;   // 36 * 30.4
const CALLS_5M_36MO_PER_SYM = Math.ceil(N_36MO_CAL_DAYS / S_CAL_DAYS); // 2
const UNIVERSE = 215;
const FIVE_MIN_UNIVERSE = 212; // 215 minus 3 non-5m context
const N_WARMUP_TOTAL_YRS = 5.2;

const A7 = {
  S_cal_days: S_CAL_DAYS,
  intraday_max_period_source: 'API error message: "Max period length is 600 days"',
  D_daily_span: 'whole in one call (R2 returned 1365 records over 5.4 years)',
  calls_per_5m_symbol_for_36mo: CALLS_5M_36MO_PER_SYM,
  earnings_accepts_symbol_list: true,
  earnings_bulk_call_covers_universe: true,
  rate_limit_headers: {
    'x-ratelimit-limit': 1200,
    interpretation: 'per-minute rolling window; recovered between R1/R2/R3',
  },
  full_refresh_budget: {
    daily_calls: UNIVERSE,
    intraday_calls: FIVE_MIN_UNIVERSE * CALLS_5M_36MO_PER_SYM,
    earnings_calls: 1,
    total: UNIVERSE + FIVE_MIN_UNIVERSE * CALLS_5M_36MO_PER_SYM + 1,
  },
  daily_cap: 100_000,
  budget_verdict: 'PASS',
};

const summary = {
  generated_at: new Date().toISOString(),
  study_start: STUDY_START,
  A1_5m_depth: A1,
  A2_daily_warmup: A2,
  A3_cross_grain: A3,
  A3_split_adjacent_NVDA: {
    split_date: '2024-06-10',
    ratio: '10-for-1',
    comparisons: nvdaSplitComparisons,
    finding: '5m data is UNADJUSTED (raw traded prices). Daily has both raw close and adjusted_close.',
  },
  A4_timestamp_semantics: A4,
  A5_synthetic_bars: A5,
  A5_volume_anomalies: volumeAnomalies,
  A6_earnings: A6,
  A7_api_mechanics: A7,
};
await fs.writeFile('discovery/summary.json', JSON.stringify(summary, null, 2));

// human-readable stdout
console.log('=== A1: 5m depth (36-month edge) ===');
console.log(`All 17 symbols returned data for 2023-06 window: ${A1.every(a => a.verdict_36mo === 'PASS') ? 'PASS' : 'PARTIAL'}`);
console.log('=== A2: daily warmup sessions before 2023-07-10 ===');
for (const a of A2) console.log(`  ${a.symbol.padEnd(6)} ${String(a.sessions_before_study_start).padStart(5)} sessions from ${a.daily_first}  ${a.verdict_550_warmup}${a.shortfall > 0 ? ` (short ${a.shortfall})` : ''}`);
console.log('=== A3: cross-grain invariant (0.1% tolerance) ===');
for (const a of A3) console.log(`  ${a.symbol.padEnd(6)} ${a.within_0_1_pct}/${a.sessions_compared} within tol  ${a.verdict}`);
console.log('=== A3 split-adjacent NVDA 2024-06-10 ===');
for (const c of nvdaSplitComparisons.slice(0, 6)) console.log(`  ${c.date} dailyRaw=${c.daily_close_raw} dailyAdj=${c.daily_adjusted_close} 5m19:55=${c.intraday_last_regular_close} ratio_raw=${c.ratio_intraday_to_dailyRaw}`);
console.log('=== A4: timestamp semantics ===');
console.log(`  gmtoffset always zero: ${A4.gmtoffset_all_zero}`);
console.log(`  bars per day at 20:00 UTC (synthetic): ${A4.bars_at_20_00}`);
console.log(`  bars outside 13:30-20:00 UTC: ${A4.bars_outside_regular_session}`);
console.log(`  first day boundary: ${A4.first_bars_per_day[0].first} → ${A4.first_bars_per_day[0].last} (${A4.first_bars_per_day[0].count} bars)`);
console.log('=== A5: synthetic bars ===');
for (const a of A5) console.log(`  ${a.symbol.padEnd(6)} ${a.synthetic_bars}/${a.sessions} synthetic bars (${a.per_session_avg}/session); all at 20:00 UTC: ${a.all_synth_at_2000}`);
console.log('=== A6: earnings ===');
console.log(`  Top-level fields: ${A6.endpoint_top_level_keys.join(',')}`);
console.log(`  Total 24mo records (3 syms): ${A6.total_records_24mo}`);
console.log(`  Scheduled distinguishable: ${A6.scheduled_vs_reported_distinguishable}`);
console.log('=== A7: budget with measured S=600 cal days ===');
console.log(`  Full-refresh: ${A7.full_refresh_budget.daily_calls} daily + ${A7.full_refresh_budget.intraday_calls} intraday + ${A7.full_refresh_budget.earnings_calls} earnings = ${A7.full_refresh_budget.total} calls (cap ${A7.daily_cap})`);
