// src/services/dueIdeaCheck.test.js
//
// Pilot P1c — founder ruling E1: the deploy station's question before any
// deploy call (src/services/dueIdeaCheck.js). The screen opens EXACTLY when
// the equipped list's newest deployed version is review_due with no ready
// successor (the shared dueDeployPending — its agreement with the deploy's
// resolver is api/_utils/hypothesisRecords/dueIdea.agreement.test.js), and
// otherwise the deploy runs as before: flag off → no request; nothing
// equipped → no request; any failure → nothing due. Bounded (review L1-1): an
// owner the gate turned away is asked once a page session, and no answer
// holds the deploy longer than DUE_IDEA_CHECK_TIMEOUT_MS. The title claims
// a time-frame only when one elapsed (review L4-1).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ on: true }));
vi.mock('../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isHypothesisRecordsOn: () => state.on }));
const svc = vi.hoisted(() => ({ listHypothesisVersions: vi.fn() }));
vi.mock('./hypothesisVersionService', () => svc);

const { checkDueIdea, readDueIdea, resetDueIdeaCheckSession, DUE_IDEA_CHECK_TIMEOUT_MS } = await import('./dueIdeaCheck');
const { dueDeployPending } = await import('../constants/hypothesisRecords');

const DEPLOYED = { firstDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedBattleId: 'battle-1' };
// A timed idea whose time-frame elapsed (the review pass's reason).
const ELAPSED = { ...DEPLOYED, horizonEnum: 'swing', stateReason: 'horizon_elapsed' };
const v = (n, status, over = {}) => ({ version: n, status, activation: [], invalidation: [], firstDeployedAt: null, ...over });
const AGENT = { id: 'agent-1', ownerId: 'owner-1', equippedWatchlistId: 'wl-1' };

beforeEach(() => {
  state.on = true;
  resetDueIdeaCheckSession();
  svc.listHypothesisVersions.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('checkDueIdea — when the screen opens, and when the deploy just runs', () => {
  it('flag off → null with NO request', async () => {
    state.on = false;
    expect(await checkDueIdea(AGENT)).toBeNull();
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('nothing equipped (or a malformed id) → null with no request', async () => {
    for (const agent of [null, {}, { equippedWatchlistId: null }, { equippedWatchlistId: '' }, { equippedWatchlistId: 7 }]) {
      expect(await checkDueIdea(agent)).toBeNull();
    }
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('the newest deployed version due, nothing newer carriable → the due version, the pointer the GET saw, and the [LIST] title from the FROZEN list', async () => {
    svc.listHypothesisVersions.mockResolvedValue({
      watchlistId: 'wl-1', currentVersion: 3,
      versions: [v(3, 'draft'), v(2, 'review_due', ELAPSED), v(1, 'retired', DEPLOYED)],
      deployedLists: { 2: { battleId: 'battle-1', name: 'AI capex', tickers: ['NVDA', 'AMD'] } },
    });
    expect(await checkDueIdea(AGENT)).toEqual({ watchlistId: 'wl-1', version: 2, currentVersion: 3, title: 'Your AI capex idea reached its time-frame.' });
    expect(svc.listHypothesisVersions).toHaveBeenCalledWith('wl-1');
  });
  it('a one-ticker frozen list → the [SYM] title; no frozen list → no title (the screen still opens)', async () => {
    svc.listHypothesisVersions.mockResolvedValue({ currentVersion: 1, versions: [v(1, 'review_due', ELAPSED)], deployedLists: { 1: { name: 'Chips', tickers: ['NVDA'] } } });
    expect((await checkDueIdea(AGENT)).title).toBe('Your NVDA idea reached its time-frame.');
    svc.listHypothesisVersions.mockResolvedValue({ currentVersion: 1, versions: [v(1, 'review_due', ELAPSED)], deployedLists: {} });
    expect(await checkDueIdea(AGENT)).toEqual({ watchlistId: 'wl-1', version: 1, currentVersion: 1, title: null });
  });
  it('"reached its time-frame" only when one elapsed (review L4-1): an open-ended idea due because its battle ended gets table C\u2019s own line for that state; a clock-fault version (B5) gets none', async () => {
    const frozen = { 1: { name: 'AI capex', tickers: ['NVDA', 'AMD'] } };
    svc.listHypothesisVersions.mockResolvedValue({ currentVersion: 1, versions: [v(1, 'review_due', { ...DEPLOYED, horizonEnum: 'unspecified', stateReason: 'battle_ended' })], deployedLists: frozen });
    expect((await checkDueIdea(AGENT)).title).toBe('The battle ended with your AI capex idea still open-ended. It\u2019s flagged for review \u2014 reaffirm or retire when you\u2019re ready.'.replace(/\u2019/g, "'"));
    svc.listHypothesisVersions.mockResolvedValue({ currentVersion: 1, versions: [v(1, 'review_due', { ...DEPLOYED, horizonEnum: 'swing', stateReason: 'battle_ended', reviewClockFault: 'calendar_unavailable' })], deployedLists: frozen });
    expect(await checkDueIdea(AGENT)).toEqual({ watchlistId: 'wl-1', version: 1, currentVersion: 1, title: null });
  });
  it('NOT shown for an UNCOMMITTED list (review L4-5): the deploy uses it as no equip, so nothing of it can ride — and a reaffirm there would change nothing', async () => {
    const page = { currentVersion: 1, versions: [v(1, 'review_due', ELAPSED)], deployedLists: {} };
    svc.listHypothesisVersions.mockResolvedValue({ ...page, listCommitted: false });
    expect(await checkDueIdea(AGENT)).toBeNull();
    svc.listHypothesisVersions.mockResolvedValue({ ...page, listCommitted: true });
    expect(await checkDueIdea(AGENT)).toMatchObject({ version: 1 });
  });
  it('NOT shown otherwise: a ready successor, an activated idea, a retired newest, drafts only, no versions', async () => {
    for (const versions of [
      [v(2, 'ready'), v(1, 'review_due', DEPLOYED)],
      [v(1, 'activated', DEPLOYED)],
      [v(2, 'retired', DEPLOYED), v(1, 'review_due', DEPLOYED)],
      [v(1, 'draft'), v(2, 'researched')],
      [],
    ]) {
      svc.listHypothesisVersions.mockResolvedValue({ currentVersion: versions.length, versions });
      expect(await checkDueIdea(AGENT), JSON.stringify(versions.map((x) => x.status))).toBeNull();
    }
  });
  it('any failure — the gate off for this player (404 disabled), a network error — → null: the deploy runs exactly as before', async () => {
    svc.listHypothesisVersions.mockRejectedValueOnce(Object.assign(new Error('disabled'), { status: 404, code: 'disabled' }));
    expect(await checkDueIdea(AGENT)).toBeNull();
    svc.listHypothesisVersions.mockRejectedValueOnce(new Error('Failed to fetch'));
    expect(await checkDueIdea({ ...AGENT, ownerId: 'owner-2' })).toBeNull();
  });
  it('an owner the gate turned away (404 disabled) is asked ONCE a page session — no request, no warning after that (review L1-1)', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('disabled'), { status: 404, code: 'disabled' }));
    expect(await checkDueIdea(AGENT)).toBeNull();
    expect(await checkDueIdea(AGENT)).toBeNull();
    expect(await checkDueIdea({ ...AGENT, equippedWatchlistId: 'wl-2' })).toBeNull();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
    // Another owner is still asked; any other failure is not remembered.
    expect(await checkDueIdea({ ...AGENT, ownerId: 'owner-2' })).toBeNull();
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
    svc.listHypothesisVersions.mockRejectedValue(new Error('Failed to fetch'));
    await checkDueIdea({ ...AGENT, ownerId: 'owner-3' });
    await checkDueIdea({ ...AGENT, ownerId: 'owner-3' });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(4);
  });
  it(`no answer holds the deploy longer than ${DUE_IDEA_CHECK_TIMEOUT_MS} ms: a hung GET → null (nothing due), and its late answer changes nothing`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let late;
    svc.listHypothesisVersions.mockReturnValue(new Promise((resolve) => { late = resolve; }));
    const pending = checkDueIdea(AGENT);
    await vi.advanceTimersByTimeAsync(DUE_IDEA_CHECK_TIMEOUT_MS);
    expect(await pending).toBeNull();
    late({ currentVersion: 1, versions: [v(1, 'review_due', ELAPSED)], deployedLists: {} });
    expect(DUE_IDEA_CHECK_TIMEOUT_MS).toBe(2_500);
  });
  it('readDueIdea (the screen\'s re-read) throws what the GET throws — it never fails open', async () => {
    svc.listHypothesisVersions.mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(readDueIdea('wl-1')).rejects.toThrow('Failed to fetch');
  });
});

describe('dueDeployPending — the one predicate (src/constants/hypothesisRecords.js)', () => {
  it('order-free; the newest DEPLOYED version decides; only a newer CARRIABLE version lifts it', () => {
    expect(dueDeployPending([v(1, 'review_due', DEPLOYED), v(2, 'draft')])?.version).toBe(1);
    expect(dueDeployPending([v(2, 'draft'), v(1, 'review_due', DEPLOYED)])?.version).toBe(1);
    expect(dueDeployPending([v(1, 'review_due', DEPLOYED), v(2, 'ready')])).toBeNull();
    expect(dueDeployPending([v(1, 'review_due', DEPLOYED), v(2, 'cancelled'), v(3, 'rejected'), v(4, 'waiting_for_evidence')])?.version).toBe(1);
    // An OLDER ready version never lifts it (B2 strict).
    expect(dueDeployPending([v(1, 'ready'), v(2, 'review_due', DEPLOYED)])?.version).toBe(2);
    // A due version that never deployed is not the deployed one.
    expect(dueDeployPending([v(1, 'review_due')])).toBeNull();
    expect(dueDeployPending([v(1, 'review_due', DEPLOYED), v(2, 'retired', DEPLOYED)])).toBeNull();
  });
  it('malformed input is no answer', () => {
    for (const bad of [null, undefined, 'x', [null, 'y', { version: 'one', status: 'review_due', ...DEPLOYED }], [{ version: 0, status: 'review_due', ...DEPLOYED }]]) {
      expect(dueDeployPending(bad)).toBeNull();
    }
  });
});
