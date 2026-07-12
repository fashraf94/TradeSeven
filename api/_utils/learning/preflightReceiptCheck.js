// api/_utils/learning/preflightReceiptCheck.js
//
// Agent Learning System — L1 Phase A.5 — pre-flight capture-integrity check.
//
// Flash runs a SHORT preview capture, points this at the first handful of
// receipts, and only starts the long run if it PASSES. This prevents burning the
// full capture window on a silently-null field. OUTCOME-BLIND and purely
// structural: it asserts field presence, plausible non-null rates, the
// receiptSeq invariant, and that the dR null-reason discriminator isn't stuck.
// It reads no outcome and computes no measurement — it is NOT the M1–M9 harness.

// Paths a valid receipt must carry (the M1–M9 inputs). "Present" = the KEY
// exists (a null value is fine — that is data; a MISSING key is a defect).
const REQUIRED_PATHS = Object.freeze([
  'receiptSeq', 'symbolIn', 'symbolOut',
  'predicateInputs.symbolIn.bbPercentB',
  'predicateInputs.symbolIn.distanceToResistancePct',
  'predicateInputs.symbolIn.distTo52wkHigh',
  'predicateInputs.symbolIn.volumeRatio',
  'predicateInputs.symbolIn.upDayVolRatio',
  'predicateInputs.symbolIn.macdAboveSignal',
  'predicateInputs.symbolIn.nearestSupport',
  'predicateInputs.symbolIn.regime',
  'predicateInputs.symbolIn.dataMode',
  'predicateClassification.symbolIn.d1ClassAsSpecced',
  'predicateClassification.symbolIn.d1ClassDrAbstain',
  'predicateClassification.symbolIn.drNullReason',
  'predicateClassification.symbolIn.techDocUpdatedAtMs',
  'predicateClassification.symbolIn.predicateStalenessMs',
  'predicateClassification.symbolIn.symbolHourKey',
  'predicateProvenance.decisionAtMs',
  'predicateProvenance.rankingsComputedAtMs',
  'swapContext.tradeCountAtDecision',
  'swapContext.tradesLenAtDecision',
]);

function pathPresent(obj, path) {
  let cur = obj;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return false;
    cur = cur[seg];
  }
  return true;
}

