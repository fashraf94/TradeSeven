// src/screens/battleView/computeTugOfWarWidth.js
//
// THE SEAM. One function, one number — the share of the bar the player's side
// owns, as a percentage.
//
// It was a module-local helper in AgentBattleScreen.jsx (`:130-134`) serving the
// shipped ScoreHeader alone. A3.0 gives the Battle View a SECOND bar (the arena
// header, D-96), and the mock drew its own arithmetic for it —
// `50 + (me - cpu) / tot * 25`, a different curve on the same two scores. Two
// derivations of one displayed quantity is the §9 display-agreement bug family
// by construction: the shipped header and the arena would eventually disagree
// about where the seam is, on the same page, for the same battle.
//
// So the helper moved HERE and both headers import it. The body is unchanged
// from the shipped one, deliberately: A3.0 is not the place to re-tune the
// curve, and the controller-on / pane-off golden proves the shipped render did
// not move a pixel.
//
// Lives in battleView/ rather than beside ScoreHeader because a battleView
// module cannot import from AgentBattleScreen.jsx without a cycle (the screen
// imports every one of these).

/**
 * The player's share of the tug-of-war bar, in percent.
 *
 * Absolute values, so a battle where both sides are DOWN still splits by
 * magnitude rather than collapsing to a sign comparison. Clamped to 10–90 so
 * neither side's colour ever vanishes entirely (a 0%-wide side reads as a
 * rendering fault, not as a rout), and 50 at a scoreless 0–0 start.
 *
 * @param {number} myScore   the player's score, exactly as the header renders it
 * @param {number} oppScore  the CPU's score, exactly as the header renders it
 * @returns {number} percentage width of the player's side, 10 ≤ n ≤ 90
 */
export function computeTugOfWarWidth(myScore, oppScore) {
  const total = Math.abs(myScore) + Math.abs(oppScore);
  if (total === 0) return 50;
  return Math.max(10, Math.min(90, (Math.abs(myScore) / total) * 100));
}

export default computeTugOfWarWidth;
