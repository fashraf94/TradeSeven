// api/_utils/huddle/archetypeWords.js
//
// Huddle — an archetype's display name and one-line disposition, through the registry (the path new consumers take; no
// §2.3 importer of a legacy archetype table, BUILD_RULES §1). Shared by the script job (the armor beat's archetype words)
// and the confirm route's per-archetype preview (Amendment E §E1: "For your Diversifier game: …"). Never throws.

import { getArchetypeDefinition } from '../archetypeRegistry.js';

/** @returns {[string|null, string|null]} the display name and the disposition, or nulls */
export function archetypeWordsOf(archetype) {
  try {
    const def = archetype ? getArchetypeDefinition(archetype) : null;
    return [def?.displayName ?? null, def?.identity?.disposition ?? null];
  } catch {
    return [null, null];
  }
}

/** The display name alone, or null. */
export const archetypeNameOf = (archetype) => archetypeWordsOf(archetype)[0];
