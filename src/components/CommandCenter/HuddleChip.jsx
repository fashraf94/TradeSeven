// src/components/CommandCenter/HuddleChip.jsx
//
// Huddle S1 — THE CHIP UNDER SHADOW (Huddle spec Amendment C V1.2 §C4; Command Center spec
// V1.2 Amendment D §D2). A state label and a door, never an announcement: no badge, pulse,
// toast, count or live region (Shadow's status line stays the hub's only live region). It
// is rendered by the shells BESIDE the stage, outside Shadow's fixed box, and leaves its
// size alone; it is a 44 px target and fits at 360 px. Its words are hubCopy.js's. It holds
// no read, effect, timer or listener: the chip state comes in (hub/huddleView.js).

import React from 'react';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR } from './hub/hubStyle';

export default function HuddleChip({ chip, onOpen }) {
  if (!chip) return null;
  const disabled = typeof onOpen !== 'function';
  return (
    <div data-hub-huddle-chip={chip.state} style={{ display: 'flex', justifyContent: 'center', marginTop: 10, maxWidth: '100%' }}>
      <button
        type="button"
        onClick={disabled ? undefined : onOpen}
        disabled={disabled}
        aria-label={COPY.huddle.chipLabel(chip.label)}
        style={{
          appearance: 'none', font: 'inherit', minHeight: 44, minWidth: 44, maxWidth: '100%', padding: '0 16px', borderRadius: 22,
          border: `1px solid ${HAIR}`, background: C.raised, color: C.ink, fontSize: 13.5, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {chip.label}
      </button>
    </div>
  );
}
