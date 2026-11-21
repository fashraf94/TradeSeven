// src/components/Explore/ExplorePinnedBar.jsx
//
// Explore Build 1 — THE PINNED BAR (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.4, N-6, E-4;
// build prompt K-14). On the story reader, the panel's primary action (Work this idea or Continue research) is on
// screen at every scroll position: in the panel, or — while the panel's own button is off screen — in this bar,
// fixed to the bottom of the screen above the phone's nav, with the same action and its line in small type.
//
//   - ONE IntersectionObserver, on the panel's own primary button. The bar shows only while that button is not
//     fully on screen (the band behind the phone's bottom nav counts as off screen), on every screen size.
//   - It is portalled into <body>: the page's ancestors animate with transforms, which would carry a fixed box.
//     So the sheet's host marks it inert with the rest of the page.
//   - It is not in the tab order twice: its button takes no Tab stop (the panel's button keeps the one, and
//     focusing it scrolls it on screen, which hides the bar); neither is hidden from assistive tech.
//   - Reduced motion: it appears without a transition.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { BOTTOM_NAV_PX, EXPLORE_LAYERS, S, T, btnStyle, wash } from './exploreStyle';

/** Whether the observed button counts as on screen: fully inside the viewport less the nav band. */
export const onScreenOf = (entry) => Boolean(entry?.isIntersecting) && entry.intersectionRatio >= 0.99;

/**
 * @param {object}   p
 * @param {{ current: HTMLElement|null }} p.targetRef  the panel's own primary button (null: no action, no bar)
 * @param {string}   p.targetKey   changes when the button is replaced, so the observer follows it
 * @param {string}   p.label       the action's words (the panel's own)
 * @param {string|null} p.line     the cost line, or the progress line, in small type
 * @param {(event) => void} p.onAct  the panel's own handler
 * @param {boolean}  p.navBelow    the phone's bottom nav is on screen
 * @param {number}   p.left        the desktop sidebar's width
 */
export default function ExplorePinnedBar({ targetRef, targetKey, label, line = null, onAct, disabled = false, navBelow = false, left = 0 }) {
  const [offScreen, setOffScreen] = useState(false);
  const reducedMotion = useReducedMotion() === true;

  useEffect(() => {
    const target = targetRef?.current ?? null;
    if (!target || typeof IntersectionObserver !== 'function') { setOffScreen(false); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      setOffScreen(!onScreenOf(entry));
    }, { threshold: [0, 0.99, 1], rootMargin: navBelow ? `0px 0px -${BOTTOM_NAV_PX}px 0px` : '0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef, targetKey, navBelow]);

  if (!offScreen || !label) return null;
  return createPortal(
    <motion.div
      className="ftx-portal"
      data-explore-pinned-bar=""
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionToken('fade', { reducedMotion })}
      style={{
        position: 'fixed', left, right: 0, bottom: navBelow ? `calc(${BOTTOM_NAV_PX}px + env(safe-area-inset-bottom, 0px))` : 0,
        zIndex: EXPLORE_LAYERS.bar, padding: navBelow ? '10px 16px' : '12px 24px calc(12px + env(safe-area-inset-bottom, 0px))',
        background: T.bg, borderTop: `1px solid ${T.hair}`, boxShadow: `0 -12px 30px ${wash('shadow', 0.45)}`,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="ftx-btn" tabIndex={-1} data-explore-bar-action="" disabled={disabled} onClick={disabled ? undefined : onAct} style={{ ...btnStyle('primary', { disabled }), flexShrink: 0 }}>
          <span style={{ fontSize: 15, lineHeight: 1.3 }}>{label}</span>
        </button>
        {line && <p style={{ ...S.small, flex: '1 1 160px' }}>{line}</p>}
      </div>
    </motion.div>,
    document.body,
  );
}
