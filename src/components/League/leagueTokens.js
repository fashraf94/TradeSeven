// src/components/League/leagueTokens.js
//
// League palette + semantic roles for the redesigned spectate-and-enter surface.
//
// SINGLE SOURCE OF TRUTH: the obsidian palette and the helpers already live in
// the Command Dashboard's shared "command-bridge" module (commandUI.CMD — the
// prototype TOKENS, transcribed there and aligned to DARK_TOKENS). We reuse
// them rather than defining a parallel copy, so the two can't drift. Only the
// League-specific identity rings (human/cpu) and the warm kept-negative red are
// added here — those roles are genuinely absent from CMD / DARK_TOKENS.
//
// This surface is dark-only by design (the same posture as the command bridge),
// so components consume LTOKENS directly rather than useTheme().tokens.

import { CMD, MONO, alpha } from '../Dashboard/commandUI';

export { MONO, alpha };

// LTOKENS === the shared obsidian palette: bg/surface/raised, the ink ramp
// (ink/ink2/ink3), hairlines (hair/hair2), teal/gold/copper, and the forge
// category colors. No copy — this is a reference to CMD.
export const LTOKENS = CMD;

// League semantic roles, derived from the shared palette. energy/comp/alert/
// pos/cut alias CMD; human/cpu/neg are the only League-only values.
export const LX = {
  energy: CMD.teal,    // primary · live · gains · advancing
  comp:   CMD.gold,    // trophy · champion · winner
  alert:  CMD.copper,  // contrarian · short
  pos:    CMD.teal,    // gains
  neg:    '#F2766B',   // losses — kept, honest, never shamed (League-only warm red)
  human:  '#5B8DEF',   // human-owned agent ring (League-only identity)
  cpu:    '#9A8CE0',   // CPU agent ring — always + a CPU chip badge (League-only identity)
  cut:    CMD.gold,    // the cut line
};
