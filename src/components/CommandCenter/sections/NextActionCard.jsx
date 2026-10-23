// src/components/CommandCenter/sections/NextActionCard.jsx
//
// Command Center hub, slice S1 — the next action (the design's NextAction,
// ff-side.jsx; spec V1.2 §8.2). With no candidate there is no card: S1 has no
// reader, so in production it renders nothing. S4 supplies the candidate
// (live game → newest ready review → first deployment → none); the layout
// fixtures show the card.
//
// A first-deployment candidate carries the hold control (spec §5.5); any
// other carries its own button. With no handler each is disabled.
//
// Slice S4 (ruling R-S4-8): the candidate comes from hub/nextAction.js. The
// two handlers are kept apart on purpose. `onAct` opens a game or a review;
// `onDeploy` is the deploy action — the very one the strip and the Deploy card
// receive — and is the hold's alone. `onAct` never reaches the hold, so the
// first-deployment card cannot start a deployment before S2b supplies
// `onDeploy`: until then the hold renders disabled, like the strip's.

import React from 'react';
import { deployDisplay } from '../hub/deployDisplay';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, tint } from '../hub/hubStyle';
import { Eyebrow, HubButton, useHubComposition } from '../HubParts';
import HubHold from './HubHold';

const CTA_ICON = { openGame: 'sword', review: 'film' };

export default function NextActionCard({ nextAction, deploy, onAct, onDeploy, onLater }) {
  const phone = useHubComposition() === 'phone';
  const candidate = nextAction?.status === 'ready' ? nextAction.candidate : null;
  if (!candidate) return null;
  const isDeploy = candidate.key === 'deploy';
  return (
    <section
      aria-label={COPY.nextAction.label}
      data-hub-next-action={candidate.key}
      style={{
        borderRadius: 18, padding: phone ? '14px 16px' : '18px 20px',
        background: `linear-gradient(135deg, ${tint('teal', 0.12)}, ${C.raised} 70%)`,
        border: `1px solid ${tint('teal', 0.35)}`, display: 'flex', flexDirection: 'column', gap: phone ? 12 : 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Eyebrow color={C.teal}>{COPY.nextAction.label}</Eyebrow>
        <div style={{ fontSize: phone ? 17 : 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.015em', marginTop: 6, lineHeight: 1.25, textWrap: 'pretty' }}>
          {candidate.title}
        </div>
        <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>{candidate.why}</div>
        {candidate.detail && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>{candidate.detail}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isDeploy ? (
          <HubHold full canStart={deployDisplay(deploy).canStart} label={COPY.deploy.hold} onDeploy={onDeploy} style={{ flex: 1 }} />
        ) : (
          <HubButton kind="primary" icon={CTA_ICON[candidate.key]} onPress={onAct} style={{ flex: 1 }}>{candidate.cta}</HubButton>
        )}
        <HubButton kind="ghost" onPress={onLater} data-hub-later="">{COPY.nextAction.later}</HubButton>
      </div>
    </section>
  );
}
