// api/_utils/cloneManifestParity.guard.test.js
//
// The casual clone carries the Character settings (rulings R-CC-1, R-CC-2,
// R-CC-3). What a clone copies (INHERITED_LOADOUT_FIELDS) and what a battle
// freezes (the manifest's agent reads) were two separate facts: the Character
// tab added leans and the tempo dial to the second and not the first, so every
// casual game ran without them and nothing failed. This guard ties the two:
//
//   - every agent field the manifest reads is on the inherited list or on
//     RANKED_ONLY_FIELDS, seen at runtime through a recording proxy (a dot, a
//     destructure, `in`, a key walk) and in the source (a read behind a branch
//     no fixture takes). A new manifest field on neither list fails here;
//   - a full ranked agent and each clone built from it through the real builders
//     freeze the same thing: the whole manifest but its own id, and the hash that
//     covers the id.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): real imports of both clone builders,
// the customization kernel, the manifest builder and the fenced createAgentBattle.
// Never mock them.

import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildCasualCloneDoc, buildCasualCloneResync } from './casualClone.js';
import { buildTrainingCloneDoc, INHERITED_LOADOUT_FIELDS, RANKED_ONLY_FIELDS } from './trainingClone.js';
import { buildResolvedAgentManifest } from './resolvedAgentManifest.js';
import { buildCustomizationSnapshot } from './leanRevalidation.js';
import { createAgentBattle } from './agentBattleService.js';
import { desiredTempoOf } from './tempoDialClamp.js';
import { makeCompositionStoreDouble } from './__fixtures__/compositionStoreDouble.js';
import { casualCloneDocId, trainingCloneDocId } from '../../src/constants/leagueTournament.js';
import { TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const NOW = '2026-11-01T15:00:00.000Z';
const OWNER = 'user-42';
const CHARACTER_FIELDS = ['standingLeans', 'standingLeansInvalidated', 'dials', 'settingsRev'];

// Every field the manifest reads holds a distinct, non-default value. TF-01 is on
// this archetype's menu and CP-04 is not, so a snapshot has both a valid side and
// an invalidated side.
const RANKED = Object.freeze({
  id: 'ranked-1',
  ownerId: OWNER,
  name: 'Viper',
  archetype: 'momentum_chaser',
  config: { risk: 72 },
  activeRules: [{ ruleId: 'tech-rsi-oversold', text: 'Prefer stocks with RSI below 30' }],
  equippedBundleIds: ['b1'],
  deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 8, enforcement: 'hard' }] },
  standingLeans: [
    { adjustmentId: 'TF-01', version: 1, equippedAt: NOW },
    { adjustmentId: 'CP-04', version: 1, equippedAt: NOW },
  ],
  standingLeansInvalidated: [{ adjustmentId: 'CP-04', version: 1, reason: 'not_in_menu' }],
  dials: { tempo: 'measured' },
  settingsRev: 17,
  // what a clone never takes: history, pointers
  memory: [{ gameId: 'old' }],
  stats: { wins: 9, losses: 1, gamesPlayed: 10, totalScore: 100, avgScore: 10, currentStreak: 3, bestStreak: 5 },
  activeBattleId: 'ranked-battle-live',
});

const WATCHLIST = { watchlistId: 'wl-1', name: 'Focus', tickers: ['NVDA'] };

const manifestOf = (agentData, compiledBuild = null) => buildResolvedAgentManifest({
  agentData, compiledBuild, equippedWatchlist: WATCHLIST, gameMode: TIERED_GAME_MODE, now: NOW,
});

/** A manifest without what names its own agent: the id, and the hash that covers the id. */
const decisionContent = (manifest) => {
  const content = { ...manifest };
  delete content.manifestId;
  delete content.manifestHash;
  return content;
};

