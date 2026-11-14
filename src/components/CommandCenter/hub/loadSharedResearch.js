// src/components/CommandCenter/hub/loadSharedResearch.js
//
// Command Center core spec V1.2, Amendment E V1.1 §3.2 (E-2; ruling R-D3) — the one import() of the Shared Research sheet's
// body: the hub graph's SECOND load-time edge, beside the agent form's engine (AgentForm/loadEngine.js, whose pattern this
// is). The body (~165 kB of source, with its screens and its service) stays out of the hub chunk and is requested only when
// the sheet first opens. The promise is kept, so the chunk is requested once per page; it is reset on failure, so a retry
// starts a fresh import.

let pending = null;

export function loadSharedResearch() {
  if (!pending) pending = import('../../SharedResearch/SharedResearchSheetBody.jsx').catch((error) => { pending = null; throw error; });
  return pending;
}
