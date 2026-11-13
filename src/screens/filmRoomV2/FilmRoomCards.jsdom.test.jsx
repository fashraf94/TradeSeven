// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomCards.jsdom.test.jsx
//
// Film Room B2 item 9 — THE CARD ON THE SCREEN (Build B spec §6; Amendment G
// RG-2 … RG-9), under FILM_ROOM_CARDS_MODE 'on', over tape days the REAL
// close pass wrote (the B1 acceptance day: ACN stalled at checks 4 and 5 on
// the recorded basis; the same day without the records: the recomputed
// basis), with the screen's API seam routed through the REAL card handler
// (api/film-room/card.js) and the REAL counter logic over the tape suites'
// in-memory Firestore — the whole contract, minus HTTP.
//   prepared-case    the moments longest first: symbol, from–to, checks (D),
//                    Take this home; no moments; unavailable with the reason
//   check detail     the tag line: the count R on the recorded basis, D on
//                    the recomputed (RG-3), the threshold D, Take this home
//   your-call        the form: the facts, the three questions word for word,
//                    the note with "n of 280", the three routes in RG-5's
//                    words, Set's plain words (RG-9), "n of 5"
//   receipt          the note as an R7 quotation bound to the ledger path
//                    ("— you · time"), the route and stage, RG-5's sentence,
//                    Retire
//   since-last-time  each open Watch card with its recurrences on the same
//                    agent's later days, linked to their battle day and moment
//                    (RG-4) — in another battle through App's P1c door, or
//                    said unreadable (B2.1 B2, RH-2); My cards active ·
//                    shelved · retired, shelving explained (acceptance D on
//                    the screen)
//   the sweeps       numbers and their classes, words, signs, quotations,
//                    stored notes, the agent's name — clean at every depth
//                    with every region open
// Dependency-surface guard (BUILD_RULES §4): the real passes, store, handler
// and counter; only the flags, the security and auth middleware and the Admin
// handle are doubled.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// The armory flip (Nov 7, 2026). The per-game flag is held here, not read live, so a rollback reddens only its pin. The
// rows in KILL_SWITCH_ROWS run with it held OFF, and keep guarding the path a rollback restores: each files its cards
// through createCard against the agent's current archetype, the flag-off rule (A2's R4); with per-game loadouts on a
// card is checked against its battle's own archetype and shelved against both loadouts, which cardStore.perGame.test.js
// holds, and nothing else in the ledger reads the flag. Every other row runs with it ON, the shipped state.
const flip = vi.hoisted(() => ({ on: true }));
vi.mock('../../config/perGameLoadoutFlags.js', () => ({ get PER_GAME_LOADOUT_ENABLED() { return flip.on; } }));
const KILL_SWITCH_ROWS = new Set([
  "B2.1 B3 (Amendment H RH-6) — an unavailable day, on the screen: no recurrence from it, and the count of such days said in RJ-7's style > Amendment K RK-10 — no open Watch card: no line, however many days could not be read — none filed, an Offer card, a retired Watch card (the mutant: the unavailable-day line with no open Watch card)",
  "B2.1 B3 (Amendment H RH-6) — an unavailable day, on the screen: no recurrence from it, and the count of such days said in RJ-7's style > RK-10 — one open Watch card: the line as built, beside its list",
  "B2.1 B3 (Amendment H RH-6) — an unavailable day, on the screen: no recurrence from it, and the count of such days said in RJ-7's style > review SPR-C-4 — another agent's unavailable days are that agent's: the line counts the battle's own agent alone",
  "B2.1 B3 (Amendment H RH-6) — an unavailable day, on the screen: no recurrence from it, and the count of such days said in RJ-7's style > review SPR-T-8 — two of its own: RJ-7's plural (the mutant: the line always singular)",
]);
beforeEach(() => { flip.on = !KILL_SWITCH_ROWS.has(expect.getState().currentTestName); });
import React from 'react';

const state = vi.hoisted(() => ({ cards: 'on', db: null, uid: 'owner-1', characterTab: true, tempoDial: true }));
vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return state.cards; },
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  // Amendment K RK-2: Set's link needs the Forge's Character tab and the tempo dial on (both live); a row turns each off
  get RELEASE3_CHARACTER_TAB_ENABLED() { return state.characterTab; },
  get TEMPO_DIAL_ENABLED() { return state.tempoDial; },
}));
vi.mock('../../../api/_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../../../api/_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('../../../api/_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { writeTapeDay } from '../../../api/_utils/filmTape/writeTapeDay.js';
import { makeTapeDb } from '../../../api/_utils/filmTape/__fixtures__/tapeFirestore.js';
import { seedDay, OWNER, AGENT } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { stalledDay } from '../../../api/_utils/filmTape/__fixtures__/tagFixtures.js';
import { buildCounter } from '../../../api/_utils/filmRoom/cardCounter.js';
import { retireCard, createCard, applyServerTransition } from '../../../api/_utils/filmRoom/cardStore.js';
import cardHandler from '../../../api/film-room/card.js';
import { setPracticeFieldSeam, resetPracticeFieldSeam } from '../../../api/_utils/filmRoom/practiceFieldSeam.js';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { momentsOf } from '../../utils/filmRoomMoments';
import { ledgerOf, latestOf, chainOf, groupCards } from './filmRoomCards';
import { setRuleOf, setStateOf, YourCall, Receipt } from './FilmRoomCardRegions';
import { FILM_ROOM_COPY } from './filmRoomCopy';
const COPY_CARDS = FILM_ROOM_COPY.cards;
import { FORGE_AREAS, forgeAreaOf } from '../../components/CommandCenter/hubChrome';
import { OPEN_BATTLE_REVIEW_EVENT } from '../../components/Forge/Watchlist/ideaNavigation';
import {
  mounter, sep23Tape, sep23Series, readersOf, NOW, sweepNumbers, sweepWords, sweepSigns, quoteDefects, storedNoteDefects, agentNameDefects,
} from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const B = 'b-cards';
const D1 = '2026-09-24';
const D2 = '2026-09-25';
const NIGHT = (d) => Date.parse(`${d}T22:15:30.000-04:00`) + 60_000;
const RG5 = {
  watch: 'The Film Room counts each time this comes back.',
  // Build C §5 (BC-3): Offer replaces Practice, and its note is the spec's sentence
  offer: 'Your agent considers this moment at its next chance. It may take it, defer it or decline it, and says why.',
  set: 'You change the setting yourself; this card changes nothing.',
};

/** The two-day battle: day 1 on the recorded basis (the acceptance shape), day 2 the standard day on the recorded basis; a copy of day 1 without records (recomputed). */
let fx;
beforeAll(async () => {
  const two = { timing: { tradingDays: [D1, D2], currentTradingDay: 2, timezone: 'America/New_York' } };
  // each day is written in its own store (the fixture's tick ids repeat per day); the two tape documents are then merged under one battle
  const d1 = await stalledDay({ battleId: B, noTriggerSeqs: [3, 4], meetingSeqs: [5], exitSeq: 6, recordStagnation: true, etDate: D1, over: two });
  const t1 = makeTapeDb(seedDay({}, d1));
  await writeTapeDay(B, D1, { db: t1.db, now: NIGHT(D1) });
  const d2 = await stalledDay({ battleId: B, recordStagnation: true, etDate: D2, over: { ...two, status: 'completed', completedAt: `${D2}T20:05:00.000Z` } });
  const t2 = makeTapeDb(seedDay({}, d2));
  await writeTapeDay(B, D2, { db: t2.db, now: NIGHT(D2) });
  const tape1 = t1.store.get(`agentBattles/${B}/tape/${D1}`);
  const tape2 = t2.store.get(`agentBattles/${B}/tape/${D2}`);
  const t = { store: new Map([...t1.store.entries(), [`agentBattles/${B}/tape/${D2}`, tape2], [`agentBattles/${B}`, d2.battle]]) };
  expect(tape1.tags.items.map((i) => [i.symbol, i.tickSeq])).toEqual([['ACN', 4], ['ACN', 5]]);
  expect(tape2.tags.items.length).toBeGreaterThan(0);
  // the recomputed twin of day 1 (no records on its ticks), written on its own
  const r1 = await stalledDay({ battleId: 'b-recomputed', noTriggerSeqs: [], exitSeq: 6, recordStagnation: false, etDate: D1 });
  const tr = makeTapeDb(seedDay({}, r1));
  await writeTapeDay('b-recomputed', D1, { db: tr.db, now: NIGHT(D1) });
  const recomputed = tr.store.get(`agentBattles/b-recomputed/tape/${D1}`);
  expect(Object.values(recomputed.tags.inputs.holdingBasis).every((b) => b === 'recomputed')).toBe(true);
  // Amendment K RK-2: day 2 again, run with a tempo the player set (agentContext.dials) — the ranked agent's battle; the
  // fixture's own days record none (tags.inputs.tempoDesired null): the dial never set — as on any battle, ranked or casual, whose owner never moved the dial (review KR2-1), and on every casual battle from before the clone build
  const d2t = await stalledDay({ battleId: B, recordStagnation: true, etDate: D2, dials: { tempo: 'standard' }, over: { ...two, status: 'completed', completedAt: `${D2}T20:05:00.000Z` } });
  const tt = makeTapeDb(seedDay({}, d2t));
  await writeTapeDay(B, D2, { db: tt.db, now: NIGHT(D2) });
  const tape2Tempo = tt.store.get(`agentBattles/${B}/tape/${D2}`);
  expect(tape2.tags.inputs.tempoDesired).toBeNull();
  expect(tape2Tempo.tags.inputs.tempoDesired).toBe('standard');
  expect(momentsOf(tape2Tempo.tags.items)).toEqual(momentsOf(tape2.tags.items));
  fx = { store: Object.fromEntries([...t.store.entries()]), battle: d2.battle, tape1, tape2, tape2Tempo, recomputed, recomputedBattle: r1.battle };
});

const m = mounter();
const mkRes = () => ({ statusCode: null, body: null, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
/** The screen's API seam, routed through the real handler and the real counter over the fake handle. */
const COUNTER_NOW = Date.parse('2026-09-26T00:00:00.000Z');
const apiOf = () => {
  const api = {
    calls: [],   // every call through the seam: ['counter', agentId] | ['card', body]
    readVerdict: async () => true,
    readCounter: async (agentId) => {
      api.calls.push(['counter', agentId]);
      // a typed refusal answers as the endpoint sends it (api/film-room/counter.js → sendCardError), never a throw
      try { const body = await buildCounter(state.db, { uid: state.uid, agentId, nowMs: COUNTER_NOW }); return { ok: !body.error, status: body.error ? 400 : 200, body }; }
      catch (err) { if (!err?.cardRoute) throw err; return { ok: false, status: err.status, body: { error: err.code, message: err.message, ...err.extra } }; }
    },
    postCard: async (body) => { api.calls.push(['card', body]); const res = mkRes(); await cardHandler({ method: 'POST', headers: {}, body }, res); return { ok: res.statusCode === 200, status: res.statusCode, body: res.body }; },
    newOpId: (() => { let n = 0; return () => `op_${(n += 1)}`; })(),
  };
  return api;
};
const counterCalls = () => api.calls.filter((c) => c[0] === 'counter').length;
const cardBodies = () => api.calls.filter((c) => c[0] === 'card').map((c) => c[1]);
let t; let api; let lastBattle = null;
const battleOf = (over = {}) => ({ id: B, agentBattleId: B, ownerId: OWNER, agentId: AGENT, status: 'completed', completedAt: `${D2}T20:05:00.000Z`, timing: { tradingDays: [D1, D2] }, agentContext: { agentName: 'Momentum chaser', archetype: 'momentum_chaser' }, gameMode: 'baggerbomb_agent', ...over });
beforeEach(() => {
  state.cards = 'on'; state.uid = OWNER; state.characterTab = true; state.tempoDial = true;
  t = makeTapeDb({ ...fx.store, [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' } });
  state.db = t.db;
  api = apiOf();
  globalThis.localStorage.clear();
  m.setup();
});
afterEach(() => { m.teardown(); vi.restoreAllMocks(); resetPracticeFieldSeam(); });
/** Build C §4: the owner's book open, through the Practice Field's seam (T1a's helper, stubbed) — the counter and the card handler both read it. */
const BOOK_ID = 'book-1';
/** Amendment A CA-12: the book document the nominate and Offer transactions re-read — the owner's idea book, for the agent. */
const seedBookDoc = (status = 'active') => t.store.set(`mandates/${BOOK_ID}`, { userId: OWNER, kind: 'idea_book', status, attributionAgentId: AGENT });
const openBook = (status = 'active') => { setPracticeFieldSeam({ bookForOwner: async (_db, { uid, attributionAgentId }) => (uid === OWNER && attributionAgentId === AGENT ? { bookId: BOOK_ID, status } : null) }); seedBookDoc(status); };

let lastReaders = null;
/** `readBattle` (B2.1 B2): the readers' read of another battle's document; `openAt`: what App hands the screen it opens. */
async function open({ battle = battleOf(), tapes = { [D1]: fx.tape1, [D2]: fx.tape2 }, series = [], readBattle = null, openAt = undefined } = {}) {
  lastBattle = battle;
  lastReaders = readersOf(tapes, series);
  if (readBattle) lastReaders.readBattle = readBattle;
  m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={lastReaders} nowMs={NOW} cardsApi={api} openAt={openAt} />);
  await m.flush(8);
}
const depth = async (label) => { m.click(m.tab(label)); await m.flush(); };
const text = () => m.container.textContent;
const region = (name) => m.q(`[data-cards-region="${name}"]`);
/**
 * The documents the sweeps read: the shown tape, the battle, the ledger (each card under its entry id, as the
 * quotation path names it), the agent's archetype as the store holds it NOW (the open-count oracle recomputes
 * shelving from it — review L3-9c) and the battle's tape days by date (a recurrence row's oracle — review L3-9b).
 */
const docsFor = (tape, { day = tape?.etDate ?? null, ...over } = {}) => ({ tape, battle: lastBattle ?? battleOf(), ledger: { etDate: day, cards: ledgerMap() }, agentArchetype: t.store.get(`agents/${AGENT}`)?.archetype ?? null, tapeDays: { [D1]: fx.tape1, [D2]: fx.tape2 }, ...over });
/** The ledger as the counter answers it now (the suite's own read of the fake, for the sweeps' oracle). */
let lastCounter = null;
async function ledgerRefresh() { lastCounter = await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW }); }
const ledgerCards = () => (lastCounter ? lastCounter.cards : []);
const ledgerMap = () => Object.fromEntries(ledgerCards().map((c) => [c.entryId, c]));
const sweepAll = async (tape, where, over = {}) => {
  await ledgerRefresh();
  const docs = docsFor(tape, over);
  expect(sweepNumbers(m.container, docs), where).toEqual([]);
  expect(sweepWords(m.container, docs), where).toEqual([]);
  expect(sweepSigns(m.container), where).toEqual([]);
  expect(quoteDefects(m.container, docs), where).toEqual([]);
  expect(storedNoteDefects(m.container, docs), where).toEqual([]);
  expect(agentNameDefects(m.container, docs), where).toEqual([]);
};
const setValue = (el, value) => { const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
/** Run `fn` with the clock (Date alone — no timer is faked) set to `iso`: the handler stamps `new Date()` (review L4-8). */
async function atClock(iso, fn) {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(iso) });
  try { return await fn(); } finally { vi.useRealTimers(); }
}
async function fileCard({ note = 'Let it go sooner.', route = 'watch', question = 'stalled.want' } = {}) {
  m.click(m.q(`[data-question="${question}"] input`));
  m.click(m.q(`[data-route="${route}"] input`));
  await m.flush(1);
  await (async () => { const ta = m.q('[data-note]'); await import('react').then(({ act }) => act(() => setValue(ta, note))); })();
  await m.flush(1);
  m.click(m.q('[data-card-form] button[type="submit"]'));
  await m.flush(10);
}

describe('RG-2 — under cards mode the reserved regions hold content; the screen opens on the last day', () => {
  it('the header holds Since last time and Prepared case, the footer its host; the empty aria-hidden regions are gone', async () => {
    await open();
    expect(m.q('[data-reserved-region]')).toBeNull();
    expect(region('since-last-time').closest('header')).toBeTruthy();
    expect(region('prepared-case').closest('header')).toBeTruthy();
    expect(m.q('footer [data-cards-regions="footer"]')).toBeTruthy();
    expect(text()).toContain('Since last time');
    expect(text()).toContain('Prepared case');
  });
  it("'off' or not admitted (the gate seam answers no under allowlist): the empty regions, as the golden", async () => {
    state.cards = 'off';
    await open();
    expect(m.qa('[data-reserved-slot]')).toHaveLength(4);
    expect(m.q('[data-cards-region]')).toBeNull();
    m.teardown(); m.setup();
    state.cards = 'allowlist';
    api.readVerdict = async () => false;
    await open();
    expect(m.qa('[data-reserved-slot]')).toHaveLength(4);
    expect(m.q('[data-cards-region]')).toBeNull();
  });
});

describe('prepared-case — the day\'s moments, longest first (RG-6)', () => {
  it('day 2 (the standard day): the stalled run of ACN as one moment — symbol, from–to as instants, its checks marked D, Take this home; nothing of how it turned out', async () => {
    await open();
    const rows = m.qa('[data-moment-row]');
    const want = momentsOf(fx.tape2.tags.items);
    expect(rows.map((r) => r.getAttribute('data-moment-row'))).toEqual(want.map((w) => `${w.situationId}:${w.symbol}:${w.fromTickSeq}-${w.toTickSeq}`));
    const first = rows[0];
    expect(first.querySelector('[data-record-text]').textContent).toBe(want[0].symbol);
    expect(first.querySelectorAll('[data-time]')).toHaveLength(2);
    const n = first.querySelector('[data-num-aggregate="count(tags.items[] in a moment)"]');
    expect(n.getAttribute('data-num-class')).toBe('derived');
    expect(n.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('derived');
    expect(Number(n.getAttribute('data-agg-value'))).toBe(want[0].checks);
    expect(first.textContent).toContain('Take this home');
    for (const w of ['price', 'score', 'result', 'won', 'lost', 'fired', 'exit']) expect(region('prepared-case').textContent.toLowerCase(), w).not.toContain(w);
    expect(region('prepared-case').textContent).not.toMatch(/\$|%/);
  });
  it('a planted second symbol with a longer run lists first; equal runs go to the earlier moment', async () => {
    const items = fx.tape2.tags.items;
    const at = (seq) => new Date(Date.parse(`${D2}T13:30:20.000Z`) + (seq - 1) * 15 * 60_000).toISOString();
    const plant = (symbol, seqs) => seqs.map((seq) => ({ ...items[0], symbol, tickSeq: seq, at: at(seq), count: 3 }));
    const tape = { ...fx.tape2, tags: { ...fx.tape2.tags, items: [...items, ...plant('ZZZ', [20, 21, 22, 23, 24]), ...plant('AAA', [2, 3])] } };
    await open({ tapes: { [D1]: fx.tape1, [D2]: tape } });
    const rows = m.qa('[data-moment-row]').map((r) => r.getAttribute('data-moment-row'));
    const acn = momentsOf(items).filter((mm) => mm.symbol === 'ACN');
    expect(acn.map((mm) => [mm.fromTickSeq, mm.toTickSeq, mm.checks])).toEqual([[4, 5, 2]]);   // the standard day: ACN stalled at 4 and 5
    expect(rows).toEqual(['stalled:ZZZ:20-24', 'stalled:AAA:2-3', 'stalled:ACN:4-5']);   // longest first; the tie at two checks to the earlier
    await sweepAll(tape, 'planted');
  });
  it('a day with tags but no item: "No moments matched this day\'s situations." (absence, no marker)', async () => {
    const tape = { ...fx.tape2, tags: { ...fx.tape2.tags, items: [] } };
    await open({ tapes: { [D1]: fx.tape1, [D2]: tape } });
    expect(region('prepared-case').textContent).toContain("No moments matched this day's situations.");
    expect(m.qa('[data-moment-row]')).toEqual([]);
    await sweepAll(tape, 'none');
  });
  it('acceptance I — a day whose stalled is unavailable shows the coverage reason as stored (bound), and no rows; the stored note is a quotation of the tape', async () => {
    await open({ battle: battleOf({ id: sep23Tape.battleId, agentBattleId: sep23Tape.battleId, timing: { tradingDays: [sep23Tape.etDate] }, completedAt: sep23Tape.battle.completedAt }), tapes: { [sep23Tape.etDate]: sep23Tape }, series: sep23Series });
    const pc = region('prepared-case');
    expect(pc.querySelector('[data-coverage="unavailable"]')).toBeTruthy();
    const note = pc.querySelector('[data-stored-note="coverage.tags.note"]');
    expect(note.textContent).toBe(sep23Tape.coverage.tags.note);
    expect(note.textContent).toMatch(/^stalled unavailable:/);
    expect(m.qa('[data-moment-row]')).toEqual([]);
    expect(pc.textContent).not.toContain('No moments matched');
    await ledgerRefresh();
    const docs = { tape: sep23Tape, battle: lastBattle, ledger: { etDate: sep23Tape.etDate, cards: ledgerCards() } };
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(sweepWords(m.container, docs)).toEqual([]);
    expect(storedNoteDefects(m.container, docs)).toEqual([]);
  });
});

describe('check detail — the tag line (RG-3: the count takes its basis\'s class)', () => {
  const open4 = async (tape, battle) => {
    await open({ battle, tapes: { [tape.etDate]: tape } });
    const i = tape.checks.findIndex((c) => c.tickSeq === 4);
    await depth('Study');
    m.click(m.q(`[data-check-row="${i}"]`));
    await m.flush();
    return i;
  };
  it('the recorded basis: the count is the check\'s own record (R), the threshold the item\'s (D), the situation named, Take this home', async () => {
    const i = await open4(fx.tape1, battleOf({ timing: { tradingDays: [D1] }, completedAt: null, status: 'active' }));
    const tag = m.q('[data-check-tag="stalled:ACN"]');
    expect(tag).toBeTruthy();
    expect(tag.getAttribute('data-count-basis')).toBe('recorded');
    expect(tag.textContent).toContain('Our stocks are not moving');
    const nums = [...tag.querySelectorAll('[data-num]')];
    expect(nums.map((n) => [n.getAttribute('data-num'), n.getAttribute('data-num-class')])).toEqual([[`checks[${i}].stagnation.ACN.ticks`, 'recorded'], ['tags.items[0].effectiveTicksThreshold', 'derived']]);
    expect(nums[0].querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('recorded');
    expect(Number(nums[0].querySelector('[data-num-text]').textContent)).toBe(fx.tape1.tags.items[0].count);
    expect(tag.textContent).toContain('Take this home');
    await sweepAll(fx.tape1, 'recorded check');
  });
  it('the recomputed basis: the count is the item\'s own (D) — never shown as R, never as D on a recorded day (the mutant)', async () => {
    const i = await open4(fx.recomputed, battleOf({ id: 'b-recomputed', agentBattleId: 'b-recomputed', timing: { tradingDays: [D1] }, completedAt: null, status: 'active' }));
    const tag = m.q('[data-check-tag="stalled:ACN"]');
    expect(tag.getAttribute('data-count-basis')).toBe('recomputed');
    const nums = [...tag.querySelectorAll('[data-num]')];
    expect(nums.map((n) => [n.getAttribute('data-num'), n.getAttribute('data-num-class')])).toEqual([['tags.items[0].count', 'derived'], ['tags.items[0].effectiveTicksThreshold', 'derived']]);
    expect(i).toBeGreaterThanOrEqual(0);
    await sweepAll(fx.recomputed, 'recomputed check');
  });
  it('Take this home from the check opens the form for the moment that holds the check', async () => {
    await open4(fx.tape1, battleOf({ timing: { tradingDays: [D1] }, completedAt: null, status: 'active' }));
    m.click(m.buttons('Take this home').find((b) => b.closest('[data-check-tag]')));
    await m.flush();
    expect(m.q('[data-card-form]').getAttribute('data-card-form')).toBe('stalled:ACN:4-5');
  });
});

describe('your-call — the form (spec §6; RG-5, RG-8, RG-9)', () => {
  it('the moment\'s facts, the three questions word for word, the note with "n of 280" marked, the three routes in RG-5\'s words, Set with no link, the open-card count "n of 5" marked', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    const form = m.q('[data-card-form]');
    expect(form.closest('footer')).toBeTruthy();
    expect(form.id).toBe('your-call');
    expect(form.querySelector('[data-moment-facts]')).toBeTruthy();
    expect(m.qa('[data-question]').map((l) => l.textContent)).toEqual(SITUATION_QUESTIONS.map((q) => q.text));
    // Build C §5: no book (the seam's default) → Watch and Set only, and not a word of the book
    expect(m.qa('[data-route]').map((l) => l.getAttribute('data-route'))).toEqual(['watch', 'set']);
    for (const r of ['watch', 'set']) expect(m.q(`[data-route="${r}"]`).textContent).toContain(RG5[r]);
    expect(form.textContent).not.toMatch(/Offer|Practice|book/);
    expect(m.q('[data-route="set"]').querySelector('a')).toBeNull();
    // B2.1 B1: this mount hands the screen no Forge door, so Set shows no link even with the day's rule on
    expect(fx.tape1.tags.inputs.forcedRotation.enabled).toBe(true);
    expect(m.q('[data-set-link]')).toBeNull();
    const noteCount = form.querySelector('[data-note-count]');
    expect([...noteCount.querySelectorAll('[data-num-aggregate]')].map((n) => [n.getAttribute('data-num-aggregate'), n.getAttribute('data-num-class'), n.getAttribute('data-agg-value')])).toEqual([['count(characters in the note)', 'derived', '0'], ['slot(S10 note characters)', 'recorded', '280']]);
    const openCount = form.querySelector('[data-open-count]');
    expect([...openCount.querySelectorAll('[data-num-aggregate]')].map((n) => [n.getAttribute('data-num-aggregate'), n.getAttribute('data-num-class'), n.getAttribute('data-agg-value')])).toEqual([['count(plays[] open)', 'derived', '0'], ['slot(S9 open cards per agent)', 'recorded', '5']]);
    expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
    // RG-5: no route says the agent learns from, reads or follows a card
    expect(form.textContent).not.toMatch(/agent (learns|reads|follows|will)/i);
    await sweepAll(fx.tape2, 'form');
  });
  it('typing moves the count; a note over 280 cannot be filed; Cancel closes the form', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    const { act } = await import('react');
    act(() => setValue(m.q('[data-note]'), 'Let it go sooner.'));
    await m.flush(1);
    expect(m.q('[data-note-count] [data-num-aggregate="count(characters in the note)"]').getAttribute('data-agg-value')).toBe('17');
    expect(m.q('[data-card-form] button[type="submit"]').disabled).toBe(false);
    act(() => setValue(m.q('[data-note]'), 'x'.repeat(281)));
    await m.flush(1);
    expect(m.q('[data-card-form] button[type="submit"]').disabled).toBe(true);
    await sweepAll(fx.tape2, 'typed');
    m.click(m.buttons('Cancel')[0]);
    await m.flush();
    expect(m.q('[data-card-form]')).toBeNull();
  });
});

describe('receipt — the filed card (spec §6; R7)', () => {
  it('filing: the receipt shows the facts, the note as a quotation bound to the ledger path credited "— you · time", the route and stage, RG-5\'s sentence, Retire; the counter refreshed', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Let it go sooner.', route: 'watch' });
    const receipt = m.q('[data-card-receipt]');
    expect(receipt).toBeTruthy();
    expect(receipt.closest('footer')).toBeTruthy();
    expect(m.q('[data-card-form]')).toBeNull();
    const q = receipt.querySelector('[data-quote-path]');
    expect(q.getAttribute('data-quote-path')).toBe('cards.op_1.note');   // bound by the card's OWN id, never a position (review L3-9a)
    expect(q.getAttribute('data-quote-doc')).toBe('ledger');
    expect(q.textContent).toBe('Let it go sooner.');
    expect(receipt.querySelector('[data-quote-attribution]').textContent).toMatch(/^— you · /);
    expect(receipt.textContent).toContain('Route · Watch · Stage · card');
    expect(receipt.textContent).toContain(RG5.watch);
    expect(m.buttons('Retire')).toHaveLength(1);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ note: 'Let it go sooner.', route: 'watch', stage: 'card', source: { battleId: B, etDate: D2 } });
    expect(region('since-last-time').textContent).toContain('My cards');
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(1);
    await sweepAll(fx.tape2, 'receipt');
  });
  it('Offer nominates, the owner\'s book open (the stage says so, the Offer sentence says what happens next); Set files a card with its words', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    expect(m.q('[data-card-receipt]').textContent).toContain('Route · Offer · Stage · offered to your agent');   // Amendment A CA-17
    expect(m.q('[data-card-receipt]').textContent).toContain(RG5.offer);
    expect(t.store.get(`mandates/${BOOK_ID}/nominations/op_1`)).toMatchObject({ state: 'queued' });
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(m.q('[data-card-receipt]').textContent).toContain('Route · Set · Stage · card');
    expect(m.q('[data-card-receipt]').textContent).toContain(RG5.set);
    expect(m.q('[data-card-receipt]').querySelector('a')).toBeNull();
    await sweepAll(fx.tape2, 'set receipt');
  });
  it('Retire moves the card to retired: the stage word, no Retire button, the card in the Retired list', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(m.q('[data-card-receipt]').textContent).toContain('Stage · retired');
    // RG-5 for a retired card: what happens next is nothing, said so — never the route's sentence (review L3-3)
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(m.q('[data-card-receipt]').textContent).not.toContain(RG5.watch);
    expect(m.buttons('Retire')).toHaveLength(0);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).stage).toBe('retired');
    expect(m.qa('[data-my-cards-group="retired"] [data-my-card]')).toHaveLength(1);
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(0);
    await sweepAll(fx.tape2, 'retired');
  });
  it('the cap: the sixth open card is refused with the cap sentence; the count reads "5 of 5"', async () => {
    await open();
    for (let i = 0; i < 5; i += 1) {
      m.click(m.buttons('Take this home')[0]);
      await m.flush();
      await fileCard({ note: `Card ${i}.`.replace(/\d/, 'x') });
    }
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.q('[data-open-count] [data-num-aggregate="count(plays[] open)"]').getAttribute('data-agg-value')).toBe('5');
    await fileCard({ note: 'One more.' });
    expect(m.q('[data-card-form]')).toBeTruthy();
    expect(m.q('[data-card-refusal]').textContent).toBe('The open-card cap is reached. A card stops counting once it is retired, parked, equipped or not taken.');   // Amendment A CA-23
    await sweepAll(fx.tape2, 'cap');
  });
});

