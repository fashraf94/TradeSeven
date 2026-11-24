// api/_utils/practiceField/agentIsolation.test.js
//
// Practice Field build B2 — WITH THE AGENT'S SWITCHES OFF, NOTHING CHANGES (rule 4: "every fire is byte-identical to
// main"), and the one build input the agent adds (§2) — the shared candidate universe in a DRAFTING close's snapshot —
// is gated on the agent's switch AND a book that may draft. With the EODHD calls a drafting close adds, measured.
//
// The fires themselves are proven identical by the engine's own suites, unchanged on this tree
// (api/cron/practiceFieldNoBook.trace.test.js, practiceFieldIsolation.test.js, endToEnd.test.js); the base-against-head
// form is in the build report §4.

import { describe, it, expect, afterEach } from 'vitest';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests, practiceFieldAgentOn, practiceFieldAgentThesesOn } from './mode.js';
import { runIdeaBookAgentPass } from './agentRun.js';
import { practiceFieldBuildInputs, ideaBookMayDraft } from './sweep.js';
import { ensureUniverseSnapshot } from '../mandateUniverseSnapshot.js';
import { CANDIDATE_UNIVERSE } from '../mandateCandidateUniverse.js';
import { MANDATE_QUOTE_BATCH_SIZE } from '../mandateConfig.js';
import { makeMandateFakeDb } from '../__testsupport__/mandateFakeFirestore.js';
import { seedBook, getBook } from './__testsupport__/fixtures.js';

let restores = [];
afterEach(() => { for (const r of restores.reverse()) r(); restores = []; });
const set = (mode, agent = {}) => { restores.push(setPracticeFieldModeForTests(mode)); restores.push(setPracticeFieldAgentForTests(agent)); };

