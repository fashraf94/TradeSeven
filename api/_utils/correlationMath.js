/**
 * Correlation Intelligence — pure correlation/regime math.
 *
 * Pure math module — no API calls, no caching, no Firebase, ZERO imports.
 * Mirrors the testable-helper convention of technicalCalculations.js /
 * returnCalculations.js: the endpoint imports this; the network stays out.
 *
 * ── Array-order contract (Build Spec V1.2, pinned) ──────────────────────────
 * Every function accepts OLDEST-FIRST (chronological) arrays: index 0 is the
 * earliest bar. This is the OPPOSITE of the repo's NEWEST-FIRST storage
 * convention — the endpoint adapter reverses exactly once at the fetch
 * boundary. No function in this module handles both orders.
 *
 * ── Index/date mapping contract (pinned) ────────────────────────────────────
 * Chronological closes[0..n-1] with parallel dates[0..n-1].
 * Return index i is defined by r_i = closes[i+1]/closes[i] − 1 (or diff mode):
 * return index i ENDS at close index i+1. A rolling-window statistic ending at
 * return index j therefore has closeIndex = j + 1 and eventDate = dates[j + 1].
 * Raw numeric index arrays never cross a function boundary — rolling entries
 * and episodes are objects carrying both closeIndex and eventDate. Forward
 * returns anchor exclusively on closeIndex.
 *
 * ── Numerical policy (pinned) ───────────────────────────────────────────────
 * Sample (n−1) divisor throughout (it cancels in Pearson and beta; consistency
 * is what matters). Insufficient or degenerate input (fewer observations than
 * required, ~zero variance, corrupt values) returns NULL, never 0 — a genuine
 * zero correlation must stay distinguishable from "no answer". This
 * deliberately differs from seasonRuleRegistry.js computeCorrelation (returns
 * a 0 sentinel); do not substitute one for the other.
 *
 * ── Resolutions baked into this module (reported at the Phase 1 checkpoint) ─
 * 1. "2 of last 3" persistence: observation i flags only when i is ITSELF a
 *    raw hit AND ≥2 of {i−2, i−1, i} are raw. The flag observation anchors
 *    direction/corr20AtFlag/score — flagging a quiet day could report a
 *    non-anomalous observation as the anomaly (and flip the direction sign).
 * 2. MAD == 0 ⇒ SDS is null: the observation can neither flag nor keep an
 *    episode open (degenerate → null rule).
 * 3. Episode semantics are a hysteresis band: the first flagged observation
 *    opens; the episode stays open through every observation with
 *    |SDS| ≥ SDS_EPISODE_END_THRESHOLD whether or not re-flagged (re-flags are
 *    absorbed); it closes at the last observation before |SDS| drops below the
 *    release threshold (or SDS becomes null). Still-open at series end closes
 *    at the final observation.
 * 4. Episode `score` = SDS at the flag observation (consistent with the other
 *    *AtFlag fields).
 * 5. Degenerate rolling windows are PRESERVED as entries with null stats
 *    (beta/value: null) so charts can gap the line — never a spike, never a
 *    dropped x-position.
 * 6. All returns/means/medians are decimal fractions (0.043 = +4.3%); the UI
 *    multiplies by 100 exactly once.
 */

// ── Pinned constants (Build Spec V1.2 parameter table) ──────────────────────
export const SDS_FLAG_THRESHOLD = 2.0;
export const SDS_EMERGENCY_THRESHOLD = 3.5;
export const SDS_EPISODE_END_THRESHOLD = 1.0;
/**
 * The one empirically-uncertain constant in the spec — the absolute divergence
 * floor. Calibrated in smoke (target: a handful of genuine regime breaks per
 * ~2 years; 0 flags → lower toward 0.20; >15 → raise toward 0.30). Kept as a
 * named export + detectInflections opts override, never a buried literal.
 */
export const ABS_DIVERGENCE_FLOOR = 0.25;
export const SDS_BASELINE_WINDOW = 120;

const LEAD_LAG_NO_SIGNAL = 0.15;
const LEAD_LAG_LAG0_MARGIN = 0.05;
const EPS = 1e-12;
const MAD_SCALE = 1.4826;

// ── Private helpers ─────────────────────────────────────────────────────────

function isFiniteNumberArray(a, minLen) {
  return Array.isArray(a) && a.length >= minLen && a.every((v) => Number.isFinite(v));
}

function mean(a) {
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}

/**
 * Median of a numeric array (copy-sorts; even length averages the two middle
 * values). Exported since the Build 4 review: the vol-regime split in
 * correlation.js needs the SAME median every other statistic in this stack
 * uses (one implementation per statistical concept — the pearson/SDS/OLS
 * rule), and exporting the existing helper beats a second inline copy.
 * NaN on an empty array — callers guard for non-empty input.
 */
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mad(a, med) {
  return median(a.map((v) => Math.abs(v - med)));
}

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// ── Exports ─────────────────────────────────────────────────────────────────

/**
 * Simple daily returns (or first differences) from OLDEST-FIRST closes.
 * mode 'pct':  r_i = closes[i+1]/closes[i] − 1
 * mode 'diff': r_i = closes[i+1] − closes[i]   (yield-like series, e.g. TNX)
 * Returns an array of length n−1, or null on corrupt input (<2 values,
 * non-finite values, unknown mode, or a zero denominator in pct mode) — a
 * null ELEMENT would silently poison every downstream window, so the whole
 * series nulls instead.
 */
export function computeReturnsSeries(closes, mode = 'pct') {
  if (!isFiniteNumberArray(closes, 2)) return null;
  if (mode !== 'pct' && mode !== 'diff') return null;
  const out = new Array(closes.length - 1);
  for (let i = 0; i < closes.length - 1; i++) {
    if (mode === 'pct') {
      if (closes[i] === 0) return null;
      out[i] = closes[i + 1] / closes[i] - 1;
    } else {
      out[i] = closes[i + 1] - closes[i];
    }
  }
  return out;
}

/**
 * Pearson correlation of two equal-length OLDEST-FIRST return arrays.
 * Sample-divisor convention (cancels). Null on mismatched/short input or
 * ~zero variance in either series; result clamped to [−1, 1] for fp drift.
 */
