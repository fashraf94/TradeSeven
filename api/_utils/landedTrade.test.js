// api/_utils/landedTrade.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part D — the read-back after an executor
// throw (founder decision Q3). Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// Review K4-3: the end-to-end rows (agent-evaluate.retrySafe.test.js) prove each
// caller's records; these pin the call identity itself — each key the match
// rests on, one at a time — because a false "landed" is the dangerous
// direction: it would suppress a real refusal or failure record, keep a
// reservation and run a success path for a trade that never happened.
//
// Pure module: imported for real.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  executorCallOf, isRowOfCall, readLandedTrade, swapResultAfterThrow, executionOutcomeOf, executionOutcomeUnknown,
  landedAfterErrorOf, landedAfterErrorFields, EXECUTION_OUTCOME_UNKNOWN, EXECUTION_NOT_LANDED, EXECUTION_LANDED_AFTER_ERROR,
} from './landedTrade.js';

const START = '2026-09-09T15:00:00.000Z';
const AT = '2026-09-09T15:00:00.250Z'; // the executor's attempt instant: after the call began

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(START));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const call = () => executorCallOf({ evaluationId: 'eval_007', tier: 'support', slotIndex: 0, symbolIn: 'AMD' });
const row = (over = {}) => ({ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, evaluationId: 'eval_007', swappedOutAt: AT, lockedPoints: 1.5, ...over });
const incoming = (over = {}) => ({ symbol: 'AMD', swapPrice: 160, swappedInAt: AT, baseATR: 3.4, ...over });
const refOf = (data) => ({ get: async () => ({ exists: data !== undefined, data: () => data }) });

describe('executorCallOf — the call\'s identity, taken just before the call', () => {
  it('the four keys and the start instant; absent keys are null (never undefined)', () => {
    expect(call()).toEqual({ evaluationId: 'eval_007', tier: 'support', slotIndex: 0, symbolIn: 'AMD', startedAtMs: Date.parse(START) });
    expect(executorCallOf({})).toEqual({ evaluationId: null, tier: null, slotIndex: null, symbolIn: null, startedAtMs: Date.parse(START) });
    expect(Object.isFrozen(call())).toBe(true);
  });
});

describe('isRowOfCall — every key must match; each differing key alone is a different trade', () => {
  it('the matching row', () => {
    expect(isRowOfCall(row(), call())).toBe(true);
    expect(isRowOfCall(row({ swappedOutAt: START }), call())).toBe(true); // the same instant counts (one clock)
  });

  for (const [key, value] of [
    ['evaluationId', 'eval_008'], ['evaluationId', null], ['tier', 'core'], ['slotIndex', 1], ['slotIndex', '0'],
    ['symbolIn', 'JPM'], ['symbolIn', null], ['swappedOutAt', '2026-09-09T14:59:59.999Z'], ['swappedOutAt', 'not a date'], ['swappedOutAt', 1757430000250],
  ]) {
    it(`${key} = ${JSON.stringify(value)} → not this call's row`, () => {
      expect(isRowOfCall(row({ [key]: value }), call())).toBe(false);
    });
  }

  it('the outgoing symbol does not decide: at off / shadow the executor swaps whatever occupies the slot', () => {
    expect(isRowOfCall(row({ symbolOut: 'XOM' }), call())).toBe(true);
  });

  it('a null evaluationId matches only a call made with none (the dormant proposal paths)', () => {
    const nullCall = executorCallOf({ evaluationId: null, tier: 'support', slotIndex: 0, symbolIn: 'AMD' });
    expect(isRowOfCall(row({ evaluationId: null }), nullCall)).toBe(true);
    expect(isRowOfCall(row({ evaluationId: undefined }), nullCall)).toBe(true);
    expect(isRowOfCall(row(), nullCall)).toBe(false);
  });

  it('not a row → false', () => {
    for (const v of [null, undefined, 'x', 7]) expect(isRowOfCall(v, call())).toBe(false);
  });
});

