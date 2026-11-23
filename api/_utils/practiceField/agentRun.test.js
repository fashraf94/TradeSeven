// api/_utils/practiceField/agentRun.test.js
//
// Practice Field build B2 — THE AGENT'S CHECK AT THE CLOSE, on the in-memory harness with a FAKE TRANSPORT (no real
// model, Firestore or vendor call). Each scripted case the build prompt names is a row: a good answer, a malformed one,
// one naming an unknown idea, an over-long note, a draft outside the rails, a draft naming an unpriced name, a timeout
// then a success, two timeouts, a replay — and the spend, the two desks, the code fallback and the carried T1b
// conditions.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from './mode.js';
import { admitIdea } from './admission.js';
import { runDeskCheck, runIdeaBookAgentPass, callWithTimeout, AGENT_MODEL_SEAT, deskWorkOf, thesisRefsKept } from './agentRun.js';
import { CODE_FALLBACK_NOTE, AGENT_MAX_OUTPUT_TOKENS, AGENT_MAX_INPUT_TOKENS, PRACTICE_FIELD_AGENT_MODEL } from './agentConfig.js';
import { PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD } from './constants.js';
import { maxCallChargeUsd } from './spend.js';
import { buildMandateRequest } from '../mandateModelCall.js';
import { seedBook, getBook, getIdea, etIso, DAYS, closeOn, windowAt, omitDailyEntry } from './__testsupport__/fixtures.js';
import {
  quotesOn, foundersMediumIdea, fakeTransport, toolResponse, transportError, holdAll, draft, deskPartsOf, agentNowOf,
} from './__testsupport__/agentFixtures.js';

let restoreMode;
let restoreAgent;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
});
afterEach(() => { restoreAgent(); restoreMode(); });

const D1 = DAYS.d1; // Mon 16 Nov 2026 — the founder's idea enters at its first window
const D2 = DAYS.d2;

/** The founder's book: created Friday 13 Nov, the medium idea admitted that day, entered Monday at its first window. */
async function foundersBook() {
  const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
  const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
  expect(admitted.ok).toBe(true);
  return { ...ctx, mediumId: admitted.ideaId };
}

/** Day 1 run up to (not including) the agent: three windows and the close. */
async function windowsAndClose(ctx, date, quotes = quotesOn()) {
  for (const slot of ['open30', 'midday', 'preClose']) await windowAt(ctx.db, ctx.bookId, { date, slot, quotes });
  const close = await closeOn(ctx.db, ctx.bookId, date, quotes);
  expect(close.closed).toBe(true);
}

describe('the call, and its spend', () => {
  it('the seat and the request: Sonnet 5.5, no temperature, no cache marker anywhere, auto tool choice, max_tokens the declared cap', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const seen = [];
    const { transport } = fakeTransport(({ request }) => { seen.push(request); return toolResponse(holdAll(request)); });
    await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport, clock: () => agentNowOf(D1) });
    expect(seen).toHaveLength(1);
    const built = buildMandateRequest(seen[0].modelSeat, seen[0].content);
    expect(built.model).toBe('claude-sonnet-5-5');
    expect(built.max_tokens).toBe(AGENT_MAX_OUTPUT_TOKENS);
    expect(built).not.toHaveProperty('temperature');
    expect(JSON.stringify(built)).not.toMatch(/cache_control/);
    expect(built.tool_choice).toEqual({ type: 'auto', disable_parallel_tool_use: true });
    expect(built.tools.map((t) => t.name)).toEqual(['submit_book_check']);
    expect(seen[0].modelSeat).toBe(AGENT_MODEL_SEAT);
  });

  it('PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD is the real maximum of the agent\'s call', () => {
    expect(maxCallChargeUsd({ modelId: PRACTICE_FIELD_AGENT_MODEL, maxInputTokens: AGENT_MAX_INPUT_TOKENS, maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS })).toBe(PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD);
    expect(PRACTICE_FIELD_MIN_CALL_MAX_CHARGE_USD).toBe(0.1625);
  });

  it('a scripted good answer: reserved before, settled after at its usage, the answer stored, the note written under the desk\'s name', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const { transport, calls } = fakeTransport(({ request }) => toolResponse(holdAll(request), { inputTokens: 6000, outputTokens: 1800 }));
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport, clock: () => agentNowOf(D1) });
    expect(res).toMatchObject({ desk: 'shadow', status: 'done', calls: 1, source: 'model' });
    expect(calls).toHaveLength(1);
    const part = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    expect(part).toMatchObject({ desk: 'shadow', deskName: 'The Shadow desk', status: 'done', source: 'model', note: 'Holding steady; nothing material changed.' });
    expect(part.actions).toEqual([{ ideaId: ctx.mediumId, action: 'hold', reason: 'The thesis still holds against its comparison.', outcome: 'held' }]);
    expect(part.attempts).toHaveLength(1);
    expect(part.attempts[0]).toMatchObject({ n: 1, state: 'settled', outcome: 'answered', unpriced: false, maxChargeUsd: 0.1625, chargedUsd: 0.03 });
    // 6,000 × $2 + 1,800 × $10 per million = $0.012 + $0.018
    const book = getBook(ctx.db, ctx.bookId);
    expect(book.spend).toMatchObject({ reservedUsd: 0.03, settledUsd: 0.03, calls: 1, exhausted: false });
    expect(ctx.db._get(`mandates/${ctx.bookId}/spendOps/agent:${D1}:shadow#1`)).toMatchObject({ state: 'settled', modelId: 'claude-sonnet-5-5', maxInputTokens: 41000, maxOutputTokens: 6000, cacheTtl: 'none', serverTools: [] });
    expect(part.manifest).toMatchObject({ model: 'claude-sonnet-5-5', desk: 'shadow', inputTokens: 6000, outputTokens: 1800, chargedUsd: 0.03 });
    expect(JSON.stringify(part.manifest)).not.toMatch(/Holding steady|research-led/); // the manifest never carries the text
  });
});

