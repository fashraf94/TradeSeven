// api/_utils/compositionCandidateApply.test.js
//
// Sol re-review #8 — the --during-close NAMESPACE BELT, unit-proven:
//   1. the happy path writes entries FIRST (batched, M12 injective ids) and
//      the run doc LAST (the completion sentinel — review P6), every write
//      inside compositionCandidateState/*;
//   2. THE MUTATION ROW: a redirect of the apply write set toward agents/*
//      (or any other protected store) aborts BEFORE that Firestore write —
//      zero writes land anywhere.

import { describe, it, expect } from 'vitest';
import { applyCandidateEntries, assertCandidatePath, CANDIDATE_APPLY_COLLECTION } from './compositionCandidateApply.js';
import { entryDocId } from './compositionStateResolver.js';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';

const ENTRIES = [
  { entryKey: 'agent|agents/a1/rules/r1|paramValues.pct', afterValue: 80, action: 'clamp' },
  { entryKey: 'agent|agents/a2/rules/r9|paramValues.n', afterValue: 3, action: 'clamp' },
];
const RUN_DOC = { migrationRunId: 'run-x', candidateStateId: 'run-x', entryCount: 2 };

describe('#8 — the candidate-apply writer and its namespace belt', () => {
  it('happy path: entries first (injective ids), run doc last (the sentinel), everything under compositionCandidateState/*', async () => {
    const { db, store, writeLog } = makeInMemoryDb({});
    const out = await applyCandidateEntries(db, { runId: 'run-x', entries: ENTRIES, runDoc: RUN_DOC });
    expect(out.entryCount).toBe(2);
    for (const e of ENTRIES) {
      expect(store.get(`${CANDIDATE_APPLY_COLLECTION}/run-x/entries/${entryDocId(e.entryKey)}`)).toEqual(e);
    }
    expect(store.get(`${CANDIDATE_APPLY_COLLECTION}/run-x`)).toEqual(RUN_DOC);
    // Sentinel order: the run doc is the LAST write; every write is in-namespace.
    const paths = writeLog.map(([, p]) => p);
    expect(paths[paths.length - 1]).toBe(`${CANDIDATE_APPLY_COLLECTION}/run-x`);
    expect(paths.every((p) => p.startsWith(`${CANDIDATE_APPLY_COLLECTION}/`))).toBe(true);
  });

  it('THE MUTATION ROW: a write set redirected toward agents/* aborts BEFORE any Firestore write — zero writes anywhere', async () => {
    const { db, writeLog } = makeInMemoryDb({});
    // Simulate the #8 mutation: a code-level redirect of the apply target
    // (db.collection returns the PROTECTED store when asked for the
    // candidate namespace). The belt must fire before a single write lands.
    const redirectingDb = {
      ...db,
      collection: (name) => db.collection(name === CANDIDATE_APPLY_COLLECTION ? 'agents' : name),
    };
    await expect(applyCandidateEntries(redirectingDb, { runId: 'run-x', entries: ENTRIES, runDoc: RUN_DOC }))
      .rejects.toThrow(/outside the candidate namespace/);
    expect(writeLog).toEqual([]); // nothing landed — the abort precedes the write
  });

  it('the belt itself: candidate paths pass, protected/foreign paths throw', () => {
    expect(assertCandidatePath({ path: `${CANDIDATE_APPLY_COLLECTION}/run-1` })).toBeUndefined();
    expect(assertCandidatePath({ path: `${CANDIDATE_APPLY_COLLECTION}/run-1/entries/e1` })).toBeUndefined();
    for (const bad of ['agents/a1', 'agents/a1/rules/r1', 'compiledBuilds/x', 'composition/activation']) {
      expect(() => assertCandidatePath({ path: bad })).toThrow(/outside the candidate namespace/);
    }
  });
});
