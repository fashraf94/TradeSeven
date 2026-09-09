// api/agent/research.dark.test.js
//
// Phase C §6 — DARK BY DESIGN, proved end to end.
//
// The flag's whole promise, in one place: with SHOW_IT_ENABLED false the route
// does not exist, no chip can be minted, no door can render, and the grounded
// prompt is byte-identical to what it is without any of this. Named in the
// flag's own FLIP MAP docstring as the suite that does NOT move when the flag
// is flipped — it mocks the flag to an explicit false throughout.
//
// The flip PR moves showItFlags.test.js's pin and drops the DARK_BY_DESIGN
// entry; nothing here changes, because everything here is about the OFF state.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

const state = vi.hoisted(() => ({ reads: 0, marketCalls: 0, committed: [] }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
// EXPLICIT FALSE, not the ambient value: this suite asserts the OFF state, and
// it must keep asserting it after the founder's flip PR flips the real one.
// `isShowItOn` is defined INSIDE featureFlags.js and closes over the module's own
// binding, so spreading `importOriginal()` re-exports the ORIGINAL accessor and
// the `SHOW_IT_ENABLED: false` override never reaches it (review D-1/D-2 — the
// same trap captureFlagOffGolden.test.jsx documents for `isCharacterPaneOn`).
// Overriding the accessor too is what makes this suite hermetic, and what makes
// the flag's FLIP MAP claim — that this file does NOT move on the flip — true.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  SHOW_IT_ENABLED: false,
  isShowItOn: () => false,
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: async () => { state.marketCalls += 1; return { daily: [], price: {} }; },
}));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (...i) => ({ __op: 'arrayUnion', items: i }) } }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({ doc: () => ({ get: async () => { state.reads += 1; return { exists: false, data: () => undefined }; } }) }),
    runTransaction: async () => { throw new Error('a dark route must never open a transaction'); },
  }),
}));

// Dependency-surface guard (BUILD_RULES §4). Never mock it.
const { default: handler } = await import('./research.js');
const { buildVoiceLayerPrompt } = await import('../_utils/voiceLayerPrompt.js');
const { normalizeSuggestedActions, PLATFORM_RESEARCH_HEADING } = await import('../_utils/voiceLayerGrounding.js');
const { isShowItOn } = await import('../../src/config/featureFlags.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

const BATTLE = {
  id: 'battle-1',
  agentId: 'agent-1',
  status: 'active',
  portfolio: { star: [{ symbol: 'NVDA' }], core: [], support: [], bench: { stocks: [{ symbol: 'MPC' }] } },
  chatExchanges: [{ messageType: 'research', symbol: 'MPC', card: { symbol: 'MPC', platformDataLabel: 'Platform data · not what the check saw', technicals: { facts: ['RSI 62.4'], label: 'Technicals · as of Sep 8' } } }],
  evaluations: [],
};

beforeEach(() => { state.reads = 0; state.marketCalls = 0; state.committed = []; });

describe('the route does not exist', () => {
  it('404s a well-formed request — before any read, any fetch, any transaction', async () => {
    const res = mkRes();
    await handler({ method: 'POST', body: { agentId: 'agent-1', battleId: 'battle-1', symbol: 'MPC' } }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(state.reads).toBe(0);
    expect(state.marketCalls).toBe(0);
  });

  it('404s every shape — a valid one, a malformed one, an unauthorised symbol', async () => {
    for (const body of [{}, { agentId: 'a', battleId: 'b', symbol: 'TSLA' }, { agentId: 'a' }]) {
      const res = mkRes();
      await handler({ method: 'POST', body }, res);
      expect(res.statusCode).toBe(404);
    }
  });
});

describe('nothing can be minted', () => {
  it('the normalizer drops a research chip when no battle is handed over — which is what chat.js does while dark', () => {
    expect(normalizeSuggestedActions([{ kind: 'research', symbol: 'MPC' }], 'analyst')).toBeNull();
  });

  it('chat.js hands the battle over ONLY under the flag, read at call time', () => {
    const src = read('api/agent/chat.js');
    expect(src).toContain('SHOW_IT_ENABLED ? { battle } : {}');
  });
});

describe('nothing renders', () => {
  it('the client gate is the accessor, and it is off', () => {
    expect(isShowItOn()).toBe(false);
  });

  it('the screen passes no handler while it is off, so both doors are absent whole', () => {
    const src = read('src/screens/AgentBattleScreen.jsx');
    expect(src).toContain('onShowIt={showItOn ? handleShowIt : null}');
    expect(src.match(/onShowIt=\{showItOn \? handleShowIt : null\}/g)).toHaveLength(2); // the Why? door and the bench
  });
});

describe('the grounded prompt does not move', () => {
  const build = (battle) => buildVoiceLayerPrompt({
    agent: { id: 'agent-1', name: 'Vega', archetype: 'diversifier' },
    battle,
    elicitationTarget: { dimension: 'risk', instruction: 'Find out how they size risk.' },
    conversationHistory: [],
    marketSnapshot: null,
    grounded: true,
  });

  it('carries no PLATFORM RESEARCH block, no research rule and no third chip kind', () => {
    const prompt = build(BATTLE);
    expect(prompt).not.toContain(PLATFORM_RESEARCH_HEADING);
    expect(prompt).not.toContain('THE RESEARCH RULE');
    expect(prompt).not.toContain('"kind": "research"');
    expect(prompt).not.toContain('RSI 62.4');
  });

  it('is BYTE-IDENTICAL to the same battle with the research exchange removed', () => {
    expect(build(BATTLE)).toBe(build({ ...BATTLE, chatExchanges: [] }));
  });
});

describe('§6 — the cost and the cron budget', () => {
  it('adds NO cron entry: vercel.json still carries 39 of the 40 slots', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.crons).toHaveLength(39);
    expect(vercel.crons.some((c) => /research/i.test(c.path))).toBe(false);
  });

  it('the route reads the cache and the rankings and NOTHING else — no screener call (item 4)', () => {
    const src = read('api/agent/research.js');
    expect(src).toContain("db.collection('voiceLayerCache')");
    expect(src).toContain("db.collection('indexIntelligence').doc('stockRankings')");
    // Comments are stripped first — the route's own header explains WHY there
    // is no screener call, which is documentation, not a call.
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    expect(code).not.toMatch(/screenStocks|screener|gemma|Gemma|Anthropic|callGemma/);
  });

  it('opens exactly ONE transaction, and its only write is chatExchanges', () => {
    const src = read('api/agent/research.js');
    expect(src.match(/runTransaction/g)).toHaveLength(1);
    expect(src.match(/tx\.update\(/g)).toHaveLength(1);
    expect(src).toContain('tx.update(battleRef, { chatExchanges: FieldValue.arrayUnion(exchange) })');
  });

  it('debate.js is UNTOUCHED — its book-only guard and its forecasting prompt stay where they are', () => {
    const src = read('api/agent/debate.js');
    // The research path needed the DATA path, not this route: widening this
    // guard would widen the reach of the prompt §0 says must never reach a
    // reader, and hazard 8 says never to widen it without a test (there is
    // none). The research route carries its own universe check instead.
    expect(src).toContain('Position ${targetSymbol} not found in portfolio');
    expect(src).not.toMatch(/battleUniverse|canonicalUniverseSymbol|flattenBenchServer/);
  });
});
