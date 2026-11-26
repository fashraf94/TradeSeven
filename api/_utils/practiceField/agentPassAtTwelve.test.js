// api/_utils/practiceField/agentPassAtTwelve.test.js
//
// Practice Field build B4 (ruling B4-8) — THE AGENT'S PASS AT TWELVE BOOKS, on the in-memory harness with a FAKE TRANSPORT
// and an INJECTED CLOCK (no real model, Firestore or vendor call):
//   • the order: different between two sessions, the same on a replay, every book visited once; the pass follows it;
//   • measurement 1 — twelve books, both desks with work, each call taking 30 s: how many close fires until every desk is
//     checked (the close window's fire count derived from vercel.json and activeCloseTick, December, EST);
//   • measurement 2 — every call timing out at 110 s: which desks get no check inside the close window, and what the close
//     row and the founder's `books` overview say about them;
//   • measurement 3 — the union of symbols twelve fully drafted books reserve, against MANDATE_UNIVERSE_MAX_SYMBOLS, with
//     every name and comparison drawn from the price list.
// Each measurement prints one `PF_B4_MEASURE` line with its figures (the build report carries them). Nothing about a desk's
// check is changed here: one call per desk, the lease, the reservation, the deferral at the deadline.
//
// THE MODEL OF A FIRE. The cron's close fire has 290 s (mandate-evaluate.js TIME_BUDGET_MS); the agent pass runs after the
// fire's closes, so it starts `offset` seconds in. A desk's call starts only while the clock + the call's timeout (110 s) +
// a 15 s margin fit before the deadline (agentRun.js), whatever the call then takes. On the harness only the calls move the
// clock (reads and writes take no time), so the figures are a ceiling on what one fire serves.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from './mode.js';
import { agentPassOrder, runIdeaBookAgentPass, AGENT_CALL_MARGIN_MS, DESK_ORDER } from './agentRun.js';
import { AGENT_CALL_TIMEOUT_MS, AGENT_MAX_ATTEMPTS } from './agentConfig.js';
import { createIdeaBook } from './ideaBook.js';
import { runIdeaBookEvalPass } from './sweep.js';
import { normalizeIdeaContract } from './contract.js';
import { ideaCoveragePlan, coverageWithRef, coverageFits, coverageSymbols, coverageRef } from './coverage.js';
import { mandateSectorOf, fundOf, isUniverseStock } from './symbols.js';
import { CANDIDATE_UNIVERSE } from '../mandateCandidateUniverse.js';
import { MANDATE_UNIVERSE_MAX_SYMBOLS, MANDATE_SWEEP_PAGE_SIZE } from '../mandateConfig.js';
import { activeCloseTick } from '../mandateSessionSlots.js';
import { PRACTICE_FIELD_FUNDS } from '../../../src/data/practiceFieldFunds.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV } from './playerList.js';
import { runBooks } from '../../../scripts/practice-field-founder.mjs';
import { makeMandateFakeDb, etIso, DAYS, storeTickSnapshot, tickOf, slotNowOf, closeOn, contractOf } from './__testsupport__/fixtures.js';
import { quotesOn, fakeTransport, toolResponse, holdAll, transportError, deskPartsOf } from './__testsupport__/agentFixtures.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OWNERS = Array.from({ length: 12 }, (_, i) => `owner-${String(i + 1).padStart(2, '0')}`);
const FIRE_BUDGET_MS = 290_000; // api/cron/mandate-evaluate.js TIME_BUDGET_MS (pinned below from its source)
const DATE = DAYS.d1;

let restoreMode;
let restoreAgent;
let errSpy;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  restoreAgent = setPracticeFieldAgentForTests({ agent: true, theses: false });
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { restoreAgent(); restoreMode(); errSpy.mockRestore(); vi.unstubAllEnvs(); });

