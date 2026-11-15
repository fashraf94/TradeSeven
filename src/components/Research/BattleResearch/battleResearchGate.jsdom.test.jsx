// @vitest-environment jsdom
//
// Battle Research Slice 1 — the flag's resolver, the per-battle hook and the four conditions
// (spec BRS-1, BRS-3): off, allowlist, on, unknown → off (a mock that omits the flag reads off);
// 'allowlist' is off without a verdict and asks once the battle names its owner, through the SAME
// cached cockpit-status verdict as the shell; 'off' and 'on' send nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const FLAG = vi.hoisted(() => ({ mode: 'off', omit: false }));
vi.mock('../../../config/researchModalFlags.js', () => ({
  get BATTLE_RESEARCH_MODE() { if (FLAG.omit) throw new Error('[vitest] No "BATTLE_RESEARCH_MODE" export is defined on the mock'); return FLAG.mode; },
  BATTLE_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  RESEARCH_MODAL_SHEET_MODE: 'off',
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
  RESEARCH_MODAL_BOMB_MODE: 'off',
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
const VERDICT = vi.hoisted(() => ({ calls: [], answer: true, cached: undefined }));
vi.mock('../../../utils/filmRoomGate.js', () => ({
  readFilmRoomVerdict: (id, opts) => { VERDICT.calls.push([id, opts?.ownerId ?? null]); return Promise.resolve(VERDICT.answer); },
  cachedFilmRoomVerdict: () => VERDICT.cached,
}));

import { resolveBattleResearchMode, battleResearchModeOn, battleResearchAvailable, useBattleResearchModeForBattle } from './battleResearchGate.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); VERDICT.calls = []; VERDICT.answer = true; VERDICT.cached = undefined; });
afterEach(() => { act(() => root.unmount()); container.remove(); FLAG.mode = 'off'; FLAG.omit = false; });

function Probe({ id, owner, out }) { out.value = useBattleResearchModeForBattle(id, owner); return null; }
const mount = async (id, owner) => { const out = {}; await act(async () => { root.render(<Probe id={id} owner={owner} out={out} />); }); await act(async () => { await Promise.resolve(); }); return out; };

describe('resolveBattleResearchMode — the walked states, unknown → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['true', 'off'], [true, 'off'], [undefined, 'off'], [null, 'off']])('%s → %s', (value, want) => {
    FLAG.mode = value;
    expect(resolveBattleResearchMode()).toBe(want);
  });
  it('a test mock of the flag module that omits the flag reads off (the catch), never throws', () => {
    FLAG.omit = true;
    expect(resolveBattleResearchMode()).toBe('off');
  });
});

describe('battleResearchModeOn / battleResearchAvailable — pure', () => {
  it('on is on; allowlist needs a true verdict; off is off', () => {
    expect(battleResearchModeOn('on')).toBe(true);
    expect(battleResearchModeOn('allowlist', { verdict: true })).toBe(true);
    expect(battleResearchModeOn('allowlist', { verdict: false })).toBe(false);
    expect(battleResearchModeOn('allowlist')).toBe(false);
    expect(battleResearchModeOn('off', { verdict: true })).toBe(false);
  });
  it('BRS-1: the flag AND active AND not League AND cockpit 2b AND the shell — each alone turns it off', () => {
    const all = { modeOn: true, active: true, league: false, cockpit2b: true, shellOn: true };
    expect(battleResearchAvailable(all)).toBe(true);
    for (const [k, v] of [['modeOn', false], ['active', false], ['league', true], ['cockpit2b', false], ['shellOn', false]]) {
      expect(battleResearchAvailable({ ...all, [k]: v })).toBe(false);
    }
  });
});

describe('useBattleResearchModeForBattle', () => {
  it("'off' answers off and asks nothing", async () => {
    FLAG.mode = 'off';
    expect((await mount('b1', 'u1')).value).toBe(false);
    expect(VERDICT.calls).toEqual([]);
  });
  it("'on' answers on for a battle and asks nothing; no battle id → off", async () => {
    FLAG.mode = 'on';
    expect((await mount('b1', 'u1')).value).toBe(true);
    expect(VERDICT.calls).toEqual([]);
    expect((await mount(null, 'u1')).value).toBe(false);
  });
  it("'allowlist' is off until the battle names its owner, then asks once and follows the verdict", async () => {
    FLAG.mode = 'allowlist';
    expect((await mount('b1', null)).value).toBe(false);
    expect(VERDICT.calls).toEqual([]);
    const out = await mount('b1', 'u1');
    expect(VERDICT.calls).toEqual([['b1', 'u1']]);
    expect(out.value).toBe(true);
  });
  it("'allowlist' with a false verdict stays off", async () => {
    FLAG.mode = 'allowlist';
    VERDICT.answer = false;
    expect((await mount('b1', 'u1')).value).toBe(false);
  });
  it("'allowlist' reads the shared cache while its own answer is pending", async () => {
    FLAG.mode = 'allowlist';
    VERDICT.cached = true;
    const out = {};
    await act(async () => { root.render(<Probe id="b2" owner="u2" out={out} />); });
    expect(out.value).toBe(true);
  });
});