const CASUAL_ID = casualCloneDocId(OWNER);
const casualAtCreation = () => ({ id: CASUAL_ID, ...buildCasualCloneDoc(RANKED, { odUserId: OWNER, nowIso: NOW }) });
// The clone a player holds before this build: its list carried none of the settings.
const clonePredatingTheList = () => ({ id: CASUAL_ID, ...buildCasualCloneDoc({ id: RANKED.id, archetype: 'analyst' }, { odUserId: OWNER, nowIso: NOW }) });
const casualAfterResync = () => ({ ...clonePredatingTheList(), ...buildCasualCloneResync(RANKED) });
const trainingAtCreation = () => ({
  id: trainingCloneDocId('pod-1', OWNER),
  ...buildTrainingCloneDoc(RANKED, { groupId: 'pod-1', odUserId: OWNER, nowIso: NOW }),
});

const CLONES = [
  ['a casual clone at creation', casualAtCreation],
  ['a casual clone after a resync', casualAfterResync],
  ['a training clone at creation', trainingAtCreation],
];

/**
 * The top-level agent fields `build` reads, by any route. A whole field is what a
 * clone copies, so the top level is the right grain: `config.risk` reads `config`.
 */
function fieldsReadBy(build, agent) {
  const read = new Set();
  build(new Proxy(agent, {
    get(target, key, receiver) {
      if (typeof key === 'string') read.add(key);
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      if (typeof key === 'string') read.add(key);
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      for (const key of Object.keys(target)) read.add(key);
      return Reflect.ownKeys(target);
    },
  }));
  return [...read].sort();
}

const unlisted = (fields, inherited = INHERITED_LOADOUT_FIELDS, rankedOnly = RANKED_ONLY_FIELDS) =>
  fields.filter((field) => !inherited.includes(field) && !rankedOnly.includes(field));

/** Each way through the manifest's branches: no build, a build at this rev, a build at another. */
const MANIFEST_BUILDS = [
  (agent) => manifestOf(agent),
  (agent) => manifestOf(agent, { sourceRevisionVector: { settingsRev: RANKED.settingsRev } }),
  (agent) => manifestOf(agent, { sourceRevisionVector: { settingsRev: RANKED.settingsRev + 1 } }),
];

const fieldsTheManifestReads = () => [...new Set(MANIFEST_BUILDS.flatMap((build) => fieldsReadBy(build, RANKED)))].sort();

/** `agentData.<field>` in the text: finds a read no fixture reaches. */
const agentDataReadsIn = (source) => [...source.matchAll(/\bagentData\??\.(\w+)/g)].map((m) => m[1]);

const manifestSource = () => readFileSync(new URL('./resolvedAgentManifest.js', import.meta.url), 'utf8');
const kernelSource = () => {
  const source = readFileSync(new URL('./leanRevalidation.js', import.meta.url), 'utf8');
  return source.slice(source.indexOf('export function buildCustomizationSnapshot'));
};

/** The agent decide.js hands the fenced createAgentBattle: the doc, plus the decision it just made. */
const deployable = (agent) => ({
  ...agent,
  lastDecision: {
    portfolio: {
      star: [{ symbol: 'AAPL', name: 'Apple', baseATR: 3 }, { symbol: 'MSFT', name: 'Microsoft', baseATR: 3 }],
      core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
      support: [{ symbol: 'GOOGL' }, { symbol: 'META' }, { symbol: 'BTC', isCrypto: true }],
    },
    bench: { stocks: [{ symbol: 'TSLA' }, { symbol: 'NFLX' }, { symbol: 'CRM' }], crypto: { symbol: 'ETH', isCrypto: true } },
    strategyBrief: 'brief',
    innerMonologue: {},
    watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
  },
});

/** The battle the real createAgentBattle writes for `agent`. */
async function battleOf(agent) {
  const added = [];
  const composition = makeCompositionStoreDouble();
  const db = {
    collection: (name) => composition.collection(name) ?? {
      add: async (doc) => { added.push(doc); return { id: 'battle-1' }; },
      doc: (id) => ({ id: id ?? 'battle-1', __collection: name }),
    },
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      create: async (_ref, doc) => { added.push(doc); },
    }),
  };
  await createAgentBattle(db, deployable(agent), {}, {}, { duration: '1d' });
  return added[0];
}

