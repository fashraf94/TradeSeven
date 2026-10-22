// scripts/cockpit-2b-read.test.js
//
// Cockpit Build 2b — the 2b read's tallies (spec S-13), on record fixtures:
// the commands D-1 counts, by kind and by the route a record can prove; the
// chosen names by source; acted / no-match on named calls; `retired` by
// reason; D-10's Following (declared-event bound); the options fill; the
// facts the records do not hold printed as unknown; an unknown event kind
// still tallied. The module is imported with no credential and no network.

import { describe, it, expect } from 'vitest';
import {
  commandsOf, routeOf, chosenSourceOf, tallyKinds, retiredByReason, followingOf, optionsFill, battleDayRead, renderTables, etDay, toMs, UNKNOWN,
} from './cockpit-2b-read.mjs';

const T = (iso) => Date.parse(iso);
const DAY = '2026-10-22';
const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return T(`${DAY}T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };

const call = (over = {}) => ({
  callId: 'b:e1:call:0', mintedAt: at('10:00') + 40_000, mintedMode: 'on', kind: 'confirmation',
  symbol: 'VLO', direction: 'exit', slot: 'core', defaultAction: 'act', condition: { side: 'below', level: 158.4 },
  replacementOptions: [{ symbol: 'MPC', source: 'agent' }, { symbol: 'XOM', source: 'bench' }],
  playerResponse: null, ...over,
});
const filing = (over = {}) => ({
  source: 'cockpit', hasDirective: true, directiveThreadId: 'th1', callId: 'b:e1:call:0', timestamp: new Date(at('10:05')).toISOString(),
  directive: { kind: 'call_replace', action: { direction: 'exit', symbol: 'VLO', pickSymbol: 'XOM' }, textVersion: 'callActions.v2' }, ...over,
});

describe('the tallies', () => {
  it('commandsOf: only cockpit filings that carry a directive — chat, chip and acks never count', () => {
    const out = commandsOf([filing(), { source: 'chat', hasDirective: true }, { source: 'cockpit', hasDirective: false }, null]);
    expect(out).toEqual([{ thread: 'th1', callId: 'b:e1:call:0', kind: 'call_replace', pickSymbol: 'XOM', textVersion: 'callActions.v2', atMs: at('10:05') }]);
    expect(commandsOf(undefined)).toEqual([]);
  });

  it('routeOf: what the record can prove — never card vs sheet', () => {
    const named = commandsOf([filing()])[0];
    expect(routeOf(named, call({ playerResponse: { answer: 'replace', kind: 'directive' } }))).toBe('step or sheet pick');
    expect(routeOf(named, call({ playerResponse: { answer: 'go_now', kind: 'directive' } }))).toBe('Exit instead · named');
    const plain = commandsOf([filing({ directive: { kind: 'call_go', action: { symbol: 'ZS' } } })])[0];
    expect(routeOf(plain, call({ symbol: 'ZS', defaultAction: 'hold', playerResponse: { answer: 'go_now', kind: 'directive' } }))).toBe('Exit instead · let the agent choose');
    expect(routeOf(plain, call({ playerResponse: { answer: 'hold', kind: 'directive' } }))).toBe('button');
    expect(routeOf(plain, null)).toBe('unknown');
  });

  it('chosenSourceOf: the stored option\'s source, else sheet-only', () => {
    expect(chosenSourceOf(call(), 'MPC')).toBe('agent');
    expect(chosenSourceOf(call(), 'XOM')).toBe('bench');
    expect(chosenSourceOf(call(), 'CVX')).toBe('sheet-only');
    expect(chosenSourceOf(call({ replacementOptions: null }), 'CVX')).toBe('sheet-only');
    expect(chosenSourceOf(call(), null)).toBeNull();
  });

  it('retired by reason, and every event kind tallied — an unknown kind included', () => {
    const events = [{ kind: 'retired', reason: 'symbol_not_held' }, { kind: 'retired', reason: 'pick_already_held' }, { kind: 'retired' }, { kind: 'brand_new_kind' }];
    expect(retiredByReason(events)).toEqual({ symbol_not_held: 1, pick_already_held: 1, '(no reason)': 1 });
    expect(tallyKinds(events)).toEqual({ retired: 3, brand_new_kind: 1 });
  });

  it('followingOf (D-10 rev 2): same plan, within 1 %, minted after the filing, its declared event naming the thread', () => {
    const answered = call();
    const cmd = commandsOf([filing()])[0];
    const later = call({ callId: 'b:e2:call:0', mintedAt: at('10:15') + 40_000, condition: { side: 'below', level: 159.5 } });
    const far = call({ callId: 'b:e2:call:1', mintedAt: at('10:15') + 40_000, condition: { side: 'below', level: 150 } });
    const other = call({ callId: 'b:e3:call:0', mintedAt: at('10:30') + 40_000 });
    const before = call({ callId: 'b:e0:call:0', mintedAt: at('09:45') + 40_000 });
    const events = [
      { kind: 'declared', callIds: [later.callId, far.callId], promptDirectiveThreadId: 'th1' },
      { kind: 'declared', callIds: [other.callId], promptDirectiveThreadId: 'th-other' },
      { kind: 'declared', callIds: [before.callId], promptDirectiveThreadId: 'th1' },
    ];
    expect(followingOf(cmd, [answered, later, far, other, before], events).map((c) => c.callId)).toEqual([later.callId]);
    // No declared event → no restatement.
    expect(followingOf(cmd, [answered, later], [])).toEqual([]);
  });

  it('optionsFill: with options, non-empty, null and absent apart; the agent and bench fill', () => {
    const { replacementOptions: _drop, ...noField } = call({ callId: 'x3' });
    const fill = optionsFill([call(), call({ callId: 'x1', replacementOptions: [] }), call({ callId: 'x2', replacementOptions: null }), noField]);
    expect(fill).toEqual({ minted: 4, withOptions: 2, nonEmpty: 1, nullOptions: 1, absent: 1, agentFill: { 0: 1, 1: 1 }, benchFill: { 0: 1, 1: 1 } });
  });
});

describe('battleDayRead — one battle-day', () => {
  const answered = call({ playerResponse: { answer: 'replace', kind: 'directive', directiveThreadId: 'th1' } });
  const battle = {
    chatExchanges: [
      filing(),
      filing({ directiveThreadId: 'th2', callId: 'b:e1:call:9', timestamp: new Date(at('11:00')).toISOString(), directive: { kind: 'call_hold', action: { symbol: 'ZS' } } }),
      { source: 'chat', hasDirective: true, directiveThreadId: 'th-chat', timestamp: new Date(at('11:30')).toISOString() },
      filing({ directiveThreadId: 'th-yesterday', timestamp: '2026-10-21T15:00:00.000Z' }),
    ],
  };
  const events = [
    { kind: 'acted', at: at('10:30'), callIds: [answered.callId] },
    { kind: 'retired', at: at('12:00'), reason: 'symbol_not_held', callIds: ['b:e1:call:9'] },
    { kind: 'superseded', at: at('11:00'), supersededBy: 'th2', callIds: [answered.callId] },
    { kind: 'superseded', at: at('11:30'), supersededBy: 'th-chat', callIds: ['b:e1:call:9'] },
    { kind: 'heard', at: '2026-10-21T15:30:00.000Z', callIds: ['x'] },
  ];
  const read = battleDayRead({ battle, calls: [answered, call({ callId: 'b:e1:call:9', symbol: 'ZS', mintedAt: at('10:45') + 40_000, replacementOptions: null })], events, day: DAY });

  it('the commands of THIS day, by kind and route; chosen by source; acted on the named call', () => {
    expect(read.commands).toBe(2);
    expect(read.byKind).toEqual({ call_replace: 1, call_hold: 1 });
    expect(read.chosen).toEqual({ agent: 0, bench: 1, 'sheet-only': 0 });
    expect(read.actedOnNamed).toBe(1);
    expect(read.noMatchOnNamed).toBe(0);
  });
  it('replacements that landed: the superseded events a COCKPIT filing wrote (a chat one does not count)', () => {
    expect(read.replacedLanded).toBe(1);
  });
  it('the facts the records do not hold read unknown — never zero', () => {
    for (const k of ['surface', 'confirmationsShown', 'replaceUnconfirmed', 'counterpartUnavailable']) expect(read[k]).toBe(UNKNOWN);
  });
  it('retired by reason; event kinds of THIS day only; the options of this day\'s minted calls', () => {
    expect(read.retired).toEqual({ symbol_not_held: 1 });
    expect(read.eventKinds).toEqual({ acted: 1, retired: 1, superseded: 2 });
    expect(read.options).toMatchObject({ minted: 2, withOptions: 1, nullOptions: 1 });
  });
  it('renderTables names accounts by label and battles by a short id — no uid field exists to print', () => {
    const md = renderTables([{ acct: 'founder', battleId: 'abcdefghijkl', read }]);
    expect(md).toContain('| founder | `abcdefgh` | 2026-10-22 | 2 |');
    expect(md).toContain(UNKNOWN);
  });
});

describe('the clock helpers', () => {
  it('etDay in America/New_York; toMs over the shapes Firestore and the raw dump use', () => {
    expect(etDay(T('2026-10-22T03:30:00.000Z'))).toBe('2026-10-21');
    expect(etDay(T('2026-10-22T14:00:00.000Z'))).toBe('2026-10-22');
    expect(toMs({ toMillis: () => 5 })).toBe(5);
    expect(toMs({ __ts: 7 })).toBe(7);
    expect(toMs({ _seconds: 1, _nanoseconds: 500_000_000 })).toBe(1500);
    expect(toMs('nope')).toBeNull();
  });
});
