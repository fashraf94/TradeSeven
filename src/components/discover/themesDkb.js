// src/components/discover/themesDkb.js
//
// Build-time bundle of the rich DKB JSON files keyed by Firestore
// doc id. Decision documented in Phase 0 audit (option B): the
// discoverThemes Firestore collection is the registry of which
// themes are active and in what order, but the rich modal content
// (full chain layer descriptions, sub-thesis bodies, risks,
// inflection points) lives in dkb/thematic/*.json and is bundled
// statically.
//
// The seed script's docId derivation (scripts/seed-discover-
// themes.js:106) is mirrored here so a Firestore doc looked up
// by id resolves to the same rich entry.

const modules = import.meta.glob('../../../dkb/thematic/*.json', {
  eager: true,
});

function deriveDocId(kebabId) {
  return `theme_${kebabId.replaceAll('-', '_')}`;
}

const themesByDocId = {};
for (const filepath in modules) {
  const data = modules[filepath]?.default ?? modules[filepath];
  if (!data?.id) continue;
  themesByDocId[deriveDocId(data.id)] = data;
}

export function getThemeRichEntry(docId) {
  return themesByDocId[docId] || null;
}

export default themesByDocId;
