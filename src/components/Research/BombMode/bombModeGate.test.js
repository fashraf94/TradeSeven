// Research Modal Build A — the gate (spec §4.1, §6 "Flag" rows).
// The flag module is mocked with a mutable value so every walked state and an
// unknown value are read at CALL time, the cards-gate pattern.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const flag = vi.hoisted(() => ({ mode: 'off' }));
vi.mock('../../../config/researchModalFlags.js', () => ({
  get RESEARCH_MODAL_BOMB_MODE() { return flag.mode; },
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));

import { resolveBombMode, bombModeOn } from './bombModeGate.js';

beforeEach(() => { flag.mode = 'off'; });

describe('resolveBombMode — read at call time, unknown → off', () => {
  it.each([['off', 'off'], ['allowlist', 'allowlist'], ['on', 'on'], ['ON', 'off'], ['true', 'off'], [true, 'off'], [undefined, 'off'], [null, 'off'], ['', 'off']])(
    'the value %j resolves %j', (value, want) => { flag.mode = value; expect(resolveBombMode()).toBe(want); });
  it('a flip between two calls is seen by the second (no module-scope read)', () => {
    flag.mode = 'off'; expect(resolveBombMode()).toBe('off');
    flag.mode = 'on'; expect(resolveBombMode()).toBe('on');
  });
});

describe('bombModeOn — the per-mount answer', () => {
  it("'off' is off for every mount, with or without a battle or verdict", () => {
    expect(bombModeOn('off', { agentBattle: true, verdict: true })).toBe(false);
    expect(bombModeOn('off')).toBe(false);
  });
  it("'on' is on for every in-battle mount, agent battle or not", () => {
    expect(bombModeOn('on')).toBe(true);
    expect(bombModeOn('on', { agentBattle: false })).toBe(true);
  });
  it("'allowlist' needs an agent battle AND a definite yes", () => {
    expect(bombModeOn('allowlist', { agentBattle: true, verdict: true })).toBe(true);
    expect(bombModeOn('allowlist', { agentBattle: true, verdict: false })).toBe(false);
    expect(bombModeOn('allowlist', { agentBattle: true, verdict: undefined })).toBe(false);
  });
  it("'allowlist' resolves off for a mount with no agent battle, even on a yes", () => {
    expect(bombModeOn('allowlist', { agentBattle: false, verdict: true })).toBe(false);
    expect(bombModeOn('allowlist', { verdict: true })).toBe(false);
  });
  it('an unknown mode is off', () => { expect(bombModeOn('maybe', { agentBattle: true, verdict: true })).toBe(false); });
});
