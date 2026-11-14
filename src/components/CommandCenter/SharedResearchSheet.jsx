// src/components/CommandCenter/SharedResearchSheet.jsx
//
// Command Center core spec V1.2, Amendment E V1.1 §3.2 (E-2; rulings R-D1, R-D3) — THE SHARED RESEARCH SHEET, in the Huddle's
// pattern (HuddleSheet.jsx): a HubSheet on the hub's overlay stack (the background inert, focus to Close, Escape, focus back
// to the opener — all the HubSheet's), 720 wide, full width on the phone, with the hub's own title, eyebrow and label.
//
// Its body, src/components/SharedResearch/SharedResearchSheetBody.jsx (B2), is NOT a static import. It is loaded lazily
// through hub/loadSharedResearch.js, the hub graph's second load-time edge, so the body, its screens and its service stay out
// of the hub chunk until the sheet first opens. The body is a module-scope React.lazy over the loader, inside Suspense with a
// loading line.
//
// A failed load shows its line and Try again. React keeps a rejected lazy forever, so Try again starts a FRESH import through
// the loader (which reset its promise on the failure) and swaps in a new lazy only once that import has loaded; a failed
// retry leaves the line as it was. This is the hub gate's pattern (CommandCenterHubGate.jsx createHubLoader). A body that
// throws while rendering shows the same line.
//
// The wrapper hands the body `overlayStack={useHubOverlays()}` (the body registers its SignalDrop modal `within` its own
// root) and the props of amendment §3.2's table. It holds no read, effect, timer or listener: the readers that feed it are
// ConnectedHub's, and every word comes from hub/hubCopy.js.

import React, { Component, Suspense, lazy, useState } from 'react';
import HubSheet from './HubSheet';
import { LoadingLine, HubLink } from './HubParts';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { useHubOverlays } from './hub/HubOverlays';
import { loadSharedResearch } from './hub/loadSharedResearch';
import { C } from './hub/hubStyle';

/**
 * The body's lazy component and its retries, over `load` (the real loader by default; tests hand their own). `retry()`
 * runs a fresh load and swaps in a new lazy only when it has loaded; calls while one is out share it.
 */
export function createBodyLoader(load) {
  // A synchronous throw from `load` is a rejected load too (the gate's createHubLoader).
  const attempt = () => new Promise((resolve) => { resolve(load()); });
  let Body = lazy(attempt);
  let pending = null;
  return {
    current: () => Body,
    retry() {
      if (!pending) {
        pending = attempt()
          .then((module) => { Body = lazy(() => Promise.resolve(module)); })
          .finally(() => { pending = null; });
      }
      return pending;
    },
  };
}

/** A rejected load, or a body that throws while rendering: the fallback in its place. */
class BodyBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadFailed({ onTryAgain }) {
  return (
    <div data-hub-research-load-failed="" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: C.ink2, lineHeight: 1.45 }}>
      <span>{COPY.research.door.loadFailed}</span>
      <HubLink onPress={onTryAgain}>{COPY.research.door.tryAgain}</HubLink>
    </div>
  );
}

/**
 * The sheet for one body loader. The default export below binds the real loader; tests bind ones they control.
 */
export function createSharedResearchSheet(load) {
  const loader = createBodyLoader(load);

  /**
   * @param {{ mode: 'start'|'session', sessionId?: string }} props.entry  the open sheet's entry (hub/useHubSheets.js)
   * @param {object[]} props.stories          the story selector's items, [] while loading or failed
   * @param {string|null} props.agentName     the ranked agent's given name, or null
   * @param {string|null} props.agentId       the ranked agent the Loadout card reads, or null
   * @param {string|null} props.equippedListLabel  the equipped list's name as the Loadout card shows it, or null
   * @param {boolean} props.gated             !admitted (false whenever the sheet is open)
   */
  function SharedResearchSheet({ entry = null, stories = [], agentName = null, agentId = null, equippedListLabel = null, gated = false, phone = false, onClose, opener = null, fallbackFocus = null, reducedMotion = false }) {
    const overlayStack = useHubOverlays();
    const [loads, setLoads] = useState(0);
    const Body = loader.current();
    const mode = entry?.mode === 'session' ? 'session' : 'start';
    const tryAgain = () => {
      loader.retry().then(
        () => { setLoads((n) => n + 1); },
        // The line simply stays: a failed retry leaves the sheet as it was.
        () => {},
      );
    };
    return (
      <HubSheet title={COPY.research.workTitle} eyebrow={COPY.research.workEyebrow} label={COPY.research.workLabel} phone={phone} width={720} onClose={onClose} opener={opener} fallbackFocus={fallbackFocus} reducedMotion={reducedMotion}>
        <BodyBoundary key={loads} fallback={<LoadFailed onTryAgain={tryAgain} />}>
          <Suspense fallback={<LoadingLine>{COPY.research.loading}</LoadingLine>}>
            <Body
              open
              mode={mode}
              item={null}
              direction={null}
              sessionId={mode === 'session' ? entry?.sessionId ?? null : null}
              stories={Array.isArray(stories) ? stories : []}
              agentName={agentName}
              agentId={agentId}
              equippedListLabel={equippedListLabel}
              gated={gated}
              phone={phone}
              onClose={onClose}
              overlayStack={overlayStack}
            />
          </Suspense>
        </BodyBoundary>
      </HubSheet>
    );
  }

  return SharedResearchSheet;
}

export default createSharedResearchSheet(loadSharedResearch);
