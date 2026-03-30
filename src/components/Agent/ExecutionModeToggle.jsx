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

// ── Pills variant (original) ───────────────────────────────────────────────

function PillsVariant({ activeMode, handleModeChange, tokens, disabled }) {
  const activeDesc = MODES.find(m => m.key === activeMode)?.desc || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
}

// ── Cards variant (Command Center) ─────────────────────────────────────────

function CardsVariant({ activeMode, handleModeChange, tokens, disabled }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
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
            whileTap={disabled ? {} : { scale: 0.98 }}
            layout
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              border: 'none',
              borderRadius: 10,
              cursor: disabled ? 'not-allowed' : 'pointer',
              position: 'relative',
              transition: 'background 0.2s, opacity 0.2s',
              background: isActive
                ? 'rgba(94, 234, 212, 0.06)'
                : 'rgba(255, 255, 255, 0.02)',
              borderLeft: isActive
                ? '3px solid #5eead4'
                : '3px solid transparent',
              boxShadow: isActive
                ? 'inset 3px 0 12px rgba(94, 234, 212, 0.12)'
                : 'none',
              opacity: isActive ? 1 : 0.45,
              textAlign: 'left',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive
                ? 'rgba(94, 234, 212, 0.12)'
                : 'rgba(255, 255, 255, 0.04)',
              flexShrink: 0,
            }}>
              <Icon
                size={16}
                color={isActive ? '#5eead4' : (tokens.textMuted || '#64748b')}
              />
            </div>

            {/* Name + Description */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#e6edf3' : (tokens.textMuted || '#64748b'),
                lineHeight: 1.2,
                marginBottom: 2,
              }}>
                {mode.label}
              </div>
              <div style={{
                fontSize: 11,
                color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {mode.desc}
              </div>
            </div>

            {/* Active badge */}
            {isActive && (
              <span style={{
                fontSize: 8,
                fontWeight: 700,
                color: '#5eead4',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(94, 234, 212, 0.1)',
                flexShrink: 0,
              }}>
                ACTIVE
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

const ExecutionModeToggle = ({ battleId, executionMode, tokens, disabled = false, variant = 'pills' }) => {
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

  if (variant === 'cards') {
    return <CardsVariant activeMode={activeMode} handleModeChange={handleModeChange} tokens={tokens} disabled={disabled} />;
  }

  return <PillsVariant activeMode={activeMode} handleModeChange={handleModeChange} tokens={tokens} disabled={disabled} />;
};

export default ExecutionModeToggle;
