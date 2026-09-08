// api/_utils/voiceLayerTradeNarration.grounding.test.js
//
// Voice-layer grounding §4 (F8) — trade narration is RETIRED under the flag:
// the model call is not made; the tape's trade card is the notice. Spec §10:
// "narration: no call under the flag (a mocked client asserts zero calls)".
//
//   'on', owner passed by the caller  → no read, no call, no write, a breadcrumb
//   'on', owner not passed            → the battle read, then retired before any call
//   'off' / 'shadow'                  → the shipped path: one call, one exchange

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', reads: 0, updates: [], gemmaCalls: [], logs: [] }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVoiceGroundingMode: () => state.mode,
}));
vi.mock('./gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async (opts) => { state.gemmaCalls.push(opts); return { success: true, content: '{"response":"Sold KO, brought AVGO in."}' }; },
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('./shadowLogger.js', () => ({ logTradeNarration: async (r) => { state.logs.push(r); return true; } }));
vi.mock('./voiceLayerPrompt.js', () => ({
  buildTradeNarrationPrompt: () => 'NARRATION_PROMPT',
  detectTradeProvenance: () => 'autopilot',
  getAgentPhase: () => 'discovery',
}));
vi.mock('./termUniverse.js', () => ({ TERM_TOKENS: [] }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (v) => ({ __arrayUnion: v }) } }));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { generateTradeNarration } = await import('./voiceLayerTradeNarration.js');

const BATTLE = { ownerId: 'owner-1', agentId: 'agent-1', status: 'active', portfolio: { star: [], core: [], support: [] }, trades: [] };
const AGENT = { name: 'Vega', archetype: 'momentum_chaser', stats: { gamesPlayed: 3 } };
const CLOSED_TRADE = { symbolOut: 'KO', symbolIn: 'AVGO', tier: 'support', rationale: 'KO went dead money.', evaluationId: 'eval_004' };

function makeDb() {
  const snap = (data, id) => ({ exists: data != null, id, data: () => data });
  const doc = (col, id) => ({
    get: async () => {
      state.reads += 1;
      if (col === 'agentBattles') return snap(BATTLE, id);
      if (col === 'agents') return snap(AGENT, id);
      return snap(null, id);
    },
    update: async (u) => { state.updates.push(u); },
  });
  return { collection: (col) => ({ doc: (id) => doc(col, id) }) };
}

beforeEach(() => {
  state.mode = 'off';
  state.reads = 0;
  state.updates = [];
  state.gemmaCalls = [];
  state.logs = [];
});

describe('trade narration under the grounding flag', () => {
  it("'on' with the owner passed: NO read, NO model call, NO exchange — a breadcrumb only", async () => {
    state.mode = 'on';
    await generateTradeNarration({ db: makeDb(), battleId: 'battle-1', agentId: 'agent-1', closedTrade: CLOSED_TRADE, evalId: 'eval_004', ownerId: 'owner-1' });
    expect(state.reads).toBe(0);
    expect(state.gemmaCalls).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0]).toMatchObject({ success: false, errorStep: 'grounding_retired', errorReason: 'voice_grounding_on', battleId: 'battle-1', evalId: 'eval_004' });
    expect(state.logs[0].swap).toEqual({ symbolOut: 'KO', symbolIn: 'AVGO', tier: 'support', evaluationId: 'eval_004' });
  });

  it("'on' without the owner: the battle is read, then retired before any model call or write", async () => {
    state.mode = 'on';
    await generateTradeNarration({ db: makeDb(), battleId: 'battle-1', agentId: 'agent-1', closedTrade: CLOSED_TRADE, evalId: 'eval_004' });
    expect(state.reads).toBeGreaterThan(0);
    expect(state.gemmaCalls).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(state.logs[0]).toMatchObject({ errorStep: 'grounding_retired' });
  });

  it.each(['off', 'shadow'])("'%s': the shipped path — one model call and one narration exchange written", async (mode) => {
    state.mode = mode;
    await generateTradeNarration({ db: makeDb(), battleId: 'battle-1', agentId: 'agent-1', closedTrade: CLOSED_TRADE, evalId: 'eval_004', ownerId: 'owner-1' });
    expect(state.gemmaCalls).toHaveLength(1);
    expect(state.updates).toHaveLength(1);
    const exchange = state.updates[0].chatExchanges.__arrayUnion;
    expect(exchange.messageType).toBe('trade_narration');
    expect(exchange.agentResponse).toBe('Sold KO, brought AVGO in.');
    // The shipped exchange shape carries no grounding marker: the old prompt wrote it.
    expect('groundingVersion' in exchange).toBe(false);
    expect(state.logs[0]).toMatchObject({ success: true });
  });
});
