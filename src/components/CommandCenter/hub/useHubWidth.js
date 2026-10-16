// src/components/CommandCenter/hub/useHubWidth.js
//
// Command Center hub, slice S1 — the hub's own content width (founder ruling
// R-S1-3; the design's useFfMode precedent, ff-ui.jsx). The hub composes by
// the width it is given, never by window.innerWidth: on the desktop site the
// sidebar takes 64 or 220 px of the window, so an 834 px tablet with the
// sidebar expanded hands the hub 614 px.
//
// One ResizeObserver on the hub's root, read once before paint and again on
// every resize. Its only effect is this width; it reads no data and sets no
// timer. null until the first measurement.

import { useLayoutEffect, useState } from 'react';

export function useHubWidth(ref) {
  const [width, setWidth] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
