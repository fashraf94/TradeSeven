// api/_utils/callRecords/amendmentG.test.js
//
// Cockpit Build 2b follow-up — CONTRACT AMENDMENT G (docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_G.md;
// the 2b report's CB2-1 and CB2-2), driven through the real calls block against the calls store fixture:
//   G-1 a directive-answered row whose command no longer stands gains ONE segment after its §2 fact:
//         `replaced by a later request at {HH:MM}` · `retired at {check}: {SYM} left the book` ·
//         `retired at {check}: {SYM} came into the book another way`
//       — read by id (`${thread}:superseded`, `${thread}:retired`), one batched get, inside the block's deadline
//   G-2 a named answer's row whose directive record is missing from the battle in hand re-reads the battle
//       document ONCE, after the calls read, inside the same deadline, and renders from the fresh document
// The existing callsBlock.test.js / entryAlreadyHeld.test.js / build2b.answers.test.js and the voice goldens are
// untouched: they are the byte-identity proof for every row with no event.
//
// The event fixtures are built by the real `buildCallEvent` (events.js), so a reader that looks in the wrong place
// for `symbol` / `reason` (top level) or `checkLabel` (under `evidence`) cannot pass on a hand-rolled shape.
//
// Dependency-surface guard (BUILD_RULES §4): the imports below are the call records modules themselves, never mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCallsFirestore } from '../__fixtures__/callsFirestore.js';
import { buildCallEvent, eventIdOf } from './events.js';
import {
  buildCallsBlock, buildCallsBlockForChat, renderCallsRow, endedSegmentOf, readEndingEvents, needsBattleReread,
  CALLS_BLOCK_HEADING, CALLS_BLOCK_CHAR_CAP, CALLS_BLOCK_TIMEOUT_MS,
} from './callsBlock.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const iso = (s) => Date.parse(s);
const NOW = iso('2026-10-30T18:30:00.000Z'); // 14:30 ET (EDT)
const CLOSE = iso('2026-10-30T20:00:00.000Z');
const B = 'battle-1';
const BATTLE_PATH = `agentBattles/${B}`;
const callPath = (id) => `${BATTLE_PATH}/calls/${id}`;
const eventPath = (id) => `${BATTLE_PATH}/callEvents/${id}`;
const EVALS = [{ evalId: 'eval_100', promptBuiltAt: '2026-10-30T17:00:00.000Z' }]; // the 13:00 ET check

