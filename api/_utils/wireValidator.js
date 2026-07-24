// api/_utils/wireValidator.js
// FantasyTimes Wire — the agentFacts validator (Spec V1.5 §4.2).
//
// Pure function. Strict allowlist projection FIRST (unknown keys at any
// depth → REJECT — this, not a name blacklist, is the P1 enforcement), then
// the rule battery:
//   R1 unknown keys · R2 directive-field named check · R3 reporter allowlist
//   R4 contract-table violations (required fields, types, enums, cardinality,
//      oversize, sign consistency, non-null direction on previews)
//   R5 truncation (stop_reason === 'max_tokens' → outcome 'truncated')
//   S1 salvage (invalid OPTIONAL field dropped; survivors publish)
//   F1 ticker normalization (uppercase, dot→hyphen) + off-universe strip
//      against TICKER_TO_SECTOR (D8)
//   F2 quarantine (a ≥1-ticker contract that ends with zero in-universe
//      tickers post-strip)
//
// Outputs CLASS CODES for the public story doc and full reason strings for
// the server-side envelope/receipt (F2-3). No validation outcome ever blocks
// story publication (P3).

import { TICKER_TO_SECTOR } from './rankingConfig.js';
import {
  EVENT_CONTRACTS,
  REPORTER_EVENT_ALLOWLIST,
  DIRECTIONS,
  UNITS,
  KEY_LEVEL_TYPES,
  FIGURES_CAP,
  QUALIFIERS_CAP,
  TICKER_MAX_LENGTH,
  WIRE_CODES,
  WIRE_OUTCOMES,
  WIRE_VALIDATOR_VERSION,
  figureBasesFor,
} from './wireContracts.js';

// The ONLY keys projection copies through. Anything else, at any depth of
// the declared shape, is R1.
const TOP_LEVEL_KEYS = ['eventType', 'tickers', 'direction', 'magnitude', 'keyLevel', 'figures', 'qualifiers'];
const MAGNITUDE_KEYS = ['value', 'unit', 'basis'];
const KEYLEVEL_KEYS = ['price', 'type'];
const FIGURE_KEYS = ['value', 'unit', 'basis'];

// R2's named check (observability; subsumed by R1 but reported distinctly).
const DIRECTIVE_FIELDS = ['recommended_action', 'sentiment'];

/** Normalize a ticker: uppercase, trim, dots→hyphens (D8/F1). */
export function normalizeWireTicker(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\./g, '-');
}

/** In-universe membership per D8: a key of rankingConfig's TICKER_TO_SECTOR. */
export function isInWireUniverse(normalizedTicker) {
  return Object.prototype.hasOwnProperty.call(TICKER_TO_SECTOR, normalizedTicker);
}

/**
 * Validate model-emitted agentFacts for one story.
 *
 * @param {object} opts
 * @param {*}      opts.rawAgentFacts — the model's agentFacts tool-input value
 *                 (may be undefined/null/malformed — never trusted)
 * @param {string} opts.reporter — server-known reporter key ('kai'|'alex'|…)
 * @param {string|null} opts.stopReason — the response's stop_reason
 *                 (batch results pass the per-result message's stop_reason)
 * @returns {{
 *   outcome: string, codes: string[], reasons: string[],
 *   facts: object|null,            // normalized survivors (ModelAgentFacts shape)
 *   offUniverseTickers: string[],
 *   preStripTickerCount: number,   // model-emitted count BEFORE F1 strip (B7)
 *   quarantined: boolean,
 *   projectionSucceeded: boolean,  // hash-input selector (F2-2)
 *   validatorVersion: string,
 * }}
 */
