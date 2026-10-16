// src/components/Dashboard/deployResult.js
//
// Command Center repair R1 (ruling R-R1-2) — the one mapping both Command
// dashboards (CommandDashboard.jsx, CommandDashboardDesktop.jsx) apply to a
// deployAgent result before handing it to the Deploy Ceremony as `deployResult`.
// Lifted out of the two shells so the mapping is tested once, directly.
//
// The one change from the mapping the shells inlined before R1: an
// `existing_battle` outcome is its own ceremony status, `existing`, carrying the
// server's existingBattleId — never `success` (it created nothing) and never
// `error` (nothing failed). `created` and every other outcome map exactly as
// before: `success` → { status: 'success', agentBattleId }, the rest → the
// error shape the ceremony's recovered-reveal gate reads.

import { DEPLOY_OUTCOMES } from '../../constants/deployOutcomes';

/** The deploy found the agent's running battle instead of creating one. */
export function isExistingBattleResult(result) {
  return result?.outcome === DEPLOY_OUTCOMES.EXISTING_BATTLE;
}

/** A deployAgent result → the ceremony's `deployResult`. */
export function deployResultFor(result) {
  if (isExistingBattleResult(result)) {
    return {
      status: 'existing',
      existingBattleId: result.existingBattleId,
      httpStatus: result.httpStatus ?? null,
      postIssued: result.postIssued === true,
    };
  }
  return result?.success
    ? { status: 'success', agentBattleId: result.agentBattleId }
    : {
        status: 'error', error: result?.error, details: result?.details,
        // Forwarded for the ceremony's recovered-reveal gate — see the
        // deployAgent comment above the POST. Previously dropped here, which
        // is why the ceremony could not tell a refusal from a real failure.
        httpStatus: result?.httpStatus ?? null,
        postIssued: result?.postIssued === true,
        // Set only when the server 200'd with a real battle id and the client
        // handoff then threw. The battle exists and we are holding its id, so
        // the ceremony pins the reveal to it rather than inferring from status.
        battleId: result?.battleId ?? null,
      };
}
