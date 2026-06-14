// src/utils/tournamentActionMachine.test.js
//
// P7 (B) — the optimistic mutation lifecycle. The load-bearing invariant:
// `confirmed` (success) is reachable ONLY via an explicit `confirm` out of
// `pending` — the UI can never claim success the server didn't grant — and
// `reject` rolls the optimistic value back.

import { describe, it, expect } from 'vitest';
import {
  actionReducer,
  initialActionState,
  isActionPending,
  ACTION_STATUS,
} from './tournamentActionMachine';

describe('tournamentActionMachine', () => {
  it('starts idle', () => {
    expect(initialActionState()).toEqual({ status: 'idle', optimistic: null, result: null, error: null });
  });

  it('submit → pending, carrying the optimistic value', () => {
    const s = actionReducer(initialActionState(), { type: 'submit', optimistic: { symbol: 'NVDA', to: 'short' } });
    expect(s.status).toBe(ACTION_STATUS.PENDING);
    expect(s.optimistic).toEqual({ symbol: 'NVDA', to: 'short' });
    expect(isActionPending(s)).toBe(true);
  });

  it('confirm out of pending → confirmed with the result', () => {
    let s = actionReducer(initialActionState(), { type: 'submit', optimistic: { x: 1 } });
    s = actionReducer(s, { type: 'confirm', result: { marketState: 'open' } });
    expect(s.status).toBe(ACTION_STATUS.CONFIRMED);
    expect(s.result).toEqual({ marketState: 'open' });
  });

  it('NEVER reaches confirmed without a confirm event (no success-before-confirm)', () => {
    // A stray confirm from idle is a no-op — success cannot be fabricated.
    const s = actionReducer(initialActionState(), { type: 'confirm', result: { faked: true } });
    expect(s.status).toBe(ACTION_STATUS.IDLE);
    expect(s.result).toBeNull();
  });

  it('reject → error and ROLLS BACK the optimistic value', () => {
    let s = actionReducer(initialActionState(), { type: 'submit', optimistic: { symbol: 'NVDA', to: 'short' } });
    s = actionReducer(s, { type: 'reject', error: 'Flip limit reached' });
    expect(s.status).toBe(ACTION_STATUS.ERROR);
    expect(s.optimistic).toBeNull();        // rolled back
    expect(s.error).toBe('Flip limit reached');
  });

  it('reset returns to idle', () => {
    let s = actionReducer(initialActionState(), { type: 'submit' });
    s = actionReducer(s, { type: 'reset' });
    expect(s).toEqual(initialActionState());
  });

  it('unknown event is a no-op', () => {
    const s0 = initialActionState();
    expect(actionReducer(s0, { type: 'noop' })).toBe(s0);
  });
});
