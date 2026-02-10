// src/services/moneyMapEngine.js
// Money Map Intelligence Engine v1.0
//
// Pure computation engine that derives intelligence metrics from existing
// sector data (sectorDataService.js) and SPY benchmark data.
// No React dependencies. No API calls. No side effects.
//
// Input:  Raw sector data (11 GICS sectors) + SPY benchmark performance
// Output: Per-sector derived metrics + global market regime classification

// ===========================================
// SECTOR CLASSIFICATION
// Maps each SPDR sector ETF to risk posture and bellwether stocks
// ===========================================
export const SECTOR_CLASSIFICATION = {
  XLK:  { riskPosture: 'Offensive',  bellwethers: ['AAPL', 'MSFT', 'NVDA'] },
  XLV:  { riskPosture: 'Defensive',  bellwethers: ['LLY', 'UNH', 'JNJ'] },
  XLF:  { riskPosture: 'Offensive',  bellwethers: ['BRK.B', 'JPM', 'V'] },
  XLE:  { riskPosture: 'Offensive',  bellwethers: ['XOM', 'CVX', 'COP'] },
  XLY:  { riskPosture: 'Offensive',  bellwethers: ['AMZN', 'TSLA', 'HD'] },
  XLP:  { riskPosture: 'Defensive',  bellwethers: ['PG', 'COST', 'WMT'] },
  XLI:  { riskPosture: 'Offensive',  bellwethers: ['GE', 'CAT', 'RTX'] },
  XLB:  { riskPosture: 'Offensive',  bellwethers: ['LIN', 'SHW', 'FCX'] },
  XLU:  { riskPosture: 'Defensive',  bellwethers: ['NEE', 'SO', 'DUK'] },
  XLRE: { riskPosture: 'Offensive',  bellwethers: ['PLD', 'AMT', 'EQIX'] },
  XLC:  { riskPosture: 'Offensive',  bellwethers: ['META', 'GOOGL', 'NFLX'] },
};

// ===========================================
// BELLWETHER MAP
// Flat lookup: ticker → { sector, name, weight_approx, isBellwether }
// Approximate weights reflect relative sector ETF weighting
// ===========================================
export const BELLWETHER_MAP = {
  // Technology (XLK)
  AAPL: { sector: 'XLK', name: 'Apple',          weight_approx: 0.22, isBellwether: true },
  MSFT: { sector: 'XLK', name: 'Microsoft',      weight_approx: 0.21, isBellwether: true },
  NVDA: { sector: 'XLK', name: 'NVIDIA',         weight_approx: 0.06, isBellwether: true },
  // Healthcare (XLV)
  LLY:  { sector: 'XLV', name: 'Eli Lilly',      weight_approx: 0.12, isBellwether: true },
  UNH:  { sector: 'XLV', name: 'UnitedHealth',   weight_approx: 0.10, isBellwether: true },
  JNJ:  { sector: 'XLV', name: 'Johnson & Johnson', weight_approx: 0.08, isBellwether: true },
  // Financials (XLF)
  'BRK.B': { sector: 'XLF', name: 'Berkshire Hathaway', weight_approx: 0.14, isBellwether: true },
  JPM:  { sector: 'XLF', name: 'JPMorgan Chase', weight_approx: 0.11, isBellwether: true },
  V:    { sector: 'XLF', name: 'Visa',           weight_approx: 0.08, isBellwether: true },
  // Energy (XLE)
  XOM:  { sector: 'XLE', name: 'Exxon Mobil',    weight_approx: 0.23, isBellwether: true },
  CVX:  { sector: 'XLE', name: 'Chevron',        weight_approx: 0.17, isBellwether: true },
  COP:  { sector: 'XLE', name: 'ConocoPhillips', weight_approx: 0.08, isBellwether: true },
  // Consumer Discretionary (XLY)
  AMZN: { sector: 'XLY', name: 'Amazon',         weight_approx: 0.24, isBellwether: true },
  TSLA: { sector: 'XLY', name: 'Tesla',          weight_approx: 0.15, isBellwether: true },
  HD:   { sector: 'XLY', name: 'Home Depot',     weight_approx: 0.10, isBellwether: true },
  // Consumer Staples (XLP)
  PG:   { sector: 'XLP', name: 'Procter & Gamble', weight_approx: 0.15, isBellwether: true },
  COST: { sector: 'XLP', name: 'Costco',         weight_approx: 0.13, isBellwether: true },
  WMT:  { sector: 'XLP', name: 'Walmart',        weight_approx: 0.10, isBellwether: true },
  // Industrials (XLI)
  GE:   { sector: 'XLI', name: 'GE Aerospace',   weight_approx: 0.09, isBellwether: true },
  CAT:  { sector: 'XLI', name: 'Caterpillar',    weight_approx: 0.06, isBellwether: true },
  RTX:  { sector: 'XLI', name: 'RTX Corp',       weight_approx: 0.05, isBellwether: true },
  // Materials (XLB)
  LIN:  { sector: 'XLB', name: 'Linde',          weight_approx: 0.18, isBellwether: true },
  SHW:  { sector: 'XLB', name: 'Sherwin-Williams', weight_approx: 0.10, isBellwether: true },
  FCX:  { sector: 'XLB', name: 'Freeport-McMoRan', weight_approx: 0.07, isBellwether: true },
  // Utilities (XLU)
  NEE:  { sector: 'XLU', name: 'NextEra Energy', weight_approx: 0.15, isBellwether: true },
  SO:   { sector: 'XLU', name: 'Southern Company', weight_approx: 0.09, isBellwether: true },
  DUK:  { sector: 'XLU', name: 'Duke Energy',    weight_approx: 0.08, isBellwether: true },
  // Real Estate (XLRE)
  PLD:  { sector: 'XLRE', name: 'Prologis',      weight_approx: 0.14, isBellwether: true },
  AMT:  { sector: 'XLRE', name: 'American Tower', weight_approx: 0.11, isBellwether: true },
  EQIX: { sector: 'XLRE', name: 'Equinix',       weight_approx: 0.09, isBellwether: true },
  // Communication Services (XLC)
  META:  { sector: 'XLC', name: 'Meta Platforms', weight_approx: 0.23, isBellwether: true },
  GOOGL: { sector: 'XLC', name: 'Alphabet',      weight_approx: 0.22, isBellwether: true },
  NFLX:  { sector: 'XLC', name: 'Netflix',       weight_approx: 0.06, isBellwether: true },
};

