// @vitest-environment jsdom
//
// Research Modal Build C — the flag's resolver and the per-battle hook (spec
// §4.1): off, allowlist, on, unknown → off; 'allowlist' is off without a
// verdict and asks once the battle names its owner; 'off' and 'on' send nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const FLAG = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../../config/researchModalFlags.js', () => ({
  get RESEARCH_MODAL_SHEET_MODE() { return FLAG.mode; },
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
  RESEARCH_MODAL_BOMB_MODE: 'off',
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
const VERDICT = vi.hoisted(() => ({ calls: [], answer: true, cached: undefined }));
vi.mock('../../../utils/filmRoomGate.js', () => ({
  readFilmRoomVerdict: (id, opts) => { VERDICT.calls.push([id, opts?.ownerId ?? null]); return Promise.resolve(VERDICT.answer); },
  cachedFilmRoomVerdict: () => VERDICT.cached,
}));

import { resolveSheetMode, sheetModeOn, useSheetModeForBattle } from './sheetGate.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); VERDICT.calls = []; VERDICT.answer = true; VERDICT.cached = undefined; });
afterEach(() => { act(() => root.unmount()); container.remove(); FLAG.mode = 'off'; });

function Probe({ id, owner, out }) { out.value = useSheetModeForBattle(id, owner); return null; }
const mount = async (id, owner) => { const out = {}; await act(async () => { root.render(<Probe id={id} owner={owner} out={out} />); }); await act(async () => { await Promise.resolve(); }); return out; };

describe('resolveSheetMode — the walked states, unknown → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['true', 'off'], [true, 'off'], [undefined, 'off'], [null, 'off']])('%s → %s', (value, want) => {
    FLAG.mode = value;
    expect(resolveSheetMode()).toBe(want);
  });
});

describe('sheetModeOn — pure (the shell\'s gate for one mount, SB-2)', () => {
  it('on is on for every mount (browse included); allowlist needs an agent battle AND a true verdict; off is off', () => {
    expect(sheetModeOn('on', { agentBattle: true })).toBe(true);
    // SB-2 (the shell, 2026-11-12): a mount with no agent battle resolves on at 'on' …
    expect(sheetModeOn('on', { agentBattle: false })).toBe(true);
    expect(sheetModeOn('on')).toBe(true);
    expect(sheetModeOn('allowlist', { agentBattle: true, verdict: true })).toBe(true);
    expect(sheetModeOn('allowlist', { agentBattle: true, verdict: undefined })).toBe(false);
    expect(sheetModeOn('allowlist', { agentBattle: true, verdict: false })).toBe(false);
    // … and off at 'allowlist' (browse never has a verdict).
    expect(sheetModeOn('allowlist', { agentBattle: false, verdict: true })).toBe(false);
    expect(sheetModeOn('allowlist', { agentBattle: false })).toBe(false);
    expect(sheetModeOn('off', { agentBattle: true, verdict: true })).toBe(false);
    expect(sheetModeOn('off', { agentBattle: false })).toBe(false);
  });
  // Every (mode × mount kind × asset kind): a stock follows the mode; a crypto, an index or a
  // sector ETF is off at every value (R-35), an allowlisted battle included.
  const MOUNTS = { battle: { agentBattle: true, verdict: true }, battleNoVerdict: { agentBattle: true, verdict: false }, browse: { agentBattle: false } };
  const WANT = { off: { battle: false, battleNoVerdict: false, browse: false }, allowlist: { battle: true, battleNoVerdict: false, browse: false }, on: { battle: true, battleNoVerdict: true, browse: true } };
  for (const mode of ['off', 'allowlist', 'on']) {
    for (const [mount, opts] of Object.entries(MOUNTS)) {
      it(`${mode} × ${mount}: stock → ${WANT[mode][mount]}; crypto, index, sector ETF → false`, () => {
        expect(sheetModeOn(mode, { ...opts, asset: 'stock' })).toBe(WANT[mode][mount]);
        for (const asset of ['crypto', 'index', 'sectorEtf']) expect(sheetModeOn(mode, { ...opts, asset })).toBe(false);
      });
    }
  }
  it('an asset kind the gate does not know is off, never on', () => {
    expect(sheetModeOn('on', { asset: 'bond' })).toBe(false);
    expect(sheetModeOn('on', { asset: null })).toBe(false);
  });
});

describe('useSheetModeForBattle', () => {
  it("'off' answers off and asks nothing", async () => {
    FLAG.mode = 'off';
    const out = await mount('b1', 'u1');
    expect(out.value).toBe(false);
    expect(VERDICT.calls).toEqual([]);
  });
  // Since the shell, sheetModeOn('on') is on for any mount; the battle screen's own answer still
  // needs a battle id (a screen with no battle yet passes no hollow sheetContext).
  it("'on' answers on for an agent battle and asks nothing; no battle id → off", async () => {
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
  it("'allowlist' with a false verdict (or a failed ask) stays off", async () => {
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
