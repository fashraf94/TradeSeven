// test/rules/callEventsDenials.rules.mjs
//
// Cockpit Build 1a (docs/COCKPIT_BUILD1A_SPEC_V1_2.md §10; contract Amendment B
// §6) — Firestore security-rules acceptance for
// agentBattles/{battleId}/callEvents/{eventId}, the call events every
// transition creates inside its own transaction through the Admin SDK. Owner
// read via the parent battle; no client write. The shared body and its
// claims: test/rules/callRecordsRulesSuite.mjs.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules
// which wraps this in `firebase emulators:exec --only firestore`.

import { describeOwnerReadCallRecords } from './callRecordsRulesSuite.mjs';

describeOwnerReadCallRecords({
  label: 'callEventsDenials',
  sub: 'callEvents',
  idVar: 'eventId',
  docId: 'battle-cr-1:eval_004:call:0:heard:eval_006',
  // The event as events.js composes it.
  record: () => ({
    kind: 'heard', at: 1789667600000, callIds: ['battle-cr-1:eval_004:call:0'], text: 'Heard at the 10:15 check', saidOk: null,
    evidence: { evalId: 'eval_006', promptBuiltAt: '2026-09-23T14:15:00.000Z', checkLabel: 'the 10:15 check' },
  }),
  patch: { text: 'rewritten by a client' },
  orderField: 'at',
});