describe('readLandedTrade — the fresh read', () => {
  it('landed: the row, and the incoming position the executor wrote into the slot (the executor\'s own return)', async () => {
    const out = await readLandedTrade(refOf({ trades: [row({ evaluationId: 'other' }), row()], portfolio: { support: [incoming()] } }), call());
    expect(out).toEqual({ outcome: 'landed', closedTrade: row(), incomingAsset: incoming() });
  });

  it('landed, but the slot no longer holds that position (same symbol, a later entry; or another stock) → incomingAsset null', async () => {
    for (const occupant of [incoming({ swappedInAt: '2026-09-09T15:05:00.000Z' }), incoming({ symbol: 'XOM' }), null]) {
      const out = await readLandedTrade(refOf({ trades: [row()], portfolio: { support: [occupant] } }), call());
      expect(out.outcome).toBe('landed');
      expect(out.incomingAsset).toBeNull();
    }
  });

  it('not landed: no row of this call (none, another call\'s, or trades not a list)', async () => {
    for (const trades of [[], [row({ evaluationId: 'eval_006' })], 'x', undefined]) {
      expect(await readLandedTrade(refOf({ trades, portfolio: {} }), call())).toEqual({ outcome: EXECUTION_NOT_LANDED });
    }
  });

  it('unknown: the read throws, or returns no document', async () => {
    expect(await readLandedTrade({ get: async () => { throw new Error('14 UNAVAILABLE'); } }, call())).toEqual({ outcome: EXECUTION_OUTCOME_UNKNOWN });
    expect(await readLandedTrade(refOf(undefined), call())).toEqual({ outcome: EXECUTION_OUTCOME_UNKNOWN });
    expect(await readLandedTrade({ get: async () => null }, call())).toEqual({ outcome: EXECUTION_OUTCOME_UNKNOWN });
  });
});

describe('swapResultAfterThrow — the catch around the executor call', () => {
  it('landed → the executor\'s result, exact; no marker', async () => {
    const result = await swapResultAfterThrow(refOf({ trades: [row()], portfolio: { support: [incoming()] } }), call(), new Error('Invalid swap: AMD cannot replace itself'));
    expect(result).toEqual({ closedTrade: row(), incomingAsset: incoming() });
    expect(landedAfterErrorOf(result)).toBeNull();
    expect(landedAfterErrorFields(result)).toEqual({});
  });

  it('landed without its incoming position → incomingAsset null, marked confirmed_after_error', async () => {
    const result = await swapResultAfterThrow(refOf({ trades: [row()], portfolio: { support: [null] } }), call(), new Error('boom'));
    expect(result.incomingAsset).toBeNull();
    expect(landedAfterErrorOf(result)).toBe(EXECUTION_LANDED_AFTER_ERROR);
    expect(landedAfterErrorFields(result)).toEqual({ executionLanded: 'confirmed_after_error' });
  });

  it('not landed → the SAME error rethrown (typed fields intact), tagged not_landed', async () => {
    const err = Object.assign(new Error('Swap refused'), { reason: 'outgoing_identity_mismatch', verification: { verdict: 'mismatch' } });
    const thrown = await swapResultAfterThrow(refOf({ trades: [], portfolio: {} }), call(), err).catch((e) => e);
    expect(thrown).toBe(err);
    expect(thrown.reason).toBe('outgoing_identity_mismatch');
    expect(executionOutcomeOf(thrown)).toBe(EXECUTION_NOT_LANDED);
    expect(executionOutcomeUnknown(thrown)).toBe(false);
  });

  it('read fails → the same error rethrown, tagged unknown', async () => {
    const err = new Error('boom');
    const thrown = await swapResultAfterThrow({ get: async () => { throw new Error('read failed'); } }, call(), err).catch((e) => e);
    expect(thrown).toBe(err);
    expect(executionOutcomeUnknown(thrown)).toBe(true);
  });

  it('a non-Error throw is wrapped (and tagged); an untagged error has no outcome', async () => {
    const thrown = await swapResultAfterThrow(refOf({ trades: [] }), call(), 'a string').catch((e) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe('a string');
    expect(executionOutcomeOf(thrown)).toBe(EXECUTION_NOT_LANDED);
    expect(executionOutcomeOf(new Error('other'))).toBeNull();
    expect(executionOutcomeOf(null)).toBeNull();
    expect(landedAfterErrorOf({ closedTrade: row(), incomingAsset: incoming() })).toBeNull(); // the executor's own return
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity follow-up 2, review K5 (the mutation lens): rows that kill mutants
// the rows above let survive (report §12.3; the M5-n ids are its mutant table).
describe('K5 — the read-back looks at THIS call\'s slot (M5-202)', () => {
  it('slotIndex 1: the incoming position is read from support[1], never support[0]', async () => {
    const call = executorCallOf({ evaluationId: 'eval_007', tier: 'support', slotIndex: 1, symbolIn: 'AMD' });
    const row = { symbolOut: 'PG', symbolIn: 'AMD', tier: 'support', slotIndex: 1, evaluationId: 'eval_007', swappedOutAt: AT };
    const incoming = { symbol: 'AMD', swapPrice: 160, swappedInAt: AT };
    const ref = { get: async () => ({ exists: true, data: () => ({ trades: [row], portfolio: { support: [{ symbol: 'KO', swappedInAt: null }, incoming] } }) }) };
    expect(await readLandedTrade(ref, call)).toEqual({ outcome: 'landed', closedTrade: row, incomingAsset: incoming });
  });
});
