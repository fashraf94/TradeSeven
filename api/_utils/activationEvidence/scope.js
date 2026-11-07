// api/_utils/activationEvidence/scope.js
//
// ID-1 Build 2 — WHICH BATTLES ARE RECORDED (contract §2, ruling Q-ID1-1).
// Tiered BaggerBomb battles (`gameMode` absent or `baggerbomb_agent`), the
// owner's agent side, whose battle carries agentContext.archetype =
// 'momentum_chaser'. Casual clones are included. Excluded and counted:
// tournament battles, CPU sides (`isCpu`), training clones (`training-agent-`)
// and other archetypes. A battle meeting several exclusions is counted ONCE,
// under the first in this order: game mode, CPU, training clone, archetype.
//
// Pure. Its src/ imports are constants modules with no imports of their own
// (BUILD_RULES §4); scope.test.js imports this module unmocked, which is the
// dependency-surface guard for that graph.

import { TIERED_GAME_MODE } from '../../../src/constants/agentGameModes.js';
import { TRAINING_CLONE_ID_PREFIX } from '../../../src/constants/leagueTournament.js';
import { TREND_FOLLOWER_ARCHETYPE } from './constants.js';

/** `gameMode` as recorded: absent (or null) reads as no field, which is the legacy tiered battle. */
const hasNoGameMode = (battle) => battle?.gameMode === undefined || battle?.gameMode === null;

/**
 * @param {object} battle the battle document's data
 * @returns {{ inScope: true, excludedBy: null } | { inScope: false, excludedBy: 'game_mode'|'cpu'|'training_clone'|'archetype' }}
 */
export function scopeOf(battle) {
  if (!(hasNoGameMode(battle) || battle.gameMode === TIERED_GAME_MODE)) return { inScope: false, excludedBy: 'game_mode' };
  if (battle.isCpu === true) return { inScope: false, excludedBy: 'cpu' };
  if (typeof battle.agentId === 'string' && battle.agentId.startsWith(TRAINING_CLONE_ID_PREFIX)) return { inScope: false, excludedBy: 'training_clone' };
  if (battle.agentContext?.archetype !== TREND_FOLLOWER_ARCHETYPE) return { inScope: false, excludedBy: 'archetype' };
  return { inScope: true, excludedBy: null };
}
