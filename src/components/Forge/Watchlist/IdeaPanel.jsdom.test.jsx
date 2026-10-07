// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.jsdom.test.jsx
//
// Pilot P1a — the Forge "Idea" panel: hidden when the gate is off (no
// request at all) or the server answers `disabled`; the current version's
// statement, time-frame, status and dates; the history; exactly the moves the
// shared transition table allows; "save as a new version"; reaffirmation with
// the table-C line; and only theme tokens for color.

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

const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  status: 'researched', stateReason: 'dialogue_completed', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const answer = (versions, currentVersion = versions.length ? Math.max(...versions.map((x) => x.version)) : 0) => ({ watchlistId: 'wl-1', currentVersion, versions: [...versions].sort((a, b) => b.version - a.version) });
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
async function mount(props = {}) {
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} listTickers={[{ symbol: 'NVDA' }]} {...props} />); });
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

describe('the gate — the panel is hidden when the records are off for this player', () => {
  it('flag OFF → renders NOTHING and makes no request', async () => {
    state.on = false;
    await mount();
    expect(container.innerHTML).toBe('');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('the server answers `disabled` (off the allowlist) → renders nothing', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('disabled'), { code: 'disabled', status: 404 }));
    await mount();
    expect(container.innerHTML).toBe('');
  });
  it('any other failure is said, with a retry — never a silent blank', async () => {
    svc.listHypothesisVersions.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'server_error', status: 500 }));
    await mount();
    expect(container.textContent).toContain(PANEL_COPY.loadFailed);
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    await click(button(PANEL_COPY.retry));
    expect(q('idea-statement').textContent).toBe('Idea number 1');
  });
});

describe('the record — current version, dates, history', () => {
  it('shows the current version\'s statement, status, time-frame with its source, and its dates; the history newest first', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([
      v(1, { status: 'retired', successorVersion: 2 }),
      v(2, { status: 'ready', horizonEnum: 'longterm', horizonSource: 'player', stateChangedAt: '2026-10-09T15:00:00.000Z', firstDeployedAt: null }),
    ]));
    await mount();
    expect(q('idea-statement').textContent).toBe('Idea number 2');
    expect(q('idea-status').textContent).toBe('v2 · Ready');
    expect(q('idea-horizon').textContent).toBe('Long-term · your pick');
    expect(q('idea-dates').textContent).toBe('Saved Oct 7, 2026 · Status since Oct 9, 2026');
    const rows = [...q('idea-history').querySelectorAll('li')].map((li) => li.textContent);
    expect(rows).toEqual(['v2 · Ready · Oct 7, 2026 — Idea number 2', 'v1 · Retired · Oct 7, 2026 · → v2 — Idea number 1']);
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
  it('Waiting for evidence needs the missing evidence named before it can be confirmed', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockResolvedValue({});
    await mount();
    await click(button(ACTION_LABELS.wait));
    const confirm = button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.wait}`);
    expect(confirm.disabled).toBe(true);
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
  it('a typed refusal (409) is shown and the record reloads', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.transitionHypothesis.mockRejectedValue(Object.assign(new Error("The idea's state changed since you loaded it. Reload and try again."), { code: 'status_conflict', status: 409 }));
    await mount();
    await click(button(ACTION_LABELS.reject));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.reject}`));
    expect(q('idea-notice').textContent).toBe("The idea's state changed since you loaded it. Reload and try again.");
    expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(2);
  });
});

