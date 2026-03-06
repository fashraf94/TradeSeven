// FantasyTrades TD Scoring - Notification Service
// Generates and manages TD Scoring event notifications
//
// Provides helpers for creating notifications for:
// - Breakout events (yours and opponent's)
// - Session events (start, complete, win/loss)
// - Battle events (lead changes, sweeps)
// - Substitution events (window open/closing)

// ============================================
// NOTIFICATION TYPE DEFINITIONS
// ============================================

/**
 * TD Scoring notification types with display properties
 */
export const TD_NOTIFICATION_TYPES = {
  // Breakout events (positive)
  breakout: { icon: '🎯', color: '#10b981', title: 'Breakout!' },
  rally: { icon: '🚀', color: '#f59e0b', title: 'Rally!' },
  moonshot: { icon: '🌙', color: '#8b5cf6', title: 'Moonshot!' },

  // Bust events (negative)
  bust: { icon: '📉', color: '#ef4444', title: 'Bust' },
  crash: { icon: '💥', color: '#dc2626', title: 'Crash' },
  meltdown: { icon: '🔥', color: '#991b1b', title: 'Meltdown' },

  // Session events
  session_start: { icon: '⏱️', color: '#3b82f6', title: 'Session Started' },
  session_complete: { icon: '✓', color: '#10b981', title: 'Session Complete' },
  session_win: { icon: '🏆', color: '#f59e0b', title: 'Session Won!' },
  session_loss: { icon: '😤', color: '#ef4444', title: 'Session Lost' },

  // Battle events
  battle_lead_change: { icon: '📊', color: '#8b5cf6', title: 'Lead Change' },
  green_sweep: { icon: '💚', color: '#10b981', title: 'Green Sweep!' },
  clean_sweep: { icon: '🧹', color: '#f59e0b', title: 'Clean Sweep!' },
  battle_complete: { icon: '🏁', color: '#3b82f6', title: 'Battle Complete' },
  battle_victory: { icon: '🏆', color: '#10b981', title: 'Victory!' },
  battle_defeat: { icon: '😤', color: '#ef4444', title: 'Defeat' },

  // Substitution events
  sub_window_open: { icon: '🔄', color: '#8b5cf6', title: 'Sub Window Open' },
  sub_window_closing: { icon: '⏰', color: '#f59e0b', title: 'Window Closing' },
  substitution_made: { icon: '↔️', color: '#3b82f6', title: 'Substitution Made' },

  // Opponent events
  opponent_breakout: { icon: '⚠️', color: '#f59e0b', title: 'Opponent Breakout' },
  opponent_substitution: { icon: '👀', color: '#6b7280', title: 'Opponent Sub' },

  // V4 Free Agent & Swap events
  free_agent_rotation: { icon: '🔄', color: '#8b5cf6', title: 'New Free Agents' },
  swap_executed: { icon: '↔️', color: '#3b82f6', title: 'Swap Executed' },
  trade_closed: { icon: '📋', color: '#6b7280', title: 'Trade Closed' },
  day_complete: { icon: '📅', color: '#f59e0b', title: 'Day Complete' },
};

// Session display names
const SESSION_NAMES = {
  MORNING_BELL: 'Morning Bell',
  MIDDAY: 'Midday',
  POWER_HOUR: 'Power Hour',
  NIGHT_GAME: 'Night Game'
};

// ============================================
// NOTIFICATION ID GENERATOR
// ============================================

/**
 * Generate unique notification ID
 */
function generateNotificationId() {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// BREAKOUT NOTIFICATIONS
// ============================================

/**
 * Create notification for a breakout event
 *
 * @param {Object} breakout - Breakout event object
 * @param {boolean} isYours - Whether this is your asset
 * @returns {Object} - Notification object
 */
export function createBreakoutNotification(breakout, isYours) {
  const { symbol, type, percentChange, points, sessionId, battleId } = breakout;
  const typeKey = type.toLowerCase();

  // Format percentage
  const pctStr = percentChange >= 0
    ? `+${percentChange.toFixed(1)}%`
    : `${percentChange.toFixed(1)}%`;

  // Format points
  const ptsStr = points >= 0 ? `+${points}` : `${points}`;

  if (isYours) {
    // Your breakout
    const typeConfig = TD_NOTIFICATION_TYPES[typeKey] || TD_NOTIFICATION_TYPES.breakout;

    return {
      id: generateNotificationId(),
      type: typeKey,
      title: `${typeConfig.icon} ${typeConfig.title}`,
      body: `Your ${symbol} hit ${pctStr} (${ptsStr} pts)`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        sessionId,
        symbol,
        percentChange,
        points,
        isYours: true
      }
    };
  } else {
    // Opponent's breakout
    return {
      id: generateNotificationId(),
      type: 'opponent_breakout',
      title: `⚠️ Opponent Breakout`,
      body: `Opponent's ${symbol} hit a ${type} (${ptsStr} pts)`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        sessionId,
        symbol,
        points,
        breakoutType: type,
        isYours: false
      }
    };
  }
}

