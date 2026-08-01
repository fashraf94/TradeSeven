// src/components/League/battleArena/DecompositionStrip.jsx
//
// Phase B Decomposition (Ruling A) — the your-seat orb, made legible. The live orb
// is a single unrounded float; this strip shows WHERE it comes from, grouped BY
// LAYER (not loose addends), because the ×1.5 lands on the COMBINED user half:
//
//   agent side (×1) = banked-prior + Σsix + swaps
//   user  layer     = (Σthree + dropped) × 1.5
//   agent side + user layer = ORB     (exactly — the same ops computeComposite runs)
//
// The ×1.5 weighting is shown EXPLICITLY on the user layer. Swaps and dropped are
// visible terms here (not just header chips) — they're load-bearing in the sum.
// banked-prior is one aggregate term (per-symbol prior base is Path b, parked).
// YOUR seat only — rivals are sealed. Renders nothing when `decomposition` is null
// (off-gate → byte-identical to today).
//
// Honesty (Ruling B): the six's per-card points are today's points (base + today's
// badges), NOT cumulative per-card base — cumulative-prior rides in `banked` here.
//
// Component (not the pure bridge): it may import the league tokens; it renders via
// renderToString in its co-located test, the same discipline StarCell follows.

import React from 'react';
import { Mono } from '../LeagueParts';
import { LTOKENS, alpha } from '../leagueTokens';
import { fmtScore } from '../../../utils/leagueFormat';
import { ST_GOOD, ST_BAD } from './arenaTheme';

// The locked your-seat teal (== leagueTokens LX.energy / CMD.teal), inlined as the
// literal so the color read matches the orb without threading a prop.
const YOU = '#5EEAD4';

const toneOf = (v) => (v > 0 ? ST_GOOD : v < 0 ? ST_BAD : LTOKENS.ink2);

// one labeled term — "banked +300", "swaps −253"
function Term({ label, value }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, whiteSpace: 'nowrap' }}>
      <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>{label}</Mono>
      <Mono style={{ fontSize: 11, fontWeight: 700, color: toneOf(v), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(v)}</Mono>
    </span>
  );
}

const Op = ({ ch }) => (
  <Mono style={{ fontSize: 11, fontWeight: 700, color: LTOKENS.ink3, flexShrink: 0 }}>{ch}</Mono>
);

// A layer group: label + weight badge + its terms + "= subtotal".
function LayerGroup({ label, weight, accent, subtotal, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 9,
      background: LTOKENS.surface, border: `1px solid ${alpha(accent, 0.3)}`, minWidth: 0, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: accent, textTransform: 'uppercase' }}>{label}</Mono>
        <Mono style={{ fontSize: 8, fontWeight: 700, color: accent, padding: '1px 4px', borderRadius: 4, background: alpha(accent, 0.14), border: `1px solid ${alpha(accent, 0.4)}` }}>{weight}</Mono>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>{children}</span>
      <Op ch="=" />
      <Mono style={{ fontSize: 12, fontWeight: 800, color: toneOf(subtotal), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(subtotal)}</Mono>
    </span>
  );
}

/**
 * @param {Object} props
 * @param {Object|null} props.decomposition - buildArenaModel's decomposition (null = no strip)
 * @param {boolean} [props.compact] - mobile: wrap + roomier padding
 */
export function DecompositionStrip({ decomposition, compact = false }) {
  if (!decomposition) return null;
  const { bankedPrior, six, swaps, three, dropped, agentSide, userLayer, k, orb } = decomposition;
  const kLabel = `×${Number.isFinite(k) ? k : 1.5}`;
  return (
    <div
      aria-label="How your live score is built"
      style={{ display: 'flex', alignItems: 'center', flexWrap: compact ? 'wrap' : 'nowrap', gap: compact ? 8 : 10,
        padding: compact ? '11px 12px' : '7px 12px', borderRadius: 12, minWidth: 0, overflowX: compact ? 'visible' : 'auto',
        background: alpha(LTOKENS.bg, 0.6), border: `1px solid ${alpha(YOU, 0.28)}` }}
    >
      <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: LTOKENS.ink3, textTransform: 'uppercase', flexShrink: 0 }}>
        How this builds
      </Mono>

      {/* AGENT side (×1): banked-prior + Σsix + swaps */}
      <LayerGroup label="Agent" weight="×1" accent={LTOKENS.ink2} subtotal={agentSide}>
        <Term label="banked" value={bankedPrior} />
        <Op ch="+" />
        <Term label="six" value={six} />
        <Op ch="+" />
        <Term label="swaps" value={swaps} />
      </LayerGroup>

      <Op ch="+" />

      {/* USER layer (×1.5 — the weighting is explicit on the badge): (Σthree + dropped) × k */}
      <LayerGroup label="User" weight={kLabel} accent={YOU} subtotal={userLayer}>
        <Term label="three" value={three} />
        <Op ch="+" />
        <Term label="dropped" value={dropped} />
      </LayerGroup>

      <Op ch="=" />

      {/* the orb it reconciles to — agentSide + userLayer === orb, exactly */}
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
        <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: YOU, textTransform: 'uppercase' }}>You</Mono>
        <Mono style={{ fontSize: 15, fontWeight: 800, color: YOU, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(orb)}</Mono>
      </span>
    </div>
  );
}
