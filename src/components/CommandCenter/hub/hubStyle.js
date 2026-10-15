// src/components/CommandCenter/hub/hubStyle.js
//
// Command Center hub, slice S1 — the style vocabulary the hub's components
// share, mapped from the design's FF table (ff-ui.jsx) onto the --ft-* tokens
// (BUILD_RULES §10; founder ruling R-S1-2). No hex lives here or anywhere
// under src/components/CommandCenter/: inline styles take cssVar() references,
// translucent colours compose from a token's -rgb triplet, and SVG attributes
// take a computed hex from readToken() at render (hazard H8).
//
//   design FF   → token                 design FF    → token
//   bg          → bg-dashboard          ink          → ink
//   surface     → bg-card               ink2         → ink-2
//   raised      → bg-agent              ink3         → ink-3
//   teal        → teal                  teal2        → teal-2
//   gold        → gold                  blue         → blue-action
//   copper      → copper                pos / neg    → pos / neg
//   violet      → purple
//   hair  rgba(255,255,255,0.07) → tint('scrim', 0.07)
//   hair2 rgba(255,255,255,0.12) → tint('scrim', 0.12)
//
// Hairlines compose from --ft-scrim-rgb: tokens.css names translucent white a
// scrim and keeps --ft-white for opaque use only, so there is no white triplet
// to read.

import { cssVar } from '../../../theme/cssTokens';

/** `rgba(var(--ft-<name>-rgb), a)` — a translucent token for an inline style. */
export const tint = (name, alpha) => `rgba(var(--ft-${name}-rgb), ${alpha})`;

export const HAIR = tint('scrim', 0.07);
export const HAIR_2 = tint('scrim', 0.12);

/** The design's mono stack. JetBrains Mono is already loaded by index.html. */
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const C = Object.freeze({
  bg: cssVar('bg-dashboard'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-agent'),
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  teal: cssVar('teal'),
  gold: cssVar('gold'),
  copper: cssVar('copper'),
  blue: cssVar('blue-action'),
  white: cssVar('white'),
  pos: cssVar('pos'),
  neg: cssVar('neg'),
});

/**
 * The hub's layers (spec §10): page < strip 40 < BottomNav 50 < sheets <
 * Forge < the root deploy ceremony (DeployCeremony.jsx Z_INDEX 1010). The
 * hub's sheets sit with the shipped EquipSheet / ScoutingBoardSheet (1000).
 */
export const HUB_LAYERS = Object.freeze({ page: 1, strip: 40, sheet: 1000 });

/** The area colour token for each relationship area (ff-stage.jsx FF_AREAS). */
export const AREA_TOKEN = Object.freeze(['teal', 'teal', 'gold']);

/** The phone's minimum touch target (spec §10 / prompt §4.7). */
export const PHONE_TARGET = 44;

/**
 * The hub's box model. The design assumes `* { box-sizing: border-box }`
 * (ff-ui.jsx injectFfCSS); the app ships no such rule (its Tailwind v4 build
 * ignores the `@tailwind base` directive in index.css, so every element is
 * content-box). Without it the phone's 100dvh scroll pane grows by its own
 * bottom padding and a full-width button overflows its card by its padding.
 * Scoped to the hub's three roots — the shell, the strip and the sheet — so
 * no other screen changes.
 */
export const HUB_BOX_MODEL_CSS = ['[data-hub="shell"]', '[data-hub-strip]', '[data-hub-sheet-overlay]']
  .flatMap((root) => [root, `${root} *`, `${root} *::before`, `${root} *::after`])
  .join(', ')
  .concat(' { box-sizing: border-box; }');
