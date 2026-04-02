// src/components/Forge/MechSVG.jsx
// Holographic wireframe mech rendered as inline SVG — visual centerpiece of the Mech Bay.
// Phase 1: "The Soul" — soft geometry, visor expressions, reactive bounce animations.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

const STATES = {
  dormant: { opacity: 0.3, glow: false, breathing: false },
  idle: { opacity: 1, glow: true, breathing: true },
  editing: { opacity: 0.8, glow: false, breathing: false },
  equipping: { opacity: 1, glow: true, breathing: false },
};

export default function MechSVG({ state = 'idle', size = 'hero', reducedMotion = false, reactPulse = null }) {
  const config = STATES[state] || STATES.idle;
  const prefersReduced = useReducedMotion();
  const noMotion = reducedMotion || prefersReduced;
  const animate = config.breathing && !noMotion;
  const isVisor = size === 'visor';

  const strokeColor = state === 'dormant' ? '#2A2D35' : '#E6EDF3';
  const visorColor = '#5EEAD4';

  // ── Expression state ──
  const [expression, setExpression] = useState('idle');
  const [glowColorOverride, setGlowColorOverride] = useState(null);
  const activeVisorColor = glowColorOverride || visorColor;

  // ── Framer Motion controls for reactive bounce ──
  const mechControls = useAnimation();
  const reactTimersRef = useRef([]);

  // ── Blink system: random blink every 5-8 seconds ──
  useEffect(() => {
    if (noMotion || state === 'dormant') return;
    const timers = [];

    const scheduleBlink = () => {
      const delay = 5000 + Math.random() * 3000;
      const scheduleId = setTimeout(() => {
        setExpression(prev => {
          if (prev !== 'idle') return prev; // don't interrupt overrides
          return 'blink';
        });
        const resetId = setTimeout(() => {
          setExpression(prev => (prev === 'blink' ? 'idle' : prev));
        }, 150);
        timers.push(resetId);
        scheduleBlink();
      }, delay);
      timers.push(scheduleId);
    };

    scheduleBlink();
    return () => timers.forEach(clearTimeout);
  }, [noMotion, state]);

  // Reset expression when entering dormant
  useEffect(() => {
    if (state === 'dormant') setExpression('idle');
  }, [state]);

  // ── Reactive pulse handler ──
  useEffect(() => {
    if (!reactPulse || noMotion) return;

    // Clear all existing timers from previous pulse
    reactTimersRef.current.forEach(clearTimeout);
    reactTimersRef.current = [];

    // Visor color flash
    if (reactPulse.color) {
      setGlowColorOverride(reactPulse.color);
      const colorTimer = setTimeout(() => setGlowColorOverride(null), 800);
      reactTimersRef.current.push(colorTimer);
    }

    if (reactPulse.type === 'ruleAdd') {
      mechControls.start({
        scale: [1, 1.05, 1],
        transition: { duration: 0.4, times: [0, 0.3, 1], ease: 'easeOut' },
      });
      setExpression('happy');
      const t = setTimeout(() => setExpression(prev => (prev === 'happy' ? 'idle' : prev)), 1500);
      reactTimersRef.current.push(t);
    } else if (reactPulse.type === 'equip') {
      mechControls.start({
        scale: [1, 1.08, 0.97, 1.02, 1],
        y: [0, -6, 0, -2, 0],
        transition: { duration: 0.8, times: [0, 0.2, 0.5, 0.7, 1], ease: 'easeOut' },
      });
      setExpression('happy');
      const t = setTimeout(() => setExpression(prev => (prev === 'happy' ? 'idle' : prev)), 1500);
      reactTimersRef.current.push(t);
    } else if (reactPulse.type === 'ruleRemove') {
      mechControls.start({
        x: [0, -2, 2, -1, 0],
        transition: { duration: 0.3, ease: 'easeOut' },
      });
    }

    return () => {
      reactTimersRef.current.forEach(clearTimeout);
      reactTimersRef.current = [];
    };
  }, [reactPulse]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Breathing CSS ──
  const breathingStyle = animate
    ? { animation: 'mechBreathe 4s ease-in-out infinite' }
    : {};

  const keyframes = `
    @keyframes mechBreathe {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-4px); }
    }
  `;

  // ── Expression opacity helper ──
  const exprOpacity = useCallback(
    (target) => {
      if (state === 'dormant') return 0;
      return expression === target ? 1 : 0;
    },
    [expression, state],
  );

  const transitionStyle = noMotion ? {} : { transition: 'opacity 0.15s ease' };
  const visorTransitionStyle = noMotion
    ? {}
    : { transition: 'stroke 0.8s ease, fill 0.8s ease' };

  // ── Visor crop mode ──
  if (isVisor) {
    return (
      <svg
        viewBox="70 52 60 32"
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
          {/* Eye sockets */}
          <ellipse cx="88" cy="64" rx="9" ry="7" fill="none" stroke="#E6EDF3" strokeWidth="1.5" opacity="0.4" />
          <ellipse cx="112" cy="64" rx="9" ry="7" fill="none" stroke="#E6EDF3" strokeWidth="1.5" opacity="0.4" />
          {/* Eye pupils */}
          <circle cx="88" cy="64" r="3" fill={visorColor} opacity="0.9" />
          <circle cx="112" cy="64" r="3" fill={visorColor} opacity="0.9" />
          {/* Mouth */}
          <line x1="95" y1="76" x2="105" y2="76" stroke={visorColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </g>
      </svg>
    );
  }

  // ── Hero mode: full mech body ──
  return (
    <div style={{ width: '100%', maxWidth: 280, margin: '0 auto', ...breathingStyle }}>
      {!noMotion && animate && <style>{keyframes}</style>}
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
          {config.glow && (
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
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

        <motion.g animate={mechControls}>
          <g id="mech-base-glow" opacity={config.opacity}>
            {/* Platform glow ellipse */}
            <ellipse cx="100" cy="260" rx="70" ry="12" fill="url(#baseGlow)" />
            {/* Platform ring */}
            <ellipse
              cx="100" cy="260" rx="55" ry="8"
              stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3"
              fill="none" opacity="0.5"
            />
          </g>

          <g id="mech-frame" opacity={config.opacity} strokeLinecap="round" strokeLinejoin="round">
            {/* ── Head (scaled 1.08x from center) ── */}
            <g id="mech-head" transform="translate(100, 56) scale(1.08) translate(-100, -56)">
              {/* Head dome */}
              <path
                d="M70 55 L80 40 L120 40 L130 55"
                stroke={strokeColor}
                strokeWidth="2.5"
              />
              {/* Head sides */}
              <line x1="70" y1="55" x2="70" y2="85" stroke={strokeColor} strokeWidth="2.5" />
              <line x1="130" y1="55" x2="130" y2="85" stroke={strokeColor} strokeWidth="2.5" />
              {/* Jaw */}
              <path
                d="M70 85 L80 92 L120 92 L130 85"
                stroke={strokeColor}
                strokeWidth="2"
              />
              {/* Antenna */}
              <line x1="100" y1="40" x2="100" y2="28" stroke={strokeColor} strokeWidth="1.5" />
              <circle cx="100" cy="25" r="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            </g>

            {/* Neck */}
            <line x1="88" y1="92" x2="85" y2="108" stroke={strokeColor} strokeWidth="2" />
            <line x1="112" y1="92" x2="115" y2="108" stroke={strokeColor} strokeWidth="2" />

            {/* Torso */}
            <path
              d="M65 108 L85 108 L115 108 L135 108 L130 165 L70 165 Z"
              stroke={strokeColor}
              strokeWidth="2.5"
            />
            {/* Torso center line */}
            <line x1="100" y1="108" x2="100" y2="165" stroke={strokeColor} strokeWidth="1" opacity="0.4" />
            {/* Chest detail */}
            <path d="M80 120 L100 115 L120 120" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M85 135 L100 130 L115 135" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />

            {/* Power Core — chest diamond */}
            <path
              d="M100 122 L108 130 L100 138 L92 130 Z"
              stroke={strokeColor}
              strokeWidth="1.5"
              fill="rgba(94,234,212,0.08)"
              opacity="0.6"
              filter={config.glow ? 'url(#coreGlow)' : undefined}
            />

            {/* Shoulders */}
            <path d="M65 108 L42 115 L38 125 L45 130" stroke={strokeColor} strokeWidth="2.5" />
            <path d="M135 108 L158 115 L162 125 L155 130" stroke={strokeColor} strokeWidth="2.5" />
            {/* Shoulder pads */}
            <rect x="35" y="112" width="18" height="10" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />
            <rect x="147" y="112" width="18" height="10" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />

            {/* Arms */}
            <line x1="45" y1="130" x2="48" y2="168" stroke={strokeColor} strokeWidth="2" />
            <line x1="155" y1="130" x2="152" y2="168" stroke={strokeColor} strokeWidth="2" />
            {/* Forearms */}
            <line x1="48" y1="168" x2="52" y2="200" stroke={strokeColor} strokeWidth="2" />
            <line x1="152" y1="168" x2="148" y2="200" stroke={strokeColor} strokeWidth="2" />
            {/* Elbow joints — with energy fill */}
            <circle cx="48" cy="168" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
            <circle cx="152" cy="168" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
            {/* Hands */}
            <rect x="45" y="200" width="14" height="12" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />
            <rect x="141" y="200" width="14" height="12" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" />

            {/* Waist */}
            <path d="M75 165 L80 175 L120 175 L125 165" stroke={strokeColor} strokeWidth="2" />

            {/* Legs */}
            <line x1="82" y1="175" x2="78" y2="220" stroke={strokeColor} strokeWidth="2.5" />
            <line x1="118" y1="175" x2="122" y2="220" stroke={strokeColor} strokeWidth="2.5" />
            {/* Knee joints — with energy fill */}
            <circle cx="78" cy="220" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
            <circle cx="122" cy="220" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
            {/* Shins */}
            <line x1="78" y1="224" x2="76" y2="248" stroke={strokeColor} strokeWidth="2.5" />
            <line x1="122" y1="224" x2="124" y2="248" stroke={strokeColor} strokeWidth="2.5" />
            {/* Feet */}
            <path d="M66 248 L76 248 L86 248 L88 258 L64 258 Z" stroke={strokeColor} strokeWidth="2" />
            <path d="M112 248 L124 248 L134 248 L136 258 L110 258 Z" stroke={strokeColor} strokeWidth="2" />
          </g>

          {/* ── Face with expression system ── */}
          <g
            id="mech-visor"
            opacity={config.opacity}
            filter={config.glow ? 'url(#visorGlow)' : undefined}
            style={{ willChange: config.glow ? 'filter' : 'auto' }}
          >
            <g id="mech-face">

              {/* ===== LEFT EYE ===== */}
              <g id="eye-left">
                {/* Eye socket — always visible face frame */}
                <ellipse cx="88" cy="64" rx="9" ry="7"
                  fill="none" stroke={strokeColor} strokeWidth="1.5" opacity="0.4"
                />
                {/* Idle: round pupil */}
                <g opacity={exprOpacity('idle')} style={transitionStyle}>
                  <circle cx="88" cy="64" r="4"
                    fill={activeVisorColor} opacity="0.9"
                    style={visorTransitionStyle}
                  />
                </g>
                {/* Blink: squished to thin line */}
                <g opacity={exprOpacity('blink')} style={noMotion ? {} : { transition: 'opacity 0.08s ease' }}>
                  <ellipse cx="88" cy="64" rx="5" ry="0.8"
                    fill={activeVisorColor} opacity="0.9"
                  />
                </g>
                {/* Happy: upward arc ^ */}
                <g opacity={exprOpacity('happy')} style={transitionStyle}>
                  <path d="M83 66 Q88 59 93 66"
                    stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round"
                    fill="none" style={visorTransitionStyle}
                  />
                </g>
                {/* Thinking: shifted-up smaller pupil */}
                <g opacity={exprOpacity('thinking')} style={transitionStyle}>
                  <circle cx="88" cy="62" r="3"
                    fill={activeVisorColor} opacity="0.7"
                    style={visorTransitionStyle}
                  />
                </g>
              </g>

              {/* ===== RIGHT EYE ===== */}
              <g id="eye-right">
                {/* Eye socket — always visible face frame */}
                <ellipse cx="112" cy="64" rx="9" ry="7"
                  fill="none" stroke={strokeColor} strokeWidth="1.5" opacity="0.4"
                />
                {/* Idle: round pupil */}
                <g opacity={exprOpacity('idle')} style={transitionStyle}>
                  <circle cx="112" cy="64" r="4"
                    fill={activeVisorColor} opacity="0.9"
                    style={visorTransitionStyle}
                  />
                </g>
                {/* Blink: squished to thin line */}
                <g opacity={exprOpacity('blink')} style={noMotion ? {} : { transition: 'opacity 0.08s ease' }}>
                  <ellipse cx="112" cy="64" rx="5" ry="0.8"
                    fill={activeVisorColor} opacity="0.9"
                  />
                </g>
                {/* Happy: upward arc ^ */}
                <g opacity={exprOpacity('happy')} style={transitionStyle}>
                  <path d="M107 66 Q112 59 117 66"
                    stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round"
                    fill="none" style={visorTransitionStyle}
                  />
                </g>
                {/* Thinking: shifted-up smaller pupil */}
                <g opacity={exprOpacity('thinking')} style={transitionStyle}>
                  <circle cx="112" cy="62" r="3"
                    fill={activeVisorColor} opacity="0.7"
                    style={visorTransitionStyle}
                  />
                </g>
              </g>

              {/* ===== MOUTH ===== */}
              <g id="mech-mouth">
                {/* Neutral: small horizontal line */}
                <g opacity={expression === 'idle' || expression === 'blink' || expression === 'thinking' ? (state === 'dormant' ? 0 : 1) : 0}
                   style={transitionStyle}>
                  <line x1="95" y1="76" x2="105" y2="76"
                    stroke={activeVisorColor} strokeWidth="1.5" strokeLinecap="round"
                    opacity="0.5" style={visorTransitionStyle}
                  />
                </g>
                {/* Happy: upward smile curve */}
                <g opacity={exprOpacity('happy')} style={transitionStyle}>
                  <path d="M93 74 Q100 80 107 74"
                    stroke={activeVisorColor} strokeWidth="2" strokeLinecap="round"
                    fill="none" opacity="0.7" style={visorTransitionStyle}
                  />
                </g>
              </g>

            </g>
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
