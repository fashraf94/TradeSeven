// src/data/traitFamilies.js
//
// PRESENTATION-ONLY family overlay for the Trait V2.2 "Clarity MVP".
//
// Re-groups the 16 cards into two public shelves the player actually reasons
// about — Temperament Traits ("how your agent behaves") and Play Cards ("what
// your agent hunts") — plus a neutral "Preview" bucket for cards that don't
// belong to either yet (Score Adaptor).
//
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT — families are DISPLAY metadata only. They DO NOT drive equip
// eligibility, slot caps, default seeding, or rule projection. Those remain bound
// to `dnaGroup` (dnaGroups.js) and the useTraits hook, which are untouched. A
// card's public family can therefore differ from the slot pool it consumes:
// e.g. Sector Rotator shows under "Play" but still fills a *strategy* slot, and
// Score Adaptor ("Preview") still fills a *strategy* slot. The per-group slot
// accounting stays visible in the equip surfaces so this is never deceptive.
//
// Nothing in the mechanical path imports this module — keep it that way.
// ─────────────────────────────────────────────────────────────────────────────

// Family metadata, in display order. `accent` mirrors the existing token palette.
export const TRAIT_FAMILIES = {
  temperament: {
    id: 'temperament',
    name: 'Temperament Traits',
    short: 'Temperament',
    tagline: 'How your agent behaves',
    blurb: 'Dispositions that lean how your agent acts — when it cuts, holds, harvests, or spreads. Advisory: your archetype still sets the hard limits.',
    accent: '#F59E0B',
    order: 0,
  },
  play: {
    id: 'play',
    name: 'Play Cards',
    short: 'Play',
    tagline: 'What your agent hunts',
    blurb: 'Selection instincts that lean what your agent looks for — the patterns and setups it favors when picking names.',
    accent: '#5EEAD4',
    order: 1,
  },
  preview: {
    id: 'preview',
    name: 'Preview',
    short: 'Preview',
    tagline: 'Experimental — not in a family yet',
    blurb: 'Functional and equippable, but still being shaped. Behaves exactly as before; just not filed under a public family yet.',
    accent: '#94A3B8',
    order: 2,
  },
};

// Render order for the family shelves.
export const FAMILY_ORDER = ['temperament', 'play', 'preview'];

// Explicit traitId → family map (the locked V2.2 mapping). Not derivable from
// dnaGroup, because Sector Rotator (strategy) → play and Score Adaptor
// (strategy) → preview.
const TRAIT_FAMILY_BY_ID = {
  // Temperament (8) — old Strategy {3} + Discipline {5}
  'trait-dual-conviction': 'temperament',
  'trait-iron-discipline': 'temperament',
  'trait-active-trader': 'temperament',
  'trait-patient-holder': 'temperament',
  'trait-let-winners-run': 'temperament',
  'trait-threshold-harvester': 'temperament',
  'trait-penalty-dodger': 'temperament',
  'trait-diversifier': 'temperament',
  // Play (7) — old Instincts {6} + Sector Rotator (moved from Strategy)
  'trait-trend-rider': 'play',
  'trait-bargain-hunter': 'play',
  'trait-squeeze-whisperer': 'play',
  'trait-breakout-chaser': 'play',
  'trait-volume-believer': 'play',
  'trait-smart-money-tracker': 'play',
  'trait-sector-rotator': 'play',
  // Preview (1) — no family
  'trait-score-adaptor': 'preview',
};

// Play Cards whose selection lean mirrors an archetype's edge — surfaced as an
// "archetype-aligned" tag so a player understands the overlap. (Data/label only
// in Phase 1; the §4.7 compatibility policy is Phase 1B.)
const ARCHETYPE_ALIGNED = new Set(['trait-trend-rider', 'trait-bargain-hunter']);

