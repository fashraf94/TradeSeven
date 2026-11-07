// api/forge/exchangeId.test.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md §4) — every exchange
// NEWLY written to a host session's `exchanges[]` carries `exchangeId:
// randomUUID()`: the dialogue (two per turn), the screener and the analysis
// routes, whatever the research-record gate. Existing exchanges keep none and
// readers treat that as legacy:
//   · a new session's exchanges, and a continuing turn's, each carry a v4 UUID;
//   · a legacy session still renders: the model is shown exactly the same
//     prompt and history whether its stored exchanges carry ids or not (no
//     reader reads the field), and its legacy entries are left as they were;
//   · a retried turn transaction (a competing write moved the session while
//     the turn was in its body) re-sends the SAME exchange objects — each new
//     id is stored once, nothing duplicated.
// The gate-off goldens (researchRecords.gateOff.test.js, the dialogue parse
// goldens) prove everything else in those writes is still main's, byte for byte.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored } from '../_utils/__fixtures__/callsFirestore.js';
import {
  OWNER, NOW, ALLOWLIST_ENV, AGENT_ID, DROP_ID, makeHostDb, call, rankingsDoc, agentDoc, parseResult, signalDropDoc,
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
      const { signal: _signal, ...args } = opts || {};
      state.calls.push(args);
      return state.replies.shift() || {};
    },
  };
});

const { default: screenerHandler } = await import('../screener/chat.js');
const { default: dialogueHandler } = await import('./watchlist-dialogue.js');
const { default: analysisHandler } = await import('./watchlist-analysis.js');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ok = (content) => ({ success: true, content });
const withIds = (exchanges) => exchanges.map((ex, i) => ({ ...ex, exchangeId: `6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b${String(i).padStart(2, '0')}` }));

/** The three hosts: how to start a session, continue a seeded one, and where it is stored. */
const HOSTS = {
  screener: {
    perTurn: 1,
    firstDocs: () => ({ 'indexIntelligence/stockRankings': rankingsDoc() }),
    first: () => { state.replies.push(ok(screenReply())); return call(screenerHandler, { body: { userMessage: 'strongest chips please' } }); },
    newPath: 'researchSessions/researchSessions-auto-1',
    seeded: (over) => ({ 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession(over) }),
    legacy: () => screenerSession().exchanges,
    next: () => { state.replies.push(ok(screenReply())); return call(screenerHandler, { body: { userMessage: 'only the top names', sessionId: 'rs-1' } }); },
    path: 'researchSessions/rs-1',
  },
  dialogue: {
    perTurn: 2,
    firstDocs: () => ({ [`agents/${AGENT_ID}`]: agentDoc(), [`users/${OWNER}/signalDrops/${DROP_ID}`]: signalDropDoc('positional') }),
    first: () => { state.replies.push(ok(dialogueReply())); return call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'What fits?', parseResult: parseResult('positional'), dropId: DROP_ID } }); },
    newPath: 'watchlistSessions/watchlistSessions-auto-1',
    seeded: (over) => ({ [`agents/${AGENT_ID}`]: agentDoc(), 'watchlistSessions/ws-1': dialogueSession(over) }),
    legacy: () => dialogueSession().exchanges,
    next: () => { state.replies.push(ok(dialogueReply({ candidateTickerUpdates: [] }))); return call(dialogueHandler, { body: { agentId: AGENT_ID, sessionId: 'ws-1', message: 'Keep AMD, anything else?' } }); },
    path: 'watchlistSessions/ws-1',
  },
  analysis: {
    perTurn: 1,
    firstDocs: () => ({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() }),
    first: () => { state.replies.push(ok(analysisReply())); return call(analysisHandler, { body: { watchlistId: 'wl-1', userMessage: 'What do these share?' } }); },
    newPath: 'analysisSessions/analysisSessions-auto-1',
    seeded: (over) => ({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList(), 'analysisSessions/as-1': analysisSession(over) }),
    legacy: () => analysisSession().exchanges,
    next: () => { state.replies.push(ok(analysisReply())); return call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'as-1', userMessage: 'Which ones lead?' } }); },
    path: 'analysisSessions/as-1',
  },
};
const GATES = [
  ['gate OFF', () => { state.flagOn = false; process.env[ALLOWLIST_ENV] = ''; }],
  ['gate ON', () => { state.flagOn = true; process.env[ALLOWLIST_ENV] = OWNER; }],
];

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  savedEnv = process.env[ALLOWLIST_ENV];
  state.replies = [];
  state.calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

