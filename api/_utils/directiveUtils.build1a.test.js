// api/_utils/directiveUtils.build1a.test.js
//
// Cockpit Build 1a — THE CALL DIRECTIVE FAMILY'S ACTIVENESS and the endpoint's
// pending predicate (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §6, §15.5), and the
// filing builders' shapes (directiveFiling.js): ordinary slots byte-identical,
// call slots carrying the family fields with the one thread key.
//
// Dependency-surface guard (BUILD_RULES §4): the imports of ./directiveUtils.js
// (which imports the fenced assembler's day helper, read-only) and
// ./directiveFiling.js are never mocked.

import { describe, it, expect } from 'vitest';
import {
  isDirectiveActive, isDirectiveActiveOnDay, isCallDirective, isCallDirectiveActiveAt, isCallDirectivePendingAt, CALL_DIRECTIVE_FAMILY,
} from './directiveUtils.js';
import { buildDirectiveRecord, buildDirectiveSlot } from './directiveFiling.js';
import { attachCheckContext } from './callRecords/mode.js';
import { buildCallDirectivePlan } from './callRecords/callActions.js';
import { makeTickBattle, makeDirective, OLD_THREAD } from './__fixtures__/tickStampsHarness.js';

const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z');
const CLOSE = T('2026-09-09T20:00:00.000Z');
const CALL_ID = 'battle-tick-1:eval_001:call:0';
const THREAD = 'thread-call-0001';

const callSlot = (over = {}) => ({
  text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: THREAD, createdAt: '2026-09-09T14:20:00.000Z',
  family: 'call', expiresAtMs: CLOSE, basis: 'this_session', callId: CALL_ID, kind: 'call_hold',
  action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' }, answerId: `${CALL_ID}:answer:hold:`,
  filedAt: '2026-09-09T14:20:00.000Z', textVersion: 'callActions.v1', ...over,
});

