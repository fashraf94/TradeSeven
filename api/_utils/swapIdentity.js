// api/_utils/swapIdentity.js
//
// Pilot P6 — the CALLER side of the swap identity check (G01; pilot spec §7;
// Phase 0 docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md §4.4, §5.3,
// §7.2). Not fenced: the comparison and the refusal live in the executor
// (api/_utils/agentSwapExecution.js); this module only shapes what the six
// callers in api/cron/agent-evaluate.js hand it and record from it.
//
//   - the check's mode, read ONCE per check (never re-read mid-check);
//   - the executor's trailing options — NONE at 'off', so every call keeps
//     exactly the ten arguments it had before P6 (the off goldens record
//     every writer argument);
//   - the belief about the outgoing position: from the position the caller
//     already read (risk, model, suppression) or from the identity stored at
//     creation (proposal `outgoingSwappedInAt`, meeting leg `swappedInAt`);
//     a record stored without it is checked by symbol only, and says so;
//   - the refusal record and the player lines (MODE_TRUTH_LANGUAGE_TABLES V1.1
//     table F). [SYM] is ALWAYS the belief — verification.expected.symbol —
//     never the slot's current occupant.

import { SWAP_IDENTITY_MODE } from '../../src/config/featureFlags.js';
import { resolveSwapIdentityMode, SWAP_REFUSAL_REASONS } from './agentSwapExecution.js';

/** The fail-closed mode. */
export const SWAP_IDENTITY_OFF = 'off';

/**
 * The check's mode: the flag through the executor's own resolver. A hermetic
 * test mock that omits the flag and throws on access → 'off'. Never throws.
 *
 * @returns {'off'|'shadow'|'enforce'}
 */
export function currentSwapIdentityMode() {
  try {
    return resolveSwapIdentityMode(SWAP_IDENTITY_MODE);
  } catch {
    return SWAP_IDENTITY_OFF;
  }
}

/** Is the check on (shadow or enforce)? Anything that is not a walked state reads as off. */
export function swapIdentityActive(mode) {
  return resolveSwapIdentityMode(mode) !== SWAP_IDENTITY_OFF;
}

/**
 * The executor's trailing arguments, spread after `snapshot`: none at 'off';
 * at shadow/enforce one options object carrying the mode and the belief. A
 * call that passes no snapshot today (the meeting leg — nine arguments) asks
 * for `padSnapshot`, so the options land in the eleventh position with the
 * snapshot's own default (null) in the tenth.
 */
export function swapIdentityOptions(mode, expectedOut, { padSnapshot = false } = {}) {
  const resolved = resolveSwapIdentityMode(mode);
  if (resolved === SWAP_IDENTITY_OFF) return [];
  const opts = { identityMode: resolved, expectedOut: expectedOut ?? null };
  return padSnapshot ? [null, opts] : [opts];
}

/**
 * The belief about a position the caller holds in memory: its symbol and the
 * instant it entered the slot (null for a creation-time position). Null when
 * there is no position to describe.
 */
export function expectedOutOfPosition(position) {
  if (!position || typeof position !== 'object') return null;
  return { symbol: typeof position.symbol === 'string' ? position.symbol : null, swappedInAt: position.swappedInAt ?? null };
}

/**
 * A belief stored at creation. `record[key]` present (null included — a
 * creation-time position) → symbol AND entry instant; absent (a legacy or
 * client-written record) → symbol only. A missing symbol stays null, so the
 * executor reads it as a mismatch — a malformed belief never passes.
 */
export function expectedOutOfStored(symbol, record, key) {
  const belief = { symbol: typeof symbol === 'string' && symbol ? symbol : null };
  if (record && typeof record === 'object' && Object.hasOwn(record, key)) belief.swappedInAt = record[key] ?? null;
  return belief;
}

/** The outgoing identity a creation site stores: the entry instant of the position it read (null if creation-time). */
export function storedIdentityOf(position) {
  return position?.swappedInAt ?? null;
}

/** Is `err` the executor's typed refusal? */
export function isSwapRefusal(err) {
  return !!err && SWAP_REFUSAL_REASONS.includes(err.reason) && !!err.verification && typeof err.verification === 'object';
}

/**
 * Table F (MODE_TRUTH_LANGUAGE_TABLES V1.1) — the player lines, verbatim. The
 * typed fields govern; these lines render them.
 */
export const REFUSAL_LINES = Object.freeze({
  outgoing_identity_mismatch: Object.freeze({
    agent: 'The agent tried to swap [SYM] for [SYM2], but [SYM] had already left that slot. No trade was made.',
    protective: 'Protection was set to sell [SYM], but [SYM] had already left that slot. No trade was made.',
  }),
  battle_not_active: 'This trade arrived after the battle ended. No trade was made.',
});

/** The callers whose refusals render the protective line (risk, suppression); every other caller is 'agent'. */
export const REFUSAL_KINDS = Object.freeze(['agent', 'protective']);

const filled = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * The table F line for a refusal. `symbol` is the BELIEF (the outgoing symbol
 * the caller expected), `symbolIn` the incoming symbol the caller was placing.
 * Placeholders are filled from the record, never invented: a value the line
 * needs and the record lacks → null (no line; the caller keeps its own text).
 */
export function refusalLine(reason, { kind = 'agent', symbol = null, symbolIn = null } = {}) {
  if (reason === 'battle_not_active') return REFUSAL_LINES.battle_not_active;
  if (reason !== 'outgoing_identity_mismatch') return null;
  const protective = kind === 'protective';
  if (!filled(symbol) || (!protective && !filled(symbolIn))) return null;
  const template = REFUSAL_LINES.outgoing_identity_mismatch[protective ? 'protective' : 'agent'];
  return template.replaceAll('[SYM2]', symbolIn ?? '').replaceAll('[SYM]', symbol);
}

/**
 * The record of a typed refusal for the caller's own refusal channel (an
 * evaluation entry, a proposal or meeting history row): the reason, the
 * verification the executor built, and the table F line it renders.
 */
export function refusalRecord(err, { kind = 'agent', symbolIn = null } = {}) {
  const verification = err.verification;
  return {
    reason: err.reason,
    verificationId: verification.verificationId ?? null,
    verification,
    line: refusalLine(err.reason, { kind, symbol: verification.expected?.symbol ?? null, symbolIn }),
  };
}

/**
 * A meeting leg whose outgoing symbol is no longer in the book when the
 * meeting executes (the leg the handler used to skip silently). The executor
 * is never reached, so there is no verification; the belief is the leg's own.
 */
export function departedLegRecord(leg) {
  return {
    reason: 'outgoing_identity_mismatch',
    verificationId: null,
    verification: null,
    line: refusalLine('outgoing_identity_mismatch', { kind: 'agent', symbol: leg?.symbolOut ?? null, symbolIn: leg?.symbolIn ?? null }),
  };
}

/**
 * The fields a feed beat carries for a typed refusal: the table F line as its
 * message (when the record can fill it — else the beat keeps its own text),
 * and the typed reason.
 */
export function refusalFeedFields(err, { kind = 'agent', symbolIn = null } = {}) {
  const line = refusalLine(err.reason, { kind, symbol: err.verification.expected?.symbol ?? null, symbolIn });
  return {
    ...(line ? { message: line } : {}),
    refusalReason: err.reason,
    verificationId: err.verification.verificationId ?? null,
  };
}
