// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.research.jsdom.test.jsx
//
// Pilot P2 — the Idea panel's research line and the player's own
// "researched" (acceptance row 12): the line shows each origin's own stages,
// every number from the record; the state is said when the research did not
// complete; the list's own research is never pushed out by analysis sessions,
// and an analysis view opened and left (no model turn) is never "researched
// with your agent" (reviews R4-1 / R1-3 / R1-4); a record closed against
// another list lends this one nothing (R4-4 / R1-1); "No research recorded…"
// only when literally true (R4-7); "You marked this researched." is distinct
// from research done with the agent; a draft offers "Mark researched"; and
// with the gate off nothing new renders (the P1a gate rows in
// IdeaPanel.jsdom.test.jsx cover the rest of the gate).
//
// Every case mounts a FRESH panel and asserts its own fetch (review R4-6: a
// re-render with the same props fetches nothing, so a looped case could assert
// against the previous DOM).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

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

import IdeaPanel from './IdeaPanel';
import { DARK_TOKENS } from '../../../theme/tokens';
import { RESEARCH_COPY, ACTION_LABELS, PANEL_COPY } from './ideaCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
function freshRoot() {
  if (root) act(() => root.unmount());
  container?.remove();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}
beforeEach(() => {
  state.on = true;
  for (const fn of Object.values(svc)) fn.mockReset?.();
  svc.newOpId.mockImplementation(() => 'op-fixed');
  root = null;
  container = null;
  freshRoot();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const NULLS = { universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: null, investigationsCompleted: null, eligible: null };
const research = (id, origin, stages, { st = 'completed', completions = 1, watchlistId = 'wl-1' } = {}) => ({
  researchWorkId: id, origin, createdAt: '2026-10-07T14:00:00.000Z', watchlistId, hypothesisVersion: null,
  stages: { ...NULLS, ...stages }, completions, state: st, terminalReason: null, endedAt: null,
});
const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  status: 'researched', stateReason: 'dialogue_completed', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const answer = (versions, researchList = []) => ({
  watchlistId: 'wl-1', currentVersion: versions.length ? Math.max(...versions.map((x) => x.version)) : 0, versions, research: researchList,
});
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
/** One fresh panel for one answer; asserts the answer was actually fetched. */
async function show(data) {
  freshRoot();
  svc.listHypothesisVersions.mockReset();
  svc.listHypothesisVersions.mockResolvedValue(data);
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
  await flush();
  expect(svc.listHypothesisVersions).toHaveBeenCalledTimes(1);
}
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
const all = (id) => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const lines = () => all('idea-research-line').map((e) => e.textContent);
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
async function click(el) { await act(async () => { el.click(); }); await flush(); }

describe('the research line', () => {
  it('a dialogue list: the approved "[n] candidates · [n] kept", nothing said about state when completed', async () => {
    await show(answer([v(1)], [research('ws_1', 'signaldrop', { shortlisted: 6, selectedForInvestigation: 4, eligible: 4 })]));
    expect(lines()).toEqual(['Researched with your agent: 6 candidates · 4 kept']);
    expect(q('idea-research-state')).toBeNull();
    expect(q('idea-research-none')).toBeNull();
  });
  it('the list\'s own research first, then its newest WORKED analysis session, which says it is still open', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], [
      research('rs_1', 'screener', { universeSize: 503, matchedPreLimit: 41, shortlisted: 25, eligible: 25 }),
      research('as_3', 'analysis', { selectedForInvestigation: 25, investigationsCompleted: 24 }, { st: 'open', completions: 0 }),
      research('as_2', 'analysis', { selectedForInvestigation: 25, investigationsCompleted: 23 }, { st: 'open', completions: 2 }),
      research('as_1', 'analysis', { selectedForInvestigation: 25, investigationsCompleted: 22 }, { st: 'open', completions: 1 }),
    ]));
    expect(lines()).toEqual([
      'Researched with your agent: 503 screened · 41 matched · 25 returned · 25 kept',
      `Researched with your agent: 25 in the set · 23 with data · ${RESEARCH_COPY.stillOpen}`,
    ]);
  });
  it('analysis views opened and left (no completed model turn) say nothing — not even "no research"', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], [
      research('as_2', 'analysis', { selectedForInvestigation: 3, investigationsCompleted: 2 }, { st: 'open', completions: 0 }),
    ]));
    expect(lines()).toEqual([]);
    expect(q('idea-research-none')).toBeNull();
  });
  it('research that ended early says so', async () => {
    await show(answer([v(1)], [research('ws_9', 'theme', { shortlisted: 2, selectedForInvestigation: 1, eligible: 0 }, { st: 'abandoned' })]));
    expect(q('idea-research-state').textContent).toBe(` · ${RESEARCH_COPY.endedEarly}`);
  });
  it('a record closed against ANOTHER list lends this list nothing', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], [
      research('rs_1', 'screener', { universeSize: 6, matchedPreLimit: 4, shortlisted: 3, eligible: 3 }, { watchlistId: 'wl-0' }),
    ]));
    expect(lines()).toEqual([]);
  });
});

