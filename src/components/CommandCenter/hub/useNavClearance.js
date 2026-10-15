// src/components/CommandCenter/hub/useNavClearance.js
//
// Command Center hub, slice S1 — the mobile strip's placement from the
// MEASURED outer heights of App's BottomNav and of the strip itself (spec
// V1.2 §10; prompt §4.5). The math is navClearance() in ./navClearance.js.
//
// BottomNav belongs to App, so the hub finds it by the attribute it carries
// (BOTTOM_NAV_ATTRIBUTE) and measures its border box with a ResizeObserver;
// the strip is measured the same way. The lookup runs after every render, so a
// nav that mounts after the hub is picked up on the next one, and a replaced
// nav is re-observed. One ResizeObserver watches both elements; no timer, no
// read of any record.

import { useLayoutEffect, useRef, useState } from 'react';
import { BOTTOM_NAV_ATTRIBUTE, navClearance } from './navClearance';

const borderBoxHeight = (el) => (el ? el.getBoundingClientRect().height : 0);

export function useNavClearance(stripRef) {
  const [heights, setHeights] = useState({ navHeight: 0, stripHeight: 0 });
  const navRef = useRef(null);
  const stripElRef = useRef(null);
  const observerRef = useRef(null);

  // After every render: (re)find the nav, observe it and the strip once each.
  useLayoutEffect(() => {
    const nav = document.querySelector(`[${BOTTOM_NAV_ATTRIBUTE}]`);
    const strip = stripRef.current;
    const measure = () => {
      const next = { navHeight: borderBoxHeight(navRef.current), stripHeight: borderBoxHeight(stripElRef.current) };
      setHeights((prev) => (prev.navHeight === next.navHeight && prev.stripHeight === next.stripHeight ? prev : next));
    };
    if (nav !== navRef.current || strip !== stripElRef.current || !observerRef.current) {
      observerRef.current?.disconnect();
      navRef.current = nav;
      stripElRef.current = strip;
      observerRef.current = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
      if (observerRef.current) {
        if (nav) observerRef.current.observe(nav);
        if (strip) observerRef.current.observe(strip);
      }
    }
    measure();
  });

  // Unmount: let go of both elements.
  useLayoutEffect(() => () => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    navRef.current = null;
    stripElRef.current = null;
  }, []);

  return navClearance(heights);
}
