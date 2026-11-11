// src/components/Research/BombMode/redZone.js
//
// Research Modal Build A — THE RED ZONE STATE MACHINE (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md BA-2, BA-3, §4.3).
// Pure. The band constants live HERE and nowhere else.
//
// Modes: 'fuse' (the 💣 view) · 'approaching' (red zone a) · 'banked' (the
// moment, red zone b) · 'closed' (red zone c, market closed).
//
//   ENTER   the live price within RED_ZONE_ENTER_PCT of the next UNBANKED
//           UPSIDE rung (FQ-2: 0.5 %, the universe p90 15-minute move). A
//           price above an unbanked rung is in the zone (distance ≤ 0): the
//           check has not read it yet.
//   STAY    while the distance to THAT rung is ≤ RED_ZONE_EXIT_PCT (0.75 %).
//   LEAVE   past 0.75 %, when that rung banks (the next rung is judged afresh,
//           at the ENTER band), or when the market closes.
//   CLOSED  outside market hours the zone is never live: a price that closed
//           inside the ENTER band shows the frozen view (c), else the Fuse.
//   NEVER   for a preview, for crypto, or near a downside tier (BA-2: the
//           machine is only ever handed the next UPSIDE rung).
//   BANKED  a rung the modal SEES bank (it was not banked at the first look)
//           plays the moment once per position and tier per modal session,
//           then re-bases to the next rung or leaves.

export const RED_ZONE_ENTER_PCT = 0.5;
export const RED_ZONE_EXIT_PCT = 0.75;

/** The machine's starting state (nothing seen yet). */
export const RED_ZONE_INITIAL = Object.freeze({ mode: 'fuse', rungKey: null, seenBanked: null, played: Object.freeze([]), moment: null });

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * One step.
 *
 * @param {object} state  the previous state (RED_ZONE_INITIAL first)
 * @param {object} input
 * @param {boolean} input.held        the player's agent holds the name (a preview never enters)
 * @param {boolean} input.crypto      crypto never enters (BA-2)
 * @param {boolean} input.marketOpen  the regular session is open now
 * @param {string|null} input.positionId
 * @param {string[]} input.bankedUp   upside tiers banked on the record now
 * @param {{ key: string, pct: number }|null} input.next  the next unbanked upside rung and the
 *        live price's distance to it, % of the displayed live price (ladder.toGo)
 * @param {boolean} [input.momentDone]  the banked moment finished its beat
 * @returns {object} the next state ({ mode, rungKey, seenBanked, played, moment })
 */
export function stepRedZone(state, input) {
  const prev = state || RED_ZONE_INITIAL;
  const { held, crypto, marketOpen, positionId = null, bankedUp = [], next = null, momentDone = false } = input || {};
  const banked = Array.isArray(bankedUp) ? bankedUp : [];
  // Nothing is seen until there is a held ladder to look at (a loading ladder
  // reports nothing banked, which must not later read as a fresh bank).
  if (held !== true || crypto === true) return { ...prev, mode: 'fuse', rungKey: null, moment: null };
  // The first look seeds what is already banked: those never play a moment.
  const seenBefore = prev.seenBanked ?? banked;
  const seenBanked = [...new Set([...seenBefore, ...banked])];
  const base = { ...prev, seenBanked };

  // The rungs the modal saw bank: ONE moment for every tier that banked at that
  // check (named by the highest), each tier once per position per modal session.
  const fresh = banked.filter((k) => !seenBefore.includes(k) && !prev.played.includes(`${positionId}:${k}`));
  if (fresh.length) {
    return { ...base, mode: 'banked', rungKey: null, moment: { key: fresh[fresh.length - 1], keys: fresh }, played: [...prev.played, ...fresh.map((k) => `${positionId}:${k}`)] };
  }
  if (prev.mode === 'banked' && !momentDone) return { ...base, mode: 'banked' };

  if (!next || !finite(next.pct)) return { ...base, mode: 'fuse', rungKey: null, moment: null };
  if (marketOpen !== true) {
    return { ...base, mode: next.pct <= RED_ZONE_ENTER_PCT ? 'closed' : 'fuse', rungKey: next.pct <= RED_ZONE_ENTER_PCT ? next.key : null, moment: null };
  }
  const staying = prev.mode === 'approaching' && prev.rungKey === next.key;
  const inside = staying ? next.pct <= RED_ZONE_EXIT_PCT : next.pct <= RED_ZONE_ENTER_PCT;
  return { ...base, mode: inside ? 'approaching' : 'fuse', rungKey: inside ? next.key : null, moment: null };
}

/** The views that are the red zone (the hook's 1-minute series). */
export const isRedZoneMode = (mode) => mode === 'approaching' || mode === 'banked' || mode === 'closed';

