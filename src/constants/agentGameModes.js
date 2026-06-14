// src/constants/agentGameModes.js
//
// P4 — the agent engine's gameMode-keyed mode config (founder ruling D1/D3,
// June 12, 2026; Spec §1.4, V2.1 §7). The engine gains a mode config; it is
// not rewritten. Two modes:
//
//   tiered (baggerbomb_agent)      — the live BaggerBomb agent game,
//                                    UNTOUCHED IN BEHAVIOR (the P4 invariant);
//                                    2/2/3 + mandatory crypto, 2x/1.5x/1x.
//   flat6  (baggerbomb_tournament) — the League Tournament agent layer:
//                                    6 stocks, no crypto, flat 1x. The
//                                    star/core/support arrays survive as SLOT
//                                    LABELS ONLY (2/2/2) so every tier
//                                    iterator, swap targeter and client pill
//                                    renderer works unchanged — flatness is a
//                                    MULTIPLIER property (the per-asset
//                                    tierMultiplier stamp), not a container
//                                    property.
//
// THE DEAD DOC CONFIG STAYS DEAD (founder ruling): scoring.tierMultipliers /
// pointValues on battle docs remain a written-never-read snapshot. Resolution
// here is by gameMode string, defaulting to tiered — a legacy battle doc with
// no/odd gameMode resolves to today's behavior by construction.
//
// IMPORT SURFACE: this module imports only the zero-import schema module
// (leagueTournament.js), so its transitive surface is Node-clean by
// construction — fenced api/ consumers import it under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import is the
// dependency-surface guard.

import { TOURNAMENT_GAME_MODE } from './leagueTournament.js';

// The mode of record for every pre-P4 battle — the literal createAgentBattle
// has always written (agentBattleService.js battle doc, photographed by the
// P4 battery).
export const TIERED_GAME_MODE = 'baggerbomb_agent';
export const FLAT6_GAME_MODE = TOURNAMENT_GAME_MODE; // 'baggerbomb_tournament'

export const MODE_CONFIGS = Object.freeze({
  [TIERED_GAME_MODE]: Object.freeze({
    gameMode: TIERED_GAME_MODE,
    label: 'tiered',
    // 7 active (2 star / 2 core / 2 support stocks + 1 support crypto).
    portfolioSize: 7,
    composition: Object.freeze({ star: 2, core: 2, support: 3 }),
    cryptoMandatory: true,
    benchStocks: 3,
    benchCrypto: true,
    // null → scorers resolve CONVICTION_MULTIPLIERS[asset.tier] (today's path).
    flatMultiplier: null,
    // What createAgentBattle records in the written-never-read scoring
    // snapshot — today's exact values for tiered (battery-photographed).
    scoringSnapshotTierMultipliers: Object.freeze({ star: 2.0, core: 1.5, support: 1.0 }),
    promptVariant: 'tiered',
  }),
  [FLAT6_GAME_MODE]: Object.freeze({
    gameMode: FLAT6_GAME_MODE,
    label: 'flat6',
    // 6 active stocks; star/core/support are slot labels only, all 1x.
    portfolioSize: 6,
    composition: Object.freeze({ star: 2, core: 2, support: 2 }),
    cryptoMandatory: false,
    // Founder ruling D5: flat6 battles start with an empty bench/hotBench;
    // the eval cron's existing hotBench refresh (ledger-filtered by P2)
    // populates swap candidates within a tick.
    benchStocks: 0,
    benchCrypto: false,
    // Stamped per-asset (tierMultiplier) at creation and swap-in; honored by
    // the scorers' override expression.
    flatMultiplier: 1.0,
    scoringSnapshotTierMultipliers: Object.freeze({ star: 1.0, core: 1.0, support: 1.0 }),
    promptVariant: 'flat6',
  }),
});

/**
 * gameMode → mode config. Unknown/absent gameMode resolves to tiered — the
 * P4 invariant's default posture: every legacy battle behaves exactly as
 * before.
 */
export function resolveModeConfig(gameMode) {
  return MODE_CONFIGS[gameMode] ?? MODE_CONFIGS[TIERED_GAME_MODE];
}
