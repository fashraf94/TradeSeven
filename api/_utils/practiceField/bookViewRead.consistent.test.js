// api/_utils/practiceField/bookViewRead.consistent.test.js
//
// Practice Field build B5 — ONE CONSISTENT BOOK (ruling B5-4; bookViewRead.js's header). Astra's two recorded cases, as
// she wrote them, each through the REAL engine on the in-memory store — the admission, the entry, closeIdeaBook, the
// founder's ruling, the agent's run and the window sale — with a close committed IN THE MIDDLE of the reader's pass:
//   B3-C01  (docs/audits/20261124_ASTRA_CONFIRMATION_B3.md) Tuesday's book and daily row agree while the idea document is
//           Wednesday's, after a close that cleared a hold beside a carried mark: either settled answer, never the mixed one
//   R5      (the B3 build report §9.7) a close landing after the first reads and before the History read: an idea both live
//           and finished
//   the two-pass stop: a close in EACH pass answers "try again"
// And the reader on every scene with its epoch and agent gives exactly the view built from the same records.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { readBookView, BOOK_READ_PASSES, bookChangeMarks } from './bookViewRead.js';
import { buildBookView } from './bookView.js';
import { nextSessionDate } from './windows.js';
import { admitIdea } from './admission.js';
import { deskOfIdea } from './agentConfig.js';
import { toCents } from './money.js';
import {
  seedBook, admitAndEnter, contractOf, closeOn, founderRules, takeSeededDbs, makeMandateFakeDb, storeTickSnapshot, catchUpAt, enterAt,
  windowAt, ADMIT_ISO, DAYS,
} from './__testsupport__/fixtures.js';
import { runBookHistory, scriptedDesks, EXIT_SESSION } from './__testsupport__/bookViewFixtures.js';
import { quotesOn, fakeTransport, runSession } from './__testsupport__/agentFixtures.js';
import { SCENE_NAMES, SCENE_UID } from './__testsupport__/bookViewScenes.js';
import { hubSceneInput, hubSceneDocs } from './__testsupport__/bookViewScenesHub.js';

const S = ['2026-11-16'];
while (S.length < 8) S.push(nextSessionDate(S.at(-1)));
const UID = 'owner-1';
const group = (v, slot) => v.groups.find((g) => g.slot === slot);
const name = (g, sym) => g.names.find((n) => n.symbol === sym);

/**
 * The store, with hooks the test runs INSIDE the reader's reads: `onDoc(path)` before a document read, `onQuery(path)` after
 * a query's answer. Paths are the documents' and collections' own. Every read still goes to the store.
 */
function racing(db, { onDoc = async () => {}, onQuery = async () => {} } = {}) {
  const wrapQuery = (path, q) => ({
    where: (...a) => wrapQuery(path, q.where(...a)),
    orderBy: (...a) => wrapQuery(path, q.orderBy(...a)),
    limit: (n) => wrapQuery(path, q.limit(n)),
    get: async () => { const s = await q.get(); await onQuery(path); return s; },
  });
  const wrapDoc = (path, d) => ({ id: d.id, get: async () => { await onDoc(path); return d.get(); }, collection: (n) => wrapCol(`${path}/${n}`, d.collection(n)) });
  const wrapCol = (path, c) => ({ ...wrapQuery(path, c), doc: (id) => wrapDoc(`${path}/${id}`, c.doc(id)) });
  return { collection: (n) => wrapCol(n, db.collection(n)) };
}

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  takeSeededDbs();
  vi.stubEnv('EODHD_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
});
afterEach(() => {
  restoreMode();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  takeSeededDbs();
});