describe('since-last-time — open Watch cards, their recurrences (RG-4), My cards (acceptance D)', () => {
  it('a Watch card filed from day 1 lists day 2\'s moment as a recurrence, linked to its battle day and moment; opening it switches the day and jumps to the moment', async () => {
    await open();
    // file from day 1
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush(8);
    expect(m.q('[data-moment-row]').getAttribute('data-moment-row')).toBe('stalled:ACN:4-5');
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    // the card is created AFTER day 1 and BEFORE day 2's moments: the handler stamps `new Date()`, so the clock itself
    // is set to that evening (review L4-8) — the stored document is never edited by hand
    await atClock(`${D1}T23:00:00.000Z`, () => fileCard({ note: 'Watch this.' }));
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).createdAt).toBe(`${D1}T23:00:00.000Z`);
    const slt = region('since-last-time');
    const watch = slt.querySelector('[data-watch-card="op_1"]');
    expect(watch).toBeTruthy();
    expect(watch.textContent).toContain('Our stocks are not moving');
    const rows = [...watch.querySelectorAll('[data-recurrence-row]')];
    const want = momentsOf(fx.tape2.tags.items).filter((mm) => mm.situationId === 'stalled');
    expect(rows.length).toBe(want.length);
    const row = rows[0];
    // this battle's recurrence is a control that opens its day and moment HERE — never a link to a route the App lacks (review L3-4)
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('href')).toBeNull();
    expect(row.getAttribute('data-recurrence-row')).toBe(`${B}:${D2}:stalled:${want[0].symbol}:${want[0].fromTickSeq}-${want[0].toTickSeq}`);
    expect(row.querySelector('[data-num-aggregate="count(tags.items[] in a moment)"]').getAttribute('data-num-class')).toBe('derived');
    expect(row.textContent).not.toMatch(/\$|%/);
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 24');
    const scrolled = [];
    const sv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scroll() { scrolled.push(this.id); };
    try {
      m.click(row);
      await m.flush(8);
    } finally { Element.prototype.scrollIntoView = sv; }
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 25');
    expect(scrolled).toContain(`moment-${want[0].symbol}-${want[0].fromTickSeq}-${want[0].toTickSeq}`);
    // B2.1 B2: the moment opened is the one marked in the prepared case, and holds the focus
    const opened = m.q('[data-moment-opened]');
    expect(opened.getAttribute('data-moment-row')).toBe(`stalled:${want[0].symbol}:${want[0].fromTickSeq}-${want[0].toTickSeq}`);
    expect(opened.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(opened);
    expect(m.qa('[aria-current="true"][data-moment-row]')).toHaveLength(1);
    expect(counterCalls()).toBe(2);   // once at open, once after the create — the day change re-asked nothing (review L4-3)
    await sweepAll(fx.tape2, 'since last time');
    // a day picked by hand clears the mark
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush(8);
    expect(m.q('[data-moment-opened]')).toBeNull();
  });
  it('no open Watch card: says so; an Offer card is not followed', async () => {
    openBook();
    await open();
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ route: 'offer', note: 'Practice it.' });
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    expect(m.qa('[data-watch-card]')).toEqual([]);
  });
  it('acceptance D on the screen: an archetype change shelves the card (the Shelved list, the open count 0), changing back restores it — no write in between; the explainer in plain words', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(1);
    const writes = t.writeLog.length;
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, name: 'Aurora', archetype: 'guardian' });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.qa('[data-my-cards-group="shelved"] [data-my-card]')).toHaveLength(1);
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(0);
    expect(region('since-last-time').textContent).toContain('A card made under another archetype is shelved');
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    // the shelved card's receipt: nothing happens while shelved — not the route's sentence (review L3-3), and no Retire
    m.click(m.q('[data-my-cards-group="shelved"] [data-my-card]'));
    await m.flush();
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe('Shelved: nothing happens while the agent is on another archetype.');
    expect(m.q('[data-card-receipt]').textContent).not.toContain(RG5.watch);
    expect(m.buttons('Retire')).toHaveLength(0);
    await sweepAll(fx.tape2, 'shelved receipt');
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(1);
    expect(t.writeLog.length).toBe(writes);
    // a card's row opens its receipt
    m.click(m.q('[data-my-card]'));
    await m.flush();
    expect(m.q('[data-card-receipt]')).toBeTruthy();
    await sweepAll(fx.tape2, 'my cards');
  });
});

describe('every sweep at every depth with the regions open — the B2 screen on the real days', () => {
  it.each(['Glance', 'Study', 'Deep dive'])('%s: a card filed, the form open on another moment, a check open', async (label) => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    await depth(label);
    const pip = m.q('[data-check-pip="3"]') || m.q('[data-check-row="3"]');
    if (pip) { m.click(pip); await m.flush(); }
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.q('[data-card-form]')).toBeTruthy();
    expect(m.q('[data-card-receipt]')).toBeNull();   // the form replaces the receipt
    await sweepAll(fx.tape2, label);
    const notes = m.container.textContent.split('This does not show which protections were armed or checked.').length - 1;
    expect(notes, label).toBe(label === 'Deep dive' && !m.q('[data-region="evidence-overlay"]') ? 0 : 1);
  });
});

describe('review round — the screen (findings L3-1 … L3-11, L4-2 … L4-10, R3-1)', () => {
  const activeOneDay = () => battleOf({ timing: { tradingDays: [D1] }, completedAt: null, status: 'active' });
  const openCheck4 = async (tape, battle) => {
    await open({ battle, tapes: { [tape.etDate]: tape } });
    const i = tape.checks.findIndex((c) => c.tickSeq === 4);
    await depth('Study');
    m.click(m.q(`[data-check-row="${i}"]`));
    await m.flush();
    return i;
  };
  it('L3-1 — a tape with NO situations section: the absence sentence, no coverage line, no "No moments matched", no tag line on a check', async () => {
    const tape = { ...fx.tape2, coverage: { ...fx.tape2.coverage } };
    delete tape.tags;
    delete tape.coverage.tags;
    await open({ tapes: { [D1]: fx.tape1, [D2]: tape } });
    const pc = region('prepared-case');
    expect(pc.getAttribute('data-tags-state')).toBe('absent');
    expect(pc.textContent).toContain("This day's tape has no situations section.");
    expect(pc.textContent).not.toContain('unavailable');
    expect(pc.textContent).not.toContain('No moments matched');
    expect(pc.querySelector('[data-coverage]')).toBeNull();
    expect(m.qa('[data-moment-row]')).toEqual([]);
    expect(m.buttons('Take this home')).toHaveLength(0);
    const i = tape.checks.findIndex((c) => c.tickSeq === 4);
    await depth('Study');
    m.click(m.q(`[data-check-row="${i}"]`));
    await m.flush();
    expect(m.q('[data-check-detail]')).toBeTruthy();
    expect(m.q('[data-check-tag]')).toBeNull();
    await sweepAll(tape, 'absent');
  });
  it('L1-3 — a day the tagger marked unavailable that still STORES items: no rows, and no tag line on its checks either (one answer across the regions)', async () => {
    const tape = { ...fx.tape1, coverage: { ...fx.tape1.coverage, tags: { ...fx.tape1.coverage.tags, status: 'unavailable', note: 'stalled unavailable: the checks section is partial' } } };
    expect(tape.tags.items.length).toBeGreaterThan(0);
    await openCheck4(tape, activeOneDay());
    expect(region('prepared-case').getAttribute('data-tags-state')).toBe('unavailable');
    expect(region('prepared-case').querySelector('[data-coverage="unavailable"]')).toBeTruthy();
    expect(m.qa('[data-moment-row]')).toEqual([]);
    expect(m.q('[data-check-detail]')).toBeTruthy();
    expect(m.q('[data-check-tag]')).toBeNull();
    expect(m.buttons('Take this home')).toHaveLength(0);
    await sweepAll(tape, 'unavailable with items');
  });
  it('L3-2 — the tag line\'s count and threshold are WHOLE counts: "3", never "+3"', async () => {
    await openCheck4(fx.tape1, activeOneDay());
    const texts = [...m.q('[data-check-tag="stalled:ACN"]').querySelectorAll('[data-num-text]')].map((n) => n.textContent);
    expect(texts).toEqual([String(fx.tape1.tags.items[0].count), String(fx.tape1.tags.items[0].effectiveTicksThreshold)]);
    for (const s of texts) expect(s).toMatch(/^\d+$/);
  });
  it('L4-6 — the recorded basis whose record DISAGREES with the item: the count renders from the item\'s path (D), the basis still named recorded, the source the item (the mutant: always R on a recorded day)', async () => {
    const i = fx.tape1.checks.findIndex((c) => c.tickSeq === 4);
    const checks = fx.tape1.checks.map((c, k) => (k === i ? { ...c, stagnation: { ...c.stagnation, ACN: { ...c.stagnation.ACN, ticks: c.stagnation.ACN.ticks + 5 } } } : c));
    const tape = { ...fx.tape1, checks };
    await openCheck4(tape, activeOneDay());
    const tag = m.q('[data-check-tag="stalled:ACN"]');
    expect(tag.getAttribute('data-count-basis')).toBe('recorded');
    expect(tag.getAttribute('data-count-source')).toBe('item');
    const nums = [...tag.querySelectorAll('[data-num]')];
    expect(nums[0].getAttribute('data-num')).toBe('tags.items[0].count');
    expect(nums[0].getAttribute('data-num-class')).toBe('derived');
    expect(nums[0].querySelector('[data-num-text]').textContent).toBe(String(fx.tape1.tags.items[0].count));
    await sweepAll(tape, 'disagreeing record');
  });
  it('L3-6a — the form before the counter has answered: words, no number; after the answer the count; a failed read: words, never "not recorded"', async () => {
    let release;
    const real = api.readCounter;
    api.readCounter = (agentId) => new Promise((resolve) => { release = () => real(agentId).then(resolve); });
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    const line = () => m.q('[data-open-count]');
    expect(line().getAttribute('data-open-count-state')).toBe('loading');
    expect(line().textContent).toBe('Open cards · still loading');
    expect(line().querySelector('[data-num-aggregate]')).toBeNull();
    expect(region('since-last-time').textContent).toContain('Loading the cards…');
    await sweepAll(fx.tape2, 'counter pending');
    release();
    await m.flush(4);
    expect(line().getAttribute('data-open-count-state')).toBe('ready');
    expect(line().querySelectorAll('[data-num-aggregate]')).toHaveLength(2);
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    api.readCounter = async () => ({ ok: false, status: 500, body: null });
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(line().getAttribute('data-open-count-state')).toBe('error');
    expect(line().textContent).toBe('Open cards · could not be read');
    expect(line().textContent).not.toContain('not recorded');
    expect(region('since-last-time').querySelector('[data-cards-read-error]').textContent).toBe('The cards could not be read.');
    expect(region('since-last-time').textContent).not.toContain('Loading the cards…');
    await sweepAll(fx.tape2, 'counter failed');
  });
  it('L3-6b / L4-2 — a day with NO tape: the counter is read all the same (the battle names the agent) and My cards shows', async () => {
    await open({ tapes: {} });
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    expect(counterCalls()).toBe(1);
    const slt = region('since-last-time');
    expect(slt.textContent).toContain('My cards');
    expect(slt.textContent).toContain('No cards yet.');
    expect(slt.textContent).not.toContain('Loading the cards…');
    expect(region('prepared-case')).toBeNull();
    await sweepAll(null, 'untaped day', { day: D2 });
  });
  it('L3-7 — on a day with no tape, a card\'s instant keeps its DATE (the shown day is not the card\'s)', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await atClock(`${D1}T23:00:00.000Z`, () => fileCard({ note: 'Watch this.' }));
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open({ tapes: { [D1]: fx.tape1 } });   // day 2, the opening day, has no tape
    expect(m.q('[data-state="missing"]')).toBeTruthy();
    const watch = region('since-last-time').querySelector('[data-watch-card="op_1"]');
    expect(watch.querySelector('[data-time]').textContent).toMatch(/^Sep 24, \d{1,2}:\d{2} [AP]M$/);
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
    expect(m.q('[data-card-receipt] [data-quote-attribution]').textContent).toMatch(/^— you · Sep 24, /);
    await sweepAll(null, 'untaped receipt', { day: D2 });
  });
  it('L3-10 — a stage this release does not know: listed under Other with the record\'s own word, never active; its receipt has no next sentence and no Retire', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const doc = t.store.get(`agents/${AGENT}/plays/op_1`);
    // Build C §3: `installed` is vocabulary v2's own word now; `drafted` was dropped before anything wrote it, so it is a stage this release does not know
    t.store.set(`agents/${AGENT}/plays/op_camp`, { ...doc, entryId: 'op_camp', opId: 'op_camp', stage: 'drafted', note: 'A camp card.' });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    const other = m.q('[data-my-cards-group="other"] [data-my-card="op_camp"]');
    expect(other).toBeTruthy();
    expect([...other.querySelectorAll('[data-record-text]')].map((r) => r.textContent)).toContain('drafted');
    m.click(other);
    await m.flush();
    const receipt = m.q('[data-card-receipt="op_camp"]');
    expect([...receipt.querySelectorAll('[data-record-text]')].map((r) => r.textContent)).toContain('drafted');
    expect(receipt.querySelector('[data-card-next]')).toBeNull();
    expect(m.buttons('Retire')).toHaveLength(0);
    await sweepAll(fx.tape2, 'other stage');
  });
  it('L4-4 — a re-read that fails keeps what was read: the list stays, the error said beside it', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    expect(m.qa('[data-my-card]')).toHaveLength(1);
    api.readCounter = async () => ({ ok: false, status: 500, body: null });
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    const slt = region('since-last-time');
    expect(slt.querySelector('[data-cards-read-error]')).toBeTruthy();
    expect(m.qa('[data-my-card]')).toHaveLength(1);
    expect(slt.textContent).not.toContain('Loading the cards…');
  });
  it('L4-9 — one op id per form: a refused filing re-tapped sends the SAME op id; a lost answer re-tapped replays (one card, not two)', async () => {
    await open();
    for (let i = 0; i < 5; i += 1) { m.click(m.buttons('Take this home')[0]); await m.flush(); await fileCard({ note: `Card ${i}.`.replace(/\d/, 'x') }); }
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'One more.' });
    expect(m.q('[data-card-refusal]').textContent).toContain('cap');
    const before = cardBodies().length;
    m.click(m.q('[data-card-form] button[type="submit"]'));   // the re-tap on the same form
    await m.flush(10);
    const bodies = cardBodies();
    expect(bodies.length).toBe(before + 1);
    expect(bodies[bodies.length - 1].opId).toBe(bodies[bodies.length - 2].opId);
    expect(m.q('[data-card-form]').getAttribute('data-card-op')).toBe(bodies[bodies.length - 1].opId);
    // a lost answer: the server files the card, the client never hears; the re-tap replays under the same op id
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    t = makeTapeDb({ ...fx.store, [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' } });
    state.db = t.db; api = apiOf();
    const real = api.postCard;
    let lose = true;
    api.postCard = async (body) => { const r = await real(body); if (lose) { lose = false; return { ok: false, status: 0, body: null }; } return r; };
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Filed once.' });
    expect(m.q('[data-card-refusal]').textContent).toBe('The card could not be filed.');
    const plays = () => [...t.store.keys()].filter((k) => k.includes('/plays/'));
    expect(plays()).toHaveLength(1);
    m.click(m.q('[data-card-form] button[type="submit"]'));
    await m.flush(10);
    expect(m.q('[data-card-receipt]')).toBeTruthy();
    expect(plays()).toHaveLength(1);
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]')).toHaveLength(1);
  });
  it('L4-10 — ledgerOf: the counter\'s row stands whole where it holds the card; the just-filed card is added only where it does not', () => {
    const fresh = { entryId: 'a', version: 2, stage: 'retired', shelved: false, note: 'n' };
    const stale = { entryId: 'a', version: 1, stage: 'card', note: 'n' };
    expect(ledgerOf({ cards: [fresh] }, stale)).toEqual([fresh]);
    expect(ledgerOf({ cards: [] }, stale)).toEqual([{ ...stale, shelved: false }]);
    expect(ledgerOf(null, stale)).toEqual([{ ...stale, shelved: false }]);
  });
  it('L3-11e / L3-11c — the note\'s label holds its words alone; Retire is disabled while a retire is pending', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.q('[data-note]').closest('label').textContent).toBe('Your note');
    await fileCard();
    let release;
    const real = api.postCard;
    api.postCard = (body) => new Promise((resolve) => { release = () => real(body).then(resolve); });
    m.click(m.buttons('Retire')[0]);
    await m.flush(2);
    const pending = m.buttons('Retiring…')[0];
    expect(pending).toBeTruthy();
    expect(pending.disabled).toBe(true);
    release();
    await m.flush(10);
    expect(m.q('[data-card-receipt]').textContent).toContain('Stage · retired');
  });
  it('R3-1 — a retired Offer card: nothing happens next, not the Offer sentence', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ route: 'offer', note: 'Practice the exit.', question: 'stalled.ready' });
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe(RG5.offer);
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(m.q('[data-card-receipt]').textContent).not.toContain(RG5.offer);
  });
});

