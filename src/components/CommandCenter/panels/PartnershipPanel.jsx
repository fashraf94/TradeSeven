// src/components/CommandCenter/panels/PartnershipPanel.jsx
//
// Command Center hub, slice S1 — the reserved Partnership panel (spec V1.2
// §8.3), exactly: one line, and nothing else. No control, link, count or
// record fetch, no promised availability, and it is never the default
// selection. It takes no data because there is none to take.

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C } from '../hub/hubStyle';

export default function PartnershipPanel() {
  return (
    <p data-hub-panel="partnership" style={{ margin: 0, fontSize: 13.5, color: C.ink2, lineHeight: 1.5, maxWidth: 580, textWrap: 'pretty' }}>
      {COPY.partnership.reserved}
    </p>
  );
}