/**
 * Public family for a trait. Unknown / unmapped ids FAIL CLOSED to 'preview' —
 * the neutral bucket — so a new card can never silently land in a curated
 * Temperament/Play shelf (or crash a renderer) before it's been mapped.
 * @param {string} traitId
 * @returns {'temperament'|'play'|'preview'}
 */
export function getTraitFamily(traitId) {
  return TRAIT_FAMILY_BY_ID[traitId] || 'preview';
}

/** Whether a card carries the "archetype-aligned" tag. */
export function isArchetypeAligned(traitId) {
  return ARCHETYPE_ALIGNED.has(traitId);
}

/** Family metadata for a family id; unknown ids resolve to the Preview meta. */
export function getFamilyMeta(familyId) {
  return TRAIT_FAMILIES[familyId] || TRAIT_FAMILIES.preview;
}

/**
 * Group a list of trait objects (each with an `id`) into ordered family buckets
 * for rendering. Empty families are dropped. Order follows FAMILY_ORDER.
 * @param {Array<{id:string}>} traits
 * @returns {Array<{ family: string, meta: Object, traits: Array }>}
 */
export function groupTraitsByFamily(traits) {
  const buckets = {};
  for (const t of traits || []) {
    const fam = getTraitFamily(t?.id);
    (buckets[fam] ||= []).push(t);
  }
  return FAMILY_ORDER
    .filter((fam) => buckets[fam]?.length)
    .map((fam) => ({ family: fam, meta: TRAIT_FAMILIES[fam], traits: buckets[fam] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1B — SOFT archetype-compatibility (Play cards). POLICY/DISPLAY ONLY.
//
// A Play card whose selection lean pulls against an archetype's edge shows a
// NON-BLOCKING heads-up on equip — the user can still equip it. There is NO
// mechanical enforcement and NO "tilt within legal universe" precedence here;
// that is Phase 2. `hardBlockedArchetypes` is intentionally omitted (no hard
// blocks in Phase 1). Default seeding is already hand-curated so no conflict
// card is ever seeded — this metadata is belt-and-suspenders + drives the warning.
//
// Archetype keys are CODE-IDs (momentum_chaser, degen, contrarian, …).
// ─────────────────────────────────────────────────────────────────────────────
export const PLAY_CARD_ARCHETYPE_FIT = {
  'trait-trend-rider': {
    compatibleArchetypes: ['momentum_chaser', 'degen'],
    softConflictArchetypes: ['contrarian'],
    conflictCopy: 'Heads up: Trend Rider hunts established uptrends, which leans against a Contrarian agent’s fade-the-crowd edge. You can still equip it.',
  },
  'trait-breakout-chaser': {
    compatibleArchetypes: ['momentum_chaser', 'degen'],
    softConflictArchetypes: ['contrarian'],
    conflictCopy: 'Heads up: Breakout Chaser chases new highs, which leans against a Contrarian agent’s fade-the-crowd edge. You can still equip it.',
  },
  'trait-bargain-hunter': {
    compatibleArchetypes: ['contrarian'],
    softConflictArchetypes: ['momentum_chaser'],
    conflictCopy: 'Heads up: Bargain Hunter buys beaten-down names, which leans against a Trend Follower agent’s momentum edge. You can still equip it.',
  },
};

/** Per-card archetype-fit metadata (or null for cards with no fit data). */
export function getArchetypeFit(traitId) {
  return PLAY_CARD_ARCHETYPE_FIT[traitId] || null;
}

/**
 * Soft-conflict heads-up copy for equipping `traitId` on an agent of `archetype`,
 * or null when there's no soft conflict. NON-BLOCKING — callers warn but still
 * allow the equip.
 * @param {string} traitId
 * @param {string} archetype - agent archetype CODE-ID
 * @returns {string|null}
 */
export function getSoftConflictCopy(traitId, archetype) {
  const fit = PLAY_CARD_ARCHETYPE_FIT[traitId];
  if (!fit || !archetype) return null;
  return fit.softConflictArchetypes?.includes(archetype) ? fit.conflictCopy : null;
}