export function pearson(returnsA, returnsB) {
  if (!isFiniteNumberArray(returnsA, 2) || !isFiniteNumberArray(returnsB, 2)) return null;
  if (returnsA.length !== returnsB.length) return null;
  const mA = mean(returnsA);
  const mB = mean(returnsB);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < returnsA.length; i++) {
    const da = returnsA[i] - mA;
    const db = returnsB[i] - mB;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa < EPS || sbb < EPS) return null;
  return clamp1(sab / Math.sqrt(saa * sbb));
}

/**
 * Intra-group cohesion (V2 Build 5) — the mean pairwise Pearson correlation
 * among a group's OWN members over the trailing `window` returns. High = the
 * group trades as one bloc; low = several stories wearing one label. Driver-
 * independent by nature.
 *
 * @param {number[][]} memberReturns - aligned OLDEST-FIRST return arrays, one per
 *   member (one joined calendar → equal lengths; the endpoint guarantees non-null).
 * @param {number} window - trailing observation count (20 or 60).
 * @returns {{value:number, pairsUsed:number, pairsTotal:number}|null}
 *   value = mean over the NON-NULL pairs; pairsTotal = C(m,2); pairsUsed = pairs
 *   that yielded a finite Pearson. Null when fewer than 2 member arrays, or when
 *   every pair is insufficient/degenerate (pairsUsed === 0).
 *
 * The math minimum is 2 arrays (one pair). The PRODUCT policy that "cohesion
 * needs ≥ 3 members" lives at the endpoint (its memberCount ≥ 3 gate) — do NOT
 * tighten this guard to 3; the 2-member branch is endpoint-dead but unit-reachable.
 * Calls the one pearson (BUILD_RULES §4, never a second copy); an insufficient or
 * degenerate pair contributes NOTHING (never a 0) so a genuine zero pair-corr stays
 * distinguishable from "no answer" — the module's null-never-zero policy.
 */
export function pairwiseCohesion(memberReturns, window) {
  if (!Array.isArray(memberReturns) || memberReturns.length < 2) return null;
  if (!Number.isInteger(window) || window < 2) return null;
  const m = memberReturns.length;
  const pairsTotal = (m * (m - 1)) / 2; // C(m,2); integer since m(m−1) is even
  let sum = 0;
  let pairsUsed = 0;
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      // Trailing `window` of each aligned array. The length === window guard rejects
      // a short source (slice caps length) so no partial-window correlation leaks —
      // complementary to pearson's own ~zero-variance guard, which drops a degenerate
      // member's pairs. Both exclusions land in pairsUsed, never as a 0.
      const a = Array.isArray(memberReturns[i]) ? memberReturns[i].slice(-window) : [];
      const b = Array.isArray(memberReturns[j]) ? memberReturns[j].slice(-window) : [];
      const r = a.length === window && b.length === window ? pearson(a, b) : null;
      if (r != null) {
        sum += r;
        pairsUsed += 1;
      }
    }
  }
  return pairsUsed === 0 ? null : { value: sum / pairsUsed, pairsUsed, pairsTotal };
}

/**
 * Rolling Pearson correlation over full windows only (no partials).
 * `dates` is the chronological CLOSES-date array (length = returns.length + 1)
 * used to stamp eventDate = dates[j + 1] per the index/date mapping contract.
 * Entries for degenerate windows are PRESERVED with value: null (chart gaps).
 * Returns [] when the series is shorter than the window; null on invalid input.
 */
export function rollingCorrelation(returnsA, returnsB, window, dates) {
  if (!isFiniteNumberArray(returnsA, 1) || !isFiniteNumberArray(returnsB, 1)) return null;
  if (returnsA.length !== returnsB.length) return null;
  if (!Number.isInteger(window) || window < 2) return null;
  if (!Array.isArray(dates) || dates.length !== returnsA.length + 1) return null;
  const out = [];
  for (let j = window - 1; j < returnsA.length; j++) {
    const lo = j - window + 1;
    out.push({
      closeIndex: j + 1,
      eventDate: dates[j + 1],
      value: pearson(returnsA.slice(lo, j + 1), returnsB.slice(lo, j + 1)),
    });
  }
  return out;
}

/**
 * Classical OLS of group (dependent, y) on driver (independent, x) — WITH
 * intercept. Fresh implementation on purpose: momentumScoring's inline
 * residual math omits the intercept and is not classical beta (BUILD_RULES §4:
 * never copy; this module is the classical-OLS home).
 * → { beta, alpha, r, n } or null (mismatched/short input, ~zero driver
 * variance). r may be null (e.g. ~zero group variance) while beta is valid.
 */
export function olsBeta(returnsGroup, returnsDriver) {
  if (!isFiniteNumberArray(returnsGroup, 2) || !isFiniteNumberArray(returnsDriver, 2)) return null;
  if (returnsGroup.length !== returnsDriver.length) return null;
  const n = returnsGroup.length;
  const mX = mean(returnsDriver);
  const mY = mean(returnsGroup);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = returnsDriver[i] - mX;
    const dy = returnsGroup[i] - mY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx < EPS) return null;
  const beta = sxy / sxx;
  const alpha = mY - beta * mX;
  const r = syy < EPS ? null : clamp1(sxy / Math.sqrt(sxx * syy));
  return { beta, alpha, r, n };
}

/**
 * Rolling classical-OLS beta over full windows only, implemented by calling
 * olsBeta per window — no second regression implementation exists.
 * Variance guard (pinned): a window where the driver's return variance is ~0
 * yields an entry with beta: null (alpha/r null too) — the entry keeps its
 * closeIndex/eventDate so the chart gaps the line, never spikes it.
 * Each entry carries its own window r so the UI can de-emphasize low-r
 * windows (surfaced, not dropped).
 */
export function rollingBeta(returnsGroup, returnsDriver, window = 40, dates) {
  if (!isFiniteNumberArray(returnsGroup, 1) || !isFiniteNumberArray(returnsDriver, 1)) return null;
  if (returnsGroup.length !== returnsDriver.length) return null;
  if (!Number.isInteger(window) || window < 2) return null;
  if (!Array.isArray(dates) || dates.length !== returnsGroup.length + 1) return null;
  const out = [];
  for (let j = window - 1; j < returnsGroup.length; j++) {
    const lo = j - window + 1;
    const stats = olsBeta(returnsGroup.slice(lo, j + 1), returnsDriver.slice(lo, j + 1));
    out.push(
      stats
        ? { closeIndex: j + 1, eventDate: dates[j + 1], beta: stats.beta, alpha: stats.alpha, r: stats.r }
        : { closeIndex: j + 1, eventDate: dates[j + 1], beta: null, alpha: null, r: null }
    );
  }
  return out;
}

