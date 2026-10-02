// api/_utils/directiveWriter.test.js
//
// Cockpit Build 1a — THE SHARED SLOT WRITER and compare-and-clear retirement
// (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §6, §15.5; contract Amendment B §3).
// The route-level proofs (chat's latest-wins without belief, the chip with
// belief, both byte-identical to their frozen rows) are in chat.test.js and
// file-directive.test.js; this file drives the writer and the retirement
// helpers directly.
//
// Dependency-surface guard (BUILD_RULES §4): the import of ./directiveWriter.js
// is never mocked.

import { describe, it, expect } from 'vitest';
import { supersedesStamp, planRetirement, retireCallDirective, fileDirectiveTransactional } from './directiveWriter.js';
import { makeDirective, OLD_THREAD, NEWER_THREAD } from './__fixtures__/tickStampsHarness.js';

const T = (iso) => Date.parse(iso);
const CALL_ID = 'battle-1:eval_001:call:0';
const callSlot = (over = {}) => ({
  text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: 'thread-call-0001', createdAt: '2026-09-09T14:20:00.000Z',
  family: 'call', expiresAtMs: T('2026-09-09T20:00:00.000Z'), basis: 'this_session', callId: CALL_ID, kind: 'call_hold',
  action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' }, answerId: `${CALL_ID}:answer:hold:`,
  filedAt: '2026-09-09T14:20:00.000Z', textVersion: 'callActions.v1', ...over,
});
const arrayUnion = (...items) => ({ __op: 'arrayUnion', items });
const exchangeOf = (threadId, timestamp = '2026-09-09T14:21:00.000Z') => ({
  userMessage: null, agentResponse: '', hasDirective: true, directive: { text: 'x', expiry: 'end_of_battle', directiveThreadId: threadId },
  directiveThreadId: threadId, timestamp, mode: 'battle', messageType: 'directive_filed', source: 'chip',
});