describe('writing and editing — content changes only by a new version', () => {
  it('no version yet → "Write the idea" → createHypothesisVersion at expectedVersion 0 with the typed statement', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([]));
    svc.createHypothesisVersion.mockResolvedValue({});
    await mount();
    expect(container.textContent).toContain(PANEL_COPY.empty);
    await click(button(PANEL_COPY.writeFirst));
    await typeInto(q('idea-editor').querySelector('textarea'), 'Grid capex compounds');
    await click(button(PANEL_COPY.save));
    expect(svc.createHypothesisVersion).toHaveBeenCalledWith('wl-1', { opId: 'op-fixed', expectedVersion: 0, statement: 'Grid capex compounds' });
  });
  it('"Save as a new version" prefills the current statement; a picked time-frame is sent, an untouched one is not', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1), v(2, { status: 'activated' })]));
    svc.createHypothesisVersion.mockResolvedValue({});
    await mount();
    await click(button(PANEL_COPY.saveNew));
    expect(q('idea-editor').querySelector('textarea').value).toBe('Idea number 2');
    expect(q('idea-editor').textContent).toContain(PANEL_COPY.editorHint);
    await typeInto(q('idea-editor').querySelector('select'), 'positional');
    await click(button(PANEL_COPY.save));
    expect(svc.createHypothesisVersion).toHaveBeenCalledWith('wl-1', { opId: 'op-fixed', expectedVersion: 2, statement: 'Idea number 2', horizonEnum: 'positional' });
  });
  it('the editor keeps ONE opId for its life, so a retried save is the same request (idempotent server-side)', async () => {
    let n = 0;
    svc.newOpId.mockImplementation(() => `op-${++n}`);
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)]));
    svc.createHypothesisVersion.mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'request_failed' })).mockResolvedValueOnce({});
    await mount();
    await click(button(PANEL_COPY.saveNew));
    await click(button(PANEL_COPY.save)); // fails — the editor stays open
    expect(q('idea-notice').textContent).toBe('network');
    await click(button(PANEL_COPY.save)); // the retry
    expect(svc.createHypothesisVersion.mock.calls.map((c) => c[1].opId)).toEqual(['op-1', 'op-1']);
    // A NEW editing session is a new request.
    await click(button(PANEL_COPY.saveNew));
    expect(svc.newOpId).toHaveBeenCalledTimes(2);
  });
});

describe('review due and reaffirmation — table C verbatim', () => {
  it('review_due (horizon elapsed) shows the table-C line filled from the record; Reaffirm with no edit sends no content', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'horizon_elapsed' })]));
    svc.reaffirmHypothesis.mockResolvedValue({});
    await mount();
    expect(q('idea-lifecycle-line').textContent).toBe(
      "Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it.",
    );
    await click(button(ACTION_LABELS.reaffirm));
    await click(button(ACTION_LABELS.reaffirm));
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, opId: 'op-fixed', expectedVersion: 1 });
    expect(q('idea-notice').textContent).toBe(LIFECYCLE_LINES.reaffirmed);
  });
  it('Reaffirm with an edited statement sends it', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'review_due', stateReason: 'battle_ended', horizonEnum: 'unspecified' })]));
    svc.reaffirmHypothesis.mockResolvedValue({});
    await mount();
    expect(q('idea-lifecycle-line').textContent).toBe("The battle ended with your NVDA idea still open-ended. It's flagged for review — reaffirm or retire when you're ready.");
    await click(button(ACTION_LABELS.reaffirm));
    await typeInto(q('idea-editor').querySelector('textarea'), 'A sharper idea');
    await click(button(ACTION_LABELS.reaffirm));
    expect(svc.reaffirmHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, opId: 'op-fixed', expectedVersion: 1, statement: 'A sharper idea' });
  });
  it('lifecycleLineFor: no line when a placeholder has no recorded value (never invented)', () => {
    expect(lifecycleLineFor(v(1, { status: 'review_due', stateReason: 'horizon_elapsed' }), [])).toBeNull();
    expect(lifecycleLineFor(v(1, { status: 'review_due', stateReason: 'horizon_elapsed', horizonEnum: 'unspecified' }), [{ symbol: 'NVDA' }])).toBeNull();
    expect(lifecycleLineFor(v(1, { status: 'invalidated', stateReason: 'close_below_slow' }), ['NVDA'])).toBe(
      "Your NVDA idea hit its invalidation: close_below_slow. That's recorded on the idea itself — what happens next is your call.",
    );
    expect(lifecycleLineFor(v(1, { status: 'ready' }), ['NVDA'])).toBeNull();
  });
});

describe('design tokens only', () => {
  it('IdeaPanel.jsx introduces no hex or rgb color literal — every color is a theme token', () => {
    const src = readFileSync(resolve(HERE, 'IdeaPanel.jsx'), 'utf8');
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(src.match(/rgba?\(/g)).toBeNull();
  });
});
