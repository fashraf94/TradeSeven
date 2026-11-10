// test/rules/huddleDenials.rules.mjs
//
// Huddle S1 (spec docs/specs/20261030_HUDDLE_S1_BUILD_SPEC_V1_1.md §3, §9 "rules
// denial tests"; Amendment C V1.2 §C1) — Firestore security-rules acceptance for the
// four new collections, all written by the Admin SDK only:
//
//   huddles/{uid}/days/{etDate}          OWNER READ ONLY (the hub's reader); no write
//   huddleQueue/{uid}_{etDate}           server-only: no client verb for anyone
//   symbolDayEvidence/{etDate}_{SYMBOL}  server-only
//   huddleRuns/{etDate}                  server-only (holds the playback index)
//
// POSITIVE CONTROL in the same run — the owner reads their own huddle record — so a
// misloaded or over-broad ruleset cannot pass by failing everything. Not part of the
// default vitest run (no `.test.` in the filename). Run: npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'huddle-owner-1';
const OTHER_UID = 'huddle-intruder-2';
const PRIVILEGED_UID = 'huddle-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const ET = '2026-11-09';
const RECORD = `huddles/${OWNER_UID}/days/${ET}`;
const QUEUE = `huddleQueue/${OWNER_UID}_${ET}`;
const EVIDENCE = `symbolDayEvidence/${ET}_AAPL`;
const RUN = `huddleRuns/${ET}`;

const recordDoc = () => ({ status: 'ready', plan: { status: 'proposed', revision: 'r1' }, session: { etDate: ET } });
const queueDoc = () => ({ uid: OWNER_UID, etDate: ET, status: 'pending', attempts: 0, claimGeneration: 0 });
const evidenceDoc = () => ({ symbol: 'AAPL', etDate: ET, price: { lastClose: 1, lastCloseAsOf: ET } });
const runDoc = () => ({ briefStage: 'done', enqueueStage: 'pending' });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

beforeAll(async () => {
  console.log(`[huddleDenials] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(RECORD, recordDoc());
  await seed(QUEUE, queueDoc());
  await seed(EVIDENCE, evidenceDoc());
  await seed(RUN, runDoc());
});

describe('huddles/{uid}/days/{etDate} — the owner reads, nobody writes', () => {
  it('POSITIVE CONTROL: the owner reads their record and lists their days', async () => {
    await assertSucceeds(getDoc(doc(asOwner(), RECORD)));
    await assertSucceeds(getDocs(collection(asOwner(), `huddles/${OWNER_UID}/days`)));
  });

  for (const [who, ctx] of [['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
    it(`${who} cannot read it or list the days`, async () => {
      await assertFails(getDoc(doc(ctx(), RECORD)));
      await assertFails(getDocs(collection(ctx(), `huddles/${OWNER_UID}/days`)));
    });
  }

  for (const [who, ctx] of [['the owner', asOwner], ['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
    it(`${who} cannot create, update, merge or delete it (confirm and skip go through the routes)`, async () => {
      await assertFails(setDoc(doc(ctx(), `huddles/${OWNER_UID}/days/2026-11-10`), recordDoc()));
      await assertFails(updateDoc(doc(ctx(), RECORD), { 'plan.status': 'confirmed' }));
      await assertFails(setDoc(doc(ctx(), RECORD), { plan: { status: 'skipped' } }, { merge: true }));
      await assertFails(deleteDoc(doc(ctx(), RECORD)));
    });
  }

  it('the parent huddles/{uid} is no readable document', async () => {
    await assertFails(getDoc(doc(asOwner(), `huddles/${OWNER_UID}`)));
  });
});

for (const [path, coll, make] of [[QUEUE, 'huddleQueue', queueDoc], [EVIDENCE, 'symbolDayEvidence', evidenceDoc], [RUN, 'huddleRuns', runDoc]]) {
  describe(`${coll}/{id} — server-only: no client verb for anyone`, () => {
    for (const [who, ctx] of [['an authenticated user (the queue row\'s own uid)', asOwner], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
      it(`${who} cannot get it or query the collection`, async () => {
        await assertFails(getDoc(doc(ctx(), path)));
        await assertFails(getDocs(collection(ctx(), coll)));
      });
      it(`${who} cannot create, update, merge or delete`, async () => {
        await assertFails(setDoc(doc(ctx(), `${coll}/new-id`), make()));
        await assertFails(updateDoc(doc(ctx(), path), { status: 'done' }));
        await assertFails(setDoc(doc(ctx(), path), { status: 'done' }, { merge: true }));
        await assertFails(deleteDoc(doc(ctx(), path)));
      });
    }
  });
}

describe('the rules text says exactly this, once per path', () => {
  it('one block each, with the owner-read rule on the record and deny-all elsewhere', () => {
    expect(ruleBlocks(RULES_TEXT, /\/huddles\/\{uid\}\/days\/\{etDate\}/)).toEqual([[
      'allow read: if request.auth != null && request.auth.uid == uid;',
      'allow write: if false;',
    ]]);
    for (const [re] of [[/\/huddleQueue\/\{rowId\}/], [/\/symbolDayEvidence\/\{docId\}/], [/\/huddleRuns\/\{etDate\}/]]) {
      expect(ruleBlocks(RULES_TEXT, re)).toEqual([['allow read, write: if false;']]);
    }
  });
});
