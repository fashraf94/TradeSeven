// src/components/CommandCenter/hub/HubOverlays.jsx
//
// Command Center hub, slice S5 — React's side of the overlay stack
// (hub/overlayStack.js): one stack per hub, `modalOpen` as state, and
// everything released if the hub unmounts.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createOverlayStack } from './overlayStack';

const HubOverlayContext = createContext(null);

/** The stack used by a sheet rendered outside any hub (a test, a story): one shared instance. */
let standalone = null;
const standaloneStack = () => {
  if (!standalone) standalone = createOverlayStack();
  return standalone;
};

/** The hub root's provider. */
export function HubOverlayProvider({ children }) {
  const [modalOpen, setModalOpen] = useState(false);
  const stackRef = useRef(null);
  if (!stackRef.current) stackRef.current = createOverlayStack({ onChange: setModalOpen });
  useEffect(() => {
    const stack = stackRef.current;
    // A hub that unmounts with a sheet open (the watchlist sheet's Forge button opens the Forge, which replaces
    // the dashboard) must not leave the app's root inert behind it.
    return () => { stack.releaseAll(); };
  }, []);
  const value = useMemo(() => ({ stack: stackRef.current, modalOpen }), [modalOpen]);
  return <HubOverlayContext.Provider value={value}>{children}</HubOverlayContext.Provider>;
}

/** The overlay stack of the enclosing hub, or the standalone one. */
export function useHubOverlays() {
  const context = useContext(HubOverlayContext);
  return context ? context.stack : standaloneStack();
}

/** True while any hub overlay is open — S2b's deploy selector input (`modalOpen`). */
export function useHubModalOpen() {
  const context = useContext(HubOverlayContext);
  return context ? context.modalOpen : false;
}
