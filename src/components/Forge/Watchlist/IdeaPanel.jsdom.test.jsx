// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.jsdom.test.jsx
//
// Pilot P1a — the Forge "Idea" panel: it renders NOTHING until the server
// proves the gate is on for this player (no request at all with the flag off;
// nothing while the first answer is pending; nothing on `disabled` or on a
// failure that comes before the gate's verdict); then the current version's
// statement, time-frame, status and dates; the history; exactly the moves the
// shared transition table allows (superseded versions included); "save as a
// new version" (never a no-op); retries that replay the identical request;
// reaffirmation with the table-C line; and only theme tokens for color.
// Review findings pinned here: L4-1, L4-2/L2-1, L4-3, L4-4, L4-5, L4-6/L1-2,
// L4-7, L4-8, L1-6.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const state = vi.hoisted(() => ({ on: true }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isHypothesisRecordsOn: () => state.on }));
const svc = vi.hoisted(() => ({
  listHypothesisVersions: vi.fn(),
  createHypothesisVersion: vi.fn(),
  transitionHypothesis: vi.fn(),
  reaffirmHypothesis: vi.fn(),
  newOpId: vi.fn(() => 'op-fixed'),
}));
vi.mock('../../../services/hypothesisVersionService', () => svc);

import IdeaPanel, { lifecycleLineFor } from './IdeaPanel';
import { DARK_TOKENS } from '../../../theme/tokens';
import { LIFECYCLE_LINES, ACTION_LABELS, PANEL_COPY } from './ideaCopy';
import { legalActionsFor } from '../../../constants/hypothesisRecords';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = dirname(fileURLToPath(import.meta.url));
let container;
let root;
beforeEach(() => {
  state.on = true;
  for (const fn of Object.values(svc)) fn.mockReset?.();
  svc.newOpId.mockImplementation(() => 'op-fixed');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const cond = (symbol) => ({ symbol, side: 'above', level: 100, basis: 'daily_close' });
const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  status: 'researched', stateReason: 'dialogue_completed', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const answer = (versions, currentVersion = versions.length ? Math.max(...versions.map((x) => x.version)) : 0) => ({ watchlistId: 'wl-1', currentVersion, versions: [...versions].sort((a, b) => b.version - a.version) });
/** The service's error shape (hypothesisVersionService.toError): HTTP errors carry status, code and body. */
const httpError = (status, code, message = `server says ${code}`) => Object.assign(new Error(message), { status, code, body: { error: code, message } });
const networkError = () => new TypeError('Failed to fetch');
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
async function mount(props = {}) {
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} {...props} />); });
  await flush();
}
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
const buttons = () => [...container.querySelectorAll('button')];
const button = (label) => buttons().find((b) => b.textContent === label);
async function click(el) { await act(async () => { el.click(); }); await flush(); }
async function typeInto(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

describe('the gate — nothing renders until the server proves the gate is on for this player (review L4-1)', () => {
  it('flag OFF → renders NOTHING and makes no request', async () => {
    state.on = false;
    await mount();
    expect(container.innerHTML).toBe('');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('while the first answer is PENDING → nothing at all (no heading, no spinner, no layout jump for a gated-off player)', async () => {
    const d = deferred();
    svc.listHypothesisVersions.mockReturnValue(d.promise);
    await mount();
    expect(container.innerHTML).toBe('');
    d.resolve(answer([v(1)]));
    await flush();
    expect(q('idea-statement').textContent).toBe('Idea number 1');
  });
  it('the server answers `disabled` (off the allowlist) → renders nothing', async () => {
    svc.listHypothesisVersions.mockRejectedValue(httpError(404, 'disabled'));
    await mount();
    expect(container.innerHTML).toBe('');
  });
  for (const [label, err] of [
    ['a network failure', networkError()],
    ['a rate limit (429, before the gate)', httpError(429, 'request_failed')],
    ['an expired token (401, before the gate)', httpError(401, 'Authentication required')],
    ['an untyped platform error', httpError(502, 'request_failed')],
  ]) {
    it(`a first-load failure the gate has not ruled on — ${label} — renders nothing (the layout never changes on a guess)`, async () => {
      svc.listHypothesisVersions.mockRejectedValue(err);
      await mount();
      expect(container.innerHTML).toBe('');
    });
  }
  for (const [status, code] of [[404, 'not_found'], [403, 'forbidden']]) {
    it(`a first-load ${code} (raised only after the gate admitted the player) shows the error card (review L5-9)`, async () => {
      svc.listHypothesisVersions.mockRejectedValue(httpError(status, code));
      await mount();
      expect(container.textContent).toContain(PANEL_COPY.loadFailed);
    });
  }
  it('a first-load error the server raises only AFTER admitting the player (server_error) is said, with a retry', async () => {
    svc.listHypothesisVersions.mockRejectedValueOnce(httpError(500, 'server_error'));
    await mount();
    expect(container.textContent).toContain(PANEL_COPY.loadFailed);
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    await click(button(PANEL_COPY.retry));
    expect(q('idea-statement').textContent).toBe('Idea number 1');
  });
  it('once the gate is known on, a later reload failure is said, never a silent blank', async () => {
    svc.listHypothesisVersions.mockResolvedValueOnce(answer([v(1)])).mockRejectedValue(networkError());
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    await click(button(ACTION_LABELS.ready));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.ready}`));
    expect(container.textContent).toContain(PANEL_COPY.loadFailed);
  });
});

describe('the record — current version, dates, history', () => {
  it('shows the current version\'s statement, status, time-frame with its source, and its dates; the history newest first, counted by the pointer', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([
      v(1, { status: 'retired', successorVersion: 2 }),
      v(2, { status: 'ready', horizonEnum: 'longterm', horizonSource: 'player', stateChangedAt: '2026-10-09T15:00:00.000Z' }),
    ]));
    await mount();
    expect(q('idea-statement').textContent).toBe('Idea number 2');
    expect(q('idea-status').textContent).toBe('v2 · Ready');
    expect(q('idea-horizon').textContent).toBe('Long-term · your pick');
    expect(q('idea-dates').textContent).toBe('Saved Oct 7, 2026 · Status since Oct 9, 2026');
    expect(q('idea-history').textContent).toContain(`${PANEL_COPY.history} (2)`);
    expect(q('idea-history-v2').textContent).toBe('v2 · Ready · Oct 7, 2026 — Idea number 2');
    expect(q('idea-history-v1').textContent).toBe('v1 · Retired · Oct 7, 2026 · → v2 — Idea number 1');
  });
  it('the current version is the one the POINTER names, not the newest in the page (review L5-9)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'ready' }), v(2, { status: 'draft' })], 1));
    await mount();
    expect(q('idea-statement').textContent).toBe('Idea number 1');
    expect(q('idea-status').textContent).toBe('v1 · Ready');
  });
  it('the saved-watchlist screen mounts the panel (source tripwire — no suite renders WatchlistEditor; review L5-1)', () => {
    const src = readFileSync(resolve(HERE, 'WatchlistEditor.jsx'), 'utf8');
    expect(src).toMatch(/import IdeaPanel from '\.\/IdeaPanel';/);
    expect(src).toMatch(/<IdeaPanel watchlistId=\{watchlistId\} tokens=\{tokens\} \/>/);
  });
  it('the history count is the pointer, not the page (a list past the page cap still counts true)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(150, { status: 'draft' }), v(149, { status: 'retired', successorVersion: 150 })], 150));
    await mount();
    expect(q('idea-history').textContent).toContain(`${PANEL_COPY.history} (150)`);
  });
  it('deploy dates show when the record has them (P1b writes them)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'activated', firstDeployedAt: '2026-10-08T14:00:00.000Z', reviewDueAt: '2026-10-22T20:00:00.000Z' })]));
    await mount();
    expect(q('idea-dates').textContent).toBe('Saved Oct 7, 2026 · Status since Oct 7, 2026 · First deployed Oct 8, 2026 · Review due Oct 22, 2026');
  });
  it('waiting_for_evidence names what it waits on', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'waiting_for_evidence', missingEvidence: 'the Q3 print' })]));
    await mount();
    expect(container.textContent).toContain('Waiting on: the Q3 print');
  });
});

describe('the moves offered are exactly the shared table\'s', () => {
  const labelsFor = (status) => legalActionsFor(status).map((a) => ACTION_LABELS[a]);
  for (const status of ['draft', 'researched', 'ready', 'waiting_for_evidence', 'activated', 'invalidated', 'review_due', 'retired', 'rejected', 'cancelled']) {
    it(`${status}: ${labelsFor(status).join(', ') || 'no move'}${status === 'review_due' ? '' : ' + Save as a new version'}`, async () => {
      svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status, stateReason: status === 'review_due' ? 'horizon_elapsed' : 'x' })]));
      await mount();
      const offered = [...q('idea-actions').querySelectorAll('button')].map((b) => b.textContent);
      expect(offered).toEqual([...labelsFor(status), ...(status === 'review_due' ? [] : [PANEL_COPY.saveNew])]);
    });
  }
  it('a SUPERSEDED version that is still open offers its closing moves on its history row; the move targets that version (review L4-7)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'ready', successorVersion: 2 }), v(2, { status: 'draft' })]));
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    const row = q('idea-history-v1');
    expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toEqual(legalActionsFor('ready', { isCurrent: false }).map((a) => ACTION_LABELS[a]));
    expect(q('idea-history-v2').querySelectorAll('button')).toHaveLength(0); // the current version's moves live above
    await click([...row.querySelectorAll('button')].find((b) => b.textContent === ACTION_LABELS.retire));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.retire} v1`));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'retire', expectedStatus: 'ready' });
  });
  it('a closed (terminal) superseded version offers nothing', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'retired', successorVersion: 2 }), v(2, { status: 'draft' })]));
    await mount();
    expect(q('idea-history-v1').querySelectorAll('button')).toHaveLength(0);
  });
});