// ============================================
// SESSION NOTIFICATIONS
// ============================================

/**
 * Create notification for session completion
 *
 * @param {string} sessionId - Session ID (MORNING_BELL, etc.)
 * @param {number} yourScore - Your score for the session
 * @param {number} oppScore - Opponent's score for the session
 * @param {boolean} won - Whether you won the session
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createSessionNotification(sessionId, yourScore, oppScore, won, battleId = null) {
  const sessionName = SESSION_NAMES[sessionId] || sessionId;

  if (won) {
    return {
      id: generateNotificationId(),
      type: 'session_win',
      title: `🏆 You won ${sessionName}!`,
      body: `${yourScore.toFixed(0)} vs ${oppScore.toFixed(0)}`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        sessionId,
        yourScore,
        oppScore,
        won: true
      }
    };
  } else if (yourScore === oppScore) {
    return {
      id: generateNotificationId(),
      type: 'session_complete',
      title: `✓ ${sessionName} Tied`,
      body: `Both scored ${yourScore.toFixed(0)} points`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        sessionId,
        yourScore,
        oppScore,
        won: null
      }
    };
  } else {
    return {
      id: generateNotificationId(),
      type: 'session_loss',
      title: `😤 Lost ${sessionName}`,
      body: `${yourScore.toFixed(0)} vs ${oppScore.toFixed(0)}`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        sessionId,
        yourScore,
        oppScore,
        won: false
      }
    };
  }
}

/**
 * Create notification for session start
 *
 * @param {string} sessionId - Session ID
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createSessionStartNotification(sessionId, battleId = null) {
  const sessionName = SESSION_NAMES[sessionId] || sessionId;

  return {
    id: generateNotificationId(),
    type: 'session_start',
    title: `⏱️ ${sessionName} Started`,
    body: 'New session is live!',
    timestamp: Date.now(),
    read: false,
    data: {
      battleId,
      sessionId
    }
  };
}

// ============================================
// SUBSTITUTION NOTIFICATIONS
// ============================================

/**
 * Create notification for substitution window
 *
 * @param {number} windowNumber - Window number (1 or 2)
 * @param {number} minutesRemaining - Minutes until window closes
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createSubstitutionWindowNotification(windowNumber, minutesRemaining, battleId = null) {
  if (minutesRemaining >= 10) {
    // Window just opened
    return {
      id: generateNotificationId(),
      type: 'sub_window_open',
      title: '🔄 Substitution window open!',
      body: `${minutesRemaining} min to make changes`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        windowNumber,
        minutesRemaining
      }
    };
  } else {
    // Window closing soon
    return {
      id: generateNotificationId(),
      type: 'sub_window_closing',
      title: `⏰ Sub window closing!`,
      body: `Only ${minutesRemaining} minutes left`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        windowNumber,
        minutesRemaining
      }
    };
  }
}

/**
 * Create notification when a substitution is made
 *
 * @param {string} outSymbol - Symbol being removed
 * @param {string} inSymbol - Symbol being added
 * @param {boolean} isYours - Whether this is your substitution
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createSubstitutionMadeNotification(outSymbol, inSymbol, isYours, battleId = null) {
  if (isYours) {
    return {
      id: generateNotificationId(),
      type: 'substitution_made',
      title: '↔️ Substitution Made',
      body: `${outSymbol} → ${inSymbol}`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        outSymbol,
        inSymbol,
        isYours: true
      }
    };
  } else {
    return {
      id: generateNotificationId(),
      type: 'opponent_substitution',
      title: '👀 Opponent Made a Sub',
      body: `They swapped ${outSymbol} for ${inSymbol}`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        outSymbol,
        inSymbol,
        isYours: false
      }
    };
  }
}

// ============================================
// LEAD CHANGE NOTIFICATIONS
// ============================================

/**
 * Create notification for lead change
 *
 * @param {boolean} isNowLeading - Whether you are now in the lead
 * @param {number} margin - Point difference
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createLeadChangeNotification(isNowLeading, margin, battleId = null) {
  if (isNowLeading) {
    return {
      id: generateNotificationId(),
      type: 'battle_lead_change',
      title: '📊 You took the lead!',
      body: `+${margin.toFixed(0)} pts ahead`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        isLeading: true,
        margin
      }
    };
  } else {
    return {
      id: generateNotificationId(),
      type: 'battle_lead_change',
      title: '📊 Opponent took the lead',
      body: `Trailing by ${margin.toFixed(0)} pts`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        isLeading: false,
        margin
      }
    };
  }
}

// ============================================
// BATTLE COMPLETE NOTIFICATIONS
// ============================================

/**
 * Create notification for battle completion
 *
 * @param {boolean} won - Whether you won the battle
 * @param {number} yourScore - Your final score
 * @param {number} oppScore - Opponent's final score
 * @param {number} margin - Point difference
 * @param {Object} extras - Additional info (cleanSweep, etc.)
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createBattleCompleteNotification(won, yourScore, oppScore, margin, extras = {}, battleId = null) {
  const isTie = yourScore === oppScore;

  if (isTie) {
    return {
      id: generateNotificationId(),
      type: 'battle_complete',
      title: '🏁 Battle Complete - Tie!',
      body: `Final: ${yourScore.toFixed(0)} - ${oppScore.toFixed(0)}`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        won: null,
        yourScore,
        oppScore,
        margin: 0,
        ...extras
      }
    };
  } else if (won) {
    return {
      id: generateNotificationId(),
      type: 'battle_victory',
      title: '🏆 Victory!',
      body: `You won ${yourScore.toFixed(0)} to ${oppScore.toFixed(0)}!`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        won: true,
        yourScore,
        oppScore,
        margin,
        ...extras
      }
    };
  } else {
    return {
      id: generateNotificationId(),
      type: 'battle_defeat',
      title: '😤 Battle Complete',
      body: `Lost by ${margin.toFixed(0)} points`,
      timestamp: Date.now(),
      read: false,
      data: {
        battleId,
        won: false,
        yourScore,
        oppScore,
        margin,
        ...extras
      }
    };
  }
}

/**
 * Create notification for green sweep (all assets positive)
 *
 * @param {string} sessionId - Session ID
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createGreenSweepNotification(sessionId, battleId = null) {
  const sessionName = SESSION_NAMES[sessionId] || sessionId;

  return {
    id: generateNotificationId(),
    type: 'green_sweep',
    title: '💚 Green Sweep!',
    body: `All your assets were positive in ${sessionName}!`,
    timestamp: Date.now(),
    read: false,
    data: {
      battleId,
      sessionId
    }
  };
}

/**
 * Create notification for clean sweep (won all sessions)
 *
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createCleanSweepNotification(battleId = null) {
  return {
    id: generateNotificationId(),
    type: 'clean_sweep',
    title: '🧹 Clean Sweep!',
    body: 'You won all 4 sessions!',
    timestamp: Date.now(),
    read: false,
    data: {
      battleId
    }
  };
}

// ============================================
// DUPLICATE PREVENTION
// ============================================

/**
 * Check if a notification should be sent (prevents duplicates)
 *
 * @param {string} notificationType - Type of notification
 * @param {Object} notificationData - Data for the notification
 * @param {Array} existingNotifications - Array of existing notifications
 * @param {number} dedupeWindowMs - Time window for deduplication (default 5 min)
 * @returns {boolean} - Whether notification should be sent
 */
