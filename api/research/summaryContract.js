/**
 * Correlation Intelligence V3 Phase 1, Sub-build 2 — THE SUMMARY CONTRACT core
 * (Change 1 evidence checklist + Change 3 the versioned contract).
 *
 * A presentation-and-explanation contract for narration surfaces (finding 20):
 * facts-only, deterministic, pre-computed at cache time. It is NOT an input to
 * ranking, trade selection, or numeric computation — a future machine consumer
 * needing precision reads the analytical `payload` (or a future machine-precision
 * contract). Machine-facing block name is `evidence`, never "quality".
 *
 * Pure with respect to project state — imports only the ONE strength-band
 * implementation (correlationVerdict.strengthBand, api→src, Node-clean; the
 * unmocked handler import in the boundary suites is the dependency-surface
 * guard, BUILD_RULES §4) and Node's crypto. No network, no Firebase.
 *
 * Envelope-vs-plain convention (faithful to the spec census's "(envelope)"
 * annotations): the analytical metric fields the census marks "(envelope)"
 * serialize as the uniform metric envelope; the Common scalars, `group`,
 * `breaks`, `comparison`, `changes`, and the `evidence` block itself are plain
 * objects (their scalars typed :int/:'YYYY-MM-DD' in the census). Every numeric
 * envelope AND every evidence criteria row carries a `unit` (confirmation-pass
 * amendment).
 */
import { createHash } from 'crypto';
import { strengthBand } from '../../src/components/Research/correlationVerdict.js';

// ── Version quartet + revision (findings 17–18) ──────────────────────────────
// contractVersion: breaking changes only (rename/remove/enum/unit/rounding/
// semantic). schemaRevision: additive optional fields. The three policy versions
// are monotonic strings, bumped only when that policy's math/thresholds change.
export const CONTRACT_VERSION = 1;
export const SCHEMA_REVISION = 1;
export const METHODOLOGY_VERSION = 'corr-v3';
export const READ_QUALITY_POLICY_VERSION = '1';
export const CHANGE_POLICY_VERSION = '1';

// Break-freshness window (trading days) — the SAME horizon the deep-dive verdict
// uses for "still fresh" (correlationVerdict.js). Stored as a plain fact; every
// consumer derives isFresh from dataAsOf at read time (finding 19 — no stored
// booleans that rot).
export const FRESHNESS_WINDOW_TRADING_DAYS = 10;

// Firestore hard limit is 1 MB; the pinned budget leaves headroom for the
// contract + priorSnapshot embedded beside the payload (test #18).
export const MAX_CONTRACT_BYTES = 700_000;

export const UNIT = {
  correlation: 'correlation',
  fraction: 'fraction',
  returnFraction: 'return_fraction',
  beta: 'beta',
  standardDeviations: 'standard_deviations',
  count: 'count',
  tradingDays: 'trading_days',
  none: 'none',
};

const GROUP_TYPES = new Set(['manual', 'watchlist', 'agent_book', 'linked']);

/**
 * The ONE shared rounding helper (finding 11 — JS formatting never defines
 * policy). Used before BOTH evidence-threshold evaluation and serialization of
 * correlation/fraction/beta/SDS values, so a criterion's pass/fail can never
 * disagree with the number the contract serializes (§9). null-never-zero:
 * a null stays null (no answer), 0 is a measured value.
 */
export function round2(v) {
  return Number.isFinite(v) ? Number(v.toFixed(2)) : null;
}

// return_fraction is shown as a 1-decimal percent on the cards (fmtPct) — 0.1%
// resolution = 3dp on the fraction — so 2dp would drop a visible digit. Round
// per unit so every serialized value stays recognizable from the screen.
function roundForUnit(value, unit) {
  if (!Number.isFinite(value)) return null;
  if (unit === UNIT.count || unit === UNIT.tradingDays) return Math.round(value);
  if (unit === UNIT.returnFraction) return Number(value.toFixed(4));
  return round2(value); // correlation / fraction / beta / standard_deviations
}

