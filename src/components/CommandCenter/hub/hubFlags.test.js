// src/components/CommandCenter/hub/hubFlags.test.js
//
// Command Center hub, slice S5 — hubFlags(): the one place the three shipped
// flags reach the Loadout's selectors. Every hub row replaces this module with a
// stand-in (the flags are the seam there), so nothing else runs it: these rows run
// the REAL module against a featureFlags stand-in that each row sets, and once
// against the shipped featureFlags itself (lens E5, E5-3).

import { afterEach, describe, expect, it, vi } from 'vitest';

const FEATURE_FLAGS = '../../../config/featureFlags';

/** hubFlags() read against a featureFlags module with exactly these exports. */
async function hubFlagsOver(exports) {
  vi.resetModules();
  vi.doMock(FEATURE_FLAGS, () => exports);
  const { hubFlags } = await import('./hubFlags');
  return hubFlags;
}

const FLAGS = (over = {}) => ({
  CASUAL_CLONE_CONCURRENCY_ENABLED: true,
  RELEASE3_CHARACTER_TAB_ENABLED: true,
  isHypothesisRecordsOn: () => true,
  ...over,
});

afterEach(() => {
  vi.doUnmock(FEATURE_FLAGS);
  vi.resetModules();
});

describe('hubFlags — each key follows its own shipped flag', () => {
  it('all three on: all three true', async () => {
    const hubFlags = await hubFlagsOver(FLAGS());
    expect(hubFlags()).toEqual({ concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: true });
  });

  it.each([
    ['CASUAL_CLONE_CONCURRENCY_ENABLED', { CASUAL_CLONE_CONCURRENCY_ENABLED: false }, { concurrencyEnabled: false, hypothesisRecordsOn: true, characterTab: true }],
    ['isHypothesisRecordsOn()', { isHypothesisRecordsOn: () => false }, { concurrencyEnabled: true, hypothesisRecordsOn: false, characterTab: true }],
    ['RELEASE3_CHARACTER_TAB_ENABLED', { RELEASE3_CHARACTER_TAB_ENABLED: false }, { concurrencyEnabled: true, hypothesisRecordsOn: true, characterTab: false }],
  ])('%s off: only its key reads false (the idea label, the equip lock and the Forge door each answer to their own flag)', async (_name, off, expected) => {
    const hubFlags = await hubFlagsOver(FLAGS(off));
    expect(hubFlags()).toEqual(expected);
  });

  it('anything but exactly true reads false, for each of the three', async () => {
    for (const value of [1, 'true', undefined, null, {}]) {
      const hubFlags = await hubFlagsOver(FLAGS({
        CASUAL_CLONE_CONCURRENCY_ENABLED: value, RELEASE3_CHARACTER_TAB_ENABLED: value, isHypothesisRecordsOn: () => value,
      }));
      expect(hubFlags(), String(value)).toEqual({ concurrencyEnabled: false, hypothesisRecordsOn: false, characterTab: false });
    }
  });

  it('the records flag is read through its accessor at each call, not captured when the module loads', async () => {
    const state = { on: false };
    const hubFlags = await hubFlagsOver(FLAGS({ isHypothesisRecordsOn: () => state.on }));
    expect(hubFlags().hypothesisRecordsOn).toBe(false);
    state.on = true;
    expect(hubFlags().hypothesisRecordsOn).toBe(true);
  });
});

describe('hubFlags — against the shipped featureFlags', () => {
  it('reads exactly what the shells read: the same three flags, each by === true', async () => {
    vi.doUnmock(FEATURE_FLAGS);
    vi.resetModules();
    const shipped = await vi.importActual(FEATURE_FLAGS);
    const { hubFlags } = await import('./hubFlags');
    expect(hubFlags()).toEqual({
      concurrencyEnabled: shipped.CASUAL_CLONE_CONCURRENCY_ENABLED === true,
      hypothesisRecordsOn: shipped.isHypothesisRecordsOn() === true,
      characterTab: shipped.RELEASE3_CHARACTER_TAB_ENABLED === true,
    });
  });
});

// ── Slice S7 (ruling R-S7-6): the phone's Shadow is one constant ────────────────────────────────────────────────────
describe('PHONE_SHADOW — the phone fallback is one constant', () => {
  it('ships as "canvas": the phone draws the moving Shadow until a device validation says otherwise', async () => {
    vi.doUnmock(FEATURE_FLAGS);
    vi.resetModules();
    const { PHONE_SHADOW } = await import('./hubFlags');
    expect(PHONE_SHADOW).toBe('canvas');
  });

  it('is one of the two forms the stage understands, and the stage compares it to "still" alone', async () => {
    const { readFileSync } = await import('node:fs');
    const { PHONE_SHADOW } = await vi.importActual('./hubFlags');
    expect(['canvas', 'still']).toContain(PHONE_SHADOW);
    const hub = readFileSync(new URL('../CommandCenterHub.jsx', import.meta.url), 'utf8');
    expect(hub.match(/PHONE_SHADOW/g)).toHaveLength(3);
    expect(hub).toContain("stillOnly={PHONE_SHADOW === 'still'}");
  });
});

