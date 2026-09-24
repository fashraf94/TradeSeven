// api/_utils/callRecords/callRecordsRulesIndex.test.js
//
// Cockpit Build 0 (docs/design/COCKPIT_SPEC_V1_3.md §3.10; §3.12 rows 10
// "index" and 13 "rules") — the DEFAULT-SUITE tripwires. The emulator suites
// (test/rules/{calls,declarations,callObservations,callSweepQueue}Denials.rules.mjs,
// `npm run test:rules`) prove the rules' behavior; these rows pin the source
// text and the index definition in every ordinary run, so neither can drift
// without the default suite going red.
//
// THE INDEX ROW validates the EXACT server query — captured from the flip scan
// as it runs, not restated by hand — against firestore.indexes.json: the
// equality fields first, then the order fields in order and direction, with
// the document-id tie-break. Removing or reshaping the committed entry is red.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runCallFlips, resetFlipIndexMemo, FLIP_QUERY } from './flip.js';
import { createCallsContext } from './mode.js';
import { makeTickBattle, makeObservation, FROZEN_NOW } from '../__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../__fixtures__/callRecordsStore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RULES = readFileSync(resolve(REPO, 'firestore.rules'), 'utf8');
const INDEXES = JSON.parse(readFileSync(resolve(REPO, 'firestore.indexes.json'), 'utf8'));

/** The statements of every `match <path> {` block (comments stripped, nested included). */
function ruleBlocks(text, pathRe) {
  const blocks = [];
  const re = new RegExp(`match ${pathRe.source} \\{`, 'g');
  while (re.exec(text) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
    }
    blocks.push(text.slice(re.lastIndex, i - 1).split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean));
  }
  return blocks;
}

const OWNER_READ = [
  'allow read: if request.auth != null',
  '&& get(/databases/$(database)/documents/agentBattles/$(battleId)).data.ownerId == request.auth.uid;',
  'allow write: if false;',
];

describe('firestore.rules — the call records (source tripwire; behavior proven in test/rules)', () => {
  for (const [sub, idVar] of [['declarations', 'evalId'], ['calls', 'callId'], ['callObservations', 'callId']]) {
    it(`agentBattles/{battleId}/${sub}/{${idVar}}: ONE block — owner read via the parent, no client write`, () => {
      expect(ruleBlocks(RULES, new RegExp(`/${sub}/\\{${idVar}\\}`))).toEqual([OWNER_READ]);
    });
  }
  it('the three subcollection blocks sit INSIDE the agentBattles/{battleId} match (so $(battleId) is bound)', () => {
    const [battleBlock] = ruleBlocks(RULES, /\/agentBattles\/\{battleId\}/);
    const text = battleBlock.join('\n');
    for (const sub of ['declarations', 'calls', 'callObservations']) expect(text).toContain(`match /${sub}/{`);
  });
  it('callSweepQueue/{battleId}: ONE top-level block, server-only — `allow read, write: if false;`', () => {
    expect(ruleBlocks(RULES, /\/callSweepQueue\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split('\n').filter((l) => l.includes('callSweepQueue') && !l.trim().startsWith('//'));
    expect(named.map((l) => l.trim())).toEqual(['match /callSweepQueue/{battleId} {']);
  });
});

// ---------------------------------------------------------------------------
/** The composite a query needs: equality fields, then order fields, then the id tie-break. */
function requiredIndex(shape) {
  const collectionGroup = shape.collectionPath.split('/').pop();
  const eq = shape.filters.filter((f) => f.op === '==').map((f) => ({ fieldPath: f.field, order: 'ASCENDING' }));
  const orders = shape.orders.map((o) => ({ fieldPath: o.field, order: o.dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }));
  const fields = [...eq, ...orders];
  if (!fields.some((f) => f.fieldPath === '__name__')) fields.push({ fieldPath: '__name__', order: orders.length ? orders[orders.length - 1].order : 'ASCENDING' });
  return { collectionGroup, queryScope: 'COLLECTION', fields };
}
/** Does the committed file serve it? (A trailing implicit __name__ in the file is accepted.) */
function served(required, indexes = INDEXES.indexes) {
  return indexes.some((ix) => {
    if (ix.collectionGroup !== required.collectionGroup || ix.queryScope !== required.queryScope) return false;
    const fields = [...ix.fields];
    const last = required.fields[required.fields.length - 1];
    if (fields.length === required.fields.length - 1 && last.fieldPath === '__name__') fields.push(last);
    return JSON.stringify(fields.map((f) => ({ fieldPath: f.fieldPath, order: f.order }))) === JSON.stringify(required.fields);
  });
}

describe('§3.12 row 10 — the flip scan\'s exact query validates against firestore.indexes.json', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse(FROZEN_NOW) + 30_000);
    resetFlipIndexMemo();
  });
  afterEach(() => { vi.useRealTimers(); });

  async function issuedQuery() {
    const db = makeCallsDb({ battle: makeTickBattle() });
    const ctx = createCallsContext({ mode: 'shadow', handlerStartMs: Date.now() });
    ctx.exit = 'no_trigger';
    ctx.observation = makeObservation();
    await runCallFlips(ctx, { db, battle: db.__store.battle, deadlineMs: Date.now() + 5_000 });
    return db.__callsAccess.queries[0];
  }

  it('the query the scan ISSUES needs exactly calls: state ASC, mintedAt ASC, __name__ ASC — and the file has it', async () => {
    const shape = await issuedQuery();
    const need = requiredIndex(shape);
    expect(need).toEqual({
      collectionGroup: 'calls', queryScope: 'COLLECTION',
      fields: [{ fieldPath: 'state', order: 'ASCENDING' }, { fieldPath: 'mintedAt', order: 'ASCENDING' }, { fieldPath: '__name__', order: 'ASCENDING' }],
    });
    expect(served(need)).toBe(true);
  });

  it('the exported FLIP_QUERY describes the same query the scan issues', async () => {
    const shape = await issuedQuery();
    expect(shape.filters).toEqual(FLIP_QUERY.equality.map((e) => ({ field: e.fieldPath, op: '==', value: e.value })));
    expect(shape.orders.map((o) => o.field)).toEqual(FLIP_QUERY.orderBy.map((o) => o.fieldPath));
  });

  it('red without the entry: the same query against the file minus the calls composite is NOT served', async () => {
    const need = requiredIndex(await issuedQuery());
    const without = INDEXES.indexes.filter((ix) => ix.collectionGroup !== 'calls');
    expect(served(need, without)).toBe(false);
    // …and a reshaped entry (mintedAt descending) does not count either.
    const reshaped = INDEXES.indexes.map((ix) => (ix.collectionGroup === 'calls'
      ? { ...ix, fields: ix.fields.map((f) => (f.fieldPath === 'mintedAt' ? { ...f, order: 'DESCENDING' } : f)) }
      : ix));
    expect(served(need, reshaped)).toBe(false);
  });

  it('exactly ONE calls composite, collection-scoped', () => {
    const calls = INDEXES.indexes.filter((ix) => ix.collectionGroup === 'calls');
    expect(calls).toHaveLength(1);
    expect(calls[0].queryScope).toBe('COLLECTION');
  });
});
