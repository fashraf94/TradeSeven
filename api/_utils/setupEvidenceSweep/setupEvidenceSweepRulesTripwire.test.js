// api/_utils/setupEvidenceSweep/setupEvidenceSweepRulesTripwire.test.js
//
// The chart's evidence, PR B — the DEFAULT-SUITE tripwire for the state's rule (the
// setupMenuLabelsRulesTripwire.test.js pattern). The emulator suite
// (test/rules/setupEvidenceSweepDenials.rules.mjs, `npm run test:rules`) proves the rule's behaviour;
// these rows pin the source text in every ordinary run, and that no index entry is needed.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// The emulator suites' shared parser (no emulator is touched on import).
import { ruleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';
import { STATE_COLLECTION } from './constants.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RULES = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));
const STATE = readFileSync(resolve(HERE, 'state.js'), 'utf8');
const SWEEP = readFileSync(resolve(HERE, 'sweep.js'), 'utf8');

describe('firestore.rules — setupEvidenceSweepState (source tripwire; behaviour proven in test/rules)', () => {
  it('ONE top-level block, server-only, and the catch-all deny still closes the file', () => {
    expect(ruleBlocks(RULES, /\/setupEvidenceSweepState\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split(/\r?\n/).filter((l) => /\/setupEvidenceSweepState\/\{/.test(l) && !l.trim().startsWith('//'));
    expect(named.map((l) => l.replace(/\s+$/, ''))).toEqual(['    match /setupEvidenceSweepState/{session} {']);
    expect(ruleBlocks(RULES, /\/\{document=\*\*\}/).at(-1)).toEqual(['allow read, write: if false;']);
  });
});

describe('firestore.indexes.json — no entry: the state has no per-symbol map and is never queried', () => {
  it('no override and no composite index on the collection', () => {
    expect(INDEXES.fieldOverrides.some((o) => o.collectionGroup === STATE_COLLECTION)).toBe(false);
    expect(INDEXES.indexes.some((i) => i.collectionGroup === STATE_COLLECTION)).toBe(false);
  });
  it('the state is addressed by document id only: no query on it anywhere in the sweep', () => {
    expect(STATE.replace(/\s+/g, ' ')).toContain('db.collection(STATE_COLLECTION).doc(session)');
    for (const src of [STATE, SWEEP]) expect(src).not.toMatch(/STATE_COLLECTION\)\s*\.(where|orderBy|limit|select|get)\b/);
  });
});
