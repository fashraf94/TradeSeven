// api/_utils/filmRoom/cardCounter.test.js
//
// Film Room B2 item 6 — the counter's logic (Build B spec §5; contract §4;
// Amendment G RG-4): the ET trading week, the window, weekly counts per agent
// per situation, recurrences that belong to the card's AGENT alone (the
// mutant: counting another agent's days), the field mask, and the whole
// answer over the tape suites' in-memory Firestore.

import { describe, it, expect, vi } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): cardCounter.js imports src/utils/filmRoomMoments.js, src/utils/tapeSchedule.js and
// src/constants/filmTape.js, and through the store (Amendment K RK-1) api/_utils/casualClone.js and
// src/constants/leagueTournament.js; this import of the counter is the runtime guard that they stay Node-clean — never mocked.
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import { tradingWeekOf, windowOf, weeklyCounts, recurrencesOf, readOwnerTapeDays, readOwnerTapeWindow, unavailableDaysOf, buildCounter, isOpenWatchCard, COUNTER_FIELD_MASK, COUNTER_WINDOW_DAYS } from './cardCounter.js';
import { createCard } from './cardStore.js';
import { MOMENT_KEYS } from '../../../src/utils/filmRoomMoments.js';

const UID = 'owner-1';
const OTHER = 'owner-2';
const A1 = 'agent-1';
const A2 = 'agent-2';
const at = (date, seq) => new Date(Date.parse(`${date}T13:30:20.000Z`) + (seq - 1) * 15 * 60_000).toISOString();
const item = (date, symbol, seq) => ({ situationId: 'stalled', version: 2, symbol, tickSeq: seq, at: at(date, seq), count: 3, effectiveTicksThreshold: 5 });
/** A tape day as the counter reads it: only the masked fields matter, but every other section is present to prove it is not read into the answer. */
const tapeDoc = ({ battleId, etDate, agentId = A1, ownerId = UID, items }) => ({
  tapeVersion: 2, battleId, ownerId, agentId, etDate, passes: { close: { status: 'written' } },
  checks: [{ tickSeq: 1, scores: { total: 99 } }], score: { lastCheck: { total: 99 } }, actions: [{ symbolOut: 'ACN', lockedPoints: -2.5 }],
  tags: { registryVersion: 2, situations: { stalled: 2 }, inputs: { archetypeCodeId: 'momentum_chaser' }, items, exits: [] },
});
const day = (battleId, etDate, items, over = {}) => ({ battleId, etDate, agentId: A1, items, ...over });

describe('tradingWeekOf — the Monday of an ET date\'s week', () => {
  it.each([
    ['2026-10-19', '2026-10-19'], ['2026-10-20', '2026-10-19'], ['2026-10-23', '2026-10-19'], ['2026-10-24', '2026-10-19'], ['2026-10-25', '2026-10-19'],
    ['2026-10-26', '2026-10-26'], ['2026-01-01', '2025-12-29'], ['2026-03-09', '2026-03-09'], ['2026-11-01', '2026-10-26'],
  ])('%s → %s', (etDate, monday) => { expect(tradingWeekOf(etDate)).toBe(monday); });
  it('not a date → null', () => { expect(tradingWeekOf('nope')).toBeNull(); expect(tradingWeekOf(null)).toBeNull(); });
});

describe('windowOf — the default 120 days ending today (ET), or the caller\'s dates in order within the cap', () => {
  const NOW = Date.parse('2026-10-21T23:30:00.000Z');   // 7:30 PM ET on Oct 21
  it('the default', () => {
    expect(COUNTER_WINDOW_DAYS).toBe(120);
    expect(windowOf(NOW)).toEqual({ from: '2026-06-23', to: '2026-10-21' });
    expect(windowOf(Date.parse('2026-10-22T02:30:00.000Z'))).toEqual({ from: '2026-06-23', to: '2026-10-21' });   // still Oct 21 in ET
  });
  it('the caller\'s window; malformed, reversed or too long → an error word', () => {
    expect(windowOf(NOW, { from: '2026-10-01', to: '2026-10-21' })).toEqual({ from: '2026-10-01', to: '2026-10-21' });
    expect(windowOf(NOW, { from: '2026-10-21', to: '2026-10-21' })).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    expect(windowOf(NOW, { from: '2026-10-22', to: '2026-10-21' })).toEqual({ error: 'invalid_window' });
    expect(windowOf(NOW, { from: 'x', to: '2026-10-21' })).toEqual({ error: 'invalid_window' });
    expect(windowOf(NOW, { from: '2026-10-01', to: null })).toEqual({ error: 'invalid_window' });
    expect(windowOf(NOW, { from: '2025-01-01', to: '2026-10-21' })).toEqual({ error: 'window_too_long' });
  });
});

