// api/agent/chat.sheetModeOff.golden.test.js
//
// Research Modal Build C — THE NON-RESEARCH TURN GOLDEN (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.3 "only research-modal
// Asks get the id; every other exchange is written exactly as on main", §6 "a
// byte-identical prompt and exchange for a non-research chat turn").
//
// GENERATED at the pre-build product tree: the golden file was written by this
// harness (GENERATE_SHEET_MODE_OFF_GOLDEN=1) at the branch's flag commit, whose
// api/agent/chat.js and api/_utils/voiceLayerPrompt.js are byte-identical to
// main f095dc29. Never regenerate it from build output.
//
// Each scene drives the REAL handler (the harness of chat.test.js: Firestore,
// auth, the model and the prompt builder are fakes) through one ordinary turn
// that sends NO researchAsk, and records three things: the named inputs the
// prompt builder received (every key and value — a new key such as
// `researchAsk` would fail here), the battle-document update (the exchange
// and the budget charge), and the response body. The prompt TEXT for a
// non-research turn is held by the existing voice-layer goldens, which run
// against the real builder.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const H = vi.hoisted(() => ({
  gemma: { impl: async () => '{"response":"hi"}' },
  promptArgs: [],
  archetype: { mode: 'off' },
  grounding: { mode: 'off' },
  calls: { mode: 'off' },
}));
let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'test-user' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async () => true }));
vi.mock('../_utils/voiceLayerPrompt.js', () => ({
  buildVoiceLayerPrompt: (args) => { H.promptArgs.push(args); return `system-prompt-stub:${args.grounded ? 'new' : 'old'}`; },
}));
vi.mock('../_utils/tournamentTime.js', () => ({ getTournamentClaimWindow: () => ({ isOpen: true, etTime: '12:00', reason: null }), formatEtDate: () => '2026-06-26' }));
vi.mock('../_utils/marketSchedule.js', () => ({ getMarketState: () => ({ state: 'OPEN', isOpen: true }) }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: (opts) => H.gemma.impl(opts),
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return H.archetype.mode; },
  get LEAGUE_AGENT_CHAT_ENABLED() { return false; },
  getVoiceGroundingMode: () => H.grounding.mode,
  get SHOW_IT_ENABLED() { return false; },
  get DIRECTIVE_FIT_CHECK_ENABLED() { return false; },
  get CALL_RECORDS_MODE() { return H.calls.mode; },
}));
vi.mock('../_utils/agentChatBudget.js', () => ({
  AGENT_CHAT_DAILY_LIMIT: 10,
  resolveBudgetDay: async () => null,
  readAgentChatBudget: async () => ({ count: 0, remaining: 10 }),
  chargeAgentChatBudget: async () => ({ charged: true, remaining: 9, count: 1 }),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...items) => ({ __op: 'arrayUnion', items }),
    increment: (n) => ({ __op: 'increment', n }),
  },
}));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { default: handler } = await import('./chat.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__goldens__', 'chat.sheetModeOff.golden.json');
const GENERATE = process.env.GENERATE_SHEET_MODE_OFF_GOLDEN === '1';

function fakeFirestore({ agent, battle }) {
  const written = [];
  const collection = (name) => ({
    doc: (id) => ({
      id,
      get: async () => {
        if (name === 'agents') return { exists: !!agent, data: () => agent };
        if (name === 'agentBattles') return { exists: !!battle, data: () => battle };
        return { exists: false, data: () => null };
      },
      update: async (u) => { written.push({ id, updates: u }); },
      collection: () => ({ where: () => ({}), doc: (sub) => ({ id: sub, path: `${name}/${id}/x/${sub}` }) }),
    }),
  });
  const batch = () => {
    const ops = [];
    return { update: (ref, u) => ops.push({ id: ref.id, updates: u }), create: () => {}, commit: async () => { written.push(...ops); } };
  };
  return { db: { collection, batch }, written };
}
const reqRes = (body) => {
  const req = { method: 'POST', body, headers: { authorization: 'Bearer x' } };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return { req, res };
};

