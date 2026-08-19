/* eslint-disable react-refresh/only-export-components -- the redesign's shared palette hook and its small surface primitives are co-located by design, mirroring commandUI.jsx */
// src/components/Tournament/awaitingOpen/awaitPrimitives.jsx
//
// Awaiting-the-Open redesign — the surface primitives (build spec §7).
// WSurf is the panel; BandHead is the section band; WChip is the small mono
// label. Depth comes from layered surfaces (bg / surface / raised), hairline
// borders and a gradient wash; glow is reserved for the countdown and the
// user's own panel/lane and is used nowhere else.
//
// Reduced motion: `useAwaitCSS` puts every hover/transition rule behind
// `@media (prefers-reduced-motion: no-preference)`, so the browser drops them
// natively, and `usePrefersReducedMotion` lets call sites drop keyframe
// animations. The hook is SUBSCRIBED rather than latched (the
// StarfieldBackground.jsx:181 precedent) — a user enabling Reduce Motion
// mid-session gets a still screen without navigating away.

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Mono } from '../../League/draft/draftPrimitives';
import { awaitPalette, alpha } from './awaitTokens';

export { Mono };

/** The design's semantic palette, derived from the live useTheme() tokens. */
export function useAwaitPalette() {
  const { tokens } = useTheme();
  return useMemo(() => awaitPalette(tokens), [tokens]);
}

/**
 * Live `prefers-reduced-motion`, subscribed rather than latched — the
 * StarfieldBackground.jsx:181 pattern (framer's useReducedMotion is a mount
 * snapshot with no subscription).
 */
export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setReduced(event.matches);
    setReduced(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

const CSS_ID = '__await_open_css';

/**
 * Keyframes + hover affordances for the redesign, injected once and kept in
 * sync with the palette. Every motion rule sits inside a reduced-motion
 * `no-preference` guard so the still-screen contract is enforced by CSS rather
 * than by remembering to branch at each call site.
 */
export function useAwaitCSS(pal) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(CSS_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
      @keyframes awOpenSheet { from { transform: translateY(103%) } to { transform: none } }
      @keyframes awOpenDim   { from { opacity: 0 } to { opacity: 1 } }
      @keyframes awOpenColon { 0%,100% { opacity: .9 } 50% { opacity: .3 } }
      @keyframes awOpenBell  { 0%,100% { box-shadow: 0 0 0 0 ${alpha(pal.teal, 0.45)} } 60% { box-shadow: 0 0 0 9px ${alpha(pal.teal, 0)} } }
      @keyframes awOpenBead  { 0%,100% { transform: translate(-50%,-50%) scale(1) } 50% { transform: translate(-50%,-50%) scale(1.4) } }
      @media (prefers-reduced-motion: no-preference) {
        .aw-row { transition: background .16s ease, border-color .16s ease; }
        .aw-row:hover { background: ${alpha(pal.white, 0.04)}; border-color: ${alpha(pal.white, 0.15)}; }
        .aw-btn { transition: background .15s ease, border-color .15s ease, transform .12s ease, box-shadow .2s ease; }
        .aw-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .aw-btn:active:not(:disabled) { transform: scale(.98); }
        .aw-pick { transition: background .15s ease, border-color .15s ease; }
        .aw-cell { transition: border-color .16s ease, background .16s ease; }
        .aw-cell:hover { border-color: ${alpha(pal.white, 0.18)}; }
        .aw-tk { transition: transform .14s ease, box-shadow .2s ease; }
        .aw-tk:hover { transform: translateY(-1px); }
      }
      .aw-btn:disabled { cursor: not-allowed; }
    `;
  }, [pal]);
}

/**
 * The panel primitive. `accent` washes the surface in an ownership colour and
 * tints the border; `glow` adds the outer bloom — reserved for the countdown
 * and the user's own panel.
 */
export function WSurf({ children, pad = 18, accent = null, glow = false, style = null }) {
  const pal = useAwaitPalette();
  const a = accent;
  return (
    <section
      style={{
        position: 'relative', borderRadius: 18, padding: pad, minWidth: 0,
        background: a
          ? `linear-gradient(166deg, ${alpha(a, 0.1)}, ${alpha(pal.bg, 0.5)} 54%), ${pal.surface}`
          : `linear-gradient(180deg, ${alpha(pal.white, 0.035)}, ${alpha(pal.white, 0)} 120px), ${pal.surface}`,
        border: `1px solid ${a ? alpha(a, 0.3) : pal.hair}`,
        boxShadow: `inset 0 1px 0 ${alpha(pal.white, 0.055)}, 0 26px 60px -44px ${alpha(pal.bg, 0.9)}${glow ? `, 0 0 66px -38px ${alpha(a || pal.teal, 0.9)}` : ''}`,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/** A section band: icon tile + letter-spaced mono eyebrow + title + optional sub. */
export function BandHead({ eyebrow, title, sub = null, right = null, compact = false, color = null, icon = null }) {
  const pal = useAwaitPalette();
  const c = color || pal.teal;
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: compact ? 12 : 15 }}>
      {icon && (
        <span style={{
          width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: 9, flexShrink: 0, marginTop: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: alpha(c, 0.14), border: `1px solid ${alpha(c, 0.36)}`,
        }}>
          {icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--ld-mono)', fontSize: compact ? 9.5 : 10, fontWeight: 700, letterSpacing: '0.3em',
          textTransform: 'uppercase', color: c,
        }}>
          {eyebrow}
        </div>
        <h2 style={{
          margin: compact ? '6px 0 0' : '7px 0 0', fontSize: compact ? 17 : 21, fontWeight: 700,
          letterSpacing: '-0.018em', color: pal.ink, lineHeight: 1.1,
        }}>
          {title}
        </h2>
        {sub && (
          <p style={{ margin: '5px 0 0', fontSize: compact ? 11.5 : 12, color: pal.ink2, lineHeight: 1.45, maxWidth: 640 }}>
            {sub}
          </p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
    </header>
  );
}

/** Small mono chip — solid for an owned/active state, dashed for an empty slot. */
export function WChip({ icon = null, children, color = null, solid = false, dash = false, style = null }) {
  const pal = useAwaitPalette();
  const c = color || pal.ink2;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999,
      background: solid ? alpha(c, 0.14) : alpha(pal.white, 0.03),
      border: `1px ${dash ? 'dashed' : 'solid'} ${solid ? alpha(c, 0.38) : pal.hair2}`,
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon}
      <Mono style={{ fontSize: 10, fontWeight: 700, color: c, letterSpacing: '0.08em' }}>{children}</Mono>
    </span>
  );
}
