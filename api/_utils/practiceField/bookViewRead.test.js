// api/_utils/practiceField/bookViewRead.test.js
//
// Practice Field build B3 — THE READER (bookViewRead.js) on the in-memory store. Every scene, stored at its Firestore paths
// and read back through readBookView, gives exactly the view built from the same records directly: so the reader reads
// what the view needs, under the caller's own book, in the right order. History is capped at 20, newest first, and holds
// resulted ideas only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { buildBookView, HISTORY_LIMIT } from './bookView.js';
import { readBookView } from './bookViewRead.js';
import { makeMandateFakeDb } from './__testsupport__/fixtures.js';
import { SCENE_NAMES, sceneInput, sceneDocs, SCENE_UID, SCENE_BOOK_ID } from './__testsupport__/bookViewScenes.js';

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

describe('readBookView: the stored records read back give the view built from them', () => {
  it('every scene, through the store, equals the view built directly', async () => {
    for (const name of SCENE_NAMES) {
      const input = sceneInput(name);
      const db = makeMandateFakeDb(sceneDocs(name));
      const stored = (await readBookView(db, { uid: SCENE_UID, agentOn: input.agentOn })).book;
      expect(JSON.stringify(stored), name).toBe(JSON.stringify(buildBookView(input)));
    }
  }, 30_000);

  it('History: at most 20, newest first, resulted ideas only (a cancelled or open idea is not finished)', async () => {
    const docs = sceneDocs('sample');
    const base = `mandates/${SCENE_BOOK_ID}/ideas`;
    for (let i = 1; i <= 24; i += 1) {
      const d = `2026-10-${String(i).padStart(2, '0')}`;
      docs[`${base}/h${String(i).padStart(2, '0')}`] = { ideaId: `h${i}`, status: 'resulted', contract: { slot: 'short', names: [`N${i}`] }, liquidation: { completedSession: d } };
    }
    docs[`${base}/cancelled1`] = { status: 'cancelled', contract: { slot: 'short', names: ['ZZZ'] } };
    const { book } = await readBookView(makeMandateFakeDb(docs), { uid: SCENE_UID, agentOn: true });
    expect(book.history.items).toHaveLength(HISTORY_LIMIT);
    expect(book.history.items.map((x) => x.namesText).slice(0, 3)).toEqual(['N24', 'N23', 'N22']);
    expect(book.history.items.at(-1).namesText).toBe('N5');
    expect(book.history.items.some((x) => x.namesText === 'ZZZ')).toBe(false);
    // none of these has a result packet: each reads as unchecked, never as a result
    expect(book.history.items.every((x) => x.columns === null && x.notMeasurable)).toBe(true);
  });
});