// ── Astra's B2 review (docs/audits/20261022_ASTRA_REVIEW_FILM_ROOM_B2_CARD.md), as Amendment I rules it ──
describe('Amendment I RI-2 (Astra B1) — a successful write wins on screen when it is newer than the counter\'s row', () => {
  it('ASTRA_STALE_RETIRE — a Watch card retired, its refresh answering 503: the receipt reads retired, says nothing happens next, shows no Retire; My cards lists it as Retired; the read error is said beside it', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe(RG5.watch);
    api.readCounter = async () => ({ ok: false, status: 503, body: { error: 'unavailable' } });
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ stage: 'retired', version: 2 });
    const receipt = m.q('[data-card-receipt="op_1"]');
    expect(receipt.textContent).toContain('Stage · retired');
    expect(receipt.textContent).not.toContain('Stage · card');
    expect(receipt.querySelector('[data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(receipt.textContent).not.toContain(RG5.watch);
    expect(m.buttons('Retire')).toHaveLength(0);
    const slt = region('since-last-time');
    expect(slt.querySelector('[data-cards-read-error]')).toBeTruthy();
    expect(m.qa('[data-my-cards-group="retired"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    expect(m.q('[data-my-cards-group="active"]')).toBeNull();
    expect(slt.querySelector('[data-watch-card]')).toBeNull();
    // the screen now says what the ledger holds: every sweep against the ledger as read fresh
    await sweepAll(fx.tape2, 'stale retire');
  });
  it('a newer counter row still wins over an older result: the card retired elsewhere between its create and the refresh — the receipt shows the counter\'s retired row, not the create\'s', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    const read = api.readCounter;
    let elsewhere = false;
    api.readCounter = async (agentId) => {
      if (!elsewhere && t.store.has(`agents/${AGENT}/plays/op_1`)) {
        elsewhere = true;   // another tab retires the card before this screen's refresh reads the counter
        await retireCard(state.db, { uid: OWNER, agentId: AGENT, entryId: 'op_1', opId: 'other_tab', expectedVersion: 1, nowIso: '2026-09-26T00:01:00.000Z' });
      }
      return read(agentId);
    };
    await fileCard();
    expect(elsewhere).toBe(true);
    const receipt = m.q('[data-card-receipt="op_1"]');
    expect(receipt.textContent).toContain('Stage · retired');
    expect(receipt.querySelector('[data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(m.buttons('Retire')).toHaveLength(0);
    expect(m.qa('[data-my-cards-group="retired"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
  });
  it('ledgerOf by version: a newer result takes the counter\'s row\'s place; an equal or older one, or one without a version, leaves the row standing; the other rows and their order are untouched', () => {
    const row = (entryId, version, stage) => ({ entryId, version, stage, shelved: false, note: 'n' });
    const result = (entryId, version, stage) => ({ entryId, version, stage, note: 'n' });
    const others = [row('z', 4, 'card'), row('y', 1, 'nominated')];
    expect(ledgerOf({ cards: [others[0], row('a', 1, 'card'), others[1]] }, result('a', 2, 'retired'))).toEqual([others[0], { ...result('a', 2, 'retired'), shelved: false }, others[1]]);
    expect(ledgerOf({ cards: [row('a', 3, 'retired')] }, result('a', 2, 'card'))).toEqual([row('a', 3, 'retired')]);
    expect(ledgerOf({ cards: [row('a', 2, 'retired')] }, result('a', 2, 'card'))).toEqual([row('a', 2, 'retired')]);
    expect(ledgerOf({ cards: [row('a', 1, 'card')] }, { entryId: 'a', stage: 'retired', note: 'n' })).toEqual([row('a', 1, 'card')]);
    expect(ledgerOf({ cards: [{ entryId: 'a', stage: 'card', shelved: false }] }, result('a', 2, 'retired'))).toEqual([{ entryId: 'a', stage: 'card', shelved: false }]);
  });
});

describe('B2.1 B3 (Amendment H RH-6) — an unavailable day, on the screen: no recurrence from it, and the count of such days said in RJ-7\'s style', () => {
  /** A card filed straight into the ledger (the real store) from day 1's moment, before day 2 — a Watch card's list is what the line explains (Amendment K RK-10). */
  const seedCard = (route) => { seedBookDoc(); /* Amendment A CA-12: the Offer transaction re-reads the book document */ return createCard(state.db, {
    uid: OWNER, agentId: AGENT, opId: `seed_${route}`, nowIso: `${D1}T23:00:00.000Z`, book: { bookId: BOOK_ID, status: 'active' },
    payload: { archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: fx.tape1.tags.items[0].version, battleId: B, etDate: D1, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Watch this.', route },
  }); };
  const unreadable = (tape) => ({ ...tape, coverage: { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });

  it('Amendment K RK-10 — no open Watch card: no line, however many days could not be read — none filed, an Offer card, a retired Watch card (the mutant: the unavailable-day line with no open Watch card)', async () => {
    for (const [d, tape] of [[D1, fx.tape1], [D2, fx.tape2]]) t.store.set(`agentBattles/${B}/tape/${d}`, unreadable(tape));
    expect((await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW })).unavailableDays[AGENT]).toBe(2);
    await open();
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    expect(m.q('[data-unavailable-days]')).toBeNull();
    await seedCard('offer');
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-my-card="seed_offer"]')).toBeTruthy();
    expect(m.q('[data-unavailable-days]')).toBeNull();
    await seedCard('watch');
    await retireCard(state.db, { uid: OWNER, agentId: AGENT, entryId: 'seed_watch', opId: 'r_seed', expectedVersion: 1, nowIso: `${D2}T23:00:00.000Z` });
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-my-cards-group="retired"] [data-my-card="seed_watch"]')).toBeTruthy();
    expect(m.q('[data-unavailable-days]')).toBeNull();
  });

  it('RK-10 — one open Watch card: the line as built, beside its list', async () => {
    await seedCard('watch');
    for (const [d, tape] of [[D1, fx.tape1], [D2, fx.tape2]]) t.store.set(`agentBattles/${B}/tape/${d}`, unreadable(tape));
    await open();
    const since = region('since-last-time');
    expect(since.querySelector('[data-watch-card="seed_watch"]')).toBeTruthy();
    expect(since.querySelector('[data-unavailable-days]').textContent.replace(/\s+/g, ' ')).toBe('Recurrences · 2D days in this window could not be read');
  });

  it('day 2\'s situations unavailable: day 1\'s Watch card lists no recurrence from it; "Recurrences · 1 day in this window could not be read", the count derived', async () => {
    await open();
    await depth('Glance');
    // a Watch card on day 1, whose recurrences would be day 2's moments
    m.click(m.qa('[data-day-picker] button, [data-region="day-picker"] button')[0]); await m.flush();
    m.click(m.qa('[data-cards-region="prepared-case"] button').find((b) => b.textContent === 'Take this home')); await m.flush();
    await atClock(`${D1}T21:00:00.000Z`, () => fileCard({ route: 'watch' }));
    expect(m.q('[data-card-receipt]')).not.toBeNull();
    const k2 = `agentBattles/${B}/tape/${D2}`;
    const before = await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW });
    const watch = Object.keys(before.recurrences)[0];
    expect(before.recurrences[watch].length).toBeGreaterThan(0);   // day 2's moments recur, while day 2 is readable
    t.store.set(k2, { ...fx.tape2, coverage: { ...fx.tape2.coverage, tags: { ...fx.tape2.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    m.teardown(); m.setup();
    await open();
    const since = region('since-last-time');
    expect(since.querySelectorAll('[data-recurrence-row]')).toHaveLength(0);
    const line = since.querySelector('[data-unavailable-days]');
    expect(line.textContent.replace(/\s+/g, ' ')).toBe('Recurrences · 1D day in this window could not be read');
    expect(line.querySelector('[data-num-aggregate]').getAttribute('data-num-class')).toBe('derived');
    await sweepAll(fx.tape2, 'unavailable day', { windowDays: [fx.tape1, t.store.get(k2)] });
  });

  it('no unavailable day: no such line', async () => {
    await open();
    expect(m.q('[data-unavailable-days]')).toBeNull();
  });

  it('review SPR-C-4 — another agent\'s unavailable days are that agent\'s: the line counts the battle\'s own agent alone', async () => {
    await seedCard('watch');   // RK-10: the line shows only beside an open Watch card
    const other = 'agent-other';
    for (const d of [D1, D2]) {
      t.store.set(`agentBattles/b-other-agent/tape/${d}`, { ...fx.tape2, etDate: d, battleId: 'b-other-agent', agentId: other, coverage: { ...fx.tape2.coverage, tags: { ...fx.tape2.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    }
    const counter = await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW });
    expect(counter.unavailableDays[other]).toBe(2);
    expect(counter.unavailableDays[AGENT] ?? 0).toBe(0);
    await open();
    expect(m.q('[data-unavailable-days]')).toBeNull();
    // and beside one of its own, the line says its own one
    t.store.set(`agentBattles/${B}/tape/${D2}`, { ...fx.tape2, coverage: { ...fx.tape2.coverage, tags: { ...fx.tape2.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    m.teardown(); m.setup();
    await open();
    expect(region('since-last-time').querySelector('[data-unavailable-days]').textContent.replace(/\s+/g, ' ')).toBe('Recurrences · 1D day in this window could not be read');
  });

  it('Amendment K RK-1 — a casual clone\'s battle: the screen sends the battle\'s own agent; the card files under the parent; the counter answers for the parent, its unavailable day counted under the parent and the clone day\'s moment a recurrence (the mutant: the line read under the clone)', async () => {
    const CLONE = `casual-agent-${OWNER}`;
    t.store.set(`agents/${CLONE}`, { ownerId: OWNER, name: 'Aurora (casual)', archetype: 'momentum_chaser', rankedAgentId: AGENT });
    const unavailableTape = (tape) => ({ ...tape, agentId: CLONE, coverage: { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    const tape1 = { ...fx.tape1, agentId: CLONE };
    t.store.set(`agentBattles/${B}`, { ...fx.battle, agentId: CLONE });
    t.store.set(`agentBattles/${B}/tape/${D1}`, tape1);
    t.store.set(`agentBattles/${B}/tape/${D2}`, { ...fx.tape2, agentId: CLONE });
    // a third clone battle whose day could not be read: it attributes to the parent too
    t.store.set(`agentBattles/b-clone-unread/tape/${D2}`, { ...unavailableTape(fx.tape2), battleId: 'b-clone-unread' });
    await open({ battle: battleOf({ agentId: CLONE }), tapes: { [D1]: tape1, [D2]: { ...fx.tape2, agentId: CLONE } } });
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush(8);
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await atClock(`${D1}T23:00:00.000Z`, () => fileCard({ note: 'Watch this.' }));
    expect(cardBodies()[0].agentId).toBe(CLONE);
    expect(api.calls.filter((c) => c[0] === 'counter').every((c) => c[1] === CLONE)).toBe(true);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ agentId: AGENT, source: { battleId: B, etDate: D1 } });
    expect([...t.store.keys()].filter((k) => k.startsWith(`agents/${CLONE}/plays`))).toEqual([]);
    const slt = region('since-last-time');
    expect(slt.querySelector('[data-watch-card="op_1"] [data-recurrence-row]')).toBeTruthy();   // day 2 of the clone's battle recurs
    expect(slt.querySelector('[data-my-card="op_1"]')).toBeTruthy();
    expect(slt.querySelector('[data-unavailable-days]').textContent.replace(/\s+/g, ' ')).toBe('Recurrences · 1D day in this window could not be read');
  });

  it('review KRV1-1 — a casual clone\'s battle whose clone cannot be resolved: the form says so in its own words (and to try again); the counter\'s refusal is a read error beside My cards; nothing is filed', async () => {
    const CLONE = `casual-agent-${OWNER}`;
    t.store.set(`agents/${CLONE}`, { ownerId: OWNER, name: 'Aurora (casual)', archetype: 'momentum_chaser' });   // no rankedAgentId
    t.store.set(`agentBattles/${B}`, { ...fx.battle, agentId: CLONE });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await open({ battle: battleOf({ agentId: CLONE }) });
    expect(region('since-last-time').querySelector('[data-cards-read-error]')).toBeTruthy();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Watch this.' });
    expect(m.q('[data-card-refusal]').textContent).toBe('The agent this card belongs to could not be resolved. Nothing was changed. Try again.');
    expect([...t.store.keys()].filter((k) => k.includes('/plays/'))).toEqual([]);
  });

  it('review SPR-T-8 — two of its own: RJ-7\'s plural (the mutant: the line always singular)', async () => {
    await seedCard('watch');   // RK-10: beside an open Watch card
    for (const [d, tape] of [[D1, fx.tape1], [D2, fx.tape2]]) {
      t.store.set(`agentBattles/${B}/tape/${d}`, { ...tape, coverage: { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    }
    await open();
    expect(region('since-last-time').querySelector('[data-unavailable-days]').textContent.replace(/\s+/g, ' ')).toBe('Recurrences · 2D days in this window could not be read');
  });
});

describe('B2.1 B1 (RH-1; RJ-8) and Amendment K RK-2 / RK-3 — Set\'s words, and its link to the tempo dial on the filed card\'s receipt', () => {
  const RULE_OFF = 'You change the setting yourself; this card changes nothing. No setting changes this situation for this archetype.';
  // RK-2's sentence: the key stays in the copy table, unread since the founder's ruling FQ-1 (every battle links)
  const NO_TEMPO_WORDS = 'No tempo setting was recorded for this battle.';
  // Amendment L RL-5: wherever Set links, its sentence ends with when a change applies
  const NEXT = 'A change applies from your next battle.';
  const LINKED = `${RG5.set} ${NEXT}`;
  /**
   * The screen on `tape`'s day (stored for the handler too), the form opened on its first moment; `file` files a Set
   * card. `battle` is the battle on screen (the ranked agent's by default); `days` its other tape days.
   */
  async function setOn(tape, onOpenForge, { file = true, battle = battleOf(), days = { [D1]: fx.tape1, [D2]: fx.tape2 } } = {}) {
    t.store.set(`agentBattles/${B}/tape/${tape.etDate}`, tape);
    lastBattle = battle;
    m.render(<FilmRoomScreenV2 battle={lastBattle} onBack={() => {}} viewerId="viewer-1" readers={readersOf({ ...days, [tape.etDate]: tape }, [])} nowMs={NOW} cardsApi={api} onOpenForge={onOpenForge} />);
    await m.flush(8);
    if (tape.etDate === D1) { m.click(m.qa('[data-region="day-picker"] button')[0]); await m.flush(8); }
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    if (file) await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
  }
  const formSet = () => m.q('[data-route-note="set"]').textContent;
  const receiptNext = () => m.q('[data-card-receipt] [data-card-next]').textContent;
  const CLONE = `casual-agent-${OWNER}`;
  /**
   * Set on a casual clone's battle (RK-1's fixture): the clone's document names the ranked agent as its parent; the
   * battle document and its tape days name the clone. The card files under the parent (RK-1). Set judges neither the
   * agent nor a recorded tempo (the founder's ruling FQ-1), so this fixture says the same as the ranked one for the same day.
   */
  async function setOnClone(tape, onOpenForge, opts = {}) {
    t.store.set(`agents/${CLONE}`, { ownerId: OWNER, name: 'Aurora (casual)', archetype: 'momentum_chaser', rankedAgentId: AGENT });
    t.store.set(`agentBattles/${B}`, { ...fx.battle, agentId: CLONE });
    await setOn({ ...tape, agentId: CLONE }, onOpenForge, { ...opts, battle: battleOf({ agentId: CLONE }), days: { [D1]: { ...fx.tape1, agentId: CLONE }, [D2]: { ...fx.tape2, agentId: CLONE } } });
  }

  it('review SPR-T-9 — the rule as stored, exactly: true is on, false is off, anything else (a 1, a string) unknown', () => {
    const ruleOf = (enabled) => setRuleOf({ tags: { inputs: { forcedRotation: { enabled } } } });
    expect([ruleOf(true), ruleOf(false), ruleOf(1), ruleOf('true'), ruleOf(0), setRuleOf(null)]).toEqual(['on', 'off', 'unknown', 'unknown', 'unknown', 'unknown']);
  });

  it('FQ-1 (every battle links) — setStateOf: the link when the rule is on and both Forge flags are on, a tempo recorded or not, whichever agent ran the battle; each condition alone turns it off', () => {
    const day = (enabled, tempoDesired) => ({ tags: { inputs: { forcedRotation: enabled === undefined ? undefined : { enabled }, tempoDesired } } });
    const LINK = { say: null, link: true };
    const NONE = { say: null, link: false };
    // no tempo condition and no agent condition: a second argument, the ranked agent's or a clone's, moves nothing
    for (const tempo of ['standard', null, undefined, '']) {
      expect(setStateOf(day(true, tempo)), String(tempo)).toEqual(LINK);
      for (const agent of [AGENT, CLONE]) expect(setStateOf(day(true, tempo), agent), `${agent} ${tempo}`).toEqual(LINK);
    }
    // the rule off or unknown: no link, RJ-8's sentence said first (review KRT-2), tempo or not
    for (const tempo of ['standard', null]) {
      expect(setStateOf(day(false, tempo)), `off ${tempo}`).toEqual({ say: 'ruleOff', link: false });
      expect(setStateOf(day(undefined, tempo)), `unknown ${tempo}`).toEqual(NONE);
    }
    // either Forge flag off alone: no link, tempo or not
    for (const flag of ['characterTab', 'tempoDial']) {
      state.characterTab = flag !== 'characterTab'; state.tempoDial = flag !== 'tempoDial';
      for (const tempo of ['standard', null]) expect(setStateOf(day(true, tempo)), `${flag} ${tempo}`).toEqual(NONE);
    }
  });

  it('all of RK-2\'s conditions hold: the FORM says RG-5\'s sentence with no link (RK-3); the filed card\'s RECEIPT holds "Tempo dial · Forge workshop", which opens the Forge on its Character area — the hub\'s own door, nothing filed (the mutant: the link inside the form)', async () => {
    const asked = [];
    await setOn(fx.tape2Tempo, (request) => asked.push(request), { file: false });
    expect(fx.tape2Tempo.tags.inputs.forcedRotation.enabled).toBe(true);
    expect(formSet()).toBe(RG5.set);
    expect(m.q('[data-card-form] [data-set-link]')).toBeNull();
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(receiptNext()).toBe(LINKED);
    const link = m.q('[data-card-receipt] [data-set-link] button');
    expect(link.textContent).toBe('Tempo dial · Forge workshop');
    const filed = cardBodies().length;
    m.click(link);
    expect(asked).toEqual([{ area: 'traits' }]);
    expect(forgeAreaOf(asked[0])).toBe(FORGE_AREAS.CHARACTER);   // the Film Room holds the area as a value (the hub's mount guard): this pins it to the hub's own
    expect(cardBodies()).toHaveLength(filed);   // the link files nothing
    await sweepAll(fx.tape2Tempo, 'set link');
  });

  it('FQ-1 — the ranked agent\'s battle with no tempo recorded (the fixture\'s own day: the dial never set): the form says RG-5\'s sentence alone, no link; the receipt links (the mutant: the link withheld with no tempo recorded)', async () => {
    const asked = [];
    await setOn(fx.tape2, (request) => asked.push(request), { file: false });
    expect(fx.tape2.tags.inputs.forcedRotation.enabled).toBe(true);
    expect(fx.tape2.tags.inputs.tempoDesired).toBeNull();
    expect(lastBattle.agentId).toBe(AGENT);
    expect(formSet()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(receiptNext()).toBe(LINKED);
    m.click(m.q('[data-card-receipt] [data-set-link] button'));
    expect(asked).toEqual([{ area: 'traits' }]);
    expect(text()).not.toContain(NO_TEMPO_WORDS);
    await sweepAll(fx.tape2, 'ranked, no tempo');
  });

  it('FQ-1 — a casual clone\'s battle with no tempo recorded links like the ranked one, and the card files under the RANKED parent (the mutant: the link withheld from a clone, RL-1\'s condition left in)', async () => {
    await setOnClone(fx.tape2, () => {}, { file: false });
    expect(formSet()).toBe(RG5.set);
    // review KRT-3: Set's words are Set's alone — Watch keeps RG-5's sentence; with no book there is no Offer route (Build C §5)
    expect(m.q('[data-route-note="watch"]').textContent).toBe(RG5.watch);
    expect(m.q('[data-route-note="offer"]')).toBeNull();
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    // the parent the card is filed under is the ranked agent (RK-1)
    expect(cardBodies()[0].agentId).toBe(CLONE);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ agentId: AGENT, route: 'set' });
    expect(m.q('[data-card-receipt]').getAttribute('data-card-receipt')).toBe('op_1');
    expect(receiptNext()).toBe(LINKED);
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
    expect(text()).not.toContain(NO_TEMPO_WORDS);
    await sweepAll({ ...fx.tape2, agentId: CLONE }, 'clone, no tempo');
  });

  it('FQ-1 — a casual clone\'s battle whose tape records a tempo: the form says RG-5\'s sentence alone; the receipt links', async () => {
    await setOnClone(fx.tape2Tempo, () => {}, { file: false });
    expect(formSet()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ agentId: AGENT, route: 'set' });
    expect(receiptNext()).toBe(LINKED);
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
  });

  it('Amendment L RL-5 — wherever Set links, its sentence ends "A change applies from your next battle.": a completed battle\'s receipt, and the receipt on a day of a multi-day battle still running; the form, which never links, never says it (the mutants: the sentence missing where Set links, or added where it does not)', async () => {
    // a completed battle (both days written; the ranked agent; a recorded tempo)
    await setOn(fx.tape2Tempo, () => {});
    expect(lastBattle.status).toBe('completed');
    expect(receiptNext()).toBe(LINKED);
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
    // a multi-day battle still running: its first day, written while it was live — the change still applies from the
    // NEXT battle, never this one (a battle snapshots its setting when it is created)
    m.teardown(); m.setup();
    const running = battleOf({ status: 'active', completedAt: null });
    t.store.set(`agentBattles/${B}`, { ...fx.battle, status: 'active', completedAt: null });
    await setOn(fx.tape1, () => {}, { file: false, battle: running });
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 24');
    expect(formSet()).toBe(RG5.set);
    expect(m.q('[data-card-form]').textContent).not.toContain(NEXT);
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(receiptNext()).toBe(LINKED);
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
    expect(text().split(NEXT)).toHaveLength(2);   // said once, on the receipt
    await sweepAll(fx.tape1, 'running, linked');
  });

  it('FQ-1 — on the ranked battle with no tempo recorded, each other condition still turns the receipt\'s link off: the rule off (RJ-8\'s sentence), the rule unknown, either Forge flag off (RG-5\'s sentence alone)', async () => {
    const off = structuredClone(fx.tape2);
    off.tags.inputs.forcedRotation.enabled = false;
    await setOn(off, () => {});
    expect(receiptNext()).toBe(RULE_OFF);
    expect(m.q('[data-set-link]')).toBeNull();
    m.teardown(); m.setup();
    const unknown = structuredClone(fx.tape2);
    delete unknown.tags.inputs.forcedRotation;
    await setOn(unknown, () => {});
    expect(receiptNext()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
    for (const flag of ['characterTab', 'tempoDial']) {
      m.teardown(); m.setup();
      state.characterTab = flag !== 'characterTab'; state.tempoDial = flag !== 'tempoDial';
      await setOn(fx.tape2, () => {});
      expect(receiptNext(), flag).toBe(RG5.set);
      expect(m.q('[data-set-link]'), flag).toBeNull();
    }
  });

  it('each condition on its own turns the receipt\'s link off: the rule off (RJ-8\'s sentence), either Forge flag off (RG-5\'s sentence alone) (the mutants: Set linking with the rule off, or with either Forge flag off)', async () => {
    const off = structuredClone(fx.tape2Tempo);
    off.tags.inputs.forcedRotation.enabled = false;
    await setOn(off, () => {});
    expect(receiptNext()).toBe(RULE_OFF);
    expect(m.q('[data-set-link]')).toBeNull();
    for (const flag of ['characterTab', 'tempoDial']) {
      m.teardown(); m.setup();
      state.characterTab = flag !== 'characterTab'; state.tempoDial = flag !== 'tempoDial';
      await setOn(fx.tape2Tempo, () => {});
      expect(receiptNext(), flag).toBe(RG5.set);
      expect(m.q('[data-set-link]'), flag).toBeNull();
    }
    // the control: both back on, the same day's Set card links
    m.teardown(); m.setup();
    state.characterTab = true; state.tempoDial = true;
    await setOn(fx.tape2Tempo, () => {});
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
  });

  it('review KRT-2 — the rule off on a day with no tempo recorded (every casual clone\'s day; an archetype like guardian): RJ-8\'s sentence on the form and the receipt, never the no-tempo one', async () => {
    const off = structuredClone(fx.tape2);
    off.tags.inputs.forcedRotation.enabled = false;
    expect(off.tags.inputs.tempoDesired).toBeNull();
    await setOn(off, () => {}, { file: false });
    expect(formSet()).toBe(RULE_OFF);
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(receiptNext()).toBe(RULE_OFF);
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('review KRT-9 — a receipt where RK-2 allows the link but the screen holds no Forge door shows no link', async () => {
    await setOn(fx.tape2Tempo, null);
    expect(receiptNext()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('the rule off on the form: RJ-8\'s no-link sentence, no link', async () => {
    const off = structuredClone(fx.tape2Tempo);
    off.tags.inputs.forcedRotation.enabled = false;
    await setOn(off, () => {}, { file: false });
    expect(formSet()).toBe(RULE_OFF);
    expect(m.q('[data-set-link]')).toBeNull();
    await sweepAll(off, 'rule off');
  });

  it('a tape that stores no such input: RG-5\'s sentence alone, on the form and the receipt — neither the link nor any further words', async () => {
    const unknown = structuredClone(fx.tape2Tempo);
    delete unknown.tags.inputs.forcedRotation;
    await setOn(unknown, () => {}, { file: false });
    expect(formSet()).toBe(RG5.set);
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(receiptNext()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('a Set card\'s receipt shown from another day (My cards) cannot judge its source day: RG-5\'s sentence alone, no link; back on its own day, the link', async () => {
    await setOn(fx.tape2Tempo, () => {});
    expect(m.q('[data-card-receipt] [data-set-link]')).toBeTruthy();
    m.click(m.qa('[data-region="day-picker"] button')[0]);   // day 1: the receipt closes with the day
    await m.flush(8);
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush(4);
    expect(receiptNext()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
    // review KR2-4: back on its own day, the same card's receipt links again
    m.click(m.qa('[data-region="day-picker"] button')[1]);
    await m.flush(8);
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush(4);
    expect(receiptNext()).toBe(LINKED);
    expect(m.q('[data-card-receipt] [data-set-link] button')).toBeTruthy();
  });

  /** The screen for `battle` over `tapes`, with the Forge door — no form opened. */
  async function screenOf(battle, tapes) {
    lastBattle = battle;
    m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readersOf(tapes, [])} nowMs={NOW} cardsApi={api} onOpenForge={() => {}} />);
    await m.flush(8);
  }

  it('review KR2-3 — a Set card\'s receipt beside the SAME date of ANOTHER battle cannot judge its source day: RG-5\'s sentence alone, no link (the mutant: the source day matched by its date alone)', async () => {
    await setOn(fx.tape2Tempo, () => {});
    expect(m.q('[data-card-receipt] [data-set-link]')).toBeTruthy();
    m.teardown(); m.setup();
    const C = 'b-same-date';
    await screenOf(battleOf({ id: C, agentBattleId: C }), { [D1]: { ...fx.tape1, battleId: C }, [D2]: { ...fx.tape2Tempo, battleId: C } });
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 25');
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush(4);
    expect(receiptNext()).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('review KR2-3 — a SHELVED Set card\'s receipt on its own day says it is shelved, and holds no link (the mutant: the link gated on the stage alone)', async () => {
    await setOn(fx.tape2Tempo, () => {});
    expect(m.q('[data-card-receipt] [data-set-link]')).toBeTruthy();
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, name: 'Aurora', archetype: 'guardian' });
    m.teardown(); m.setup();
    await screenOf(battleOf(), { [D1]: fx.tape1, [D2]: fx.tape2Tempo });
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush(4);
    expect(receiptNext()).toBe('Shelved: nothing happens while the agent is on another archetype.');
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('a retired Set card\'s receipt says nothing happens next, and holds no link', async () => {
    await setOn(fx.tape2Tempo, () => {});
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(receiptNext()).toBe('Retired: nothing happens next.');
    expect(m.q('[data-set-link]')).toBeNull();
  });

  it('the real archetype with its rule off (guardian) stores enabled: false — the input the screen reads', async () => {
    const g = await stalledDay({ battleId: 'b-guardian', archetype: 'guardian', recordStagnation: false, etDate: D1 });
    const tg = makeTapeDb(seedDay({}, g));
    await writeTapeDay('b-guardian', D1, { db: tg.db, now: NIGHT(D1) });
    expect(tg.store.get(`agentBattles/b-guardian/tape/${D1}`).tags.inputs.forcedRotation.enabled).toBe(false);
  });
});

describe('B2.1 B2 (Amendment H RH-2) — a recurrence in another battle opens that battle\'s Film Room day at its moment', () => {
  const ELSE = 'b-elsewhere';
  const D3 = '2026-09-28';   // the next session (Sep 26 is a Saturday)
  // the same agent's other battle: days D2 and D3, completed — so it opens on D3 by default, and D2 only when asked
  const elseBattle = () => battleOf({ id: ELSE, agentBattleId: ELSE, timing: { tradingDays: [D2, D3] }, completedAt: `${D3}T20:05:00.000Z` });
  const elseTape = () => ({ ...fx.tape2, battleId: ELSE });
  let events;
  const onEvent = (e) => events.push(e.detail);
  beforeEach(() => { events = []; window.addEventListener(OPEN_BATTLE_REVIEW_EVENT, onEvent); });
  afterEach(() => { window.removeEventListener(OPEN_BATTLE_REVIEW_EVENT, onEvent); });

  /** A Watch card filed from day 1 of this battle, with the other battle's day 2 in the counter's window. */
  async function watchCardWithElsewhere(opts = {}) {
    t.store.set(`agentBattles/${ELSE}/tape/${D2}`, elseTape());
    await open(opts);
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush(8);
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await atClock(`${D1}T23:00:00.000Z`, () => fileCard({ note: 'Watch this.' }));
    const watch = region('since-last-time').querySelector('[data-watch-card="op_1"]');
    const rows = [...watch.querySelectorAll('[data-recurrence-row]')];
    const own = rows.filter((r) => r.getAttribute('data-recurrence-row').startsWith(`${B}:`));
    const elsewhere = rows.filter((r) => r.getAttribute('data-recurrence-row').startsWith(`${ELSE}:`));
    expect(own.length).toBeGreaterThan(0);
    expect(elsewhere.length).toBe(own.length);
    return { watch, own, elsewhere };
  }
  const want = () => momentsOf(fx.tape2.tags.items).filter((mm) => mm.situationId === 'stalled')[0];
  const wantAt = () => { const w = want(); return { etDate: D2, moment: { situationId: 'stalled', symbol: w.symbol, fromTickSeq: w.fromTickSeq, toTickSeq: w.toTickSeq } }; };

  it('the row is a control: one read of that battle\'s document, then P1c\'s event with the battle, its day and its moment — this screen reads nothing of it', async () => {
    const reads = [];
    const other = elseBattle();
    const { watch, own, elsewhere } = await watchCardWithElsewhere({ readBattle: async (id) => { reads.push(id); return { status: 'ready', battle: other }; } });
    for (const r of elsewhere) {
      expect(r.tagName).toBe('BUTTON');
      expect(r.hasAttribute('data-recurrence-elsewhere')).toBe(true);
      expect(r.getAttribute('href')).toBeNull();
      expect(r.textContent).toContain('in another battle');
    }
    for (const r of own) expect(r.tagName).toBe('BUTTON');
    expect(watch.querySelector('a')).toBeNull();
    await sweepAll(fx.tape1, 'elsewhere');
    const before = lastReaders.calls.length;
    m.click(elsewhere[0]);
    await m.flush(8);
    expect(reads).toEqual([ELSE]);
    expect(events).toHaveLength(1);
    expect(events[0].battle).toBe(other);
    expect(events[0].at).toEqual(wantAt());
    expect(m.q('[data-recurrence-unreadable]')).toBeNull();
    // the screen on show stays as it was until App opens the other battle: its day, and no tape or series of the other battle read here
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 24');
    expect(lastReaders.calls.slice(before).filter((c) => c[1] === ELSE)).toEqual([]);
  });

  it('the screen App opens for it (the battle, and the event\'s day and moment): that day, the moment selected — marked, focused, scrolled to', async () => {
    await watchCardWithElsewhere({ readBattle: async () => ({ status: 'ready', battle: elseBattle() }) });
    m.click(m.q(`[data-recurrence-row^="${ELSE}:"]`));
    await m.flush(8);
    expect(events).toHaveLength(1);
    const detail = events[0];
    // what App's listener does: the battle, and the day and moment for it (src/App.jsx onOpenBattleReview)
    m.teardown(); m.setup();
    const scrolled = [];
    const sv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scroll() { scrolled.push(this.id); };
    try {
      await open({ battle: detail.battle, tapes: { [D2]: elseTape() }, openAt: { ...detail.at, battleId: detail.battle.id } });
      await m.flush(8);
    } finally { Element.prototype.scrollIntoView = sv; }
    const w = want();
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 25');
    const row = m.q('[data-moment-opened]');
    expect(row).toBeTruthy();
    expect(row.getAttribute('data-moment-row')).toBe(`stalled:${w.symbol}:${w.fromTickSeq}-${w.toTickSeq}`);
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(document.activeElement).toBe(row);
    expect(scrolled).toContain(`moment-${w.symbol}-${w.fromTickSeq}-${w.toTickSeq}`);
    expect(lastReaders.calls.filter((c) => c[0] === 'tape').map((c) => [c[1], c[2]])).toEqual([[ELSE, D2]]);   // the default day was never read
    await sweepAll(elseTape(), 'opened at the moment');
  });

  it('Amendment K RK-4 — a cross-battle open applies once: opened at its day and moment, moved to another day, then remounted (the Forge replaced the screen, then closed) → the default view, no moment marked (the mutant: `at` applied on a second mount)', async () => {
    let used = 0;
    /** What App holds (src/App.jsx): the open, cleared once the Film Room says it has used it; the Forge renders in the screen's place. */
    function AppHolder({ show }) {
      const [openAt, setOpenAt] = React.useState(() => ({ ...wantAt(), battleId: ELSE }));
      return show
        ? <FilmRoomScreenV2 battle={lastBattle} onBack={() => {}} viewerId="viewer-1" readers={lastReaders} nowMs={NOW} cardsApi={api} openAt={openAt} onOpenAtUsed={() => { used += 1; setOpenAt(null); }} />
        : <div data-forge-stand-in="" />;
    }
    lastBattle = elseBattle();
    lastReaders = readersOf({ [D2]: elseTape(), [D3]: { ...elseTape(), etDate: D3 } }, []);
    const pressed = () => m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent;
    m.render(<AppHolder show />);
    await m.flush(8);
    expect(pressed()).toContain('Sep 25');
    expect(m.q('[data-moment-opened]')).toBeTruthy();
    expect(used).toBe(1);
    // the player moves on: day 3, and Study (review KR2-4: a view the default is not, so the remount's view is told apart)
    m.click(m.qa('[data-region="day-picker"] button')[1]);
    await m.flush(8);
    expect(pressed()).toContain('Sep 28');
    await depth('Study');
    expect(m.q('[role="tab"][aria-selected="true"]').textContent).toBe('Study');
    // the Forge's round trip remounts the Film Room: its default view (the completed battle's last day, Glance), nothing marked
    m.render(<AppHolder show={false} />);
    await m.flush(2);
    expect(m.q('[data-screen="film-room-v2"]')).toBeNull();
    m.render(<AppHolder show />);
    await m.flush(8);
    expect(pressed()).toContain('Sep 28');
    expect(m.q('[data-moment-opened]')).toBeNull();
    expect(m.q('[role="tab"][aria-selected="true"]').textContent).toBe('Glance');
    expect(used).toBe(1);
  });

  it('the cards\' gate answering after the tape (\'allowlist\', the flip\'s first step): the jump waits for the moment\'s row, then marks and focuses it', async () => {
    state.cards = 'allowlist';
    let admit = null;
    api.readVerdict = () => new Promise((r) => { admit = () => r(true); });
    await open({ battle: elseBattle(), tapes: { [D2]: elseTape() }, openAt: { ...wantAt(), battleId: ELSE } });
    // the tape is on screen, the cards are not yet: the empty reserved regions, no moment row, nothing focused
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 25');
    expect(m.qa('[data-reserved-slot]')).toHaveLength(4);
    expect(m.q('[data-moment-row]')).toBeNull();
    expect(typeof admit).toBe('function');
    admit();
    await m.flush(8);
    const w = want();
    const row = m.q('[data-moment-opened]');
    expect(row).toBeTruthy();
    expect(row.getAttribute('data-moment-row')).toBe(`stalled:${w.symbol}:${w.fromTickSeq}-${w.toTickSeq}`);
    expect(document.activeElement).toBe(row);
  });

  it('P1c\'s own event (no day, no moment) opens that battle as before, on its default day, nothing marked; a day and moment for another battle are ignored', async () => {
    await open({ battle: elseBattle(), tapes: { [D2]: elseTape() } });
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 28');
    expect(m.q('[data-moment-opened]')).toBeNull();
    m.teardown(); m.setup();
    await open({ battle: elseBattle(), tapes: { [D2]: elseTape() }, openAt: { ...wantAt(), battleId: B } });
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 28');
    expect(m.q('[data-moment-opened]')).toBeNull();
    m.teardown(); m.setup();
    // a malformed one (no moment) is ignored the same way
    await open({ battle: elseBattle(), tapes: { [D2]: elseTape() }, openAt: { etDate: D2, battleId: ELSE } });
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 28');
  });

  it('a battle that cannot be read: the row says so beside itself, and nothing opens — missing, failed, thrown, another battle\'s id, no reader', async () => {
    const answers = [
      async () => ({ status: 'missing', battle: null }),
      async () => ({ status: 'error', battle: null }),
      async () => { throw new Error('unavailable'); },
      async () => ({ status: 'ready', battle: { ...elseBattle(), id: 'b-someone-else', agentBattleId: 'b-someone-else' } }),
      null,
    ];
    for (const readBattle of answers) {
      m.teardown(); m.setup();
      t = makeTapeDb({ ...fx.store, [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' } });
      state.db = t.db;
      api = apiOf();
      events = [];
      const { elsewhere } = await watchCardWithElsewhere({ readBattle });
      m.click(elsewhere[0]);
      await m.flush(8);
      const said = m.qa('[data-recurrence-unreadable]');
      expect(said).toHaveLength(1);
      expect(said[0].textContent).toBe('That battle could not be read, so it was not opened.');
      expect(said[0].previousElementSibling).toBe(elsewhere[0]);
      expect(elsewhere[0].disabled).toBe(false);   // a later tap may try again
      expect(events).toEqual([]);
      expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 24');
    }
    await sweepAll(fx.tape1, 'unreadable');
  });

  it('review SPR-L-2 — a read that answers after the player left the Film Room opens nothing', async () => {
    let release;
    const { elsewhere } = await watchCardWithElsewhere({ readBattle: () => new Promise((r) => { release = () => r({ status: 'ready', battle: elseBattle() }); }) });
    m.click(elsewhere[0]);
    await m.flush(2);
    m.teardown(); m.setup();   // back: the screen unmounts while the read is out
    release();
    await m.flush(4);
    expect(events).toEqual([]);
  });

  it('review SPR-L-3 — the deferred jump never takes the focus from where the player has since put it: a depth tab focused while the cards\' gate is out keeps it; the moment is still marked', async () => {
    state.cards = 'allowlist';
    let admit = null;
    api.readVerdict = () => new Promise((r) => { admit = () => r(true); });
    await open({ battle: elseBattle(), tapes: { [D2]: elseTape() }, openAt: { ...wantAt(), battleId: ELSE } });
    const study = m.tab('Study');
    m.click(study);
    await m.flush();
    m.tab('Study').focus();
    expect(document.activeElement).toBe(m.tab('Study'));
    const scrolled = [];
    const sv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scroll() { scrolled.push(this.id); };
    try {
      admit();
      await m.flush(8);
    } finally { Element.prototype.scrollIntoView = sv; }
    expect(document.activeElement).toBe(m.tab('Study'));
    expect(scrolled).toEqual([]);
    expect(m.q('[data-moment-opened]')).toBeTruthy();
  });

  it('while the battle is read the row takes no second tap', async () => {
    let release;
    const reads = [];
    const { elsewhere } = await watchCardWithElsewhere({ readBattle: (id) => { reads.push(id); return new Promise((r) => { release = () => r({ status: 'ready', battle: elseBattle() }); }); } });
    m.click(elsewhere[0]);
    await m.flush(2);
    expect(elsewhere[0].disabled).toBe(true);
    m.click(elsewhere[0]);
    await m.flush(2);
    expect(reads).toEqual([ELSE]);
    release();
    await m.flush(8);
    expect(events).toHaveLength(1);
  });
});

// ── Film Room C1 (Build C spec V1, docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md) ──────────────────────────
describe('C1 item 1 — My cards under the stage vocabulary v2 (spec §3)', () => {
  it('testing and an unparked tested card are active and count open; a parked tested card lists under Parked; installed under Equipped, its stage word "equipped"; a v1 entry (no stageVocabVersion) reads and counts as before', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const doc = t.store.get(`agents/${AGENT}/plays/op_1`);
    expect(doc.stageVocabVersion).toBe(2);
    const plant = (id, minute, over) => t.store.set(`agents/${AGENT}/plays/${id}`, { ...doc, entryId: id, opId: id, note: `The card ${id}.`, createdAt: `2026-09-25T2${minute}:00:00.000Z`, ...over });
    plant('c_testing', 1, { stage: 'testing' });
    plant('c_tested', 2, { stage: 'tested' });
    plant('c_parked', 3, { stage: 'tested', parkedAt: '2026-09-25T23:30:00.000Z' });
    plant('c_installed', 0, { stage: 'installed' });
    const v1 = { ...doc, entryId: 'c_v1', opId: 'c_v1', note: 'A v1 card.', createdAt: '2026-09-25T19:00:00.000Z' };
    delete v1.stageVocabVersion;
    t.store.set(`agents/${AGENT}/plays/c_v1`, v1);
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    const group = (g) => m.qa(`[data-my-cards-group="${g}"] [data-my-card]`).map((b) => b.getAttribute('data-my-card'));
    expect(group('active').sort()).toEqual(['c_tested', 'c_testing', 'c_v1', 'op_1']);
    expect(group('parked')).toEqual(['c_parked']);
    expect(group('equipped')).toEqual(['c_installed']);
    expect(m.q('[data-my-cards-group="equipped"]').textContent).toContain('Equipped');
    expect(m.q('[data-my-card="c_installed"]').textContent).toContain('equipped');
    expect(m.q('[data-my-card="c_testing"]').textContent).toContain('testing');
    expect(m.q('[data-my-cards-group="other"]')).toBeNull();
    // the form's open count: four open (card, testing, tested unparked, the v1 card) — the oracle recounts it by the one export
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(Number(m.q('[data-open-count] [data-num-aggregate="count(plays[] open)"]').getAttribute('data-agg-value'))).toBe(4);
    await sweepAll(fx.tape2, 'v2 groups');
  });
});

describe('C1 item 5 — the form: Watch, Offer and Set; Offer only with the owner\'s book open (spec §5; BC-3)', () => {
  it('the book open (the counter says so): the routes Watch, Offer, Set in that order, Offer with the spec\'s sentence; the counter answered `book: { open: true }` and nothing else of the book', async () => {
    openBook();
    await open();
    expect((await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW })).book).toEqual({ open: true });
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.qa('[data-route]').map((l) => l.getAttribute('data-route'))).toEqual(['watch', 'offer', 'set']);
    expect(m.q('[data-route="offer"]').textContent).toBe(`Offer${RG5.offer}`);
    expect(m.q('[data-route-note="offer"]').textContent).toBe(RG5.offer);
    await sweepAll(fx.tape2, 'offer form');
  });

  it('no book, and a book not active: no Offer route and no word of the book (the mutant: the Offer route shown with no book)', async () => {
    for (const status of [null, 'closed']) {
      if (status) openBook(status); else resetPracticeFieldSeam();
      await open();
      m.click(m.buttons('Take this home')[0]);
      await m.flush();
      expect(m.qa('[data-route]').map((l) => l.getAttribute('data-route')), String(status)).toEqual(['watch', 'set']);
      expect(m.q('[data-card-form]').textContent).not.toMatch(/Offer|book|Practice/);
      m.teardown(); m.setup();
    }
  });

  it('the Practice route and its sentence are gone (the mutant: the Practice sentence back): not in the copy, not on any form', async () => {
    expect(Object.keys(COPY_CARDS.routes)).toEqual(['watch', 'offer', 'set']);
    expect(Object.keys(COPY_CARDS.routeNotes)).toEqual(['watch', 'offer', 'set']);
    expect(JSON.stringify(COPY_CARDS)).not.toContain('The Practice Field opens later');
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.q('[data-route="drill"]')).toBeNull();
    expect(text()).not.toContain('The Practice Field opens later');
  });

  it('Offer picked, then the counter re-reads the book closed: the Offer route goes, the choice falls back to Watch, and Watch is what is sent (no Offer to a closed book)', async () => {
    const moment = momentsOf(fx.tape2.tags.items)[0];
    const sent = [];
    const form = (bookOpen) => <YourCall tape={fx.tape2} moment={moment} counter={{ status: 'ready', data: { open: 0, cap: 5, book: { open: bookOpen } } }} mintOpId={() => 'op_form'} onFile={async (b) => { sent.push(b); return { ok: true }; }} onCancel={() => {}} />;
    m.render(form(true));
    await m.flush(2);
    m.click(m.q('[data-route="offer"] input'));
    await m.flush(1);
    expect(m.q('[data-route="offer"] input').checked).toBe(true);
    m.render(form(false));
    await m.flush(1);
    expect(m.q('[data-route="offer"]')).toBeNull();
    expect(m.q('[data-route="watch"] input').checked).toBe(true);
    await (async () => { const ta = m.q('[data-note]'); await import('react').then(({ act }) => act(() => setValue(ta, 'Watch it.'))); })();
    await m.flush(1);
    m.click(m.q('[data-card-form] button[type="submit"]'));
    await m.flush(2);
    expect(sent.map((x) => x.route)).toEqual(['watch']);
  });

  it('a stored `drill` entry (v1, never written in production) reads as Offer on My cards and its receipt', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const doc = t.store.get(`agents/${AGENT}/plays/op_1`);
    const v1 = { ...doc, entryId: 'c_drill', opId: 'c_drill', route: 'drill', stage: 'nominated', note: 'A v1 Practice card.' };
    delete v1.stageVocabVersion;
    t.store.set(`agents/${AGENT}/plays/c_drill`, v1);
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.q('[data-my-card="c_drill"]').textContent).toContain('Offer · nominated for the Practice Field');
    m.click(m.q('[data-my-card="c_drill"]'));
    await m.flush();
    const receipt = m.q('[data-card-receipt="c_drill"]');
    expect(receipt.textContent).toContain('Route · Offer');
    // a v1 Practice card holds no nomination record: nothing is said to come next
    expect(receipt.querySelector('[data-card-next]')).toBeNull();
    await sweepAll(fx.tape2, 'v1 drill');
  });
});

describe('C1 item 6 — the receipt is the chain (spec §5; acceptance C-COPY), every state from the ledger\'s own writes', () => {
  /** A server transition through the REAL helper (the Practice Field's one way in), at an instant on the shown day. */
  const move = (entryId, to, payload, clock) => applyServerTransition(state.db, { entryId, ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId: `s_${to}_${clock.replace(/\D/g, '')}`, nowIso: `${D2}T${clock}:00.000Z` });
  // Amendment A CA-4: an accepted copy names its idea (`idea-1`, the one `testing` names below) and may carry a thesis
  const NOM = (state, reason, consideredAt, thesis = null) => ({ bookId: BOOK_ID, nominationId: 'op_1', state, reason, consideredAt, ...(state === 'accepted' ? { ideaId: 'idea-1', thesis } : {}) });
  const reopen = async (id) => {
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q(`[data-my-card="${id}"]`));
    await m.flush();
    return m.q(`[data-card-receipt="${id}"]`);
  };
  const lines = (receipt) => [...receipt.querySelectorAll('[data-chain-line]')].map((l) => [l.getAttribute('data-chain-line'), l.getAttribute('data-chain-state')]);
  const lineText = (receipt, i) => receipt.querySelectorAll('[data-chain-line]')[i].querySelector('span').textContent;
  const offerCard = async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
  };

  it('filed by the Offer route: "Offered to your agent" and "Filed", newest first, each with its time; the note "— you" stays; what comes next is the Offer sentence', async () => {
    await offerCard();
    const receipt = m.q('[data-card-receipt="op_1"]');
    expect(lines(receipt)).toEqual([['offered', null], ['filed', null]]);
    // the card was filed now, not on the shown day: its instant carries its date (review L3-7)
    expect(lineText(receipt, 0)).toMatch(/^Offered to your agent · ([A-Z][a-z]{2} \d{1,2}, )?\d{1,2}:\d{2} [AP]M$/);
    expect(lineText(receipt, 1)).toMatch(/^Filed · /);
    expect(receipt.querySelectorAll('[data-chain-line] [data-time]')).toHaveLength(2);
    expect(receipt.querySelector('[data-quotation="you"]')).toBeTruthy();
    expect(receipt.querySelector('[data-card-next]').textContent).toBe(RG5.offer);
    await sweepAll(fx.tape2, 'offered');
  });

  it('deferred, then accepted (Amendment A CA-4, CA-11): each answer a line, each quoting from ITS OWN row at ITS OWN consideredAt — the deferral its reason, the acceptance its thesis (never its reason), "— your agent · {time}"; no Offer sentence once answered (the mutants: a later copy overwriting an earlier answer\'s quotation; a quotation dated with the delivery time)', async () => {
    await offerCard();
    await move('op_1', 'nomination', NOM('deferred', 'Not this week: the book is full.', `${D2}T20:10:00.000Z`), '20:15');
    let receipt = await reopen('op_1');
    expect(lines(receipt)).toEqual([['nomination', 'deferred'], ['offered', null], ['filed', null]]);
    expect(lineText(receipt, 0)).toBe('Deferred · 4:15 PM');
    const q1 = receipt.querySelector('[data-quotation="yourAgent"]');
    expect(q1.querySelector('[data-quote-path]').textContent).toBe('Not this week: the book is full.');
    expect(q1.querySelector('[data-quote-path]').getAttribute('data-quote-path')).toBe('cards.op_1.stageHistory[1].reason');
    // the reason's own time (4:10), never the copy's delivery (4:15)
    expect(q1.querySelector('[data-quote-attribution]').textContent).toBe('— your agent · 4:10 PM');
    expect(receipt.querySelector('[data-card-next]')).toBeNull();
    await sweepAll(fx.tape2, 'deferred');
    await move('op_1', 'nomination', NOM('accepted', 'I will test holding one more check after the stall.', `${D2}T20:40:00.000Z`, 'Holding one more check after a stall pays more than it costs.'), '20:45');
    receipt = await reopen('op_1');
    expect(lines(receipt)).toEqual([['nomination', 'accepted'], ['nomination', 'deferred'], ['offered', null], ['filed', null]]);
    expect(lineText(receipt, 0)).toBe('Taken into an idea · 4:45 PM');
    const quotes = [...receipt.querySelectorAll('[data-quotation="yourAgent"]')].map((q) => [q.closest('[data-chain-line]').getAttribute('data-chain-state'), q.querySelector('[data-quote-path]').getAttribute('data-quote-path'), q.querySelector('[data-quote-path]').textContent, q.querySelector('[data-quote-attribution]').textContent]);
    expect(quotes).toEqual([
      ['accepted', 'cards.op_1.stageHistory[2].thesis', 'Holding one more check after a stall pays more than it costs.', '— your agent · 4:40 PM'],
      ['deferred', 'cards.op_1.stageHistory[1].reason', 'Not this week: the book is full.', '— your agent · 4:10 PM'],
    ]);
    expect(receipt.textContent).not.toContain('I will test holding one more check after the stall.');
    // no book door is handed in: "Open the idea" renders nowhere (the mutant: a book link with no door)
    expect(m.buttons('Open the idea')).toHaveLength(0);
    await sweepAll(fx.tape2, 'accepted');
  });

  it('testing, tested, installed: the lines in the ledger\'s order; the result\'s words EXACTLY as stored (the mutant: the result in other words); no idea or result link without the door; never "validated", "proven" or "supported"', async () => {
    await offerCard();
    await move('op_1', 'nomination', NOM('accepted', 'I will test it.', `${D2}T20:40:00.000Z`), '20:45');
    await move('op_1', 'testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    let receipt = await reopen('op_1');
    expect(lineText(receipt, 0)).toBe('Testing · from 4:50 PM');
    expect(receipt.querySelector('[data-card-next]')).toBeNull();
    await move('op_1', 'tested', { ideaId: 'idea-1', resultRef: 'mandates/book-1/ideas/idea-1/results/r1', contractCondition: 'breached', economicResult: 'within band' }, '20:55');
    receipt = await reopen('op_1');
    expect(lines(receipt).map((l) => l[0])).toEqual(['tested', 'testing', 'nomination', 'offered', 'filed']);
    expect(lineText(receipt, 0)).toBe('Tested · 4:55 PM · contract condition breached · economic result within band');
    expect([...receipt.querySelectorAll('[data-result-field]')].map((e) => [e.getAttribute('data-result-field'), e.textContent])).toEqual([['contractCondition', 'breached'], ['economicResult', 'within band']]);
    expect(receipt.querySelector('[data-result-field]').closest('[data-record-text]')).toBeTruthy();
    expect(m.buttons('Open the result')).toHaveLength(0);
    expect(m.buttons('Open the idea')).toHaveLength(0);
    expect(receipt.textContent).not.toMatch(/validated|proven|supported|\bright\b|\bwrong\b/i);
    expect(receipt.textContent).toContain('Stage · tested');
    await sweepAll(fx.tape2, 'tested');
    await move('op_1', 'offered', { ideaId: 'idea-1', offerId: 'offer-1', state: 'offered' }, '20:58');
    await move('op_1', 'installed', { ideaId: 'idea-1', offerId: 'offer-1', state: 'accepted' }, '21:00');
    receipt = await reopen('op_1');
    expect(lineText(receipt, 0)).toBe('Equipped · 5:00 PM');
    expect(receipt.textContent).toContain('Stage · equipped');
    expect(m.buttons('Retire')).toHaveLength(0);
    await sweepAll(fx.tape2, 'installed');
  });

  it('expired: "Not considered within 10 sessions", ten a derived number (B6); retired by the server: the Forge offer\'s state as stored', async () => {
    await offerCard();
    await move('op_1', 'nomination', NOM('expired', null, null), '20:15');
    let receipt = await reopen('op_1');
    // the ten carries its class mark (D) beside it
    expect(lineText(receipt, 0)).toBe('Not considered within 10D sessions · 4:15 PM');
    const n = receipt.querySelector('[data-num-aggregate="count(sessions a queued nomination waits, B6)"]');
    expect(n.getAttribute('data-num-class')).toBe('derived');
    expect(Number(n.getAttribute('data-agg-value'))).toBe(10);
    expect(receipt.querySelector('[data-quotation="yourAgent"]')).toBeNull();   // no reason stored, no quotation
    await sweepAll(fx.tape2, 'expired');
  });

  it('retired by the server from tested, with the Forge offer\'s state: "Retired · {time} · Forge offer {state}", the state the record\'s own word', async () => {
    await offerCard();
    await move('op_1', 'nomination', NOM('accepted', 'I will test it.', `${D2}T20:40:00.000Z`), '20:45');
    await move('op_1', 'testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    await move('op_1', 'tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'met', economicResult: 'unmeasurable' }, '20:55');
    await move('op_1', 'retired', { ideaId: 'idea-1', offerId: null, state: 'no_offer' }, '21:05');
    const receipt = await reopen('op_1');
    expect(lineText(receipt, 0)).toBe('Retired · 5:05 PM · Forge offer no_offer');
    expect(receipt.querySelector('[data-offer-state]').closest('[data-record-text]')).toBeTruthy();
    expect(receipt.querySelector('[data-card-next]').textContent).toBe('Retired: nothing happens next.');
    await sweepAll(fx.tape2, 'server retired');
  });

  it('the chain says only what the ledger holds (exit criterion 11): a result planted on a card-stage entry shows no tested line; an answer the copy has no line for is the record\'s own word', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const doc = t.store.get(`agents/${AGENT}/plays/op_1`);
    t.store.set(`agents/${AGENT}/plays/op_1`, { ...doc, result: { ideaId: 'x', resultRef: 'x', contractCondition: 'met', economicResult: 'ahead' } });
    let receipt = await reopen('op_1');
    expect(lines(receipt)).toEqual([['filed', null]]);
    expect(receipt.textContent).not.toContain('Tested');
    expect(receipt.textContent).not.toContain('ahead');
    // a nominated entry whose copied answer is one the copy names no line for (a state no writer sends today, planted — Amendment A CA-9 gave considered its own line)
    t.store.set(`agents/${AGENT}/plays/op_1`, { ...doc, stage: 'nominated', nomination: { bookId: BOOK_ID, nominationId: 'op_1', state: 'reviewing', reason: null, consideredAt: null }, stageHistory: [...doc.stageHistory, { stage: 'nominated', at: `${D2}T20:00:00.000Z`, by: 'player', opId: 'n1' }, { stage: 'nominated', event: 'nomination', state: 'reviewing', at: `${D2}T20:05:00.000Z`, by: 'server', writer: 'practice_field', opId: 's1' }] });
    receipt = await reopen('op_1');
    expect(lineText(receipt, 0)).toBe("Your agent's answer · reviewing · 4:05 PM");
    expect(receipt.querySelectorAll('[data-chain-line]')[0].querySelector('[data-record-text]').textContent).toBe('reviewing');
    await sweepAll(fx.tape2, 'unknown answer');
  });

  it('the link slots render only beside the book\'s door (onOpenBook): handed one, "Open the idea" and "Open the result" open the entry\'s own idea and result; handed none (C1, everywhere), no slot', async () => {
    await offerCard();
    await move('op_1', 'nomination', NOM('accepted', 'I will test it.', `${D2}T20:40:00.000Z`), '20:45');
    await move('op_1', 'testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    await move('op_1', 'tested', { ideaId: 'idea-1', resultRef: 'r-1', contractCondition: 'met', economicResult: 'ahead' }, '20:55');
    const entry = t.store.get(`agents/${AGENT}/plays/op_1`);
    const opened = [];
    m.teardown(); m.setup();
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [entry] } }} card={entry} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} onOpenBook={(target) => opened.push(target)} />);
    await m.flush(2);
    expect(m.buttons('Open the idea')).toHaveLength(2);   // taken into an idea; testing
    expect(m.buttons('Open the result')).toHaveLength(1);
    // newest first: the tested line's result, the testing line's idea, then the accepted line's
    m.click(m.buttons('Open the result')[0]);
    m.click(m.buttons('Open the idea')[0]);
    m.click(m.buttons('Open the idea')[1]);
    expect(opened).toEqual([{ ideaId: 'idea-1', resultRef: 'r-1' }, { bookId: BOOK_ID, ideaId: 'idea-1' }, { bookId: BOOK_ID, nominationId: 'op_1' }]);
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [entry] } }} card={entry} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
    await m.flush(2);
    expect(m.buttons('Open the idea')).toHaveLength(0);
    expect(m.buttons('Open the result')).toHaveLength(0);
  });
});

describe('C1 item 7 — "Park this card", on a tested receipt only (refinement R-C1-2; acceptance C-PARK)', () => {
  const move = (to, payload, clock) => applyServerTransition(state.db, { entryId: 'op_1', ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId: `s_${to}`, nowIso: `${D2}T${clock}:00.000Z` });
  const toTested = async () => {
    await move('nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'accepted', ideaId: 'idea-1', reason: 'I will test it.', consideredAt: `${D2}T20:40:00.000Z` }, '20:45');
    await move('testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    await move('tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'met', economicResult: 'ahead' }, '20:55');
  };
  const reopen = async () => {
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
  };

  it('a tested receipt holds "Park this card" (and Retire); parking writes parkedAt through the endpoint: the Parked line, the parked note, no buttons, under Parked, the open count down', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    // an Offer card at nominated, testing: no Park
    expect(m.buttons('Park this card')).toHaveLength(0);
    await toTested();
    await reopen();
    expect(m.buttons('Park this card')).toHaveLength(1);
    expect(m.buttons('Retire')).toHaveLength(1);
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    m.click(m.buttons('Park this card')[0]);
    await m.flush(10);
    const bodies = cardBodies().filter((b) => b.op === 'park');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ op: 'park', agentId: AGENT, entryId: 'op_1' });
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).parkedAt).toEqual(expect.any(String));
    const receipt = m.q('[data-card-receipt="op_1"]');
    expect(receipt.querySelector('[data-chain-line]').getAttribute('data-chain-line')).toBe('parked');
    expect(receipt.querySelector('[data-card-next]').textContent).toBe('Parked: kept with its result, no longer counted as open.');
    expect(m.buttons('Park this card')).toHaveLength(0);
    expect(m.buttons('Retire')).toHaveLength(0);
    expect(m.qa('[data-my-cards-group="parked"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(Number(m.q('[data-open-count] [data-num-aggregate="count(plays[] open)"]').getAttribute('data-agg-value'))).toBe(0);
    await sweepAll(fx.tape2, 'parked');
  });

  it('no Park on any receipt but a tested one: a card, an equipped card, a retired one', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    expect(m.buttons('Park this card')).toHaveLength(0);
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(m.buttons('Park this card')).toHaveLength(0);
  });

  it('ledgerOf keeps the counter row\'s shelving when a newer write result replaces it (a shelved tested card parks), and a new entry reads unshelved', () => {
    const row = { entryId: 'e1', version: 4, stage: 'tested', shelved: true };
    expect(ledgerOf({ cards: [row] }, { entryId: 'e1', version: 5, stage: 'tested', parkedAt: 'x' })[0]).toMatchObject({ version: 5, parkedAt: 'x', shelved: true });
    expect(ledgerOf({ cards: [{ ...row, shelved: false }] }, { entryId: 'e1', version: 5 })[0].shelved).toBe(false);
    expect(ledgerOf({ cards: [] }, { entryId: 'e2', version: 1 })[0].shelved).toBe(false);
  });
});

describe('C1 item 8 — since last time: every card past the card stage, its latest state line and time, newest first (refinement R-C1-1)', () => {
  const move = (entryId, to, payload, clock) => applyServerTransition(state.db, { entryId, ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId: `s_${entryId}_${to}_${clock.replace(':', '')}`, nowIso: `${D2}T${clock}:00.000Z` });
  const latestRows = () => m.qa('[data-latest-line]').map((b) => [b.getAttribute('data-latest-line'), b.getAttribute('data-latest-kind')]);

  it('a Watch card at card is not listed; two Offer cards answered at different times list newest state first, each with the situation, symbol, day and the receipt\'s state line; a tap opens the receipt', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'A watch card.' });   // op_1, at card: never listed
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'An offer.', route: 'offer' });   // op_3 (the receipt minted op_2)
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Another offer.', route: 'offer', question: 'stalled.ready' });
    const ids = [...t.store.keys()].filter((k) => k.startsWith(`agents/${AGENT}/plays/`)).map((k) => k.split('/').pop()).filter((id) => t.store.get(`agents/${AGENT}/plays/${id}`).route === 'offer').sort();
    expect(ids).toHaveLength(2);
    const [a, b] = ids;
    await move(a, 'nomination', { bookId: BOOK_ID, nominationId: a, state: 'declined', reason: 'Not for this book.', consideredAt: `${D2}T20:30:00.000Z` }, '20:30');
    await move(b, 'nomination', { bookId: BOOK_ID, nominationId: b, state: 'deferred', reason: 'Later.', consideredAt: `${D2}T20:20:00.000Z` }, '20:20');
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(latestRows()).toEqual([[a, 'nomination'], [b, 'nomination']]);
    const first = m.q(`[data-latest-line="${a}"]`);
    expect(first.textContent).toContain('Our stocks are not moving');
    expect(first.querySelector('[data-record-text]').textContent).toBe('ACN');
    expect(first.textContent).toContain('Declined · 4:30 PM');
    expect(m.q(`[data-latest-line="${b}"]`).textContent).toContain('Deferred · 4:20 PM');
    expect(m.q('[data-latest-line="op_1"]')).toBeNull();
    // the latest list sits after the Watch cards and before My cards
    const region = m.q('[data-cards-region="since-last-time"]');
    const order = [...region.querySelectorAll('[data-watch-card], [data-latest-states], [data-my-cards]')].map((e) => (e.hasAttribute('data-watch-card') ? 'watch' : e.hasAttribute('data-latest-states') ? 'latest' : 'mine'));
    expect(order).toEqual(['watch', 'latest', 'mine']);
    await sweepAll(fx.tape2, 'latest');
    m.click(first);
    await m.flush();
    expect(m.q(`[data-card-receipt="${a}"]`)).toBeTruthy();
    // b moves on: its newer line puts it first
    await move(b, 'nomination', { bookId: BOOK_ID, nominationId: b, state: 'accepted', ideaId: 'idea-b', reason: 'Taking it.', consideredAt: `${D2}T20:40:00.000Z` }, '20:45');
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(latestRows().map((r) => r[0])).toEqual([b, a]);
    expect(m.q(`[data-latest-line="${b}"]`).textContent).toContain('Taken into an idea · 4:45 PM');
  });

  it('latestOf (pure): cards past card only, each with chainOf\'s newest line, newest first, ties by entry id; a retired Watch card is listed', () => {
    const at = (h) => `${D2}T${h}:00.000Z`;
    const card = (entryId, stage, history) => ({ entryId, stage, stageHistory: history });
    const cards = [
      card('w', 'card', [{ stage: 'card', at: at('14:00') }]),
      card('r', 'retired', [{ stage: 'card', at: at('14:00') }, { stage: 'retired', at: at('15:00'), by: 'player' }]),
      card('n', 'nominated', [{ stage: 'nominated', at: at('16:00'), by: 'player' }]),
      card('m', 'nominated', [{ stage: 'nominated', at: at('16:00'), by: 'player' }]),
    ];
    expect(latestOf(cards).map((x) => [x.card.entryId, x.line.kind])).toEqual([['m', 'offered'], ['n', 'offered'], ['r', 'retired']]);
    expect(latestOf(null)).toEqual([]);
  });
});