describe('B3-C01: a close that clears a hold beside a carried mark, landing while the idea document is read', () => {
  const Q = (aapl, msft, over = {}) => ({ AAPL: { price: aapl, marketCap: 3e12, ...over }, MSFT: { price: msft, marketCap: 3e12 }, SPY: 500, XLK: 233.59 });
  const dv = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 1, source: 'eodhd_dividends' };

  it('Astra\'s row: either settled answer (Tue waiting, Wed $10,246.93) — never MSFT at $10,096.97, +$96.97, +$99.97 under "Waiting on data"', async () => {
    // Her two-name R2 fixture: AAPL 100 and MSFT 200 on Monday; Tuesday at 99 and 202 with conflicting AAPL dividends of $1
    // and $1.50 (AAPL's mark carried, MSFT's vendor-timed, the idea row below full quality); the founder's "none" ruling.
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: Q(100, 200), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100, 200));
    await closeOn(c.db, c.bookId, S[1], Q(99, 202, { corporateActions: [dv, { ...dv, amount: 1.5, source: 'founder' }] }));
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' });
    const base = `mandates/${c.bookId}`;
    const settledTue = (await readBookView(c.db, { uid: UID })).book;
    expect(settledTue.day).toBe('Tue 17 Nov');
    expect(name(group(settledTue, 'short'), 'MSFT').state).toBe('waiting');
    const tue = { book: c.db._get(base), daily: c.db._get(`${base}/dailyRows/${S[1]}`), dailyPrev: c.db._get(`${base}/dailyRows/${S[0]}`), row: c.db._get(`${base}/ideas/${c.ideaId}/rows/${S[1]}`), rowPrev: c.db._get(`${base}/ideas/${c.ideaId}/rows/${S[0]}`) };

    // The read: its daily query captures Tuesday; the live idea document's read is held; the real Wednesday close commits
    // at 99 and 205; then the idea read finishes (Wednesday's idea).
    let captured;
    const dailyDone = new Promise((res) => { captured = res; });
    let raced = 0;
    let bookReads = 0;
    const db = racing(c.db, {
      onQuery: async (path) => { if (path === `${base}/dailyRows`) captured(); },
      onDoc: async (path) => {
        if (path === base) bookReads += 1;
        if (raced === 0 && path === `${base}/ideas/${c.ideaId}`) {
          raced = 1;
          await dailyDone;
          await closeOn(c.db, c.bookId, S[2], Q(99, 205));
        }
      },
    });
    const answer = await readBookView(db, { uid: UID });
    expect(raced).toBe(1);
    expect(bookReads).toBe(2 * BOOK_READ_PASSES); // two passes, each bracketed by two reads of the book
    const settledWed = (await readBookView(c.db, { uid: UID })).book;
    expect(settledWed.day).toBe('Wed 18 Nov');
    expect(name(group(settledWed, 'short'), 'MSFT')).toMatchObject({ state: 'held', mark: '205.00', positionValue: '$10,246.93', plOpen: { text: '+$246.93' } });
    // The answer is one of the settled ones, whole — here Wednesday's, the second pass's.
    expect([JSON.stringify(settledTue), JSON.stringify(settledWed)]).toContain(JSON.stringify(answer.book));
    expect(answer.book.day).toBe('Wed 18 Nov');

    // The control: the mixed answer a single pass could give (Tuesday's book, rows and daily rows with Wednesday's idea), as
    // Astra measured it — so the row above can fail.
    const wedIdea = c.db._get(`${base}/ideas/${c.ideaId}`);
    const mixed = buildBookView({
      book: { ...tue.book, bookId: c.bookId }, ideas: [{ ...wedIdea, ideaId: c.ideaId }],
      rows: new Map([[c.ideaId, { last: tue.row, prev: tue.rowPrev }]]), dailyRows: { last: tue.daily, prev: tue.dailyPrev },
    });
    expect(mixed.day).toBe('Tue 17 Nov');
    expect(mixed.line.waiting).not.toBeNull();
    expect(name(group(mixed, 'short'), 'MSFT')).toMatchObject({ mark: '202.00', positionValue: '$10,096.97', plOpen: { text: '+$96.97' }, plDay: { text: '+$99.97' } });
    expect(JSON.stringify(answer.book)).not.toBe(JSON.stringify(mixed));
  });

  it('the book\'s change marks: a close moves them (its revision and its session); nothing else the read needs moves without them', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 }, date: S[0] });
    expect(r.ideaId).toBeTruthy();
    const before = c.db._get(`mandates/${c.bookId}`);
    await closeOn(c.db, c.bookId, S[0], { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 });
    const after = c.db._get(`mandates/${c.bookId}`);
    expect(after.revision).toBe(before.revision + 1);
    expect([before.execState.lastCloseKey ?? null, after.execState.lastCloseKey]).toEqual([null, S[0]]);
    expect(bookChangeMarks(after)).not.toBe(bookChangeMarks(before));
    expect(bookChangeMarks({ ...after, drafting: 'paused', health: {} })).toBe(bookChangeMarks(after));
  });
});