/** The shadow desk's part after one scripted call at D1. */
async function shadowAfter(script, { ctx: given } = {}) {
  const ctx = given ?? await foundersBook();
  if (!given) await windowsAndClose(ctx, D1);
  const fake = fakeTransport(script);
  const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
  return { ctx, res, calls: fake.calls, part: deskPartsOf(ctx.db, ctx.bookId, D1).shadow };
}

/** What nothing-changed means: the book's money and its ideas, byte for byte. */
const moneyOf = (ctx) => {
  const book = getBook(ctx.db, ctx.bookId);
  return JSON.stringify([book.treasury, book.portfolio, book.slots, book.openIdeaIds, ...book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))]);
};

describe('the code fallback: an answer that does not validate changes nothing', () => {
  const fallbackCases = [
    ['a malformed answer (no actions list)', () => toolResponse({ bookNote: 'A note.', drafts: [] }), /^answer_invalid:actions:not_a_list$/],
    ['an answer naming an unknown idea', (request) => toolResponse({ ...holdAll(request), actions: [...holdAll(request).actions, { ideaId: 'idea_000000000000000000000000', action: 'hold', reason: 'x' }] }), /^answer_invalid:actions\[1\]:unknown_idea$/],
    ['an over-long note (601 code points)', (request) => toolResponse({ ...holdAll(request), bookNote: 'n'.repeat(601) }), /^answer_invalid:bookNote:too_long$/],
    ['a note with a result word', (request) => toolResponse({ ...holdAll(request), bookNote: 'The thesis is validated by the tape.' }), /^answer_invalid:bookNote:banned_word$/],
    ['an unknown field', (request) => toolResponse({ ...holdAll(request), capitalUsd: 50000 }), /^answer_invalid:answer:unknown_field:capitalUsd$/],
    ['no tool call at all', () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'I would hold.' }], usage: { input_tokens: 5000, output_tokens: 200 } }), /^answer_invalid:no_tool_call$/],
    ['a refusal', () => ({ stop_reason: 'refusal', content: [], usage: { input_tokens: 5000, output_tokens: 10 } }), /^answer_invalid:refusal$/],
    ['an answer cut off at max_tokens', (request) => toolResponse(holdAll(request), { stopReason: 'max_tokens', outputTokens: 6000 }), /^answer_invalid:max_tokens$/],
  ];
  for (const [name, respond, reason] of fallbackCases) {
    it(`${name}: the code-built note, nothing changed, the call charged what it cost, no retry`, async () => {
      const ctx = await foundersBook();
      await windowsAndClose(ctx, D1);
      const before = moneyOf(ctx);
      const { res, calls, part } = await shadowAfter(({ request }) => respond(request), { ctx });
      expect(calls).toHaveLength(1); // an answer that does not validate is not retried
      expect(res).toMatchObject({ status: 'done', source: 'code_fallback' });
      expect(part).toMatchObject({ source: 'code_fallback', note: CODE_FALLBACK_NOTE, actions: [], considered: [] });
      expect(part.fallbackReason).toMatch(reason);
      expect(part).not.toHaveProperty('answer');
      expect(part.attempts[0]).toMatchObject({ state: 'settled', outcome: 'invalid_answer', unpriced: false });
      expect(moneyOf(ctx)).toBe(before);
    });
  }
});