// ── THE DANGER ZONE (refinement 2026-11-10, BD-5): the red zone's mirror below ──
//
// Same bands (RED_ZONE_ENTER_PCT / RED_ZONE_EXIT_PCT above — the constants stay
// in this module and nowhere else), measured to the next UNHIT DOWNSIDE rung:
//
//   ENTER   the live price within RED_ZONE_ENTER_PCT ABOVE that rung (ladder
//           toGoDown's pctShown); at or below the rung (pct ≤ 0) is inside —
//           a check has not read it yet.
//   STAY    to RED_ZONE_EXIT_PCT for THAT rung.
//   LEAVE   past the stay band, when that rung is hit (the next rung below is
//           judged afresh at the ENTER band), or at the close.
//   CLOSED  a market that is shut shows the frozen view ('dangerClosed') for a
//           price that closed inside the ENTER band, as red zone (c) does.
//   NEVER   for a preview, a held-preview (legacy stock, every crypto) or a
//           League battle (all three reach here with held false), or crypto.
//   A HIT   plays NO moment: no takeover, no motion. The machine only reports
//           which rungs it SAW hit (`freshHits`, never the ones already hit at
//           the first look), so the view can name the check (BA-4's rule).
//
// Modes: 'fuse' · 'danger' (live) · 'dangerClosed' (frozen).

/** The danger machine's starting state (nothing seen yet). */
export const DANGER_ZONE_INITIAL = Object.freeze({ mode: 'fuse', rungKey: null, seenHit: null, freshHits: Object.freeze([]) });

/**
 * One step of the Danger Zone.
 *
 * @param {object} state  the previous state (DANGER_ZONE_INITIAL first)
 * @param {object} input
 * @param {boolean} input.held        the player's agent holds the name on the measured model
 * @param {boolean} input.crypto      crypto never enters
 * @param {boolean} input.marketOpen
 * @param {string[]} input.hitDown    downside tiers hit on the record now
 * @param {{ key: string, pct: number }|null} input.nextDown  the next unhit downside rung and the
 *        live price's distance ABOVE it, % of the displayed live price (ladder.toGoDown pctShown)
 */
export function stepDangerZone(state, input) {
  const prev = state || DANGER_ZONE_INITIAL;
  const { held, crypto, marketOpen, hitDown = [], nextDown = null } = input || {};
  const hits = Array.isArray(hitDown) ? hitDown : [];
  if (held !== true || crypto === true) return { ...prev, mode: 'fuse', rungKey: null, freshHits: [] };
  const seenBefore = prev.seenHit ?? hits;
  const freshHits = hits.filter((k) => !seenBefore.includes(k));
  const base = { ...prev, seenHit: [...new Set([...seenBefore, ...hits])], freshHits };
  if (!nextDown || !finite(nextDown.pct)) return { ...base, mode: 'fuse', rungKey: null };
  if (marketOpen !== true) {
    const inBand = nextDown.pct <= RED_ZONE_ENTER_PCT;
    return { ...base, mode: inBand ? 'dangerClosed' : 'fuse', rungKey: inBand ? nextDown.key : null };
  }
  const staying = prev.mode === 'danger' && prev.rungKey === nextDown.key;
  const inside = staying ? nextDown.pct <= RED_ZONE_EXIT_PCT : nextDown.pct <= RED_ZONE_ENTER_PCT;
  return { ...base, mode: inside ? 'danger' : 'fuse', rungKey: inside ? nextDown.key : null };
}

/** The views that are the Danger Zone. */
export const isDangerZoneMode = (mode) => mode === 'danger' || mode === 'dangerClosed';
/** Either zone (the hook's 1-minute series, the 1-second clock). */
export const isZoneMode = (mode) => isRedZoneMode(mode) || isDangerZoneMode(mode);

/** Both machines, and which zone shows. */
export const ZONES_INITIAL = Object.freeze({ red: RED_ZONE_INITIAL, danger: DANGER_ZONE_INITIAL, shown: null, mode: 'fuse' });

/**
 * One step of BOTH zones (BD-5). Each machine keeps its own bands and memory;
 * this decides which one the 💣 view shows:
 *   - the red zone's banked moment always shows (it is the one takeover);
 *   - both bands at once (a stock whose threshold is under 0.5 %): the zone
 *     already showing stays; on a first look the nearer one wins (the smaller
 *     displayed %), and a tie goes to the red zone.
 *
 * @param {object} state  ZONES_INITIAL first
 * @param {object} input  stepRedZone's input, plus `hitDown` and `nextDown` for the Danger Zone
 * @returns {{ red, danger, shown: 'red'|'danger'|null, mode: string }}
 */
export function stepZones(state, input) {
  const prev = state || ZONES_INITIAL;
  const red = stepRedZone(prev.red, input);
  const danger = stepDangerZone(prev.danger, input);
  const redIn = isRedZoneMode(red.mode);
  const dangerIn = isDangerZoneMode(danger.mode);
  let shown = null;
  if (red.mode === 'banked') shown = 'red';
  else if (redIn && dangerIn) {
    if (prev.shown === 'red' || prev.shown === 'danger') shown = prev.shown;
    else shown = Number(input?.nextDown?.pct) < Number(input?.next?.pct) ? 'danger' : 'red';
  } else if (redIn) shown = 'red';
  else if (dangerIn) shown = 'danger';
  const mode = shown === 'red' ? red.mode : shown === 'danger' ? danger.mode : 'fuse';
  return { red, danger, shown, mode };
}
