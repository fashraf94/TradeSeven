// api/_utils/practiceField/bookView.e2e.test.js
//
// Practice Field build B3 — THE VIEW AGAINST A REAL RUN OF THE ENGINE (B3 "Tests: the figures"). The B2 end-to-end history
// (__testsupport__/bookViewFixtures.js, a copy of agentEndToEnd.test.js's run, so that file's pinned dump never moves):
// thirteen sessions of the founder's book on the in-memory harness, both desks checking at every close, an early exit, a
// failed call and the 27 Nov early close. After EVERY close the screen's reader runs, and its book line, groups and names
// must agree with the stored rows to the cent; the reads it makes are counted against the reader's own bound; and no id
// leaves it.

//
// B5 (rulings B5-1 to B5-3), at every close too: the archetype is the epoch's; the split's shares are the stored epoch's,
// and each desk's use is the sum of its ideas' stored `markedHoldingsValue` at that close (computed here from the stored
// rows, not from the view's helpers), against the desk's share of the stored equity; and the desks read by their names —
// the caller's agent "Atlas" (seeded beside the run, the caller's own) and the epoch's archetype — never "Shadow".
//
// B6 (ruling B6-3): never "Shadow" or "archetype desk" in ANY string a player reads, a desk's own words included — the
// scripted notes name the old desks and quote the book's idea ids (bookViewFixtures.js), and the view shows each desk's
// name and "the {slot} idea" — and the stored close row is the same after the read as before it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { readBookView } from './bookViewRead.js';
import { allotCents, pctText } from './bookView.js';
import { toCents } from './money.js';
import { nextSessionDate } from './windows.js';
import { deskOfIdea, deskOfSlot } from './agentConfig.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { runBookHistory, historySessions, EARLY_CLOSE, EXIT_SESSION, FAIL_SESSION } from './__testsupport__/bookViewFixtures.js';