for (const [gate, enter] of GATES) {
  for (const [name, h] of Object.entries(HOSTS)) {
    describe(`${gate} · ${name}`, () => {
      it('a NEW session\'s exchanges each carry their own v4 UUID exchangeId', async () => {
        enter();
        activeDb = makeHostDb(h.firstDocs());
        const res = await h.first();
        expect(res.statusCode).toBe(200);
        const ex = stored(activeDb, h.newPath).exchanges;
        expect(ex).toHaveLength(h.perTurn);
        for (const e of ex) expect(e.exchangeId).toMatch(UUID_V4);
        expect(new Set(ex.map((e) => e.exchangeId)).size).toBe(h.perTurn);
        expect(JSON.stringify(res.body)).not.toContain(ex[0].exchangeId); // the id is stored, never answered
      });
      it('a continuing turn on a LEGACY session: the legacy entries stay exactly as they were; the new ones carry ids', async () => {
        enter();
        activeDb = makeHostDb(h.seeded());
        const res = await h.next();
        expect(res.statusCode).toBe(200);
        const ex = stored(activeDb, h.path).exchanges;
        const legacy = h.legacy();
        expect(ex.slice(0, legacy.length)).toEqual(legacy);
        const fresh = ex.slice(legacy.length);
        expect(fresh).toHaveLength(h.perTurn);
        for (const e of fresh) expect(e.exchangeId).toMatch(UUID_V4);
      });
      it('a legacy session still renders: the model sees the same prompt and history whether stored exchanges carry ids or not', async () => {
        enter();
        activeDb = makeHostDb(h.seeded());
        await h.next();
        const legacyCall = state.calls.pop();
        activeDb = makeHostDb(h.seeded({ exchanges: withIds(h.legacy()) }));
        await h.next();
        const idCall = state.calls.pop();
        expect(idCall).toEqual(legacyCall);
        expect(JSON.stringify(legacyCall)).not.toContain('exchangeId');
      });
      it('a retried turn transaction re-sends the SAME exchanges: each new id stored once, nothing duplicated', async () => {
        enter();
        activeDb = makeHostDb(h.seeded());
        let competed = false;
        activeDb.__hooks.afterTxBody = async ({ readPaths }) => {
          if (competed || !readPaths.includes(h.path)) return;
          competed = true;
          await activeDb.doc(h.path).update({ touchedElsewhereAt: NOW }); // moves the session under the turn: the body runs again
        };
        const before = activeDb.__txAttempts;
        const res = await h.next();
        expect(res.statusCode).toBe(200);
        expect(competed).toBe(true);
        expect(activeDb.__txAttempts - before).toBeGreaterThanOrEqual(2);
        const ex = stored(activeDb, h.path).exchanges;
        expect(ex).toHaveLength(h.legacy().length + h.perTurn);
        const ids = ex.map((e) => e.exchangeId).filter(Boolean);
        expect(ids).toHaveLength(h.perTurn);
        expect(new Set(ids).size).toBe(h.perTurn);
        const sent = activeDb.__access.writes.filter((w) => w.path === h.path && w.data?.exchanges).map((w) => w.data.exchanges.items.map((e) => e.exchangeId));
        expect(sent.length).toBeGreaterThanOrEqual(1);
        for (const s of sent) expect(s).toEqual(ids); // every attempt that wrote sent the same objects
      });
    });
  }
}
