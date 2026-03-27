// api/_utils/agentPresetConfig.js
// Strategy preset configurations for agent behavior modification.
// Controls how the regime router, risk manager, and prompt system behave
// based on the user's chosen strategic posture.

const PRESET_CONFIGS = {
  aggressive: {
    label: 'Aggressive',
    regime: {
      favoredStrategies: ['volatility_squeeze_breakout', '52w_high_breakout', 'rs_momentum_vwap_pullback'],
      holdOnlyRegimes: [],
    },
    risk: {
      bustBuffer: -0.90,
      vwapFailureTicks: 3,
      trailStopATR: 1.5,
    },
    scoring: {
      minConviction: 65,
    },
    promptGuidance: 'You are in AGGRESSIVE mode. Prioritize high-ATR stocks with breakout potential. Accept higher risk for larger BaggerBomb bonus opportunities. Chase momentum. Favor Star tier positions in volatile sectors. Lower your conviction threshold for swaps — act on strong setups even with moderate confidence.',
  },

  balanced: {
    label: 'Balanced',
    regime: {
      favoredStrategies: null,
      holdOnlyRegimes: [],
    },
    risk: {
      bustBuffer: -0.85,
      vwapFailureTicks: 2,
      trailStopATR: 1.5,
    },
    scoring: {
      minConviction: 75,
    },
    promptGuidance: 'You are in BALANCED mode. Use the full strategy mix based on regime classification. Standard risk parameters. Make trades when conviction is strong. Balance risk and reward across all tiers.',
  },

  defensive: {
    label: 'Defensive',
    regime: {
      favoredStrategies: ['rs_momentum_vwap_pullback', 'vwap_mean_reversion'],
      holdOnlyRegimes: ['choppy'],
    },
    risk: {
      bustBuffer: -0.75,
      vwapFailureTicks: 1,
      trailStopATR: 1.0,
    },
    scoring: {
      minConviction: 85,
    },
    promptGuidance: 'You are in DEFENSIVE mode. Prioritize capital preservation above all else. Favor high-RS, low-volatility stocks. Only trade with very high conviction. Tight stops — protect the current score aggressively. Avoid breakout plays in uncertain conditions. Sit out choppy regimes entirely.',
  },
};

function getPresetConfig(preset) {
  return PRESET_CONFIGS[preset] || PRESET_CONFIGS.balanced;
}

module.exports = { PRESET_CONFIGS, getPresetConfig };
