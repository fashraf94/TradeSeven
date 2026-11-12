// api/_utils/filmRoom/practiceFieldSeam.test.js
//
// Film Room C1 item 2 — THE PRACTICE FIELD SEAM (refinement R-C1-3; Build C spec §4): the two helpers the nomination
// path reaches the book through, with their "no book" defaults, and the test-only injection.
//   · bookForOwner answers null by default, and reads nothing (a handle that throws on any touch still answers null);
//   · buildNominationDoc builds contract V2 §5.2's record: exactly its fields, `queued`, the source reference,
//     `queuedAt`, `expiresAt` the close of the tenth session after the anchor on the calendar of record (a weekend, a
//     holiday and an early close walked), and the state history;
//   · a walk off the maintained calendar throws calendar_unavailable — never a guessed expiry;
//   · setPracticeFieldSeam swaps a helper in a test, restores, refuses an unknown helper, and refuses to run at all
//     outside the vitest runner (production can never call it).
// Dependency-surface guard (BUILD_RULES §4): the seam imports api/_utils/marketSchedule.js, and through it
// src/utils/marketCalendar.js; this import is unmocked.

import { describe, it, expect, afterEach } from 'vitest';
import {
  bookForOwner, buildNominationDoc, setPracticeFieldSeam, resetPracticeFieldSeam, closeOfSessionsAfter,
  PRACTICE_FIELD_SEAM_DEFAULTS, NOMINATION_SOURCE_KIND,
} from './practiceFieldSeam.js';
import { NOMINATION_EXPIRY_SESSIONS } from '../../../src/data/cardStages.js';

afterEach(() => resetPracticeFieldSeam());

/** A handle that fails on any touch: a default that read anything would throw. */
const untouchable = new Proxy({}, { get: (_t, k) => { throw new Error(`the default touched db.${String(k)}`); } });
const SOURCE = { entryId: 'op_1', situationId: 'stalled', questionId: 'stalled.want', questionVersion: 1 };

describe('C1 item 2 — the seam\'s defaults: no book for anyone, and the contract\'s record', () => {
  it('bookForOwner answers null and reads nothing', async () => {
    expect(await bookForOwner(untouchable, { uid: 'owner-1', attributionAgentId: 'agent-1' })).toBeNull();
    expect(await PRACTICE_FIELD_SEAM_DEFAULTS.bookForOwner(untouchable, { uid: 'u', attributionAgentId: 'a' })).toBeNull();
  });

  it('buildNominationDoc: exactly the record\'s fields — queued, the source reference, queuedAt, expiresAt, the state history', () => {
    const nowIso = '2026-11-11T15:00:00.000Z';   // Wed 10:00 ET, inside the session: the anchor is Nov 11
    const doc = buildNominationDoc({ ...SOURCE, nowIso, expiresAfterSessions: NOMINATION_EXPIRY_SESSIONS });
    expect(Object.keys(doc)).toEqual(['state', 'source', 'queuedAt', 'expiresAt', 'stateHistory']);
    expect(doc).toEqual({
      state: 'queued',
      source: { kind: NOMINATION_SOURCE_KIND, ...SOURCE },
      queuedAt: nowIso,
      // ten sessions after Nov 11: Nov 12, 13, 16, 17, 18, 19, 20, 23, 24, 25 — the 25th's close, 16:00 EST
      expiresAt: '2026-11-25T21:00:00.000Z',
      stateHistory: [{ state: 'queued', at: nowIso }],
    });
    expect(NOMINATION_SOURCE_KIND).toBe('film_room_card');
    expect(NOMINATION_EXPIRY_SESSIONS).toBe(10);
  });

  it('the walk: after the close the anchor is the next session; Thanksgiving is skipped and the early close after it honoured', () => {
    // Wed Nov 11, 17:00 ET (after the close): the anchor is Thu Nov 12; ten after it run to Fri Nov 27 (Nov 26 a
    // holiday), an early close at 13:00 ET
    expect(new Date(closeOfSessionsAfter(Date.parse('2026-11-11T22:00:00.000Z'), 10)).toISOString()).toBe('2026-11-27T18:00:00.000Z');
    // a Saturday: the anchor is Monday
    expect(new Date(closeOfSessionsAfter(Date.parse('2026-11-14T15:00:00.000Z'), 1)).toISOString()).toBe('2026-11-17T21:00:00.000Z');
    // the instant at the open is inside the session
    expect(new Date(closeOfSessionsAfter(Date.parse('2026-11-16T14:30:00.000Z'), 1)).toISOString()).toBe('2026-11-17T21:00:00.000Z');
  });

  it('a walk off the maintained calendar throws calendar_unavailable — no guessed expiry', () => {
    let err = null;
    try { buildNominationDoc({ ...SOURCE, nowIso: '2027-12-27T15:00:00.000Z', expiresAfterSessions: 10 }); } catch (e) { err = e; }
    expect(err?.code).toBe('calendar_unavailable');
    expect(err?.practiceFieldSeam).toBe(true);
  });

  it('an incomplete source or a non-instant is refused, invalid_nomination', () => {
    for (const over of [{ entryId: '' }, { situationId: null }, { questionVersion: '1' }, { nowIso: 'today' }, { expiresAfterSessions: 0 }]) {
      let err = null;
      try { buildNominationDoc({ ...SOURCE, nowIso: '2026-11-11T15:00:00.000Z', expiresAfterSessions: 10, ...over }); } catch (e) { err = e; }
      expect(err?.code, JSON.stringify(over)).toBe('invalid_nomination');
    }
  });
});

describe('C1 item 2 — setPracticeFieldSeam: tests only', () => {
  it('swaps a helper, and the restore puts the default back', async () => {
    const restore = setPracticeFieldSeam({ bookForOwner: async (_db, { uid }) => ({ bookId: `book-of-${uid}`, status: 'active' }) });
    expect(await bookForOwner(untouchable, { uid: 'u1', attributionAgentId: 'a1' })).toEqual({ bookId: 'book-of-u1', status: 'active' });
    restore();
    expect(await bookForOwner(untouchable, { uid: 'u1', attributionAgentId: 'a1' })).toBeNull();
  });

  it('refuses an unknown helper', () => {
    expect(() => setPracticeFieldSeam({ writeBook: () => {} })).toThrow(/unknown helper writeBook/);
  });

  it('refuses to run outside the vitest runner (production can never inject), and under NODE_ENV production', () => {
    const was = process.env.VITEST;
    const node = process.env.NODE_ENV;
    try {
      delete process.env.VITEST;
      expect(() => setPracticeFieldSeam({ bookForOwner: async () => ({ bookId: 'b', status: 'active' }) })).toThrow(/tests only/);
      expect(() => resetPracticeFieldSeam()).toThrow(/tests only/);
      process.env.VITEST = 'true';
      process.env.NODE_ENV = 'production';
      expect(() => setPracticeFieldSeam({ bookForOwner: async () => ({ bookId: 'b', status: 'active' }) })).toThrow(/tests only/);
    } finally {
      process.env.VITEST = was;
      process.env.NODE_ENV = node;
    }
  });
});
