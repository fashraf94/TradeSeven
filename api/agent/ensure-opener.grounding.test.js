// api/agent/ensure-opener.grounding.test.js
//
// Voice-layer grounding — the lazy opener is the ONE opener writer the arc can
// stamp (the deploy-time opener is fenced, Sep 7 ruling 4). Under 'on' for the
// battle's owner: the generated opener is built under the §7 contract
// (`grounded: true`), the floor stops after the archetype sentence (the floor
// builder is asked for `grounded: true`), and either exchange carries the
// top-level `groundingVersion: 1` marker (§3.4, M3). Under 'off' and 'shadow'
// the shipped shape, byte for byte.
//
// Mock shape mirrors ensure-opener.test.js; the two builders are spies so the
// arguments they were asked for are observable.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', calls: [], firstMessageArgs: [], templateArgs: [] }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  OPENER_LAZY_FALLBACK_ENABLED: true,
  getVoiceGroundingMode: (uid) => { state.calls.push(uid); return state.mode; },
}));
vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildFirstMessagePrompt: (args) => { state.firstMessageArgs.push(args); return 'SYSTEM_PROMPT'; },
  getAgentPhase: () => 'discovery',
}));
vi.mock('../_utils/termUniverse.js', () => ({ TERM_TOKENS: [] }));
vi.mock('../_utils/openerTemplateFloor.js', () => ({
  buildTemplateOpener: (args) => { state.templateArgs.push(args); return 'TEMPLATE_OPENER'; },
}));

const gemma = vi.hoisted(() => ({ callGemmaVoice: vi.fn(), parseVoiceLayerResponse: vi.fn() }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: gemma.callGemmaVoice,
  parseVoiceLayerResponse: gemma.parseVoiceLayerResponse,
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (v) => ({ __arrayUnion: v }) } }));

let db;
function snap(data) { return { exists: data != null, id: data?.__id, data: () => data }; }
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: (col) => ({
      doc: (id) => ({
        __col: col, __id: id,
        get: async () => {
          if (col === 'agentBattles') return snap(db.battle?.__id === id ? db.battle : null);
          if (col === 'agents') return snap(db.agent?.__id === id ? db.agent : null);
          return snap(null);
        },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => (ref.__col === 'agentBattles' ? snap(db.battle) : snap(null)),
      update: (ref, data) => { db.updates.push({ col: ref.__col, data }); },
    }),
  }),
}));

const { default: handler } = await import('./ensure-opener.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

beforeEach(() => {
  state.mode = 'off';
  state.calls = [];
  state.firstMessageArgs = [];
  state.templateArgs = [];
  gemma.callGemmaVoice.mockReset();
  gemma.parseVoiceLayerResponse.mockReset();
  db = {
    battle: { __id: 'b1', ownerId: 'owner-1', status: 'active', agentId: 'a1', chatExchanges: [], portfolio: { star: [], core: [], support: [] } },
    agent: { __id: 'a1', name: 'Vega', archetype: 'momentum_chaser', stats: { gamesPlayed: 1 } },
    updates: [],
  };
});

const generatedGemma = () => {
  gemma.callGemmaVoice.mockResolvedValue('{"response":"Agent is live."}');
  gemma.parseVoiceLayerResponse.mockReturnValue({ response: 'Agent is live.', _scratchpad: null });
};
const abortingGemma = () => {
  gemma.callGemmaVoice.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
};
const exchangeWritten = () => db.updates.find((u) => u.data.chatExchanges)?.data.chatExchanges.__arrayUnion;

describe('ensure-opener under the grounding flag', () => {
  it("asks the accessor once, with the owner's uid (the ownership check precedes it, so the caller's and the owner's uid are one here)", async () => {
    generatedGemma();
    await handler({ method: 'POST', body: { battleId: 'b1' } }, mkRes());
    expect(state.calls).toEqual(['owner-1']);
  });

  it("'on' + generated: the §7 prompt is asked for, and the exchange carries the marker", async () => {
    state.mode = 'on';
    generatedGemma();
    const res = mkRes();
    await handler({ method: 'POST', body: { battleId: 'b1' } }, res);
    expect(res.body.status).toBe('generated');
    expect(state.firstMessageArgs[0].grounded).toBe(true);
    const ex = exchangeWritten();
    expect(ex.messageType).toBe('first_message');
    expect(ex.groundingVersion).toBe(1);
  });

  it("'on' + floored: the floor is asked for the grounded template, and the exchange carries the marker", async () => {
    state.mode = 'on';
    abortingGemma();
    const res = mkRes();
    await handler({ method: 'POST', body: { battleId: 'b1' } }, res);
    expect(res.body.status).toBe('floored');
    expect(state.templateArgs[0].grounded).toBe(true);
    expect(exchangeWritten().groundingVersion).toBe(1);
  });

  it.each(['off', 'shadow'])("'%s': the shipped opener — not grounded, no marker on the exchange", async (mode) => {
    state.mode = mode;
    generatedGemma();
    await handler({ method: 'POST', body: { battleId: 'b1' } }, mkRes());
    expect(state.firstMessageArgs[0].grounded).toBe(false);
    const ex = exchangeWritten();
    expect(ex.messageType).toBe('first_message');
    expect('groundingVersion' in ex).toBe(false);
  });

  it("'off' + floored: the shipped floor — the builder is asked for grounded: false", async () => {
    abortingGemma();
    await handler({ method: 'POST', body: { battleId: 'b1' } }, mkRes());
    expect(state.templateArgs[0].grounded).toBe(false);
    expect('groundingVersion' in exchangeWritten()).toBe(false);
  });
});
