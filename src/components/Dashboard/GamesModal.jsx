// /src/components/Dashboard/GamesModal.jsx
// Bottom-sheet modal with swipeable game mode card carousel
// Each card: icon, description, Go to Lobby / Play vs AI / How to Score

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, TrendingUp, Users, Bot, BookOpen } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// ─── Game mode data ──────────────────────────────────────────────────────────

const GAME_MODES = [
  {
    id: 'baggerbomb',
    name: 'BaggerBomb',
    subtitle: '1v1 Volatility Battle',
    description: 'Build a 7-stock portfolio and compete head-to-head. Stocks that break through volatility thresholds trigger BaggerBomb bonuses for explosive scoring multipliers.',
    Icon: Flame,
    iconColor: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.12)',
  },
  {
    id: 'snakeDraft',
    name: 'Snake Draft',
    subtitle: '4-Player Serpentine Draft',
    description: 'Draft 9 assets in snake order against 3 opponents. Daily scoring resets keep every trading day competitive. The best strategists dominate the leaderboard.',
    Icon: TrendingUp,
    iconColor: '#34d399',
    accentBg: 'rgba(52,211,153,0.12)',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function GamesModal({
  isOpen,
  onClose,
  setShowBaggerBombModal,
  setShowSnakeDraftModal,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
}) {
  const { tokens } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / GAME_MODES.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, GAME_MODES.length - 1));
  }, []);

  const handleLobby = (gameId) => {
    onClose();
    if (gameId === 'baggerbomb') setShowBaggerBombModal(true);
    if (gameId === 'snakeDraft') setShowSnakeDraftModal(true);
  };

  const handleTraining = (gameId) => {
    onClose();
    if (gameId === 'baggerbomb') setShowBaggerBombTrainingConfirm(true);
    if (gameId === 'snakeDraft') {
      setTrainingConfirmType('stocks');
      setShowTrainingConfirmModal(true);
    }
  };

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
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
              <div style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: tokens.textFaintest,
              }} />
            </div>

            {/* Header */}
            <div style={{ position: 'relative', padding: '16px 0 12px', textAlign: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: '600', color: tokens.textPrimary }}>
                Games
              </span>
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '14px',
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

            {/* Carousel */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gap: '16px',
                padding: '4px 7.5% 0',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              {GAME_MODES.map((game) => (
                <div
                  key={game.id}
                  style={{
                    minWidth: '85%',
                    maxWidth: '85%',
                    scrollSnapAlign: 'center',
                    flexShrink: 0,
                    background: tokens.bgCard,
                    border: `1px solid ${tokens.borderDefault}`,
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '8px',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: tokens.bgIcon,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <game.Icon size={32} color={game.iconColor} />
                  </div>

                  {/* Name + subtitle */}
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: tokens.textPrimary,
                    marginTop: '16px',
                  }}>
                    {game.name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: tokens.textMuted,
                    marginTop: '4px',
                  }}>
                    {game.subtitle}
                  </div>

                  {/* Description */}
                  <div style={{
                    fontSize: '14px',
                    color: tokens.textSecondary,
                    lineHeight: 1.5,
                    marginTop: '12px',
                  }}>
                    {game.description}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
                    <motion.button
                      onClick={() => handleLobby(game.id)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '14px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        background: game.accentBg,
                        color: game.iconColor,
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <Users size={18} />
                      Go to Lobby
                    </motion.button>

                    <motion.button
                      onClick={() => handleTraining(game.id)}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '14px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        background: tokens.bgIcon,
                        color: tokens.textSecondary,
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <Bot size={18} />
                      Play vs AI
                    </motion.button>

                    {/* TODO: Wire to scoring rules modal */}
                    <button
                      onClick={() => {}}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'transparent',
                        color: tokens.textFaint,
                        fontSize: '13px',
                        fontWeight: '400',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <BookOpen size={16} />
                      How to Score
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 0',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}>
              {GAME_MODES.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === activeIndex ? '8px' : '6px',
                    height: i === activeIndex ? '8px' : '6px',
                    borderRadius: '50%',
                    background: i === activeIndex ? tokens.teal : tokens.textFaintest,
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
