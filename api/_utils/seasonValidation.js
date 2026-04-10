/**
 * Season Validation — Pit Stop Security Boundary
 *
 * Server-side validation for pit stop rule-parameter changes and shortlist
 * submissions. Called by the Sunday-night lock-in cron before applying any
 * client-submitted changes to an entry's algorithm.
 *
 * This is a **security boundary**. During the pit stop window the client
 * writes directly to the pitStop doc. Nothing in that doc gets applied to
 * the entry's algorithm until it has been re-validated here against (a) the
 * entry's current rule set, (b) the canonical rule schema registry, and
 * (c) a fresh read of current param state (stale-write protection).
 *
 * Pure functions — no Firestore access. Callers pass in the pit stop payload,
 * the entry's current rules, and a prebuilt schema registry; they receive
 * back `{ validated, rejected, error }` tuples that describe exactly which
 * items pass and which must be discarded.
 *
 * Note on the rule schema registry: `api/` files do not import from `src/`,
 * so `buildRuleSchemaRegistry` accepts the templates array as a parameter.
 * The cron is responsible for sourcing the array (bundled mirror, passed in
 * by the SDK, or duplicated) and building the registry once at startup.
 */

import { SEASON_CONFIG } from './seasonConfig.js';

// ─── Main Exports ─────────────────────────────────────────────

/**
 * Validates pit stop rule parameter changes before applying them.
 *
 * Runs each change through an ordered gauntlet: structure → rule exists →
 * schema exists → field exists → type + bounds → stale-write protection.
 * First failing check rejects the change with an explanatory reason. Passing
 * changes are returned in `validated` in a normalized shape.
 *
 * @param {Object[]} changes - Client-submitted changes from pitStop doc
 *   Each: { type: 'param_change', ruleId, field, oldValue, newValue, timestamp? }
 * @param {Object[]} currentRules - Entry's current algorithm.rules[]
 *   Each: { ruleId, params: { [field]: value }, ... }
 * @param {Object} ruleSchemaRegistry - Map of ruleId → { params: { [field]: paramDef } }
 *   Produced by buildRuleSchemaRegistry()
 * @returns {{ validated: Object[], rejected: Object[], error: string|null }}
 */
export function validatePitStopChanges(changes, currentRules, ruleSchemaRegistry) {
  if (!Array.isArray(changes)) {
    return { validated: [], rejected: [], error: 'Changes must be an array' };
  }
  if (changes.length === 0) {
    return { validated: [], rejected: [], error: null };
  }
  if (changes.length > SEASON_CONFIG.MAX_PIT_STOP_CHANGES) {
    return {
      validated: [],
      rejected: changes.map(c => ({
        ...c,
        rejectReason: `Exceeded max ${SEASON_CONFIG.MAX_PIT_STOP_CHANGES} changes per pit stop`,
      })),
      error: `Exceeded max ${SEASON_CONFIG.MAX_PIT_STOP_CHANGES} changes per pit stop`,
    };
  }

  const validated = [];
  const rejected = [];

  for (const change of changes) {
    const result = validateSingleChange(change, currentRules, ruleSchemaRegistry);
    if (result.ok) {
      validated.push(result.change);
    } else {
      rejected.push({ ...(change || {}), rejectReason: result.reason });
    }
  }

  return { validated, rejected, error: null };
}

/**
 * Validates the user's 3-stock shortlist submission.
 *
 * Checks: length → per-ticker (type → sanitize → universe → not-already-held
 * → not-duplicate). Sanitization trims whitespace and uppercases tickers.
 *
 * @param {string[]} shortlist - Client-submitted ticker array
 * @param {string[]} universe - Season's stock universe (from seasonDoc.universe)
 * @param {Object} portfolio - Entry's current portfolio { positions: { [ticker]: {...} } }
 * @returns {{ validated: string[], rejected: Object[], error: string|null }}
 */
export function validateShortlist(shortlist, universe, portfolio) {
  if (!Array.isArray(shortlist)) {
    return { validated: [], rejected: [], error: 'Shortlist must be an array' };
  }
  if (shortlist.length > SEASON_CONFIG.MAX_SHORTLIST) {
    return {
      validated: [],
      rejected: shortlist.map(t => ({
        ticker: t,
        rejectReason: `Exceeded max ${SEASON_CONFIG.MAX_SHORTLIST} tickers in shortlist`,
      })),
      error: `Exceeded max ${SEASON_CONFIG.MAX_SHORTLIST} tickers in shortlist`,
    };
  }

  const universeSet = new Set(Array.isArray(universe) ? universe : []);
  const heldSet = new Set(
    portfolio && portfolio.positions ? Object.keys(portfolio.positions) : [],
  );

  const validated = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of shortlist) {
    // Type check — must be a non-empty string
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      rejected.push({ ticker: raw, rejectReason: 'Invalid ticker format' });
      continue;
    }

    const ticker = raw.trim().toUpperCase();

    if (!universeSet.has(ticker)) {
      rejected.push({ ticker, rejectReason: `${ticker} not in season universe` });
      continue;
    }

    if (heldSet.has(ticker)) {
      rejected.push({ ticker, rejectReason: `${ticker} already held in portfolio` });
      continue;
    }

    if (seen.has(ticker)) {
      rejected.push({ ticker, rejectReason: `${ticker} duplicate in shortlist` });
      continue;
    }

    seen.add(ticker);
    validated.push(ticker);
  }

  return { validated, rejected, error: null };
}

