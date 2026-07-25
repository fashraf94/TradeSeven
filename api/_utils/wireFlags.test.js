// api/_utils/wireFlags.test.js
// The merge-is-dark guarantee (§4.8) and the continuity dependency rule.
//
// Every OTHER Wire suite mocks wireFlags, so without this file the shipped
// flag values and getWireFlags' one job had zero test protection: flipping
// all three flags to true — the accident the "each flip is its own one-line
// PR" discipline exists to prevent — would have passed CI unchallenged.

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('shipped flag values — the merge must be dark', () => {
  it('all three Wire flags ship FALSE', async () => {
    const flags = await import('../../src/config/featureFlags.js');
    expect(flags.WIRE_METRICS_ENABLED).toBe(false);
    expect(flags.WIRE_WRITES_ENABLED).toBe(false);
    expect(flags.CONTINUITY_MEMORY_ENABLED).toBe(false);
  });

  it('getWireFlags reports everything off at HEAD', async () => {
    const { getWireFlags } = await import('./wireFlags.js');
    expect(getWireFlags()).toEqual({
      metricsEnabled: false,
      writesEnabled: false,
      continuityEnabled: false,
    });
  });
});

describe('continuity requires writes (§4.8 flag table)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const withFlags = async (metrics, writes, continuity) => {
    vi.doMock('../../src/config/featureFlags.js', () => ({
      WIRE_METRICS_ENABLED: metrics,
      WIRE_WRITES_ENABLED: writes,
      CONTINUITY_MEMORY_ENABLED: continuity,
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

  it('metrics is independent of writes in both directions', async () => {
    expect((await withFlags(true, false, false)).metricsEnabled).toBe(true);
    vi.resetModules();
    expect((await withFlags(false, true, false)).metricsEnabled).toBe(false);
  });
});
