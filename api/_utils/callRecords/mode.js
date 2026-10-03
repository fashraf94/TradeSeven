// api/_utils/callRecords/mode.js
//
// Cockpit Build 0 — mode resolution and the request-local calls context
// (spec docs/design/COCKPIT_SPEC_V1_3.md §2, §3.3). Cockpit Build 1a —
// per-battle activation and the in-memory check context
// (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3; contract Amendment B §10).
//
// THE MODE is resolved ONCE per battle check, after the authoritative load, on
// the battle's `ownerId`, and carried in the calls context; nothing reads
// CALL_RECORDS_MODE again during the check:
//   global 'off'    → 'off'
//   global 'shadow' → 'shadow'
//   global 'on'     → 'on' iff ownerId ∈ COCKPIT_ALLOWLIST_UIDS, else 'off'
//   anything malformed — an unknown flag value, a non-array allowlist, a
//   non-string owner, a hermetic test mock that omits a name and throws on
//   access — → 'off': the only state that changes nothing.
// Two battles in one run never share a resolution: each check resolves its
// own. WITHOUT a battle the resolver returns the GLOBAL value (the sweep's
// global gate; a caller that has not loaded a battle yet).
//
// THE CHECK CONTEXT the cron attaches in memory — `battle.__callsMode` and
// `battle.__checkInstantMs` — is what every call-family directive reader
// requires (directiveUtils.isDirectiveActive); a reader without both fails
// closed. Both are NON-ENUMERABLE: no spread, JSON.stringify, structuredClone
// or Object.assign(copy, battle) can carry them into a write, and the cron's
// refresh (Object.assign(battle, freshDoc)) merges INTO the object and leaves
// them in place. Never persisted.
//
// THE CONTEXT is declared outside the handler's `try` (the tick-capture
// precedent) so every exit, the `finally` included, reaches it. It is
// independent of tick capture by construction: nothing here reads a capture
// context, and capture off changes nothing in it.

import { CALL_RECORDS_MODE, CALL_RECORDS_MODES, COCKPIT_ALLOWLIST_UIDS } from '../../../src/config/featureFlags.js';

/** The fail-closed default. */
export const CALLS_MODE_OFF = 'off';

/**
 * The global flag value when it is one of the walked states, else 'off'.
 * Never throws.
 *
 * @returns {'off'|'shadow'|'on'}
 */
export function resolveGlobalCallRecordsMode() {
  try {
    const modes = CALL_RECORDS_MODES;
    const mode = CALL_RECORDS_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : CALLS_MODE_OFF;
  } catch {
    return CALLS_MODE_OFF;
  }
}

/** Is this owner on the cockpit allowlist? A malformed list or owner → false. Never throws. */
export function isCockpitOwnerAllowlisted(ownerId) {
  try {
    const list = COCKPIT_ALLOWLIST_UIDS;
    return typeof ownerId === 'string' && ownerId.length > 0 && Array.isArray(list) && list.includes(ownerId);
  } catch {
    return false;
  }
}

/**
 * The check's mode (spec §3). With a battle: per owner. Without one
 * (`undefined`): the global value. Never throws.
 *
 * @param {object} [battle]  the authoritative in-memory battle (its `ownerId`)
 * @returns {'off'|'shadow'|'on'}
 */
export function resolveCallRecordsMode(battle) {
  const global = resolveGlobalCallRecordsMode();
  if (battle === undefined) return global;
  if (global !== 'on') return global;
  return isCockpitOwnerAllowlisted(battle?.ownerId) ? 'on' : CALLS_MODE_OFF;
}

/** Does this mode record calls at all? ('shadow' and 'on' do; 'off' does nothing.) */
export function callsActive(mode) {
  return mode === 'shadow' || mode === 'on';
}

/**
 * Attach the check context IN MEMORY (spec §3): immediately after resolution
 * and before the control-epoch call, once per check. Non-enumerable, never
 * persisted. `nowMs` must be finite — a non-finite instant is stored as null,
 * and every reader then fails closed exactly as with no attachment.
 *
 * @param {object} battle
 * @param {{ mode: string, nowMs: number }} p
 * @returns {{ mode: string, instantMs: number|null }|null}
 */
export function attachCheckContext(battle, { mode, nowMs }) {
  if (!battle || typeof battle !== 'object') return null;
  const instantMs = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : null;
  const define = (key, value) => Object.defineProperty(battle, key, { value, enumerable: false, writable: true, configurable: true });
  define('__callsMode', mode);
  define('__checkInstantMs', instantMs);
  return { mode, instantMs };
}

/**
 * The attached check context — or nulls when it is absent or malformed, so a
 * reader without a valid context fails closed.
 *
 * @returns {{ mode: string|null, instantMs: number|null }}
 */
export function checkContextOf(battle) {
  const mode = battle?.__callsMode;
  const instant = battle?.__checkInstantMs;
  return {
    mode: typeof mode === 'string' ? mode : null,
    instantMs: typeof instant === 'number' && Number.isFinite(instant) ? instant : null,
  };
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
 * @param {string} p.mode            the resolved mode (resolveCallRecordsMode(battle))
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

/** Bounded diagnostic list of calls faults on one check. */
const MAX_FAULTS = 8;

/**
 * THE ONE WAY THE CRON CALLS INTO THE CALL RECORDS (the captureStep
 * precedent): inactive → nothing runs at all; active → `fn` runs inside a
 * catch, so a calls defect costs the check a record, never a decision, a write
 * or an exit. A fault is a bounded diagnostic and a log line.
 *
 * @template T
 * @param {object} callsCtx
 * @param {() => T} fn
 * @returns {T|undefined}
 */
export function callsStep(callsCtx, fn) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return undefined;
  try {
    return fn();
  } catch (err) {
    noteCallsFault(callsCtx, err);
    return undefined;
  }
}

/** The async twin: awaited, isolated, never rejects. */
export async function callsStepAsync(callsCtx, fn) {
  if (!callsCtx || !callsActive(callsCtx.mode)) return undefined;
  try {
    return await fn();
  } catch (err) {
    noteCallsFault(callsCtx, err);
    return undefined;
  }
}

function noteCallsFault(callsCtx, err) {
  try {
    const message = String(err?.message || err).slice(0, 200);
    const faults = Array.isArray(callsCtx.diag.faults) ? callsCtx.diag.faults : [];
    if (faults.length < MAX_FAULTS) faults.push(message);
    callsCtx.diag.faults = faults;
    console.error(`[calls] fault (isolated — the check is unaffected): ${message}`);
  } catch { /* the fault recorder itself is best-effort */ }
}
