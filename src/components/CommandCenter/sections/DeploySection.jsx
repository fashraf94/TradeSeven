// src/components/CommandCenter/sections/DeploySection.jsx
//
// Command Center hub — the Deploy card on the desktop, tablet and stacked
// compositions (the design's DeploySection, ff-side.jsx; spec V1.2 §3.1,
// §5.5). Slice S1 laid it down: "Send Shadow into a game", the shipped hold
// control disabled with no onComplete, and the spec's pointer and keyboard
// helper lines. Slice S2a renders every display state of hub/deployDisplay.js:
// the state's line with its one action, and the freshness note under it. In
// production the selector reads S2a's unresolved inputs as "Checking
// eligibility…"; S3 and S2b supply real ones.
//
// Every action goes through `onAction(kind)`; with no handler (S2a wires none)
// each renders disabled. A read's Retry and an attempt's Retry are different
// kinds, so wiring one can never start the other.
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

function ActionLink({ action, onAction }) {
  if (!action) return null;
  return (
    <>
      <span>{COPY.sep}</span>
      <HubLink onPress={onAction ? () => onAction(action.kind) : undefined}>{action.label}</HubLink>
    </>
  );
}

export default function DeploySection({ deploy, loadoutLine, onDeploy, onOpenLoadout, onAction }) {
  const display = deployDisplay(deploy);
  const tinted = display.displayState === 'ready' || display.displayState === 'ready_stale';
  const line = display.cardLine;
  const note = display.cardNote;
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
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: display.dot === 'blue-action' ? C.blue : C.ink2, marginTop: 5, flexShrink: 0 }} />
            )}
            <span>
              {line.text}
              <ActionLink action={line.action} onAction={onAction} />
            </span>
          </div>
        )}
        {note && (
          <div data-hub-deploy-note="" style={{ marginTop: 6, paddingLeft: 22, fontSize: 12.5, color: C.ink2, lineHeight: 1.45 }}>
            {note.text}
            <ActionLink action={note.action} onAction={onAction} />
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
