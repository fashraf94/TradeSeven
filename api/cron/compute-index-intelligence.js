// api/cron/compute-index-intelligence.js
// Cron: computes index-level market intelligence + per-stock RS & Technical Scores.
//
// Pre-market baseline: "30 10,11 * * 1-5" (dual UTC hours for DST), ~6:30 AM ET.
// Intraday recompute: "0 14-20 * * 1-5" via ?mode=intraday — re-runs the SAME
//   pipeline hourly during RTH, but first splices each symbol's live price onto
//   its bars (see injectIntradayBar) so the cross-sectional ranks + baggerBombFit
//   reflect the current session. Without a quote, a symbol falls back to its
//   prior close, so an intraday run with no quotes == the pre-market baseline.
// Idempotent — running twice overwrites the same Firestore docs.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  calculateSMA,
  calculateRSI,
  calculateRSISeries,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  calculateNR7,
  calculateVolumeProfile,
  calculatePivotLevels,
  classifyTrend,
} from '../_utils/technicalCalculations.js';
import {
  findSwingHighsLows,
  findNearestLevels,
  detectRSIDivergence,
  detectCandlePattern,
} from '../_utils/analyticalPrimitives.js';
import {
  classifyRegime,
  detectLeadership,
  detectDivergence,
  computeBreadthQuality,
  classifyYieldRegime,
  computeRS,
  computeRSTrend,
  computeTechnicalScore,
} from '../_utils/indexIntelligence.js';
import { STOCK_UNIVERSE, ALL_TICKERS, TICKER_TO_SECTOR, TICKER_TO_INDUSTRY, TECHNICAL_FACTOR_WEIGHTS } from '../_utils/rankingConfig.js';
import { computeGameModeFits, assignGameModeRanks } from '../_utils/gameModeScoring.js';
import { computeMomentumRankings } from '../_utils/momentumScoring.js';
import { computeArchetypeRankings } from '../_utils/archetypeScoring.js';
import { computeReturns } from '../_utils/returnCalculations.js';

const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

export const config = { maxDuration: 300 };

const LOG_PREFIX = '[IndexIntelligence]';
const EODHD_API_KEY = process.env.EODHD_API_KEY;

const INDEX_SYMBOLS = [
  { symbol: 'SPY', eodhd: 'SPY.US', name: 'S&P 500' },
  { symbol: 'QQQ', eodhd: 'QQQ.US', name: 'Nasdaq 100' },
  { symbol: 'DIA', eodhd: 'DIA.US', name: 'Dow Jones' },
  { symbol: 'IWM', eodhd: 'IWM.US', name: 'Russell 2000' },
  { symbol: 'RSP', eodhd: 'RSP.US', name: 'S&P 500 Equal Weight' },
];

const SECTOR_ETFS = Object.entries(STOCK_UNIVERSE).map(([id, s]) => ({
  id, name: s.name, etf: s.etf, eodhd: s.etf + '.US',
}));

// ───────────────────────────────────────────────
// Intraday recompute state
// ───────────────────────────────────────────────
// In intraday mode (?mode=intraday) the cron refreshes the universe's
// price-derived dimensions by splicing today's live price onto each symbol's
// bars before the (unchanged) scoring pipeline runs — so the cross-sectional
// RS / sector-RS / ATR / momentum percentiles, and the baggerBombFit derived
// from them, stay valid intraday instead of reflecting yesterday's close.
// Map<eodhdSymbol, quote>; null in pre-market mode. Reset every invocation for
// warm-container safety.
let intradayQuotes = null;

// ───────────────────────────────────────────────
// Logging
// ───────────────────────────────────────────────

