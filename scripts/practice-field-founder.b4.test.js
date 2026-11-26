// scripts/practice-field-founder.b4.test.js
//
// Practice Field build B4 — the founder script's new rows (a new file beside practice-field-founder.test.js), on the
// in-memory harness: no environment file, no credential, no real Firestore, model or vendor call.
//   • `books`: one line per open idea book — the owner, state, value, last close, each desk's latest source ("not checked"
//     when the close row holds no part for it), the month's spend, the open records — books with open records first;
//   • --owner on status, pause, resume, wind-down and resolve, and create-book-for --owner; --uid stays the acting founder;
//     a body without --owner (so its request key) is exactly as before B4;
//   • status says whether the owner is on the player list on this machine, and that the deployed app reads its own copy;
//   • the two fixes: sessions left agrees with the agent's prompt and the screen (Q-7); the parse-report alerts list only
//     symbols the book held or had reserved when that session's report was written (the 25 Nov shape);
//   • a uid that is not a founder is refused, with nothing read, by every new path.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { runCli, parseArgs, bodyWithoutKey, requestKeyFor, sessionsLeft, deskSourceOf, EXIT, PLAYER_LIST_REDEPLOY_SENTENCE } from './practice-field-founder.mjs';
import { setPracticeFieldModeForTests, setPracticeFieldAgentForTests } from '../api/_utils/practiceField/mode.js';
import { PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV } from '../api/_utils/practiceField/playerList.js';
import { admitIdea } from '../api/_utils/practiceField/admission.js';
import { sessionsLeftOf } from '../api/_utils/practiceField/bookView.js';
import {
  makeMandateFakeDb, contractOf, etIso, ADMIT_ISO, DAYS, getBook, getIdea, dumpStore, closeOn, closeNowOf, omitParseReport,
  admitAndEnter,
} from '../api/_utils/practiceField/__testsupport__/fixtures.js';
import {
  quotesOn, foundersMediumIdea, fakeTransport, toolResponse, holdAll, runSession, agentNowOf,
} from '../api/_utils/practiceField/__testsupport__/agentFixtures.js';
import { nextSessionDate } from '../api/_utils/practiceField/windows.js';

const FOUNDER = 'founder-b4';
const P1 = 'player-b4-one';
const P2 = 'player-b4-two';
const agentsFor = (uid) => ({
  [`agents/agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', name: 'Ranked' },
  [`agents/casual-agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', isCasualClone: true, rankedAgentId: `agent-${uid}` },
});
const seed = (...uids) => Object.assign({}, ...uids.map(agentsFor));

async function cli(db, args, { nowIso = ADMIT_ISO, files = {} } = {}) {
  const lines = [];
  const code = await runCli(args, {
    getDb: async () => db,
    nowIso: () => nowIso,
    print: (s) => lines.push(String(s)),
    readFile: (p) => {
      const name = Object.keys(files).find((f) => path.resolve(f) === p);
      if (name === undefined) throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      return files[name];
    },
  });
  return { code, out: lines.join('\n') };
}
const json = async (db, args, opts) => {
  const r = await cli(db, [...args, '--json'], opts);
  return { code: r.code, body: JSON.parse(r.out) };
};
const untouchable = () => ({ collection: () => { throw new Error('a read was made'); }, runTransaction: () => { throw new Error('a transaction was opened'); } });

let restoreMode;
let restoreAgent;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('allowlist');
  restoreAgent = setPracticeFieldAgentForTests({ agent: false });
  vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, FOUNDER);
  vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, [FOUNDER, P1, P2].join(','));
});
afterEach(() => { restoreAgent(); restoreMode(); vi.unstubAllEnvs(); });