describe('isDirectiveActive — the call-family branch (spec §6; Amendment B §10)', () => {
  it('ACTIVE only with the in-memory check context: mode on AND a finite instant at or before the lifetime end', () => {
    const battle = makeTickBattle({ directive: callSlot() });
    expect(isDirectiveActive(battle.directive, battle)).toBe(false); // no context (voice, any reader without it) → closed
    attachCheckContext(battle, { mode: 'on', nowMs: CLOSE - 1 });
    expect(isDirectiveActive(battle.directive, battle)).toBe(true);
    attachCheckContext(battle, { mode: 'on', nowMs: CLOSE });
    expect(isDirectiveActive(battle.directive, battle)).toBe(true); // the exact lifetime end is inside it
    attachCheckContext(battle, { mode: 'on', nowMs: CLOSE + 1 });
    expect(isDirectiveActive(battle.directive, battle)).toBe(false);
  });

  it('INACTIVE at every mode but on, at a non-finite instant, and for a malformed slot', () => {
    for (const mode of ['off', 'shadow', null, undefined, 'ON']) {
      const battle = makeTickBattle({ directive: callSlot() });
      attachCheckContext(battle, { mode, nowMs: NOW });
      expect(isDirectiveActive(battle.directive, battle), String(mode)).toBe(false);
    }
    for (const bad of [NaN, Infinity, null, undefined, '1']) {
      const battle = makeTickBattle({ directive: callSlot() });
      attachCheckContext(battle, { mode: 'on', nowMs: bad });
      expect(isDirectiveActive(battle.directive, battle), String(bad)).toBe(false);
    }
    const battle = makeTickBattle({ directive: callSlot({ expiresAtMs: null }) });
    attachCheckContext(battle, { mode: 'on', nowMs: NOW });
    expect(isDirectiveActive(battle.directive, battle)).toBe(false);
    expect(isDirectiveActive(callSlot({ text: '' }), battle)).toBe(false);
    expect(isDirectiveActive(callSlot({ directiveThreadId: null }), battle)).toBe(false);
  });

  it('the pure day rule NEVER activates a call-family directive (a caller without the context fails closed)', () => {
    expect(isDirectiveActiveOnDay(callSlot(), ['2026-09-09'], 1)).toBe(false);
    expect(isCallDirectiveActiveAt(callSlot(), { mode: 'on', instantMs: NOW })).toBe(true);
    expect(isCallDirectiveActiveAt(callSlot(), { mode: 'on', instantMs: null })).toBe(false);
    expect(isCallDirectiveActiveAt(callSlot(), null)).toBe(false);
    expect(isCallDirectiveActiveAt(makeDirective(), { mode: 'on', instantMs: NOW })).toBe(false); // not call-family
  });

  it('ORDINARY directives are unchanged — end_of_battle, permanent, 3_games, and the unknown-expiry fallback (true), with or without a context', () => {
    const battle = makeTickBattle();
    expect(isDirectiveActive(makeDirective(), battle)).toBe(true);
    expect(isDirectiveActive(makeDirective({ expiry: 'permanent' }), battle)).toBe(true);
    expect(isDirectiveActive(makeDirective({ expiry: 'until_ms', expiresAtMs: 1 }), battle)).toBe(true); // unknown expiry, NO family marker → the defensive fallback, as before
    expect(isDirectiveActive(makeDirective({ expiry: 'whatever' }), battle)).toBe(true);
    expect(isDirectiveActive(null, battle)).toBe(false);
    expect(isDirectiveActive({ text: 'x' }, battle)).toBe(false);
    attachCheckContext(battle, { mode: 'on', nowMs: NOW });
    expect(isDirectiveActive(makeDirective(), battle)).toBe(true);
    expect(isDirectiveActiveOnDay(makeDirective({ expiry: '3_games', createdAt: '2026-09-09T14:20:00.000Z' }), ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14'], 4)).toBe(false);
    expect(isDirectiveActiveOnDay(makeDirective({ expiry: '3_games', createdAt: '2026-09-09T14:20:00.000Z' }), ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14'], 3)).toBe(true);
  });

  it('isCallDirective keys on the stored family marker alone', () => {
    expect(CALL_DIRECTIVE_FAMILY).toBe('call');
    expect(isCallDirective(callSlot())).toBe(true);
    expect(isCallDirective({ ...callSlot(), family: 'chip' })).toBe(false);
    expect(isCallDirective(makeDirective())).toBe(false);
    expect(isCallDirective(null)).toBe(false);
  });
});

describe('isCallDirectivePendingAt — the endpoint predicate, separate from check activeness (spec §6; Amendment B §3)', () => {
  const base = () => ({ directive: callSlot(), mode: 'on', nowMs: NOW, killedIds: [], thisCallId: 'battle-tick-1:eval_001:call:9' });

  it('pending: a live call-family slot of a DIFFERENT call at mode on, within its lifetime, not killed', () => {
    expect(isCallDirectivePendingAt(base())).toBe(true);
    expect(isCallDirectivePendingAt({ ...base(), nowMs: CLOSE })).toBe(true);
  });

  it('not pending: the same call (an identical repeat never blocks itself); past the lifetime; killed; mode not on; an ordinary slot; a malformed slot', () => {
    expect(isCallDirectivePendingAt({ ...base(), thisCallId: CALL_ID })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), nowMs: CLOSE + 1 })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), killedIds: [THREAD] })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), killedIds: new Set([THREAD]) })).toBe(false);
    for (const mode of ['off', 'shadow', null]) expect(isCallDirectivePendingAt({ ...base(), mode }), String(mode)).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), directive: makeDirective() })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), directive: null })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), directive: callSlot({ expiresAtMs: 'soon' }) })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), nowMs: NaN })).toBe(false);
    expect(isCallDirectivePendingAt({ ...base(), directive: callSlot({ text: '' }) })).toBe(false);
  });

  it('never consults the cron-only in-memory fields', () => {
    const battle = makeTickBattle({ directive: callSlot() });
    attachCheckContext(battle, { mode: 'off', nowMs: NaN });
    expect(isCallDirectivePendingAt({ directive: battle.directive, mode: 'on', nowMs: NOW, thisCallId: 'other' })).toBe(true);
  });
});

