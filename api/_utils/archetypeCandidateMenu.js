import { ARCHETYPE_WEIGHTS, computeArchetypeRankings } from './archetypeScoring.js';
import { TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';
import * as featureFlags from '../../src/config/featureFlags.js';

/**
 * BaggerBomb refresh only. Null delegates to the caller's legacy fit policy.
 * Missing gameMode is a legacy tiered battle; explicit other modes stay out.
 * The scorer is called read-only, on the FULL universe before exclusions, so
 * V1 sector counts (and future V2 axes) keep their original population.
 */
export function buildArchetypeCandidateMenu({
  gameMode, isTournament = false, archetype, rankings,
  excludeSymbols = new Set(), equippedTickers = [], onEvent = () => {},
}) {
  // Call-time read. Absent exports in older bare test mocks also stay dark.
  if (!Object.hasOwn(featureFlags, 'ARCHETYPE_REFRESH_MENU_ENABLED')
    || featureFlags.ARCHETYPE_REFRESH_MENU_ENABLED !== true) return null;
  if (isTournament || (gameMode != null && gameMode !== TIERED_GAME_MODE)) return null;
  if (typeof archetype !== 'string' || !Object.hasOwn(ARCHETYPE_WEIGHTS, archetype)) {
    onEvent({ type: 'archetype_candidate_menu_legacy', reason: 'unknown_archetype' });
    return null;
  }

  const ranked = computeArchetypeRankings(rankings, archetype, { gameMode: 'baggerBomb' });
  const candidates = [...new Set(ranked.map(s => s.symbol))]
    .filter(symbol => !excludeSymbols.has(symbol));
  const equipped = [...new Set(Array.isArray(equippedTickers) ? equippedTickers : [])]
    .filter(symbol => typeof symbol === 'string' && symbol && !excludeSymbols.has(symbol));
  const equippedSet = new Set(equipped);
  const initial = candidates.slice(0, 15);
  const initialSet = new Set(initial);
  const merged = [...initial, ...equipped.filter(symbol => !initialSet.has(symbol))];

  // Equipped names always survive, including >20. The caller hands over only the
  // equipped names that are in the ranked universe (F2, Oct 25: an equipped name
  // outside it, such as KRE, stays on the snapshot and never reaches the hotBench).
  // Under pressure, trim NON-equipped names in archetype rank order. The
  // shared legacy equip helper intentionally retains its fit-based policy.
  let hotBench = merged;
  if (merged.length > 20) {
    const protectedNames = merged.filter(symbol => equippedSet.has(symbol));
    hotBench = [
      ...merged.filter(symbol => !equippedSet.has(symbol)).slice(0, Math.max(0, 20 - protectedNames.length)),
      ...protectedNames,
    ];
  }
  const hotBenchSet = new Set(hotBench);
  return {
    hotBench,
    monitoring: candidates.filter(symbol => !hotBenchSet.has(symbol)).slice(0, 18),
  };
}
