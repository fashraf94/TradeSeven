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
//     While the sheet is open it is inert by its own prop (it may appear while the sheet is open: review B-8).
//   - It is not in the tab order twice: its button takes no Tab stop (the panel's button keeps the one, and
//     focusing it scrolls it on screen, which hides the bar); neither is hidden from assistive tech.
//   - Reduced motion: it appears without a transition.
//   - Build 2 (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.3, B-13; build prompt K-10): below
//     1000 px the chosen question rides on one line beside the action, as a button that jumps to the chooser; the
//     cost or the state goes under both. From 1000 px the bar is as built (the question's button is not drawn).

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { motionToken } from '../../theme/motion';
import { BOTTOM_NAV_PX, EXPLORE_LAYERS, S, T, btnStyle, wash } from './exploreStyle';
import { EXPLORE_COPY } from './exploreCopy';

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
export default function ExplorePinnedBar({ targetRef, targetKey, label, line = null, onAct, disabled = false, refreshing = false, inertNow = false, navBelow = false, left = 0, question = null, onQuestion = null }) {
  const [offScreen, setOffScreen] = useState(false);
  const reducedMotion = useReducedMotion() === true;
  const barRef = useRef(null);

  useEffect(() => {
    const target = targetRef?.current ?? null;
    if (!target || typeof IntersectionObserver !== 'function') { setOffScreen(false); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      const onScreen = onScreenOf(entries[entries.length - 1]);
      // The bar leaves while its own button holds focus (a sheet opened from it, then closed): focus goes to the panel's
      // button — the same action, now on screen — never to <body> (review C-3).
      if (onScreen && barRef.current?.contains(document.activeElement)) target.focus({ preventScroll: true });
      setOffScreen(!onScreen);
    }, { threshold: [0, 0.99, 1], rootMargin: navBelow ? `0px 0px -${BOTTOM_NAV_PX}px 0px` : '0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef, targetKey, navBelow]);

  // While the bar is shown, the page keeps its band clear for focus: a control reached by Tab is scrolled above the bar,
  // never left under it (scroll-padding-bottom; review C-2). Put back exactly as it was when the bar goes — but only
  // while the value there is still the bar's own: on a phone the tab reserves the nav's band under it (Build 2 review
  // P-2), and when Explore goes with the bar shown the tab gives its value back first (the refuter's leak).
  const shown = offScreen && Boolean(label);
  useLayoutEffect(() => {
    if (!shown) return undefined;
    const root = document.documentElement;
    const before = root.style.scrollPaddingBottom;
    let mine = null;
    // the bar's laid-out top (offsetTop ignores the entrance animation's transform, which a box measure would catch
    // mid-slide), and a little room above it
    const reserve = () => {
      const top = barRef.current?.offsetTop;
      if (!Number.isFinite(top)) return;
      mine = `${Math.max(0, Math.ceil(window.innerHeight - top) + 8)}px`;
      root.style.scrollPaddingBottom = mine;
    };
    reserve();
    window.addEventListener('resize', reserve);
    return () => {
      window.removeEventListener('resize', reserve);
      if (mine !== null && root.style.scrollPaddingBottom === mine) root.style.scrollPaddingBottom = before;
    };
  }, [shown, line, navBelow]);

  if (!shown) return null;
  return createPortal(
    <motion.div
      ref={barRef}
      className="ftx-portal"
      data-explore-pinned-bar=""
      inert={inertNow ? true : undefined}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionToken('fade', { reducedMotion })}
      style={{
        position: 'fixed', left, right: 0, bottom: navBelow ? `calc(${BOTTOM_NAV_PX}px + env(safe-area-inset-bottom, 0px))` : 0,
        zIndex: EXPLORE_LAYERS.bar, padding: navBelow ? '10px 16px' : '12px 24px calc(12px + env(safe-area-inset-bottom, 0px))',
        background: T.bg, borderTop: `1px solid ${T.hair}`, boxShadow: `0 -12px 30px ${wash('shadow', 0.45)}`,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', columnGap: 12, rowGap: 4, flexWrap: 'wrap' }}>
        {question ? (
          <button
            type="button"
            className="ftx-btn ftx-phone-only"
            tabIndex={-1}
            aria-label={EXPLORE_COPY.bar.toQuestions(question)}
            data-explore-bar-question=""
            onClick={onQuestion ?? undefined}
            style={{ appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: 0, minHeight: 44, flex: '1 1 0', minWidth: 0, cursor: 'pointer', color: T.ink, textAlign: 'left' }}
          >
            <span className="ftx-oneline" style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{question}</span>
          </button>
        ) : null}
        <button type="button" className="ftx-btn" tabIndex={-1} data-explore-bar-action="" disabled={disabled} aria-disabled={refreshing ? 'true' : undefined} onClick={disabled || refreshing ? undefined : onAct} style={{ ...btnStyle('primary', { disabled: disabled || refreshing }), flexShrink: 0 }}>
          <span style={{ fontSize: 15, lineHeight: 1.3 }}>{label}</span>
        </button>
        {line && <p className="ftx-bar-line" style={S.small} data-explore-bar-line="">{line}</p>}
      </div>
    </motion.div>,
    document.body,
  );
}
