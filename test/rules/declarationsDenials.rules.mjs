// test/rules/declarationsDenials.rules.mjs
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.10; contract
// docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §2.1) — Firestore security-rules
// acceptance for agentBattles/{battleId}/declarations/{evalId}, the per-check
// declarations record the evaluation cron creates once after the evaluation
// commit. Owner read via the parent battle; no client write. The shared body
// and its claims: test/rules/callRecordsRulesSuite.mjs.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { describeOwnerReadCallRecords } from './callRecordsRulesSuite.mjs';

describeOwnerReadCallRecords({
  label: 'declarationsDenials',
  sub: 'declarations',
  idVar: 'evalId',
  docId: 'eval_004',
  // The record as publish.js composes it.
  record: () => ({
    battleId: 'battle-cr-1', evalId: 'eval_004', evalSeq: 4, mintedAt: 1789664000000,
    calledShots: [], watching: ['AMD'], playerAsk: null, fork: null, removed: [], minted: [],
  }),
  patch: { watching: ['NVDA'] },
  orderField: 'evalSeq',
});