// ── Film Room C1 items 11 and 12 — Build C spec V1 §8 rulings 3 and 4 (the B2.1 report §14.10 items 3 and 4) ─────────
describe('C1 item 11 — §8 ruling 3: a battle with no agent recorded links nothing (the cautious reading stands)', () => {
  it('the battle document and its tape days name no agent, with the Forge door handed in and the day\'s rule on: the form says RG-5\'s sentence alone, the counter is never asked, a card cannot be filed, and no link to the tempo dial renders anywhere', async () => {
    const forge = [];
    const tapes = { [D1]: { ...fx.tape1, agentId: null }, [D2]: { ...fx.tape2, agentId: null } };
    lastBattle = battleOf({ agentId: null });
    expect(fx.tape2.tags.inputs.forcedRotation.enabled).toBe(true);
    m.render(<FilmRoomScreenV2 battle={lastBattle} onBack={() => {}} viewerId="viewer-1" readers={readersOf(tapes, [])} nowMs={NOW} cardsApi={api} onOpenForge={(a) => forge.push(a)} />);
    await m.flush(8);
    expect(counterCalls()).toBe(0);
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    expect(m.q('[data-route-note="set"]').textContent).toBe(RG5.set);
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    expect(m.q('[data-card-receipt]')).toBeNull();
    expect(m.q('[data-card-refusal]')).toBeTruthy();
    expect(m.q('[data-set-link]')).toBeNull();
    expect(forge).toEqual([]);
    expect(t.writeLog.filter((w) => w.path.includes('/plays/'))).toEqual([]);
  });
});

