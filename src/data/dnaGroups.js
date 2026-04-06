/**
 * Agent DNA Groups — The Three Pillars
 *
 * These replace the Strategy/Controls toggle and organize
 * the 8 rule categories into 3 user-facing groups.
 */

export const DNA_GROUPS = {
  instincts: {
    id: 'instincts',
    name: 'Instincts',
    description: 'What patterns your agent recognizes',
    icon: 'Eye',
    color: '#5EEAD4',
    categories: ['technical', 'tier_strategy'],
    maxTraits: 2,
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy',
    description: 'How your agent thinks about the game',
    icon: 'Brain',
    color: '#F59E0B',
    categories: ['fundamental', 'game_state', 'threshold'],
    maxTraits: 2,
  },
  discipline: {
    id: 'discipline',
    name: 'Discipline',
    description: 'How your agent controls itself',
    icon: 'Shield',
    color: '#EF4444',
    categories: ['risk', 'allocation', 'mid_battle'],
    maxTraits: 2,
  },
};

// Helper: given a rule category, return which DNA group it belongs to
export function getDnaGroupForCategory(category) {
  for (const [groupId, group] of Object.entries(DNA_GROUPS)) {
    if (group.categories.includes(category)) return groupId;
  }
  return null;
}

// Total trait slots across all groups
export const TOTAL_TRAIT_SLOTS = Object.values(DNA_GROUPS).reduce(
  (sum, g) => sum + g.maxTraits, 0
); // = 6