// ===========================================
// HISTORICAL RETURNS (Annual, 2020-2025)
// Approximate total returns for each sector ETF by year
// Reference data for AI context — not used in live calculations
// ===========================================
export const HISTORICAL_RETURNS = {
  2020: { XLK: 43.9, XLV: 13.4, XLF: -1.7, XLE: -33.7, XLY: 32.1, XLP: 10.7, XLI: 11.1, XLB: 20.7, XLU: 0.5, XLRE: -2.2, XLC: 23.6 },
  2021: { XLK: 34.5, XLV: 26.0, XLF: 35.0, XLE: 53.3, XLY: 27.0, XLP: 18.6, XLI: 21.1, XLB: 27.3, XLU: 17.7, XLRE: 46.2, XLC: 16.6 },
  2022: { XLK: -28.2, XLV: -2.0, XLF: -10.5, XLE: 65.7, XLY: -37.0, XLP: -0.6, XLI: -5.5, XLB: -12.3, XLU: 1.6, XLRE: -26.2, XLC: -39.9 },
  2023: { XLK: 56.4, XLV: 2.1, XLF: 12.1, XLE: -1.3, XLY: 42.4, XLP: 0.5, XLI: 18.4, XLB: 12.6, XLU: -7.1, XLRE: 12.4, XLC: 55.8 },
  2024: { XLK: 36.6, XLV: 5.3, XLF: 30.5, XLE: 5.8, XLY: 30.1, XLP: 15.8, XLI: 17.2, XLB: 9.7, XLU: 24.2, XLRE: 5.2, XLC: 38.9 },
  2025: { XLK: 0, XLV: 0, XLF: 0, XLE: 0, XLY: 0, XLP: 0, XLI: 0, XLB: 0, XLU: 0, XLRE: 0, XLC: 0 },
};

// ===========================================
// BREADTH TIERS
// Classify sector breadth (% above 50-day SMA) into named tiers
// ===========================================
export const BREADTH_TIERS = [
  { min: 80, max: 100, label: 'Full Participation', color: '#10b981', tooltip: '80-100% of stocks above 50-day SMA. Broad, healthy strength across the sector.' },
  { min: 50, max: 79,  label: 'Healthy',            color: '#22c55e', tooltip: '50-79% participating. Majority of the sector is in gear.' },
  { min: 31, max: 49,  label: 'Thinning',           color: '#f59e0b', tooltip: '31-49% participating. Leadership is narrowing — watch for cracks.' },
  { min: 10, max: 30,  label: 'Fragile',            color: '#ef4444', tooltip: '10-30% participating. Narrow leadership, high divergence risk.' },
  { min: 0,  max: 9,   label: 'Capitulation',       color: '#991b1b', tooltip: '0-9% participating. Extreme weakness — potential washout or capitulation.' },
];