describe('transport errors: one retry, reserved too', () => {
  it('a timeout, then a success: two reservations; the first charged its whole maximum (unpriced), the second what it cost', async () => {
    const { res, calls, part, ctx } = await shadowAfter(({ request, n }) => (n === 1 ? transportError() : toolResponse(holdAll(request))));
    expect(calls).toHaveLength(2);
    expect(res).toMatchObject({ status: 'done', source: 'model', calls: 2 });
    expect(part.attempts.map((a) => [a.n, a.outcome, a.unpriced, a.chargedUsd])).toEqual([[1, 'transport_error', true, 0.1625], [2, 'answered', false, 0.03]]);
    expect(part.attempts[0].error).toBe('agent_call_timeout');
    expect(getBook(ctx.db, ctx.bookId).spend).toMatchObject({ reservedUsd: 0.1925, settledUsd: 0.1925, calls: 2 });
    expect(ctx.db._get(`mandates/${ctx.bookId}/spendOps/agent:${D1}:shadow#2`)).toMatchObject({ state: 'settled' });
  });

  it('the saved theses\' read failing (their query, never run against production) costs the Shadow desk its theses, never its check', async () => {
    restoreAgent();
    restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: true });
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const failing = new Proxy(ctx.db, { get(t, k) { if (k === 'collection') return (name) => { if (name === 'watchlists') throw new Error('FAILED_PRECONDITION: the query needs an index'); return t.collection(name); }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await runDeskCheck(failing, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
      expect(res).toMatchObject({ status: 'done', source: 'model', calls: 1 });
    } finally { errors.mockRestore(); }
    expect(fake.calls[0].request.content.messages[0].content).not.toMatch(/saved_thesis/);
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow).toMatchObject({ thesesSkipped: [{ listId: null, reason: 'theses_read_failed' }] });
  });

  it('a saved card that fails the reply\'s requirements is SKIPPED, with why; a whole one reaches the prompt as T1', async () => {
    restoreAgent();
    restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: true });
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const card = (listId, savedAt) => ({ schemaVersion: 1, watchlistId: listId, hypothesisVersion: 1, sessionId: 's', researchWorkId: `rw_${listId}`, savedAt, statement: `Thesis of ${listId}.`, names: { value: ['AAPL'] }, why: { reasons: [] }, wrongIf: { text: 'x', priceLines: [] }, timeFrame: { label: 'months' }, findingIds: ['f1'] });
    const list = (listId, savedAt, extra = {}) => ({ watchlistId: listId, userId: ctx.uid, status: 'committed', researchWorkId: `rw_${listId}`, attribution: { agentId: 'a', at: savedAt }, thesisCard: card(listId, savedAt), ...extra });
    for (const [id, at, extra] of [['wl_ok', '2026-11-10T12:00:00.000Z', {}], ['wl_nostamp', '2026-11-11T12:00:00.000Z', { attribution: null }], ['wl_nofinding', '2026-11-12T12:00:00.000Z', {}]]) {
      ctx.db._store.set(`watchlists/${id}`, { data: list(id, at, extra), version: 1 });
      ctx.db._store.set(`researchWork/rw_${id}`, { data: { findings: id === 'wl_nofinding' ? [] : [{ findingId: 'f1', fact: 'a fact', source: { label: 's' } }] }, version: 1 });
    }
    const { part, calls } = await shadowAfter(({ request }) => toolResponse(holdAll(request)), { ctx });
    expect(part.thesesSkipped).toEqual([{ listId: 'wl_nofinding', reason: 'finding_ids_unresolved' }, { listId: 'wl_nostamp', reason: 'provenance_stamp_missing' }]);
    const msg = calls[0].request.content.messages[0].content;
    expect(msg.match(/<saved_thesis /g)).toHaveLength(1);
    expect(msg).toContain('Thesis of wl_ok.');
    expect(part.thesisRefs).toEqual({ T1: 'wl_ok' });
  });

  it('a 400 (the request itself refused) is NOT retried: one call, the code fallback, the status recorded', async () => {
    const err400 = Object.assign(transportError('invalid_request_error'), { status: 400 });
    const { res, calls, part } = await shadowAfter(() => err400);
    expect(calls).toHaveLength(1);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'transport_refused' });
    expect(part.attempts).toMatchObject([{ n: 1, outcome: 'transport_error', httpStatus: 400, retryable: false, unpriced: true }]);
  });

  it('a 529 (overloaded) or a 429 IS retried once', async () => {
    for (const status of [529, 429]) {
      const err = Object.assign(transportError('overloaded_error'), { status });
      const { calls, part } = await shadowAfter(({ request, n }) => (n === 1 ? err : toolResponse(holdAll(request))));
      expect(calls, String(status)).toHaveLength(2);
      expect(part.attempts.map((a) => [a.outcome, a.httpStatus ?? null, a.retryable ?? null])).toEqual([['transport_error', status, true], ['answered', null, null]]);
    }
  });

  it('two timeouts: the code fallback, both charged their maximum, and no third call', async () => {
    const { res, calls, part, ctx } = await shadowAfter(() => transportError());
    expect(calls).toHaveLength(2);
    expect(res).toMatchObject({ status: 'done', source: 'code_fallback', reason: 'transport_failed' });
    expect(part).toMatchObject({ source: 'code_fallback', note: CODE_FALLBACK_NOTE, fallbackReason: 'transport_failed' });
    expect(getBook(ctx.db, ctx.bookId).spend).toMatchObject({ reservedUsd: 0.325, settledUsd: 0.325, calls: 2 });
  });

  it('the module\'s own timeout turns a call that never answers into a transport error', async () => {
    vi.useFakeTimers();
    try {
      const pending = callWithTimeout(() => new Promise(() => {}), {}, 50);
      const caught = pending.catch((e) => e);
      await vi.advanceTimersByTimeAsync(60);
      expect((await caught).code).toBe('agent_call_timeout');
    } finally { vi.useRealTimers(); }
  });
});

