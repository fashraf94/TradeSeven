// src/components/Research/BombMode/bombTheme.js
//
// The skin of Bomb mode: the shipped --ft-* tokens only (BUILD_RULES §10), read
// through the bridge as var() strings. No hex in this directory. SVG shapes take
// their colors through `style` (fill / stroke / stopColor), never presentation
// attributes, because var() is not reliably substituted in those (hazard H8).
//
// THE ONE DERIVED ACCENT — the red-zone heat — is a mix of two shipped tokens,
// the risk red and the amber (the batch-1 design's rmMix(risk, amber, 0.45)),
// expressed as CSS color-mix() over the tokens: no new value is introduced.

import { cssVar } from '../../../theme/cssTokens.js';

export const BT = Object.freeze({
  bg: cssVar('bg-dashboard'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-agent'),
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  teal: cssVar('teal'),
  green: cssVar('pos'),
  red: cssVar('neg'),
  risk: cssVar('red'),
  gold: cssVar('gold'),
  amber: cssVar('amber'),
  core: cssVar('white'),
});

/** A token at `pct` % strength over transparent. */
export const tint = (token, pct) => `color-mix(in srgb, ${token} ${pct}%, transparent)`;

/** The red-zone heat: 55 % risk red, 45 % amber (derived, never a new hex). */
export const HEAT = `color-mix(in srgb, ${BT.risk} 55%, ${BT.amber})`;

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
