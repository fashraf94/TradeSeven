// src/components/CommandCenter/HubHeader.jsx
//
// Command Center hub, slice S1 — the header (the design's CcHeader, ff-app.jsx;
// prompt §4.2): an eyebrow with today's date in ET and the player's name, and
// the title. The mock-up's own top navigation (Compete · News · League ·
// Forge) is prototype chrome and is not built: the app's sidebar and BottomNav
// stay (ruling R-S1-3).
//
// On the phone the design's account circle stays as the profile affordance.
// S5 wires it to the profile (spec §2); in S1 it is a disabled button with its
// label, a 44 px target around the 34 px circle.

import React from 'react';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, tint } from './hub/hubStyle';
import { Eyebrow } from './HubParts';

export default function HubHeader({ dateText, name, phone = false, gutter = 28, onOpenProfile }) {
  const initial = name ? name.trim().charAt(0).toUpperCase() : '';
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: phone ? '10px 14px 0' : `18px ${gutter}px 6px` }}>
      <div style={{ minWidth: 0 }}>
        <Eyebrow>{COPY.header.eyebrow(dateText, name)}</Eyebrow>
        <h1 style={{ margin: '3px 0 0', fontSize: phone ? 21 : 24, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1.1 }}>
          {COPY.header.title}
        </h1>
      </div>
      {phone && (
        <button
          type="button"
          onClick={onOpenProfile}
          disabled={typeof onOpenProfile !== 'function'}
          aria-label={COPY.header.profile}
          data-hub-profile=""
          style={{ appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', padding: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: typeof onOpenProfile === 'function' ? 'pointer' : 'default' }}
        >
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${tint('teal', 0.7)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: C.ink }}>
            {initial}
          </span>
        </button>
      )}
    </header>
  );
}
