// api/_utils/executionAuthority.js
//
// Integrity build — client-forged proposal data (7 Oct 2026; founder decision
// F1). The ONE server-owned execution mode both launch guards in
// api/cron/agent-evaluate.js read:
//
//   - the model path, which forces it before it executes or proposes a swap;
//   - the proposal handler (handlePendingProposal), which clears any pending
//     proposal without executing it while this value is 'autopilot'.
//
// Never a battle's own `executionMode`: an owner may write that field from the
// browser at any moment (firestore.rules, the agentBattles update allowlist),
// and before this build the proposal handler's guard keyed on it — a planted
// 'copilot' plus a planted approved `pendingProposal` reached the executor.
// See docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md.
//
// LAUNCH DECISION (2026-05-19): auto-pilot only; co-pilot and manual are
// deferred (AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md). Reviving proposals is the
// authority arc's work, not a change to this value. Tests that drive the
// dormant proposal paths mock this module.
//
// Pinned by: api/_utils/executionAuthority.test.js

/** The execution mode every battle runs under at launch. */
export const LAUNCH_EXECUTION_MODE = 'autopilot';
