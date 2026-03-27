// api/_utils/agentArchetypeConfig.js
// Archetype → strategy engine mapping config.
// Each archetype has real mechanical effects on the regime router,
// risk manager, conviction scoring, and trade frequency.

export const ARCHETYPE_CONFIGS = {
  momentum_chaser: {
    label: 'Momentum Chaser',
    defaultPreset: 'aggressive',
    regimePreferences: {
      favoredStrategies: ['volatility_squeeze', '52_week_high'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    riskOverrides: {
      bustBuffer: 0.90,
      vwapFailureTicks: 2,
      trailStopLevel: 'sma20',
    },
    convictionMods: {
      volumeWeight: 1.2,
      macdWeight: 1.2,
      rsWeight: 0.8,
    },
    sectorConcentrationCap: 3,
    tradeFrequency: 'high',
    defaultConfig: { risk: 75, concentration: 60, momentum: 85 },
    avatarColors: ['#5eead4', '#a855f7'],
  },
  analyst: {
    label: 'Analyst',
    defaultPreset: 'balanced',
    regimePreferences: {
      favoredStrategies: [],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    riskOverrides: {
      bustBuffer: 0.85,
      vwapFailureTicks: 2,
      trailStopLevel: 'sma20',
    },
    convictionMods: {
      convictionThreshold: 1.15,
    },
    sectorConcentrationCap: 3,
    tradeFrequency: 'moderate',
    defaultConfig: { risk: 50, concentration: 50, momentum: 50 },
    avatarColors: ['#3b82f6', '#5eead4'],
  },
  diversifier: {
    label: 'Diversifier',
    defaultPreset: 'balanced',
    regimePreferences: {
      favoredStrategies: ['rs_momentum'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    riskOverrides: {
      bustBuffer: 0.85,
      vwapFailureTicks: 2,
      trailStopLevel: 'sma20',
    },
    convictionMods: {},
    sectorConcentrationCap: 2,
    tradeFrequency: 'moderate',
    defaultConfig: { risk: 45, concentration: 30, momentum: 55 },
    avatarColors: ['#10b981', '#3b82f6'],
  },
  contrarian: {
    label: 'Contrarian',
    defaultPreset: 'balanced',
    regimePreferences: {
      favoredStrategies: ['vwap_mean_reversion'],
      avoidedStrategies: [],
      canEnterDistressed: true,
    },
    riskOverrides: {
      bustBuffer: 0.85,
      vwapFailureTicks: 2,
      trailStopLevel: 'sma20',
    },
    convictionMods: {
      rsWeight: -0.5,
    },
    sectorConcentrationCap: 3,
    tradeFrequency: 'moderate',
    defaultConfig: { risk: 65, concentration: 55, momentum: 40 },
    avatarColors: ['#a855f7', '#ef4444'],
  },
  degen: {
    label: 'Degen',
    defaultPreset: 'aggressive',
    regimePreferences: {
      favoredStrategies: ['volatility_squeeze', '52_week_high', 'news_catalyst'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    riskOverrides: {
      bustBuffer: 0.90,
      vwapFailureTicks: 3,
      trailStopLevel: 'sma9',
    },
    convictionMods: {
      convictionThreshold: 0.85,
    },
    sectorConcentrationCap: 4,
    tradeFrequency: 'highest',
    defaultConfig: { risk: 90, concentration: 75, momentum: 90 },
    avatarColors: ['#ef4444', '#f59e0b'],
  },
  guardian: {
    label: 'Guardian',
    defaultPreset: 'defensive',
    regimePreferences: {
      favoredStrategies: ['rs_momentum'],
      avoidedStrategies: ['volatility_squeeze'],
      canEnterDistressed: false,
    },
    riskOverrides: {
      bustBuffer: 0.75,
      vwapFailureTicks: 1,
      trailStopLevel: 'sma20',
    },
    convictionMods: {
      convictionThreshold: 1.2,
    },
    sectorConcentrationCap: 2,
    tradeFrequency: 'low',
    defaultConfig: { risk: 25, concentration: 40, momentum: 35 },
    avatarColors: ['#3b82f6', '#10b981'],
  },
};

export const getArchetypeConfig = (archetype) => {
  return ARCHETYPE_CONFIGS[archetype] || ARCHETYPE_CONFIGS.analyst;
};

export const VALID_ARCHETYPES = Object.keys(ARCHETYPE_CONFIGS);
