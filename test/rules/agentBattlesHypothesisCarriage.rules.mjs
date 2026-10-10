// test/rules/agentBattlesHypothesisCarriage.rules.mjs
//
// Pilot P1b (pilot spec §2.4, §2.7; Phase 0 row #15; build prompt item 6) —
// Firestore security-rules acceptance for the frozen hypothesis a battle now
// carries (`agentBattles/{battleId}.agentContext.equippedHypothesis`). P1b
// changes NO rule: these rows prove the EXISTING agentBattles block already
// holds the line the carriage needs.
//
// THE CLAIMS:
//   · the owner reads a carried battle (positive control — a misloaded or
//     over-broad ruleset cannot pass by failing everything);
//   · another authenticated user, a privileged-claims context and an
//     unauthenticated client cannot read it — by get, or by a query naming
//     the owner;
//   · the OWNER cannot write agentContext: not the sibling by dot-path, not a
//     whole replacement of agentContext, not a merge, not a delete of the
//     sibling, not a sibling added to a battle that carried none — while the
//     owner's sanctioned execution-control update still succeeds (the
//     positive control for the update path);
//   · nobody creates or deletes a battle;
//   · the rules text: the agentBattles update allowlist names no agentContext.
//
// Not part of the default vitest run (no `.test.` in the filename). Run:
//     npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, collectionGroup, getDocs, query, where,
} from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'carry-owner-1';
const OTHER_UID = 'carry-intruder-2';
const PRIVILEGED_UID = 'carry-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };

const CARRIED = 'agentBattles/battle-carry-1';
const PLAIN = 'agentBattles/battle-plain-1';

const SIBLING = Object.freeze({
  watchlistId: 'wl-carry-1', hypothesisVersion: 2, contentHash: 'c'.repeat(64), statement: 'AI capex keeps compounding',
  horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
});
const battle = (withSibling) => ({
  ownerId: OWNER_UID, agentId: 'agent-carry-1', status: 'active', gameMode: 'baggerbomb_agent', executionMode: 'autopilot',
  agentContext: {
    agentName: 'Viper', archetype: 'momentum_chaser',
    equippedWatchlist: { watchlistId: 'wl-carry-1', name: 'AI capex', tickers: ['NVDA', 'AMD'], snapshotAt: '2026-10-13T15:00:00.000Z' },
    ...(withSibling ? { equippedHypothesis: { ...SIBLING } } : {}),
  },
});

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const NON_OWNERS = [['another user', asOther], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]];

beforeAll(async () => {
  console.log(`[agentBattlesHypothesisCarriage] rules text sha256: ${RULES_SHA256}`);
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
  await seed(CARRIED, battle(true));
  await seed(PLAIN, battle(false));
});

describe('agentBattles carrying equippedHypothesis — READ: the owner only', () => {
  it('the owner reads the carried battle, sibling included (positive control)', async () => {
    const snap = await assertSucceeds(getDoc(doc(asOwner(), CARRIED)));
    expect(snap.data().agentContext.equippedHypothesis).toEqual(SIBLING);
  });
  it('the owner LISTS their own battles by ownerId (positive control for the query rows below; review L3-2)', async () => {
    const snap = await assertSucceeds(getDocs(query(collection(asOwner(), 'agentBattles'), where('ownerId', '==', OWNER_UID))));
    expect(snap.size).toBe(2);
  });
  for (const [who, ctx] of NON_OWNERS) {
    it(`${who} cannot read it — by get, by a query naming the owner, or by a collection-group query`, async () => {
      await assertFails(getDoc(doc(ctx(), CARRIED)));
      await assertFails(getDocs(query(collection(ctx(), 'agentBattles'), where('ownerId', '==', OWNER_UID))));
      await assertFails(getDocs(collectionGroup(ctx(), 'agentBattles')));
      await assertFails(getDocs(query(collectionGroup(ctx(), 'agentBattles'), where('ownerId', '==', OWNER_UID))));
    });
  }
});

describe('agentBattles carrying equippedHypothesis — WRITE: never agentContext, not even by the owner', () => {
  it('the owner\'s sanctioned execution-control update still succeeds (positive control for the update path)', async () => {
    await assertSucceeds(updateDoc(doc(asOwner(), CARRIED), { executionMode: 'copilot' }));
  });
  it('the owner cannot rewrite the sibling (dot-path), replace agentContext, merge into it, or delete the sibling', async () => {
    const db = asOwner();
    await assertFails(updateDoc(doc(db, CARRIED), { 'agentContext.equippedHypothesis.statement': 'rewritten' }));
    await assertFails(updateDoc(doc(db, CARRIED), { 'agentContext.equippedHypothesis.hypothesisVersion': 1 }));
    await assertFails(updateDoc(doc(db, CARRIED), { agentContext: { agentName: 'Viper' } }));
    await assertFails(setDoc(doc(db, CARRIED), { agentContext: { equippedHypothesis: { ...SIBLING, statement: 'merged' } } }, { merge: true }));
    await assertFails(updateDoc(doc(db, CARRIED), { 'agentContext.equippedHypothesis': deleteField() }));
  });
  it('the owner cannot ADD a sibling to a battle that carried none (a carriage is the server\'s alone)', async () => {
    await assertFails(updateDoc(doc(asOwner(), PLAIN), { 'agentContext.equippedHypothesis': { ...SIBLING } }));
  });
  for (const [who, ctx] of NON_OWNERS) {
    it(`${who} cannot write the sibling either`, async () => {
      await assertFails(updateDoc(doc(ctx(), CARRIED), { 'agentContext.equippedHypothesis.statement': 'x' }));
    });
  }
  it('nobody creates a battle carrying a sibling, or deletes one', async () => {
    await assertFails(setDoc(doc(asOwner(), 'agentBattles/battle-new-1'), battle(true)));
    await assertFails(deleteDoc(doc(asOwner(), CARRIED)));
  });
});

describe('the rules text — P1b changes no rule', () => {
  it('the agentBattles block\'s owner-update allowlist names no agentContext (the carriage is server-written only)', () => {
    const blocks = ruleBlocks(RULES_TEXT, /\/agentBattles\/\{battleId\}/);
    expect(blocks.length).toBeGreaterThan(0);
    const top = blocks[0].join('\n');
    expect(top).toMatch(/allow update: if request\.auth != null/);
    const allowlist = /hasOnly\(\[([^\]]*)\]\)/.exec(top)?.[1] || '';
    expect(allowlist).toContain("'executionMode'");
    expect(allowlist).not.toContain('agentContext');
    expect(allowlist).not.toContain('equippedHypothesis');
    expect(top).toMatch(/allow create, delete: if false;/);
  });
});
