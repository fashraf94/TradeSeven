// src/components/Tournament/awaitingOpen/awaitTokens.js
//
// Awaiting-the-Open redesign — the redesign's NON-REACT layer: the one
// token/copy mapping site plus the pure display model (countdown segmentation,
// the ET run day, the wire's window line) for the redesigned awaiting-open
// surface (flag: AWAITING_OPEN_REDESIGN_ENABLED). Kept out of the component
// files so the derivations stay unit-testable without a DOM — and so those
// files export components only (fast refresh).
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

/**
 * Countdown segments, from the SAME total-seconds value the numerals render —
 * so the label and its number can never come from two sources (BUILD_RULES §9).
 * A DAYS segment appears only when the open is more than a day out (a weekend
 * or a holiday); under an hour the hours segment is dropped entirely.
 */
export function waitSegments(totalSec) {
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return [[days, days === 1 ? 'DAY' : 'DAYS'], [hours, 'HRS'], [mins, 'MIN'], [secs, 'SEC']];
  if (hours > 0) return [[hours, 'HRS'], [mins, 'MIN'], [secs, 'SEC']];
  return [[mins, 'MIN'], [secs, 'SEC']];
}

/**
 * The ET weekday the run starts on, as a 3-letter key matching WPOD.run, so the
 * run strip highlights the day the battle ACTUALLY begins rather than assuming
 * Monday. Intl with America/New_York — never a hand-rolled offset
 * (BUILD_RULES §6). Null for a missing or malformed anchor.
 */
export function runStartDay(targetIso) {
  if (!targetIso) return null;
  const d = new Date(targetIso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' })
      .format(d).toUpperCase();
  } catch {
    return null;
  }
}

/** ET weekday key ('Mon'…'Sun') — Intl with America/New_York, never a
 *  hand-rolled offset (BUILD_RULES §6). Returns null if it cannot be resolved. */
export function etWeekday(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now);
  } catch {
    return null;
  }
}

/**
 * The wire's window line (build spec §6.1), derived from the LIVE
 * getClaimWindowDisplay() state the caller passes in — the display-only mirror
 * of the server window, which stays the sole authority on any submit.
 *
 * The window helper is deliberately NOT widened (founder ruling: it has two
 * callers and this needs nothing from it that it doesn't already return), so
 * the one nuance it cannot express is handled here: on a FRIDAY during market
 * hours it reports `market_hours` with a countdown to today's 16:00, but the
 * wire never actually opens then — Friday ≥16:00 is `friday_evening`, closed
 * until Monday. Showing "opens in 2h 0m" there would be a countdown that lies,
 * so that branch drops the countdown and states the reopen plainly.
 *
 * Returns `{ text, isOpen }`. Copy mirrors ClaimFlipWindow's countdownLabel.
 */
export function wireWindowLine(win, now = new Date()) {
  if (!win) return { text: '', isOpen: false };
  if (win.reason === 'weekend') {
    return { text: 'Closed for the weekend — the wire opens Monday at 4:00 PM ET.', isOpen: false };
  }
  if (win.reason === 'friday_evening') {
    return { text: 'Closed — the wire reopens Monday at 4:00 PM ET.', isOpen: false };
  }
  if (!win.isOpen && etWeekday(now) === 'Fri') {
    // Friday daytime: today's 16:00 "open" is immediately friday_evening.
    return { text: 'Closed — the wire reopens Monday at 4:00 PM ET.', isOpen: false };
  }
  const mins = win.countdownMinutes;
  if (!Number.isFinite(mins)) {
    return win.isOpen
      ? { text: 'Open — claims lock at 9:24 AM ET.', isOpen: true }
      : { text: 'Closed — the wire opens at 4:00 PM ET.', isOpen: false };
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return win.isOpen
    ? { text: `Open — claims lock in ${dur} (9:24 AM ET).`, isOpen: true }
    : { text: `Closed — the wire opens in ${dur} (4:00 PM ET).`, isOpen: false };
}