function getPath(obj, path) {
  let cur = obj;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

const rate = (num, den) => (den > 0 ? num / den : 0);

/**
 * Validate a short capture sample before the long run.
 * @param {Array<Object>} receipts  captured receipt docs
 * @param {Object} [opts]
 * @param {number} [opts.expectedDrNullRate=0.59]  projected dR-null share (D1 audit)
 * @param {number} [opts.drNullRateTolerance=0.25]  band around the projection before WARN
 * @param {number} [opts.minTechDocNonNullRate=0.95]  predicateComputedAt should be ~always present
 * @param {number} [opts.minDataModeNonNullRate=0.9]  dataMode should be ~always present
 * @returns {{pass: boolean, checks: Array<{name,pass,level,detail}>, summary: Object}}
 */
export function validateCaptureSample(receipts, opts = {}) {
  const {
    expectedDrNullRate = 0.59,
    drNullRateTolerance = 0.25,
    minTechDocNonNullRate = 0.95,
    minDataModeNonNullRate = 0.9,
  } = opts;

  const list = Array.isArray(receipts) ? receipts : [];
  const n = list.length;
  const checks = [];
  // offendingIndices (optional): receipt indices a runner can print as samples.
  const add = (name, pass, level, detail, offendingIndices) =>
    checks.push({ name, pass, level, detail, ...(offendingIndices && offendingIndices.length ? { offendingIndices: offendingIndices.slice(0, 5) } : {}) });

  if (n === 0) {
    add('sample-nonempty', false, 'error', 'no receipts provided');
    return { pass: false, checks, summary: { n: 0 } };
  }

  // (a) Field presence — every required path present on every receipt.
  const missing = [];
  const missingIdx = new Set();
  list.forEach((r, i) => {
    for (const p of REQUIRED_PATHS) {
      if (!pathPresent(r, p)) { missing.push(`receipt[${i}].${p}`); missingIdx.add(i); }
    }
  });
  add('field-presence', missing.length === 0, 'error',
    missing.length === 0 ? `all ${REQUIRED_PATHS.length} required paths present on ${n} receipts`
      : `${missing.length} missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`,
    [...missingIdx]);

  // (b) Plausible non-null rates.
  const techNullIdx = list.map((r, i) => (getPath(r, 'predicateClassification.symbolIn.techDocUpdatedAtMs') == null ? i : -1)).filter((i) => i >= 0);
  const techRate = rate(n - techNullIdx.length, n);
  add('predicateComputedAt-nonnull', techRate >= minTechDocNonNullRate, 'error',
    `techDocUpdatedAtMs non-null ${(techRate * 100).toFixed(0)}% (≥ ${(minTechDocNonNullRate * 100).toFixed(0)}% required)`,
    techNullIdx);

  const dmNullIdx = list.map((r, i) => (getPath(r, 'predicateInputs.symbolIn.dataMode') == null ? i : -1)).filter((i) => i >= 0);
  const dmRate = rate(n - dmNullIdx.length, n);
  add('dataMode-populated', dmRate >= minDataModeNonNullRate, 'error',
    `dataMode non-null ${(dmRate * 100).toFixed(0)}% (≥ ${(minDataModeNonNullRate * 100).toFixed(0)}% required)`,
    dmNullIdx);

  const drNullCount = list.filter((r) => getPath(r, 'predicateInputs.symbolIn.distanceToResistancePct') === null).length;
  const drNullRate = rate(drNullCount, n);
  if (drNullRate === 0 || drNullRate === 1) {
    // A real sample of any size should have BOTH null and non-null dR (projection
    // ~0.59). 0% or 100% signals the field isn't being captured correctly.
    add('dR-null-rate', false, 'error', `dR null rate ${(drNullRate * 100).toFixed(0)}% — stuck (expected a mix near ${(expectedDrNullRate * 100).toFixed(0)}%)`);
  } else {
    const withinBand = Math.abs(drNullRate - expectedDrNullRate) <= drNullRateTolerance;
    add('dR-null-rate', true, withinBand ? 'info' : 'warn',
      `dR null rate ${(drNullRate * 100).toFixed(0)}% (projection ~${(expectedDrNullRate * 100).toFixed(0)}%)${withinBand ? '' : ' — outside plausible band, inspect'}`);
  }

  // (c) receiptSeq === tradeCountAtDecision + 1 invariant.
  const violations = [];
  const violIdx = [];
  list.forEach((r, i) => {
    const seq = getPath(r, 'receiptSeq');
    const tc = getPath(r, 'swapContext.tradeCountAtDecision');
    if (typeof seq === 'number' && typeof tc === 'number' && seq !== tc + 1) {
      violations.push(`receipt[${i}]: receiptSeq=${seq} ≠ tradeCount+1=${tc + 1}`);
      violIdx.push(i);
    }
  });
  add('receiptSeq-invariant', violations.length === 0, 'error',
    violations.length === 0 ? 'receiptSeq === tradeCountAtDecision + 1 holds'
      : `${violations.length} violations: ${violations.slice(0, 5).join('; ')}`,
    violIdx);

  // (d) drNullReason discriminator is not stuck.
  const reasons = list.map((r) => getPath(r, 'predicateClassification.symbolIn.drNullReason'));
  const distinct = new Set(reasons.filter((x) => x != null));
  const nullReceiptReasons = new Set(
    list.filter((r) => getPath(r, 'predicateInputs.symbolIn.distanceToResistancePct') === null)
      .map((r) => getPath(r, 'predicateClassification.symbolIn.drNullReason')).filter((x) => x != null),
  );
  if (distinct.size > 1) {
    add('drNullReason-diversity', true, 'info', `distinct reasons: ${[...distinct].join(', ')}`);
  } else if (distinct.size === 1 && distinct.has('present')) {
    add('drNullReason-diversity', true, 'warn', 'only "present" seen — no dR-null entries in sample; split unexercised (enlarge sample)');
  } else {
    add('drNullReason-diversity', false, 'error',
      `discriminator stuck at ${[...distinct].join(',') || 'none'}${nullReceiptReasons.size <= 1 && drNullCount > 0 ? ' — dR-null entries never vary (nearestSupport may not be captured)' : ''}`);
  }

  const pass = checks.filter((c) => c.level === 'error').every((c) => c.pass);
  return {
    pass,
    checks,
    summary: {
      n,
      predicateComputedAtNonNullRate: techRate,
      dataModeNonNullRate: dmRate,
      drNullRate,
      drNullReasonDistinct: [...distinct],
      receiptSeqViolations: violations.length,
      missingFieldCount: missing.length,
    },
  };
}
