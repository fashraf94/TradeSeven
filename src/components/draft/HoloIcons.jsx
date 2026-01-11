import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * HoloIcons - Styled SVG icons matching the holographic theme
 * Phase 5.6: Polish emojis with consistent styled icons
 */

// Styled icon wrapper for consistent sizing and glow
const IconWrapper = ({ children, size = 16, color = HOLO_COLORS.cyan, glow = false }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${size * 0.85}px`,
    filter: glow ? `drop-shadow(0 0 4px ${color})` : 'none',
  }}>
    {children}
  </span>
);

// User/Squad icon
export const UserIcon = ({ size = 16, color = HOLO_COLORS.cyan }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" fill="none"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  </IconWrapper>
);

// Trophy icon for Top Performers
export const TrophyIcon = ({ size = 16, color = HOLO_COLORS.gold }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 7H4a1 1 0 00-1 1v1a3 3 0 003 3M17 7h3a1 1 0 011 1v1a3 3 0 01-3 3" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
);

// Swap/Refresh icon for Free Agency
export const SwapIcon = ({ size = 16, color = HOLO_COLORS.purple }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M4 12l4-4m0 0l4 4m-4-4v12" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 12l-4 4m0 0l-4-4m4 4V4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
);

// Scout/Radar icon
export const ScoutIcon = ({ size = 16, color = HOLO_COLORS.amber, animated = false }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} style={{
      animation: animated ? 'scoutRadarPulse 1.5s ease-in-out infinite' : 'none',
    }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3"/>
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6"/>
      <circle cx="12" cy="12" r="2" fill={color}/>
      <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  </IconWrapper>
);

// Fire icon for Best performer
export const FireIcon = ({ size = 14, color = HOLO_COLORS.green }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 22c4.5 0 7-3.5 7-8 0-3-2-5.5-4-7.5 0 2.5-1.5 4-3 4-1 0-2-.5-2-2 0-1 .5-2 1-3-3 1-6 5-6 8.5 0 4.5 2.5 8 7 8z"
        stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
);

// Snowflake/Ice icon for Worst performer
export const SnowflakeIcon = ({ size = 14, color = HOLO_COLORS.red }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </IconWrapper>
);

// Robot icon for CPU players
export const BotIcon = ({ size = 12, color = HOLO_COLORS.textMuted }) => (
  <IconWrapper size={size} color={color}>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect x="4" y="8" width="16" height="12" rx="2" stroke={color} strokeWidth="2" fill="none"/>
      <circle cx="9" cy="14" r="1.5" fill={color}/>
      <circle cx="15" cy="14" r="1.5" fill={color}/>
      <line x1="12" y1="4" x2="12" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="3" r="1" fill={color}/>
    </svg>
  </IconWrapper>
);

// Star icon for "YOU" indicator
export const StarIcon = ({ size = 10, color = HOLO_COLORS.cyan }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  </IconWrapper>
);

// Arrow up icon for rank changes
export const ArrowUpIcon = ({ size = 12, color = HOLO_COLORS.green }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
);

// Arrow down icon for rank changes
export const ArrowDownIcon = ({ size = 12, color = HOLO_COLORS.red }) => (
  <IconWrapper size={size} color={color} glow>
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </IconWrapper>
);

// Export CSS for animations (add to component that uses ScoutIcon with animated=true)
export const HoloIconAnimations = `
  @keyframes scoutRadarPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }
`;

export default {
  UserIcon,
  TrophyIcon,
  SwapIcon,
  ScoutIcon,
  FireIcon,
  SnowflakeIcon,
  BotIcon,
  StarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
};
