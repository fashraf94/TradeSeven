// api/_utils/callRecords/callsBlock.test.js
//
// Cockpit Build 1a — THE CHAT CALLS BLOCK (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §9, §15.8; Amendment B §8): three bounded queries, the merge, the cap, the
// priority; the awaiting class empty; nothing read below resolved 'on'; the
// prompt bytes unchanged at off / shadow (the voice goldens hold; here the
// prompt builder is driven with and without the block).
//
// Dependency-surface guard (BUILD_RULES §4): the import of ./callsBlock.js is never mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, touches } from '../__fixtures__/callsFirestore.js';
import {
  buildCallsBlock, renderCallsRow, renderCallFact, mergeHistory, readCallsForBlock, buildCallsBlockForChat,
  CALLS_BLOCK_CHAR_CAP, CALLS_BLOCK_HEADING, CALLS_BLOCK_OPEN_LIMIT, CALLS_BLOCK_HISTORY_LIMIT, RESOLVED_STATES,
} from './callsBlock.js';

const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z');
const CLOSE = T('2026-09-09T20:00:00.000Z');
const B = 'battle-1';
const P = (id) => `agentBattles/${B}/calls/${id}`;
const shot = (n, over = {}) => ({
  callId: `${B}:eval_00${Math.min(9, n)}:call:${n}`, kind: 'called_shot', battleId: B, evalId: `eval_00${Math.min(9, n)}`, evalSeq: 1, mintedAt: NOW - 100_000 + n * 1_000,
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'x',
  state: 'open', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
const EVALS = [{ evalId: 'eval_010', promptBuiltAt: '2026-09-09T14:15:00.000Z' }, { evalId: 'eval_011', promptBuiltAt: '2026-09-09T14:30:00.000Z' }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('rows and facts (spec §9, §2)', () => {
  it('a row: id · call line · state · answer · the fact with its check time', () => {
    expect(renderCallsRow(shot(1), { nowMs: NOW })).toBe(`- ${B}:eval_001:call:1 · AMD above $161.00 by today's close · open`);
    const answered = shot(2, { playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: 'eval_010' }, directiveThreadId: 't' });
    expect(renderCallsRow(answered, { nowMs: NOW, evaluations: EVALS })).toBe(`- ${B}:eval_002:call:2 · AMD above $161.00 by today's close · open · answered: Hold off · heard at the 10:15 check`);
    const acted = shot(3, { state: 'hit', playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: 'eval_010' }, outcome: { actedEvalId: 'eval_011' } });
    expect(renderCallsRow(acted, { nowMs: NOW, evaluations: EVALS })).toBe(`- ${B}:eval_003:call:3 · AMD above $161.00 by today's close · hit · answered: Go now · acted at the 10:30 check`);
    const unconfirmed = shot(4, { playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: null } });
    expect(renderCallFact(unconfirmed, { evaluations: EVALS })).toBe('not confirmed heard');
    const ack = shot(5, { playerResponse: { answer: 'go', kind: 'ack', callId: 'c', filedAt: 'f' } });
    expect(renderCallFact(ack)).toBeNull();
    expect(renderCallsRow(ack, { nowMs: NOW })).toContain('answered: Go');
    // A flip stamp WITHOUT a directive answer is the agent's own choice, not a §2 fact: no fact (review L5-9).
    expect(renderCallFact(shot(6, { outcome: { actedEvalId: 'eval_zzz' } }), { evaluations: EVALS })).toBeNull();
    // acted with an evalId outside the retained window: no time invented.
    expect(renderCallFact(shot(6, { playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: 'eval_010' }, outcome: { actedEvalId: 'eval_zzz' } }), { evaluations: EVALS })).toBe('acted');
    // A stamp from a check BEFORE the answer was filed is coincident: not confirmed heard until heard, then heard — never acted (review L5-9).
    expect(renderCallFact(shot(6, { playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: null }, outcome: { actedEvalId: 'eval_010' } }), { evaluations: EVALS })).toBe('not confirmed heard');
    expect(renderCallFact(shot(6, { playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: '2026-09-09T14:20:00.000Z', heardEvalId: 'eval_011' }, outcome: { actedEvalId: 'eval_010' } }), { evaluations: EVALS })).toBe('heard at the 10:30 check');
    expect(renderCallsRow({ ...shot(7), condition: null }, { nowMs: NOW })).toBeNull();
  });

  it('a pick row shows the request line and the chosen symbol', () => {
    const pick = shot(8, { kind: 'pick', symbol: null, direction: null, swapOut: 'KO', options: [{ symbol: 'AMD' }, { symbol: 'JPM' }], condition: null, defaultAction: null, horizon: { phrase: 'next_check', expiresAt: NOW + 900_000, basis: 'next_check' }, playerResponse: { answer: 'pick', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: null, pickSymbol: 'JPM' } });
    // The selection lives in the directive's own record (spec §5): the row reads it from the battle's slot or thread exchange, never from playerResponse (review L6-2 / L5-3).
    const answeredPick = { ...pick, playerResponse: { answer: 'pick', kind: 'directive', directiveThreadId: 't', callId: pick.callId, filedAt: 'f', heardEvalId: null }, directiveThreadId: 't' };
    expect(renderCallsRow(answeredPick, { nowMs: NOW })).toBe(`- ${B}:eval_008:call:8 · support: AMD or JPM for KO · open · answered: Pick · not confirmed heard`);
    const record = { text: 'Bring in JPM for KO at the next check.', expiry: 'until_ms', directiveThreadId: 't', family: 'call', callId: pick.callId, kind: 'call_pick', action: { direction: null, symbol: null, slot: 'support', pickSymbol: 'JPM', swapOut: 'KO' } };
    expect(renderCallsRow(answeredPick, { nowMs: NOW, battle: { directive: null, chatExchanges: [{ directiveThreadId: 't', directive: record }] } })).toBe(`- ${B}:eval_008:call:8 · support: AMD or JPM for KO · open · answered: Pick JPM · not confirmed heard`);
    expect(renderCallsRow(answeredPick, { nowMs: NOW, battle: { directive: { ...record, createdAt: 'c' }, chatExchanges: [] } })).toContain('answered: Pick JPM');
  });
});