describe('R-CC-1 — the Character settings join the one list', () => {
  it.each(CLONES)('%s carries every one of them, by value', (_name, cloneOf) => {
    const clone = cloneOf();
    for (const field of CHARACTER_FIELDS) expect(clone[field], field).toEqual(RANKED[field]);
  });

  it('an archetype change on the ranked agent re-syncs leans and their invalidation together: the pair the next battle freezes is judged against the archetype that rode with them', () => {
    const switched = {
      ...RANKED,
      archetype: 'guardian',
      standingLeansInvalidated: [{ adjustmentId: 'TF-01', version: 1, reason: 'not_in_menu' }],
      settingsRev: 18,
    };
    const clone = { ...casualAtCreation(), ...buildCasualCloneResync(switched) };

    expect(clone.archetype).toBe('guardian');
    expect(clone.standingLeans).toEqual(switched.standingLeans);
    expect(clone.standingLeansInvalidated).toEqual(switched.standingLeansInvalidated);

    const frozen = buildCustomizationSnapshot(clone, NOW);
    expect(frozen).toEqual(buildCustomizationSnapshot(switched, NOW));
    expect(frozen.standingLeans.map((l) => l.adjustmentId)).toEqual(['CP-04']);
    expect(frozen.standingLeansInvalidated.map((l) => l.adjustmentId)).toEqual(['TF-01']);
  });
});