describe('weeklyCounts — per agent, per situation, per ET trading week; tags and moments, both derived', () => {
  it('two days of one week and one of the next, two agents apart', () => {
    const days = [
      day('b-1', '2026-10-19', [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5), item('2026-10-19', 'MSFT', 9)]),
      day('b-1', '2026-10-21', [item('2026-10-21', 'ACN', 2)]),
      day('b-2', '2026-10-27', [item('2026-10-27', 'NVDA', 3), item('2026-10-27', 'NVDA', 4), item('2026-10-27', 'NVDA', 5)]),
      day('b-9', '2026-10-21', [item('2026-10-21', 'XOM', 7)], { agentId: A2 }),
    ];
    expect(weeklyCounts(days)).toEqual({
      [A1]: { stalled: { '2026-10-19': { tags: 4, moments: 3 }, '2026-10-26': { tags: 3, moments: 1 } } },
      [A2]: { stalled: { '2026-10-19': { tags: 1, moments: 1 } } },
    });
  });
  it('a day with no items counts nothing; a day of another situation counts under it', () => {
    expect(weeklyCounts([day('b-1', '2026-10-19', [])])).toEqual({});
    expect(weeklyCounts([day('b-1', '2026-10-19', [{ ...item('2026-10-19', 'ACN', 4), situationId: 'down' }])])).toEqual({ [A1]: { down: { '2026-10-19': { tags: 1, moments: 1 } } } });
  });
});

describe('recurrencesOf — the card\'s situation, on any holding, on the SAME agent\'s days, after the card\'s creation', () => {
  const card = { entryId: 'c1', agentId: A1, route: 'watch', stage: 'card', situationId: 'stalled', createdAt: '2026-10-20T02:00:00.000Z', source: { battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 } };
  const days = [
    day('b-1', '2026-10-19', [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5), item('2026-10-19', 'MSFT', 9)]),   // the card's own day: before the creation
    day('b-1', '2026-10-21', [item('2026-10-21', 'MSFT', 2), item('2026-10-21', 'MSFT', 3)]),                                 // after: another holding counts
    day('b-2', '2026-10-27', [item('2026-10-27', 'NVDA', 3)]),                                                              // another battle, the same agent
    day('b-9', '2026-10-22', [item('2026-10-22', 'XOM', 7), item('2026-10-22', 'XOM', 8)], { agentId: A2 }),                // ANOTHER AGENT: never (the mutant)
    day('b-3', '2026-10-28', [{ ...item('2026-10-28', 'ACN', 2), situationId: 'down' }]),                                   // another situation: never
  ];
  it('lists each recurrence with its battle, day and the moment\'s seven fields — nothing else — in time order', () => {
    const r = recurrencesOf(card, days);
    expect(r.map((x) => [x.battleId, x.etDate, x.symbol, x.fromTickSeq, x.toTickSeq, x.checks])).toEqual([['b-1', '2026-10-21', 'MSFT', 2, 3, 2], ['b-2', '2026-10-27', 'NVDA', 3, 3, 1]]);
    for (const x of r) expect(Object.keys(x)).toEqual(['battleId', 'etDate', ...MOMENT_KEYS]);
  });
  it('the mutant: another agent\'s days are never counted, however alike; the card\'s agent is the only one read', () => {
    const r = recurrencesOf({ ...card, agentId: A2 }, days);
    expect(r.map((x) => [x.battleId, x.symbol])).toEqual([['b-9', 'XOM']]);
    expect(recurrencesOf({ ...card, agentId: 'agent-3' }, days)).toEqual([]);
  });
  it('a moment before the creation, and the card\'s own source moment on a later refresh, are never recurrences; no createdAt → none', () => {
    const later = { ...card, createdAt: '2026-10-28T02:00:00.000Z' };
    expect(recurrencesOf(later, days)).toEqual([]);
    // the source day re-tagged (a refresh) still holds the source moment: it is not a recurrence of itself even with a creation before it
    const early = { ...card, createdAt: '2026-10-19T01:00:00.000Z' };
    expect(recurrencesOf(early, days).map((x) => [x.etDate, x.symbol])).toEqual([['2026-10-19', 'MSFT'], ['2026-10-21', 'MSFT'], ['2026-10-27', 'NVDA']]);
    expect(recurrencesOf({ ...card, createdAt: null }, days)).toEqual([]);
  });
  it('isOpenWatchCard: route watch, at card, not shelved', () => {
    expect(isOpenWatchCard({ route: 'watch', stage: 'card', archetypeCodeId: 'a', shelved: false }, 'a')).toBe(true);
    expect(isOpenWatchCard({ route: 'watch', stage: 'retired', archetypeCodeId: 'a', shelved: false }, 'a')).toBe(false);
    expect(isOpenWatchCard({ route: 'drill', stage: 'nominated', archetypeCodeId: 'a', shelved: false }, 'a')).toBe(false);
    expect(isOpenWatchCard({ route: 'watch', stage: 'card', archetypeCodeId: 'b', shelved: true }, 'a')).toBe(false);
    expect(isOpenWatchCard({ route: 'watch', stage: 'card', archetypeCodeId: 'b' }, 'a')).toBe(false);
  });
});