/** The founder's book and two players' books, made through the script. */
async function threeBooks() {
  const db = makeMandateFakeDb(seed(FOUNDER, P1, P2));
  const own = await json(db, ['create-book', '--uid', FOUNDER, '--go']);
  const b1 = await json(db, ['create-book-for', '--owner', P1, '--uid', FOUNDER, '--go']);
  const b2 = await json(db, ['create-book-for', '--owner', P2, '--archetype', 'diversifier', '--uid', FOUNDER, '--go']);
  for (const r of [own, b1, b2]) expect(r.code, JSON.stringify(r.body.answer)).toBe(EXIT.DONE);
  return { db, own: own.body.answer.bookId, b1: b1.body.answer.bookId, b2: b2.body.answer.bookId };
}

// ── THE COMMAND LINE ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the command line (B4): --owner and --archetype, where they belong', () => {
  it('--owner on status, resolve, pause, resume and wind-down; create-book-for needs it; admit, create-book and books refuse it', () => {
    for (const cmd of ['status', 'pause', 'resume', 'wind-down']) expect(parseArgs([cmd, '--owner', P1, '--uid', FOUNDER]).owner).toBe(P1);
    expect(parseArgs(['resolve', '--file', 'r.json', '--owner', P1, '--uid', FOUNDER]).owner).toBe(P1);
    expect(parseArgs(['create-book-for', '--owner', P1, '--archetype', 'degen', '--agent', 'a-1', '--uid', FOUNDER])).toMatchObject({ owner: P1, archetype: 'degen', agentId: 'a-1', uid: FOUNDER });
    expect(() => parseArgs(['create-book-for', '--uid', FOUNDER])).toThrow(/needs --owner/);
    expect(() => parseArgs(['admit', '--file', 'c.json', '--owner', P1, '--uid', FOUNDER])).toThrow(/not an option of admit/);
    expect(() => parseArgs(['create-book', '--owner', P1, '--uid', FOUNDER])).toThrow(/not an option of create-book/);
    expect(() => parseArgs(['books', '--owner', P1, '--uid', FOUNDER])).toThrow(/not an option of books/);
    expect(() => parseArgs(['status', '--archetype', 'degen', '--uid', FOUNDER])).toThrow(/not an option of status/);
  });

  it('a body without --owner — and so its request key — is exactly as before B4; with it, the owner joins the body and the key', () => {
    expect(bodyWithoutKey('pause', {})).toEqual({ action: 'pause' });
    expect(bodyWithoutKey('wind-down', { owner: null })).toEqual({ action: 'wind_down' });
    expect(bodyWithoutKey('resolve', { fileValue: { ideaId: 'i', kind: 'suspicion', recordId: 'r', decision: 'price_move', ownerUid: 'from-a-file' } })).toEqual({ action: 'resolve_hold', ideaId: 'i', kind: 'suspicion', recordId: 'r', decision: 'price_move' });
    expect(bodyWithoutKey('pause', { owner: P1 })).toEqual({ action: 'pause', ownerUid: P1 });
    expect(bodyWithoutKey('create-book-for', { owner: P1, archetype: 'degen' })).toEqual({ action: 'create_book_for', ownerUid: P1, archetypeCodeId: 'degen' });
    expect(requestKeyFor({ action: 'pause', ownerUid: P1 }, 'b')).not.toBe(requestKeyFor({ action: 'pause', ownerUid: P2 }, 'b'));
    expect(requestKeyFor({ action: 'pause', ownerUid: P1 }, 'b')).not.toBe(requestKeyFor({ action: 'pause' }, 'b'));
  });
});

// ── --owner, THROUGH THE DOOR ───────────────────────────────────────────────────────────────────────────────────────────

