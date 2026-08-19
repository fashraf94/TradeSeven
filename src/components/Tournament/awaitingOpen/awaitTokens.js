// src/components/Tournament/awaitingOpen/awaitTokens.js
//
// Awaiting-the-Open redesign — the ONE token/copy mapping site for the
// redesigned awaiting-open surface (flag: AWAITING_OPEN_REDESIGN_ENABLED).
//
// THEMING (founder ruling, Option A): this surface keeps useTheme() as its token
// source rather than going dark-only via LTOKENS/CMD. The app mounts a single
// dark-default ThemeProvider (ThemeContext.jsx:7 `useState('dark')`, never
// toggled anywhere), and DARK_TOKENS already carries the redesign's palette
// byte-for-byte — bgApp #0D0E12, bgCard #15171E, bgAgent #1C1A27, teal #5eead4,
// medalGold #F0C75E, warmCopper #E8927C. So the design's semantic names are a
// pure RENAME of live tokens, not a second palette: zero pixels change and there
// is no parallel source to drift (BUILD_RULES §9).
//
// The one value DARK_TOKENS lacks is the ownership blue for "you". Per the
// founder ruling it comes from LX.human (#5B8DEF, leagueTokens.js) — the same
// blue the battle screen already uses for the human side, so teal=agent /
// blue=you reads identically across screens.
//
// BUILD_RULES §10: no raw core-palette hex is introduced here. Every colour is a
// token identifier composed through the house helpers `alpha()` / `readableOn()`
// (commandUI.jsx) — which is also why nothing may become a `var()` string: both
// helpers parse hex and fail SILENTLY on `var()` (alpha() returns teal,
// readableOn() returns near-black). Identifiers in, composed rgba out.

import { getSectorColor } from '../../../constants/holoTheme';
import { alpha, readableOn } from '../../Dashboard/commandUI';
import { LX } from '../../League/leagueTokens';

export { alpha, readableOn };

/** Ownership identity — the battle screen's convention. Teal is the agent, blue is you. */
export const W_YOU = LX.human;

/**
 * The design's semantic surface names, derived from the live useTheme() tokens.
 * Call with `tokens` from useTheme(); returns a stable-shaped object so every
 * redesign component reads ONE naming vocabulary.
 *
 * bg/surface/raised and teal/gold/copper are exact matches to the reference
 * palette; the ink ramp and hairlines map onto the live text/border ramp.
 */
export function awaitPalette(tokens) {
  return {
    bg: tokens.bgApp,                 // #0D0E12 — page ground
    surface: tokens.bgCard,           // #15171E — panel
    raised: tokens.bgAgent,           // #1C1A27 — inset rails/tracks
    ink: tokens.textPrimary,          // primary type
    ink2: tokens.textMuted,           // body / secondary
    ink3: tokens.textFaint,           // eyebrows, units, dim labels
    hair: tokens.borderDivider,       // hairline
    hair2: tokens.borderInput,        // stronger hairline
    teal: tokens.teal,                // #5eead4 — agent / primary accent
    gold: tokens.medalGold,           // #F0C75E — the wire's accent
    copper: tokens.warmCopper,        // #E8927C — practice-mode identity
    white: tokens.textWhite,          // overlay/gradient white
    you: W_YOU,                       // #5B8DEF — YOUR ownership colour
  };
}

/** Sector colour for a ticker plate — the LIVE map (holoTheme), the same one
 *  AssetResearchModal and the existing SectorChip use, so a ticker's colour can
 *  never disagree between the board, the wire and the modal (BUILD_RULES §9). */
export function wSec(sector) {
  return getSectorColor(sector);
}

// ── copy ────────────────────────────────────────────────────────────────────
// The product's own strings, verbatim (build spec §8). `closed` is rendered from
// the live claim window rather than this fixture — see awaitWireCopy().
export const WPOD = {
  cdEyebrow: 'Battle starts at the next open',
  cdFoot: 'Locked in — your three picks and your agent are set. When the bell rings, the five-day run begins.',
  opening: 'Opening…',
  openingSub: 'The market is opening — your pod goes live any moment. This view switches to the battle on its own.',
  noTarget: 'Your five-day practice battle begins at the next market open.',
  open: '9:30 AM ET',
  run: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  draft: {
    eyebrow: 'The draft',
    title: 'Your league draftboard',
    sub: 'The 12 user-layer picks — who took what. Tap any ticker to research it.',
  },
  wire: {
    eyebrow: 'Waiver wire',
    title: 'Best remaining free agents',
    sub: 'Ranked for your agent from the names still available. Tap a ticker to research; Claim to line up an overnight swap.',
  },
  claims: 'Claims',
  place: 'Place claim',
  flips: 'Flips open when the battle starts',
  note: 'Dropping a pick does NOT erase its points — the dropped name keeps scoring its banked legs for the rest of the week. A won name starts fresh, long, at the next open.',
};

export const WMODES = {
  practice: {
    key: 'practice',
    label: 'Practice pod',
    chip: 'PRACTICE',
    text: 'Every seat here is a CPU. No stakes, no cut — practice runs don’t feed the leaderboard or the bracket.',
  },
  ranked: {
    key: 'ranked',
    label: 'League pod',
    chip: 'RANKED',
    text: 'Every seat is a live player. This run feeds the leaderboard and the monthly bracket.',
  },
};

/** Mode identity colour, resolved off the live palette (practice = copper). */
export function modeColor(pal, mode = 'practice') {
  return mode === 'ranked' ? pal.gold : pal.copper;
}