describe('R5: a close landing after the first reads and before the History read', () => {
  it('the refuter\'s row on the B2 run: the 23 Nov window sale and close land during the History query — the idea is never both live and finished', { timeout: 60_000 }, async () => {
    let checked = false;
    await runBookHistory({
      n: 5,
      onSession: async (date, i, c) => {
        if (date !== EXIT_SESSION) return;
        const base = `mandates/${c.bookId}`;
        // 20 Nov, settled: the short idea (XOM) called Exit and sells at the next session's first window.
        const settled20 = (await readBookView(c.db, { uid: c.uid, agentOn: true })).book;
        expect(group(settled20, 'short')).toMatchObject({ state: 'selling', namesText: 'XOM' });
        expect(settled20.history.items.some((h) => h.namesText === 'XOM')).toBe(false);
        // The read: its History query is answered, then the whole 23 Nov session (the window sale, the close) commits.
        const next = nextSessionDate(EXIT_SESSION);
        const fake = fakeTransport(scriptedDesks(() => next));
        let raced = false;
        const db = racing(c.db, {
          onQuery: async (path) => {
            if (!raced && path === `${base}/ideas`) {
              raced = true;
              await runSession(c.db, c.bookId, next, { quotes: quotesOn({ drift: 5 * 0.002 }), transport: fake.transport });
            }
          },
        });
        const answer = (await readBookView(db, { uid: c.uid, agentOn: true })).book;
        expect(raced).toBe(true);
        const settled23 = (await readBookView(c.db, { uid: c.uid, agentOn: true })).book;
        expect(settled23.history.items[0]).toMatchObject({ namesText: 'XOM', endedOn: '23 Nov' });
        expect(JSON.stringify(answer)).toBe(JSON.stringify(settled23));
        // R5's mixed answer: the sold idea still holding or selling in its slot while History has it. (The archetype desk's
        // fresh draft at the 23 Nov close may name XOM again — a NEW idea, entering, not the finished one.)
        const live = answer.groups.filter((g) => ['holding', 'selling'].includes(g.state)).map((g) => g.namesText);
        const done = answer.history.items.map((h) => h.namesText);
        expect(live.filter((n) => done.includes(n))).toEqual([]);
        expect(group(answer, 'short').state).not.toBe('selling');
        checked = true;
      },
    });
    expect(checked).toBe(true);
  });
});

describe('the two-pass stop (B5-4)', () => {
  it('a close in each pass: { tryAgain: true } after exactly two passes; a quiet read then answers whole', async () => {
    const Q = (p) => ({ AAPL: { price: p, marketCap: 3e12 }, SPY: 500 });
    const c = await seedBook();
    await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: Q(100), date: S[0] });
    await closeOn(c.db, c.bookId, S[0], Q(100));
    const base = `mandates/${c.bookId}`;
    const closes = [() => closeOn(c.db, c.bookId, S[1], Q(101)), () => closeOn(c.db, c.bookId, S[2], Q(102)), () => closeOn(c.db, c.bookId, S[3], Q(103))];
    let dailyQueries = 0;
    const db = racing(c.db, { onQuery: async (path) => { if (path === `${base}/dailyRows`) { dailyQueries += 1; await closes.shift()(); } } });
    expect(await readBookView(db, { uid: UID })).toEqual({ tryAgain: true });
    expect(dailyQueries).toBe(BOOK_READ_PASSES);
    expect(closes).toHaveLength(1); // the third close never ran: no third pass
    expect(BOOK_READ_PASSES).toBe(2);
    expect((await readBookView(c.db, { uid: UID })).book.day).toBe('Wed 18 Nov');
  });

  it('a close in the first pass only: the second pass answers, whole', async () => {
    const Q = (p) => ({ AAPL: { price: p, marketCap: 3e12 }, SPY: 500 });
    const c = await seedBook();
    await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: Q(100), date: S[0] });
    await closeOn(c.db, c.bookId, S[0], Q(100));
    const base = `mandates/${c.bookId}`;
    let once = false;
    const db = racing(c.db, { onDoc: async (path) => { if (!once && path.startsWith(`${base}/windows/`)) { once = true; await closeOn(c.db, c.bookId, S[1], Q(101)); } } });
    const answer = await readBookView(db, { uid: UID });
    expect(JSON.stringify(answer)).toBe(JSON.stringify(await readBookView(c.db, { uid: UID })));
    expect(answer.book.day).toBe('Tue 17 Nov');
  });
});