describe('readOwnerTapeDays — the owner\'s days in the window, through the collection group with the field mask', () => {
  const seedTapes = () => makeTapeDb({
    'agentBattles/b-1/tape/2026-10-19': tapeDoc({ battleId: 'b-1', etDate: '2026-10-19', items: [item('2026-10-19', 'ACN', 4)] }),
    'agentBattles/b-1/tape/2026-10-21': tapeDoc({ battleId: 'b-1', etDate: '2026-10-21', items: [] }),
    'agentBattles/b-2/tape/2026-10-27': tapeDoc({ battleId: 'b-2', etDate: '2026-10-27', agentId: A2, items: [item('2026-10-27', 'NVDA', 3)] }),
    'agentBattles/b-x/tape/2026-10-20': tapeDoc({ battleId: 'b-x', etDate: '2026-10-20', ownerId: OTHER, items: [item('2026-10-20', 'XOM', 2)] }),
    'agentBattles/b-1/tape/2026-06-01': tapeDoc({ battleId: 'b-1', etDate: '2026-06-01', items: [item('2026-06-01', 'ACN', 2)] }),
    'agentBattles/b-1/tape/2026-10-22': { ...tapeDoc({ battleId: 'b-1', etDate: '2026-10-22', items: [] }), tags: { items: null }, passes: { close: { status: 'failed' } } },
    'agentBattles/b-1/tape/2026-10-23': { tapeVersion: 2, battleId: 'b-1', ownerId: UID, agentId: A1, etDate: '2026-10-23', passes: { close: { status: 'skipped_mode' } } },
  });
  it('the owner\'s days in the window that store items, oldest first; another owner\'s, an out-of-window, a failed and a skipped day are left out', async () => {
    const t = seedTapes();
    const days = await readOwnerTapeDays(t.db, { uid: UID, from: '2026-10-01', to: '2026-10-31' });
    expect(days.map((d) => [d.battleId, d.etDate, d.agentId, d.items.length])).toEqual([['b-1', '2026-10-19', A1, 1], ['b-1', '2026-10-21', A1, 0], ['b-2', '2026-10-27', A2, 1]]);
    expect(t.readLog).toEqual(['group:tape']);
  });
  it('asks with the field mask — tags, etDate, ownerId, agentId, battleId and (B2.1 B3, RH-6) coverage.tags.status — and nothing else', async () => {
    expect(COUNTER_FIELD_MASK).toEqual(['tags', 'etDate', 'ownerId', 'agentId', 'battleId', 'coverage.tags.status']);
    const selected = [];
    const q = { where: () => q, select: (...f) => { selected.push(f); return q; }, get: async () => ({ docs: [] }) };
    const db = { collectionGroup: (name) => { selected.push([`group:${name}`]); return q; } };
    expect(await readOwnerTapeDays(db, { uid: UID, from: '2026-10-01', to: '2026-10-31' })).toEqual([]);
    expect(selected).toEqual([['group:tape'], ['tags', 'etDate', 'ownerId', 'agentId', 'battleId', 'coverage.tags.status']]);
  });
  it('a document that names another owner, however it got into the result, is dropped here too', async () => {
    const q = { where: () => q, select: () => q, get: async () => ({ docs: [{ data: () => tapeDoc({ battleId: 'b-x', etDate: '2026-10-20', ownerId: OTHER, items: [item('2026-10-20', 'XOM', 2)] }) }] }) };
    expect(await readOwnerTapeDays({ collectionGroup: () => q }, { uid: UID, from: '2026-10-01', to: '2026-10-31' })).toEqual([]);
  });
});

