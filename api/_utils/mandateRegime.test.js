// api/_utils/mandateRegime.test.js
// Spec 1 §6.1 (P3) — regime provenance: fresh label stamps, stale/absent/
// unprovable resolve 'unknown' — NEVER a silently stale label.

import { describe, it, expect } from 'vitest';
import { resolveRegime } from './mandateRegime.js';
import { MANDATE_REGIME_MAX_AGE_MS, MANDATE_REGIME_SOURCE } from './mandateConfig.js';

const NOW = new Date('2026-08-12T20:30:00Z');

describe('resolveRegime', () => {
  it('stamps a fresh regime with provenance', () => {
    const updatedAt = new Date('2026-08-12T20:00:00Z'); // 30 min old
    const r = resolveRegime({ regime: 'risk_on', updatedAt }, NOW);
    expect(r).toEqual({ regime: 'risk_on', regimeAsOf: updatedAt.toISOString(), regimeSource: MANDATE_REGIME_SOURCE });
  });
  it('a doc older than MANDATE_REGIME_MAX_AGE_MS stamps UNKNOWN (provenance kept)', () => {
    const stale = new Date(NOW.getTime() - MANDATE_REGIME_MAX_AGE_MS - 1000);
    const r = resolveRegime({ regime: 'risk_on', updatedAt: stale }, NOW);
    expect(r.regime).toBe('unknown');
    expect(r.regimeAsOf).toBe(stale.toISOString()); // what was seen is still recorded
  });
  it('a missing doc, missing label, or missing updatedAt stamps unknown (freshness unprovable)', () => {
    expect(resolveRegime(null, NOW).regime).toBe('unknown');
    expect(resolveRegime({ updatedAt: NOW }, NOW).regime).toBe('unknown');
    expect(resolveRegime({ regime: '' , updatedAt: NOW }, NOW).regime).toBe('unknown');
    expect(resolveRegime({ regime: 'risk_on' }, NOW).regime).toBe('unknown'); // label without a clock proves nothing
  });
  it("an upstream 'unknown' label within freshness is stamped verbatim (a real value, not an error)", () => {
    const r = resolveRegime({ regime: 'unknown', updatedAt: NOW }, NOW);
    expect(r.regime).toBe('unknown');
    expect(r.regimeAsOf).toBe(NOW.toISOString());
  });
  it('accepts Firestore-Timestamp-shaped updatedAt (toDate)', () => {
    const ts = { toDate: () => new Date('2026-08-12T20:00:00Z') };
    expect(resolveRegime({ regime: 'choppy', updatedAt: ts }, NOW).regime).toBe('choppy');
  });
});
