// src/components/CommandCenter/CommandCenterHub.jsx
//
// Command Center hub — the lazily loaded hub module (spec V1.2 §2). At S0 it is
// a TEMPORARY SCAFFOLD: one plain labelled placeholder, so the gate's
// `import('./CommandCenterHub')` resolves at build time and the chunk exists.
// No simulated product, no data, no props, no effects. S1 replaces the body
// with the approved shell.
//
// Nothing imports this module statically. Only CommandCenterHubGate's dynamic
// import reaches it, so it ships in its own chunk and is requested only when
// the gate renders (the hub flag on).

import React from 'react';
import { cssVar } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';

export default function CommandCenterHub() {
  return (
    <section
      aria-label={COPY.regionLabel}
      data-hub="placeholder"
      style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '48px 24px 96px', color: cssVar('text-primary') }}
    >
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{COPY.placeholderTitle}</h1>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: cssVar('text-secondary') }}>{COPY.placeholderBody}</p>
    </section>
  );
}
