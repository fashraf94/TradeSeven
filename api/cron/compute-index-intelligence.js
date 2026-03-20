// api/cron/compute-index-intelligence.js
// Daily cron: computes index-level market intelligence + per-stock RS & Technical Scores.
//
// Schedule: "30 10 * * 1-5" and "30 11 * * 1-5" (dual UTC hours for DST coverage)
// Runs at ~6:30 AM ET weekdays. Idempotent — running twice overwrites the same Firestore docs.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
} from '../_utils/technicalCalculations.js';
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
import { DRAFT_STOCK_SYMBOLS } from '../_utils/draftStockList.js';
import { STOCK_UNIVERSE } from '../_utils/rankingConfig.js';

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

async function fetchOHLCV(eohdSymbol, daysBack = 200) {
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
  return data.reverse().map(d => ({
    date: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.adjusted_close,
    volume: d.volume || 0,
  }));
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
  log('Starting index intelligence computation...');

  try {
    const db = getFirebaseAdmin();

    // Step 2 — Fetch Index OHLCV
    log('Step 2: Fetching index OHLCV data...');
    const indexData = {};
    for (const idx of INDEX_SYMBOLS) {
      try {
        indexData[idx.symbol] = await fetchOHLCV(idx.eodhd);
        log(`  ✓ ${idx.symbol}: ${indexData[idx.symbol].length} days`);
      } catch (err) {
        errors.push({ symbol: idx.symbol, error: err.message });
        log(`  ✗ ${idx.symbol}: ${err.message}`);
      }
    }

    // Fetch TNX (Treasury yield) — 30 days only
    let tnxData = null;
    try {
      tnxData = await fetchOHLCV('TNX.INDX', 30);
      log(`  ✓ TNX: ${tnxData.length} days`);
    } catch (err) {
      errors.push({ symbol: 'TNX', error: err.message });
      log(`  ✗ TNX: ${err.message}`);
    }

    // Step 2B — Fetch Sector ETF data (35 days each, compute 1D/1W/1M changes)
    log('Step 2B: Fetching sector ETF data...');
    const sectorSnapshot = [];
    for (const sec of SECTOR_ETFS) {
      try {
        const data = await fetchOHLCV(sec.eodhd, 35);
        if (data.length >= 2) {
          const todayClose = data[0].close;   // fetchOHLCV returns newest-first
          const prevClose = data[1].close;
          const changePercent = ((todayClose - prevClose) / prevClose) * 100;

          // Week change: ~5 trading days back
          const weekIdx = Math.min(5, data.length - 1);
          const weekChange = ((todayClose - data[weekIdx].close) / data[weekIdx].close) * 100;

          // Month change: ~21 trading days back
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
      } catch (err) {
        errors.push({ symbol: sec.etf, error: err.message });
        log(`  ✗ ${sec.etf}: ${err.message}`);
      }
    }
    sectorSnapshot.sort((a, b) => b.changePercent - a.changePercent);
    log(`  ✓ Sector snapshot: ${sectorSnapshot.length}/11 sectors`);

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

    // Step 5 — Compute RS + Technical Scores for 75 draft stocks
    log('Step 5: Fetching OHLCV for 75 draft stocks...');
    let stockScores = [];
    let stocksProcessed = 0;

    const spyCloses = indexData.SPY ? indexData.SPY.map(d => d.close) : null;

    if (!spyCloses || spyCloses.length < 50) {
      log('⚠ SPY has insufficient data (<50 days). Skipping RS computation.');
      errors.push({ symbol: 'RS_COMPUTATION', error: 'SPY insufficient data — need 50+ days' });
    } else {
      const { results: stockOHLCV, errors: stockErrors } = await fetchBatch(DRAFT_STOCK_SYMBOLS, 10, 500);
      errors.push(...stockErrors);
      log(`  Fetched ${Object.keys(stockOHLCV).length}/${DRAFT_STOCK_SYMBOLS.length} stocks`);

      // Compute RS20 change for all stocks (for percentile ranking)
      log('  Computing RS + Technical Scores...');
      const rsData = [];
      for (const sym of DRAFT_STOCK_SYMBOLS) {
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

      // Compute full technical score for each stock
      for (const d of rsData) {
        const closes = d.closes;
        const highs = d.ohlcv.map(o => o.high);
        const lows = d.ohlcv.map(o => o.low);
        const volumes = d.ohlcv.map(o => o.volume);

        const sma20 = calculateSMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const rsi = calculateRSI(closes, 14);

        const rsPercentile = rsPercentileMap[d.sym] ?? 50;
        const scoreResult = computeTechnicalScore({
          closes,
          highs,
          lows,
          volumes,
          spyCloses,
          rsPercentile,
          rsTrend: d.rsTrend,
          technicals: { rsi, sma20, sma50, sma200 },
        });

        // Fill in the slope in factors
        scoreResult.factors.rsTrendSlope = d.rsTrendSlope;

        stockScores.push({
          symbol: d.sym,
          rs20: d.rs20 ? { value: d.rs20.value, change: d.rs20.change, percentile: rsPercentile } : null,
          rs50: d.rs50 ? { value: d.rs50.value, change: d.rs50.change, percentile: 0 } : null,
          rsTrend: d.rsTrend,
          ...scoreResult,
        });
      }

      // Sort by technicalScore desc and assign ranks
      stockScores.sort((a, b) => b.technicalScore - a.technicalScore);
      stockScores.forEach((s, idx) => {
        s.technicalRank = idx + 1;
      });

      stocksProcessed = stockScores.length;
      log(`  Scored ${stocksProcessed} stocks`);
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

    await batch.commit();
    log(`  ✓ Wrote ${writeCount} documents to Firestore`);

    // Step 7 — Return Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Done in ${elapsed}s`);

    return res.status(200).json({
      success: true,
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
