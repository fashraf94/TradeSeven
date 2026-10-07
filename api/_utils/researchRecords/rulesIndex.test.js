// api/_utils/researchRecords/rulesIndex.test.js
//
// Pilot P2 — the DEFAULT-SUITE tripwires for the research record's rule and
// index (the hypothesisRecords/rulesIndex.test.js precedent). The emulator
// suite (test/rules/researchWorkDenials.rules.mjs, `npm run test:rules`)
// proves the rule's behavior; these rows pin the source text and the index
// definition in every ordinary run.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// The emulator suites' shared parser (no emulator is touched on import).
import { ruleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';
import { RESEARCH_WORK_COLLECTION } from './model.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RULES = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));

describe('firestore.rules — researchWork (source tripwire; behavior proven in test/rules)', () => {
  it('the collection the code writes is the collection the rule names', () => {
    expect(RESEARCH_WORK_COLLECTION).toBe('researchWork');
  });
  it('ONE top-level block: owner read on the record\'s own userId, no client write', () => {
    expect(ruleBlocks(RULES, /\/researchWork\/\{researchWorkId\}/)).toEqual([[
      'allow read: if request.auth != null',
      '&& resource.data.userId == request.auth.uid;',
      'allow write: if false;',
    ]]);
    const named = RULES.split('\n').filter((l) => /\bresearchWork\b/.test(l) && !l.trim().startsWith('//'));
    expect(named).toHaveLength(1);
  });
  it('no recursive-wildcard rule reaches it (the only {path=**} heads stay the default deny and P1a\'s collection-group list)', () => {
    const heads = RULES.split('\n').map((l) => l.trim()).filter((l) => /^match \/\{[^}]*=\*\*\}/.test(l));
    expect(heads).toEqual(['match /{path=**}/hypothesisVersions/{versionId} {', 'match /{document=**} {']);
  });
});

describe('firestore.indexes.json — the Command Center\'s research list', () => {
  it('ONE researchWork composite: userId ASC, createdAt DESC (collection scope)', () => {
    expect(INDEXES.indexes.filter((i) => i.collectionGroup === 'researchWork')).toEqual([{
      collectionGroup: 'researchWork',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'userId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    }]);
  });
  it('the per-list read needs no composite (one equality, served by the automatic single-field index)', () => {
    const src = readFileSync(resolve(HERE, 'store.js'), 'utf8');
    expect(src).toContain(".where('watchlistId', '==', watchlistId)");
    expect(src).not.toMatch(/orderBy\(/);
  });
});
