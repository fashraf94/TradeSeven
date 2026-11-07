// src/components/AgentForm/LoadoutStill.jsx
//
// Build A2 — Shadow wearing a loadout's set, as a still, for the loadout cards and lines (the loadout boards' `Still`:
// 48 px on cards, 40 px in lines; board 7 #2). Ruling N1 names these stills among the few places a figure wears a
// loadout's archetype outside a game. One component for the hub's cards and Deploy line (CommandCenter/LoadoutCards.jsx)
// and the League lobby's lines (League/LeagueLoadoutLine.jsx), kept beside the wrapper so the League never reaches into
// the hub's directory.
//
// The rate is the still, whatever the size (R12 says still under 40 px; these ask for it at 40 and 48 too), so a card
// never runs a live view. Hidden until its view has reported, so the wrapper's placeholder never shows for the frame
// before the engine draws (the armory's Figure rule); without WebGL the wrapper's own still shows at once. No effect,
// timer or listener of its own.

import React, { useState } from 'react';
import AgentForm from './AgentForm';
import { hasWebGL } from './agentFormSpec';
import { getAgentGrowth } from './agentGrowth';
import { cssVar } from '../../theme/cssTokens';

/** Board 7 #2: still sizes — 48 on cards, 40 in lines. */
export const STILL_PX = /* @__PURE__ */ Object.freeze({ card: 48, line: 40 });

const STILL = 'still';
const PLAYER = 'player';
const CSS_BLOOM = 'css';

export default function LoadoutStill({ archetype, size }) {
  const [shown, setShown] = useState(() => !hasWebGL());
  const { coreStage, armorStage } = getAgentGrowth(null);
  return (
    <span
      aria-hidden="true"
      data-loadout-still={archetype || ''}
      style={{ width: size, height: size, borderRadius: Math.round(size / 4), background: cssVar('bg-dashboard'), border: `1px solid rgba(var(--ft-scrim-rgb), 0.07)`, overflow: 'hidden', flexShrink: 0, display: 'block' }}
    >
      <span style={{ display: 'block', visibility: shown ? 'visible' : 'hidden' }}>
        <AgentForm archetype={archetype} coreStage={coreStage} armorStage={armorStage} allegiance={PLAYER} size={size} rate={STILL} label={null} bloom={CSS_BLOOM} batched clip onStatus={() => setShown(true)} />
      </span>
    </span>
  );
}
