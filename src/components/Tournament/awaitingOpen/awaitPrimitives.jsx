/* eslint-disable react-refresh/only-export-components -- the redesign's shared palette hook and its small surface primitives are co-located by design, mirroring commandUI.jsx */
// src/components/Tournament/awaitingOpen/awaitPrimitives.jsx
//
// Awaiting-the-Open redesign — the surface primitives (build spec §7).
// WSurf is the panel; BandHead is the section band; WChip is the small mono
// label. Depth comes from layered surfaces (bg / surface / raised), hairline
// borders and a gradient wash.
//
// GLOW DISCIPLINE, stated precisely: PANEL-level bloom (WSurf's `glow`) is
// reserved for the countdown and the user's own lane, and appears nowhere else.
// It is not a ban on light — the ticker plate's sector spine, the tick rails and
// the live-control bloom are part of the plate/meter grammar and are present
// wherever those primitives are, CPU lanes included. What CPU lanes do not get
// is the ownership wash and the panel bloom.
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
import { awaitPalette, alpha, wSec } from './awaitTokens';

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
    if (typeof document === 'undefined') return undefined;
    let injected = null;
    let el = document.getElementById(CSS_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = CSS_ID;
      document.head.appendChild(el);
    }
    injected = el;
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
      /* src/index.css:6-11 ships an UNLAYERED
         input,select,textarea,button { font-size:16px !important } (the iOS
         auto-zoom guard). It beats inline styles, so without this every button
         in this surface renders at 16px — measured, that turns the mobile wire
         row's Claim button into 37% of the row. Countered only for our own
         classes, via a custom property so each call site keeps its own size. */
      .aw-btn { font-size: var(--aw-btn-fs, 11px) !important; }
    `;
    // Remove on unmount so the rules do not outlive the surface for the rest of
    // the SPA session.
    return () => { if (injected && injected.parentNode) injected.remove(); };
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

/**
 * The claims meter — n/3 pending as filled beads plus the count. `used` is the
 * caller's OWN pending claim count (self-scoped; no other seat's claims are
 * read), and `max` is the live TOURNAMENT_TUNING cap passed by the caller, so
 * the beads and the number can never disagree with the cap the server enforces.
 */
export function ClaimsMeter({ used = 0, max = 3, compact = false }) {
  const pal = useAwaitPalette();
  const on = used > 0;
  const c = on ? pal.teal : pal.ink3;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: compact ? '4px 8px' : '5px 10px',
      borderRadius: 999, background: on ? alpha(pal.teal, 0.1) : alpha(pal.white, 0.03),
      border: `1px solid ${on ? alpha(pal.teal, 0.32) : pal.hair2}`, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true" style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: i < used ? pal.teal : alpha(pal.white, 0.16),
            boxShadow: i < used ? `0 0 6px ${pal.teal}` : 'none',
          }} />
        ))}
      </span>
      <Mono style={{ fontSize: compact ? 9.5 : 10, fontWeight: 700, color: c, letterSpacing: '0.06em' }}>
        {used}/{max} pending
      </Mono>
    </span>
  );
}

/**
 * THE TICKER PLATE — a spined market plate rather than a flat pill. Sector
 * colour arrives as a glowing spine + tint + tick marks while the symbol itself
 * stays near-white, so it reads as light ON colour instead of tinted text.
 *
 * Colour comes from wSec() → the live getSectorColor map — the same source the
 * research modal uses, so a ticker's colour is identical wherever it appears.
 * With `onResearch` the plate is a real <button> (keyboard-reachable, labelled);
 * without it, an inert span.
 */
export function TickerPlate({ symbol, sector, size = 'md', tag = null, tagColor = null, onResearch = null }) {
  const pal = useAwaitPalette();
  const c = wSec(sector);
  const S = {
    sm: { h: 26, f: 12, sp: 2.5, pad: '0 9px 0 8px', r: 8, tick: 5 },
    md: { h: 34, f: 15, sp: 3, pad: '0 11px 0 10px', r: 10, tick: 7 },
    lg: { h: 44, f: 21, sp: 4, pad: '0 15px 0 13px', r: 12, tick: 9 },
  }[size] || {};

  const inner = (
    <>
      <span aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: S.sp, background: c,
        boxShadow: `0 0 10px 0 ${alpha(c, 0.85)}`,
      }} />
      <Mono style={{
        fontSize: S.f, fontWeight: 700, letterSpacing: '-0.005em', color: pal.white,
        textShadow: `0 0 12px ${alpha(c, 0.65)}`, whiteSpace: 'nowrap',
      }}>
        {symbol}
      </Mono>
      {tag && (
        <Mono style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
          color: alpha(tagColor || c, 0.95), textTransform: 'uppercase',
        }}>
          {tag}
        </Mono>
      )}
      <span aria-hidden="true" style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 'auto', paddingLeft: 4 }}>
        {[0.9, 0.55, 0.3].map((o, i) => (
          <span key={i} style={{ width: 1.5, height: S.tick, borderRadius: 1, background: alpha(c, o) }} />
        ))}
      </span>
    </>
  );

  const style = {
    position: 'relative', display: 'inline-flex', alignItems: 'center',
    gap: size === 'sm' ? 7 : 9, height: S.h, padding: S.pad, borderRadius: S.r,
    overflow: 'hidden', minWidth: 0, maxWidth: '100%',
    background: `linear-gradient(96deg, ${alpha(c, 0.26)} 0%, ${alpha(c, 0.1)} 48%, ${alpha(pal.bg, 0.28)} 100%)`,
    border: `1px solid ${alpha(c, 0.42)}`,
    boxShadow: `inset 0 1px 0 ${alpha(pal.white, 0.1)}, 0 0 20px -12px ${alpha(c, 1)}`,
  };

  if (onResearch) {
    return (
      <button
        type="button"
        className="aw-tk"
        onClick={(e) => { e.stopPropagation(); onResearch(symbol); }}
        aria-label={`Research ${symbol}`}
        title={`Research ${symbol}`}
        style={{ ...style, font: 'inherit', cursor: 'pointer' }}
      >
        {inner}
      </button>
    );
  }
  return <span style={style}>{inner}</span>;
}

/** A tick-marked rail with a glowing bead — the battle screen's meter grammar. */
export function TickRail({ pct, color = null, ticks = 12, h = 7, live = false }) {
  const pal = useAwaitPalette();
  const c = color || pal.teal;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: '100%', height: h, borderRadius: h, background: pal.raised }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const x = ((i + 1) / (ticks + 1)) * 100;
        const crossed = x <= p;
        return (
          <span key={i} style={{
            position: 'absolute', left: `${x}%`, top: -2, bottom: -2, width: 1.5,
            transform: 'translateX(-50%)', borderRadius: 2,
            background: crossed ? alpha(c, 0.85) : alpha(c, 0.22),
            boxShadow: crossed ? `0 0 6px ${alpha(c, 0.6)}` : 'none',
          }} />
        );
      })}
      <span style={{
        position: 'absolute', left: 0, width: `${p}%`, top: 0, bottom: 0, borderRadius: h,
        background: `linear-gradient(90deg, ${alpha(c, 0.35)}, ${c})`,
        boxShadow: `0 0 12px -2px ${alpha(c, 0.7)}`,
      }} />
      <span style={{
        position: 'absolute', left: `${p}%`, top: '50%', width: h + 5, height: h + 5, borderRadius: '50%',
        transform: 'translate(-50%,-50%)', background: c, border: `2px solid ${pal.bg}`,
        boxShadow: `0 0 12px ${alpha(c, 0.95)}`,
        animation: live ? 'awOpenBead 2s ease-in-out infinite' : 'none',
      }} />
    </div>
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
