// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.words.reads.jsdom.test.jsx
//
// Film Room D2 item 7 — THE ONE READ (D2 spec §9; DW-10; exit criterion 9), driven through the REAL Firestore readers
// (filmRoomData.js firestoreReaders.readDebrief) against a recording firebase/firestore double, as D1's F-READS suite is:
// with the words on, the front reads the day's tape and ONE getDoc of agentBattles/{id}/debriefs/{etDate} — nothing
// else, never a subscription; with the words off, D1's reads exactly. A denied or missing record reads as no record; any
// other failure as an error that shows nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import sep23Tape from './__fixtures__/sep23.tape.json';
import sep23Series from './__fixtures__/sep23.series.json';

const flags = vi.hoisted(() => ({ flow: 'on', debrief: 'on' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return 'off'; },
  get FILM_ROOM_DEBRIEF_MODE() { return flags.debrief; },
}));
const fs = vi.hoisted(() => ({ calls: [], docs: {}, fail: {} }));
vi.mock('../../firebase/config', () => ({ db: { name: 'db' }, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segs) => ({ path: segs.join('/') }),
  collection: (_db, ...segs) => ({ path: segs.join('/') }),
  where: (field, op, value) => ({ field, op, value }),
  query: (ref, ...cons) => ({ ...ref, cons }),
  getDoc: vi.fn(async (ref) => {
    fs.calls.push(['getDoc', ref.path]);
    if (fs.fail[ref.path]) throw Object.assign(new Error('x'), { code: fs.fail[ref.path] });
    const data = fs.docs[ref.path];
    return { exists: () => data !== undefined, data: () => data };
  }),
  getDocs: vi.fn(async (q) => { fs.calls.push(['getDocs', q.path]); return { docs: (fs.docs[q.path] || []).map((d) => ({ data: () => d })) }; }),
  onSnapshot: vi.fn(() => { fs.calls.push(['onSnapshot']); return () => {}; }),
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';
import { firestoreReaders } from './filmRoomData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BID = sep23Tape.battleId;
const D = sep23Tape.etDate;
const TAPE_PATH = `agentBattles/${BID}/tape/${D}`;
const RECORD_PATH = `agentBattles/${BID}/debriefs/${D}`;
const RECORD = { battleId: BID, etDate: D, ownerId: 'owner-1', status: 'written', writtenAt: '2026-09-24T03:45:12.000Z', lines: [{ key: sep23Tape.actions[1].key, label: 's2', text: 'PLTR held, so DE went out on my plan.' }], dropped: [] };

let container; let root;
beforeEach(() => {
  flags.flow = 'on'; flags.debrief = 'on';
  fs.calls = []; fs.docs = { [TAPE_PATH]: sep23Tape, [`${TAPE_PATH}/series`]: sep23Series }; fs.fail = {};
  globalThis.localStorage?.clear?.();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const flush = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const battle = () => ({ id: BID, ownerId: 'owner-1', status: 'completed', completedAt: '2026-09-23T20:05:00.000Z', timing: { tradingDays: [D] }, agentContext: { agentName: 'Momentum chaser' } });
const cardsApi = { readVerdict: async () => true, readCounter: async () => ({ ok: true, status: 200, body: { cards: [] } }), postCard: async () => ({ ok: false }), newOpId: () => 'op' };
const mount = (nowMs = Date.parse('2026-10-08T15:00:00.000Z')) => act(() => root.render(<FilmRoomScreenV2 battle={battle()} onBack={() => {}} viewerId="viewer-1" nowMs={nowMs} cardsApi={cardsApi} />));
const words = () => container.querySelectorAll('[data-flow-said="agent-words"]').length;

describe('F-READS with the words: exactly one read more', () => {
  it('the words on: the day\'s tape and ONE getDoc of its debrief record; the pins, the door and the way back read nothing more; never onSnapshot', async () => {
    fs.docs[RECORD_PATH] = RECORD;
    mount(); await flush();
    expect(words()).toBe(1);
    for (const b of container.querySelectorAll('[data-flow-pin]')) click(b);
    click(container.querySelector('[data-flow-door]')); await flush();
    click(container.querySelector('header button')); await flush();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH], ['getDoc', RECORD_PATH]]);
  });
  it("the words 'off': D1's reads exactly — the tape alone", async () => {
    flags.debrief = 'off';
    fs.docs[RECORD_PATH] = RECORD;
    mount(); await flush();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
    expect(words()).toBe(0);
  });
  it('a record the rules DENY (another owner\'s, or the block not yet deployed) reads as no record — the not-yet window applies, never an error', async () => {
    fs.fail[RECORD_PATH] = 'permission-denied';
    mount(Date.parse('2026-09-24T03:00:00.000Z')); await flush();
    expect(words()).toBe(0);
    expect(container.querySelectorAll('[data-flow-debrief-notyet]')).toHaveLength(1);
  });
  it('any other failure is an error that shows nothing — no line, no not-yet line, and no second read', async () => {
    fs.fail[RECORD_PATH] = 'unavailable';
    mount(Date.parse('2026-09-24T03:00:00.000Z')); await flush();
    expect([words(), container.querySelectorAll('[data-flow-debrief-notyet]').length]).toEqual([0, 0]);
    expect(fs.calls.filter((c) => c[1] === RECORD_PATH)).toHaveLength(1);
  });
});

describe('firestoreReaders.readDebrief — the one reader', () => {
  it('a record: ready; none: missing; denied or not-found: missing; anything else: error', async () => {
    fs.docs[RECORD_PATH] = RECORD;
    expect(await firestoreReaders.readDebrief(BID, D)).toEqual({ status: 'ready', record: RECORD });
    expect(await firestoreReaders.readDebrief(BID, '2026-09-24')).toEqual({ status: 'missing', record: null });
    fs.fail[RECORD_PATH] = 'permission-denied';
    expect(await firestoreReaders.readDebrief(BID, D)).toEqual({ status: 'missing', record: null });
    fs.fail[RECORD_PATH] = 'not-found';
    expect(await firestoreReaders.readDebrief(BID, D)).toEqual({ status: 'missing', record: null });
    fs.fail[RECORD_PATH] = 'unavailable';
    expect(await firestoreReaders.readDebrief(BID, D)).toEqual({ status: 'error', record: null });
    expect(fs.calls.every((c) => c[0] === 'getDoc' && c[1].startsWith(`agentBattles/${BID}/debriefs/`))).toBe(true);
  });
});
