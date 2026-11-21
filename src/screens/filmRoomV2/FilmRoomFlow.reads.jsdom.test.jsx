// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.reads.jsdom.test.jsx
//
// Film Room D1 — F-READS (Build D spec §0, §2; exit criterion 2): the front adds no Firestore read. Driven through the
// REAL Firestore readers (filmRoomData.js) against a recording firebase/firestore double, as the screen's own reads
// suite is: on the front, one getDoc of the day's tape and nothing else; through the door, still nothing; the series
// is read only when the Deep dive opens, once; a change of day reads that day once; never a subscription.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import sep23Tape from './__fixtures__/sep23.tape.json';
import sep23Series from './__fixtures__/sep23.series.json';

const flags = vi.hoisted(() => ({ flow: 'on' }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_FLOW_MODE() { return flags.flow; },
  get FILM_ROOM_CARDS_MODE() { return 'off'; },
}));
const fs = vi.hoisted(() => ({ calls: [], docs: {} }));
vi.mock('../../firebase/config', () => ({ db: { name: 'db' }, auth: {}, default: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segs) => ({ path: segs.join('/') }),
  collection: (_db, ...segs) => ({ path: segs.join('/') }),
  where: (field, op, value) => ({ field, op, value }),
  query: (ref, ...cons) => ({ ...ref, cons }),
  getDoc: vi.fn(async (ref) => { fs.calls.push(['getDoc', ref.path]); const data = fs.docs[ref.path]; return { exists: () => data !== undefined, data: () => data }; }),
  getDocs: vi.fn(async (q) => { fs.calls.push(['getDocs', q.path]); return { docs: (fs.docs[q.path] || []).map((d) => ({ data: () => d })) }; }),
  onSnapshot: vi.fn(() => { fs.calls.push(['onSnapshot']); return () => {}; }),
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BID = sep23Tape.battleId;
const D = sep23Tape.etDate;
const TAPE_PATH = `agentBattles/${BID}/tape/${D}`;
const SERIES_PATH = `${TAPE_PATH}/series`;

let container; let root;
beforeEach(() => {
  flags.flow = 'on';
  fs.calls = []; fs.docs = {};
  globalThis.localStorage?.clear?.();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const flush = async (limitMs = 5_000) => {
  const until = performance.now() + limitMs;
  let quiet = 0;
  let seen = fs.calls.length;
  while (performance.now() < until && quiet < 6) {
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    if (fs.calls.length === seen && !container.querySelector('[data-state="loading"]')) quiet += 1; else { quiet = 0; seen = fs.calls.length; }
  }
};
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const tab = (label) => [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === label);
const battle = (over = {}) => ({ id: BID, ownerId: 'owner-1', status: 'completed', completedAt: '2026-09-23T20:05:00.000Z', timing: { tradingDays: [D] }, agentContext: { agentName: 'Momentum chaser' }, ...over });
const cardsApi = { readVerdict: async () => true, readCounter: async () => ({ ok: true, status: 200, body: { cards: [] } }), postCard: async () => ({ ok: false }), newOpId: () => 'op' };
const mount = (b = battle()) => act(() => root.render(<FilmRoomScreenV2 battle={b} onBack={() => {}} viewerId="viewer-1" nowMs={Date.parse('2026-10-08T15:00:00.000Z')} cardsApi={cardsApi} />));

describe('F-READS — the front adds no Firestore read', () => {
  it('the front: one getDoc of the day\'s tape and nothing else; every pin, the stepper and the door read nothing more', async () => {
    fs.docs[TAPE_PATH] = sep23Tape;
    fs.docs[SERIES_PATH] = sep23Series;
    mount();
    await flush();
    expect(container.querySelector('[data-flow-front]')).toBeTruthy();
    for (const pin of container.querySelectorAll('[data-flow-pin]')) click(pin);
    for (const b of container.querySelectorAll('[data-flow-stepper] button')) click(b);
    await flush();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
    click(container.querySelector('[data-flow-door]'));
    await flush();
    expect(container.querySelector('[data-depth="glance"]')).toBeTruthy();
    click(tab('Study'));
    await flush();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
  });

  it('the series only when the Deep dive opens, once; back to the front and through the door again reads nothing; never onSnapshot', async () => {
    fs.docs[TAPE_PATH] = sep23Tape;
    fs.docs[SERIES_PATH] = sep23Series;
    mount();
    await flush();
    click(container.querySelector('[data-flow-door]'));
    await flush();
    click(tab('Deep dive'));
    await flush();
    expect(container.querySelector('[data-region="price-chart"]')).toBeTruthy();
    click(container.querySelector('header button'));   // "Game flow"
    await flush();
    expect(container.querySelector('[data-flow-front]')).toBeTruthy();
    click(container.querySelector('[data-flow-door]'));
    await flush();
    click(tab('Deep dive'));
    await flush();
    expect(fs.calls.map((c) => c[0])).toEqual(['getDoc', 'getDocs']);
    expect(fs.calls.filter((c) => c[0] === 'onSnapshot')).toEqual([]);
  });

  it('a change of day on the front reads that day once — the reads the day picker made before Build D', async () => {
    const D2 = '2026-09-24';
    fs.docs[TAPE_PATH] = sep23Tape;
    mount(battle({ timing: { tradingDays: [D, D2] } }));
    await flush();
    expect(fs.calls).toEqual([['getDoc', `agentBattles/${BID}/tape/${D2}`]]);
    const chips = () => [...container.querySelectorAll('[data-region="day-picker"] button')];
    click(chips()[0]); await flush();
    expect(container.querySelector('[data-flow-front]')).toBeTruthy();
    click(chips()[1]); await flush();
    click(chips()[0]); await flush();
    expect(fs.calls).toEqual([['getDoc', `agentBattles/${BID}/tape/${D2}`], ['getDoc', TAPE_PATH]]);
  });

  it('the control: with the flow off the same open makes the same reads — the front\'s reads ARE the screen\'s', async () => {
    flags.flow = 'off';
    fs.docs[TAPE_PATH] = sep23Tape;
    mount();
    await flush();
    expect(container.querySelector('[data-flow-front]')).toBeNull();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
  });
});
