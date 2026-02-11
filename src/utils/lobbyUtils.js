// /src/utils/lobbyUtils.js
// Lobby expiration and cleanup utilities

/**
 * Configuration constants for lobby expiration
 */
export const LOBBY_CONFIG = {
  EXPIRATION_GRACE_PERIOD_MS: 5 * 60 * 1000,          // 5 minutes after scheduled start
  SNAKE_DRAFT_MIN_PLAYERS: 4,
  BAGGER_BOMB_MIN_PLAYERS: 2,                          // Creator + 1 opponent
  DISBANDED_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,    // 7 days retention
  BAGGER_BOMB_FALLBACK_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours if no scheduledStart
};

/**
 * Warning thresholds for UI display
 */
export const EXPIRATION_WARNING = {
  URGENT_THRESHOLD_MS: 2 * 60 * 1000,   // 2 minutes - red warning
  WARNING_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes - yellow warning
};

/**
 * Detect if a lobby is a Snake Draft
 * @param {Object} lobby - Lobby document
 * @returns {boolean}
 */
export function isSnakeDraft(lobby) {
  return lobby?.isSnakeDraft === true || lobby?.battleType === 'snake-draft';
}

/**
 * Detect if a lobby is a BaggerBomb V3 or V4
 * @param {Object} lobby - Lobby document
 * @returns {boolean}
 */
export function isBaggerBombV3(lobby) {
  return lobby?._v === 3 || lobby?._v === 4;
}

/**
 * Get the status of a lobby (normalized for both types)
 * @param {Object} lobby - Lobby document
 * @returns {string|null}
 */
export function getLobbyStatus(lobby) {
  if (!lobby) return null;

  // Snake Draft: status at root level
  if (isSnakeDraft(lobby)) {
    return lobby.status;
  }

  // BaggerBomb V3: status in state.status
  if (isBaggerBombV3(lobby)) {
    return lobby.state?.status;
  }

  // Unknown lobby type
  return null;
}

/**
 * Get the scheduled start time of a lobby
 * @param {Object} lobby - Lobby document
 * @returns {Date|null}
 */
export function getLobbyScheduledStart(lobby) {
  if (!lobby) return null;

  // Snake Draft: scheduledStart at root level
  if (isSnakeDraft(lobby) && lobby.scheduledStart) {
    return new Date(lobby.scheduledStart);
  }

  // BaggerBomb V3: timing.scheduledStart
  if (isBaggerBombV3(lobby) && lobby.timing?.scheduledStart) {
    return new Date(lobby.timing.scheduledStart);
  }

  return null;
}

/**
 * Get the creation time of a lobby
 * @param {Object} lobby - Lobby document
 * @returns {Date|null}
 */
export function getLobbyCreatedAt(lobby) {
  if (!lobby) return null;

  // Snake Draft: createdAt at root level (can be Timestamp or ISO string)
  if (isSnakeDraft(lobby) && lobby.createdAt) {
    if (lobby.createdAt.toDate) {
      return lobby.createdAt.toDate();
    }
    return new Date(lobby.createdAt);
  }

  // BaggerBomb V3: timing.createdAt
  if (isBaggerBombV3(lobby) && lobby.timing?.createdAt) {
    return new Date(lobby.timing.createdAt);
  }

  return null;
}

/**
 * Get the player count for a lobby
 * @param {Object} lobby - Lobby document
 * @returns {number}
 */
export function getLobbyPlayerCount(lobby) {
  if (!lobby) return 0;

  // Snake Draft: players array length
  if (isSnakeDraft(lobby)) {
    return lobby.players?.length || 0;
  }

  // BaggerBomb V3: creator always exists, check for opponent
  if (isBaggerBombV3(lobby)) {
    let count = 0;
    if (lobby.creator?.uid || lobby.creator?.odUserId) count++;
    if (lobby.opponent?.uid || lobby.opponent?.odUserId) count++;
    return count;
  }

  return 0;
}

/**
 * Check if a lobby is full (has enough players)
 * @param {Object} lobby - Lobby document
 * @returns {boolean}
 */
export function isLobbyFull(lobby) {
  if (!lobby) return false;

  const playerCount = getLobbyPlayerCount(lobby);

  if (isSnakeDraft(lobby)) {
    return playerCount >= LOBBY_CONFIG.SNAKE_DRAFT_MIN_PLAYERS;
  }

  if (isBaggerBombV3(lobby)) {
    return playerCount >= LOBBY_CONFIG.BAGGER_BOMB_MIN_PLAYERS;
  }

  return false;
}

/**
 * Calculate the expiration time for a lobby
 * @param {Object} lobby - Lobby document
 * @returns {Date|null} - The time at which the lobby expires, or null if cannot determine
 */
