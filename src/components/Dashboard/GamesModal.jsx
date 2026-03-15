// /src/components/Dashboard/GamesModal.jsx
// Bottom-sheet modal for game mode selection — PVP and Training options
// Opened from Challenge / Quick Play CTA buttons on the dashboard

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, TrendingUp, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import TapGlint from '../shared/TapGlint';

// ─── Game data ───────────────────────────────────────────────────────────────

const GAMES = [
  {
    id: 'baggerbomb',
    name: 'BaggerBomb',
    Icon: Flame,
    iconColor: '#f59e0b',
    pvpTagline: 'Volatility-powered 1v1 battles',
    trainTagline: 'Practice with AI opponent',
  },
  {
    id: 'snakeDraft',
    name: 'Snake Draft',
    Icon: TrendingUp,
    iconColor: '#34d399',
    pvpTagline: '4-player serpentine draft',
    trainTagline: 'Draft against 3 AI players',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function GamesModal({
  isOpen,
  onClose,
  mode,
  setShowBaggerBombModal,
  setShowSnakeDraftModal,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
}) {
  const { tokens } = useTheme();
  const [tapCounts, setTapCounts] = useState({});

  const handleGameSelect = (gameId, sectionType) => {
    onClose();
    if (sectionType === 'pvp') {
      if (gameId === 'baggerbomb') setShowBaggerBombModal(true);
      if (gameId === 'snakeDraft') setShowSnakeDraftModal(true);
    } else {
      if (gameId === 'baggerbomb') setShowBaggerBombTrainingConfirm(true);
      if (gameId === 'snakeDraft') {
        setTrainingConfirmType('stocks');
        setShowTrainingConfirmModal(true);
      }
    }
  };

  const sections = mode === 'pvp'
    ? [{ title: 'CHALLENGE A FRIEND', type: 'pvp' }, { title: 'QUICK PLAY VS AI', type: 'training' }]
    : [{ title: 'QUICK PLAY VS AI', type: 'training' }, { title: 'CHALLENGE A FRIEND', type: 'pvp' }];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* Modal Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              background: tokens.bgApp,
              borderRadius: '24px 24px 0 0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Grab handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '12px',
            }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: tokens.textFaintest,
              }} />
            </div>

            {/* Header */}
            <div style={{
              position: 'relative',
              padding: '20px 0',
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: '22px',
                fontWeight: '600',
                color: tokens.textPrimary,
              }}>
                Games
              </span>
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '20px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tokens.bgIcon,
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: tokens.textFaint,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0 20px',
              paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
            }}>
              {sections.map((section, si) => (
                <div key={section.type} style={{ marginTop: si === 0 ? 0 : '24px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: tokens.textFaint,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    marginBottom: '12px',
                    padding: '0 4px',
                  }}>
                    {section.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {GAMES.map((game) => {
                      const tapKey = `${section.type}-${game.id}`;
                      return (
                        <motion.button
                          key={tapKey}
                          onClick={() => {
                            setTapCounts(prev => ({ ...prev, [tapKey]: (prev[tapKey] || 0) + 1 }));
                            handleGameSelect(game.id, section.type);
                          }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          style={{
                            position: 'relative',
                            overflow: 'hidden',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '16px',
                            background: tokens.bgCard,
                            border: `1px solid ${tokens.borderDefault}`,
                            borderRadius: '14px',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <TapGlint triggerKey={tapCounts[tapKey] || 0} />
                          {/* Icon */}
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: tokens.bgIcon,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <game.Icon size={24} color={game.iconColor} />
                          </div>
                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: tokens.textPrimary,
                            }}>
                              {game.name}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: tokens.textMuted,
                              marginTop: '2px',
                            }}>
                              {section.type === 'pvp' ? game.pvpTagline : game.trainTagline}
                            </div>
                          </div>
                          {/* Chevron */}
                          <ChevronRight size={16} color={tokens.textFaintest} style={{ flexShrink: 0 }} />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
