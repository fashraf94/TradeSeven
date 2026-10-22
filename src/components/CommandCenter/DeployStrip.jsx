// src/components/CommandCenter/DeployStrip.jsx
//
// Command Center hub, slice S1 — the persistent game-action strip on the
// mobile site (the design's GameStrip, ff-mobile.jsx; spec V1.2 §10). Fixed
// above App's BottomNav at its measured outer height, z-index 40 (page <
// strip 40 < nav 50 < sheets), outside the tab panel so every tab keeps it.
//
// Two lines — status and loadout, clamped (slice S3, below) — and the action
// slot, from the display table in hub/deployDisplay.js. In production the state is "Checking
// eligibility…" with the shipped hold control present and disabled. The
// status button opens the Loadout tab: local presentation, the one thing the
// strip does before S2b. Slice S2a: the slot also carries the state's one
// action (Retry, Open game, Enter battle, Check deployment, Open in the
// Forge) through `onAction(kind)`, disabled with no handler.
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

// The strip's height rule (slice S3, founder ruling R-S3-1 on Q-S2A-2): the
// first line clamps at two lines and the second at one, each with an ellipsis,
// so the strip keeps the design's height whatever the words. The full words
// stay on the Deploy card — on the phone, the Loadout tab's card
// (sections/DeploySection.jsx PhoneDeployCard) — and the status button's
// accessible name carries both lines whole. The review-due refusal says
// "Deployment refused" here, with Open in the Forge as its action; the
// server's line is on the card (hub/deployDisplay.js). S2a's unclamped lines
// (S1 review L3-13) grew the strip to 117 px at 360; the S3 report records the
// tallest state measured under this rule.
const clampTwo = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', minWidth: 0 };
const clampOne = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

const DeployStrip = forwardRef(function DeployStrip({ deploy, liveGame, loadoutLine, placement, onOpenLoadout, onOpenGame, onDeploy, onAction }, ref) {
  const display = deployDisplay(deploy, liveGame);
  const line1 = display.stripLine1;
  const line2 = display.stripLine2(loadoutLine);
  const { hold, openGame, action } = display.strip;
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
          <span data-hub-strip-line="1" style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3, ...clampTwo }}>{line1}</span>
        </span>
        <span data-hub-strip-line="2" style={{ fontSize: 11, color: C.ink2, lineHeight: 1.3, paddingLeft: 14, ...clampOne }}>{line2}</span>
      </button>
      {/* One row, never the design's column: a live game with deploy still ready (spec §10's ranked-only case) would otherwise grow the strip past the design's 63–69 px. */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
        {openGame && (
          <HubButton kind="primary" icon="sword" onPress={liveGame && onOpenGame ? () => onOpenGame(liveGame) : undefined} ariaLabel={COPY.deploy.openGame} style={{ padding: hold ? '0 12px' : '0 14px' }}>
            {hold ? COPY.deploy.openGameShort : COPY.deploy.openGame}
          </HubButton>
        )}
        {hold && <HubHold compact canStart={display.canStart} label={hold.label} onDeploy={onDeploy} />}
        {action && (
          <HubButton kind="secondary" onPress={onAction ? () => onAction(action.kind) : undefined} style={{ padding: '0 14px' }}>
            {action.label}
          </HubButton>
        )}
      </div>
    </div>
  );
});

export default DeployStrip;