/**
 * Builds a lookup map of ruleId → param schema from the forgeKnowledgeBase
 * rule templates array. Called once at cron startup; cached for the lifetime
 * of the cron run.
 *
 * Pure transform. Skips rules missing `id` or a populated `forgeTemplates`.
 *
 * @param {Object[]} knowledgeBase - Rule templates array (e.g. FORGE_RULE_TEMPLATES)
 * @returns {Object} Map of ruleId → { params, category, modes }
 */
export function buildRuleSchemaRegistry(knowledgeBase) {
  const registry = Object.create(null);
  if (!Array.isArray(knowledgeBase)) return registry;

  for (const rule of knowledgeBase) {
    if (!rule || typeof rule.id !== 'string') continue;
    const templates = rule.forgeTemplates;
    if (!Array.isArray(templates) || templates.length === 0) continue;

    const template = templates[0];
    if (!template || !template.params || typeof template.params !== 'object') continue;

    registry[rule.id] = {
      params: template.params,
      category: rule.category ?? null,
      modes: rule.modes ?? null,
    };
  }

  return registry;
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Runs the full per-change validation gauntlet. Returns `{ ok: true, change }`
 * on success or `{ ok: false, reason }` on first failure.
 */
function validateSingleChange(change, currentRules, ruleSchemaRegistry) {
  // 1. STRUCTURE CHECK
  if (!change || typeof change !== 'object') {
    return { ok: false, reason: 'Missing required fields' };
  }
  const { ruleId, field, oldValue, newValue } = change;
  if (
    typeof ruleId !== 'string' ||
    typeof field !== 'string' ||
    newValue === undefined ||
    oldValue === undefined
  ) {
    return { ok: false, reason: 'Missing required fields' };
  }

  // Cap string lengths to prevent DoS via rejection-reason amplification
  if (ruleId.length > 64) {
    return { ok: false, reason: 'Rule ID too long' };
  }
  if (field.length > 64) {
    return { ok: false, reason: 'Field name too long' };
  }

  // 2. RULE EXISTS CHECK (in user's current algorithm)
  const rule = Array.isArray(currentRules)
    ? currentRules.find(r => r && r.ruleId === ruleId)
    : null;
  if (!rule) {
    return { ok: false, reason: `Rule ${truncate(ruleId)} not in algorithm` };
  }

  // 3. SCHEMA EXISTS CHECK
  const schemaEntry = ruleSchemaRegistry ? ruleSchemaRegistry[ruleId] : null;
  if (!schemaEntry || !schemaEntry.params) {
    return { ok: false, reason: `No schema found for ${truncate(ruleId)}` };
  }

  // 4. FIELD EXISTS CHECK
  const paramDef = schemaEntry.params[field];
  if (!paramDef) {
    return { ok: false, reason: `Field ${truncate(field)} not in schema for ${truncate(ruleId)}` };
  }

  // 5. TYPE VALIDATION
  const typeCheck = validateParamValue(paramDef, newValue);
  if (!typeCheck.ok) return typeCheck;

  // 6. STALE WRITE CHECK — current value must match client's oldValue
  const currentValue = rule.params ? rule.params[field] : undefined;
  if (currentValue !== oldValue) {
    return {
      ok: false,
      reason: `Stale: current is ${formatValue(currentValue)}, expected ${formatValue(oldValue)}`,
    };
  }

  // All checks passed — return a normalized change record
  return {
    ok: true,
    change: {
      type: 'param_change',
      ruleId,
      field,
      oldValue,
      newValue,
    },
  };
}

/**
 * Validates a parameter value against its schema definition. Handles
 * `number`, `select`, and `toggle` types. Unknown types are rejected.
 */
function validateParamValue(paramDef, value) {
  const type = paramDef.type;

  if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, reason: 'Must be a number' };
    }
    const min = paramDef.min;
    const max = paramDef.max;
    const hasMin = typeof min === 'number';
    const hasMax = typeof max === 'number';
    if ((hasMin && value < min) || (hasMax && value > max)) {
      const lo = hasMin ? min : '-∞';
      const hi = hasMax ? max : '∞';
      return { ok: false, reason: `${value} outside [${lo}, ${hi}]` };
    }
    return { ok: true };
  }

  if (type === 'select') {
    const validValues = extractSelectValues(paramDef.options);
    if (!validValues.includes(value)) {
      return { ok: false, reason: `${formatValue(value)} not in options` };
    }
    return { ok: true };
  }

  if (type === 'toggle') {
    if (typeof value !== 'boolean') {
      return { ok: false, reason: 'Must be boolean' };
    }
    return { ok: true };
  }

  return { ok: false, reason: `Unknown param type: ${type}` };
}

/**
 * Extracts the list of valid values from a select param's `options` array.
 * Supports both `[{ value, label }]` (standard in forgeKnowledgeBase) and
 * `[plainValue, ...]` (defensive fallback for future or mirrored schemas).
 */
function extractSelectValues(options) {
  if (!Array.isArray(options)) return [];
  return options.map(opt => {
    if (opt && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  });
}

/**
 * Formats a value for inclusion in a reject-reason string. Keeps strings
 * quoted and falsy values explicit so error messages stay unambiguous.
 */
function formatValue(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

/**
 * Truncates a string for safe inclusion in rejection-reason messages.
 * Bounds worst-case rejection-doc size when client submits pathological input.
 */
function truncate(str, max = 100) {
  if (typeof str !== 'string') str = String(str);
  return str.length > max ? str.slice(0, max) + '...' : str;
}