describe('a replay of the same session never calls twice', () => {
  it('the whole pass run again: no call, no write — the store byte for byte (the lease aside)', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ request, emptySlots }) => toolResponse(holdAll(request, {
      drafts: emptySlots.includes('long') ? [draft({ slot: 'long', names: ['MSFT', 'NVDA'] })] : (emptySlots.includes('short') ? [draft({ slot: 'short', names: ['XOM'] })] : []),
    })));
    const first = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't1', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(first).toMatchObject({ books: 1, checked: 1, calls: 2, fallbacks: 0 });
    const others = () => JSON.stringify([...ctx.db._store.entries()].filter(([p]) => p !== `mandates/${ctx.bookId}`));
    const bookWithoutLease = () => JSON.stringify({ ...getBook(ctx.db, ctx.bookId), execState: null });
    const bytes = others();
    const bookBefore = bookWithoutLease();
    const again = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't2', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(again.calls).toBe(0);
    expect(fake.calls).toHaveLength(2);
    expect(others()).toBe(bytes);
    expect(bookWithoutLease()).toBe(bookBefore);
  });

  it('a process that died mid-call (reserved, never settled): the replay settles it unpriced and falls back — no second call', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    // The settlement's transaction never runs: the call was made, the reservation stands, nothing settled it.
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    let txs = 0;
    ctx.db.runTransaction = async (fn, o) => { txs += 1; if (txs === 2) throw new Error('the function was stopped'); return realTx(fn, o); };
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    await expect(runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) })).rejects.toThrow(/stopped/);
    ctx.db.runTransaction = realTx;
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow.attempts).toMatchObject([{ n: 1, state: 'reserved' }]);
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ status: 'done', source: 'code_fallback', reason: 'interrupted_call' });
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow.attempts).toMatchObject([{ n: 1, state: 'settled', outcome: 'interrupted', unpriced: true, chargedUsd: 0.1625 }]);
    expect(getBook(ctx.db, ctx.bookId).spend).toMatchObject({ reservedUsd: 0.1625, settledUsd: 0.1625 });
  });
});

