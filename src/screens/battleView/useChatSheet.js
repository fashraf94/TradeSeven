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

/**
 * Peek sizes itself to its content (the sheet's height is `auto` there); this
 * is the floor for the other detents and the clearance the mobile board
 * reserves. It is the base peek height measured in Chromium under the
 * production cascade (no preflight; buttons forced to 16 px): the handle
 * row 39 + the budget row 24 + the one-line input row 105 (review refuter A).
 */
export const SHEET_PEEK_PX = 172;
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
 * The part of the LAYOUT viewport that the browser's own chrome is covering —
 * the gap `position: fixed` does not know about.
 *
 * A3 F3. `position: fixed` anchors to the LAYOUT viewport, so an element pinned
 * to `bottom: 0` sits under iOS's toolbar rather than above it — the same
 * mismatch readViewportHeight() exists for, one step further on. The sheet only
 * needed the visual HEIGHT because it is pinned to `bottom: 0` and sized; the
 * character mark is pinned to the bottom with nothing behind it, so it needs
 * the OFFSET too or the player loses the one door back into the pane behind a
 * strip of browser chrome.
 *
 * Takes the visual HEIGHT rather than reading it, so a caller that already
 * subscribes via useViewportHeight re-derives this on the same render the
 * subscription causes — no second listener, no stale read. `offsetTop` and
 * `scale` ARE read here: they change on exactly the same `visualViewport`
 * resize that changes the height, so the caller's subscription covers them
 * too, and threading three values through the screen to keep the function
 * nominally pure would buy nothing (`window.innerHeight` is already read
 * here).
 *
 * @param {number} visualHeight - from readViewportHeight() / useViewportHeight().
 * @returns {number} px, never negative. 0 where there is no visual viewport.
 */
export function viewportInsetFrom(visualHeight) {
  if (typeof window === 'undefined') return 0;
  const layout = window.innerHeight;
  if (!layout || !Number.isFinite(visualHeight) || visualHeight <= 0) return 0;
  const vv = window.visualViewport;
  // PINCH-ZOOM IS NOT CHROME (review lens 1). Zooming shrinks the visual
  // viewport while `window.innerHeight` stays put, so the plain subtraction
  // reads a 2x zoom on an 800px page as 400px of browser chrome and throws the
  // mark into the middle of the screen. A zoomed page has no chrome offset
  // worth correcting for — the browser is already showing the user what they
  // asked to see — so the honest answer is zero.
  if (vv && typeof vv.scale === 'number' && Math.abs(vv.scale - 1) > 0.01) return 0;
  // THE GAP IS AT THE BOTTOM, and `layout - visual` only measures it when the
  // visual viewport is flush with the top. iOS scrolls the visual viewport DOWN
  // to bring a focused input into view, and a pinch-pan moves it too; whatever
  // sits above it was being counted a second time at the bottom.
  const offsetTop = vv && Number.isFinite(vv.offsetTop) ? vv.offsetTop : 0;
  return Math.max(0, Math.round(layout - (offsetTop + visualHeight)));
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
 * "at least half"; `collapse()` is peek. Disabled (flag-off) the detent reads
 * peek and resets to peek.
 *
 * BOTH SHELLS, from A2.4 (ruling 7). The desktop column is not a third state:
 * it reads the SAME detent, as two — peek is the strip at the bottom of the
 * board column, open is the column itself. That is what makes the ruled
 * crossing behaviour true by construction rather than by a synchroniser: the
 * detent SURVIVES a breakpoint crossing, so a chat left open on the desktop
 * arrives at half on the phone, and one collapsed to the strip arrives at
 * peek. Phase A reset it on every crossing because the hook was disabled on
 * desktop; the A4 guard row that asserted that reset now asserts the survival.
 *
 * `initialDetent` is what each shell OPENS at, and only the first render reads
 * it: the phone starts at peek (the board is the page), the desktop at half
 * (the column is the layout). `isDesktop` resolves synchronously from
 * `window.innerWidth` before the first render, so this is not a flash.
 *
 * @param {boolean} enabled
 * @param {string} [initialDetent]
 */
export function useChatSheet(enabled, initialDetent = SHEET_DETENT.PEEK) {
  const [detent, setDetentState] = useState(
    isDetent(initialDetent) ? initialDetent : SHEET_DETENT.PEEK,
  );
  const returnFocusRef = useRef(null);
  // Whether the PLAYER has ever moved the sheet. What ruling 7 says survives a
  // crossing is a CHOICE; a shell's untouched opening detent is not one
  // (review L2-F6). Without this, a session that mounted on a phone — peek,
  // never touched — and was then widened arrived on a desktop with no chat
  // column at all, which is the opposite of the desktop's stated default.
  const touchedRef = useRef(false);

  const setDetent = useCallback((next, invoker = null) => {
    touchedRef.current = true;
    setDetentState((current) => {
      const target = isDetent(next) ? next : current;
      if (!isSheetOpen(current) && isSheetOpen(target)) returnFocusRef.current = invoker;
      return target;
    });
  }, []);

  const open = useCallback((invoker = null) => {
    touchedRef.current = true;
    setDetentState((current) => {
      if (isSheetOpen(current)) return current;
      returnFocusRef.current = invoker;
      return SHEET_DETENT.HALF;
    });
  }, []);

  const collapse = useCallback(() => {
    touchedRef.current = true;
    setDetentState(SHEET_DETENT.PEEK);
  }, []);

  // A shell the player has not spoken to OPENS at its own default when that
  // default is open — which today means: an untouched sheet arriving on the
  // DESKTOP shows the column (review L2-F6).
  //
  // Asymmetric, deliberately, and it keeps ruling 7's own example intact. The
  // ruling's two cases are both desktop → mobile (`open → half`,
  // `collapsed → peek`), so nothing untouched is pushed shut on the way to the
  // phone. The reverse needed a rule because the two shells' closed states are
  // not the same thing: on a phone PEEK is the chat, visible at the bottom of
  // the page with its own composer, and a fine place to arrive; on a desktop
  // it hides the column entirely, so a player who never asked for that landed
  // on a screen with no chat and no way to know one existed.
  //
  // Once they HAVE moved the sheet the detent is theirs and it survives every
  // crossing in both directions, which is what ruling 7 protects.
  useEffect(() => {
    if (touchedRef.current || !isDetent(initialDetent)) return;
    if (!isSheetOpen(initialDetent)) return;
    setDetentState(initialDetent);
  }, [initialDetent]);

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