describe('buildCallsBlock — merge, priority, the cap (spec §9)', () => {
  it('open rows first, then the five newest resolved; the awaiting class is EMPTY in 1a; null with nothing to say', () => {
    const open = [shot(1), shot(2)];
    const history = mergeHistory([[shot(3, { state: 'hit' }), shot(4, { state: 'hit' })], [shot(5, { state: 'expired_unresolved' })], [shot(6, { state: 'ended_with_battle' }), shot(7, { state: 'ended_with_battle' }), shot(8, { state: 'ended_with_battle' })]]);
    expect(history.map((c) => c.callId.slice(-1))).toEqual(['8', '7', '6', '5', '4']); // newest first, cut to five
    const block = buildCallsBlock({ open, history, awaiting: [] }, { nowMs: NOW });
    const lines = block.split('\n');
    expect(lines[0]).toBe(CALLS_BLOCK_HEADING);
    expect(lines.slice(1).map((l) => l.split(' · ')[0].slice(-1))).toEqual(['1', '2', '8', '7', '6', '5', '4']);
    expect(buildCallsBlock({ open: [], history: [] }, { nowMs: NOW })).toBeNull();
    expect(block.length).toBeLessThanOrEqual(CALLS_BLOCK_CHAR_CAP);
  });

  it('merge dedupes by call id across the three queries', () => {
    const same = shot(3, { state: 'hit' });
    expect(mergeHistory([[same], [same], [same]])).toHaveLength(1);
  });

  it('the cap: whole-row truncation with "… n more"; open rows take priority over history', () => {
    const open = Array.from({ length: 6 }, (_, i) => shot(i + 1));
    // Long ids (a 90-char battle id) make eleven rows overflow the 1,200-char cap.
    const LONG = `battle-${'x'.repeat(90)}`;
    const history = Array.from({ length: 5 }, (_, i) => shot(i + 1, { callId: `${LONG}:eval_009:call:${i + 20}`, state: 'hit', playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't', callId: 'c', filedAt: 'f', heardEvalId: 'eval_010' }, outcome: { actedEvalId: 'eval_011' } }));
    const block = buildCallsBlock({ open, history }, { nowMs: NOW, evaluations: EVALS });
    expect(block.length).toBeLessThanOrEqual(CALLS_BLOCK_CHAR_CAP);
    const lines = block.split('\n');
    expect(lines[lines.length - 1]).toMatch(/^… \d+ more$/);
    // Every open row is present before any history row was cut.
    for (let i = 1; i <= 6; i++) expect(block).toContain(`${B}:eval_00${i}:call:${i} ·`);
    // No row is cut mid-way: each body line is a whole row.
    for (const l of lines.slice(1, -1)) expect(l).toMatch(/^- .* · (open|hit|expired_unresolved|ended_with_battle)/);
    const shown = lines.length - 2;
    expect(Number(lines[lines.length - 1].match(/\d+/)[0])).toBe(11 - shown);
  });
});

