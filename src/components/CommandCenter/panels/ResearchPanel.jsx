// src/components/CommandCenter/panels/ResearchPanel.jsx
//
// Command Center hub, slice S1 — the Shared Research panel's frame (spec V1.2
// §8.1). S1 renders its loading state and the Forge action, disabled: S6
// supplies the equipped list's current idea through the existing list reader
// and wires the action. The hub never writes research (§8.1: Forge is the
// action surface).

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { Eyebrow, HubButton, LoadingLine } from '../HubParts';

export default function ResearchPanel({ research, onOpenForge }) {
  return (
    <div data-hub-panel="research" data-hub-status-of={research?.status || 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* The design's header row: the eyebrow, and the action on the right (ff-stage.jsx ResearchPanel). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Eyebrow>{COPY.research.ideas}</Eyebrow>
        <HubButton kind="accent" small icon="hammer" onPress={onOpenForge}>{COPY.research.openForge}</HubButton>
      </div>
      <LoadingLine>{COPY.research.loading}</LoadingLine>
    </div>
  );
}