/**
 * Lead-lag scan over lags −maxLag..+maxLag.
 * Sign convention (pinned): POSITIVE lag k means the DRIVER LEADS the group by
 * k days — driver return at t−k is paired with group return at t.
 * Selection (pinned): bestLag = argmax |corr|, tie-broken (a) lag 0 wins
 * unless a nonzero lag's |corr| exceeds |lag0Corr| by ≥ 0.05, (b) smaller
 * |lag| wins, (c) exact ties break toward lag 0, then the positive lag.
 * verdict: 'none' unless |corrAtBestLag| ≥ 0.15, else 'coincident' /
 * 'driver_leads' / 'group_leads'. Table rows carry n = pair count; degenerate
 * rows keep corr: null and are excluded from selection. Null when lag-0 itself
 * is degenerate (tie-breaker (a) would be dishonest without it).
 */
export function leadLag(returnsGroup, returnsDriver, maxLag = 5) {
  if (!isFiniteNumberArray(returnsGroup, 2) || !isFiniteNumberArray(returnsDriver, 2)) return null;
  if (returnsGroup.length !== returnsDriver.length) return null;
  if (!Number.isInteger(maxLag) || maxLag < 0) return null;
  const n = returnsGroup.length;
  const table = [];
  for (let k = -maxLag; k <= maxLag; k++) {
    const m = Math.abs(k);
    const pairs = n - m;
    let corr = null;
    if (pairs >= 2) {
      corr =
        k >= 0
          ? pearson(returnsGroup.slice(k), returnsDriver.slice(0, pairs))
          : pearson(returnsGroup.slice(0, pairs), returnsDriver.slice(m));
    }
    table.push({ lag: k, corr, n: pairs });
  }
  const lag0Corr = table[maxLag].corr;
  if (lag0Corr === null) return null;
  const candidates = table
    .filter((row) => row.corr !== null)
    .sort(
      (a, b) =>
        Math.abs(b.corr) - Math.abs(a.corr) || Math.abs(a.lag) - Math.abs(b.lag) || b.lag - a.lag
    );
  let best = candidates[0];
  if (best.lag !== 0 && Math.abs(best.corr) < Math.abs(lag0Corr) + LEAD_LAG_LAG0_MARGIN) {
    best = table[maxLag];
  }
  let verdict;
  if (Math.abs(best.corr) < LEAD_LAG_NO_SIGNAL) verdict = 'none';
  else if (best.lag === 0) verdict = 'coincident';
  else if (best.lag > 0) verdict = 'driver_leads';
  else verdict = 'group_leads';
  return { verdict, bestLag: best.lag, corrAtBestLag: best.corr, lag0Corr, table };
}

/**
 * Standardized divergence score (SDS) for observation `i` of a divergence
 * series — the SAME robust statistic detectInflections flags on, exposed as a
 * pure function so callers (e.g. the endpoint's `divergence.latest`) can surface
 * the LATEST observation's SDS WITHOUT recomputing the math. BUILD_RULES §4:
 * one SDS implementation, never a copy — detectInflections calls this too.
 *
 * SDS_i = (d_i − median) / (1.4826 × MAD), median/MAD over the trailing
 * `baselineWindow` divergence observations EXCLUDING i (a robust baseline so one
 * fat-tailed shock can't inflate the denominator). NOT a z-score — never
 * presented as sigma evidence. Returns NULL ("unscoreable") when i has no full
 * trailing baseline (i < baselineWindow), the current or any baseline `d` is
 * non-finite, or MAD == 0 (degenerate → null, resolution 2).
 */
export function standardizedDivergenceScore(divergenceSeries, i, opts = {}) {
  const { baselineWindow = SDS_BASELINE_WINDOW } = opts;
  if (!Array.isArray(divergenceSeries)) return null;
  const d = divergenceSeries[i]?.d;
  if (!Number.isInteger(i) || i < baselineWindow || !Number.isFinite(d)) return null;
  const base = [];
  for (let k = i - baselineWindow; k < i; k++) {
    const v = divergenceSeries[k]?.d;
    if (!Number.isFinite(v)) return null; // baseline gap → unscoreable
    base.push(v);
  }
  const med = median(base);
  const denom = MAD_SCALE * mad(base, med);
  if (denom < EPS) return null; // MAD == 0 → unscoreable (resolution 2)
  return (d - med) / denom;
}

/**
 * Correlation-regime inflection detection over a caller-built divergence
 * series [{ closeIndex, eventDate, d, corr20, corr60 }] (chronological,
 * entries only where BOTH windows exist, aligned by closeIndex).
 *
 * Score (pinned): standardizedDivergenceScore — NOT a z-score, never presented
 * as sigma evidence. SDS_t = (d_t − median) / (1.4826 × MAD), median/MAD over
 * the trailing `baselineWindow` divergence observations EXCLUDING the current
 * day (a robust baseline so one fat-tailed shock can't inflate the denominator
 * and suppress subsequent detection).
 *
 * Flag (pinned): |SDS| ≥ flagSds AND |d| ≥ absFloor on 2 of the last 3
 * observations (the current one included and itself required to qualify —
 * resolution 1 in the header), OR single-day |SDS| ≥ emergencySds with
 * |d| ≥ absFloor. Episodes collapse per the hysteresis band (resolution 3).
 *
 * Returns episodes [{ startCloseIndex, startDate, endCloseIndex, endDate,
 * direction, corr20AtFlag, corr60AtFlag, score }]; [] when nothing flags or
 * the series is too short to score; null on non-array input.
 */