describe('buildCounter — the whole answer: the window, the weekly counts, the cards with their shelving, each open Watch card\'s recurrences', () => {
  const NOW = Date.parse('2026-10-28T23:00:00.000Z');
  const payload = (over = {}) => ({ archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Let it go.', route: 'watch', ...over });
  const seed = () => makeTapeDb({
    [`agents/${A1}`]: { ownerId: UID, archetype: 'momentum_chaser' },
    [`agents/${A2}`]: { ownerId: UID, archetype: 'guardian' },
    'agentBattles/b-1/tape/2026-10-19': tapeDoc({ battleId: 'b-1', etDate: '2026-10-19', items: [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5)] }),
    'agentBattles/b-1/tape/2026-10-21': tapeDoc({ battleId: 'b-1', etDate: '2026-10-21', items: [item('2026-10-21', 'MSFT', 2)] }),
    'agentBattles/b-2/tape/2026-10-27': tapeDoc({ battleId: 'b-2', etDate: '2026-10-27', agentId: A2, items: [item('2026-10-27', 'NVDA', 3), item('2026-10-27', 'NVDA', 4)] }),
  });
  it('an open Watch card gets its recurrences on its own agent\'s later days; a Practice card and a Set card get none; the counts cover every day', async () => {
    const t = seed();
    await createCard(t.db, { uid: UID, agentId: A1, opId: 'w1', payload: payload(), nowIso: '2026-10-20T02:00:00.000Z' });
    await createCard(t.db, { uid: UID, agentId: A1, opId: 'p1', payload: payload({ route: 'drill' }), nowIso: '2026-10-20T02:01:00.000Z' });
    await createCard(t.db, { uid: UID, agentId: A1, opId: 's1', payload: payload({ route: 'set' }), nowIso: '2026-10-20T02:02:00.000Z' });
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.window).toEqual({ from: '2026-06-30', to: '2026-10-28' });
    expect(out.weekly).toEqual({
      [A1]: { stalled: { '2026-10-19': { tags: 3, moments: 2 } } },
      [A2]: { stalled: { '2026-10-26': { tags: 2, moments: 1 } } },
    });
    expect(out).toMatchObject({ agentId: A1, archetypeCodeId: 'momentum_chaser', open: 3, cap: 5 });
    expect(out.cards.map((c) => [c.entryId, c.route, c.stage, c.shelved])).toEqual([['s1', 'set', 'card', false], ['p1', 'drill', 'nominated', false], ['w1', 'watch', 'card', false]]);
    expect(Object.keys(out.recurrences)).toEqual(['w1']);
    expect(out.recurrences.w1.map((x) => [x.battleId, x.etDate, x.symbol, x.checks])).toEqual([['b-1', '2026-10-21', 'MSFT', 1]]);
    // nothing but the masked fields reaches the answer: no score, price or result from any tape day
    const text = JSON.stringify(out);
    for (const word of ['"scores"', '"score"', '"lockedPoints"', '"checks":[', '"actions"', '"total"']) expect(text, word).not.toContain(word);
    expect(t.writeLog.filter((w) => w.path.includes('/tape/'))).toEqual([]);
  });
  it('a shelved Watch card (the agent changed archetype) gets no recurrences and is not open; a retired one neither', async () => {
    const t = seed();
    await createCard(t.db, { uid: UID, agentId: A1, opId: 'w1', payload: payload(), nowIso: '2026-10-20T02:00:00.000Z' });
    t.store.set(`agents/${A1}`, { ownerId: UID, archetype: 'guardian' });
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.cards.map((c) => [c.entryId, c.shelved])).toEqual([['w1', true]]);
    expect(out.open).toBe(0);
    expect(out.recurrences).toEqual({});
  });
  it('a malformed window answers an error word before any read; another owner\'s agent is refused by the ledger read', async () => {
    const t = seed();
    expect(await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW, from: 'x', to: 'y' })).toEqual({ error: 'invalid_window' });
    expect(t.readLog).toEqual([]);
    await expect(buildCounter(t.db, { uid: OTHER, agentId: A1, nowMs: NOW })).rejects.toMatchObject({ cardRoute: true, status: 403 });
  });
  it('the mutant: the counter never counts another agent\'s days as a card\'s recurrences even when they fall in the window after the card', async () => {
    const t = seed();
    await createCard(t.db, { uid: UID, agentId: A1, opId: 'w1', payload: payload(), nowIso: '2026-10-20T02:00:00.000Z' });
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.recurrences.w1.map((x) => x.battleId)).not.toContain('b-2');
  });
});

