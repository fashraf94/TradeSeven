// research/level-study/tools/phase-a-universe-sweep.mjs
//
// LevelStory S5.6 — PHASE A: universe candidates → daily fetch → R2 sweep → SPAC flags → strata.
//
//   node tools/phase-a-universe-sweep.mjs
//
// CHEAP BY DESIGN. Daily-only (~1 call/symbol) + fundamentals (~1 call/symbol). It deliberately
// does NOT fetch 5-minute data: that is Phase B, and it must not be paid for names that fail R2.
//
// Ends in a HARD GATE. This script DECIDES NOTHING. It flags, measures, and reports; the founder
// rules on R2 failures, SPAC suspects, and sector-map disagreements before Phase B runs.
//
// Zero product imports: the candidate list below is a DATA TRANSCRIPTION of
// api/_utils/rankingConfig.js STOCK_UNIVERSE (239 tickers, 11 SPDR sectors), not an import.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';
import { createClient } from '../lib/eodhd-client.js';
import { normalizeDaily } from '../lib/normalize.js';
import { buildSeries } from '../lib/level-series.js';
import { depthEligibilitySweep } from '../lib/depth-eligibility.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY_ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(STUDY_ROOT, 'data', 'phase-a');

// ── §4.1 CANDIDATES — transcribed from api/_utils/rankingConfig.js:15 STOCK_UNIVERSE ─────────
//
// FOUNDER-RULED EXCLUSIONS, applied here (S56-A3):
//   GOOG — dropped, GOOGL kept. Same company, two share classes: they would double-count in peer
//          confirmation, breadth, and the momentum deciles (two rows, one economic entity).
//   DKNG — dropped. De-SPAC (DEAC/SBTech shell). Shell-era bars are not economically DKNG and would
//          poison extension percentiles (504-session trailing) and trend-origin searches. The RKLB lesson.
// → 239 − 2 = 237 candidates.
const PRODUCT_SECTOR_MAP = {
  XLK: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'AMD', 'ADBE', 'CSCO', 'ACN', 'IBM', 'INTC', 'QCOM', 'TXN', 'NOW', 'INTU', 'AMAT', 'MU', 'LRCX', 'KLAC', 'SHOP', 'PLTR', 'SNOW', 'BE', 'CRWV', 'CRWD', 'PANW', 'ZS'],
  XLV: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'PFE', 'AMGN', 'DHR', 'ISRG', 'MDT', 'BMY', 'VRTX', 'SYK', 'GILD', 'CVS', 'ELV', 'CI', 'BSX', 'HUM', 'NVO'],
  XLF: ['BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'SPGI', 'AXP', 'PGR', 'BLK', 'C', 'MMC', 'CB', 'SCHW', 'ICE', 'CME', 'AON', 'USB', 'COIN', 'AFRM', 'HOOD'],
  XLE: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'WMB', 'KMI', 'HES', 'HAL', 'DVN', 'BKR', 'FANG', 'TRGP', 'OKE', 'CTRA'],
  XLY: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'BKNG', 'SBUX', 'TJX', 'ORLY', 'CMG', 'MAR', 'GM', 'F', 'DHI', 'AZO', 'ROST', 'LEN', 'YUM', 'EBAY', 'GME'],
  XLP: ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MDLZ', 'MO', 'CL', 'KMB', 'GIS', 'STZ', 'SYY', 'KHC', 'HSY', 'K', 'KR', 'WBA', 'TSN', 'CAG', 'DG', 'DLTR'],
  XLI: ['GE', 'CAT', 'RTX', 'UNP', 'HON', 'DE', 'BA', 'LMT', 'UPS', 'ADP', 'ETN', 'ITW', 'NOC', 'GD', 'WM', 'CSX', 'NSC', 'MMM', 'EMR', 'FDX', 'GEV', 'RKLB', 'PWR'],
  XLB: ['LIN', 'SHW', 'APD', 'FCX', 'ECL', 'NEM', 'NUE', 'DOW', 'DD', 'CTVA', 'PPG', 'VMC', 'MLM', 'ALB', 'IFF', 'CE', 'CF', 'MOS', 'FMC', 'PKG'],
  XLU: ['NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'PCG', 'EXC', 'XEL', 'PEG', 'ED', 'WEC', 'EIX', 'AWK', 'DTE', 'ETR', 'PPL', 'FE', 'AEE'],
  XLRE: ['PLD', 'AMT', 'EQIX', 'WELL', 'SPG', 'PSA', 'DLR', 'O', 'CCI', 'VICI', 'SBAC', 'AVB', 'EQR', 'WY', 'EXR', 'ARE', 'MAA', 'VTR', 'IRM', 'UDR'],
  XLC: ['META', 'GOOGL', 'NFLX', 'T', 'VZ', 'DIS', 'CMCSA', 'TMUS', 'CHTR', 'EA', 'WBD', 'OMC', 'TTWO', 'LYV', 'IPG', 'MTCH', 'PARA', 'FOXA', 'NWS'],
};
const DROPPED = { GOOG: 'same company as GOOGL (dual share class) — would double-count in peers/breadth/deciles', DKNG: 'de-SPAC (DEAC/SBTech shell) — shell-era bars are not economically DKNG' };

