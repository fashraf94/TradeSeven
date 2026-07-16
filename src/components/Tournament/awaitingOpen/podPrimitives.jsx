// src/components/Tournament/awaitingOpen/podPrimitives.jsx
//
// Small presentational primitives shared by the awaiting-open pod surfaces
// (Training Pod Draft V2 — Phase 2). The sector chip is the ONE colored-chip
// home (L6/L10): color comes from getSectorColor (holoTheme) — keyed by the
// universe doc's sectorName, the SAME map AssetResearchModal uses, so chips and
// the modal never disagree (BUILD_RULES §9). The competing sectors.js SPDR
// palette is deliberately not used.

import React from 'react';
import { getSectorColor } from '../../../constants/holoTheme';

/** A sector-colored ticker chip. `onResearch` makes the ticker a tap target
 *  (opens research); without it the chip is static. */
export function SectorChip({ symbol, sector, size = 'm', onResearch = null, highlight = false }) {
  const color = getSectorColor(sector);
  const small = size === 's';
  const inner = (
    <>
      <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, letterSpacing: '0.01em' }}>{symbol}</span>
    </>
  );
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6,
    padding: small ? '3px 8px' : '5px 10px', borderRadius: 999,
    background: `${color}${highlight ? '2e' : '1c'}`,
    border: `1px solid ${color}${highlight ? '80' : '55'}`,
    color, fontSize: small ? 11 : 12.5, whiteSpace: 'nowrap', maxWidth: '100%',
    boxShadow: highlight ? `0 0 0 1px ${color}33` : 'none',
  };
  if (onResearch) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); onResearch(symbol); }}
        aria-label={`Research ${symbol}`} title={`Research ${symbol}`}
        style={{ ...style, cursor: 'pointer', font: 'inherit' }}>
        {inner}
      </button>
    );
  }
  return <span style={style}>{inner}</span>;
}

/** A section eyebrow + title used to head each pod section. */
export function SectionHead({ tokens, eyebrow, title, note = null, right = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: tokens.teal }}>{eyebrow}</div>
        )}
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: tokens.textPrimary, marginTop: eyebrow ? 3 : 0 }}>{title}</div>
        {note && <div style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 3, lineHeight: 1.4 }}>{note}</div>}
      </div>
      {right}
    </div>
  );
}
