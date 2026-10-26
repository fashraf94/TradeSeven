// src/components/CommandCenter/ShadowStill.jsx
//
// Command Center hub, slice S1 — Shadow, as the still (founder ruling R-S1-1;
// spec V1.2 §1, §10). The design's static SVG (ff-shadow.jsx ShadowSVG), drawn
// from the same geometry S7's canvas will animate (hub/shadowGeometry.js): the
// still is the moving form at rest, not a different drawing.
//
// ONE SWAPPABLE COMPONENT. Everything about Shadow's look lives in here, inside
// a fixed `size × size` stage box. The props are the whole contract:
//   size          the box's side, px
//   tier          'low' | 'mid' | 'high' — strands per family (spec §10: start
//                 sparse; the hub passes low on the phone, mid elsewhere)
//   status        'ambient' | 'still' | 'processing' — named in the label
//                 (spec §10: labels distinguish them); S1 always draws the still
//   selectedArea  0 | 1 | 2 | null — the selected relationship area's family
//                 leans out, the others recede (the design's focus)
//   reducedMotion the same geometry with no motion; the still has none to drop
//   flash         slice S7: the reduced-motion form of the response bloom — the design's brief
//                 lift of the glow and the strands (drawStill(flash): ×1.25, capped at 1), which the
//                 owner of the response clears itself after 420 ms
//   boxRef        the stage box element, the one thing the stage measures
// Nothing outside reads a filament point: the area controls, the dotted
// connector and the status line anchor to the box's edges and the controls'
// own positions, so a later arc can swap this whole component (S7's
// ShadowFilaments, an armoured Shadow) without touching the layout.
//
// Colours are computed token hexes read at render (SVG attributes cannot take
// var(), BUILD_RULES §10 hazard H8): the near colour teal, the far colour
// teal-2, the bright core white (the design's #ECFFFB highlight has no token;
// white is the nearest shipped one).

import React, { useId, useMemo } from 'react';
import { readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { SH_ECHO_NODES, mixHex, stillPaths } from './hub/shadowGeometry';

export default function ShadowStill({ size, tier = 'mid', status = 'still', selectedArea = null, reducedMotion = false, flash = false, boxRef }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sel = selectedArea === 0 || selectedArea === 1 || selectedArea === 2 ? selectedArea : null;
  const paths = useMemo(() => stillPaths(tier, sel), [tier, sel]);
  const near = readToken('teal');
  const far = readToken('teal-2');
  const core = readToken('white');
  const state = COPY.shadow.states[status] || COPY.shadow.states.still;
  const areaName = sel == null ? null : COPY.areas.names[sel];
  const lift = flash ? 1.25 : 1;

  return (
    <div
      ref={boxRef}
      data-shadow-box=""
      data-shadow-status={state}
      data-shadow-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-shadow-flash={flash ? '' : undefined}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="-1.25 -1.25 2.5 2.5"
        role="img"
        aria-label={COPY.shadow.imageLabel(state, areaName)}
        style={{ display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`h${uid}`}>
            <stop offset="0" stopColor={near} stopOpacity={0.1 * lift} />
            <stop offset="0.55" stopColor={near} stopOpacity="0.035" />
            <stop offset="1" stopColor={near} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`c${uid}`}>
            <stop offset="0" stopColor={core} stopOpacity="0.95" />
            <stop offset="0.35" stopColor={near} stopOpacity={Math.min(1, 0.55 * lift)} />
            <stop offset="1" stopColor={near} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`n${uid}`}>
            <stop offset="0" stopColor={core} stopOpacity="0.9" />
            <stop offset="0.35" stopColor={near} stopOpacity="0.5" />
            <stop offset="1" stopColor={near} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="1.15" fill={`url(#h${uid})`} />
        {paths.map((p, i) => {
          const stroke = mixHex(far, near, p.depth);
          const alpha = Math.min(1, p.alpha * lift);
          return (
            <g key={i} data-shadow-strand="">
              {p.glow && (
                <path d={p.d} fill="none" stroke={stroke} strokeOpacity={alpha * 0.16} strokeWidth={p.glowWidth} strokeLinecap="round" strokeLinejoin="round" />
              )}
              <path d={p.d} fill="none" stroke={stroke} strokeOpacity={alpha} strokeWidth={p.width} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        <circle r="0.11" fill={`url(#c${uid})`} />
        {SH_ECHO_NODES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={`url(#n${uid})`} />)}
      </svg>
    </div>
  );
}