// ===========================================
// QUADRANT LABELS
// Momentum quadrant classification metadata for UI rendering
// ===========================================
export const QUADRANT_LABELS = {
  LEADING:    { label: 'Leading',    color: '#10b981', icon: 'trending-up',   narrative: 'Outperforming the market and accelerating. Strongest conviction zone.' },
  WEAKENING:  { label: 'Weakening',  color: '#f59e0b', icon: 'trending-down', narrative: 'Still ahead of the market but losing momentum. Watch for rotation.' },
  LAGGING:    { label: 'Lagging',    color: '#ef4444', icon: 'arrow-down',    narrative: 'Underperforming and decelerating. Avoid or reduce exposure.' },
  IMPROVING:  { label: 'Improving',  color: '#3b82f6', icon: 'arrow-up',      narrative: 'Behind the market but gaining momentum. Early rotation target.' },
  NEUTRAL:    { label: 'Neutral',    color: '#8b949e', icon: 'minus',         narrative: 'Tracking close to the benchmark. No strong directional signal.' },
};

// ===========================================
// INTERNAL CONFIG
// ===========================================
const CYCLICAL_SECTORS = ['XLK', 'XLY', 'XLI', 'XLF', 'XLE', 'XLB', 'XLC', 'XLRE'];
const DEFENSIVE_SECTORS = ['XLP', 'XLV', 'XLU'];

const QUADRANT_BUFFER = 0.25;
const MOMENTUM_X_WEIGHT = 1.5;
const MOMENTUM_Y_WEIGHT = 2.0;
const MOMENTUM_DIRECTION_THRESHOLD = 0.5;

// ===========================================
// TUNING CONSTANTS
// Named thresholds for scoring & classification
// ===========================================

// Leadership scoring weights (sum = 5.0 max)
const LEADERSHIP_HEALTH_WEIGHT = 3.0;
const LEADERSHIP_OUTPERFORM_WEIGHT = 1.5;
const LEADERSHIP_DEPTH_WEIGHT = 0.5;
const LEADERSHIP_MAX_DEPTH = 7;
const LEADERSHIP_MAX_SCORE = 5;

// Leadership health multipliers
const HEALTH_MULT_GOOD = 1.5;
const HEALTH_MULT_WARN = 1.0;
const HEALTH_MULT_BAD = 0.5;
const OUTPERFORM_MULT_YES = 1.2;
const OUTPERFORM_MULT_NO = 0.8;

// Gilded Cage detection
const GILDED_CAGE_LEADERSHIP_MIN = 4.0;
const GILDED_CAGE_BREADTH_MAX = 40;
const GILDED_CAGE_CRITICAL_THRESHOLD = 0.70;

// Regime thresholds
const REGIME_BREADTH_RISK_ON = 80;
const REGIME_BREADTH_RISK_OFF = 20;
const REGIME_BREADTH_CYCLICAL_MIN = 60;
const REGIME_BREADTH_CYCLICAL_MAX = 80;
const REGIME_BREADTH_DEFENSIVE_MIN = 25;
const REGIME_BREADTH_DEFENSIVE_MAX = 40;
const REGIME_BREADTH_MIXED_MIN = 45;
const REGIME_BREADTH_MIXED_MAX = 55;
const REGIME_DELTA_RISK_OFF = -3;
const REGIME_DELTA_MIXED_BAND = 1;
const REGIME_DELTA_FALLBACK = 1;
const REGIME_SECTORS_POSITIVE_MIN = 8;

// Confidence scoring
const CONFIDENCE_PERF_RANGE = 20;
const CONFIDENCE_PERF_MAX = 60;
const CONFIDENCE_BREADTH_MAX = 25;
const CONFIDENCE_ALIGNMENT_FULL = 15;
const CONFIDENCE_ALIGNMENT_PARTIAL = 7.5;
const CONFIDENCE_ALIGNMENT_THRESHOLD = 0.5;

// Price-Breadth divergence
const DIVERGENCE_BREADTH_LOW = 40;
const DIVERGENCE_BREADTH_HIGH = 60;

// ===========================================
// SAFE NUMBER HELPERS
// Guard against undefined, null, NaN, Infinity in sector data
// ===========================================