/**
 * The uniform metric envelope `{status, value, n, reason, unit, band?}`
 * (finding 16). `band` is present only on correlation-unit envelopes (it may be
 * null there for a sub-0.15 magnitude — strengthBand's floor).
 */
export function envelope({ status, value = null, n = null, reason = null, unit, band }) {
  const env = { status, value: value ?? null, n: n ?? null, reason: reason ?? null, unit };
  if (band !== undefined) env.band = band ?? null;
  return env;
}

// A numeric "ok" envelope (or insufficient_data when the value is non-finite).
// withBand adds the strengthBand of the ROUNDED magnitude (§9) — correlation
// unit only.
function numEnvelope(value, unit, { n = null, withBand = false } = {}) {
  if (!Number.isFinite(value)) {
    return envelope({
      status: 'insufficient_data',
      value: null,
      n,
      reason: 'insufficient_data',
      unit,
      ...(withBand ? { band: null } : {}),
    });
  }
  const rounded = roundForUnit(value, unit);
  return withBand
    ? envelope({ status: 'ok', value: rounded, n, unit, band: strengthBand(Math.abs(rounded)) })
    : envelope({ status: 'ok', value: rounded, n, unit });
}

// A not_applicable envelope (below-member-count nulls, etc.).
function naEnvelope(unit, { reason = 'not_applicable', withBand = false } = {}) {
  return envelope({ status: 'not_applicable', value: null, reason, unit, ...(withBand ? { band: null } : {}) });
}

// An enum-valued envelope (unit 'none') — tension.state, comparison verdicts, etc.
function enumEnvelope(value, { status = value == null ? 'insufficient_data' : 'ok', reason = null } = {}) {
  return envelope({ status, value: value ?? null, unit: UNIT.none, reason });
}

// ── Partial-correlation envelopes (raw = headline corr; adjusted = partial) ──
// links.rawNN comes from the DISPLAYED headline correlation (§9), not partial.raw.
function rawLinkEnvelope(headlineCorr) {
  return numEnvelope(headlineCorr, UNIT.correlation, { withBand: true });
}

// adjusted from partial.wNN: {raw,adjusted,n,suppressed} | {skipped:'self'} |
// {suppressed:'spy_unavailable'}. Maps the shipped partial vocabulary → envelope
// status/reason (finding 16 mapping).
function adjustedLinkEnvelope(pw) {
  if (!pw) return envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.correlation, band: null });
  if (pw.skipped === 'self') return envelope({ status: 'skipped', reason: 'self', unit: UNIT.correlation, band: null });
  if (pw.suppressed === 'spy_unavailable')
    return envelope({ status: 'suppressed', reason: 'spy_unavailable', unit: UNIT.correlation, band: null });
  if (pw.suppressed === 'driver_is_market')
    return envelope({ status: 'suppressed', reason: 'driver_is_market', n: pw.n ?? null, unit: UNIT.correlation, band: null });
  if (Number.isFinite(pw.adjusted)) {
    const r = round2(pw.adjusted);
    return envelope({ status: 'ok', value: r, n: pw.n ?? null, unit: UNIT.correlation, band: strengthBand(Math.abs(r)) });
  }
  return envelope({ status: 'insufficient_data', n: pw.n ?? null, reason: 'insufficient_data', unit: UNIT.correlation, band: null });
}

// The partial window used for survives_adjustment / market_proxy: w60 primary,
// w20 fallback when w60 is not an 'ok' number. Returns the chosen envelope + key.
function primaryAdjusted(partial) {
  const w60 = adjustedLinkEnvelope(partial?.w60);
  if (w60.status === 'ok' || w60.status === 'suppressed' || w60.status === 'skipped') return { env: w60, window: 'w60' };
  const w20 = adjustedLinkEnvelope(partial?.w20);
  return { env: w20.status === 'ok' ? w20 : w60, window: w20.status === 'ok' ? 'w20' : 'w60' };
}

