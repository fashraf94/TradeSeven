// src/components/CommandCenter/panels/ResearchPanel.jsx
//
// Command Center hub, slice S1 — the Shared Research panel's frame (spec V1.2
// §8.1). S1 renders its loading state and the Forge action, disabled: S6
// supplies the equipped list's current idea through the existing list reader
// and wires the action. The hub never writes research (§8.1: Forge is the
// action surface).

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { HubButton, LoadingLine } from '../HubParts';

export default function ResearchPanel({ research, onOpenForge }) {
  return (
    <div data-hub-panel="research" data-hub-status-of={research?.status || 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <LoadingLine>{COPY.research.loading}</LoadingLine>
      <HubButton kind="accent" small icon="hammer" onPress={onOpenForge}>{COPY.research.openForge}</HubButton>
    </div>
  );
}
