/**
 * Correlation Intelligence Phase 2 — the NARRATION PLAN BUILDER (Change 1).
 *
 * PURE and DETERMINISTIC: the same deep-dive summaryContract (+ its displayed
 * driver label) yields a BYTE-IDENTICAL plan. Selects and orders the claims per
 * the pinned stance, and renders every value / unit / date / name / band into
 * the exact display string the card shows (§9 — the spans read the contract's
 * ONE pre-rounded/pre-banded source via the shared card formatters; the builder
 * NEVER re-rounds and NEVER re-bands).
 *
 * The plan is the model's whole instruction set: it hands the model the exact
 * span strings + the approved variants; the model only picks a variant and a
 * connective. Omission is caught HERE, before any model runs — a contract whose
 * REQUIRED claims (caveat / proxy / headline) can't be built fails loudly to
 * template (`ok:false`), which is the adverse-omission guarantee.
 *
 * Node-clean: imports the summary-contract schema/validator (input + plan-schema
 * style), the shared card formatters + ordinal (§9), and the phrasebook (variant
 * pruning). No network, no Firebase, no Date/Math.random.
 */
import { validateContract, schemaForKind } from './summaryContractSchema.js';
import { fmtCorr, fmtPct, fmtBeta, ordinal } from '../../src/components/Research/correlationVerdict.js';
import { PHRASEBOOK, variantsFor } from './narrationPhrasebook.js';

export const PLAN_BUILDER_VERSION = '1.1';

// ── Vocabulary (pinned) — each sampleSpan is bound to its OWN window so the
//    phrase matches the horizon the metric was measured over (§9). ────────────
const WINDOW_PHRASE = { 20: 'over the past month', 60: 'over the past 3 months' };
const SAMPLE_PHRASE = 'in this sample'; // sample-wide reads (tension, capture, tail, vol)
const DRIVER_MOVE_PHRASE = 'over the past 20 sessions'; // driverContext.trailingReturn — matches the card
const sessionsPhrase = (n) => `across ${n} sessions`;

// Render a numeric span from its envelope's OWN unit field — the ONE place the
// display unit is decided (§9 / diff-mode drivers). correlation → fmtCorr,
// beta → fmtBeta, return_fraction → fmtPct(1dp), fraction → fmtPct(0dp),
// standard_deviations → " SD", counts → String. Reads the contract's pre-rounded
// value verbatim — never re-rounds.
function renderByUnit(env) {
  const { value, unit } = env;
  switch (unit) {
    case 'correlation': return fmtCorr(value);
    case 'beta': return fmtBeta(value);
    case 'return_fraction': return fmtPct(value, 1);
    case 'fraction': return fmtPct(value, 0);
    case 'standard_deviations': return `${value.toFixed(2)} SD`;
    case 'count':
    case 'trading_days': return String(value);
    default: return String(value);
  }
}

// Failing/missing criterion → a rendered clause (server span, lexicon-clean).
const CRITERION_PHRASE = {
  adequate_sample: 'the sample was thin',
  stable_link: 'the link wandered across the window',
  group_coheres: 'the group did not move as one',
  broad_based: 'one member carried it',
  survives_adjustment: 'little of it survived the market adjustment',
  tension_contained: 'the link was under strain',
};
const STABLE_LINK_MISSING = "the link's stability could not be measured";
const TOO_FEW_CHECKS = 'too few checks applied to be sure';
const STRAIN_PHRASE = { stretched: 'it stretched to an extreme in the sample', break: 'it broke from its recent range' };

// Supporting-claim priority (pinned).
const SUPPORTING_ORDER = [
  'tension_elevated', 'percentile_extreme', 'capture_asymmetry',
  'tail_comovement', 'low_cohesion', 'driver_context',
];

const ALL_CLAIM_IDS = Object.keys(PHRASEBOOK);
const OPENING_CAVEATS = ['caveat_in_flux', 'caveat_fragile', 'caveat_limited'];

// ── Envelope helpers ─────────────────────────────────────────────────────────
const okNum = (env) => env && env.status === 'ok' && Number.isFinite(env.value);