describe('C1 item 12 — §8 ruling 4: an open at a real date that is not one of the battle\'s days opens the default view, nothing marked; the clear still fires once', () => {
  const ELSE = 'b-elsewhere';
  const D3 = '2026-09-28';
  const elseBattle = () => battleOf({ id: ELSE, agentBattleId: ELSE, timing: { tradingDays: [D2, D3] }, completedAt: `${D3}T20:05:00.000Z` });
  const elseTape = () => ({ ...fx.tape2, battleId: ELSE });
  const moment = () => { const w = momentsOf(fx.tape2.tags.items)[0]; return { situationId: w.situationId, symbol: w.symbol, fromTickSeq: w.fromTickSeq, toTickSeq: w.toTickSeq }; };
  const mountAt = async (etDate) => {
    let used = 0;
    lastBattle = elseBattle();
    lastReaders = readersOf({ [D2]: elseTape(), [D3]: { ...elseTape(), etDate: D3 } }, []);
    m.render(<FilmRoomScreenV2 battle={lastBattle} onBack={() => {}} viewerId="viewer-1" readers={lastReaders} nowMs={NOW} cardsApi={api} openAt={{ battleId: ELSE, etDate, moment: moment() }} onOpenAtUsed={() => { used += 1; }} />);
    await m.flush(8);
    return () => used;
  };
  const pressed = () => m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent;

  it('a Saturday between the battle\'s days (a real date, battleReviewAtOf accepts it): the default day (the completed battle\'s last), no moment marked, no read of the foreign day; onOpenAtUsed once (the mutant: a foreign day\'s openAt marking a moment)', async () => {
    const used = await mountAt('2026-09-26');
    expect(pressed()).toContain('Sep 28');
    expect(m.q('[data-moment-opened]')).toBeNull();
    expect(lastReaders.calls.filter((c) => c[0] === 'tape').map((c) => c[2])).not.toContain('2026-09-26');
    expect(used()).toBe(1);
  });

  it('the control: one of the battle\'s days opens there, the moment marked; onOpenAtUsed once', async () => {
    const used = await mountAt(D2);
    expect(pressed()).toContain('Sep 25');
    expect(m.q('[data-moment-opened]')).toBeTruthy();
    expect(used()).toBe(1);
  });

  it('battleReviewAtOf itself is unchanged: the Saturday is a real date it accepts — the bound is the screen\'s', async () => {
    const { battleReviewAtOf } = await import('../../components/Forge/Watchlist/ideaNavigation');
    expect(battleReviewAtOf({ etDate: '2026-09-26', moment: moment() }, ELSE)).toMatchObject({ battleId: ELSE, etDate: '2026-09-26' });
  });
});

