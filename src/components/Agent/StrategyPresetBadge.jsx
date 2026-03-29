// StrategyPresetBadge - Compact badge chip for strategy preset selection
// Tappable chip that opens a bottom-sheet popover with 3 preset options.

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Scale, ShieldCheck, Settings } from 'lucide-react';
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

export default function StrategyPresetBadge({ battleId, strategyPreset, tokens, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const popoverRef = useRef(null);

  const activePreset = PRESETS.find(p => p.key === strategyPreset) || PRESETS[1];

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [open]);

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
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Badge chip */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 36,
          padding: '0 12px',
          borderRadius: 10,
          border: `1px solid ${activePreset.color}33`,
          background: `${activePreset.color}14`,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontSize: 12,
          fontWeight: 600,
          color: activePreset.color,
          whiteSpace: 'nowrap',
        }}
      >
        <Settings size={12} />
        <span>{activePreset.label}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '\u25B4' : '\u25BE'}</span>
      </motion.button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 999,
              }}
            />

            {/* Popover card */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 240,
                background: tokens.bgCard || '#15171E',
                border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
                borderRadius: 14,
                padding: 6,
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = preset.key === strategyPreset;
                return (
                  <motion.button
                    key={preset.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelect(preset)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? `${preset.color}18` : 'transparent',
                      cursor: isActive ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${preset.color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} color={preset.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? preset.color : (tokens.textPrimary || '#e2e8f0'),
                      }}>
                        {preset.label}
                        {isActive && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>Active</span>}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: tokens.textFaint || '#64748b',
                        lineHeight: 1.3,
                        marginTop: 1,
                      }}>
                        {preset.desc}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
