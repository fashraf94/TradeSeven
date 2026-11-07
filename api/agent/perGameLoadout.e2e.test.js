// api/agent/perGameLoadout.e2e.test.js
//
// Build A2 — ONE ROW THROUGH THE REAL DEPLOY PATH (the model mocked), with PER_GAME_LOADOUT_ENABLED mocked ON. The
// pilot's deploy harness (api/_utils/__fixtures__/deployHarness.js: the callsFirestore double, the model and voice
// doubles, the frozen clock) carries the real writers, the real casual-clone provisioning and the real fenced
// decide.js / createAgentBattle, read and called, never edited:
//   1. BaggerBomb is set to the Speculator and League to the Contrarian, through change-archetype with `loadout`;
//   2. a casual game deploys (ensureCasualClone, then decide.js for the clone): agentContext.archetype is `degen`;
//   3. a League deploy that week (the prescribed tournament request on the ranked record): it is `contrarian`;
//   4. a League equip mid-week is refused with the lock; a BaggerBomb equip mid-game lands on the next deploy only —
//      the running clone is not resynced (GUARD 1) and its battle keeps its book; after the game, the next deploy's
//      battle carries the new one.

process.env.TZ = 'UTC';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null, anthropic: null, uid: 'p1b-owner-1' }));

vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: true }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.anthropic.create(args) }; }
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => {
  const { priceAnswer } = await import('../_utils/__fixtures__/deployHarness.js');
  return { ...(await importOriginal()), getStockAnalysisData: (symbol) => priceAnswer(symbol) };
});
vi.mock('../_utils/shadowLogger.js', () => ({
  logDecision: async () => {},
  logFirstMessage: async () => {},
  logSignalDrops: async () => true,
}));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async () => '{"response":"Opening line."}',
  parseVoiceLayerResponse: () => ({ response: 'Opening line.', _scratchpad: null }),
}));
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  return { FieldValue: { ...FieldValueDouble, serverTimestamp: () => '2026-11-04T15:00:00.000Z' } };
});
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
// The composition fence dark, as the carriage suite runs its fence-off rows: the double's refs carry no `.firestore`.
vi.mock('../_utils/compositionConfig.js', async (importOriginal) => ({ ...(await importOriginal()), COMPOSITION_EPOCH_FENCE_ENABLED: false }));

const H = await import('../_utils/__fixtures__/deployHarness.js');
const { stored } = await import('../_utils/__fixtures__/callsFirestore.js');
const { ensureCasualClone } = await import('../_utils/casualClone.js');
const { casualCloneDocId } = await import('../../src/constants/leagueTournament.js');
const { default: decide } = await import('./decide.js');
const { default: changeArchetype } = await import('./change-archetype.js');
const { default: equipWatchlist } = await import('./equip-watchlist.js');

const NOW = '2026-11-04T15:00:00.000Z'; // Wednesday of the week of Nov 2, market open
const CLONE_ID = casualCloneDocId(H.OWNER);
const SECOND_LIST = 'wl-energy';

