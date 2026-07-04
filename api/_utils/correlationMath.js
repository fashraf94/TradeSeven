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

function median(a) {
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
 * @param {{corr: number, n: number}|null} sideA - a maskedPearson result
 * @param {{corr: number, n: number}|null} sideB - a maskedPearson result
 * @param {number} [floor=0.15] - the pinned asymmetry floor
 * @returns {{asymmetric: boolean, direction: ('A'|'B'|null)}|null}
 *   null when either side is null (no comparison exists — never a fabricated
 *   verdict). asymmetric is true only at |corrA − corrB| ≥ floor. direction =
 *   the LARGER-|corr| side (the side where the link is tighter; for inverse
 *   links that is the more-negative side), null when not asymmetric. The
 *   measure-zero corner |corrA| === |corrB| with a ≥-floor raw difference (an
 *   exact sign-flip tie) also yields direction null — neither side is tighter,
 *   and the UI renders its no-difference verdict rather than picking a winner.
 */
export function compareConditionalSides(sideA, sideB, floor = 0.15) {
  if (sideA == null || sideB == null) return null;
  const a = sideA.corr;
  const b = sideB.corr;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (!Number.isFinite(floor) || floor < 0) return null;
  const asymmetric = Math.abs(a - b) >= floor;
  let direction = null;
  if (asymmetric && Math.abs(a) !== Math.abs(b)) {
    direction = Math.abs(a) > Math.abs(b) ? 'A' : 'B';
  }
  return { asymmetric, direction };
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
