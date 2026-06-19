// src/components/League/draft/TierHeader.jsx
//
// Tier divider — ported from the design (draft-parts.jsx). Banded on absolute fit.

import React from 'react';
import { TOKENS, DX, alpha } from './draftTokens';
import { TIERS } from './boardModel';
import { Mono } from './draftPrimitives';

export function TierHeader({ tier, count }) {
  const t = TIERS.find((x) => x.id === tier) || TIERS[TIERS.length - 1];
  const c = tier === 'top' ? DX.you : tier === 'reach' ? TOKENS.ink3 : TOKENS.ink2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 2px 7px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: tier === 'top' ? `0 0 8px ${alpha(c, 0.8)}` : 'none' }} />
      <Mono style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: c, fontWeight: 700 }}>{t.label}</Mono>
      {t.note && <Mono style={{ fontSize: 10, color: TOKENS.ink3, letterSpacing: '0.04em' }}>· {t.note}</Mono>}
      <div style={{ flex: 1, height: 1, background: alpha(c, 0.14) }} />
      <Mono style={{ fontSize: 10, color: TOKENS.ink3 }}>{count}</Mono>
    </div>
  );
}

export default TierHeader;
