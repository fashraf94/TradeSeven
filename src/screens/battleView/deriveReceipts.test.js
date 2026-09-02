// src/screens/battleView/deriveReceipts.test.js
//
// Phase A (A3) — receipts are proven or absent (D-51): Filed on the filing
// exchange, Replaced when a later exchange filed a different thread id (time =
// the replacing exchange), Expired on battle complete only (D-61), nothing for
// an exchange with no directive. `expiry` is an enum and is never read as a
// time (hazard 20).

import { describe, it, expect } from 'vitest';
import { deriveReceipts, RECEIPT_STATE } from './deriveReceipts';

const T1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
const T2 = '2026-09-01T16:58:00.000Z'; // 12:58 PM ET
const T3 = '2026-09-01T17:20:00.000Z';

const filed = (threadId, timestamp, text = 'Protect the lead into the close') => ({
  userMessage: text,
  agentResponse: 'Got it.',
  hasDirective: true,
  directive: { text, expiry: 'end_of_battle', directiveThreadId: threadId },
  directiveThreadId: threadId,
  timestamp,
});
const plain = (timestamp) => ({
  userMessage: 'How is the book?', agentResponse: 'Flat.', hasDirective: false,
  directive: null, directiveThreadId: null, timestamp,
});

describe('Filed', () => {
  it('the filing exchange proves it — state filed, at = the exchange timestamp', () => {
    const r = deriveReceipts([plain('2026-09-01T15:00:00.000Z'), filed('t-1', T1)], { directiveThreadId: 't-1', text: 'x', expiry: 'end_of_battle' }, 'active');
    expect(r).toEqual({ 't-1': { state: RECEIPT_STATE.FILED, at: T1 } });
  });

  it('an exchange with no directive gets nothing', () => {
    const r = deriveReceipts([plain(T1), plain(T2)], null, 'active');
    expect(r).toEqual({});
    expect(deriveReceipts([], null, 'active')).toEqual({});
    expect(deriveReceipts(undefined, null, 'active')).toEqual({});
  });

  it('reads the thread id from the exchange (sibling) or its directive record', () => {
    const onlyNested = { ...filed('t-9', T1), directiveThreadId: undefined };
    expect(deriveReceipts([onlyNested], null, 'active')['t-9']).toEqual({ state: 'filed', at: T1 });
  });
});

describe('Replaced', () => {
  it('a later exchange filing a DIFFERENT thread id replaces the earlier one — at = the replacing filing', () => {
    const r = deriveReceipts([filed('t-1', T1), filed('t-2', T2)], { directiveThreadId: 't-2' }, 'active');
    expect(r['t-1']).toEqual({ state: RECEIPT_STATE.REPLACED, at: T2 });
    expect(r['t-2']).toEqual({ state: RECEIPT_STATE.FILED, at: T2 });
  });

  it('three filings: the first two are replaced, each by the next; the last is filed', () => {
    const r = deriveReceipts([filed('t-1', T1), plain('2026-09-01T16:00:00.000Z'), filed('t-2', T2), filed('t-3', T3)], { directiveThreadId: 't-3' }, 'active');
    expect(r['t-1']).toEqual({ state: 'replaced', at: T2 });
    expect(r['t-2']).toEqual({ state: 'replaced', at: T3 });
    expect(r['t-3']).toEqual({ state: 'filed', at: T3 });
  });

  it('with the slot absent, the newest filing is still the current one', () => {
    const r = deriveReceipts([filed('t-1', T1), filed('t-2', T2)], null, 'active');
    expect(r['t-1'].state).toBe('replaced');
    expect(r['t-2'].state).toBe('filed');
  });

  it('a duplicate of the same thread id does not move the filed time or replace anything', () => {
    const r = deriveReceipts([filed('t-1', T1), filed('t-1', T2)], { directiveThreadId: 't-1' }, 'active');
    expect(r).toEqual({ 't-1': { state: 'filed', at: T1 } });
  });

  it('the copy never claims the replaced directive was unseen — the derivation carries text and time only', () => {
    const r = deriveReceipts([filed('t-1', T1), filed('t-2', T2)], { directiveThreadId: 't-2' }, 'active');
    expect(Object.keys(r['t-1'])).toEqual(['state', 'at']);
  });
});

describe('Expired — battle complete only (D-61)', () => {
  it('every directive, current included, is expired once status === completed', () => {
    const r = deriveReceipts([filed('t-1', T1), filed('t-2', T2)], { directiveThreadId: 't-2' }, 'completed');
    expect(r['t-1']).toEqual({ state: RECEIPT_STATE.EXPIRED, at: null });
    expect(r['t-2']).toEqual({ state: RECEIPT_STATE.EXPIRED, at: null });
  });

  it('`expiry` is an enum, never a time: a 3_games directive is filed, not expired, while the battle is active', () => {
    const three = filed('t-5', T1);
    three.directive.expiry = '3_games';
    const r = deriveReceipts([three], { directiveThreadId: 't-5', expiry: '3_games', createdAt: '2026-08-20T13:31:00.000Z' }, 'active');
    expect(r['t-5'].state).toBe('filed');
  });

  it('an active battle never expires a directive, whatever its expiry value', () => {
    for (const expiry of ['end_of_battle', 'permanent', '3_games', undefined]) {
      const ex = filed('t-6', T1);
      ex.directive.expiry = expiry;
      expect(deriveReceipts([ex], { directiveThreadId: 't-6', expiry }, 'active')['t-6'].state).toBe('filed');
    }
  });
});

describe('timestamps', () => {
  it('normalises Firestore-Timestamp-shaped exchange stamps to ISO', () => {
    const ex = filed('t-7', { seconds: Math.floor(new Date(T1).getTime() / 1000) });
    expect(deriveReceipts([ex], null, 'active')['t-7'].at).toBe(T1);
  });

  it('a missing timestamp yields at: null rather than an invented time', () => {
    const ex = filed('t-8', undefined);
    expect(deriveReceipts([ex], null, 'active')['t-8']).toEqual({ state: 'filed', at: null });
  });
});
