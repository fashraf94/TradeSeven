/**
 * Correlation Intelligence V3 Sub-build 2 — Change 2 ("Since your last scan").
 *
 * Honest deltas between the current scan and the prior cached scan of a
 * DIFFERENT trading day. Everything here is fingerprint-gated: if the group, the
 * driver universe, the methodology, or the change policy differs between the two
 * scans, the comparison is `not_comparable` and ZERO events are emitted — never
 * a manufactured market story (finding 6). Deltas are computed ONCE at
 * cache-write assembly; the endpoint places the SAME objects on the payload and
 * the contract (§9 — one source, can't drift).
 *
 * Pure with respect to project state — imports only Node crypto and the
 * trading-day walker (marketSchedule.getPreviousTradingDay). No network, no
 * Firebase.
 */
import { createHash } from 'crypto';
import { getPreviousTradingDay } from '../_utils/marketSchedule.js';

// driverUniverseHash — the standalone hash of the registry salt (the scan folds
// the salt into its docId, but the comparison needs it as its own fingerprint).
export function driverUniverseHash(registrySalt) {
  return createHash('sha1').update(String(registrySalt)).digest('hex');
}

// adjusted20 from a partial window {raw,adjusted,n,suppressed} | {skipped}/{suppressed}:
// a finite number, else null (suppressed / skipped / thin window all collapse to
// null in the compact snapshot — the snapshot is facts, not reasons).
function adjustedOf(pw) {
  return pw && Number.isFinite(pw.adjusted) ? pw.adjusted : null;
}

/**
 * The compact per-scan snapshot persisted in the doc so the NEXT scan can carry
 * it forward as the baseline. Per driver: {driverId, rank, tier, corr20, corr60,
 * adjusted20, tensionState}; plus the fingerprints + observationTradingDay.
 */
export function compactSnapshot({ rows, observationTradingDay, fingerprints }) {
  const drivers = (Array.isArray(rows) ? rows : []).map((row, i) => ({
    driverId: row.driver,
    rank: i + 1,
    tier: row.tier ?? null,
    corr20: Number.isFinite(row.corr20) ? row.corr20 : null,
    corr60: Number.isFinite(row.corr60) ? row.corr60 : null,
    adjusted20: adjustedOf(row.rq?.partial?.w20),
    // Whether the SPY-adjustment is genuinely SUPPRESSED (driver-is-market),
    // distinct from a merely thin/insufficient window — so became_suppressed
    // never mislabels an unavailable adjustment as a suppressed one.
    adjustedSuppressed: row.rq?.partial?.w20?.suppressed === 'driver_is_market',
    tensionState: row.tensionState ?? null,
  }));
  return {
    observationTradingDay,
    membershipHash: fingerprints.membershipHash,
    driverUniverseHash: fingerprints.driverUniverseHash,
    methodologyVersion: fingerprints.methodologyVersion,
    changePolicyVersion: fingerprints.changePolicyVersion,
    drivers,
  };
}

function isValidSnapshot(s) {
  return s && typeof s === 'object' && typeof s.observationTradingDay === 'string' && Array.isArray(s.drivers);
}

/**
 * The pinned snapshot-carry idiom. Given the EXISTING doc (read at cache-write
 * time) and the NEW observation trading day, decide what to embed as
 * `priorSnapshot`:
 *   - existing snapshot on a DIFFERENT observation day → it becomes the baseline
 *   - existing snapshot on the SAME observation day → preserve the existing
 *     priorSnapshot unchanged (a Monday-premarket recompute on Friday's bars
 *     never advances the baseline — same-day preservation keys on
 *     observationTradingDay)
 *   - no/ malformed existing snapshot (legacy doc) → tolerated: carry the
 *     existing priorSnapshot if it's valid, else null.
 */
export function carryPriorSnapshot(existingDoc, newObservationTradingDay) {
  const existingSnap = existingDoc?.snapshot;
  if (isValidSnapshot(existingSnap)) {
    if (existingSnap.observationTradingDay !== newObservationTradingDay) return existingSnap;
    return isValidSnapshot(existingDoc?.priorSnapshot) ? existingDoc.priorSnapshot : null;
  }
  return isValidSnapshot(existingDoc?.priorSnapshot) ? existingDoc.priorSnapshot : null;
}

