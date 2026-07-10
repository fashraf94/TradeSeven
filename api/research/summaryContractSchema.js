/**
 * Correlation Intelligence V3 Sub-build 2 — the summary-contract JSON-schema
 * lock + a tiny hand-rolled validator (founder decision: no new dependency).
 *
 * `additionalProperties:false` on every object per known revision, so ANY drift
 * — a renamed field, a stray key, a wrong enum — fails the fixture test loudly
 * (the repo's shape-pinning discipline, formalized). The validator is also
 * called defensively at cache-write time behind a try/catch that console.warns
 * and never 500s (validator-failure telemetry: warn, never fail the response).
 *
 * Supported keywords (the subset the contract needs): type (string | string[]),
 * enum, const, required, properties, additionalProperties (false | schema),
 * items. `type` arrays including 'null' express nullability.
 */
import {
  UNIT,
  CONTRACT_VERSION,
  SCHEMA_REVISION,
} from './summaryContract.js';

// ── The validator ────────────────────────────────────────────────────────────
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number' && Number.isInteger(v)) return 'integer';
  return typeof v; // 'number' | 'string' | 'boolean' | 'object'
}

function matchesType(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'integer') return actual === 'integer';
  return actual === t;
}

function validateNode(schema, value, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  if ('const' in schema) {
    if (value !== schema.const) errors.push({ path, message: `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
    return;
  }
  if (schema.enum) {
    if (!schema.enum.some((e) => e === value)) errors.push({ path, message: `value ${JSON.stringify(value)} not in enum` });
    return;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push({ path, message: `expected type ${types.join('|')}, got ${typeOf(value)}` });
      return; // can't recurse into a mistyped node
    }
    if (value === null) return;
  }

  if (typeOf(value) === 'object' && (schema.properties || schema.required || schema.additionalProperties !== undefined)) {
    const props = schema.properties || {};
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push({ path: `${path}.${key}`, message: 'required property missing' });
    }
    for (const [key, v] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (props[key]) {
        validateNode(props[key], v, childPath, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: childPath, message: 'additional property not allowed' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateNode(schema.additionalProperties, v, childPath, errors);
      }
    }
  }

  if (typeOf(value) === 'array' && schema.items) {
    value.forEach((item, i) => validateNode(schema.items, item, `${path}[${i}]`, errors));
  }
}

/**
 * @param {object} schema - a schema object (from the tables below)
 * @param {*} doc - the value to validate
 * @returns {{valid:boolean, errors:Array<{path,message}>}}
 */
export function validateContract(schema, doc) {
  const errors = [];
  validateNode(schema, doc, '$', errors);
  return { valid: errors.length === 0, errors };
}

// ── Schema constructors ──────────────────────────────────────────────────────
const STATUS_ENUM = ['ok', 'suppressed', 'skipped', 'insufficient_data', 'not_applicable'];
const UNIT_ENUM = Object.values(UNIT);
const BAND_ENUM = ['strong', 'moderate', 'loose', null];

// A metric envelope. bandable envelopes REQUIRE `band` (correlation-unit); the
// rest forbid it (additionalProperties:false).
function env({ band = false } = {}) {
  const properties = {
    status: { enum: STATUS_ENUM },
    value: { type: ['number', 'string', 'null'] },
    n: { type: ['integer', 'null'] },
    reason: { type: ['string', 'null'] },
    unit: { enum: UNIT_ENUM },
  };
  const required = ['status', 'value', 'n', 'reason', 'unit'];
  if (band) {
    properties.band = { enum: BAND_ENUM };
    required.push('band');
  }
  return { type: 'object', additionalProperties: false, required, properties };
}
const bandEnv = () => env({ band: true });

const obj = (properties, { required } = {}) => ({
  type: 'object',
  additionalProperties: false,
  required: required || Object.keys(properties),
  properties,
});

const groupSchema = obj({
  groupType: { enum: ['manual', 'watchlist', 'agent_book', 'linked'] },
  memberSymbols: { type: 'array', items: { type: 'string' } },
  memberCount: { type: 'integer' },
  membershipHash: { type: 'string' },
});

const criterionSchema = obj({
  id: { type: 'string' },
  outcome: { enum: ['pass', 'fail', 'not_applicable'] },
  value: { type: ['number', 'string', 'null'] },
  threshold: { type: ['number', 'string', 'null'] },
  unit: { enum: UNIT_ENUM },
});

const evidenceSchema = obj({
  readType: { enum: ['standard', 'market_proxy'] },
  readState: { enum: ['solid', 'fragile', 'limited', 'in_flux'] },
  applicableCount: { type: 'integer' },
  passedCount: { type: 'integer' },
  failedCount: { type: 'integer' },
  unavailableCount: { type: 'integer' },
  criteria: { type: 'array', items: criterionSchema },
});

const tensionSchema = obj({ state: env(), d: bandEnv(), sds: env() });

const commonProps = {
  contractVersion: { const: CONTRACT_VERSION },
  schemaRevision: { const: SCHEMA_REVISION },
  methodologyVersion: { type: 'string' },
  readQualityPolicyVersion: { type: 'string' },
  changePolicyVersion: { type: 'string' },
  kind: { type: 'string' },
  generatedAt: { type: 'string' },
  dataAsOf: { type: 'string' },
  observationTradingDay: { type: 'string' },
  lookbackDays: { type: 'integer' },
  group: groupSchema,
};

// ── Deep-dive contract schema (revision 1) ───────────────────────────────────
const deepDiveSchemaV1 = obj({
  ...commonProps,
  kind: { const: 'deepDive' },
  driver: obj({ driverId: { type: 'string' }, driverType: { enum: ['registry', 'custom'] }, symbol: { type: 'string' } }),
  links: obj({ raw20: bandEnv(), raw60: bandEnv(), adjusted20: bandEnv(), adjusted60: bandEnv() }),
  tension: tensionSchema,
  percentile: obj({ corr20: env(), corr60: env() }),
  stability: obj({ aboveFraction: env(), signPersistence: env(), sign: env() }),
  cohesion: obj({ c20: bandEnv(), c60: bandEnv(), pairsUsed: env(), pairsTotal: env() }),
  contribution: obj({
    breadthStatus: env(),
    topMember: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['symbol', 'corrDelta'],
      properties: { symbol: { type: ['string', 'null'] }, corrDelta: bandEnv() },
    },
  }),
  capture: obj({ betaDown: env(), betaUp: env(), nDown: env(), nUp: env(), comparison: env() }),
  tail: obj({
    worst: obj({ n: env(), coMoveCount: env(), groupMedian: env() }),
    best: obj({ n: env(), coMoveCount: env(), groupMedian: env() }),
  }),
  driverContext: obj({ trailingReturn: env(), volPercentile: env() }),
  evidence: evidenceSchema,
  breaks: obj({
    count: { type: 'integer' },
    latestBreakDay: { type: ['string', 'null'] },
    freshnessWindowTradingDays: { type: 'integer' },
  }),
});

// ── Scan contract schema (revision 1) ────────────────────────────────────────
const comparisonSchema = obj({
  status: { enum: ['available', 'no_prior_scan', 'not_comparable'] },
  baselineObservationDay: { type: ['string', 'null'] },
  currentObservationDay: { type: ['string', 'null'] },
  gapTradingDays: { type: ['integer', 'null'] },
  baselineMembershipHash: { type: ['string', 'null'] },
  baselineDriverUniverseHash: { type: ['string', 'null'] },
  baselineMethodologyVersion: { type: ['string', 'null'] },
  baselineChangePolicyVersion: { type: ['string', 'null'] },
});

const EVENT_ENUM = [
  'tension_worsened', 'tension_recovered', 'signal_entered', 'signal_exited',
  'became_unavailable', 'became_suppressed', 'driver_removed',
  'correlation_strengthened', 'correlation_weakened', 'correlation_sign_flipped',
  'rank_rose', 'rank_fell',
];

const changesSchema = obj({
  status: { enum: ['available', 'no_prior_scan', 'not_comparable'] },
  events: {
    type: 'array',
    items: obj({
      driverId: { type: 'string' },
      event: { enum: EVENT_ENUM },
      from: { type: ['number', 'string', 'null'] },
      to: { type: ['number', 'string', 'null'] },
      magnitude: { type: ['number', 'null'] },
    }),
  },
});

const scanTopDriverSchema = obj({
  driverId: { type: 'string' },
  rank: { type: 'integer' },
  tier: { enum: ['established', 'emerging', 'weak'] },
  raw20: bandEnv(),
  raw60: bandEnv(),
  adjusted20: bandEnv(),
  adjusted60: bandEnv(),
  tension: tensionSchema,
  evidence: evidenceSchema,
});

const scanSchemaV1 = obj({
  ...commonProps,
  kind: { const: 'scan' },
  driverUniverseHash: { type: 'string' },
  comparison: comparisonSchema,
  topDrivers: { type: 'array', items: scanTopDriverSchema },
  changes: changesSchema,
  groupEvidence: obj({ cohesion: bandEnv(), breadthStatus: { const: 'not_applicable_in_scan' } }),
});

// Revision-keyed tables — a future additive revision registers a new schema here
// and consumers validate against the matching revision.
export const deepDiveContractSchema = { 1: deepDiveSchemaV1 };
export const scanContractSchema = { 1: scanSchemaV1 };

export function schemaForKind(kind, revision = SCHEMA_REVISION) {
  if (kind === 'deepDive') return deepDiveContractSchema[revision] ?? null;
  if (kind === 'scan') return scanContractSchema[revision] ?? null;
  return null;
}

export { EVENT_ENUM };
