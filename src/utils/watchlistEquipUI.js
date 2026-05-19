// src/utils/watchlistEquipUI.js
//
// Phase 5B2 — Watchlist Equip UI. Pure, deterministic helpers for the three
// equip surfaces (watchlist card, agent dashboard card, running-battle chip).
// No I/O, no React — every function here is unit-testable in isolation,
// mirroring api/_utils/watchlistEquip.js (the Phase 5B1 backend precedent for
// pure, testable equip logic).
//
// Consumed by:
//   * src/components/Forge/Watchlist/WatchlistListCard.jsx   — isWatchlistEquipped, getCardEquipState
//   * src/components/Forge/Watchlist/WatchlistListPanel.jsx  — getEquipErrorMessage
//   * src/components/Agent/EquippedWatchlistCard.jsx         — resolveEquippedName, getEquipErrorMessage
//   * src/screens/AgentBattleScreen.jsx                      — getEquippedWatchlistLabel

/**
 * True when `watchlistId` is the watchlist currently equipped to `agent`.
 * Both ids must be present — a null/absent equippedWatchlistId never matches.
 *
 * @param {Object|null} agent
 * @param {string|null|undefined} watchlistId
 * @returns {boolean}
 */
export function isWatchlistEquipped(agent, watchlistId) {
  const equipped = agent?.equippedWatchlistId;
  return Boolean(equipped) && Boolean(watchlistId) && equipped === watchlistId;
}

/**
 * Derive the watchlist-card footer state.
 *
 * @param {Object} args
 * @param {Object|null} args.agent  - the user's agent doc, or null if none.
 * @param {Object} args.watchlist   - the watchlist for this card.
 * @param {boolean} args.working    - true while an equip/unequip request is in flight.
 * @returns {{visible:boolean, isEquipped?:boolean, mode?:('equip'|'unequip'), disabled?:boolean, label?:string}}
 *   `{ visible: false }` (no other fields) when the watchlist is a draft — the
 *   footer is omitted entirely. Otherwise the footer renders one button.
 */
export function getCardEquipState({ agent, watchlist, working }) {
  if (watchlist?.status !== 'committed') {
    return { visible: false };
  }

  const isEquipped = isWatchlistEquipped(agent, watchlist?.watchlistId);
  const mode = isEquipped ? 'unequip' : 'equip';

  if (!agent) {
    return { visible: true, isEquipped: false, mode: 'equip', disabled: true, label: 'Create an agent to equip' };
  }
  if (agent.activeBattleId) {
    return {
      visible: true,
      isEquipped,
      mode,
      disabled: true,
      label: mode === 'equip' ? 'Equip locked during battle' : 'Unequip locked during battle',
    };
  }

  return {
    visible: true,
    isEquipped,
    mode,
    disabled: Boolean(working),
    label: mode === 'equip' ? 'Equip to agent' : 'Unequip',
  };
}

/**
 * Resolve the display name for an agent's equipped watchlist, folding in the
 * result of the dashboard's refresh-on-load getWatchlist() probe (Q-B6).
 *
 * @param {Object} args
 * @param {string|null} args.equippedWatchlistId - agent.equippedWatchlistId.
 * @param {string|null} args.cachedName          - agent.equippedWatchlistName (may be stale).
 * @param {Object|null} [args.freshWatchlist]    - getWatchlist() result, used when fetchStatus === 'ok'.
 * @param {('pending'|'ok'|'not_found'|'error')} args.fetchStatus
 * @returns {{name:(string|null), unavailable:boolean}}
 *   `name` is null when nothing is equipped. `unavailable` is true only when the
 *   probe 404'd (deleted/missing) — the UI appends a "(unavailable)" marker.
 */
export function resolveEquippedName({ equippedWatchlistId, cachedName, freshWatchlist, fetchStatus }) {
  if (!equippedWatchlistId) {
    return { name: null, unavailable: false };
  }
  if (fetchStatus === 'ok' && freshWatchlist) {
    return { name: freshWatchlist.name || 'Untitled watchlist', unavailable: false };
  }

  const fallback = cachedName || 'Watchlist';
  if (fetchStatus === 'not_found') {
    return { name: fallback, unavailable: true };
  }
  // 'pending' or 'error' — show the cached name with no marker.
  return { name: fallback, unavailable: false };
}

/**
 * Label for the read-only running-battle chip, built from the frozen
 * agentContext.equippedWatchlist snapshot. Returns null when no watchlist was
 * equipped at battle start (the chip is then omitted).
 *
 * @param {{name?:string}|null|undefined} equippedWatchlistSnapshot
 * @returns {string|null}
 */
export function getEquippedWatchlistLabel(equippedWatchlistSnapshot) {
  const name = equippedWatchlistSnapshot?.name;
  return name ? `Watchlist: ${name}` : null;
}

/**
 * Map an equip/unequip failure to plain user-facing copy (beta tone — no codes).
 *
 * @param {{status?:number}|null|undefined} error - Error thrown by equipWatchlist/unequipWatchlist.
 * @param {('equip'|'unequip')} action
 * @returns {string}
 */
export function getEquipErrorMessage(error, action) {
  const verb = action === 'unequip' ? 'unequip' : 'equip';
  if (error?.status === 409) {
    return `Cannot ${verb} — the agent is in an active battle.`;
  }
  if (error?.status === 404) {
    return 'That watchlist is no longer available. Refresh to see your current list.';
  }
  return `Could not ${verb} the watchlist. Try again.`;
}
