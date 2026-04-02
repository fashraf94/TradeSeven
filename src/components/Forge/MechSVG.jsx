// src/components/Forge/MechSVG.jsx
// Holographic wireframe mech rendered as inline SVG — visual centerpiece of the Mech Bay.
// V2 chibi companion design with goggle eyes, barrel torso, heart power core.
// Phase 1 "The Soul": expressions, blink timer, reactive bounce, color flash.

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
          if (prev !== 'idle') return prev;
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

  // ── Visor crop mode (simplified static face for 70px strip) ──
  if (isVisor) {
    return (
      <svg
        viewBox="62 48 76 40"
        width="120"
        height="50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {config.glow && (
          <defs>
            <filter id="eyeGlowSmall" x="-50%" y="-50%" width="200%" height="200%">
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
          filter={config.glow ? 'url(#eyeGlowSmall)' : undefined}
          style={{ willChange: config.glow ? 'filter' : 'auto' }}
        >
          {/* Goggle rims */}
          <circle cx="82" cy="64" r="15" stroke="#E6EDF3" strokeWidth="3" fill="none" />
          <circle cx="118" cy="64" r="15" stroke="#E6EDF3" strokeWidth="3" fill="none" />
          {/* Iris pupils */}
          <circle cx="82" cy="64" r="5" fill={visorColor} opacity="0.85" />
          <circle cx="118" cy="64" r="5" fill={visorColor} opacity="0.85" />
          {/* Mouth */}
          <path d="M93 82 Q100 85 107 82" stroke={visorColor} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
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
            <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          {config.glow && (
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          {config.glow && (
            <filter id="antennaTipGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          <radialGradient id="platformGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={visorColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={visorColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.g animate={mechControls}>
          {/* ===== PLATFORM ===== */}
          <g id="platform" opacity={config.opacity}>
            <ellipse cx="100" cy="260" rx="60" ry="10" fill="url(#platformGlow)" />
            <ellipse cx="100" cy="260" rx="50" ry="7"
              stroke="#5EEAD4" strokeWidth="1" strokeDasharray="6 4"
              fill="none" opacity="0.5"
            />
          </g>

          {/* ===== ROBOT BODY ===== */}
          <g id="robot-body" opacity={config.opacity} strokeLinecap="round" strokeLinejoin="round">

            {/* ── LEGS ── */}
            <g id="legs">
              <g id="leg-left">
                <line x1="84" y1="178" x2="80" y2="210" stroke={strokeColor} strokeWidth="2.5" />
                <circle cx="80" cy="210" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
                <line x1="80" y1="214" x2="78" y2="240" stroke={strokeColor} strokeWidth="2.5" />
                <rect x="72" y="218" width="12" height="16" rx="3" stroke={strokeColor} strokeWidth="1.2" fill="none" opacity="0.5" />
                <path d="M66 240 L88 240 Q92 240 92 248 L92 252 Q92 258 86 258 L66 258 Q60 258 60 252 L60 244 Q60 240 66 240 Z"
                  stroke={strokeColor} strokeWidth="1.8" fill="none" />
              </g>
              <g id="leg-right">
                <line x1="116" y1="178" x2="120" y2="210" stroke={strokeColor} strokeWidth="2.5" />
                <circle cx="120" cy="210" r="4" stroke={strokeColor} strokeWidth="1.5" fill="rgba(94,234,212,0.15)" />
                <line x1="120" y1="214" x2="122" y2="240" stroke={strokeColor} strokeWidth="2.5" />
                <rect x="116" y="218" width="12" height="16" rx="3" stroke={strokeColor} strokeWidth="1.2" fill="none" opacity="0.5" />
                <path d="M112 240 L134 240 Q140 240 140 248 L140 252 Q140 258 134 258 L114 258 Q108 258 108 252 L108 244 Q108 240 112 240 Z"
                  stroke={strokeColor} strokeWidth="1.8" fill="none" />
              </g>
            </g>

            {/* ── TORSO ── */}
            <g id="torso">
              <rect x="72" y="118" width="56" height="55" rx="10" stroke={strokeColor} strokeWidth="2.2" fill="none" />
              <line x1="100" y1="118" x2="100" y2="173" stroke={strokeColor} strokeWidth="0.8" opacity="0.3" />
              <path d="M80 128 Q100 122 120 128" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />
              <circle cx="88" cy="155" r="1.5" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />
              <circle cx="94" cy="155" r="1.5" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />
              <line x1="112" y1="150" x2="122" y2="150" stroke={strokeColor} strokeWidth="0.8" opacity="0.3" />
              <line x1="112" y1="154" x2="120" y2="154" stroke={strokeColor} strokeWidth="0.8" opacity="0.3" />
              <rect x="70" y="168" width="60" height="8" rx="3" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.6" />
              <rect x="95" y="169" width="10" height="6" rx="1.5" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.5" />

              {/* POWER CORE — heart screen */}
              <g id="power-core">
                <rect x="91" y="133" width="18" height="15" rx="3"
                  stroke={strokeColor} strokeWidth="1.2" fill="rgba(94,234,212,0.06)" />
                <path d="M100 145 L96.5 141 Q94.5 138.5 96.5 137 Q98.5 135.5 100 138 Q101.5 135.5 103.5 137 Q105.5 138.5 103.5 141 Z"
                  stroke="#5EEAD4" strokeWidth="1" fill="rgba(94,234,212,0.3)"
                  filter={config.glow ? 'url(#coreGlow)' : undefined} />
              </g>
            </g>

            {/* ── ARMS ── */}
            <g id="arms">
              <g id="arm-left">
                <rect x="56" y="118" width="18" height="10" rx="4" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.7" />
                <line x1="65" y1="128" x2="58" y2="158" stroke={strokeColor} strokeWidth="2" />
                <circle cx="58" cy="158" r="3.5" stroke={strokeColor} strokeWidth="1.2" fill="rgba(94,234,212,0.15)" />
                <line x1="58" y1="162" x2="54" y2="190" stroke={strokeColor} strokeWidth="2" />
                <rect x="49" y="166" width="10" height="18" rx="3" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.5" />
                <path d="M48 190 L44 198 M52 190 L52 200 M56 190 L58 198" stroke={strokeColor} strokeWidth="1.5" />
                <path d="M46 190 Q52 192 58 190" stroke={strokeColor} strokeWidth="1.2" fill="none" />
              </g>
              <g id="arm-right">
                <rect x="126" y="118" width="18" height="10" rx="4" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.7" />
                <line x1="135" y1="128" x2="142" y2="155" stroke={strokeColor} strokeWidth="2" />
                <circle cx="142" cy="155" r="3.5" stroke={strokeColor} strokeWidth="1.2" fill="rgba(94,234,212,0.15)" />
                <line x1="142" y1="159" x2="148" y2="184" stroke={strokeColor} strokeWidth="2" />
                <rect x="143" y="162" width="10" height="16" rx="3" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.5" />
                <path d="M144 184 L140 176 M148 184 L148 174 M152 184 L156 177" stroke={strokeColor} strokeWidth="1.5" />
                <path d="M142 184 Q148 186 154 184" stroke={strokeColor} strokeWidth="1.2" fill="none" />
              </g>
            </g>

            {/* ── NECK ── */}
            <g id="neck">
              <line x1="90" y1="105" x2="88" y2="118" stroke={strokeColor} strokeWidth="1.8" />
              <line x1="110" y1="105" x2="112" y2="118" stroke={strokeColor} strokeWidth="1.8" />
              <ellipse cx="100" cy="112" rx="14" ry="3" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.4" />
            </g>

            {/* ── HEAD ── */}
            <g id="head">

              {/* HELMET */}
              <g id="helmet">
                <path d="M62 95 L62 55 Q62 18 100 18 Q138 18 138 55 L138 95 Q138 105 128 105 L72 105 Q62 105 62 95 Z"
                  stroke={strokeColor} strokeWidth="2.2" fill="none" />
                <path d="M68 46 Q100 28 132 46" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.2" />
                <path d="M62 52 L138 52" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.4" />
                <path d="M72 95 Q100 108 128 95" stroke={strokeColor} strokeWidth="1.5" fill="none" opacity="0.5" />
                <rect x="56" y="62" width="7" height="12" rx="2" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.35" />
                <rect x="137" y="62" width="7" height="12" rx="2" stroke={strokeColor} strokeWidth="1" fill="none" opacity="0.35" />
              </g>

              {/* ANTENNA */}
              <g id="antenna">
                <line x1="100" y1="18" x2="100" y2="8" stroke={strokeColor} strokeWidth="1.5" />
                <circle cx="100" cy="6" r="3"
                  stroke={state === 'dormant' ? strokeColor : activeVisorColor} strokeWidth="1.2"
                  fill={state === 'dormant' ? 'none' : `${activeVisorColor}66`}
                  filter={config.glow ? 'url(#antennaTipGlow)' : undefined}
                  style={visorTransitionStyle}
                />
                <circle cx="100" cy="18" r="2.5" stroke={strokeColor} strokeWidth="1" fill="none" />
              </g>

              {/* FACE */}
              <g id="face">
                {/* Goggle bridge */}
                <path d="M90 62 Q100 58 110 62" stroke={strokeColor} strokeWidth="2" fill="none" opacity="0.5" />

                {/* ===== LEFT EYE ===== */}
                <g id="eye-left">
                  <g id="eye-left-frame">
                    <circle cx="82" cy="64" r="15" stroke={strokeColor} strokeWidth="3" fill="none" />
                    <circle cx="82" cy="64" r="11" stroke={strokeColor} strokeWidth="0.8" fill="none" opacity="0.25" />
                  </g>
                  {/* Iris background — always visible when not dormant */}
                  <circle cx="82" cy="64" r="8"
                    fill={activeVisorColor} opacity={state === 'dormant' ? 0 : 0.15}
                    style={visorTransitionStyle}
                  />
                  <g id="eye-left-pupil">
                    {/* Idle: glowing iris + dark pupil */}
                    <g opacity={exprOpacity('idle')} style={transitionStyle}>
                      <circle cx="82" cy="64" r="6"
                        fill={activeVisorColor} opacity="0.85"
                        filter={config.glow ? 'url(#eyeGlow)' : undefined}
                        style={visorTransitionStyle}
                      />
                      <circle cx="82" cy="64" r="2.5" fill="#0D0E12" opacity="0.6" />
                    </g>
                    {/* Blink: squished thin line */}
                    <g opacity={exprOpacity('blink')} style={noMotion ? {} : { transition: 'opacity 0.08s ease' }}>
                      <ellipse cx="82" cy="64" rx="6" ry="0.8"
                        fill={activeVisorColor} opacity="0.9"
                      />
                    </g>
                    {/* Happy: upward arc ^ */}
                    <g opacity={exprOpacity('happy')} style={transitionStyle}>
                      <path d="M75 66 Q82 56 89 66"
                        stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round"
                        fill="none" style={visorTransitionStyle}
                      />
                    </g>
                    {/* Thinking: shifted-up smaller iris */}
                    <g opacity={exprOpacity('thinking')} style={transitionStyle}>
                      <circle cx="82" cy="61" r="4"
                        fill={activeVisorColor} opacity="0.7"
                        style={visorTransitionStyle}
                      />
                      <circle cx="82" cy="61" r="1.5" fill="#0D0E12" opacity="0.5" />
                    </g>
                  </g>
                </g>

                {/* ===== RIGHT EYE ===== */}
                <g id="eye-right">
                  <g id="eye-right-frame">
                    <circle cx="118" cy="64" r="15" stroke={strokeColor} strokeWidth="3" fill="none" />
                    <circle cx="118" cy="64" r="11" stroke={strokeColor} strokeWidth="0.8" fill="none" opacity="0.25" />
                  </g>
                  {/* Iris background */}
                  <circle cx="118" cy="64" r="8"
                    fill={activeVisorColor} opacity={state === 'dormant' ? 0 : 0.15}
                    style={visorTransitionStyle}
                  />
                  <g id="eye-right-pupil">
                    {/* Idle: glowing iris + dark pupil */}
                    <g opacity={exprOpacity('idle')} style={transitionStyle}>
                      <circle cx="118" cy="64" r="6"
                        fill={activeVisorColor} opacity="0.85"
                        filter={config.glow ? 'url(#eyeGlow)' : undefined}
                        style={visorTransitionStyle}
                      />
                      <circle cx="118" cy="64" r="2.5" fill="#0D0E12" opacity="0.6" />
                    </g>
                    {/* Blink: squished thin line */}
                    <g opacity={exprOpacity('blink')} style={noMotion ? {} : { transition: 'opacity 0.08s ease' }}>
                      <ellipse cx="118" cy="64" rx="6" ry="0.8"
                        fill={activeVisorColor} opacity="0.9"
                      />
                    </g>
                    {/* Happy: upward arc ^ */}
                    <g opacity={exprOpacity('happy')} style={transitionStyle}>
                      <path d="M111 66 Q118 56 125 66"
                        stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round"
                        fill="none" style={visorTransitionStyle}
                      />
                    </g>
                    {/* Thinking: shifted-up smaller iris */}
                    <g opacity={exprOpacity('thinking')} style={transitionStyle}>
                      <circle cx="118" cy="61" r="4"
                        fill={activeVisorColor} opacity="0.7"
                        style={visorTransitionStyle}
                      />
                      <circle cx="118" cy="61" r="1.5" fill="#0D0E12" opacity="0.5" />
                    </g>
                  </g>
                </g>

                {/* ===== MOUTH ===== */}
                <g id="mouth">
                  {/* Neutral: subtle smile — shown during idle, blink, thinking */}
                  <g opacity={expression === 'idle' || expression === 'blink' || expression === 'thinking' ? (state === 'dormant' ? 0 : 1) : 0}
                     style={transitionStyle}>
                    <path d="M93 82 Q100 85 107 82"
                      stroke={activeVisorColor} strokeWidth="1.5" strokeLinecap="round"
                      fill="none" opacity="0.5" style={visorTransitionStyle}
                    />
                  </g>
                  {/* Happy: bigger smile */}
                  <g opacity={exprOpacity('happy')} style={transitionStyle}>
                    <path d="M91 80 Q100 88 109 80"
                      stroke={activeVisorColor} strokeWidth="2" strokeLinecap="round"
                      fill="none" opacity="0.7" style={visorTransitionStyle}
                    />
                  </g>
                </g>

              </g>
            </g>

          </g>
        </motion.g>
      </svg>
    </div>
  );
}