// ── the review's rows (docs/audits/20261021_BUILD_FILM_ROOM_B2_CARD.md §9) ──
describe('review L1-2 — the default window is floored at the earliest open Watch card\'s creation day, within the 400-day cap', () => {
  const NOW = Date.parse('2026-10-28T23:00:00.000Z');   // Oct 28 ET; the default window starts Jun 30
  const seedOld = (createdAt) => {
    const t = makeTapeDb({
      [`agents/${A1}`]: { ownerId: UID, archetype: 'momentum_chaser' },
      'agentBattles/b-old/tape/2026-06-10': tapeDoc({ battleId: 'b-old', etDate: '2026-06-10', items: [item('2026-06-10', 'MSFT', 2)] }),   // before Jun 30: outside the default window
      'agentBattles/b-1/tape/2026-10-21': tapeDoc({ battleId: 'b-1', etDate: '2026-10-21', items: [item('2026-10-21', 'MSFT', 2)] }),
      [`agents/${A1}/plays/w_old`]: { schemaVersion: 1, entryId: 'w_old', ownerId: UID, agentId: A1, createdAt, archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, source: { battleId: 'b-older', etDate: '2026-05-20', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: 1, note: 'Watch.', route: 'watch', slotsVersion: 1, stage: 'card', stageAt: createdAt, stageHistory: [{ stage: 'card', at: createdAt, by: 'player', opId: 'w_old' }], version: 1, opId: 'w_old', opFingerprint: 'f' },
    });
    return t;
  };
  it('a Watch card from May: the window opens at its creation day, so June\'s recurrence is counted (not "none recorded")', async () => {
    const t = seedOld('2026-05-21T02:00:00.000Z');
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.window).toEqual({ from: '2026-05-20', to: '2026-10-28' });
    expect(out.recurrences.w_old.map((x) => x.etDate)).toEqual(['2026-06-10', '2026-10-21']);
  });
  it('a Watch card older than the 400-day cap: the window opens at the cap, never earlier; a caller\'s own window is never widened', async () => {
    const t = seedOld('2024-01-05T02:00:00.000Z');
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.window).toEqual({ from: '2025-09-24', to: '2026-10-28' });   // 400 days inclusive of both ends
    const asked = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW, from: '2026-10-01', to: '2026-10-28' });
    expect(asked.window).toEqual({ from: '2026-10-01', to: '2026-10-28' });
    expect(asked.recurrences.w_old.map((x) => x.etDate)).toEqual(['2026-10-21']);
  });
  it('a retired or shelved Watch card does not widen the window', async () => {
    const t = seedOld('2026-05-21T02:00:00.000Z');
    t.store.set(`agents/${A1}/plays/w_old`, { ...t.store.get(`agents/${A1}/plays/w_old`), stage: 'retired' });
    expect((await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW })).window.from).toBe('2026-06-30');
    t.store.set(`agents/${A1}/plays/w_old`, { ...t.store.get(`agents/${A1}/plays/w_old`), stage: 'card', archetypeCodeId: 'guardian' });
    expect((await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW })).window.from).toBe('2026-06-30');
  });
});

