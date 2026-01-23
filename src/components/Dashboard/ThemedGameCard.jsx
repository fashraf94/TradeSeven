// /src/components/Dashboard/ThemedGameCard.jsx
// Themed game cards with unique visual elements and subtle animations

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Trophy, Swords, Target, Hammer, Bomb } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Game theme configurations
const GAME_THEMES = {
  snakeDraft: {
    primary: '#10b981',
    secondary: '#059669',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    icon: TrendingUp,
    emoji: '🐍',
    pattern: 'snake',
  },
  builder: {
    primary: '#00ffff',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #00ffff 0%, #06b6d4 100%)',
    glowColor: 'rgba(0, 255, 255, 0.4)',
    icon: Hammer,
    emoji: '🏗️',
    pattern: 'construction',
  },
  baggerBomb: {
    primary: '#dc2626',
    secondary: '#f97316',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    glowColor: 'rgba(220, 38, 38, 0.4)',
    icon: Bomb,
    emoji: '💣',
    pattern: 'explosion',
  },
  optionsArena: {
    primary: '#10b981',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    icon: Target,
    emoji: '🎯',
    pattern: 'target',
  },
  training: {
    primary: '#8b5cf6',
    secondary: '#6d28d9',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    icon: Trophy,
    emoji: '🎓',
    pattern: 'training',
  },
};

