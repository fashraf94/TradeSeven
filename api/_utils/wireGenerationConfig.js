// api/_utils/wireGenerationConfig.js
// FantasyTimes Wire — the per-seam generation config resolver (Phase 2 Spec
// V1.3 N0 / D-P2-9, V1.4 R3-B3, V1.5 R4-B2).
//
// getGenerationConfig(seam, flags) returns ONE frozen execution object per
// call. That object is the single source of truth for every generation
// parameter a Wire-context seam sends: wireModelCall builds the request from
// it AND derives the envelope provenance stamp from it, in the same function
// — so the stamp cannot disagree with the request (P11: provenance binds to
// execution by construction).
//
// D-P2-9 hard rule: the values below are LITERALS — never read from
// REPORTER_PROFILES, which provably lies for two reporters (profiles declare
// Haiku for the Neta and Doug previews while the call sites ran
// claude-sonnet-4-6; the profile↔model contradiction is in the Phase 2
// separate-tasking register). After P1 this table IS the model config; the
// profiles' `model` field is display metadata only.
//
// Byte-identity contract: every entry reproduces its seam's pre-P1 call-site
// parameters EXACTLY, including flag dependence, for both flag states —
// asserted per-seam by wireGenerationConfig.test.js and end-to-end by
// wirePayloadEquality.test.js. Known preserved quirk: doug_earnings_preview
// sends NO temperature (the only seam that doesn't) — a pre-existing gap
// already filed in the separate-tasking register; P1 preserves the request
// bytes and does not fix it.
//
// This file is inside the GENERATION_SURFACE manifest: any edit here —
// model id, sampling param, new seam — requires a WIRE_GENERATION_VERSION
// bump (F-M1), enforced by the committed-baseline hash (P2-15).

import { WIRE_GENERATION_VERSION } from './wireContracts.js';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

// Sonnet 4.6 defaults to high effort; the seams pin low + thinking disabled
// to preserve the prior Sonnet-4 (no-thinking) latency profile. One frozen
// pair, shared by reference across entries and requests.
const SONNET_LATENCY_PIN = Object.freeze({
  thinking: Object.freeze({ type: 'disabled' }),
  outputConfig: Object.freeze({ effort: 'low' }),
});

// maxTokens: a plain number is unconditional; { base, wireWrites } resolves
// on flags.writesEnabled — the §4.2 headroom raise for the agentFacts block.
const SEAM_EXECUTION = Object.freeze({
  // ── Wire generation seams (publishStoryWithWire callers) ───────────────
  kai_pulse: Object.freeze({
    model: MODEL_HAIKU, maxTokens: Object.freeze({ base: 800, wireWrites: 1200 }), temperature: 0.8,
  }),
  alex_mover: Object.freeze({
    model: MODEL_HAIKU, maxTokens: Object.freeze({ base: 500, wireWrites: 900 }), temperature: 0.8,
  }),
  neta_econ_recap: Object.freeze({
    model: MODEL_HAIKU, maxTokens: Object.freeze({ base: 600, wireWrites: 1000 }), temperature: 0.7,
  }),
  neta_econ_preview: Object.freeze({
    model: MODEL_SONNET, maxTokens: Object.freeze({ base: 1000, wireWrites: 1400 }), temperature: 0.8,
    ...SONNET_LATENCY_PIN,
  }),
  doug_earnings_recap: Object.freeze({
    model: MODEL_HAIKU, maxTokens: Object.freeze({ base: 500, wireWrites: 900 }), temperature: 0.8,
  }),
  // NO temperature — preserved pre-P1 request bytes (register item).
  doug_earnings_preview: Object.freeze({
    model: MODEL_SONNET, maxTokens: Object.freeze({ base: 800, wireWrites: 1200 }),
    ...SONNET_LATENCY_PIN,
  }),
  kim_column: Object.freeze({
    model: MODEL_SONNET, maxTokens: Object.freeze({ base: 1200, wireWrites: 1600 }), temperature: 0.85,
    ...SONNET_LATENCY_PIN,
  }),

  // ── Non-Wire callers inside the Wire context (R-A1 scope) ───────────────
  // alex_macro: producer-dead seam (no cron, dead HTTP caller) but a live
  // module in api/fantasytimes/** — routed so the P2-48 invariant holds
  // without carve-outs.
  alex_macro: Object.freeze({ model: MODEL_HAIKU, maxTokens: 700, temperature: 0.8 }),
  vera_deepdive: Object.freeze({
    model: MODEL_SONNET, maxTokens: 2000, temperature: 0.7, ...SONNET_LATENCY_PIN,
  }),
  art_director: Object.freeze({ model: MODEL_HAIKU, maxTokens: 500, temperature: 0 }),
});

export const WIRE_GENERATION_SEAMS = Object.freeze(Object.keys(SEAM_EXECUTION));

/**
 * Resolve the frozen execution object for one generation call.
 *
 * @param {string} seam — a WIRE_GENERATION_SEAMS id; unknown ids throw
 *        (fail loud — a silent default here would be an unstamped epoch).
 * @param {object} [flags] — getWireFlags() shape. Optional for seams with no
 *        flag-dependent params and no Wire envelope (alex_macro,
 *        vera_deepdive, art_director); flag-raised seams pass the SAME flags
 *        object they already resolved for the instruction/tool gating, so
 *        maxTokens and the prompt extension can never disagree on flag state.
 * @returns {Readonly<object>} frozen execution object:
 *        { seam, generationVersion, continuityEnabled, model, maxTokens,
 *          temperature?, thinking?, outputConfig? }
 */
export function getGenerationConfig(seam, flags) {
  const entry = SEAM_EXECUTION[seam];
  if (!entry) {
    throw new Error(`[WireGenerationConfig] unknown seam '${seam}' — not in WIRE_GENERATION_SEAMS`);
  }
  const maxTokens = typeof entry.maxTokens === 'number'
    ? entry.maxTokens
    : (flags?.writesEnabled === true ? entry.maxTokens.wireWrites : entry.maxTokens.base);

  const execution = {
    seam,
    generationVersion: WIRE_GENERATION_VERSION,
    continuityEnabled: flags?.continuityEnabled === true,
    model: entry.model,
    maxTokens,
  };
  // Explicit field copy — a seam table entry can never smuggle an
  // unrecognized generation param into the execution object (F-M7 pattern).
  if (entry.temperature !== undefined) execution.temperature = entry.temperature;
  if (entry.thinking !== undefined) execution.thinking = entry.thinking;
  if (entry.outputConfig !== undefined) execution.outputConfig = entry.outputConfig;

  return Object.freeze(execution);
}