describe('review fixes: what is work, and what a drafting call needs', () => {
  it('C-5: an idea the desk cannot act on (not entered, selling, settling) is context, not work — no call is paid for it', () => {
    const book = { status: 'active', drafting: 'on', windDown: null, slots: { short: 'i1', medium: 'm', long: 'l' } };
    const idea = (status, holdings = { XOM: { shares: 1 } }) => ({ ideaId: 'i1', status, contract: { slot: 'short' }, ledger: { holdings }, result: null });
    for (const status of ['accepted', 'entering', 'line_hit_exit_pending', 'settled']) {
      expect(deskWorkOf(book, [idea(status)], 'archetype'), status).toMatchObject({ hasWork: false, deskIdeas: [] });
    }
    expect(deskWorkOf(book, [idea('holding', { XOM: { shares: 1, exitPending: { reason: 'line' } } })], 'archetype').hasWork).toBe(false);
    expect(deskWorkOf(book, [idea('holding')], 'archetype')).toMatchObject({ hasWork: true });
  });

  it('B-1: a close that priced no candidate offers no slot — the desk with an idea is called without drafting; the desk with none is not called; no attempt is spent', async () => {
    const ctx = await foundersBook();
    // The founder's names, its fund and SPY only: the close snapshot of a fire built without the universe.
    const bare = { JPM: 220, BAC: 42, GS: 520, XLF: 48, SPY: 590 };
    await windowsAndClose(ctx, D1, bare);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const out = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(out.calls).toBe(1);
    expect(fake.calls.map((c) => c.desk)).toEqual(['shadow']);
    expect(fake.calls[0].request.content.messages[0].content).toMatch(/## Your empty slots to draft for\n\(none: draft nothing\)/);
    const parts = deskPartsOf(ctx.db, ctx.bookId, D1);
    expect(parts.shadow).toMatchObject({ source: 'model', refill: {}, manifest: { offeredSlots: [] } });
    expect(parts.archetype).toMatchObject({ source: 'no_work', calledModel: false, draftingSkipped: 'no_candidates', refill: {} });
  });

  it('B-3: only the labels the prompt carried resolve to a saved list', () => {
    expect(thesisRefsKept({ T1: 'a', T2: 'b', T3: 'c', T5: 'e' }, 2)).toEqual({ T1: 'a', T2: 'b' });
    expect(thesisRefsKept({ T1: 'a', X: 'z' }, 5)).toEqual({ T1: 'a' });
  });
});

describe('review A-1, A-2, A-7: what a later fire may never do', () => {
  it('A-1: an answer that did not validate, its fallback write lost — the next fire does NOT call again', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(() => toolResponse({ bookNote: 'n'.repeat(601), actions: [], drafts: [] }));
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    let failed = 0;
    ctx.db.runTransaction = async (fn, o) => { if (failed === 0 && /partPatch\(desk, part\)/.test(String(fn))) { failed += 1; throw new Error('the function was stopped'); } return realTx(fn, o); };
    await expect(runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) })).rejects.toThrow(/stopped/);
    ctx.db.runTransaction = realTx;
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'answer_invalid:bookNote:too_long' });
  });

  it('A-2: a desk left mid-way (a timeout, its retry deferred) on a book paused meanwhile spends nothing more', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    let t = agentNowOf(D1).getTime();
    const fake = fakeTransport(() => { t += 200_000; return transportError(); });
    const first = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => new Date(t), deadlineMs: t + 130_000 });
    expect(first).toMatchObject({ status: 'deferred', calls: 1 });
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, drafting: 'paused' }, version: 99 });
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => new Date(t) });
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'spend_stopped:drafting_paused' });
    expect(getBook(ctx.db, ctx.bookId).spend.calls).toBe(1);
  });

  it('A-7: an operation already reserved is never called under again (the close row lost the desk\'s record)', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    const path = `mandates/${ctx.bookId}/windows/${D1}_close`;
    const row = ctx.db._get(path);
    ctx.db._store.set(path, { data: { ...row, agent: { ...row.agent, desks: {} } }, version: 99 });
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'attempt_already_reserved' });
    // The attempt is written back (the settled operation's), never dropped.
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow.attempts).toMatchObject([{ n: 1, state: 'settled', outcome: 'interrupted', recordLost: true }]);
  });

  it('A-7, the reservation still OPEN when the row lost its record: settled at its maximum, its attempt kept; no call, then or later', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    let txs = 0;
    ctx.db.runTransaction = async (fn, o) => { txs += 1; if (txs === 2) throw new Error('the function was stopped'); return realTx(fn, o); };
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    await expect(runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) })).rejects.toThrow(/stopped/);
    ctx.db.runTransaction = realTx;
    const opId = deskPartsOf(ctx.db, ctx.bookId, D1).shadow.attempts[0].opId;
    const path = `mandates/${ctx.bookId}/windows/${D1}_close`;
    const row = ctx.db._get(path);
    ctx.db._store.set(path, { data: { ...row, agent: { ...row.agent, desks: {} } }, version: 99 });
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'attempt_already_reserved' });
    expect(ctx.db._get(`mandates/${ctx.bookId}/spendOps/${opId}`)).toMatchObject({ state: 'settled', chargedUsd: 0.1625 });
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow.attempts).toMatchObject([{ n: 1, opId, state: 'settled', outcome: 'interrupted', recordLost: true, chargedUsd: 0.1625 }]);
    const again = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(again).toMatchObject({ status: 'already_done', calls: 0 });
    expect(fake.calls).toHaveLength(1);
  });

  it('refuter R-1: the reservation\'s own commit landed and the transaction RE-RAN (an ambiguous commit) — the call goes ahead, once, and settles', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    let txs = 0;
    ctx.db.runTransaction = async (fn, o) => { txs += 1; if (txs === 1) { await realTx(fn, o); return realTx(fn, o); } return realTx(fn, o); };
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    ctx.db.runTransaction = realTx;
    expect(fake.calls).toHaveLength(1);
    expect(res).toMatchObject({ status: 'done', source: 'model', calls: 1 });
    const part = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    expect(part.attempts).toMatchObject([{ n: 1, state: 'settled', outcome: 'answered', unpriced: false }]);
    expect(ctx.db._get(`mandates/${ctx.bookId}/spendOps/${part.attempts[0].opId}`)).toMatchObject({ state: 'settled' });
    expect(getBook(ctx.db, ctx.bookId).spend.calls).toBe(1);
  });
});

