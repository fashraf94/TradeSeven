// src/services/agentDeploy.stockAdmission.test.js
//
// BaggerBomb measured thresholds (v2 Ruling 6, BR-2, BR-4): a measured creation
// the server refuses (decide.js answers `503 { error: 'Stock admission
// unavailable', reason, retriable: true }`) reaches the Deploy Ceremony as one
// short player line in `details`. Only a selected creation can be refused this
// way; every other failure forwards exactly what it did before. BR-2 removed
// the late-start and evening-window refusals and their lines: the publication
// wait (close to close + 15 minutes) is the one timed refusal left.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// R1 (R-R1-4): the deploy is owned by the signed-in uid; one stays signed in throughout.
vi.mock('../firebase/authService', () => ({ getIdToken: async () => 'id-token', getCurrentUser: () => ({ uid: 'uid-1' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), CASUAL_CLONE_CONCURRENCY_ENABLED: false }));

const { deployAgent, stockAdmissionLine, STOCK_ADMISSION_ERROR } = await import('./agentDeploy');
const { etWallClockToMs } = await import('../utils/marketCalendar');

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => JSON.stringify(body) });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete globalThis.fetch; });
// The refusal's own clock: the line names the time from the shared rule (src/utils/stockAdmissionWindow.js).
const at = (date, hh, mm) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(etWallClockToMs(date, hh, mm))); };
const OPEN_415 = 'Measured battles open again at 4:15 PM ET.';
const GENERIC = 'Measured scoring could not start this battle just now. Try again in a minute.';

describe('the measured refusal reads as one clear player line', () => {
  it('publication wait → the 4:15 PM ET line, retriable, with the code and status riding along', async () => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason: 'publication_window_not_open', retriable: true }));
    at('2026-10-21', 16, 5);
    // R1 (R-R1-3) adds the typed outcome beside the unchanged legacy fields.
    expect(await deployAgent('agent-1', vi.fn())).toEqual({
      outcome: 'refused',
      success: false, status: 503, postIssued: true, httpStatus: 503, error: 'Stock admission unavailable',
      details: OPEN_415, errorPhase: undefined,
    });
    for (const [hh, mm] of [[16, 0], [16, 14]]) { at('2026-10-21', hh, mm); expect((await deployAgent('agent-1', vi.fn())).details, `${hh}:${mm}`).toBe(OPEN_415); }
    at('2026-10-23', 16, 10); // Friday
    expect((await deployAgent('agent-1', vi.fn())).details).toBe(OPEN_415);
  });
  it('an early-close day names its own end of the wait: 1:15 PM ET (Nov 27 and Dec 24, 2026)', () => {
    for (const date of ['2026-11-27', '2026-12-24']) {
      expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'publication_window_not_open' }, new Date(etWallClockToMs(date, 13, 5))), date).toBe('Measured battles open again at 1:15 PM ET.');
    }
  });
  it('both DST weekends keep the wall-clock time; off a trading day the line falls back to the plain one', () => {
    // The Monday after each 2026 DST change (Mar 8, Nov 1), by the refusal instant passed in.
    for (const date of ['2026-03-09', '2026-11-02']) expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'publication_window_not_open' }, new Date(etWallClockToMs(date, 16, 5))), date).toBe(OPEN_415);
    expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason: 'publication_window_not_open' }, new Date(etWallClockToMs('2026-10-24', 16, 5)))).toBe('Measured battles reopen 15 minutes after the market close. Try again shortly.');
  });
  it('the retired late-start and evening-window reasons have no line of their own any more', () => {
    for (const reason of ['late_start_cutoff', 'evening_window']) expect(stockAdmissionLine({ error: STOCK_ADMISSION_ERROR, reason }, new Date(etWallClockToMs('2026-10-21', 15, 30))), reason).toBe(GENERIC);
  });
  it.each([
    ['prior_corrected_battle_requires_settlement', 'Your previous measured battle is still settling. Try again after it completes.'],
    ['provider_failure', GENERIC],
    ['calendar_missing', "New battles can't be scheduled yet: next year's market calendar isn't loaded."],
    [undefined, GENERIC],
  ])('reason %s maps to its line', async (reason, line) => {
    globalThis.fetch = vi.fn(async () => respond(503, { error: STOCK_ADMISSION_ERROR, reason, retriable: true }));
    expect((await deployAgent('agent-1', vi.fn())).details).toBe(line);
  });
  it('no other error gains a line', () => {
    for (const body of [{ error: 'pricing_unavailable', reason: 'publication_window_not_open' }, { error: 'Failed to generate portfolio' }, null, undefined]) expect(stockAdmissionLine(body)).toBe(null);
  });
});
