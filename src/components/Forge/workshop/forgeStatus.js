// src/components/Forge/workshop/forgeStatus.js
//
// Generic component-status mapping for the Forge shelf. The shelf card + status
// chip are type-agnostic (draft / ready) so a trait "ready" state (Phase 4) can
// be added without a new card. Each real lifecycle maps onto the shared two:
//
//   watchlist : draft → draft,  committed → ready
//   bundle    : draft → draft,  forged → ready,  equipped → ready (+ in use)
//   trait     : (V1 has no draft lifecycle) equipped → ready
//
// "In use" is read-only and decided separately by the equip source of truth.

export const SHELF_DRAFT = 'draft';
export const SHELF_READY = 'ready';

export function watchlistShelfStatus(wl) {
  return wl?.status === 'committed' ? SHELF_READY : SHELF_DRAFT;
}

export function bundleShelfStatus(b) {
  if (b?.status === 'forged' || b?.status === 'equipped') return SHELF_READY;
  return SHELF_DRAFT;
}

// Overview tallies — count ready vs draft per area from real data.
export function countWatchlists(watchlists = []) {
  let ready = 0, draft = 0;
  for (const wl of watchlists) {
    if (watchlistShelfStatus(wl) === SHELF_READY) ready += 1; else draft += 1;
  }
  return { ready, draft, total: watchlists.length };
}

export function countBundles(bundles = []) {
  let ready = 0, draft = 0;
  for (const b of bundles) {
    if (bundleShelfStatus(b) === SHELF_READY) ready += 1; else draft += 1;
  }
  return { ready, draft, total: bundles.length };
}

// Traits (V1): equipped traits are the agent's active identity layer = "ready".
// There is no trait draft lifecycle yet (Phase 4), so draft is always 0.
export function countTraits(equippedTraits = []) {
  return { ready: equippedTraits.length, draft: 0, total: equippedTraits.length };
}
