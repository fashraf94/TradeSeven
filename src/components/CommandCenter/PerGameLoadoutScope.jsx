// src/components/CommandCenter/PerGameLoadoutScope.jsx
//
// Build A2 — the hub's per-game loadout scope (rulings D1, FD-1, FD-3; boards 1–5), mounted by ConnectedHub in the arm
// that both PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED hold (CommandCenterHub.jsx). Everything the loadout
// surfaces need that today's elements do not carry reaches them through hub/perGameLoadoutContext.js, never a new prop
// on a shipped element, so the flag-off build is main's byte for byte:
//   - the owner's ranked record (the hub's own owner-tagged read, the one the Loadout and the deploy state take);
//   - the League lock (hub/useLeagueLoadoutLock.js) and the owner's live games (App's active poll, the deploy gate's own);
//   - which loadout the armory and the book sheet are setting (a card's door sets it, then opens the shipped sheet slot);
//   - the committed lists, added by the shells' nested Provider of the same context around their panels (`lists`; null
//     here).

import React, { useState } from 'react';
import { LOADOUT_KINDS } from '../../constants/perGameLoadout';
import { PerGameLoadoutContext } from './hub/perGameLoadoutContext';
import { useLeagueLoadoutLock } from './hub/useLeagueLoadoutLock';

/**
 * @param {{ status: string, agent: object|null }} props.agentRead  the hub's owner-tagged read (useHubReaders)
 * @param {Array|null} props.activeBattles  App's active poll (`hub.activeBattles`)
 */
export default function PerGameLoadoutScope({ agentRead, activeBattles = null, children }) {
  const agent = agentRead && agentRead.status === 'ready' && agentRead.agent && typeof agentRead.agent === 'object' ? agentRead.agent : null;
  const lockRead = useLeagueLoadoutLock(agent ? agent.ownerId ?? null : null);
  const [armoryKind, setArmoryKind] = useState(LOADOUT_KINDS.BAGGERBOMB);
  const [bookKind, setBookKind] = useState(LOADOUT_KINDS.BAGGERBOMB);
  const value = {
    agent,
    lock: lockRead.lock,
    lockFailed: lockRead.failed,
    activeBattles: Array.isArray(activeBattles) ? activeBattles : null,
    lists: null,
    armoryKind,
    setArmoryKind,
    bookKind,
    setBookKind,
  };
  return <PerGameLoadoutContext.Provider value={value}>{children}</PerGameLoadoutContext.Provider>;
}