describe('a crash after the answer was stored: the replay acts on the stored answer, with no second call', () => {
  it('the final write fails; the next fire finds the answer on the close row, admits its draft once and writes the part', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    const isFinalWrite = (fn) => /writePart|partPatch\(desk, part\)/.test(String(fn));
    let failed = 0;
    // The reservation (1), the settlement with the answer (2), the admission's probe and admission, then the part's write.
    ctx.db.runTransaction = async (fn, o) => { if (failed === 0 && isFinalWrite(fn)) { failed += 1; throw new Error('the function was stopped'); } return realTx(fn, o); };
    await expect(runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) })).rejects.toThrow(/stopped/);
    ctx.db.runTransaction = realTx;
    const stored = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    expect(stored).toMatchObject({ status: 'in_progress', answer: { drafts: [{ slot: 'long', names: ['MSFT'] }] } });
    const longId = getBook(ctx.db, ctx.bookId).slots.long;
    expect(longId).toBeTruthy(); // admitted before the crash
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(res).toMatchObject({ status: 'done', source: 'model', calls: 0 });
    expect(fake.calls).toHaveLength(1);
    const part = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    expect(part.considered).toMatchObject([{ outcome: 'admitted', ideaId: longId, idempotentReplay: true }]);
    expect(getBook(ctx.db, ctx.bookId).openIdeaIds.filter((id) => id === longId)).toHaveLength(1);
  });
});

describe('the spend bound refuses: no call, the code fallback', () => {
  it('an exhausted month: the reservation is refused, nothing is called, the note says so', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, spend: { version: 3, month: '2026-11', boundUsd: 3, reservedUsd: 2.9, settledUsd: 2.9, exhausted: true, exhaustedAt: null, exhaustedBy: null, calls: 40 } }, version: 99 });
    const { res, calls, part } = await shadowAfter(() => { throw new Error('must not be called'); }, { ctx });
    expect(calls).toHaveLength(0);
    expect(res).toMatchObject({ source: 'code_fallback', reason: 'spend_refused:spend_exhausted' });
    expect(part).toMatchObject({ note: CODE_FALLBACK_NOTE, calledModel: false });
  });
});

