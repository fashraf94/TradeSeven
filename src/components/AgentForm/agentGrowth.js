// src/components/AgentForm/agentGrowth.js
//
// The agent's two growth tracks, as proposed in the Phase 0 report
// (docs/audits/20261028_PHASE0_AGENT_IDENTITY.md §7). No Firestore read in V1: the caller hands in records
// it already holds. Neither track has an honest source today (no partnership record; the plays ledger is
// dark and never reaches 'installed'), so both stages are 1 everywhere; the thresholds are a founder ruling.

export function getAgentGrowth(agentId, sources = {}) {
  // sources.core:  e.g. Shadow's split record or confirmed partnership preferences, once they exist
  // sources.armor: e.g. installed plays on this archetype (agents/{agentId}/plays, stage 'installed'), once that stage has a writer
  const core = Array.isArray(sources.core) ? sources.core : [];
  const armor = Array.isArray(sources.armor) ? sources.armor : [];
  return { coreStage: 1, armorStage: 1, sources: { core, armor } }; // stage 1 until a real source exists; thresholds are a ruling
}
