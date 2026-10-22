// api/_utils/callRecords/build2b.receipts.test.js
//
// Cockpit Build 2b — receipts for a chosen name (D-5) and the one expiry
// label (D-8). Contract Amendment D; spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md
// S-6, S-8, §11 "D-5", "D-8":
//   D-5  acted only for OUT→IN; OUT→another name is a LOUD no-match and
//        retires; another leg traded is a no-match and does not retire; v1
//        (no name) is unchanged; the flip's actedEvalId binding.
//   D-8  the four rows: active / not active × deadline before / after the end.

import { describe, it, expect } from 'vitest';
import { planFlip, matchesWholeTrade, selectedPickFor } from './flip.js';
import { planHeard } from './heard.js';
import { renderNoMatchingTradeEvent, renderRetiredEvent, RETIRED_REASONS, RETIRED_REASON_TEXT } from './copy.js';
import { decideTerminalParentExpiry, decideSweepExpiry, battleEndMs, callDeadlineMs, nextCheckCutoff } from './sweep.js';

const T = (iso) => Date.parse(iso);
const NOW = T('2026-10-15T17:45:00.000Z');
const THREAD = 'thread-d5';
const PROMPT = '2026-10-15T17:45:00.000Z';

const exitCall = (over = {}) => ({
  callId: 'b:eval_004:call:0', kind: 'confirmation', symbol: 'AMD', direction: 'exit', slot: 'core', counterpart: null,
  condition: { side: 'below', level: 610 }, horizon: { basis: 'this_session', expiresAt: T('2026-10-15T20:00:00.000Z') },
  defaultAction: 'act', state: 'open', evalId: 'eval_004', mintedAt: T('2026-10-15T15:00:00.000Z'), outcome: null,
  playerResponse: { answer: 'replace', kind: 'directive', directiveThreadId: THREAD, filedAt: '2026-10-15T15:30:00.000Z', heardEvalId: null, after: { answer: 'go', filedAt: '2026-10-15T15:29:00.000Z' } },
  ...over,
});
/** The parent: the thread's directive record names IN (the slot), or none (a v1 directive). */
const parentNaming = (pickSymbol) => ({
  directive: { directiveThreadId: THREAD, family: 'call', answerId: 'a-1', action: { direction: 'exit', symbol: 'AMD', slot: 'core', ...(pickSymbol ? { pickSymbol } : {}) } },
  chatExchanges: [],
});
const result = (symbolOut, symbolIn, tier = 'core') => ({ symbolOut, symbolIn, tier, slotIndex: 0 });

describe('D-5 — the flip: the chosen name binds the exit match', () => {
  it('selectedPickFor: the directive record\'s pickSymbol for an exit call; null for a v1 exit directive, an entry, an acknowledgment', () => {
    expect(selectedPickFor(exitCall(), parentNaming('DHR'))).toBe('DHR');
    expect(selectedPickFor(exitCall(), parentNaming(null))).toBeNull();
    expect(selectedPickFor(exitCall({ direction: 'entry' }), parentNaming('DHR'))).toBeNull();
    expect(selectedPickFor(exitCall({ playerResponse: { answer: 'go', kind: 'ack' } }), parentNaming('DHR'))).toBeNull();
  });

  it('matchesWholeTrade: with IN bound only OUT→IN matches; without one, v1\'s rule (any IN when the counterpart is null)', () => {
    expect(matchesWholeTrade(exitCall(), result('AMD', 'DHR'), { selectedSymbol: 'DHR' })).toBe(true);
    expect(matchesWholeTrade(exitCall(), result('AMD', 'CEG'), { selectedSymbol: 'DHR' })).toBe(false);
    expect(matchesWholeTrade(exitCall(), result('KO', 'DHR'), { selectedSymbol: 'DHR' })).toBe(false);
    expect(matchesWholeTrade(exitCall(), result('AMD', 'CEG'))).toBe(true);
    expect(matchesWholeTrade(exitCall({ counterpart: 'JPM' }), result('AMD', 'JPM'))).toBe(true);
    expect(matchesWholeTrade(exitCall({ counterpart: 'JPM' }), result('AMD', 'CEG'))).toBe(false);
  });

  it('planFlip stamps actedEvalId only for OUT→IN (the model row); OUT→other leaves the call un-acted (it may still be hit)', () => {
    const observation = { observedAtMs: NOW, symbols: { AMD: { px: 600 } } };
    const yes = planFlip(exitCall(), { observation, evalId: 'eval_009', executorResult: result('AMD', 'DHR'), selectedSymbol: 'DHR' });
    expect(yes).toEqual({ next: 'hit', acted: true });
    const no = planFlip(exitCall(), { observation, evalId: 'eval_009', executorResult: result('AMD', 'CEG'), selectedSymbol: 'DHR' });
    expect(no).toEqual({ next: 'hit', acted: false });
  });
});

