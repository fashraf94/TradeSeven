// api/_utils/activationEvidence/activationEvidenceRulesTripwire.test.js
//
// ID-1 Build 2 — the DEFAULT-SUITE tripwire for the rules and the index (the
// setupEvidenceRulesTripwire.test.js pattern). The emulator suite
// (test/rules/activationEvidenceDenials.rules.mjs, `npm run test:rules`) proves
// the rules' behaviour; these rows pin the source text in every ordinary run.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// The emulator suites' shared parser (no emulator is touched on import).
import { ruleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RULES = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));
const TENANT = readFileSync(resolve(HERE, 'tenant.js'), 'utf8');

describe('firestore.rules — the observer\'s two collections (source tripwire; behaviour proven in test/rules)', () => {
  it('agentBattles/{battleId}/activations/{activationId}: ONE block, server-only, INSIDE the battle match', () => {
    expect(ruleBlocks(RULES, /\/activations\/\{activationId\}/)).toEqual([['allow read, write: if false;']]);
    const [battle] = ruleBlocks(RULES, /\/agentBattles\/\{battleId\}/);
    expect(battle.join('\n')).toContain('match /activations/{activationId} {');
    expect(RULES.split(/\r?\n/).filter((l) => /\/activations\/\{/.test(l) && !l.trim().startsWith('//'))).toHaveLength(1);
  });
  it('activationObserverState/{name}: ONE top-level block, server-only', () => {
    expect(ruleBlocks(RULES, /\/activationObserverState\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split(/\r?\n/).filter((l) => /\/activationObserverState\/\{/.test(l) && !l.trim().startsWith('//'));
    expect(named.map((l) => l.replace(/\s+$/, ''))).toEqual(['    match /activationObserverState/{name} {']);
  });
});

describe('firestore.indexes.json — the candidate query\'s composite', () => {
  it('agentBattles (ownerId ASC, createdAt DESC) is declared once, and it is exactly the shape the tenant queries', () => {
    const matches = INDEXES.indexes.filter((i) => i.collectionGroup === 'agentBattles' && i.queryScope === 'COLLECTION'
      && JSON.stringify(i.fields) === JSON.stringify([{ fieldPath: 'ownerId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]));
    expect(matches).toHaveLength(1);
    const q = TENANT.replace(/\s+/g, ' ');
    expect(q).toContain(".where('ownerId', '==', ownerId).where('createdAt', '>=', lookbackIso) .orderBy('createdAt', 'desc')");
  });
  it('no composite is declared for the pointers or the state (both are read by document id)', () => {
    expect(INDEXES.indexes.some((i) => /^(activations|activationObserverState)$/.test(i.collectionGroup))).toBe(false);
  });
});

describe('firestore.indexes.json — the state\'s maps are exempt from single-field indexing (contract V1.8 §4.4, review L4-2)', () => {
  it('exactly two overrides on activationObserverState, `battles` and `outstandingKeys`, each with no index; none on the pointers', () => {
    const state = INDEXES.fieldOverrides.filter((o) => o.collectionGroup === 'activationObserverState');
    expect(state).toEqual([
      { collectionGroup: 'activationObserverState', fieldPath: 'battles', indexes: [] },
      { collectionGroup: 'activationObserverState', fieldPath: 'outstandingKeys', indexes: [] },
    ]);
    expect(INDEXES.fieldOverrides.some((o) => o.collectionGroup === 'activations')).toBe(false);
  });
  it('the exempt fields are the state document\'s own keys; state.js addresses the collection by document id, and neither state.js nor tenant.js chains a query on it', () => {
    const STATE = readFileSync(resolve(HERE, 'state.js'), 'utf8');
    for (const f of ['battles', 'outstandingKeys']) expect(STATE).toMatch(new RegExp(`\\b${f}\\b`));
    expect(STATE.replace(/\s+/g, ' ')).toContain('db.collection(OBSERVER_STATE_COLLECTION).doc(OBSERVER_STATE_DOC)');
    for (const src of [STATE, TENANT]) expect(src).not.toMatch(/OBSERVER_STATE_COLLECTION\)\s*\.(where|orderBy|limit|select|get)\b/);
  });
});
