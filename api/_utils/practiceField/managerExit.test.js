// api/_utils/practiceField/managerExit.test.js
//
// Practice Field build B2 (ruling B2-1) — THE MANAGER'S EXIT reuses the settlement path whole. The differential: one
// idea, one history, settled at the same session S two ways — by its due-session close, and by a manager exit at S's
// close (its due session moved past S on a copy of the store, test-constructed). The endpoint row, the result and the
// result packet must be the SAME, but for the fields that name the difference: the endpoint's kind, its due session,
// the exit's own record, the settlement record's reason — and the packet's hash, which seals them.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { exitIdeaByManager, valuationFromRowMarks, EXIT_OUTCOME } from './managerExit.js';
import { sessionAfter, nextSessionDate } from './windows.js';
import { makeMandateFakeDb } from '../__testsupport__/mandateFakeFirestore.js';
import { verifyPacket, resultPacketPartProblems } from './evidence.js';
import {
  seedBook, contractOf, admitAndEnter, closeOn, closeNowOf, windowAt, getIdea, getBook, DAYS,
} from './__testsupport__/fixtures.js';
import { admitIdea } from './admission.js';
import { ADMIT_ISO } from './__testsupport__/fixtures.js';

let restore;
let errSpy;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { restore(); errSpy.mockRestore(); });

const QUOTES = (i) => ({ AAPL: 230 + i, SPY: 590 + i / 2 });
const cloneDb = (db) => makeMandateFakeDb(Object.fromEntries([...db._store.entries()].map(([p, e]) => [p, structuredClone(e.data)])));
const without = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/** One short idea (AAPL, same stock held), entered D1, closed every session through the one before `upTo`. */
async function historyUpTo(upToExclusive) {
  const ctx = await seedBook();
  const { ideaId } = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ slot: 'short', names: ['AAPL'] }), quotes: QUOTES(0) });
  let i = 0;
  for (let s = DAYS.d1; s < upToExclusive; s = nextSessionDate(s)) {
    i += 1;
    if (s !== DAYS.d1) for (const slot of ['open30', 'midday', 'preClose']) await windowAt(ctx.db, ctx.bookId, { date: s, slot, quotes: QUOTES(i) });
    expect((await closeOn(ctx.db, ctx.bookId, s, QUOTES(i))).closed).toBe(true);
  }
  return { ...ctx, ideaId, i };
}

describe('the differential: a manager exit at S writes the endpoint the due-session close writes at S', () => {
  for (const [label, finalQuotes] of [['every mark fresh', (i) => QUOTES(i)], ['SPY unquoted at S: its mark CARRIED, with its source', (i) => ({ AAPL: 230 + i })]]) it(`${label}: endpoint row, result and packet are equal but for kind, due session, the exit record, the settlement reason and the seal`, { timeout: 60_000 }, async () => {
    const due = sessionAfter(DAYS.d1, 10);
    const ctx = await historyUpTo(due);
    const nowAtClose = closeNowOf(due).toISOString();
    for (const slot of ['open30', 'midday', 'preClose']) await windowAt(ctx.db, ctx.bookId, { date: due, slot, quotes: finalQuotes(ctx.i + 1) });
    // B: a copy of the store whose idea is due LATER (test-constructed), so S's close does not settle it.
    const dbB = cloneDb(ctx.db);
    const path = `mandates/${ctx.bookId}/ideas/${ctx.ideaId}`;
    const ideaB = dbB._get(path);
    dbB._store.set(path, { data: { ...ideaB, contract: { ...ideaB.contract, schedule: { ...ideaB.contract.schedule, dueSession: sessionAfter(due, 3) } } }, version: 1 });
    // A: S is the due session — the close settles it.
    expect((await closeOn(ctx.db, ctx.bookId, due, finalQuotes(ctx.i + 1))).closed).toBe(true);
    const a = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(a).toMatchObject({ status: 'settled', endpoint: { kind: 'due_session', session: due } });
    // B: the close values it; then the manager exits at S's close, at the same instant the close ran.
    expect((await closeOn(dbB, ctx.bookId, due, finalQuotes(ctx.i + 1))).closed).toBe(true);
    expect(dbB._get(path).status).toBe('holding');
    const bookRefB = dbB.collection('mandates').doc(ctx.bookId);
    const res = await exitIdeaByManager(dbB, bookRefB, { ideaId: ctx.ideaId, session: due, desk: 'archetype', reason: 'The setup failed.', nowIso: nowAtClose });
    expect(res).toMatchObject({ ok: true, outcome: EXIT_OUTCOME.SETTLED });
    const b = dbB._get(path);

    const rowA = ctx.db._get(`${path}/rows/endpoint`);
    const rowB = dbB._get(`${path}/rows/endpoint`);
    expect(without(rowB, ['endpointKind', 'dueSession', 'writtenAt'])).toEqual(without(rowA, ['endpointKind', 'dueSession', 'writtenAt']));
    expect([rowA.endpointKind, rowB.endpointKind]).toEqual(['due_session', 'manager_exit']);
    expect(without(b.result, ['endpointKind', 'managerExit', 'writtenAt'])).toEqual(without(a.result, ['endpointKind', 'writtenAt']));
    expect(b.result.managerExit).toEqual({ session: due, desk: 'archetype', reason: 'The setup failed.', decidedAt: nowAtClose });
    // Every holding waits for the ONE settlement sale; B's records say why.
    for (const [sym, h] of Object.entries(a.ledger.holdings)) {
      expect(without(b.ledger.holdings[sym].settlementPending, ['reason'])).toEqual(h.settlementPending);
      expect(b.ledger.holdings[sym].settlementPending.reason).toBe('manager_exit');
    }
    const packetA = ctx.db._get(`${path}/evidence/result`);
    const packetB = dbB._get(`${path}/evidence/result`);
    const core = (p) => ({ ...without(p, ['contentHash', 'writtenAt', 'result', 'endpoint']), endpoint: without(p.endpoint, ['kind', 'dueSession']) });
    expect(core(packetB)).toEqual(core(packetA));
    expect(verifyPacket(packetB)).toBe(true);
    const partsB = Object.fromEntries([...dbB._store.keys()].filter((p) => p.startsWith(`${path}/evidence/result_actions_`)).map((p) => [p.split('/').pop(), dbB._get(p)]));
    expect(resultPacketPartProblems(packetB, partsB)).toEqual([]);
    if (!('SPY' in finalQuotes(0))) expect(rowB.spy.holdings.SPY).toMatchObject({ markSource: expect.not.stringMatching(/^snapshot$/) });
    // The book's money did not move.
    expect(JSON.stringify(dbB._get(`mandates/${ctx.bookId}`).treasury)).toBe(JSON.stringify(getBook(ctx.db, ctx.bookId).treasury));
  });

  it('the valuation is the close\'s: every holding needs its stored mark, rounded once as the close rounds it', () => {
    const ledger = { holdings: { A: { shares: 3.333333 }, B: { shares: 1 } } };
    expect(valuationFromRowMarks(ledger, { A: { mark: 10.01, quality: 'vendor_time', markSource: 'snapshot', vendorTimeIso: 'x' }, B: { mark: 5, quality: 'carried_forward', markSource: 'carried', vendorTimeIso: null } }))
      .toEqual({ marks: { A: { mark: 10.01, quality: 'vendor_time', markSource: 'snapshot', vendorTimeIso: 'x' }, B: { mark: 5, quality: 'carried_forward', markSource: 'carried', vendorTimeIso: null } }, markedHoldingsValue: 38.37 });
    expect(valuationFromRowMarks(ledger, { A: { mark: 10 } })).toBeNull();
  });
});

