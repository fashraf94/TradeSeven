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

// Pure function — testable without a clock dependency. Use this from
// tests; production callers should use isDirectiveActive(directive, battle)
// below which derives currentDay from getCurrentTradingDayServer.
export function isDirectiveActiveOnDay(directive, tradingDays, currentDay) {
  // Malformed directive — nothing to surface.
  if (!directive || typeof directive !== 'object') return false;
  if (!directive.text || !directive.directiveThreadId) return false;

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
  const tradingDays = battle?.timing?.tradingDays || [];
  const currentDay = getCurrentTradingDayServer(tradingDays);
  return isDirectiveActiveOnDay(directive, tradingDays, currentDay);
}