// ── Group identity (finding 21 — no user text) ───────────────────────────────
export function membershipHash(group) {
  return createHash('sha1').update([...group].sort().join(',')).digest('hex');
}

export function groupIdentity({ group, groupType = 'manual' }) {
  const type = GROUP_TYPES.has(groupType) ? groupType : 'manual';
  const memberSymbols = [...group].sort().slice(0, 10);
  return { groupType: type, memberSymbols, memberCount: group.length, membershipHash: membershipHash(group) };
}

// ── Change 1 — the evidence checklist (a checklist of displayed facts) ───────
// Canonical criteria order (deep-dive full set); the scan uses SCAN_CRITERIA.
const DEEP_CRITERIA = [
  'adequate_sample',
  'stable_link',
  'group_coheres',
  'broad_based',
  'survives_adjustment',
  'tension_contained',
];
const SCAN_CRITERIA = ['adequate_sample', 'stable_link', 'survives_adjustment', 'tension_contained'];

const ADEQUATE_SAMPLE_MIN = 300;
const STABLE_LINK_MIN = 0.7;
const COHESION_MIN = 0.4;
const SURVIVES_ADJ_MIN = 0.15;
const CALM_STATES = new Set(['calm', 'elevated']);

/**
 * Build one criterion row {id, outcome, value, threshold, unit}. outcome is
 * 'not_applicable' | 'pass' | 'fail'. All numeric comparisons run on the
 * round2'd value so the row's verdict matches the serialized number (§9).
 */
function criterion(id, { evidence }) {
  const { joinedCloses, stability, cohesionC20, memberCount, breadthStatus, primaryAdj, tensionState, partialApplicable } = evidence;
  switch (id) {
    case 'adequate_sample': {
      const v = joinedCloses ?? null;
      return { id, outcome: Number.isFinite(v) && v >= ADEQUATE_SAMPLE_MIN ? 'pass' : 'fail', value: v, threshold: ADEQUATE_SAMPLE_MIN, unit: UNIT.count };
    }
    case 'stable_link': {
      if (!stability || !Number.isFinite(stability.aboveFraction))
        return { id, outcome: 'not_applicable', value: null, threshold: STABLE_LINK_MIN, unit: UNIT.fraction };
      const v = round2(stability.aboveFraction);
      return { id, outcome: v >= STABLE_LINK_MIN ? 'pass' : 'fail', value: v, threshold: STABLE_LINK_MIN, unit: UNIT.fraction };
    }
    case 'group_coheres': {
      if (memberCount < 3 || !Number.isFinite(cohesionC20))
        return { id, outcome: 'not_applicable', value: null, threshold: COHESION_MIN, unit: UNIT.correlation };
      const v = round2(cohesionC20);
      return { id, outcome: v >= COHESION_MIN ? 'pass' : 'fail', value: v, threshold: COHESION_MIN, unit: UNIT.correlation };
    }
    case 'broad_based': {
      if (memberCount < 3 || breadthStatus == null)
        return { id, outcome: 'not_applicable', value: null, threshold: 'broad_based', unit: UNIT.none };
      return { id, outcome: breadthStatus === 'broad_based' ? 'pass' : 'fail', value: breadthStatus, threshold: 'broad_based', unit: UNIT.none };
    }
    case 'survives_adjustment': {
      if (!partialApplicable || primaryAdj == null || !Number.isFinite(primaryAdj))
        return { id, outcome: 'not_applicable', value: primaryAdj ?? null, threshold: SURVIVES_ADJ_MIN, unit: UNIT.correlation };
      const v = round2(primaryAdj);
      return { id, outcome: Math.abs(v) >= SURVIVES_ADJ_MIN ? 'pass' : 'fail', value: v, threshold: SURVIVES_ADJ_MIN, unit: UNIT.correlation };
    }
    case 'tension_contained': {
      if (tensionState == null) return { id, outcome: 'not_applicable', value: null, threshold: 'calm|elevated', unit: UNIT.none };
      return { id, outcome: CALM_STATES.has(tensionState) ? 'pass' : 'fail', value: tensionState, threshold: 'calm|elevated', unit: UNIT.none };
    }
    default:
      return { id, outcome: 'not_applicable', value: null, threshold: null, unit: UNIT.none };
  }
}

