// src/data/archetypeCharacter.js
//
// The authored CONTENT layer for the Traits → Archetype Exploration surface.
//
// This is the ONLY net-new content the redesign introduces. Everything else
// (disposition/reveal/voice, display names, signature traits, the 16-trait
// library, per-trait hardness, the live loadout) is read from existing live
// sources — see getArchetypeCharacter() below, which composes them.
//
// What lives here:
//   • ARCHETYPE_CHARACTER — per code-id: the four decision-factor copy axes
//     (directional, comparable, NO numeric thresholds), the temperament slider
//     position, the combo flavor title, and the color pair.
//   • The color pairs MIRROR the real avatarColors in
//     api/_utils/agentArchetypeConfig.js (the calibration fence). They are
//     re-typed here as display values and cross-checked by the test — this file
//     NEVER imports the fenced module.
//
// Honesty rules (from the build spec §0/§7):
//   • Display names only, never code-ids (resolved via archetypeDisplay).
//   • Physics described directionally — never a quoted threshold/number.
//   • Hardness is computed from rules at render time (traitEnforcement), never
//     authored here.
//   • The combo is a real TRAIT_COMBOS label, not a fabricated one.

import { getArchetypeIdentity } from './archetypeIdentity';
import { getArchetypeDisplayName } from './archetypeDisplay';
import { ARCHETYPE_DEFAULT_TRAITS } from './traitLibrary';

// ── the four decision-factor axes — identical for all six so they compare cleanly ──
export const FACTOR_AXES = [
  { key: 'huntsFor', label: 'Hunts for', icon: 'target', note: 'What it picks' },
  { key: 'hardRule', label: 'Hard rule', icon: 'lock', note: 'The constraint it must obey', constraint: true },
  { key: 'temperament', label: 'Temperament', icon: 'scale', note: 'Deliberate ↔ bold', spectrum: ['Deliberate', 'Bold'] },
  { key: 'positionStyle', label: 'Position style', icon: 'layers', note: 'How it works a position' },
];

// ── DNA pillar → forgeKit Icon glyph (colors/labels/blurbs come from DNA_GROUPS) ──
export const PILLAR_ICON = { instincts: 'eye', strategy: 'compass', discipline: 'shield' };
export const PILLAR_ORDER = ['instincts', 'strategy', 'discipline'];

// ── strength display meta (values match useTraits: subtle/moderate/dominant) ──
export const STRENGTH_META = {
  subtle: { label: 'Subtle', dots: 1 },
  moderate: { label: 'Moderate', dots: 2 },
  dominant: { label: 'Dominant', dots: 3 },
};

