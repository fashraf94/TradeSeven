import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Scale, ShieldCheck } from 'lucide-react';
import { updateStrategyPreset, appendBattleLedger } from '../../services/agentService';

const PRESETS = [
  { key: 'aggressive', label: 'Aggressive', icon: Flame, color: '#f59e0b', desc: 'Chase momentum. Higher risk, bigger bonuses.' },
  { key: 'balanced', label: 'Balanced', icon: Scale, color: '#5eead4', desc: 'Full strategy mix. Standard risk parameters.' },
  { key: 'defensive', label: 'Defensive', icon: ShieldCheck, color: '#3b82f6', desc: 'Protect your score. Tight stops, high-quality stocks only.' },
];

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const StrategyPresetToggle = ({ battleId, strategyPreset, tokens, disabled = false }) => {
  const activePreset = strategyPreset || 'balanced';

  const handlePresetChange = async (newPreset) => {
    if (newPreset === activePreset || disabled || !battleId) return;
    try {
      await updateStrategyPreset(battleId, newPreset);
      await appendBattleLedger(battleId, {
        type: 'preset_change',
        details: { from: activePreset, to: newPreset },
      });
    } catch (err) {
      console.error('[PresetToggle] Failed to update preset:', err.message);
    }
  };

  const activeInfo = PRESETS.find(p => p.key === activePreset) || PRESETS[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Label */}
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: tokens.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Strategy Preset
      </div>

      {/* Segmented control */}
      <div style={{
        display: 'flex',
        borderRadius: '12px',
        border: `1px solid ${tokens.borderDefault}`,
        background: tokens.bgCard,
        padding: '3px',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
      }}>
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isActive = activePreset === preset.key;
          const accentColor = isActive ? preset.color : tokens.textMuted;
          return (
            <motion.button
              key={preset.key}
              onClick={() => handlePresetChange(preset.key)}
              disabled={disabled}
              whileTap={disabled ? {} : { scale: 0.97 }}
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '8px 4px',
                border: 'none',
                borderRadius: '10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: isActive ? hexToRgba(preset.color, 0.12) : 'transparent',
                color: accentColor,
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                transition: 'color 0.2s, background 0.2s',
                zIndex: 1,
                fontFamily: 'inherit',
              }}
            >
              <Icon size={13} />
              {preset.label}
            </motion.button>
          );
        })}
      </div>

      {/* Preset description */}
      <p style={{
        fontSize: '11px',
        color: tokens.textFaint,
        lineHeight: '1.4',
        margin: 0,
        paddingLeft: '4px',
      }}>
        {activeInfo.desc}
      </p>
    </div>
  );
};

export default StrategyPresetToggle;