/**
 * @param {object} facts - the rounded/normalized inputs (see the evidence bag below)
 * @param {string[]} ids - canonical criteria id list (DEEP_CRITERIA or SCAN_CRITERIA)
 * @returns {{readType, readState, applicableCount, passedCount, failedCount, unavailableCount, criteria}}
 */
export function buildEvidence(facts, ids) {
  const evidence = {
    joinedCloses: facts.joinedCloses ?? null,
    stability: facts.stability ?? null,
    cohesionC20: facts.cohesionC20 ?? null,
    memberCount: facts.memberCount ?? 0,
    breadthStatus: facts.breadthStatus ?? null,
    primaryAdj: facts.primaryAdjustedValue ?? null,
    partialApplicable: facts.partialApplicable === true,
    tensionState: facts.tensionState ?? null,
  };
  const criteria = ids.map((id) => criterion(id, { evidence }));
  const applicable = criteria.filter((c) => c.outcome !== 'not_applicable');
  const passed = applicable.filter((c) => c.outcome === 'pass');
  const applicableCount = applicable.length;
  const passedCount = passed.length;
  const failedCount = applicable.length - passed.length;
  const unavailableCount = criteria.length - applicable.length;

  const byId = Object.fromEntries(criteria.map((c) => [c.id, c]));
  const passing = (id) => byId[id] && byId[id].outcome === 'pass';

  // readState — pinned ordered mapping (finding 5 + finding 9).
  let readState;
  if (facts.tensionState === 'stretched' || facts.tensionState === 'break') {
    readState = 'in_flux';
  } else if (applicableCount < 4 || !passing('adequate_sample') || !passing('stable_link')) {
    readState = 'limited';
  } else if (passedCount === applicableCount) {
    readState = 'solid';
  } else {
    readState = 'fragile';
  }
  const readType = facts.marketProxy === true ? 'market_proxy' : 'standard';
  return { readType, readState, applicableCount, passedCount, failedCount, unavailableCount, criteria };
}

// Shared: pull the evidence "facts" bag out of a deep-dive's assembled pieces.
function deepEvidenceFacts({ joinedCloses, memberCount, stability, cohesion, contribution, partial, tensionState }) {
  const cohesionC20 = cohesion && cohesion.c20 && Number.isFinite(cohesion.c20.value) ? cohesion.c20.value : null;
  const { env: primaryAdjEnv } = primaryAdjusted(partial);
  const primaryAdjustedValue = primaryAdjEnv.status === 'ok' ? primaryAdjEnv.value : null;
  const partialApplicable = primaryAdjEnv.status === 'ok';
  const marketProxy = primaryAdjEnv.status === 'suppressed' && primaryAdjEnv.reason === 'driver_is_market';
  return {
    joinedCloses,
    memberCount,
    stability,
    cohesionC20,
    breadthStatus: contribution?.breadthStatus ?? null,
    primaryAdjustedValue,
    partialApplicable,
    marketProxy,
    tensionState,
  };
}

// ── Change 3 — census assembly ───────────────────────────────────────────────
function commonBlock({ kind, generatedAt, dataAsOf, observationTradingDay, lookbackDays, group, groupType }) {
  return {
    contractVersion: CONTRACT_VERSION,
    schemaRevision: SCHEMA_REVISION,
    methodologyVersion: METHODOLOGY_VERSION,
    readQualityPolicyVersion: READ_QUALITY_POLICY_VERSION,
    changePolicyVersion: CHANGE_POLICY_VERSION,
    kind,
    generatedAt,
    dataAsOf,
    observationTradingDay,
    lookbackDays,
    group: groupIdentity({ group, groupType }),
  };
}