// ── Agent form build S1 (ruling R1): the phone's armored agent rate is one constant ─────────────────────────────────
describe('AGENT_FORM_PHONE — the phone rate of the armored agent is one constant', () => {
  it('ships as "live": the founder\'s iPhone 16 lab reading (every preset passed)', async () => {
    const { AGENT_FORM_PHONE } = await vi.importActual('./hubFlags');
    expect(AGENT_FORM_PHONE).toBe('live');
  });

  it('is one of the engine\'s three rates, and only the hub form reads it', async () => {
    const { readFileSync } = await import('node:fs');
    const { AGENT_FORM_PHONE } = await vi.importActual('./hubFlags');
    expect(['live', 'half', 'still']).toContain(AGENT_FORM_PHONE);
    const view = readFileSync(new URL('../HubAgentForm.jsx', import.meta.url), 'utf8');
    expect(view).toMatch(/\bAGENT_FORM_PHONE\b/);
    const hub = readFileSync(new URL('../CommandCenterHub.jsx', import.meta.url), 'utf8');
    expect(hub).not.toMatch(/\bAGENT_FORM_PHONE\b/);
  });
});

// ── Command Center Amendment E V1.1 §1 (ruling R-D4): the research door's mode, read through this module ──────────────
const SHARED_RESEARCH_FLAGS = '../../../config/sharedResearchFlags';

/** sharedResearchMode() read against a flag module with exactly these exports. */
async function researchModeOver(exports) {
  vi.resetModules();
  vi.doMock(SHARED_RESEARCH_FLAGS, () => exports);
  const { sharedResearchMode } = await import('./hubFlags');
  return sharedResearchMode;
}

describe('sharedResearchMode — SHARED_RESEARCH_MODE read at call time; any other value reads off', () => {
  afterEach(() => { vi.doUnmock(SHARED_RESEARCH_FLAGS); });

  it.each(['off', 'allowlist', 'on'])('the walked value %s reads as itself', async (mode) => {
    const sharedResearchMode = await researchModeOver({ SHARED_RESEARCH_MODE: mode, SHARED_RESEARCH_MODES: ['off', 'allowlist', 'on'] });
    expect(sharedResearchMode()).toBe(mode);
  });

  it('anything outside SHARED_RESEARCH_MODES reads off: a typo, a boolean, a case change, nothing', async () => {
    for (const value of ['onn', 'ON', 'Allowlist', true, 1, null, undefined, '']) {
      const sharedResearchMode = await researchModeOver({ SHARED_RESEARCH_MODE: value, SHARED_RESEARCH_MODES: ['off', 'allowlist', 'on'] });
      expect(sharedResearchMode(), String(value)).toBe('off');
    }
  });

  it('a value outside a malformed mode list reads off (the list itself is checked)', async () => {
    const sharedResearchMode = await researchModeOver({ SHARED_RESEARCH_MODE: 'on', SHARED_RESEARCH_MODES: 'on' });
    expect(sharedResearchMode()).toBe('off');
  });

  it('is read at each call, never held at module scope: a live binding that moves is followed', async () => {
    const state = { mode: 'off' };
    vi.resetModules();
    vi.doMock(SHARED_RESEARCH_FLAGS, () => ({
      get SHARED_RESEARCH_MODE() { return state.mode; },
      SHARED_RESEARCH_MODES: ['off', 'allowlist', 'on'],
    }));
    const { sharedResearchMode } = await import('./hubFlags');
    expect(sharedResearchMode()).toBe('off');
    state.mode = 'allowlist';
    expect(sharedResearchMode()).toBe('allowlist');
  });

  it('against the shipped flag module: the shipped value, which is off (the pin is sharedResearchFlags.test.js)', async () => {
    vi.doUnmock(SHARED_RESEARCH_FLAGS);
    vi.resetModules();
    const shipped = await vi.importActual(SHARED_RESEARCH_FLAGS);
    const { sharedResearchMode } = await import('./hubFlags');
    expect(sharedResearchMode()).toBe(shipped.SHARED_RESEARCH_MODE);
    expect(shipped.SHARED_RESEARCH_MODES).toContain(sharedResearchMode());
  });

  it('the source reads both exports inside the function, not at module scope', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./hubFlags.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const body = /export function sharedResearchMode\(\) \{\n([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
    expect(body).toContain('const mode = SHARED_RESEARCH_MODE;');
    expect(body).toContain('const modes = SHARED_RESEARCH_MODES;');
    // comments aside, the name appears twice: its import and its one read inside the function
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/\bSHARED_RESEARCH_MODE\b/g)).toHaveLength(2);
  });
});
