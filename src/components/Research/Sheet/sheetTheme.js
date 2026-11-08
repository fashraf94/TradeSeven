// src/components/Research/Sheet/sheetTheme.js
//
// The skin of the sheet: the shipped --ft-* tokens only (BUILD_RULES §10), read
// through the bridge as var() strings for inline styles. No hex in this
// directory. (The chart's canvas colors are computed hex through readToken,
// in useSheetView — a canvas cannot read var().)

import { cssVar } from '../../../theme/cssTokens.js';

export const ST = Object.freeze({
  bg: cssVar('bg-dashboard'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-elevated'),
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  hair: cssVar('border-strong'),
  teal: cssVar('teal'),
  green: cssVar('pos'),
  red: cssVar('neg'),
  gold: cssVar('gold'),
  amber: cssVar('amber'),
  purple: cssVar('purple'),
});

/** A token at `pct` % strength over transparent. */
export const tint = (token, pct) => `color-mix(in srgb, ${token} ${pct}%, transparent)`;

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
