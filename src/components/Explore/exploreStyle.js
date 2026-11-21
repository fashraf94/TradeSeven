// src/components/Explore/exploreStyle.js
//
// Explore Build 1 — THE LOOK (build prompt K-15; the Round 1 mockup's layout, hierarchy, spacing
// and type, docs/design/explore/EXPLORE_ROUND_1.html). Colors are the --ft-* tokens only
// (BUILD_RULES §10): cssVar() for a color, `rgba(var(--ft-<tone>-rgb), a)` for a wash. No hex.
// Motion comes from src/theme/motion.js (BUILD_RULES §11).
//
// ONE DOM AT EVERY WIDTH. A layout that changed its parents by breakpoint would remount its
// children (focus and state lost), so the two-column screens are one grid whose two column
// wrappers are `display: contents` on a phone — their items then interleave by `order` — and real
// flex columns from 1000 px. Neither column ever has a scroll of its own (spec E-4, N-6): the page
// scrolls, and on desktop the side column scrolls with it.
//
// The app has no global border-box and forces 16 px on every <button> (src/index.css), so the
// roots here scope their own box model and button labels are sized on an inner span.

import { cssVar } from '../../theme/cssTokens';

export const T = Object.freeze({
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  teal: cssVar('teal'),
  gold: cssVar('gold'),
  copper: cssVar('copper'),
  purple: cssVar('purple'),
  bg: cssVar('bg-app'),
  surface: cssVar('bg-card'),
  hair: cssVar('border-strong'),
});

/** A translucent tone: the token's rgb triplet with an alpha (tones with a triplet: teal, gold, copper, ink-2, purple, shadow). */
export const wash = (tone, a) => `rgba(var(--ft-${tone}-rgb), ${a})`;

/**
 * The layers. The pinned bar sits above the app's BottomNav (50) and below the Search overlay (100); the sheet
 * sits above both and below the Work an idea body's SignalDrop modal (SR_DROP_LAYER, 1001), which the body opens
 * over it. Pinned by explore.layout.test.js.
 */
export const EXPLORE_LAYERS = Object.freeze({ bar: 60, sheet: 1000 });

/** The breakpoint of the two-column home and reader (spec §3.2, §3.4). */
export const WIDE_MIN_PX = 1000;
/** The app's BottomNav: 64 px tall, plus the safe-area inset (no border-box). The pinned bar sits above it. */
export const BOTTOM_NAV_PX = 64;

export const S = Object.freeze({
  col: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  box: { padding: '12px 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  card: { padding: '12px 14px', borderRadius: 14, background: T.bg, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3, margin: 0 },
  h2: { margin: 0, fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', lineHeight: 1.3 },
  body: { margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.5, overflowWrap: 'anywhere' },
  meta: { margin: 0, fontSize: 12.5, color: T.ink2, lineHeight: 1.45, overflowWrap: 'anywhere' },
  small: { margin: 0, fontSize: 12.5, color: T.ink2, lineHeight: 1.5, overflowWrap: 'anywhere' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: { display: 'block', width: '100%', minHeight: 46, padding: '10px 14px', borderRadius: 12, background: T.bg, color: T.ink, border: `1px solid ${T.hair}`, font: 'inherit', fontSize: 16, lineHeight: 1.5 },
  label: { display: 'block', fontSize: 13.5, fontWeight: 600, color: T.ink2, marginBottom: 6 },
});

const btnBase = {
  appearance: 'none', font: 'inherit', cursor: 'pointer', minHeight: 44, padding: '10px 16px', borderRadius: 12,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'left', lineHeight: 1.3, maxWidth: '100%', whiteSpace: 'normal',
};
export function btnStyle(kind = 'secondary', { full = false, disabled = false } = {}) {
  const look = {
    primary: { background: T.teal, color: T.bg, border: `1px solid ${T.teal}`, fontWeight: 700 },
    secondary: { background: T.surface, color: T.ink, border: `1px solid ${T.hair}`, fontWeight: 600 },
    ghost: { background: 'transparent', color: T.ink2, border: '1px solid transparent', fontWeight: 600 },
  }[kind];
  return { ...btnBase, ...look, ...(full ? { width: '100%' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) };
}
export const linkStyle = {
  appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: '6px 0', minHeight: 44, display: 'inline-flex', alignItems: 'center',
  cursor: 'pointer', color: T.teal, fontWeight: 600, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3,
};
/** A row that is one button (a search result, an in-progress row, a saved story). */
export const rowBtnStyle = {
  appearance: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%', minHeight: 48, color: T.ink,
  padding: '12px 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
};

/**
 * The page's own rules: the scoped box model, the breakpoint, the reader's type, hover, and reduced motion.
 * Injected once by ExploreTab (and by the pinned bar and the sheet host, which portal outside it).
 */
export const EXPLORE_CSS = `
.ftx-root, .ftx-root *, .ftx-root *::before, .ftx-root *::after,
.ftx-portal, .ftx-portal *, .ftx-portal *::before, .ftx-portal *::after { box-sizing: border-box; }
.ftx-root { min-width: 0; color: ${T.ink}; overflow-anchor: none; }
.ftx-root :focus-visible, .ftx-portal :focus-visible { outline: 2px solid ${T.teal}; outline-offset: 2px; }
.ftx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ftx-btn { transition: filter .15s ease; }
.ftx-btn:not(:disabled):not([aria-disabled="true"]):hover { filter: brightness(1.12); }
.ftx-rowbtn:hover { box-shadow: 0 0 0 1px ${wash('teal', 0.35)}; }
.ftx-h1 { margin: 0; font-size: clamp(26px, 4.2vw, 40px); font-weight: 800; letter-spacing: -.025em; line-height: 1.1; color: ${T.ink}; overflow-wrap: anywhere; }
.ftx-qh { margin: 0; font-size: clamp(19px, 2.4vw, 24px); font-weight: 800; letter-spacing: -.015em; line-height: 1.2; color: ${T.ink}; overflow-wrap: anywhere; }
.ftx-deck { margin: 0; font-size: 16px; line-height: 1.5; color: ${T.ink2}; max-width: 60ch; overflow-wrap: anywhere; }
.ftx-prose { display: flex; flex-direction: column; gap: 16px; max-width: 64ch; }
.ftx-prose p { margin: 0; font-size: 17px; line-height: 1.65; color: ${T.ink}; overflow-wrap: anywhere; }
.ftx-parts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 10px 0; }
.ftx-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.ftx-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
.ftx-col { display: contents; }
.ftx-o1 { order: 1; } .ftx-o2 { order: 2; } .ftx-o3 { order: 3; } .ftx-o4 { order: 4; } .ftx-o5 { order: 5; } .ftx-o6 { order: 6; } .ftx-o7 { order: 7; }
@media (min-width: 560px) {
  .ftx-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ftx-parts { grid-template-columns: 140px minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: baseline; }
}
@media (min-width: ${WIDE_MIN_PX}px) {
  .ftx-grid[data-ftx-grid="home"] { grid-template-columns: minmax(0, 1fr) 320px; gap: 44px; align-items: start; }
  .ftx-grid[data-ftx-grid="story"] { grid-template-columns: minmax(0, 660px) minmax(320px, 400px); gap: 48px; justify-content: space-between; align-items: start; }
  .ftx-grid > .ftx-col { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
}
@media (prefers-reduced-motion: reduce) { .ftx-btn, .ftx-rowbtn { transition: none; } }
`;
