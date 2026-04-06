/**
 * Trait Combo Labels — Emergent Personality Types
 *
 * When a user equips specific trait pairs, an RPG "Class Title"
 * appears under their agent's name in the Mech Bay hero UI.
 *
 * Checked on every trait equip/unequip.
 * First match wins (list is priority-ordered).
 */

export const TRAIT_COMBOS = [
  {
    traitA: 'trait-bargain-hunter',
    traitB: 'trait-let-winners-run',
    label: 'Contrarian Diamond Miner',
    description: 'Buys the dip and holds for the breakout. High risk, high reward.',
    gradientType: 'instincts',
  },
  {
    traitA: 'trait-trend-rider',
    traitB: 'trait-iron-discipline',
    label: 'Disciplined Surfer',
    description: 'Rides every wave but always wears a leash.',
    gradientType: 'mixed',
  },
  {
    traitA: 'trait-squeeze-whisperer',
    traitB: 'trait-active-trader',
    label: 'Volatility Harvester',
    description: 'Finds the compression, catches the explosion, moves on.',
    gradientType: 'instincts',
  },
  {
    traitA: 'trait-volume-believer',
    traitB: 'trait-smart-money-tracker',
    label: 'Institutional Shadow',
    description: 'If the big money isn\'t there, neither is this agent.',
    gradientType: 'instincts',
  },
  {
    traitA: 'trait-threshold-harvester',
    traitB: 'trait-active-trader',
    label: 'Point Machine',
    description: 'Banks bonuses like a conveyor belt. Efficiency over elegance.',
    gradientType: 'strategy',
  },
  {
    traitA: 'trait-score-adaptor',
    traitB: 'trait-iron-discipline',
    label: 'Calculated Survivor',
    description: 'Knows when to press and when to protect. Never panics.',
    gradientType: 'discipline',
  },
  {
    traitA: 'trait-breakout-chaser',
    traitB: 'trait-threshold-harvester',
    label: 'Peak Predator',
    description: 'Chases the strongest stocks to scoring thresholds and harvests.',
    gradientType: 'strategy',
  },
  {
    traitA: 'trait-bargain-hunter',
    traitB: 'trait-iron-discipline',
    label: 'Careful Contrarian',
    description: 'Takes the other side of the trade but always has an exit plan.',
    gradientType: 'discipline',
  },
  {
    traitA: 'trait-dual-conviction',
    traitB: 'trait-patient-holder',
    label: 'Conviction Fortress',
    description: 'Demands proof from every angle, then holds with absolute faith.',
    gradientType: 'strategy',
  },
  {
    traitA: 'trait-diversifier',
    traitB: 'trait-penalty-dodger',
    label: 'Risk Fortress',
    description: 'Will never have a bad day. Might never have a great one either.',
    gradientType: 'discipline',
  },
  {
    traitA: 'trait-trend-rider',
    traitB: 'trait-breakout-chaser',
    label: 'Momentum Purist',
    description: 'Only buys strength. If it\'s not going up, it doesn\'t exist.',
    gradientType: 'instincts',
  },
  {
    traitA: 'trait-smart-money-tracker',
    traitB: 'trait-sector-rotator',
    label: 'Flow Rider',
    description: 'Follows the institutional capital rotation. Always in the right sector.',
    gradientType: 'strategy',
  },
];

/**
 * Find the active combo label for a set of equipped trait IDs.
 * Returns the first match (priority-ordered) or null.
 */
export function getActiveComboLabel(equippedTraitIds) {
  for (const combo of TRAIT_COMBOS) {
    if (equippedTraitIds.includes(combo.traitA) && equippedTraitIds.includes(combo.traitB)) {
      return combo;
    }
  }
  return null;
}
