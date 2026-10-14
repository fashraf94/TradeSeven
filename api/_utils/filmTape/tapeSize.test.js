// api/_utils/filmTape/tapeSize.test.js
//
// Film Room B1 (Astra F3, exit criterion 4) — THE TAPE STAYS WITHIN ITS SIZE
// BUDGET WHERE B1'S OPTIONAL SECTIONS CAN MAKE IT SO. Before the write, a
// fresh write and a merge alike, the merged document is estimated against the
// budget: over it, `meetings` goes first (coverage unavailable,
// document_size_budget); still over, the tag items and exits; still over, the
// core tape alone is written as before B1. Every other section is the one the
// day writes without a budget. The real-Firestore regression (the emulator's
// own 1 MiB limit) is test/rules/filmTapeSizeBudget.rules.mjs; here the budget
// is the writer's test seam, so the three steps run on ordinary fixtures.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real writer; only the flag
// module is mocked, by spreading the real one.

import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { writeTapeDay } from './writeTapeDay.js';
import {
  firestoreValueBytes, tapeDocumentBytes, fitTapeToBudget, TAPE_SIZE_BUDGET_BYTES, FIRESTORE_MAX_DOCUMENT_BYTES,
  MEETINGS_OVER_BUDGET_NOTE, TAGS_OVER_BUDGET_NOTE,
} from './tapeSize.js';
import { contentOf, stableStringify } from './tapeMerge.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { sizedDay, boundedMeetings } from './__fixtures__/sizeFixtures.js';

const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const D = '2026-09-24';
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
const utf8 = (s) => Buffer.byteLength(s, 'utf8');

/** Everything but B1's optional sections — what must be the same with and without the budget. */
const core = (doc) => {
  const c = structuredClone(contentOf(doc));
  delete c.meetings; delete c.tags;
  if (c.coverage) { delete c.coverage.meetings; delete c.coverage.tags; }
  return stableStringify(c);
};

async function written(fx, { budget, t = makeTapeDb(seedDay({}, fx)), now = NIGHT } = {}) {
  const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now, sizeBudget: budget });
  return { r, t, tape: t.store.get(path(fx)) };
}

describe('the estimate — Firestore\'s storage-size rules, and never less than the JSON', () => {
  it('a value: string = UTF-8 bytes + 1, number 8, boolean and null 1, a map\'s names UTF-8 + 1, an array the sum', () => {
    expect(firestoreValueBytes('abc')).toBe(4);
    expect(firestoreValueBytes('漢')).toBe(4);
    expect(firestoreValueBytes(12.5)).toBe(8);
    expect(firestoreValueBytes(true)).toBe(1);
    expect(firestoreValueBytes(null)).toBe(1);
    expect(firestoreValueBytes({ ab: 1, c: 'x' })).toBe((3 + 8) + (2 + 2));
    expect(firestoreValueBytes([1, 'x', null])).toBe(8 + 2 + 1);
  });

  it('a document: its name (agentBattles/{id}/tape/{etDate}) + 16 + its fields + 32 — or its UTF-8 JSON, whichever is larger', () => {
    const doc = { battleId: 'b1', etDate: D, n: [0, 0, 0, 0, 0, 0, 0, 0] };
    const name = (12 + 1) + (2 + 1) + (4 + 1) + (10 + 1) + 16;
    expect(tapeDocumentBytes(doc)).toBe(name + firestoreValueBytes(doc) + 32);
    const wordy = { battleId: 'b1', etDate: D, s: '"\\'.repeat(1000) };              // JSON escapes double these
    expect(tapeDocumentBytes(wordy)).toBe(utf8(JSON.stringify(wordy)));
  });

  it('the budget sits under Firestore\'s limit, with a margin', () => {
    expect(FIRESTORE_MAX_DOCUMENT_BYTES).toBe(1_048_576);
    expect(TAPE_SIZE_BUDGET_BYTES).toBe(950_000);
  });

  it('a document within the budget is returned as it is', () => {
    const doc = { battleId: 'b1', etDate: D, meetings: [{ a: 1 }], tags: { items: [], exits: [] } };
    expect(fitTapeToBudget(doc, { budget: 10_000 })).toBe(doc);
  });
});