describe('--owner through the door: --uid acts, --owner is the book', () => {
  it('create-book-for --owner makes the PLAYER\'s book; without --go it sends nothing', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P1));
    const before = dumpStore(db);
    const dry = await json(db, ['create-book-for', '--owner', P1, '--uid', FOUNDER]);
    expect(dry.code).toBe(EXIT.REFUSED);
    expect(dry.body).toMatchObject({ sent: false, body: { action: 'create_book_for', ownerUid: P1 } });
    expect(dumpStore(db)).toBe(before);
    const go = await json(db, ['create-book-for', '--owner', P1, '--uid', FOUNDER, '--go']);
    expect(go.code).toBe(EXIT.DONE);
    expect(go.body.answer).toMatchObject({ ok: true, action: 'create_book_for', ownerUid: P1, attributionAgentId: `agent-${P1}` });
    expect(getBook(db, go.body.answer.bookId).userId).toBe(P1);
    // An unlisted owner: the door's refusal, passed through.
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, FOUNDER);
    const refused = await json(db, ['create-book-for', '--owner', P2, '--uid', FOUNDER, '--go']);
    expect(refused.code).toBe(EXIT.REFUSED);
    expect(refused.body.answer).toMatchObject({ error: 'owner_not_on_player_list', ownerUid: P2 });
  });

  it('pause, resume and wind-down --owner act on the player\'s book; the founder\'s own book does not move; a re-run is the door\'s replay', async () => {
    const { db, own, b1 } = await threeBooks();
    const nowIso = etIso(DAYS.d1, 8, 0);
    const paused = await json(db, ['pause', '--owner', P1, '--uid', FOUNDER, '--go'], { nowIso });
    expect(paused.body).toMatchObject({ sent: true, body: { action: 'pause', ownerUid: P1 }, answer: { ok: true, ownerUid: P1, bookId: b1, outcome: 'paused' } });
    expect(getBook(db, b1).drafting).toBe('paused');
    expect(getBook(db, own).drafting).toBe('on');
    const replay = await json(db, ['pause', '--owner', P1, '--uid', FOUNDER, '--go'], { nowIso });
    expect(replay.body).toMatchObject({ replay: true, bookNow: { bookId: b1, drafting: 'paused' } });
    expect((await json(db, ['resume', '--owner', P1, '--uid', FOUNDER, '--go'], { nowIso })).body.answer).toMatchObject({ outcome: 'resumed', bookId: b1 });
    expect((await json(db, ['wind-down', '--owner', P1, '--uid', FOUNDER, '--go'], { nowIso })).body.answer).toMatchObject({ outcome: 'draining', bookId: b1 });
    expect(getBook(db, b1)).toMatchObject({ status: 'draining', windDown: { requestedBy: FOUNDER } });
    expect(getBook(db, own).status).toBe('active');
  });

  it('resolve --owner rules on the PLAYER\'s idea, by the founder', async () => {
    const restore = setPracticeFieldModeForTests('on');
    const db = makeMandateFakeDb(seed(FOUNDER, P1));
    const made = await json(db, ['create-book-for', '--owner', P1, '--uid', FOUNDER, '--go']);
    restore();
    const bookId = made.body.answer.bookId;
    const Q = { AAPL: { price: 100, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
    const e = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: Q });
    await closeOn(db, bookId, DAYS.d1, Q);
    await closeOn(db, bookId, DAYS.d2, { ...Q, AAPL: 50 });
    const recordId = `suspected_split_AAPL_${DAYS.d2}`;
    // status --owner lists the player's record — what resolve needs.
    const st = await json(db, ['status', '--owner', P1, '--uid', FOUNDER], { nowIso: etIso(DAYS.d2, 19, 0) });
    expect(st.body.records.map((r) => [r.ideaId, r.kind, r.recordId])).toEqual([[e.ideaId, 'suspicion', recordId]]);
    const files = { 'r.json': JSON.stringify({ ideaId: e.ideaId, kind: 'suspicion', recordId, decision: 'price_move' }) };
    const r = await json(db, ['resolve', '--file', 'r.json', '--owner', P1, '--uid', FOUNDER, '--go'], { files, nowIso: etIso(DAYS.d3, 8, 0) });
    expect(r.code).toBe(EXIT.DONE);
    expect(r.body.answer).toMatchObject({ ok: true, ownerUid: P1, bookId, ideaId: e.ideaId });
    expect(getIdea(db, bookId, e.ideaId).founderRulings[0]).toMatchObject({ recordId, by: FOUNDER });
  });

  it('status --owner reads the player\'s book; status says whether the OWNER is on this machine\'s player list, with the redeploy sentence', async () => {
    const { db, b1 } = await threeBooks();
    const st = await json(db, ['status', '--owner', P1, '--uid', FOUNDER]);
    expect(st.body).toMatchObject({ owner: P1, ownerIsUid: false, onPlayerList: true, modeAdmitsOwner: true, founder: true, book: { bookId: b1, agentId: `agent-${P1}` } });
    const text = await cli(db, ['status', '--owner', P1, '--uid', FOUNDER]);
    expect(text.out).toContain(`player list     yes for owner ${P1}`);
    expect(text.out).toContain(PLAYER_LIST_REDEPLOY_SENTENCE);
    expect(text.out).toContain(`owner           ${P1}`);
    expect(text.out).not.toContain('cockpit list');
    // A removed player: the line says so; the founder still reads the book.
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, [FOUNDER, P2].join(','));
    const removed = await json(db, ['status', '--owner', P1, '--uid', FOUNDER]);
    expect(removed.body).toMatchObject({ onPlayerList: false, modeAdmitsOwner: false, book: { bookId: b1 } });
    // The founder's own status: his own line.
    const mine = await cli(db, ['status', '--uid', FOUNDER]);
    expect(mine.out).toContain('player list     yes   (PRACTICE_FIELD_PLAYER_UIDS, this machine');
  });

  it('a uid that is not a founder is refused by every new path, with nothing read', async () => {
    for (const args of [
      ['books', '--uid', P1], ['status', '--owner', P2, '--uid', P1], ['create-book-for', '--owner', P2, '--uid', P1, '--go'],
      ['pause', '--owner', P2, '--uid', P1, '--go'], ['wind-down', '--owner', P2, '--uid', P1, '--go'],
    ]) {
      const r = await cli(untouchable(), args);
      expect(r.code, args.join(' ')).toBe(EXIT.REFUSED);
      expect(r.out, args.join(' ')).toContain('REFUSED (founder)');
    }
  });
});

