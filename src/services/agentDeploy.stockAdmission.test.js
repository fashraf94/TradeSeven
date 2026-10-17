// src/services/agentDeploy.stockAdmission.test.js
//
// BaggerBomb stock thresholds v2, Rulings 2 and 6 (and P2, the evening window): a measured pilot creation
// the server refuses (decide.js answers `503 { error: 'Stock admission
// unavailable', reason, retriable: true }`) reaches the Deploy Ceremony as one
// short player line in `details`. Only an allowlisted pilot creation can be
// refused this way; every other failure forwards exactly what it did before.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// R1 (R-R1-4): the deploy is owned by the signed-in uid; one stays signed in throughout.
vi.mock('../firebase/authService', () => ({ getIdToken: async () => 'id-token', getCurrentUser: () => ({ uid: 'uid-1' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));

const { deployAgent, stockAdmissionLine, STOCK_ADMISSION_ERROR } = await import('./agentDeploy');
const { etWallClockToMs } = await import('../utils/marketCalendar');

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete globalThis.fetch; });
// The refusal's own clock: the line names the retry time from the shared rule (src/utils/stockAdmissionWindow.js).
const at = (date, hh, mm) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(etWallClockToMs(date, hh, mm))); };
const AFTER_8 = "Measured battles can't start this late in the day. Try again after 8:00 PM ET.";

describe('the measured pilot refusal reads as one clear player line', () => {
  it('late-start cutoff → the retry-time line, retriable, with the code and status riding along', async () => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason: 'late_start_cutoff', retriable: true }));
    at('2026-10-21', 15, 30);
    // R1 (R-R1-3) adds the typed outcome beside the unchanged legacy fields.
    expect(await deployAgent('agent-1', vi.fn())).toEqual({
      outcome: 'refused',
      success: false, status: 503, postIssued: true, httpStatus: 503, error: 'Stock admission unavailable',
      details: AFTER_8, errorPhase: undefined,
    });
  });
  it('evening window → the same line: retry after the Night Game close (P2)', async () => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason: 'evening_window', retriable: true }));
    for (const [hh, mm] of [[16, 0], [16, 15], [18, 0], [19, 59]]) { at('2026-10-21', hh, mm); expect((await deployAgent('agent-1', vi.fn())).details, `${hh}:${mm}`).toBe(AFTER_8); }
    at('2026-10-23', 18, 0); // Friday evening
    expect((await deployAgent('agent-1', vi.fn())).details).toBe(AFTER_8);
  });
  it('an early-close day names the end of its publication window: no Night Game, 1:15 PM ET', () => {
    at('2026-11-27', 12, 30);
    expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'late_start_cutoff' })).toBe("Measured battles can't start this late in the day. Try again after 1:15 PM ET.");
  });
  it('the retry time is computed at the refusal instant passed in; off a trading day the line falls back to the generic one', () => {
    expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'evening_window' }, new Date(etWallClockToMs('2026-12-24', 12, 30)))).toBe("Measured battles can't start this late in the day. Try again after 1:15 PM ET.");
    expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'evening_window' }, new Date(etWallClockToMs('2026-10-24', 18, 0)))).toBe('Measured scoring could not start this battle just now. Try again in a minute.');
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