/** The close fires of a session: the cron's own schedule (vercel.json) walked minute by minute, kept where activeCloseTick answers. */
function closeFiresOn(date) {
  const vercel = JSON.parse(readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
  const schedule = vercel.crons.find((c) => c.path === '/api/cron/mandate-evaluate').schedule;
  const [minField, hourField] = schedule.split(' ');
  const step = Number(/^\*\/(\d+)$/.exec(minField)[1]);
  const hours = hourField.split(',').map(Number);
  const out = [];
  for (const h of hours) {
    for (let m = 0; m < 60; m += step) {
      const at = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
      if (activeCloseTick(at)?.date === date) out.push(at);
    }
  }
  return { schedule, fires: out };
}

/** Twelve owners' books, each closed on time for DATE (the eval pass at the three windows, then each book's close). */
async function twelveClosedBooks() {
  const db = makeMandateFakeDb();
  const books = [];
  for (const uid of OWNERS) {
    const res = await createIdeaBook(db, { uid, attributionAgentId: `agent-${uid}`, archetypeCodeId: 'momentum_chaser', opId: `create-${uid}`, nowIso: etIso(DAYS.admit, 9, 0) });
    expect(res.ok, uid).toBe(true);
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

/**
 * Run the session's close fires, each with its own deadline, until every desk is done or the window's fires run out. The
 * virtual clock starts each fire `offsetFirstMs` (the first fire: the snapshot and twelve closes) or `offsetLaterMs` in;
 * the fake transport advances it by `callMs` and answers `answer(ctx)`.
 */
async function runFires(db, books, { fires, offsetFirstMs, offsetLaterMs, callMs, answer }) {
  let t = 0;
  const clock = () => new Date(t);
  const fake = fakeTransport(async (ctx) => { t += callMs; return answer(ctx); });
  const doneAt = {}; // `${bookId}/${desk}` → the fire (1-based) whose end first found it done
  const perFire = [];
  for (const [k, fireAt] of fires.entries()) {
    const start = fireAt.getTime();
    t = start + (k === 0 ? offsetFirstMs : offsetLaterMs);
    const callsBefore = fake.calls.length;
    const out = await runIdeaBookAgentPass(db, {
      date: DATE, now: new Date(start), ownerToken: `fire-${k + 1}`, deadlineMs: start + FIRE_BUDGET_MS, transport: fake.transport, clock,
    });
    perFire.push({ fire: k + 1, calls: fake.calls.length - callsBefore, deferred: out.deferred, endedSecondsIn: Math.round((t - start) / 1000) });
    for (const bookId of books) {
      const parts = deskPartsOf(db, bookId, DATE) || {};
      for (const desk of DESK_ORDER) if (parts[desk]?.status === 'done' && doneAt[`${bookId}/${desk}`] === undefined) doneAt[`${bookId}/${desk}`] = k + 1;
    }
    if (Object.keys(doneAt).length === books.length * DESK_ORDER.length) break;
  }
  return { doneAt, perFire, calls: fake.calls.length };
}

describe('the order (B4-8): each session its own, the same on every fire of it', () => {
  const docs = OWNERS.map((o, i) => ({ id: `pf_book_${String(i).padStart(2, '0')}_${o}` }));

  it('visits every book once; is the same for a session on a replay; differs between two sessions; no clock, no randomness', () => {
    const a = agentPassOrder(docs, '2026-12-04').map((d) => d.id);
    expect([...a].sort()).toEqual(docs.map((d) => d.id).sort());
    expect(agentPassOrder([...docs].reverse(), '2026-12-04').map((d) => d.id)).toEqual(a); // the page's own order does not matter
    expect(agentPassOrder(docs, '2026-12-04').map((d) => d.id)).toEqual(a);
    const b = agentPassOrder(docs, '2026-12-07').map((d) => d.id);
    expect(b).not.toEqual(a);
    // Over twenty sessions, every book leads at least once and no book is last every day.
    const sessions = Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10));
    const firsts = new Set(sessions.map((s) => agentPassOrder(docs, s)[0].id));
    const lasts = new Set(sessions.map((s) => agentPassOrder(docs, s).at(-1).id));
    expect(firsts.size).toBeGreaterThan(6);
    expect(lasts.size).toBeGreaterThan(6);
    expect(agentPassOrder([], '2026-12-04')).toEqual([]);
    expect(MANDATE_SWEEP_PAGE_SIZE).toBeGreaterThanOrEqual(PRACTICE_FIELD_SLOTS.B8_FOUNDER_BOOK_CAP); // the page holds every book
  });

  it('the pass follows it: the desks\' checks start in the session\'s order of the books (a fire that runs out of time leaves the tail)', { timeout: 120_000 }, async () => {
    const { db, books } = await twelveClosedBooks();
    let t = Date.parse(etIso(DATE, 16, 20));
    const fake = fakeTransport(async ({ request }) => { t += 1000; return toolResponse(holdAll(request)); });
    await runIdeaBookAgentPass(db, { date: DATE, now: new Date(t), ownerToken: 'order', transport: fake.transport, clock: () => new Date(t) });
    const started = books.map((id) => ({ id, at: deskPartsOf(db, id, DATE).shadow.startedAt })).sort((x, y) => x.at.localeCompare(y.at)).map((x) => x.id);
    expect(started).toEqual(agentPassOrder(books.map((id) => ({ id })), DATE).map((d) => d.id));
    expect(fake.calls).toHaveLength(24);
  });
});

describe('measurements at twelve books (B4-8): figures, not limits', () => {
  it('the close window has seven fires in December (EST), every 15 minutes from 16:15 to 17:45 ET; an early close has seven too', () => {
    const src = readFileSync(path.join(REPO, 'api/cron/mandate-evaluate.js'), 'utf8');
    expect(src).toMatch(/const TIME_BUDGET_MS = 290_000;/);
    const dec = closeFiresOn('2026-12-04');
    expect(dec.fires.map((f) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(f))).toEqual(['16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45']);
    const early = closeFiresOn('2026-11-27');
    expect(early.fires).toHaveLength(7);
    console.log(`PF_B4_MEASURE fires ${JSON.stringify({ schedule: dec.schedule, december: dec.fires.length, earlyClose: early.fires.length, budgetSeconds: FIRE_BUDGET_MS / 1000, callStartsWhileSecondsIn: (FIRE_BUDGET_MS - AGENT_CALL_TIMEOUT_MS - AGENT_CALL_MARGIN_MS) / 1000 })}`);
  });

  it('1 — twelve books, both desks with work, each call 30 s: every desk is checked inside the window, at every first-fire offset measured', { timeout: 300_000 }, async () => {
    const { fires } = closeFiresOn('2026-12-04');
    const figures = [];
    for (const [offsetFirstS, offsetLaterS] of [[0, 0], [60, 5], [120, 10], [160, 10]]) {
      const { db, books } = await twelveClosedBooks();
      // Re-dated: the harness's session is DATE; the fires keep December's minutes within the window, shifted to DATE.
      const shifted = fires.map((f) => new Date(Date.parse(`${DATE}T${f.toISOString().slice(11)}`)));
      const run = await runFires(db, books, { fires: shifted, offsetFirstMs: offsetFirstS * 1000, offsetLaterMs: offsetLaterS * 1000, callMs: 30_000, answer: ({ request }) => toolResponse(holdAll(request)) });
      const lastFire = Math.max(...Object.values(run.doneAt));
      figures.push({ offsetFirstS, offsetLaterS, desksChecked: Object.keys(run.doneAt).length, firesNeeded: lastFire, calls: run.calls, perFire: run.perFire.map((p) => p.calls) });
      expect(Object.keys(run.doneAt), `offset ${offsetFirstS}`).toHaveLength(24);
      expect(lastFire, `offset ${offsetFirstS}`).toBeLessThanOrEqual(shifted.length);
      expect(run.calls).toBe(24); // one call per desk, no more
      for (const bookId of books) for (const desk of DESK_ORDER) expect(deskPartsOf(db, bookId, DATE)[desk], `${bookId}/${desk}`).toMatchObject({ status: 'done', source: 'model' });
    }
    console.log(`PF_B4_MEASURE thirty_second_calls ${JSON.stringify(figures)}`);
  });

  it('2 — every call times out at 110 s: the desks the window never reaches, what the close row and `books` say about them', { timeout: 300_000 }, async () => {
    vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, 'founder-x');
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, ['founder-x', ...OWNERS].join(','));
    const { fires } = closeFiresOn('2026-12-04');
    const shifted = fires.map((f) => new Date(Date.parse(`${DATE}T${f.toISOString().slice(11)}`)));
    const figures = [];
    for (const [offsetFirstS, offsetLaterS] of [[0, 0], [120, 10]]) {
      const { db, books } = await twelveClosedBooks();
      const run = await runFires(db, books, { fires: shifted, offsetFirstMs: offsetFirstS * 1000, offsetLaterMs: offsetLaterS * 1000, callMs: AGENT_CALL_TIMEOUT_MS, answer: () => transportError('agent_call_timeout') });
      const order = agentPassOrder(books.map((id) => ({ id })), DATE).map((d) => d.id);
      const visit = order.flatMap((id) => DESK_ORDER.map((desk) => `${id}/${desk}`));
      const checked = visit.filter((k) => run.doneAt[k] !== undefined);
      const unchecked = visit.filter((k) => run.doneAt[k] === undefined);
      // Every desk checked was checked in the session's order, by code: two timed-out attempts, then the code-built note.
      expect(checked).toEqual(visit.slice(0, checked.length));
      for (const k of checked) {
        const [bookId, desk] = k.split('/');
        const part = deskPartsOf(db, bookId, DATE)[desk];
        expect(part, k).toMatchObject({ status: 'done', source: 'code_fallback', fallbackReason: 'transport_failed' });
        expect(part.attempts.map((a) => [a.outcome, a.unpriced]), k).toEqual(Array.from({ length: AGENT_MAX_ATTEMPTS }, () => ['transport_error', true]));
      }
      // The desks left: no part at all on the close row (a deferral reserves and writes nothing), or one in progress.
      const states = unchecked.map((k) => { const [bookId, desk] = k.split('/'); const p = deskPartsOf(db, bookId, DATE)?.[desk]; return p ? p.status : 'no_part'; });
      const overview = await runBooks(db, { uid: 'founder-x', nowIso: etIso(DATE, 19, 0) });
      const sources = Object.fromEntries(overview.result.books.map((b) => [b.bookId, b.desks]));
      for (const k of unchecked) {
        const [bookId, desk] = k.split('/');
        expect(['not_checked', 'not_finished'], k).toContain(sources[bookId][desk].source);
      }
      const charged = books.flatMap((id) => DESK_ORDER.flatMap((d) => (deskPartsOf(db, id, DATE)?.[d]?.attempts || []).map((a) => a.chargedUsd || 0)));
      figures.push({
        offsetFirstS, offsetLaterS, firesRun: run.perFire.length, desksChecked: checked.length, desksUnchecked: unchecked.length,
        uncheckedStates: Object.fromEntries([...new Set(states)].map((s) => [s, states.filter((x) => x === s).length])),
        booksWithNoDeskChecked: order.filter((id) => DESK_ORDER.every((d) => run.doneAt[`${id}/${d}`] === undefined)).length,
        callsCharged: charged.length, chargedUsdTotal: Math.round(charged.reduce((a, b) => a + b, 0) * 1e6) / 1e6, perFire: run.perFire.map((p) => p.calls),
      });
      expect(unchecked.length).toBeGreaterThan(0);
    }
    console.log(`PF_B4_MEASURE timeouts ${JSON.stringify(figures)}`);
  });

  it('3 — the union twelve fully drafted books reserve, every name and comparison from the price list: inside MANDATE_UNIVERSE_MAX_SYMBOLS', () => {
    // THE PRICE LIST the agent drafts from: the engine's candidate universe (136), less what is not a pickable stock of the
    // house universe (agentSources.js candidatesOf drops it — five names today). Every one of its stocks, spread over
    // 12 books × 3 ideas × up to 4 names (144 places); the medium idea of each book compared with its sector's fund (so the
    // sector funds are reserved too); SPY is every idea's benchmark.
    const PRICE_LIST = CANDIDATE_UNIVERSE.filter((s) => isUniverseStock(s));
    const bySector = new Map();
    for (const sym of PRICE_LIST) {
      const s = mandateSectorOf(sym);
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s).push(sym);
    }
    const fundFor = Object.fromEntries(Object.entries(PRACTICE_FIELD_FUNDS).filter(([, f]) => f.represents !== 'broad_market').map(([sym, f]) => [f.represents, sym]));
    const sectorsWithFund = [...bySector.keys()].filter((s) => fundFor[s] && bySector.get(s).length >= 4);
    const used = new Set();
    const next = (n, pred = () => true, avoid = new Set()) => {
      const pick = PRICE_LIST.filter((s) => !used.has(s) && !avoid.has(s) && pred(s)).slice(0, n);
      const fill = pick.length < n ? PRICE_LIST.filter((s) => !pick.includes(s) && !avoid.has(s) && pred(s)).slice(0, n - pick.length) : [];
      for (const s of [...pick, ...fill]) used.add(s);
      return [...pick, ...fill];
    };
    let doc = null;
    const refusals = [];
    for (let b = 0; b < 12; b += 1) {
      const inBook = new Set();
      const sector = sectorsWithFund[b % sectorsWithFund.length];
      const specs = [
        { slot: 'medium', names: next(4, (s) => mandateSectorOf(s) === sector, inBook), comparison: { type: 'sector_fund', symbols: [fundFor[sector]] } },
      ];
      specs[0].names.forEach((s) => inBook.add(s));
      for (const slot of ['short', 'long']) {
        const names = next(4, () => true, inBook);
        names.forEach((s) => inBook.add(s));
        specs.push({ slot, names, comparison: { type: 'same_stock_held' } });
      }
      for (const [i, spec] of specs.entries()) {
        const shape = normalizeIdeaContract(contractOf({ ...spec, capitalUsd: 1000 }));
        if (!shape.contract) { refusals.push({ b, slot: spec.slot, refusals: shape.refusals }); continue; }
        const plan = ideaCoveragePlan(shape.contract, { filled: false });
        expect(coverageFits(doc, plan).fits, `book ${b} ${spec.slot}`).toBe(true);
        doc = coverageWithRef(doc, coverageRef(`book-${b}`, `idea-${i}`), plan, etIso(DAYS.admit, 11, 0));
      }
    }
    expect(refusals).toEqual([]);
    const reserved = coverageSymbols(doc);
    const fit = coverageFits(doc, {});
    const stocks = reserved.filter((s) => !Object.hasOwn(PRACTICE_FIELD_FUNDS, s));
    const funds = reserved.filter((s) => Object.hasOwn(PRACTICE_FIELD_FUNDS, s));
    const ceiling = new Set([...CANDIDATE_UNIVERSE, ...Object.keys(PRACTICE_FIELD_FUNDS)]).size;
    expect(stocks).toEqual([...PRICE_LIST].sort()); // every stock of the price list reserved
    expect(fit).toEqual({ fits: true, needed: CANDIDATE_UNIVERSE.length + funds.length, cap: MANDATE_UNIVERSE_MAX_SYMBOLS });
    expect(ceiling).toBeLessThanOrEqual(MANDATE_UNIVERSE_MAX_SYMBOLS);
    console.log(`PF_B4_MEASURE union ${JSON.stringify({ candidateUniverse: CANDIDATE_UNIVERSE.length, priceList: PRICE_LIST.length, notPickable: CANDIDATE_UNIVERSE.filter((s) => !isUniverseStock(s)), reserved: reserved.length, stocks: stocks.length, funds: funds.length, fundsReserved: funds, needed: fit.needed, cap: fit.cap, ceilingIfEveryFundReserved: ceiling, sectorsWithAFund: sectorsWithFund.length, fundSymbols: Object.keys(PRACTICE_FIELD_FUNDS).length, fundOfCheck: fundOf('XLK')?.represents ?? null })}`);
  });
});
