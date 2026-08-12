// api/_utils/mandateGenerationConfig.js
//
// Spec 1 — Mandate Substrate — the mandate manager's MODEL SEAT + cadence-tier
// configuration. Pure config data (Node-clean; NO Anthropic client, NO call
// logic — the model SEAM `mandateModelCall.js` is P2/P5 and is deliberately
// NOT built here). This module exists in Phase 1 because the vintage publish
// step (§5.1) freezes the model seat into every published vintage (FR-6 / D-44):
// a mid-quarter model swap must not be able to reach an active book — model and
// gate changes propagate per-user at rollover.
//
// D-7: the mandate's MANAGER is a separate agent from the user's arena agents.
// D-19: cadence is an archetype property.
// D-24: the battle Trading Brain stays on Haiku pre-launch; the mandate manager
//       is a distinct seat and is seated on Haiku here for cost (§6.3 envelope
//       — ~$0.0075/eval at 12K in / 600 out matches Haiku batch pricing).

import { listArchetypeIds } from './archetypeRegistry.js';

// ── Default model seat ───────────────────────────────────────────────────────
// Provider + model id + generation params. PROVISIONAL Phase-1 default: the
// charter pins no specific mandate-manager model, and Prerequisite C (D-40) may
// revise model choice by harness. Any change propagates per-user at rollover
// (D-44), never mid-quarter, and is frozen per-book by the vintage pin. The id
// matches the app's in-use Claude model set (api/agent/decide.js).
export const MANDATE_DEFAULT_MODEL_SEAT = Object.freeze({
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  params: Object.freeze({
    // ~600 output tokens per the §6.3 reference envelope; temperature is a
    // provisional default (founder-tunable, propagates at rollover).
    temperature: 0.7,
    maxTokens: 600,
  }),
});

// Per-archetype seat overrides. Empty in V1 — every archetype rides the default
// seat. Present as the binding point for a future per-archetype model decision
// (e.g. seating a slow, deliberative archetype on a stronger model). A future
// override changes the vintage hash for that archetype only, and reaches books
// at rollover.
const SEAT_OVERRIDES = Object.freeze({});

// ── Cadence tier per archetype (D-19) ────────────────────────────────────────
// Provisional Phase-1 assignment; founder-tunable, propagates at rollover.
// The §6.3 cost envelope assumes a 40/40/20 slow/standard/fast USER mix — this
// map is per-archetype, not per-user, and is orthogonal to that assumption.
const ARCHETYPE_CADENCE_TIER = Object.freeze({
  analyst: 'slow',          // Fundamental Investor — long horizon
  guardian: 'slow',         // Capital Preserver — deliberate
  contrarian: 'standard',   // Contrarian
  diversifier: 'standard',  // Diversifier
  momentum_chaser: 'fast',  // Trend Follower — momentum-reactive
  degen: 'fast',            // Speculator — fast-twitch
});

const DEFAULT_CADENCE_TIER = 'standard';

/**
 * The model seat for an archetype: the per-archetype override merged over the
 * default seat. Returns a plain (deep-cloned) object safe to embed in a vintage
 * payload. Unknown archetype → null (fail-closed; the caller must validate).
 */
export function getModelSeat(codeId) {
  if (!listArchetypeIds().includes(codeId)) return null;
  const override = SEAT_OVERRIDES[codeId] || null;
  const base = MANDATE_DEFAULT_MODEL_SEAT;
  return {
    provider: override?.provider ?? base.provider,
    model: override?.model ?? base.model,
    params: { ...base.params, ...(override?.params || {}) },
  };
}

/**
 * The cadence tier for an archetype (D-19). Unknown archetype → null
 * (fail-closed). Known archetype with no explicit mapping → DEFAULT_CADENCE_TIER.
 */
export function getCadenceTier(codeId) {
  if (!listArchetypeIds().includes(codeId)) return null;
  return ARCHETYPE_CADENCE_TIER[codeId] ?? DEFAULT_CADENCE_TIER;
}
