// src/components/CommandCenter/sections/HubHold.jsx
//
// Command Center hub, slice S1 — the hub's hold control: the SHIPPED
// HoldToDeployButton (src/components/Dashboard/deployCeremony/), never a new
// one. Its 1,300 ms hold, keyboard path and commit beat are the shipped ones;
// the design's 1.5 s HoldDeploy is a prototype value (prompt §4.4).
//
// S1 wires no deployment (S2b does, after the R1/R2 repairs), so the control
// is live only when BOTH the display state allows a start AND a handler was
// supplied. In S1 neither is true: the control renders disabled, with no
// onComplete, and its hook schedules no frame, timer or sky intent.
//
// The accent is the design's action blue, read as a computed hex because the
// shipped button composes it with alpha(), which parses hex only (BUILD_RULES
// §10). Disabled, it takes the design's disabled look (ff-space.jsx
// HoldDeploy): the raised surface, the secondary ink, a hairline.

import React from 'react';
import { readToken } from '../../../theme/cssTokens';
import HoldToDeployButton from '../../Dashboard/deployCeremony/HoldToDeployButton';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR_2 } from '../hub/hubStyle';
import { BoltIcon } from '../HubParts';

export default function HubHold({ label, canStart = false, onDeploy, full = false, compact = false, style }) {
  const live = canStart === true && typeof onDeploy === 'function';
  const accent = readToken('blue-action') || undefined;
  return (
    <HoldToDeployButton
      label={label}
      Icon={BoltIcon}
      iconSize={17}
      accent={accent}
      enabled={live}
      disabled={!live}
      onComplete={live ? onDeploy : undefined}
      ariaLabel={COPY.deploy.holdLabel}
      style={{
        minHeight: compact ? 44 : 48,
        padding: compact ? '0 14px' : '0 18px',
        width: full ? '100%' : 'auto',
        borderRadius: 12,
        fontSize: compact ? 14 : 15,
        whiteSpace: 'nowrap',
        ...(live ? null : { background: C.raised, color: C.ink2, border: `1px solid ${HAIR_2}`, opacity: 0.55, cursor: 'not-allowed' }),
        ...style,
      }}
    />
  );
}
