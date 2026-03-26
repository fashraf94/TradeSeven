import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Users, Hand } from 'lucide-react';
import { updateExecutionMode, appendBattleLedger } from '../../services/agentService';

const MODES = [
  { key: 'autopilot', label: 'Autopilot', icon: Zap, desc: 'Agent trades freely. You\'ll see the results in the feed.' },
  { key: 'copilot', label: 'Co-Pilot', icon: Users, desc: 'Agent proposes trades for your approval. You have 10 minutes to respond.' },
  { key: 'manual', label: 'Manual', icon: Hand, desc: 'Agent suggests trades but waits for your explicit approval.' },
];

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ExecutionModeToggle = ({ battleId, executionMode, tokens, disabled = false }) => {
  const activeMode = executionMode || 'copilot';

  const handleModeChange = async (newMode) => {
    if (newMode === activeMode || disabled || !battleId) return;
    try {
      await updateExecutionMode(battleId, newMode);
      await appendBattleLedger(battleId, {
        type: 'mode_change',
        details: { from: activeMode, to: newMode },
      });
    } catch (err) {
      console.error('[ModeToggle] Failed to update mode:', err.message);
    }
  };

  const activeDesc = MODES.find(m => m.key === activeMode)?.desc || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.key;
          return (
            <motion.button
              key={mode.key}
              onClick={() => handleModeChange(mode.key)}
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
                background: isActive ? hexToRgba(tokens.teal, 0.12) : 'transparent',
                color: isActive ? tokens.teal : tokens.textMuted,
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                transition: 'color 0.2s, background 0.2s',
                zIndex: 1,
              }}
            >
              <Icon size={13} />
              {mode.label}
            </motion.button>
          );
        })}
      </div>

      {/* Mode description */}
      <p style={{
        fontSize: '11px',
        color: tokens.textFaint,
        lineHeight: '1.4',
        margin: 0,
        paddingLeft: '4px',
      }}>
        {activeDesc}
      </p>
    </div>
  );
};

export default ExecutionModeToggle;
