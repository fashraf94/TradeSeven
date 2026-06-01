// src/data/archetypeDisplay.js
//
// CANONICAL source of truth for USER-FACING archetype display names (frontend).
//
// The API side mirrors these strings via `.label` in
// api/_utils/agentArchetypeConfig.js (the API cannot import from src/, and we do
// not bundle that config client-side). When you rename a display name, update
// BOTH this map and the matching `.label` so the UI and the agent's own chat
// (Voice Layer) stay in sync.
//
// IMPORTANT: the keys below are stable code-ids used across Firestore, scoring,
// validators, and the quiz — NEVER rename a key. Only the display strings are
// user-facing and safe to change.

export const ARCHETYPE_DISPLAY_NAMES = {
  momentum_chaser: 'Momentum Hunter',
  degen: 'Degen',
  contrarian: 'Contrarian',
  analyst: 'Analyst',
  guardian: 'Guardian',
  diversifier: 'Broad Market Specialist',
};

// Resolve a code-id to its user-facing display name.
//   - known code-id      → its display name
//   - unknown-but-present → humanized form (legacy fallback, e.g. "foo_bar" → "Foo bar")
//   - falsy/missing       → 'Unknown'
export const getArchetypeDisplayName = (archetype) => {
  if (!archetype) return 'Unknown';
  return (
    ARCHETYPE_DISPLAY_NAMES[archetype] ||
    archetype.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
};
