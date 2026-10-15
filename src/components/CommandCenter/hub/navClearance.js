// src/components/CommandCenter/hub/navClearance.js
//
// Command Center hub, slice S1 — the mobile strip's placement, from MEASURED
// heights (spec V1.2 §10; prompt §4.5).
//
// The strip is fixed above App's BottomNav. Both heights come from a
// ResizeObserver on the element's border box (useNavClearance), never from
// CSS: BottomNav declares `height: 64px` with `padding-bottom:
// env(safe-area-inset-bottom)` under the app's border-box sizing, so its CSS
// height is not a safe guess at its outer height on every device.
//
// The safe-area inset is counted once. The nav's measured outer height already
// contains its own safe-area padding, so a strip sitting on the nav adds none.
// Only with no nav on screen does the strip pad the inset itself, and its
// measured height then contains it.
//
//   stripBottom      — px from the viewport bottom to the strip's bottom edge
//   stripPadsSafeArea — whether the strip adds env(safe-area-inset-bottom)
//   scrollClearance  — the bottom padding the hub's scroll area needs so its
//                      last row clears both the strip and the nav

const measured = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

/**
 * @param {{ navHeight: number|null, stripHeight: number|null }} heights border-box px
 * @returns {{ stripBottom: number, stripPadsSafeArea: boolean, scrollClearance: number }}
 */
export function navClearance({ navHeight, stripHeight }) {
  const nav = measured(navHeight);
  const strip = measured(stripHeight);
  return {
    stripBottom: nav,
    stripPadsSafeArea: nav === 0,
    scrollClearance: nav + strip,
  };
}

/** The attribute App's BottomNav carries so the hub can find and measure it. */
export const BOTTOM_NAV_ATTRIBUTE = 'data-ft-bottom-nav';
