// api/_utils/setupEvidenceSweep/state.test.js
//
// The chart's evidence, PR B — the sweep's state (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-4,
// SW-5): the counter read and written in one transaction with no increment sentinel, the cap's
// boundary, fail closed on a document this code cannot read, the run record, and closed key lists.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSweepDb } from './__fixtures__/sweepDb.js';
import {
  closedTally, emptyState, failureTally, latestOf, readSweepState, recordRun, reserveProviderRequest, stateReadable,
} from './state.js';
import { LATEST_FIELDS, STATE_FIELDS } from './constants.js';

const S = '2026-11-16';
const PATH = `setupEvidenceSweepState/${S}`;
const NOW = Date.parse('2026-11-16T22:31:00.000Z');
const SRC = readFileSync(fileURLToPath(new URL('./state.js', import.meta.url)), 'utf8');
const seeded = (over = {}) => makeSweepDb({ docs: { [PATH]: { ...emptyState(S), ...over } } });

describe('reserveProviderRequest — one place under the cap, in one transaction', () => {
  it('an absent document starts at zero: the first place is 1, written with the whole state', async () => {
    const db = makeSweepDb();
    await expect(reserveProviderRequest({ db, session: S, nowMs: NOW })).resolves.toEqual({ ok: true, count: 1 });
    const doc = db.read(PATH);
    expect(Object.keys(doc)).toEqual([...STATE_FIELDS]);
    expect(doc).toMatchObject({ schemaVersion: 1, session: S, providerRequests: 1, runs: 0, updatedAt: '2026-11-16T22:31:00.000Z' });
    expect(db.__log.transactions).toBe(1);
  });
  it('the cap\'s boundary: at cap − 1 one more place is given (the last); at the cap none, and nothing is written', async () => {
    const db = seeded({ providerRequests: 399 });
    await expect(reserveProviderRequest({ db, session: S, nowMs: NOW })).resolves.toEqual({ ok: true, count: 400 });
    const commits = db.__log.commits.length;
    await expect(reserveProviderRequest({ db, session: S, nowMs: NOW })).resolves.toEqual({ ok: false, reason: 'cap', count: 400 });
    expect(db.__log.commits.length).toBe(commits);
    expect(db.read(PATH).providerRequests).toBe(400);
  });
  it('a smaller cap is honoured the same way', async () => {
    const db = makeSweepDb();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await reserveProviderRequest({ db, session: S, nowMs: NOW, cap: 3 }));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
  });
  it('the source reads and writes the number in the transaction: no increment sentinel', () => {
    expect(SRC).not.toMatch(/FieldValue|increment\(/);
    expect(SRC.replace(/\s+/g, ' ')).toContain('providerRequests: count }');
  });
  it.each([
    ['another schema version', { schemaVersion: 2 }],
    ['another session', { session: '2026-11-13' }],
    ['a counter that is a string', { providerRequests: '3' }],
    ['a negative counter', { providerRequests: -1 }],
    ['a fractional counter', { providerRequests: 2.5 }],
    ['a missing run count', { runs: undefined }],
  ])('fail closed — %s: refused, nothing written, never read as zero', async (_label, over) => {
    const db = seeded(over);
    const before = db.read(PATH);
    await expect(reserveProviderRequest({ db, session: S, nowMs: NOW })).resolves.toEqual({ ok: false, reason: 'state_unreadable', count: null });
    expect(db.read(PATH)).toEqual(before);
    expect((await readSweepState(db, S)).status).toBe('unreadable');
    await expect(recordRun({ db, session: S, nowMs: NOW, run: { startedAtMs: NOW, ms: 5, complete: true, tallies: {} } })).resolves.toEqual({ written: false, skipped: 'state_unreadable' });
    expect(db.read(PATH)).toEqual(before);
  });
  it('stateReadable: a plain document of the session with whole-number counts', () => {
    expect(stateReadable(emptyState(S), S)).toBe(true);
    expect(stateReadable(null, S)).toBe(false);
    expect(stateReadable([], S)).toBe(false);
  });
});