function tensionEnvelopes(latest) {
  // latest = { d, score(sds), state } | null
  if (!latest) {
    return {
      state: enumEnvelope(null),
      d: envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.correlation, band: null }),
      sds: envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.standardDeviations }),
    };
  }
  return {
    state: enumEnvelope(latest.state ?? null),
    d: numEnvelope(latest.d, UNIT.correlation, { withBand: true }),
    sds: numEnvelope(latest.score, UNIT.standardDeviations),
  };
}

function percentileEnvelope(sp) {
  // selfPercentile result {percentile(0-100), n, latest} | null → fraction (0,1]
  if (!sp || !Number.isFinite(sp.percentile)) return envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.fraction });
  return numEnvelope(sp.percentile / 100, UNIT.fraction, { n: sp.n ?? null });
}

function cohesionBlock(cohesion, { inScan = false } = {}) {
  // cohesion (deep) = { c20:{value,pairsUsed,pairsTotal}, c60:{...}, memberCount } | null
  if (!cohesion) {
    const c = naEnvelope(UNIT.correlation, { reason: 'below_member_count', withBand: true });
    const n = naEnvelope(UNIT.count, { reason: 'below_member_count' });
    return inScan ? { c20: c } : { c20: c, c60: c, pairsUsed: n, pairsTotal: n };
  }
  const c20 = numEnvelope(cohesion.c20?.value, UNIT.correlation, { n: cohesion.c20?.pairsUsed ?? null, withBand: true });
  if (inScan) return { c20 };
  return {
    c20,
    c60: numEnvelope(cohesion.c60?.value, UNIT.correlation, { n: cohesion.c60?.pairsUsed ?? null, withBand: true }),
    pairsUsed: numEnvelope(cohesion.c20?.pairsUsed, UNIT.count),
    pairsTotal: numEnvelope(cohesion.c20?.pairsTotal, UNIT.count),
  };
}

function contributionBlock(contribution) {
  if (!contribution || !Array.isArray(contribution.members)) {
    return { breadthStatus: enumEnvelope(null, { status: 'not_applicable', reason: 'below_member_count' }), topMember: null };
  }
  const breadthStatus = enumEnvelope(contribution.breadthStatus ?? null);
  let topMember = null;
  if (contribution.breadthStatus === 'single_driver') {
    // The member with the largest |corrDelta| (2dp, the §9 value the card ranks on).
    const symbols = Array.isArray(contribution.memberSymbols) ? contribution.memberSymbols : [];
    const scored = contribution.members
      .map((m) => ({ index: m.index, d: Number.isFinite(m.corrDelta) ? Number(m.corrDelta.toFixed(2)) : null }))
      .filter((m) => m.d != null)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (scored.length) {
      const t = scored[0];
      topMember = { symbol: symbols[t.index] ?? null, corrDelta: numEnvelope(t.d, UNIT.correlation, { withBand: true }) };
    }
  }
  return { breadthStatus, topMember };
}

function captureBlock(captureAsymmetry) {
  const ca = captureAsymmetry ?? {};
  const cmp = ca.comparison ?? null;
  const comparisonValue = cmp ? (cmp.asymmetric ? cmp.direction ?? 'asymmetric' : 'symmetric') : null;
  return {
    betaDown: ca.down && Number.isFinite(ca.down.beta) ? numEnvelope(ca.down.beta, UNIT.beta, { n: ca.down.n ?? null }) : envelope({ status: 'insufficient_data', n: ca.counts?.down ?? null, reason: 'insufficient_data', unit: UNIT.beta }),
    betaUp: ca.up && Number.isFinite(ca.up.beta) ? numEnvelope(ca.up.beta, UNIT.beta, { n: ca.up.n ?? null }) : envelope({ status: 'insufficient_data', n: ca.counts?.up ?? null, reason: 'insufficient_data', unit: UNIT.beta }),
    nDown: numEnvelope(ca.counts?.down, UNIT.count),
    nUp: numEnvelope(ca.counts?.up, UNIT.count),
    comparison: enumEnvelope(comparisonValue),
  };
}