// ── roster display order (stable code-ids) ──
export const ROSTER_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// ── per-archetype authored content, keyed by stable code-id ──
// colors  = mirror of avatarColors (agentArchetypeConfig.js — verified by test)
// combo   = real TRAIT_COMBOS label for the signature set (shown sparingly, per the mock)
// factors = directional decision-factor copy (handoff §3 / mock ARCH_ROSTER)
// tempPos = temperament slider position, 0 (deliberate) → 1 (bold)
export const ARCHETYPE_CHARACTER = {
  momentum_chaser: {
    colors: ['#5eead4', '#a855f7'],
    combo: 'Momentum Purist',
    tempPos: 0.62,
    factors: {
      huntsFor:
        'Names already in motion — strong technicals, momentum, and the volatility to ride. Pays little attention to fundamentals and doesn’t spread across sectors.',
      hardRule:
        'Must fish in the day’s hottest sectors (names from the top performers) and stay out of what’s falling.',
      temperament: 'Disciplined, not impulsive — consistent picks, quick exits.',
      positionStyle:
        'Trades often and rotates out of fading names fast; leans on volume and momentum to confirm a move.',
    },
  },
  contrarian: {
    colors: ['#a855f7', '#ef4444'],
    combo: null,
    tempPos: 0.5,
    factors: {
      huntsFor:
        'What the market has given up on — the more beaten-down, the more interested. Actively discounts whatever’s already winning.',
      hardRule: 'Must shop in the day’s worst-performing sectors and avoid the top sector entirely.',
      temperament: 'Independent — comfortable being early and looking wrong for a while.',
      positionStyle:
        'Will step into genuinely distressed names others won’t, and gives the bet time to turn rather than chasing.',
    },
  },
  diversifier: {
    colors: ['#10b981', '#3b82f6'],
    combo: null,
    tempPos: 0.42,
    factors: {
      huntsFor:
        'Breadth and balance — rewards spreading across sectors, leans on quality with some upside, steers away from the wildest movers.',
      hardRule: 'Must span many sectors, with no more than a handful of names in any one.',
      temperament: 'Even-handed — no single-factor obsession.',
      positionStyle:
        'Holds many small positions across a wide field rather than concentrating; the spread is the strategy.',
    },
  },
  degen: {
    colors: ['#ef4444', '#f59e0b'],
    combo: null,
    tempPos: 0.96,
    factors: {
      huntsFor: 'The biggest movers — volatility above everything, big-upside names, fundamentals ignored entirely.',
      hardRule: 'Must hold genuinely high-volatility names; fundamentals are explicitly off the table.',
      temperament: 'The boldest and most improvisational of the six.',
      positionStyle:
        'Trades constantly, acts on thin conviction, concentrates freely — explosive upside and hard hits, by design.',
    },
  },
  analyst: {
    colors: ['#3b82f6', '#5eead4'],
    combo: null,
    tempPos: 0.16,
    factors: {
      huntsFor:
        'Quality first — strong fundamentals lead, technicals are a secondary check, the most volatile names are avoided.',
      hardRule:
        'A real quality floor — only names with strong fundamentals make the cut; weak ones are excluded outright.',
      temperament: 'The most deliberate of the six — slow, consistent, a high bar to act.',
      positionStyle: 'Patient — needs strong conviction before moving and holds through noise.',
    },
  },
  guardian: {
    colors: ['#3b82f6', '#10b981'],
    combo: 'Risk Fortress',
    tempPos: 0.12,
    factors: {
      huntsFor:
        'Safety and spread — rewards diversification and quality, deliberately downweights chasing big upside, avoids volatility.',
      hardRule:
        'A quality floor, a forced spread across many sectors, and a ceiling on volatility — the edge is avoiding busts, not catching baggers.',
      temperament: 'Cautious and deliberate.',
      positionStyle:
        'Trades rarely and holds defensively — the only archetype that won’t chase rotation, with the highest bar to act of all six.',
    },
  },
};

// Fallback mirrors the server-side derivation default (and getArchetypeIdentity).
const FALLBACK_ID = 'analyst';

/**
 * Compose the full "character" object the exploration UI renders, by merging the
 * authored content here with the live identity / display name / signature traits.
 * Unknown code-ids fall back to the analyst profile (mirrors getArchetypeIdentity).
 *
 * @param {string} codeId stable archetype code-id (e.g. 'momentum_chaser')
 * @returns {{
 *   id: string, name: string, colors: [string,string], combo: string|null,
 *   disposition: string, reveal: string, voice: string,
 *   factors: { huntsFor: string, hardRule: string, temperament: string, positionStyle: string },
 *   tempPos: number, signature: string[]
 * }}
 */
export function getArchetypeCharacter(codeId) {
  const id = ARCHETYPE_CHARACTER[codeId] ? codeId : FALLBACK_ID;
  const character = ARCHETYPE_CHARACTER[id];
  const identity = getArchetypeIdentity(id);
  return {
    id,
    name: getArchetypeDisplayName(id),
    colors: character.colors,
    combo: character.combo,
    disposition: identity.disposition,
    reveal: identity.reveal,
    voice: identity.voice,
    factors: character.factors,
    tempPos: character.tempPos,
    signature: ARCHETYPE_DEFAULT_TRAITS[id] || [],
  };
}

/** The full roster as composed character objects, in display order. */
export function getArchetypeRoster() {
  return ROSTER_ORDER.map((id) => getArchetypeCharacter(id));
}