export function detectInflections(divergenceSeries, opts = {}) {
  if (!Array.isArray(divergenceSeries)) return null;
  const {
    flagSds = SDS_FLAG_THRESHOLD,
    emergencySds = SDS_EMERGENCY_THRESHOLD,
    releaseSds = SDS_EPISODE_END_THRESHOLD,
    absFloor = ABS_DIVERGENCE_FLOOR,
    baselineWindow = SDS_BASELINE_WINDOW,
  } = opts;
  const len = divergenceSeries.length;

  // Pass 1 — per-observation SDS + raw/emergency qualification. The SDS math is
  // the shared standardizedDivergenceScore helper (single source of truth): a
  // null return reproduces every original skip (i < baselineWindow, non-finite
  // current/baseline d, or MAD == 0), so when score !== null the current d is
  // finite and the floor check is safe.
  const sds = new Array(len).fill(null);
  const raw = new Array(len).fill(false);
  const emerg = new Array(len).fill(false);
  for (let i = 0; i < len; i++) {
    const score = standardizedDivergenceScore(divergenceSeries, i, { baselineWindow });
    if (score === null) continue;
    sds[i] = score;
    const abs = Math.abs(score);
    const floorOk = Math.abs(divergenceSeries[i].d) >= absFloor;
    raw[i] = abs >= flagSds && floorOk;
    emerg[i] = abs >= emergencySds && floorOk;
  }

  // Pass 2 — flag determination (persistence; emergency exempt).
  const flagged = new Array(len).fill(false);
  for (let i = 0; i < len; i++) {
    if (emerg[i]) {
      flagged[i] = true;
      continue;
    }
    if (!raw[i]) continue;
    let count = 0;
    for (let k = Math.max(0, i - 2); k <= i; k++) if (raw[k]) count++;
    flagged[i] = count >= 2;
  }

  // Pass 3 — hysteresis episode state machine.
  const episodes = [];
  let open = null;
  const closeEpisode = (o, endIdx) => {
    const start = divergenceSeries[o.startIdx];
    const end = divergenceSeries[endIdx];
    episodes.push({
      startCloseIndex: start.closeIndex,
      startDate: start.eventDate,
      endCloseIndex: end.closeIndex,
      endDate: end.eventDate,
      direction: start.d < 0 ? 'weakening' : 'strengthening', // d = 0 can't flag (floor)
      corr20AtFlag: start.corr20,
      corr60AtFlag: start.corr60,
      score: o.score,
    });
  };
  for (let i = 0; i < len; i++) {
    const active = sds[i] !== null && Math.abs(sds[i]) >= releaseSds;
    if (!open) {
      if (flagged[i]) open = { startIdx: i, score: sds[i] };
    } else if (!active) {
      // A non-active observation can never itself flag (flag needs ≥ flagSds),
      // so closing here can't race a same-observation reopen.
      closeEpisode(open, i - 1);
      open = null;
    }
  }
  if (open) closeEpisode(open, len - 1); // still open at series end (resolution 3)
  return episodes;
}

/**
 * Forward returns from episode anchors over OLDEST-FIRST closes/dates.
 * Formula (pinned): for episode start closeIndex c and horizon h,
 * fwd = closes[c + h] / closes[c] − 1. Episodes with c + h beyond the last
 * close are EXCLUDED from that horizon (never zero-filled).
 * Aggregation (pinned): NON-OVERLAPPING only — chronological walk; an episode
 * enters the aggregate only if its window [c, c + h] does not overlap the
 * window of the last AGGREGATED episode (first-in wins; rejected episodes
 * never advance the boundary). Clustered breaks from one macro event count
 * once. hitRate = strict fraction > 0 over the independent set (0 is a miss).
 * Per horizon: { eligibleCount, independentCount, mean, median, hitRate,
 * details } — details lists ALL eligible episodes (not deduplicated), each
 * with an `independent` marker. Null on invalid input. Rows whose forward
 * return is non-finite (zero base close) are excluded from that horizon.
 */
export function forwardReturns(closes, dates, episodes, horizons = [5, 10, 20]) {
  if (!isFiniteNumberArray(closes, 2)) return null;
  if (!Array.isArray(dates) || dates.length !== closes.length) return null;
  if (!Array.isArray(episodes)) return null;
  if (!Array.isArray(horizons) || horizons.length === 0) return null;
  if (!horizons.every((h) => Number.isInteger(h) && h >= 1)) return null;

  const ordered = [...episodes].sort((a, b) => a.startCloseIndex - b.startCloseIndex);
  const out = {};
  for (const h of horizons) {
    const details = [];
    for (const ep of ordered) {
      const c = ep?.startCloseIndex;
      if (!Number.isInteger(c) || c < 0 || c + h > closes.length - 1) continue;
      const fwd = closes[c + h] / closes[c] - 1;
      if (!Number.isFinite(fwd)) continue;
      details.push({
        startCloseIndex: c,
        startDate: ep.startDate,
        direction: ep.direction,
        exitDate: dates[c + h],
        fwdReturn: fwd,
        independent: false,
      });
    }
    let lastEnd = -Infinity;
    for (const row of details) {
      if (row.startCloseIndex > lastEnd) {
        row.independent = true;
        lastEnd = row.startCloseIndex + h;
      }
    }
    const ind = details.filter((r) => r.independent).map((r) => r.fwdReturn);
    out[h] = {
      eligibleCount: details.length,
      independentCount: ind.length,
      mean: ind.length ? mean(ind) : null,
      median: ind.length ? median(ind) : null,
      hitRate: ind.length ? ind.filter((v) => v > 0).length / ind.length : null,
      details,
    };
  }
  return out;
}

/**
 * Rolling sample standard deviation over full windows only (V2 Build 4 —
 * the vol-regime condition's raw series). Same rolling conventions as
 * rollingCorrelation/rollingBeta: OLDEST-FIRST returns, `dates` is the
 * chronological CLOSES-date array (length = returns.length + 1), entries carry
 * closeIndex = j + 1 / eventDate = dates[j + 1] for the window ENDING at
 * return index j, sample (n−1) divisor, [] when the series is shorter than
 * the window, null on invalid input. Degenerate windows are PRESERVED as
 * entries with value: null (never dropped, never zero) — with finite inputs
 * this branch is unreachable (a sample std of finite values is finite, and 0
 * is a legitimate quiet-window reading, not a degenerate one), but the guard
 * keeps the null-never-zero contract explicit for future callers.
 */