function tailSide(side) {
  if (!side) return { n: naEnvelope(UNIT.count), coMoveCount: naEnvelope(UNIT.count), groupMedian: naEnvelope(UNIT.returnFraction) };
  return {
    n: numEnvelope(side.n, UNIT.count),
    coMoveCount: numEnvelope(side.coMoveCount, UNIT.count),
    groupMedian: numEnvelope(side.groupMedian, UNIT.returnFraction),
  };
}

function driverContextBlock(driverContext) {
  const dc = driverContext ?? {};
  return {
    trailingReturn: Number.isFinite(dc.trailingReturn) ? numEnvelope(dc.trailingReturn, UNIT.returnFraction) : envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.returnFraction }),
    volPercentile: dc.vol && Number.isFinite(dc.vol.percentile) ? numEnvelope(dc.vol.percentile / 100, UNIT.fraction, { n: dc.vol.n ?? null }) : envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.fraction }),
  };
}

/**
 * Assemble the kind='deepDive' contract from already-computed deep-dive pieces.
 * @param {object} p
 * @returns {object} the summary contract (facts-only, envelope-normalized)
 */
export function buildDeepDiveContract(p) {
  const {
    generatedAt, dataAsOf, observationTradingDay, lookbackDays, group, groupType,
    driverId, driverType, driverSymbol,
    corr20, corr60, // headline latest values
    partial, selfPercentile, stability, cohesion, contribution, captureAsymmetry, tail, driverContext,
    tensionLatest, // { d, score, state } | null
    memberCount, joinedCloses, inflections,
  } = p;

  const facts = deepEvidenceFacts({ joinedCloses, memberCount, stability, cohesion, contribution, partial, tensionState: tensionLatest?.state ?? null });
  const evidence = buildEvidence(facts, DEEP_CRITERIA);

  const breaks = {
    count: Array.isArray(inflections) ? inflections.length : 0,
    latestBreakDay: Array.isArray(inflections) && inflections.length ? inflections[inflections.length - 1].startDate ?? null : null,
    freshnessWindowTradingDays: FRESHNESS_WINDOW_TRADING_DAYS,
  };

  return {
    ...commonBlock({ kind: 'deepDive', generatedAt, dataAsOf, observationTradingDay, lookbackDays, group, groupType }),
    driver: { driverId, driverType, symbol: driverSymbol },
    links: {
      raw20: rawLinkEnvelope(corr20),
      raw60: rawLinkEnvelope(corr60),
      adjusted20: adjustedLinkEnvelope(partial?.w20),
      adjusted60: adjustedLinkEnvelope(partial?.w60),
    },
    tension: tensionEnvelopes(tensionLatest),
    percentile: {
      corr20: percentileEnvelope(selfPercentile?.corr20),
      corr60: percentileEnvelope(selfPercentile?.corr60),
    },
    stability: {
      aboveFraction: stability && Number.isFinite(stability.aboveFraction) ? numEnvelope(stability.aboveFraction, UNIT.fraction, { n: stability.n ?? null }) : envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.fraction }),
      signPersistence: stability && Number.isFinite(stability.signPersistence) ? numEnvelope(stability.signPersistence, UNIT.fraction, { n: stability.n ?? null }) : envelope({ status: 'insufficient_data', reason: 'insufficient_data', unit: UNIT.fraction }),
      sign: enumEnvelope(stability?.sign ?? null, { status: stability?.sign ? 'ok' : 'insufficient_data' }),
    },
    cohesion: cohesionBlock(cohesion),
    contribution: contributionBlock(contribution),
    capture: captureBlock(captureAsymmetry),
    tail: { worst: tailSide(tail?.worst), best: tailSide(tail?.best) },
    driverContext: driverContextBlock(driverContext),
    evidence,
    breaks,
  };
}

