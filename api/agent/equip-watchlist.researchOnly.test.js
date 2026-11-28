// api/agent/equip-watchlist.researchOnly.test.js
//
// Research universe Build 3b, build prompt section 7 (founder ruling RU-18): A SAVED IDEA HOLDING A RESEARCH-ONLY
// COMPANY CANNOT BE EQUIPPED TO A BATTLE AGENT. The equip route refuses a saved idea (a list Work an idea saved — its
// session marker; review L1-1: a Forge list equips as before, whatever it holds) that holds one — code
// `research_only_list` — for every loadout, before the idempotent answer, with nothing written and no log. A list of game
// stocks is equipped as today; a list with a fund outside both lists (KRE) is equipped as today (ruling F2 governs it).
//
// PER_GAME_LOADOUT_ENABLED is mocked on here, as production runs it (perGameLoadoutFlags.js). The route's own suites run
// as before. No row calls Firestore: the loadout writers' double (loadoutWriterDb.js).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoadoutWriterDb, makeReqRes } from '../_utils/__fixtures__/loadoutWriterDb.js';
import { isResearchStock } from '../_utils/researchUniverse.js';

const { auth, logs } = vi.hoisted(() => ({ auth: { current: { uid: 'u1' } }, logs: { current: [] } }));
let activeDb = null;

vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => auth.current }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async (r) => { logs.current.push(r); } }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: equipWatchlist, holdsResearchOnly, isSavedIdea } = await import('./equip-watchlist.js');

beforeEach(() => {
  auth.current = { uid: 'u1' };
  logs.current = [];
  activeDb = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const RANKED = Object.freeze({ ownerId: 'u1', archetype: 'contrarian', equippedWatchlistId: null, equippedWatchlistName: null, activeBattleId: null, settingsRev: 5 });
const list = (tickers, extra = {}) => ({ userId: 'u1', status: 'committed', name: 'An idea', tickers: tickers.map((symbol) => ({ symbol })), ...extra });
/** A saved idea: a list Work an idea saved carries its session marker (store.js commitAdoption; hypothesisRecords SHARED_RESEARCH_LIST_MARKER). */
const idea = (tickers) => list(tickers, { sourceSharedResearchSessionId: 'session-1', origin: 'shared_research' });
const LISTS = {
  'wl-research': idea(['GLW']),
  'wl-mixed': idea(['NVDA', 'GLW']),
  'wl-game': idea(['NVDA', 'AMD']),
  'wl-fund': idea(['NVDA', 'KRE']),
  'wl-dotted': idea(['MOG.B']),
  'wl-lower': idea(['glw ']),
  // review L1-1: a list made anywhere else (the Forge) equips as before this build, whatever it holds
  'wl-forge-tsm': list(['NVDA', 'TSM']),
  'wl-forge-glw': list(['GLW']),
};
const REFUSAL = { error: 'research_only_list', message: "This idea holds a research-only company and can't be equipped to a battle agent." };

function setup({ agent = RANKED } = {}) {
  const fx = makeLoadoutWriterDb({ agentDocs: { 'agent-1': { ...agent } }, watchlists: structuredClone(LISTS), groups: [] });
  activeDb = fx.db;
  return fx;
}
async function equip(watchlistId, loadout) {
  const { req, res } = makeReqRes({ agentId: 'agent-1', watchlistId, ...(loadout === undefined ? {} : { loadout }) });
  await equipWatchlist(req, res);
  return res;
}
const LOADOUTS = [['league', 'league'], ['baggerbomb', 'baggerbomb'], ['absent (the League book, as today)', undefined]];

describe('a list holding a research-only company is refused, for every loadout (RU-18)', () => {
  it.each(LOADOUTS)('%s: research_only_list, nothing written, no log', async (_t, loadout) => {
    for (const id of ['wl-research', 'wl-mixed', 'wl-dotted', 'wl-lower']) {
      const fx = setup();
      const before = JSON.stringify(fx.state.agentDocs);
      const res = await equip(id, loadout);
      expect([res.statusCode, res.body], id).toEqual([400, REFUSAL]);
      expect(JSON.stringify(fx.state.agentDocs), id).toBe(before);
      expect(logs.current, id).toEqual([]);
    }
  });
  it.each(LOADOUTS)('%s: already the equipped list is refused too (the check runs before the idempotent answer)', async (_t, loadout) => {
    const agent = { ...RANKED, equippedWatchlistId: 'wl-research', equippedWatchlistName: 'An idea', loadouts: { baggerbomb: { archetype: 'degen', book: { ref: { watchlistId: 'wl-research' }, name: 'An idea', pin: null } } } };
    setup({ agent });
    const res = await equip('wl-research', loadout);
    expect([res.statusCode, res.body.error]).toEqual([400, 'research_only_list']);
  });
});

describe('everything else equips as today', () => {
  it.each(LOADOUTS)('%s: a list of game stocks is equipped', async (_t, loadout) => {
    setup();
    const res = await equip('wl-game', loadout);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ equippedWatchlistId: 'wl-game', idempotent: false });
  });
  it.each(LOADOUTS)('%s: a Forge list (not a saved idea) holding a directory company is equipped as before this build (review L1-1)', async (_t, loadout) => {
    for (const id of ['wl-forge-tsm', 'wl-forge-glw']) {
      setup();
      const res = await equip(id, loadout);
      expect(res.statusCode, id).toBe(200);
      expect(res.body, id).toMatchObject({ equippedWatchlistId: id, idempotent: false });
    }
  });
  it.each(LOADOUTS)('%s: a list with a fund outside both lists (KRE) is equipped (ruling F2 governs it)', async (_t, loadout) => {
    setup();
    const res = await equip('wl-fund', loadout);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ equippedWatchlistId: 'wl-fund' });
  });
});

describe('isSavedIdea: the session marker Work an idea writes, never another field', () => {
  it('the marker name is the one the hypothesis records model writes', async () => {
    const { SHARED_RESEARCH_LIST_MARKER } = await import('../_utils/hypothesisRecords/model.js');
    expect(SHARED_RESEARCH_LIST_MARKER).toBe('sourceSharedResearchSessionId');
    expect(isSavedIdea(idea(['GLW']))).toBe(true);
    for (const w of [list(['GLW']), { ...list(['GLW']), sourceSharedResearchSessionId: '' }, { ...list(['GLW']), sourceSharedResearchSessionId: 7 }, null, undefined]) expect(isSavedIdea(w)).toBe(false);
  });
});

describe('holdsResearchOnly: a directory company only, spelled as the house spells it', () => {
  it.each([
    [['GLW'], true], [['TSM'], true], [['MOG.B'], true], [['mog-b'], true], [[' glw '], true],
    [['NVDA', 'AAPL', 'BRK.B'], false], [['KRE', 'SPY', 'XLK'], false], [['ZZZZ'], false], [['MMC'], false], [[], false],
  ])('%j → %s', (symbols, expected) => {
    expect(holdsResearchOnly(symbols.map((symbol) => ({ symbol })))).toBe(expected);
  });
  it('a malformed list holds none: no tickers, entries without a symbol', () => {
    expect(holdsResearchOnly(undefined)).toBe(false);
    expect(holdsResearchOnly([null, {}, { symbol: 7 }])).toBe(false);
  });
  it('agrees with the research list: GLW and MOG-B are research stocks; NVDA, KRE and the retired MMC are not', () => {
    expect([isResearchStock('GLW'), isResearchStock('MOG-B'), isResearchStock('NVDA'), isResearchStock('KRE'), isResearchStock('MMC')]).toEqual([true, true, false, false, false]);
  });
});
