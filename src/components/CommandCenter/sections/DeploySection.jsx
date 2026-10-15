// src/components/CommandCenter/sections/DeploySection.jsx
//
// Command Center hub, slice S1 — the Deploy card on the desktop, tablet and
// stacked compositions (the design's DeploySection, ff-side.jsx; spec V1.2
// §3.1, §5.5). S1 renders "Send Shadow into a game" with "Checking
// eligibility…", the shipped hold control disabled with no onComplete, and the
// spec's pointer and keyboard helper lines. The other display states come
// from the layout fixtures until S2a/S2b (hub/deployDisplay.js).
//
// The state line is not a second live region: the stage's status line is the
// hub's one (spec §10).

import React from 'react';
import { deployDisplay } from '../hub/deployDisplay';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, tint } from '../hub/hubStyle';
import { Card, HubLink, Icon, Section } from '../HubParts';
import HubHold from './HubHold';

const LINE_ICON_COLOR = { lock: C.ink3, info: C.copper, check: C.pos };

export default function DeploySection({ deploy, loadoutLine, onDeploy, onOpenLoadout, onRetry }) {
  const display = deployDisplay(deploy);
  const tinted = display.displayState === 'ready';
  const line = display.cardLine;
  return (
    <Section label={COPY.deploy.label} data-hub-section="deploy">
      <Card
        accent={tinted ? 'blue-action' : null}
        data-hub-deploy={display.displayState}
        style={{ background: tinted ? `linear-gradient(135deg, ${tint('blue-action', 0.1)}, ${C.surface} 70%)` : C.surface }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{COPY.deploy.title}</div>
        <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.5 }}>
          <span>{loadoutLine}</span>
          <span>{COPY.sep}</span>
          <HubLink onPress={onOpenLoadout}>{COPY.deploy.loadoutLink}</HubLink>
        </div>
        <div style={{ marginTop: 14 }}>
          <HubHold full canStart={display.canStart} label={display.cardHoldLabel} onDeploy={onDeploy} />
        </div>
        {line && (
          <div data-hub-deploy-line="" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 12.5, color: C.ink2, lineHeight: 1.45 }}>
            {line.icon ? (
              <span style={{ color: LINE_ICON_COLOR[line.icon], display: 'flex', marginTop: 2 }}><Icon name={line.icon} size={14} /></span>
            ) : (
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: display.displayState === 'submitting' ? C.blue : C.ink2, marginTop: 5, flexShrink: 0 }} />
            )}
            <span>
              {line.text}
              {line.retry && (
                <>
                  <span>{COPY.sep}</span>
                  <HubLink onPress={onRetry}>{COPY.deploy.retry}</HubLink>
                </>
              )}
            </span>
          </div>
        )}
        <div data-hub-hold-help="" style={{ marginTop: 10, fontSize: 12.5, color: tinted ? C.ink2 : C.ink3, lineHeight: 1.45 }}>
          <div>{COPY.deploy.pointerHelp}</div>
          <div>{COPY.deploy.keyboardHelp}</div>
        </div>
      </Card>
    </Section>
  );
}