/** A transaction / batch / ref double that records what the writer buffers. */
function makeDoubles() {
  const ops = [];
  const tx = {
    update: (ref, data) => ops.push({ op: 'update', path: ref.path, data }),
    create: (ref, data) => ops.push({ op: 'create', path: ref.path, data }),
  };
  const battleRef = { path: 'agentBattles/battle-1', update: async (data) => { ops.push({ op: 'plainUpdate', path: 'agentBattles/battle-1', data }); } };
  let batches = 0;
  const db = {
    collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}`, collection: (sub) => ({ doc: (sid) => ({ path: `${c}/${id}/${sub}/${sid}` }) }) }) }),
    batch: () => {
      batches += 1;
      const buffered = [];
      return {
        update: (ref, data) => buffered.push({ op: 'batchUpdate', path: ref.path, data }),
        create: (ref, data) => buffered.push({ op: 'batchCreate', path: ref.path, data }),
        commit: async () => { ops.push(...buffered); ops.push({ op: 'batchCommit' }); },
      };
    },
  };
  return { ops, tx, battleRef, db, batches: () => batches };
}

describe('supersedesStamp — only when the replaced slot is call-family and names a different thread', () => {
  it('stamps the prior call thread and the replacing instant', () => {
    expect(supersedesStamp(callSlot(), { newThreadId: NEWER_THREAD, at: 't' })).toEqual({ directiveThreadId: 'thread-call-0001', at: 't' });
  });
  it('no stamp for an ordinary prior slot, no prior slot, the same thread, or a malformed call slot', () => {
    expect(supersedesStamp(makeDirective(), { newThreadId: NEWER_THREAD, at: 't' })).toBeNull();
    expect(supersedesStamp(null, { newThreadId: NEWER_THREAD, at: 't' })).toBeNull();
    expect(supersedesStamp(callSlot(), { newThreadId: 'thread-call-0001', at: 't' })).toBeNull();
    expect(supersedesStamp(callSlot({ directiveThreadId: '' }), { newThreadId: NEWER_THREAD, at: 't' })).toBeNull();
  });
});

describe('retirement — compare-and-clear on directiveThreadId AND answerId; a newer slot is never touched (spec §6)', () => {
  const id = { directiveThreadId: 'thread-call-0001', answerId: `${CALL_ID}:answer:hold:` };

  it('plans a clear only when family, thread and answer identity all match', () => {
    expect(planRetirement(callSlot(), id)).toBe(true);
    expect(planRetirement(callSlot({ directiveThreadId: NEWER_THREAD }), id)).toBe(false);
    expect(planRetirement(callSlot({ answerId: `${CALL_ID}:answer:go_now:` }), id)).toBe(false);
    expect(planRetirement(makeDirective({ directiveThreadId: 'thread-call-0001' }), id)).toBe(false); // ordinary slot with the same thread string: not call-family
    expect(planRetirement(null, id)).toBe(false);
    expect(planRetirement(callSlot(), { directiveThreadId: null, answerId: id.answerId })).toBe(false);
    expect(planRetirement(callSlot(), { directiveThreadId: id.directiveThreadId, answerId: '' })).toBe(false);
  });

  it('retireCallDirective buffers `directive: null` on a matching FRESH parent and nothing otherwise', () => {
    const { ops, tx, battleRef } = makeDoubles();
    expect(retireCallDirective(tx, battleRef, { directive: callSlot() }, id)).toBe(true);
    expect(ops).toEqual([{ op: 'update', path: 'agentBattles/battle-1', data: { directive: null } }]);
    ops.length = 0;
    expect(retireCallDirective(tx, battleRef, { directive: callSlot({ directiveThreadId: NEWER_THREAD }) }, id)).toBe(false); // a newer slot
    expect(retireCallDirective(tx, battleRef, { directive: makeDirective() }, id)).toBe(false); // an ordinary slot
    expect(retireCallDirective(tx, battleRef, { directive: null }, id)).toBe(false);
    expect(retireCallDirective(tx, battleRef, null, id)).toBe(false);
    expect(ops).toEqual([]);
  });
});

describe('fileDirectiveTransactional — the three writers\' one payload (spec §6)', () => {
  const plainFields = { chatBudgetUsed: 3, recentElicitationTargets: ['x'], directive: makeDirective({ directiveThreadId: NEWER_THREAD }) };

  it('an ordinary filing over an ORDINARY slot writes exactly the caller\'s payload — no stamp, no event, no extra key (transaction path)', async () => {
    const { ops, tx, battleRef, db } = makeDoubles();
    const exchange = exchangeOf(NEWER_THREAD);
    const res = await fileDirectiveTransactional(tx, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: true, priorSlot: makeDirective(), callsMode: 'on', fields: plainFields });
    expect(ops).toEqual([{ op: 'update', path: 'agentBattles/battle-1', data: { chatExchanges: arrayUnion(exchange), ...plainFields } }]);
    expect(ops[0].data.chatExchanges.items[0]).toBe(exchange); // the very object, unstamped
    expect(res).toEqual({ exchange, supersedes: null, supersededEventId: null });
    expect(Object.keys(ops[0].data)).toEqual(['chatExchanges', 'chatBudgetUsed', 'recentElicitationTargets', 'directive']);
  });

  it('the plain path (chat) is a plain battleRef.update with the same payload', async () => {
    const { ops, battleRef, db, batches } = makeDoubles();
    const exchange = exchangeOf(NEWER_THREAD);
    await fileDirectiveTransactional(null, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: true, priorSlot: makeDirective(), callsMode: 'on', fields: plainFields });
    expect(ops).toEqual([{ op: 'plainUpdate', path: 'agentBattles/battle-1', data: { chatExchanges: arrayUnion(exchange), ...plainFields } }]);
    expect(batches()).toBe(0);
  });

  it('a filing that does NOT install a directive (chat with no directive minted) never stamps, whatever the prior slot', async () => {
    const { ops, battleRef, db } = makeDoubles();
    const exchange = { userMessage: 'hi', agentResponse: 'hello', hasDirective: false, directive: null, directiveThreadId: null, timestamp: 't' };
    await fileDirectiveTransactional(null, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: false, priorSlot: callSlot(), callsMode: 'on', fields: { chatBudgetUsed: 1 } });
    expect(ops).toEqual([{ op: 'plainUpdate', path: 'agentBattles/battle-1', data: { chatExchanges: arrayUnion(exchange), chatBudgetUsed: 1 } }]);
    expect(ops[0].data.chatExchanges.items[0]).not.toHaveProperty('supersedes');
  });

  it('replacing a CALL-FAMILY slot at off/shadow: the `supersedes` stamp on the exchange, nothing else (ordinary state)', async () => {
    for (const callsMode of ['off', 'shadow', null]) {
      const { ops, tx, battleRef, db } = makeDoubles();
      const exchange = exchangeOf(NEWER_THREAD);
      const res = await fileDirectiveTransactional(tx, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: true, priorSlot: callSlot(), callsMode, fields: plainFields });
      expect(ops, String(callsMode)).toHaveLength(1);
      expect(ops[0].op).toBe('update');
      expect(ops[0].data.chatExchanges.items[0]).toEqual({ ...exchange, supersedes: { directiveThreadId: 'thread-call-0001', at: exchange.timestamp } });
      expect(res.supersedes).toEqual({ directiveThreadId: 'thread-call-0001', at: exchange.timestamp });
      expect(res.supersededEventId).toBeNull();
    }
  });

  it("replacing a CALL-FAMILY slot at ON: the stamp AND a `superseded` call event created in the SAME transaction, at the prior thread's id", async () => {
    const { ops, tx, battleRef, db } = makeDoubles();
    const exchange = exchangeOf(NEWER_THREAD);
    const res = await fileDirectiveTransactional(tx, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: true, priorSlot: callSlot(), callsMode: 'on', fields: plainFields });
    expect(ops.map((o) => o.op)).toEqual(['update', 'create']);
    expect(ops[1].path).toBe('agentBattles/battle-1/callEvents/thread-call-0001:superseded');
    expect(ops[1].data).toEqual({
      kind: 'superseded', at: Date.parse(exchange.timestamp), callIds: [CALL_ID], text: 'Superseded by a later filing at 10:21 ET', saidOk: null,
      evidence: { evalId: null, promptBuiltAt: null, checkLabel: null }, supersededBy: NEWER_THREAD, supersededDirectiveThreadId: 'thread-call-0001',
    });
    expect(res.supersededEventId).toBe('thread-call-0001:superseded');
    // The replaced call's own record is never touched by the writer (no write to calls/).
    expect(ops.some((o) => o.path.includes('/calls/'))).toBe(false);
  });

  it("the plain path at ON with a call-family prior: ONE WriteBatch carrying the update and the event's create, committed together", async () => {
    const { ops, battleRef, db, batches } = makeDoubles();
    const exchange = exchangeOf(NEWER_THREAD);
    await fileDirectiveTransactional(null, battleRef, { db, battleId: 'battle-1', arrayUnion, exchange, filed: true, priorSlot: callSlot(), callsMode: 'on', fields: plainFields });
    expect(batches()).toBe(1);
    expect(ops.map((o) => o.op)).toEqual(['batchUpdate', 'batchCreate', 'batchCommit']);
    expect(ops[0].data.chatExchanges.items[0].supersedes).toEqual({ directiveThreadId: 'thread-call-0001', at: exchange.timestamp });
    expect(ops[1].path).toBe('agentBattles/battle-1/callEvents/thread-call-0001:superseded');
  });

  it('refuses to run without arrayUnion (a plan is never half-built)', async () => {
    const { tx, battleRef, db } = makeDoubles();
    await expect(fileDirectiveTransactional(tx, battleRef, { db, battleId: 'b', exchange: exchangeOf(OLD_THREAD), fields: {} })).rejects.toThrow(/arrayUnion/);
  });
});