describe('D-5 — the heard pass: a chosen name follows the pick\'s rules', () => {
  const heard = (call, parent, executorResult) => planHeard(call, parent, { thread: THREAD, evalId: 'eval_009', promptBuiltAt: PROMPT, executorResult, flippedIds: new Set() });

  it('OUT→IN: acted, and the directive is retired (an act-default exit included — the v1 rule would keep it)', () => {
    const p = heard(exitCall(), parentNaming('DHR'), result('AMD', 'DHR'));
    expect(p).toMatchObject({ acted: true, noMatch: false, retire: true, pick: 'DHR' });
  });

  it('OUT→another name: a LOUD no-match ("— not the selected DHR"), and retired (OUT is gone)', () => {
    const p = heard(exitCall(), parentNaming('DHR'), result('AMD', 'CEG'));
    expect(p).toMatchObject({ acted: false, noMatch: true, legTraded: true, retire: true });
    expect(renderNoMatchingTradeEvent({ promptBuiltAt: PROMPT, executorResult: result('AMD', 'CEG'), selectedSymbol: p.pick }))
      .toBe('The agent exited AMD for CEG at the 13:45 check — not the selected DHR');
  });

  it('another leg traded: a no-match (the request IS the name — the shot\'s silent case does not apply), and not retired', () => {
    const p = heard(exitCall(), parentNaming('DHR'), result('KO', 'JPM', 'support'));
    expect(p).toMatchObject({ acted: false, noMatch: true, legTraded: false, retire: false });
    expect(renderNoMatchingTradeEvent({ promptBuiltAt: PROMPT, executorResult: null, selectedSymbol: 'DHR' })).toBe('No matching trade recorded at the 13:45 check');
  });

  it('v1, NO name on the record: byte-identical rules — OUT→anything is acted (counterpart null); OUT traded by an act-default exit is not retired; another leg is a no-match', () => {
    const v1Call = exitCall({ playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: THREAD, filedAt: '2026-10-15T15:30:00.000Z', heardEvalId: null } });
    expect(heard(v1Call, parentNaming(null), result('AMD', 'CEG'))).toMatchObject({ acted: true, noMatch: false, retire: false, pick: null });
    expect(heard(v1Call, parentNaming(null), result('KO', 'JPM', 'support'))).toMatchObject({ acted: false, noMatch: true, retire: false });
    const v1Hold = exitCall({ defaultAction: 'hold', playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: THREAD, filedAt: '2026-10-15T15:30:00.000Z', heardEvalId: null } });
    expect(heard(v1Hold, parentNaming(null), result('AMD', 'CEG'))).toMatchObject({ acted: true, retire: true });
  });
});

describe('the retired event\'s words (D-6)', () => {
  it('one line per book reason; an unknown reason or no symbol says nothing', () => {
    expect(RETIRED_REASONS).toEqual(['symbol_not_held', 'counterpart_not_held', 'swap_out_not_held', 'pick_already_held']);
    for (const r of RETIRED_REASONS) expect(RETIRED_REASON_TEXT[r]).toBeTruthy();
    expect(renderRetiredEvent({ symbol: 'VLO', reason: 'symbol_not_held', promptBuiltAt: '2026-10-06T17:17:00.000Z' })).toBe('VLO left the book at the 13:17 check · command retired.');
    expect(renderRetiredEvent({ symbol: 'DHR', reason: 'pick_already_held', promptBuiltAt: '2026-10-06T17:17:00.000Z' })).toBe('DHR came into the book another way at the 13:17 check · command retired.');
    expect(renderRetiredEvent({ symbol: 'VLO', reason: 'symbol_not_held' })).toBe('VLO left the book · command retired.');
    expect(renderRetiredEvent({ symbol: 'VLO', reason: 'pick_locked' })).toBeNull();
    expect(renderRetiredEvent({ reason: 'symbol_not_held' })).toBeNull();
  });
});

