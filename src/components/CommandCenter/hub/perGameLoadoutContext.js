// src/components/CommandCenter/hub/perGameLoadoutContext.js
//
// Build A2 — the hub's per-game loadout context, alone in a module so the shipped hub files that read it (each read a
// literal ternary on PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED) reach nothing else when the flags fold it
// away. The value is PerGameLoadoutScope.jsx's: { agent, lock, lockFailed, activeBattles, lists, armoryKind,
// setArmoryKind, bookKind, setBookKind }; the shells' nested Provider adds `lists` around their panels. Null outside a
// scope. The helpers turn a value into the cards (hub/perGameLoadoutModel.js) and the two text lines the shipped
// elements carry: the strip's and the Deploy card's line, and the stage's loadout summary.

import { createContext } from 'react';
import { deployLineOf, deriveLoadoutCards, loadoutSummaryOf } from './perGameLoadoutModel';

export const PerGameLoadoutContext = /* @__PURE__ */ createContext(null);

/** The cards for a scope's value (null outside a scope, or before the agent is read). */
export function cardsOf(scope) {
  if (!scope) return null;
  return deriveLoadoutCards({
    agent: scope.agent,
    lock: scope.lock,
    lockFailed: scope.lockFailed,
    activeBattles: scope.activeBattles,
    committed: scope.lists ? scope.lists.committed : null,
  });
}

/** What the next BaggerBomb deploy carries, as the strip's line; null until the agent is read. */
export function scopeDeployLine(scope) {
  const cards = cardsOf(scope);
  return cards ? deployLineOf(cards) : null;
}

/** Both loadouts, as the stage's loadout summary; null until the agent is read. */
export function scopeSummary(scope) {
  const cards = cardsOf(scope);
  return cards ? loadoutSummaryOf(cards) : null;
}
