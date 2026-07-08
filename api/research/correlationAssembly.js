/**
 * Correlation Intelligence — shared per-driver assembly core (V2 Build 2).
 *
 * Extracted VERBATIM from api/research/correlation.js (the V0 single-driver
 * endpoint) so the multi-driver scan endpoint runs the IDENTICAL
 * join-and-compute pipeline per driver instead of a parallel implementation —
 * two copies of the join discipline is the copy-proliferation bug class
 * BUILD_RULES §4 exists to prevent. correlation.js's boundary suite passing
 * with ZERO expectation changes is the extraction's acceptance test.
 *
 * Pure with respect to project state: imports correlationMath (zero-import
 * pure math) and marketSchedule (the TTL helper's clock reads) only — no
 * network, no Firebase, no caching. Handler files are not import targets;
 * this module exists so BOTH handlers import from a non-handler home.
 *
 * Array-order contract (unchanged): all series inputs are OLDEST-FIRST —
 * callers own the reverse-once wire boundary BEFORE calling in here.
 */
import { getETDate, getMarketState, getNextMarketClose } from '../_utils/marketSchedule.js';
import {
  computeReturnsSeries,
  rollingCorrelation,
  selfPercentile,
  correlationStability,
  partialCorrelationWindows,
  trailingReturnInto,
  rollingStd,
  ABS_DIVERGENCE_FLOOR,
  SDS_EPISODE_END_THRESHOLD,
  SDS_FLAG_THRESHOLD,
} from '../_utils/correlationMath.js';

const CORR_WINDOWS = [20, 60];
const THIRTY_MIN_MS = 30 * 60 * 1000;

/**
 * Pinned join gate (V0): below this many joined closes, inflection detection
 * is suppressed in the single-driver endpoint AND the scan's per-row tension
 * read (d / SDS / tensionState) nulls out — a scan chip must never show a
 * state the deep dive would refuse to show for the same pair.
 */
export const MIN_CLOSES_FOR_INFLECTIONS = 300;

/**
 * The V0 join-and-compute core, one driver against a fixed member set:
 * scale driver LEVELS (TNX registry contract, before differencing) →
 * inner-join all members + driver on date → cap at lookbackDays closes →
 * returns (driver per registry.returnMode, members pct) → equal-weight
 * composite + synthetic levels → gated rolling corr 20/60 → divergence
 * series aligned by closeIndex (never raw array position).
 *
 * @param {Array<{date: string, close: number}>} driverAsc - OLDEST-FIRST driver rows (post reverse-once)
 * @param {Array<Map<string, number>>} memberMaps - date→close per surviving member (read-only; reusable across drivers)
 * @param {{returnMode: string, scale?: number}} registry - the driver's registry entry (or CUSTOM synthetic)
 * @param {number} lookbackDays - trading-day cap (already clamped by the caller)
 * @returns {{ error: string, joinedCloses: number } | {
 *   joinedCloses: number, joinedDates: string[], driverCloses: number[],
 *   driverReturns: number[], groupReturns: number[], groupLevels: number[],
 *   corr20: Array|null, corr60: Array|null, divergenceSeries: Array }}
 * (member closes/returns stay internal — they exist only to build the
 * composite; neither handler consumes them.)
 */
export function assembleDriverCore({ driverAsc, memberMaps, registry, lookbackDays }) {
  // TNX scale applies to LEVELS, before differencing (registry contract).
  const scale = registry.scale ?? 1;
  const driverScaled =
    scale === 1 ? driverAsc : driverAsc.map((r) => ({ date: r.date, close: r.close * scale }));

  // ── Inner-join ALL series on date string BEFORE returns (commodities
  //    trade on different calendars), then cap at lookbackDays closes ──
  let joined = driverScaled.filter((r) => memberMaps.every((m) => m.has(r.date)));
  if (joined.length > lookbackDays) joined = joined.slice(-lookbackDays);
  const joinedCloses = joined.length;
  if (joinedCloses < 2) {
    return { error: 'no_overlapping_history', joinedCloses };
  }
  const joinedDates = joined.map((r) => r.date);
  const driverCloses = joined.map((r) => r.close);
  const memberCloses = memberMaps.map((m) => joinedDates.map((d) => m.get(d)));

  // ── Returns (chronological from here down) ──
  const driverReturns = computeReturnsSeries(driverCloses, registry.returnMode);
  const memberReturns = memberCloses.map((closes) => computeReturnsSeries(closes, 'pct'));
  if (!driverReturns || memberReturns.some((r) => r === null)) {
    return { error: 'degenerate_series', joinedCloses };
  }
  // Group composite = equal-weight mean of member daily returns (post-join).
  const groupReturns = driverReturns.map(
    (_, t) => memberReturns.reduce((acc, r) => acc + r[t], 0) / memberReturns.length
  );
  // Synthetic composite levels: length n, aligned 1:1 with joinedDates, so
  // episode closeIndexes anchor identically for group forward returns.
  const groupLevels = [100];
  for (const r of groupReturns) groupLevels.push(groupLevels[groupLevels.length - 1] * (1 + r));

  // ── Stats (per-window gate: window + 1 joined closes, else null) ──
  const [W20, W60] = CORR_WINDOWS;
  const corr20 = joinedCloses >= W20 + 1 ? rollingCorrelation(groupReturns, driverReturns, W20, joinedDates) : null;
  const corr60 = joinedCloses >= W60 + 1 ? rollingCorrelation(groupReturns, driverReturns, W60, joinedDates) : null;

  // Divergence series d = corr20 − corr60, aligned by closeIndex where BOTH
  // windows have non-null values (never by raw array position).
  const divergenceSeries = [];
  if (corr20 && corr60) {
    const byCloseIndex = new Map(corr20.map((e) => [e.closeIndex, e.value]));
    for (const e of corr60) {
      const v20 = byCloseIndex.get(e.closeIndex);
      if (v20 != null && e.value != null) {
        divergenceSeries.push({
          closeIndex: e.closeIndex,
          eventDate: e.eventDate,
          d: v20 - e.value,
          corr20: v20,
          corr60: e.value,
        });
      }
    }
  }

  return {
    joinedCloses,
    joinedDates,
    driverCloses,
    driverReturns,
    groupReturns,
    groupLevels,
    corr20,
    corr60,
    divergenceSeries,
  };
}