// ── Deterministic claim constructor (fixed key order) ────────────────────────
function claim({ claimId, subjectId, metricId, fieldPath, spans, requiredPosition = null, allowedVariants, suppressedFamilies = [] }) {
  return {
    claimId,
    subjectId,
    metricId,
    fieldPath,
    polarity: 'assert',
    temporalScope: 'measured_sample',
    spans,
    sampleSpan: spans.sampleSpan ?? null,
    requiredPosition,
    allowedVariants,
    suppressedFamilies,
  };
}

// The variants of a claim whose `requires` slots are all present (non-null) in
// the rendered spans — the plan hands the model only span-satisfiable frames.
function prune(claimId, spans) {
  return variantsFor(claimId)
    .filter((v) => v.requires.every((slot) => spans[slot] != null))
    .map((v) => v.id);
}

// ── Opening caveat ───────────────────────────────────────────────────────────
function buildCaveat(readState, tensionState, criteriaById, sampleSpan) {
  if (readState === 'in_flux') {
    const strain = STRAIN_PHRASE[tensionState];
    if (!strain) return null; // in_flux without a strain state is unbuildable
    const spans = { strain, sampleSpan };
    return claim({ claimId: 'caveat_in_flux', subjectId: 'read_quality', metricId: 'tension.state', fieldPath: 'tension.state', spans, requiredPosition: 1, allowedVariants: prune('caveat_in_flux', spans) });
  }
  // fragile / limited carry the failing/missing criterion IDs as a rendered span.
  const failing = [];
  if (readState === 'limited') {
    const as = criteriaById.adequate_sample;
    const sl = criteriaById.stable_link;
    if (as?.outcome === 'fail') failing.push(CRITERION_PHRASE.adequate_sample);
    if (sl?.outcome === 'fail') failing.push(CRITERION_PHRASE.stable_link);
    else if (sl?.outcome === 'not_applicable') failing.push(STABLE_LINK_MISSING);
    if (!failing.length) failing.push(TOO_FEW_CHECKS); // limited purely by applicableCount < 4
  } else {
    // fragile: name every applicable criterion that failed, in contract order.
    for (const c of Object.values(criteriaById)) {
      if (c.outcome === 'fail' && CRITERION_PHRASE[c.id]) failing.push(CRITERION_PHRASE[c.id]);
    }
  }
  if (!failing.length) return null; // unbuildable → adverse-omission → template
  const criterion = failing.join(' and ');
  const id = readState === 'limited' ? 'caveat_limited' : 'caveat_fragile';
  const spans = { criterion, sampleSpan };
  return claim({ claimId: id, subjectId: 'read_quality', metricId: 'evidence.readState', fieldPath: 'evidence.criteria', spans, requiredPosition: 1, allowedVariants: prune(id, spans) });
}

// ── Proxy disclosure ─────────────────────────────────────────────────────────
function buildProxy(name, requiredPosition) {
  const spans = { name, sampleSpan: WINDOW_PHRASE[60] };
  const allowedVariants = prune('proxy_disclosure', spans);
  if (!allowedVariants.length) return null;
  return claim({ claimId: 'proxy_disclosure', subjectId: 'read_type', metricId: 'evidence.readType', fieldPath: 'links.adjusted60', spans, requiredPosition, allowedVariants, suppressedFamilies: ['adjusted_link'] });
}

// ── Headline ─────────────────────────────────────────────────────────────────
function buildHeadline(contract, name, marketProxy) {
  const { raw20, raw60, adjusted20, adjusted60 } = contract.links;
  // Prefer the 60d headline; fall back to 20d. A null band (|corr| < 0.15) is a
  // "no reliable link" read — not narratable via the band frames → template floor.
  let link = null;
  let window = null;
  if (okNum(raw60) && raw60.band) { link = raw60; window = 60; }
  else if (okNum(raw20) && raw20.band) { link = raw20; window = 20; }
  if (!link) return null;

  const spans = {
    name,
    direction: link.value >= 0 ? 'with' : 'against',
    band: link.band,
    value: renderByUnit(link),
    sampleSpan: WINDOW_PHRASE[window],
  };
  const suppressedFamilies = [];
  // Adjusted clause only for a standard read whose adjusted link is an ok band.
  if (!marketProxy) {
    const adj = okNum(adjusted60) && adjusted60.band ? adjusted60 : (okNum(adjusted20) && adjusted20.band ? adjusted20 : null);
    if (adj) { spans.adjBand = adj.band; spans.adjValue = renderByUnit(adj); }
    else suppressedFamilies.push('adjusted_link');
  } else {
    suppressedFamilies.push('adjusted_link'); // the proxy claim IS the adjusted statement
  }
  const metricId = window === 60 ? 'links.raw60' : 'links.raw20';
  return claim({ claimId: 'headline_link', subjectId: 'group_vs_driver', metricId, fieldPath: metricId, spans, allowedVariants: prune('headline_link', spans), suppressedFamilies });
}