// Trading-day gap from baseline (fromDay) to current (toDay), walked backward
// from the current day via getPreviousTradingDay (holiday/half-day aware). null
// if the baseline isn't reachable on the calendar path (safety — never a fake 0).
function tradingDayGap(fromDay, toDay) {
  if (typeof fromDay !== 'string' || typeof toDay !== 'string') return null;
  if (fromDay === toDay) return 0;
  if (fromDay > toDay) return null; // baseline is newer than current — nonsensical
  let cursor = toDay;
  for (let steps = 1; steps <= 60; steps++) {
    cursor = getPreviousTradingDay(cursor);
    if (cursor === fromDay) return steps;
    if (cursor < fromDay) return null; // walked past it → baseline wasn't a trading day on the path
  }
  return null;
}

/**
 * The comparison block (finding 2). Fingerprint-gated: ANY mismatch →
 * not_comparable (baseline fields still populated for transparency, but
 * computeChanges must emit zero events for a non-'available' status).
 *
 * @param {object|null} prior - the carried prior snapshot (or null)
 * @param {object} current - the new compact snapshot
 * @param {object} fingerprints - the current run's {membershipHash, driverUniverseHash, methodologyVersion, changePolicyVersion}
 */
export function buildComparison({ prior, current, fingerprints }) {
  const currentObservationDay = current.observationTradingDay;
  const base = {
    baselineObservationDay: null,
    currentObservationDay,
    gapTradingDays: null,
    baselineMembershipHash: null,
    baselineDriverUniverseHash: null,
    baselineMethodologyVersion: null,
    baselineChangePolicyVersion: null,
  };
  if (!isValidSnapshot(prior)) return { status: 'no_prior_scan', ...base };

  const baseline = {
    ...base,
    baselineObservationDay: prior.observationTradingDay,
    baselineMembershipHash: prior.membershipHash ?? null,
    baselineDriverUniverseHash: prior.driverUniverseHash ?? null,
    baselineMethodologyVersion: prior.methodologyVersion ?? null,
    baselineChangePolicyVersion: prior.changePolicyVersion ?? null,
  };

  const comparable =
    prior.membershipHash === fingerprints.membershipHash &&
    prior.driverUniverseHash === fingerprints.driverUniverseHash &&
    prior.methodologyVersion === fingerprints.methodologyVersion &&
    prior.changePolicyVersion === fingerprints.changePolicyVersion;

  if (!comparable) return { status: 'not_comparable', ...baseline };

  return { status: 'available', ...baseline, gapTradingDays: tradingDayGap(prior.observationTradingDay, currentObservationDay) };
}

// ── Event model (findings 12–15) ─────────────────────────────────────────────
const CORR_FLOOR = 0.15; // |Δcorr20| floor for correlation events
const SIGN_FLIP_MIN = 0.15; // both sides |r| must clear this for a real reversal
const RANK_SHIFT_MIN = 5; // rank move alone is context, not a headline
const RANK_CORR_MIN = 0.1; // a rank event needs an accompanying corr move
const TENSION_ORDER = { calm: 0, elevated: 1, stretched: 2, break: 3 };
const round2 = (v) => (Number.isFinite(v) ? Number(v.toFixed(2)) : null);

// Priority classes for deterministic ordering (lower = more important). The
// spec's ladder: break-tension > tension_worsened > signal entry/exit > sign flip
// > large corr move > rank > recovery; the "gone" events sit with signal exit.
function priorityOf(ev) {
  if (ev.event === 'tension_worsened' && ev.to === 'break') return 0;
  if (ev.event === 'tension_worsened') return 1;
  if (ev.event === 'signal_entered' || ev.event === 'signal_exited' || ev.event === 'became_unavailable' || ev.event === 'driver_removed') return 2;
  if (ev.event === 'correlation_sign_flipped' || ev.event === 'became_suppressed') return 3;
  if (ev.event === 'correlation_strengthened' || ev.event === 'correlation_weakened') return 4;
  if (ev.event === 'rank_rose' || ev.event === 'rank_fell') return 5;
  if (ev.event === 'tension_recovered') return 6;
  return 7;
}

