// src/components/League/battleArena/arenaTheme.js
//
// League Battle View V2 — arena-specific COLOR ROLES + small mappings, layered on
// the shared League palette (leagueTokens). Non-component module so the .jsx
// surfaces stay component-only (clean react-refresh boundary).
//
// The dual-hue is deliberate and matches the spec: the agent's machine is teal,
// YOUR three are blue. A bagger climb reads teal; a bust slide reads the warm
// kept-negative red.

import { LTOKENS, LX } from '../leagueTokens';

export const ST_GOOD = LTOKENS.teal; // climbing toward a bagger
export const ST_BAD = LX.neg;        // sliding toward a bust
export const OWN_AGENT = LTOKENS.teal; // the machine's six (watch-only)
export const OWN_YOU = LX.human;       // your three (you act — blue)

// conviction tier → label + meter glyph kind (presentation only; the tier's
// scoring multiplier is applied upstream by the scorer, never here).
export const TIER_META = Object.freeze({
  star: { label: 'Star', glyph: 'star' },
  core: { label: 'Core', glyph: 'half' },
  support: { label: 'Support', glyph: 'dot' },
});

export function tierMeta(tier) {
  return TIER_META[tier] || TIER_META.support;
}

// A beat's semantic tone (good/bad/neutral) + kind → its accent color. A flip is
// your move (blue); a lead change reads gold (the leader hue); a swap and the
// rest of neutral read teal (the agent).
export function beatToneColor(tone, kind) {
  if (kind === 'flip') return OWN_YOU;
  if (tone === 'bad') return ST_BAD;
  if (tone === 'good') return ST_GOOD;
  if (kind === 'lead') return LTOKENS.gold;
  return ST_GOOD;
}

// kind → the small glyph the on-board caption / star beat-ring uses.
export const BEAT_GLYPH = Object.freeze({
  lead: 'crown', swap: 'bolt', claim: 'flag', edge: 'pulse', danger: 'short', hit: 'bolt', flip: 'flip',
});
