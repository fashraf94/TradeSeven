// api/_utils/practiceField/agentRun.b6.test.js
//
// Practice Field build B6, ruling B6-9 (B4's Q-4, review C4) — THE PASS CHECKS ITS DEADLINE BEFORE IT READS A REMAINING DESK'S
// PROMPT INPUTS. After a fire's first deferral, every later book's desk used to read its epoch, the close snapshot, its prior
// notes and its ideas' rows before finding there was no time for a call. Now a desk the fire cannot serve costs no such read.
// Nothing else moves: the desks checked, the calls and the deferrals are the same, and B4's three measurements
// (agentPassAtTwelve.test.js, its PF_B4_MEASURE lines) are unchanged — the build report compares them before and after.
// In-memory store, fake transport, injected clock.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from './mode.js';
import { runIdeaBookAgentPass, AGENT_CALL_MARGIN_MS } from './agentRun.js';
import { AGENT_CALL_TIMEOUT_MS } from './agentConfig.js';
import { createIdeaBook } from './ideaBook.js';
import { runIdeaBookEvalPass } from './sweep.js';
import { makeMandateFakeDb, etIso, DAYS, storeTickSnapshot, tickOf, slotNowOf, closeOn } from './__testsupport__/fixtures.js';
import { quotesOn, fakeTransport, toolResponse, holdAll, deskPartsOf } from './__testsupport__/agentFixtures.js';

const DATE = DAYS.d1;
const OWNERS = ['owner-a', 'owner-b', 'owner-c'];

let restoreMode;
let restoreAgent;
let errSpy;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreAgent(); restoreMode(); errSpy.mockRestore(); });

/** Three owners' books, each closed on time for DATE: every desk has work (its empty slots). */
async function threeClosedBooks() {
  const db = makeMandateFakeDb();
  const books = [];
  for (const uid of OWNERS) {
    const res = await createIdeaBook(db, { uid, attributionAgentId: `agent-${uid}`, archetypeCodeId: 'momentum_chaser', opId: `create-${uid}`, nowIso: etIso(DAYS.admit, 9, 0) });
    books.push(res.bookId);
  }
  const quotes = quotesOn();
  for (const slot of ['open30', 'midday', 'preClose']) {
    await storeTickSnapshot(db, DATE, slot, quotes);
    await runIdeaBookEvalPass(db, { tick: tickOf(DATE, slot), now: slotNowOf(DATE, slot), ownerToken: `w-${slot}` });
  }
  for (const bookId of books) expect((await closeOn(db, bookId, DATE, quotes)).closed, bookId).toBe(true);
  return { db, books };
}

