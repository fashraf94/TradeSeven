// api/_utils/indexIntelligence.js
// Pure computation helpers for Index Intelligence.
// No API calls, no Firestore — just math and classification logic.

// Tunable thresholds — adjust these to change classification sensitivity.
const THRESHOLDS = {
  leadershipSpread: 0.3,        // % difference to detect index leadership
  rotationDivergence: 0.5,      // % QQQ-IWM gap for rotation signal
  spyFlatZone: 0.2,             // % SPY move to consider "flat"
  narrowParticipationMove: 1.0,  // % move needed when SPY is flat
  smallCapMomentumMinSpy: 0.1,  // minimum SPY move for small-cap momentum
  smallCapMomentumMultiplier: 2, // IWM must exceed SPY by this factor
  breadthProximity: 0.3,        // % SPY-RSP gap for breadth quality
  yieldAccommodative: 4.0,      // 10Y yield below this = accommodative
  yieldNeutral: 4.5,            // 10Y yield below this = neutral
  yieldRestrictive: 5.0,        // 10Y yield below this = restrictive
  rsTrendFlat: 0.0005,          // RS slope below this = flat trend
};

/**
 * Classify market regime based on SPY price relative to moving averages.
 * @param {number} price - Current SPY price
 * @param {number} sma50 - 50-day SMA value
 * @param {number} sma200 - 200-day SMA value
 * @returns {{ regime: string, regimeDetail: string }}
 */
export function classifyRegime(price, sma50, sma200) {
  if (price > sma50 && sma50 > sma200) {
    return {
      regime: 'bull',
      regimeDetail: `SPY above 50-day MA (${sma50.toFixed(2)}) and 50-day above 200-day MA (${sma200.toFixed(2)}). Strong uptrend.`,
    };
  }
  if (price < sma50 && price > sma200) {
    return {
      regime: 'correction',
      regimeDetail: `SPY below 50-day MA (${sma50.toFixed(2)}) but holding 200-day MA (${sma200.toFixed(2)}). Correction within uptrend.`,
    };
  }
  if (price < sma50 && price < sma200) {
    return {
      regime: 'bear',
      regimeDetail: `SPY below both 50-day MA (${sma50.toFixed(2)}) and 200-day MA (${sma200.toFixed(2)}). Bear market conditions.`,
    };
  }
  // price > sma50 && sma50 < sma200
  return {
    regime: 'recovery',
    regimeDetail: `SPY reclaimed 50-day MA (${sma50.toFixed(2)}) but 50-day still below 200-day MA (${sma200.toFixed(2)}). Early recovery.`,
  };
}

/**
 * Detect which index is leading the market today.
 * @param {number} spyChange - SPY daily % change
 * @param {number} qqqChange - QQQ daily % change
 * @param {number} diaChange - DIA daily % change
 * @param {number} iwmChange - IWM daily % change
 * @returns {string}
 */
export function detectLeadership(spyChange, qqqChange, diaChange, iwmChange) {
  const all = [spyChange, qqqChange, diaChange, iwmChange];
  const spread = Math.max(...all) - Math.min(...all);

  if (qqqChange - spyChange > THRESHOLDS.leadershipSpread) return 'tech_leads';
  if (iwmChange - spyChange > THRESHOLDS.leadershipSpread) return 'small_cap_leads';
  if (diaChange - qqqChange > THRESHOLDS.leadershipSpread) return 'defensive_leads';
  if (spread < THRESHOLDS.leadershipSpread && all.every(v => v > 0)) return 'broad_rally';
  if (spread < THRESHOLDS.leadershipSpread && all.every(v => v < 0)) return 'broad_selloff';
  return 'mixed';
}

/**
 * Detect divergence signals between indexes.
 * @param {number} spyChange - SPY daily % change
 * @param {number} qqqChange - QQQ daily % change
 * @param {number} diaChange - DIA daily % change
 * @param {number} iwmChange - IWM daily % change
 * @returns {{ active: boolean, type: string, detail: string }}
 */