export function rollingStd(returns, window, dates) {
  if (!isFiniteNumberArray(returns, 1)) return null;
  if (!Number.isInteger(window) || window < 2) return null;
  if (!Array.isArray(dates) || dates.length !== returns.length + 1) return null;
  const out = [];
  for (let j = window - 1; j < returns.length; j++) {
    const win = returns.slice(j - window + 1, j + 1);
    const m = mean(win);
    let ss = 0;
    for (const v of win) ss += (v - m) * (v - m);
    const sd = Math.sqrt(ss / (window - 1));
    out.push({
      closeIndex: j + 1,
      eventDate: dates[j + 1],
      value: Number.isFinite(sd) ? sd : null,
    });
  }
  return out;
}

/**
 * Pearson correlation restricted to the observations where mask[i] === true
 * (STRICT true — truthy non-booleans do not select; the mask is a built
 * artifact, never coerced data). Mask semantics: same index space as the two
 * return arrays; the CALLER builds masks (V2 Build 4 — the conditional-
 * correlation sides). Implemented by extracting the masked pairs and calling
 * pearson — one Pearson implementation exists in this codebase's correlation
 * stack (BUILD_RULES §4).
 *
 * → { corr, n } where n = the masked pair count, or NULL when n < minN
 * (the caller's observation floor; defaults to Pearson's own minimum of 2),
 * when the masked subset is degenerate (~zero variance on either side), or on
 * invalid/mismatched input. Null, never zero — an insufficient side must stay
 * distinguishable from a genuinely uncorrelated one.
 */
export function maskedPearson(returnsA, returnsB, mask, minN = 2) {
  if (!isFiniteNumberArray(returnsA, 1) || !isFiniteNumberArray(returnsB, 1)) return null;
  if (returnsA.length !== returnsB.length) return null;
  if (!Array.isArray(mask) || mask.length !== returnsA.length) return null;
  if (!Number.isInteger(minN) || minN < 2) return null;
  const subA = [];
  const subB = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === true) {
      subA.push(returnsA[i]);
      subB.push(returnsB[i]);
    }
  }
  if (subA.length < minN) return null;
  const corr = pearson(subA, subB);
  if (corr === null) return null;
  return { corr, n: subA.length };
}

/**
 * Side-vs-side comparison for conditional correlation (V2 Build 4).
 *
 * THE HONESTY CORE: conditioning on a subset mechanically shrinks measured
 * correlation on BOTH sides even when the true relationship is perfectly
 * symmetric — restricting the driver's range truncates its variance, and
 * correlation within a truncated range is smaller. Side-vs-side is therefore
 * the ONLY honest comparison; either side vs the full-sample number is a
 * systematic misread. This function compares sides to each other and to
 * nothing else.
 *
 * Asymmetry floor (pinned, 0.15): at ~250 obs/side and mid-range r, the
 * sampling SE of the difference of two side correlations is ≈ 0.07, so
 * sub-0.15 differences are noise-class — the floor sits at ~2 SE. An
 * inferential upgrade (Fisher-z) is a documented future refinement, not
 * V2 Build 4 scope.
 *
 * Display agreement (the H5 rounding-family rule, commit 8395606 precedent):
 * the verdict is decided on the 2dp-ROUNDED corrs — the SAME values the UI
 * prints (fmtCorr = toFixed(2)) — so the chip word can never contradict the
 * displayed numbers at the floor edge (raw 0.5951 vs 0.4549 displays as
 * +0.60 / +0.45, a visible 0.15 gap, and must read asymmetric even though the
 * raw difference is 0.1402). The shift in the effective raw floor is < 0.005 —
 * inside the heuristic's own precision. The small epsilon absorbs IEEE-754
 * representation error in the rounded difference (0.60 − 0.45 must clear a
 * 0.15 floor whichever side of the true value both doubles land on).
 *
 * Sign flip (pinned addition — founder decision, pre-PR): when the link is
 * meaningfully POSITIVE on one side and meaningfully NEGATIVE on the other, it
 * has REVERSED direction between the two subsets, not merely tightened. This
 * is a distinct, honest verdict — "tighter on {side}" would hide the reversal.
 * A flip is the one comparison that SURVIVES the truncation caveat: subsetting
 * shrinks |r| on both sides but never flips its SIGN, so an opposite-sign
 * split is a real regime effect, not a range-restriction artifact. Guarded so
 * a pair merely straddling zero on noise is NOT a flip — BOTH sides must
 * themselves clear the floor as a level (|corr| ≥ floor: the SAME 0.15 that is
 * the "is there a link at all" line elsewhere in the stack), so e.g. +0.02
 * (no link) vs −0.31 stays a "tighter" case, not a fabricated reversal. On a
 * flip, direction is null — neither side is "tighter"; the UI renders reversal
 * copy instead.
 *
 * @param {{corr: number, n: number}|null} sideA - a maskedPearson result
 * @param {{corr: number, n: number}|null} sideB - a maskedPearson result
 * @param {number} [floor=0.15] - the pinned asymmetry floor (also the per-side
 *   level a flip requires — one tunable, both roles move together)
 * @returns {{asymmetric: boolean, direction: ('A'|'B'|null), flipped: boolean}|null}
 *   null when either side is null (no comparison exists — never a fabricated
 *   verdict). asymmetric is true only at |corrA − corrB| ≥ floor (2dp-rounded,
 *   per the display-agreement rule). flipped is true for a meaningful sign
 *   reversal (both sides opposite-signed and each |corr| ≥ floor). direction =
 *   the LARGER-|corr| side (the side where the link is tighter; for inverse
 *   links that is the more-negative side), and is null when not asymmetric,
 *   when flipped (no side is "tighter"), or at the equal-rounded-magnitude
 *   same-direction edge.
 */
const FLOOR_EPS = 1e-9; // fp guard for the quantized 2dp comparison only

export function compareConditionalSides(sideA, sideB, floor = 0.15) {
  if (sideA == null || sideB == null) return null;
  if (!Number.isFinite(sideA.corr) || !Number.isFinite(sideB.corr)) return null;
  if (!Number.isFinite(floor) || floor < 0) return null;
  const a = Number(sideA.corr.toFixed(2));
  const b = Number(sideB.corr.toFixed(2));
  const asymmetric = Math.abs(a - b) >= floor - FLOOR_EPS;
  const flipped =
    asymmetric &&
    (a < 0) !== (b < 0) &&
    Math.abs(a) >= floor - FLOOR_EPS &&
    Math.abs(b) >= floor - FLOOR_EPS;
  let direction = null;
  if (asymmetric && !flipped && Math.abs(a) !== Math.abs(b)) {
    direction = Math.abs(a) > Math.abs(b) ? 'A' : 'B';
  }
  return { asymmetric, direction, flipped };
}

