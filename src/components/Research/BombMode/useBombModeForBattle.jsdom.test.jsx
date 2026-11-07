// @vitest-environment jsdom
// Research Modal Build A — the per-agent-battle resolution (spec §4.1):
// 'off' and 'on' send nothing; 'allowlist' asks the Film Room gate's cached
// verdict (cockpit-status) once per owner, and reads off until a yes arrives.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const flag = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../../config/researchModalFlags.js', () => ({
  get RESEARCH_MODAL_BOMB_MODE() { return flag.mode; },
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
const gate = vi.hoisted(() => ({ calls: [], answer: true }));
vi.mock('../../../utils/filmRoomGate.js', () => ({
  readFilmRoomVerdict: (id, opts) => { gate.calls.push([id, opts]); return Promise.resolve(gate.answer); },
  cachedFilmRoomVerdict: () => undefined,
}));

import useBombModeForBattle from './useBombModeForBattle.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
const seen = [];
function Probe({ id, owner }) { seen.push(useBombModeForBattle(id, owner)); return null; }
beforeEach(() => { container = document.createElement('div'); root = createRoot(container); seen.length = 0; gate.calls.length = 0; gate.answer = true; });
afterEach(() => { act(() => root.unmount()); });
const mount = async (id = 'battle-1', owner = 'owner-1') => { await act(async () => { root.render(<Probe id={id} owner={owner} />); }); await act(async () => { await Promise.resolve(); }); };

describe('useBombModeForBattle', () => {
  it("'off': off, and no verdict is asked", async () => { flag.mode = 'off'; await mount(); expect(seen.at(-1)).toBe(false); expect(gate.calls).toEqual([]); });
  it("'on': on, and no verdict is asked", async () => { flag.mode = 'on'; await mount(); expect(seen.at(-1)).toBe(true); expect(gate.calls).toEqual([]); });
  it("'allowlist': off until the cached cockpit-status verdict says yes, asked once with the owner", async () => {
    flag.mode = 'allowlist'; await mount();
    expect(seen[0]).toBe(false);
    expect(seen.at(-1)).toBe(true);
    expect(gate.calls).toEqual([['battle-1', { ownerId: 'owner-1' }]]);
  });
  it("'allowlist' and a no: stays off", async () => { flag.mode = 'allowlist'; gate.answer = false; await mount(); expect(seen.at(-1)).toBe(false); });
  it("'allowlist' before the battle names its owner: off and nothing asked (one request per owner, review B5)", async () => { flag.mode = 'allowlist'; await mount('battle-1', null); expect(seen.at(-1)).toBe(false); expect(gate.calls).toEqual([]); });
  it("'allowlist' with no agent battle id: off and nothing asked", async () => { flag.mode = 'allowlist'; await mount(null); expect(seen.at(-1)).toBe(false); expect(gate.calls).toEqual([]); });
  it('an unknown mode: off, nothing asked', async () => { flag.mode = 'sometimes'; await mount(); expect(seen.at(-1)).toBe(false); expect(gate.calls).toEqual([]); });
});
