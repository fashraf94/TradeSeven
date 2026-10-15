// src/components/CommandCenter/panels/AreaPanel.jsx
//
// Command Center hub, slice S1 — the selected area's panel (the design's
// AreaPanel and MobileSectionHead, ff-stage.jsx / ff-mobile.jsx). On the
// desktop, tablet and stacked compositions it is the tabpanel the area
// controls select; on the phone its body sits inside the tab row's panel.
//
// The heading follows the control: "Equipped Archetype" on the wider
// compositions, the phone tab's "Loadout" on the phone (prompt §4.3).
//
// The design's one-line area descriptions are not carried into S1: each names
// data the hub does not hold yet (the equipped archetype by name) or describes
// a later contract (Partnership's is replaced by its reserved line, §8.3;
// Research's content is S6's §8.1 contract).

import React from 'react';
import { motion } from 'framer-motion';
import { motionToken } from '../../../theme/motion';
import { HUB_AREAS } from '../hub/composition';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR } from '../hub/hubStyle';
import { RingGlyph } from '../HubParts';
import LoadoutPanel from './LoadoutPanel';
import PartnershipPanel from './PartnershipPanel';
import ResearchPanel from './ResearchPanel';

export function AreaBody({ area, sections, actions }) {
  if (area === HUB_AREAS.PARTNERSHIP) return <PartnershipPanel />;
  if (area === HUB_AREAS.RESEARCH) return <ResearchPanel research={sections.research} onOpenForge={actions.openResearchForge} />;
  return (
    <LoadoutPanel
      loadout={sections.loadout}
      onChangeArchetype={actions.changeArchetype}
      onChangeWatchlist={actions.changeWatchlist}
      onOpenForge={actions.openLoadoutForge}
    />
  );
}

export function AreaHeading({ area, label, size = 20 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <RingGlyph on area={area} />
      <h2 style={{ margin: 0, fontSize: size, fontWeight: 700, letterSpacing: '-0.015em', color: C.ink }}>{label}</h2>
    </div>
  );
}

/** Desktop, tablet and stacked: the tabpanel under the stage. */
export default function AreaPanel({ area, panelId, tabId, sections, actions, reducedMotion }) {
  return (
    <section
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      data-hub-area-panel={area}
      style={{ borderRadius: 20, background: C.surface, border: `1px solid ${HAIR}`, padding: '20px 24px' }}
    >
      <AreaHeading area={area} label={COPY.areas.names[area]} />
      <motion.div
        key={area}
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={motionToken('smooth', { reducedMotion })}
        style={{ marginTop: 16 }}
      >
        <AreaBody area={area} sections={sections} actions={actions} />
      </motion.div>
    </section>
  );
}
