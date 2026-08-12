// api/_utils/wireFlags.test.js
// The merge-is-dark guarantee (§4.8) and the dependency rules (continuity
// requires writes; Phase 2 N1: newsline requires writes).
//
// Every OTHER Wire suite mocks wireFlags, so without this file the shipped
// flag values and getWireFlags' one job had zero test protection: flipping
// the flags to true — the accident the "each flip is its own one-line
// PR" discipline exists to prevent — would have passed CI unchallenged.

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('shipped flag values — the write path ships dark (metrics is runway step 1, live)', () => {
  it('four Wire write-path flags ship FALSE; WIRE_METRICS_ENABLED is live (runway §4.8 step 1)', async () => {
    const flags = await import('../../src/config/featureFlags.js');
    expect(flags.WIRE_METRICS_ENABLED).toBe(true); // runway step 1: flipped FIRST for the p95 baseline, before writes
    expect(flags.WIRE_WRITES_ENABLED).toBe(false);
    expect(flags.CONTINUITY_MEMORY_ENABLED).toBe(false);
    expect(flags.WIRE_NEWSLINE_ENABLED).toBe(false);
    expect(flags.EDITORIAL_REVIEW_ENABLED).toBe(false);
  });

  it('getWireFlags reports metrics ON, the write path off at HEAD', async () => {
    const { getWireFlags } = await import('./wireFlags.js');
    expect(getWireFlags()).toEqual({
      metricsEnabled: true,
      writesEnabled: false,
      continuityEnabled: false,
      newslineEnabled: false,
      editorialEnabled: false,
    });
  });
});

describe('the dependency rules (§4.8 flag table + Phase 2 N1)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const withFlags = async (metrics, writes, continuity, newsline = false, editorial = false) => {
    vi.doMock('../../src/config/featureFlags.js', () => ({
      WIRE_METRICS_ENABLED: metrics,
      WIRE_WRITES_ENABLED: writes,
      CONTINUITY_MEMORY_ENABLED: continuity,
      WIRE_NEWSLINE_ENABLED: newsline,
      EDITORIAL_REVIEW_ENABLED: editorial,
    }));
    const { getWireFlags } = await import('./wireFlags.js');
    return getWireFlags();
  };

  it('continuity ON + writes OFF resolves to continuity OFF', async () => {
    const f = await withFlags(false, false, true);
    expect(f.continuityEnabled).toBe(false);
    expect(f.writesEnabled).toBe(false);
  });

  it('continuity ON + writes ON resolves to continuity ON', async () => {
    const f = await withFlags(false, true, true);
    expect(f.continuityEnabled).toBe(true);
  });

  it('newsline ON + writes OFF resolves to newsline OFF (no writes → nothing to read; never dark-solo)', async () => {
    const f = await withFlags(false, false, false, true);
    expect(f.newslineEnabled).toBe(false);
  });

  it('newsline ON + writes ON resolves to newsline ON', async () => {
    const f = await withFlags(false, true, false, true);
    expect(f.newslineEnabled).toBe(true);
    expect(f.continuityEnabled).toBe(false); // independent of continuity
  });

  it('metrics is independent of writes in both directions', async () => {
    expect((await withFlags(true, false, false)).metricsEnabled).toBe(true);
    vi.resetModules();
    expect((await withFlags(false, true, false)).metricsEnabled).toBe(false);
  });

  it('editorial is deliberately independent of writes (V1.2 flag table — flip ORDER is founder-sequenced)', async () => {
    const f = await withFlags(false, false, false, false, true);
    expect(f.editorialEnabled).toBe(true);
    expect(f.writesEnabled).toBe(false);
  });
});
