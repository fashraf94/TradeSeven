// api/_utils/agentEvalToolResultValidation.js
//
// Schema validation for the mid-battle evaluation tool result.
//
// WHY THIS EXISTS. `tool_choice` is forced, so the parse site in
// agent-evaluate.js used to accept any tool_use block carrying a STRING
// `decision` and hand it straight to the decision pipeline. That let three
// shapes through that the schema forbids: a `decision` outside the enum, a
// SWAP missing `symbolOut`/`symbolIn`, and a missing or non-numeric
// `conviction` — the last of which then slipped past the platform's
// `conviction < 70` floor (agentSwapExecution.js:77) because `undefined < 70`
// is false. Validation now runs BEFORE anything reads the result, so a
// malformed proposal is a fail-closed HOLD rather than a half-read trade.
//
// FAIL CLOSED, NEVER REPAIR. An invalid result yields the failing field name
// and nothing else: no default is filled, no field is coerced, no call is
// retried. The tick degrades to its ordinary fallback HOLD.
//
// DRIVEN BY THE SCHEMA, NOT A TRANSCRIPT OF IT. The rules are read off
// TRADE_DECISION_TOOL.input_schema at call time, so a schema change cannot
// leave a hand-copied rule list behind. The schema module is imported and
// never edited (BUILD_RULES §1 permits reading; the tool schema is frozen for
// this build regardless).
//
// TWO DELIBERATE RELAXATIONS, both stated rather than silent:
//   1. `conviction` is declared `integer`; this validator accepts any FINITE
//      number in [minimum, maximum]. The build prompt's requirement is
//      "present and numeric", and rejecting a 72.5 would turn a decision the
//      platform floor accepts today into a HOLD — a behavior change wider
//      than the defect.
//   2. Only TOP-LEVEL properties are checked. Nested item shapes (the
//      `anticipationCandidates` rows, `trade_reasoning`) are left to the
//      consumers that already drop malformed entries individually; promoting
//      a droppable narration row into a whole-tick HOLD would likewise be
//      wider than the defect.
// `swap_type` is type/enum-checked when present but not required: the schema's
// machine-readable `required` array does not list it (only its prose
// description says "Required if SWAP"), and requiring it would reject SWAPs
// the pipeline executes today.

import { TRADE_DECISION_TOOL } from './agentEvalToolSchema.js';

const INPUT_SCHEMA = TRADE_DECISION_TOOL.input_schema;

/** The two tickers a SWAP must name. Enforced beyond `required` because the
 *  schema states the conditional in prose the model can ignore. */
export const SWAP_PAIR_FIELDS = Object.freeze(['symbolOut', 'symbolIn']);

/** The failureClass this module's rejections are recorded under. */
export const INVALID_TOOL_RESULT_CLASS = 'invalid_tool_result';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Schema `type` is a string or a union array (`['string', 'null']`). */
function typeMatches(value, declared) {
  const types = Array.isArray(declared) ? declared : [declared];
  return types.some((t) => {
    switch (t) {
      case 'null': return value === null;
      case 'array': return Array.isArray(value);
      case 'object': return isPlainObject(value);
      case 'string': return typeof value === 'string';
      // `integer` intentionally shares the `number` arm — see relaxation 1.
      case 'integer':
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'boolean': return typeof value === 'boolean';
      // A type this validator does not model: never invent a rejection.
      default: return true;
    }
  });
}

const describeType = (declared) => (Array.isArray(declared) ? declared.join('|') : String(declared));

/**
 * Validate a `submit_trade_decision` tool input against the live schema.
 *
 * @param {unknown} input - `toolUse.input`, exactly as the SDK delivered it.
 * @returns {{valid: boolean, invalidField: string|null, reason: string|null}}
 *          `invalidField` names the FIRST field that failed — the one recorded
 *          on the evaluation entry. Checks run required → type/enum/range →
 *          SWAP pair, so a missing field is never reported as a type error.
 */
export function validateTradeToolResult(input) {
  if (!isPlainObject(input)) {
    return { valid: false, invalidField: 'input', reason: 'tool input is not an object' };
  }

  for (const name of INPUT_SCHEMA.required || []) {
    if (input[name] === undefined || input[name] === null) {
      return { valid: false, invalidField: name, reason: `required field '${name}' is missing` };
    }
  }

  for (const [name, spec] of Object.entries(INPUT_SCHEMA.properties || {})) {
    const value = input[name];
    // Absent, or explicitly null. On an OPTIONAL property both mean "not
    // provided" and the schema allows it: the model routinely answers an
    // "omit if nothing noteworthy" field with `null` rather than dropping the
    // key (the eval fixtures' own valid HOLD sends `pvp_context: null`
    // against a bare `type: 'string'`), and every consumer reads these
    // through `?.x || null`. A null in a REQUIRED slot is a genuine failure
    // and was already rejected by the `required` loop above.
    if (value === undefined || value === null) continue;
    if (!typeMatches(value, spec.type)) {
      return { valid: false, invalidField: name, reason: `'${name}' is not ${describeType(spec.type)}` };
    }
    if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
      return { valid: false, invalidField: name, reason: `'${name}' is not one of ${spec.enum.join('|')}` };
    }
    if (typeof value === 'number') {
      if (typeof spec.minimum === 'number' && value < spec.minimum) {
        return { valid: false, invalidField: name, reason: `'${name}' is below the schema minimum ${spec.minimum}` };
      }
      if (typeof spec.maximum === 'number' && value > spec.maximum) {
        return { valid: false, invalidField: name, reason: `'${name}' is above the schema maximum ${spec.maximum}` };
      }
    }
  }

  if (input.decision === 'SWAP') {
    for (const name of SWAP_PAIR_FIELDS) {
      const value = input[name];
      if (typeof value !== 'string' || value.trim() === '') {
        return { valid: false, invalidField: name, reason: `SWAP requires a '${name}' ticker` };
      }
    }
  }

  return { valid: true, invalidField: null, reason: null };
}
