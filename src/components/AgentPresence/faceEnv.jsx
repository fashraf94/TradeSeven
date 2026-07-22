// src/components/AgentPresence/faceEnv.jsx
//
// Agent Presence — the ENVIRONMENT layer. Ported from the Design reference
// (face-env.jsx). On rare high-stakes moments the presence affects its CONTAINER
// instead of contorting its face — impact without the character mugging. EnvStage
// wraps a ReactiveFace, exposes its API, and auto-wires the controller's onImpact hook.
// Rules enforced here (unchanged from the reference):
//   • tier 3 & 4 only        • transform + filter only (no layout reflow)
//   • < 600ms                • rate-limited (no two in a row)
//   • reduced-motion fallback (a single quiet glow bump)
//
// PORT NOTES: ES modules; reduced-motion is REACTIVE (a `reduced` prop threaded from
// the house useReducedMotion at the AgentPresence boundary) rather than a module-load
// const; CSS is injected on mount (SSR-safe, idempotent) instead of at import.

import React from 'react';
import { ReactiveFace } from './faceEngine';
import { REDUCED_MOTION } from './faceEngineCore';

// hex + alpha → rgba (local; mirrors the shared AgentOrb helper — kept local so this
// module has no cross-tree token import and stays self-contained).
function alpha(hex, a) {
  if (!hex || typeof hex !== 'string') return `rgba(94,234,212,${a})`;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(94,234,212,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function injectEnvCSS() {
  if (typeof document === 'undefined' || document.getElementById('__presence_env_css')) return;
  const el = document.createElement('style');
  el.id = '__presence_env_css';
  el.textContent = `
    .env-wrap{position:relative;display:flex;align-items:center;justify-content:center;will-change:transform;transform-origin:50% 55%}
    .env-layer{position:absolute;inset:0;pointer-events:none;border-radius:inherit}
    .env-glow{opacity:0}
    .env-flood{opacity:0;border-radius:16px}
    @keyframes envGlowPulse{0%{opacity:0}22%{opacity:.9}100%{opacity:0}}
    @keyframes envGlowPulseBig{0%{opacity:0}16%{opacity:1}100%{opacity:0}}
    @keyframes envFlood{0%{opacity:0}18%{opacity:.42}100%{opacity:0}}
    @keyframes envQuake{0%{transform:translate(0,0) rotate(0)}12%{transform:translate(-5px,2px) rotate(-.7deg)}26%{transform:translate(5px,-2px) rotate(.7deg)}42%{transform:translate(-4px,-1px) rotate(-.5deg)}60%{transform:translate(3px,2px) rotate(.4deg)}80%{transform:translate(-1px,0) rotate(-.15deg)}100%{transform:translate(0,0) rotate(0)}}
    @keyframes envNudge{0%{transform:translate(0,0)}20%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}100%{transform:translate(0,0)}}
    .env-play-glow{animation:envGlowPulse .5s ease-out}
    .env-play-glow-big{animation:envGlowPulseBig .56s ease-out}
    .env-play-flood{animation:envFlood .5s ease-out}
    .env-play-quake{animation:envQuake .46s ease-in-out}
    .env-play-nudge{animation:envNudge .3s ease-in-out}
    @media (prefers-reduced-motion: reduce){.env-play-glow,.env-play-glow-big,.env-play-flood,.env-play-quake,.env-play-nudge{animation:none!important}}
  `;
  document.head.appendChild(el);
}

// Impact tone → colour. Local (not exported) so this view file exports only the
// EnvStage component (react-refresh/only-export-components).
const ENV_TONE = { good: '#5EEAD4', bad: '#E08154', warn: '#F0C75E', neu: '#8B93A7' };

export const EnvStage = React.forwardRef(function EnvStage({ disposition = 'neutral', size = 200, accent = '#5EEAD4', standing = 0, enabled = true, radial = true, stageAccent, reduced, reactivityLevel = 'reactive', onDim, style }, ref) {
  const faceRef = React.useRef();
  const wrapRef = React.useRef(), glowRef = React.useRef(), floodRef = React.useRef();
  const last = React.useRef(0), enRef = React.useRef(enabled);
  const redRef = React.useRef(reduced != null ? reduced : REDUCED_MOTION);
  const timers = React.useRef(new Set());   // pending impact timeouts, cleared on unmount
  React.useEffect(() => { enRef.current = enabled; }, [enabled]);
  React.useEffect(() => { redRef.current = reduced != null ? reduced : REDUCED_MOTION; }, [reduced]);
  React.useEffect(() => { injectEnvCSS(); }, []);
  // Clear any in-flight impact timeouts on unmount so a class-removal / onDim(false) can't
  // fire after the stage is gone (short-lived <0.6s callbacks; harmless but hygienic).
  React.useEffect(() => () => { timers.current.forEach((id) => clearTimeout(id)); timers.current.clear(); }, []);

  // Stable (they only touch the `timers` ref) so `impact` — and thus the onImpact wiring
  // effect keyed on it — doesn't churn every render.
  const defer = React.useCallback((fn, ms) => { const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms); timers.current.add(id); return id; }, []);
  const run = React.useCallback((node, cls, ms) => { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); defer(() => node.classList.remove(cls), ms); }, [defer]);

  const impact = React.useCallback((tier, ev, tone) => {
    if (tier < 3) return;
    const now = performance.now();
    if (now - last.current < 850) return;                 // rate-limit — two in a row loses its power
    last.current = now;
    const col = ENV_TONE[tone] || accent;
    const g = glowRef.current;
    if (g) g.style.boxShadow = `0 0 60px 12px ${col}, inset 0 0 40px ${col}`;
    if (redRef.current) { if (g) { g.style.transition = 'opacity .16s'; g.style.opacity = '0.5'; defer(() => { g.style.opacity = '0'; }, 170); } return; }
    if (floodRef.current) floodRef.current.style.background = `radial-gradient(circle at 50% 52%, ${col}, transparent 68%)`;
    if (tier >= 4) {
      run(glowRef.current, 'env-play-glow-big', 560);
      run(wrapRef.current, 'env-play-quake', 460);
      run(floodRef.current, 'env-play-flood', 500);
      if (onDim) { onDim(true); defer(() => onDim(false), 470); }
    } else {
      run(glowRef.current, 'env-play-glow', 500);
      run(wrapRef.current, 'env-play-nudge', 300);
    }
  }, [accent, onDim, run, defer]);

  React.useEffect(() => {
    if (reactivityLevel === 'static') return undefined;   // a static head never reacts → no onImpact wiring/poll
    const id = setInterval(() => {
      if (faceRef.current && faceRef.current.ctl) { faceRef.current.ctl.onImpact = (t, e, to) => { if (enRef.current) impact(t, e, to); }; clearInterval(id); }
    }, 30);
    return () => clearInterval(id);
  }, [impact, reactivityLevel]);

  React.useImperativeHandle(ref, () => ({
    react: (e, o) => faceRef.current && faceRef.current.react(e, o),
    play: (m, o) => faceRef.current && faceRef.current.play(m, o),
    rest: () => faceRef.current && faceRef.current.rest(),
    neutralize: () => faceRef.current && faceRef.current.neutralize(),
    setStanding: (s, o) => faceRef.current && faceRef.current.setStanding(s, o),
    impact,
    get ctl() { return faceRef.current && faceRef.current.ctl; },
  }), [impact]);

  return (
    <div ref={wrapRef} className="env-wrap" style={{ width: '100%', height: '100%', ...style }}>
      {radial && <div className="env-layer" style={{ background: `radial-gradient(56% 48% at 50% 48%, ${alpha(stageAccent || accent, 0.13)}, transparent 72%)` }} />}
      <div ref={floodRef} className="env-layer env-flood" />
      <div ref={glowRef} className="env-layer env-glow" style={{ borderRadius: 24 }} />
      <ReactiveFace ref={faceRef} disposition={disposition} size={size} accent={accent} standing={standing} reduced={reduced} reactivityLevel={reactivityLevel} />
    </div>
  );
});