const call = (n, over = {}) => ({
  callId: `${B}:eval_00${n}:call:${n}`, kind: 'called_shot', battleId: B, evalId: `eval_00${n}`, evalSeq: 1, mintedAt: NOW - 600_000 + n * 1_000,
  symbol: 'CCI', direction: 'exit', slot: 'support', counterpart: null, condition: { side: 'below', level: 89 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'x',
  state: 'open', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
const answered = (n, { answer = 'hold', thread = `thread-${n}`, heard = 'eval_100', over = {} } = {}) => call(n, {
  playerResponse: { answer, kind: 'directive', directiveThreadId: thread, callId: `${B}:eval_00${n}:call:${n}`, filedAt: '2026-10-30T16:45:00.000Z', heardEvalId: heard },
  directiveThreadId: thread, ...over,
});
const pickCall = (n, thread = `thread-${n}`) => answered(n, {
  answer: 'pick', thread,
  over: { kind: 'pick', symbol: null, direction: null, swapOut: 'KO', options: [{ symbol: 'AMD' }, { symbol: 'JPM' }], condition: null, defaultAction: null, horizon: { phrase: 'next_check', expiresAt: NOW + 900_000, basis: 'next_check' } },
});
/** The battle document in hand when the calls read raced ahead of the filing: no record of it, no checks. */
const STALE = { evaluations: [], chatExchanges: [] };
/** A thread exchange holding the directive record the row reads its chosen name from (threads.js selectedPickOf). */
const exchange = (thread, pickSymbol = null) => ({ directiveThreadId: thread, directive: { directiveThreadId: thread, family: 'call', action: { direction: 'exit', symbol: 'CCI', pickSymbol } } });

const supersededEvent = (thread, atIso, callId = 'c') => buildCallEvent({
  kind: 'superseded', at: iso(atIso), callIds: [callId], text: 'Superseded by a later filing', extra: { supersededBy: 'thread-new', supersededDirectiveThreadId: thread },
});
const retiredEvent = (callId, { atIso = '2026-10-30T17:15:30.000Z', symbol = 'CCI', reason = 'symbol_not_held', label = 'the 13:15 check' } = {}) => buildCallEvent({
  kind: 'retired', at: iso(atIso), callIds: [callId], text: 'x', evidence: { evalId: null, promptBuiltAt: null, checkLabel: label }, extra: { symbol, reason, trade: null },
});

/** A calls store: the calls, the battle document (the FRESH one the re-read sees) and the closing events by thread. */
function world({ calls = [], battle = null, superseded = {}, retired = {} } = {}) {
  const docs = {};
  for (const c of calls) docs[callPath(c.callId)] = c;
  if (battle) docs[BATTLE_PATH] = battle;
  for (const [thread, e] of Object.entries(superseded)) docs[eventPath(eventIdOf('superseded', { directiveThreadId: thread }))] = e;
  for (const [thread, e] of Object.entries(retired)) docs[eventPath(eventIdOf('retired', { directiveThreadId: thread }))] = e;
  return makeCallsFirestore({ docs });
}
const run = (db, battle, over = {}) => buildCallsBlockForChat(db, B, battle, { callsMode: 'on', nowMs: NOW, ...over });
const rowsOf = (block) => block.split('\n').slice(1);
const battleReads = (db) => db.__access.reads.filter((p) => p === BATTLE_PATH).length;
const eventReads = (db) => db.__access.reads.filter((p) => p.includes('/callEvents/'));
const BASE = { nowMs: NOW, evaluations: EVALS };
const evMap = (thread, ev) => new Map([[thread, { superseded: null, retired: null, ...ev }]]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
describe('G-1 — the three segment templates, frozen literals', () => {
  const REPLACE = answered(1, { answer: 'replace', thread: 'thread-cci' });
  const REPLACE_BATTLE = { chatExchanges: [exchange('thread-cci', 'DLTR')] };

  it("superseded: the amendment's own example row, byte for byte (FT_QA, 2026-10-30)", () => {
    const events = evMap('thread-cci', { superseded: supersededEvent('thread-cci', '2026-10-30T17:46:00.000Z') });
    expect(renderCallsRow(REPLACE, { ...BASE, battle: REPLACE_BATTLE, events })).toBe(
      "- battle-1:eval_001:call:1 · CCI below $89.00 by today's close · open · answered: Bring in DLTR · heard at the 13:00 check · replaced by a later request at 13:46",
    );
  });

  it('superseded: {HH:MM} is the ET wall clock in both EDT and EST — not UTC, not a fixed offset', () => {
    expect(endedSegmentOf({ superseded: supersededEvent('t', '2026-10-30T17:46:00.000Z') })).toBe('replaced by a later request at 13:46'); // EDT
    expect(endedSegmentOf({ superseded: supersededEvent('t', '2026-11-02T18:46:00.000Z') })).toBe('replaced by a later request at 13:46'); // EST, the Monday after the change
    expect(endedSegmentOf({ superseded: supersededEvent('t', '2026-10-30T04:05:00.000Z') })).toBe('replaced by a later request at 00:05'); // a 24-hour clock: 00:05, never 24:05
  });

  it.each([
    ['symbol_not_held', 'CCI'],
    ['counterpart_not_held', 'XOM'],
    ['swap_out_not_held', 'KO'],
  ])('retired, the stock left (%s): "retired at {check}: {SYM} left the book"', (reason, symbol) => {
    const ev = retiredEvent('c', { reason, symbol });
    expect(endedSegmentOf({ retired: ev })).toBe(`retired at the 13:15 check: ${symbol} left the book`);
  });

  it('retired, a chosen name came into the book another way (pick_already_held)', () => {
    const ev = retiredEvent('c', { reason: 'pick_already_held', symbol: 'DLTR', label: 'the 13:30 check' });
    expect(endedSegmentOf({ retired: ev })).toBe('retired at the 13:30 check: DLTR came into the book another way');
  });

  it('a retired row, end to end: the segment follows the §2 fact; {SYM} and {check} come from the stored event', () => {
    const exit = answered(2, { answer: 'go_now', thread: 'thread-x', over: { symbol: 'XOM' } });
    const events = evMap('thread-x', { retired: retiredEvent(exit.callId, { symbol: 'XOM', label: 'the 13:17 check' }) });
    expect(renderCallsRow(exit, { ...BASE, battle: { chatExchanges: [exchange('thread-x')] }, events })).toBe(
      "- battle-1:eval_002:call:2 · XOM below $89.00 by today's close · open · answered: Go now · heard at the 13:00 check · retired at the 13:17 check: XOM left the book",
    );
  });

  it('the symbol and reason are read from the stored event TOP LEVEL (buildCallEvent spreads `extra`), the label from `evidence`', () => {
    const ev = retiredEvent('c', { reason: 'swap_out_not_held', symbol: 'KO' });
    expect(ev.symbol).toBe('KO');
    expect(ev.reason).toBe('swap_out_not_held');
    expect(ev.evidence.checkLabel).toBe('the 13:15 check');
    expect(ev.extra).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe('G-1 — both events present, and an event that cannot fill its template', () => {
  const sup = (atIso) => supersededEvent('t', atIso);
  const ret = (atIso, over = {}) => retiredEvent('c', { atIso, ...over });

  it('both present → the earlier by `at` shows, whichever kind it is', () => {
    expect(endedSegmentOf({ superseded: sup('2026-10-30T17:10:00.000Z'), retired: ret('2026-10-30T17:15:30.000Z') })).toBe('replaced by a later request at 13:10');
    expect(endedSegmentOf({ superseded: sup('2026-10-30T17:20:00.000Z'), retired: ret('2026-10-30T17:15:30.000Z') })).toBe('retired at the 13:15 check: CCI left the book');
  });

  it('a tie goes to superseded', () => {
    expect(endedSegmentOf({ superseded: sup('2026-10-30T17:15:30.000Z'), retired: ret('2026-10-30T17:15:30.000Z') })).toBe('replaced by a later request at 13:15');
  });

  it('an unfillable event yields no segment, and never hides the other one; neither → null', () => {
    const goodRetired = ret('2026-10-30T17:15:30.000Z');
    // superseded without a usable `at` (buildCallEvent stores null for a bad timestamp; a string is not an instant)
    const noAt = { ...sup('2026-10-30T17:10:00.000Z'), at: null };
    expect(endedSegmentOf({ superseded: noAt })).toBeNull();
    expect(endedSegmentOf({ superseded: { ...noAt, at: '2026-10-30T17:10:00.000Z' } })).toBeNull();
    expect(endedSegmentOf({ superseded: noAt, retired: goodRetired })).toBe('retired at the 13:15 check: CCI left the book');
    // retired: an unknown reason, a prototype key, no reason, no symbol, no check label
    const bads = {
      'unknown reason': { reason: 'slot_changed' },
      'prototype key': { reason: 'toString' },
      'no reason': { reason: undefined },
      'null symbol': { symbol: null },
      'empty symbol': { symbol: '' },
      'no check label': { evidence: { ...goodRetired.evidence, checkLabel: null } },
    };
    for (const [label, patch] of Object.entries(bads)) expect(endedSegmentOf({ retired: { ...goodRetired, ...patch } }), label).toBeNull();
    expect(endedSegmentOf({ superseded: sup('2026-10-30T17:10:00.000Z'), retired: { ...goodRetired, reason: 'toString' } })).toBe('replaced by a later request at 13:10');
    expect(endedSegmentOf({})).toBeNull();
    expect(endedSegmentOf()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('G-1 — rows with neither event stay byte-identical', () => {
  const held = answered(3, { answer: 'hold', thread: 'thread-3' });
  const acted = answered(4, { answer: 'go_now', thread: 'thread-4', over: { state: 'hit', outcome: { actedEvalId: 'eval_100' } } });
  const ack = call(5, { playerResponse: { answer: 'go', kind: 'ack', callId: 'c', filedAt: 'f' } });
  const unanswered = call(6);
  const LITERAL = new Map([
    [held, "- battle-1:eval_003:call:3 · CCI below $89.00 by today's close · open · answered: Hold off · heard at the 13:00 check"],
    [acted, "- battle-1:eval_004:call:4 · CCI below $89.00 by today's close · hit · answered: Go now · acted at the 13:00 check"],
    [ack, "- battle-1:eval_005:call:5 · CCI below $89.00 by today's close · open · answered: Go"],
    [unanswered, "- battle-1:eval_006:call:6 · CCI below $89.00 by today's close · open"],
  ]);

  it('no `events`, an empty map, a thread with both slots null, and another thread\'s event all render the pre-amendment literal', () => {
    for (const [c, literal] of LITERAL) {
      const thread = c.playerResponse?.directiveThreadId ?? 'thread-none';
      const other = evMap('some-other-thread', { superseded: supersededEvent('some-other-thread', '2026-10-30T17:46:00.000Z') });
      for (const events of [undefined, null, new Map(), evMap(thread, {}), other]) {
        expect(renderCallsRow(c, { ...BASE, battle: { chatExchanges: [] }, events })).toBe(literal);
      }
    }
  });

  it('only a directive-answered row takes a segment: an ack / unanswered row is untouched even when a stray event sits under a thread id', () => {
    const stray = evMap('thread-5', { superseded: supersededEvent('thread-5', '2026-10-30T17:46:00.000Z') });
    expect(renderCallsRow({ ...ack, directiveThreadId: 'thread-5' }, { ...BASE, events: stray })).toBe(LITERAL.get(ack));
    expect(renderCallsRow({ ...unanswered, directiveThreadId: 'thread-5' }, { ...BASE, events: stray })).toBe(LITERAL.get(unanswered));
  });

  it('end to end, with no event documents in the store, the block is the pre-amendment block; the only addition is the one batched get', async () => {
    const battle = { evaluations: EVALS, chatExchanges: [exchange('thread-4')] };
    const db = world({ calls: [held, acted, ack, unanswered], battle });
    const getAll = vi.spyOn(db, 'getAll');
    const block = await run(db, battle);
    // open rows newest first (6, 5, 3), then the resolved row (4)
    expect(block).toBe([CALLS_BLOCK_HEADING, LITERAL.get(unanswered), LITERAL.get(ack), LITERAL.get(held), LITERAL.get(acted)].join('\n'));
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(battleReads(db)).toBe(0);
  });

  it('the segments are the ONLY difference: strip the three templates and the block equals the block without events', async () => {
    const calls = [answered(1, { thread: 'ta' }), answered(2, { thread: 'tb' }), answered(3, { thread: 'tc' }), call(4)];
    const plain = await run(world({ calls }), { evaluations: EVALS, chatExchanges: [] });
    const db = world({
      calls,
      superseded: { ta: supersededEvent('ta', '2026-10-30T17:46:00.000Z') },
      retired: { tb: retiredEvent(calls[1].callId), tc: retiredEvent(calls[2].callId, { reason: 'pick_already_held', symbol: 'DLTR' }) },
    });
    const withEvents = await run(db, { evaluations: EVALS, chatExchanges: [] });
    expect(withEvents).not.toBe(plain);
    const stripped = withEvents
      .replace(/ · replaced by a later request at \d\d:\d\d(?=\n|$)/g, '')
      .replace(/ · retired at the [\d:]+ check: [A-Z]+ (left the book|came into the book another way)(?=\n|$)/g, '');
    expect(stripped).toBe(plain);
    expect(withEvents.split('\n')[0]).toBe(plain.split('\n')[0]); // the heading is untouched
  });
});

// ---------------------------------------------------------------------------
describe('G-1 — the read: directive rows only, one batched get, deduped, open and history alike', () => {
  it('reads both ids per distinct thread in ONE getAll; renders open and history rows; reads nothing for ack / unanswered rows', async () => {
    const open = answered(1, { thread: 'ta' });
    const hist = answered(2, { thread: 'tb', over: { state: 'hit', mintedAt: NOW - 900_000 } });
    // the same thread again: one pair of refs, not two — and keyed by `playerResponse.directiveThreadId`, not the call's own top-level copy
    const twin = answered(3, { thread: 'ta', over: { directiveThreadId: null } });
    // an ack files no directive: even one that carries a thread id (it should not) is neither read nor rendered
    const ack = call(4, { playerResponse: { answer: 'go', kind: 'ack', directiveThreadId: 'tack', callId: 'c', filedAt: 'f' } });
    const db = world({
      calls: [open, hist, twin, ack, call(5)],
      superseded: { ta: supersededEvent('ta', '2026-10-30T17:46:00.000Z'), tack: supersededEvent('tack', '2026-10-30T17:46:00.000Z') },
      retired: { tb: retiredEvent(hist.callId, { symbol: 'KO', reason: 'swap_out_not_held' }) },
    });
    const getAll = vi.spyOn(db, 'getAll');
    const block = await run(db, { evaluations: EVALS, chatExchanges: [] });
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll.mock.calls[0].map((r) => r.path)).toEqual([
      eventPath('ta:superseded'), eventPath('ta:retired'), eventPath('tb:superseded'), eventPath('tb:retired'),
    ]);
    expect(eventReads(db)).toHaveLength(4);
    const rows = rowsOf(block);
    expect(rows.find((r) => r.includes('call:1 ·'))).toMatch(/ · replaced by a later request at 13:46$/);
    expect(rows.find((r) => r.includes('call:3 ·'))).toMatch(/ · replaced by a later request at 13:46$/);
    expect(rows.find((r) => r.includes('call:2 ·'))).toMatch(/ · hit · answered: Hold off · heard at the 13:00 check · retired at the 13:15 check: KO left the book$/);
    expect(rows.find((r) => r.includes('call:4 ·'))).not.toMatch(/replaced|retired/);
    expect(rows.find((r) => r.includes('call:5 ·'))).not.toMatch(/replaced|retired/);
  });

  it('no directive-answered call → no event read at all (not even an empty getAll)', async () => {
    const db = world({ calls: [call(1), call(2, { playerResponse: { answer: 'go', kind: 'ack', callId: 'c', filedAt: 'f' } })] });
    const getAll = vi.spyOn(db, 'getAll');
    expect(await run(db, { evaluations: EVALS })).toContain('battle-1:eval_001:call:1');
    expect(getAll).not.toHaveBeenCalled();
    expect(eventReads(db)).toEqual([]);
  });

  it('readEndingEvents: absent events are null; a short read throws', async () => {
    const db = world({ calls: [], superseded: { ta: supersededEvent('ta', '2026-10-30T17:46:00.000Z') } });
    const map = await readEndingEvents(db, B, ['ta', 'tb'], { deadlineMs: Date.now() + 1_000 });
    expect(map.get('ta').superseded.kind).toBe('superseded');
    expect(map.get('ta').retired).toBeNull();
    expect(map.get('tb')).toEqual({ superseded: null, retired: null });
    expect((await readEndingEvents(db, B, [], { deadlineMs: Date.now() + 1_000 })).size).toBe(0);
    vi.spyOn(db, 'getAll').mockResolvedValue([{ exists: false }]);
    await expect(readEndingEvents(db, B, ['ta'], { deadlineMs: Date.now() + 1_000 })).rejects.toThrow('calls_block_events_short_read');
  });
});

// ---------------------------------------------------------------------------
describe('G-1 — a failed or timed-out event read degrades the whole block to null', () => {
  const calls = () => [answered(1, { thread: 'ta' }), call(2)];

  it('a rejected batched get → null (and logged); the same store without the failure renders', async () => {
    const db = world({ calls: calls() });
    expect(await run(db, { evaluations: EVALS })).toContain('battle-1:eval_002:call:2');
    const failing = world({ calls: calls() });
    vi.spyOn(failing, 'getAll').mockRejectedValue(new Error('events unavailable'));
    expect(await run(failing, { evaluations: EVALS })).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[calls] chat calls block degraded to null:', 'events unavailable');
  });

  describe('timeouts (fake timers): the events read shares the ONE deadline', () => {
    beforeEach(() => { vi.useRealTimers(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });

    it('a hanging events read → null at the block deadline', async () => {
      const db = world({ calls: calls() });
      vi.spyOn(db, 'getAll').mockImplementation(() => new Promise(() => {}));
      let out; let done = false;
      run(db, { evaluations: EVALS }).then((v) => { out = v; done = true; });
      await vi.advanceTimersByTimeAsync(CALLS_BLOCK_TIMEOUT_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(done).toBe(true);
      expect(out).toBeNull();
    });

    it('the builder\'s own timeoutMs sets that deadline (the chat route passes none, so the 1,500 ms stands)', async () => {
      const db = world({ calls: calls() });
      vi.spyOn(db, 'getAll').mockImplementation(() => new Promise(() => {}));
      let out; let done = false;
      run(db, { evaluations: EVALS }, { timeoutMs: 100 }).then((v) => { out = v; done = true; });
      await vi.advanceTimersByTimeAsync(99);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(done).toBe(true);
      expect(out).toBeNull();
    });

    it('the calls read\'s time is spent from the same budget: 1,000 ms in the queries leaves 500 ms for the events, not a fresh 1,500', async () => {
      const db = world({ calls: calls() });
      db.__hooks.afterQuery = () => new Promise((r) => setTimeout(r, 1_000));
      vi.spyOn(db, 'getAll').mockImplementation(() => new Promise(() => {}));
      let out; let done = false;
      run(db, { evaluations: EVALS }).then((v) => { out = v; done = true; });
      await vi.advanceTimersByTimeAsync(1_000); // the queries finish
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(CALLS_BLOCK_TIMEOUT_MS - 1_000 - 1); // t = 1,499
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2); // t = 1,501
      expect(done).toBe(true);
      expect(out).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
describe('G-2 — a named answer\'s row always carries its name (CB2-2)', () => {
  const fresh = (thread, pick) => ({ evaluations: EVALS, chatExchanges: [exchange(thread, pick)] });

  it.each([
    ['replace', (n, t) => answered(n, { answer: 'replace', thread: t }), 'answered: Bring in DLTR'],
    ['go_now (named)', (n, t) => answered(n, { answer: 'go_now', thread: t }), 'answered: Go now, bring in DLTR'],
    ['pick', (n, t) => pickCall(n, t), 'answered: Pick DLTR'],
  ])('%s: a stale battle plus a successful re-read gives the name — and the fresh document\'s checks', async (_label, make, phrase) => {
    const c = make(1, 'thread-race');
    const db = world({ calls: [c], battle: fresh('thread-race', 'DLTR') });
    const block = await run(db, STALE);
    const row = rowsOf(block)[0];
    expect(row).toContain(` · ${phrase} · heard at the 13:00 check`); // the label comes from the FRESH evaluations (the stale ones were empty)
    expect(battleReads(db)).toBe(1);
  });

  it('the stale document alone shows the bug the amendment fixes: the bare "answered: Bring in" (what a skipped re-read would render)', () => {
    const c = answered(1, { answer: 'replace', thread: 'thread-race' });
    expect(renderCallsRow(c, { ...BASE, battle: STALE })).toBe("- battle-1:eval_001:call:1 · CCI below $89.00 by today's close · open · answered: Bring in · heard at the 13:00 check");
  });

  it('the re-read comes AFTER the calls read, once, even when several named answers are missing their records', async () => {
    const calls = [answered(1, { answer: 'replace', thread: 'ta' }), answered(2, { answer: 'go_now', thread: 'tb' }), answered(3, { answer: 'replace', thread: 'tc' })];
    const db = world({ calls, battle: { evaluations: EVALS, chatExchanges: [exchange('ta', 'AAA'), exchange('tb', 'BBB'), exchange('tc', 'CCC')] } });
    const block = await run(db, STALE);
    expect(block).toContain('answered: Bring in AAA');
    expect(block).toContain('answered: Go now, bring in BBB');
    expect(block).toContain('answered: Bring in CCC');
    expect(battleReads(db)).toBe(1);
    const reads = db.__access.reads;
    const lastCall = Math.max(...reads.map((p, i) => (p.includes('/calls/') ? i : -1)));
    expect(reads.indexOf(BATTLE_PATH)).toBeGreaterThan(lastCall);
  });

  it('no re-read when none is needed (count the reads)', async () => {
    const withRecord = answered(1, { answer: 'replace', thread: 'ta' });
    const plainGoNow = answered(2, { answer: 'go_now', thread: 'tb' }); // a record, no chosen name: reads bare, no re-read
    const hold = answered(3, { answer: 'hold', thread: 'tc' }); // not a named answer: no record needed
    const ack = call(4, { playerResponse: { answer: 'go', kind: 'ack', callId: 'c', filedAt: 'f' } });
    const db = world({ calls: [withRecord, plainGoNow, hold, ack, call(5)], battle: STALE });
    const battle = { evaluations: EVALS, chatExchanges: [exchange('ta', 'AAA'), exchange('tb', null)] };
    const block = await run(db, battle);
    expect(battleReads(db)).toBe(0);
    expect(block).toContain('answered: Bring in AAA');
    expect(rowsOf(block).find((r) => r.includes('call:2 ·'))).toContain('answered: Go now · heard');
    // a record living in the parent's slot (not an exchange) counts too
    const slotDb = world({ calls: [withRecord], battle: STALE });
    expect(await run(slotDb, { evaluations: EVALS, directive: exchange('ta', 'ZZZ').directive })).toContain('answered: Bring in ZZZ');
    expect(battleReads(slotDb)).toBe(0);
  });

  it('needsBattleReread: record absence on a named answer is the only trigger', () => {
    const named = answered(1, { answer: 'replace', thread: 'ta' });
    expect(needsBattleReread([named], STALE)).toBe(true);
    expect(needsBattleReread([named], null)).toBe(true);
    expect(needsBattleReread([named], { chatExchanges: [exchange('ta', null)] })).toBe(false);
    expect(needsBattleReread([named], { chatExchanges: [exchange('other', 'X')] })).toBe(true);
    for (const answer of ['hold', 'go', 'agree', 'disagree']) expect(needsBattleReread([answered(2, { answer, thread: 'tz' })], null), answer).toBe(false);
    expect(needsBattleReread([call(3)], null)).toBe(false);
    expect(needsBattleReread([], null)).toBe(false);
  });

  it('a failed re-read → null', async () => {
    const c = answered(1, { answer: 'replace', thread: 'thread-race' });
    const db = world({ calls: [c], battle: fresh('thread-race', 'DLTR') });
    const realCollection = db.collection;
    db.collection = (name) => {
      const coll = realCollection(name);
      return name !== 'agentBattles' ? coll : { ...coll, doc: (id) => ({ ...coll.doc(id), get: async () => { throw new Error('battle unreadable'); } }) };
    };
    expect(await run(db, STALE)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[calls] chat calls block degraded to null:', 'battle unreadable');
  });

  it('a re-read that SUCCEEDS and still has no record renders the bare word, once — only a failed re-read degrades (the letter of G-2; founder reading 6)', async () => {
    const c = answered(1, { answer: 'replace', thread: 'thread-race' });
    const db = world({ calls: [c], battle: { evaluations: EVALS, chatExchanges: [] } });
    const block = await run(db, STALE);
    expect(rowsOf(block)[0]).toBe("- battle-1:eval_001:call:1 · CCI below $89.00 by today's close · open · answered: Bring in · heard at the 13:00 check");
    expect(battleReads(db)).toBe(1); // asked once, not again
  });

  it('a re-read that finds no battle document → null (never a bare "answered: Bring in")', async () => {
    const c = answered(1, { answer: 'replace', thread: 'thread-race' });
    expect(await run(world({ calls: [c] }), STALE)).toBeNull();
  });

  describe('timeouts (fake timers): the re-read shares the ONE deadline', () => {
    beforeEach(() => { vi.useRealTimers(); vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });

    it('a hanging re-read → null at the block deadline, not later', async () => {
      const c = answered(1, { answer: 'replace', thread: 'thread-race' });
      const db = world({ calls: [c], battle: fresh('thread-race', 'DLTR') });
      const realCollection = db.collection;
      db.collection = (name) => {
        const coll = realCollection(name);
        return name !== 'agentBattles' ? coll : { ...coll, doc: (id) => ({ ...coll.doc(id), get: () => new Promise(() => {}) }) };
      };
      db.__hooks.afterQuery = () => new Promise((r) => setTimeout(r, 1_000));
      let out; let done = false;
      run(db, STALE).then((v) => { out = v; done = true; });
      await vi.advanceTimersByTimeAsync(CALLS_BLOCK_TIMEOUT_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(done).toBe(true);
      expect(out).toBeNull();
    });
  });

  it('G-1 and G-2 together: one batched get for the events, one battle re-read', async () => {
    const c = answered(1, { answer: 'replace', thread: 'thread-cci' });
    const db = world({ calls: [c], battle: fresh('thread-cci', 'DLTR'), superseded: { 'thread-cci': supersededEvent('thread-cci', '2026-10-30T17:46:00.000Z') } });
    const getAll = vi.spyOn(db, 'getAll');
    const block = await run(db, STALE);
    expect(rowsOf(block)[0]).toBe("- battle-1:eval_001:call:1 · CCI below $89.00 by today's close · open · answered: Bring in DLTR · heard at the 13:00 check · replaced by a later request at 13:46");
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(battleReads(db)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("at 'off' and 'shadow' nothing is read", () => {
  it.each(['off', 'shadow', null, undefined])('callsMode %s: no query, no document read, no batched get — null', async (callsMode) => {
    const c = answered(1, { answer: 'replace', thread: 'thread-cci' });
    const db = world({ calls: [c], battle: { chatExchanges: [exchange('thread-cci', 'DLTR')] }, superseded: { 'thread-cci': supersededEvent('thread-cci', '2026-10-30T17:46:00.000Z') } });
    const getAll = vi.spyOn(db, 'getAll');
    expect(await buildCallsBlockForChat(db, B, STALE, { callsMode, nowMs: NOW })).toBeNull();
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
    expect(getAll).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('what stays as it is: the heading, the cap, the whole-row truncation, the chat route', () => {
  it('pins: the heading, the 1,200-character cap and the 1,500 ms deadline', () => {
    expect(CALLS_BLOCK_HEADING).toBe("CALLS ON THE RECORD (the trading process's called shots: open first, then the five newest resolved — an answer is a request filed to the process, never a trade it has made)");
    expect(CALLS_BLOCK_CHAR_CAP).toBe(1_200);
    expect(CALLS_BLOCK_TIMEOUT_MS).toBe(1_500);
  });

  it('a longer row can push an older history row into "… n more"; rows stay whole; the cap holds', () => {
    const LONG = `battle-${'x'.repeat(60)}`;
    const mk = (n, over = {}) => answered(n, { thread: `t${n}`, over: { callId: `${LONG}:eval_009:call:${n}`, ...over } });
    const open = [mk(1), mk(2), mk(3)];
    const history = [mk(4, { state: 'hit' }), mk(5, { state: 'hit' }), mk(6, { state: 'hit' }), mk(7, { state: 'hit' }), mk(8, { state: 'hit' })];
    const events = new Map([...open, ...history].map((c) => [c.playerResponse.directiveThreadId, { superseded: supersededEvent(c.playerResponse.directiveThreadId, '2026-10-30T17:46:00.000Z'), retired: null }]));
    const without = buildCallsBlock({ open, history }, BASE);
    const withSegments = buildCallsBlock({ open, history }, { ...BASE, events });
    const shown = (b) => b.split('\n').filter((l) => l.startsWith('- ')).length;
    expect(withSegments.length).toBeLessThanOrEqual(CALLS_BLOCK_CHAR_CAP);
    expect(shown(withSegments)).toBeLessThan(shown(without)); // non-vacuous: the segments really cost a row
    const lines = withSegments.split('\n');
    expect(lines[lines.length - 1]).toBe(`… ${8 - shown(withSegments)} more`);
    for (const l of lines.slice(1, -1)) expect(l).toMatch(/ · replaced by a later request at 13:46$/); // every shown row is whole, segment included
  });

  it('the chat route is untouched: api/agent/chat.js still makes the one call it always made', () => {
    const src = readFileSync(resolve(HERE, '../../agent/chat.js'), 'utf8');
    expect(src).toContain('? buildCallsBlockForChat(db, battleId, battle, { callsMode })');
  });
});