export function getLobbyExpirationTime(lobby) {
  if (!lobby) return null;

  // For Snake Draft: use scheduledStart + grace period
  if (isSnakeDraft(lobby)) {
    const scheduledStart = getLobbyScheduledStart(lobby);
    if (scheduledStart) {
      return new Date(scheduledStart.getTime() + LOBBY_CONFIG.EXPIRATION_GRACE_PERIOD_MS);
    }
    return null;
  }

  // For BaggerBomb V3: prefer lobbyExpiresAt field (new), fallback to createdAt + 24h (legacy)
  if (isBaggerBombV3(lobby)) {
    // NEW: Use lobbyExpiresAt if available (from new time selection feature)
    if (lobby.timing?.lobbyExpiresAt) {
      return new Date(lobby.timing.lobbyExpiresAt);
    }

    // FALLBACK: Legacy lobbies without lobbyExpiresAt - use createdAt + 24 hours
    const createdAt = getLobbyCreatedAt(lobby);
    if (createdAt) {
      return new Date(createdAt.getTime() + LOBBY_CONFIG.BAGGER_BOMB_FALLBACK_EXPIRY_MS);
    }
  }

  return null;
}

/**
 * Check if a Snake Draft lobby is expired
 * @param {Object} draft - Draft lobby document
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {boolean}
 */
export function isSnakeDraftExpired(draft, now = new Date()) {
  if (!draft || !isSnakeDraft(draft)) return false;

  // Only check waiting lobbies
  if (draft.status !== 'waiting') return false;

  // Full lobbies never expire - wait for host to start
  if (isLobbyFull(draft)) return false;

  const expirationTime = getLobbyExpirationTime(draft);
  if (!expirationTime) return false;

  return now.getTime() >= expirationTime.getTime();
}

/**
 * Check if a BaggerBomb V3 lobby is expired
 * @param {Object} battle - BaggerBomb battle document
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {boolean}
 */
export function isBaggerBombExpired(battle, now = new Date()) {
  if (!battle || !isBaggerBombV3(battle)) return false;

  // Only check waiting lobbies
  if (battle.state?.status !== 'waiting') return false;

  // Full lobbies never expire
  if (isLobbyFull(battle)) return false;

  const expirationTime = getLobbyExpirationTime(battle);
  if (!expirationTime) return false;

  return now.getTime() >= expirationTime.getTime();
}

/**
 * Check if any lobby is expired (unified function)
 * @param {Object} lobby - Lobby document (Snake Draft or BaggerBomb)
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {boolean}
 */
export function isLobbyExpired(lobby, now = new Date()) {
  if (!lobby) return false;

  if (isSnakeDraft(lobby)) {
    return isSnakeDraftExpired(lobby, now);
  }

  if (isBaggerBombV3(lobby)) {
    return isBaggerBombExpired(lobby, now);
  }

  return false;
}

/**
 * Get detailed expiration status for a lobby
 * @param {Object} lobby - Lobby document
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {Object} Status object with: { isExpired, status, timeUntilExpiration, expirationTime, message }
 */
export function getLobbyExpirationStatus(lobby, now = new Date()) {
  const result = {
    isExpired: false,
    status: 'active',      // 'active' | 'warning' | 'urgent' | 'expired'
    timeUntilExpiration: null,
    expirationTime: null,
    message: null,
  };

  if (!lobby) {
    result.isExpired = true;
    result.status = 'expired';
    result.message = 'Lobby not found';
    return result;
  }

  const status = getLobbyStatus(lobby);

  // Already disbanded
  if (status === 'disbanded') {
    result.isExpired = true;
    result.status = 'expired';
    result.message = 'Lobby has been disbanded';
    return result;
  }

  // Not in waiting status
  if (status !== 'waiting') {
    return result; // Active lobby, not expired
  }

  // Full lobbies don't expire
  if (isLobbyFull(lobby)) {
    result.message = 'Lobby is full - waiting for host';
    return result;
  }

  const expirationTime = getLobbyExpirationTime(lobby);
  if (!expirationTime) {
    return result; // Can't determine expiration
  }

  result.expirationTime = expirationTime;
  const timeUntilExpiration = expirationTime.getTime() - now.getTime();
  result.timeUntilExpiration = timeUntilExpiration;

  if (timeUntilExpiration <= 0) {
    result.isExpired = true;
    result.status = 'expired';
    result.message = 'Lobby has expired due to insufficient players';
  } else if (timeUntilExpiration <= EXPIRATION_WARNING.URGENT_THRESHOLD_MS) {
    result.status = 'urgent';
    const seconds = Math.ceil(timeUntilExpiration / 1000);
    result.message = `Expires in ${seconds}s!`;
  } else if (timeUntilExpiration <= EXPIRATION_WARNING.WARNING_THRESHOLD_MS) {
    result.status = 'warning';
    const minutes = Math.ceil(timeUntilExpiration / 60000);
    result.message = `Expires in ${minutes}m`;
  }

  return result;
}

/**
 * Filter an array of lobbies to only include active (non-expired) ones
 * @param {Array} lobbies - Array of lobby documents
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {Array} - Filtered array of active lobbies
 */
