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

// Bundle pill tier (draft / ready / equipped) — the shelf chip distinguishes
// "equipped" (in use) from plain "ready". Single source for the bundle pill.
export function bundlePillStatus(b) {
  if (b?.status === 'equipped') return 'equipped';
  if (b?.status === 'forged') return SHELF_READY;
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

// The overview's "ready to equip / in progress" aggregate — Watchlists + Rule
// bundles ONLY. Traits are deliberately EXCLUDED: an equipped trait is in-use,
// not "ready to equip," and traits have no draft lifecycle, so folding them in
// overstated "ready" and could never contribute a real "in progress". Traits are
// surfaced as their own equipped summary instead (see ForgeOverview).
export function countForgeAggregate(watchlists = [], bundles = []) {
  const wl = countWatchlists(watchlists);
  const b = countBundles(bundles);
  return { ready: wl.ready + b.ready, draft: wl.draft + b.draft };
}
