// api/forge/researchRecords.gateOff.test.js
//
// Pilot P2 — ACCEPTANCE ROW 1: with the gate OFF for the caller, every host
// this build touches answers, reads, writes and calls the model exactly as
// `main` does. Two gate-off states, each against the SAME golden:
//   · HYPOTHESIS_RECORDS_ENABLED false (the shipped value)
//   · the flag true, but the caller is not on the cockpit allowlist
//
// Each scenario's TRACE — the HTTP status and body, every document read,
// every query, every write (op, path, payload), and every model call's
// arguments (system prompt bytes, history, user message; the AbortSignal
// aside) — is canonicalised and hashed. The goldens below were CAPTURED BY
// RUNNING THIS FILE AGAINST MAIN'S OWN CODE (an LF `git archive` of
// 2519d1c8, with P2_GOLDEN_WRITE=1), so a match here is a match with main.
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

const state = vi.hoisted(() => ({ flagOn: false, replies: [], calls: [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {}, logConversation: async () => true }));
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
      return state.replies.shift();
    },
  };
});

const { default: screenerHandler } = await import('../screener/chat.js');
const { default: dialogueHandler } = await import('./watchlist-dialogue.js');
const { default: abandonHandler } = await import('./watchlist-dialogue-abandon.js');
const { default: analysisHandler } = await import('./watchlist-analysis.js');
const { default: watchlistsHandler } = await import('./watchlists.js');

// ── the trace and its digest ─────────────────────────────────────────────────
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const canon = (v) => JSON.stringify(sortKeys(v));
const sha = (v) => createHash('sha256').update(canon(v)).digest('hex');
function traceOf(res, db) {
  const a = db.__access;
  return { status: res.statusCode, body: res.body, reads: a.reads, queries: a.queries, writes: a.writes, model: state.calls };
}

const RW_SCREENER = 'rs_rs-1';
const RW_DIALOGUE = 'ws_ws-1';
const RW_ANALYSIS = 'as_as-1';
const record = (researchWorkId, origin) => ({ researchWorkId, userId: OWNER, origin, state: 'open', telemetry: { attempts: 1 } });
const ok = (content) => ({ success: true, content });
const failed = { success: false, error: 'OpenRouter 500: upstream', fallbackResponse: null };
const timedOut = { success: false, error: 'Request aborted', aborted: true, fallbackResponse: null };

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
};

// Captured from main (2519d1c8) — see the header. One digest per scenario; both gate-off states must equal it.
const GOLDEN = {
  'screener · first turn (new session, screened)': 'e7bddecc23548d2526553f3c7db1c4378692c88f9e7f048e93d757e7976ab2f8',
  'screener · first turn, the model fails': '0c2844c387743506894558898dcd5197d90accd4fa5bcbac8cd88a1f77a53829',
  'screener · continuing turn (the session carries a record id)': 'b7bba49e4097d6e7cbb1f387927cfae3c82f5651697bcb58126a01190a388c18',
  'screener · continuing turn, the model fails': '2b94a170ee50e2acc424f48ff709eeb018ade3de43da79269cfb8211a8fcf103',
  'screener · continuing turn, the model times out': 'bde23884f40d27dba0796d29a43c4f1165d784a15f587d72f64bcd7b76003fdb',
  'screener · continuing turn, unparseable reply': 'efeb46770c330fc40d3d69dfec3dcb46ade0abac8d1beab7862bbca8e3303dc6',
  'dialogue · first turn (paste)': 'f337ca79f2b17f6db70a5ccbf7dd430018c079886cc068be5b4a1224caf8c255',
  'dialogue · continuing turn (the session carries a record id)': '6cd21785100b7bc7bc6d3ea2aefe05b799d4d2d9ce9ba86fab2c0a84dca5e175',
  'dialogue · continuing turn, the model fails': '582a97781135d5cfd167d980242331b211cc479d7918182d428183f3b62e6db8',
  'abandon · user_close (the session carries a record id)': 'd76114d197cfdbf6f15b6fc4e20011be032450d0121952754881f76296467944',
  'abandon · finalize_intent': 'a0e8331218158f109905f223fd5076ff036040dab14e1bda059ca93f4d586365',
  'analysis · open turn (new session)': 'db7e02877fa05a034a6a0ce0ac9e16279bc6d3597819efcc1e17e44618a4acfb',
  'analysis · first message turn (new session)': '5405c3ad326cde2621b4849ad9fe086964fddd2248335915ab78cd4a0942e716',
  'analysis · continuing turn (the session carries a record id)': 'd5b4ee2ce459f344d2fd6008476bad3477d3f8ed75e05eb1ed3ea9508eb141de',
  'analysis · continuing turn, the model fails': '31489e65c8b72ee336cd6927816626627075614bfbc45be746d17862ad93b854',
  'watchlists · dialogue save (the session carries a record id)': '9f3ef01ca3a19f0a68585bd9a5850e25c1f24876513e7b4e1f753cd19673358a',
  'watchlists · screener create (the client sends its screener session id)': '5bdd5f7a06e23eb7b59458df597119538255736f9875f85c741738a45ab9c126',
  'watchlists · manual create': 'd19b0008e9a7651cf5705b0df061861383c154d4448ba89d99cdaa915e8f498d',
};

const MODES = [
  ['flag OFF', () => { state.flagOn = false; process.env[ALLOWLIST_ENV] = OWNER; }],
  ['flag ON, caller OFF the allowlist', () => { state.flagOn = true; process.env[ALLOWLIST_ENV] = OTHER; }],
];

let savedEnv;
const captured = {};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  savedEnv = process.env[ALLOWLIST_ENV];
  state.calls = [];
  state.replies = [];
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
          if (captured[name] && captured[name] !== digest) throw new Error(`the two gate-off states differ on ${name}`);
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