const CANDIDATES = Object.entries(PRODUCT_SECTOR_MAP).flatMap(([etf, syms]) => syms.map((symbol) => ({ symbol, productSector: etf })));

// ── §4.2 EODHD sector → SPDR ETF ─────────────────────────────────────────────────────────────
//
// ⚠ WHICH EODHD FIELD IS AUTHORITATIVE — a load-bearing choice (S56-C1).
//
// EODHD exposes TWO sector taxonomies:
//   General::Sector    → MORNINGSTAR names ("Technology", "Consumer Cyclical", "Basic Materials")
//   General::GicSector → GICS names        ("Information Technology", "Consumer Discretionary", "Materials")
//
// The study's sector features are defined AGAINST THE SPDR SELECT SECTOR ETFs — `rs_vs_sector_*`,
// `sector_rs_vs_spy_*`, `sector_direction_at_touch` (Addendum §A2.2/§A2.3) — and the peer group is
// "the other members of my sector". **The SPDR Select Sector ETFs track GICS.** So a symbol must be
// grouped with the ETF it is ACTUALLY A CONSTITUENT OF, or its RS is measured against a benchmark it
// does not belong to and its peers are the wrong companies.
//
// ⇒ GicSector is authoritative. Morningstar's `Sector` is fetched too, and reported, but NOT used.
//
// This matters concretely. Measured on the 237 candidates, the Morningstar field disagrees with the
// product map on 4 names — and on 3 of them the PRODUCT is right and Morningstar is wrong:
//   ADP  Morningstar=Technology       GICS=Industrials       → XLI  (GICS moved ADP IT→Industrials, 2023)
//   PKG  Morningstar=Consumer Cyclical GICS=Materials        → XLB
//   WBA  Morningstar=Healthcare       GICS=Consumer Staples  → XLP
//   BE   Morningstar=Industrials      GICS=Industrials       → XLI  (the ONE genuine product error: product says XLK)
// Adopting the Morningstar field would have introduced 3 NEW errors to fix 1.
const GICS_SECTOR_TO_SPDR = {
  'Information Technology': 'XLK',
  'Health Care': 'XLV',
  'Financials': 'XLF',
  'Energy': 'XLE',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  'Industrials': 'XLI',
  'Materials': 'XLB',
  'Utilities': 'XLU',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC',
};

const R2_FLOOR = CONFIG.universe.eligibilityMinPreStudySessions; // 550
const AS_OF = CONFIG.universe.eligibilityAsOf;                   // 2023-07-10
const STUDY_START = CONFIG.range.studyStart;
const STUDY_END = CONFIG.range.studyEnd;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const stdev = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