describe('what an exit refuses or ignores', () => {
  it('a replay of the same session\'s exit answers what it did and writes nothing; a later session moves on; another desk may not', async () => {
    const ctx = await historyUpTo(DAYS.d3);
    const bookRef = ctx.db.collection('mandates').doc(ctx.bookId);
    const nowIso = closeNowOf(DAYS.d2).toISOString();
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: ctx.ideaId, session: DAYS.d2, desk: 'shadow', reason: 'x', nowIso })).toEqual({ ok: false, code: 'not_this_desks_idea' });
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: ctx.ideaId, session: DAYS.d1, desk: 'archetype', reason: 'x', nowIso })).toEqual({ ok: false, code: 'session_moved_on' });
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: ctx.ideaId, session: DAYS.d2, desk: 'archetype', reason: 'x', nowIso })).toMatchObject({ ok: true, outcome: 'exit_settled', idempotentReplay: false });
    const bytes = JSON.stringify([...ctx.db._store.entries()]);
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: ctx.ideaId, session: DAYS.d2, desk: 'archetype', reason: 'x', nowIso })).toMatchObject({ ok: true, outcome: 'exit_settled', idempotentReplay: true });
    expect(JSON.stringify([...ctx.db._store.entries()])).toBe(bytes);
  });

  it('an idea already selling at its line ignores the exit', async () => {
    const ctx = await historyUpTo(DAYS.d2);
    // D2's close breaches AAPL's 5% line: the holding waits for its line exit.
    for (const slot of ['open30', 'midday', 'preClose']) await windowAt(ctx.db, ctx.bookId, { date: DAYS.d2, slot, quotes: QUOTES(2) });
    expect((await closeOn(ctx.db, ctx.bookId, DAYS.d2, { AAPL: 150, SPY: 590 })).closed).toBe(true);
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('line_hit_exit_pending');
    const bookRef = ctx.db.collection('mandates').doc(ctx.bookId);
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: ctx.ideaId, session: DAYS.d2, desk: 'archetype', reason: 'x', nowIso: closeNowOf(DAYS.d2).toISOString() }))
      .toEqual({ ok: true, outcome: EXIT_OUTCOME.IGNORED_SELLING });
  });

  it('an idea not yet entered ignores the exit', async () => {
    const ctx = await seedBook();
    const admitted = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'x', nowIso: ADMIT_ISO });
    const book = getBook(ctx.db, ctx.bookId);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, execState: { ...book.execState, lastCloseKey: DAYS.admit } }, version: 9 });
    const bookRef = ctx.db.collection('mandates').doc(ctx.bookId);
    expect(await exitIdeaByManager(ctx.db, bookRef, { ideaId: admitted.ideaId, session: DAYS.admit, desk: 'archetype', reason: 'x', nowIso: closeNowOf(DAYS.admit).toISOString() }))
      .toEqual({ ok: true, outcome: EXIT_OUTCOME.IGNORED_NOT_ENTERED });
  });
});