/**
 * Trailing return INTO an anchor close index `c` — the forwardReturns formula
 * pointed backward: levels[c] / levels[c − look] − 1, the `look`-session move
 * leading into a regime-break flag. OLDEST-FIRST levels (composite levels or
 * scaled driver closes). Returns NULL when there is no trailing window
 * (c < look) or a level is non-finite / the base level is zero — never zero.
 */
export function trailingReturnInto(levels, c, look = 5) {
  if (!Array.isArray(levels)) return null;
  if (!Number.isInteger(c) || !Number.isInteger(look) || look < 1 || c < look) return null;
  const base = levels[c - look];
  const cur = levels[c];
  if (!Number.isFinite(base) || !Number.isFinite(cur) || base === 0) return null;
  const v = cur / base - 1;
  return Number.isFinite(v) ? v : null;
}

// ── V3 Phase 1 — relationship-quality metrics (Bucket B) ─────────────────────
// All seven are PURE and reuse the module's existing statistical concepts
// (pearson / olsBeta / median) rather than reinlining them — BUILD_RULES §4,
// one implementation per concept. Null-never-zero throughout: an insufficient
// or degenerate read stays distinguishable from a genuine 0.

/**
 * Member contribution (leave-one-out) — which member IS the relationship.
 * The group composite is an EQUAL-WEIGHT mean of member returns
 * (correlationAssembly.js), so removing member k re-means over the other m−1.
 * For each member: corrDelta_k = full − corr(group_without_k, driver) and
 * betaDelta_k = full − beta(group_without_k, driver) — the drop in the link
 * when that name is taken out (positive = the name was HOLDING UP the link).
 *
 * All statistics are the trailing `window` returns so `full.corr` equals the
 * headline corr(window) BY CONSTRUCTION (both are pearson of the same trailing
 * slices) — display-agreement (§9). Default window 60 aligns with corr60.
 * Beta is reported at the SAME window (label it by that window, never the
 * rolling-40 headline beta). CALLS pearson (:pearson) and olsBeta (:olsBeta).
 *
 * @param {number[][]} memberReturns - aligned OLDEST-FIRST per-member returns
 * @param {number[]} driverReturns - aligned OLDEST-FIRST driver returns
 * @param {number} [window=60] - trailing observation count
 * @param {{minMembers?:number}} [opts]
 * @returns {{full:{corr:number|null,beta:number|null}, members:Array<{index:number,corrDelta:number|null,betaDelta:number|null}>, window:number, n:number}|null}
 *   Null below minMembers (a 2-member "contribution" is one pair wearing a
 *   grand name), on a short/ragged driver series, or when the trailing window
 *   doesn't fit. Per-member deltas null (never 0) when a side is degenerate.
 */
export function memberContribution(memberReturns, driverReturns, window = 60, opts = {}) {
  const { minMembers = 3 } = opts;
  if (!Array.isArray(memberReturns) || memberReturns.length < minMembers) return null;
  if (!isFiniteNumberArray(driverReturns, 2)) return null;
  if (!Number.isInteger(window) || window < 2 || driverReturns.length < window) return null;
  const m = memberReturns.length;
  for (const mr of memberReturns) {
    if (!isFiniteNumberArray(mr, 2) || mr.length !== driverReturns.length) return null;
  }
  const dWin = driverReturns.slice(-window);
  const memberWins = memberReturns.map((mr) => mr.slice(-window));
  const groupOf = (skip) => {
    const denom = skip == null ? m : m - 1;
    return dWin.map((_, t) => {
      let s = 0;
      for (let k = 0; k < m; k++) if (k !== skip) s += memberWins[k][t];
      return s / denom;
    });
  };
  const fullGroup = groupOf(null);
  const fullCorr = pearson(fullGroup, dWin);
  const fullBetaObj = olsBeta(fullGroup, dWin);
  const fullBeta = fullBetaObj ? fullBetaObj.beta : null;
  const members = [];
  for (let k = 0; k < m; k++) {
    const looGroup = groupOf(k);
    const looCorr = pearson(looGroup, dWin);
    const looBetaObj = olsBeta(looGroup, dWin);
    const looBeta = looBetaObj ? looBetaObj.beta : null;
    members.push({
      index: k,
      corrDelta: fullCorr != null && looCorr != null ? fullCorr - looCorr : null,
      betaDelta: fullBeta != null && looBeta != null ? fullBeta - looBeta : null,
    });
  }
  return { full: { corr: fullCorr, beta: fullBeta }, members, window, n: window };
}

/**
 * SPY-adjusted partial correlation — the closed form for r(group,driver | SPY)
 * from the three pairwise correlations: (rGD − rGS·rDS)/√((1−rGS²)(1−rDS²)).
 * This surfaces the market-beta contamination raw correlation hides (§6):
 * "how linked once the S&P's shared move is removed."
 *
 * PURE ARITHMETIC — it does NOT recompute any correlation (the caller passes
 * pearson outputs measured on ONE shared sample; that same-sample discipline
 * lives in partialCorrelationWindows). Suppressed when |rDS| > maxDriverMarket
 * (the driver IS the market — adjusting for SPY is meaningless, not a number to
 * print). corr:null with NO tag when an input is non-finite / out of range or
 * the denominator underflows (covers the group-is-market |rGS|→1 degenerate).
 *
 * @param {number} rGD @param {number} rGS @param {number} rDS
 * @param {{maxDriverMarket?:number}} [opts]
 * @returns {{corr:number|null, suppressed:('driver_is_market'|null)}}
 */
export function partialCorrelationSPY(rGD, rGS, rDS, opts = {}) {
  const { maxDriverMarket = 0.9 } = opts;
  if (![rGD, rGS, rDS].every((v) => Number.isFinite(v))) return { corr: null, suppressed: null };
  if (Math.abs(rGS) > 1 || Math.abs(rDS) > 1 || Math.abs(rGD) > 1) return { corr: null, suppressed: null };
  if (Math.abs(rDS) > maxDriverMarket) return { corr: null, suppressed: 'driver_is_market' };
  const denom = Math.sqrt((1 - rGS * rGS) * (1 - rDS * rDS));
  if (!Number.isFinite(denom) || denom < EPS) return { corr: null, suppressed: null };
  return { corr: clamp1((rGD - rGS * rDS) / denom), suppressed: null };
}