describe('D-8 — one expiry label: the four rows', () => {
  const SESSION_CLOSE = T('2026-10-15T20:00:00.000Z');
  const call = (expiresAt, basis = 'this_session') => ({ state: 'open', horizon: { basis, expiresAt } });

  it('active parent × deadline before / after: the active path as today (past the deadline → expired, else nothing)', () => {
    expect(decideSweepExpiry(call(SESSION_CLOSE), SESSION_CLOSE + 60_000)).toEqual({ next: 'expired_unresolved', reason: 'past_deadline' });
    expect(decideSweepExpiry(call(SESSION_CLOSE), SESSION_CLOSE - 60_000)).toEqual({ next: null, reason: 'before_deadline' });
  });

  it('NOT active × the deadline at or before the battle\'s end → expired_unresolved with the active path\'s reason', () => {
    const ended = { status: 'completed', completedAt: new Date(SESSION_CLOSE + 4 * 3_600_000).toISOString() };
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), ended, SESSION_CLOSE + 5 * 3_600_000)).toEqual({ next: 'expired_unresolved', reason: 'past_deadline' });
    // At the end exactly: at or before → expired.
    const atEnd = { status: 'completed', completedAt: new Date(SESSION_CLOSE).toISOString() };
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), atEnd, SESSION_CLOSE + 1)).toEqual({ next: 'expired_unresolved', reason: 'past_deadline' });
    // next_check: the deadline is its H2 cutoff (the session close), the reason the active path's 'unobserved'.
    const slot = T('2026-10-15T17:15:00.000Z');
    expect(callDeadlineMs(call(slot, 'next_check'))).toBe(nextCheckCutoff(slot).closeMs);
    expect(decideTerminalParentExpiry(call(slot, 'next_check'), ended, SESSION_CLOSE + 5 * 3_600_000)).toEqual({ next: 'expired_unresolved', reason: 'unobserved' });
  });

  it('NOT active × the deadline after the battle\'s end → ended_with_battle, as today', () => {
    const early = { status: 'completed', completedAt: new Date(SESSION_CLOSE - 3_600_000).toISOString() };
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), early, SESSION_CLOSE + 60_000)).toEqual({ next: 'ended_with_battle', reason: 'battle_ended' });
    const slot = T('2026-10-15T17:15:00.000Z');
    expect(decideTerminalParentExpiry(call(slot, 'next_check'), early, SESSION_CLOSE + 60_000)).toEqual({ next: 'ended_with_battle', reason: 'battle_ended' });
  });

  it('the end: completedAt (ISO, ms, Date or a Timestamp), else the scheduled expiresAt; never later than the maintenance instant; unreadable → ended_with_battle', () => {
    const ms = SESSION_CLOSE + 4 * 3_600_000;
    expect(battleEndMs({ completedAt: new Date(ms).toISOString() })).toBe(ms);
    expect(battleEndMs({ completedAt: ms })).toBe(ms);
    expect(battleEndMs({ completedAt: new Date(ms) })).toBe(ms);
    expect(battleEndMs({ completedAt: { toMillis: () => ms } })).toBe(ms);
    expect(battleEndMs({ expiresAt: new Date(ms).toISOString() })).toBe(ms);
    // No completion instant and a scheduled end still ahead: the deadline cannot have "passed" before now.
    const voided = { status: 'voided', expiresAt: new Date(SESSION_CLOSE + 86_400_000).toISOString() };
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), voided, SESSION_CLOSE - 60_000)).toEqual({ next: 'ended_with_battle', reason: 'battle_ended' });
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), voided, SESSION_CLOSE + 60_000)).toEqual({ next: 'expired_unresolved', reason: 'past_deadline' });
    expect(decideTerminalParentExpiry(call(SESSION_CLOSE), { status: 'completed' }, SESSION_CLOSE + 60_000)).toEqual({ next: 'ended_with_battle', reason: 'battle_ended' });
    expect(decideTerminalParentExpiry({ horizon: {} }, { status: 'completed', completedAt: ms }, ms)).toEqual({ next: 'ended_with_battle', reason: 'battle_ended' });
  });
});
