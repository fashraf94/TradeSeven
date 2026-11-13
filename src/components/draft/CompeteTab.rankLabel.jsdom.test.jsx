// @vitest-environment jsdom
//
// The two-view shell's Ranks tab (Amendment C R-32; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): today's CompeteTab with ONE
// additive prop, `rankLabel`, which names the shown rank's group and day above
// the badges and follows the badge the player selects. Absent — every caller but
// the shell — the tab renders exactly as on main (a golden written from main's
// CompeteTab.jsx, 68a237a8, by GENERATE_COMPETE_OFF_GOLDEN=1; review C8).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__goldens__', 'competeTab.offShell.golden.json');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
// The peer group and the sector are named apart, so the label's group is pinned per badge.
const PEER = { ticker: 'CEG', sectorName: 'Independent Power', compositeRank: 12, totalPeers: 38, compositeScore: 64, tier: 'Above Average', computedAt: new Date(WED_EVENING_ET).toISOString(), pillars: {}, leaderboard: [] };
const ROW = { symbol: 'CEG', sectorId: 'utilities', sectorName: 'Utilities', sectorTechnicalRank: 4, sectorTechnicalTotal: 38 };
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  DOCS['indexIntelligence/stockRankings'] = { computedAt: { toMillis: () => WED_EVENING_ET }, stocks: [ROW] };
  DOCS['stockTechnicalScores/CEG'] = { technicalRank: 31, technicalScore: 76, updatedAt: { seconds: Math.floor(Date.UTC(2026, 10, 10, 21, 0) / 1000) } };
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: PEER }) }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); delete globalThis.fetch; });
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const show = async (props) => { await act(async () => { root.render(<CompeteTab symbol="CEG" isMobile onNavigateToStock={() => {}} {...props} />); }); await flush(); };
const badge = (title) => [...container.querySelectorAll('div')].find((d) => d.textContent === title && d.parentElement?.style.cursor === 'pointer')?.parentElement;
// framer's entrance values are caught mid-flight at different frames: masked, nothing else.
const html = () => container.innerHTML.replace(/opacity: [\d.e-]+; transform: translateY\([^)]*\);/g, 'opacity: ~; transform: ~;');

describe('CompeteTab rankLabel (R-32)', () => {
  it('names the selected badge\'s group and day — the peer group for the fundamental rank, the sector for the technical — and follows the badge the player selects', async () => {
    await show({ rankLabel: true });
    expect(container.querySelector('[data-ranks-label]').textContent).toBe('Independent Power · fundamental rank · Wed Nov 11');
    await act(async () => { badge('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.querySelector('[data-ranks-label]').textContent).toBe('Utilities · technical rank · Wed Nov 11');
  });
  it('the technical badge on the universe rank (no sector rank in the doc): "All stocks", at the score doc\'s own day', async () => {
    DOCS['indexIntelligence/stockRankings'] = { computedAt: { toMillis: () => WED_EVENING_ET }, stocks: [{ symbol: 'CEG', sectorId: 'utilities', sectorName: 'Utilities' }] };
    await show({ rankLabel: true });
    await act(async () => { badge('Technical').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('#31');
    expect(container.querySelector('[data-ranks-label]').textContent).toBe('All stocks · technical rank · Tue Nov 10');
  });
  it('absent (every caller but the shell): no label, and the markup is main\'s CompeteTab\'s, byte for byte (masked mid-flight motion only)', async () => {
    await show({});
    expect(container.querySelector('[data-ranks-label]')).toBeNull();
    const now = html();
    expect(now).toContain('#12');
    if (process.env.GENERATE_COMPETE_OFF_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify({ html: now }, null, 1)}\n`);
    expect(now).toBe(JSON.parse(readFileSync(GOLDEN, 'utf8')).html);
    act(() => root.unmount()); root = createRoot(container);
    await show({ rankLabel: false });
    expect(html()).toBe(now);
  });
});
