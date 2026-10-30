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