function log(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

// ───────────────────────────────────────────────
// Firebase Admin
// ───────────────────────────────────────────────

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ───────────────────────────────────────────────
// EODHD Fetching
// ───────────────────────────────────────────────

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function fetchOHLCV(eohdSymbol, daysBack = 252) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - Math.ceil(daysBack * 1.5)); // overshoot for weekends/holidays
  const url = `https://eodhd.com/api/eod/${eohdSymbol}?period=d&from=${formatDate(fromDate)}&fmt=json&api_token=${EODHD_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EODHD ${eohdSymbol}: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`EODHD ${eohdSymbol}: empty response`);
  }

  // EODHD returns oldest-first. Reverse to newest-first for our calculations.
  const ohlcv = data.reverse().map(d => ({
    date: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.adjusted_close,
    volume: d.volume || 0,
  }));

  // Intraday mode: splice today's live price onto the front so downstream
  // technicals/RS/momentum reflect the current session. No-op (returns the EOD
  // array) for any symbol without a fresh quote — including TNX, which is never
  // quoted here — so pre-market runs are byte-for-byte unchanged. The lookup is
  // canonicalized so it hits whether EODHD returned "AAPL" or "AAPL.US".
  if (intradayQuotes) {
    const quote = intradayQuotes.get(canonicalRtKey(eohdSymbol));
    if (quote) return injectIntradayBar(ohlcv, quote, formatDate(new Date()));
  }
  return ohlcv;
}

async function fetchBatch(symbols, batchSize = 10, delayMs = 500) {
  const results = {};
  const errors = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (sym) => {
      const eohdSym = sym.replace(/\./g, '-') + '.US';
      try {
        const data = await fetchOHLCV(eohdSym);
        results[sym] = data;
      } catch (err) {
        errors.push({ symbol: sym, error: err.message });
        log(`⚠ Failed to fetch ${sym}: ${err.message}`);
      }
    });
    await Promise.all(promises);

    // Rate-limit delay between batches (skip after last batch)
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return { results, errors };
}

// ───────────────────────────────────────────────
// Intraday price injection
// ───────────────────────────────────────────────

function toNum(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonical key for matching EODHD real-time `code` (which may come back as
 * "AAPL" or "AAPL.US") against our requested "TICKER.US" symbols. Uppercases and
 * strips ONLY the trailing .US exchange suffix — applied symmetrically on both
 * sides (map build + lookup), so injection hits regardless of which shape EODHD
 * returns. Never collapses two distinct tickers: the class-share dash in e.g.
 * "BRK-B" is preserved, and non-US codes like "TNX.INDX" are left intact (so TNX
 * stays unquoted).
 */
export function canonicalRtKey(sym) {
  return String(sym).toUpperCase().replace(/\.US$/, '');
}

/**
 * Splice today's live price onto a newest-first OHLCV array as a synthetic
 * index-0 bar, so downstream technicals/RS/momentum reflect the current
 * session rather than yesterday's close. Pure + deterministic for unit testing.
 *
 * Volume is deliberately NEUTRALIZED to the trailing average: a partial-day
 * bar's cumulative volume would otherwise manufacture a fake volume drought in
 * volumeRatio / the volume profile. Intraday refresh is about price, not volume.
 *
 * Dedup: if the EOD feed already returned today's bar (e.g. just after close),
 * replace index 0 rather than prepend, to avoid a duplicate session.
 *
 * Returns the original array unchanged when the quote carries no usable price.
 */
export function injectIntradayBar(ohlcv, quote, todayStr) {
  if (!Array.isArray(ohlcv) || ohlcv.length === 0) return ohlcv;
  const price = quote ? toNum(quote.close) : null;
  if (price === null || price <= 0) return ohlcv;

  const prev = ohlcv[0];
  const lookback = ohlcv.slice(0, Math.min(30, ohlcv.length));
  const avgVol = Math.round(
    lookback.reduce((a, d) => a + (d.volume || 0), 0) / lookback.length
  );

  const qOpen = toNum(quote.open);
  const qHigh = toNum(quote.high);
  const qLow = toNum(quote.low);
  const todayBar = {
    date: todayStr,
    open: qOpen !== null && qOpen > 0 ? qOpen : prev.close,
    high: Math.max(qHigh !== null && qHigh > 0 ? qHigh : price, price),
    low: Math.min(qLow !== null && qLow > 0 ? qLow : price, price),
    close: price,
    volume: avgVol,
  };

  return prev.date === todayStr
    ? [todayBar, ...ohlcv.slice(1)]
    : [todayBar, ...ohlcv];
}

/**
 * Batched EODHD real-time quotes for intraday injection. Uses the multi-symbol
 * real-time endpoint (first symbol in the path, the rest via &s=) to collapse
 * the ~255-symbol universe into a handful of calls. Best-effort: any symbol
 * without a quote simply keeps its prior close (no worse than the pre-market
 * baseline). Returns Map<eodhdSymbol, { close, open, high, low, previousClose }>.
 */
async function fetchRealtimeQuotes(eodhdSymbols, batchSize = 20, delayMs = 300) {
  const quotes = new Map();

  for (let i = 0; i < eodhdSymbols.length; i += batchSize) {
    const group = eodhdSymbols.slice(i, i + batchSize);
    const [first, ...rest] = group;
    const sParam = rest.length ? `&s=${rest.join(',')}` : '';
    const url = `https://eodhd.com/api/real-time/${first}?api_token=${EODHD_API_KEY}&fmt=json${sParam}`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const arr = Array.isArray(data) ? data : [data];
        for (const q of arr) {
          if (!q) continue;
          // Single-symbol responses may omit `code`; fall back to the requested symbol.
          const code = q.code || (arr.length === 1 ? first : null);
          if (!code) continue;
          quotes.set(canonicalRtKey(code), {
            close: toNum(q.close),
            open: toNum(q.open),
            high: toNum(q.high),
            low: toNum(q.low),
            previousClose: toNum(q.previousClose),
          });
        }
      } else {
        log(`⚠ Real-time batch HTTP ${response.status} for ${group.length} symbols`);
      }
    } catch (err) {
      log(`⚠ Real-time batch failed: ${err.message}`);
    }

    if (i + batchSize < eodhdSymbols.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return quotes;
}

// ───────────────────────────────────────────────
// Per-Index Technical Computation
// ───────────────────────────────────────────────