// ── books ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('books: one line per open idea book', () => {
  it('every open book with its owner, state, value, last close, the desks\' sources, spend and open records; books with open records first; reads only', async () => {
    const restore = setPracticeFieldModeForTests('on');
    const { db, own, b1, b2 } = await threeBooks();
    // P2's book: an entered idea with a suspicion — an open record waiting on the founder.
    const Q = { AAPL: { price: 100, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
    const e = await admitAndEnter(db, b2, { contract: contractOf(), quotes: Q });
    for (const b of [own, b1]) await closeOn(db, b, DAYS.d1, Q);
    await closeOn(db, b2, DAYS.d1, Q);
    await closeOn(db, b2, DAYS.d2, { ...Q, AAPL: 50 });
    restore();
    // P1's book is paused.
    await json(db, ['pause', '--owner', P1, '--uid', FOUNDER, '--go'], { nowIso: etIso(DAYS.d2, 8, 0) });
    const before = dumpStore(db);
    const r = await json(db, ['books', '--uid', FOUNDER], { nowIso: etIso(DAYS.d2, 19, 0) });
    expect(dumpStore(db)).toBe(before);
    expect(r.code).toBe(EXIT.DONE);
    expect(r.body.books.map((b) => [b.ownerUid, b.bookId, b.openRecords])).toEqual([
      [P2, b2, 1], // open records first
      [FOUNDER, own, 0],
      [P1, b1, 0],
    ]);
    expect(r.body.books[0]).toMatchObject({ status: 'active', drafting: 'on', lastClose: DAYS.d2, agentOn: false, desks: null, spend: { month: '2026-11', boundUsd: 3 } });
    expect(r.body.books[2]).toMatchObject({ drafting: 'paused', lastClose: DAYS.d1 });
    expect(typeof r.body.books[0].valueUsd).toBe('number');
    expect(getIdea(db, b2, e.ideaId).ledger.holdings.AAPL.basisSuspicion).toBeTruthy();
    const text = await cli(db, ['books', '--uid', FOUNDER], { nowIso: etIso(DAYS.d2, 19, 0) });
    expect(text.out).toContain('open books      3   (books with open records first)');
    expect(text.out.indexOf(P2)).toBeLessThan(text.out.indexOf(P1));
    expect(text.out).toContain('open records 1');
    expect(text.out).toContain('agent off in this checkout');
  });

  it('with the agent on: each desk\'s latest source from the last close row — "not checked" for a desk the close window never reached', async () => {
    restoreAgent = setPracticeFieldAgentForTests({ agent: true });
    const restore = setPracticeFieldModeForTests('on');
    const { db, own, b1 } = await threeBooks();
    for (const b of [own, b1]) await closeOn(db, b, DAYS.d1, quotesOn());
    // The founder's close row: the Shadow desk done from the model, the archetype desk never reached (no part).
    const row = db._get(`mandates/${own}/windows/${DAYS.d1}_close`);
    db._store.set(`mandates/${own}/windows/${DAYS.d1}_close`, { data: { ...row, agent: { desks: { shadow: { status: 'done', source: 'model' } } } }, version: 9 });
    // P1's: the archetype desk deferred after one attempt (in progress), the Shadow desk fell back to code.
    const row1 = db._get(`mandates/${b1}/windows/${DAYS.d1}_close`);
    db._store.set(`mandates/${b1}/windows/${DAYS.d1}_close`, { data: { ...row1, agent: { desks: { shadow: { status: 'done', source: 'code_fallback', fallbackReason: 'transport_failed' }, archetype: { status: 'in_progress', attempts: [{}] } } } }, version: 9 });
    restore();
    const r = await json(db, ['books', '--uid', FOUNDER], { nowIso: etIso(DAYS.d1, 19, 0) });
    const byOwner = Object.fromEntries(r.body.books.map((b) => [b.ownerUid, b]));
    expect(byOwner[FOUNDER].desks).toEqual({ shadow: { source: 'model', fallbackReason: null }, archetype: { source: 'not_checked', fallbackReason: null } });
    expect(byOwner[P1].desks).toEqual({ shadow: { source: 'code_fallback', fallbackReason: 'transport_failed' }, archetype: { source: 'not_finished', fallbackReason: null } });
    expect(byOwner[P2].desks).toBeNull(); // no close yet
    const text = await cli(db, ['books', '--uid', FOUNDER], { nowIso: etIso(DAYS.d1, 19, 0) });
    expect(text.out).toContain('shadow model · archetype not_checked');
    expect(deskSourceOf(undefined)).toEqual({ source: 'not_checked', fallbackReason: null });
  });
});