// Background patterns for each theme
const BackgroundPattern = ({ theme, isHovered }) => {
  const patterns = {
    snake: (
      <svg
        style={{
          position: 'absolute',
          right: -10,
          bottom: -10,
          width: '120px',
          height: '120px',
          opacity: isHovered ? 0.15 : 0.08,
          transition: 'opacity 0.3s ease',
        }}
        viewBox="0 0 100 100"
      >
        {/* Snake path */}
        <path
          d="M10,50 Q30,20 50,50 T90,50"
          fill="none"
          stroke={GAME_THEMES.snakeDraft.primary}
          strokeWidth="8"
          strokeLinecap="round"
          style={{
            animation: isHovered ? 'snakeSlither 2s ease-in-out infinite' : 'none',
          }}
        />
        <circle cx="90" cy="50" r="6" fill={GAME_THEMES.snakeDraft.primary} />
        <circle cx="86" cy="46" r="2" fill="#fff" />
        <circle cx="86" cy="54" r="2" fill="#fff" />
      </svg>
    ),
    construction: (
      <svg
        style={{
          position: 'absolute',
          right: -5,
          bottom: -5,
          width: '100px',
          height: '100px',
          opacity: isHovered ? 0.15 : 0.08,
          transition: 'opacity 0.3s ease',
        }}
        viewBox="0 0 100 100"
      >
        {/* Crane arm */}
        <line
          x1="20" y1="80" x2="20" y2="20"
          stroke={GAME_THEMES.builder.primary}
          strokeWidth="6"
        />
        <line
          x1="20" y1="20" x2="80" y2="20"
          stroke={GAME_THEMES.builder.primary}
          strokeWidth="4"
          style={{
            transformOrigin: '20px 20px',
            animation: isHovered ? 'craneSwing 3s ease-in-out infinite' : 'none',
          }}
        />
        {/* Building blocks */}
        <rect x="50" y="60" width="20" height="20" fill={GAME_THEMES.builder.secondary} opacity="0.6" />
        <rect x="55" y="45" width="15" height="15" fill={GAME_THEMES.builder.primary} opacity="0.4" />
      </svg>
    ),
    explosion: (
      <svg
        style={{
          position: 'absolute',
          right: -5,
          bottom: -5,
          width: '100px',
          height: '100px',
          opacity: isHovered ? 0.2 : 0.1,
          transition: 'opacity 0.3s ease',
        }}
        viewBox="0 0 100 100"
      >
        {/* Explosion burst */}
        <polygon
          points="50,10 60,40 90,40 65,60 75,90 50,70 25,90 35,60 10,40 40,40"
          fill={GAME_THEMES.baggerBomb.secondary}
          style={{
            transformOrigin: '50px 50px',
            animation: isHovered ? 'explosionPulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
        {/* Spark particles */}
        <circle cx="30" cy="25" r="3" fill={GAME_THEMES.baggerBomb.primary} opacity="0.8" />
        <circle cx="70" cy="30" r="2" fill={GAME_THEMES.baggerBomb.secondary} opacity="0.6" />
        <circle cx="75" cy="70" r="2.5" fill={GAME_THEMES.baggerBomb.primary} opacity="0.7" />
      </svg>
    ),
    target: (
      <svg
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '90px',
          height: '90px',
          opacity: isHovered ? 0.15 : 0.08,
          transition: 'opacity 0.3s ease',
        }}
        viewBox="0 0 100 100"
      >
        {/* Target rings */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={GAME_THEMES.optionsArena.primary}
          strokeWidth="3"
          style={{
            transformOrigin: '50px 50px',
            animation: isHovered ? 'targetPulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <circle cx="50" cy="50" r="25" fill="none" stroke={GAME_THEMES.optionsArena.secondary} strokeWidth="3" />
        <circle cx="50" cy="50" r="10" fill={GAME_THEMES.optionsArena.primary} />
      </svg>
    ),
    training: (
      <svg
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '80px',
          height: '80px',
          opacity: isHovered ? 0.15 : 0.08,
          transition: 'opacity 0.3s ease',
        }}
        viewBox="0 0 100 100"
      >
        {/* Graduation cap */}
        <polygon points="50,20 10,45 50,70 90,45" fill={GAME_THEMES.training.primary} />
        <rect x="45" y="45" width="10" height="25" fill={GAME_THEMES.training.secondary} />
        <line x1="80" y1="45" x2="80" y2="75" stroke={GAME_THEMES.training.primary} strokeWidth="3" />
        <circle cx="80" cy="78" r="5" fill={GAME_THEMES.training.secondary} />
      </svg>
    ),
  };

  return patterns[theme] || null;
};

// CSS keyframe animations
const AnimationStyles = () => (
  <style>{`
    @keyframes snakeSlither {
      0%, 100% { transform: translateX(0) scaleX(1); }
      25% { transform: translateX(3px) scaleX(1.02); }
      75% { transform: translateX(-3px) scaleX(0.98); }
    }

    @keyframes craneSwing {
      0%, 100% { transform: rotate(-8deg); }
      50% { transform: rotate(8deg); }
    }

    @keyframes explosionPulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.1); opacity: 1; }
    }

    @keyframes targetPulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.05); opacity: 1; }
    }

    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 0 20px var(--glow-color-20); }
      50% { box-shadow: 0 0 35px var(--glow-color-35); }
    }

    @keyframes fuseSpark {
      0%, 100% { opacity: 1; filter: brightness(1); }
      50% { opacity: 0.7; filter: brightness(1.4); }
    }
  `}</style>
);

// Main ThemedGameCard component
export default function ThemedGameCard({
  theme = 'snakeDraft',
  title,
  description,
  duration,
  onClick,
  index = 0,
  isTraining = false,
  customIcon,
  customEmoji,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const themeConfig = GAME_THEMES[theme] || GAME_THEMES.snakeDraft;
  const Icon = customIcon || themeConfig.icon;
  const emoji = customEmoji || themeConfig.emoji;

  return (
    <>
      <AnimationStyles />
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          flex: '0 0 auto',
          width: 'calc(85vw - 32px)',
          maxWidth: '320px',
          minWidth: '260px',
          scrollSnapAlign: 'start',
          background: HOLO_COLORS.bgCard,
          borderRadius: '16px',
          border: `1px solid ${isHovered ? themeConfig.primary : HOLO_COLORS.borderSubtle}`,
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isHovered ? `0 0 30px ${themeConfig.glowColor}` : 'none',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
          '--glow-color-20': `${themeConfig.primary}33`,
          '--glow-color-35': `${themeConfig.primary}55`,
        }}
      >
        {/* Background pattern */}
        <BackgroundPattern theme={themeConfig.pattern} isHovered={isHovered} />

        {/* Icon with gradient background */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: themeConfig.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: `0 4px 15px ${themeConfig.glowColor}`,
          position: 'relative',
          zIndex: 1,
        }}>
          {emoji ? (
            <span style={{ fontSize: '28px' }}>{emoji}</span>
          ) : (
            <Icon size={28} color="#fff" />
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: HOLO_COLORS.textPrimary,
          marginBottom: '6px',
          position: 'relative',
          zIndex: 1,
        }}>
          {title}
          {isTraining && (
            <span style={{
              marginLeft: '8px',
              padding: '2px 6px',
              background: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              color: '#a78bfa',
              textTransform: 'uppercase',
            }}>
              Training
            </span>
          )}
        </div>

        {/* Description */}
        <div style={{
          fontSize: '13px',
          color: HOLO_COLORS.textSecondary,
          marginBottom: duration ? '12px' : '0',
          lineHeight: '1.4',
          position: 'relative',
          zIndex: 1,
        }}>
          {description}
        </div>

        {/* Duration badge */}
        {duration && (
          <div style={{
            fontSize: '12px',
            color: themeConfig.primary,
            fontWeight: '600',
            position: 'relative',
            zIndex: 1,
          }}>
            {duration}
          </div>
        )}

        {/* Subtle animated glow effect on hover */}
        {isHovered && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 30% 30%, ${themeConfig.primary}10 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />
        )}
      </motion.div>
    </>
  );
}

// Export theme configs for external use
export { GAME_THEMES };
