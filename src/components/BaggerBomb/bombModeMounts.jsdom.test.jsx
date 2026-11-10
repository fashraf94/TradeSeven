// @vitest-environment jsdom
//
// Research Modal Build A — the two BaggerBomb in-battle mounts (spec §4.2, §6
// "Mounts"): the free-agent bar and the BaggerBomb battle view pass bombContext
// only when the mode resolves on — and with no agent battle, 'allowlist'
// resolves OFF (§4.1). The research modal is a recorder; the battle view's
// heavy children are stubs except the row that opens research.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const flag = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../config/researchModalFlags.js', () => ({ get RESEARCH_MODAL_BOMB_MODE() { return flag.mode; }, RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
const OPENED = vi.hoisted(() => ({ props: [] }));
vi.mock('../draft/AssetResearchModal', () => ({ default: (props) => { OPENED.props.push(props); return null; } }));
vi.mock('./BaggerBombBackground', () => ({ default: () => null }));
vi.mock('./BattleHeader', () => ({ default: () => null }));
vi.mock('./BenchSection', () => ({ default: () => null }));
vi.mock('./ClosedTradesSection', () => ({ default: () => null }));
vi.mock('./EventFeed', () => ({ default: () => null }));
vi.mock('./SwapMarketModal', () => ({ default: () => null }));
vi.mock('../draft/ScoreBreakdownPopover', () => ({ default: () => null }));
vi.mock('./TacticalRow', () => ({ default: ({ leftAsset, playerAsset, onSymbolClick }) => {
  const a = playerAsset || leftAsset;
  return a ? <button type="button" data-open-research={a.symbol} onClick={() => onSymbolClick({ symbol: a.symbol, name: a.symbol })}>{a.symbol}</button> : null;
} }));
vi.mock('../../hooks/useBaggerShockwave', () => ({ useBaggerShockwave: () => ({ activeShockwaves: [], triggerShockwave: () => {} }) }));

import FreeAgentBar from './FreeAgentBar';
import BaggerBombBattleView from '../../screens/BaggerBombBattleView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); OPENED.props = []; vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = async (el) => { await act(async () => { root.render(el); }); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); };

async function openFreeAgent() {
  await render(<FreeAgentBar freeAgents={[{ symbol: 'NVDA', name: 'Nvidia' }]} currentPrices={{ NVDA: 100 }} thresholds={{}} />);
  const card = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('NVDA'));
  await click(card);
  return OPENED.props.at(-1);
}

const LEVELS = { date: '2026-10-14', assets: { EOG: { baseline: 150, baggerBomb: 154.5, doubleBagger: 156.75, tenBagger: 159, bust: 145.5, crash: 143.25, meltdown: 141, threshold: 3 } } };
async function openBattleView(battleVersion) {
  const player = { username: 'me', portfolio: { star: [{ symbol: 'EOG', name: 'EOG' }], core: [], support: [] } };
  const opponent = { username: 'cpu', portfolio: { star: [{ symbol: 'CVX', name: 'CVX' }], core: [], support: [] } };
  await render(<BaggerBombBattleView battle={{ id: 'v4-battle', state: { dailyLevels: LEVELS, startingPrices: { EOG: 150 } } }} player={player} opponent={opponent} battleVersion={battleVersion} currentPrices={{ EOG: 151 }} events={[]} onBack={() => {}} />);
  await click(container.querySelector('[data-open-research="EOG"]'));
  return OPENED.props.at(-1);
}

describe('BaggerBomb/FreeAgentBar.jsx', () => {
  it("'on': bombContext { kind: 'bench' }", async () => { flag.mode = 'on'; expect((await openFreeAgent()).bombContext).toEqual({ kind: 'bench' }); });
  it("'allowlist': no agent battle → off, no prop", async () => { flag.mode = 'allowlist'; expect(await openFreeAgent()).not.toHaveProperty('bombContext'); });
  it("'off': no prop", async () => { flag.mode = 'off'; expect(await openFreeAgent()).not.toHaveProperty('bombContext'); });
});

describe('BaggerBombBattleView.jsx', () => {
  it("'on', a V4 battle: bombContext { kind: 'v4', dailyLevels } (the battle's own levels)", async () => {
    flag.mode = 'on';
    expect((await openBattleView(4)).bombContext).toEqual({ kind: 'v4', dailyLevels: LEVELS });
  });
  it("'on', a V3 battle: { kind: 'bench' }", async () => { flag.mode = 'on'; expect((await openBattleView(3)).bombContext).toEqual({ kind: 'bench' }); });
  it("'allowlist' and 'off': no prop", async () => {
    flag.mode = 'allowlist'; expect(await openBattleView(4)).not.toHaveProperty('bombContext');
    flag.mode = 'off'; expect(await openBattleView(4)).not.toHaveProperty('bombContext');
  });
});
