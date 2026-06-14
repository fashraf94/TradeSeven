// src/utils/roundBoundaryAck.js
//
// P7 (C) — the client-only acknowledgement for the round-boundary interstitial,
// and the last-seen bracket-game pointer the eliminated path needs (an
// eliminated player's subscribeMyGroup returns null, so the bracketId is
// recovered from here). NO server write, NO cron — purely local UX state.
//
// Every access is try/catch-wrapped: when storage is unavailable (private
// mode, disabled, quota), reads degrade to "not acknowledged" (the interstitial
// SHOWS — never suppressed by a storage failure) and writes no-op. Never throws.

const ACK_KEY = 'ft.tournament.roundBoundaryAck';
const LAST_GAME_KEY = 'ft.tournament.lastBracketGameId';

function readAckMap() {
  try {
    const raw = globalThis.localStorage?.getItem(ACK_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Has the player dismissed the interstitial for this completed game? */
export function isRoundBoundaryAcknowledged(gameId) {
  if (!gameId) return false;
  return readAckMap()[gameId] === true;
}

/** Dismiss the interstitial for this game (idempotent; no-op if storage fails). */
export function acknowledgeRoundBoundary(gameId) {
  if (!gameId) return;
  try {
    const map = readAckMap();
    if (map[gameId] === true) return;
    map[gameId] = true;
    globalThis.localStorage?.setItem(ACK_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — the interstitial will simply show again */
  }
}

/** Remember the player's current bracket game (so elimination can recover the bracketId). */
export function rememberBracketGameId(bracketGameId) {
  if (!bracketGameId) return;
  try {
    globalThis.localStorage?.setItem(LAST_GAME_KEY, bracketGameId);
  } catch {
    /* no-op */
  }
}

/** The last bracket game the player was in (or null). */
export function getRememberedBracketGameId() {
  try {
    return globalThis.localStorage?.getItem(LAST_GAME_KEY) || null;
  } catch {
    return null;
  }
}
