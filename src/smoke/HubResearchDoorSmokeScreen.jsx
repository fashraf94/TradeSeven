// src/smoke/HubResearchDoorSmokeScreen.jsx — SMOKE ONLY, NEVER MERGE.
//
// The `?hubResearchDoor=1` page for the real-browser rows (src/components/CommandCenter/researchDoor.browser.test.js): the
// hub's OWN pieces, with no sign-in — the Research panel's door (panels/ResearchPanel.jsx), the sheet hook
// (hub/useHubSheets.js), the shells' research actions (CommandCenterHub.jsx researchActionsOf), Activity's research rows
// (hub/activityRows.js, sections/ActivitySection.jsx ActivityRows) and the wrapper (SharedResearchSheet.jsx), whose body
// loads through the real lazy edge (hub/loadSharedResearch.js), under HubOverlayProvider. Every request the body makes is
// answered by the smoke's routes (hubResearchDoorSmoke.js). ConnectedHub's own wiring (the readers, admission) is proven
// in jsdom (CommandCenterHub.researchDoor.jsdom.test.jsx), not here.

import React, { useRef } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { researchActionsOf } from '../components/CommandCenter/CommandCenterHub';
import SharedResearchSheet from '../components/CommandCenter/SharedResearchSheet';
import ResearchPanel from '../components/CommandCenter/panels/ResearchPanel';
import { ActivityRows } from '../components/CommandCenter/sections/ActivitySection';
import { HubLayoutContext } from '../components/CommandCenter/HubParts';
import { HubOverlayProvider } from '../components/CommandCenter/hub/HubOverlays';
import { HUB_COMPOSITIONS } from '../components/CommandCenter/hub/composition';
import { deriveActivity } from '../components/CommandCenter/hub/activityRows';
import { researchDoorOf } from '../components/CommandCenter/hub/researchDoorView';
import { C, HUB_SCOPED_CSS } from '../components/CommandCenter/hub/hubStyle';
import { HUB_SHEETS, useHubSheets } from '../components/CommandCenter/hub/useHubSheets';
import { SMOKE_RESEARCH_RECORDS, smokeStories } from './hubResearchDoorSmoke';

const STORIES = smokeStories();

function Door({ phone }) {
  const rootRef = useRef(null);
  const sheet = useHubSheets(rootRef);
  const now = Date.now();
  const door = researchDoorOf({ read: { status: 'ready', records: SMOKE_RESEARCH_RECORDS }, nowMs: now });
  const actions = researchActionsOf({ retry: () => {} }, sheet, door);
  const rows = deriveActivity({ battles: [], live: [], rowsById: new Map(), research: SMOKE_RESEARCH_RECORDS, nowMs: now }).rows;
  return (
    <HubLayoutContext.Provider value={phone ? HUB_COMPOSITIONS.PHONE : HUB_COMPOSITIONS.DESKTOP}>
      <style data-hub-css="">{HUB_SCOPED_CSS}</style>
      <section ref={rootRef} data-hub="shell" tabIndex={-1} style={{ minHeight: '100vh', background: C.bg, color: C.ink, padding: phone ? '14px 14px 24px' : '24px 28px', outline: 'none' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ResearchPanel research={{ status: 'no_idea', listName: 'Momentum Basket' }} door={door} onWork={actions.openResearch} onContinue={actions.continueResearch} onRetryDoor={() => {}} onOpenForge={() => {}} onRetry={() => {}} />
          <ActivityRows items={rows} onOpen={actions.openActivity} />
        </div>
      </section>
      {sheet.sheet === HUB_SHEETS.RESEARCH ? (
        <SharedResearchSheet entry={sheet.entry} stories={STORIES} agentName="Atlas" agentId="agent-smoke-1" equippedListLabel="Momentum Basket" gated={false} phone={phone} onClose={sheet.close} opener={sheet.opener} fallbackFocus={sheet.fallback} />
      ) : null}
    </HubLayoutContext.Provider>
  );
}

export default function HubResearchDoorSmokeScreen() {
  const phone = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <ThemeProvider>
      <HubOverlayProvider>
        <Door phone={phone} />
      </HubOverlayProvider>
    </ThemeProvider>
  );
}