/** The store, logging the path of every document read (a ref's `get`, in or out of a transaction). */
function readLogged(db) {
  const log = [];
  const wrap = (obj) => new Proxy(obj, {
    get(target, prop) {
      const v = target[prop];
      if (prop === 'get' && typeof v === 'function' && typeof target.path === 'string') return (...a) => { log.push(target.path); return v.apply(target, a); };
      if (prop === 'runTransaction' && typeof v === 'function') {
        return (fn, ...rest) => v.call(target, (tx) => fn(new Proxy(tx, { get(t, p) { const f = t[p]; return p === 'get' ? (ref, ...a) => { log.push(ref?.path ?? '?'); return f.call(t, ref, ...a); } : (typeof f === 'function' ? f.bind(t) : f); } })), ...rest);
      }
      if (['collection', 'doc', 'where', 'orderBy', 'limit'].includes(prop) && typeof v === 'function') return (...a) => wrap(v.apply(target, a));
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return { db: wrap(db), log };
}
/** A read of a desk's prompt inputs: the epoch, the close snapshot, a prior note's close row of an EARLIER session, an idea row. */
const promptInputRead = (p) => /\/epochs\//.test(p) || p.startsWith('mandateUniverseSnapshots/') || /\/ideas\/[^/]+\/rows\//.test(p)
  || (/\/windows\/\d{4}-\d{2}-\d{2}_close$/.test(p) && !p.endsWith(`/${DATE}_close`));

describe('B6-9 — the deadline before the reads', () => {
  it('after the fire\'s first deferral, no remaining desk reads its prompt inputs; the desks checked, the calls and the deferrals are as before', async () => {
    const { db: store, books } = await threeClosedBooks();
    const { db, log } = readLogged(store);
    const start = new Date(`${DATE}T21:30:00.000Z`).getTime();
    let now = start;
    const clock = () => new Date(now);
    // Each call takes 200 s of the fire's 290: the first desk is served; every desk after it is past the deadline.
    const callMs = 200_000;
    const deadlineMs = start + 290_000;
    expect(start + AGENT_CALL_TIMEOUT_MS + AGENT_CALL_MARGIN_MS).toBeLessThanOrEqual(deadlineMs);
    expect(start + callMs + AGENT_CALL_TIMEOUT_MS + AGENT_CALL_MARGIN_MS).toBeGreaterThan(deadlineMs);
    let readsAtFirstDeferral = null;
    const fake = fakeTransport((ctx) => { now += callMs; readsAtFirstDeferral = log.length; return toolResponse(holdAll(ctx.request)); });
    const out = await runIdeaBookAgentPass(db, { date: DATE, now: new Date(start), ownerToken: 'fire-1', deadlineMs, transport: fake.transport, clock });
    // As before: three books visited, one desk served by one call, and each book's pass stops at its first deferral.
    expect(out).toMatchObject({ books: 3, checked: 1, calls: 1, deferred: 3, errors: 0, fallbacks: 0, leaseSkips: 0 });
    expect(fake.calls).toHaveLength(1);
    // The reads after the one call: the books, their close rows, their ideas, the leases — and no prompt input.
    const after = log.slice(readsAtFirstDeferral);
    expect(after.filter(promptInputRead)).toEqual([]);
    // (Not vacuous: the served desk read its prompt inputs before its call.)
    expect(log.slice(0, readsAtFirstDeferral).filter(promptInputRead).length).toBeGreaterThan(0);
    // The deferred desks wrote nothing: their parts are absent from their close rows; the served desk's is done.
    const parts = books.map((b) => deskPartsOf(store, b, DATE));
    expect(parts.flatMap((p) => Object.values(p || {})).filter(Boolean).map((p) => p.status)).toEqual(['done']);
  });

  it('a desk mid-way (one attempt made) reached past the deadline: deferred with no read and no write — its part keeps its attempt as recorded', async () => {
    const { db: store, books } = await threeClosedBooks();
    const start = new Date(`${DATE}T21:30:00.000Z`).getTime();
    let now = start;
    // Fire 1: the first desk's call times out (the fake throws after 200 s); its retry no longer fits: deferred mid-way.
    const timeout = Object.assign(new Error('fixture transport error: agent_call_timeout'), { code: 'agent_call_timeout' });
    const first = fakeTransport(() => { now += 200_000; return timeout; });
    await runIdeaBookAgentPass(store, { date: DATE, now: new Date(start), ownerToken: 'fire-1', deadlineMs: start + 290_000, transport: first.transport, clock: () => new Date(now) });
    const midway = books.map((b) => deskPartsOf(store, b, DATE)).flatMap((p) => Object.entries(p || {})).find(([, part]) => part?.status === 'in_progress');
    expect(midway).toBeTruthy();
    const [desk, part] = midway;
    expect(part.attempts).toHaveLength(1);
    const book = books.find((b) => deskPartsOf(store, b, DATE)?.[desk] === part || JSON.stringify(deskPartsOf(store, b, DATE)?.[desk]) === JSON.stringify(part));
    const before = JSON.stringify(store._get(`mandates/${book}/windows/${DATE}_close`));
    // Fire 2 reaches it already past its deadline: no call, no prompt-input read, and its close row untouched.
    const { db, log } = readLogged(store);
    const second = fakeTransport(() => toolResponse(holdAll({})));
    const start2 = start + 900_000;
    const out = await runIdeaBookAgentPass(db, { date: DATE, now: new Date(start2), ownerToken: 'fire-2', deadlineMs: start2 + 1_000, transport: second.transport, clock: () => new Date(start2) });
    expect(second.calls).toHaveLength(0);
    expect(out.calls).toBe(0);
    expect(log.filter(promptInputRead)).toEqual([]);
    expect(JSON.stringify(store._get(`mandates/${book}/windows/${DATE}_close`))).toBe(before);
  });
});
