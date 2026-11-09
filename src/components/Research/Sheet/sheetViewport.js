// src/components/Research/Sheet/sheetViewport.js
//
// Research Modal Build C — founder ruling FQ-6 (2026-11-08): in sheet mode the
// phone modal is sized from the VISIBLE viewport, so the pinned action row
// (Ask, → Cockpit) is never under Safari's toolbar. `100dvh` (the dynamic
// viewport: the visible height as the toolbar shows and hides), falling back
// to `100vh` where the browser has no `dvh`. Mode off is untouched (the modal
// keeps `100vh`). The chart keeps its sizes; Layer 0 may scroll where the
// visible viewport is shorter than the sizes BC-2 names.
//
// PURE; the CSS support test is injectable so a row can pin both answers.

const browserSupports = (property, value) => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value) === true;

/**
 * The phone modal's height in sheet mode.
 * @param {(property: string, value: string) => boolean} [supports]  CSS.supports by default
 * @returns {'100dvh'|'100vh'}
 */
export function visibleViewportHeight(supports = browserSupports) {
  try {
    return supports('height', '100dvh') ? '100dvh' : '100vh';
  } catch {
    return '100vh';
  }
}