let savedCron;
beforeEach(() => {
  savedCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = H.CRON_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.spyOn(Math, 'random').mockImplementation(H.seededRandom());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedCron;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function post(handler, req) {
  state.anthropic = H.makeAnthropicDouble();
  const res = H.makeRes();
  await handler(req, res);
  await H.settle();
  return res;
}
const body = (b) => ({ method: 'POST', headers: { authorization: 'Bearer client-token' }, body: b, query: {} });
const battlesOf = (db, agentId) => [...db.__docs.entries()]
  .filter(([p, d]) => /^agentBattles\/[^/]+$/.test(p) && d.agentId === agentId)
  .map(([p, d]) => ({ id: p.split('/')[1], ...d }));

describe('A2 end to end: two loadouts, two games, one week', () => {
  it('BaggerBomb deploys as the Speculator, League as the Contrarian; League locks mid-week, BaggerBomb reaches the next deploy only', async () => {
    const docs = H.seedDeploy({
      agent: H.agentDoc({ lastDeployedAt: '2026-11-03T15:00:00.000Z' }),
      extra: {
        [`watchlists/${SECOND_LIST}`]: { ...H.watchlistDoc({ name: 'Energy Movers', tickers: ['XOM', 'CVX'] }), watchlistId: SECOND_LIST },
      },
    });
    const db = H.makeDeployDb(docs);
    state.db = db;

    // 1. The two loadouts, through the real writers (no group yet: League is open).
    expect((await post(changeArchetype, body({ agentId: H.AGENT_ID, archetype: 'degen', loadout: 'baggerbomb' }))).statusCode).toBe(200);
    expect((await post(changeArchetype, body({ agentId: H.AGENT_ID, archetype: 'contrarian', loadout: 'league' }))).statusCode).toBe(200);
    const ranked = stored(db, `agents/${H.AGENT_ID}`);
    expect(ranked.archetype).toBe('contrarian');
    expect(ranked.loadouts.baggerbomb.archetype).toBe('degen');

    // 2. A casual game: the clone is provisioned in the BaggerBomb loadout and decide.js deploys it.
    await ensureCasualClone(db, { odUserId: H.OWNER, now: new Date(NOW) });
    expect(stored(db, `agents/${CLONE_ID}`).archetype).toBe('degen');
    const casual = await post(decide, body({ agentId: CLONE_ID }));
    expect(casual.statusCode).toBe(200);
    const [casualBattle] = battlesOf(db, CLONE_ID);
    expect(casualBattle.agentContext.archetype).toBe('degen');
    expect(casualBattle.agentContext.equippedWatchlist?.watchlistId).toBe(H.WATCHLIST_ID);

    // 3. The League week: the player's ranked group, and that day's League deploy on the ranked record.
    db.__docs.set('tournamentGroups/grp-p1b-1', {
      status: 'battle', groupMembers: [H.OWNER, 'cpu-1', 'cpu-2', 'cpu-3'], updatedAt: NOW, startAnchor: { anchorEtDate: '2026-11-02' },
    });
    const league = await post(decide, H.tournamentRequest());
    expect(league.statusCode).toBe(200);
    const [leagueBattle] = battlesOf(db, H.AGENT_ID);
    expect(leagueBattle.agentContext.archetype).toBe('contrarian');

    // 4a. A League equip mid-week: refused with the lock, naming the week's end (Fri Nov 6, 4:00 PM ET).
    const lockedEquip = await post(equipWatchlist, body({ agentId: H.AGENT_ID, watchlistId: SECOND_LIST, loadout: 'league' }));
    expect(lockedEquip.statusCode).toBe(409);
    expect(lockedEquip.body.lock).toMatchObject({ kind: 'league_week', groupId: 'grp-p1b-1', endsAt: '2026-11-06T21:00:00.000Z' });
    expect(stored(db, `agents/${H.AGENT_ID}`).equippedWatchlistId).toBe(H.WATCHLIST_ID);

    // 4b. A BaggerBomb equip mid-game: it lands on the slot at once...
    const bbEquip = await post(equipWatchlist, body({ agentId: H.AGENT_ID, watchlistId: SECOND_LIST, loadout: 'baggerbomb' }));
    expect(bbEquip.statusCode).toBe(200);
    expect(stored(db, `agents/${H.AGENT_ID}`).loadouts.baggerbomb.book.ref).toEqual({ watchlistId: SECOND_LIST });
    // ...but the running game's clone is not resynced (GUARD 1), and its battle keeps the book it deployed with.
    await ensureCasualClone(db, { odUserId: H.OWNER, now: new Date(NOW) });
    expect(stored(db, `agents/${CLONE_ID}`).equippedWatchlistId).toBe(H.WATCHLIST_ID);
    expect(stored(db, `agentBattles/${casualBattle.id}`).agentContext.equippedWatchlist?.watchlistId).toBe(H.WATCHLIST_ID);

    // The game ends; the next deploy carries the new book, still as the Speculator.
    db.__docs.set(`agents/${CLONE_ID}`, { ...stored(db, `agents/${CLONE_ID}`), activeBattleId: null });
    db.__docs.set(`agentBattles/${casualBattle.id}`, { ...stored(db, `agentBattles/${casualBattle.id}`), status: 'completed' });
    vi.setSystemTime(new Date('2026-11-05T15:00:00.000Z'));
    await ensureCasualClone(db, { odUserId: H.OWNER, now: new Date('2026-11-05T15:00:00.000Z') });
    expect(stored(db, `agents/${CLONE_ID}`).equippedWatchlistId).toBe(SECOND_LIST);
    const next = await post(decide, body({ agentId: CLONE_ID }));
    expect(next.statusCode).toBe(200);
    const nextBattle = battlesOf(db, CLONE_ID).find((b) => b.id !== casualBattle.id);
    expect(nextBattle.agentContext.archetype).toBe('degen');
    expect(nextBattle.agentContext.equippedWatchlist?.watchlistId).toBe(SECOND_LIST);
    // League still wears the Contrarian and the first book: nothing BaggerBomb did reached it.
    expect(stored(db, `agents/${H.AGENT_ID}`)).toMatchObject({ archetype: 'contrarian', equippedWatchlistId: H.WATCHLIST_ID });
  }, 30_000); // three deploys through decide.js: ~3 s here, given room under a loaded suite
});
