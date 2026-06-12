// api/_utils/agentArchetypeConfig.js
// Archetype → strategy engine mapping config.
// Each archetype has real mechanical effects on the regime router,
// risk manager, conviction scoring, and trade frequency.
//
// Forge Enforcement Keystone V1.4 (§3.2 Decision 2, §3.3 Decision 3, §4.1):
//   - `hftConfig` carries the archetype-LOCKED HFT knobs that are read by the
//     risk manager regardless of the user-toggleable `strategyPreset`:
//       * forcedRotation (Knob A, §4.2)  — active-trading floor
//       * hurdleFloor    (Knob B, §4.3)  — deterministic quality gate (Shape-B per-reason)
//       * swapWindow     (Knob C, §4.4)  — circuit-breaker ceiling
//   - The old `riskOverrides` block was dead and sign-flipped (never read by
//     evaluateRisk) and is removed per LOCKED Decision 10. Base risk levers
//     (bustBuffer / vwapFailureTicks / trailStopATR) remain preset-driven via
//     agentPresetConfig.js — see Decision 2.
//
// hftConfig values below are launch-seed and ILLUSTRATIVE (§3.3); calibration
// (Phase 8 behavioral gates 8A/8B) is post-merge work. They are intentionally
// differentiated (degen ≠ guardian) so the archetype→physics wire is real at
// launch (Gate 1).

// `.label` is the API-side USER-FACING display name (used in prompts/logs).
// It mirrors the frontend resolver in src/data/archetypeDisplay.js — the
// canonical source. Keep the two in sync when renaming. The code-id keys
// (momentum_chaser, degen, …) are stable identifiers and must NOT change.
export const ARCHETYPE_CONFIGS = {
  momentum_chaser: {
    label: 'Trend Follower',
    defaultPreset: 'aggressive',
    regimePreferences: {
      favoredStrategies: ['volatility_squeeze', '52_week_high'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    hftConfig: {
      forcedRotation: { enabled: true, pctThreshold: 0.0015, ticksThreshold: 3, maxTickAgeMinutes: 20, winnerThreshold: 0.0015 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.3 },
          stagnation: { atrMultiplier: 0.55 },
        },
        default: { atrMultiplier: 0.3 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 8, windowMinutes: 60, countEmergencies: false },
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
    label: 'Fundamental Investor',
    defaultPreset: 'balanced',
    regimePreferences: {
      favoredStrategies: [],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    hftConfig: {
      forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.4 },
          stagnation: { atrMultiplier: 0.5 },
        },
        default: { atrMultiplier: 0.4 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
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
    hftConfig: {
      forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.4 },
          stagnation: { atrMultiplier: 0.5 },
        },
        default: { atrMultiplier: 0.4 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
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
    hftConfig: {
      forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.4 },
          stagnation: { atrMultiplier: 0.5 },
        },
        default: { atrMultiplier: 0.4 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
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
    label: 'Speculator',
    defaultPreset: 'aggressive',
    regimePreferences: {
      favoredStrategies: ['volatility_squeeze', '52_week_high', 'news_catalyst'],
      avoidedStrategies: [],
      canEnterDistressed: false,
    },
    hftConfig: {
      forcedRotation: { enabled: true, pctThreshold: 0.001, ticksThreshold: 3, maxTickAgeMinutes: 20, winnerThreshold: 0.002 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.2 },
          stagnation: { atrMultiplier: 0.6 },
        },
        default: { atrMultiplier: 0.2 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 12, windowMinutes: 60, countEmergencies: false },
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
    label: 'Capital Preserver',
    defaultPreset: 'defensive',
    regimePreferences: {
      favoredStrategies: ['rs_momentum'],
      avoidedStrategies: ['volatility_squeeze'],
      canEnterDistressed: false,
    },
    hftConfig: {
      // Forced rotation DISABLED for guardian (§3.3 / §3.4). The remaining
      // forcedRotation fields are inert while disabled but kept for schema
      // uniformity / testability.
      forcedRotation: { enabled: false, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
      hurdleFloor: {
        enabled: true,
        byReason: {
          haiku_decision: { atrMultiplier: 0.5 },
          stagnation: { atrMultiplier: 0.5 },
        },
        default: { atrMultiplier: 0.5 },
        requireBenchPositive: true,
      },
      swapWindow: { enabled: true, capPerWindow: 2, windowMinutes: 120, countEmergencies: false },
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

/**
 * P4 — hftConfig mode-awareness (Fence-Edit Map §5E; founder-signed
 * calibration table, June 12, 2026: ZERO deltas at launch). An archetype MAY
 * carry per-mode overrides under `hftConfigByMode[gameMode]`; none do today,
 * so every mode resolves to the archetype-locked `hftConfig` — tiered
 * behavior untouched by construction, and any future flat6 recalibration is
 * a config entry here, never code.
 */
export const resolveHftConfig = (archetypeConfig, gameMode) => {
  return archetypeConfig?.hftConfigByMode?.[gameMode] ?? archetypeConfig?.hftConfig ?? null;
};

// User-facing display label for an archetype, for API-side prompts/logs.
// Mirrors the frontend resolver in src/data/archetypeDisplay.js.
//   - known code-id      → its .label
//   - unknown-but-present → the raw value (legacy behavior)
//   - missing            → `fallback`
// Use THIS for display, not getArchetypeConfig(...).label — getArchetypeConfig
// falls back to the analyst config and would mask a missing archetype.
export const getArchetypeLabel = (archetype, fallback = 'strategist') =>
  ARCHETYPE_CONFIGS[archetype]?.label || archetype || fallback;

export const VALID_ARCHETYPES = Object.keys(ARCHETYPE_CONFIGS);
