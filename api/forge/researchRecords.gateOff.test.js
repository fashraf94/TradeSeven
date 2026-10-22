// api/forge/researchRecords.gateOff.test.js
//
// Pilot P2 — ACCEPTANCE ROW 1: with the gate OFF for the caller, every host
// this build touches answers, reads, writes and calls the model exactly as
// `main` does. Three gate-off states, each against the SAME golden:
//   · HYPOTHESIS_RECORDS_ENABLED false (the shipped value)
//   · the flag true, but the caller is not on the cockpit allowlist
//   · the flag true, and NOBODY is on the allowlist
//
// Each scenario's TRACE — the HTTP status and body, every document read,
// every query, every write (op, path, payload), the transaction attempts,
// every shadow-log call's arguments, and every model call's arguments
// (system prompt bytes, history, user message; the AbortSignal aside) — is
// serialised in its own key order (byte identity, not merely structure) and
// hashed. The goldens below were CAPTURED BY RUNNING THIS FILE AGAINST MAIN'S
// OWN CODE (an LF `git archive` of 2519d1c8, with P2_GOLDEN_WRITE=1), so a
// match here is a match with main. Scenarios cover every exit the build
// touched (review R3-3): new and continuing turns, model failure and timeout,
// unparseable replies, a missing rankings document, the lost-concurrency 409s,
// the catch-all after the model answered, budget exits, idempotent abandon and
// save, every create path, and the P1a routes' gate answer.
// The real prompt builder (voiceLayerPrompt.js), screener (screenStocks.js)
// and cohort digest run; only the model's HTTP call is replaced.
//
// Seeded sessions CARRY a research record id and the record exists — the
// gate must ignore both: no researchWork read, no researchWork write, no
// `includeUsage` on the model call.
//
// This file and its harness (api/_utils/__fixtures__/researchHostHarness.js)
// import nothing that is new in P2, so they run unchanged on main.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  OWNER, OTHER, NOW, ALLOWLIST_ENV, AGENT_ID, DROP_ID, makeHostDb, call, rankingsDoc, agentDoc, parseResult, signalDropDoc,
  screenReply, dialogueReply, analysisReply, dialogueSession, screenerSession, savedList, analysisSession,
} from '../_utils/__fixtures__/researchHostHarness.js';

const state = vi.hoisted(() => ({ flagOn: false, replies: [], calls: [], logs: [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async (entry) => { state.logs.push(['signalDrops', entry]); },
  logConversation: async (entry) => { state.logs.push(['conversation', entry]); return true; },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));
vi.mock('../_utils/gemmaClient.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    callGemmaVoiceWithRetry: async (opts) => {
      const { signal, ...args } = opts || {};
      state.calls.push({ args, hasSignal: !!signal });
      const reply = state.replies.shift();
      // A reply may carry `during`: what happens while the model "thinks" (a competing write, a store outage).
      if (typeof reply?.during === 'function') await reply.during();
      const { during, ...result } = reply || {};
      return result;
    },
  };
});

const { default: screenerHandler } = await import('../screener/chat.js');
const { default: dialogueHandler } = await import('./watchlist-dialogue.js');
const { default: abandonHandler } = await import('./watchlist-dialogue-abandon.js');
const { default: analysisHandler } = await import('./watchlist-analysis.js');
const { default: watchlistsHandler } = await import('./watchlists.js');
const { default: versionsHandler } = await import('./watchlists/[id]/hypothesis-versions.js');
const { default: transitionHandler } = await import('./watchlists/[id]/hypothesis-transition.js');

// ── the trace and its digest ─────────────────────────────────────────────────
// Serialised in insertion order: a key-order change in a body or a payload is a difference (byte identity).
const canon = (v) => JSON.stringify(v);
const sha = (v) => createHash('sha256').update(canon(v)).digest('hex');
function traceOf(res, db) {
  const a = db.__access;
  return {
    status: res.statusCode, body: res.body, reads: a.reads, queries: a.queries, writes: a.writes,
    txAttempts: db.__txAttempts, logs: state.logs, model: state.calls,
  };
}

