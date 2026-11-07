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

  // A rung the modal saw bank: the moment, once per position and tier.
  const fresh = banked.find((k) => !seenBefore.includes(k) && !prev.played.includes(`${positionId}:${k}`));
  if (fresh) {
    return { ...base, mode: 'banked', rungKey: null, moment: { key: fresh }, played: [...prev.played, `${positionId}:${fresh}`] };
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