// ── THE TWO FIXES ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('fix 1 (Q-7): sessions left agrees with the agent\'s prompt and the screen', () => {
  it('after each close, status says the number the desk\'s prompt said for the same idea at that close', { timeout: 60_000 }, async () => {
    restoreAgent = setPracticeFieldAgentForTests({ agent: true });
    const restore = setPracticeFieldModeForTests('on');
    const db = makeMandateFakeDb(seed(FOUNDER));
    const made = await json(db, ['create-book', '--uid', FOUNDER, '--go']);
    const bookId = made.body.answer.bookId;
    const medium = await admitIdea(db, { bookId, contract: foundersMediumIdea(), opId: 'founder-medium', nowIso: etIso(DAYS.admit, 11, 0) });
    expect(medium.ok).toBe(true);
    const fake = fakeTransport(({ request }) => toolResponse(holdAll(request)));
    const checked = [];
    let date = DAYS.d1;
    for (let i = 0; i < 4; i += 1) {
      const callsBefore = fake.calls.length;
      await runSession(db, bookId, date, { quotes: quotesOn({ drift: i * 0.001 }), transport: fake.transport });
      const said = fake.calls.slice(callsBefore).map((c) => /(\d+) sessions to its review \(([\d-]+)\)/.exec(c.request.content.messages[0].content)).filter(Boolean);
      expect(said.length, date).toBeGreaterThan(0);
      const st = await json(db, ['status', '--uid', FOUNDER], { nowIso: new Date(agentNowOf(date).getTime() + 3600_000).toISOString() });
      expect(st.body.book.lastClosedSession).toBe(date);
      const left = st.body.book.slots.medium.sessionsLeft;
      expect(left, date).toBe(Number(said[0][1]));
      expect(left, date).toBe(sessionsLeftOf(date, said[0][2])); // the screen's own count
      checked.push([date, left]);
      date = nextSessionDate(date);
    }
    restore();
    // A 30-session idea entered on the first session: its entry close is day 0 of 30, as the screen draws it (B3 Q-3).
    expect(checked.map(([, n]) => n)).toEqual([30, 29, 28, 27]);
    expect(sessionsLeft(DAYS.d1, '2026-11-20')).toBe(sessionsLeftOf(DAYS.d1, '2026-11-20'));
  });
});

