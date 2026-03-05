import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, Lock, Users, ChevronRight } from 'lucide-react';
// ─── Custom Snake Icon (matches Lucide style: 24x24 viewBox, stroke-based) ──
const SnakeIcon = ({ size = 24, color = 'currentColor', strokeWidth = 2 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Snake body - flowing S-curve */}
    <path d="M4 18 Q 4 14, 8 14 Q 12 14, 12 10 Q 12 6, 16 6 Q 20 6, 20 3" />
    {/* Snake head */}
    <circle cx="20" cy="3" r="1.5" fill={color} stroke="none" />
    {/* Snake tongue */}
    <path d="M21.5 2 L23 1" />
    <path d="M21.5 3.2 L23 3.8" />
    {/* Snake eye */}
    <circle cx="19.2" cy="2.5" r="0.5" fill="none" strokeWidth={strokeWidth * 0.8} />
    {/* Tail taper */}
    <path d="M4 18 Q 3 19.5, 2 20" />
  </svg>
);
// ─── Game Mode Configurations ───────────────────────────────────────────────
const GAME_MODES = {
  baggerbomb: {
    id: 'baggerbomb',
    title: 'BaggerBomb',
    description: '1v1 battle — Score points with breakout bonuses and explosive multipliers.',
    icon: Flame,
    accentColor: '#f59e0b',
    accentColorRgb: '245, 158, 11',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    bgIdle: 'linear-gradient(135deg, #1a1508 0%, #151005 50%, #110d03 100%)',
    bgHover: 'linear-gradient(135deg, #231c0a 0%, #1a1408 50%, #151005 100%)',
    glowIdle: '0 0 20px rgba(245, 158, 11, 0.2), 0 0 50px rgba(245, 158, 11, 0.06), 0 4px 16px rgba(0,0,0,0.5)',
    glowHover: '0 0 35px rgba(245, 158, 11, 0.5), 0 0 80px rgba(245, 158, 11, 0.18), 0 0 120px rgba(245, 158, 11, 0.06), 0 8px 28px rgba(0,0,0,0.5)',
    borderIdle: 'rgba(245, 158, 11, 0.3)',
    borderHover: 'rgba(245, 158, 11, 0.7)',
    playerCount: '1v1',
    enabled: true,
  },
  snakeDraft: {
    id: 'snakeDraft',
    title: 'Snake Draft',
    description: 'Draft 9 assets in snake order. Outsmart 3 opponents to climb the altitude map.',
    icon: SnakeIcon,
    accentColor: '#22c55e',
    accentColorRgb: '34, 197, 94',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
    bgIdle: 'linear-gradient(135deg, #091a10 0%, #06140b 50%, #040f08 100%)',
    bgHover: 'linear-gradient(135deg, #0d2316 0%, #091a10 50%, #06140b 100%)',
    glowIdle: '0 0 20px rgba(34, 197, 94, 0.2), 0 0 50px rgba(34, 197, 94, 0.06), 0 4px 16px rgba(0,0,0,0.5)',
    glowHover: '0 0 35px rgba(34, 197, 94, 0.5), 0 0 80px rgba(34, 197, 94, 0.18), 0 0 120px rgba(34, 197, 94, 0.06), 0 8px 28px rgba(0,0,0,0.5)',
    borderIdle: 'rgba(34, 197, 94, 0.3)',
    borderHover: 'rgba(34, 197, 94, 0.7)',
    playerCount: '4 Players',
    enabled: true,
  },
  optionsArena: {
    id: 'optionsArena',
    title: 'Options Arena',
    description: 'Pick strikes & expiries in synthetic options. Biggest P&L wins the arena.',
    icon: Target,
    accentColor: '#8b5cf6',
    accentColorRgb: '139, 92, 246',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    bgIdle: 'linear-gradient(135deg, #120e1e 0%, #0e0a18 50%, #0a0813 100%)',
    bgHover: 'linear-gradient(135deg, #181228 0%, #120e1e 50%, #0e0a18 100%)',
    glowIdle: '0 0 20px rgba(139, 92, 246, 0.2), 0 0 50px rgba(139, 92, 246, 0.06), 0 4px 16px rgba(0,0,0,0.5)',
    glowHover: '0 0 35px rgba(139, 92, 246, 0.5), 0 0 80px rgba(139, 92, 246, 0.18), 0 0 120px rgba(139, 92, 246, 0.06), 0 8px 28px rgba(0,0,0,0.5)',
    borderIdle: 'rgba(139, 92, 246, 0.3)',
    borderHover: 'rgba(139, 92, 246, 0.7)',
    playerCount: '1v1',
    enabled: false,
  },
};
// ─── Decorative Background Graphics (landscape) ────────────────────────────
const CardBackgroundGraphic = ({ mode, isHovered }) => {
  const opacity = isHovered ? 0.14 : 0.07;
  switch (mode.id) {
    case 'baggerbomb':
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', transition: 'opacity 0.4s ease', opacity }}>
          <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: '-40%', right: '-5%', width: '65%', height: '160%' }}>
            <polygon points="100,5 118,70 188,70 130,110 152,178 100,138 48,178 70,110 12,70 82,70" fill={mode.accentColor} />
          </svg>
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', bottom: '10%', right: '35%', width: '15%', height: '30%', opacity: 0.5 }}>
            <polygon points="50,5 60,38 95,38 65,58 75,90 50,70 25,90 35,58 5,38 40,38" fill={mode.accentColor} />
          </svg>
        </div>
      );
    case 'snakeDraft':
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', transition: 'opacity 0.4s ease', opacity }}>
          <svg viewBox="0 0 500 180" style={{ position: 'absolute', bottom: '-25%', left: '5%', width: '95%', height: '110%' }}>
            <path d="M 10 140 Q 70 30, 140 90 T 280 60 T 400 90 T 490 30" fill="none" stroke={mode.accentColor} strokeWidth="7" strokeLinecap="round" />
            <circle cx="490" cy="30" r="9" fill={mode.accentColor} />
          </svg>
        </div>
      );
    case 'optionsArena':
      return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', transition: 'opacity 0.4s ease', opacity: isHovered ? 0.16 : 0.08 }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '-15%',
            transform: 'translateY(-50%)',
            width: '70%',
            height: '220%',
            background: `conic-gradient(
              from 0deg,
              ${mode.accentColor} 0deg, transparent 12deg,
              transparent 30deg, ${mode.accentColor} 30deg, transparent 42deg,
              transparent 60deg, ${mode.accentColor} 60deg, transparent 72deg,
              transparent 90deg, ${mode.accentColor} 90deg, transparent 102deg,
              transparent 120deg, ${mode.accentColor} 120deg, transparent 132deg,
              transparent 150deg, ${mode.accentColor} 150deg, transparent 162deg,
              transparent 180deg, ${mode.accentColor} 180deg, transparent 192deg,
              transparent 210deg, ${mode.accentColor} 210deg, transparent 222deg,
              transparent 240deg, ${mode.accentColor} 240deg, transparent 252deg,
              transparent 270deg, ${mode.accentColor} 270deg, transparent 282deg,
              transparent 300deg, ${mode.accentColor} 300deg, transparent 312deg,
              transparent 330deg, ${mode.accentColor} 330deg, transparent 342deg,
              transparent 360deg
            )`,
            borderRadius: '50%',
          }} />
        </div>
      );
    default:
      return null;
  }
};
// ─── Single Game Card (Horizontal, Large) ───────────────────────────────────
const GameModeCard = ({ mode, onSelect, isTraining = false, isMobile = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = mode.icon;
  const isDisabled = !mode.enabled;
  // Bigger cards — fill more screen
  const cardWidth = isMobile ? 320 : 360;
  const cardHeight = isMobile ? 150 : 165;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isDisabled ? { scale: 1.03, y: -4 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onMouseEnter={() => !isDisabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDisabled && onSelect?.(mode.id, isTraining)}
      style={{
        position: 'relative',
        width: cardWidth,
        minWidth: cardWidth,
        height: cardHeight,
        borderRadius: 20,
        overflow: 'hidden',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        // Color-tinted dark background
        background: isHovered ? mode.bgHover : mode.bgIdle,
        // Neon border + glow aura
        border: `1.5px solid ${isHovered ? mode.borderHover : mode.borderIdle}`,
        boxShadow: isHovered ? mode.glowHover : mode.glowIdle,
        // Horizontal layout
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: isMobile ? '20px' : '22px 26px',
        gap: isMobile ? 18 : 22,
        transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      {/* Background graphic */}
      <CardBackgroundGraphic mode={mode} isHovered={isHovered} />
      {/* Top edge shine */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '8%',
        width: '84%',
        height: 1,
        background: `linear-gradient(90deg, transparent, rgba(${mode.accentColorRgb}, ${isHovered ? 0.55 : 0.2}), transparent)`,
        transition: 'all 0.35s ease',
      }} />
      {/* Radial vignette from left */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 0% 50%, rgba(${mode.accentColorRgb}, ${isHovered ? 0.06 : 0.03}) 0%, transparent 50%)`,
        pointerEvents: 'none',
        transition: 'background 0.35s ease',
      }} />
      {/* ── LEFT: Icon ── */}
      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <div style={{
          width: isMobile ? 68 : 76,
          height: isMobile ? 68 : 76,
          borderRadius: 18,
          background: mode.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isHovered
            ? `0 10px 28px rgba(${mode.accentColorRgb}, 0.5), 0 0 18px rgba(${mode.accentColorRgb}, 0.25), inset 0 1px 0 rgba(255,255,255,0.25)`
            : `0 6px 20px rgba(${mode.accentColorRgb}, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
          transition: 'box-shadow 0.35s ease',
        }}>
          <IconComponent size={isMobile ? 30 : 34} color="#ffffff" strokeWidth={2.2} />
        </div>
      </div>
      {/* ── RIGHT: Text + CTA ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
      }}>
        {/* Title row with player count pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{
            fontSize: isMobile ? 19 : 22,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: '#e6edf3',
            margin: 0,
            lineHeight: 1.2,
            textShadow: isHovered ? `0 0 20px rgba(${mode.accentColorRgb}, 0.45)` : 'none',
            transition: 'text-shadow 0.35s ease',
            whiteSpace: 'nowrap',
          }}>
            {mode.title}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            borderRadius: 8,
            background: `rgba(${mode.accentColorRgb}, 0.1)`,
            border: `1px solid rgba(${mode.accentColorRgb}, 0.15)`,
            flexShrink: 0,
          }}>
            <Users size={10} color={mode.accentColor} style={{ opacity: 0.7 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: mode.accentColor, opacity: 0.7, letterSpacing: '0.3px' }}>
              {mode.playerCount}
            </span>
          </div>
        </div>
        {/* Description */}
        <p style={{
          fontSize: isMobile ? 12 : 13,
          color: mode.accentColor,
          margin: 0,
          lineHeight: 1.5,
          fontWeight: 500,
        }}>
          {mode.description}
        </p>
        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: isHovered ? mode.accentColor : `rgba(${mode.accentColorRgb}, 0.7)`,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'color 0.3s ease',
          }}>
            {isTraining ? 'Practice' : 'Play Now'}
          </span>
          <ChevronRight
            size={15}
            color={isHovered ? mode.accentColor : `rgba(${mode.accentColorRgb}, 0.7)`}
            style={{
              transition: 'color 0.3s ease, transform 0.3s ease',
              transform: isHovered ? 'translateX(3px)' : 'translateX(0)',
            }}
          />
        </div>
      </div>
      {/* ── Coming Soon Overlay ── */}
      {isDisabled && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'rgba(10, 12, 16, 0.75)',
          borderRadius: 20,
        }}>
          <Lock size={22} color={mode.accentColor} style={{ opacity: 0.85 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: mode.accentColor, textTransform: 'uppercase', letterSpacing: '2px' }}>
            Coming Soon
          </span>
        </div>
      )}
      {/* ── Left edge accent bar ── */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: '15%',
        height: '70%',
        width: 2.5,
        borderRadius: 2,
        background: mode.gradient,
        opacity: isHovered ? 1 : 0.35,
        filter: isHovered ? 'blur(1px)' : 'none',
        transition: 'opacity 0.35s ease, filter 0.35s ease',
      }} />
    </motion.div>
  );
};
// ─── Carousel Container ─────────────────────────────────────────────────────
const GameModeCarousel = ({
  mode = 'pvp',
  onSelect,
  isMobile = false,
  colors = {},
}) => {
  // 3 game modes: BaggerBomb first, then Snake Draft, then Options Arena
  const modeOrder = ['baggerbomb', 'snakeDraft', 'optionsArena'];
  const isTraining = mode === 'train';
  return (
    <div style={{
      width: '100%',
      overflowX: 'auto',
      overflowY: 'visible',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      padding: '12px 0 16px 0',
    }}>
      <style>{`.mc-game-carousel::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="mc-game-carousel"
        style={{
          display: 'flex',
          gap: isMobile ? 14 : 18,
          paddingLeft: isMobile ? 16 : 24,
          paddingRight: isMobile ? 16 : 24,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        {modeOrder.map((key, index) => {
          const gameMode = GAME_MODES[key];
          if (!gameMode) return null;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            >
              <GameModeCard
                mode={gameMode}
                onSelect={onSelect}
                isTraining={isTraining}
                isMobile={isMobile}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
export { GAME_MODES, GameModeCard, SnakeIcon };
export default GameModeCarousel;
