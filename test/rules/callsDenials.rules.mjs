// test/rules/callsDenials.rules.mjs
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.10; contract
// docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §1) — Firestore security-rules
// acceptance for agentBattles/{battleId}/calls/{callId}: "mirrors
// intradayViews — owner read via inline parent get(), allow write: if false.
// Every player action is an API route." The shared body and its claims:
// test/rules/callRecordsRulesSuite.mjs. A client can never flip a state,
// forge a playerResponse or write an outcome.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { describeOwnerReadCallRecords } from './callRecordsRulesSuite.mjs';

const CALL_ID = 'battle-cr-1:eval_004:call:0';

describeOwnerReadCallRecords({
  label: 'callsDenials',
  sub: 'calls',
  idVar: 'callId',
  docId: CALL_ID,
  // The call as candidate.js composes it (contract §4 key order).
  record: () => ({
    callId: CALL_ID, kind: 'called_shot', battleId: 'battle-cr-1', evalId: 'eval_004', evalSeq: 4, mintedAt: 1789664000000,
    symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163.5 },
    horizon: { phrase: 'this_session', expiresAt: 1789675200000, basis: 'this_session' }, defaultAction: 'act',
    said: 'AMD into Support if it holds $163.50.', evidence: { tickId: null, availability: 'off', priceAsOf: '2026-09-09T15:00:00.000Z' },
    hypothesisRef: null, origin: 'agent_initiative', state: 'open', stateChangedAt: 1789664000000, stateSource: 'mint',
    playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
  }),
  patch: { state: 'hit', playerResponse: { answer: 'go', kind: 'ack' } },
  orderField: 'mintedAt',
});