export function detectDivergence(spyChange, qqqChange, diaChange, iwmChange) {
  // QQQ and IWM moving opposite directions
  if (Math.sign(qqqChange) !== Math.sign(iwmChange) && Math.abs(qqqChange - iwmChange) > THRESHOLDS.rotationDivergence) {
    const leader = qqqChange > iwmChange ? 'tech' : 'small-caps';
    return {
      active: true,
      type: 'rotation',
      detail: `QQQ ${qqqChange > 0 ? '+' : ''}${qqqChange.toFixed(2)}% vs IWM ${iwmChange > 0 ? '+' : ''}${iwmChange.toFixed(2)}% — rotation into ${leader}.`,
    };
  }

  // SPY flat but QQQ or IWM moving significantly
  if (Math.abs(spyChange) < THRESHOLDS.spyFlatZone && (Math.abs(qqqChange) > THRESHOLDS.narrowParticipationMove || Math.abs(iwmChange) > THRESHOLDS.narrowParticipationMove)) {
    const mover = Math.abs(qqqChange) > Math.abs(iwmChange) ? 'QQQ' : 'IWM';
    const moveVal = mover === 'QQQ' ? qqqChange : iwmChange;
    return {
      active: true,
      type: 'narrow_participation',
      detail: `SPY flat (${spyChange.toFixed(2)}%) but ${mover} ${moveVal > 0 ? '+' : ''}${moveVal.toFixed(2)}% — narrow participation.`,
    };
  }

  // All same direction but IWM magnitude much larger than SPY
  if (Math.sign(spyChange) === Math.sign(iwmChange) && Math.abs(spyChange) > THRESHOLDS.smallCapMomentumMinSpy && Math.abs(iwmChange) > Math.abs(spyChange) * THRESHOLDS.smallCapMomentumMultiplier) {
    return {
      active: true,
      type: 'small_cap_momentum',
      detail: `IWM ${iwmChange > 0 ? '+' : ''}${iwmChange.toFixed(2)}% vs SPY ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% — small-cap momentum shift.`,
    };
  }

  return { active: false, type: 'none', detail: '' };
}

/**
 * Compute breadth quality by comparing SPY (cap-weighted) vs RSP (equal-weight).
 * @param {number} spyChange - SPY daily % change
 * @param {number} rspChange - RSP daily % change
 * @returns {{ spyVsRsp: number, signal: string, detail: string }}
 */
export function computeBreadthQuality(spyChange, rspChange) {
  const diff = spyChange - rspChange;
  let signal, detail;

  if (spyChange > 0 && rspChange < 0) {
    signal = 'divergent';
    detail = `SPY +${spyChange.toFixed(2)}% but RSP ${rspChange.toFixed(2)}% — mega-caps masking broad weakness.`;
  } else if (spyChange < 0 && rspChange > 0) {
    signal = 'divergent';
    detail = `SPY ${spyChange.toFixed(2)}% but RSP +${rspChange.toFixed(2)}% — broad market stronger than mega-caps suggest.`;
  } else if (Math.abs(diff) < THRESHOLDS.breadthProximity) {
    signal = 'broad_participation';
    detail = `SPY and RSP within ${Math.abs(diff).toFixed(2)}% — healthy broad participation.`;
  } else if (diff > THRESHOLDS.breadthProximity) {
    signal = 'narrow_leadership';
    detail = `SPY ${spyChange > 0 ? '+' : ''}${spyChange.toFixed(2)}% but RSP ${rspChange > 0 ? '+' : ''}${rspChange.toFixed(2)}% — rally driven by mega-caps.`;
  } else {
    signal = 'broad_weakness';
    detail = `RSP outpacing SPY by ${Math.abs(diff).toFixed(2)}% — broad market underperforming large-caps.`;
  }

  return { spyVsRsp: Number(diff.toFixed(2)), signal, detail };
}