// ── Supporting claims ────────────────────────────────────────────────────────
// Each returns a claim or null (null = family excluded: envelope not ok or the
// notable condition did not fire). Supporting claims never fail the plan.
function buildSupporting(id, contract, name, tensionState) {
  switch (id) {
    case 'tension_elevated': {
      // Cite the divergence `d` (correlation unit) — the number the gauge prints
      // via fmtCorr (§9), never the SDS-as-significance.
      if (tensionState !== 'elevated' || !okNum(contract.tension?.d)) return null;
      const spans = { value: renderByUnit(contract.tension.d), sampleSpan: SAMPLE_PHRASE };
      return claim({ claimId: id, subjectId: 'tension', metricId: 'tension.d', fieldPath: 'tension.d', spans, allowedVariants: prune(id, spans) });
    }
    case 'percentile_extreme': {
      // Prefer the 1-month percentile (the one the card shows) when IT is extreme,
      // else the 3-month; the sampleSpan tracks whichever window was used.
      const isExtreme = (e) => okNum(e) && (e.value <= 0.1 || e.value >= 0.9);
      let p = null; let window = null;
      if (isExtreme(contract.percentile?.corr20)) { p = contract.percentile.corr20; window = 20; }
      else if (isExtreme(contract.percentile?.corr60)) { p = contract.percentile.corr60; window = 60; }
      if (!p) return null;
      const spans = { pct: `${ordinal(Math.round(p.value * 100))} percentile`, sampleSpan: WINDOW_PHRASE[window] };
      return claim({ claimId: id, subjectId: 'percentile', metricId: `percentile.corr${window}`, fieldPath: `percentile.corr${window}`, spans, allowedVariants: prune(id, spans) });
    }
    case 'capture_asymmetry': {
      // Two-sided: both betas with their own n, and the stronger side named.
      const cmp = contract.capture?.comparison?.value;
      if (cmp !== 'down' && cmp !== 'up') return null; // only a named-direction asymmetry
      const bDown = contract.capture.betaDown;
      const bUp = contract.capture.betaUp;
      if (!okNum(bDown) || !okNum(bUp) || bDown.n == null || bUp.n == null) return null;
      const spans = {
        direction: cmp,
        betaDown: renderByUnit(bDown), betaUp: renderByUnit(bUp),
        nDown: String(bDown.n), nUp: String(bUp.n),
        sampleSpan: SAMPLE_PHRASE,
      };
      return claim({ claimId: id, subjectId: 'capture', metricId: 'capture', fieldPath: 'capture', spans, allowedVariants: prune(id, spans) });
    }
    case 'tail_comovement': {
      const w = contract.tail?.worst;
      if (!w || !okNum(w.n) || !okNum(w.coMoveCount)) return null;
      const spans = { name, n: String(w.n.value), coMoveCount: String(w.coMoveCount.value), sampleSpan: SAMPLE_PHRASE };
      return claim({ claimId: id, subjectId: 'tail', metricId: 'tail.worst', fieldPath: 'tail.worst', spans, allowedVariants: prune(id, spans) });
    }
    case 'low_cohesion': {
      const c = contract.cohesion?.c20;
      if (!okNum(c) || !(c.band === 'loose' || c.value < 0)) return null;
      const spans = { value: renderByUnit(c), sampleSpan: WINDOW_PHRASE[20] }; // c20 = a 1-month window
      return claim({ claimId: id, subjectId: 'cohesion', metricId: 'cohesion.c20', fieldPath: 'cohesion.c20', spans, allowedVariants: prune(id, spans) });
    }
    case 'driver_context': {
      const vol = contract.driverContext?.volPercentile;
      const ret = contract.driverContext?.trailingReturn;
      if (okNum(vol) && vol.value >= 0.8) {
        const spans = { name, volpct: `${ordinal(Math.round(vol.value * 100))} percentile`, sampleSpan: SAMPLE_PHRASE };
        return claim({ claimId: id, subjectId: 'driver_context', metricId: 'driverContext.volPercentile', fieldPath: 'driverContext.volPercentile', spans, allowedVariants: prune(id, spans) });
      }
      if (okNum(ret) && Math.abs(ret.value) >= 0.1) {
        // renderByUnit consumes the envelope's own unit (return_fraction → fmtPct) so
        // a diff-mode driver's trailing move formats from the contract, not a guess.
        const spans = { name, ret: renderByUnit(ret), sampleSpan: DRIVER_MOVE_PHRASE };
        return claim({ claimId: id, subjectId: 'driver_context', metricId: 'driverContext.trailingReturn', fieldPath: 'driverContext.trailingReturn', spans, allowedVariants: prune(id, spans) });
      }
      return null;
    }
    default:
      return null;
  }
}

