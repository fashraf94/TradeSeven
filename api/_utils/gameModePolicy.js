// api/_utils/gameModePolicy.js
//
// Archetype Architecture Phase 2 (P2.1) — the GameModePolicy contract
// (Spec §1.3, R1 finding 29; A-2 adds gameModePolicyHash). Documents the
// existing per-mode substrate behind a versioned, hashed read surface; no
// behavior change, zero production consumers in Phase 2.
//
// Mode vocabulary: the live agentBattles gameMode literals are
// 'baggerbomb_agent' (tiered/clash) and 'baggerbomb_tournament' (flat6 —
// which League training pods also ride, distinguished by group flags, not by
// gameMode). 'training' and 'season' below are POLICY entries the spec names
// (§1.3): training pods deploy flat6 battles under the training intervention
// tier; season experiments never create agentBattles (workshop pipeline).
// The vehicle mode is Phase 6 and deliberately absent.
//
// A-2: one CompiledBuild is valid for exactly ONE mode; gameMode +
// gameModePolicyVersion + gameModePolicyHash enter both contentHash and
// sourceRevisionVector, and the lock transaction re-verifies all three.

import {
  TIERED_GAME_MODE,
  FLAT6_GAME_MODE,
  MODE_CONFIGS,
} from '../../src/constants/agentGameModes.js';
import { GAME_MODE_POLICY_VERSION } from './archetypeVersionConstants.js';
import { canonicalContentHash } from './canonicalHash.js';

// DR-2 intervention tiers (§1.3): training = gated logged directives;
// ranked = gated + receipted; vehicle = none post-lock (Phase 6, absent).
export const INTERVENTION_TIERS = Object.freeze({
  TRAINING: 'training_gated_logged',
  RANKED: 'ranked_gated_receipted',
});

// The deploy surface a CompiledBuild can target at HEAD: the two live
// agentBattles gameMode literals. Season/training policies exist below for
// contract completeness but map onto these battle modes (training → flat6)
// or onto no battle at all (season).
export const LIVE_DEPLOY_MODES = Object.freeze([TIERED_GAME_MODE, FLAT6_GAME_MODE]);

export const GAME_MODE_POLICIES = Object.freeze({
  [TIERED_GAME_MODE]: Object.freeze({
    gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
    mode: TIERED_GAME_MODE,
    // Tier slots with real multipliers (2/2/3 + mandatory crypto, 2x/1.5x/1x)
    // — governs which guardrail types are applicable (position-scoped caps
    // are tier-slot semantics here).
    slotStructure: Object.freeze({
      kind: 'tier_slots',
      composition: MODE_CONFIGS[TIERED_GAME_MODE].composition,
      cryptoMandatory: true,
      flatMultiplier: null,
    }),
    // Universe: open BaggerBomb universe + equipped-watchlist union (census
    // Map 5: hotBench/monitoring rebuilt live from stockRankings).
    eligibilityFilters: Object.freeze({ universe: 'open_rankings_plus_watchlist' }),
    interventionTier: INTERVENTION_TIERS.RANKED,
    // The existing corpus `modes` field vocabulary ('both' | 'clash' |
    // 'season') — which rules are admissible in this mode.
    ruleModeGate: Object.freeze(['both', 'clash']),
    freezeExceptions: Object.freeze([]),
    precedencePosition: 2,
  }),
  [FLAT6_GAME_MODE]: Object.freeze({
    gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
    mode: FLAT6_GAME_MODE,
    // Flat 6: star/core/support survive as SLOT LABELS only (2/2/2), flat 1x
    // stamped per asset (agentGameModes.js MODE_CONFIGS).
    slotStructure: Object.freeze({
      kind: 'flat6_labels',
      composition: MODE_CONFIGS[FLAT6_GAME_MODE].composition,
      cryptoMandatory: false,
      flatMultiplier: 1.0,
    }),
    // Tournament candidate pool is ledger-filtered (agent exclusivity —
    // BUILD_RULES §7: two-phase reserve/confirm around executeSwapServer).
    eligibilityFilters: Object.freeze({ universe: 'tournament_ledger_filtered' }),
    interventionTier: INTERVENTION_TIERS.RANKED,
    ruleModeGate: Object.freeze(['both', 'clash']),
    // Mode-specific deviations from the §8 freeze policy, each with
    // rationale. Deploys are prescribed-portfolio only in tournament mode
    // (BUILD_RULES §7) — recorded as a freeze-adjacent fact, not a deviation.
    freezeExceptions: Object.freeze([]),
    precedencePosition: 2,
  }),
  // Training pods ride flat6 battles; the policy differs ONLY in
  // intervention tier (DR-2: gated logged directives) and scoring context
  // (MODE_MULT 0.6 — a settlement fact, not a compile input).
  training: Object.freeze({
    gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
    mode: 'training',
    slotStructure: Object.freeze({
      kind: 'flat6_labels',
      composition: MODE_CONFIGS[FLAT6_GAME_MODE].composition,
      cryptoMandatory: false,
      flatMultiplier: 1.0,
    }),
    eligibilityFilters: Object.freeze({ universe: 'training_pod_board' }),
    interventionTier: INTERVENTION_TIERS.TRAINING,
    ruleModeGate: Object.freeze(['both', 'clash']),
    freezeExceptions: Object.freeze([]),
    precedencePosition: 2,
  }),
  // Season experiments run the workshop pipeline — no agentBattles doc, no
  // deploy path. The policy exists so season-only rules ('season' mode gate)
  // have a declared admission surface (A-4 scopes the compat matrix to rules
  // equippable in any LAUNCH mode per this table).
  season: Object.freeze({
    gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
    mode: 'season',
    slotStructure: Object.freeze({ kind: 'season_experiment', composition: null, cryptoMandatory: false, flatMultiplier: null }),
    eligibilityFilters: Object.freeze({ universe: 'season_entry' }),
    interventionTier: INTERVENTION_TIERS.RANKED,
    ruleModeGate: Object.freeze(['both', 'season']),
    freezeExceptions: Object.freeze([]),
    precedencePosition: 2,
  }),
});

/**
 * §1.3 read surface. Unknown mode returns null — the compiler fails loudly
 * on a mode it can't resolve (mirrors createAgentBattle's unknown-mode
 * throw); no silent tiered fallback here, because a CompiledBuild is valid
 * for exactly one EXPLICIT mode (A-2).
 */
export function getGameModePolicy(mode) {
  return GAME_MODE_POLICIES[mode] ?? null;
}

/**
 * A-2 content hash for one mode's policy (version field excluded — the hash
 * detects content change; the version records intent). Both enter
 * CompiledBuild.contentHash and sourceRevisionVector; the lock transaction
 * re-verifies mode + version + hash exactly like a settingsRev mismatch.
 */
export function computeGameModePolicyHash(mode) {
  const policy = getGameModePolicy(mode);
  if (!policy) return null;
  const { gameModePolicyVersion, ...content } = policy;
  return canonicalContentHash(content);
}
