// api/_utils/practiceField/bookView.e2e.test.js
//
// Practice Field build B3 — THE VIEW AGAINST A REAL RUN OF THE ENGINE (B3 "Tests: the figures"). The B2 end-to-end history
// (__testsupport__/bookViewFixtures.js, a copy of agentEndToEnd.test.js's run, so that file's pinned dump never moves):
// thirteen sessions of the founder's book on the in-memory harness, both desks checking at every close, an early exit, a
// failed call and the 27 Nov early close. After EVERY close the screen's reader runs, and its book line, groups and names
// must agree with the stored rows to the cent; the reads it makes are counted against the reader's own bound; and no id
// leaves it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { readBookView } from './bookViewRead.js';
import { allotCents, pctText } from './bookView.js';
import { toCents } from './money.js';
import { nextSessionDate } from './windows.js';
import { runBookHistory, historySessions, EARLY_CLOSE, EXIT_SESSION, FAIL_SESSION } from './__testsupport__/bookViewFixtures.js';

const cents = (text) => {
  const neg = text.startsWith('−');
  const n = Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
  return neg ? -n : n;
};
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};

/** The store, counting every document and query read the reader makes (a query counts its documents too). */
function counting(db) {
  const count = { docs: 0, queries: 0 };
  const wrapQuery = (q) => ({
    where: (...a) => wrapQuery(q.where(...a)),
    orderBy: (...a) => wrapQuery(q.orderBy(...a)),
    limit: (n) => wrapQuery(q.limit(n)),
    get: async () => { const s = await q.get(); count.queries += 1; count.docs += s.size; return s; },
  });
  const wrapDoc = (d) => ({
    id: d.id,
    get: async () => { count.docs += 1; return d.get(); },
    collection: (n) => wrapCol(d.collection(n)),
  });
  const wrapCol = (c) => ({ ...wrapQuery(c), doc: (id) => wrapDoc(c.doc(id)) });
  return { db: { collection: (n) => wrapCol(db.collection(n)) }, count };
}

let restoreMode;
let errSpy;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreMode(); errSpy.mockRestore(); });

