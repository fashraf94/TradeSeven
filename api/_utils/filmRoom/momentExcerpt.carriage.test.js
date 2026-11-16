// api/_utils/filmRoom/momentExcerpt.carriage.test.js
//
// Film Room C2 fix round — Build C Amendment D CD-8 with Amendment E CE-5: THE IDEA IS THE ONE THE BATTLE CARRIED, as
// the REAL deploy writer freezes it. Battles are created through the real createAgentBattle (agentBattleService.js —
// fenced: called, never edited) and the real creation transaction, from the version the hypothesis store writes:
//   an ordinary deploy freezes the carriage, and the excerpt reads exactly it (list, version, hash) — the idea with its
//   statement, from the version document that agrees with it;
//   a TOURNAMENT battle handed a carriage anyway (malicious options) stores none, and the excerpt carries no idea.
// The excerpt's own day is the Sep 23 fixture (__fixtures__/excerptFixtures.js); only the battle's agentContext is the
// one the writer produced.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored } from '../__fixtures__/callsFirestore.js';
import { makeDeployDb } from '../__fixtures__/deployHarness.js';

const state = vi.hoisted(() => ({ flag: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const { createAgentBattle } = await import('../agentBattleService.js');
const { siblingOf } = await import('../hypothesisRecords/carriage.js');
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): see momentExcerpt.test.js — never mocked.
const { excerptOf } = await import('./momentExcerpt.js');
const { carriedIdeaOf } = await import('../../../src/utils/filmRoomSubject.js');
const fx = await import('./__fixtures__/excerptFixtures.js');

const NOW = '2026-09-22T15:00:00.000Z';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const LIT = Object.freeze({ dark: false, descriptor: null });
const VERSION_PATH = `watchlists/${fx.EXCERPT_WATCHLIST}/hypothesisVersions/v${fx.EXCERPT_IDEA_VERSION}`;
/** The version as the store holds it before its first deploy: `ready`, its content hash the store's own. */
const readyVersion = () => fx.ideaVersionDoc({ status: 'ready', stateSource: 'player', stateReason: 'player_ready' });
const list = () => ({ watchlistId: fx.EXCERPT_WATCHLIST, userId: fx.OWNER, name: 'Industrials', status: 'committed', tickers: [{ symbol: 'ETN' }, { symbol: 'MU' }] });
const snapshot = () => ({ watchlistId: fx.EXCERPT_WATCHLIST, name: 'Industrials', tickers: ['ETN', 'MU'] });
function agentData() {
  return {
    id: fx.AGENT, ownerId: fx.OWNER, name: 'Viper', archetype: 'momentum_chaser', activeRules: [], equippedBundleIds: [],
    lastDecision: {
      portfolio: {
        star: [{ symbol: 'AAPL', baseATR: 3 }, { symbol: 'MSFT', baseATR: 3 }],
        core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
        support: [{ symbol: 'JPM' }, { symbol: 'XOM' }, { symbol: 'BTC', isCrypto: true }],
      },
      bench: { stocks: [{ symbol: 'COST' }, { symbol: 'LLY' }, { symbol: 'UNH' }], crypto: { symbol: 'ETH', isCrypto: true } },
      strategyBrief: 'brief', innerMonologue: {},
      watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
    },
  };
}
/** A battle created through the REAL writer, handed the version's carriage; its stored document. */
async function deployed(over = {}) {
  const db = makeDeployDb({ [`watchlists/${fx.EXCERPT_WATCHLIST}`]: list(), [VERSION_PATH]: readyVersion() });
  const { id } = await createAgentBattle(db, agentData(), {}, {}, { equippedWatchlist: snapshot(), equippedHypothesis: siblingOf(readyVersion()), activationPin: LIT, ...over });
  return stored(db, `agentBattles/${id}`);
}

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.flag = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = fx.OWNER;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.restoreAllMocks();
});

const DAY = await fx.excerptDay();
/** The excerpt of the fixture's ETN moment, its battle carrying the agentContext the writer produced. */
const excerptUnder = async (agentContext) => {
  const battle = { ...DAY.fx.battle, agentContext };
  const store = fx.excerptStore(DAY, { over: { [`agentBattles/${fx.EXCERPT_BATTLE}`]: battle } });
  return excerptOf(fx.dbOf(store).db, { uid: fx.OWNER, attributionAgentId: fx.AGENT, battleId: fx.EXCERPT_BATTLE, etDate: fx.SEP23, moment: fx.ETN_MOMENT });
};

describe('CD-8 — the idea the REAL deploy writer froze on the battle', () => {
  it('an ordinary deploy freezes the carriage; the excerpt reads exactly its list, version and hash — the idea with its statement, from the version that agrees with it', async () => {
    const battle = await deployed();
    expect(carriedIdeaOf(battle)).toEqual({ watchlistId: fx.EXCERPT_WATCHLIST, hypothesisVersion: fx.EXCERPT_IDEA_VERSION, contentHash: fx.EXCERPT_CONTENT_HASH });
    const got = await excerptUnder(battle.agentContext);
    expect(got.excerpt.idea).toEqual({ label: 'i1', version: { value: fx.EXCERPT_IDEA_VERSION, class: 'recorded' }, statement: { text: fx.EXCERPT_STATEMENT, by: 'player', at: fx.ideaVersionDoc().createdAt, class: 'quoted' } });
    expect(got.refs.i1).toBe(fx.EXCERPT_WATCHLIST);
  });
  it('A TOURNAMENT BATTLE handed a carriage anyway (malicious options) stores none — and the excerpt carries no idea', async () => {
    const battle = await deployed({ gameMode: 'baggerbomb_tournament', groupId: 'grp-1', tournament: {} });
    expect('equippedHypothesis' in battle.agentContext).toBe(false);
    expect(carriedIdeaOf(battle)).toBeNull();
    const got = await excerptUnder(battle.agentContext);
    expect(got).not.toBeNull();
    expect(got.excerpt.idea).toBeUndefined();
    expect(got.refs.i1).toBeUndefined();
  });
  it('a deploy with no carriage passed stores none — no idea, though the version exists', async () => {
    const db = makeDeployDb({ [`watchlists/${fx.EXCERPT_WATCHLIST}`]: list(), [VERSION_PATH]: readyVersion() });
    const { id } = await createAgentBattle(db, agentData(), {}, {}, { equippedWatchlist: snapshot(), activationPin: LIT });
    const battle = stored(db, `agentBattles/${id}`);
    expect(carriedIdeaOf(battle)).toBeNull();
    expect((await excerptUnder(battle.agentContext)).excerpt.idea).toBeUndefined();
  });
});
