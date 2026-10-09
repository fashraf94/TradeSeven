// src/services/agentDeploy.refusal.test.js
//
// Pilot P1b (build prompt item 5; founder ruling B2) — the deploy station
// shows the refusal's table C line VERBATIM. The endpoint answers a due idea
// with `409 { error: 'hypothesis_review_due', message: <table C line> }`; the
// Deploy Ceremony renders `details` (CeremonyError), so the deploy service
// forwards that one refusal's `message` as `details`. Every other failure
// forwards exactly what it did before — in particular a `message` on any
// other error is NOT promoted (compiled_build_unverifiable's reason stays
// internal, as it was).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../firebase/authService', () => ({ getIdToken: async () => 'id-token' }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));

const { deployAgent } = await import('./agentDeploy');
const { DUE_DEPLOY_LINE, DEPLOY_REFUSAL_CODE, CARRIAGE_RACE_MESSAGE } = await import('../constants/hypothesisRecords');

const respond = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body),
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); delete globalThis.fetch; });

describe('the deploy refusal reaches the ceremony verbatim', () => {
  it('409 hypothesis_review_due → details is table C\'s due-deploy line, byte for byte; the code and status ride along', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }));
    const out = await deployAgent('agent-1', vi.fn());
    expect(out).toEqual({
      success: false, status: 409, postIssued: true, httpStatus: 409,
      error: 'hypothesis_review_due', details: DUE_DEPLOY_LINE, errorPhase: undefined,
    });
  });
  it('every other failure forwards exactly what it did before: a message on another error is not promoted', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: 'compiled_build_unverifiable', message: 'internal reason' }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
    globalThis.fetch = vi.fn(async () => respond(500, { error: 'Failed to generate portfolio', details: CARRIAGE_RACE_MESSAGE }));
    const race = await deployAgent('agent-1', vi.fn());
    expect(race).toMatchObject({ error: 'Failed to generate portfolio', details: CARRIAGE_RACE_MESSAGE, httpStatus: 500 });
    globalThis.fetch = vi.fn(async () => respond(503, { error: 'pricing_unavailable', details: undefined }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
  });
  it('a refusal body without a string message forwards no invented words (AD02: a non-string message is not forwarded)', async () => {
    globalThis.fetch = vi.fn(async () => respond(409, { error: DEPLOY_REFUSAL_CODE }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
    globalThis.fetch = vi.fn(async () => respond(409, { error: DEPLOY_REFUSAL_CODE, message: 42 }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBeUndefined();
  });
});
