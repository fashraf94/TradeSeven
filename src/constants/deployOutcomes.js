// src/constants/deployOutcomes.js
//
// Command Center repair R1 (ruling R-R1-1) — the typed `outcome` every
// deployAgent result carries (src/services/agentDeploy.js). The six strings are
// spec V1.2 §5.2's service-outcome vocabulary (correction C3), the table that
// maps each one to a provider phase, a ceremony phase and the hub's display
// words:
//
//   created         — the server created a new battle; its real id was handed off
//   existing_battle — the server answered 200 with battleCreated:false: the agent
//                     already has a running battle (existingBattleId), and this
//                     deploy created nothing (spec IR-01)
//   refused         — a definitive answer that no battle was created: the two
//                     no-POST preflights and every refusal the server sent as JSON
//   uncertain       — the POST may have committed and the client cannot tell
//   handoff_failed  — the server created a real battle, and App's handoff threw
//   orphaned        — the signed-in account changed during the deploy; a local
//                     ownership disposition, not a server failure
//
// Kept outside src/components/CommandCenter/ on purpose: the main graph may not
// import from the hub directory (commandCenterHub.mount.guard.test.js). The hub's
// own SERVICE_OUTCOMES (hub/selectors/attemptVocabulary.js) holds the same six
// values, and src/constants/deployOutcomes.test.js keeps the two equal.

export const DEPLOY_OUTCOMES = Object.freeze({
  CREATED: 'created',
  EXISTING_BATTLE: 'existing_battle',
  REFUSED: 'refused',
  UNCERTAIN: 'uncertain',
  HANDOFF_FAILED: 'handoff_failed',
  ORPHANED: 'orphaned',
});