describe('moves go to the server with the status the player saw, then the record reloads', () => {
  it('Mark ready → confirm → transitionHypothesis({ version, action: ready, expectedStatus }) → reload', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    await click(button(ACTION_LABELS.ready));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.ready}`));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'ready', expectedStatus: 'researched' });
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });
  it('the panel stays BUSY until the reload lands — no move for the old status can be made in between (review L4-5)', async () => {
    const reload = deferred();
    svc.listHypothesisVersions.mockResolvedValueOnce(answer([v(1)])).mockReturnValueOnce(reload.promise);
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    await click(button(ACTION_LABELS.ready));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.ready}`));
    expect(q('idea-status').textContent).toBe('v1 · Researched'); // the reload is in flight
    expect([...q('idea-actions').querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    reload.resolve(answer([v(1, { status: 'ready', stateReason: 'player_ready' })]));
    await flush();
    expect(q('idea-status').textContent).toBe('v1 · Ready');
    expect([...q('idea-actions').querySelectorAll('button')].some((b) => b.disabled)).toBe(false);
  });
  it('Waiting for evidence needs the missing evidence named before it can be confirmed', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    await click(button(ACTION_LABELS.wait));
    expect(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.wait}`).disabled).toBe(true);
    await typeInto(q('idea-confirm').querySelector('input'), 'the Q3 print');
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.wait}`));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'wait', expectedStatus: 'researched', missingEvidence: 'the Q3 print' });
  });
  it('a closing move warns it is final', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    await mount();
    await click(button(ACTION_LABELS.retire));
    expect(q('idea-confirm').textContent).toContain(PANEL_COPY.closeConfirm);
    await click(button(PANEL_COPY.keep));
    expect(q('idea-confirm')).toBeNull();
    expect(svc.transitionHypothesis).not.toHaveBeenCalled();
  });
  it('a typed refusal (409) shows the server\'s words and the record reloads', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockRejectedValue(httpError(409, 'status_conflict', "The idea's state changed since you loaded it. Reload and try again."));
    await mount();
    await click(button(ACTION_LABELS.reject));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.reject}`));
    expect(q('idea-notice').textContent).toBe("The idea's state changed since you loaded it. Reload and try again.");
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });
  it('a network failure shows the panel\'s own words, never a raw browser string (review L4-8)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockRejectedValue(networkError());
    await mount();
    await click(button(ACTION_LABELS.reject));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.reject}`));
    expect(q('idea-notice').textContent).toBe(PANEL_COPY.moveFailed);
  });
  it('a `disabled` answer to a MOVE hides the panel and sends no reload', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockRejectedValue(httpError(404, 'disabled'));
    await mount();
    await click(button(ACTION_LABELS.reject));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.reject}`));
    expect(container.innerHTML).toBe('');
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
  });
});

describe('writing and editing — content changes only by a new version, never by a no-op', () => {
  it('no version yet → "Write the idea" → createHypothesisVersion at expectedVersion 0; the time-frame default is never named (review L4-4)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([]));
    svc.createHypothesisVersion.mockResolvedValue({});
    await mount();
    expect(container.textContent).toContain(PANEL_COPY.empty);
    await click(button(PANEL_COPY.writeFirst));
    const options = [...q('idea-editor').querySelectorAll('option')].map((o) => [o.value, o.textContent]);
    expect(options[0]).toEqual(['', PANEL_COPY.horizonDefault]);
    expect(options.filter(([, label]) => label === options[0][1])).toHaveLength(1); // no duplicate label
    await typeInto(q('idea-editor').querySelector('textarea'), 'Grid capex compounds');
    await click(button(PANEL_COPY.save));
    expect(svc.createHypothesisVersion).toHaveBeenCalledWith('wl-1', { opId: 'op-fixed', expectedVersion: 0, statement: 'Grid capex compounds' });
  });
  it('"Save as a new version" opens prefilled, says the new version starts as a draft, and cannot save a NO-OP (review L4-3)', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1), v(2, { status: 'activated' })]));
    svc.createHypothesisVersion.mockResolvedValue({});
    await mount();
    await click(button(PANEL_COPY.saveNew));
    expect(q('idea-editor').querySelector('textarea').value).toBe('Idea number 2');
    expect(q('idea-editor').textContent).toContain(PANEL_COPY.draftHint);
    expect(button(PANEL_COPY.save).disabled).toBe(true);
    await typeInto(q('idea-editor').querySelector('textarea'), '  Idea number 2  '); // whitespace is not an edit
    expect(button(PANEL_COPY.save).disabled).toBe(true);
    await typeInto(q('idea-editor').querySelector('select'), 'positional'); // a time-frame pick is
    expect(button(PANEL_COPY.save).disabled).toBe(false);
    await click(button(PANEL_COPY.save));
    expect(svc.createHypothesisVersion).toHaveBeenCalledWith('wl-1', { opId: 'op-fixed', expectedVersion: 2, statement: '  Idea number 2  ', horizonEnum: 'positional' });
  });
  it('a RETRY after a lost response is the identical request — same opId AND the pointer the editor was opened against (review L2-1 / L4-2)', async () => {
    let n = 0;
    svc.newOpId.mockImplementation(() => `op-${++n}`);
    // The first save commits server-side but the response is lost: the reload already shows v2.
    svc.listHypothesisVersions.mockResolvedValueOnce(answer([v(1)])).mockResolvedValue(answer([v(1, { successorVersion: 2 }), v(2, { status: 'draft', statement: 'Sharper' })]));
    svc.createHypothesisVersion.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ idempotent: true });
    await mount();
    await click(button(PANEL_COPY.saveNew));
    await typeInto(q('idea-editor').querySelector('textarea'), 'Sharper');
    await click(button(PANEL_COPY.save)); // lost — the editor stays open for a retry
    expect(q('idea-notice').textContent).toBe(PANEL_COPY.moveFailed);
    expect(q('idea-editor')).not.toBeNull();
    await click(button(PANEL_COPY.save)); // the retry
    expect(svc.createHypothesisVersion.mock.calls.map((c) => c[1])).toEqual([
      { opId: 'op-1', expectedVersion: 1, statement: 'Sharper' },
      { opId: 'op-1', expectedVersion: 1, statement: 'Sharper' },
    ]);
    expect(q('idea-editor')).toBeNull();
    // A NEW editing session is a new request.
    await click(button(PANEL_COPY.saveNew));
    expect(svc.newOpId).toHaveBeenCalledTimes(2);
  });
  it('a 409 conflict closes the editor: the request it holds can no longer apply as opened', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.createHypothesisVersion.mockRejectedValue(httpError(409, 'version_conflict', 'The idea changed since you loaded it. Reload and try again.'));
    await mount();
    await click(button(PANEL_COPY.saveNew));
    await typeInto(q('idea-editor').querySelector('textarea'), 'Sharper');
    await click(button(PANEL_COPY.save));
    expect(q('idea-editor')).toBeNull();
    expect(q('idea-notice').textContent).toBe('The idea changed since you loaded it. Reload and try again.');
  });
});

describe('review due and reaffirmation — table C verbatim, filled only from the version\'s own record', () => {
  it('review_due (horizon elapsed) with a symbol on the version → the table-C line; Reaffirm with no edit sends no content', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', activation: [cond('NVDA')] })]));
    svc.reaffirmHypothesis.mockResolvedValue({});
    await mount();
    expect(q('idea-lifecycle-line').textContent).toBe(
      "Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.",
    );
    await click(button(ACTION_LABELS.reaffirm));
    expect(button(ACTION_LABELS.reaffirm).disabled).toBe(false); // same content is a legal reaffirmation
    await click(button(ACTION_LABELS.reaffirm));
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, opId: 'op-fixed', expectedVersion: 1 });
    expect(q('idea-notice').textContent).toBe(LIFECYCLE_LINES.reaffirmed);
  });
  it('a reaffirm RETRY after a lost response is the identical request — same opId, target and pointer as opened (review L5-2)', async () => {
    let n = 0;
    svc.newOpId.mockImplementation(() => `op-${++n}`);
    svc.listHypothesisVersions
      .mockResolvedValueOnce(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed' })], 1))
      // The first reaffirm committed server-side; its response was lost. The reload already shows v2.
      .mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed', successorVersion: 2 }), v(2, { status: 'ready' })], 2));
    svc.reaffirmHypothesis.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ idempotent: true });
    await mount();
    await click(button(ACTION_LABELS.reaffirm));
    await click(q('idea-editor').querySelector('button'));
    expect(q('idea-editor')).not.toBeNull();
    await click(q('idea-editor').querySelector('button'));
    expect(svc.reaffirmHypothesis.mock.calls.map((c) => c[1])).toEqual([
      { version: 1, opId: 'op-1', expectedVersion: 1 },
      { version: 1, opId: 'op-1', expectedVersion: 1 },
    ]);
    expect(q('idea-notice').textContent).toBe(LIFECYCLE_LINES.reaffirmed);
  });
  it('Reaffirm with an edited statement sends it; the target is the version the editor opened on', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'battle_ended', horizonEnum: 'unspecified', invalidation: [cond('AMD')] })]));
    svc.reaffirmHypothesis.mockResolvedValue({});
    await mount();
    expect(q('idea-lifecycle-line').textContent).toBe("The battle ended with your AMD idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    await click(button(ACTION_LABELS.reaffirm));
    await typeInto(q('idea-editor').querySelector('textarea'), 'A sharper idea');
    await click(button(ACTION_LABELS.reaffirm));
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, opId: 'op-fixed', expectedVersion: 1, statement: 'A sharper idea' });
  });
  it('a review_due version whose record names no symbol renders NO line (never the list\'s tickers — review L1-2 / L4-6); the chip says it', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed' })]));
    await mount();
    expect(q('idea-lifecycle-line')).toBeNull();
    expect(q('idea-status').textContent).toBe('v1 · Review due');
  });
  it('lifecycleLineFor: no line without a recorded value; `invalidated` renders nothing until P3/P4 define the met condition (review L1-6)', () => {
    expect(lifecycleLineFor(v(1, { status: 'review_due', stateReason: 'horizon_elapsed' }))).toBeNull();
    expect(lifecycleLineFor(v(1, { status: 'review_due', stateReason: 'horizon_elapsed', horizonEnum: 'unspecified', activation: [cond('NVDA')] }))).toBeNull();
    expect(lifecycleLineFor(v(1, { status: 'invalidated', stateReason: 'close_below_slow', invalidation: [cond('NVDA')] }))).toBeNull();
    expect(lifecycleLineFor(v(1, { status: 'ready', activation: [cond('NVDA')] }))).toBeNull();
  });
});

describe('design tokens only', () => {
  it('IdeaPanel.jsx introduces no hex or rgb color literal — every color is a theme token', () => {
    const src = readFileSync(resolve(HERE, 'IdeaPanel.jsx'), 'utf8');
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(src.match(/rgba?\(/g)).toBeNull();
  });
});