/**
 * Per-window SPY-adjusted partial correlation, owning the SAME-SAMPLE
 * discipline the closed form requires: rGD, rGS and rDS must be measured on
 * ONE aligned subset. `spyReturns` (from projectAlignedReturns) may carry
 * per-index nulls where SPY lacks a session on the driver's joined calendar;
 * per window we keep only indices where ALL THREE are finite, then compute the
 * three pearsons on that identical subset and adjust. `raw` is rGD on that
 * shared subset, so raw and adjusted are one sample by construction (§9) — and
 * when SPY covers every session `raw` equals the headline corr(window) exactly.
 *
 * @param {number[]} groupReturns @param {number[]} driverReturns
 * @param {Array<number|null>} spyReturns - same index space; per-index null allowed
 * @param {number[]} [windows=[20,60]]
 * @returns {{[key:string]:{raw:number|null,adjusted:number|null,n:number,suppressed:(string|null)}}|null}
 *   keys are `w20`/`w60`; null on ragged/invalid input.
 */
export function partialCorrelationWindows(groupReturns, driverReturns, spyReturns, windows = [20, 60]) {
  if (!isFiniteNumberArray(groupReturns, 1) || !isFiniteNumberArray(driverReturns, 1)) return null;
  if (!Array.isArray(spyReturns)) return null;
  if (groupReturns.length !== driverReturns.length || spyReturns.length !== groupReturns.length) return null;
  if (!Array.isArray(windows) || windows.length === 0) return null;
  const out = {};
  for (const w of windows) {
    const key = `w${w}`;
    if (!Number.isInteger(w) || w < 2) {
      out[key] = { raw: null, adjusted: null, n: 0, suppressed: null };
      continue;
    }
    const gWin = groupReturns.slice(-w);
    const dWin = driverReturns.slice(-w);
    const sWin = spyReturns.slice(-w);
    const g = [];
    const d = [];
    const s = [];
    for (let i = 0; i < gWin.length; i++) {
      if (Number.isFinite(gWin[i]) && Number.isFinite(dWin[i]) && Number.isFinite(sWin[i])) {
        g.push(gWin[i]);
        d.push(dWin[i]);
        s.push(sWin[i]);
      }
    }
    // Full-window discipline (the rollingCorrelation / pairwiseCohesion rule):
    // only a COMPLETE trailing window is reported. This guarantees `raw` equals
    // the headline corr(window) by construction (§9) and prevents a thin-history
    // window (fewer than w base returns) or a gappy SPY series from surfacing a
    // sub-window number mislabeled w20/w60. g.length can only be ≤ w.
    if (g.length < w) {
      out[key] = { raw: null, adjusted: null, n: g.length, suppressed: null };
      continue;
    }
    const rGD = pearson(g, d);
    const rGS = pearson(g, s);
    const rDS = pearson(d, s);
    const adj = partialCorrelationSPY(rGD, rGS, rDS);
    out[key] = { raw: rGD, adjusted: adj.corr, n: g.length, suppressed: adj.suppressed };
  }
  return out;
}

/**
 * Self-percentile — where the LATEST value of a rolling series sits within that
 * same series' own history: "today's link is in the Nth percentile of its own
 * past." Operates on the SIGNED value (matches the signed correlation chart —
 * a −0.8 and a +0.8 sit at opposite ends). `series` is a rollingCorrelation /
 * rollingStd output (`[{value}]`); `latest` is the last non-null value, so it
 * equals the number the chart/headline shows (§9).
 *
 * percentile = 100 · (#non-null ≤ latest) / (#non-null), latest inclusive, so
 * the result is in (0, 100]. Null below minObs non-null observations or when
 * the latest value is null.
 *
 * @param {Array<{value:(number|null)}>} series
 * @param {{minObs?:number}} [opts]
 * @returns {{percentile:number, n:number, latest:number}|null}
 */
export function selfPercentile(series, opts = {}) {
  const { minObs = 2 } = opts;
  if (!Array.isArray(series) || series.length === 0) return null;
  const values = [];
  for (const e of series) {
    const v = e?.value;
    if (Number.isFinite(v)) values.push(v);
  }
  // `latest` is the LAST ENTRY's value — the SAME number latestValue() feeds the
  // headline — so the percentile's "today" reading can never diverge from the
  // displayed corr (§9). A degenerate/absent last window (value null) has no
  // reading today → null, exactly as the headline then renders "—".
  const latest = series[series.length - 1]?.value;
  if (!Number.isFinite(latest) || values.length < minObs) return null;
  const countLe = values.reduce((acc, v) => acc + (v <= latest ? 1 : 0), 0);
  return { percentile: (100 * countLe) / values.length, n: values.length, latest };
}

/**
 * Classical OLS beta restricted to the observations where mask[i] === true —
 * the beta analogue of maskedPearson. Extracts the masked pairs and CALLS
 * olsBeta (BUILD_RULES §4: the one classical-OLS home), so { beta, alpha, r, n }
 * carries the same variance-guard/null-never-zero semantics. Null when the
 * masked subset is smaller than minN or degenerate.
 */
export function maskedBeta(returnsGroup, returnsDriver, mask, minN = 2) {
  if (!isFiniteNumberArray(returnsGroup, 1) || !isFiniteNumberArray(returnsDriver, 1)) return null;
  if (returnsGroup.length !== returnsDriver.length) return null;
  if (!Array.isArray(mask) || mask.length !== returnsGroup.length) return null;
  if (!Number.isInteger(minN) || minN < 2) return null;
  const subG = [];
  const subD = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === true) {
      subG.push(returnsGroup[i]);
      subD.push(returnsDriver[i]);
    }
  }
  if (subG.length < minN) return null;
  return olsBeta(subG, subD);
}

const CAPTURE_FLOOR_EPS = 1e-9; // fp guard for the quantized 2dp comparison
// A relative-gap claim needs at least this much ABSOLUTE 2dp beta difference so
// near-zero betas (0.04 vs 0.03) can't manufacture a 25% "asymmetry" out of
// rounding noise — 0.05 is 5 hundredths, well above the ±0.005 quantization.
const CAPTURE_REL_MIN_ABS = 0.05;

