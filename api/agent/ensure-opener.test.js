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
      // Simulate the battle being deleted during the (long) Gemma window.
      if (state.deleteBattleBeforeTx) {
        state.battle = null;
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
    index: {}, cache: {}, updates: [], injectOpenerBeforeTx: false, deleteBattleBeforeTx: false,
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

  it('battle_gone: battle deleted during the Gemma window → no write, no 500', async () => {
    gemma.callGemmaVoice.mockResolvedValue('{"response":"Hi"}');
    gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Hi' });
    state.deleteBattleBeforeTx = true;
    const res = mkRes();
    await handler(mkReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('battle_gone');
    expect(state.updates).toHaveLength(0);
  });

  it('a client-supplied agentId naming another agent is REFUSED, not ignored', async () => {
    const res = mkRes();
    // battle.agentId is 'a1'; a client passes a different id. This row used to
    // assert the id was IGNORED and the opener generated anyway; the agent
    // binding check supersedes that — silently opening a different agent's name
    // than the caller asked for is the wrong answer to a wrong request.
    await handler(mkReq({ battleId: 'b1', agentId: 'evil-arbitrary-id' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    // The guarantee this row was written for is intact and stronger: the agent
    // doc is still resolved from battle.agentId (the MATCH row below opens with
    // the battle's own id and never with the body's), and a body id can no
    // longer be sent without matching it — nor omitted.
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

  it('a battle with no agentId is refused by the binding check, before the 422 branch', async () => {
    state.battle.agentId = undefined;
    const res = mkRes();
    // The 422 branch ('battle has no agentId') is now UNREACHABLE through the
    // handler and this row says so rather than pretending to guard it: the
    // binding check is unconditional, and a battle whose own agentId is absent
    // can match no body id at all, so every such call stops at the 403. The
    // branch stays as defence in depth against a future reordering.
    await handler(mkReq({ battleId: 'b1', agentId: 'a1' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    expect(state.updates).toHaveLength(0);
  });
});

describe('ensure-opener — the agent must belong to this battle', () => {
  // Ownership proves the battle is the caller's; it does not prove the agent
  // they named is the one this battle is bound to. `POST /api/agent/file-directive`
  // has carried this check since it shipped; these rows are the lazy opener's,
  // through the same shared predicate (agentBattleBinding.js).
  it('MISMATCH: a body naming another agent → 403, no Gemma call, no write', async () => {
    const res = mkRes();
    await handler(mkReq({ battleId: 'b1', agentId: 'a2' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    expect(gemma.callGemmaVoice).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });

  it('MATCH: the battle\'s own agent opens exactly as before', async () => {
    gemma.callGemmaVoice.mockResolvedValue('{"response":"Deployed."}');
    gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Deployed.' });
    const res = mkRes();
    await handler(mkReq({ battleId: 'b1', agentId: 'a1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('generated');
    expect(state.updates).toHaveLength(1);
  });

  it('ABSENT: a body with no agentId is refused too — the check is UNCONDITIONAL', async () => {
    // Both shipped callers send the battle's own agentId now (AgentChat.jsx,
    // mounted by the Battle View controller column and by the arena's Command
    // Center tab), so an absent id is no longer the shipped shape — it is a
    // caller that has not proved which agent it means. The conditional branch
    // that waved it through is gone; nothing is generated and nothing written.
    gemma.callGemmaVoice.mockResolvedValue('{"response":"Deployed."}');
    gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Deployed.' });
    const res = mkRes();
    await handler(mkReq({ battleId: 'b1' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    expect(gemma.callGemmaVoice).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });

  it('an EMPTY-STRING agentId is refused as well (the predicate takes no falsy id)', async () => {
    const res = mkRes();
    await handler(mkReq({ battleId: 'b1', agentId: '' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    expect(state.updates).toHaveLength(0);
  });
});
