// @vitest-environment jsdom
//
// The two-view shell's Ranks tab (Amendment C R-32; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): today's CompeteTab with ONE
// additive prop, `rankLabel`, which names the shown rank's group and day above
// the badges and follows the badge the player selects. Absent — every caller but
// the shell — the tab renders exactly as before.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const WED_EVENING_ET = Date.UTC(2026, 10, 12, 3, 5); // Wed Nov 11, 22:05 ET
const DOCS = vi.hoisted(() => ({}));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...p) => ({ path: p.join('/') }),
  getDoc: (ref) => Promise.resolve({ exists: () => ref.path in DOCS, data: () => DOCS[ref.path] }),
}));
vi.mock('../Research/RanksLeaderboard', () => ({ default: () => null }));

import CompeteTab from './CompeteTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
const PEER = { ticker: 'CEG', sectorName: 'Utilities', compositeRank: 12, totalPeers: 38, compositeScore: 64, tier: 'Above Average', computedAt: new Date(WED_EVENING_ET).toISOString(), pillars: {}, leaderboard: [] };
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  DOCS['indexIntelligence/stockRankings'] = { computedAt: { toMillis: () => WED_EVENING_ET }, stocks: [{ symbol: 'CEG', sectorId: 'utilities', sectorName: 'Utilities', sectorTechnicalRank: 4, sectorTechnicalTotal: 38 }] };
  DOCS['stockTechnicalScores/CEG'] = { technicalRank: 31, technicalScore: 76, updatedAt: { seconds: Math.floor(WED_EVENING_ET / 1000) } };
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: PEER }) }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); delete globalThis.fetch; });
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const show = async (props) => { await act(async () => { root.render(<CompeteTab symbol="CEG" isMobile onNavigateToStock={() => {}} {...props} />); }); await flush(); };

describe('CompeteTab rankLabel (R-32)', () => {
  it('names the selected badge\'s group and day, and follows the badge the player selects', async () => {
    await show({ rankLabel: true });
    expect(container.querySelector('[data-ranks-label]').textContent).toBe('Utilities · fundamental rank · Wed Nov 11');
    const tech = [...container.querySelectorAll('div')].find((d) => d.textContent === 'Technical' && d.parentElement?.style.cursor === 'pointer')?.parentElement;
    expect(tech).toBeTruthy();
    await act(async () => { tech.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.querySelector('[data-ranks-label]').textContent).toBe('Utilities · technical rank · Wed Nov 11');
  });
  it('absent (every caller but the shell): no label, and the tab\'s markup is exactly the false prop\'s', async () => {
    // framer's entrance values are caught mid-flight at different frames: masked, nothing else.
    const html = () => container.innerHTML.replace(/opacity: [\d.e-]+; transform: translateY\([^)]*\);/g, 'opacity: ~; transform: ~;');
    await show({});
    expect(container.querySelector('[data-ranks-label]')).toBeNull();
    const absent = html();
    act(() => root.unmount()); root = createRoot(container);
    await show({ rankLabel: false });
    expect(html()).toBe(absent);
    expect(absent).toContain('#12');
  });
});