describe('fix 2: the parse-report alerts list only what the book held or had reserved when that session\'s report was written', () => {
  /** The founder's book: an idea admitted Friday and entered Monday; Monday's close; then two ideas admitted AT that close. */
  async function theTwentyFifthShape() {
    const restore = setPracticeFieldModeForTests('on');
    const db = makeMandateFakeDb(seed(FOUNDER));
    const made = await json(db, ['create-book', '--uid', FOUNDER, '--go']);
    const bookId = made.body.answer.bookId;
    const q = quotesOn();
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: q });
    await closeOn(db, bookId, DAYS.d1, q);
    // Two ideas admitted after Monday's close (as the agent drafts them), on names Monday's report never covered.
    const atClose = new Date(closeNowOf(DAYS.d1).getTime() + 5 * 60_000).toISOString();
    const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['JPM', 'BAC'], capitalUsd: 25000 }), opId: 'after-1', nowIso: atClose });
    const c = await admitIdea(db, { bookId, contract: contractOf({ slot: 'long', names: ['XOM', 'CVX'], capitalUsd: 30000 }), opId: 'after-2', nowIso: atClose });
    expect([b.ok, c.ok], JSON.stringify([b.refusals, c.refusals])).toEqual([true, true]);
    omitParseReport(db, DAYS.d1, ['JPM', 'BAC', 'XOM', 'CVX']); // the report written that morning did not cover them
    restore();
    return { db, bookId, ideaA: a.ideaId, later: [b.ideaId, c.ideaId] };
  }
  const evening = () => new Date(closeNowOf(DAYS.d1).getTime() + 3 * 3600_000).toISOString();

  it('the 25 Nov shape: two ideas admitted at the close are NOT alerts — the status names them as admitted after the report', async () => {
    const { db, later } = await theTwentyFifthShape();
    const st = await json(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
    expect(st.body.parseReport).toMatchObject({ session: DAYS.d1, alerts: [], cutoff: { source: 'daily_build', at: etIso(DAYS.d1, 9, 0) } });
    expect([...st.body.parseReport.admittedAfter].sort()).toEqual([...later].sort());
    const text = await cli(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
    expect(text.out).toContain('clean for the book\'s symbols');
    expect(text.out).toContain('2 idea(s) admitted after this report was written');
  });

  it('the positive control: a name the book held when the report was written, missing from it, IS still an alert', async () => {
    const { db } = await theTwentyFifthShape();
    omitParseReport(db, DAYS.d1, ['AAPL']);
    const st = await json(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
    expect(st.body.parseReport.alerts).toEqual([{ session: DAYS.d1, symbol: 'AAPL', reason: 'parse_report_missing' }]);
  });

  it('with no daily layer stored for the session, the cut-off is the session\'s close: ideas admitted after it are still not alerts; before it, they are', async () => {
    const { db } = await theTwentyFifthShape();
    db._store.delete(`mandateUniverseDaily/${DAYS.d1}`);
    omitParseReport(db, DAYS.d1, ['AAPL']);
    const st = await json(db, ['status', '--uid', FOUNDER], { nowIso: evening() });
    expect(st.body.parseReport.cutoff.source).toBe('session_close');
    expect(st.body.parseReport.alerts.map((a) => a.symbol)).toEqual(['AAPL']);
  });
});
