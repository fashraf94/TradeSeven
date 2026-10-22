// api/_utils/filmRoom/rulesIndex.test.js
//
// Film Room B2 item 4 / item 6 — the DEFAULT-SUITE tripwires for the plays
// rules and the counter's index (the hypothesisRecords/rulesIndex.test.js
// precedent). The emulator suite (test/rules/filmRoomPlaysDenials.rules.mjs,
// `npm run test:rules`) proves the rules' behavior; these rows pin the source
// text and the index definition in every ordinary run, so neither can drift
// without the default suite going red. Deploying both is a founder action
// after merge (Amendment G RG-7).

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

describe('firestore.rules — the plays ledger (source tripwire; behavior proven in test/rules)', () => {
  it('plays/{entryId}: ONE nested block, INSIDE agents/{agentId} — owner read by the document\'s OWN ownerId, no client write', () => {
    expect(ruleBlocks(RULES, /\/plays\/\{entryId\}/)).toEqual([[
      'allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;',
      'allow write: if false;',
    ]]);
    const [agentsBlock] = ruleBlocks(RULES, /\/agents\/\{agentId\}/);
    expect(agentsBlock.join('\n')).toContain('match /plays/{entryId} {');
    // the word appears in no other rule line: no second surface for the ledger
    const lines = RULES.split(/\r?\n/).filter((l) => /\bplays\b/.test(l) && !l.trim().startsWith('//'));
    expect(lines).toHaveLength(1);
  });
  it('the agents parent keeps its own posture: owner read by ownerId, delete denied', () => {
    const [agentsBlock] = ruleBlocks(RULES, /\/agents\/\{agentId\}/);
    expect(agentsBlock.slice(0, 2)).toEqual(['allow read: if request.auth != null', '&& resource.data.ownerId == request.auth.uid;']);
    expect(agentsBlock).toContain('allow delete: if false;');
  });
});

describe('firestore.indexes.json — the counter\'s window over the owner\'s tape days', () => {
  it('ONE tape COLLECTION_GROUP composite: ownerId ASC, etDate ASC — beside A1\'s candles-status composite', () => {
    const entries = INDEXES.indexes.filter((i) => i.collectionGroup === 'tape' && i.queryScope === 'COLLECTION_GROUP');
    expect(entries).toEqual([
      { collectionGroup: 'tape', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'passes.candles.status', order: 'ASCENDING' }, { fieldPath: 'etDate', order: 'ASCENDING' }] },
      { collectionGroup: 'tape', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'ownerId', order: 'ASCENDING' }, { fieldPath: 'etDate', order: 'ASCENDING' }] },
    ]);
  });
  it('the ledger needs no composite (its reads are one agent\'s whole subcollection): no entry is declared for plays', () => {
    expect(INDEXES.indexes.some((i) => i.collectionGroup === 'plays')).toBe(false);
  });
});
