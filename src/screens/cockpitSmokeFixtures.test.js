// src/screens/cockpitSmokeFixtures.test.js — SMOKE BRANCH ONLY (never merged).
// Every ?cockpitFixtures variant builds, and shows what the smoke checklist says it shows.

import { describe, it, expect } from 'vitest';
import { createCockpitSmoke } from './cockpitSmokeFixtures';
import { buildCockpitFeed } from './battleView/cockpitModel';
import { buildCockpit2bView } from './battleView/cockpit2bModel';

const NOW = Date.parse('2026-10-22T17:20:00.000Z');
const BATTLE = { id: 'b', portfolio: { star: [{ symbol: 'NVDA' }], core: [{ symbol: 'VLO' }], support: [{ symbol: 'KO' }, { symbol: 'BTC.CC', isCrypto: true }] }, watchlist: {} };
const viewOf = (variant) => {
  const store = createCockpitSmoke({ battleId: 'b', battle: BATTLE, evaluations: [], nowMs: NOW, variant });
  const s = store.get();
  const battle = { ...BATTLE, directive: s.directive, chatExchanges: s.chatExchanges, portfolio: { ...BATTLE.portfolio, bench: s.bench }, watchlist: { hotBench: s.hotBench } };
  const feed = buildCockpitFeed({ calls: s.calls, events: s.events, evaluations: [], directive: s.directive, nowMs: NOW, exchanges: s.chatExchanges, v2: true });
  return { store, s, view: buildCockpit2bView({ feed, calls: s.calls, events: s.events, rawExchanges: s.chatExchanges, battle, agent: 'Shadow', nowMs: NOW }) };
};

describe('the smoke variants', () => {
  it('1: the Who comes in case leads, with the step on the card; four receipt filings leave the meter at 3; fresh: 7', () => {
    const { view } = viewOf('1');
    expect(view.now.symbol).toBe('NVDA');
    expect(view.now.step.state).toBe('on_card');
    expect(view.meter.left).toBe(3);
    expect(viewOf('fresh').view.meter.left).toBe(7);
    expect(view.earlier.count).toBeGreaterThanOrEqual(5);
    expect(view.strip.count).toBeGreaterThanOrEqual(6);
  });
  it('p2 / p3 / p4 / quiet: each Now-card priority, and the quiet line', () => {
    expect(viewOf('p2').view.now.symbol).toBe('AMD');
    const p3 = viewOf('p3').view;
    expect(p3.now.eyebrow).toBe('Hold call');
    expect(p3.now.step.state).toBe('after_exit_instead');
    const p4 = viewOf('p4').view;
    expect(p4.now.mode).toBe('command');
    expect(p4.meter.left).toBe(2);
    expect(p4.now.followTag?.text ?? null).toBe('Following your call');
    expect(viewOf('quiet').view.now).toBeNull();
  });
  it('meter1 / meter0', () => {
    expect(viewOf('meter1').view.meter.left).toBe(1);
    expect(viewOf('meter0').view.meter.zero).toBe(true);
  });
  it('filed: the command card with the filed step', () => {
    const { view } = viewOf('filed');
    expect(view.now.mode).toBe('command');
    expect(view.now.step.filedLine).toBe('✓ XOM comes in if NVDA exits · filed');
  });
  it('chat: an override is refused 409 replace_unconfirmed until confirmed; then it files and the meter counts it', async () => {
    const { store } = viewOf('chat');
    const amd = store.get().calls.find((c) => c.symbol === 'AMD');
    const first = await store.post({ callId: amd.callId, answer: 'hold' });
    expect(first).toMatchObject({ status: 409, body: { reason: 'replace_unconfirmed', currentCallId: null } });
    const second = await store.post({ callId: amd.callId, answer: 'hold', confirmReplace: true });
    expect(second.status).toBe(200);
    expect(store.get().chatExchanges.filter((e) => e.source === 'cockpit' && e.hasDirective).length).toBe(5);
    expect(store.get().directive.callId).toBe(amd.callId);
  });
  it('the bench rows: available, locked, not_swappable, no_price (scoped) and browse', async () => {
    const { store } = viewOf('1');
    const p1 = store.get().calls.find((c) => c.symbol === 'NVDA' && c.direction === 'exit');
    const scoped = await store.requestBench({ callId: p1.callId });
    expect(scoped.data.rows.map((r) => r.status).sort()).toEqual(['available', 'available', 'locked', 'no_price', 'not_swappable']);
    const browse = await store.requestBench({});
    expect(browse.data.rows.some((r) => r.status === 'not_swappable')).toBe(false);
  });
});