const RW_SCREENER = 'rs_rs-1';
const RW_DIALOGUE = 'ws_ws-1';
const RW_ANALYSIS = 'as_as-1';
const record = (researchWorkId, origin) => ({ researchWorkId, userId: OWNER, origin, state: 'open', telemetry: { attempts: 1 } });
const ok = (content) => ({ success: true, content });
const failed = { success: false, error: 'OpenRouter 500: upstream', fallbackResponse: null };
const timedOut = { success: false, error: 'Request aborted', aborted: true, fallbackResponse: null };
/** While the model "thinks": a competing write, or the store going down. */
const meanwhile = (reply, during) => ({ ...reply, during });
const sessionUpdate = (path, data) => () => activeDb.doc(path).update(data);
const storeDown = () => { activeDb.runTransaction = async () => { throw new Error('14 UNAVAILABLE: the store went away'); }; };
const screenerDocs = (over = {}) => ({ 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER, ...over }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') });
const dialogueDocs = (over = {}) => ({ [`agents/${AGENT_ID}`]: agentDoc(), 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE, ...over }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') });
const analysisDocs = (over = {}) => ({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList(), 'analysisSessions/as-1': analysisSession({ researchWorkId: RW_ANALYSIS, ...over }), [`researchWork/${RW_ANALYSIS}`]: record(RW_ANALYSIS, 'analysis') });
const screenNext = () => call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } });
const dialogueNext = () => call(dialogueHandler, { body: { agentId: AGENT_ID, sessionId: 'ws-1', message: 'Keep AMD, anything else?' } });
const analysisNext = () => call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'as-1', userMessage: 'Which ones lead?' } });

