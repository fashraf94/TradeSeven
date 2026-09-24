// test/rules/callObservationsDenials.rules.mjs
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.8, §3.10) — Firestore
// security-rules acceptance for agentBattles/{battleId}/callObservations/
// {callId}, the companion receipt the flip transaction creates on a call's
// first observed transition. Owner read via the parent battle; no client
// write — a receipt is evidence and nobody but the check may author it. The
// shared body and its claims: test/rules/callRecordsRulesSuite.mjs.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { describeOwnerReadCallRecords } from './callRecordsRulesSuite.mjs';

const CALL_ID = 'battle-cr-1:eval_004:call:0';

describeOwnerReadCallRecords({
  label: 'callObservationsDenials',
  sub: 'callObservations',
  idVar: 'callId',
  docId: CALL_ID,
  // The receipt as receipt.js composes it.
  record: () => ({ callId: CALL_ID, evalId: 'eval_005', observedAtMs: 1789665000000, px: 164.2, source: 'model_prompt', replacedInPrompt: false }),
  patch: { px: 170 },
  orderField: 'observedAtMs',
});
