// api/_utils/__fixtures__/deployScenarios.js
//
// Pilot P1b — the deploy scenarios the off golden was captured on
// (api/agent/decide.carriageOffGolden.test.js) and the gate-on suites replay
// (api/agent/decide.carriage.test.js), so "the same deploy" means the same
// store seed and the same request in both. Version documents are built by
// P1a's own buildVersionDoc (on `main` since PR #937), with the lifecycle a
// deployed version carries spread over it.

import * as H from './deployHarness.js';
import { buildVersionDoc } from '../hypothesisRecords/model.js';

/**
 * A version as buildVersionDoc writes it (status `ready`), with lifecycle and
 * content overrides.
 */
export function version(n, lifecycle = {}, content = {}) {
  return {
    ...buildVersionDoc({
      version: n, watchlistId: H.WATCHLIST_ID, userId: H.OWNER, opId: `op-${n}`, opFingerprint: 'f'.repeat(64),
      createdAt: `2026-10-0${n}T14:00:00.000Z`,
      content: {
        statement: `Idea version ${n}`, horizonEnum: 'swing', horizonSource: 'player',
        activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual', ...content,
      },
      status: 'ready', stateSource: 'player', stateReason: 'player_ready',
    }),
    ...lifecycle,
  };
}

/** The lifecycle fields of a version first deployed into `battleId` on Mon 5 Oct 2026. */
export const DEPLOYED = (battleId) => ({
  firstDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedAt: '2026-10-05T15:00:00.000Z',
  lastDeployedBattleId: battleId, reviewDueAt: '2026-10-19T20:00:00.000Z', stateSource: 'deploy', stateReason: 'deployed',
});

/** The scenarios: each a store seed and a request. */
export const SCENARIOS = {
  self_select_ready_over_activated: () => ({
    docs: H.seedDeploy({ versions: [version(1, { status: 'activated', ...DEPLOYED('battle-old-1') }), version(2)] }),
    req: H.clientRequest(),
  }),
  self_select_due_no_ready: () => ({
    docs: H.seedDeploy({ versions: [version(1, { status: 'review_due', ...DEPLOYED('battle-old-1'), stateSource: 'review_pass', stateReason: 'horizon_elapsed' })] }),
    req: H.clientRequest(),
  }),
  self_select_no_equip: () => ({
    docs: H.seedDeploy({ watchlist: null, agent: H.agentDoc({ equippedWatchlistId: null }) }),
    req: H.clientRequest(),
  }),
  self_select_uncommitted_list: () => ({
    docs: H.seedDeploy({ watchlist: H.watchlistDoc({ status: 'draft' }), versions: [version(1)] }),
    req: H.clientRequest(),
  }),
  self_select_existing_active_battle: () => ({
    docs: H.seedDeploy({
      versions: [version(1)],
      extra: { 'agentBattles/battle-live-1': { agentId: H.AGENT_ID, ownerId: H.OWNER, status: 'active', expiresAt: '2026-10-13T20:00:00.000Z' } },
    }),
    req: H.clientRequest(),
  }),
  tournament_prescribed_with_ready_idea: () => ({
    docs: H.seedDeploy({ versions: [version(1)] }),
    req: H.tournamentRequest(),
  }),
};
