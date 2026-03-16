// /src/components/Dashboard/GamesModal.jsx
// Centered overlay modal with swipeable game mode card carousel
// Each card: premium color-tinted bg, icon with gradient glow, description, action buttons

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Users, Bot, BookOpen } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import CenteredModal from '../shared/CenteredModal';

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
    cardBg: 'linear-gradient(135deg, #1a1508 0%, #110d03 100%)',
    borderColor: 'rgba(245,158,11,0.3)',
    glowShadow: '0 0 20px rgba(245,158,11,0.1)',
    iconGradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    iconGlow: '0 4px 15px rgba(220,38,38,0.4)',
  },
  {
    id: 'snakeDraft',
    name: 'Snake Draft',
    subtitle: '4-Player Serpentine Draft',
    description: 'Draft 9 assets in snake order against 3 opponents. Daily scoring resets keep every trading day competitive. The best strategists dominate the leaderboard.',
    Icon: TrendingUp,
    iconColor: '#34d399',
    accentBg: 'rgba(52,211,153,0.12)',
    cardBg: 'linear-gradient(135deg, #091a10 0%, #040f08 100%)',
    borderColor: 'rgba(52,211,153,0.3)',
    glowShadow: '0 0 20px rgba(52,211,153,0.1)',
    iconGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    iconGlow: '0 4px 15px rgba(16,185,129,0.4)',
  },
];

// ─── Decorative SVGs ─────────────────────────────────────────────────────────

function ExplosionSvg() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{
      position: 'absolute', right: '-5px', bottom: '-5px', opacity: 0.08, pointerEvents: 'none',
    }}>
      <polygon
        points="50,5 61,35 95,35 67,55 78,90 50,70 22,90 33,55 5,35 39,35"
        fill="#f97316"
      />
      <circle cx="30" cy="25" r="3" fill="#dc2626" opacity="0.8" />
      <circle cx="70" cy="30" r="2" fill="#f97316" opacity="0.6" />
      <circle cx="75" cy="70" r="2.5" fill="#dc2626" opacity="0.7" />
    </svg>
  );
}

function SnakeSvg() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{
      position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.08, pointerEvents: 'none',
    }}>
      <path
        d="M10,60 Q30,30 50,60 T90,60"
        stroke="#10b981"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="90" cy="60" r="6" fill="#10b981" />
      <circle cx="86" cy="56" r="2" fill="white" />
      <circle cx="86" cy="64" r="2" fill="white" />
    </svg>
  );
}

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
    <CenteredModal isOpen={isOpen} onClose={onClose} title="Games">
            {/* Carousel */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                gap: '16px',
                padding: '4px 7.5% 8px',
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
                    position: 'relative',
                    minWidth: '85%',
                    maxWidth: '85%',
                    scrollSnapAlign: 'center',
                    flexShrink: 0,
                    background: game.cardBg,
                    border: `1px solid ${game.borderColor}`,
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: `${tokens.obsidianShadow}, ${game.glowShadow}`,
                    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Decorative SVG */}
                  {game.id === 'baggerbomb' ? <ExplosionSvg /> : <SnakeSvg />}

                  {/* Icon */}
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '18px',
                    background: game.iconGradient,
                    boxShadow: game.iconGlow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    <game.Icon size={36} color="#fff" />
                  </div>

                  {/* Name + subtitle */}
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: tokens.textPrimary,
                    marginTop: '16px',
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {game.name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: game.iconColor,
                    marginTop: '4px',
                    fontWeight: '500',
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {game.subtitle}
                  </div>

                  {/* Description */}
                  <div style={{
                    fontSize: '14px',
                    color: tokens.textSecondary,
                    lineHeight: 1.5,
                    marginTop: '12px',
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {game.description}
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '20px',
                    position: 'relative',
                    zIndex: 1,
                  }}>
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
              padding: '12px 0 20px',
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
    </CenteredModal>
  );
}