/**
 * Build one topDrivers row for the scan contract from a scan payload row.
 * Row carries {driver, corr20, corr60, d, score, tensionState, joinedCloses,
 * tier, rq:{partial, stability}}.
 */
export function scanTopDriverRow(row, rank) {
  const partial = row.rq?.partial ?? null;
  const { env: primaryAdjEnv } = primaryAdjusted(partial);
  // The scan subset is [adequate_sample, stable_link, survives_adjustment,
  // tension_contained] — cohesion / broad_based are group-level (groupEvidence),
  // never per row — so the cohesion/breadth/memberCount facts are intentionally
  // absent here; buildEvidence never reads them for SCAN_CRITERIA.
  const facts = {
    joinedCloses: row.joinedCloses,
    stability: row.rq?.stability ?? null,
    primaryAdjustedValue: primaryAdjEnv.status === 'ok' ? primaryAdjEnv.value : null,
    partialApplicable: primaryAdjEnv.status === 'ok',
    marketProxy: primaryAdjEnv.status === 'suppressed' && primaryAdjEnv.reason === 'driver_is_market',
    tensionState: row.tensionState ?? null,
  };
  return {
    driverId: row.driver,
    rank,
    tier: row.tier,
    raw20: rawLinkEnvelope(row.corr20),
    raw60: rawLinkEnvelope(row.corr60),
    adjusted20: adjustedLinkEnvelope(partial?.w20),
    adjusted60: adjustedLinkEnvelope(partial?.w60),
    tension: tensionEnvelopes(row.tensionState != null || row.d != null ? { d: row.d, score: row.score, state: row.tensionState } : null),
    evidence: buildEvidence(facts, SCAN_CRITERIA),
  };
}

/**
 * Assemble the kind='scan' contract. topDrivers is the ≤10 rank-ordered rows;
 * groupEvidence carries the group-level cohesion envelope (breadthStatus is
 * not_applicable_in_scan — broad_based is group-level, computed once, never
 * per row). comparison + changes are passed in (built at cache-write assembly).
 */
export function buildScanContract(p) {
  const {
    generatedAt, dataAsOf, observationTradingDay, lookbackDays, group, groupType,
    driverUniverseHash, rows, cohesion, comparison, changes,
  } = p;
  const topDrivers = rows.slice(0, 10).map((row, i) => scanTopDriverRow(row, i + 1));
  return {
    ...commonBlock({ kind: 'scan', generatedAt, dataAsOf, observationTradingDay, lookbackDays, group, groupType }),
    driverUniverseHash,
    comparison,
    topDrivers,
    changes,
    groupEvidence: { cohesion: cohesionBlock(cohesion, { inScan: true }).c20, breadthStatus: 'not_applicable_in_scan' },
  };
}

// ── Flag dependency rule (pinned) ────────────────────────────────────────────
// Synthesis computes/serializes/renders ONLY when BOTH flags are on. The on/off
// misconfiguration short-circuits dark with a single console.warn.
export function synthesisActive(synthesisFlag, rqFlag) {
  if (synthesisFlag && !rqFlag) {
    console.warn('[correlation] CORRELATION_SYNTHESIS_ENABLED requires CORRELATION_RELATIONSHIP_QUALITY_ENABLED; synthesis stays dark.');
    return false;
  }
  return Boolean(synthesisFlag && rqFlag);
}

// ── Doc-size budget (finding: ≤ 700KB against Firestore's 1MB limit) ─────────
// TextEncoder (a standard Web API present in Node and browsers) gives the true
// UTF-8 byte length without the Node-only Buffer global.
export function serializedByteSize(obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}
