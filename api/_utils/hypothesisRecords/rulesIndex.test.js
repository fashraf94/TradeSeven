// api/_utils/hypothesisRecords/rulesIndex.test.js
//
// Pilot P1a — the DEFAULT-SUITE tripwires for the rules and the index (the
// callRecordsRulesIndex.test.js precedent). The emulator suites
// (test/rules/hypothesisVersionsDenials.rules.mjs and
// hypothesisReviewQueueDenials.rules.mjs, `npm run test:rules`) prove the
// rules' behavior; these rows pin the source text and the index definition in
// every ordinary run, so neither can drift without the default suite going red.

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

describe('firestore.rules — the hypothesis records (source tripwire; behavior proven in test/rules)', () => {
  it('hypothesisVersions/{versionId}: ONE nested block, INSIDE watchlists/{watchlistId} — owner read via the parent\'s userId, no client write', () => {
    expect(ruleBlocks(RULES, /\/hypothesisVersions\/\{versionId\}/)).toEqual([[
      'allow read: if request.auth != null',
      '&& get(/databases/$(database)/documents/watchlists/$(watchlistId)).data.userId == request.auth.uid;',
      'allow write: if false;',
    ]]);
    const [listBlock] = ruleBlocks(RULES, /\/watchlists\/\{watchlistId\}/);
    expect(listBlock.join('\n')).toContain('match /hypothesisVersions/{versionId} {');
    // …and the list's own posture is unchanged (server-written).
    expect(listBlock.slice(0, 3)).toEqual(['allow read: if request.auth != null', '&& resource.data.userId == request.auth.uid;', 'allow create, update, delete: if false;']);
  });
  it('the collection-group block grants `list` only, on the version\'s own userId (a `get` there would bypass the parent check)', () => {
    expect(ruleBlocks(RULES, /\/\{path=\*\*\}\/hypothesisVersions\/\{versionId\}/)).toEqual([[
      'allow list: if request.auth != null',
      '&& resource.data.userId == request.auth.uid;',
    ]]);
  });
  it('hypothesisReviewQueue and hypothesisReviewState: ONE top-level block each, server-only', () => {
    for (const coll of ['hypothesisReviewQueue', 'hypothesisReviewState']) {
      expect(ruleBlocks(RULES, new RegExp(`/${coll}/\\{[^}/]+\\}`))).toEqual([['allow read, write: if false;']]);
      const named = RULES.split('\n').filter((l) => l.includes(coll) && !l.trim().startsWith('//'));
      expect(named).toHaveLength(1);
    }
  });
});

describe('firestore.indexes.json — the cross-list view', () => {
  it('ONE hypothesisVersions COLLECTION_GROUP composite: userId ASC, status ASC, stateChangedAt DESC', () => {
    const entries = INDEXES.indexes.filter((i) => i.collectionGroup === 'hypothesisVersions');
    expect(entries).toEqual([{
      collectionGroup: 'hypothesisVersions',
      queryScope: 'COLLECTION_GROUP',
      fields: [
        { fieldPath: 'userId', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'stateChangedAt', order: 'DESCENDING' },
      ],
    }]);
  });
  it('the review queue needs no composite (its queries ride single-field indexes): no entry is declared for it', () => {
    expect(INDEXES.indexes.some((i) => i.collectionGroup === 'hypothesisReviewQueue')).toBe(false);
  });
});