// ── the C1 review's fixes (docs/audits/20261112_BUILD_FILM_ROOM_C1_CHAIN.md §6) ─────────────────────────────────────
describe('C1 review — the chain and the receipt say only what the ledger holds', () => {
  const at = (hm) => `${D2}T${hm}:00.000Z`;
  const base = (over = {}) => ({
    entryId: 'e1', ownerId: OWNER, agentId: AGENT, createdAt: at('20:00'), archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
    source: { battleId: B, etDate: D2, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: 1, note: 'A note.', route: 'watch',
    stage: 'card', stageAt: at('20:00'), stageHistory: [{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }], version: 1, ...over,
  });
  const receiptOf = async (card, extra = {}) => {
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [card] } }} card={card} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} onPark={async () => ({ ok: true })} {...extra} />);
    await m.flush(2);
    return m.q('[data-card-receipt]');
  };
  const kinds = (r) => [...r.querySelectorAll('[data-chain-line]')].map((l) => l.getAttribute('data-chain-line'));

  it('A-7 / B-1: a v1 Practice entry (stored route drill, filed at nominated, no record) says its stage\'s own word — never "Offered to your agent" — on the receipt and in the latest list', async () => {
    const v1 = base({ route: 'drill', stage: 'nominated', stageHistory: [{ stage: 'nominated', at: at('20:00'), by: 'player', opId: 'e1' }] });
    const r = await receiptOf(v1);
    expect(kinds(r)).toEqual(['stage', 'filed']);
    expect(r.querySelector('[data-chain-line="stage"]').textContent).toBe('nominated for the Practice Field · 4:00 PM');
    expect(r.textContent).not.toContain('Offered to your agent');
    expect(latestOf([v1])[0].line.kind).toBe('stage');
    // an Offer-route card's same row IS an offer
    expect(latestOf([{ ...v1, route: 'offer' }])[0].line.kind).toBe('offered');
  });

  it('B-2: a parked card the idea later equipped is equipped — no parked note; the note stays on a parked TESTED card', async () => {
    const history = [{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }, { stage: 'tested', event: 'parked', at: at('20:30'), by: 'player', opId: 'p1' }, { stage: 'installed', at: at('20:40'), by: 'server', writer: 'practice_field', opId: 's9' }];
    let r = await receiptOf(base({ stage: 'installed', parkedAt: at('20:30'), stageHistory: history, offer: { offerId: 'o1', state: 'accepted' } }));
    expect(r.querySelector('[data-card-next]')).toBeNull();
    expect(r.textContent).toContain('Stage · equipped');
    expect(m.buttons('Park this card')).toHaveLength(0);   // B-12: no Park on an equipped card
    r = await receiptOf(base({ stage: 'tested', parkedAt: at('20:30'), stageHistory: history.slice(0, 2) }));
    expect(r.querySelector('[data-card-next]').textContent).toBe('Parked: kept with its result, no longer counted as open.');
  });

  it('B-3: an expiry carries no quotation — even with a reason stored, it is the book\'s, not the agent\'s words; an answer still quotes its reason', async () => {
    const nominated = [{ stage: 'nominated', at: at('20:00'), by: 'player', opId: 'e1' }];
    const expired = base({ route: 'offer', stage: 'nominated', nomination: { bookId: 'b', nominationId: 'e1', state: 'expired', reason: 'Expired unread.', consideredAt: at('20:10') }, stageHistory: [...nominated, { stage: 'nominated', event: 'nomination', state: 'expired', reason: 'Expired unread.', consideredAt: at('20:10'), at: at('20:15'), by: 'server', writer: 'practice_field', opId: 's1' }] });
    let r = await receiptOf(expired);
    expect(r.querySelector('[data-quotation="yourAgent"]')).toBeNull();
    // the decline's reason sits on its own row (Amendment A CA-11), quoted at the row's consideredAt
    const declined = { ...expired, nomination: { ...expired.nomination, state: 'declined', reason: 'Not for this book.' }, stageHistory: [...nominated, { ...expired.stageHistory[1], state: 'declined', reason: 'Not for this book.', consideredAt: at('20:10') }] };
    r = await receiptOf(declined);
    expect(r.querySelector('[data-quotation="yourAgent"] [data-quote-path]').textContent).toBe('Not for this book.');
  });

  it('B-4: Set\'s sentence and its tempo link belong to the filed Set card at card — a Set card offered later and now testing, or queued, shows neither (RL-5\'s sentence and link stay together)', async () => {
    expect(fx.tape2.tags.inputs.forcedRotation.enabled).toBe(true);
    const asFiled = base({ route: 'set' });
    let r = await receiptOf(asFiled, { tape: fx.tape2, onOpenForge: () => {} });
    expect(r.querySelector('[data-set-link]')).toBeTruthy();   // the control: a filed Set card links
    const testing = base({ route: 'set', stage: 'testing', idea: { bookId: 'b', ideaId: 'i' }, stageHistory: [...asFiled.stageHistory, { stage: 'nominated', at: at('20:05'), by: 'player', opId: 'n1' }, { stage: 'testing', at: at('20:20'), by: 'server', writer: 'practice_field', opId: 's2' }] });
    r = await receiptOf(testing, { tape: fx.tape2, onOpenForge: () => {} });
    expect(r.querySelector('[data-set-link]')).toBeNull();
    expect(r.textContent).not.toContain('A change applies from your next battle.');
    const queued = base({ route: 'set', stage: 'nominated', nomination: { bookId: 'b', nominationId: 'n1', state: 'queued' }, stageHistory: testing.stageHistory.slice(0, 2) });
    r = await receiptOf(queued, { tape: fx.tape2, onOpenForge: () => {} });
    expect(r.querySelector('[data-set-link]')).toBeNull();
    expect(r.querySelector('[data-card-next]').textContent).toBe(RG5.offer);
  });

  it('B-6 / B-7 / B-8: a nomination row with no state, and a row with an event the chain does not know, give no line; a row with no instant says so in words, never as an instant', async () => {
    const r = await receiptOf(base({ stage: 'tested', result: { ideaId: 'i', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' }, stageHistory: [
      { stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' },
      { stage: 'nominated', event: 'nomination', at: at('20:05'), by: 'server', opId: 's0' },
      { stage: 'tested', at: null, by: 'server', opId: 's1' },
      { stage: 'tested', event: 'unparked', at: at('20:30'), by: 'player', opId: 'u1' },
    ] }));
    expect(kinds(r)).toEqual(['tested', 'filed']);
    expect(r.textContent).not.toContain('undefined');
    const tested = r.querySelector('[data-chain-line="tested"]');
    expect(tested.textContent).toContain('Tested · time not recorded');
    expect(tested.querySelector('[data-time]')).toBeNull();
  });
});

describe('C1 review — the mutating lens\'s survivors on the screen', () => {
  it('D-M21: Offer shows ONLY when the counter reports the book open — never while it loads, after a failed first read, or when it answered with no book field', async () => {
    const moment = momentsOf(fx.tape2.tags.items)[0];
    for (const counter of [{ status: 'loading', data: null }, { status: 'idle', data: null }, { status: 'error', data: null }, { status: 'ready', data: { open: 0, cap: 5 } }, { status: 'ready', data: { open: 0, cap: 5, book: {} } }]) {
      m.render(<YourCall key={JSON.stringify(counter)} tape={fx.tape2} moment={moment} counter={counter} mintOpId={() => 'op_f'} onFile={async () => ({ ok: true })} onCancel={() => {}} />);
      await m.flush(1);
      expect(m.qa('[data-route]').map((l) => l.getAttribute('data-route')), JSON.stringify(counter)).toEqual(['watch', 'set']);
    }
  });

  it('D-M20: a park the server refuses as stale re-reads the counter, says why, and shows the counter\'s row; an unknown refusal says the park sentence', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    const by = { entryId: 'op_1', ownerId: OWNER, agentId: AGENT, by: 'practice_field' };
    await applyServerTransition(state.db, { ...by, to: 'nomination', opId: 'r1', payload: { bookId: BOOK_ID, nominationId: 'op_1', state: 'accepted', ideaId: 'i1', reason: 'Testing it.', consideredAt: `${D2}T20:40:00.000Z` }, nowIso: `${D2}T20:45:00.000Z` });
    await applyServerTransition(state.db, { ...by, to: 'testing', opId: 'r2', payload: { bookId: BOOK_ID, ideaId: 'i1' }, nowIso: `${D2}T20:50:00.000Z` });
    await applyServerTransition(state.db, { ...by, to: 'tested', opId: 'r3', payload: { ideaId: 'i1', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' }, nowIso: `${D2}T20:55:00.000Z` });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
    // the card moves on elsewhere (another tab parks it): the receipt still holds the old version
    const stored = t.store.get(`agents/${AGENT}/plays/op_1`);
    t.store.set(`agents/${AGENT}/plays/op_1`, { ...stored, version: stored.version + 1 });
    const reads = counterCalls();
    m.click(m.buttons('Park this card')[0]);
    await m.flush(10);
    expect(cardBodies().filter((b) => b.op === 'park')).toHaveLength(1);
    expect(m.q('[data-card-receipt] [data-card-refusal]').textContent).toBe('This card changed since it was loaded. Reload and try again.');
    expect(counterCalls()).toBe(reads + 1);
    // an unknown refusal: the park's own sentence
    m.teardown(); m.setup();
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [stored] } }} card={stored} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} onPark={async () => ({ ok: false, code: 'server_error' })} />);
    await m.flush(2);
    m.click(m.buttons('Park this card')[0]);
    await m.flush(2);
    expect(m.q('[data-card-refusal]').textContent).toBe('The card could not be parked.');
  });
});