// ── The plan builder ─────────────────────────────────────────────────────────
/**
 * @param {object} contract - a deep-dive summaryContract (kind:'deepDive')
 * @param {{driverLabel?: string}} [opts] - the driver's DISPLAYED label (the same
 *   string the Lab card shows, §9); falls back to the contract's driver symbol.
 * @returns {{ok:true, plan:{planBuilderVersion,claims}} | {ok:false, code, errors?}}
 */
export function buildNarrationPlan(contract, opts = {}) {
  // 0. Input must be a schema-valid deep-dive contract.
  if (!contract || contract.kind !== 'deepDive') return { ok: false, code: 'wrong_kind' };
  const inputCheck = validateContract(schemaForKind('deepDive'), contract);
  if (!inputCheck.valid) return { ok: false, code: 'contract_invalid', errors: inputCheck.errors };

  const name = opts.driverLabel || contract.driver?.symbol || contract.driver?.driverId;
  if (!name) return { ok: false, code: 'no_driver_name' };

  const readState = contract.evidence.readState;
  const readType = contract.evidence.readType;
  const marketProxy = readType === 'market_proxy';
  const tensionState = contract.tension?.state?.value ?? null;
  const criteriaById = Object.fromEntries(contract.evidence.criteria.map((c) => [c.id, c]));
  const joinedCloses = criteriaById.adequate_sample?.value;
  const sampleSessions = Number.isFinite(joinedCloses) ? sessionsPhrase(joinedCloses) : null;

  const claims = [];

  // 1. Opening caveat — REQUIRED and FIRST when readState ≠ solid.
  if (readState !== 'solid') {
    if (!sampleSessions) return { ok: false, code: 'caveat_unbuildable' };
    const caveat = buildCaveat(readState, tensionState, criteriaById, sampleSessions);
    if (!caveat) return { ok: false, code: 'caveat_unbuildable' };
    claims.push(caveat);
  }

  // 2. Proxy disclosure — REQUIRED when market_proxy. Position 1, or 2 behind an
  //    opening caveat (generalizes the pinned in_flux interaction to any caveat).
  if (marketProxy) {
    const proxy = buildProxy(name, claims.length + 1);
    if (!proxy) return { ok: false, code: 'proxy_unbuildable' };
    claims.push(proxy);
  }

  // 3. Headline — always.
  const headline = buildHeadline(contract, name, marketProxy);
  if (!headline) return { ok: false, code: 'headline_unbuildable' };
  claims.push(headline);

  // 4. Up to TWO supporting claims, by pinned priority.
  let supportingCount = 0;
  for (const id of SUPPORTING_ORDER) {
    if (supportingCount >= 2) break;
    const c = buildSupporting(id, contract, name, tensionState);
    if (c && c.allowedVariants.length) { claims.push(c); supportingCount += 1; }
  }

  // D1 (Rider 1) — the named thin-solid trigger: a clean solid standard read with
  // little else to add routes to the deterministic "standard summary", not a
  // model call for a one-liner. Explicit semantic rule, not a raw claim count.
  if (readState === 'solid' && readType === 'standard' && supportingCount <= 1) {
    return { ok: false, code: 'thin_solid_read' };
  }

  // 5. Closing caveat — present iff readState ≠ solid.
  if (readState !== 'solid') {
    if (!sampleSessions) return { ok: false, code: 'closing_unbuildable' };
    const spans = { sampleSpan: sampleSessions };
    claims.push(claim({ claimId: 'closing_caveat', subjectId: 'read_quality', metricId: 'evidence.readState', fieldPath: 'evidence', spans, allowedVariants: prune('closing_caveat', spans) }));
  }

  const plan = { planBuilderVersion: PLAN_BUILDER_VERSION, claims };

  // 6. Self-validate: plan-schema + mandatory-claim rules. A plan that fails here
  //    never reaches the model (defense-in-depth on the builder's own output).
  const selfCheck = validateSelf(plan, { readState, marketProxy, supportingCount });
  if (!selfCheck.ok) return selfCheck;

  return { ok: true, plan };
}