describe('the two desks (B2-7)', () => {
  it('each desk drafts only its own slots: a draft for the other desk\'s slot is refused; each note sits under its own name', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ desk, request }) => toolResponse(holdAll(request, {
      note: `${desk} desk note`,
      drafts: desk === 'shadow'
        ? [draft({ slot: 'short', names: ['XOM'] }), draft({ slot: 'long', names: ['MSFT', 'NVDA'] })]
        : [draft({ slot: 'long', names: ['AAPL'] }), draft({ slot: 'short', names: ['XOM'] })],
    })));
    const out = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(out).toMatchObject({ calls: 2, fallbacks: 0 });
    const parts = deskPartsOf(ctx.db, ctx.bookId, D1);
    expect(parts.shadow).toMatchObject({ deskName: 'The Shadow desk', note: 'shadow desk note', source: 'model' });
    expect(parts.archetype).toMatchObject({ deskName: 'The archetype desk', note: 'archetype desk note', source: 'model' });
    expect(parts.shadow.considered.map((c) => [c.slot, c.outcome, c.refusals.map((r) => r.code)])).toEqual([['short', 'refused', ['slot_not_this_desks']], ['long', 'admitted', []]]);
    expect(parts.archetype.considered.map((c) => [c.slot, c.outcome, c.refusals.map((r) => r.code)])).toEqual([['long', 'refused', ['slot_not_this_desks']], ['short', 'admitted', []]]);
    const book = getBook(ctx.db, ctx.bookId);
    const long = getIdea(ctx.db, ctx.bookId, book.slots.long);
    const short = getIdea(ctx.db, ctx.bookId, book.slots.short);
    expect(long.contract).toMatchObject({ desk: 'shadow', slot: 'long', origin: { kind: 'market_scan', initiatedBy: 'agent' }, sources: [{ kind: 'market_scan', ref: `${D1}_close` }], thesis: { author: 'agent' } });
    expect(short.contract).toMatchObject({ desk: 'archetype', slot: 'short', origin: { kind: 'market_scan', initiatedBy: 'agent' } });
    // Code sized both: each the slot's permitted maximum at admission's marks — long by its slot cap (40% of the book's
    // marked equity, which the medium idea's entry costs moved below $100,000), short by its own (20%), under the cash floor.
    const equity = ctx.db._get(`mandates/${ctx.bookId}/ideas/${book.slots.long}/evidence/admission`).measuredAgainst.equityUsd;
    expect(long.contract.capitalUsd).toBe(Math.floor(equity * 0.4 * 100) / 100);
    expect(parts.shadow.considered[1]).toMatchObject({ capitalUsd: long.contract.capitalUsd, binding: ['slot_cap'] });
    expect(parts.archetype.considered[1]).toMatchObject({ capitalUsd: short.contract.capitalUsd, binding: ['slot_cap'] });
    expect(long.contract.capitalUsd).toBeGreaterThan(39900);
    expect(short.contract.capitalUsd).toBeGreaterThan(19900);
    // The founder's hand-entered medium idea belongs to the Shadow desk (no desk frozen on it: the desk of its slot).
    expect(getIdea(ctx.db, ctx.bookId, ctx.mediumId).contract.desk).toBeUndefined();
    expect(parts.shadow.actions.map((a) => a.ideaId)).toEqual([ctx.mediumId]);
    expect(parts.archetype.actions).toEqual([]);
  });

  it('a desk acts only on its own ideas: the archetype desk naming the Shadow desk\'s idea is refused whole', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ desk, request }) => toolResponse(desk === 'archetype'
      ? { bookNote: 'Exiting the banks.', actions: [{ ideaId: ctx.mediumId, action: 'exit', reason: 'Not mine to exit.' }], drafts: [] }
      : holdAll(request)));
    await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    const parts = deskPartsOf(ctx.db, ctx.bookId, D1);
    expect(parts.archetype).toMatchObject({ source: 'code_fallback', fallbackReason: 'answer_invalid:actions[0]:unknown_idea' });
    expect(getIdea(ctx.db, ctx.bookId, ctx.mediumId).status).toBe('holding');
  });

  it('a desk with no work makes no call: the Shadow desk with its slots full and no idea of its own is not called; the archetype desk is', async () => {
    const ctx = await seedBook({ nowIso: etIso(DAYS.admit, 9, 0) });
    // A book whose medium and long slots are taken by ideas not yet entered and owned by no desk the Shadow desk acts on
    // is not this case; the plain one: the archetype desk has an empty short slot, the Shadow desk has work too. So the
    // no-work desk is built directly: the Shadow desk's slots hold the archetype desk's... — see deskWorkOf below.
    const book = getBook(ctx.db, ctx.bookId);
    const full = { ...book, slots: { short: null, medium: 'idea_m', long: 'idea_l' } };
    const otherDesks = [{ ideaId: 'idea_m', status: 'accepted', contract: { slot: 'medium', desk: 'archetype' } }];
    expect(deskWorkOf(full, otherDesks, 'shadow')).toMatchObject({ hasWork: false, deskIdeas: [], emptySlots: [], stoppedBy: null });
    expect(deskWorkOf(full, otherDesks, 'archetype')).toMatchObject({ hasWork: true, emptySlots: ['short'] });
  });

  it('A PAUSED BOOK SPENDS NOTHING (contract V2 §3.2: "Paused stops drafting and model spend"): neither desk is called; each says why', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, drafting: 'paused' }, version: 99 });
    expect(deskWorkOf({ ...book, drafting: 'paused' }, [], 'archetype')).toMatchObject({ hasWork: false, emptySlots: [], stoppedBy: 'drafting_paused' });
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const out = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(fake.calls).toEqual([]);
    expect(out.calls).toBe(0);
    const parts = deskPartsOf(ctx.db, ctx.bookId, D1);
    for (const desk of ['shadow', 'archetype']) expect(parts[desk], desk).toMatchObject({ source: 'no_work', calledModel: false, note: null, attempts: [], stoppedBy: 'drafting_paused' });
    expect(getBook(ctx.db, ctx.bookId).spend).toBeUndefined();
    expect(deskWorkOf({ ...book, windDown: { requestedAt: 'x' } }, [], 'shadow')).toMatchObject({ hasWork: false, stoppedBy: 'wind_down' });
  });

  it('ONE DESK\'S FAILURE NEVER COSTS THE OTHER ITS CHECK: the Shadow desk throws (its first transaction fails); the archetype desk still checks', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const realTx = ctx.db.runTransaction.bind(ctx.db);
    let txs = 0;
    // The book's lease is the first transaction; the Shadow desk's reservation is the second.
    ctx.db.runTransaction = async (fn, o) => { txs += 1; if (txs === 2) throw new Error('a store outage'); return realTx(fn, o); };
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const out = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't', transport: fake.transport, clock: () => agentNowOf(D1) });
    ctx.db.runTransaction = realTx;
    expect(out).toMatchObject({ errors: 1, calls: 1 });
    expect(fake.calls.map((c) => c.desk)).toEqual(['archetype']);
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).archetype).toMatchObject({ source: 'model' });
    // …and the next fire serves the Shadow desk: nothing was reserved for it.
    const again = await runIdeaBookAgentPass(ctx.db, { date: D1, now: agentNowOf(D1), ownerToken: 't2', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(again).toMatchObject({ errors: 0, calls: 1 });
    expect(deskPartsOf(ctx.db, ctx.bookId, D1).shadow).toMatchObject({ source: 'model' });
  });
});

