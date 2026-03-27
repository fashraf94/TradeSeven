import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Check } from 'lucide-react';
import { AGENT_LEVELS } from '../../constants/agentProgression';

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const LevelUpNotification = ({ event, agentName, onDismiss, tokens }) => {
  if (!event) return null;

  const newLevel = AGENT_LEVELS[event.to];
  const accentColor = newLevel?.color || tokens.teal;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '360px',
            background: tokens.bgApp,
            borderRadius: '24px',
            border: `1px solid ${hexToRgba(accentColor, 0.3)}`,
            boxShadow: `0 0 60px ${hexToRgba(accentColor, 0.15)}, 0 25px 50px rgba(0,0,0,0.5)`,
            padding: '32px 28px',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.15 }}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${accentColor}, ${hexToRgba(accentColor, 0.6)})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', boxShadow: `0 0 30px ${hexToRgba(accentColor, 0.3)}`,
            }}
          >
            <Zap size={28} color="#fff" />
          </motion.div>

          {/* Title */}
          <div style={{ fontSize: '11px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
            Level Up
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: tokens.textPrimary, marginBottom: '20px' }}>
            {agentName || 'Agent'} is now {newLevel?.label || event.to}
          </div>

          {/* Unlocks */}
          {event.unlocks?.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Unlocked
              </div>
              {event.unlocks.map((unlock, i) => (
                <motion.div
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 0', fontSize: '13px', color: tokens.textSecondary,
                  }}
                >
                  <Check size={14} color={accentColor} style={{ flexShrink: 0 }} />
                  {unlock}
                </motion.div>
              ))}
            </div>
          )}

          {/* CTA */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onDismiss}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
              background: `linear-gradient(135deg, ${accentColor}, ${hexToRgba(accentColor, 0.7)})`,
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Let's Go!
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LevelUpNotification;