describe('recordRun — the end-of-run record', () => {
  it('one more run, its time, its tallies; the counter as read; the first instant kept; completedAt set once', async () => {
    const db = seeded({ providerRequests: 9, runs: 1, firstRunAt: '2026-11-16T22:30:00.000Z', runMs: 1_000 });
    const t1 = Date.parse('2026-11-16T23:30:00.000Z');
    const r = await recordRun({ db, session: S, nowMs: t1 + 4_000, run: { startedAtMs: t1, ms: 4_000.4, complete: false, tallies: { names: 3, final: { measured: 2, refused: 1 }, retryable: { missing_bar: 1 } } } });
    expect(r).toEqual({ written: true, providerRequests: 9 });
    const doc = db.read(PATH);
    expect(doc).toMatchObject({ providerRequests: 9, runs: 2, firstRunAt: '2026-11-16T22:30:00.000Z', lastRunAt: '2026-11-16T23:30:00.000Z', completedAt: null, runMs: 5_000 });
    expect(Object.keys(doc.latest)).toEqual([...LATEST_FIELDS]);
    expect(doc.latest).toMatchObject({ startedAt: '2026-11-16T23:30:00.000Z', names: 3, final: { measured: 2, refused: 1 }, retryable: { missing_bar: 1 } });
    const t2 = Date.parse('2026-11-17T12:30:00.000Z');
    await recordRun({ db, session: S, nowMs: t2 + 1_000, run: { startedAtMs: t2, ms: 1_000, complete: true, tallies: {} } });
    expect(db.read(PATH).completedAt).toBe('2026-11-17T12:30:01.000Z');
    await recordRun({ db, session: S, nowMs: t2 + 99_000, run: { startedAtMs: t2 + 98_000, ms: 1_000, complete: true, tallies: {} } });
    expect(db.read(PATH)).toMatchObject({ completedAt: '2026-11-17T12:30:01.000Z', runs: 4 });
  });
  it('a reservation and a record never lose each other\'s write (one transaction each, on the document as read)', async () => {
    const db = makeSweepDb();
    await Promise.all([
      reserveProviderRequest({ db, session: S, nowMs: NOW }),
      recordRun({ db, session: S, nowMs: NOW, run: { startedAtMs: NOW, ms: 1, complete: false, tallies: {} } }),
      reserveProviderRequest({ db, session: S, nowMs: NOW }),
    ]);
    expect(db.read(PATH)).toMatchObject({ providerRequests: 2, runs: 1 });
  });
});

describe('closed key lists: nothing free enters the document', () => {
  it('latestOf keeps exactly its fields, and every tally on its list', () => {
    const l = latestOf({ names: 2, extra: 'x', final: { measured: 1, refused: 1, other: 3 }, retryable: { missing_bar: 2, 'AAPL 1.23': 1 }, deferred: { cap: 1, MSFT: 1 }, failures: { 'read:14': 1, 'read:AAPL 1.23': 1, 'nope:x': 1 }, pending: -1, excluded: 1.5 });
    expect(Object.keys(l)).toEqual([...LATEST_FIELDS]);
    expect(l).toEqual({
      startedAt: null, names: 2, final: { measured: 1, refused: 1 }, acquired: 0, retryable: { missing_bar: 2, other: 1 }, pending: 0, excluded: 0,
      deferred: { cap: 1, other: 1 }, failures: { 'read:14': 1, 'read:other': 1, 'other:x': 1 }, programmingErrors: 0,
    });
  });
  it('closedTally and failureTally drop zero and non-count values', () => {
    expect(closedTally({ cap: 0, deadline: 'x', unpublished: 2 }, ['cap', 'deadline', 'unpublished'])).toEqual({ unpublished: 2 });
    expect(failureTally({ 'reserve:ECONNRESET': 1, 'reserve:TypeError': 2, 'acquire:': 1, 'state:9': 0 })).toEqual({ 'reserve:ECONNRESET': 1, 'reserve:TypeError': 2, 'acquire:other': 1 });
  });
});
