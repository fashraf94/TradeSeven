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
//                    (RG-4); My cards active · shelved · retired, shelving
//                    explained (acceptance D on the screen)
//   the sweeps       numbers and their classes, words, signs, quotations,
//                    stored notes, the agent's name — clean at every depth
//                    with every region open
// Dependency-surface guard (BUILD_RULES §4): the real passes, store, handler
// and counter; only the flags, the security and auth middleware and the Admin
// handle are doubled.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';

const state = vi.hoisted(() => ({ cards: 'on', db: null, uid: 'owner-1' }));
vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return state.cards; },
  get FILM_TAPE_WRITE_ENABLED() { return true; },
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
import cardHandler from '../../../api/film-room/card.js';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { momentsOf } from '../../utils/filmRoomMoments';
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
  drill: 'The Practice Field opens later; this keeps the moment for it.',
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
  fx = { store: Object.fromEntries([...t.store.entries()]), battle: d2.battle, tape1, tape2, recomputed, recomputedBattle: r1.battle };
});

const m = mounter();
const mkRes = () => ({ statusCode: null, body: null, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
/** The screen's API seam, routed through the real handler and the real counter over the fake handle. */
const apiOf = () => ({
  calls: [],
  readVerdict: async () => true,
  readCounter: async (agentId) => { const body = await buildCounter(state.db, { uid: state.uid, agentId, nowMs: Date.parse('2026-09-26T00:00:00.000Z') }); return { ok: !body.error, status: body.error ? 400 : 200, body }; },
  postCard: async (body) => { const res = mkRes(); await cardHandler({ method: 'POST', headers: {}, body }, res); return { ok: res.statusCode === 200, status: res.statusCode, body: res.body }; },
  newOpId: (() => { let n = 0; return () => `op_${(n += 1)}`; })(),
});
let t; let api; let lastBattle = null;
const battleOf = (over = {}) => ({ id: B, agentBattleId: B, ownerId: OWNER, agentId: AGENT, status: 'completed', completedAt: `${D2}T20:05:00.000Z`, timing: { tradingDays: [D1, D2] }, agentContext: { agentName: 'Momentum chaser', archetype: 'momentum_chaser' }, gameMode: 'baggerbomb_agent', ...over });
beforeEach(() => {
  state.cards = 'on'; state.uid = OWNER;
  t = makeTapeDb({ ...fx.store, [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' } });
  state.db = t.db;
  api = apiOf();
  globalThis.localStorage.clear();
  m.setup();
});
afterEach(() => { m.teardown(); vi.restoreAllMocks(); });

async function open({ battle = battleOf(), tapes = { [D1]: fx.tape1, [D2]: fx.tape2 }, series = [] } = {}) {
  lastBattle = battle;
  m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readersOf(tapes, series)} nowMs={NOW} cardsApi={api} />);
  await m.flush(8);
}
const depth = async (label) => { m.click(m.tab(label)); await m.flush(); };
const text = () => m.container.textContent;
const region = (name) => m.q(`[data-cards-region="${name}"]`);
const docsFor = (tape) => ({ tape, battle: lastBattle ?? battleOf(), ledger: { etDate: tape.etDate, cards: ledgerCards() } });
/** The ledger as the counter answers it now (the suite's own read of the fake, for the sweeps' oracle). */
let lastCounter = null;
async function ledgerRefresh() { lastCounter = await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: Date.parse('2026-09-26T00:00:00.000Z') }); }
const ledgerCards = () => (lastCounter ? lastCounter.cards : []);
const sweepAll = async (tape, where) => {
  await ledgerRefresh();
  const docs = docsFor(tape);
  expect(sweepNumbers(m.container, docs), where).toEqual([]);
  expect(sweepWords(m.container, docs), where).toEqual([]);
  expect(sweepSigns(m.container), where).toEqual([]);
  expect(quoteDefects(m.container, docs), where).toEqual([]);
  expect(storedNoteDefects(m.container, docs), where).toEqual([]);
  expect(agentNameDefects(m.container, docs), where).toEqual([]);
};
const setValue = (el, value) => { const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
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
    for (const r of ['watch', 'drill', 'set']) expect(m.q(`[data-route="${r}"]`).textContent).toContain(RG5[r]);
    expect(m.q('[data-route="set"]').querySelector('a')).toBeNull();
    expect(m.q('[data-route="set"]').textContent).toContain('this card links nowhere');
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
    expect(q.getAttribute('data-quote-path')).toBe('cards[0].note');
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
  it('Practice nominates (the stage says so); Set files a card with its words', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ note: 'Practice the exit.', route: 'drill', question: 'stalled.ready' });
    expect(m.q('[data-card-receipt]').textContent).toContain('Stage · nominated for the Practice Field');
    expect(m.q('[data-card-receipt]').textContent).toContain(RG5.drill);
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
    expect(m.q('[data-card-refusal]').textContent).toBe('The open-card cap for this agent is reached. Retire a card first.');
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
    // the card must be created AFTER day 1 and BEFORE day 2's moments: the fake clock is the handler's `new Date()`, so plant the creation time
    await fileCard({ note: 'Watch this.' });
    const created = t.store.get(`agents/${AGENT}/plays/op_1`);
    t.store.set(`agents/${AGENT}/plays/op_1`, { ...created, createdAt: `${D1}T23:00:00.000Z` });
    m.click(m.buttons('Take this home')[0]);   // any refresh: re-open the form, cancel it
    await m.flush();
    m.click(m.buttons('Cancel')[0]);
    await m.flush();
    // the counter is re-read on the next write; force one through a retire-less path: re-render by switching day and back
    m.click(m.qa('[data-region="day-picker"] button')[1]);
    await m.flush(8);
    await api.readCounter(AGENT);
    // mount fresh so the header reads the ledger with the planted creation time
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    const slt = region('since-last-time');
    const watch = slt.querySelector('[data-watch-card="op_1"]');
    expect(watch).toBeTruthy();
    expect(watch.textContent).toContain('Our stocks are not moving');
    const rows = [...watch.querySelectorAll('[data-recurrence-row]')];
    const want = momentsOf(fx.tape2.tags.items).filter((mm) => mm.situationId === 'stalled');
    expect(rows.length).toBe(want.length);
    const a = rows[0];
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe(`#film-room/${B}/${D2}/moment-${want[0].symbol}-${want[0].fromTickSeq}-${want[0].toTickSeq}`);
    expect(a.querySelector('[data-num-aggregate="count(tags.items[] in a moment)"]').getAttribute('data-num-class')).toBe('derived');
    expect(a.textContent).not.toMatch(/\$|%/);
    // this battle's day: opening switches the day (day 2 is already shown: go to day 1 first)
    m.click(m.qa('[data-region="day-picker"] button')[0]);
    await m.flush(8);
    const scrolled = [];
    Element.prototype.scrollIntoView = function sv() { scrolled.push(this.id); };
    m.click(region('since-last-time').querySelector('[data-recurrence-row]'));
    await m.flush(8);
    expect(m.q('[data-region="day-picker"] [aria-pressed="true"]').textContent).toContain('Sep 25');
    expect(scrolled).toContain(`moment-${want[0].symbol}-${want[0].fromTickSeq}-${want[0].toTickSeq}`);
    await sweepAll(fx.tape2, 'since last time');
  });
  it('another battle\'s recurrence is a plain link: the screen does not navigate (App wiring is not this build\'s)', async () => {
    await open();
    const r = { battleId: 'b-elsewhere', etDate: D2, situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 2, toTickSeq: 3, from: fx.tape2.checks[1].at, to: fx.tape2.checks[2].at, checks: 2 };
    const { recurrenceHref } = await import('./FilmRoomCardRegions');
    expect(recurrenceHref(r)).toBe('#film-room/b-elsewhere/2026-09-25/moment-MSFT-2-3');
  });
  it('no open Watch card: says so; a Practice card is not followed', async () => {
    await open();
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ route: 'drill', note: 'Practice it.' });
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