describe('a money move between closes moves the book\'s revision: the read sees it too (B5-4, "any other change to it")', () => {
  it('a fill landing while the idea document is read, on a book with no close yet — never the pre-fill cash beside the bought idea', async () => {
    const Q = (p) => ({ AAPL: { price: p, marketCap: 3e12 }, SPY: 500 });
    const c = await seedBook();
    const a = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ names: ['AAPL'] }), opId: 'idea-1', nowIso: ADMIT_ISO });
    expect(a.ok).toBe(true);
    await storeTickSnapshot(c.db, DAYS.d1, 'open30', Q(100));
    await catchUpAt(c.db, c.bookId, { date: DAYS.d1, slot: 'open30' });
    const base = `mandates/${c.bookId}`;
    const before = (await readBookView(c.db, { uid: UID })).book;
    expect(group(before, 'short').state).toBe('entering');
    const revision = c.db._get(base).revision;
    let raced = false;
    const db = racing(c.db, {
      onDoc: async (path) => {
        if (!raced && path === `${base}/ideas/${a.ideaId}`) { raced = true; await enterAt(c.db, c.bookId, a.ideaId, { date: DAYS.d1, slot: 'open30' }); }
      },
    });
    const answer = (await readBookView(db, { uid: UID })).book;
    expect(raced).toBe(true);
    // The fill moved the book's revision and nothing else of its marks (no close).
    expect(c.db._get(base).revision).toBe(revision + 1);
    expect(c.db._get(base).execState.lastCloseKey ?? null).toBeNull();
    const after = (await readBookView(c.db, { uid: UID })).book;
    expect(group(after, 'short').state).toBe('holding');
    expect(after.line.cash).not.toBe(before.line.cash);
    expect(JSON.stringify(answer)).toBe(JSON.stringify(after));
  });
});

describe('B5-2 through the reader: an idea finished since the last close is counted by its row of that close', () => {
  it('on the B2 run: XOM sold at the 23 Nov first window (finished, in History) — the archetype desk\'s use is still its 20 Nov row', { timeout: 60_000 }, async () => {
    let checked = false;
    await runBookHistory({
      n: 5,
      onSession: async (date, i, c) => {
        if (date !== EXIT_SESSION) return;
        const base = `mandates/${c.bookId}`;
        const next = nextSessionDate(EXIT_SESSION);
        await windowAt(c.db, c.bookId, { date: next, slot: 'open30', quotes: quotesOn({ drift: 5 * 0.002 }) });
        const v = (await readBookView(c.db, { uid: c.uid, agentOn: true })).book;
        expect(v.day).toBe('Fri 20 Nov');
        expect(group(v, 'short').state).toBe('open');
        expect(v.history.items[0]).toMatchObject({ namesText: 'XOM', endedOn: '23 Nov' });
        // The stored rows of the 20 Nov close, by desk.
        const used = { shadow: 0, archetype: 0 };
        for (const p of [...c.db._store.keys()].filter((k) => new RegExp(`^${base}/ideas/[^/]+$`).test(k))) {
          const row = c.db._get(`${p}/rows/${EXIT_SESSION}`);
          if (row) used[deskOfIdea(c.db._get(p))] += toCents(row.markedHoldingsValue);
        }
        expect(used.archetype).toBeGreaterThan(0);
        const amount = (key) => { const t = v.split.parts.find((x) => x.key === key).use.amount.text; return Math.round(Number(t.replace(/[^0-9.]/g, '')) * 100); };
        expect([amount('archetype'), amount('agent')]).toEqual([used.archetype, used.shadow]);
        checked = true;
      },
    });
    expect(checked).toBe(true);
  });
});

describe('the reader on every scene with its epoch and agent', () => {
  it('gives exactly the view built from the same records', async () => {
    for (const n of SCENE_NAMES) {
      const input = hubSceneInput(n);
      const stored = (await readBookView(makeMandateFakeDb(hubSceneDocs(n)), { uid: SCENE_UID, agentOn: input.agentOn })).book;
      expect(JSON.stringify(stored), n).toBe(JSON.stringify(buildBookView(input)));
    }
  }, 60_000);
});