function computeIndexTechnicals(ohlcv, name) {
  const closes = ohlcv.map(d => d.close);
  const highs = ohlcv.map(d => d.high);
  const lows = ohlcv.map(d => d.low);
  const volumes = ohlcv.map(d => d.volume);

  const currentPrice = closes[0];
  const prevClose = closes.length > 1 ? closes[1] : currentPrice;
  const change = currentPrice - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  // Moving averages with position info
  const sma20Val = calculateSMA(closes, 20);
  const sma50Val = calculateSMA(closes, 50);
  const sma200Val = calculateSMA(closes, 200);

  function smaInfo(smaVal) {
    if (smaVal === null) return { value: null, position: 'unknown', distance: 0 };
    const dist = ((currentPrice - smaVal) / smaVal) * 100;
    return {
      value: Number(smaVal.toFixed(2)),
      position: currentPrice > smaVal ? 'above' : 'below',
      distance: Number(dist.toFixed(2)),
    };
  }

  // RSI
  const rsi = calculateRSI(closes, 14);

  // MACD with signal classification
  const macd = calculateMACD(closes, 12, 26, 9);
  let macdSignal = 'neutral';
  if (macd) {
    if (macd.histogram > 0 && macd.macd > macd.signal) macdSignal = 'bullish_cross';
    else if (macd.histogram < 0 && macd.macd < macd.signal) macdSignal = 'bearish_cross';
    else macdSignal = 'converging';
  }

  // ATR
  const atr = calculateATR(highs, lows, closes, 14);

  // Volume ratio: last day vs avg last 30 days
  let volumeRatio = null;
  if (volumes.length > 30 && volumes[0] > 0) {
    const avgVol30 = volumes.slice(1, 31).reduce((a, b) => a + b, 0) / 30;
    volumeRatio = avgVol30 > 0 ? Number((volumes[0] / avgVol30).toFixed(2)) : null;
  }

  // 52-week range (252 trading days)
  const tradingDays = Math.min(252, closes.length);
  const range252 = closes.slice(0, tradingDays);
  const high252 = Math.max(...highs.slice(0, tradingDays));
  const low252 = Math.min(...lows.slice(0, tradingDays));
  const rangePosition = high252 !== low252 ? ((currentPrice - low252) / (high252 - low252)) * 100 : 50;

  // YTD return
  const currentYear = new Date().getFullYear();
  let ytdReturn = null;
  for (let i = ohlcv.length - 1; i >= 0; i--) {
    if (ohlcv[i].date && ohlcv[i].date.startsWith(String(currentYear))) {
      const yearStart = ohlcv[i].close;
      ytdReturn = yearStart > 0 ? Number(((currentPrice - yearStart) / yearStart * 100).toFixed(2)) : null;
      break;
    }
  }

  return {
    name,
    price: Number(currentPrice.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    ytdReturn,
    sma20: smaInfo(sma20Val),
    sma50: smaInfo(sma50Val),
    sma200: smaInfo(sma200Val),
    rsi: rsi || { value: null, zone: 'unknown' },
    macd: macd ? { signal: macdSignal, histogram: macd.histogram } : { signal: 'unknown', histogram: 0 },
    atr: atr || { value: null, regime: 'unknown' },
    volumeRatio,
    range52w: {
      low: Number(low252.toFixed(2)),
      high: Number(high252.toFixed(2)),
      position: Number(rangePosition.toFixed(1)),
    },
  };
}

// ───────────────────────────────────────────────
// Industry rollup (Phase 2)
// ───────────────────────────────────────────────

// Minimum members for an industry to be ranked / rolled up. One global knob
// (trivially bumpable to 5). Used for both the inclusion gate and the per-metric
// non-null-count gate.
export const MIN_INDUSTRY_SIZE = 4;

// Null-safe median — mirrors api/cron/compute-rankings.js:97 (sorted, upper-middle
// element, null on empty). Callers pass only finite numbers.
function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Metrics aggregated per industry — the PR #468 realized returns + momentumScore.
const ROLLUP_METRICS = ['return1W', 'return1M', 'return3M', 'returnYTD', 'return12M', 'momentumScore'];

// Build the per-industry rollup from the already-assembled rankingStocks (which carry
// industryName + the return/momentum fields). Pure + exported for unit testing. Groups by
// industryName (skipping null industry), includes an industry only when it has >= minSize
// members, and stores the MEDIAN of each metric over the members with a non-null value for
// it — null when fewer than minSize members do, so a thin-history horizon won't rank.
// Median is robust to a single outlier; a mean would be skewed by one rocket.
export function buildIndustriesRollup(rankingStocks, minSize = MIN_INDUSTRY_SIZE) {
  const groups = {};
  for (const stock of Array.isArray(rankingStocks) ? rankingStocks : []) {
    const name = stock?.industryName;
    if (!name) continue;
    if (!groups[name]) groups[name] = [];
    groups[name].push(stock);
  }

  const industries = {};
  for (const [name, members] of Object.entries(groups)) {
    if (members.length < minSize) continue; // inclusion gate
    const entry = { name, stocks: members.map(s => s.symbol), totalStocks: members.length };
    for (const metric of ROLLUP_METRICS) {
      const vals = members.map(s => s[metric]).filter(v => typeof v === 'number' && Number.isFinite(v));
      entry[metric] = vals.length >= minSize ? median(vals) : null; // per-metric non-null gate
    }
    industries[name] = entry;
  }
  return industries;
}

// ───────────────────────────────────────────────
// Main Handler
// ───────────────────────────────────────────────

export default async function handler(req, res) {
  // Step 1 — Auth Check
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers['authorization'];
  const isSecretAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isSecretAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const errors = [];
  const intraday = req.query?.mode === 'intraday' || req.headers['x-recompute-mode'] === 'intraday';
  // Reset module-level intraday state every invocation (warm-container safety).
  intradayQuotes = null;
  log(`Starting index intelligence computation... (mode=${intraday ? 'intraday' : 'premarket'})`);

  try {
    const db = getFirebaseAdmin();

    // Intraday mode: fetch live quotes for the WHOLE universe up-front so
    // fetchOHLCV can splice today's price onto each symbol's bars. The
    // cross-sectional ranks only stay coherent if every symbol (stocks +
    // indices + sector ETFs) is refreshed together, so we quote them all.
    if (intraday) {
      const rtSymbols = [
        ...INDEX_SYMBOLS.map(i => i.eodhd),
        ...SECTOR_ETFS.map(s => s.eodhd),
        ...ALL_TICKERS.map(t => t.replace(/\./g, '-') + '.US'),
      ];
      log(`Intraday: fetching real-time quotes for ${rtSymbols.length} symbols...`);
      intradayQuotes = await fetchRealtimeQuotes(rtSymbols);
      log(`  ✓ Got ${intradayQuotes.size}/${rtSymbols.length} real-time quotes`);
      if (intradayQuotes.size === 0) {
        errors.push({ stage: 'intraday-quotes', error: 'no real-time quotes; falling back to prior-close bars' });
      }
    }

    // Step 2 — Fetch Index OHLCV + TNX + Sector ETFs in parallel
    log('Step 2: Fetching index, TNX, and sector ETF data in parallel...');
    const indexData = {};
    let tnxData = null;
    const sectorSnapshot = [];

    const allResults = await Promise.allSettled([
      ...INDEX_SYMBOLS.map(idx =>
        fetchOHLCV(idx.eodhd).then(data => ({ type: 'index', symbol: idx.symbol, data }))
      ),
      fetchOHLCV('TNX.INDX', 30).then(data => ({ type: 'tnx', data })),
      ...SECTOR_ETFS.map(sec =>
        fetchOHLCV(sec.eodhd, 50).then(data => ({ type: 'sector', sec, data }))
      ),
    ]);

    // Sector ETF close data for Sector-Relative Strength computation
    const sectorETFCloses = {}; // { sectorId: number[] (closes, newest first) }

    // Process all results (indexes, TNX, sectors)
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        const { type, symbol, sec, data } = result.value;
        if (type === 'index') {
          indexData[symbol] = data;
          log(`  ✓ ${symbol}: ${data.length} days`);
        } else if (type === 'tnx') {
          tnxData = data;
          log(`  ✓ TNX: ${data.length} days`);
        } else if (type === 'sector' && data.length >= 2) {
          // Store sector ETF closes for Sector RS computation
          sectorETFCloses[sec.id] = data.map(d => d.close);
          const todayClose = data[0].close;
          const prevClose = data[1].close;
          const changePercent = ((todayClose - prevClose) / prevClose) * 100;
          const weekIdx = Math.min(5, data.length - 1);
          const weekChange = ((todayClose - data[weekIdx].close) / data[weekIdx].close) * 100;
          const monthIdx = Math.min(21, data.length - 1);
          const monthChange = ((todayClose - data[monthIdx].close) / data[monthIdx].close) * 100;
          sectorSnapshot.push({
            sector: sec.name,
            etf: sec.etf,
            changePercent: Math.round(changePercent * 100) / 100,
            weekChange: Math.round(weekChange * 100) / 100,
            monthChange: Math.round(monthChange * 100) / 100,
          });
        }
      } else {
        // Extract symbol from the rejection for error logging
        const errMsg = result.reason?.message || 'Unknown error';
        errors.push({ error: errMsg });
        log(`  ✗ Fetch failed: ${errMsg}`);
      }
    }
    sectorSnapshot.sort((a, b) => b.changePercent - a.changePercent);
    log(`  ✓ Indexes: ${Object.keys(indexData).length}/5, TNX: ${tnxData ? 'yes' : 'no'}, Sectors: ${sectorSnapshot.length}/11`);

    // Step 3 — Compute Per-Index Technicals
    log('Step 3: Computing per-index technicals...');
    const indexTechnicals = {};
    for (const idx of INDEX_SYMBOLS) {
      if (!indexData[idx.symbol]) continue;
      indexTechnicals[idx.symbol] = computeIndexTechnicals(indexData[idx.symbol], idx.name);
      indexTechnicals[idx.symbol].symbol = idx.symbol;
    }

    // Step 4 — Compute Higher-Order Intelligence
    log('Step 4: Computing higher-order market intelligence...');
    const spyT = indexTechnicals.SPY;
    const qqqT = indexTechnicals.QQQ;
    const diaT = indexTechnicals.DIA;
    const iwmT = indexTechnicals.IWM;
    const rspT = indexTechnicals.RSP;

    let regime = { regime: 'unknown', regimeDetail: 'Insufficient data' };
    if (spyT && spyT.sma50.value && spyT.sma200.value) {
      regime = classifyRegime(spyT.price, spyT.sma50.value, spyT.sma200.value);
    }

    const spyChg = spyT?.changePercent || 0;
    const qqqChg = qqqT?.changePercent || 0;
    const diaChg = diaT?.changePercent || 0;
    const iwmChg = iwmT?.changePercent || 0;
    const rspChg = rspT?.changePercent || 0;

    const leadership = detectLeadership(spyChg, qqqChg, diaChg, iwmChg);
    const divergence = detectDivergence(spyChg, qqqChg, diaChg, iwmChg);
    const breadthQuality = computeBreadthQuality(spyChg, rspChg);

    let yields = { tnx: null, tnxChange: 0, regime: 'unknown', detail: 'TNX data unavailable' };
    if (tnxData && tnxData.length >= 2) {
      yields = classifyYieldRegime(tnxData[0].close, tnxData[1].close);
    }

    // Volatility regime from SPY ATR
    const volatilityRegime = spyT?.atr?.regime || 'unknown';

    // Breadth composite (simple scoring: 0-100)
    let breadthComposite = 50;
    if (spyT) {
      let score = 50;
      if (regime.regime === 'bull') score += 15;
      else if (regime.regime === 'correction') score -= 10;
      else if (regime.regime === 'bear') score -= 25;
      if (breadthQuality.signal === 'broad_participation') score += 15;
      else if (breadthQuality.signal === 'narrow_leadership') score -= 10;
      else if (breadthQuality.signal === 'divergent') score -= 15;
      if (leadership === 'broad_rally') score += 10;
      else if (leadership === 'broad_selloff') score -= 10;
      if (!divergence.active) score += 5;
      breadthComposite = Math.max(0, Math.min(100, score));
    }

    let breadthTier;
    if (breadthComposite >= 70) breadthTier = 'healthy';
    else if (breadthComposite >= 50) breadthTier = 'moderate';
    else if (breadthComposite >= 30) breadthTier = 'thinning';
    else breadthTier = 'weak';

    // Step 5 — Compute RS + Technical Scores for full stock universe
    log(`Step 5: Fetching OHLCV for ${ALL_TICKERS.length} stocks...`);
    let stockScores = [];
    let stocksProcessed = 0;
    const momentumMap = new Map();
    const returnsMap = new Map();

    const spyCloses = indexData.SPY ? indexData.SPY.map(d => d.close) : null;

    if (!spyCloses || spyCloses.length < 50) {
      log('⚠ SPY has insufficient data (<50 days). Skipping RS computation.');
      errors.push({ symbol: 'RS_COMPUTATION', error: 'SPY insufficient data — need 50+ days' });
    } else {
      const { results: stockOHLCV, errors: stockErrors } = await fetchBatch(ALL_TICKERS, 10, 500);
      errors.push(...stockErrors);
      log(`  Fetched ${Object.keys(stockOHLCV).length}/${ALL_TICKERS.length} stocks`);

      // Compute RS20 change for all stocks (for percentile ranking)
      log('  Computing RS + Technical Scores...');
      const rsData = [];
      for (const sym of ALL_TICKERS) {
        const ohlcv = stockOHLCV[sym];
        if (!ohlcv || ohlcv.length < 50) continue;

        const closes = ohlcv.map(d => d.close);
        const rs20 = computeRS(closes, spyCloses, 20);
        const rs50 = computeRS(closes, spyCloses, 50);
        const { trend: rsTrend, slope: rsTrendSlope } = computeRSTrend(closes, spyCloses, 10);

        rsData.push({ sym, ohlcv, closes, rs20, rs50, rsTrend, rsTrendSlope });
      }

      // Sort by RS20 change to compute percentiles
      const sortedByRS = [...rsData]
        .filter(d => d.rs20)
        .sort((a, b) => (a.rs20.change) - (b.rs20.change));

      const rsPercentileMap = {};
      sortedByRS.forEach((d, idx) => {
        rsPercentileMap[d.sym] = Math.round((idx / Math.max(sortedByRS.length - 1, 1)) * 100);
      });

      // Compute Sector RS for each stock (RS of stock vs its sector ETF)
      // Group by sector, compute RS, then compute percentile within each sector
      const sectorRSMap = {}; // sym → sectorRSPercentile
      const sectorRSGroups = {}; // sectorId → [{ sym, rsChange }]
      for (const d of rsData) {
        const sectorId = TICKER_TO_SECTOR[d.sym];
        if (!sectorId || !sectorETFCloses[sectorId] || sectorETFCloses[sectorId].length < 22) continue;
        const etfCloses = sectorETFCloses[sectorId];
        const sectorRS = computeRS(d.closes, etfCloses, 20);
        if (sectorRS) {
          if (!sectorRSGroups[sectorId]) sectorRSGroups[sectorId] = [];
          sectorRSGroups[sectorId].push({ sym: d.sym, rsChange: sectorRS.change });
        }
      }
      // Compute percentile ranks within each sector
      for (const [, group] of Object.entries(sectorRSGroups)) {
        group.sort((a, b) => a.rsChange - b.rsChange);
        group.forEach((item, idx) => {
          sectorRSMap[item.sym] = Math.round((idx / Math.max(group.length - 1, 1)) * 100);
        });
      }

      // Compute full technical score for each stock
      for (const d of rsData) {
        const closes = d.closes;
        const highs = d.ohlcv.map(o => o.high);
        const lows = d.ohlcv.map(o => o.low);
        const opens = d.ohlcv.map(o => o.open);
        const volumes = d.ohlcv.map(o => o.volume);

        const sma20 = calculateSMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const rsi = calculateRSI(closes, 14);

        // MACD computation (NEW) — uses existing calculateMACD
        const macdResult = calculateMACD(closes);
        let macdEnhanced = null;
        if (macdResult) {
          // Compute previous histogram for expansion detection
          // We need to compute MACD for closes[1:] to get the prior bar's histogram
          const prevCloses = closes.slice(1);
          const prevMacd = prevCloses.length >= 26 ? calculateMACD(prevCloses) : null;

          // Detect fresh crossovers by comparing current vs previous signal relationship
          let freshBullishCross = false;
          let freshBearishCross = false;
          if (prevMacd) {
            const nowAbove = macdResult.macd > macdResult.signal;
            const prevAbove = prevMacd.macd > prevMacd.signal;
            if (nowAbove && !prevAbove) freshBullishCross = true;
            if (!nowAbove && prevAbove) freshBearishCross = true;
          }

          macdEnhanced = {
            ...macdResult,
            prevHistogram: prevMacd?.histogram ?? null,
            freshBullishCross,
            freshBearishCross,
          };
        }

        // ATR computation (for game-mode scoring)
        const atr = calculateATR(highs, lows, closes, 14);

        // NR7 + daily range computation
        const nr7Result = calculateNR7(highs, lows);

        // Bollinger bandwidth (raw value — percentile computed after loop)
        const bbResult = calculateBollingerBands(closes, 20, 2);

        // Volume profile (RVOL: today vs 20-day avg). Distinct from
        // factors.upDayVolRatio (up-day vs down-day directional bias).
        const vp = calculateVolumeProfile(volumes, 20);

        const rsPercentile = rsPercentileMap[d.sym] ?? 50;
        const sectorRSPercentile = sectorRSMap[d.sym] ?? null;
        const scoreResult = computeTechnicalScore({
          closes,
          highs,
          lows,
          volumes,
          spyCloses,
          rsPercentile,
          rsTrend: d.rsTrend,
          technicals: { rsi, sma20, sma50, sma200, macd: macdEnhanced },
          sectorRSPercentile,
        });

        const currentPrice = closes[0];
        const sma200_position = (sma200 !== null && currentPrice != null)
          ? Number((((currentPrice - sma200) / sma200) * 100).toFixed(2))
          : null;

        // Phase 2A — pivot levels from prior-day OHLC (index 1 = yesterday in
        // newest-first arrays). Returns null sub-object if any input missing.
        const pivots = calculatePivotLevels(highs[1] ?? null, lows[1] ?? null, closes[1] ?? null);

        // Phase 2A — multi-timeframe trend classification from existing daily
        // SMAs. Each field is 'up' | 'down' | null (null when SMA unavailable).
        const trend = {
          shortTerm: classifyTrend(currentPrice, sma20),
          intermediate: classifyTrend(currentPrice, sma50),
          longTerm: classifyTrend(currentPrice, sma200),
        };

        // Phase 2A — swing high/low detection + nearest S/R cluster derivation.
        // Both default to lookback=20. levels falls back to a null-filled
        // shape when there's insufficient history for swing detection.
        const swings = findSwingHighsLows(closes, highs, lows, 20);
        const levels = swings
          ? findNearestLevels(currentPrice, swings.swingHighs, swings.swingLows, 20)
          : { nearestResistance: null, nearestSupport: null, distanceToResistancePct: null, distanceToSupportPct: null };

        // Phase 2B — RSI divergence (price vs RSI series swing comparison).
        // calculateRSISeries returns null when closes.length < period+1; in
        // practice every retained stock has ≥50 bars so this rarely fires.
        const rsiSeries = calculateRSISeries(closes, 14);
        const momentum = {
          divergence: rsiSeries ? detectRSIDivergence(closes, rsiSeries, 20) : null,
        };

        // Phase 2B — recent candle pattern. Suspicious-candle filter inside
        // detectCandlePattern guards against split-day false positives caused
        // by EODHD returning adjusted close + unadjusted O/H/L. avgVolume comes
        // from the volumeProfile already computed above.
        const recentAction = {
          lastCandlePattern: detectCandlePattern(opens, highs, lows, closes, volumes, vp?.avgVolume ?? null),
        };

        stockScores.push({
          symbol: d.sym,
          rs20: d.rs20 ? { value: d.rs20.value, change: d.rs20.change, percentile: rsPercentile } : null,
          rs50: d.rs50 ? { value: d.rs50.value, change: d.rs50.change, percentile: 0 } : null,
          rsTrend: d.rsTrend,
          atrPercent: atr?.percent ?? null,
          dailyRange: nr7Result?.dailyRange ?? null,
          nr7Flag: nr7Result?.nr7 ?? false,
          bBandwidth: bbResult?.bandwidth ?? null,
          bbPercentB: bbResult?.percentB ?? null,
          bbUpper: bbResult?.upper ?? null,
          bbLower: bbResult?.lower ?? null,
          volumeProfile: vp ? { ratio: vp.ratio, avgVolume: vp.avgVolume, tier: vp.tier } : null,
          sma200_position,
          trend,
          pivots,
          levels,
          momentum,
          recentAction,
          ...scoreResult,
        });
      }

      // Sort by technicalScore desc and assign ranks
      stockScores.sort((a, b) => b.technicalScore - a.technicalScore);
      stockScores.forEach((s, idx) => {
        s.technicalRank = idx + 1;
      });

      // --- Sector Technical Ranking ---
      const sectorGroups = {};
      for (const stock of stockScores) {
        const sid = TICKER_TO_SECTOR[stock.symbol];
        if (!sid) continue;
        if (!sectorGroups[sid]) sectorGroups[sid] = [];
        sectorGroups[sid].push(stock);
      }
      for (const [, sectorStocks] of Object.entries(sectorGroups)) {
        sectorStocks.sort((a, b) => b.technicalScore - a.technicalScore);
        sectorStocks.forEach((stock, index) => {
          stock.sectorTechnicalRank = index + 1;
          stock.sectorTechnicalTotal = sectorStocks.length;
        });
      }

      stocksProcessed = stockScores.length;
      log(`  Scored ${stocksProcessed} stocks across ${Object.keys(sectorGroups).length} sectors`);

      // Momentum Rank (Phase 2) — 6 metrics + sub-pillars. Reuses rsData which
      // already holds per-stock closes + ohlcv. Passes spyCloses for Residual
      // Momentum (beta regression) and Intermediate RS (benchmark comparison).
      const stockMomentumData = rsData.map(d => ({
        symbol: d.sym,
        closes: d.closes,
        volumes: d.ohlcv.map(o => o.volume),
      }));
      // TODO: Wire lastEarningsDate + last-earnings-day return from peerRankings
      // once compute-rankings.js persists per-event dates. For now earningsMap =
      // null so computePeadAdjustment returns 0 for every stock (PEAD inactive).
      const momentumResults = computeMomentumRankings(stockMomentumData, spyCloses, null);
      momentumResults.forEach(r => momentumMap.set(r.symbol, r));
      log(`  Computed momentum rank for ${momentumResults.length} stocks`);

      // Conversational Performance — realized 1W/1M/3M/YTD/12M returns from the SAME
      // newest-first adjusted closes momentum already uses (zero new EODHD calls).
      // Strictly additive: computed into a separate map; momentumMap / momentumScoring
      // and every existing field are untouched.
      for (const d of rsData) {
        returnsMap.set(d.sym, computeReturns(d.closes, d.ohlcv.map(o => o.date)));
      }
      log(`  Computed period returns for ${returnsMap.size} stocks`);
    }

    // Top/Bottom leaders for marketContext
    const technicalLeaders = stockScores.slice(0, 5).map(s => s.symbol);
    const technicalLaggards = stockScores.slice(-5).reverse().map(s => s.symbol);

    // Top/worst sector from ETF daily performance
    const topSectorToday = sectorSnapshot.length > 0 ? sectorSnapshot[0].sector : 'N/A';
    const topSectorChange = sectorSnapshot.length > 0 ? sectorSnapshot[0].changePercent : null;
    const worstSectorToday = sectorSnapshot.length > 0 ? sectorSnapshot[sectorSnapshot.length - 1].sector : 'N/A';
    const worstSectorChange = sectorSnapshot.length > 0 ? sectorSnapshot[sectorSnapshot.length - 1].changePercent : null;

    // Step 6 — Write to Firestore
    log('Step 6: Writing to Firestore...');
    const batch = db.batch();
    let writeCount = 0;

    // Write index documents
    for (const idx of INDEX_SYMBOLS) {
      const tech = indexTechnicals[idx.symbol];
      if (!tech) continue;
      const ref = db.collection('indexIntelligence').doc(idx.symbol);
      batch.set(ref, { ...tech, updatedAt: FieldValue.serverTimestamp() });
      writeCount++;
    }

    // Write marketContext
    const marketContextRef = db.collection('indexIntelligence').doc('marketContext');
    batch.set(marketContextRef, {
      regime: regime.regime,
      regimeDetail: regime.regimeDetail,
      spy: spyT ? { price: spyT.price, change: spyT.change, changePercent: spyT.changePercent } : null,
      qqq: qqqT ? { price: qqqT.price, change: qqqT.change, changePercent: qqqT.changePercent } : null,
      dia: diaT ? { price: diaT.price, change: diaT.change, changePercent: diaT.changePercent } : null,
      iwm: iwmT ? { price: iwmT.price, change: iwmT.change, changePercent: iwmT.changePercent } : null,
      leadership,
      divergence,
      breadthQuality,
      yields,
      breadthComposite,
      breadthTier,
      volatilityRegime,
      sectorSnapshot,
      topSectorToday,
      topSectorChange,
      worstSectorToday,
      worstSectorChange,
      technicalLeaders,
      technicalLaggards,
      mode: intraday ? 'intraday' : 'premarket',
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeCount++;

    // Write stockTechnicalScores
    for (const score of stockScores) {
      const ref = db.collection('stockTechnicalScores').doc(score.symbol);
      batch.set(ref, {
        ...score,
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeCount++;
    }

    // Build stockRankings summary (composite of fundamental + technical)
    if (stockScores.length > 0) {
      log('  Building stockRankings summary...');
      const totalTechStocks = stockScores.length;

      // Fetch peerRankings for all scored symbols (batch in groups of 30 for Firestore 'in' limit)
      const symbols = stockScores.map(s => s.symbol);
      const fundMap = new Map();
      for (let i = 0; i < symbols.length; i += 30) {
        const chunk = symbols.slice(i, i + 30);
        const snap = await db.collection('peerRankings')
          .where('ticker', 'in', chunk)
          .get();
        snap.forEach(doc => {
          const d = doc.data();
          fundMap.set(d.ticker, d);
        });
      }

      // Compute ATR percentiles across all stocks for game-mode scoring
      const atrValues = stockScores
        .filter(s => s.atrPercent != null)
        .map(s => ({ sym: s.symbol, atr: s.atrPercent }))
        .sort((a, b) => a.atr - b.atr);
      const atrPercentileMap = {};
      atrValues.forEach((item, idx) => {
        atrPercentileMap[item.sym] = atrValues.length > 1
          ? idx / (atrValues.length - 1)
          : 0.5;
      });

      // Compute Bollinger bandwidth percentiles across all stocks
      const bwValues = stockScores
        .filter(s => s.bBandwidth != null)
        .map(s => ({ sym: s.symbol, bw: s.bBandwidth }))
        .sort((a, b) => a.bw - b.bw);
      const bBandwidthPercentileMap = {};
      bwValues.forEach((item, idx) => {
        bBandwidthPercentileMap[item.sym] = bwValues.length > 1
          ? Math.round((idx / (bwValues.length - 1)) * 100)
          : 50;
      });

      const rankingStocks = [];
      for (const tech of stockScores) {
        const fund = fundMap.get(tech.symbol);
        const fundRank = fund?.compositeRank;
        const fundScore = fund?.compositeScore;
        const fundTotalPeers = fund?.totalPeers;
        const sectorId = TICKER_TO_SECTOR[tech.symbol];
        const sectorName = fund?.sectorName || (sectorId ? STOCK_UNIVERSE[sectorId]?.name : null);

        // Composite: average of fundamental percentile (sector-scoped) and technical percentile (sector-scoped)
        let compositeScore = null;
        if (fundRank != null && fundTotalPeers > 0 && tech.sectorTechnicalRank != null && tech.sectorTechnicalTotal > 0) {
          const fundPercentile = ((fundTotalPeers - fundRank) / fundTotalPeers) * 100;
          const techPercentile = ((tech.sectorTechnicalTotal - tech.sectorTechnicalRank) / tech.sectorTechnicalTotal) * 100;
          compositeScore = Math.round(((fundPercentile + techPercentile) / 2) * 10) / 10;
        }

        // Build pillar scores from peerRankings data (for game-mode computation)
        const pillarScores = {};
        if (fund?.pillars) {
          for (const [key, pillar] of Object.entries(fund.pillars)) {
            if (pillar?.percentile != null) pillarScores[key] = pillar.percentile;
          }
        }

        // Build technical factor scores (normalized to 0-100 for game-mode computation)
        const techFactors = tech.factors || {};
        const technicalFactorScores = {
          rsVsSpy: techFactors.rsPercentile ?? 50,
          sectorRS: techFactors.sectorRSPercentile ?? techFactors.rsPercentile ?? 50,
          smaPosition: tech.smaScore != null ? (tech.smaScore / 18) * 100 : 50,
          macd: tech.macdScore != null ? (tech.macdScore / 12) * 100 : 50,
          weekHighProx: tech.highProximity != null ? (tech.highProximity / 12) * 100 : 50,
          volume: tech.volumeConfirmation != null ? (tech.volumeConfirmation / 12) * 100 : 50,
          rsi: tech.rsiContext != null ? (tech.rsiContext / 9) * 100 : 50,
        };

        // Compute game-mode fit scores
        const atrPercentile = atrPercentileMap[tech.symbol] ?? 0.5;
        const mom = momentumMap.get(tech.symbol);
        const momentumData = mom?.momentumFactors
          ? { heat: mom.momentumFactors.heat }
          : null;
        const gameModes = computeGameModeFits({
          pillarScores,
          technicalFactorScores,
          atrPercentile,
          momentumData,
        });

        // Conversational Performance — realized period returns for this stock.
        const ret = returnsMap.get(tech.symbol);

        const stockEntry = {
          symbol: tech.symbol,
          sectorId: sectorId || null,
          sectorName,
          // Phase 4.6 industry taxonomy, stamped from the committed static map
          // (TICKER_TO_INDUSTRY). Named-field addition — no EODHD call, inert to decide.js.
          industryName: TICKER_TO_INDUSTRY[tech.symbol] || null,
          fundamentalRank: fundRank || null,
          fundamentalScore: fundScore || null,
          fundamentalTotalPeers: fundTotalPeers || null,
          technicalRank: tech.technicalRank,
          technicalScore: tech.technicalScore,
          sectorTechnicalRank: tech.sectorTechnicalRank || null,
          sectorTechnicalTotal: tech.sectorTechnicalTotal || null,
          compositeScore,
          // Game-mode fit scores
          baggerBombFit: gameModes.baggerBombFit ?? null,
          atrPercentile: Math.round(atrPercentile * 100) / 100,
          // Intraday momentum fields (Sprint 1)
          dailyRange: tech.dailyRange ?? null,
          nr7Flag: tech.nr7Flag ?? false,
          bBandwidthPercentile: bBandwidthPercentileMap[tech.symbol] ?? null,
          // Momentum Rank (Phase 1)
          momentumScore: mom?.momentumScore ?? null,
          momentumRank: mom?.momentumRank ?? null,
          momentumFactors: mom?.momentumFactors ?? null,
          // Tier 0 Item 6: % distance from 200-day SMA (signed; null if insufficient history)
          sma200_position: tech.sma200_position ?? null,
          // Phase 2A — multi-timeframe trend, pivot levels, nearest S/R levels.
          // Mirrored from stockTechnicalScores so the voice layer can read
          // them off the rankings doc directly (matches Item 6 precedent).
          trend: tech.trend ?? null,
          pivots: tech.pivots ?? null,
          levels: tech.levels ?? null,
          // Phase 2B — RSI divergence + recent candle pattern. Mirrored for
          // the same reason.
          momentum: tech.momentum ?? null,
          recentAction: tech.recentAction ?? null,
          // Conversational Performance — realized period returns (signed percent; null
          // on thin history). Computed fresh from adjusted closes; named fields only,
          // so inert to decide.js and the calibration fence.
          return1W: ret?.return1W ?? null,
          return1M: ret?.return1M ?? null,
          return3M: ret?.return3M ?? null,
          returnYTD: ret?.returnYTD ?? null,
          return12M: ret?.return12M ?? null,
        };

        rankingStocks.push(stockEntry);
      }

      // Assign game-mode ranks
      assignGameModeRanks(rankingStocks);

      // Sort by compositeScore descending (nulls last)
      rankingStocks.sort((a, b) => {
        if (a.compositeScore == null && b.compositeScore == null) return 0;
        if (a.compositeScore == null) return 1;
        if (b.compositeScore == null) return -1;
        return b.compositeScore - a.compositeScore;
      });

      // Tier 0 Item 6: persist per-archetype ARCH scores for the universe screener.
      // Must run against the FULL rankingStocks array — sectorDiversity depends on
      // the input universe, so a filtered subset would yield different scores.
      const archScoresBySymbol = {};
      for (const archetype of ARCHETYPES) {
        const ranked = computeArchetypeRankings(rankingStocks, archetype);
        for (const s of ranked) {
          if (!archScoresBySymbol[s.symbol]) archScoresBySymbol[s.symbol] = {};
          archScoresBySymbol[s.symbol][archetype] = s.archetypeScore;
        }
      }
      for (const stock of rankingStocks) {
        stock.arch_scores = archScoresBySymbol[stock.symbol] || {};
      }

      // Build sectors lookup for efficient frontend leaderboard rendering
      const sectorGroupsLocal = {};
      for (const stock of stockScores) {
        const sid = TICKER_TO_SECTOR[stock.symbol];
        if (!sid) continue;
        if (!sectorGroupsLocal[sid]) sectorGroupsLocal[sid] = [];
        sectorGroupsLocal[sid].push(stock);
      }
      const sectors = {};
      for (const [sid, sectorStocks] of Object.entries(sectorGroupsLocal)) {
        sectors[sid] = {
          name: STOCK_UNIVERSE[sid]?.name || sid,
          stocks: sectorStocks.map(s => s.symbol),
          totalStocks: sectorStocks.length,
        };
      }

      // Phase 2 — per-industry rollup (median aggregates, >= MIN_INDUSTRY_SIZE members).
      // Reads the assembled rankingStocks; no extra data fetch.
      const industries = buildIndustriesRollup(rankingStocks);

      const rankingsRef = db.collection('indexIntelligence').doc('stockRankings');
      batch.set(rankingsRef, {
        stocks: rankingStocks,
        totalTechStocks,
        sectors,
        industries,
        mode: intraday ? 'intraday' : 'premarket',
        computedAt: FieldValue.serverTimestamp(),
        // Freshness horizon for consumers: intraday docs go stale within ~75min
        // (hourly cadence + slack); the pre-market baseline holds for the day.
        expiresAt: Timestamp.fromMillis(Date.now() + (intraday ? 75 : 24 * 60) * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writeCount++;
      log(`  ✓ stockRankings summary: ${rankingStocks.length} stocks, ${rankingStocks.filter(s => s.compositeScore != null).length} with composite`);
    }

    await batch.commit();
    log(`  ✓ Wrote ${writeCount} documents to Firestore`);

    // Step 7 — Return Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Done in ${elapsed}s`);

    return res.status(200).json({
      success: true,
      mode: intraday ? 'intraday' : 'premarket',
      realtimeQuotes: intradayQuotes ? intradayQuotes.size : 0,
      indexesProcessed: Object.keys(indexTechnicals).length,
      tnxProcessed: tnxData !== null,
      stocksScored: stocksProcessed,
      sectorsProcessed: sectorSnapshot.length,
      firestoreWrites: writeCount,
      regime: regime.regime,
      topLeader: technicalLeaders[0] || null,
      elapsedSeconds: Number(elapsed),
      errors,
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`FATAL ERROR after ${elapsed}s: ${err.message}`);
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message,
      elapsedSeconds: Number(elapsed),
      errors,
    });
  }
}
