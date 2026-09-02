// src/screens/battleView/useChatSheet.js
//
// The mobile chat sheet's detent state machine (Phase A, A4). PURE helpers
// plus one small hook; nothing here touches the DOM except the viewport
// height listener, which is inert unless the sheet is enabled.
//
// Three detents (design brief §3, rulings §3.9-3.10):
//   peek  — the turn line and the composer; the board stays the page.
//   half  — the conversation beside the board.
//   full  — the conversation as the page, the header still reachable.
// The keyboard control CYCLES peek → half → full → peek; a pull on the
// grabber raises or lowers one detent; the Why? door opens to AT LEAST half.
//
// The sheet is NON-MODAL: nothing behind it is inert, the board stays
// tappable at peek and half. Focus is moved into the sheet on expand and back
// to the invoking control on collapse — the invoker is captured by the
// caller SYNCHRONOUSLY in its event handler (returnFocusRef), because by the
// time an effect runs the chat's own prefill effect may already have moved
// focus into the composer (child effects fire first).

import { useCallback, useEffect, useRef, useState } from 'react';

export const SHEET_DETENT = Object.freeze({
  PEEK: 'peek',
  HALF: 'half',
  FULL: 'full',
});

const ORDER = Object.freeze([SHEET_DETENT.PEEK, SHEET_DETENT.HALF, SHEET_DETENT.FULL]);

/** Peek: the handle row, the budget row and the composer — nothing else. */
export const SHEET_PEEK_PX = 148;
/** Full leaves this much of the header visible above the sheet. */
export const SHEET_FULL_TOP_GAP_PX = 56;
/** Half is this share of the viewport. */
export const SHEET_HALF_RATIO = 0.5;
/** A pull on the grabber shorter than this is not a detent change. */
export const SHEET_DRAG_PX = 40;
/** The viewport height assumed with no window (SSR) or a zero reading. */
export const DEFAULT_VIEWPORT_HEIGHT = 800;

const indexOf = (detent) => {
  const i = ORDER.indexOf(detent);
  return i < 0 ? 0 : i;
};

export const isDetent = (value) => ORDER.includes(value);
export const isSheetOpen = (detent) => detent === SHEET_DETENT.HALF || detent === SHEET_DETENT.FULL;

/** The keyboard cycle: peek → half → full → peek. */
export const nextDetent = (detent) => ORDER[(indexOf(detent) + 1) % ORDER.length];
/** One detent up (full stays full). */
export const raiseDetent = (detent) => ORDER[Math.min(indexOf(detent) + 1, ORDER.length - 1)];
/** One detent down (peek stays peek). */
export const lowerDetent = (detent) => ORDER[Math.max(indexOf(detent) - 1, 0)];
/** The door's target: at least half — an open sheet keeps its detent. */
export const atLeastHalf = (detent) => (isSheetOpen(detent) ? detent : SHEET_DETENT.HALF);

/** The sheet's height for a detent, in px, from the viewport height. */
export function detentHeightPx(detent, viewportHeight) {
  const vh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : DEFAULT_VIEWPORT_HEIGHT;
  if (detent === SHEET_DETENT.FULL) return Math.max(SHEET_PEEK_PX, Math.round(vh - SHEET_FULL_TOP_GAP_PX));
  if (detent === SHEET_DETENT.HALF) return Math.max(SHEET_PEEK_PX, Math.round(vh * SHEET_HALF_RATIO));
  return SHEET_PEEK_PX;
}

/** The VISIBLE viewport height: the visual viewport where the browser has one
 * (iOS shrinks it for the software keyboard and the toolbars without firing a
 * window resize — review L2-F11), else the window's inner height. */
export function readViewportHeight() {
  if (typeof window === 'undefined') return DEFAULT_VIEWPORT_HEIGHT;
  const visual = window.visualViewport && window.visualViewport.height;
  return Math.round(visual || window.innerHeight || DEFAULT_VIEWPORT_HEIGHT);
}

/**
 * The viewport height, refreshed on resize / orientation change / the visual
 * viewport's own resize (the keyboard). Listeners only while enabled (the
 * controller under the flag); a constant otherwise.
 */
export function useViewportHeight(enabled) {
  const [height, setHeight] = useState(readViewportHeight);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const onResize = () => setHeight(readViewportHeight());
    onResize();
    window.addEventListener('resize', onResize);
    const visual = window.visualViewport;
    if (visual && typeof visual.addEventListener === 'function') visual.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (visual && typeof visual.removeEventListener === 'function') visual.removeEventListener('resize', onResize);
    };
  }, [enabled]);
  return height;
}

/**
 * The detent, its setters, and the element focus returns to on collapse.
 *
 * `setDetent(next, invoker)` records `invoker` as the return-focus target
 * whenever the sheet goes from peek to open; `open(invoker)` is the door's
 * "at least half"; `collapse()` is peek. Disabled (desktop, or flag-off) the
 * detent reads peek and resets to peek, so a viewport that crosses the
 * breakpoint and comes back starts closed.
 *
 * @param {boolean} enabled
 */
export function useChatSheet(enabled) {
  const [detent, setDetentState] = useState(SHEET_DETENT.PEEK);
  const returnFocusRef = useRef(null);

  const setDetent = useCallback((next, invoker = null) => {
    setDetentState((current) => {
      const target = isDetent(next) ? next : current;
      if (!isSheetOpen(current) && isSheetOpen(target)) returnFocusRef.current = invoker;
      return target;
    });
  }, []);

  const open = useCallback((invoker = null) => {
    setDetentState((current) => {
      if (isSheetOpen(current)) return current;
      returnFocusRef.current = invoker;
      return SHEET_DETENT.HALF;
    });
  }, []);

  const collapse = useCallback(() => setDetentState(SHEET_DETENT.PEEK), []);

  useEffect(() => {
    if (!enabled) setDetentState(SHEET_DETENT.PEEK);
  }, [enabled]);

  return {
    detent: enabled ? detent : SHEET_DETENT.PEEK,
    setDetent,
    open,
    collapse,
    returnFocusRef,
  };
}

export default useChatSheet;
