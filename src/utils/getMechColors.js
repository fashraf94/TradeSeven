/**
 * getMechColors — Computes mech SVG color personality from DNA distribution.
 *
 * @param {Object} slotUsage - { instincts: { used, max }, strategy: { used, max }, discipline: { used, max } }
 * @returns {Object} Color configuration for MechSVG
 */

const DNA_COLORS = {
  instincts: '#5EEAD4',   // teal
  strategy: '#F59E0B',    // amber
  discipline: '#EF4444',  // red
};

const STANDBY = {
  mode: 'standby',
  primaryGlow: '#718096',     // Text Muted — dim wireframe
  visorColor: '#4A5568',      // darker — visor "powered off"
  gradientStart: '#718096',
  gradientEnd: '#718096',
  glowIntensity: 0,
};

export function getMechColors(slotUsage) {
  if (!slotUsage) return STANDBY;

  const groups = [
    { id: 'instincts', count: slotUsage.instincts?.used || 0, color: DNA_COLORS.instincts },
    { id: 'strategy', count: slotUsage.strategy?.used || 0, color: DNA_COLORS.strategy },
    { id: 'discipline', count: slotUsage.discipline?.used || 0, color: DNA_COLORS.discipline },
  ].sort((a, b) => b.count - a.count);

  const totalEquipped = groups.reduce((sum, g) => sum + g.count, 0);

  if (totalEquipped === 0) return STANDBY;

  const primary = groups[0];
  const secondary = groups[1];

  return {
    mode: 'active',
    primaryGlow: primary.color,
    visorColor: secondary.count > 0 ? secondary.color : primary.color,
    gradientStart: primary.color,
    gradientEnd: secondary.count > 0 ? secondary.color : '#ffffff',
    glowIntensity: Math.min(totalEquipped / 6, 1),
  };
}
