// src/services/agentDeploy.stockAdmission.test.js
//
// BaggerBomb stock thresholds v2, Rulings 2 and 6: a measured pilot creation
// the server refuses (decide.js answers `503 { error: 'Stock admission
// unavailable', reason, retriable: true }`) reaches the Deploy Ceremony as one
// short player line in `details`. Only an allowlisted pilot creation can be
// refused this way; every other failure forwards exactly what it did before.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../firebase/authService', () => ({ getIdToken: async () => 'id-token' }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));

const { deployAgent, stockAdmissionLine, STOCK_ADMISSION_ERROR } = await import('./agentDeploy');

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); delete globalThis.fetch; });

describe('the measured pilot refusal reads as one clear player line', () => {
  it('late-start cutoff → the 45-minute line, retriable, with the code and status riding along', async () => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason: 'late_start_cutoff', retriable: true }));
    expect(await deployAgent('agent-1', vi.fn())).toEqual({
      success: false, status: 503, postIssued: true, httpStatus: 503, error: 'Stock admission unavailable',
      details: 'Measured battles stop starting 45 minutes before the market close. Try again 15 minutes after the close.', errorPhase: undefined,
    });
  });
  it.each([
    ['publication_window_not_open', 'Measured battles reopen 15 minutes after the market close. Try again shortly.'],
    ['prior_corrected_battle_requires_settlement', 'Your previous measured battle is still settling. Try again after it completes.'],
    ['provider_failure', 'Measured scoring could not start this battle just now. Try again in a minute.'],
    [undefined, 'Measured scoring could not start this battle just now. Try again in a minute.'],
  ])('reason %s maps to its line', async (reason, line) => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason, retriable: true }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBe(line);
  });
  it('no other error gains a line', () => {
    for (const body of [{ error: 'pricing_unavailable', reason: 'late_start_cutoff' }, { error: 'Failed to generate portfolio' }, null, undefined]) expect(stockAdmissionLine(body)).toBe(null);
  });
});