describe('directiveFiling — the builders keep every existing field; call filings add the family fields; the only thread key is directiveThreadId', () => {
  const ordinary = { text: 'Require stronger confirmation before entering', expiry: 'end_of_battle', adjustmentId: 'TF-02', canonicalTextVersion: 1 };
  const legacy = { text: 'Narrow to the strongest sector', expiry: 'end_of_battle' };

  it('an ORDINARY record and slot are byte-identical to the pre-build shapes (with and without the Release 2 id/version)', () => {
    expect(JSON.stringify(buildDirectiveRecord(ordinary, OLD_THREAD))).toBe(JSON.stringify({
      text: ordinary.text, expiry: 'end_of_battle', directiveThreadId: OLD_THREAD, adjustmentId: 'TF-02', canonicalTextVersion: 1,
    }));
    expect(JSON.stringify(buildDirectiveSlot(ordinary, OLD_THREAD, '2026-09-09T14:20:00.000Z'))).toBe(JSON.stringify({
      text: ordinary.text, expiry: 'end_of_battle', directiveThreadId: OLD_THREAD, createdAt: '2026-09-09T14:20:00.000Z', adjustmentId: 'TF-02', canonicalTextVersion: 1,
    }));
    expect(JSON.stringify(buildDirectiveRecord(legacy, OLD_THREAD))).toBe(JSON.stringify({ text: legacy.text, expiry: 'end_of_battle', directiveThreadId: OLD_THREAD }));
    expect(JSON.stringify(buildDirectiveSlot(legacy, OLD_THREAD, 'c'))).toBe(JSON.stringify({ text: legacy.text, expiry: 'end_of_battle', directiveThreadId: OLD_THREAD, createdAt: 'c' }));
    expect(buildDirectiveSlot(ordinary, OLD_THREAD, 'c')).not.toHaveProperty('family');
    expect(buildDirectiveSlot(ordinary, OLD_THREAD, 'c')).not.toHaveProperty('callId');
  });

  it('a CALL filing carries the family fields on both shapes, keeps the existing ones, and names the thread by directiveThreadId only', () => {
    const call = {
      callId: CALL_ID, kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO',
      condition: { side: 'above', level: 161 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act',
    };
    const plan = buildCallDirectivePlan({ call, answer: 'hold', nowMs: NOW, filedAt: '2026-09-09T14:20:00.000Z' });
    const slot = buildDirectiveSlot(plan.normalized, THREAD, '2026-09-09T14:20:00.000Z');
    expect(slot).toEqual(callSlot());
    expect(Object.keys(slot)).toEqual(['text', 'expiry', 'directiveThreadId', 'createdAt', 'family', 'expiresAtMs', 'basis', 'callId', 'kind', 'action', 'answerId', 'filedAt', 'textVersion']);
    const record = buildDirectiveRecord(plan.normalized, THREAD);
    expect(record).not.toHaveProperty('createdAt');
    expect(record.directiveThreadId).toBe(THREAD);
    expect(record).not.toHaveProperty('threadId');
    expect(slot).not.toHaveProperty('threadId');
    expect(slot).not.toHaveProperty('adjustmentId');
    // The slot is what isDirectiveActive judges: live at on with a context, closed without.
    const battle = makeTickBattle({ directive: slot });
    expect(isDirectiveActive(slot, battle)).toBe(false);
    attachCheckContext(battle, { mode: 'on', nowMs: NOW });
    expect(isDirectiveActive(slot, battle)).toBe(true);
  });
});