/**
 * Classify yield regime based on 10-Year Treasury yield level.
 * @param {number} tnxClose - Current TNX close (yield %)
 * @param {number} tnxPrevClose - Previous TNX close (yield %)
 * @returns {{ tnx: number, tnxChange: number, regime: string, detail: string }}
 */
export function classifyYieldRegime(tnxClose, tnxPrevClose) {
  // EODHD returns TNX as a price-like number (e.g. 42.59); divide by 10 to get actual yield %
  tnxClose = tnxClose / 10;
  tnxPrevClose = tnxPrevClose / 10;
  const tnxChange = Number((tnxClose - tnxPrevClose).toFixed(2));
  const direction = tnxChange > 0 ? `+${tnxChange}bps` : `${tnxChange}bps`;
  let regime, detail;

  if (tnxClose < THRESHOLDS.yieldAccommodative) {
    regime = 'accommodative';
    detail = `10Y at ${tnxClose.toFixed(2)}%, ${direction} — accommodative zone, supportive for equities.`;
  } else if (tnxClose < THRESHOLDS.yieldNeutral) {
    regime = 'neutral';
    detail = `10Y at ${tnxClose.toFixed(2)}%, ${direction} — neutral zone.`;
  } else if (tnxClose < THRESHOLDS.yieldRestrictive) {
    regime = 'restrictive';
    detail = `10Y at ${tnxClose.toFixed(2)}%, ${direction} — restrictive zone, headwind for growth stocks.`;
  } else {
    regime = 'crisis';
    detail = `10Y at ${tnxClose.toFixed(2)}%, ${direction} — crisis-level yields, significant equity headwind.`;
  }

  return { tnx: tnxClose, tnxChange, regime, detail };
}

/**
 * Compute Relative Strength ratio of a stock vs SPY over a given period.
 * @param {number[]} stockCloses - Stock closing prices (newest-first)
 * @param {number[]} spyCloses - SPY closing prices (newest-first)
 * @param {number} period - Lookback period in trading days
 * @returns {{ value: number, change: number }|null}
 */
export function computeRS(stockCloses, spyCloses, period) {
  if (!stockCloses || !spyCloses || stockCloses.length < period + 1 || spyCloses.length < period + 1) {
    return null;
  }
  if (spyCloses[0] === 0 || spyCloses[period] === 0 || stockCloses[0] === 0) return null;

  const ratioToday = stockCloses[0] / spyCloses[0];
  const ratioPeriodAgo = stockCloses[period] / spyCloses[period];
  const change = ((ratioToday - ratioPeriodAgo) / ratioPeriodAgo) * 100;

  return {
    value: Number(ratioToday.toFixed(4)),
    change: Number(change.toFixed(3)),
  };
}

/**
 * Compute RS trend using simple linear regression slope on recent RS ratios.
 * @param {number[]} stockCloses - Stock closing prices (newest-first)
 * @param {number[]} spyCloses - SPY closing prices (newest-first)
 * @param {number} lookback - Number of recent days to analyze (default 10)
 * @returns {{ trend: string, slope: number }}
 */