/**
 * §4.5 SPAC / shell-contamination heuristic — FLAG ONLY, never decide.
 *
 * A de-SPAC's pre-merger bars are the SHELL trading at its ~$10 trust value with almost no
 * volatility. Those bars are not economically the company: they flatten extension percentiles (a
 * 504-session trailing window) and corrupt trend-origin searches (252-session lookback). RKLB/DKNG
 * are the cautionary names.
 *
 * Shape we look for: a long INITIAL run of near-$10 closes at unusually low volatility, ending in a
 * volatility regime change. Reported as evidence (mean, stdev, regime-change date, vol ratio) — the
 * founder rules on each. Deliberately conservative: it flags a shape, it does not assert a verdict.
 */
function shellHeuristic(bars) {
  if (bars.length < 60) return null;
  // RAW closes, NOT adjusted. The ~$10 SPAC trust value is a NOMINAL price fact. Adjusted closes are
  // scaled by every subsequent split and dividend, so a de-SPAC that later split 2:1 has its shell
  // era sitting at ~$5 adjusted — outside the band, never flagged, and its shell bars walk straight
  // into the study. (Symmetrically, a mature dividend payer's back-adjusted 2018 closes can drift
  // INTO $8–12 and fabricate a shell.) The band must be tested against the price that actually
  // printed. This is the RKLB/DKNG failure the heuristic exists to prevent, so it must not be
  // defeated by the adjustment basis.
  const closes = bars.map((b) => b.close);
  const dates = bars.map((b) => b.date);

  // The initial run of bars that look like a trust-value shell: price parked near $10, tiny daily moves.
  const NEAR_10 = (p) => p >= 8.0 && p <= 12.0;
  const rets = closes.map((c, i) => (i === 0 ? 0 : Math.abs(c / closes[i - 1] - 1)));
  let prefix = 0;
  for (let i = 0; i < closes.length; i++) {
    if (NEAR_10(closes[i]) && rets[i] < 0.03) prefix++; // <3% daily move while parked at trust value
    else break;
  }
  if (prefix < 30) return null; // no meaningful shell-shaped prefix

  const pre = closes.slice(0, prefix);
  const preRets = rets.slice(1, prefix);
  const post = rets.slice(prefix, Math.min(prefix + 60, rets.length));
  const preVol = stdev(preRets), postVol = stdev(post);
  return {
    prefixSessions: prefix,
    preListingPriceMean: Math.round(mean(pre) * 100) / 100,
    preListingPriceStdev: Math.round(stdev(pre) * 1000) / 1000,
    preListingDailyVolPct: preVol != null ? Math.round(preVol * 10000) / 100 : null,
    postRegimeDailyVolPct: postVol != null ? Math.round(postVol * 10000) / 100 : null,
    volRatio: preVol && postVol ? Math.round((postVol / preVol) * 10) / 10 : null,
    regimeChangeDate: dates[prefix] || null,
    shellEra: `${dates[0]} → ${dates[prefix - 1]}`,
  };
}

/** Median ATR% (ATR14 ÷ close) over the STUDY WINDOW — the axis the tertile strata are cut on. */
function studyAtrPct(bars) {
  let series;
  try { series = buildSeries(bars); } catch { return null; } // adjustment-basis quarantine → no stratum
  const vals = [];
  for (let i = 0; i < series.n; i++) {
    const d = series.dates[i];
    if (d < STUDY_START || d > STUDY_END) continue;
    if (series.atr[i] == null || !series.aClose[i]) continue;
    vals.push((series.atr[i] / series.aClose[i]) * 100);
  }
  return vals.length ? Math.round(median(vals) * 1000) / 1000 : null;
}