// ── C1 fix round, Astra F3 — an unknown first history row draws no "Filed" line (criteria 3 and 11) ────────────────
describe('C1 fix round F3 — the chain recognises a create row by its shape, never by its index alone', () => {
  const at = (hm) => `${D2}T${hm}:00.000Z`;
  const card = (stageHistory, over = {}) => ({ entryId: 'e1', route: 'watch', stage: 'card', stageHistory, ...over });
  const kindsOf = (c) => chainOf(c).map((l) => l.kind);

  it("Astra's repro, through the real handler and counter: a card filed at 16:00Z (12:00 PM ET), its first row replaced by an unknown event at 17:00Z — the receipt draws no \"Filed · 1:00 PM\", no chain line at all, while the note credit still says 12:00 PM (the mutant: an unknown first row drawn as Filed)", async () => {
    await atClock('2026-09-25T16:00:00.000Z', async () => {
      await open();
      m.click(m.buttons('Take this home')[0]);
      await m.flush();
      await fileCard({ note: 'Let it go sooner.' });
    });
    // the control: as filed, the receipt says Filed at 12:00 PM, and the note's credit the same
    const filed = m.q('[data-card-receipt]');
    expect(filed.querySelector('[data-chain-line="filed"]').textContent).toBe('Filed · 12:00 PM');
    expect(filed.querySelector('[data-quotation="you"] [data-quote-attribution]').textContent).toContain('12:00 PM');
    const path = `agents/${AGENT}/plays/op_1`;
    t.store.set(path, { ...t.store.get(path), stageHistory: [{ event: 'unknown', at: '2026-09-25T17:00:00.000Z', by: 'server', writer: 'practice_field' }] });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
    const r = m.q('[data-card-receipt]');
    expect(r.textContent).not.toContain('Filed · 1:00 PM');
    expect(r.querySelector('[data-chain-line]')).toBeNull();
    expect(r.querySelector('[data-quotation="you"] [data-quote-attribution]').textContent).toContain('12:00 PM');
    // and no entry in "Since last time" for a card whose history the chain does not know
    expect(m.q(`[data-latest-line="op_1"]`)).toBeNull();
  });

  it('chainOf (pure): an unknown event at index zero gives no line and no latest entry; a server row at index zero is no create', () => {
    expect(chainOf(card([{ event: 'unknown', at: at('17:00'), by: 'server', writer: 'practice_field' }]))).toEqual([]);
    expect(chainOf(card([{ stage: 'card', event: 'unknown', at: at('17:00'), by: 'player' }]))).toEqual([]);
    expect(chainOf(card([{ stage: 'card', at: at('17:00'), by: 'server', writer: 'practice_field' }]))).toEqual([]);
    expect(chainOf(card([{ stage: 'retired', at: at('17:00'), by: 'player' }]))).toEqual([{ kind: 'retired', at: at('17:00'), k: 0, by: 'player' }]);
    expect(latestOf([card([{ event: 'unknown', at: at('17:00'), by: 'server' }], { stage: 'nominated', route: 'offer' })])).toEqual([]);
  });

  it('kept: the valid Watch, Set and Offer first rows, the v1 drill first row, and "time not recorded" for a recognisable row with no time', () => {
    expect(kindsOf(card([{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }]))).toEqual(['filed']);
    expect(kindsOf(card([{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }], { route: 'set' }))).toEqual(['filed']);
    expect(kindsOf(card([{ stage: 'nominated', at: at('20:00'), by: 'player', opId: 'e1' }], { route: 'offer', stage: 'nominated' }))).toEqual(['offered', 'filed']);
    expect(kindsOf(card([{ stage: 'nominated', at: at('20:00'), by: 'player', opId: 'e1' }], { route: 'drill', stage: 'nominated' }))).toEqual(['stage', 'filed']);
    expect(chainOf(card([{ stage: 'card', by: 'player', opId: 'e1' }]))).toEqual([{ kind: 'filed', at: undefined, k: 0 }]);
    // a `card` row past the first is no create and no line
    expect(kindsOf(card([{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }, { stage: 'card', at: at('20:10'), by: 'player', opId: 'e2' }]))).toEqual(['filed']);
  });

  it('a recognisable create row with no time renders "Filed · time not recorded", never an instant', async () => {
    const c = { ...card([{ stage: 'card', by: 'player', opId: 'e1' }]), ownerId: OWNER, agentId: AGENT, createdAt: at('20:00'), situationId: 'stalled', source: { battleId: B, etDate: D2, symbol: 'ACN' }, questionId: 'stalled.want', note: 'A note.', version: 1 };
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [c] } }} card={c} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
    await m.flush(2);
    const line = m.q('[data-chain-line="filed"]');
    expect(line.textContent).toBe('Filed · time not recorded');
    expect(line.querySelector('[data-time]')).toBeNull();
  });
});

// ── Amendment A CA-3 — a declined or expired nomination closes the card: "Not taken" ───────────────────────────────
describe('Amendment A CA-3 — My cards: a nominated card the agent did not take is listed under "Not taken", once', () => {
  const move = (entryId, to, payload, clock) => applyServerTransition(state.db, { entryId, ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId: `s_${to}_${clock.replace(/\D/g, '')}`, nowIso: `${D2}T${clock}:00.000Z` });
  const group = (g) => m.qa(`[data-my-cards-group="${g}"] [data-my-card]`).map((b) => b.getAttribute('data-my-card'));

  for (const state of ['declined', 'expired']) {
    it(`a ${state} Offer card: under Not taken alone (never Active, never Parked), its receipt says it is kept and no longer open, no Retire; the open count drops (the mutant: a not-taken card listed under Parked)`, async () => {
      openBook();
      await open();
      m.click(m.buttons('Take this home')[0]);
      await m.flush();
      await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
      await move('op_1', 'nomination', { bookId: BOOK_ID, nominationId: 'op_1', state, reason: state === 'declined' ? 'Not for this book.' : null, consideredAt: `${D2}T20:10:00.000Z` }, '20:15');
      m.teardown(); m.setup(); globalThis.localStorage.clear();
      await open();
      expect(group('notTaken')).toEqual(['op_1']);
      expect(m.q('[data-my-cards-group="notTaken"]').textContent).toContain('Not taken');
      for (const g of ['active', 'parked', 'equipped', 'retired', 'other', 'shelved']) expect(group(g), g).toEqual([]);
      expect(m.qa('[data-my-card="op_1"]')).toHaveLength(1);
      m.click(m.q('[data-my-card="op_1"]'));
      await m.flush();
      const r = m.q('[data-card-receipt="op_1"]');
      expect(r.querySelector('[data-card-next]').textContent).toBe('Not taken: kept, no longer counted as open.');
      expect(m.buttons('Retire')).toHaveLength(0);
      // the form's open count, from the counter: nothing open
      m.click(m.buttons('Take this home')[0]);
      await m.flush();
      expect(Number(m.q('[data-open-count] [data-num-aggregate="count(plays[] open)"]').getAttribute('data-agg-value'))).toBe(0);
      await sweepAll(fx.tape2, `not taken ${state}`);
    });
  }

  it('shelving keeps its precedence: a not-taken card under another archetype is Shelved, not Not taken', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    await move('op_1', 'nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'declined', reason: 'No.', consideredAt: `${D2}T20:10:00.000Z` }, '20:15');
    t.store.set(`agents/${AGENT}`, { ...t.store.get(`agents/${AGENT}`), archetype: 'guardian' });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(group('shelved')).toEqual(['op_1']);
    expect(group('notTaken')).toEqual([]);
  });

  it('groupCards (pure): every stage × parked × shelved, and nominated × every copy state — each card in exactly one list', () => {
    const cards = [];
    for (const stage of ['card', 'nominated', 'testing', 'tested', 'installed', 'retired', 'drilled']) {
      for (const parkedAt of [undefined, '2026-09-25T21:00:00.000Z']) {
        for (const shelved of [false, true]) {
          const states = stage === 'nominated' ? [undefined, 'queued', 'considered', 'accepted', 'deferred', 'declined', 'expired', 'withdrawn'] : [undefined];
          for (const s of states) cards.push({ entryId: `${stage}:${parkedAt ? 'p' : 'u'}:${shelved ? 's' : 'a'}:${s ?? '-'}`, stage, parkedAt, shelved, ...(s ? { nomination: { state: s } } : {}) });
        }
      }
    }
    const g = groupCards(cards);
    const all = Object.values(g).flat();
    expect(all).toHaveLength(cards.length);
    expect(new Set(all.map((c) => c.entryId)).size).toBe(cards.length);
    expect(g.notTaken.map((c) => c.entryId).sort()).toEqual([
      'nominated:p:a:declined', 'nominated:p:a:expired', 'nominated:p:a:withdrawn', 'nominated:u:a:declined', 'nominated:u:a:expired', 'nominated:u:a:withdrawn',
    ]);
    expect(g.parked.map((c) => c.entryId)).toEqual(['tested:p:a:-']);
    expect(g.active.every((c) => !c.shelved)).toBe(true);
    expect(g.active.some((c) => c.stage === 'nominated' && ['declined', 'expired', 'withdrawn'].includes(c.nomination?.state))).toBe(false);
    expect(g.shelved.every((c) => c.stage !== 'retired')).toBe(true);
  });
});

// ── Amendment A CA-1, CA-2, CA-5 — the receipt's Retire, and a withdrawn card's line ───────────────────────────────
describe('Amendment A CA-1 / CA-2 / CA-5 — Retire shows where the player may retire; a withdrawal says so', () => {
  const at = (hm) => `${D2}T${hm}:00.000Z`;
  const base = (over = {}) => ({
    entryId: 'e1', ownerId: OWNER, agentId: AGENT, createdAt: at('20:00'), archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
    source: { battleId: B, etDate: D2, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: 1, note: 'A note.', route: 'offer',
    stage: 'card', stageAt: at('20:00'), stageHistory: [{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }], version: 1, ...over,
  });
  const retireShown = async (card) => {
    m.teardown(); m.setup();
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [card] } }} card={card} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} onPark={async () => ({ ok: true })} />);
    await m.flush(2);
    return m.buttons('Retire').length === 1;
  };

  it('the receipt reads isRetirableByPlayer: Retire on a card, a nominated card queued / considered / deferred or with no copy (v1); never on testing (CA-1), an accepted nomination (CA-2), a not-taken one, or a result with an offer waiting (CA-5) — Park still shows there', async () => {
    const nom = (state) => base({ stage: 'nominated', nomination: { bookId: 'b', nominationId: 'e1', state } });
    expect(await retireShown(base())).toBe(true);
    for (const state of ['queued', 'considered', 'deferred']) expect(await retireShown(nom(state)), state).toBe(true);
    expect(await retireShown(base({ route: 'drill', stage: 'nominated' }))).toBe(true);
    for (const state of ['accepted', 'declined', 'expired']) expect(await retireShown(nom(state)), state).toBe(false);
    expect(await retireShown(base({ stage: 'testing', idea: { bookId: 'b', ideaId: 'i' } }))).toBe(false);
    expect(await retireShown(base({ stage: 'tested', result: { ideaId: 'i', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' } }))).toBe(true);
    expect(await retireShown(base({ stage: 'tested', result: { ideaId: 'i', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' }, offer: { ideaId: 'i', offerId: 'o', state: 'offered' } }))).toBe(false);
    expect(m.buttons('Park this card')).toHaveLength(1);
  });

  it('through the real handler: an Offer card retired while its record is queued — the record withdrawn, the chain\'s newest line "Withdrawn and retired · {time}", the card under Retired', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    expect(t.store.get(`mandates/${BOOK_ID}/nominations/op_1`).state).toBe('queued');
    await atClock(`${D2}T20:30:00.000Z`, async () => {
      m.click(m.buttons('Retire')[0]);
      await m.flush(10);
    });
    expect(t.store.get(`mandates/${BOOK_ID}/nominations/op_1`)).toMatchObject({ state: 'withdrawn', withdrawnAt: `${D2}T20:30:00.000Z` });
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ stage: 'retired', nomination: { state: 'withdrawn' } });
    const r = m.q('[data-card-receipt="op_1"]');
    expect(r.querySelector('[data-chain-line]').textContent).toBe('Withdrawn and retired · 4:30 PM');
    expect(r.querySelector('[data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(m.qa('[data-my-cards-group="retired"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    await sweepAll(fx.tape2, 'withdrawn');
  });

  it('a Watch card retired (no nomination) still says "Retired", never "Withdrawn"; a server retire keeps its Forge offer line', () => {
    const watch = base({ route: 'watch', stage: 'retired', stageHistory: [{ stage: 'card', at: at('20:00'), by: 'player' }, { stage: 'retired', at: at('20:30'), by: 'player' }] });
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [watch] } }} card={watch} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
    expect(m.q('[data-chain-line="retired"]').textContent).toBe('Retired · 4:30 PM');
  });

  it('the refusal nomination_unavailable says its own words: nothing changed, try again', async () => {
    const card = base({ stage: 'nominated', nomination: { bookId: 'b', nominationId: 'e1', state: 'queued' } });
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [card] } }} card={card} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: false, code: 'nomination_unavailable' })} />);
    await m.flush(2);
    m.click(m.buttons('Retire')[0]);
    await m.flush(2);
    expect(m.q('[data-card-refusal]').textContent).toBe("This card's offer could not be checked. Nothing was changed. Try again.");
  });
});

// ── Amendment A CA-4 / CA-11 — the agent's words on the chain, each from its own source at its own time ───────────
describe('Amendment A CA-4 / CA-11 — the chain quotes each answer from its own row, and the closing note at its own time', () => {
  const move = (to, payload, clock, opId = `s_${to}_${clock.replace(/\D/g, '')}`) => applyServerTransition(state.db, { entryId: 'op_1', ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId, nowIso: `${D2}T${clock}:00.000Z` });
  const offerCard = async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
  };
  const reopen = async () => {
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
    return m.q('[data-card-receipt="op_1"]');
  };
  const quotesOf = (r) => [...r.querySelectorAll('[data-quotation="yourAgent"]')].map((q) => [q.closest('[data-chain-line]').getAttribute('data-chain-line'), q.querySelector('[data-quote-path]').textContent, q.querySelector('[data-quote-attribution]').textContent]);

  it('the tested line quotes the agent\'s closing note at closingNoteAt (4:52), never the delivery time (4:55); an accepted line with no thesis quotes nothing — never its reason', async () => {
    await offerCard();
    await move('nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'accepted', ideaId: 'idea-1', reason: 'Taking it.', consideredAt: `${D2}T20:40:00.000Z` }, '20:45');
    await move('testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    await move('tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'met', economicResult: 'ahead', closingNote: 'The stall resolved upward; holding paid this once.', closingNoteAt: `${D2}T20:52:00.000Z` }, '20:55');
    const r = await reopen();
    expect(quotesOf(r)).toEqual([['tested', 'The stall resolved upward; holding paid this once.', '— your agent · 4:52 PM']]);
    expect(r.querySelector('[data-quotation="yourAgent"] [data-quote-path]').getAttribute('data-quote-path')).toBe('cards.op_1.result.closingNote');
    expect(r.textContent).not.toContain('Taking it.');
    await sweepAll(fx.tape2, 'closing note');
  });

  it('a deferral, then a decline: each line quotes its OWN reason at its own consideredAt — the later answer never rewrites the earlier one', async () => {
    await offerCard();
    await move('nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'deferred', reason: 'Later, the book is full.', consideredAt: `${D2}T20:05:00.000Z` }, '20:10');
    await move('nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'declined', reason: 'Not a fit for this archetype.', consideredAt: `${D2}T20:25:00.000Z` }, '20:30');
    const r = await reopen();
    expect(quotesOf(r)).toEqual([
      ['nomination', 'Not a fit for this archetype.', '— your agent · 4:25 PM'],
      ['nomination', 'Later, the book is full.', '— your agent · 4:05 PM'],
    ]);
    await sweepAll(fx.tape2, 'two answers');
  });
});

// ── Amendment A CA-5 and CA-22 — the chain's offer line and the no-fill line, from the ledger's own writes ───────────
describe('Amendment A CA-5 / CA-22 — "An offer waits in the Forge" and "Ended before its first trade", through the real helper', () => {
  const move = (to, payload, clock, opId = `s_${to}_${clock.replace(/\D/g, '')}`) => applyServerTransition(state.db, { entryId: 'op_1', ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId, nowIso: `${D2}T${clock}:00.000Z` });
  const offerCard = async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    await move('nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'accepted', ideaId: 'idea-1', consideredAt: `${D2}T20:40:00.000Z`, thesis: 'One more check pays.' }, '20:45');
  };
  const reopen = async () => {
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q('[data-my-card="op_1"]'));
    await m.flush();
    return m.q('[data-card-receipt="op_1"]');
  };
  const kinds = (r) => [...r.querySelectorAll('[data-chain-line]')].map((l) => l.getAttribute('data-chain-line'));
  const firstLine = (r) => r.querySelector('[data-chain-line]').querySelector('span').textContent;

  it('tested → offered → parked → installed: one Tested line; the waiting offer dated at its own row, parked or not, never a second "Tested"; no Retire while it waits, Park still there; once installed, "Equipped" and no waiting line (the mutant: offered drawn as a second Tested)', async () => {
    await offerCard();
    await move('testing', { bookId: BOOK_ID, ideaId: 'idea-1' }, '20:50');
    await move('tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'met', economicResult: 'ahead' }, '20:55');
    await move('offered', { ideaId: 'idea-1', offerId: 'offer-1', state: 'offered' }, '21:00');
    let r = await reopen();
    expect(kinds(r)).toEqual(['offerWaits', 'tested', 'testing', 'nomination', 'offered', 'filed']);
    expect(firstLine(r)).toBe('An offer waits in the Forge · 5:00 PM');
    expect([...r.querySelectorAll('[data-chain-line="tested"]')]).toHaveLength(1);
    expect(r.querySelector('[data-chain-line="tested"] span').textContent).toBe('Tested · 4:55 PM · contract condition met · economic result ahead');
    expect(m.buttons('Retire')).toHaveLength(0);
    expect(m.buttons('Park this card')).toHaveLength(1);
    await sweepAll(fx.tape2, 'offer waits');
    m.click(m.buttons('Park this card')[0]);
    await m.flush(10);
    r = m.q('[data-card-receipt="op_1"]');
    expect(kinds(r)).toEqual(['parked', 'offerWaits', 'tested', 'testing', 'nomination', 'offered', 'filed']);
    await move('installed', { ideaId: 'idea-1', offerId: 'offer-1', state: 'accepted' }, '21:10');
    r = await reopen();
    expect(kinds(r)).toEqual(['installed', 'parked', 'tested', 'testing', 'nomination', 'offered', 'filed']);
    expect(firstLine(r)).toBe('Equipped · 5:10 PM');
    expect(r.textContent).not.toContain('An offer waits');
    await sweepAll(fx.tape2, 'installed after offer');
  });

  it('an accepted idea that ended before any fill: "Ended before its first trade · {time}" with the result\'s own words and the closing note quoted at its time — no Testing line, never "Tested"; Since last time says the same', async () => {
    await offerCard();
    await move('tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'unobserved', economicResult: 'unmeasurable', noFill: true, closingNote: 'Never reached an entry price.', closingNoteAt: `${D2}T20:52:00.000Z` }, '20:55');
    const r = await reopen();
    expect(kinds(r)).toEqual(['tested', 'nomination', 'offered', 'filed']);
    expect(firstLine(r)).toBe('Ended before its first trade · 4:55 PM · contract condition unobserved · economic result unmeasurable');
    expect(r.textContent).not.toMatch(/Tested ·|Testing ·/);
    const quote = r.querySelector('[data-chain-line="tested"] [data-quotation="yourAgent"]');
    expect(quote.querySelector('[data-quote-path]').textContent).toBe('Never reached an entry price.');
    expect(quote.querySelector('[data-quote-attribution]').textContent).toBe('— your agent · 4:52 PM');
    expect(m.q('[data-latest-line="op_1"]').textContent).toContain('Ended before its first trade · 4:55 PM');
    await sweepAll(fx.tape2, 'ended before first trade');
  });

  it('read from the ONE stored fact (the result\'s noFill), never from a missing testing row (the mutant): a tested row with no testing row before it but no flag says "Tested"; the chain line and the stage word agree whichever flag a split record carries (§2 review B3)', async () => {
    const at = (hm) => `${D2}T${hm}:00.000Z`;
    const card = {
      entryId: 'e1', route: 'offer', stage: 'tested', result: { ideaId: 'i', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' },
      stageHistory: [{ stage: 'nominated', at: at('20:00'), by: 'player' }, { stage: 'nominated', event: 'nomination', state: 'accepted', at: at('20:10'), by: 'server' }, { stage: 'tested', at: at('20:30'), by: 'server' }],
    };
    expect(chainOf(card)[0]).toEqual({ kind: 'tested', at: at('20:30'), k: 2, by: 'server' });
    // the result's stored fact draws it, on the chain and the stage word alike
    expect(chainOf({ ...card, result: { ...card.result, noFill: true } })[0]).toMatchObject({ kind: 'tested', noFill: true });
    // a row flag alone (a split record no writer leaves) draws nothing different from the stage word: both say tested
    const rowOnly = { ...card, stageHistory: [...card.stageHistory.slice(0, 2), { stage: 'tested', at: at('20:30'), by: 'server', noFill: true }] };
    expect(chainOf(rowOnly)[0]).not.toHaveProperty('noFill');
    const said = async (c) => {
      m.teardown(); m.setup();
      const full = { ...c, ownerId: OWNER, agentId: AGENT, createdAt: at('20:00'), situationId: 'stalled', source: { battleId: B, etDate: D2, symbol: 'ACN' }, questionId: 'stalled.want', note: 'A note.', version: 3 };
      m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [full] } }} card={full} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
      await m.flush(2);
      const r = m.q('[data-card-receipt]');
      return [r.querySelector('[data-chain-line="tested"] span').textContent.split(' · ')[0], /Stage · ([a-z ]+)/.exec(r.textContent)[1]];
    };
    expect(await said({ ...card, result: { ...card.result, noFill: true } })).toEqual(['Ended before its first trade', 'ended before its first trade']);
    expect(await said(rowOnly)).toEqual(['Tested', 'tested']);
  });
});

