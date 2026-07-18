import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));

// Feature flag: load the REAL module (preserves the BUILD_RULES §4
// dependency-surface guard — featureFlags.js must load clean in Node) and flip
// only the flag under test ON.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  OPENER_LAZY_FALLBACK_ENABLED: true,
}));

vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildFirstMessagePrompt: () => 'SYSTEM_PROMPT',
  getAgentPhase: () => 'discovery',
}));
vi.mock('../_utils/termUniverse.js', () => ({ TERM_TOKENS: [] }));
vi.mock('../_utils/openerTemplateFloor.js', () => ({ buildTemplateOpener: () => 'TEMPLATE_OPENER' }));

const gemma = vi.hoisted(() => ({ callGemmaVoice: vi.fn(), parseVoiceLayerResponse: vi.fn() }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: gemma.callGemmaVoice,
  parseVoiceLayerResponse: gemma.parseVoiceLayerResponse,
}));

// FieldValue.arrayUnion → tag objects so we can assert what got appended.
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (v) => ({ __arrayUnion: v }) },
}));

// Fake Firestore over a mutable `state` (reset per test).
let state;
function snap(data) { return { exists: data != null, id: data?.__id, data: () => data }; }
function docRef(col, id) {
  return {
    __col: col,
    __id: id,
    get: async () => {
      if (col === 'agentBattles') return snap(state.battle && state.battle.__id === id ? state.battle : null);
      if (col === 'agents') return snap(state.agent && state.agent.__id === id ? state.agent : null);
      if (col === 'indexIntelligence') return snap(state.index?.[id] ?? null);
      if (col === 'voiceLayerCache') return snap(state.cache?.[id] ?? null);
      return snap(null);
    },
  };
}
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: (col) => ({ doc: (id) => docRef(col, id) }),
    runTransaction: async (fn) => {
      // Simulate a racing writer landing an opener between the plain read and commit.
      if (state.injectOpenerBeforeTx) {
        state.battle.chatExchanges = [{ messageType: 'first_message', agentResponse: 'raced' }];
      }
      const tx = {
        get: async (ref) => docRef(ref.__col, ref.__id).get(),
        update: (ref, data) => { state.updates.push({ col: ref.__col, id: ref.__id, data }); },
      };
      return fn(tx);
    },
  }),
}));

const { default: handler } = await import('./ensure-opener.js');

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const mkReq = (body = { battleId: 'b1', agentId: 'a1' }, method = 'POST') => ({ method, body });

beforeEach(() => {
  state = {
    battle: { __id: 'b1', ownerId: 'owner-1', status: 'active', agentId: 'a1', chatExchanges: [] },
    agent: { __id: 'a1', archetype: 'analyst', stats: { gamesPlayed: 3 } },
    index: {}, cache: {}, updates: [], injectOpenerBeforeTx: false,
  };
  gemma.callGemmaVoice.mockReset();
  gemma.parseVoiceLayerResponse.mockReset();
});

describe('ensure-opener decision tree', () => {
  it('already_present: an existing first_message → no write', async () => {
    state.battle.chatExchanges = [{ messageType: 'first_message', agentResponse: 'hi' }];
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('already_present');
    expect(state.updates).toHaveLength(0);
  });

  it('no_action_needed: other content but no opener (late open) → no write', async () => {
    state.battle.chatExchanges = [{ messageType: 'anticipation', agentResponse: 'eyeing X' }];
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('no_action_needed');
    expect(state.updates).toHaveLength(0);
  });

  it('generated: empty chat + valid Gemma JSON → appends a first_message + statusFeed', async () => {
    gemma.callGemmaVoice.mockResolvedValue('{"response":"Hello there"}');
    gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Hello there', _scratchpad: 'plan' });
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('generated');
    expect(state.updates).toHaveLength(1);
    const written = state.updates[0].data.chatExchanges.__arrayUnion;
    expect(written.messageType).toBe('first_message');
    expect(written.agentResponse).toBe('Hello there');
    expect(written.userMessage).toBeNull();
    expect(written.scratchpad).toBe('plan');
    expect(state.updates[0].data.statusFeed.__arrayUnion.action).toBe('first_message');
  });

  it('floored: empty chat + Gemma aborts twice → appends the template floor (retried once)', async () => {
    gemma.callGemmaVoice.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('floored');
    expect(state.updates[0].data.chatExchanges.__arrayUnion.agentResponse).toBe('TEMPLATE_OPENER');
    expect(gemma.callGemmaVoice).toHaveBeenCalledTimes(2);
  });

  it('floored: empty chat + unparseable Gemma output → floor (bounded to 2 attempts)', async () => {
    gemma.callGemmaVoice.mockResolvedValue('not json');
    gemma.parseVoiceLayerResponse.mockReturnValue({ parseError: true, errorReason: 'plaintext_passthrough' });
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('floored');
    expect(gemma.callGemmaVoice).toHaveBeenCalledTimes(2);
  });

  it('transaction guard: an opener races in before commit → discards, no duplicate', async () => {
    gemma.callGemmaVoice.mockResolvedValue('{"response":"Hi"}');
    gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Hi' });
    state.injectOpenerBeforeTx = true; // fake tx re-read sees a first_message
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('already_present');
    expect(state.updates).toHaveLength(0);
  });
});

describe('ensure-opener guards', () => {
  it('405 on non-POST', async () => {
    const res = mkRes();
    await handler(mkReq({}, 'GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('400 when battleId is missing', async () => {
    const res = mkRes();
    await handler(mkReq({ agentId: 'a1' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('404 when the battle is not found', async () => {
    state.battle = null;
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.statusCode).toBe(404);
  });

  it('403 on an ownership mismatch', async () => {
    state.battle.ownerId = 'someone-else';
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.statusCode).toBe(403);
  });

  it('not_active on a non-active battle → no write', async () => {
    state.battle.status = 'completed';
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.body.status).toBe('not_active');
    expect(state.updates).toHaveLength(0);
  });
});
