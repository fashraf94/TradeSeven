// StrategyPresetBadge - Inline 3-segment strategy posture selector
// Shows Aggressive / Balanced / Defensive as a horizontal segmented control
// with preset-specific colors and icons.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Scale, ShieldCheck } from 'lucide-react';
import { updateStrategyPreset, appendBattleLedger } from '../../services/agentService';

const PRESETS = [
  {
    key: 'aggressive',
    label: 'Aggressive',
    icon: Flame,
    color: '#f59e0b',
    desc: 'Chase momentum. Higher risk, bigger bonuses.',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    icon: Scale,
    color: '#5eead4',
    desc: 'Full strategy mix. Standard risk parameters.',
  },
  {
    key: 'defensive',
    label: 'Defensive',
    icon: ShieldCheck,
    color: '#3b82f6',
    desc: 'Protect your score. Tight stops, high-quality only.',
  },
];

export { PRESETS };

export default function StrategyPresetBadge({ battleId, strategyPreset, tokens, disabled = false }) {
  const [updating, setUpdating] = useState(false);

  const handleSelect = async (preset) => {
    if (preset.key === strategyPreset || updating || disabled || !battleId) return;
    setUpdating(true);
    try {
      await updateStrategyPreset(battleId, preset.key);
      await appendBattleLedger(battleId, {
        type: 'preset_change',
        details: { from: strategyPreset, to: preset.key },
      });
    } catch (err) {
      console.error('[StrategyPresetBadge] Failed to update preset:', err.message);
    }
    setUpdating(false);
  };

  return (
    <div style={{
      display: 'flex',
      borderRadius: 10,
      background: 'rgba(255, 255, 255, 0.02)',
      padding: 3,
      gap: 2,
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      {PRESETS.map((preset) => {
        const Icon = preset.icon;
        const isActive = preset.key === strategyPreset;
        return (
          <motion.button
            key={preset.key}
            onClick={() => handleSelect(preset)}
            disabled={disabled || updating}
            whileTap={disabled ? {} : { scale: 0.96 }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '10px 6px',
              border: 'none',
              borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              position: 'relative',
              background: isActive
                ? `${preset.color}18`
                : 'transparent',
              borderBottom: isActive
                ? `2px solid ${preset.color}`
                : '2px solid transparent',
              color: isActive ? preset.color : 'rgba(255, 255, 255, 0.4)',
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              transition: 'all 0.2s ease',
              letterSpacing: '0.01em',
            }}
          >
            <Icon size={13} />
            <span>{preset.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