describe('drafting: the rails, the candidates, the sizing', () => {
  it('a draft outside the rails and a draft naming an unpriced name are refused with their codes; the next draft for the slot is tried', async () => {
    const { part, ctx } = await shadowAfter(({ request }) => toolResponse(holdAll(request, {
      drafts: [
        draft({ slot: 'long', names: ['MSFT'], distance: 0.3 }), // B5: long lines 10%–25%
        draft({ slot: 'long', names: ['ORCL'] }), // a universe stock no close price lists
        draft({ slot: 'long', names: ['AAPL', 'AMZN'] }),
      ],
    })));
    expect(part.considered.map((c) => [c.index, c.outcome, c.refusals.map((r) => r.code)])).toEqual([
      [0, 'refused', ['line_distance_out_of_band']], [1, 'refused', ['name_not_a_candidate']], [2, 'admitted', []],
    ]);
    expect(part.refill).toEqual({ long: { attempted: true, spent: true, admittedIdeaId: getBook(ctx.db, ctx.bookId).slots.long, waitingOn: null } });
  });

  it('at most one draft per empty slot, in the agent\'s order: the second admissible draft for the slot is "not chosen"', async () => {
    const { part } = await shadowAfter(({ request }) => toolResponse(holdAll(request, {
      drafts: [draft({ slot: 'long', names: ['MSFT', 'NVDA'] }), draft({ slot: 'long', names: ['AAPL'] })],
    })));
    expect(part.considered.map((c) => [c.index, c.outcome])).toEqual([[0, 'admitted'], [1, 'not_chosen']]);
  });

  it('drafting admits at THIS close\'s snapshot with SERVER time (carried condition), and the idea enters at the next session\'s first window', async () => {
    const serverNow = new Date(agentNowOf(D1).getTime() + 7 * 60_000);
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => serverNow });
    const longId = getBook(ctx.db, ctx.bookId).slots.long;
    expect(getIdea(ctx.db, ctx.bookId, longId).admittedAt).toBe(serverNow.toISOString());
    const packet = ctx.db._get(`mandates/${ctx.bookId}/ideas/${longId}/evidence/admission`);
    expect(packet.measuredAgainst.admissionMarks).toMatchObject({ basis: 'last_close', session: D1, snapshotKey: `${D1}_close` });
    expect(packet.admittedAt).toBe(serverNow.toISOString());
    expect(getIdea(ctx.db, ctx.bookId, longId).contract.schedule.entryNotBefore).toMatchObject({ sessionDate: D2, slot: 'open30' });
  });

  it('a refusal for close_owed does NOT spend the slot\'s refill attempt: the stored drafts are admitted at the next fire, with no model call', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    // Server time a day late: D2 has completed and is not closed, so admission is refused close_owed.
    const late = agentNowOf(D2);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })));
    await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => late });
    let part = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    // (A day late, the last completed session's close snapshot is not stored either: the marks are unavailable too — the
    // other refusal that leaves the attempt unspent. Nothing else is refused.)
    expect(part.considered.map((c) => c.outcome)).toEqual(['waiting']);
    expect(part.considered[0].refusals.map((r) => r.code).sort()).toEqual(['admission_marks_unavailable', 'close_owed']);
    expect(part.refill.long).toMatchObject({ attempted: true, spent: false, admittedIdeaId: null });
    expect(part.refill.long.waitingOn).toContain('close_owed');
    expect(getBook(ctx.db, ctx.bookId).slots.long).toBeNull();
    // The next fire of the same close window: the stored drafts again, no call.
    const res = await runDeskCheck(ctx.db, ctx.bookRef, { session: D1, desk: 'shadow', transport: fake.transport, clock: () => agentNowOf(D1) });
    expect(res).toMatchObject({ status: 'done', calls: 0, reason: 'drafts_retried' });
    expect(fake.calls).toHaveLength(1);
    part = deskPartsOf(ctx.db, ctx.bookId, D1).shadow;
    expect(part.considered.map((c) => c.outcome)).toEqual(['admitted']);
    expect(part.refill.long).toMatchObject({ spent: true, admittedIdeaId: getBook(ctx.db, ctx.bookId).slots.long });
  });

  it('a held name\'s corporate-action data missing (admission_marks_unavailable — the ex-dividend family) does NOT spend the attempt', async () => {
    const ctx = await foundersBook();
    await windowsAndClose(ctx, D1);
    omitDailyEntry(ctx.db, D1, ['JPM']);
    const { part } = await shadowAfter(({ request }) => toolResponse(holdAll(request, { drafts: [draft({ slot: 'long', names: ['MSFT'] })] })), { ctx });
    expect(part.considered.map((c) => [c.outcome, c.refusals.map((r) => r.code)])).toEqual([['waiting', ['admission_marks_unavailable']]]);
    expect(part.refill.long).toMatchObject({ attempted: true, spent: false, waitingOn: ['admission_marks_unavailable'] });
  });
});
