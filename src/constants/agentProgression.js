// src/constants/agentProgression.js
// Single source of truth for agent progression thresholds and feature gates.

export const AGENT_LEVELS = {
  rookie: {
    label: 'Rookie',
    minGames: 0,
    maxGames: 4,
    color: '#6b7280',
    chatBudget: 2,
    playbookSlots: 5,
    features: {
      autopilot: false,
      debate: false,
      gameplanMeeting: false,
      presets: true,
    },
    speech: 'Still learning the ropes. Every battle teaches me something new.',
  },
  starter: {
    label: 'Starter',
    minGames: 5,
    maxGames: 14,
    color: '#5eead4',
    chatBudget: 4,
    playbookSlots: 10,
    features: {
      autopilot: true,
      debate: true,
      gameplanMeeting: true,
      presets: true,
    },
    speech: 'Starting to find my rhythm. Trust the process, Coach.',
  },
  partner: {
    label: 'Partner',
    minGames: 15,
    maxGames: Infinity,
    color: '#8b5cf6',
    chatBudget: 6,
    playbookSlots: 20,
    features: {
      autopilot: true,
      debate: true,
      gameplanMeeting: true,
      presets: true,
    },
    speech: "We make a good team, Coach. Let's keep building.",
  },
};

// Forge limits by progression level — controls bundle and rule capacity
export const FORGE_LIMITS = {
  rookie:  { maxBundles: 5, maxRulesPerBundle: 10 },
  starter: { maxBundles: 5, maxRulesPerBundle: 15 },
  partner: { maxBundles: 5, maxRulesPerBundle: 20 },
};

export function getAgentLevel(gamesPlayed) {
  if (gamesPlayed >= 15) return 'partner';
  if (gamesPlayed >= 5) return 'starter';
  return 'rookie';
}

export function getLevelConfig(gamesPlayed) {
  return AGENT_LEVELS[getAgentLevel(gamesPlayed)];
}

export function getNextLevelInfo(gamesPlayed) {
  const currentLevel = getAgentLevel(gamesPlayed);
  if (currentLevel === 'partner') return null;
  const nextLevel = currentLevel === 'rookie' ? 'starter' : 'partner';
  const config = AGENT_LEVELS[nextLevel];
  return {
    level: nextLevel,
    label: config.label,
    gamesNeeded: config.minGames - gamesPlayed,
    unlocks: currentLevel === 'rookie'
      ? ['Autopilot mode', 'Debate mechanic', 'Gameplan meetings', '10 Playbook slots', '4 chat exchanges']
      : ['20 Playbook slots', '6 chat exchanges'],
  };
}

// TODO: Wire this into the level-up notification flow.
// When agent.stats.gamesPlayed crosses a level threshold:
// 1. Call getQueuedRulesForPromotion(agentRules, newLevel)
// 2. Batch-update each rule's status from 'queued' to 'active' in Firestore
// 3. Show the celebration notification with the returned message

/**
 * Promotes queued rules to active when a user levels up.
 * Call this when agent.stats.gamesPlayed crosses a level threshold.
 *
 * @param {Object[]} rules - All rules for this agent (from Firestore)
 * @param {string} newLevel - The new level ('starter' or 'partner')
 * @returns {Object} { ruleIdsToPromote: string[], message: string|null }
 */
export function getQueuedRulesForPromotion(rules, newLevel) {
  const levelConfig = AGENT_LEVELS[newLevel];
  if (!levelConfig) return { ruleIdsToPromote: [], message: null };

  const maxSlots = levelConfig.playbookSlots;
  const activeRules = rules.filter(r => r.status === 'active' || !r.status);
  const queuedRules = rules
    .filter(r => r.status === 'queued')
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const availableSlots = maxSlots - activeRules.length;
  const rulesToPromote = queuedRules.slice(0, Math.max(0, availableSlots));

  return {
    ruleIdsToPromote: rulesToPromote.map(r => r.id),
    message: rulesToPromote.length > 0
      ? `${rulesToPromote.length} new rules activated in your strategy!`
      : null,
  };
}