describe('R-CC-2 — a clone freezes what its ranked agent freezes', () => {
  it('every agent field the manifest reads at runtime is on the inherited list or on RANKED_ONLY_FIELDS', () => {
    const read = fieldsTheManifestReads();
    expect(read).toContain('settingsRev');
    expect(unlisted(read)).toEqual([]);
  });

  it('so is every field the source reads, a read behind a branch no fixture takes included', () => {
    const read = [...new Set([...agentDataReadsIn(manifestSource()), ...agentDataReadsIn(kernelSource())])];
    expect(read).toEqual(expect.arrayContaining(['activeRules', 'dials', 'settingsRev', 'standingLeans']));
    expect(unlisted(read)).toEqual([]);
  });

  it('no field sits on both lists', () => {
    expect(RANKED_ONLY_FIELDS.filter((field) => INHERITED_LOADOUT_FIELDS.includes(field))).toEqual([]);
  });

  it('the fixture sets every field the manifest reads: a field it leaves out would compare undefined with undefined', () => {
    for (const field of fieldsTheManifestReads()) expect(RANKED[field], field).toBeDefined();
  });

  it('the fixture is non-default: the snapshot holds both lean sides, the tempo and the rev', () => {
    expect(buildCustomizationSnapshot(RANKED, NOW)).toMatchObject({
      standingLeans: [{ adjustmentId: 'TF-01' }],
      standingLeansInvalidated: [{ adjustmentId: 'CP-04', reason: 'not_in_menu' }],
      dials: { tempo: 'measured' },
      settingsRev: 17,
    });
  });

  it.each(CLONES)('%s freezes the same content: the customization snapshot, the equipped config, its hash and the rest of the manifest', (_name, cloneOf) => {
    const clone = cloneOf();
    const ranked = manifestOf(RANKED);
    const cloned = manifestOf(clone);

    expect(buildCustomizationSnapshot(clone, NOW)).toEqual(buildCustomizationSnapshot(RANKED, NOW));
    expect(cloned.frozenLayers).toEqual(ranked.frozenLayers);
    expect(cloned.equippedConfigHash).toBe(ranked.equippedConfigHash);
    expect(decisionContent(cloned)).toEqual(decisionContent(ranked));
    // the two fields left out are the clone's own, and they do differ
    expect(cloned.manifestId).not.toBe(ranked.manifestId);
    expect(cloned.manifestHash).not.toBe(ranked.manifestHash);
  });

  it('the comparison sees every inherited field the manifest reads: a clone without any one of them differs', () => {
    const ranked = decisionContent(manifestOf(RANKED));
    const inherited = fieldsTheManifestReads().filter((field) => !RANKED_ONLY_FIELDS.includes(field));
    expect(inherited.length).toBeGreaterThanOrEqual(9);
    for (const field of inherited) {
      const clone = casualAtCreation();
      delete clone[field];
      expect(decisionContent(manifestOf(clone)), field).not.toEqual(ranked);
    }
  });

  it('a planted manifest field on neither list fails the runtime read; on a list it passes', () => {
    const planted = (agent) => {
      void agent.perAgentRuleVersion;
      return manifestOf(agent);
    };
    const read = fieldsReadBy(planted, RANKED);
    expect(unlisted(read)).toEqual(['perAgentRuleVersion']);
    expect(unlisted(read, [...INHERITED_LOADOUT_FIELDS, 'perAgentRuleVersion'])).toEqual([]);
    expect(unlisted(read, INHERITED_LOADOUT_FIELDS, [...RANKED_ONLY_FIELDS, 'perAgentRuleVersion'])).toEqual([]);
  });

  it('a planted read by a destructure, an `in` and a key walk are each seen', () => {
    const destructure = (agent) => { const { plantedA } = agent; return plantedA; };
    const within = (agent) => 'plantedB' in agent;
    const walk = (agent) => Object.keys(agent);
    expect(unlisted(fieldsReadBy(destructure, RANKED))).toEqual(['plantedA']);
    expect(unlisted(fieldsReadBy(within, RANKED))).toEqual(['plantedB']);
    expect(unlisted(fieldsReadBy(walk, { perAgentRuleVersion: 1 }))).toEqual(['perAgentRuleVersion']);
  });

  it('a planted read behind a branch no fixture takes fails the source read', () => {
    const planted = `${manifestSource()}\nif (neverTrue) use(agentData?.perAgentRuleVersion);\n`;
    expect(unlisted(agentDataReadsIn(planted))).toEqual(['perAgentRuleVersion']);
  });

  it.each(CLONES)('the fenced createAgentBattle, unchanged, freezes %s\'s settings on the battle: what evaluation reads and the manifest', async (_name, cloneOf) => {
    const clone = cloneOf();
    const ranked = await battleOf(RANKED);
    const battle = await battleOf(clone);

    expect(desiredTempoOf(battle)).toBe('measured');
    for (const field of CHARACTER_FIELDS) expect(battle.agentContext[field], field).toEqual(ranked.agentContext[field]);
    expect(battle.resolvedAgentManifest.frozenLayers.dials).toEqual({ tempo: 'measured' });
    expect(battle.resolvedAgentManifest.equippedConfigHash).toBe(ranked.resolvedAgentManifest.equippedConfigHash);
  });
});

describe('R-CC-3 — the change takes effect at the next deploy\'s resync', () => {
  it('a game already running keeps what it froze; the next game takes the new settings', async () => {
    const clone = casualAtCreation();
    const running = await battleOf(clone);
    const manifestAtStart = structuredClone(running.resolvedAgentManifest);
    expect(desiredTempoOf(running)).toBe('measured');

    const moved = { ...RANKED, dials: { tempo: 'standard' }, standingLeans: [], settingsRev: 18 };
    const resynced = { ...clone, ...buildCasualCloneResync(moved) };

    expect(running.resolvedAgentManifest).toEqual(manifestAtStart);
    expect(desiredTempoOf(running)).toBe('measured');
    expect(running.agentContext.standingLeans.map((l) => l.adjustmentId)).toEqual(['TF-01']);

    const next = await battleOf(resynced);
    expect(desiredTempoOf(next)).toBe('standard');
    expect(next.agentContext.standingLeans).toEqual([]);
    expect(next.agentContext.settingsRev).toBe(18);
    expect(next.resolvedAgentManifest.equippedConfigHash).not.toBe(manifestAtStart.equippedConfigHash);
  });
});
