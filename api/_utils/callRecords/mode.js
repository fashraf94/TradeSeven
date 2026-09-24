// api/_utils/callRecords/mode.js
//
// Cockpit Build 0 — mode resolution and the request-local calls context
// (spec docs/design/COCKPIT_SPEC_V1_3.md §2, §3.3).
//
// THE MODE is resolved ONCE per evaluation check, at the handler's start, and
// carried in the calls context; nothing reads CALL_RECORDS_MODE again during
// the check. An unknown value — or a hermetic test mock that omits the name,
// which throws on access under vitest — resolves to 'off': the only state that
// changes nothing.
//
// THE CONTEXT is declared outside the handler's `try` (the tick-capture
// precedent) so every exit, the `finally` included, reaches it. It is
// independent of tick capture by construction: nothing here reads a capture
// context, and capture off changes nothing in it.

import { CALL_RECORDS_MODE, CALL_RECORDS_MODES } from '../../../src/config/featureFlags.js';

/** The fail-closed default. */
export const CALLS_MODE_OFF = 'off';

/**
 * The check's mode: the live flag when it is one of the walked states, else
 * 'off'. Never throws.
 *
 * @returns {'off'|'shadow'|'on'}
 */
export function resolveCallRecordsMode() {
  try {
    const modes = CALL_RECORDS_MODES;
    const mode = CALL_RECORDS_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : CALLS_MODE_OFF;
  } catch {
    return CALLS_MODE_OFF;
  }
}

/** Does this mode record calls at all? ('shadow' and 'on' do; 'off' does nothing.) */
export function callsActive(mode) {
  return mode === 'shadow' || mode === 'on';
}

/**
 * The request-local calls context (spec §3.3). The spec's fields, plus two
 * carriers the model path needs between its seams:
 *   `declarations` — the model's block, detached at the tool-result seam, and
 *                    its pre-commit validation (which decides the entry's
 *                    `declarationsPhase`);
 *   `universe`     — the battle universe frozen at the prompt seam (the fork
 *                    options' membership test).
 *
 * @param {object} p
 * @param {string} p.mode            the resolved mode (resolveCallRecordsMode())
 * @param {number} p.handlerStartMs  the invocation's start — the ONE clock every hook budgets against
 */
export function createCallsContext({ mode, handlerStartMs }) {
  return {
    mode,
    handlerStartMs,
    fetchedQuotes: {},
    observation: null,
    evalIdentity: null,
    executorResult: null,
    exit: null,
    diag: {},
    declarations: null,
    universe: null,
  };
}
