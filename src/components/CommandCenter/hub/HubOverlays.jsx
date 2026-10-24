// src/components/CommandCenter/hub/HubOverlays.jsx
//
// Command Center hub, slice S5 — React's side of the overlay stack
// (hub/overlayStack.js): one stack per hub, `modalOpen` as state, and
// everything released if the hub unmounts.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createOverlayStack } from './overlayStack';

const HubOverlayContext = createContext(null);

/**
 * The stack used by a sheet rendered outside any hub (a test, a story): one shared instance that is NOT a hub's, so
 * what registers with it is invisible to every hub's `modalOpen`. An overlay that must count (S2b's Scouting Board
 * and deploy ceremony) renders inside the hub's provider.
 */
let standalone = null;
const standaloneStack = () => {
  if (!standalone) standalone = createOverlayStack();
  return standalone;
};

/**
 * The hub root's provider. Slice S2b: `onOpen` is called synchronously when the stack goes from empty to open, in
 * the task that opened the overlay — the deploy provider's cancel of an uncommitted hold (spec §10: "An overlay
 * opening pre-commit cancels that hold"; R2 Fable FR2-4).
 */
export function HubOverlayProvider({ children, onOpen = null }) {
  const [modalOpen, setModalOpen] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const stackRef = useRef(null);
  if (!stackRef.current) {
    stackRef.current = createOverlayStack({
      onChange: (open) => {
        setModalOpen(open);
        if (open && typeof onOpenRef.current === 'function') onOpenRef.current();
      },
    });
  }
  useEffect(() => {
    const stack = stackRef.current;
    // A hub that unmounts with a sheet open (the watchlist sheet's Forge button opens the Forge, which replaces
    // the dashboard; a site flip remounts the whole hub under the gate's frame) must not leave the app's root inert
    // behind it. Focus was inside what was removed, so it has fallen to <body>: if a new hub is already on screen
    // (the site flip) its shell takes it; with none (the Forge) nothing moves. A focus that is anywhere live stays.
    return () => {
      const had = stack.depth > 0;
      stack.releaseAll();
      if (had && document.activeElement === document.body) document.querySelector('[data-hub="shell"]')?.focus();
    };
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
