// @vitest-environment jsdom
//
// src/screens/filmRoomV2/filmRoomData.jsdom.test.jsx
//
// Film Room A2 item 3 — THE READS (spec V1.2 §7; Amendment E BA-40): one
// getDoc of tape/{etDate} per selected day, never repeated for a day already
// read; series/* only when the Deep dive opens, one owner-constrained query
// per day; never a subscription. Driven through the real Firestore readers
// against a recording firebase/firestore double; the mounted screen's reads
// are FilmRoomScreenV2.reads.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import sep23Tape from './__fixtures__/sep23.tape.json';
import sep23Series from './__fixtures__/sep23.series.json';

const fs = vi.hoisted(() => ({ calls: [], docs: {}, denied: new Set(), fail: false }));
vi.mock('../../firebase/config', () => ({ db: { name: 'db' }, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segs) => ({ path: segs.join('/') }),
  collection: (_db, ...segs) => ({ path: segs.join('/') }),
  where: (field, op, value) => ({ field, op, value }),
  query: (ref, ...cons) => ({ ...ref, cons }),
  getDoc: vi.fn(async (ref) => {
    fs.calls.push(['getDoc', ref.path]);
    if (fs.fail) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    if (fs.denied.has(ref.path)) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    const data = fs.docs[ref.path];
    return { exists: () => data !== undefined, data: () => data };
  }),
  getDocs: vi.fn(async (q) => {
    fs.calls.push(['getDocs', q.path, q.cons]);
    return { metadata: { fromCache: fs.offline === true }, docs: fs.offline ? [] : (fs.docs[q.path] || []).map((d) => ({ data: () => d })) };
  }),
  onSnapshot: vi.fn(() => { fs.calls.push(['onSnapshot']); return () => {}; }),
}));

import { firestoreReaders } from './filmRoomData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BID = sep23Tape.battleId;
const D = sep23Tape.etDate;
const TAPE_PATH = `agentBattles/${BID}/tape/${D}`;
const SERIES_PATH = `${TAPE_PATH}/series`;

let container; let root;
beforeEach(() => {
  fs.calls = []; fs.docs = {}; fs.denied = new Set(); fs.fail = false;
  globalThis.localStorage?.clear?.();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const flush = async (n = 6) => { for (let i = 0; i < n; i += 1) await act(async () => { await Promise.resolve(); }); };
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const tab = (label) => [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === label);

const battle = (over = {}) => ({ id: BID, status: 'completed', completedAt: '2026-09-23T20:05:00.000Z', timing: { tradingDays: [D] }, agentContext: { agentName: 'Momentum chaser' }, ...over });

describe('the Firestore readers', () => {
  it('a tape day is ONE getDoc of agentBattles/{id}/tape/{etDate}', async () => {
    fs.docs[TAPE_PATH] = sep23Tape;
    const r = await firestoreReaders.readTape(BID, D);
    expect(r.status).toBe('ready');
    expect(r.tape.battleId).toBe(BID);
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
  });

  it('a denied get (a missing tape, or another owner\'s) reads "no tape"; any other failure is an error, never "no tape"', async () => {
    fs.denied.add(TAPE_PATH);
    expect((await firestoreReaders.readTape(BID, D)).status).toBe('missing');
    fs.denied.clear();
    expect((await firestoreReaders.readTape(BID, D)).status).toBe('missing');   // not there
    fs.fail = true;
    expect((await firestoreReaders.readTape(BID, D)).status).toBe('error');
  });

  it('a day\'s series is ONE query of tape/{etDate}/series constrained to the tape\'s ownerId (rules are not filters)', async () => {
    fs.docs[SERIES_PATH] = sep23Series;
    const r = await firestoreReaders.readSeries(BID, D, sep23Tape.ownerId);
    expect(r.status).toBe('ready');
    expect(r.series).toHaveLength(sep23Series.length);
    expect(fs.calls).toEqual([['getDocs', SERIES_PATH, [{ field: 'ownerId', op: '==', value: sep23Tape.ownerId }]]]);
  });
});

describe('review A2V3-2 — a series answer from the offline cache is not the record', () => {
  it('offline, getDocs answers from the cache without an error: that reads as a failed read, never "no series"', async () => {
    fs.docs[SERIES_PATH] = sep23Series;
    fs.offline = true;
    try {
      expect(await firestoreReaders.readSeries(BID, D, sep23Tape.ownerId)).toEqual({ status: 'error', series: [] });
    } finally {
      fs.offline = false;
    }
    expect((await firestoreReaders.readSeries(BID, D, sep23Tape.ownerId)).status).toBe('ready');
  });
});
