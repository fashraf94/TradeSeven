// src/components/PracticeField/IdeaBookParts.jsx
//
// Practice Field build B3 — THE IDEA BOOK SCREEN'S PARTS (design of record docs/design/practice-field/IDEA_BOOK_ROUND_2.html,
// its ib-parts.jsx and ff-ui.jsx). The two voices: an agent's words are quoted, signed and dated, never boxed or coloured;
// the book's numbers are mono, and the up and down colours sit on numbers only (a sign always says the direction too).
//
// Colours are the app's own tokens through the bridge (BUILD_RULES §10: cssVar, --ft-*): the mock-up's palette is the
// Command Center's, and every value it uses has a token (bg-dashboard, bg-card, bg-agent, ink, ink-2, ink-3, pos, neg,
// teal). Hairlines compose the scrim triplet. SVG keeps `currentColor` in its attributes (ruling R-H8). The app ships no
// global border-box and forces every <button> to 16 px (src/index.css), so every box sets its own sizing and every
// button's words sit in a span with their own size. Nothing here reads, fetches or formats money: the server sends every
// figure as a display string (ruling B3-1).

import React, { useId } from 'react';
import { IB, MONO, HAIR, mono, BOOK_TEXT } from './ideaBookStyle';

export function Eyebrow({ children, color = IB.ink3, style }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color, fontWeight: 600, ...style }}>{children}</div>;
}

export function Icon({ name, size = 16 }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const g = {
    chevR: <path {...p} d="M9 5l7 7-7 7" />,
    chevD: <path {...p} d="M5 9l7 7 7-7" />,
    chevL: <path {...p} d="M15 5l-7 7 7 7" />,
    x: <path {...p} d="M6 6l12 12M18 6L6 18" />,
    clock: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>{g[name] || null}</svg>;
}

/**
 * A desk's mark: a still of the desk's core in its frame. The mock-up drew each mark with the identity engine; the screen
 * draws a static still (no WebGL for a 24 px mark): the Shadow desk's teal core, the archetype desk's silver one.
 */
export function DeskMark({ desk, deskName, size = 24, dim = false }) {
  const id = useId().replace(/:/g, '');
  const near = desk === 'shadow' ? IB.teal : IB.monoNear;
  const core = desk === 'shadow' ? IB.tealCore : IB.ink;
  return (
    <span role="img" aria-label={deskName ? `${deskName} mark` : undefined} data-ib-desk-mark={desk} style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: IB.bg, border: HAIR, overflow: 'hidden', flexShrink: 0, display: 'block', boxSizing: 'border-box', opacity: dim ? 0.5 : 1 }}>
      <svg width={size - 2} height={size - 2} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block' }}>
        <defs>
          <radialGradient id={`ibm-${id}`}>
            <stop offset="0" style={{ stopColor: core, stopOpacity: 1 }} />
            <stop offset=".22" style={{ stopColor: near, stopOpacity: 0.6 }} />
            <stop offset=".55" style={{ stopColor: near, stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: near, stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" style={{ fill: `url(#ibm-${id})` }} />
        {desk !== 'shadow' ? <circle cx="50" cy="50" r="27" style={{ fill: 'none', stroke: near, strokeOpacity: 0.55, strokeWidth: 3 }} /> : null}
      </svg>
    </span>
  );
}

/** An agent's (or a player's) words: quoted, signed and dated. Plain text, always. */
export function Quote({ children, cap, size = 14 }) {
  return (
    <figure style={{ margin: 0, display: 'grid', gridTemplateColumns: '13px minmax(0,1fr)' }}>
      <span aria-hidden="true" style={{ fontSize: size * 1.85, lineHeight: 1, fontWeight: 700, color: IB.ink3, height: size, marginTop: 1 }}>“</span>
      <div style={{ minWidth: 0 }}>
        <blockquote style={{ margin: 0, fontSize: size, lineHeight: 1.5, color: IB.ink, textWrap: 'pretty', overflowWrap: 'anywhere' }}>{children}”</blockquote>
        {cap ? <figcaption style={{ ...mono(10.5, IB.ink3), letterSpacing: '.03em', marginTop: 6, lineHeight: 1.4 }}>{cap}</figcaption> : null}
      </div>
    </figure>
  );
}

export function Chip({ children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '2px 9px', borderRadius: 999, border: `1px solid ${IB.hair2}`, fontSize: 11.5, color: IB.ink2, lineHeight: 1.3, whiteSpace: 'nowrap', boxSizing: 'border-box' }}>{children}</span>;
}

/** A call's word (Hold, Exit, Paused): neutral type, never a colour; Exit and Paused solid. */
export function CallWord({ kind, solid = false }) {
  const s = solid || kind === 'Exit';
  return <span style={{ ...mono(10.5, s ? IB.bg : IB.ink, 700), letterSpacing: '.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, lineHeight: 1.3, background: s ? IB.ink : 'transparent', border: `1px solid ${s ? IB.ink : IB.hair2}`, flexShrink: 0 }}>{kind}</span>;
}

/** The book's own sentence in a box (the buy and sell sentences). */
export function BookSays({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 10px', borderRadius: 10, background: IB.bg, border: HAIR, ...BOOK_TEXT, color: IB.ink }}>
      <span style={{ marginTop: 2, color: IB.ink3 }}><Icon name="clock" size={14} /></span>
      <span>{children}</span>
    </div>
  );
}

/** The line track: the line at the right-hand tick, the dot the price now (`gauge` 0–1 from the server). */
export function LineGauge({ gauge, near }) {
  const p = Math.max(0, Math.min(1, Number(gauge) || 0));
  const c = near ? IB.ink : IB.ink2;
  return (
    <span aria-hidden="true" style={{ position: 'relative', flex: 1, height: 10, minWidth: 40, display: 'block' }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: 4.5, height: 1, background: IB.hair2 }} />
      <span style={{ position: 'absolute', right: 0, top: 0, width: 2, height: 10, borderRadius: 1, background: c }} />
      <span style={{ position: 'absolute', left: `calc(${p * 100}% - ${p * 9}px)`, top: 2, width: 6, height: 6, borderRadius: 3, background: c, boxShadow: near ? '0 0 0 3px rgba(var(--ft-scrim-rgb), 0.2)' : 'none' }} />
    </span>
  );
}