/**
 * Milliseconds until the pinned cache expiry (next close + 30min, two-sided).
 * getETDate() returns an ET-SHIFTED Date whose getTime() is not real epoch —
 * so the duration is computed entirely inside that frame (frame-invariant)
 * and callers convert to a real-epoch expiresAt via Date.now() + ttlMs.
 */
export function computeCorrelationCacheTtlMs() {
  const nowEt = getETDate();
  const { state, isEarlyClose } = getMarketState();
  let expiryEtMs;
  if (state === 'CLOSED_AFTERHOURS') {
    // Weekday non-holiday outside open hours: early-AM pre-open OR post-close.
    // Reconstruct TODAY's close in the same ET frame — in [close, close+30)
    // getNextMarketClose() has already rolled to the next session, but the
    // pinned rule says today's close + 30min still governs.
    const todayClose = new Date(nowEt);
    todayClose.setHours(isEarlyClose ? 13 : 16, 0, 0, 0);
    const todayClosePlus30 = todayClose.getTime() + THIRTY_MIN_MS;
    expiryEtMs =
      nowEt.getTime() < todayClosePlus30
        ? todayClosePlus30
        : getNextMarketClose().getTime() + THIRTY_MIN_MS;
  } else {
    // OPEN / PRE_MARKET → today's close; CLOSED_WEEKEND / CLOSED_HOLIDAY →
    // next trading day's close. getNextMarketClose is early-close-aware.
    expiryEtMs = getNextMarketClose().getTime() + THIRTY_MIN_MS;
  }
  return Math.max(60 * 1000, expiryEtMs - nowEt.getTime());
}

/**
 * (SDS score, raw gap d) → Divergence Watch / scan-chip tension state, the ONE
 * mapping both surfaces render (the scan sends it per row; the single-driver
 * endpoint stamps divergence.latest.state via this same helper) so a chip and
 * the deep-dive gauge can never drift. Build 3.1 coherence fix: 'break' now
 * applies BOTH of detectInflections' per-observation LEVEL conditions — the
 * standardized score AND the absolute gap floor (|score| ≥ flag AND |d| ≥
 * floor, i.e. detectInflections' `raw` qualification) — so the gauge can no
 * longer claim "in break territory" on score alone when the gap is small.
 *
 *   null       score null / non-finite (unscoreable → no chip)
 *   'calm'     |score| < SDS_EPISODE_END_THRESHOLD (1.0)
 *   'elevated' SDS_EPISODE_END_THRESHOLD ≤ |score| < SDS_FLAG_THRESHOLD (2.0)
 *   'stretched'|score| ≥ SDS_FLAG_THRESHOLD, |d| < ABS_DIVERGENCE_FLOOR
 *   'break'    |score| ≥ SDS_FLAG_THRESHOLD, |d| ≥ ABS_DIVERGENCE_FLOOR
 *
 * Scope (pinned): this is a latest-OBSERVATION tension read, not the episode
 * flag. detectInflections layers a persistence (2-of-3-raw) / emergency (≥3.5)
 * gate ON TOP of these two level conditions, and that gate is out of scope for
 * Build 3.1 ("the flag logic itself is untouched"). So an isolated raw spike
 * can still read 'break' here without opening a regime-break episode — by
 * design: the gauge reports current tension, the regime-break card reports
 * episodes. The floor is the SAME exported constant the flag uses — never a
 * literal copy. A missing/non-finite d at break-level score can't confirm the
 * gap, so it degrades to the conservative 'stretched', never a false 'break'.
 */