/** Each scenario seeds a store, queues the model's replies, and makes one request. */
const SCENARIOS = {
  'screener · first turn (new session, screened)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc() },
    replies: [ok(screenReply())],
    go: () => call(screenerHandler, { body: { userMessage: 'strongest chips please' } }),
  },
  'screener · first turn, the model fails': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc() },
    replies: [failed],
    go: () => call(screenerHandler, { body: { userMessage: 'strongest chips please' } }),
  },
  'screener · continuing turn (the session carries a record id)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [ok(screenReply({ screenSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 80 }], limit: 2 } }))],
    go: () => call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } }),
  },
  'screener · continuing turn, the model fails': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [failed],
    go: () => call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } }),
  },
  'screener · continuing turn, the model times out': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [timedOut],
    go: () => call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } }),
  },
  'screener · continuing turn, unparseable reply': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [ok('I would rather just chat about it.')],
    go: () => call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } }),
  },
  'dialogue · first turn (paste)': {
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [`users/${OWNER}/signalDrops/${DROP_ID}`]: signalDropDoc('positional') },
    replies: [ok(dialogueReply())],
    go: () => call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'What fits this?', parseResult: parseResult('positional'), dropId: DROP_ID } }),
  },
  'dialogue · continuing turn (the session carries a record id)': {
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') },
    replies: [ok(dialogueReply({ candidateTickerUpdates: [{ action: 'keep', symbol: 'AMD' }, { action: 'propose', symbol: 'AVGO', reasoning: 'networking' }] }))],
    go: () => call(dialogueHandler, { body: { agentId: AGENT_ID, sessionId: 'ws-1', message: 'Keep AMD, anything else?' } }),
  },
  'dialogue · continuing turn, the model fails': {
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') },
    replies: [failed],
    go: () => call(dialogueHandler, { body: { agentId: AGENT_ID, sessionId: 'ws-1', message: 'Keep AMD, anything else?' } }),
  },
  'abandon · user_close (the session carries a record id)': {
    docs: { 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') },
    replies: [],
    go: () => call(abandonHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, reason: 'user_close' } }),
  },
  'abandon · finalize_intent': {
    docs: { 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') },
    replies: [],
    go: () => call(abandonHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, reason: 'finalize_intent' } }),
  },
  'analysis · open turn (new session)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList({ currentHypothesisVersion: 2, hypothesisVersionCount: 2 }) },
    replies: [],
    go: () => call(analysisHandler, { body: { watchlistId: 'wl-1' } }),
  },
  'analysis · first message turn (new session)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() },
    replies: [ok(analysisReply())],
    go: () => call(analysisHandler, { body: { watchlistId: 'wl-1', userMessage: 'What do these share?' } }),
  },
  'analysis · continuing turn (the session carries a record id)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList(), 'analysisSessions/as-1': analysisSession({ researchWorkId: RW_ANALYSIS }), [`researchWork/${RW_ANALYSIS}`]: record(RW_ANALYSIS, 'analysis') },
    replies: [ok(analysisReply())],
    go: () => call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'as-1', userMessage: 'Which ones lead?' } }),
  },
  'analysis · continuing turn, the model fails': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList(), 'analysisSessions/as-1': analysisSession({ researchWorkId: RW_ANALYSIS }), [`researchWork/${RW_ANALYSIS}`]: record(RW_ANALYSIS, 'analysis') },
    replies: [failed],
    go: () => call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'as-1', userMessage: 'Which ones lead?' } }),
  },
  'watchlists · dialogue save (the session carries a record id)': {
    docs: { 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: RW_DIALOGUE, status: 'finalize_intent' }), [`researchWork/${RW_DIALOGUE}`]: record(RW_DIALOGUE, 'signaldrop') },
    replies: [],
    go: () => call(watchlistsHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, dropId: DROP_ID } }),
  },
  'watchlists · screener create (the client sends its screener session id)': {
    docs: { 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [],
    go: () => call(watchlistsHandler, {
      body: {
        tickers: [{ symbol: 'NVDA', reasoning: '', category: 'Technology' }, { symbol: 'AMD', reasoning: '', category: 'Technology' }],
        name: 'Strong chips', sourceScreenSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 60 }], limit: 3 }, screenerSessionId: 'rs-1',
      },
    }),
  },
  'watchlists · manual create': {
    docs: {},
    replies: [],
    go: () => call(watchlistsHandler, { body: {} }),
  },
  // ── review R3-3: every other exit the build touched ──────────────────────────
  'screener · first turn, a clarifying reply (no screen)': {
    docs: { 'indexIntelligence/stockRankings': rankingsDoc() },
    replies: [ok(JSON.stringify({ message: 'Which sector?', readyToScreen: false, screenSpec: null }))],
    go: () => call(screenerHandler, { body: { userMessage: 'something good' } }),
  },
  'screener · continuing turn, the rankings document is missing (503)': {
    docs: { 'researchSessions/rs-1': screenerSession({ researchWorkId: RW_SCREENER }), [`researchWork/${RW_SCREENER}`]: record(RW_SCREENER, 'screener') },
    replies: [ok(screenReply())],
    go: screenNext,
  },
  'screener · continuing turn, a concurrent turn used the budget (409)': {
    docs: screenerDocs(),
    replies: [meanwhile(ok(screenReply()), sessionUpdate('researchSessions/rs-1', { messagesUsed: 30 }))],
    go: screenNext,
  },
  'screener · continuing turn, the store fails after the model answered (catch-all)': {
    docs: screenerDocs(),
    replies: [meanwhile(ok(screenReply()), storeDown)],
    go: screenNext,
  },
  'screener · the budget is spent (no model call)': {
    docs: screenerDocs({ messagesUsed: 30 }),
    replies: [],
    go: screenNext,
  },
  'dialogue · first turn (theme)': {
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), 'discoverThemes/t-1': { title: 'Grid buildout', narrative: 'Power demand keeps climbing.', tickers: ['NVDA', 'AVGO'], status: 'active' } },
    replies: [ok(dialogueReply())],
    go: () => call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'Dive in', themeId: 't-1', dropId: 'theme-drop-1' } }),
  },
  'dialogue · first turn, the model fails': {
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [`users/${OWNER}/signalDrops/${DROP_ID}`]: signalDropDoc('swing') },
    replies: [failed],
    go: () => call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'What fits this?', parseResult: parseResult('swing'), dropId: DROP_ID } }),
  },
  'dialogue · continuing turn, unparseable reply': {
    docs: dialogueDocs(),
    replies: [ok('Happy to chat, but no JSON today.')],
    go: dialogueNext,
  },
  'dialogue · continuing turn, the session closed meanwhile (409)': {
    docs: dialogueDocs(),
    replies: [meanwhile(ok(dialogueReply()), sessionUpdate('watchlistSessions/ws-1', { status: 'abandoned' }))],
    go: dialogueNext,
  },
  'dialogue · continuing turn, the store fails after the model answered (catch-all)': {
    docs: dialogueDocs(),
    replies: [meanwhile(ok(dialogueReply()), storeDown)],
    go: dialogueNext,
  },
  'dialogue · the budget is spent (no model call)': {
    docs: dialogueDocs({ messagesUsed: 20 }),
    replies: [],
    go: dialogueNext,
  },
  'analysis · continuing turn, unparseable reply': {
    docs: analysisDocs(),
    replies: [ok('Plain words only.')],
    go: analysisNext,
  },
  'analysis · continuing turn, a concurrent turn used the budget (409)': {
    docs: analysisDocs(),
    replies: [meanwhile(ok(analysisReply()), sessionUpdate('analysisSessions/as-1', { messagesUsed: 30 }))],
    go: analysisNext,
  },
  'analysis · continuing turn, the store fails after the model answered (catch-all)': {
    docs: analysisDocs(),
    replies: [meanwhile(ok(analysisReply()), storeDown)],
    go: analysisNext,
  },
  'analysis · an open turn on an existing session (no write)': {
    docs: analysisDocs(),
    replies: [],
    go: () => call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'as-1' } }),
  },
  'abandon · already abandoned (idempotent)': {
    docs: dialogueDocs({ status: 'abandoned', abandonReason: 'user_close', abandonedAt: NOW }),
    replies: [],
    go: () => call(abandonHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, reason: 'user_close' } }),
  },
  'watchlists · dialogue save, already saved (idempotent)': {
    docs: dialogueDocs({ status: 'completed', dropListId: 'wl-saved' }),
    replies: [],
    go: () => call(watchlistsHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, dropId: DROP_ID } }),
  },
  'watchlists · screener create without a session id (what main\'s client sends)': {
    docs: screenerDocs(),
    replies: [],
    go: () => call(watchlistsHandler, { body: { tickers: [{ symbol: 'NVDA' }], name: 'One name', sourceScreenSpec: { filters: [] } } }),
  },
  'watchlists · screener create with a malformed session id': {
    docs: screenerDocs(),
    replies: [],
    go: () => call(watchlistsHandler, { body: { tickers: [{ symbol: 'NVDA' }], name: 'One name', sourceScreenSpec: null, screenerSessionId: 'bad/id' } }),
  },
  'P1a · GET the idea (the gate\'s own answer)': {
    docs: { 'watchlists/wl-1': savedList({ researchWorkId: 'wl_wl-1' }) },
    replies: [],
    go: () => call(versionsHandler, { method: 'GET', query: { id: 'wl-1' } }),
  },
  'P1a · POST mark_researched (the gate\'s own answer)': {
    docs: { 'watchlists/wl-1': savedList() },
    replies: [],
    go: () => call(transitionHandler, { query: { id: 'wl-1' }, body: { version: 1, action: 'mark_researched', expectedStatus: 'draft' } }),
  },
};