export function shouldNotify(notificationType, notificationData, existingNotifications = [], dedupeWindowMs = 5 * 60 * 1000) {
  const now = Date.now();

  // Find recent notifications of the same type
  const recentSameType = existingNotifications.filter(n => {
    const age = now - (n.timestamp || 0);
    return n.type === notificationType && age < dedupeWindowMs;
  });

  if (recentSameType.length === 0) {
    return true;
  }

  // Check for exact match based on notification type
  switch (notificationType) {
    case 'breakout':
    case 'rally':
    case 'moonshot':
    case 'bust':
    case 'crash':
    case 'meltdown':
    case 'opponent_breakout':
      // Check for same symbol + session combination
      return !recentSameType.some(n =>
        n.data?.symbol === notificationData.symbol &&
        n.data?.sessionId === notificationData.sessionId
      );

    case 'session_win':
    case 'session_loss':
    case 'session_complete':
    case 'session_start':
      // Check for same session
      return !recentSameType.some(n =>
        n.data?.sessionId === notificationData.sessionId
      );

    case 'sub_window_open':
    case 'sub_window_closing':
      // Check for same window number
      return !recentSameType.some(n =>
        n.data?.windowNumber === notificationData.windowNumber
      );

    case 'battle_lead_change':
      // Only notify if lead direction changed
      return !recentSameType.some(n =>
        n.data?.isLeading === notificationData.isLeading
      );

    case 'battle_victory':
    case 'battle_defeat':
    case 'battle_complete':
      // Only one per battle
      return !recentSameType.some(n =>
        n.data?.battleId === notificationData.battleId
      );

    default:
      // Allow by default
      return true;
  }
}

