// api/_utils/wireGenerationConfig.test.js
// Phase 2 Spec V1.3 D-P2-9 — the resolver's byte-identity contract.
//
// Every assertion against a literal below is the pre-P1 call-site value
// read during the P1 census (file:line in the P1 checkpoint report). If a
// seam's real params ever change, the change lands HERE first — with a
// WIRE_GENERATION_VERSION bump enforced by the baseline lock.

import { describe, it, expect, vi, afterEach } from 'vitest';

import { getGenerationConfig, WIRE_GENERATION_SEAMS } from './wireGenerationConfig.js';
import { WIRE_GENERATION_VERSION } from './wireContracts.js';

const OFF = { metricsEnabled: false, writesEnabled: false, continuityEnabled: false };
const WRITES = { metricsEnabled: true, writesEnabled: true, continuityEnabled: false };
const CONTINUITY = { metricsEnabled: true, writesEnabled: true, continuityEnabled: true };

afterEach(() => {
  vi.doUnmock('./wireContracts.js');
  vi.resetModules();
});

describe('resolver basics', () => {
  it('unknown seam throws — never a silent default', () => {
    expect(() => getGenerationConfig('nope', OFF)).toThrow(/unknown seam 'nope'/);
  });

  it('returns a frozen object; mutation attempts do not stick', () => {
    const cfg = getGenerationConfig('kai_pulse', OFF);
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(() => { 'use strict'; cfg.model = 'x'; }).toThrow(TypeError);
    expect(cfg.model).toBe('claude-haiku-4-5-20251001');
  });

  it('captures generationVersion and continuityEnabled', () => {
    expect(getGenerationConfig('kai_pulse', OFF).generationVersion).toBe(WIRE_GENERATION_VERSION);
    expect(getGenerationConfig('kai_pulse', OFF).continuityEnabled).toBe(false);
    expect(getGenerationConfig('kai_pulse', CONTINUITY).continuityEnabled).toBe(true);
    // flags omitted (non-Wire callers) → continuity false, never undefined
    expect(getGenerationConfig('art_director').continuityEnabled).toBe(false);
  });
});

describe('per-seam byte-identity goldens (pre-P1 census values)', () => {
  const strip = (cfg) => {
    const { seam, generationVersion, continuityEnabled, ...params } = cfg;
    void seam; void generationVersion; void continuityEnabled;
    return params;
  };

  const PIN = { thinking: { type: 'disabled' }, outputConfig: { effort: 'low' } };

  const GOLDEN = {
    kai_pulse: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 800, temperature: 0.8 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 1200, temperature: 0.8 },
    },
    alex_mover: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 500, temperature: 0.8 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 900, temperature: 0.8 },
    },
    neta_econ_recap: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 600, temperature: 0.7 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 1000, temperature: 0.7 },
    },
    neta_econ_preview: {
      off: { model: 'claude-sonnet-4-6', maxTokens: 1000, temperature: 0.8, ...PIN },
      writes: { model: 'claude-sonnet-4-6', maxTokens: 1400, temperature: 0.8, ...PIN },
    },
    doug_earnings_recap: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 500, temperature: 0.8 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 900, temperature: 0.8 },
    },
    doug_earnings_preview: {
      off: { model: 'claude-sonnet-4-6', maxTokens: 800, ...PIN },
      writes: { model: 'claude-sonnet-4-6', maxTokens: 1200, ...PIN },
    },
    kim_column: {
      off: { model: 'claude-sonnet-4-6', maxTokens: 1200, temperature: 0.85, ...PIN },
      writes: { model: 'claude-sonnet-4-6', maxTokens: 1600, temperature: 0.85, ...PIN },
    },
    alex_macro: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 700, temperature: 0.8 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 700, temperature: 0.8 },
    },
    vera_deepdive: {
      off: { model: 'claude-sonnet-4-6', maxTokens: 2000, temperature: 0.7, ...PIN },
      writes: { model: 'claude-sonnet-4-6', maxTokens: 2000, temperature: 0.7, ...PIN },
    },
    art_director: {
      off: { model: 'claude-haiku-4-5-20251001', maxTokens: 500, temperature: 0 },
      writes: { model: 'claude-haiku-4-5-20251001', maxTokens: 500, temperature: 0 },
    },
  };

  it('the table and the goldens cover the identical seam set', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual([...WIRE_GENERATION_SEAMS].sort());
  });

  for (const [seam, byFlag] of Object.entries(GOLDEN)) {
    it(`${seam}: exact params, both flag states`, () => {
      expect(strip(getGenerationConfig(seam, OFF))).toEqual(byFlag.off);
      expect(strip(getGenerationConfig(seam, WRITES))).toEqual(byFlag.writes);
    });
  }

  it('doug_earnings_preview carries NO temperature key (preserved register quirk)', () => {
    expect('temperature' in getGenerationConfig('doug_earnings_preview', OFF)).toBe(false);
    expect('temperature' in getGenerationConfig('doug_earnings_preview', WRITES)).toBe(false);
  });

  it('temperature: 0 (art_director) survives — falsy is not absent', () => {
    expect(getGenerationConfig('art_director', OFF).temperature).toBe(0);
  });
});

describe('mutable-mock version bump (P2-22 groundwork)', () => {
  it('a mocked WIRE_GENERATION_VERSION bump is visible through the resolver', async () => {
    vi.doMock('./wireContracts.js', async (importOriginal) => {
      const real = await importOriginal();
      return { ...real, WIRE_GENERATION_VERSION: 99 };
    });
    const { getGenerationConfig: bumped } = await import('./wireGenerationConfig.js');
    expect(bumped('kai_pulse', OFF).generationVersion).toBe(99);
  });
});