const AGENT = { ownerId: 'test-user', name: 'Juno', archetype: 'momentum_chaser', partnerProfile: {} };
const BATTLE = {
  ownerId: 'test-user', agentId: 'agent-1', status: 'active', gameMode: 'standard',
  chatBudgetUsed: 3, reviewBudgetUsed: 0, chatExchanges: [], recentElicitationTargets: [],
  agentContext: { archetype: 'momentum_chaser', agentName: 'Juno' },
  portfolio: { star: [{ symbol: 'EOG', name: 'EOG Resources' }], core: [], support: [] },
  scoreState: { currentScore: 12, opponentScore: 20 },
};

// Timestamps are the wall clock; uuids are minted per run. Both are masked.
const stable = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'function' ? '[function]' : x === undefined ? '[undefined]' : x))
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<iso>')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>'));

async function turn({ body, gemma, archetype = 'off', grounding = 'off' }) {
  H.promptArgs.length = 0;
  H.archetype.mode = archetype;
  H.grounding.mode = grounding;
  H.gemma.impl = gemma;
  const fx = fakeFirestore({ agent: AGENT, battle: JSON.parse(JSON.stringify(BATTLE)) });
  activeFirestore = fx.db;
  const { req, res } = reqRes(body);
  await handler(req, res);
  return stable({
    status: res.statusCode,
    response: res.body,
    // The named inputs, minus the two documents (they are the fixture itself).
    promptInputs: H.promptArgs.map(({ agent, battle, ...rest }) => ({ ...rest, keys: Object.keys({ agent, battle, ...rest }).sort() })),
    written: fx.written,
  });
}

const SCENES = {
  // The shipped chat path: flag-off integrity, no directive.
  plain_turn: () => turn({ body: { agentId: 'agent-1', battleId: 'battle-1', message: 'How is EOG doing?' }, gemma: async () => '{"response":"EOG is holding its trend."}' }),
  // Integrity enforce with a directive the gate passes: the threadId and slot are written.
  enforce_turn_with_directive: () => turn({
    body: { agentId: 'agent-1', battleId: 'battle-1', message: 'Hold EOG through the close.' },
    archetype: 'enforce',
    gemma: async () => JSON.stringify({ response: 'Holding EOG.', hasDirective: true, directive: { text: 'Hold EOG through the close', expiry: 'end_of_day' } }),
  }),
  // A body that carries an unknown extra field: ignored today.
  plain_turn_extra_field: () => turn({ body: { agentId: 'agent-1', battleId: 'battle-1', message: 'And now?', somethingElse: { a: 1 } }, gemma: async () => '{"response":"Same."}' }),
  // A refused turn (budget spent) writes nothing.
  budget_spent: async () => {
    const saved = BATTLE.chatBudgetUsed;
    BATTLE.chatBudgetUsed = 10;
    try { return await turn({ body: { agentId: 'agent-1', battleId: 'battle-1', message: 'One more?' }, gemma: async () => '{"response":"x"}' }); } finally { BATTLE.chatBudgetUsed = saved; }
  },
};

describe('non-research chat turns: the prompt inputs, the exchange and the response are exactly main\'s (Build C spec §4.3, §6)', () => {
  const golden = !GENERATE && existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : null;
  const out = {};
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterAll(() => {
    if (!GENERATE) return;
    mkdirSync(path.dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(out, null, 1)}\n`);
  });
  it.each(Object.keys(SCENES))('%s — same prompt inputs, same write, same response', async (name) => {
    const got = await SCENES[name]();
    if (GENERATE) { out[name] = got; return; }
    expect(golden, 'golden file missing — it is generated only at the pre-build tree').not.toBeNull();
    expect(got.status).toBe(golden[name].status);
    expect(got.promptInputs).toEqual(golden[name].promptInputs);
    expect(got.written).toEqual(golden[name].written);
    expect(got.response).toEqual(golden[name].response);
    // No research field anywhere on a non-research turn.
    expect(JSON.stringify(got)).not.toMatch(/exchangeId|research_modal|researchAsk/);
  });
});