export function tensionStateFrom({ score, d }) {
  if (score == null || !Number.isFinite(score)) return null;
  const a = Math.abs(score);
  if (a < SDS_EPISODE_END_THRESHOLD) return 'calm';
  if (a < SDS_FLAG_THRESHOLD) return 'elevated';
  const clearsFloor = Number.isFinite(d) && Math.abs(d) >= ABS_DIVERGENCE_FLOOR;
  return clearsFloor ? 'break' : 'stretched';
}

/**
 * Project a date→close Map onto an already-built joined-date axis and return
 * the aligned OLDEST-FIRST return series — the glue that lets the V3
 * SPY-adjusted partial correlation measure r(group,SPY) and r(driver,SPY) on
 * the SAME joined calendar every other stat on the page uses. The map is the
 * FULL series for a symbol (e.g. SPY); joinedDates is a driver's own
 * (lookback-capped) join axis, which may lack a session the map has or vice
 * versa.
 *
 * Deliberately NOT computeReturnsSeries: that helper nulls the WHOLE series on
 * a single gap (a poisoned-window guard for the composite inputs). Here a gap
 * must null ONLY that one index so partialCorrelationWindows can drop just the
 * missing session and report an honest n — so the return is length
 * joinedDates.length − 1 with a per-index null wherever either endpoint close
 * is absent (or zero, in pct mode). Same index/date mapping as the rest of the
 * stack: return i spans joinedDates[i]→joinedDates[i+1].
 *
 * @param {Map<string, number>} map - date string → close
 * @param {string[]} joinedDates - chronological join axis
 * @param {('pct'|'diff')} [mode='pct']
 * @returns {Array<number|null>|null} null on invalid input
 */
export function projectAlignedReturns(map, joinedDates, mode = 'pct') {
  if (!(map instanceof Map) || !Array.isArray(joinedDates) || joinedDates.length < 2) return null;
  if (mode !== 'pct' && mode !== 'diff') return null;
  const out = new Array(joinedDates.length - 1);
  for (let i = 0; i < joinedDates.length - 1; i++) {
    const a = map.get(joinedDates[i]);
    const b = map.get(joinedDates[i + 1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      out[i] = null;
    } else if (mode === 'pct') {
      out[i] = a === 0 ? null : b / a - 1;
    } else {
      out[i] = b - a;
    }
  }
  return out;
}

/**
 * The V3 relationship-quality fields BOTH surfaces share — the SPY-adjusted
 * partial correlation, self-percentile, past stability, and driver-side context.
 * Extracted so the partial-status vocabulary (`skipped:'self'` /
 * `suppressed:'spy_unavailable'`) — which the UI keys off by string — and the
 * shared field set live in ONE place, not copy-proliferated across the two
 * handlers (BUILD_RULES §4 rationale). The deep dive spreads this and adds the
 * depth-only blocks (member contribution, capture asymmetry, tail co-movement).
 *
 * @param {object} p
 * @param {number[]} p.groupReturns @param {number[]} p.driverReturns
 * @param {number[]} p.driverCloses @param {string[]} p.joinedDates
 * @param {Array|null} p.corr20 @param {Array|null} p.corr60 - rollingCorrelation outputs
 * @param {string} p.driverSymbol - registry wire symbol (SPY.US ⇒ self-skip)
 * @param {Map<string,number>|null} p.spyMap - SPY date→close, or null if unavailable
 * @returns {{partial:object, selfPercentile:object, stability:object, driverContext:object}}
 */
export function buildRelationshipQualityShared({
  groupReturns,
  driverReturns,
  driverCloses,
  joinedDates,
  corr20,
  corr60,
  driverSymbol,
  spyMap,
}) {
  const driverIsSpy = driverSymbol === 'SPY.US';
  const spyReturns = spyMap && !driverIsSpy ? projectAlignedReturns(spyMap, joinedDates) : null;
  const partial = driverIsSpy
    ? { w20: { skipped: 'self' }, w60: { skipped: 'self' } }
    : spyReturns
      ? partialCorrelationWindows(groupReturns, driverReturns, spyReturns)
      : { w20: { suppressed: 'spy_unavailable' }, w60: { suppressed: 'spy_unavailable' } };
  return {
    partial,
    selfPercentile: {
      corr20: selfPercentile(corr20 ?? []),
      corr60: selfPercentile(corr60 ?? []),
    },
    stability: correlationStability(corr20 ?? []),
    driverContext: {
      trailingReturn: trailingReturnInto(driverCloses, driverCloses.length - 1, 20),
      vol: selfPercentile(rollingStd(driverReturns, 20, joinedDates) ?? []),
    },
  };
}
