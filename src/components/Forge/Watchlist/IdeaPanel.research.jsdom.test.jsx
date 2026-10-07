// @vitest-environment jsdom
// src/components/Forge/Watchlist/IdeaPanel.research.jsdom.test.jsx
//
// Pilot P2 — the Idea panel's research line and the player's own
// "researched" (acceptance row 12): the line shows only the stages a record
// has, each number from the record; the state is said when the research did
// not complete; "You marked this researched." is distinct from research done
// with the agent; a draft offers "Mark researched"; and with the gate off
// nothing new renders (the P1a gate rows in IdeaPanel.jsdom.test.jsx cover
// the rest of the gate).

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

const NULLS = { universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: null, investigationsCompleted: null, eligible: null };
const research = (id, origin, stages, st = 'completed') => ({ researchWorkId: id, origin, createdAt: '2026-10-07T14:00:00.000Z', watchlistId: 'wl-1', hypothesisVersion: null, stages: { ...NULLS, ...stages }, state: st, terminalReason: null, endedAt: null });
const v = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', statement: `Idea number ${n}`, horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [],
  status: 'researched', stateReason: 'dialogue_completed', createdAt: '2026-10-07T14:00:00.000Z', stateChangedAt: '2026-10-07T14:00:00.000Z',
  firstDeployedAt: null, reviewDueAt: null, successorVersion: null, missingEvidence: null, ...over,
});
const answer = (versions, researchList = []) => ({
  watchlistId: 'wl-1', currentVersion: versions.length ? Math.max(...versions.map((x) => x.version)) : 0, versions, research: researchList,
});
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };
async function mount() {
  await act(async () => { root.render(<IdeaPanel watchlistId="wl-1" tokens={DARK_TOKENS} />); });
  await flush();
}
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
const all = (id) => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent === label);
async function click(el) { await act(async () => { el.click(); }); await flush(); }

describe('the research line', () => {
  it('a dialogue list: present stages only, in pipeline order, from the record; nothing said about state when completed', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1)], [research('ws_1', 'signaldrop', { shortlisted: 6, selectedForInvestigation: 4, eligible: 4 })]));
    await mount();
    expect(all('idea-research-line').map((e) => e.textContent)).toEqual(['Researched with your agent: 6 candidates · 4 selected · 4 kept']);
    expect(q('idea-research-state')).toBeNull();
    expect(q('idea-research-none')).toBeNull();
    expect(container.textContent).not.toMatch(/screened|matched|investigated/); // stages it does not have are not shown at all
  });
  it('an open analysis and a completed screener, newest first; the open one says so', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'draft', stateReason: 'player_authored' })], [
      research('as_2', 'analysis', { selectedForInvestigation: 25, investigationsCompleted: 24 }, 'open'),
      research('rs_1', 'screener', { universeSize: 503, matchedPreLimit: 41, shortlisted: 25, eligible: 25 }),
    ]));
    await mount();
    expect(all('idea-research-line').map((e) => e.textContent)).toEqual([
      `Researched with your agent: 25 selected · 24 investigated · ${RESEARCH_COPY.stillOpen}`,
      'Researched with your agent: 503 screened · 41 matched · 25 returned · 25 kept',
    ]);
  });
  it('research that ended early says so', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([], [research('ws_9', 'theme', { shortlisted: 2, selectedForInvestigation: 1, eligible: 0 }, 'abandoned')]));
    await mount();
    expect(q('idea-research-state').textContent).toBe(` · ${RESEARCH_COPY.endedEarly}`);
  });
  it('no agent research (none at all, or only the manual record) → "No research recorded for this idea yet."', async () => {
    for (const list of [[], [research('wl_1', 'manual', {})]]) {
      svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'draft' })], list));
      await mount();
      expect(q('idea-research-none').textContent).toBe(RESEARCH_COPY.none);
      expect(q('idea-research-line')).toBeNull();
    }
  });
  it('an answer without research (an older server) is read as none — never invented', async () => {
    svc.listHypothesisVersions.mockResolvedValue({ watchlistId: 'wl-1', currentVersion: 1, versions: [v(1)] });
    await mount();
    expect(q('idea-research-none').textContent).toBe(RESEARCH_COPY.none);
  });
});

describe('the player\'s own "researched" (founder ruling D4)', () => {
  it('a draft offers "Mark researched"; confirming sends mark_researched as a compare-and-set on the status seen', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'draft', stateReason: 'player_authored' })]));
    svc.transitionHypothesis.mockResolvedValue({ watchlistId: 'wl-1', version: v(1, { status: 'researched', stateReason: 'player_marked_researched' }) });
    await mount();
    const offered = [...q('idea-actions').querySelectorAll('button')].map((b) => b.textContent);
    expect(offered).toContain(ACTION_LABELS.mark_researched);
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'researched', stateReason: 'player_marked_researched', stateSource: 'player' })]));
    await click(button(ACTION_LABELS.mark_researched));
    await click(button(`${PANEL_COPY.confirm}: ${ACTION_LABELS.mark_researched}`));
    expect(svc.transitionHypothesis).toHaveBeenCalledWith('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'draft' });
    expect(q('idea-player-marked').textContent).toBe(RESEARCH_COPY.playerMarked);
  });
  it('agent research is never labelled as the player\'s: a dialogue-researched version shows no player-marked line', async () => {
    svc.listHypothesisVersions.mockResolvedValue(answer([v(1, { status: 'researched', stateReason: 'dialogue_completed' })], [research('ws_1', 'signaldrop', { shortlisted: 1, selectedForInvestigation: 1, eligible: 1 })]));
    await mount();
    expect(q('idea-player-marked')).toBeNull();
    expect(container.textContent).not.toContain(ACTION_LABELS.mark_researched); // only a draft offers it
  });
});

describe('gate off — nothing new renders', () => {
  it('flag off: no research line, no request', async () => {
    state.on = false;
    await mount();
    expect(container.innerHTML).toBe('');
    expect(svc.listHypothesisVersions).not.toHaveBeenCalled();
  });
  it('the server says disabled: nothing at all', async () => {
    svc.listHypothesisVersions.mockRejectedValue(Object.assign(new Error('off'), { status: 404, code: 'disabled', body: { error: 'disabled' } }));
    await mount();
    expect(container.innerHTML).toBe('');
  });
});