describe('"No research recorded for this idea yet." — only when literally true', () => {
  it('no record at all for a list whose idea exists → said', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], []));
    expect(q('idea-research-none').textContent).toBe(RESEARCH_COPY.none);
  });
  it('a manual list (it HAS its own record) → not said', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], [research('wl_1', 'manual', {}, { completions: 0 })]));
    expect(q('idea-research-none')).toBeNull();
    expect(lines()).toEqual([]);
  });
  it('no idea yet → not said (only "No idea is recorded…")', async () => {
    await show(answer([], []));
    expect(q('idea-research-none')).toBeNull();
    expect(container.textContent).toContain(PANEL_COPY.empty);
  });
  it('beside a version the dialogue already researched → not said', async () => {
    await show(answer([v(1, { status: 'researched', stateReason: 'dialogue_completed' })], []));
    expect(q('idea-research-none')).toBeNull();
  });
  it('an answer that does not carry research (unknown) → not said, never invented as "none"', async () => {
    await show({ watchlistId: 'wl-1', currentVersion: 1, versions: [v(1, { status: 'draft', stateReason: 'player_authored' })] });
    expect(q('idea-research-none')).toBeNull();
  });
});

describe('the player\'s own "researched" (founder ruling D4)', () => {
  it('a draft offers "Mark researched"; confirming sends mark_researched as a compare-and-set on the status seen', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], []));
    svc.transitionHypothesis.mockResolvedValue({ watchlistId: 'wl-1', version: v(1, { status: 'researched', stateReason: 'player_marked_researched' }) });
    const offered = [...q('idea-actions').querySelectorAll('button')].map((b) => b.textContent);
    expect(offered).toContain(ACTION_LABELS.mark_researched);
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'researched', stateReason: 'player_marked_researched', stateSource: 'player' })], []));
    await click(button(ACTION_LABELS.mark_researched));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.mark_researched}`));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'draft' });
    expect(q('idea-player-marked').textContent).toBe(RESEARCH_COPY.playerMarked);
    // Distinct from agent research: no agent research is recorded, and the panel says so.
    expect(q('idea-research-none').textContent).toBe(RESEARCH_COPY.none);
  });
  it('agent research is never labelled as the player\'s: a dialogue-researched version shows no player-marked line and no "Mark researched"', async () => {
    await show(answer([v(1, { status: 'researched', stateReason: 'dialogue_completed' })], [research('ws_1', 'signaldrop', { shortlisted: 1, selectedForInvestigation: 1, eligible: 1 })]));
    expect(q('idea-player-marked')).toBeNull();
    expect(container.textContent).not.toContain(ACTION_LABELS.mark_researched);
  });
});

describe('mutation-lens rows (R5)', () => {
  it('R5-21 a load failure after the gate admitted the player shows the error card and no research block (never stale lines)', async () => {
    freshRoot();
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('boom'), { status: 500, code: 'server_error', body: { error: 'server_error', message: 'x' } }));
    await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
    await flush();
    expect(container.textContent).toContain(PANEL_COPY.loadFailed);
    expect(q('idea-research')).toBeNull();
  });
  it('R5-26 "Mark researched" is styled as the forward move, not as a closing one', async () => {
    await show(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], []));
    const mark = button(ACTION_LABELS.mark_researched);
    const reject = button(ACTION_LABELS.reject);
    expect(mark.style.color).toBeTruthy();
    expect(mark.style.color).not.toBe(reject.style.color);
  });
});

describe('gate off — nothing new renders', () => {
  it('flag off: nothing at all, no request', async () => {
    state.on = false;
    freshRoot();
    await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
    await flush();
    expect(container.innerHTML).toBe('');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('the server says disabled: nothing at all', async () => {
    freshRoot();
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { status: 404, code: 'disabled', body: { error: 'disabled' } }));
    await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
    await flush();
    expect(container.innerHTML).toBe('');
  });
});
