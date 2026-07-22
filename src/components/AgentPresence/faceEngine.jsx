// src/components/AgentPresence/faceEngine.jsx
//
// Agent Presence (V2.1) — the reactive FACE view (no body). Ported from the Design
// reference (face-engine.jsx). Identity kept: goggle twin housings + bridge, antenna
// bulb, glowing eyes + highlights, one-curve mouth. Colour is the DNA channel (single
// accent), never archetype.
//
// TWO LAYERS so the face carries a persistent MOOD, not just transients:
//   • base[] — the mood baseline. Shifts SLOWLY (~7s) with `standing` (how the agent is
//              doing). On screen ~95% of the time, so it carries the information. At even
//              standing, base == REST.
//   • off[]  — transient reactions. Rest = 0; pushed by moves, relaxes back to 0.
//   displayed d[key] = clamp(base[key] + off[key]). Transients play ON TOP of mood.
//
// The engine core (FaceCtl, the rAF loop, REST/EASE/TIER, the reactive REDUCED_MOTION
// default) lives in faceEngineCore.js; this file is the React view only.
//
// PORT NOTES vs the reference: ES modules; reduced motion is REACTIVE per instance
// (threaded from the house framer useReducedMotion() at the AgentPresence boundary,
// not a single module-load const) — the sibling AgentOrb respects reduced-motion via
// neither the CSS guard nor a hook, a gap the presence must not inherit; the rAF loop
// skips ticks while the tab is hidden; `standing` is driven EXTERNALLY by the read-only
// binding (no faked nudge model).

import React from 'react';
import { DISPO } from './faceMoves';
import { FaceCtl, FACE_REG, ensureLoop } from './faceEngineCore';