export function filterActiveLobbies(lobbies, now = new Date()) {
  if (!Array.isArray(lobbies)) return [];

  return lobbies.filter(lobby => {
    const status = getLobbyStatus(lobby);

    // Exclude already disbanded lobbies
    if (status === 'disbanded') return false;

    // Exclude expired lobbies
    if (isLobbyExpired(lobby, now)) return false;

    return true;
  });
}

/**
 * Check if a disbanded lobby should be deleted (retention period passed)
 * @param {Object} lobby - Lobby document with disbandedAt timestamp
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {boolean}
 */
export function shouldDeleteDisbandedLobby(lobby, now = new Date()) {
  if (!lobby) return false;

  const status = getLobbyStatus(lobby);
  if (status !== 'disbanded') return false;

  const disbandedAt = lobby.disbandedAt ? new Date(lobby.disbandedAt) : null;
  if (!disbandedAt) return false;

  const retentionExpired = now.getTime() - disbandedAt.getTime() >= LOBBY_CONFIG.DISBANDED_RETENTION_MS;
  return retentionExpired;
}

/**
 * Format time until expiration for display
 * @param {number} timeMs - Time in milliseconds
 * @returns {string} - Formatted time string
 */
export function formatExpirationTime(timeMs) {
  if (timeMs <= 0) return 'Expired';

  const seconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 && minutes < 5 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Get approximate time until lobby expires (rounded increments for public display)
 * Used in lobby cards for user-friendly countdown display
 * @param {Object} lobby - Lobby document
 * @returns {string} - Formatted time string (~5m, ~30m, ~1h 30m, etc.)
 */
export function getApproximateTimeUntilExpiry(lobby) {
  const expiresAt = getLobbyExpirationTime(lobby);
  if (!expiresAt) return 'No time set';

  const now = new Date();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) return 'Expiring now!';

  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 10) {
    // Round UP to 5-minute increments
    const rounded = Math.ceil(diffMins / 5) * 5;
    return `~${rounded || 5}m`;
  } else if (diffMins < 30) {
    // Round UP to 10-minute increments
    const rounded = Math.ceil(diffMins / 10) * 10;
    return `~${rounded}m`;
  } else if (diffMins < 60) {
    // Round UP to 30-minute increments
    const rounded = Math.ceil(diffMins / 30) * 30;
    return `~${rounded}m`;
  } else {
    // Over 1 hour - round to 30-minute increments, show hours + mins
    const totalMins = Math.ceil(diffMins / 30) * 30;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
  }
}

/**
 * Get minutes until lobby expires for tier grouping
 * @param {Object} lobby - Lobby document
 * @returns {number} - Minutes until expiration (0 if expired or cannot determine)
 */
export function getMinutesUntilExpiry(lobby) {
  const expiresAt = getLobbyExpirationTime(lobby);
  if (!expiresAt) return 0;
  const now = new Date();
  const diffMs = expiresAt - now;
  return Math.max(0, Math.floor(diffMs / 60000));
}

/**
 * Group BaggerBomb lobbies by expiration time tiers
 * Matches the Snake Draft pattern for consistent UX
 * @param {Array} lobbies - Array of BaggerBomb lobby documents
 * @returns {Object} - Tiers object with lobbies grouped by time
 */
export function groupBaggerBombLobbiesByTime(lobbies) {
  const tiers = {
    soon: {
      key: 'soon',
      label: 'Expiring Soon',
      sublabel: 'under 30 min',
      icon: 'Flame',
      iconColor: '#f59e0b',
      lobbies: []
    },
    medium: {
      key: 'medium',
      label: 'Expiring in 30min - 1 hour',
      sublabel: null,
      icon: 'Clock',
      iconColor: '#8b949e',
      lobbies: []
    },
    later: {
      key: 'later',
      label: 'Expiring in 1-2 hours',
      sublabel: null,
      icon: 'Calendar',
      iconColor: '#8b949e',
      lobbies: []
    },
    future: {
      key: 'future',
      label: 'Expiring in 2+ hours',
      sublabel: null,
      icon: 'CalendarDays',
      iconColor: '#8b949e',
      lobbies: []
    },
  };

  if (!Array.isArray(lobbies)) return tiers;

  lobbies.forEach(lobby => {
    const diffMins = getMinutesUntilExpiry(lobby);

    if (diffMins < 30) {
      tiers.soon.lobbies.push(lobby);
    } else if (diffMins < 60) {
      tiers.medium.lobbies.push(lobby);
    } else if (diffMins < 120) {
      tiers.later.lobbies.push(lobby);
    } else {
      tiers.future.lobbies.push(lobby);
    }
  });

  // Sort each tier by soonest first
  Object.values(tiers).forEach(tier => {
    tier.lobbies.sort((a, b) => {
      const aTime = getLobbyExpirationTime(a) || new Date(0);
      const bTime = getLobbyExpirationTime(b) || new Date(0);
      return aTime - bTime;
    });
  });

  return tiers;
}
