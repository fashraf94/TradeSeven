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
// The emulator suites' shared copy of the parser (no emulator is touched on import).
import { ruleBlocks as suiteRuleBlocks } from '../../../test/rules/callRecordsRulesSuite.mjs';

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
    // CRLF-safe (review BR-5): `.` stops at a CR, so an LF-only split left the
    // CR in place and the anchored strip missed every inline comment.
    blocks.push(text.slice(re.lastIndex, i - 1).split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean));
  }
  return blocks;
}

const OWNER_READ = [
  'allow read: if request.auth != null',
  '&& get(/databases/$(database)/documents/agentBattles/$(battleId)).data.ownerId == request.auth.uid;',
  'allow write: if false;',
];

describe('firestore.rules — the call records (source tripwire; behavior proven in test/rules)', () => {
  for (const [sub, idVar] of [['declarations', 'evalId'], ['calls', 'callId'], ['callObservations', 'callId'], ['callEvents', 'eventId']]) {
    it(`agentBattles/{battleId}/${sub}/{${idVar}}: ONE block — owner read via the parent, no client write`, () => {
      expect(ruleBlocks(RULES, new RegExp(`/${sub}/\\{${idVar}\\}`))).toEqual([OWNER_READ]);
    });
  }
  it('the four subcollection blocks sit INSIDE the agentBattles/{battleId} match (so $(battleId) is bound)', () => {
    const [battleBlock] = ruleBlocks(RULES, /\/agentBattles\/\{battleId\}/);
    const text = battleBlock.join('\n');
    for (const sub of ['declarations', 'calls', 'callObservations', 'callEvents']) expect(text).toContain(`match /${sub}/{`);
  });
  it('callSweepQueue/{battleId}: ONE top-level block, server-only — `allow read, write: if false;`', () => {
    expect(ruleBlocks(RULES, /\/callSweepQueue\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split('\n').filter((l) => l.includes('callSweepQueue') && !l.trim().startsWith('//'));
    expect(named.map((l) => l.trim())).toEqual(['match /callSweepQueue/{battleId} {']);
  });
  it('callSweepState/{docId}: ONE top-level block, server-only (Build 1a §8, §10)', () => {
    expect(ruleBlocks(RULES, /\/callSweepState\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
    const named = RULES.split('\n').filter((l) => l.includes('callSweepState') && !l.trim().startsWith('//'));
    expect(named.map((l) => l.trim())).toEqual(['match /callSweepState/{docId} {']);
  });
});

describe('both rules-text parsers read a CRLF checkout exactly as they read LF (branch review BR-5)', () => {
  const LF = RULES.replace(/\r\n/g, '\n');
  const CRLF = LF.replace(/\n/g, '\r\n');
  const PATHS = [
    /\/callSweepQueue\/\{[^}/]+\}/, /\/agentBattles\/\{battleId\}/,
    /\/declarations\/\{evalId\}/, /\/calls\/\{callId\}/, /\/callObservations\/\{callId\}/,
  ];
  for (const [label, parse] of [['this suite\'s parser', ruleBlocks], ['the rules-suite copy (test/rules/callRecordsRulesSuite.mjs)', suiteRuleBlocks]]) {
    it(`${label}: every block, comments stripped, is identical under CRLF — the queue's inline comment included`, () => {
      expect(CRLF).toContain('if false;  // Admin SDK only\r\n');
      for (const re of PATHS) expect(parse(CRLF, re), String(re)).toEqual(parse(LF, re));
      expect(parse(CRLF, /\/callSweepQueue\/\{[^}/]+\}/)).toEqual([['allow read, write: if false;']]);
      expect(parse(CRLF, /\/calls\/\{callId\}/)).toEqual([OWNER_READ]);
    });
  }
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

  it('exactly TWO calls composites, collection-scoped: Build 0\'s ASC scan and Build 1a\'s DESC chat block (§9)', () => {
    const calls = INDEXES.indexes.filter((ix) => ix.collectionGroup === 'calls');
    expect(calls).toHaveLength(2);
    for (const ix of calls) expect(ix.queryScope).toBe('COLLECTION');
    expect(calls[1].fields).toEqual([{ fieldPath: 'state', order: 'ASCENDING' }, { fieldPath: 'mintedAt', order: 'DESCENDING' }, { fieldPath: '__name__', order: 'DESCENDING' }]);
  });

  it("Build 1a §9: the chat block's four queries (open; hit / expired_unresolved / ended_with_battle, newest first) are served by the DESC composite — and NOT by the ASC one", async () => {
    const { makeCallsFirestore } = await import('../__fixtures__/callsFirestore.js');
    const { readCallsForBlock } = await import('./callsBlock.js');
    const db = makeCallsFirestore({ docs: {} });
    await readCallsForBlock(db, 'battle-x');
    const shapes = db.__access.queries;
    expect(shapes).toHaveLength(4);
    for (const shape of shapes) {
      const need = requiredIndex(shape);
      expect(need.fields).toEqual([{ fieldPath: 'state', order: 'ASCENDING' }, { fieldPath: 'mintedAt', order: 'DESCENDING' }, { fieldPath: '__name__', order: 'DESCENDING' }]);
      expect(served(need)).toBe(true);
      expect(served(need, INDEXES.indexes.filter((ix) => !(ix.collectionGroup === 'calls' && ix.fields[1].order === 'DESCENDING')))).toBe(false);
    }
  });

  it('Build 1a §8: the sweep queue\'s nextExpiresAt index is declared as a fieldOverride carrying exactly the automatic triple (ASC, DESC, CONTAINS at collection scope)', () => {
    const override = INDEXES.fieldOverrides.find((o) => o.collectionGroup === 'callSweepQueue' && o.fieldPath === 'nextExpiresAt');
    expect(override).toBeDefined();
    expect(override.indexes).toEqual([
      { order: 'ASCENDING', queryScope: 'COLLECTION' },
      { order: 'DESCENDING', queryScope: 'COLLECTION' },
      { arrayConfig: 'CONTAINS', queryScope: 'COLLECTION' },
    ]);
    expect(INDEXES.fieldOverrides.filter((o) => o.collectionGroup === 'agentBattles')).toEqual([]); // the reconciliation route uses the automatic index; no override replaces it
  });
});
