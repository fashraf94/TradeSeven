// api/_utils/setupMenuLabels/setupMenuLabelsRulesTripwire.test.js
//
// Slice 2 — the DEFAULT-SUITE tripwire for the rules and the index exemption (the
// activationEvidenceRulesTripwire.test.js pattern). The emulator suite
// (test/rules/setupMenuLabelsDenials.rules.mjs, `npm run test:rules`) proves the rules' behaviour; these
// rows pin the source text in every ordinary run.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// The emulator suites' shared parser (no emulator is touched on import).
import { ruleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';
import { STATE_COLLECTION, STATE_DOC } from './constants.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RULES = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));
const STATE = readFileSync(resolve(HERE, 'state.js'), 'utf8');
const TENANT = readFileSync(resolve(HERE, 'tenant.js'), 'utf8');

describe('firestore.rules — setupMenuLabelState (source tripwire; behaviour proven in test/rules)', () => {
  it('ONE top-level block, server-only', () => {
    expect(ruleBlocks(RULES, /\/setupMenuLabelState\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split(/\r?\n/).filter((l) => /\/setupMenuLabelState\/\{/.test(l) && !l.trim().startsWith('//'));
    expect(named.map((l) => l.replace(/\s+$/, ''))).toEqual(['    match /setupMenuLabelState/{name} {']);
  });
  it('the tick record that carries the block is the existing server-only ticks record: no new tick rule', () => {
    expect(RULES.split(/\r?\n/).filter((l) => /match \/ticks\/\{/.test(l) && !l.trim().startsWith('//')).length).toBeLessThanOrEqual(1);
  });
});

describe('firestore.indexes.json — the state\'s attempts map is exempt from single-field indexing', () => {
  it('exactly one override on setupMenuLabelState, `attempts`, with no index; no composite', () => {
    expect(INDEXES.fieldOverrides.filter((o) => o.collectionGroup === STATE_COLLECTION)).toEqual([
      { collectionGroup: STATE_COLLECTION, fieldPath: 'attempts', indexes: [] },
    ]);
    expect(INDEXES.indexes.some((i) => i.collectionGroup === STATE_COLLECTION)).toBe(false);
  });
  it('the exempt field is the state document\'s own map; it is addressed by document id and never queried', () => {
    expect(STATE).toMatch(/\battempts\b/);
    expect(STATE.replace(/\s+/g, ' ')).toContain('db.collection(STATE_COLLECTION).doc(STATE_DOC)');
    for (const src of [STATE, TENANT]) expect(src).not.toMatch(/STATE_COLLECTION\)\s*\.(where|orderBy|limit|select|get)\b/);
    expect([STATE_COLLECTION, STATE_DOC]).toEqual(['setupMenuLabelState', 'main']);
  });
  it('the tenant\'s battle query is equality-only (ownerId ==, status ==): no composite index is declared for it', () => {
    const q = TENANT.replace(/\s+/g, ' ');
    expect(q).toContain(".where('ownerId', '==', ownerId).where('status', '==', 'active') .select(...BATTLE_FIELDS)");
    expect(q).not.toMatch(/\.orderBy\(/);
  });
});
