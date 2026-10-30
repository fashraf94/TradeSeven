// api/_utils/setupEvidence/setupEvidenceRulesTripwire.test.js
//
// ID-1 Build 1 — the DEFAULT-SUITE tripwire for the rules (the
// hypothesisRecords/rulesIndex.test.js pattern). The emulator suite
// (test/rules/setupEvidenceDenials.rules.mjs, `npm run test:rules`) proves the
// rules' behavior; these rows pin the source text in every ordinary run, so the
// posture cannot drift without the default suite going red.

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

describe('firestore.rules — the setup-evidence collections (source tripwire; behavior proven in test/rules)', () => {
  it.each([['setupEvidence'], ['setupEvidenceClaims']])('%s: ONE top-level block, server-only', (coll) => {
    expect(ruleBlocks(RULES, new RegExp(`/${coll}/\\{[^}/]+\\}`))).toEqual([['allow read, write: if false;']]);
    const named = RULES.split('\n').filter((l) => new RegExp(`/${coll}/\\{`).test(l) && !l.trim().startsWith('//'));
    expect(named).toHaveLength(1);
  });
  it('neither collection is nested under another match', () => {
    for (const coll of ['setupEvidence', 'setupEvidenceClaims']) {
      expect(RULES.split('\n').find((l) => new RegExp(`match /${coll}/\\{`).test(l))).toMatch(/^ {4}match /);
    }
  });
});

describe('firestore.indexes.json', () => {
  it('the store reads by document id: no composite is declared for it', () => {
    expect(INDEXES.indexes.some((i) => /^setupEvidence/.test(i.collectionGroup))).toBe(false);
  });
});