// Captured from main (2519d1c8) — see the header. One digest per scenario; every gate-off state must equal it.
const GOLDEN = {
  'screener · first turn (new session, screened)': '6b78c83354b5d43afd4f4ed354f3c3356a3558ae68cac602954c80c40518d181',
  'screener · first turn, the model fails': 'f054fa6eac961749e8e002a4ee2fb9efaf7665c95ac4108fee0d6a61ec31486a',
  'screener · continuing turn (the session carries a record id)': 'c912fb38191828e040d31275ece2c1e6fa4ecc126711d6983dd9fcbbdd0d9c4e',
  'screener · continuing turn, the model fails': '2964a688ddaa8148cc5f5770d3d5a61a451f103194c6a2e1da18eb7e25f2fa69',
  'screener · continuing turn, the model times out': '264a8ac306dd6de1020885e7c4c38a27b184976c3d25e41ad6bdd5971b340aa0',
  'screener · continuing turn, unparseable reply': '1cc7fcc1c39b62491e9461284bf1b507097d41cafb0f33a3c94d6a983e398735',
  'dialogue · first turn (paste)': '14eb529c1788c1ed4c49694e31e38935476a27813552d5bbd7029f4d2a81cfa8',
  'dialogue · continuing turn (the session carries a record id)': 'b0bd4ccbf565e9b7e7cce685d75e913804cbcd58a676fbb87ed5eba602d94ea1',
  'dialogue · continuing turn, the model fails': '0f15010f7069fca07ae23fa71e91a04f81f1b010b79bcc9dc9e65b0c5899f000',
  'abandon · user_close (the session carries a record id)': '6c71be2cc5285995bfe48c5735d1832d9bb5bccb62e4671adbcc9972227b6644',
  'abandon · finalize_intent': 'f196b0d89bce8479e8d3f565330b52100ab7de36eede3e406d6bbca925ebabe1',
  'analysis · open turn (new session)': 'd5d5083364033cc1df6260bdb5904938c1178d24edf5a62860c239dde9044ac8',
  'analysis · first message turn (new session)': '675f032b25d048cfc488f697b5ce676676d79a24ed7eabf5bcedd58b36f9db8b',
  'analysis · continuing turn (the session carries a record id)': '6b8fe460ccac14d98f40fe3000845a17b3e462fb4dc803707588c00a493c6a00',
  'analysis · continuing turn, the model fails': '5d6168f66f09e64719d959af0575db66b58cdf237f06255af3fc8bfb0f4ab927',
  'watchlists · dialogue save (the session carries a record id)': 'e3ebc600bcc9eb173b3813a66cc34611a43eb537d75a85767218993883e6d4c4',
  'watchlists · screener create (the client sends its screener session id)': 'd39443c88f0da30d1be2eddec0aa1428de63f45982e51543fee9f4d65f9cb4ba',
  'watchlists · manual create': 'ad110dc349c86ad90c1d66042ccf4f28259ea97029577bf6c814ae5025b5ea0e',
  'screener · first turn, a clarifying reply (no screen)': '6c4315ba4c1d972960a888a446894191f9d032b440b0874dbb0c14a785f60f48',
  'screener · continuing turn, the rankings document is missing (503)': 'dc1dc8baa8a9a67ded95b7e58ca5d885e42a59e9c13831c82ee813c8e83210ac',
  'screener · continuing turn, a concurrent turn used the budget (409)': '36c3317530fd31036cf7dbdc64c95e5551aa1d3a4101092067f9dd9920b2fa24',
  'screener · continuing turn, the store fails after the model answered (catch-all)': 'ccb47e072d501b37e21b251875b6ebfeaa7822ef0d684e4b2c7592b03361088a',
  'screener · the budget is spent (no model call)': '89ae5015791becb63ade716e712f29c1bd24bdb8ba5e1e6b20d9dbf045e06c68',
  'dialogue · first turn (theme)': 'd95f6203fb369ea911397e9b73c54ed1700d2ae66634edd1ba4dfa3f1dee59ba',
  'dialogue · first turn, the model fails': '25a0e84535483db081e8b562563480e96dfd7c672b0dda9fe24ea2cdc42e9fba',
  'dialogue · continuing turn, unparseable reply': '8906790e658bab341004d74521298f2507037a27b3a0ab9d91effc026f113a1e',
  'dialogue · continuing turn, the session closed meanwhile (409)': '5d85c1b4911a862d11eb8005975db1bdb8fdbc67321738d00fd4a90fce8981bf',
  'dialogue · continuing turn, the store fails after the model answered (catch-all)': '8a94855cd033fda4bc55812368964c3eee506911e5b4e13cec25a6fbb65c99cb',
  'dialogue · the budget is spent (no model call)': '367f46ad6189133e2fd0b46c9d73aefd503c6aab2d9fcb0a78e4cd80496ed53f',
  'analysis · continuing turn, unparseable reply': 'b09f8d1389c4edcc83a361fb0db40d87f759ee6b950112ceb56a2c0dd896566a',
  'analysis · continuing turn, a concurrent turn used the budget (409)': 'ff267dce6cce1b1d205622db740cbbcc1a8ff0a95547f759c0b71e1d9a08c318',
  'analysis · continuing turn, the store fails after the model answered (catch-all)': '28994aa6e8651a4458363242ebe20fd4fa21a4472005315364693f127fbabd42',
  'analysis · an open turn on an existing session (no write)': 'c84bb5841c6da44eb3964be51bb779d5eca96a4cf4148aaf69df680d3832a49a',
  'abandon · already abandoned (idempotent)': 'eda52dc171777dae9c32dd05526e870db9f07ad31c5d5fb4b87e2097f284fa43',
  'watchlists · dialogue save, already saved (idempotent)': '2371180964774b3da0e66e5bf8af891d1d9580957b3777e2c64d1e876a3d8991',
  'watchlists · screener create without a session id (what main\'s client sends)': '16d3a6638dc7a93e6733866174e0f5ff88c53ddb503c10127fbe9ad6a3b8da15',
  'watchlists · screener create with a malformed session id': '6110da8a31bdb710ff553b2e429c4c325195f28c75848d1105aa422a8aef4a2b',
  'P1a · GET the idea (the gate\'s own answer)': '6d523a9240f3000cf6d7c48fe426e2001dcfcbbbb42702208d232476a09ffb6b',
  'P1a · POST mark_researched (the gate\'s own answer)': '6d523a9240f3000cf6d7c48fe426e2001dcfcbbbb42702208d232476a09ffb6b',
};