export function computeRSTrend(stockCloses, spyCloses, lookback = 10) {
  if (!stockCloses || !spyCloses || stockCloses.length < lookback || spyCloses.length < lookback) {
    return { trend: 'flat', slope: 0 };
  }

  // Build RS ratio series for the lookback window (newest-first)
  const ratios = [];
  for (let i = 0; i < lookback; i++) {
    if (spyCloses[i] === 0) continue;
    ratios.push(stockCloses[i] / spyCloses[i]);
  }

  if (ratios.length < 3) return { trend: 'flat', slope: 0 };

  // Reverse to oldest-first for regression (x=0 is oldest)
  ratios.reverse();

  // Simple linear regression: slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
  const n = ratios.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ratios[i];
    sumXY += i * ratios[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let trend;
  if (Math.abs(slope) < THRESHOLDS.rsTrendFlat) trend = 'flat';
  else if (slope > 0) trend = 'rising';
  else trend = 'falling';

  return { trend, slope: Number(slope.toFixed(6)) };
}

/**
 * Compute the full Technical Score for a single stock.
 *
 * 7 Factors (RS Trend Direction removed, Sector RS + MACD added):
 * - RS vs SPY (percentile rank)              — 22 pts
 * - Sector-Relative Strength (NEW)           — 15 pts
 * - SMA Positioning (above/below 20/50/200)  — 18 pts
 * - MACD Signal Alignment (NEW)              — 12 pts
 * - 52-Week High Proximity                   — 12 pts
 * - Volume Confirmation                      — 12 pts
 * - RSI Trend Context                        — 9 pts
 *
 * @param {object} params
 * @param {number[]} params.closes - Stock closes (newest-first)
 * @param {number[]} params.highs - Stock highs (newest-first)
 * @param {number[]} params.lows - Stock lows (newest-first)
 * @param {number[]} params.volumes - Stock volumes (newest-first)
 * @param {number[]} params.spyCloses - SPY closes (newest-first)
 * @param {number} params.rsPercentile - Pre-computed RS percentile (0-100)
 * @param {string} params.rsTrend - Pre-computed RS trend ('rising'|'flat'|'falling')
 * @param {object} params.technicals - Pre-computed indicators { rsi, sma20, sma50, sma200, macd }
 * @param {number|null} [params.sectorRSPercentile] - RS vs sector ETF percentile (0-100)
 * @returns {object} Technical score breakdown
 */
export function computeTechnicalScore({
  closes,
  highs,
  lows,
  volumes,
  spyCloses,
  rsPercentile,
  rsTrend,
  technicals,
  sectorRSPercentile,
}) {
  const currentPrice = closes[0];

  // --- RS vs SPY Score (out of 22) ---
  const rsVsSpyScore = Math.round((rsPercentile / 100) * 22);

  // --- Sector-Relative Strength (out of 15) --- NEW
  const sectorRSPct = sectorRSPercentile != null ? sectorRSPercentile : rsPercentile;
  const sectorRSScore = Math.round((sectorRSPct / 100) * 15);

  // --- SMA Score (out of 18) ---
  let smaScore = 0;
  const aboveSMA200 = technicals.sma200 !== null && currentPrice > technicals.sma200;
  const aboveSMA50 = technicals.sma50 !== null && currentPrice > technicals.sma50;
  const aboveSMA20 = technicals.sma20 !== null && currentPrice > technicals.sma20;
  if (aboveSMA200) smaScore += 8;
  if (aboveSMA50) smaScore += 6;
  if (aboveSMA20) smaScore += 4;

  // --- MACD Signal Alignment (out of 12) --- NEW
  let macdScore = 6; // default neutral
  const macd = technicals.macd;
  if (macd && macd.macd != null && macd.signal != null && macd.histogram != null) {
    const aboveSignal = macd.macd > macd.signal;
    // Determine if histogram is expanding (getting more positive or less negative)
    const histExpanding = macd.prevHistogram != null
      ? macd.histogram > macd.prevHistogram
      : macd.histogram > 0;

    if (aboveSignal && histExpanding) macdScore = 12;        // Strong bullish momentum
    else if (aboveSignal && !histExpanding) macdScore = 8;   // Bullish but weakening
    else if (!aboveSignal && histExpanding) macdScore = 6;   // Potential bullish crossover forming
    else macdScore = 2;                                       // Bearish momentum deepening

    // Fresh crossover bonus/penalty (within last 3 bars)
    if (macd.freshBullishCross) macdScore = Math.min(12, macdScore + 2);
    if (macd.freshBearishCross) macdScore = Math.max(0, macdScore - 2);
  }

  // --- 52-Week High Proximity (out of 12) ---
  const tradingDays = Math.min(252, highs.length);
  const high52w = Math.max(...highs.slice(0, tradingDays));
  const distToHigh = ((high52w - currentPrice) / high52w) * 100;
  let highProximity;
  if (distToHigh <= 5) highProximity = 12;
  else if (distToHigh <= 10) highProximity = 10;
  else if (distToHigh <= 20) highProximity = 7;
  else if (distToHigh <= 30) highProximity = 4;
  else highProximity = 1;

  // --- Volume Confirmation (out of 12) ---
  let volumeConfirmation = 6; // default
  if (closes.length >= 20 && volumes.length >= 20) {
    let upDayVolSum = 0, upDayCount = 0;
    let downDayVolSum = 0, downDayCount = 0;
    for (let i = 0; i < 20; i++) {
      if (i + 1 < closes.length) {
        if (closes[i] > closes[i + 1]) {
          upDayVolSum += volumes[i];
          upDayCount++;
        } else {
          downDayVolSum += volumes[i];
          downDayCount++;
        }
      }
    }
    const avgUpVol = upDayCount > 0 ? upDayVolSum / upDayCount : 0;
    const avgDownVol = downDayCount > 0 ? downDayVolSum / downDayCount : 0;
    const volRatio = avgDownVol > 0 ? avgUpVol / avgDownVol : 1;

    if (volRatio > 1.5) volumeConfirmation = 12;
    else if (volRatio > 1.2) volumeConfirmation = 9;
    else if (volRatio > 1.0) volumeConfirmation = 6;
    else volumeConfirmation = 3;
  }

  // --- RSI Context (out of 9) ---
  let rsiContext = 4; // default
  const rsiValue = technicals.rsi?.value ?? 50;
  if (rsiValue >= 50 && rsiValue <= 70 && rsTrend === 'rising') rsiContext = 9;
  else if (rsiValue >= 40 && rsiValue < 50 && rsTrend === 'rising') rsiContext = 6;
  else if (rsiValue > 80) rsiContext = 4;
  else if (rsiValue < 30 && rsTrend === 'falling') rsiContext = 0;
  else if (rsiValue >= 50 && rsiValue <= 70) rsiContext = 6;
  else if (rsiValue < 40) rsiContext = 2;

  // --- Total Technical Score ---
  const technicalScore = rsVsSpyScore + sectorRSScore + smaScore + macdScore + highProximity + volumeConfirmation + rsiContext;

  // Compute up/down volume ratio for factors output
  let upDayVolRatio = 1;
  if (closes.length >= 20 && volumes.length >= 20) {
    let upSum = 0, upCnt = 0, downSum = 0, downCnt = 0;
    for (let i = 0; i < 20; i++) {
      if (i + 1 < closes.length) {
        if (closes[i] > closes[i + 1]) { upSum += volumes[i]; upCnt++; }
        else { downSum += volumes[i]; downCnt++; }
      }
    }
    upDayVolRatio = downCnt > 0 ? (upSum / Math.max(upCnt, 1)) / (downSum / downCnt) : 1;
  }

  return {
    technicalScore: Math.min(100, technicalScore),
    smaScore,
    highProximity,
    volumeConfirmation,
    rsiContext,
    sectorRSScore,
    macdScore,
    rsVsSpyScore,
    factors: {
      rsPercentile,
      sectorRSPercentile: sectorRSPct,
      aboveSMA20,
      aboveSMA50,
      aboveSMA200,
      sma20: technicals.sma20 ?? null,
      sma50: technicals.sma50 ?? null,
      sma200: technicals.sma200 ?? null,
      distTo52wkHigh: Number(distToHigh.toFixed(1)),
      upDayVolRatio: Number(upDayVolRatio.toFixed(2)),
      rsi: rsiValue,
      macdHistogram: macd?.histogram ?? null,
      macdAboveSignal: macd ? macd.macd > macd.signal : null,
      macdFreshBullishCross: macd?.freshBullishCross ?? false,
      macdFreshBearishCross: macd?.freshBearishCross ?? false,
    },
  };
}
