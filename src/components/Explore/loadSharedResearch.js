// src/components/Explore/loadSharedResearch.js
//
// Explore Build 1 (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3.6, §7; build prompt K-3) — the
// Work an idea sheet's SECOND door (B6a X-6; the first is the hub's, in the same pattern): the one load-time
// import() of the sheet's body, and nothing else from its directory. The body, its screens and its service stay
// out of every Explore chunk until the sheet first opens. The promise is kept, so the chunk is requested once
// per page; it is reset on failure, so Try again starts a fresh import.
// Guarded by the sheet's own boundary test (doorProblemsOf, EXPLORE_DOOR) and by explore.boundary.test.js.

let pending = null;

export function loadSharedResearch() {
  if (!pending) pending = import('../SharedResearch/SharedResearchSheetBody.jsx').catch((error) => { pending = null; throw error; });
  return pending;
}