function perDriverEvents(prior, cur) {
  const out = [];
  const id = cur.driverId;
  const push = (event, from, to, magnitude = null) => out.push({ driverId: id, event, from, to, magnitude });

  const c20p = prior.corr20;
  const c20c = cur.corr20;
  const measuredPrior = Number.isFinite(c20p);
  const measuredCur = Number.isFinite(c20c);

  // Availability first — a driver that went uncomputable this run is
  // became_unavailable, NEVER signal_exited (finding 14).
  if (measuredPrior && !measuredCur) {
    push('became_unavailable', c20p, null);
    return out;
  }
  // Adjusted (SPY-partial) became suppressed (driver-is-market) while the raw
  // link is still measurable — NOT merely a thin window (which leaves adjusted20
  // null without cur.adjustedSuppressed).
  if (measuredCur && Number.isFinite(prior.adjusted20) && cur.adjusted20 == null && cur.adjustedSuppressed === true) {
    push('became_suppressed', prior.adjusted20, null);
  }

  // Tension — state-boundary crossings both directions (finding 13).
  if (prior.tensionState !== cur.tensionState && prior.tensionState != null && cur.tensionState != null) {
    const wp = TENSION_ORDER[prior.tensionState];
    const wc = TENSION_ORDER[cur.tensionState];
    if (wc > wp) push('tension_worsened', prior.tensionState, cur.tensionState);
    else if (wc < wp) push('tension_recovered', prior.tensionState, cur.tensionState);
  }

  // Signal (tier) entry/exit — established = a real relationship.
  const wasSignal = prior.tier === 'established';
  const isSignal = cur.tier === 'established';
  if (!wasSignal && isSignal) push('signal_entered', prior.tier, cur.tier);
  else if (wasSignal && !isSignal && measuredCur) push('signal_exited', prior.tier, cur.tier);

  // Correlation move / sign flip (measured both sides).
  if (measuredPrior && measuredCur) {
    const delta = c20c - c20p;
    const bothClear = Math.abs(c20p) >= SIGN_FLIP_MIN && Math.abs(c20c) >= SIGN_FLIP_MIN;
    const flipped = bothClear && Math.sign(c20p) !== Math.sign(c20c);
    if (flipped) {
      push('correlation_sign_flipped', round2(c20p), round2(c20c), Math.abs(round2(delta)));
    } else if (Math.abs(delta) >= CORR_FLOOR - 1e-9) {
      const stronger = Math.abs(c20c) > Math.abs(c20p);
      push(stronger ? 'correlation_strengthened' : 'correlation_weakened', round2(c20p), round2(c20c), Math.abs(round2(delta)));
    }

    // Rank — context only: needs a big shift AND an accompanying corr move (finding 12).
    const rankShift = prior.rank - cur.rank; // positive → moved up (toward rank 1)
    if (Math.abs(rankShift) >= RANK_SHIFT_MIN && Math.abs(delta) >= RANK_CORR_MIN - 1e-9) {
      push(rankShift > 0 ? 'rank_rose' : 'rank_fell', prior.rank, cur.rank, Math.abs(rankShift));
    }
  }

  return out;
}

/**
 * Compute the change events between a prior and current snapshot. Returns the
 * complete, priority-ordered event list (contract retains ALL qualifying;
 * finding 15). Deterministic tie-break by driverId. Caller only invokes this
 * when the comparison is 'available'.
 */
export function computeChanges({ prior, current }) {
  if (!isValidSnapshot(prior) || !isValidSnapshot(current)) return [];
  const priorById = new Map(prior.drivers.map((d) => [d.driverId, d]));
  const events = [];
  for (const cur of current.drivers) {
    const p = priorById.get(cur.driverId);
    if (p) events.push(...perDriverEvents(p, cur));
  }
  // A driver present in the baseline but absent from the current universe is
  // driver_removed (finding 14). Unreachable while driverUniverseHash matches
  // (available runs share a driver set), but correct as defense-in-depth.
  const currentIds = new Set(current.drivers.map((d) => d.driverId));
  for (const p of prior.drivers) {
    if (!currentIds.has(p.driverId)) events.push({ driverId: p.driverId, event: 'driver_removed', from: p.tier ?? null, to: null, magnitude: null });
  }
  events.sort((a, b) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    if (pa !== pb) return pa - pb;
    return a.driverId < b.driverId ? -1 : a.driverId > b.driverId ? 1 : 0;
  });
  return events;
}
