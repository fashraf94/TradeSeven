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
    // The flag's 404 is a PRE-TRANSACTION refusal, so it carries the
    // attestation the Show-it doors' cost clause is gated on (§2 review, A1):
    // nothing was written, and the route is the only party that can say so.
    expect(res.body).toEqual({ noCardWritten: true, error: 'Not found' });
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
    // COMMENTS STRIPPED FIRST (the deskHonesty.test.js rule). This counted raw
    // occurrences, so the docstring that explains WHY the transaction's own
    // refusals carry no attestation — which has to name `runTransaction` to
    // explain it — reddened a row about how many transactions the route opens.
    const src = read('api/agent/research.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(src.match(/runTransaction/g)).toHaveLength(1);
    expect(src.match(/tx\.update\(/g)).toHaveLength(1);
    expect(src).toContain('tx.update(battleRef, { chatExchanges: FieldValue.arrayUnion(exchange) })');
  });

  // ── The attestation's own contract (§2 review, A1) ───────────────────────
  //
  // The Show-it doors say `no use spent` only when the body carries
  // `noCardWritten`, and this is the rule that makes that safe: the field is on
  // every refusal answered BEFORE the transaction is opened, and on NONE of the
  // ones answered from inside or after it — because `runTransaction` retries,
  // and a commit that landed whose reply was lost re-runs against a document
  // that already holds its own card.
  it('the attestation is on the pre-transaction refusals, and on none of the rest', () => {
    // Comments stripped: the prose below the transaction NAMES the constant in
    // order to say why it is absent there, which is documentation, not a use.
    const src = read('api/agent/research.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const txAt = src.indexOf('await db.runTransaction');
    expect(txAt, 'the transaction').toBeGreaterThan(-1);
    const before = src.slice(0, txAt);
    const after = src.slice(txAt);
    // Every refusal above the transaction attests…
    const refusalsBefore = before.match(/return res\.status\((?!200)\d+\)/g) || [];
    expect(refusalsBefore.length).toBeGreaterThan(5);
    for (const [i, chunk] of before.split('return res.status(').slice(1).entries()) {
      if (chunk.startsWith('200')) continue;
      expect(chunk.slice(0, 200), `pre-transaction refusal ${i} attests`).toContain('NO_CARD_WRITTEN');
    }
    // …and nothing below it does, the catch included.
    expect(after).not.toContain('NO_CARD_WRITTEN');
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

// ============================================================================
// B2 — THE SAME RULE, ON THE TWO DIRECTIVE ROUTES (spec §2 ruling 7)
//
// The invariant above is the research route's: a claim about cost or
// persistence is only made where it is PROVABLE. B2 gives the directive routes
// the same vocabulary (`persisted` / `charged` / `reason`, named once in
// src/data/decisionRecord.js), so the structural rule extends to them — a
// refusal answered from ABOVE the filing transaction proves of its own
// construction that nothing landed and nothing was spent, and nothing below
// the transaction may claim that, because below it the route either knows it
// committed or knows it cannot tell.
//
// Per the Sep 10 review's second headline, this walks SOURCE and is therefore
// not a substitute for a behavioural row — it guards a structural property a
// mounted test cannot express. The behavioural rows sit beside it, in
// api/agent/chat.test.js ("every response attests persisted / charged") and
// api/agent/file-directive.test.js.
// ============================================================================

describe('B2 — the filing attestation is on the pre-transaction refusals, and on none of the rest', () => {
  const ROUTES = ['api/agent/chat.js', 'api/agent/file-directive.js'];
  // Comments stripped first (the deskHonesty.test.js rule, and the same trap
  // the research row above documents): both routes NAME the constant in prose
  // in order to explain where it may and may not appear.
  const code = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(ROUTES)('%s: every refusal ABOVE the filing transaction attests', (rel) => {
    const src = code(rel);
    const txAt = src.indexOf('runDirectiveTransaction(db');
    expect(txAt, 'the filing transaction').toBeGreaterThan(-1);
    const before = src.slice(0, txAt);
    const refusals = before.split('return res.status(').slice(1);
    // The route has a real refusal surface above the write — a rule with
    // nothing to police is not a guard.
    expect(refusals.filter((c) => !c.startsWith('200')).length).toBeGreaterThan(3);
    for (const [i, chunk] of refusals.entries()) {
      // The League zero state is a 200 that filed nothing; it attests too, so
      // it is not skipped the way the research row skips its 200s.
      expect(chunk.slice(0, 260), `${rel}: pre-transaction refusal ${i} attests`).toContain('NOTHING_FILED');
    }
  });

  it.each(ROUTES)('%s: nothing BELOW the transaction claims false / false', (rel) => {
    const src = code(rel);
    const after = src.slice(src.indexOf('runDirectiveTransaction(db'));
    // Below the write there are exactly two honest positions, and neither is a
    // literal: the outcome's own attestation (it refused, so it knows), and
    // attestThrown (which knows whether the commit happened, and says `null`
    // when it cannot tell).
    // BOTH FORMS. The first cut of this row matched only the object-literal
    // `persisted: false`, and the mutation check walked straight past a
    // `clientResponse.persisted = false` assignment — a row that cannot fail
    // under the defect it names is not a guard (BUILD_RULES §2).
    expect(after).not.toContain('NOTHING_FILED');
    expect(after).not.toMatch(/persisted\s*[:=]\s*false/);
    expect(after).not.toMatch(/charged\s*[:=]\s*false/);
  });

  it('the vocabulary has ONE home, and both routes read it from there', () => {
    for (const rel of ROUTES) {
      expect(code(rel)).toContain("NOTHING_FILED } from '../../src/data/decisionRecord.js'");
    }
    const vocab = read('src/data/decisionRecord.js');
    expect(vocab).toContain('export const NOTHING_FILED');
    expect(vocab).toContain('export const CHAT_NOT_SENT_CLAUSE');
    expect(vocab).toContain('export const attestsPersisted');
    expect(vocab).toContain('export const attestsCharged');
  });

  it('the unknown side of an ambiguous commit is `null`, never `false` (the one §2 does not name)', () => {
    const shared = read('api/_utils/directiveTransaction.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(shared).toContain('if (attempted) return { persisted: null, charged: null, reason };');
    // …and the two reader helpers test for an explicit true/false, so an
    // unknown reads as no claim on either side.
    const vocab = read('src/data/decisionRecord.js');
    expect(vocab).toContain('body?.persisted === true');
    expect(vocab).toContain('body?.charged === true');
  });
});