/**
 * Down-capture vs up-capture comparison — the beta analogue of
 * compareConditionalSides, decided on the DISPLAY-ROUNDED betas (toFixed(2),
 * the fmtBeta rounding) so the chip word can never contradict the printed
 * numbers (§9). Betas are unbounded, so "asymmetric" fires when the absolute
 * gap clears absFloor OR the relative gap clears relFloor (the latter guarded
 * by CAPTURE_REL_MIN_ABS against near-zero-beta noise). No sign-"flip" concept:
 * a negative capture beta is meaningful but not a truncation-safe reversal
 * claim, so it stays out. direction = the larger-|beta| side (null when equal
 * magnitude or not asymmetric).
 *
 * @param {{beta:number,n:number}|null} sideDown - maskedBeta over driver-down days
 * @param {{beta:number,n:number}|null} sideUp - maskedBeta over driver-up days
 * @param {{absFloor?:number, relFloor?:number}} [opts]
 * @returns {{asymmetric:boolean, direction:('down'|'up'|null), betaDown:number, betaUp:number, nDown:number, nUp:number}|null}
 *   null when either side is null (no comparison — never a fabricated verdict).
 */
export function compareCaptureSides(sideDown, sideUp, opts = {}) {
  const { absFloor = 0.2, relFloor = 0.25 } = opts;
  if (sideDown == null || sideUp == null) return null;
  if (!Number.isFinite(sideDown.beta) || !Number.isFinite(sideUp.beta)) return null;
  if (!Number.isFinite(absFloor) || absFloor < 0 || !Number.isFinite(relFloor) || relFloor < 0) return null;
  const bd = Number(sideDown.beta.toFixed(2));
  const bu = Number(sideUp.beta.toFixed(2));
  const absGap = Math.abs(bd - bu);
  const maxMag = Math.max(Math.abs(bd), Math.abs(bu));
  const relGap = maxMag > 0 ? absGap / maxMag : 0;
  const relQualifies = relGap >= relFloor - CAPTURE_FLOOR_EPS && absGap >= CAPTURE_REL_MIN_ABS - CAPTURE_FLOOR_EPS;
  const asymmetric = absGap >= absFloor - CAPTURE_FLOOR_EPS || relQualifies;
  let direction = null;
  if (asymmetric && Math.abs(bd) !== Math.abs(bu)) {
    direction = Math.abs(bd) > Math.abs(bu) ? 'down' : 'up';
  }
  return { asymmetric, direction, betaDown: bd, betaUp: bu, nDown: sideDown.n, nUp: sideUp.n };
}

/**
 * Tail co-movement — on the driver's worst/best days, how often (and how far)
 * the group moved with it. Turns correlation into risk CONTEXT without
 * predicting: bottom decile of driver returns when the sample supports it
 * (⌊n·0.1⌋ ≥ minTailN), else bottom 20%; symmetric for the best days. Reports
 * raw COUNTS (n-first) — the UI applies the no-%-under-5 tier — plus the median
 * group return on those days (CALLS median, §4). "co-move" = group also down on
 * the worst days / also up on the best days.
 *
 * @param {number[]} groupReturns @param {number[]} driverReturns
 * @param {{minTailN?:number}} [opts]
 * @returns {{worst:{n:number,tailPct:number,coMoveCount:number,groupMedian:number}, best:{…}, sampleN:number}|null}
 *   null when neither tail can reach minTailN.
 */
export function tailCoMovement(groupReturns, driverReturns, opts = {}) {
  const { minTailN = 5 } = opts;
  if (!isFiniteNumberArray(groupReturns, 2) || !isFiniteNumberArray(driverReturns, 2)) return null;
  if (groupReturns.length !== driverReturns.length) return null;
  const n = driverReturns.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => driverReturns[a] - driverReturns[b]);
  const decileN = Math.floor(n * 0.1);
  const useDecile = decileN >= minTailN;
  const tailN = useDecile ? decileN : Math.floor(n * 0.2);
  if (tailN < minTailN) return null;
  const tailPct = useDecile ? 10 : 20;
  const side = (indices, downward) => {
    const groupOnTail = indices.map((i) => groupReturns[i]);
    const coMoveCount = groupOnTail.filter((r) => (downward ? r < 0 : r > 0)).length;
    return { n: indices.length, tailPct, coMoveCount, groupMedian: median(groupOnTail) };
  };
  return {
    worst: side(order.slice(0, tailN), true),
    best: side(order.slice(n - tailN), false),
    sampleN: n,
  };
}

/**
 * Correlation stability ("past stability", never "durability") — over the
 * rolling correlation series: what SHARE of observed windows shared the latest
 * window's sign (signPersistence), and what share cleared the link threshold in
 * magnitude (aboveFraction). A description of the PAST series only — no decay
 * fit, no forward claim. Operates on the already-computed corr series (no
 * pearson recompute). Null below minObs non-null windows; signPersistence null
 * when the latest window is exactly 0 (no defined sign).
 *
 * @param {Array<{value:(number|null)}>} series - a rollingCorrelation output
 * @param {{threshold?:number, minObs?:number}} [opts]
 * @returns {{signPersistence:number|null, aboveFraction:number, n:number, sign:('positive'|'negative'|null), threshold:number}|null}
 */
export function correlationStability(series, opts = {}) {
  const { threshold = 0.15, minObs = 20 } = opts;
  if (!Array.isArray(series)) return null;
  if (!Number.isFinite(threshold) || threshold < 0) return null;
  const values = [];
  let latest = null;
  for (let i = 0; i < series.length; i++) {
    const v = series[i]?.value;
    if (Number.isFinite(v)) {
      values.push(v);
      latest = v;
    }
  }
  if (values.length < minObs || latest == null) return null;
  const sign = latest > 0 ? 'positive' : latest < 0 ? 'negative' : null;
  const signPersistence =
    sign === null
      ? null
      : values.reduce((acc, v) => acc + ((sign === 'positive' ? v > 0 : v < 0) ? 1 : 0), 0) / values.length;
  const aboveFraction = values.reduce((acc, v) => acc + (Math.abs(v) >= threshold ? 1 : 0), 0) / values.length;
  return { signPersistence, aboveFraction, n: values.length, sign, threshold };
}
