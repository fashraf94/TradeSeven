// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.reads.jsdom.test.jsx
//
// Film Room A2 item 3 — THE READS (spec V1.2 §7; Amendment E BA-40): one
// getDoc of tape/{etDate} per selected day, never repeated for a day already
// read; series/* only when the Deep dive opens, one owner-constrained query
// per day; never a subscription. Driven through the real Firestore readers
// against a recording firebase/firestore double, and through the mounted
// screen with recording readers.

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
    return { docs: (fs.docs[q.path] || []).map((d) => ({ data: () => d })) };
  }),
  onSnapshot: vi.fn(() => { fs.calls.push(['onSnapshot']); return () => {}; }),
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2';

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

// Macrotask turns: the readers import the Firebase SDK lazily (import()), which settles over several.
const flush = async (n = 8) => { for (let i = 0; i < n; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const tab = (label) => [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === label);

const battle = (over = {}) => ({ id: BID, status: 'completed', completedAt: '2026-09-23T20:05:00.000Z', timing: { tradingDays: [D] }, agentContext: { agentName: 'Momentum chaser' }, ...over });

describe('the mounted screen reads exactly what §7 allows', () => {
  it('Glance and Study: one getDoc for the day and nothing else — no series, no subscription, no battle read', async () => {
    fs.docs[TAPE_PATH] = sep23Tape;
    fs.docs[SERIES_PATH] = sep23Series;
    act(() => root.render(<FilmRoomScreenV2 battle={battle()} onBack={() => {}} viewerId="viewer-1" nowMs={Date.parse('2026-10-08T15:00:00.000Z')} />));
    await flush();
    expect(container.querySelector('[data-depth="glance"]')).toBeTruthy();
    click(tab('Study'));
    await flush();
    expect(container.querySelector('[data-depth="study"]')).toBeTruthy();
    expect(fs.calls).toEqual([['getDoc', TAPE_PATH]]);
  });

  it('the Deep dive opens → the series query, once; leaving and returning reads nothing more; never onSnapshot', async () => {
    fs.docs[TAPE_PATH] = sep23Tape;
    fs.docs[SERIES_PATH] = sep23Series;
    act(() => root.render(<FilmRoomScreenV2 battle={battle()} onBack={() => {}} viewerId="viewer-1" nowMs={Date.parse('2026-10-08T15:00:00.000Z')} />));
    await flush();
    click(tab('Deep dive'));
    await flush();
    expect(container.querySelector('[data-region="price-chart"]')).toBeTruthy();
    click(tab('Glance'));
    await flush();
    click(tab('Deep dive'));
    await flush();
    expect(fs.calls.map((c) => c[0])).toEqual(['getDoc', 'getDocs']);
    expect(fs.calls.filter((c) => c[0] === 'onSnapshot')).toEqual([]);
  });

  it('a multi-day battle: one getDoc per day selected, and returning to a day reads nothing again', async () => {
    const D2 = '2026-09-24';
    fs.docs[TAPE_PATH] = sep23Tape;
    act(() => root.render(<FilmRoomScreenV2 battle={battle({ timing: { tradingDays: [D, D2] } })} onBack={() => {}} viewerId="viewer-1" nowMs={Date.parse('2026-10-08T15:00:00.000Z')} />));
    await flush();
    expect(fs.calls).toEqual([['getDoc', `agentBattles/${BID}/tape/${D2}`]]);   // a completed battle opens on its last day
    const chips = [...container.querySelectorAll('[data-region="day-picker"] button')];
    click(chips[0]); await flush();
    click(chips[1]); await flush();
    click(chips[0]); await flush();
    expect(fs.calls).toEqual([['getDoc', `agentBattles/${BID}/tape/${D2}`], ['getDoc', TAPE_PATH]]);
  });
});
