// api/_utils/directiveUtils.js
//
// Helpers for reasoning about active user-supplied directives (the
// tactical directives the user locks in via chat — see
// api/agent/chat.js where battle.directive is written).
//
// A directive is created with shape:
//   { text, expiry: 'end_of_battle' | '3_games' | 'permanent',
//     directiveThreadId, createdAt: ISO string }
//
// Expiry semantics (Phase 2 Voice Layer Rework — Fix #4):
//   - 'end_of_battle' (default): active for the duration of the active
//     battle. The cron filters battles to status='active', so any
//     active-battle read path treats this as always-active.
//   - 'permanent': same scope as end_of_battle in practice
//     (battle.directive lives on a single battle doc; nothing carries
//     it across battles today). Treat as always-active during the
//     battle.
//   - '3_games': interpreted as "3 trading days from createdAt within
//     this battle." A directive created at any time on day N is active
//     on days N, N+1, N+2 and inactive from day N+3 onward. Computed
//     against battle.timing.tradingDays (the canonical 1-indexed
//     trading-day calendar).
//
// Defensive philosophy: when uncertain (missing createdAt, missing
// tradingDays, unknown expiry value, createdAt outside the battle's
// calendar), return TRUE — better to surface a possibly-stale
// directive than to silently strip a valid one. The cost of a false
// positive is a slightly-stale directive callback; the cost of a
// false negative is an active directive that never reaches the
// narration / decide prompt.

import { getCurrentTradingDayServer } from './agentEvalPromptAssembly.js';
// Cockpit Build 1a (spec §6): the check context the cron attaches in memory —
// the resolved mode and one frozen instant — which a CALL-FAMILY directive
// needs to be active at all.
import { checkContextOf } from './callRecords/mode.js';

// Pure function — testable without a clock dependency. Use this from
// tests; production callers should use isDirectiveActive(directive, battle)
// below which derives currentDay from getCurrentTradingDayServer.
export function isDirectiveActiveOnDay(directive, tradingDays, currentDay) {
  // Malformed directive — nothing to surface.
  if (!directive || typeof directive !== 'object') return false;
  if (!directive.text || !directive.directiveThreadId) return false;
  // Cockpit Build 1a (spec §6): the day rule never activates a call-family
  // directive — that takes the check context (isDirectiveActive below); a
  // caller of the pure rule has none, and fails closed.
  if (isCallDirective(directive)) return false;

  const expiry = directive.expiry || 'end_of_battle';

  if (expiry === 'end_of_battle') return true;
  if (expiry === 'permanent') return true;

  if (expiry === '3_games') {
    // Defensive: missing createdAt or unknown battle calendar — treat
    // as active. We never silently strip a directive that might still
    // be valid (see header comment).
    if (!directive.createdAt) return true;
    if (!Array.isArray(tradingDays) || tradingDays.length === 0) return true;
    if (typeof currentDay !== 'number' || currentDay < 1) return true;

    const createdDateStr = String(directive.createdAt).split('T')[0];
    const createdDayIndex = tradingDays.indexOf(createdDateStr);
    if (createdDayIndex === -1) {
      // createdAt date isn't in this battle's tradingDays array (e.g.,
      // the directive was created over a weekend or outside the
      // battle's calendar). Defensive fallback: active.
      return true;
    }

    const createdDay = createdDayIndex + 1; // tradingDays is 0-indexed; currentDay is 1-indexed
    const elapsedDays = currentDay - createdDay;
    // Created Mon → active Mon/Tue/Wed (elapsed 0/1/2) → inactive Thu (elapsed 3).
    return elapsedDays < 3;
  }

  // Unknown expiry value — defensive fallback.
  return true;
}

export function isDirectiveActive(directive, battle) {
  // Cockpit Build 1a (spec §6): a CALL-FAMILY directive is active only for a
  // reader holding the check context the cron attached in memory — the
  // battle's resolved mode 'on' and one finite check instant at or before the
  // directive's lifetime end. Voice, and every other reader without the
  // context, fail closed. Ordinary directives are unchanged, the
  // unknown-expiry branch included.
  if (isCallDirective(directive)) return isCallDirectiveActiveAt(directive, checkContextOf(battle));
  const tradingDays = battle?.timing?.tradingDays || [];
  const currentDay = getCurrentTradingDayServer(tradingDays);
  return isDirectiveActiveOnDay(directive, tradingDays, currentDay);
}

// ==================== Cockpit Build 1a — the call directive family (spec §6) ====================

/** The family marker a call directive carries (callActions.js writes it; the only other value is absent). */
export const CALL_DIRECTIVE_FAMILY = 'call';

/** Is this a call-family directive? By the stored marker alone. */
export function isCallDirective(directive) {
  return !!directive && typeof directive === 'object' && directive.family === CALL_DIRECTIVE_FAMILY;
}

/**
 * Activeness for the CHECK (the cron's readers): the resolved mode is 'on',
 * the check instant is finite, and it is at or before the directive's lifetime
 * end (`expiresAtMs` — the horizon's expiry, plus 15 minutes for next_check;
 * a bounded advisory lifetime, NOT an H2 guarantee). Malformed → inactive.
 *
 * @param {object} directive
 * @param {{ mode: string|null, instantMs: number|null }} ctx
 */
export function isCallDirectiveActiveAt(directive, ctx) {
  if (!isCallDirective(directive)) return false;
  if (!directive.text || !directive.directiveThreadId) return false;
  const expiresAtMs = directive.expiresAtMs;
  const instantMs = ctx?.instantMs;
  if (ctx?.mode !== 'on') return false;
  if (typeof instantMs !== 'number' || !Number.isFinite(instantMs)) return false;
  if (typeof expiresAtMs !== 'number' || !Number.isFinite(expiresAtMs)) return false;
  return instantMs <= expiresAtMs;
}

/**
 * THE ENDPOINT'S PENDING PREDICATE (spec §6; Amendment B §3), separate from
 * check activeness: does the parent's slot hold a LIVE call-family directive
 * that a second call-family filing must not displace? True iff the slot is
 * call-family, the resolved mode is 'on', `nowMs` is at or before its lifetime
 * end, its thread is not killed, and it belongs to a DIFFERENT call than the
 * one being answered. Never consults cron-only fields.
 *
 * @param {{ directive: object, mode: string, nowMs: number, killedIds?: Iterable<string>, thisCallId?: string|null }} p
 */
export function isCallDirectivePendingAt({ directive, mode, nowMs, killedIds = [], thisCallId = null }) {
  if (!isCallDirective(directive)) return false;
  if (mode !== 'on') return false;
  if (!directive.text || !directive.directiveThreadId) return false;
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return false;
  if (typeof directive.expiresAtMs !== 'number' || !Number.isFinite(directive.expiresAtMs)) return false;
  if (nowMs > directive.expiresAtMs) return false;
  const killed = killedIds instanceof Set ? killedIds : new Set(killedIds || []);
  if (killed.has(directive.directiveThreadId)) return false;
  if (thisCallId !== null && directive.callId === thisCallId) return false;
  return true;
}
