// src/components/CommandCenter/panels/PartnershipPanel.jsx
//
// Command Center hub, slice S1 — the reserved Partnership panel (spec V1.2
// §8.3), exactly: one line, and nothing else. No control, link, count or
// record fetch, no promised availability, and it is never the default
// selection. It takes no data because there is none to take.
//
// Huddle S1 (Huddle spec Amendment C V1.2 §C8; Command Center spec V1.2 Amendment D §D5):
// while DRB_HUDDLE_ENABLED is on, the hub hands it `huddle` (hub/huddleView.js
// huddlePartnershipOf) and the panel shows the game plan as a trading-control record for
// one session — today's plan and its per-game status, and the recent plans — with the
// Research panel's states: loading, none, error with Retry, and an as-of note on a kept
// answer. It reads nothing itself. With no `huddle` (the flag off, the frames, the tests
// that render it alone) it is the reserved line above, unchanged.

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C } from '../hub/hubStyle';
import { HubButton, HubLink } from '../HubParts';

const lineStyle = { margin: 0, fontSize: 13.5, color: C.ink2, lineHeight: 1.5, maxWidth: 580, textWrap: 'pretty' };

export default function PartnershipPanel({ huddle = null, onOpenHuddle, onRetry }) {
  if (!huddle) {
    return (
      <p data-hub-panel="partnership" style={lineStyle}>
        {COPY.partnership.reserved}
      </p>
    );
  }
  const H = COPY.huddle;
  if (huddle.status === 'loading') return <p data-hub-panel="partnership" data-hub-partnership="loading" style={lineStyle}>{H.partnershipLoading}</p>;
  if (huddle.status === 'error') {
    return (
      <div data-hub-panel="partnership" data-hub-partnership="error" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={lineStyle}>{H.partnershipError}</p>
        <HubButton small onPress={onRetry}>{H.partnershipRetry}</HubButton>
      </div>
    );
  }
  return (
    <div data-hub-panel="partnership" data-hub-partnership={huddle.status} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 580 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{H.partnershipHeading}</div>
      {huddle.today ? (
        <div data-hub-partnership-today={huddle.today.etDate}>
          {huddle.today.items.map((text) => <div key={text} style={{ fontSize: 13.5, color: C.ink }}>{text}</div>)}
          <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 4 }}>{huddle.today.line}</div>
          {huddle.today.battles.map((b) => <div key={b.battleId} style={{ fontSize: 12.5, color: C.ink2 }}>{b.text}</div>)}
          {onOpenHuddle && <div style={{ marginTop: 6, fontSize: 12.5 }}><HubLink onPress={onOpenHuddle}>{H.openToday}</HubLink></div>}
        </div>
      ) : (
        <p style={lineStyle}>{H.partnershipNone}</p>
      )}
      {huddle.history.length > 0 && (
        <div data-hub-partnership-history="">
          <div style={{ fontSize: 12.5, color: C.ink2, fontWeight: 600, marginBottom: 4 }}>{H.recentPlans}</div>
          {huddle.history.map((row) => <div key={row.etDate} style={{ fontSize: 12.5, color: C.ink2 }}>{row.text}</div>)}
        </div>
      )}
      {huddle.asOf && <p style={{ ...lineStyle, fontSize: 12 }}>{huddle.asOf}</p>}
      <p style={{ ...lineStyle, fontSize: 12 }}>{H.partnershipNote}</p>
    </div>
  );
}