/** Returns value if it's a finite number, otherwise returns fallback */
function safeNum(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

/** Clamp a value between min and max */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Safe percent: finite number clamped to [0, 100] */
function safePercent(value) {
  return clamp(safeNum(value, 50), 0, 100);
}

/** Round to N decimal places */
function round(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ===========================================
// PER-SECTOR HELPERS
// Each function computes one derived metric from raw sector data
// ===========================================

/**
 * 1. Momentum Quadrant Classification
 * X-axis = relative 1M strength vs SPY
 * Y-axis = acceleration (change in relative momentum from 1M → 1W timeframe)
 *
 * @param {{ week1: number, month1: number }} sectorPerf
 * @param {{ week1: number, month1: number }} spy
 * @returns {{ quadrant: string, x: number, y: number, quadrantMeta: object }}
 */
function computeMomentumQuadrant(sectorPerf, spy) {
  const sW = safeNum(sectorPerf.week1);
  const sM = safeNum(sectorPerf.month1);
  const spyW = safeNum(spy.week1);
  const spyM = safeNum(spy.month1);

  // X = relative 1-month performance vs benchmark
  const x = round(sM - spyM, 2);
  // Y = change in relative momentum (1W relative minus 1M relative)
  const y = round((sW - spyW) - (sM - spyM), 2);

  let quadrant;
  if (x > QUADRANT_BUFFER && y > QUADRANT_BUFFER) {
    quadrant = 'LEADING';
  } else if (x > QUADRANT_BUFFER && y < -QUADRANT_BUFFER) {
    quadrant = 'WEAKENING';
  } else if (x < -QUADRANT_BUFFER && y < -QUADRANT_BUFFER) {
    quadrant = 'LAGGING';
  } else if (x < -QUADRANT_BUFFER && y > QUADRANT_BUFFER) {
    quadrant = 'IMPROVING';
  } else {
    quadrant = 'NEUTRAL';
  }

  return {
    quadrant,
    x,
    y,
    quadrantMeta: QUADRANT_LABELS[quadrant],
  };
}

/**
 * 2. Momentum Score (-10 to +10)
 * Weighted combination of relative strength (X) and acceleration (Y)
 *
 * @param {number} x - Relative 1M performance
 * @param {number} y - Momentum acceleration
 * @returns {number} Score in [-10, 10]
 */
function computeMomentumScore(x, y) {
  const raw = (x * MOMENTUM_X_WEIGHT) + (y * MOMENTUM_Y_WEIGHT);
  return round(clamp(raw, -10, 10), 1);
}

/**
 * 3. Momentum Direction
 * Compares short-term (1W) performance to medium-term (1M) to detect acceleration
 *
 * @param {{ week1: number, month1: number }} sectorPerf
 * @returns {{ direction: string, delta: number }}
 */
function computeMomentumDirection(sectorPerf) {
  const week = safeNum(sectorPerf.week1);
  const month = safeNum(sectorPerf.month1);
  const delta = round(week - month, 2);

  let direction;
  if (Math.abs(delta) <= MOMENTUM_DIRECTION_THRESHOLD) {
    direction = 'Steady';
  } else if (delta > MOMENTUM_DIRECTION_THRESHOLD) {
    direction = 'Accelerating';
  } else {
    direction = 'Decelerating';
  }

  return { direction, delta };
}

/**
 * 4. MA Position Label
 * Combines 50-day and 200-day SMA status into a trend label
 *
 * @param {{ above50SMA: boolean|null, above200SMA: boolean|null }} technicals
 * @returns {{ label: string, color: string }}
 */
function computeMAPositionLabel(technicals) {
  const a50 = technicals.above50SMA;
  const a200 = technicals.above200SMA;

  // Handle null/undefined MA data
  if (a50 == null || a200 == null) {
    return { label: 'Unknown', color: '#8b949e' };
  }

  if (a50 && a200)   return { label: 'Strong Uptrend', color: '#10b981' };
  if (!a50 && a200)  return { label: 'Pulling Back',   color: '#f59e0b' };
  if (a50 && !a200)  return { label: 'Recovering',     color: '#3b82f6' };
  return { label: 'Downtrend', color: '#ef4444' };
}

/**
 * 5. Breadth Tier Classification
 * Maps breadth percent to a named tier with color and tooltip
 *
 * @param {number} breadthPercent - 0 to 100
 * @returns {{ label: string, color: string, tooltip: string, percent: number }}
 */
function computeBreadthTier(breadthPercent) {
  const pct = safePercent(breadthPercent);
  const tier = BREADTH_TIERS.find(t => pct >= t.min && pct <= t.max);

  if (tier) {
    return { label: tier.label, color: tier.color, tooltip: tier.tooltip, percent: pct };
  }

  // Fallback — shouldn't happen with valid data
  return { label: 'Unknown', color: '#8b949e', tooltip: 'Breadth data unavailable.', percent: pct };
}

/**
 * 6. Price-Breadth Divergence Detection
 * Flags when price performance and underlying breadth disagree
 *
 * @param {{ month1: number }} performance
 * @param {number} breadthPercent
 * @returns {{ divergence: string, description: string }}
 */
function computePriceBreadthDivergence(performance, breadthPercent) {
  const m1 = safeNum(performance.month1);
  const pct = safePercent(breadthPercent);

  if (m1 > 0 && pct < DIVERGENCE_BREADTH_LOW) {
    return {
      divergence: 'bearish',
      description: 'Price is rising but fewer stocks are participating. Rally may be fragile.',
    };
  }

  if (m1 < 0 && pct > DIVERGENCE_BREADTH_HIGH) {
    return {
      divergence: 'bullish',
      description: 'Price is falling but breadth remains wide. Underlying strength suggests potential rebound.',
    };
  }

  return { divergence: 'none', description: '' };
}

/**
 * 7a. Leadership Score (0 to 5)
 * Derives a composite score from the leadership array (up to 7 top stocks)
 *
 * Scoring:
 *   - Healthy ratio (✅ / total) × 3.0  → max 3.0 pts (health quality)
 *   - Outperforming ratio × 1.5         → max 1.5 pts (alpha generation)
 *   - Depth bonus (total / 7) × 0.5     → max 0.5 pts (bench depth)
 *
 * @param {Array} leadership - From sectorDataService, sorted by relativePerformance desc
 * @returns {{ score: number, maxScore: number, healthy: number, outperforming: number, total: number }}
 */
function computeLeadershipScore(leadership) {
  if (!leadership || leadership.length === 0) {
    return { score: 0, maxScore: LEADERSHIP_MAX_SCORE, healthy: 0, outperforming: 0, total: 0 };
  }

  const total = leadership.length;
  const healthy = leadership.filter(l => l.healthStatus === '✅').length;
  const outperforming = leadership.filter(l => l.outperforming).length;

  const healthRatio = healthy / total;
  const outperformRatio = outperforming / total;
  const depthRatio = Math.min(total / LEADERSHIP_MAX_DEPTH, 1);

  const raw = (healthRatio * LEADERSHIP_HEALTH_WEIGHT) + (outperformRatio * LEADERSHIP_OUTPERFORM_WEIGHT) + (depthRatio * LEADERSHIP_DEPTH_WEIGHT);
  const score = round(clamp(raw, 0, LEADERSHIP_MAX_SCORE), 1);

  return { score, maxScore: LEADERSHIP_MAX_SCORE, healthy, outperforming, total };
}

/**
 * 7b. Gilded Cage Detection
 * Flags sectors where top leaders look strong but broad participation is weak.
 * This is a classic narrow-market warning: a few mega-caps masking sector weakness.
 *
 * Trigger: leadershipScore >= 4.0 AND breadthPercent < 40
 * Severity based on weighted leadership concentration
 *
 * @param {number} leadershipScore - 0 to 5
 * @param {number} breadthPercent - 0 to 100
 * @param {Array} leadership - Leadership array for weighted calc
 * @returns {{ detected: boolean, severity: string, description: string, weightedLeadership: number }}
 */
function computeGildedCage(leadershipScore, breadthPercent, leadership) {
  const detected = leadershipScore >= GILDED_CAGE_LEADERSHIP_MIN && breadthPercent < GILDED_CAGE_BREADTH_MAX;

  if (!detected) {
    return { detected: false, severity: 'none', description: '', weightedLeadership: 0 };
  }

  // Compute weighted leadership score
  // Position weight: leader at index 0 (highest relPerf) gets weight = N, last gets 1
  // Health multiplier: ✅ = 1.5, ⚠️ = 1.0, ❌ = 0.5
  // Outperformance multiplier: outperforming = 1.2, not = 0.8
  let weightedSum = 0;
  let maxPossible = 0;

  leadership.forEach((leader, index) => {
    const positionWeight = leadership.length - index;
    const healthMult = leader.healthStatus === '✅' ? HEALTH_MULT_GOOD :
                       leader.healthStatus === '⚠️' ? HEALTH_MULT_WARN : HEALTH_MULT_BAD;
    const outMult = leader.outperforming ? OUTPERFORM_MULT_YES : OUTPERFORM_MULT_NO;

    weightedSum += positionWeight * healthMult * outMult;
    maxPossible += positionWeight * HEALTH_MULT_GOOD * OUTPERFORM_MULT_YES;
  });

  const weightedLeadership = maxPossible > 0 ? round(weightedSum / maxPossible, 2) : 0;

  // CRITICAL if weighted leadership < 70% of max — means top names are carrying
  // the sector while second-tier names are faltering
  const severity = weightedLeadership < GILDED_CAGE_CRITICAL_THRESHOLD ? 'CRITICAL' : 'WARNING';

  const description = severity === 'CRITICAL'
    ? 'A few mega-cap leaders are masking broad sector weakness. High risk of sudden mean-reversion if top names falter.'
    : 'Leadership is concentrated while breadth thins. Monitor for cracks in top names.';

  return {
    detected: true,
    severity,
    description,
    weightedLeadership,
    breadthPercent,
    leadershipScore,
  };
}

// ===========================================
// GLOBAL METRIC HELPERS
// Compute market-wide regime from all 11 sectors
// ===========================================

/**
 * Average a numeric field across an array of sector objects
 * @param {Array} sectors - Sector data objects
 * @param {function} accessor - Function to extract the value from each sector
 * @returns {number} Average value
 */
function avgField(sectors, accessor) {
  const values = sectors.map(s => safeNum(accessor(s)));
  if (values.length === 0) return 0;
  return round(values.reduce((sum, v) => sum + v, 0) / values.length, 2);
}

/**
 * 8. Market Regime Classification
 *
 * Compares cyclical vs defensive sector performance and breadth to determine
 * the overall market posture.
 *
 * Rules:
 *   FULL_RISK_ON:       breadth > 80%, cyclicals win 1W AND 1M, 8+ sectors positive on 3M
 *   LEANING_CYCLICAL:   breadth 60-80%, cyclicals win on 1M
 *   MIXED:              breadth 45-55%, delta within ±1%
 *   LEANING_DEFENSIVE:  breadth 25-40%, defensives win 1W and 1M
 *   FULL_RISK_OFF:      breadth < 20%, defensives win by >3% delta on 1M and 3M
 *
 * @param {Object} sectorData - Full sector data keyed by ID
 * @returns {Object} Regime classification with supporting metrics
 */
function computeMarketRegime(sectorData) {
  const cyclicals = CYCLICAL_SECTORS.map(id => sectorData[id]).filter(Boolean);
  const defensives = DEFENSIVE_SECTORS.map(id => sectorData[id]).filter(Boolean);
  const allSectors = Object.values(sectorData).filter(Boolean);

  // Need minimum data to classify
  if (cyclicals.length === 0 || defensives.length === 0) {
    return {
      regime: 'UNKNOWN',
      label: 'Unknown',
      avgBreadth: 0,
      cyclicalPerf1W: 0, cyclicalPerf1M: 0, cyclicalPerf3M: 0,
      defensivePerf1W: 0, defensivePerf1M: 0, defensivePerf3M: 0,
      perfDelta1M: 0,
      sectorsPositive3M: 0,
    };
  }

  // Compute averages
  const cyclicalPerf1W = avgField(cyclicals, s => s.performance?.week1);
  const cyclicalPerf1M = avgField(cyclicals, s => s.performance?.month1);
  const cyclicalPerf3M = avgField(cyclicals, s => s.performance?.month3);
  const defensivePerf1W = avgField(defensives, s => s.performance?.week1);
  const defensivePerf1M = avgField(defensives, s => s.performance?.month1);
  const defensivePerf3M = avgField(defensives, s => s.performance?.month3);

  const avgBreadth = avgField(allSectors, s => s.breadth?.percent);

  // Performance deltas (positive = cyclicals leading)
  const delta1W = round(cyclicalPerf1W - defensivePerf1W, 2);
  const delta1M = round(cyclicalPerf1M - defensivePerf1M, 2);
  const delta3M = round(cyclicalPerf3M - defensivePerf3M, 2);

  // Count sectors with positive 3M performance
  const sectorsPositive3M = allSectors.filter(s => safeNum(s.performance?.month3) > 0).length;

  // Apply regime rules in order of specificity
  let regime;

  if (avgBreadth > REGIME_BREADTH_RISK_ON && delta1W > 0 && delta1M > 0 && sectorsPositive3M >= REGIME_SECTORS_POSITIVE_MIN) {
    regime = 'FULL_RISK_ON';
  } else if (avgBreadth < REGIME_BREADTH_RISK_OFF && delta1M < REGIME_DELTA_RISK_OFF && delta3M < REGIME_DELTA_RISK_OFF) {
    regime = 'FULL_RISK_OFF';
  } else if (avgBreadth >= REGIME_BREADTH_CYCLICAL_MIN && avgBreadth <= REGIME_BREADTH_CYCLICAL_MAX && delta1M > 0) {
    regime = 'LEANING_CYCLICAL';
  } else if (avgBreadth >= REGIME_BREADTH_DEFENSIVE_MIN && avgBreadth <= REGIME_BREADTH_DEFENSIVE_MAX && delta1W < 0 && delta1M < 0) {
    regime = 'LEANING_DEFENSIVE';
  } else if (avgBreadth >= REGIME_BREADTH_MIXED_MIN && avgBreadth <= REGIME_BREADTH_MIXED_MAX && Math.abs(delta1M) <= REGIME_DELTA_MIXED_BAND) {
    regime = 'MIXED';
  } else {
    // Fallback: classify by 1M performance delta direction
    if (delta1M > REGIME_DELTA_FALLBACK) regime = 'LEANING_CYCLICAL';
    else if (delta1M < -REGIME_DELTA_FALLBACK) regime = 'LEANING_DEFENSIVE';
    else regime = 'MIXED';
  }

  return {
    regime,
    label: formatRegimeLabel(regime),
    avgBreadth,
    cyclicalPerf1W, cyclicalPerf1M, cyclicalPerf3M,
    defensivePerf1W, defensivePerf1M, defensivePerf3M,
    perfDelta1M: delta1M,
    perfDelta1W: delta1W,
    perfDelta3M: delta3M,
    sectorsPositive3M,
  };
}

/** Human-readable regime label */
function formatRegimeLabel(regime) {
  const labels = {
    FULL_RISK_ON:      'Full Risk-On',
    LEANING_CYCLICAL:  'Leaning Cyclical',
    MIXED:             'Mixed / Transitioning',
    LEANING_DEFENSIVE: 'Leaning Defensive',
    FULL_RISK_OFF:     'Full Risk-Off',
    UNKNOWN:           'Unknown',
  };
  return labels[regime] || 'Unknown';
}

/**
 * 9. Confidence Ratio (0-100)
 * Measures conviction in the current regime classification.
 * 50 = neutral, >50 = risk-on favored, <50 = risk-off favored.
 *
 * @param {Object} regimeData - Output from computeMarketRegime
 * @returns {number} 0-100
 */
function computeConfidenceRatio(regimeData) {
  const { perfDelta1M, perfDelta1W, avgBreadth } = regimeData;
  const d1M = safeNum(perfDelta1M);
  const d1W = safeNum(perfDelta1W);
  const breadth = safeNum(avgBreadth, 50);

  // Performance component (0-CONFIDENCE_PERF_MAX range)
  const perfScore = clamp(((d1M + (CONFIDENCE_PERF_RANGE / 2)) / CONFIDENCE_PERF_RANGE) * CONFIDENCE_PERF_MAX, 0, CONFIDENCE_PERF_MAX);

  // Breadth component (0-CONFIDENCE_BREADTH_MAX range)
  const breadthScore = clamp((breadth / 100) * CONFIDENCE_BREADTH_MAX, 0, CONFIDENCE_BREADTH_MAX);

  // Short-term momentum confirmation (0-CONFIDENCE_ALIGNMENT_FULL range)
  const alignmentBonus = (d1W > 0 && d1M > 0) || (d1W < 0 && d1M < 0)
    ? CONFIDENCE_ALIGNMENT_FULL
    : Math.abs(d1W) < CONFIDENCE_ALIGNMENT_THRESHOLD ? CONFIDENCE_ALIGNMENT_PARTIAL : 0;

  return Math.round(clamp(perfScore + breadthScore + alignmentBonus, 0, 100));
}

/**
 * 10. Regime Weather Label & Description
 * Maps regime classification to a weather analogy and plain English narrative
 *
 * @param {string} regime - Regime ID from computeMarketRegime
 * @returns {{ weather: string, description: string }}
 */
function computeRegimeWeather(regime) {
  const weatherMap = {
    FULL_RISK_ON: {
      weather: 'Clear Skies',
      description: 'Broad risk appetite with cyclicals dominating. Favor growth, momentum, and offensive sectors.',
    },
    LEANING_CYCLICAL: {
      weather: 'Partly Sunny',
      description: 'Cyclicals leading but not uniformly. Selective opportunities in growth — stay alert for clouds.',
    },
    MIXED: {
      weather: 'Overcast',
      description: 'No clear leadership between offense and defense. Stay diversified and nimble.',
    },
    LEANING_DEFENSIVE: {
      weather: 'Cloudy',
      description: 'Defensives gaining the edge. Consider rotating toward stability and income.',
    },
    FULL_RISK_OFF: {
      weather: 'Stormy',
      description: 'Defensives dominating, risk aversion elevated. Prioritize capital preservation.',
    },
    UNKNOWN: {
      weather: 'Fog',
      description: 'Insufficient data to determine market regime. Proceed with caution.',
    },
  };

  return weatherMap[regime] || weatherMap.UNKNOWN;
}

// ===========================================
// PER-SECTOR ORCHESTRATOR
// Computes all derived metrics for a single sector
// ===========================================

/**
 * Compute all Money Map metrics for one sector
 *
 * @param {string} sectorId - ETF ticker (e.g., 'XLK')
 * @param {Object} sector - Full sector data from sectorDataService
 * @param {Object} spy - Normalized SPY benchmark { week1, month1, month3 }
 * @returns {Object} Complete per-sector Money Map metrics
 */
function computeSectorMetrics(sectorId, sector, spy) {
  const perf = sector.performance || {};
  const breadthPct = safePercent(sector.breadth?.percent);
  const technicals = sector.etfTechnicals || {};
  const leaders = sector.leadership || [];

  const quadrant = computeMomentumQuadrant(perf, spy);
  const momentumScore = computeMomentumScore(quadrant.x, quadrant.y);
  const momentumDirection = computeMomentumDirection(perf);
  const maPosition = computeMAPositionLabel(technicals);
  const breadthTier = computeBreadthTier(breadthPct);
  const priceBreadthDivergence = computePriceBreadthDivergence(perf, breadthPct);
  const leadershipResult = computeLeadershipScore(leaders);
  const gildedCage = computeGildedCage(leadershipResult.score, breadthPct, leaders);

  return {
    sectorId,
    name: sector.name || sectorId,
    quadrant,
    momentumScore,
    momentumDirection,
    maPosition,
    breadthTier,
    priceBreadthDivergence,
    leadershipScore: leadershipResult,
    gildedCage,
    classification: SECTOR_CLASSIFICATION[sectorId] || null,
  };
}

// ===========================================
// MAIN EXPORTED FUNCTION
// ===========================================

/**
 * Compute Money Map intelligence data for all sectors.
 *
 * Pure computation — no API calls, no side effects, no React dependencies.
 * Takes raw sector data (from sectorDataService.fetchAllSectorsData) and
 * SPY benchmark data, returns a comprehensive intelligence object with
 * per-sector derived metrics and global market regime classification.
 *
 * @param {Object} sectorData - Object keyed by sector ID (e.g., { XLK: {...}, XLV: {...} })
 *   Each sector should have: performance, breadth, etfTechnicals, leadership, trend, name
 * @param {Object} spyData - S&P 500 benchmark: { week1, month1, month3 }
 * @returns {{
 *   sectors: Object.<string, Object>,
 *   global: {
 *     regime: Object,
 *     confidence: number,
 *     weather: { weather: string, description: string },
 *     sectorCount: number,
 *     computedAt: number
 *   }
 * }}
 */
export function computeMoneyMapData(sectorData, spyData) {
  // Validate and normalize inputs
  const spy = {
    week1: safeNum(spyData?.week1),
    month1: safeNum(spyData?.month1),
    month3: safeNum(spyData?.month3),
  };

  const safeSectorData = sectorData || {};

  // Compute per-sector metrics
  const sectors = {};
  for (const [sectorId, sector] of Object.entries(safeSectorData)) {
    if (!sector) continue;
    sectors[sectorId] = computeSectorMetrics(sectorId, sector, spy);
  }

  // Compute global metrics
  const regime = computeMarketRegime(safeSectorData);
  const confidence = computeConfidenceRatio(regime);
  const weather = computeRegimeWeather(regime.regime);

  return {
    sectors,
    global: {
      regime,
      confidence,
      weather,
      sectorCount: Object.keys(sectors).length,
      computedAt: Date.now(),
    },
  };
}

// ===========================================
// DEFAULT EXPORT
// ===========================================
export default {
  computeMoneyMapData,
  SECTOR_CLASSIFICATION,
  BELLWETHER_MAP,
  HISTORICAL_RETURNS,
  BREADTH_TIERS,
  QUADRANT_LABELS,
};
