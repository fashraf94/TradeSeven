// src/components/Forge/MechSVG.jsx
// Holographic wireframe mech — Gemini V3 approved design.
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

  // ── Style helpers (Gemini CSS classes → dynamic inline) ──
  const wire = { stroke: strokeColor, fill: '#0D0E12', strokeWidth: 2.5 };
  const accent = {
    stroke: activeVisorColor, strokeWidth: 2.5, strokeLinecap: 'round',
    strokeLinejoin: 'round', fill: 'none',
    ...visorTransitionStyle,
  };
  const accentFill = {
    fill: activeVisorColor, stroke: 'none',
    ...visorTransitionStyle,
  };

  // ── Visor crop mode (simplified static face for 70px strip) ──
  if (isVisor) {
    return (
      <svg
        viewBox="60 32 80 50"
        width="120"
        height="50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {config.glow && (
          <defs>
            <filter id="eyeGlowSmall" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <g opacity={config.opacity}>
          {/* Head background */}
          <rect x="65" y="35" width="70" height="48" rx="14" fill="#0D0E12" stroke="#E6EDF3" strokeWidth="2.5" />
          {/* Goggle frames */}
          <rect x="70" y="44" width="27" height="22" rx="11" fill="#0D0E12" stroke="#E6EDF3" strokeWidth="2.5" />
          <rect x="103" y="44" width="27" height="22" rx="11" fill="#0D0E12" stroke="#E6EDF3" strokeWidth="2.5" />
          {/* Goggle bridge */}
          <line x1="97" y1="55" x2="103" y2="55" stroke="#E6EDF3" strokeWidth="3" />
          {/* Eyes */}
          <circle cx="83.5" cy="55" r="4" fill={visorColor} opacity="0.85"
            filter={config.glow ? 'url(#eyeGlowSmall)' : undefined} />
          <circle cx="116.5" cy="55" r="4" fill={visorColor} opacity="0.85"
            filter={config.glow ? 'url(#eyeGlowSmall)' : undefined} />
          {/* Highlights */}
          <circle cx="85" cy="53.5" r="1" fill="#FFFFFF" opacity="0.7" />
          <circle cx="118" cy="53.5" r="1" fill="#FFFFFF" opacity="0.7" />
          {/* Mouth */}
          <path d="M87 72 Q100 77 113 72" stroke={visorColor} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
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
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          {config.glow && (
            <filter id="teal-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          {config.glow && (
            <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        <motion.g animate={mechControls}>
          {/* ===== PLATFORM ===== */}
          <g id="platform" opacity={config.opacity}>
            <ellipse cx="100" cy="260" rx="65" ry="8"
              stroke="#5EEAD4" strokeWidth="1.5" strokeDasharray="6 6"
              fill="none" opacity="0.5"
            />
          </g>

          {/* ===== ROBOT BODY ===== */}
          <g id="robot-body" opacity={config.opacity}>

            {/* ── PLANT IN BOOT ── */}
            <g id="plant-in-boot">
              <path d="M148 260 L163 260 L163 253 L158 253 L158 245 L148 245 Z" style={{ ...wire, strokeWidth: 2 }} />
              <path d="M153 245 Q153 238 158 235" style={{ ...accent, strokeWidth: 2, fill: 'none' }} />
              <path d="M153 241 Q148 239 150 237 Q153 237 153 241" style={accentFill} />
              <path d="M156 238 Q161 236 160 233 Q156 234 156 238" style={accentFill} />
            </g>

            {/* ── ARMS (behind torso for layering) ── */}
            <g id="arms">
              {/* Left arm */}
              <rect x="45" y="95" width="20" height="12" rx="4" style={wire} />
              <rect x="48" y="107" width="14" height="35" rx="6" style={wire} />
              <circle cx="55" cy="146" r="6" style={wire} />
              <rect x="48" y="152" width="14" height="30" rx="6" style={wire} />
              <rect x="50" y="182" width="10" height="6" rx="2" style={wire} />
              <path d="M50 188 L45 200 L49 200 L53 188 Z" style={{ ...wire, strokeWidth: 2 }} />
              <path d="M60 188 L65 200 L61 200 L57 188 Z" style={{ ...wire, strokeWidth: 2 }} />
              {/* Right arm */}
              <rect x="135" y="95" width="20" height="12" rx="4" style={wire} />
              <rect x="138" y="107" width="14" height="35" rx="6" style={wire} />
              <circle cx="145" cy="146" r="6" style={wire} />
              <rect x="138" y="152" width="14" height="30" rx="6" style={wire} />
              <rect x="140" y="182" width="10" height="6" rx="2" style={wire} />
              <path d="M140 188 L135 200 L139 200 L143 188 Z" style={{ ...wire, strokeWidth: 2 }} />
              <path d="M150 188 L155 200 L151 200 L147 188 Z" style={{ ...wire, strokeWidth: 2 }} />
            </g>

            {/* ── LEGS (behind torso for layering) ── */}
            <g id="legs">
              {/* Left leg */}
              <rect x="73" y="170" width="10" height="35" rx="4" style={wire} />
              <circle cx="78" cy="209" r="6" style={wire} />
              <rect x="73" y="215" width="10" height="35" rx="4" style={wire} />
              <path d="M65 260 L91 260 L85 248 L71 248 Z" style={wire} />
              {/* Right leg */}
              <rect x="117" y="170" width="10" height="35" rx="4" style={wire} />
              <circle cx="122" cy="209" r="6" style={wire} />
              <rect x="117" y="215" width="10" height="35" rx="4" style={wire} />
              <path d="M109 260 L135 260 L129 248 L115 248 Z" style={wire} />
            </g>

            {/* ── TORSO (renders after arms/legs — fills hide what's behind) ── */}
            <g id="torso">
              {/* Neck (hidden behind torso barrel) */}
              <rect x="90" y="80" width="20" height="15" style={wire} />
              <line x1="93" y1="88" x2="107" y2="88" stroke={strokeColor} strokeWidth="1.5" />
              {/* Chest barrel */}
              <rect x="65" y="93" width="70" height="68" rx="10" style={wire} />
              {/* Belt */}
              <rect x="70" y="161" width="60" height="14" rx="4" style={wire} />
              {/* Chest corner brackets (teal accent) */}
              <g id="chest-framing" opacity="0.6">
                <path d="M85 110 L80 110 L80 115" style={{ ...accent, strokeWidth: 2, fill: 'none' }} />
                <path d="M115 110 L120 110 L120 115" style={{ ...accent, strokeWidth: 2, fill: 'none' }} />
                <path d="M80 141 L80 146 L85 146" style={{ ...accent, strokeWidth: 2, fill: 'none' }} />
                <path d="M120 141 L120 146 L115 146" style={{ ...accent, strokeWidth: 2, fill: 'none' }} />
              </g>
              {/* ARC REACTOR — power core */}
              <g id="power-core" transform="translate(100, 128)">
                <circle cx="0" cy="0" r="12"
                  fill="none" stroke={activeVisorColor} strokeWidth="1.5" opacity="0.4"
                  style={visorTransitionStyle}
                />
                <circle cx="0" cy="0" r="8"
                  fill="none" stroke={activeVisorColor} strokeWidth="1" opacity="0.6"
                  style={visorTransitionStyle}
                />
                <circle cx="0" cy="0" r="4"
                  fill={activeVisorColor} opacity="0.8"
                  filter={config.glow ? 'url(#core-glow)' : undefined}
                  style={visorTransitionStyle}
                />
                <circle cx="0" cy="0" r="1.5" fill="#FFFFFF" opacity="0.9" />
                {[0, 60, 120, 180, 240, 300].map(angle => (
                  <line key={angle}
                    x1={Math.cos(angle * Math.PI / 180) * 5}
                    y1={Math.sin(angle * Math.PI / 180) * 5}
                    x2={Math.cos(angle * Math.PI / 180) * 11}
                    y2={Math.sin(angle * Math.PI / 180) * 11}
                    stroke={activeVisorColor} strokeWidth="0.8" opacity="0.3"
                    strokeLinecap="round" style={visorTransitionStyle}
                  />
                ))}
              </g>
            </g>

            {/* ── HEAD (renders last — on top) ── */}
            <g id="head">
              {/* Antenna */}
              <g id="antenna">
                <line x1="100" y1="22" x2="100" y2="35" stroke={strokeColor} strokeWidth="1.5" />
                <circle cx="100" cy="20" r="4"
                  stroke={state === 'dormant' ? strokeColor : activeVisorColor} strokeWidth="1.2"
                  fill={state === 'dormant' ? 'none' : activeVisorColor}
                  opacity={state === 'dormant' ? 0.3 : 1}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  style={visorTransitionStyle}
                />
              </g>
              {/* Head shape */}
              <rect x="65" y="35" width="70" height="48" rx="14" style={wire} />
              {/* Goggle frames */}
              <rect x="70" y="44" width="27" height="22" rx="11" style={wire} />
              <rect x="103" y="44" width="27" height="22" rx="11" style={wire} />
              {/* Goggle bridge */}
              <line x1="97" y1="55" x2="103" y2="55" stroke={strokeColor} strokeWidth="3" />

              {/* ===== EYES (expression-aware) ===== */}
              <g id="eyes">
                {/* === LEFT EYE === */}
                {/* Idle iris */}
                <circle cx="83.5" cy="55" r="5"
                  fill={activeVisorColor}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  opacity={state === 'dormant' ? 0 : (expression === 'blink' ? 0.3 : (expression === 'happy' ? 0 : 1))}
                  style={{ transition: noMotion ? 'none' : 'fill 0.8s ease, opacity 0.15s ease' }}
                />
                {/* Idle highlight */}
                <circle cx="85" cy="53.5" r="1.5" fill="#FFFFFF"
                  opacity={state === 'dormant' ? 0 : (expression === 'idle' || expression === 'thinking' ? 0.8 : 0)}
                  style={transitionStyle}
                />
                {/* Blink squish */}
                <ellipse cx="83.5" cy="55" rx="5" ry="0.8"
                  fill={activeVisorColor}
                  opacity={exprOpacity('blink')}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.08s ease' }}
                />
                {/* Happy arc ^ */}
                <path d="M78 57 Q83.5 50 89 57"
                  stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round" fill="none"
                  opacity={exprOpacity('happy')}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease, stroke 0.8s ease' }}
                />
                {/* Thinking shifted iris */}
                <circle cx="83.5" cy="52" r="3"
                  fill={activeVisorColor}
                  opacity={exprOpacity('thinking')}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease' }}
                />

                {/* === RIGHT EYE === */}
                {/* Idle iris */}
                <circle cx="116.5" cy="55" r="5"
                  fill={activeVisorColor}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  opacity={state === 'dormant' ? 0 : (expression === 'blink' ? 0.3 : (expression === 'happy' ? 0 : 1))}
                  style={{ transition: noMotion ? 'none' : 'fill 0.8s ease, opacity 0.15s ease' }}
                />
                {/* Idle highlight */}
                <circle cx="118" cy="53.5" r="1.5" fill="#FFFFFF"
                  opacity={state === 'dormant' ? 0 : (expression === 'idle' || expression === 'thinking' ? 0.8 : 0)}
                  style={transitionStyle}
                />
                {/* Blink squish */}
                <ellipse cx="116.5" cy="55" rx="5" ry="0.8"
                  fill={activeVisorColor}
                  opacity={exprOpacity('blink')}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.08s ease' }}
                />
                {/* Happy arc ^ */}
                <path d="M111 57 Q116.5 50 122 57"
                  stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round" fill="none"
                  opacity={exprOpacity('happy')}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease, stroke 0.8s ease' }}
                />
                {/* Thinking shifted iris */}
                <circle cx="116.5" cy="52" r="3"
                  fill={activeVisorColor}
                  opacity={exprOpacity('thinking')}
                  filter={config.glow ? 'url(#teal-glow)' : undefined}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease' }}
                />
              </g>

              {/* ===== MOUTH (expression-aware) ===== */}
              <g id="mouth">
                {/* Neutral smile — idle, blink, thinking */}
                <path d="M87 72 Q100 77 113 72"
                  stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round" fill="none"
                  opacity={state === 'dormant' ? 0 : (expression === 'happy' ? 0 : 0.8)}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease, stroke 0.8s ease' }}
                />
                {/* Happy big smile */}
                <path d="M85 71 Q100 80 115 71"
                  stroke={activeVisorColor} strokeWidth="2.5" strokeLinecap="round" fill="none"
                  opacity={exprOpacity('happy')}
                  style={{ transition: noMotion ? 'none' : 'opacity 0.15s ease, stroke 0.8s ease' }}
                />
              </g>
            </g>

          </g>
        </motion.g>
      </svg>
    </div>
  );
}
