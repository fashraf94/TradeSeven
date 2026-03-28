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
  rookie:  { maxBundles: 1, maxRulesPerBundle: 5 },
  starter: { maxBundles: 2, maxRulesPerBundle: 7 },
  partner: { maxBundles: 3, maxRulesPerBundle: 10 },
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