// ── the SVG (built once; refs captured for imperative updates) ──────────────
export const ReactiveFace = React.forwardRef(function ReactiveFace({ disposition = 'neutral', size = 200, accent = '#5EEAD4', standing = 0, reduced, reactivityLevel = 'reactive', style }, ref) {
  const uid = React.useId().replace(/[:]/g, '');
  const refs = React.useRef({});
  // STATIC vs REACTIVE (finding 13 seam). A reactive head joins the shared rAF loop
  // (breath + idle + mood glide); a static head paints ONE frame and never registers —
  // truly loop-free, the CPU-slot path and the future mech-customization seam (flip the
  // level to light a CPU up, no rebuild).
  const isStatic = reactivityLevel === 'static';
  // Created ONCE (the controller is a stable imperative object); the effect below
  // syncs ctl.disp when `disposition` changes, so the memo intentionally omits it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctl = React.useMemo(() => new FaceCtl(DISPO[disposition] || DISPO.neutral), []);
  React.useEffect(() => { ctl.disp = DISPO[disposition] || DISPO.neutral; }, [disposition, ctl]);
  // reactive reduced-motion (house framer useReducedMotion is read at the AgentPresence
  // boundary and threaded here). When it changes, re-apply the pose instantly. Skipped
  // for a static head — it never joins the loop, so reduced-motion is already a no-op.
  React.useEffect(() => {
    if (isStatic || reduced == null) return;
    ctl.setReduced(reduced);
    if (reduced) ctl.setStanding(ctl.standing, { instant: true });
  }, [isStatic, reduced, ctl]);
  // mount-once initial pose (deliberately not re-run on `standing` — the effect below
  // owns standing changes; this only seeds the correct pose synchronously on mount).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { ctl.setStanding(standing, { instant: true }); }, []);
  // standing → pose. Reactive glides via the loop; static writes instantly and repaints
  // its single frame (it has no loop to apply a tween). The mount paint is owned by the
  // lifecycle effect below (refs are attached there first).
  React.useEffect(() => {
    // `ctl.still` is set here too (not only in the lifecycle effect below) so this repaint
    // is self-consistent regardless of effect order.
    if (isStatic) { ctl.still = true; ctl.setStanding(standing, { instant: true }); ctl.renderStatic(performance.now()); }
    else ctl.setStanding(standing);
  }, [standing, isStatic, ctl]);
  React.useEffect(() => {
    ctl.attach(refs.current);
    ctl.still = isStatic;
    // Static: paint one still frame and RETURN — never join FACE_REG (no rAF, no idle,
    // no breath). The dispose() cleanup still runs so any (future) queued react-latency
    // timeout can't fire on a detached ctl. Reactive: paint the initial pose once, then
    // join the shared loop.
    if (isStatic) { ctl.renderStatic(performance.now()); return () => ctl.dispose(); }
    ctl.tick(performance.now());   // paint the initial pose once, synchronously
    FACE_REG.add(ctl); ensureLoop();
    return () => { FACE_REG.delete(ctl); ctl.dispose(); };
  }, [ctl, isStatic]);
  React.useImperativeHandle(ref, () => ({
    play: (m, o) => ctl.play(m, o), react: (e, o) => ctl.react(e, o), rest: () => ctl.rest(),
    setStanding: (s, o) => ctl.setStanding(s, o), neutralize: () => ctl.neutralize(), shake: (a, d) => ctl.shake(a, d), ctl,
  }), [ctl]);
  const set = (k) => (el) => { if (el) refs.current[k] = el; };
  const s = '#E6EDF3', body = '#0D0E12';
  const RC = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="30 6 140 156" height={size} width={size * 140 / 156} style={{ display: 'block', overflow: 'visible', ...style }}>
      <defs>
        <clipPath id={`lensL-${uid}`}><rect x="54" y="78" width="40" height="34" rx="17" /></clipPath>
        <clipPath id={`lensR-${uid}`}><rect x="106" y="78" width="40" height="34" rx="17" /></clipPath>
        <filter id={`gl-${uid}`} x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter id={`glc-${uid}`} x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g ref={set('face')}>
        <g ref={set('ant')}>
          <line x1="100" y1="54" x2="100" y2="27" stroke={s} strokeWidth="2.6" {...RC} />
          <circle ref={set('bulbGlow')} cx="100" cy="22" r="7" fill={accent} filter={`url(#glc-${uid})`} opacity="0.6" />
          <circle ref={set('bulb')} cx="100" cy="22" r="4.6" fill={accent} />
        </g>
        <rect x="40" y="52" width="120" height="96" rx="30" fill={body} stroke={s} strokeWidth="2.8" {...RC} />
        <g clipPath={`url(#lensL-${uid})`}>
          <g ref={set('eyeL')} transform="translate(74 95)">
            <circle ref={set('glowL')} r="12" fill={accent} filter={`url(#gl-${uid})`} opacity="0.6" />
            <circle r="8" fill={accent} /><circle cx="-2.8" cy="-2.8" r="2.2" fill="#FFFFFF" opacity="0.92" />
          </g>
          <rect ref={set('lidTL')} x="54" y="44" width="40" height="34" fill={body} stroke={s} strokeWidth="2.6" />
          <rect ref={set('lidBL')} x="54" y="112" width="40" height="34" fill={body} stroke={s} strokeWidth="2.6" />
        </g>
        <rect x="54" y="78" width="40" height="34" rx="17" fill="none" stroke={s} strokeWidth="2.8" {...RC} />
        <g clipPath={`url(#lensR-${uid})`}>
          <g ref={set('eyeR')} transform="translate(126 95)">
            <circle ref={set('glowR')} r="12" fill={accent} filter={`url(#gl-${uid})`} opacity="0.6" />
            <circle r="8" fill={accent} /><circle cx="-2.8" cy="-2.8" r="2.2" fill="#FFFFFF" opacity="0.92" />
          </g>
          <rect ref={set('lidTR')} x="106" y="44" width="40" height="34" fill={body} stroke={s} strokeWidth="2.6" />
          <rect ref={set('lidBR')} x="106" y="112" width="40" height="34" fill={body} stroke={s} strokeWidth="2.6" />
        </g>
        <rect x="106" y="78" width="40" height="34" rx="17" fill="none" stroke={s} strokeWidth="2.8" {...RC} />
        <line x1="94" y1="95" x2="106" y2="95" stroke={s} strokeWidth="2.8" {...RC} />
        <path ref={set('mouth')} d="M80 128 Q100 132 120 128" stroke={s} strokeWidth="2.6" {...RC} />
      </g>
    </svg>
  );
});
