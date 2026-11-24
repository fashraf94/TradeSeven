// src/components/PracticeField/ideaBookStyle.js
//
// Practice Field build B3 — the idea book screen's palette and shared styles (IdeaBookParts.jsx says why each is so):
// the app's own tokens through the bridge (BUILD_RULES §10), a mono stack for the book's numbers, and the button reset the
// app's 16 px button rule needs. Data only.

import { cssVar } from '../../theme/cssTokens';

/** The palette (ff-ui.jsx FF), as tokens. */
export const IB = Object.freeze({
  bg: cssVar('bg-dashboard'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-agent'),
  hair: 'rgba(var(--ft-scrim-rgb), 0.07)',
  hair2: 'rgba(var(--ft-scrim-rgb), 0.12)',
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  pos: cssVar('pos'),
  neg: cssVar('neg'),
  teal: cssVar('teal'),
  monoNear: cssVar('agent-mono-near'),
  tealCore: cssVar('agent-teal-core'),
});
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
export const HAIR = `1px solid ${IB.hair}`;
/** The book's numbers: mono, tabular. */
export const mono = (size, color = IB.ink, weight = 500) => ({ fontFamily: MONO, fontSize: size, color, fontWeight: weight, fontVariantNumeric: 'tabular-nums' });
/** Up and down colours, on numbers only. */
export const signColor = (dir) => (dir > 0 ? IB.pos : dir < 0 ? IB.neg : IB.ink2);
/** The book's own plain sentences. */
export const BOOK_TEXT = { fontSize: 12.5, color: IB.ink2, lineHeight: 1.45, textWrap: 'pretty' };
/** A button with nothing of the browser's own: every row and control on the screen is one. */
export const RESET = {
  appearance: 'none', border: 'none', background: 'transparent', margin: 0, padding: 0, color: 'inherit', font: 'inherit',
  textAlign: 'left', boxSizing: 'border-box', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
};

/** The screen's few state styles (press, hover, focus), scoped by class. */
export const IB_CSS = `
.ib-root, .ib-root * { -webkit-font-smoothing: antialiased; }
.ib-tap { transition: transform .12s ease, background .15s ease, box-shadow .2s ease; }
.ib-tap:active { transform: scale(.985); }
.ib-row:hover { background: rgba(var(--ft-scrim-rgb), 0.035) !important; }
.ib-tap:focus-visible { outline: 2px solid var(--ft-teal); outline-offset: 2px; }
.ib-scroll { scrollbar-width: none; }
.ib-scroll::-webkit-scrollbar { width: 0; height: 0; }
@media (prefers-reduced-motion: reduce) { .ib-tap { transition: none; } .ib-tap:active { transform: none; } }
`;