describe('the view after every close of the B2 history agrees with the stored rows to the cent', () => {
  it('the book line, the groups and the names, at each of thirteen closes; reads bounded; no id', { timeout: 60_000 }, async () => {
    const seen = [];
    const days = historySessions(13);
    const { ctx } = await runBookHistory({
      n: 13,
      onSession: async (date, i, c) => {
        const { db, count } = counting(c.db);
        const { book: v } = await readBookView(db, { uid: c.uid, agentOn: true });
        const base = `mandates/${c.bookId}`;
        const book = c.db._get(base);
        const last = c.db._get(`${base}/dailyRows/${date}`);
        const prevDate = days[i - 1] ?? null;
        const prev = prevDate ? c.db._get(`${base}/dailyRows/${prevDate}`) : null;

        // The book line: the stored equity and cash; today's change against the close before.
        expect(cents(v.line.value), date).toBe(toCents(last.markedEquity));
        expect(cents(v.line.cash), date).toBe(toCents(last.treasuryCash) + toCents(last.reservedCash));
        if (prev && last.fullQuality && prev.fullQuality) {
          const diff = toCents(last.markedEquity) - toCents(prev.markedEquity);
          expect(cents(v.line.today.text), date).toBe(diff);
          expect(v.line.today.pct, date).toBe(pctText((diff * 100) / toCents(prev.markedEquity)));
        }
        const sinceCents = toCents(last.markedEquity) - toCents(book.portfolio.initialValue);
        expect(v.line.first, date).toMatchObject({ kind: 'since', label: 'Since 16 Nov', value: pctText((sinceCents * 100) / toCents(book.portfolio.initialValue)) });

        // Each live group: its gap is its row's; its names' values sum to the row's holdings value; each P/L to the cent.
        for (const g of v.groups.filter((x) => x.state === 'holding' || x.state === 'selling')) {
          const ideaId = book.slots[g.slot];
          const idea = c.db._get(`${base}/ideas/${ideaId}`);
          const row = c.db._get(`${base}/ideas/${ideaId}/rows/${date}`);
          if (!row) continue;
          expect(cents(g.gap.text), `${date} ${g.slot}`).toBe(toCents(row.markedGapUsd));
          expect(cents(g.gap.spy.text), `${date} ${g.slot}`).toBe(toCents(row.markedGapToSpyUsd));
          const held = g.names.filter((n) => n.state === 'held' || n.state === 'line_hit');
          expect(held.reduce((s, n) => s + cents(n.positionValue), 0), `${date} ${g.slot}`).toBe(toCents(row.markedHoldingsValue));
          const prevRow = prevDate ? c.db._get(`${base}/ideas/${ideaId}/rows/${prevDate}`) : null;
          const before = allotCents(prevRow);
          for (const n of held) {
            const h = idea.ledger.holdings[n.symbol];
            expect(n.mark, `${date} ${n.symbol}`).toBe(new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.marks[n.symbol].mark));
            expect(cents(n.plOpen.text) + toCents(h.costBasisTotal), `${date} ${n.symbol} open`).toBe(cents(n.positionValue));
            const base0 = idea.entry.sessionDate === date ? toCents(h.costBasisTotal) : before.get(n.symbol);
            expect(cents(n.plDay.text), `${date} ${n.symbol} day`).toBe(cents(n.positionValue) - base0);
          }
          // Day n of N, on the agent's own count (agentRun.js sessionsLeft) to the frozen due session: n + left = N.
          const N = idea.contract.schedule.sessions;
          let left = 0;
          for (let s = date; s < idea.contract.schedule.dueSession; s = nextSessionDate(s)) left += 1;
          expect([g.day, g.of, g.sessionsLeft], `${date} ${g.slot} days`).toEqual([N - Math.min(N, left), N, Math.min(N, left)]);
        }

        // SPY since open: the first entered idea's inception SPY leg quote, to the last close's clean SPY mark.
        const firstIdea = [...c.db._store.keys()].filter((p) => new RegExp(`^${base}/ideas/[^/]+$`).test(p)).map((p) => c.db._get(p))
          .filter((i) => i.entry?.sessionDate).sort((a, b) => (a.entry.sessionDate < b.entry.sessionDate ? -1 : 1))[0];
        const startQuote = c.db._get(`${base}/ideas/${firstIdea.ideaId}/rows/inception`).legs.spy.find((r) => r.symbol === 'SPY').mark;
        const nowMark = Object.values(book.slots).filter(Boolean).map((id) => c.db._get(`${base}/ideas/${id}/rows/${date}`)?.spyMarks?.SPY)
          .find((m) => m && m.quality === 'vendor_time')?.mark;
        expect(v.line.spy.value, `${date} SPY`).toBe(pctText(((nowMark - startQuote) * 100) / startQuote));

        // The reads: bounded by the reader's own formula (bookViewRead.js header: 46 + 3·I + 20·P), no receipt parts here.
        const ideasRead = (book.openIdeaIds || []).length + Object.values(book.slots || {}).filter(Boolean).length;
        expect(count.docs, date).toBeLessThanOrEqual(46 + 3 * ideasRead);
        expect(count.queries, date).toBe(3);

        // No id of the owner, the book or an idea reaches the view.
        const ids = [c.uid, c.bookId, ...[...c.db._store.keys()].filter((p) => p.startsWith(`${base}/ideas/`) && p.split('/').length === 4).map((p) => p.split('/')[3])];
        for (const s of strings(v)) for (const id of ids) expect(s.includes(id), `${date}: ${s}`).toBe(false);
        seen.push({ date, v });
      },
    });
    expect(seen).toHaveLength(13);
    expect(ctx.bookId).toBeTruthy();

    // What the history shows along the way: the exit, its settlement, the failed call, the early close.
    const at = (d) => seen.find((s) => s.date === d).v;
    expect(at(EXIT_SESSION).strip[0]).toMatchObject({ deskName: 'Archetype desk', text: 'called Exit on XOM' });
    expect(at(EXIT_SESSION).groups[0]).toMatchObject({ slot: 'short', state: 'selling', selling: { word: 'Exit' } });
    expect(at('2026-11-23').history.items[0]).toMatchObject({ namesText: 'XOM', ended: 'Settled early by the manager', endedOn: '23 Nov', notMeasurable: null });
    expect(at('2026-11-23').history.items[0].columns.map((col) => col.label)).toEqual(['Lines', 'Result', 'Process', 'Evidence', 'Adoption']);
    expect(at(FAIL_SESSION).strip.find((s) => s.desk === 'shadow')).toMatchObject({ failed: true });
    expect(at(EARLY_CLOSE).day).toBe('Fri 27 Nov');
    expect(at(days[0]).groups.find((g) => g.slot === 'medium').names.every((n) => n.isNew)).toBe(true);
  });
});
