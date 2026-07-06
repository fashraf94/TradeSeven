// src/components/Tournament/myTournament/TCard.jsx
//
// Shared card + module-header primitives for the "My Tournament" page. The
// mockup's TCard has no app equivalent, so it's built here on the shared
// obsidian tokens (LTOKENS = commandUI.CMD); ModHead is the mockup's per-module
// header (icon chip + eyebrow + optional sub + optional right slot).

import React from 'react';
import { LTOKENS, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, LIcon } from '../../League/LeagueParts';

// A rounded obsidian card. `accent` tints the background gradient + border;
// `glow` adds the soft drop shadow (the hero cards).
export function TCard({ children, accent, glow, pad = 16, style }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 16, padding: pad, minWidth: 0,
      background: accent
        ? `linear-gradient(158deg, ${alpha(accent, 0.07)}, ${alpha(LTOKENS.bg, 0.45)} 62%)`
        : LTOKENS.surface,
      border: `1px solid ${accent ? alpha(accent, 0.3) : LTOKENS.hair}`,
      boxShadow: glow ? `0 20px 50px -30px ${alpha(accent || LTOKENS.teal, 0.55)}` : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

// The per-module header: an icon chip, an eyebrow label, an optional mono
// sub-line, and an optional right-aligned element (edit link, count, chip).
export function ModHead({ icon, color = LTOKENS.ink3, label, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: alpha(color, 0.13), border: `1px solid ${alpha(color, 0.36)}`,
      }}>
        <LIcon name={icon} size={14} color={color} stroke={2.1} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow color={color}>{label}</Eyebrow>
        {sub && (
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, marginTop: 2, display: 'block', letterSpacing: '0.02em' }}>
            {sub}
          </Mono>
        )}
      </div>
      {right}
    </div>
  );
}
