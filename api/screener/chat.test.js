// api/screener/chat.test.js
//
// Narrow coverage for the screener chat endpoint's Gemma-failure branch.
//
// Created Sep 3 2026 (voice-timeout incident). This handler was the only one of
// the six callGemmaVoiceWithRetry callers with no test file at all, so the
// sibling timeout-class row had nowhere to live. Scope is deliberately just
// that branch — the screen-spec, session-lifecycle and budget paths are not
// covered here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== HOISTED MOCK STATE ====================
const { authReturnValue, gemmaResult } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  gemmaResult: { current: { success: true, content: '{"message":"here you go","screenSpec":null}' } },
}));

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) { res.status(401).json({ error: 'auth required' }); return null; }
    return authReturnValue.current;
  },
}));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async () => true }));
vi.mock('../_utils/voiceLayerPrompt.js', () => ({ buildVoiceLayerPrompt: () => 'system-prompt-stub' }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async () => gemmaResult.current,
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('../_utils/screenStocks.js', () => ({
  screenStocks: async () => ({ results: [], appliedSpec: {}, rejectedFilters: [] }),
  screenIndustries: async () => ({ results: [], appliedSpec: {}, rejectedFilters: [] }),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));

const { default: handler } = await import('./chat.js');

// ==================== Fixture helpers ====================

// Minimal researchSessions fake: doc() with no id mints a new session ref, so
// the handler takes its isNewSession branch and never reads Firestore.
function makeFakeFirestore() {
  const written = { setCalls: [], updateCalls: [] };
  const docRef = {
    id: 'new-session-123',
    get: async () => ({ exists: false, data: () => null }),
    set: async (data) => { written.setCalls.push({ data }); },
    update: async (data) => { written.updateCalls.push({ data }); },
  };
  return { db: { collection: () => ({ doc: () => docRef }) }, written };
}

function makeReqRes(body) {
  const req = { method: 'POST', body, headers: {} };
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

beforeEach(() => {
  authReturnValue.current = { uid: 'test-user' };
  gemmaResult.current = { success: true, content: '{"message":"here you go","screenSpec":null}' };
  activeFirestore = null;
});

// ==========================================================================
// SIBLING TIMEOUT-CLASS ROW — Sep 3 2026 voice-timeout incident.
//
// gemmaClient now reports an abort that fires DURING THE BODY READ as
// `aborted: true`. It previously came back as a generic failure with `aborted`
// undefined, so this handler answered HTTP 200 — a success status — on a turn
// that had actually timed out. This row pins that the new class is handled and
// does not crash the handler. The classification itself is guarded at source in
// api/_utils/gemmaClient.test.js.
// ==========================================================================

describe('screener/chat — gemmaClient timeout class (aborted:true)', () => {
  it('an aborted Gemma call returns 504, not 200', async () => {
    activeFirestore = makeFakeFirestore().db;
    gemmaResult.current = { success: false, error: 'Request aborted', aborted: true, fallbackResponse: null };

    const { req, res } = makeReqRes({ userMessage: 'show me cheap industrials' });
    await handler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe(true);
    expect(res.body.message).toBeTruthy();   // graceful copy, not a crash
    expect(res.body.screened).toBe(false);
  });

  it('a NON-aborted Gemma failure still returns the graceful 200 (no over-classification)', async () => {
    activeFirestore = makeFakeFirestore().db;
    gemmaResult.current = { success: false, error: 'OpenRouter 500: upstream', aborted: false, fallbackResponse: null };

    const { req, res } = makeReqRes({ userMessage: 'show me cheap industrials' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.error).toBe(true);
  });
});
