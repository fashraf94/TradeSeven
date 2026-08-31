// src/hooks/useCommandCenterSync.js
//
// The impure boundary for Command Center Sync (Pass 1). The adapter itself is
// pure — it takes `now` and `marketState` as parameters so its phase matrix is
// testable against fixtures. This hook is where the clock and the market state
// actually get read, once, at render, for both dashboard shells.
//
// It exists so the two shells share ONE flag gate and ONE adapter call. The
// desktop and mobile Command surfaces duplicate a great deal already
// (layout, copy, getGreeting, the accent derivation); this is deliberately not
// added to that pile.
//
// FLAG READ IS AT RENDER SCOPE, NEVER MODULE SCOPE. 15 of 56 featureFlags
// vi.mock call sites use a bare factory with no importOriginal spread, so a
// module-scope `const ON = COMMAND_CENTER_SYNC_ENABLED` in a shared module
// resolves to undefined inside those suites — the failure documented in
// docs/audits/20260819_EXIT_BEHAVIOR_ASK3_BUILD_REVIEW.md:120, where seven
// files failed at load and a tail-piped run reported it as green. Reading the
// import inside the hook body defers it to call time.

import { useMemo } from 'react';
import { COMMAND_CENTER_SYNC_ENABLED } from '../config/featureFlags';
import { getMarketState } from '../utils/marketSchedule';
import { buildBaggerbombAdapter } from '../adapters/baggerbombAdapter';

/**
 * Build the Pass 1 adapter for a live battle, or null.
 *
 * Returns null — and does no work at all — when the flag is off, which is what
 * makes flag-off byte-identical: callers render exactly what they rendered
 * before because they receive nothing to render from.
 *
 * @param {object|null} battle  the live agentBattles doc ({id, ...data})
 * @param {object|null} voiceLayerCacheDoc  voiceLayerCache/{battleId}, or null
 * @param {object|null} agent   the agents doc
 * @returns {object|null} the adapter object, or null
 */
export default function useCommandCenterSync(battle, voiceLayerCacheDoc, agent) {
  const enabled = COMMAND_CENTER_SYNC_ENABLED;
  const battleId = battle?.id ?? null;

  return useMemo(() => {
    if (!enabled || !battle) return null;
    // Read once per render pass. The 120s poll is what re-renders the shells,
    // and the underlying data refreshes every ~15 min, so a per-render read is
    // already more current than the source.
    return buildBaggerbombAdapter(
      battle,
      voiceLayerCacheDoc || null,
      agent || null,
      new Date(),
      getMarketState(),
    );
    // battleId is in the dep list so a battle swap rebuilds even if the object
    // identity is reused by the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, battle, battleId, voiceLayerCacheDoc, agent]);
}
