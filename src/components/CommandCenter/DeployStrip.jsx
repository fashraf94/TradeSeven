// src/components/CommandCenter/DeployStrip.jsx
//
// Command Center hub, slice S1 — the persistent game-action strip on the
// mobile site (the design's GameStrip, ff-mobile.jsx; spec V1.2 §10). Fixed
// above App's BottomNav at its measured outer height, z-index 40 (page <
// strip 40 < nav 50 < sheets), outside the tab panel so every tab keeps it.
//
// Two lines — status and loadout — and the action slot, from the display
// table in hub/deployDisplay.js. S1's state is "Checking eligibility…" with
// the shipped hold control present and disabled. The status button opens the
// Loadout tab: local presentation, the one thing the strip does in S1.
//
// Placement: `bottom` is the nav's measured height, so the safe-area inset
// the nav pads is not counted again; only with no nav does the strip pad the
// inset itself (hub/navClearance.js). The second line uses ink-2: ink-3 does
// not clear 4.5:1 on the strip's raised surface (4.38:1).

import React, { forwardRef } from 'react';
import { deployDisplay } from './hub/deployDisplay';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR_2, HUB_LAYERS } from './hub/hubStyle';
import { cssVar } from '../../theme/cssTokens';
import { HubButton } from './HubParts';
import HubHold from './sections/HubHold';

const clamp2 = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' };

const DeployStrip = forwardRef(function DeployStrip({ deploy, liveGame, loadoutLine, placement, onOpenLoadout, onOpenGame, onDeploy, onRetry }, ref) {
  const display = deployDisplay(deploy, liveGame);
  const line1 = display.stripLine1;
  const line2 = display.stripLine2(loadoutLine);
  const { hold, openGame, retry } = display.strip;
  return (
    <div
      ref={ref}
      role="region"
      aria-label={COPY.strip.regionLabel}
      data-hub-strip={display.displayState}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: placement.stripBottom, zIndex: HUB_LAYERS.strip,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px 9px 14px',
        paddingBottom: placement.stripPadsSafeArea ? 'calc(9px + env(safe-area-inset-bottom, 0px))' : 9,
        background: C.raised, borderTop: `1px solid ${HAIR_2}`,
      }}
    >
      <button
        type="button"
        onClick={onOpenLoadout}
        aria-label={COPY.strip.openLoadoutLabel(line1, line2)}
        style={{ appearance: 'none', font: 'inherit', color: 'inherit', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flex: 1, minWidth: 0, minHeight: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, textAlign: 'left', borderRadius: 8 }}
      >
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0 }}>
          <span aria-hidden="true" data-hub-strip-dot={display.dot} style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: cssVar(display.dot), boxShadow: liveGame ? `0 0 8px ${C.teal}` : 'none' }} />
          <span data-hub-strip-line="1" style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3, ...clamp2 }}>{line1}</span>
        </span>
        <span data-hub-strip-line="2" style={{ fontSize: 11, color: C.ink2, lineHeight: 1.3, paddingLeft: 14, ...clamp2 }}>{line2}</span>
      </button>
      <div style={{ display: 'flex', flexDirection: openGame && hold ? 'column' : 'row', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
        {openGame && (
          <HubButton kind="primary" icon="sword" onPress={liveGame && onOpenGame ? () => onOpenGame(liveGame) : undefined} style={{ padding: '0 14px' }}>
            {COPY.deploy.openGame}
          </HubButton>
        )}
        {hold && <HubHold compact canStart={display.canStart} label={hold.label} onDeploy={onDeploy} />}
        {retry && <HubButton kind="secondary" onPress={onRetry} style={{ padding: '0 14px' }}>{COPY.deploy.retry}</HubButton>}
      </div>
    </div>
  );
});

export default DeployStrip;