/** A database that counts every collection it is asked for (a read or a write starts there). */
function countingDb(db) {
  const counts = { collection: 0 };
  return { counts, db: new Proxy(db, { get(t, k) { if (k === 'collection') return (...a) => { counts.collection += 1; return t.collection(...a); }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }) };
}

describe('the switches', () => {
  it('shipped OFF: the agent and the saved theses are off whatever the mode', () => {
    for (const mode of ['off', 'allowlist', 'on']) {
      set(mode, { agent: null, theses: null });
      expect([mode, practiceFieldAgentOn(), practiceFieldAgentThesesOn()]).toEqual([mode, false, false]);
    }
  });
  it('the theses need the agent; the agent needs the mode', () => {
    set('on', { agent: false, theses: true });
    expect(practiceFieldAgentThesesOn()).toBe(false);
    set('off', { agent: true, theses: true });
    expect([practiceFieldAgentOn(), practiceFieldAgentThesesOn()]).toEqual([false, false]);
    set('on', { agent: true, theses: true });
    expect([practiceFieldAgentOn(), practiceFieldAgentThesesOn()]).toEqual([true, true]);
  });
});

describe('with the agent off, the pass reads nothing and calls nothing', () => {
  it('not even the query: zero collections asked for, no transport call', async () => {
    set('on', { agent: false });
    const ctx = await seedBook();
    const { db, counts } = countingDb(ctx.db);
    let called = 0;
    const out = await runIdeaBookAgentPass(db, { date: '2026-11-16', ownerToken: 't', transport: async () => { called += 1; } });
    expect(out).toEqual({ books: 0, checked: 0, calls: 0, fallbacks: 0, deferred: 0, errors: 0, leaseSkips: 0 });
    expect(counts.collection).toBe(0);
    expect(called).toBe(0);
  });
});

describe('the close snapshot\'s inputs (§2: a sweep.js build-input change, gated)', () => {
  const emptyBook = { kind: 'idea_book', bookId: 'pf_b', status: 'active', drafting: 'on', windDown: null, slots: { short: null, medium: 'idea_x', long: null } };
  const fullBook = { ...emptyBook, slots: { short: 'a', medium: 'b', long: 'c' } };
  const inputs = (db, over) => practiceFieldBuildInputs(db, { ideaHeldTickers: ['JPM'], quarterlyActive: false, ideaBookIds: [], ...over });
  /** A store whose full book holds three ideas of the given statuses. */
  const withIdeas = (statuses) => makeMandateFakeDb(Object.fromEntries(['a', 'b', 'c'].map((id, i) => [`mandates/pf_b/ideas/${id}`, { ideaId: id, status: statuses[i] }])));

  it('UNCHANGED with the agent off — on the close fire too — on any slot tick, and with no book that may draft', async () => {
    const db = withIdeas(['holding', 'holding', 'holding']);
    set('on', { agent: false });
    const base = await inputs(db, {});
    expect(base.tick).toMatchObject({ candidateUniverse: [], minCandidateCapacity: 0 });
    expect(JSON.stringify(await inputs(db, { closeTick: true, ideaBooks: [emptyBook] }))).toBe(JSON.stringify(base));
    set('on', { agent: true });
    expect(JSON.stringify(await inputs(db, { closeTick: false, ideaBooks: [emptyBook] }))).toBe(JSON.stringify(base));
    expect(JSON.stringify(await inputs(db, { closeTick: true, ideaBooks: [fullBook] }))).toBe(JSON.stringify(base));
    expect(JSON.stringify(await inputs(db, { closeTick: true, ideaBooks: [{ ...emptyBook, drafting: 'paused' }] }))).toBe(JSON.stringify(base));
    expect(JSON.stringify(await inputs(db, { closeTick: true, ideaBooks: [{ ...emptyBook, status: 'draining' }] }))).toBe(JSON.stringify(base));
    expect(ideaBookMayDraft(emptyBook)).toBe(true);
    expect(ideaBookMayDraft({ ...emptyBook, windDown: { requestedAt: 'x' } })).toBe(false);
  });

  it('review B-1: a full book whose slot may FREE at this close (an entry timing out; an idea resolving) keeps the universe too', async () => {
    set('on', { agent: true });
    const base = await inputs(withIdeas(['holding', 'holding', 'holding']), { closeTick: true, ideaBooks: [fullBook] });
    expect(base.tick).toMatchObject({ candidateUniverse: [] });
    for (const status of ['accepted', 'line_hit_exit_pending', 'settled']) {
      const out = await inputs(withIdeas(['holding', status, 'holding']), { closeTick: true, ideaBooks: [fullBook] });
      expect(out.tick, status).not.toHaveProperty('candidateUniverse');
    }
    // An idea that cannot be read counts as one that may free: the universe is kept (one more quote call, never one fewer).
    expect((await inputs(makeMandateFakeDb(), { closeTick: true, ideaBooks: [fullBook] })).tick).not.toHaveProperty('candidateUniverse');
  });

  it('a DRAFTING close keeps the default candidate universe in its snapshot — its quotes only: the daily build is unchanged', async () => {
    const db = makeMandateFakeDb();
    set('on', { agent: false });
    const base = await inputs(db, {});
    set('on', { agent: true });
    const drafting = await inputs(db, { closeTick: true, ideaBooks: [emptyBook] });
    expect(drafting.tick).not.toHaveProperty('candidateUniverse');
    expect(drafting.tick).toMatchObject({ minCandidateCapacity: 0, coverageTickers: base.tick.coverageTickers });
    expect(JSON.stringify(drafting.daily)).toBe(JSON.stringify(base.daily));
  });

  it('MEASURED: the EODHD quote calls a drafting close adds (one counted call per batch of MANDATE_QUOTE_BATCH_SIZE)', async () => {
    const count = async (tickInputs) => {
      const db = makeMandateFakeDb();
      let calls = 0;
      const fetchQuotes = async (syms) => { calls += 1; return Object.fromEntries(syms.map((s) => [s, { close: 100, timestamp: 1_763_400_000 }])); };
      const built = await ensureUniverseSnapshot(db, { tickKey: '2026-11-16_close', sessionDate: '2026-11-16', heldTickers: [], now: new Date('2026-11-16T21:20:00Z'), fetchQuotes, ...tickInputs });
      return { calls, upstream: built.upstreamCalls, symbols: Object.keys(built.snapshot.symbols).length };
    };
    const coverage = ['JPM', 'BAC', 'GS', 'XLF', 'SPY'];
    set('on', { agent: true });
    const plain = await count({ candidateUniverse: [], minCandidateCapacity: 0, coverageTickers: coverage });
    const drafting = await count({ minCandidateCapacity: 0, coverageTickers: coverage });
    console.log(`PF_AGENT_EODHD ${JSON.stringify({ plain, drafting, universe: CANDIDATE_UNIVERSE.length, batch: MANDATE_QUOTE_BATCH_SIZE })}`);
    expect(plain.calls).toBe(1);
    expect(drafting.calls).toBe(Math.ceil((CANDIDATE_UNIVERSE.length + 2) / MANDATE_QUOTE_BATCH_SIZE)); // JPM, BAC, GS are candidates too; XLF and SPY are not
    expect(drafting.calls - plain.calls).toBe(1);
  });
});

describe('the founder\'s live book, as it stands, is untouched by merging this build', () => {
  it('an existing book with the agent off: a pass over it changes not one byte', async () => {
    set('on', { agent: null, theses: null }); // the agent's switches as shipped (off); 'on' so the fixture can create the book
    const ctx = await seedBook();
    const before = JSON.stringify([...ctx.db._store.entries()]);
    await runIdeaBookAgentPass(ctx.db, { date: '2026-11-16', ownerToken: 't', transport: async () => { throw new Error('no call'); } });
    expect(JSON.stringify([...ctx.db._store.entries()])).toBe(before);
    expect(getBook(ctx.db, ctx.bookId).spend).toBeUndefined();
  });
});