describe('readCallsForBlock / buildCallsBlockForChat — the three bounded queries, at resolved on only', () => {
  const docs = () => ({
    [P(shot(1).callId)]: shot(1),
    [P(shot(2).callId)]: shot(2),
    [P(shot(3).callId)]: shot(3, { state: 'hit' }),
    [P(shot(4).callId)]: shot(4, { state: 'expired_unresolved' }),
    [P(shot(5).callId)]: shot(5, { state: 'ended_with_battle' }),
    [P(shot(6).callId)]: shot(6, { state: 'invalidated' }),
  });

  it('issues the open query (limit 6, mintedAt desc) and one query per resolved state (limit 5, mintedAt desc), merges the history, leaves awaiting empty', async () => {
    const db = makeCallsFirestore({ docs: docs() });
    const read = await readCallsForBlock(db, B);
    expect(read.open.map((c) => c.callId.slice(-1))).toEqual(['2', '1']);
    expect(read.history.map((c) => c.callId.slice(-1))).toEqual(['5', '4', '3']);
    expect(read.awaiting).toEqual([]);
    const q = db.__access.queries;
    expect(q).toHaveLength(4);
    expect(q[0]).toMatchObject({ filters: [{ field: 'state', op: '==', value: 'open' }], orders: [{ field: 'mintedAt', dir: 'desc' }], limit: CALLS_BLOCK_OPEN_LIMIT });
    expect(q.slice(1).map((x) => x.filters[0].value)).toEqual([...RESOLVED_STATES]);
    for (const x of q.slice(1)) expect(x).toMatchObject({ orders: [{ field: 'mintedAt', dir: 'desc' }], limit: CALLS_BLOCK_HISTORY_LIMIT });
    expect(CALLS_BLOCK_HISTORY_LIMIT).toBe(5);
  });

  it('below resolved on nothing is read and null is returned; at on the block renders; a failed read degrades to null', async () => {
    for (const callsMode of ['off', 'shadow', null]) {
      const db = makeCallsFirestore({ docs: docs() });
      expect(await buildCallsBlockForChat(db, B, { evaluations: [] }, { callsMode })).toBeNull();
      expect(touches(db)).toEqual({ reads: 0, writes: 0, queries: 0 });
    }
    const db = makeCallsFirestore({ docs: docs() });
    const block = await buildCallsBlockForChat(db, B, { evaluations: [] }, { callsMode: 'on', nowMs: NOW });
    expect(block).toContain(CALLS_BLOCK_HEADING);
    expect(block).toContain(`${B}:eval_002:call:2 · AMD above $161.00 by today's close · open`);
    expect(block).not.toContain('invalidated');
    const failing = makeCallsFirestore({ docs: docs() });
    failing.__hooks.failQuery = new Error('index missing');
    expect(await buildCallsBlockForChat(failing, B, {}, { callsMode: 'on' })).toBeNull();
  });
});