async function main() {
  const client = createClient({ log: () => {} });
  const startedAt = new Date().toISOString();
  console.log(`LevelStory S5.6 PHASE A — ${CANDIDATES.length} candidates (239 product − GOOG − DKNG)`);
  console.log(`R2: ≥${R2_FLOOR} daily sessions before ${AS_OF} | daily-only fetch (NO 5m — that is Phase B)\n`);

  const rows = [];
  const failures = [];
  let done = 0;

  for (const c of CANDIDATES) {
    const { symbol, productSector } = c;
    try {
      const rawDaily = await client.fetchDaily(symbol, CONFIG.fetch.dailyFetchStart, STUDY_END);
      const { bars } = normalizeDaily(rawDaily);
      if (!bars.length) throw new Error('EMPTY daily response (HTTP 200 + [] — the silent-failure mode)');

      // A fundamentals FAILURE and "the vendor has no GICS sector for this name" are different facts
      // and must never collapse into the same null. If a transient 429 silently degraded a symbol to
      // "unmapped → fall back to the product sector", the one name the §4.2 cross-check exists to
      // catch (BE, which the product files under XLK) could be waved through with its known-wrong
      // sector — and the hard gate would report zero disagreements for it. Record the failure loudly.
      let fund = null, fundError = null;
      const FIELDS = 'General::Sector,General::GicSector,General::GicIndustry,General::Industry,General::IPODate,General::Type';
      try { fund = await client.fetchFundamentals(symbol, FIELDS); } catch (e) { fundError = e.message; }
      // GICS is authoritative (see GICS_SECTOR_TO_SPDR above): the SPDR sector ETFs track GICS, and
      // every sector feature is measured against those ETFs. Morningstar is carried for the report only.
      const gicsName = fund && fund['General::GicSector'] ? fund['General::GicSector'] : null;
      const eodhdSector = gicsName ? (GICS_SECTOR_TO_SPDR[gicsName] || null) : null;

      rows.push({
        symbol, productSector,
        gicsName, eodhdSector, fundError,
        morningstarName: fund ? fund['General::Sector'] || null : null, // reported, NOT used
        eodhdIndustry: fund ? fund['General::GicIndustry'] || fund['General::Industry'] || null : null,
        eodhdType: fund ? fund['General::Type'] || null : null,
        eodhdIpoDate: fund ? fund['General::IPODate'] || null : null,
        sectorAgrees: eodhdSector != null ? eodhdSector === productSector : null,
        bars,
        atrPct: studyAtrPct(bars),
        shell: shellHeuristic(bars),
      });
    } catch (e) {
      failures.push({ symbol, productSector, error: e.message });
    }
    done += 1;
    if (done % 25 === 0 || done === CANDIDATES.length) process.stdout.write(`  fetched ${done}/${CANDIDATES.length}\n`);
  }

  // ── §4.4 R2 SWEEP (the existing utility — not a re-implementation) ─────────
  const sweep = depthEligibilitySweep(rows.map((r) => ({ symbol: r.symbol, dailyBars: r.bars })));
  const bySym = new Map(sweep.map((s) => [s.symbol, s]));
  for (const r of rows) {
    const s = bySym.get(r.symbol);
    r.r2 = { verdict: s.verdict, preStudySessions: s.preStudySessions, margin: s.margin, firstDailyBar: s.firstDailyBar };
  }

  const pass = rows.filter((r) => r.r2.verdict === 'PASS');
  const fail = rows.filter((r) => r.r2.verdict === 'FAIL');

  // ── §4.6 STRATA — three ATR%-percentile tertiles over the study window ─────
  // Cut on the PASS set only (the FAILs are not in the universe, so they must not shift the edges).
  const atrRanked = pass.filter((r) => r.atrPct != null).sort((a, b) => a.atrPct - b.atrPct);
  const t1 = Math.floor(atrRanked.length / 3), t2 = Math.floor((2 * atrRanked.length) / 3);
  const cut1 = atrRanked[t1] ? atrRanked[t1].atrPct : null;
  const cut2 = atrRanked[t2] ? atrRanked[t2].atrPct : null;
  atrRanked.forEach((r, i) => { r.stratum = i < t1 ? 'LOW_VOL' : i < t2 ? 'MID_VOL' : 'HIGH_VOL'; });
  for (const r of pass) if (!r.stratum) r.stratum = null; // ATR% unavailable → no stratum (reported)

  // ── §4.5 SPAC suspects ────────────────────────────────────────────────────
  // EVERY shell-shaped PASS name is flagged, regardless of listing year. The daily fetch opens at
  // 2018-01-01, so a 2018-listed de-SPAC's shell era is squarely IN RANGE — filtering the flag list
  // by `firstDailyBar >= 2019` would drop such a name from the suspects AND from the informational
  // list, and it would reach the founder's freeze completely unmentioned. The listing-year cutoff is
  // used ONLY to decide which clean names are worth listing informationally.
  const spacSuspects = pass.filter((r) => r.shell);
  const lateListedNoFlag = pass.filter((r) => !r.shell && r.r2.firstDailyBar >= '2019-01-01');

  // ── §4.2 sector-map disagreements ─────────────────────────────────────────
  const disagreements = rows.filter((r) => r.sectorAgrees === false);
  const unmappedSector = rows.filter((r) => r.eodhdSector == null && !r.fundError);
  const fundFailures = rows.filter((r) => r.fundError); // vendor call FAILED — sector UNVERIFIED

  // ── §4.7 per-sector peer counts, POST-R2 (the eligible_peer_count ≥ 5 test) ─
  // Counted on the EODHD-derived (authoritative) sector, which is what the peer layer will use.
  const perSectorPost = {};
  for (const r of pass) {
    const sec = r.eodhdSector || r.productSector;
    perSectorPost[sec] = (perSectorPost[sec] || 0) + 1;
  }
  const MIN_PEERS = CONFIG.features.group.minEligiblePeers; // 5
  const sectorPeerCheck = Object.entries(perSectorPost).map(([sec, n]) => ({
    sector: sec, members: n, peersPerMember: n - 1, meetsFloor: n - 1 >= MIN_PEERS,
  })).sort((a, b) => a.members - b.members);

  // ── Report ─────────────────────────────────────────────────────────────────
  const line = (s) => console.log(s);
  line(`\n════════ §4.4 R2 SWEEP (≥${R2_FLOOR} daily sessions before ${AS_OF}) ════════`);
  line(`  PASS ${pass.length} / FAIL ${fail.length} / fetch-failed ${failures.length}  (of ${CANDIDATES.length} candidates)`);
  line(`\n  FAIL (excluded by R2 — the founder confirms):`);
  for (const r of fail.sort((a, b) => b.r2.preStudySessions - a.r2.preStudySessions)) {
    line(`    ${r.symbol.padEnd(6)} ${String(r.r2.preStudySessions).padStart(4)} sessions (${String(r.r2.margin).padStart(5)}) first bar ${r.r2.firstDailyBar}  [${r.productSector}]`);
  }
  if (failures.length) {
    line(`\n  🔴 FETCH FAILURES (not an R2 verdict — a data problem):`);
    for (const f of failures) line(`    ${f.symbol.padEnd(6)} ${f.error}`);
  }
  const thin = pass.filter((r) => r.r2.margin < 100).sort((a, b) => a.r2.margin - b.r2.margin);
  line(`\n  Thinnest PASS margins (closest to the floor):`);
  for (const r of thin.slice(0, 10)) line(`    ${r.symbol.padEnd(6)} ${String(r.r2.preStudySessions).padStart(4)} sessions (+${r.r2.margin}) first bar ${r.r2.firstDailyBar}`);

  line(`\n════════ §4.5 SPAC / SHELL-CONTAMINATION FLAGS (flag only — founder rules each) ════════`);
  if (!spacSuspects.length) line('  none flagged among R2-PASS names listed after 2019-01-01');
  for (const r of spacSuspects) {
    const s = r.shell;
    line(`  🚩 ${r.symbol} [${r.productSector}] IPODate=${r.eodhdIpoDate || 'n/a'} firstBar=${r.r2.firstDailyBar}`);
    line(`       shell-era ${s.shellEra} (${s.prefixSessions} sessions): price mean $${s.preListingPriceMean} stdev $${s.preListingPriceStdev}`);
    line(`       daily vol ${s.preListingDailyVolPct}% → ${s.postRegimeDailyVolPct}% (×${s.volRatio}) — regime change ${s.regimeChangeDate}`);
  }
  if (lateListedNoFlag.length) {
    line(`\n  Listed ≥2019 but NO shell shape detected (clean IPO/direct listing — informational):`);
    line(`    ${lateListedNoFlag.map((r) => `${r.symbol}(${r.r2.firstDailyBar})`).join(', ')}`);
  }

  line(`\n════════ §4.2 SECTOR MAP — EODHD GICS (authoritative) vs PRODUCT ════════`);
  line(`  agree ${rows.filter((r) => r.sectorAgrees === true).length} / disagree ${disagreements.length} / unmapped ${unmappedSector.length}`);
  line(`  (GICS is authoritative because the SPDR sector ETFs track GICS — see GICS_SECTOR_TO_SPDR)`);
  if (disagreements.length) {
    line(`\n  DISAGREEMENTS (GICS wins unless the founder overrides the specific name):`);
    for (const r of disagreements.sort((a, b) => (a.productSector < b.productSector ? -1 : 1))) {
      line(`    ${r.symbol.padEnd(6)} product=${r.productSector.padEnd(5)} GICS=${String(r.eodhdSector).padEnd(5)} (${r.gicsName} / ${r.eodhdIndustry})  R2=${r.r2.verdict}`);
    }
  }
  // Where Morningstar would have DISAGREED with GICS — the reason GicSector is the field we trust.
  const msDisagree = rows.filter((r) => r.morningstarName && r.gicsName && r.morningstarName !== r.gicsName
    && GICS_SECTOR_TO_SPDR[r.gicsName] !== ({ Technology: 'XLK', Healthcare: 'XLV', 'Financial Services': 'XLF', Energy: 'XLE', 'Consumer Cyclical': 'XLY', 'Consumer Defensive': 'XLP', Industrials: 'XLI', 'Basic Materials': 'XLB', Utilities: 'XLU', 'Real Estate': 'XLRE', 'Communication Services': 'XLC' }[r.morningstarName]));
  if (msDisagree.length) {
    line(`\n  ⚠ Names where MORNINGSTAR (EODHD General::Sector) would have mapped differently than GICS —`);
    line(`    i.e. what we would have broken by trusting the wrong EODHD field:`);
    for (const r of msDisagree) {
      line(`    ${r.symbol.padEnd(6)} GICS=${String(r.eodhdSector).padEnd(5)} (${r.gicsName})  vs Morningstar="${r.morningstarName}"  [product=${r.productSector}]`);
    }
  }
  if (unmappedSector.length) {
    line(`\n  ⚠ UNMAPPED GICS sector (vendor returned no GicSector — fell back to the product map):`);
    for (const r of unmappedSector) line(`    ${r.symbol.padEnd(6)} product=${r.productSector} GICS-name=${JSON.stringify(r.gicsName)}`);
  }
  if (fundFailures.length) {
    // NOT the same as "unmapped". The vendor call FAILED, so this symbol's sector was never checked
    // at all — it is silently sitting on the unverified product sector. Must be loud.
    line(`\n  🔴 FUNDAMENTALS FETCH FAILED — sector UNVERIFIED, still on the product map (re-run before freezing):`);
    for (const r of fundFailures) line(`    ${r.symbol.padEnd(6)} product=${r.productSector} (unverified) — ${r.fundError}`);
  }

  line(`\n════════ §4.6 STRATA — ATR% tertiles over the study window (mechanical) ════════`);
  line(`  cut points: LOW_VOL < ${cut1}% ≤ MID_VOL < ${cut2}% ≤ HIGH_VOL   (median ATR14/close, ${STUDY_START}→${STUDY_END})`);
  for (const s of ['LOW_VOL', 'MID_VOL', 'HIGH_VOL']) {
    const m = pass.filter((r) => r.stratum === s);
    const a = m.map((r) => r.atrPct);
    line(`    ${s.padEnd(9)} n=${String(m.length).padStart(3)}  ATR% ${a.length ? `${Math.min(...a)}–${Math.max(...a)}` : 'n/a'}`);
  }
  const noStratum = pass.filter((r) => r.stratum == null);
  if (noStratum.length) line(`    ⚠ no stratum (ATR% unavailable): ${noStratum.map((r) => r.symbol).join(', ')}`);

  line(`\n════════ §4.7 PER-SECTOR PEER COUNTS, POST-R2 (floor: eligible_peer_count ≥ ${MIN_PEERS}) ════════`);
  for (const s of sectorPeerCheck) {
    line(`    ${s.sector.padEnd(5)} members=${String(s.members).padStart(3)}  peers/member=${String(s.peersPerMember).padStart(3)}  ${s.meetsFloor ? '✅' : '🔴 BELOW FLOOR'}`);
  }
  const allMeet = sectorPeerCheck.every((s) => s.meetsFloor);
  line(`\n  ⇒ ${allMeet ? '✅ every sector clears the peer floor — Addendum Layer 1 switches ON universe-wide' : '🔴 a sector is below the peer floor — peer features stay null there'}`);

  // ── Artifact ───────────────────────────────────────────────────────────────
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const doc = {
    session: 'LevelStory S5.6 Phase A — universe candidates, R2 sweep, SPAC flags, strata',
    startedAt, finishedAt: new Date().toISOString(),
    configVersion: CONFIG.version,
    droppedBeforeSweep: DROPPED,
    candidateCount: CANDIDATES.length,
    r2: { floor: R2_FLOOR, asOf: AS_OF, pass: pass.length, fail: fail.length, fetchFailed: failures.length },
    strata: { rule: 'ATR% (median ATR14/close over the study window) tertiles, cut on the R2-PASS set', cut1, cut2 },
    sectorPeerCheck, minEligiblePeers: MIN_PEERS,
    sectorSource: 'EODHD General::GicSector (GICS) — the SPDR sector ETFs track GICS, and every sector feature is measured against those ETFs. EODHD General::Sector (Morningstar) is recorded but NOT used.',
    sectorDisagreements: disagreements.map((r) => ({ symbol: r.symbol, product: r.productSector, gics: r.eodhdSector, gicsName: r.gicsName, morningstarName: r.morningstarName, industry: r.eodhdIndustry, r2: r.r2.verdict })),
    spacSuspects: spacSuspects.map((r) => ({ symbol: r.symbol, ipoDate: r.eodhdIpoDate, firstDailyBar: r.r2.firstDailyBar, ...r.shell })),
    fetchFailures: failures,
    fundamentalsFailures: fundFailures.map((r) => ({ symbol: r.symbol, productSector: r.productSector, error: r.fundError, sectorVerified: false })),
    symbols: rows.map((r) => ({
      symbol: r.symbol, productSector: r.productSector, eodhdSector: r.eodhdSector, gicsName: r.gicsName, morningstarName: r.morningstarName,
      eodhdIndustry: r.eodhdIndustry, eodhdType: r.eodhdType, eodhdIpoDate: r.eodhdIpoDate, sectorAgrees: r.sectorAgrees,
      r2: r.r2, atrPct: r.atrPct, stratum: r.stratum || null, shell: r.shell || null,
    })).sort((a, b) => (a.symbol < b.symbol ? -1 : 1)),
  };
  const outPath = path.join(OUT_DIR, 'phase_a_sweep.json');
  await fsp.writeFile(outPath, JSON.stringify(doc, null, 2));

  const calls = client.getManifest().filter((m) => !m.fromCache).length;
  line(`\n════════ COST ════════`);
  line(`  network calls this run: ${calls} (daily + fundamentals; cached calls reused)`);
  line(`  artifact → ${path.relative(STUDY_ROOT, outPath)}`);
  line(`\n⛔ HARD GATE — Phase B (5-min fetch + rebuild) does NOT run without founder rulings on:`);
  line(`   (1) the ${fail.length} R2 failures  (2) the ${spacSuspects.length} SPAC suspects  (3) the ${disagreements.length} sector-map disagreements  (4) the final frozen list`);
  if (fundFailures.length || failures.length) {
    line(`\n   🔴 AND FIRST: ${failures.length} daily-fetch failure(s) + ${fundFailures.length} fundamentals failure(s) must be re-run.`);
    line(`      A symbol whose fundamentals call failed has an UNVERIFIED sector — do not freeze the universe until it is clean.`);
  }
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