// ── Plan schema (same hand-rolled validator as the contract; no ajv/zod) ─────
const claimSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['claimId', 'subjectId', 'metricId', 'fieldPath', 'polarity', 'temporalScope', 'spans', 'sampleSpan', 'requiredPosition', 'allowedVariants', 'suppressedFamilies'],
  properties: {
    claimId: { enum: ALL_CLAIM_IDS },
    subjectId: { type: 'string' },
    metricId: { type: 'string' },
    fieldPath: { type: 'string' },
    polarity: { const: 'assert' },
    temporalScope: { const: 'measured_sample' },
    spans: { type: 'object', additionalProperties: { type: 'string' } },
    sampleSpan: { type: ['string', 'null'] },
    requiredPosition: { type: ['integer', 'null'] },
    allowedVariants: { type: 'array', items: { type: 'string' } },
    suppressedFamilies: { type: 'array', items: { type: 'string' } },
  },
};
const NARRATION_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['planBuilderVersion', 'claims'],
  properties: {
    planBuilderVersion: { type: 'string' },
    claims: { type: 'array', items: claimSchema },
  },
};

function validateSelf(plan, { readState, marketProxy, supportingCount }) {
  const schemaCheck = validateContract(NARRATION_PLAN_SCHEMA, plan);
  if (!schemaCheck.valid) return { ok: false, code: 'plan_schema_invalid', errors: schemaCheck.errors };

  const { claims } = plan;
  const ids = claims.map((c) => c.claimId);
  const openingCount = claims.filter((c) => OPENING_CAVEATS.includes(c.claimId)).length;
  const headlineCount = ids.filter((id) => id === 'headline_link').length;
  const proxyCount = ids.filter((id) => id === 'proxy_disclosure').length;
  const closingCount = ids.filter((id) => id === 'closing_caveat').length;

  const rule = (cond, code) => (cond ? null : { ok: false, code });
  const checks = [
    rule(claims.length >= 2 && claims.length <= 6, 'claim_count_out_of_range'),
    rule(headlineCount === 1, 'headline_rule'),
    rule(supportingCount <= 2, 'supporting_cap'),
    rule(openingCount === (readState !== 'solid' ? 1 : 0), 'opening_caveat_rule'),
    rule(closingCount === (readState !== 'solid' ? 1 : 0), 'closing_caveat_rule'),
    rule(proxyCount === (marketProxy ? 1 : 0), 'proxy_rule'),
    // opening caveat, when present, is FIRST.
    rule(readState === 'solid' || OPENING_CAVEATS.includes(ids[0]), 'caveat_not_first'),
  ];
  for (const c of checks) if (c) return c;

  // Per-claim: allowedVariants non-empty, real, span-satisfiable; requiredPosition
  // honored.
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i];
    if (!c.allowedVariants.length) return { ok: false, code: 'no_allowed_variants', detail: c.claimId };
    for (const vid of c.allowedVariants) {
      const v = variantsFor(c.claimId).find((x) => x.id === vid);
      if (!v) return { ok: false, code: 'unknown_variant', detail: `${c.claimId}/${vid}` };
      if (!v.requires.every((slot) => c.spans[slot] != null)) return { ok: false, code: 'variant_span_gap', detail: `${c.claimId}/${vid}` };
    }
    if (c.requiredPosition != null && c.requiredPosition !== i + 1) return { ok: false, code: 'required_position_mismatch', detail: c.claimId };
  }
  return { ok: true };
}