describe('through the real writer: meetings first, then the tag items and exits, then the core tape as before B1', () => {
  let fx;
  let control;
  let sizes;
  // the control: the same day written with no budget at all; the budgets below are read off it
  beforeAll(async () => {
    fx = await sizedDay({ battleId: 'b-size-steps', meetings: boundedMeetings(D) });
    control = (await written(fx, { budget: Infinity })).tape;
    const noMeetings = fitTapeToBudget(control, { budget: tapeDocumentBytes(control) - 1 });
    sizes = { all: tapeDocumentBytes(control), noMeetings: tapeDocumentBytes(noMeetings) };
  });

  it('the precondition: the day carries 26 bounded meetings and tag items', () => {
    expect(control.meetings).toHaveLength(26);
    expect(control.tags.items.length).toBeGreaterThan(0);
    expect(sizes.all - sizes.noMeetings).toBeGreaterThan(26 * 1500);
  });

  it('over the budget with the meetings, within it without: meetings unavailable (document_size_budget); tags and every other section as written without a budget', async () => {
    const { r, tape } = await written(fx, { budget: sizes.all - 1 });
    expect(r.status).toBe('written');
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE, preservedFrom: null });
    expect(tape.tags).toEqual(control.tags);
    expect(tape.coverage.tags).toEqual(control.coverage.tags);
    expect(core(tape)).toBe(core(control));
  });

  it('still over without the meetings: the tag items and exits go too (coverage unavailable, document_size_budget); the rest of tags and every other section stand', async () => {
    const { r, tape } = await written(fx, { budget: sizes.noMeetings - 1 });
    expect(r.status).toBe('written');
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings.note).toBe(MEETINGS_OVER_BUDGET_NOTE);
    expect(tape.tags).toEqual({ ...control.tags, items: null, exits: null });
    expect(tape.coverage.tags).toMatchObject({ status: 'unavailable', note: TAGS_OVER_BUDGET_NOTE });
    expect(core(tape)).toBe(core(control));
  });

  it('the core tape alone over the budget: written as before B1 — both optional sections gone, the core untouched (the store decides; Firestore\'s own limit is the emulator test\'s)', async () => {
    const { r, tape } = await written(fx, { budget: 1 });
    expect(r.status).toBe('written');
    expect(tape.meetings).toEqual([]);
    expect(tape.tags.items).toBeNull();
    expect(core(tape)).toBe(core(control));
  });

  it('the same day again under the same budget: unchanged — the budget is applied before "did anything change"', async () => {
    const t = makeTapeDb(seedDay({}, fx));
    await written(fx, { budget: sizes.all - 1, t });
    const again = await written(fx, { budget: sizes.all - 1, t, now: NIGHT + 60_000 });
    expect(again.r.status).toBe('unchanged');
  });

  it('a merge: a tape stored with its meetings, refreshed over the budget, drops them the same way', async () => {
    const t = makeTapeDb(seedDay({}, fx));
    expect((await written(fx, { budget: Infinity, t })).tape.meetings).toHaveLength(26);
    const { r, tape } = await written(fx, { budget: sizes.all - 1, t, now: NIGHT + 60_000 });
    expect(r.status).toBe('written');
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE });
    expect(core(tape)).toBe(core(control));
  });

  it('the default budget leaves an ordinary day — meetings at every limit included — exactly as written without one', async () => {
    const { tape } = await written(fx, { budget: undefined });
    expect(sizes.all).toBeLessThan(TAPE_SIZE_BUDGET_BYTES);
    expect(stableStringify(contentOf(tape))).toBe(stableStringify(contentOf(control)));
  });
});