describe('B2.1 B3 (Amendment H RH-6) — an unavailable day gives one answer: neither counted nor a recurrence, only counted as unavailable', () => {
  const NOW = Date.parse('2026-10-28T23:00:00.000Z');
  const payload = (over = {}) => ({ archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Let it go.', route: 'watch', ...over });
  const unavailable = (doc) => ({ ...doc, coverage: { tags: { status: 'unavailable', note: 'stalled unavailable: checks partial' } } });
  const seed = () => makeTapeDb({
    [`agents/${A1}`]: { ownerId: UID, archetype: 'momentum_chaser' },
    'agentBattles/b-1/tape/2026-10-19': tapeDoc({ battleId: 'b-1', etDate: '2026-10-19', items: [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5)] }),
    // a later day that STORES items under an unavailable coverage — the case RH-6 names
    'agentBattles/b-1/tape/2026-10-21': unavailable(tapeDoc({ battleId: 'b-1', etDate: '2026-10-21', items: [item('2026-10-21', 'MSFT', 2)] })),
    'agentBattles/b-3/tape/2026-10-22': unavailable(tapeDoc({ battleId: 'b-3', etDate: '2026-10-22', items: null })),
    'agentBattles/b-2/tape/2026-10-27': unavailable(tapeDoc({ battleId: 'b-2', etDate: '2026-10-27', agentId: A2, items: [item('2026-10-27', 'NVDA', 3)] })),
    'agentBattles/b-4/tape/2026-10-23': tapeDoc({ battleId: 'b-4', etDate: '2026-10-23', items: [item('2026-10-23', 'XOM', 6)] }),
  });

  it('readOwnerTapeWindow: the unavailable days apart, items or none; the usable days as before', async () => {
    const { days, unavailable: un } = await readOwnerTapeWindow(seed().db, { uid: UID, from: '2026-10-01', to: '2026-10-31' });
    expect(days.map((d) => [d.battleId, d.etDate])).toEqual([['b-1', '2026-10-19'], ['b-4', '2026-10-23']]);
    expect(un).toEqual([{ battleId: 'b-1', etDate: '2026-10-21', agentId: A1 }, { battleId: 'b-3', etDate: '2026-10-22', agentId: A1 }, { battleId: 'b-2', etDate: '2026-10-27', agentId: A2 }]);
  });

  it('buildCounter: the unavailable day\'s moment is no recurrence and no weekly count; the answer reports the unavailable days per agent (the mutant: the counter counting an unavailable day)', async () => {
    const t = seed();
    await createCard(t.db, { uid: UID, agentId: A1, opId: 'w1', payload: payload(), nowIso: '2026-10-20T02:00:00.000Z' });
    const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
    expect(out.recurrences.w1.map((x) => [x.battleId, x.etDate, x.symbol])).toEqual([['b-4', '2026-10-23', 'XOM']]);
    expect(out.weekly).toEqual({ [A1]: { stalled: { '2026-10-19': { tags: 3, moments: 2 } } } });
    expect(out.unavailableDays).toEqual({ [A1]: 2, [A2]: 1 });
    expect(unavailableDaysOf([])).toEqual({});
  });

  it('a day whose situations are complete, partial or absent is not "unavailable": only the stored status says so', async () => {
    const t = makeTapeDb({
      'agentBattles/b-1/tape/2026-10-19': { ...tapeDoc({ battleId: 'b-1', etDate: '2026-10-19', items: [item('2026-10-19', 'ACN', 4)] }), coverage: { tags: { status: 'complete' } } },
      'agentBattles/b-1/tape/2026-10-20': { ...tapeDoc({ battleId: 'b-1', etDate: '2026-10-20', items: [item('2026-10-20', 'ACN', 4)] }), coverage: { tags: { status: 'partial' } } },
      'agentBattles/b-1/tape/2026-10-21': tapeDoc({ battleId: 'b-1', etDate: '2026-10-21', items: [item('2026-10-21', 'ACN', 4)] }),
    });
    const { days, unavailable: un } = await readOwnerTapeWindow(t.db, { uid: UID, from: '2026-10-01', to: '2026-10-31' });
    expect(days).toHaveLength(3);
    expect(un).toEqual([]);
  });
});

// Build B Amendment K RK-1 — the counter answers for the ATTRIBUTION agent: the owner's casual clone's days count for
// its parent (the ranked agent), by one read of the owner's clone document and the platform's resolver; another
// owner's clone never counts. The same rows run on the real emulator in test/rules/filmRoomCardAttribution.rules.mjs.
describe('RK-1 — the counter answers for the attribution agent (the casual clone\'s parent)', () => {
  const NOW = Date.parse('2026-10-28T23:00:00.000Z');
  const CLONE = `casual-agent-${UID}`;
  const FOREIGN_CLONE = `casual-agent-${OTHER}`;
  const payload = (over = {}) => ({ archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Let it go.', route: 'watch', ...over });
  const unavailable = (doc) => ({ ...doc, coverage: { tags: { status: 'unavailable', note: 'stalled unavailable: checks partial' } } });
  /** The parent A1 (ranked); the owner's clone naming it; a ranked day (b-1), a clone day (b-c), an unavailable clone day, and two days on ANOTHER owner's clone — tape days the owner owns, the shape the mutant would count. */
  const seed = (clone = { ownerId: UID, archetype: 'momentum_chaser', rankedAgentId: A1 }, hooks = {}) => makeTapeDb({
    [`agents/${A1}`]: { ownerId: UID, archetype: 'momentum_chaser' },
    ...(clone ? { [`agents/${CLONE}`]: clone } : {}),
    [`agents/${FOREIGN_CLONE}`]: { ownerId: OTHER, archetype: 'momentum_chaser', rankedAgentId: A1 },
    'agentBattles/b-1/tape/2026-10-19': tapeDoc({ battleId: 'b-1', etDate: '2026-10-19', items: [item('2026-10-19', 'ACN', 4), item('2026-10-19', 'ACN', 5)] }),
    'agentBattles/b-c/tape/2026-10-21': tapeDoc({ battleId: 'b-c', etDate: '2026-10-21', agentId: CLONE, items: [item('2026-10-21', 'MSFT', 2)] }),
    'agentBattles/b-c2/tape/2026-10-22': unavailable(tapeDoc({ battleId: 'b-c2', etDate: '2026-10-22', agentId: CLONE, items: null })),
    'agentBattles/b-f/tape/2026-10-23': tapeDoc({ battleId: 'b-f', etDate: '2026-10-23', agentId: FOREIGN_CLONE, items: [item('2026-10-23', 'XOM', 6)] }),
    'agentBattles/b-f2/tape/2026-10-24': unavailable(tapeDoc({ battleId: 'b-f2', etDate: '2026-10-24', agentId: FOREIGN_CLONE, items: null })),
  }, { hooks });
  const watchCard = (t) => createCard(t.db, { uid: UID, agentId: A1, opId: 'w1', payload: payload(), nowIso: '2026-10-20T02:00:00.000Z' });

  it('recurrencesOf / unavailableDaysOf by the resolver: a clone day recurs and counts for the parent; any other id maps to itself', () => {
    const targetOf = (id) => (id === CLONE ? A1 : id);
    const card = { entryId: 'w1', agentId: A1, situationId: 'stalled', createdAt: '2026-10-20T02:00:00.000Z', source: { battleId: 'b-1', etDate: '2026-10-19', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 } };
    const days = [day('b-c', '2026-10-21', [item('2026-10-21', 'MSFT', 2)], { agentId: CLONE }), day('b-f', '2026-10-23', [item('2026-10-23', 'XOM', 6)], { agentId: FOREIGN_CLONE })];
    expect(recurrencesOf(card, days, targetOf).map((x) => [x.battleId, x.symbol])).toEqual([['b-c', 'MSFT']]);
    expect(recurrencesOf(card, days)).toEqual([]);   // without the resolver the clone's day is the clone's
    expect(unavailableDaysOf([{ agentId: CLONE }, { agentId: A1 }, { agentId: FOREIGN_CLONE }], targetOf)).toEqual({ [A1]: 2, [FOREIGN_CLONE]: 1 });
  });

  it('asked with the clone (the battle\'s own agent): the answer names the parent, its ledger, the clone day\'s recurrence of a card filed from a ranked day, and the clone\'s unavailable day under the parent — never another owner\'s clone (the mutants: the clone day left out; another owner\'s clone counted)', async () => {
    const t = seed();
    await watchCard(t);
    for (const asked of [CLONE, A1]) {
      const out = await buildCounter(t.db, { uid: UID, agentId: asked, nowMs: NOW });
      expect(out).toMatchObject({ agentId: asked, attributionAgentId: A1, archetypeCodeId: 'momentum_chaser', open: 1, cap: 5 });
      expect(out.cards.map((c) => [c.entryId, c.agentId])).toEqual([['w1', A1]]);
      expect(out.recurrences.w1.map((x) => [x.battleId, x.etDate, x.symbol])).toEqual([['b-c', '2026-10-21', 'MSFT']]);
      expect(out.unavailableDays[A1]).toBe(1);
      expect(out.unavailableDays[FOREIGN_CLONE]).toBe(1);   // the other owner's clone's day is that clone's, never the parent's
    }
    // one read of the owner's clone document per answer; nothing written
    t.readLog.length = 0;
    await buildCounter(t.db, { uid: UID, agentId: CLONE, nowMs: NOW });
    expect(t.readLog.filter((p) => p === `agents/${CLONE}`)).toHaveLength(1);
    expect(t.readLog).not.toContain(`agents/${FOREIGN_CLONE}`);
    expect(t.writeLog.filter((w) => !w.path.includes('/plays/w1'))).toEqual([]);
  });

  it('the owner\'s clone the resolver cannot resolve — no document, no rankedAgentId, a document another owner holds, a parent another owner holds — is refused 503 attribution_unavailable; nothing is read under it', async () => {
    const cases = [
      ['no clone document', null],
      ['no rankedAgentId', { ownerId: UID, archetype: 'momentum_chaser' }],
      ['the document another owner\'s', { ownerId: OTHER, archetype: 'momentum_chaser', rankedAgentId: A1 }],
      ['a parent another owner holds', { ownerId: UID, archetype: 'momentum_chaser', rankedAgentId: 'agent-9' }],
    ];
    for (const [label, clone] of cases) {
      const t = seed(clone);
      t.store.set('agents/agent-9', { ownerId: OTHER, archetype: 'momentum_chaser' });
      await expect(buildCounter(t.db, { uid: UID, agentId: CLONE, nowMs: NOW }), label).rejects.toMatchObject({ cardRoute: true, status: 503, code: 'attribution_unavailable', extra: { agentId: CLONE } });
      expect(t.readLog.some((p) => p.includes('/plays')), label).toBe(false);
      // the ranked agent itself still answers — its own days alone, the unresolved clone's days not among them
      if (label !== 'a parent another owner holds') {
        const out = await buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW });
        expect(out.attributionAgentId, label).toBe(A1);
        expect(out.unavailableDays[A1], label).toBeUndefined();
      }
    }
  });

  it('a clone document that cannot be read → 503 attribution_unavailable, never an answer with no recurrence', async () => {
    const t = seed(undefined, { beforeRead: (label) => { if (label === `agents/${CLONE}`) throw new Error('UNAVAILABLE'); } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(buildCounter(t.db, { uid: UID, agentId: A1, nowMs: NOW })).rejects.toMatchObject({ status: 503, code: 'attribution_unavailable' });
    vi.restoreAllMocks();
  });
});