// ============================================
// STORAGE HELPERS
// ============================================

/**
 * Get notifications storage key for a user
 *
 * @param {string} userId - User ID
 * @returns {string} - Storage key
 */
export function getStorageKey(userId) {
  return `notifications_${userId}`;
}

/**
 * Load notifications from localStorage
 *
 * @param {string} userId - User ID
 * @returns {Array} - Array of notifications
 */
export function loadNotifications(userId) {
  try {
    const key = getStorageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      return data.notifications || [];
    }
    return [];
  } catch (error) {
    console.error('[TDNotifications] Error loading notifications:', error);
    return [];
  }
}

/**
 * Save notifications to localStorage
 *
 * @param {string} userId - User ID
 * @param {Array} notifications - Array of notifications
 */
export function saveNotifications(userId, notifications) {
  try {
    const key = getStorageKey(userId);
    // Keep max 50 notifications
    const trimmed = notifications.slice(0, 50);
    localStorage.setItem(key, JSON.stringify({ notifications: trimmed }));
  } catch (error) {
    console.error('[TDNotifications] Error saving notifications:', error);
  }
}

/**
 * Add a notification to storage
 *
 * @param {string} userId - User ID
 * @param {Object} notification - Notification object
 * @returns {Array} - Updated notifications array
 */
export function addNotificationToStorage(userId, notification) {
  const existing = loadNotifications(userId);
  const updated = [notification, ...existing].slice(0, 50);
  saveNotifications(userId, updated);
  return updated;
}

// ============================================
// V4: FREE AGENT & SWAP NOTIFICATIONS
// ============================================

/**
 * Create notification for free agent rotation
 * @param {Array} newAgents - New free agent symbols
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createFreeAgentRotationNotification(newAgents = [], battleId = null) {
  const symbols = newAgents.map(a => a.symbol || a).join(', ');
  return {
    id: generateNotificationId(),
    type: 'free_agent_rotation',
    title: '🔄 New free agents available!',
    body: symbols || 'Pool refreshed',
    timestamp: Date.now(),
    read: false,
    data: { battleId, symbols: newAgents.map(a => a.symbol || a) },
  };
}

/**
 * Create notification for swap execution
 * @param {string} outSymbol - Symbol removed
 * @param {string} inSymbol - Symbol added
 * @param {number} lockedPoints - Points locked from outgoing asset
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createSwapNotification(outSymbol, inSymbol, lockedPoints = 0, battleId = null) {
  const ptsStr = lockedPoints >= 0 ? `+${lockedPoints.toFixed(1)}` : `${lockedPoints.toFixed(1)}`;
  return {
    id: generateNotificationId(),
    type: 'swap_executed',
    title: `↔️ Swapped ${outSymbol} for ${inSymbol}`,
    body: `${outSymbol} closed at ${ptsStr} pts`,
    timestamp: Date.now(),
    read: false,
    data: { battleId, outSymbol, inSymbol, lockedPoints },
  };
}

/**
 * Create notification for day completion
 * @param {number} dayNumber - Day number (1, 2, 3)
 * @param {number} yourScore - Your score for the day
 * @param {number} oppScore - Opponent's score
 * @param {string} battleId - Battle ID
 * @returns {Object} - Notification object
 */
export function createDayCompleteNotification(dayNumber, yourScore, oppScore, battleId = null) {
  const won = yourScore > oppScore;
  const tied = yourScore === oppScore;
  return {
    id: generateNotificationId(),
    type: 'day_complete',
    title: `📅 Day ${dayNumber} Complete`,
    body: tied
      ? `Tied at ${Math.round(yourScore)} pts`
      : `${won ? 'Leading' : 'Trailing'} ${Math.round(yourScore)} - ${Math.round(oppScore)}`,
    timestamp: Date.now(),
    read: false,
    data: { battleId, dayNumber, yourScore, oppScore, won },
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Types
  TD_NOTIFICATION_TYPES,

  // Breakout notifications
  createBreakoutNotification,

  // Session notifications
  createSessionNotification,
  createSessionStartNotification,

  // Substitution notifications
  createSubstitutionWindowNotification,
  createSubstitutionMadeNotification,

  // Battle notifications
  createLeadChangeNotification,
  createBattleCompleteNotification,
  createGreenSweepNotification,
  createCleanSweepNotification,

  // V4 notifications
  createFreeAgentRotationNotification,
  createSwapNotification,
  createDayCompleteNotification,

  // Helpers
  shouldNotify,
  getStorageKey,
  loadNotifications,
  saveNotifications,
  addNotificationToStorage
};