// ── Amendment A CA-9 and CA-17 — `considered` in its own words; one label reader for the stage word ───────────────
describe('Amendment A CA-9 / CA-17 — the words: "Your agent considered this", and one stage word wherever a stage is named', () => {
  const move = (entryId, to, payload, clock) => applyServerTransition(state.db, { entryId, ownerId: OWNER, agentId: AGENT, to, by: 'practice_field', payload, opId: `s_${to}_${clock.replace(/\D/g, '')}`, nowIso: `${D2}T${clock}:00.000Z` });
  const reopen = async (id) => {
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    m.click(m.q(`[data-my-card="${id}"]`));
    await m.flush();
    return m.q(`[data-card-receipt="${id}"]`);
  };

  it('CA-9: a real considered copy with a reason reads "Your agent considered this · {time}" with no quotation, on the receipt and in Since last time; a deferral after it still quotes its reason', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    await move('op_1', 'nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'considered', reason: 'Looking at the book first.', consideredAt: `${D2}T20:05:00.000Z` }, '20:10');
    let r = await reopen('op_1');
    expect(r.querySelector('[data-chain-line="nomination"] span').textContent).toBe('Your agent considered this · 4:10 PM');
    expect(r.querySelector('[data-quotation="yourAgent"]')).toBeNull();
    expect(r.textContent).not.toContain('Looking at the book first.');
    expect(m.q('[data-latest-line="op_1"]').textContent).toContain('Your agent considered this · 4:10 PM');
    await sweepAll(fx.tape2, 'considered');
    await move('op_1', 'nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'deferred', reason: 'Next week.', consideredAt: `${D2}T20:20:00.000Z` }, '20:25');
    r = await reopen('op_1');
    expect([...r.querySelectorAll('[data-quotation="yourAgent"] [data-quote-path]')].map((q) => q.textContent)).toEqual(['Next week.']);
  });

  it('CA-17: a v1 WATCH card and a v1 SET card nominated through the real writer stay v1 and read "offered to your agent" on the route line and in My cards (the mutant: a v1 Watch card\'s nomination drawn as "nominated for the Practice Field"); a v1 drill entry keeps "nominated for the Practice Field" everywhere', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const doc = t.store.get(`agents/${AGENT}/plays/op_1`);
    const v1 = (id, route) => { const e = { ...doc, entryId: id, opId: id, route, note: `A v1 ${route} card.`, createdAt: `${D2}T19:0${id.length % 10}:00.000Z`, stageHistory: [{ ...doc.stageHistory[0], opId: id }] }; delete e.stageVocabVersion; t.store.set(`agents/${AGENT}/plays/${id}`, e); };
    v1('v1w', 'watch');
    v1('v1set', 'set');
    v1('v1drill', 'drill');
    t.store.set(`agents/${AGENT}/plays/v1drill`, { ...t.store.get(`agents/${AGENT}/plays/v1drill`), stage: 'nominated', stageHistory: [{ stage: 'nominated', at: `${D2}T19:00:00.000Z`, by: 'player', opId: 'v1drill' }] });
    for (const id of ['v1w', 'v1set']) {
      const res = await api.postCard({ op: 'nominate', opId: `n_${id}`, agentId: AGENT, entryId: id, expectedVersion: 1 });
      expect(res.status, id).toBe(200);
      expect('stageVocabVersion' in t.store.get(`agents/${AGENT}/plays/${id}`), id).toBe(false);
    }
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.q('[data-my-card="v1w"]').textContent).toContain('Watch · offered to your agent');
    expect(m.q('[data-my-card="v1set"]').textContent).toContain('Set · offered to your agent');
    expect(m.q('[data-my-card="v1drill"]').textContent).toContain('Offer · nominated for the Practice Field');
    m.click(m.q('[data-my-card="v1w"]'));
    await m.flush();
    expect(m.q('[data-card-receipt="v1w"]').textContent).toContain('Route · Watch · Stage · offered to your agent');
    expect(m.q('[data-card-receipt="v1w"] [data-chain-line]').getAttribute('data-chain-line')).toBe('offered');
    expect(m.q('[data-card-receipt="v1w"]').textContent).not.toContain('Practice Field');
    m.click(m.q('[data-my-card="v1drill"]'));
    await m.flush();
    const drill = m.q('[data-card-receipt="v1drill"]');
    expect(drill.textContent).toContain('Route · Offer · Stage · nominated for the Practice Field');
    expect(drill.querySelector('[data-chain-line="stage"]').textContent).toBe('nominated for the Practice Field · 3:00 PM');
    expect(m.q('[data-latest-line="v1drill"]').textContent).toContain('nominated for the Practice Field');
    await sweepAll(fx.tape2, 'v1 labels');
  });

  it('CA-17 / CA-22: one reader everywhere — a tested card whose idea ended before any fill reads "ended before its first trade" on the route line and in My cards (and its chain line says so); a normal tested card reads "tested"', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'offer', question: 'stalled.ready' });
    await move('op_1', 'nomination', { bookId: BOOK_ID, nominationId: 'op_1', state: 'accepted', ideaId: 'idea-1', consideredAt: `${D2}T20:40:00.000Z` }, '20:45');
    await move('op_1', 'tested', { ideaId: 'idea-1', resultRef: 'r1', contractCondition: 'unobserved', economicResult: 'unmeasurable', noFill: true }, '20:55');
    const r = await reopen('op_1');
    expect(r.textContent).toContain('Route · Offer · Stage · ended before its first trade');
    expect(m.q('[data-my-card="op_1"]').textContent).toContain('Offer · ended before its first trade');
    expect(r.textContent).not.toMatch(/Stage · tested|Tested ·/);
    const card = t.store.get(`agents/${AGENT}/plays/op_1`);
    m.teardown(); m.setup();
    const normal = { ...card, result: { ...card.result, noFill: undefined } };
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [normal] } }} card={normal} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
    await m.flush(2);
    expect(m.q('[data-card-receipt]').textContent).toContain('Stage · tested');
  });
});

// ── Amendment A CA-7 — the receipt's "Offer to your agent" ────────────────────────────────────────────────────────
describe('Amendment A CA-7 — "Offer to your agent" on a card-stage receipt, only while the owner\'s book is open', () => {
  const at = (hm) => `${D2}T${hm}:00.000Z`;
  const base = (over = {}) => ({
    entryId: 'e1', ownerId: OWNER, agentId: AGENT, createdAt: at('20:00'), archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, stageVocabVersion: 2,
    source: { battleId: B, etDate: D2, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: 1, note: 'A note.', route: 'watch',
    stage: 'card', stageAt: at('20:00'), stageHistory: [{ stage: 'card', at: at('20:00'), by: 'player', opId: 'e1' }], version: 1, ...over,
  });
  const shown = async (card, counter) => {
    m.teardown(); m.setup();
    // the card as the counter holds it (its computed shelving with it), where the counter has answered
    const held = counter.data ? { ...counter, data: { ...counter.data, cards: [card] } } : counter;
    m.render(<Receipt day={D2} counter={held} card={card} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} onPark={async () => ({ ok: true })} onNominate={async () => ({ ok: true })} />);
    await m.flush(2);
    return m.buttons('Offer to your agent').length === 1;
  };

  it('THE MATRIX: shown only for a card at card, not shelved, while the counter says book.open === true — never while it loads, after a failed first read, with the field missing, false, or a truthy non-true (the mutant: the Offer button shown with book missing or still loading)', async () => {
    const ready = (book) => ({ status: 'ready', data: { cards: [], open: 0, cap: 5, ...(book === undefined ? {} : { book }) } });
    const counters = [
      ['loading', { status: 'loading', data: null }, false], ['idle', { status: 'idle', data: null }, false], ['failed first read', { status: 'error', data: null }, false],
      ['no book field', ready(undefined), false], ['book {}', ready({}), false], ['open false', ready({ open: false }), false], ['open "true"', ready({ open: 'true' }), false],
      ['open true', ready({ open: true }), true], ['open true kept through a failed re-read', { status: 'error', data: ready({ open: true }).data }, true],
    ];
    for (const [name, counter, want] of counters) expect(await shown(base(), counter), name).toBe(want);
    const open = ready({ open: true });
    const v1 = base();
    delete v1.stageVocabVersion;
    for (const [name, card, want] of [
      ['a v2 Watch card', base(), true], ['a v1 Watch card', v1, true], ['a Set card', base({ route: 'set' }), true],
      ['a shelved card', base({ shelved: true }), false], ['a nominated card', base({ stage: 'nominated', route: 'offer', nomination: { bookId: 'b', nominationId: 'e1', state: 'queued' } }), false],
      ['a tested card', base({ stage: 'tested', result: { ideaId: 'i', resultRef: 'r', contractCondition: 'met', economicResult: 'ahead' } }), false], ['a retired card', base({ stage: 'retired' }), false],
    ]) expect(await shown(card, open), name).toBe(want);
    // with it, Offer's route note sits above the button
    await shown(base(), open);
    const note = m.q('[data-offer-note]');
    expect(note.textContent).toBe(RG5.offer);
    expect(note.compareDocumentPosition(m.buttons('Offer to your agent')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('through the real handler: one tap sends ONE nominate under the receipt\'s own op id (never the retire\'s), the card moves to nominated — "Offered to your agent" — and the button goes', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const receipt = m.q('[data-card-receipt="op_1"]');
    const retireOp = receipt.getAttribute('data-card-op');
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(10);
    const bodies = cardBodies().filter((b) => b.op === 'nominate');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({ op: 'nominate', opId: expect.any(String), agentId: AGENT, entryId: 'op_1', expectedVersion: 1 });
    expect(bodies[0].opId).not.toBe(retireOp);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ stage: 'nominated', nomination: { state: 'queued' } });
    const r = m.q('[data-card-receipt="op_1"]');
    expect(r.querySelector('[data-chain-line]').getAttribute('data-chain-line')).toBe('offered');
    expect(r.textContent).toContain('Stage · offered to your agent');
    expect(m.buttons('Offer to your agent')).toHaveLength(0);
    await sweepAll(fx.tape2, 'offered from the receipt');
  });

  it('a lost answer re-tapped sends the SAME op id, and the store answers once (the mutant: two taps minting two ids)', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const real = api.postCard;
    let lose = true;
    api.postCard = async (body) => { if (body.op === 'nominate' && lose) { lose = false; await real(body); return { ok: false, status: 0, body: null }; } return real(body); };
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(10);
    expect(m.q('[data-card-refusal]').textContent).toBe('The card could not be offered.');
    // the answer was lost after the store committed: the re-read shows the card nominated, so the button is gone; the
    // receipt kept its op id — a re-tap from a receipt still showing the card (as before the refresh) would send it
    const sent = api.calls.filter((c) => c[0] === 'card' && c[1].op === 'nominate').map((c) => c[1].opId);
    expect(sent).toHaveLength(1);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).stage).toBe('nominated');
    // a receipt over a stale counter that still shows the card: two taps, one id, one nomination
    const card = { ...t.store.get(`agents/${AGENT}/plays/op_1`), stage: 'card', version: 1, stageHistory: t.store.get(`agents/${AGENT}/plays/op_1`).stageHistory.slice(0, 1) };
    delete card.nomination;
    const ids = [];
    m.teardown(); m.setup();
    let n = 0;
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [card], book: { open: true } } }} card={card} mintOpId={() => `op_m${(n += 1)}`} onRetire={async () => ({ ok: true })} onNominate={async (_c, opId) => { ids.push(opId); return { ok: false, code: 'nominateDefault' }; }} />);
    await m.flush(2);
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(2);
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(2);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).not.toBe(m.q('[data-card-receipt]').getAttribute('data-card-op'));
  });

  it('a refusal re-reads the counter and says why: the book closed since the counter answered → its words, never "filed"; the re-read hides the button', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    t.store.set(`mandates/${BOOK_ID}`, { ...t.store.get(`mandates/${BOOK_ID}`), status: 'closed' });
    setPracticeFieldSeam({ bookForOwner: async () => ({ bookId: BOOK_ID, status: 'closed' }) });
    const reads = counterCalls();
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(10);
    expect(m.q('[data-card-refusal]').textContent).toBe('This card cannot be offered to your agent now. Nothing was offered.');
    expect(counterCalls()).toBe(reads + 1);
    expect(m.buttons('Offer to your agent')).toHaveLength(0);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).stage).toBe('card');
  });

  it('every refusal\'s words: each source refusal one sentence; tape, attribution, book, calendar their own; any other code the receipt\'s existing words; the default its own — and none says "Nothing was filed" or "could not be filed"', async () => {
    const said = async (code) => {
      m.teardown(); m.setup();
      const card = base();
      m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [card], book: { open: true } } }} card={card} mintOpId={() => 'op_x'} onRetire={async () => ({ ok: true })} onNominate={async () => ({ ok: false, code })} />);
      await m.flush(2);
      m.click(m.buttons('Offer to your agent')[0]);
      await m.flush(2);
      return m.q('[data-card-refusal]').textContent;
    };
    const SOURCE = "This card's moment has changed on the tape since it was filed, so it can't be offered. The card stays as it is.";
    for (const code of ['moment_not_found', 'source_changed', 'tags_unavailable', 'tape_not_found', 'archetype_changed', 'archetype_unknown']) expect(await said(code), code).toBe(SOURCE);
    expect(await said('tape_unreadable')).toBe('The tape for this day could not be read. Nothing was offered. Try again.');
    expect(await said('attribution_unavailable')).toBe('The agent this card belongs to could not be resolved. Nothing was offered. Try again.');
    expect(await said('book_not_open')).toBe('This card cannot be offered to your agent now. Nothing was offered.');
    expect(await said('calendar_unavailable')).toBe("The offer's expiry could not be placed on the market calendar. Nothing was offered.");
    expect(await said('version_conflict')).toBe(COPY_CARDS.refusals.version_conflict);
    expect(await said('illegal_transition')).toBe(COPY_CARDS.refusals.illegal_transition);
    for (const code of ['server_error', 'nominateDefault', 'default', undefined]) expect(await said(code), String(code)).toBe('The card could not be offered.');
    const all = [...Object.values(COPY_CARDS.offerRefusals)];
    expect(all.filter((w) => /Nothing was filed|could not be filed|cannot be filed/.test(w))).toEqual([]);
  });

  it('a successful offer whose counter refresh then fails keeps the nominated card on the receipt (RI-2), the read error said beside it', async () => {
    openBook();
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    const realRead = api.readCounter;
    api.readCounter = async () => ({ ok: false, status: 503, body: null });
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(10);
    expect(m.q('[data-card-receipt="op_1"]').textContent).toContain('Stage · offered to your agent');
    expect(m.q('[data-cards-read-error]')).toBeTruthy();
    api.readCounter = realRead;
  });

  it('cards off: no receipt, no Offer button, no request', async () => {
    state.cards = 'off';
    openBook();
    await open();
    expect(m.buttons('Offer to your agent')).toHaveLength(0);
    expect(m.q('[data-offer-note]')).toBeNull();
    expect(api.calls).toEqual([]);
  });
});

// ── the fix round's §2 review (report §9.7): the create row by the stored route; no player line from a server row ──
describe('C1 fix round §2 review — the chain\'s create row is the stored route\'s; a server row never draws the player\'s line', () => {
  const at = (hm) => `${D2}T${hm}:00.000Z`;
  const card = (stageHistory, over = {}) => ({ entryId: 'e1', route: 'watch', stage: 'nominated', stageHistory, ...over });

  it('B1: a WATCH or SET card\'s player `nominated` row at index zero is its nominate op, never its filing — no "Filed" line (Astra\'s F3 contradiction through another first row)', () => {
    for (const route of ['watch', 'set']) {
      expect(chainOf(card([{ stage: 'nominated', by: 'player', at: at('17:00'), opId: 'n1' }], { route })).map((l) => l.kind), route).toEqual(['offered']);
    }
    // kept: the Offer route and a v1 drill entry are filed at nominated; Watch and Set at card
    expect(chainOf(card([{ stage: 'nominated', by: 'player', at: at('17:00'), opId: 'e1' }], { route: 'offer' })).map((l) => l.kind)).toEqual(['offered', 'filed']);
    expect(chainOf(card([{ stage: 'nominated', by: 'player', at: at('17:00'), opId: 'e1' }], { route: 'drill' })).map((l) => l.kind)).toEqual(['stage', 'filed']);
    expect(chainOf(card([{ stage: 'card', by: 'player', at: at('17:00'), opId: 'e1' }], { route: 'set', stage: 'card' })).map((l) => l.kind)).toEqual(['filed']);
    // an Offer card's first row at `card` is no create (an Offer is filed at nominated), and an unknown route files nothing
    expect(chainOf(card([{ stage: 'card', by: 'player', at: at('17:00'), opId: 'e1' }], { route: 'offer', stage: 'card' }))).toEqual([]);
    expect(chainOf(card([{ stage: 'card', by: 'player', at: at('17:00'), opId: 'e1' }], { route: 'practice', stage: 'card' }))).toEqual([]);
  });

  it('B1 on the receipt: a Watch card filed at 16:00Z whose first row became its nominate row at 17:00Z draws no "Filed · 1:00 PM" beside a note credited 12:00 PM', async () => {
    const c = { ...card([{ stage: 'nominated', by: 'player', at: '2026-09-25T17:00:00.000Z', opId: 'n1' }]), ownerId: OWNER, agentId: AGENT, createdAt: '2026-09-25T16:00:00.000Z', situationId: 'stalled', source: { battleId: B, etDate: D2, symbol: 'ACN' }, questionId: 'stalled.want', note: 'A note.', nomination: { bookId: 'b', nominationId: 'n1', state: 'queued' }, version: 2 };
    m.render(<Receipt day={D2} counter={{ status: 'ready', data: { cards: [c] } }} card={c} mintOpId={() => 'op_r'} onRetire={async () => ({ ok: true })} />);
    await m.flush(2);
    const r = m.q('[data-card-receipt]');
    expect(r.textContent).not.toContain('Filed');
    expect(r.querySelector('[data-quotation="you"] [data-quote-attribution]').textContent).toContain('12:00 PM');
  });

  it('B2: a SERVER row at nominated with no event draws no "Offered to your agent" — that line is the player\'s nominate alone; nor does it reach the latest list', () => {
    const c = card([{ stage: 'nominated', by: 'server', writer: 'practice_field', at: at('17:00') }], { route: 'offer' });
    expect(chainOf(c)).toEqual([]);
    expect(latestOf([c])).toEqual([]);
    expect(chainOf(card([{ stage: 'card', by: 'player', at: at('16:00') }, { stage: 'nominated', by: 'server', at: at('17:00') }])).map((l) => l.kind)).toEqual(['filed']);
  });
});

describe('C1 fix round §2 review A2 — a casual clone\'s offer names the parent the card is filed under', () => {
  it('on a clone\'s battle the receipt\'s offer sends the card\'s own agent (the ranked parent), so its lost answer re-tapped after the clone\'s document is gone is still its own replay (the 200), where a clone-named re-tap could no longer be resolved', async () => {
    const CLONE = `casual-agent-${OWNER}`;
    t.store.set(`agents/${CLONE}`, { ownerId: OWNER, name: 'Aurora (casual)', archetype: 'momentum_chaser', rankedAgentId: AGENT });
    t.store.set(`agentBattles/${B}`, { ...fx.battle, agentId: CLONE });
    t.store.set(`agentBattles/${B}/tape/${D2}`, { ...fx.tape2, agentId: CLONE });
    openBook();
    await open({ battle: battleOf({ agentId: CLONE }), tapes: { [D1]: { ...fx.tape1, agentId: CLONE }, [D2]: { ...fx.tape2, agentId: CLONE } } });
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard();
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ agentId: AGENT, stage: 'card' });
    m.click(m.buttons('Offer to your agent')[0]);
    await m.flush(10);
    const sent = cardBodies().filter((b) => b.op === 'nominate');
    expect(sent).toHaveLength(1);
    expect(sent[0].agentId).toBe(AGENT);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).stage).toBe('nominated');
    // the clone's document gone: the same request (a lost answer re-tapped) is still the idempotent answer
    t.store.delete(`agents/${CLONE}`);
    const again = await api.postCard(sent[0]);
    expect(again).toMatchObject({ ok: true, status: 200, body: { idempotent: true } });
    // where the clone-named request could no longer be resolved
    expect(await api.postCard({ ...sent[0], agentId: CLONE })).toMatchObject({ ok: false, status: 503, body: { error: 'attribution_unavailable' } });
  });
});