export function validateAgentFacts({ rawAgentFacts, reporter, stopReason }) {
  const codes = [];
  const reasons = [];
  const base = {
    facts: null,
    offUniverseTickers: [],
    preStripTickerCount: 0,
    quarantined: false,
    projectionSucceeded: false,
    validatorVersion: WIRE_VALIDATOR_VERSION,
  };

  const reject = () => ({ ...base, outcome: WIRE_OUTCOMES.REJECTED, codes, reasons });

  // ── R5: truncation preempts everything (§4.2) ──────────────────────────
  if (stopReason === 'max_tokens') {
    codes.push(WIRE_CODES.R5_TRUNCATED);
    reasons.push('stop_reason=max_tokens: tool input may be partial; facts not trusted');
    return { ...base, outcome: WIRE_OUTCOMES.TRUNCATED, codes, reasons };
  }

  // ── Presence ───────────────────────────────────────────────────────────
  if (rawAgentFacts === undefined || rawAgentFacts === null) {
    codes.push(WIRE_CODES.R4_MISSING);
    reasons.push('agentFacts absent from tool input');
    return reject();
  }
  if (typeof rawAgentFacts !== 'object' || Array.isArray(rawAgentFacts)) {
    codes.push(WIRE_CODES.R4_TYPE);
    reasons.push(`agentFacts is ${Array.isArray(rawAgentFacts) ? 'an array' : typeof rawAgentFacts}, expected object`);
    return reject();
  }

  // ── R2 named check (before projection so it is reported as R2) ─────────
  const directiveHits = DIRECTIVE_FIELDS.filter((f) =>
    Object.prototype.hasOwnProperty.call(rawAgentFacts, f)
  );
  if (directiveHits.length > 0) {
    codes.push(WIRE_CODES.R2_DIRECTIVE_FIELD);
    reasons.push(`directive field(s) present in agentFacts: ${directiveHits.join(', ')}`);
    return reject();
  }

  // ── R1: strict allowlist projection, unknown keys at any depth ─────────
  const unknown = collectUnknownKeys(rawAgentFacts);
  if (unknown.length > 0) {
    codes.push(WIRE_CODES.R1_UNKNOWN_KEYS);
    reasons.push(`unknown key(s) in agentFacts: ${unknown.join(', ')}`);
    return reject();
  }
  base.projectionSucceeded = true;

  // ── eventType: required; R3 reporter allowlist ─────────────────────────
  const eventType = rawAgentFacts.eventType;
  if (typeof eventType !== 'string' || eventType.length === 0) {
    codes.push(WIRE_CODES.R4_MISSING);
    reasons.push('eventType missing');
    return reject();
  }
  if (!EVENT_CONTRACTS[eventType]) {
    codes.push(WIRE_CODES.R4_ENUM);
    reasons.push(`eventType '${eventType.slice(0, 40)}' is not a contract eventType`);
    return reject();
  }
  const allowlist = REPORTER_EVENT_ALLOWLIST[reporter] || [];
  if (!allowlist.includes(eventType)) {
    codes.push(WIRE_CODES.R3_EVENTTYPE);
    reasons.push(`eventType '${eventType}' outside ${reporter}'s allowlist [${allowlist.join(', ')}]`);
    return reject();
  }
  const contract = EVENT_CONTRACTS[eventType];

  // ── tickers: required array; cardinality PRE-STRIP; oversize; F1 ───────
  const rawTickers = rawAgentFacts.tickers;
  if (!Array.isArray(rawTickers)) {
    codes.push(WIRE_CODES.R4_MISSING);
    reasons.push('tickers missing or not an array');
    return reject();
  }
  base.preStripTickerCount = rawTickers.length;
  const [minT, maxT] = contract.tickers;
  if (rawTickers.length < minT || rawTickers.length > maxT) {
    codes.push(WIRE_CODES.R4_CARDINALITY);
    reasons.push(`tickers cardinality ${rawTickers.length} outside [${minT},${maxT}] for ${eventType} (pre-strip)`);
    return reject();
  }
  const normalizedTickers = [];
  for (const t of rawTickers) {
    if (typeof t !== 'string') {
      codes.push(WIRE_CODES.R4_TYPE);
      reasons.push('tickers[] contains a non-string entry');
      return reject();
    }
    const norm = normalizeWireTicker(t);
    if (!norm || norm.length > TICKER_MAX_LENGTH) {
      codes.push(WIRE_CODES.R4_OVERSIZE);
      reasons.push(`ticker '${String(t).slice(0, 40)}' empty or exceeds ${TICKER_MAX_LENGTH} chars after normalization`);
      return reject();
    }
    if (!normalizedTickers.includes(norm)) normalizedTickers.push(norm);
  }
  const inUniverse = normalizedTickers.filter(isInWireUniverse);
  const offUniverse = normalizedTickers.filter((t) => !isInWireUniverse(t));
  if (offUniverse.length > 0) {
    codes.push(WIRE_CODES.F1_OFFUNIVERSE);
    reasons.push(`off-universe ticker(s) moved out: ${offUniverse.join(', ')}`);
  }
  base.offUniverseTickers = offUniverse;

  // ── direction: forbidden on previews; enum when present ────────────────
  let direction = rawAgentFacts.direction ?? null;
  if (contract.direction === 'forbidden' && direction !== null) {
    codes.push(WIRE_CODES.R4_DIRECTION_ON_PREVIEW);
    reasons.push(`non-null direction (${JSON.stringify(direction)}) on preview eventType ${eventType}`);
    return reject();
  }
  if (direction !== null && !DIRECTIONS.includes(direction)) {
    // Optional field with an invalid value → salvage-drop (S1), not reject.
    codes.push(WIRE_CODES.SALVAGE_DIRECTION);
    reasons.push(`direction ${JSON.stringify(direction)} not in [${DIRECTIONS.join(', ')}]; dropped`);
    direction = null;
  }

  // ── magnitude (optional): unit/basis enums, finite value ───────────────
  let magnitude = rawAgentFacts.magnitude ?? null;
  if (magnitude !== null) {
    const valid =
      typeof magnitude === 'object' && !Array.isArray(magnitude) &&
      Number.isFinite(magnitude.value) &&
      UNITS.includes(magnitude.unit) &&
      contract.magnitudeBases.includes(magnitude.basis);
    if (!valid) {
      codes.push(WIRE_CODES.SALVAGE_MAGNITUDE);
      reasons.push(`magnitude invalid for ${eventType} (value/unit/basis check failed); dropped`);
      magnitude = null;
    } else {
      magnitude = { value: magnitude.value, unit: magnitude.unit, basis: magnitude.basis };
    }
  }

  // ── keyLevel (optional): finite price, type enum ───────────────────────
  let keyLevel = rawAgentFacts.keyLevel ?? null;
  if (keyLevel !== null) {
    const valid =
      typeof keyLevel === 'object' && !Array.isArray(keyLevel) &&
      Number.isFinite(keyLevel.price) &&
      KEY_LEVEL_TYPES.includes(keyLevel.type);
    if (!valid) {
      codes.push(WIRE_CODES.SALVAGE_KEYLEVEL);
      reasons.push('keyLevel invalid (price/type check failed); dropped');
      keyLevel = null;
    } else {
      keyLevel = { price: keyLevel.price, type: keyLevel.type };
    }
  }

  // ── figures (optional array, cap 4 = R4 oversize; bad items salvage) ───
  let figures = rawAgentFacts.figures ?? [];
  if (!Array.isArray(figures)) {
    codes.push(WIRE_CODES.SALVAGE_FIGURE);
    reasons.push('figures not an array; dropped');
    figures = [];
  } else if (figures.length > FIGURES_CAP) {
    codes.push(WIRE_CODES.R4_OVERSIZE);
    reasons.push(`figures length ${figures.length} exceeds cap ${FIGURES_CAP}`);
    return reject();
  } else {
    const allowedBases = figureBasesFor(eventType);
    const kept = [];
    for (const f of figures) {
      const valid =
        f && typeof f === 'object' && !Array.isArray(f) &&
        Number.isFinite(f.value) && UNITS.includes(f.unit) && allowedBases.includes(f.basis) &&
        Object.keys(f).every((k) => FIGURE_KEYS.includes(k));
      if (valid) {
        kept.push({ value: f.value, unit: f.unit, basis: f.basis });
      } else {
        codes.push(WIRE_CODES.SALVAGE_FIGURE);
        reasons.push('figures[] item invalid; dropped');
      }
    }
    figures = kept;
  }

  // ── qualifiers (optional array, cap 3 = R4 oversize; bad items salvage) ─
  let qualifiers = rawAgentFacts.qualifiers ?? [];
  if (!Array.isArray(qualifiers)) {
    codes.push(WIRE_CODES.SALVAGE_QUALIFIER);
    reasons.push('qualifiers not an array; dropped');
    qualifiers = [];
  } else if (qualifiers.length > QUALIFIERS_CAP) {
    codes.push(WIRE_CODES.R4_OVERSIZE);
    reasons.push(`qualifiers length ${qualifiers.length} exceeds cap ${QUALIFIERS_CAP}`);
    return reject();
  } else {
    const kept = [];
    for (const q of qualifiers) {
      if (contract.qualifiers.includes(q)) {
        if (!kept.includes(q)) kept.push(q);
      } else {
        codes.push(WIRE_CODES.SALVAGE_QUALIFIER);
        reasons.push(`qualifier ${JSON.stringify(q)} not in ${eventType}'s enum; dropped`);
      }
    }
    qualifiers = kept;
  }

  // ── R4 sign consistency (post-salvage survivors; REJECT-class) ─────────
  if (direction !== null && magnitude !== null) {
    const contradicts =
      (direction === 'up' && magnitude.value < 0) ||
      (direction === 'down' && magnitude.value > 0);
    if (contradicts) {
      codes.push(WIRE_CODES.R4_SIGN);
      reasons.push(`direction=${direction} contradicts magnitude.value=${magnitude.value}`);
      return reject();
    }
  }

  // ── F2 quarantine: ≥1-ticker contract, zero in-universe post-strip ─────
  if (minT >= 1 && inUniverse.length === 0) {
    codes.push(WIRE_CODES.F2_QUARANTINE);
    reasons.push('zero in-universe tickers after off-universe strip on a ticker-required eventType');
    base.quarantined = true;
  }

  const facts = {
    eventType,
    tickers: inUniverse,
    direction,
    magnitude,
    keyLevel,
    figures,
    qualifiers,
  };

  const salvaged = codes.some((c) => c.startsWith('SALVAGE_'));
  const outcome = base.quarantined
    ? WIRE_OUTCOMES.QUARANTINED
    : salvaged
      ? WIRE_OUTCOMES.SALVAGED
      : WIRE_OUTCOMES.PASSED;

  return { ...base, outcome, codes, reasons, facts };
}

/**
 * Recursive unknown-key scan over the DECLARED shape only. Returns dotted
 * paths of every key outside the allowlist ('' paths never leak values —
 * key names only, and even those stay in envelope-side reasons).
 */
function collectUnknownKeys(raw) {
  const unknown = [];
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) unknown.push(key);
  }
  checkObjectKeys(raw.magnitude, MAGNITUDE_KEYS, 'magnitude', unknown);
  checkObjectKeys(raw.keyLevel, KEYLEVEL_KEYS, 'keyLevel', unknown);
  if (Array.isArray(raw.figures)) {
    raw.figures.forEach((f, i) => checkObjectKeys(f, FIGURE_KEYS, `figures[${i}]`, unknown));
  }
  return unknown;
}

function checkObjectKeys(obj, allowed, path, out) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) out.push(`${path}.${key}`);
  }
}