const MODES = [
  ['flag OFF', () => { state.flagOn = false; process.env[ALLOWLIST_ENV] = OWNER; }],
  ['flag ON, caller OFF the allowlist', () => { state.flagOn = true; process.env[ALLOWLIST_ENV] = OTHER; }],
  ['flag ON, NOBODY on the allowlist', () => { state.flagOn = true; process.env[ALLOWLIST_ENV] = ''; }],
];

let savedEnv;
const captured = {};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  savedEnv = process.env[ALLOWLIST_ENV];
  state.calls = [];
  state.replies = [];
  state.logs = [];
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv;
  vi.useRealTimers();
});
afterAll(() => {
  if (process.env.P2_GOLDEN_WRITE === '1') writeFileSync(process.env.P2_GOLDEN_OUT || 'p2-golden.json', JSON.stringify(captured, null, 2));
});

describe('acceptance row 1 — gate off: every touched host is byte-identical to main', () => {
  for (const [mode, enter] of MODES) {
    for (const [name, s] of Object.entries(SCENARIOS)) {
      it(`${mode} · ${name}`, async () => {
        enter();
        activeDb = makeHostDb(s.docs);
        state.replies = [...s.replies];
        const res = await s.go();
        const trace = traceOf(res, activeDb);
        // Readable guards (true on main by construction): no research record is read, queried or written, and no model call opts into usage.
        expect(trace.reads.filter((p) => p.startsWith('researchWork/'))).toEqual([]);
        expect(trace.queries.filter((q) => q.collectionPath === 'researchWork')).toEqual([]);
        expect(trace.writes.filter((w) => w.path?.startsWith('researchWork/'))).toEqual([]);
        expect(trace.model.every((c) => !('includeUsage' in c.args))).toBe(true);
        expect(state.replies).toEqual([]); // every queued reply was consumed (the scenario reached the model)
        const digest = sha(trace);
        if (process.env.P2_GOLDEN_WRITE === '1') {
          if (captured[name] && captured[name] !== digest) throw new Error(`the gate-off states differ on ${name}`);

          captured[name] = digest;
          return;
        }
        expect(digest, `${name}\n${canon(trace).slice(0, 4000)}`).toBe(GOLDEN[name]);
      });
    }
  }
  it('every scenario has a golden (none silently skipped)', () => {
    if (process.env.P2_GOLDEN_WRITE === '1') return;
    expect(Object.keys(GOLDEN).sort()).toEqual(Object.keys(SCENARIOS).sort());
  });
});
