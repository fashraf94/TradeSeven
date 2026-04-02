// src/components/Forge/MechSVG.jsx
// Holographic wireframe mech rendered as inline SVG — visual centerpiece of the Mech Bay.
// Phase 1: static mech frame with state-driven opacity/glow. Overlays come in Phase 2.

import React, { useMemo } from 'react';

const STATES = {
  dormant: { opacity: 0.3, glow: false, breathing: false },
  idle: { opacity: 1, glow: true, breathing: true },
  editing: { opacity: 0.8, glow: false, breathing: false },
  equipping: { opacity: 1, glow: true, breathing: false },
};

export default function MechSVG({ state = 'idle', size = 'hero', reducedMotion = false }) {
  const config = STATES[state] || STATES.idle;
  const animate = config.breathing && !reducedMotion;
  const isVisor = size === 'visor';

  const strokeColor = state === 'dormant' ? '#2A2D35' : '#E6EDF3';
  const visorColor = '#5EEAD4';

  const breathingStyle = animate ? {
    animation: 'mechBreathe 4s ease-in-out infinite',
  } : {};

  const keyframes = `
    @keyframes mechBreathe {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-4px); }
    }
  `;

  // Visor crop: only render the visor area
  if (isVisor) {
    return (
      <svg
        viewBox="30 55 140 40"
        width="120"
        height="50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {config.glow && (
          <defs>
            <filter id="visorGlowSmall" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <g
          opacity={config.opacity}
          filter={config.glow ? 'url(#visorGlowSmall)' : undefined}
          style={{ willChange: config.glow ? 'filter' : 'auto' }}
        >
          {/* Visor shape */}
          <path
            d="M60 70 L80 62 L120 62 L140 70 L120 78 L80 78 Z"
            stroke={visorColor}
            strokeWidth="2"
            fill="none"
          />
          {/* Visor inner detail */}
          <path
            d="M72 70 L85 65 L115 65 L128 70 L115 75 L85 75 Z"
            stroke={visorColor}
            strokeWidth="1.5"
            fill={`${visorColor}15`}
          />
          {/* Visor center dot */}
          <circle cx="100" cy="70" r="3" fill={visorColor} opacity="0.8" />
        </g>
      </svg>
    );
  }

  // Hero mode: full mech body
  return (
    <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', ...breathingStyle }}>
      {!reducedMotion && animate && <style>{keyframes}</style>}
      <svg
        viewBox="0 0 200 280"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          {config.glow && (
            <filter id="visorGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          <radialGradient id="baseGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={visorColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={visorColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g id="mech-base-glow" opacity={config.opacity}>
          {/* Platform glow ellipse */}
          <ellipse cx="100" cy="260" rx="70" ry="12" fill="url(#baseGlow)" />
          {/* Platform ring */}
          <ellipse cx="100" cy="260" rx="55" ry="8" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" fill="none" opacity="0.5" />
        </g>

        <g id="mech-frame" opacity={config.opacity}>
          {/* Head dome */}
          <path
            d="M70 55 L80 40 L120 40 L130 55"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Head sides */}
          <line x1="70" y1="55" x2="70" y2="85" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="130" y1="55" x2="130" y2="85" stroke={strokeColor} strokeWidth="2.5" />
          {/* Jaw */}
          <path
            d="M70 85 L80 92 L120 92 L130 85"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Antenna */}
          <line x1="100" y1="40" x2="100" y2="28" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="100" cy="25" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />

          {/* Neck */}
          <line x1="88" y1="92" x2="85" y2="108" stroke={strokeColor} strokeWidth="2" />
          <line x1="112" y1="92" x2="115" y2="108" stroke={strokeColor} strokeWidth="2" />

          {/* Torso */}
          <path
            d="M65 108 L85 108 L115 108 L135 108 L130 165 L70 165 Z"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Torso center line */}
          <line x1="100" y1="108" x2="100" y2="165" stroke={strokeColor} strokeWidth="1" opacity="0.4" />
          {/* Chest detail */}
          <path d="M80 120 L100 115 L120 120" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M85 135 L100 130 L115 135" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />

          {/* Shoulders */}
          <path d="M65 108 L42 115 L38 125 L45 130" stroke={strokeColor} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M135 108 L158 115 L162 125 L155 130" stroke={strokeColor} strokeWidth="2.5" strokeLinejoin="round" />
          {/* Shoulder pads */}
          <rect x="35" y="112" width="18" height="10" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />
          <rect x="147" y="112" width="18" height="10" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Arms */}
          <line x1="45" y1="130" x2="48" y2="168" stroke={strokeColor} strokeWidth="2" />
          <line x1="155" y1="130" x2="152" y2="168" stroke={strokeColor} strokeWidth="2" />
          {/* Forearms */}
          <line x1="48" y1="168" x2="52" y2="200" stroke={strokeColor} strokeWidth="2" />
          <line x1="152" y1="168" x2="148" y2="200" stroke={strokeColor} strokeWidth="2" />
          {/* Elbow joints */}
          <circle cx="48" cy="168" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          <circle cx="152" cy="168" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          {/* Hands */}
          <rect x="45" y="200" width="14" height="12" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          <rect x="141" y="200" width="14" height="12" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />

          {/* Waist */}
          <path d="M75 165 L80 175 L120 175 L125 165" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />

          {/* Legs */}
          <line x1="82" y1="175" x2="78" y2="220" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="118" y1="175" x2="122" y2="220" stroke={strokeColor} strokeWidth="2.5" />
          {/* Knee joints */}
          <circle cx="78" cy="220" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          <circle cx="122" cy="220" r="4" stroke={strokeColor} strokeWidth="1.5" fill="none" />
          {/* Shins */}
          <line x1="78" y1="224" x2="76" y2="248" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="122" y1="224" x2="124" y2="248" stroke={strokeColor} strokeWidth="2.5" />
          {/* Feet */}
          <path d="M66 248 L76 248 L86 248 L88 258 L64 258 Z" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
          <path d="M112 248 L124 248 L134 248 L136 258 L110 258 Z" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
        </g>

        <g
          id="mech-visor"
          opacity={config.opacity}
          filter={config.glow ? 'url(#visorGlow)' : undefined}
          style={{ willChange: config.glow ? 'filter' : 'auto' }}
        >
          {/* Visor outer */}
          <path
            d="M74 68 L84 60 L116 60 L126 68 L116 76 L84 76 Z"
            stroke={visorColor}
            strokeWidth="2"
            fill="none"
          />
          {/* Visor inner */}
          <path
            d="M80 68 L88 63 L112 63 L120 68 L112 73 L88 73 Z"
            stroke={visorColor}
            strokeWidth="1.5"
            fill={`${visorColor}15`}
          />
          {/* Visor center dot */}
          <circle cx="100" cy="68" r="2.5" fill={visorColor} opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
