// src/components/CommandCenter/hubFallbackSignal.jsx
//
// Command Center hub, slice S5 — the gate's one signal to App (ruling R-S5-7:
// the floating bug button and the season banner are withheld "whenever the hub
// is the rendered dashboard"). The gate renders this ONLY inside its fallback,
// the legacy shell it shows because the hub's chunk failed to load. While it is
// mounted the hub is not on screen, and App gives the button and the banner back.
//
//   mount    onFallback(true)
//   unmount  onFallback(false)   Retry that loads the hub, the gate going away
//                                (navigation, the Forge opening over the
//                                dashboard) and StrictMode's probe: one effect
//                                covers every way out of the fallback.
//
// A LAYOUT effect, on purpose: App's `hidden` is then already right in the same
// turn as the commit that swaps the fallback and the hub. A passive effect
// leaves it wrong for a turn each way (the button hidden over the legacy shell,
// shown over the hub after Retry). `onFallback` must be stable (App hands a state
// setter). Without it, as for every caller before S5, this does nothing. It
// renders nothing and reads nothing, and it exists only on the hub-flag-on path:
// with the flag off the gate is never rendered.

import { useLayoutEffect } from 'react';

export default function HubFallbackSignal({ onFallback }) {
  useLayoutEffect(() => {
    if (typeof onFallback !== 'function') return undefined;
    onFallback(true);
    return () => onFallback(false);
  }, [onFallback]);
  return null;
}
