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
import { retireCard, createCard } from '../../../api/_utils/filmRoom/cardStore.js';
import cardHandler from '../../../api/film-room/card.js';
import { SITUATION_QUESTIONS } from '../../data/situationQuestions';
import { momentsOf } from '../../utils/filmRoomMoments';
import { ledgerOf } from './filmRoomCards';
import { setRuleOf, setStateOf } from './FilmRoomCardRegions';
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
  // Amendment K RK-2: day 2 again, run with a tempo the player set (agentContext.dials) — the ranked agent's battle; the
  // fixture's own days record none (tags.inputs.tempoDesired null): the dial never set — as on every casual clone's battle, and on a ranked one whose owner never moved the dial (review KR2-1)
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
afterEach(() => { m.teardown(); vi.restoreAllMocks(); });

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
    for (const r of ['watch', 'drill', 'set']) expect(m.q(`[data-route="${r}"]`).textContent).toContain(RG5[r]);
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
    t.store.set(`agents/${AGENT}/plays/op_camp`, { ...doc, entryId: 'op_camp', opId: 'op_camp', stage: 'installed', note: 'A camp card.' });
    m.teardown(); m.setup(); globalThis.localStorage.clear();
    await open();
    expect(m.qa('[data-my-cards-group="active"] [data-my-card]').map((b) => b.getAttribute('data-my-card'))).toEqual(['op_1']);
    const other = m.q('[data-my-cards-group="other"] [data-my-card="op_camp"]');
    expect(other).toBeTruthy();
    expect([...other.querySelectorAll('[data-record-text]')].map((r) => r.textContent)).toContain('installed');
    m.click(other);
    await m.flush();
    const receipt = m.q('[data-card-receipt="op_camp"]');
    expect([...receipt.querySelectorAll('[data-record-text]')].map((r) => r.textContent)).toContain('installed');
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
  it('R3-1 — a retired Practice card: nothing happens next, not the Practice Field sentence', async () => {
    await open();
    m.click(m.buttons('Take this home')[0]);
    await m.flush();
    await fileCard({ route: 'drill', note: 'Practice the exit.', question: 'stalled.ready' });
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe(RG5.drill);
    m.click(m.buttons('Retire')[0]);
    await m.flush(10);
    expect(m.q('[data-card-receipt] [data-card-next]').textContent).toBe('Retired: nothing happens next.');
    expect(m.q('[data-card-receipt]').textContent).not.toContain(RG5.drill);
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
  const seedCard = (route) => createCard(state.db, {
    uid: OWNER, agentId: AGENT, opId: `seed_${route}`, nowIso: `${D1}T23:00:00.000Z`,
    payload: { archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: fx.tape1.tags.items[0].version, battleId: B, etDate: D1, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Watch this.', route },
  });
  const unreadable = (tape) => ({ ...tape, coverage: { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });

  it('Amendment K RK-10 — no open Watch card: no line, however many days could not be read — none filed, a Practice card, a retired Watch card (the mutant: the unavailable-day line with no open Watch card)', async () => {
    for (const [d, tape] of [[D1, fx.tape1], [D2, fx.tape2]]) t.store.set(`agentBattles/${B}/tape/${d}`, unreadable(tape));
    expect((await buildCounter(state.db, { uid: state.uid, agentId: AGENT, nowMs: COUNTER_NOW })).unavailableDays[AGENT]).toBe(2);
    await open();
    expect(region('since-last-time').textContent).toContain('No open Watch card.');
    expect(m.q('[data-unavailable-days]')).toBeNull();
    await seedCard('drill');
    m.teardown(); m.setup();
    await open();
    expect(m.q('[data-my-card="seed_drill"]')).toBeTruthy();
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
  const NO_TEMPO = 'You change the setting yourself; this card changes nothing. No tempo setting was recorded for this battle.';
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
   * Amendment L RL-1 — Set on a casual clone's battle (RK-1's fixture): the clone's document names the ranked agent as
   * its parent; the battle document and its tape days name the clone. The card files under the parent (RK-1), so the
   * card's own agentId — and the counter's attributionAgentId — is a RANKED agent: only the battle's own agent tells
   * the clone apart (review AL1-2: the counter's `agentId` is the agent it was asked about, the clone).
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

  it('Amendment L RL-1 — setStateOf: the link when the rule is on, the dial reaches the battle (its OWN agent is not a casual clone, or its tape records a tempo) and both Forge flags are on; each condition alone turns it off', () => {
    const day = (enabled, tempoDesired) => ({ tags: { inputs: { forcedRotation: enabled === undefined ? undefined : { enabled }, tempoDesired } } });
    const LINK = { say: null, link: true };
    const NONE = { say: null, link: false };
    const NO = { say: 'noTempo', link: false };
    // the ranked agent's battle: the dial reaches it, a tempo recorded or not
    for (const tempo of ['standard', null, undefined, '']) expect(setStateOf(day(true, tempo), AGENT), String(tempo)).toEqual(LINK);
    // a casual clone's battle: only where its tape records a tempo — RK-2's sentence otherwise
    expect(setStateOf(day(true, 'standard'), CLONE)).toEqual(LINK);
    for (const tempo of [null, undefined, '']) expect(setStateOf(day(true, tempo), CLONE), String(tempo)).toEqual(NO);   // review KRT-8: an empty tempo is none
    // an agent not known is not established as the ranked one: it links only on a recorded tempo
    for (const agent of [null, undefined, '', 7]) {
      expect(setStateOf(day(true, null), agent), String(agent)).toEqual(NO);
      expect(setStateOf(day(true, 'standard'), agent), String(agent)).toEqual(LINK);
    }
    // the rule off or unknown: no link for any agent, RJ-8's sentence said first (review KRT-2), tempo or not
    for (const agent of [AGENT, CLONE, null]) {
      for (const tempo of ['standard', null]) {
        expect(setStateOf(day(false, tempo), agent), `${agent} off ${tempo}`).toEqual({ say: 'ruleOff', link: false });
        expect(setStateOf(day(undefined, tempo), agent), `${agent} unknown ${tempo}`).toEqual(NONE);
      }
    }
    // either Forge flag off alone: no link, wherever the dial reaches
    for (const flag of ['characterTab', 'tempoDial']) {
      state.characterTab = flag !== 'characterTab'; state.tempoDial = flag !== 'tempoDial';
      for (const [tempo, agent] of [[null, AGENT], ['standard', AGENT], ['standard', CLONE]]) expect(setStateOf(day(true, tempo), agent), `${flag} ${agent} ${tempo}`).toEqual(NONE);
      expect(setStateOf(day(true, null), CLONE), flag).toEqual(NO);
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

  it('Amendment L RL-1 — the ranked agent\'s battle with no tempo recorded (the fixture\'s own day: the dial never set): the form says RG-5\'s sentence alone, no link; the receipt links (the mutant: the link withheld from a ranked battle with no tempo)', async () => {
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
    await sweepAll(fx.tape2, 'ranked, no tempo');
  });

  it('Amendment L RL-1 — a casual clone\'s battle with no tempo recorded: RK-2\'s sentence on the form and the receipt, and no link anywhere — though the card files under the RANKED parent (the mutants: the link shown on a clone with no tempo; RL-1 reading the resolved parent, the card\'s agentId or the counter\'s attributionAgentId, instead of the battle\'s own)', async () => {
    await setOnClone(fx.tape2, () => {}, { file: false });
    expect(formSet()).toBe(NO_TEMPO);
    // review KRT-3: Set's words are Set's alone — Watch and Practice keep RG-5's sentences
    expect(m.q('[data-route-note="watch"]').textContent).toBe(RG5.watch);
    expect(m.q('[data-route-note="drill"]').textContent).toBe(RG5.drill);
    expect(m.q('[data-set-link]')).toBeNull();
    await fileCard({ note: 'A setting to change.', route: 'set', question: 'stalled.whose' });
    // the parent the card is filed under is the ranked agent (RK-1) — the screen still judges the battle's own
    expect(cardBodies()[0].agentId).toBe(CLONE);
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toMatchObject({ agentId: AGENT, route: 'set' });
    expect(m.q('[data-card-receipt]').getAttribute('data-card-receipt')).toBe('op_1');
    expect(receiptNext()).toBe(NO_TEMPO);
    expect(m.q('[data-set-link]')).toBeNull();
    await sweepAll({ ...fx.tape2, agentId: CLONE }, 'clone, no tempo');
  });

  it('Amendment L RL-1 — a casual clone\'s battle whose tape records a tempo: the form says RG-5\'s sentence alone; the receipt links', async () => {
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

  it('Amendment L RL-1 — on the ranked battle with no tempo recorded, each other condition still turns the receipt\'s link off: the rule off (RJ-8\'s sentence), the rule unknown, either Forge flag off (RG-5\'s sentence alone)', async () => {
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
