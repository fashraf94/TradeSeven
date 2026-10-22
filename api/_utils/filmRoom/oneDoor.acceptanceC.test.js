// api/_utils/filmRoom/oneDoor.acceptanceC.test.js
//
// Film Room B2 item 7 — ACCEPTANCE C (shared contract §9; Build B spec §4
// "One door"): with entries at `card` and `nominated` (and a retired one) in
// the ledger, the assembled trading prompt is BYTE-IDENTICAL to the one with
// an empty ledger. The fenced assemblers are CALLED, never edited
// (BUILD_RULES §1): the evaluator's system prompt, the identity block, the
// live-context block and the portfolio CSV (agentEvalPromptAssembly.js), and
// the deploy path's strategy and portfolio prompts (agentPromptAssembly.js).
// The Admin SDK handle every assembler would read through is the tape
// suites' in-memory Firestore, SEEDED with the ledger under the battle's own
// agent, so a read of `plays` anywhere in the assembly would show in its read
// log — and none does. The seeded ledger is proven readable (a readCards on
// the same handle returns the entries), so the comparison is not vacuous.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ db: null }));
vi.mock('../firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db, getFirebaseAuth: () => ({}) }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const { cacheDbDouble } = await import('../__fixtures__/eodhdQuoteFixtures.js');
  return { ...(await importOriginal()), getFirestore: () => cacheDbDouble() };
});

const { buildEvalSystemPrompt, buildAgentIdentityBlock, buildLiveContextBlock, buildPortfolioCSV } = await import('../agentEvalPromptAssembly.js');
const { buildStrategySystemPrompt, buildStrategyUserPrompt, buildPortfolioSystemPrompt } = await import('../agentPromptAssembly.js');
const { makeTickBattle, makePriceTable } = await import('../__fixtures__/tickStampsHarness.js');
const { makeTapeDb } = await import('../filmTape/__fixtures__/tapeFirestore.js');
const { createCard, retireCard, readCards } = await import('./cardStore.js');

vi.setConfig({ testTimeout: 30_000 });

const UID = 'owner-uid-1';
const AGENT = 'agent-1';
const NOW = '2026-09-09T02:00:00.000Z';
const payload = (over = {}) => ({ archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2, battleId: 'b-earlier', etDate: '2026-09-08', symbol: 'NVDA', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner next time.', route: 'watch', ...over });

/** A fresh handle: the battle's agent, and — when `seeded` — the ledger with a card, a nominated entry and a retired one. */
async function handleOf(seeded) {
  const t = makeTapeDb({ [`agents/${AGENT}`]: { ownerId: UID, name: 'Aurora', archetype: 'momentum_chaser' } });
  if (seeded) {
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c_card', payload: payload(), nowIso: NOW });
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c_nominated', payload: payload({ route: 'drill', note: 'Practice the exit.' }), nowIso: '2026-09-09T02:01:00.000Z' });
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c_retired', payload: payload({ route: 'set', note: 'A setting to change.' }), nowIso: '2026-09-09T02:02:00.000Z' });
    await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c_retired', opId: 'r_1', expectedVersion: 1, nowIso: '2026-09-09T02:03:00.000Z' });
    t.readLog.length = 0;
  }
  return t;
}

/** The agent as the deploy path hands it to the strategy prompt. */
const agent = () => ({ id: AGENT, name: 'Aurora', archetype: 'momentum_chaser', memory: [{ gameId: 'g1', score: 12, result: 'win', lesson: 'Stay with winners.' }], consolidatedInsight: 'Patience pays.', evolutionCycle: 2, activeRules: [], personality: { traits: ['patient'] } });

/** Every assembler, called as the model paths call it; the outputs as one object. */
async function assemble() {
  const battle = makeTickBattle({ agentId: AGENT, ownerId: UID });
  const prices = makePriceTable();
  const out = {};
  out.evalSystem = buildEvalSystemPrompt('Aurora', 'momentum_chaser', 'baggerbomb_agent', 'momentum_chaser');
  out.identity = buildAgentIdentityBlock(battle);
  out.liveContext = await buildLiveContextBlock(battle, prices, { SPY: 0, QQQ: 0, BTC: 0 }, [], [], [], [], {}, null);
  out.portfolioCsv = buildPortfolioCSV([], prices, battle, {});
  out.strategySystem = buildStrategySystemPrompt('SYM,sector,price\nNVDA,Technology,100', 'no stories', 'momentum_chaser');
  out.strategyUser = buildStrategyUserPrompt(agent(), null);
  out.portfolioSystem = buildPortfolioSystemPrompt('a brief', 'SYM,score\nNVDA,80', [], '', null);
  return out;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('acceptance C — the assembled trading prompt with a ledger is byte-identical to one with an empty ledger', () => {
  it('the ledger is really there, under the battle\'s agent, readable through the very handle the assemblers get', async () => {
    const t = await handleOf(true);
    const r = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(r.cards.map((c) => [c.entryId, c.stage])).toEqual([['c_retired', 'retired'], ['c_nominated', 'nominated'], ['c_card', 'card']]);
    expect(r.open).toBe(2);
  });

  it('every assembler: the same bytes with and without the ledger, and no read of plays in either run', async () => {
    const empty = await handleOf(false);
    state.db = empty.db;
    const without = await assemble();
    const seeded = await handleOf(true);
    state.db = seeded.db;
    const withLedger = await assemble();
    expect(Object.keys(withLedger)).toEqual(['evalSystem', 'identity', 'liveContext', 'portfolioCsv', 'strategySystem', 'strategyUser', 'portfolioSystem']);
    for (const [k, v] of Object.entries(withLedger)) {
      expect(typeof v, k).toBe('string');
      expect(v.length, k).toBeGreaterThan(50);
      expect(v, k).toBe(without[k]);
      expect(v, k).not.toContain('Let it go sooner');
      expect(v, k).not.toContain('Practice the exit');
    }
    for (const log of [empty.readLog, seeded.readLog]) expect(log.filter((r) => /plays/.test(r))).toEqual([]);
  });

  it('the bite: a prompt that DID read the ledger would differ — the comparison can fail', async () => {
    const seeded = await handleOf(true);
    const r = await readCards(seeded.db, { uid: UID, agentId: AGENT });
    const leaked = `${buildStrategyUserPrompt(agent(), null)}\n${r.cards.map((c) => c.note).join('\n')}`;
    expect(leaked).not.toBe(buildStrategyUserPrompt(agent(), null));
    expect(seeded.readLog.filter((x) => /plays/.test(x)).length).toBeGreaterThan(0);
  });
});