const AGENT_NAME = 'Atlas';
/** Every string of a view a player reads: the desk ids (`desk`) are the engine's keys, and the agent's own words are shown as written. */
const playerStrings = (v, key = null, out = []) => {
  if (typeof v === 'string') { if (key !== 'desk') out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => playerStrings(x, key, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) playerStrings(x, k, out);
  return out;
};

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
    const wordsSeen = { shadow: 0, reasons: 0 };
    const days = historySessions(13);
    const { ctx } = await runBookHistory({
      n: 13,
      onSession: async (date, i, c) => {
        const base = `mandates/${c.bookId}`;
        // B5-3: the book's attribution agent, the caller's own, as the agent creation path stores it (seeded in the store's
        // own map: no write path is added to the protected-store scan's view of `agents`).
        const agentId = c.db._get(base).attributionAgentId;
        if (!c.db._get(`agents/${agentId}`)) c.db._store.set(`agents/${agentId}`, { data: { ownerId: c.uid, name: AGENT_NAME, archetype: 'degen' }, version: 1 });
        const { db, count } = counting(c.db);
        const closeRowBefore = JSON.stringify(c.db._get(`${base}/windows/${date}_close`));
        const { book: v } = await readBookView(db, { uid: c.uid, agentOn: true });
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

        // SPY since open: the book's first FILL's inception SPY leg quote (the earliest entry.filledAt, B3-A03), to the last
        // close's clean SPY mark.
        const firstIdea = [...c.db._store.keys()].filter((p) => new RegExp(`^${base}/ideas/[^/]+$`).test(p)).map((p) => c.db._get(p))
          .filter((i) => i.entry?.filledAt).sort((a, b) => (Date.parse(a.entry.filledAt) - Date.parse(b.entry.filledAt)))[0];
        const startQuote = c.db._get(`${base}/ideas/${firstIdea.ideaId}/rows/inception`).legs.spy.find((r) => r.symbol === 'SPY').mark;
        const nowMark = Object.values(book.slots).filter(Boolean).map((id) => c.db._get(`${base}/ideas/${id}/rows/${date}`)?.spyMarks?.SPY)
          .find((m) => m && m.quality === 'vendor_time')?.mark;
        expect(v.line.spy.value, `${date} SPY`).toBe(pctText(((nowMark - startQuote) * 100) / startQuote));

        // B5-1: the archetype the book runs under — its epoch's — never the agent's battle archetype ('degen' above).
        const epoch = c.db._get(`${base}/epochs/${book.currentEpochId}`);
        expect(v.archetype, date).toEqual({ codeId: epoch.archetypeCodeId, name: getArchetypeDefinition(epoch.archetypeCodeId).displayName });
        // B5-2: the split, from the stored epoch and the stored rows of this close (no view helper used here).
        const ppm = (x) => Number(BigInt(Math.round(x * 1e6)));
        const sharePpm = { shadow: 0, archetype: 0 };
        for (const [slot, share] of Object.entries(epoch.rails.slotCapShare)) sharePpm[deskOfSlot(slot)] += ppm(share);
        const cashPpm = ppm(epoch.gateConfig.cashFloorPct);
        expect(sharePpm.shadow + sharePpm.archetype + cashPpm, date).toBe(1_000_000);
        const used = { shadow: 0, archetype: 0 };
        const ideaPaths = [...c.db._store.keys()].filter((p) => new RegExp(`^${base}/ideas/[^/]+$`).test(p));
        for (const p of ideaPaths) {
          const row = c.db._get(`${p}/rows/${date}`);
          if (row) used[deskOfIdea(c.db._get(p))] += toCents(row.markedHoldingsValue);
        }
        const equityCents = toCents(last.markedEquity);
        for (const [key, desk] of [['agent', 'shadow'], ['archetype', 'archetype']]) {
          const part = v.split.parts.find((x) => x.key === key);
          const ofCents = Number((BigInt(equityCents) * BigInt(sharePpm[desk])) / 1_000_000n);
          expect(part, `${date} ${key}`).toMatchObject({ desk, share: { number: sharePpm[desk] / 1e6 } });
          if (!last.fullQuality) { expect(part.use, `${date} ${key} waits`).toBeNull(); continue; }
          expect(cents(part.use.amount.text), `${date} ${key} use`).toBe(used[desk]);
          expect(cents(part.use.of.text), `${date} ${key} of`).toBe(ofCents);
          expect(part.use.bar, `${date} ${key} bar`).toBe(Math.min(1, used[desk] / ofCents));
          // §9: the desk's use is the sum of the position values its groups show, to the cent.
          const shown = v.groups.filter((g) => g.desk === desk).flatMap((g) => g.names).filter((n) => n.positionValue).reduce((s, n) => s + cents(n.positionValue), 0);
          expect(shown, `${date} ${key} shown`).toBe(used[desk]);
        }
        expect(v.split.parts.find((x) => x.key === 'cash')).toMatchObject({ name: 'Cash', share: { number: cashPpm / 1e6 } });
        // B5-3: the desks by their names, in every sentence. Build B6 (B6-3): never "Shadow" or "archetype desk" in ANY string a
        // player reads — a desk's own words included. The scripted notes here say "Shadow desk, …" and "Archetype desk, …" and
        // quote the book's idea ids (bookViewFixtures.js scriptedDesks): the view shows each desk's name and "the {slot} idea".
        for (const s of playerStrings(v)) expect(s, `${date}: ${s}`).not.toMatch(/shadow|archetype desk/i);
        for (const s of v.strip) expect(s.deskName, date).toBe(s.desk === 'shadow' ? 'Atlas’s desk' : 'Trend Follower’s desk');
        // (Not vacuous: the stored words still say them, and the view's desk notes are those words with the two replaced.)
        const stored = c.db._get(`${base}/windows/${date}_close`)?.agent?.desks || {};
        const shown = Object.fromEntries(v.desks.map((dk) => [dk.desk, dk.note?.text ?? null]));
        if (stored.shadow?.source === 'model') {
          expect(stored.shadow.note, date).toMatch(/^Shadow desk, /);
          expect(shown.shadow, date).toBe(stored.shadow.note.replace(/^Shadow desk/, 'Atlas’s desk').replace(/ I hold (.*)\.$/, (_, ids) => ` I hold ${ids.split(' and ').map((id) => `the ${c.db._get(`${base}/ideas/${id}`).contract.slot} idea`).join(' and ')}.`));
          wordsSeen.shadow += 1;
        }
        if (stored.archetype?.source === 'model') {
          expect(stored.archetype.note, date).toBe(`Archetype desk, ${date}: short-term only; the Shadow desk keeps the banks.`);
          expect(shown.archetype, date).toBe(`Trend Follower’s desk, ${date}: short-term only; Atlas’s desk keeps the banks.`);
          for (const a of stored.archetype.actions || []) {
            const call = v.groups.find((g) => g.call && g.slot === 'short')?.call;
            if (call && a.ideaId === book.slots.short) {
              expect(a.reason, date).toContain(a.ideaId);
              expect(call.text, date).toBe(a.reason.split(a.ideaId).join('the short idea').replace(/^the short idea/, 'The short idea'));
              wordsSeen.reasons += 1;
            }
          }
        }
        // The stored close row is unchanged by the read: the view returns new strings and writes nothing.
        expect(JSON.stringify(c.db._get(`${base}/windows/${date}_close`)), date).toBe(closeRowBefore);

        // The reads: bounded by the reader's own formula (bookViewRead.js header: one pass, 55 + 3·I + 20·P — B5-4 restated
        // B3-A10's 48 with the epoch, the agent, the rows of ideas finished since the close and the second reads of the book
        // and the close row), no receipt parts here and no close during the read. I counts the UNIQUE ideas the open set and
        // the slots name.
        const ideasRead = new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {}).filter(Boolean)]).size;
        expect(count.docs, date).toBeLessThanOrEqual(55 + 3 * ideasRead);
        expect(count.queries, date).toBe(3);

        // No id of the owner, the book, its agent or an idea reaches the view.
        const ids = [c.uid, c.bookId, agentId, ...[...c.db._store.keys()].filter((p) => p.startsWith(`${base}/ideas/`) && p.split('/').length === 4).map((p) => p.split('/')[3])];
        for (const s of strings(v)) for (const id of ids) expect(s.includes(id), `${date}: ${s}`).toBe(false);
        seen.push({ date, v });
      },
    });
    expect(seen).toHaveLength(13);
    expect(ctx.bookId).toBeTruthy();
    // B6-3 was exercised: the shadow desk's note on every model close (12: its 24 Nov call fails), and the archetype desk's
    // reasons quoting its short idea's id.
    expect(wordsSeen.shadow).toBe(12);
    expect(wordsSeen.reasons).toBeGreaterThan(5);

    // What the history shows along the way: the exit, its settlement, the failed call, the early close.
    const at = (d) => seen.find((s) => s.date === d).v;
    expect(at(EXIT_SESSION).strip[0]).toMatchObject({ deskName: 'Trend Follower’s desk', text: 'called Exit on XOM' });
    expect(at(EXIT_SESSION).groups[0]).toMatchObject({ slot: 'short', state: 'selling', selling: { word: 'Exit' } });
    expect(at('2026-11-23').history.items[0]).toMatchObject({ namesText: 'XOM', ended: 'Settled early by the manager', endedOn: '23 Nov', notMeasurable: null });
    expect(at('2026-11-23').history.items[0].columns.map((col) => col.label)).toEqual(['Lines', 'Result', 'Process', 'Evidence', 'Adoption']);
    // B6-3 in History: the exit's reason quoted the idea's id; History says "the short idea".
    expect(at('2026-11-23').history.items[0].lastCall).toMatchObject({ kind: 'Exit', text: 'The breakout failed on the short idea; the setup no longer holds.', deskName: 'Trend Follower’s desk' });
    expect(at(FAIL_SESSION).strip.find((s) => s.desk === 'shadow')).toMatchObject({ failed: true });
    expect(at(EARLY_CLOSE).day).toBe('Fri 27 Nov');
    expect(at(days[0]).groups.find((g) => g.slot === 'medium').names.every((n) => n.isNew)).toBe(true);
    // B3-A08: the entry close reads "Entered today"; the next, Day 1. B3-A06: the founder's thesis is the founder's.
    expect(at(days[0]).groups.find((g) => g.slot === 'medium')).toMatchObject({ line: 'Entered today · 30 sessions', day: 0, thesis: { byline: 'The founder' }, deskName: 'Atlas’s desk' });
    // B5-2 along the run: on the first close the short slot's idea is still entering — its desk's use is zero.
    expect(at(days[0]).groups.find((g) => g.slot === 'short').state).toBe('entering');
    expect(at(days[0]).split.parts.find((x) => x.key === 'archetype').use).toMatchObject({ amount: { text: '$0.00' }, pct: '0%', bar: 0 });
    expect(at(days[0]).split.parts.find((x) => x.key === 'agent').use.bar).toBeGreaterThan(0);
    expect(at(days[1]).groups.find((g) => g.slot === 'medium')).toMatchObject({ line: 'Day 1 of 30', day: 1 });
  });
});
