// api/_utils/regimeStamp.test.js
// Corpus Capture Patch W3 — behavioral coverage for the pure stamp helpers
// (Build Spec §6 Phase 2: write-once/if-absent idempotence, flag-off ⇒ no
// write, shape conformance, stale-observedAt still stamps). The cron wiring
// itself is static-guarded in api/cron/agent-evaluate.test.js.
import { describe, it, expect } from 'vitest';
import {
  shouldStampRegime,
  buildRegimeAtStart,
  REGIME_STAMP_SOURCE,
  REGIME_STAMP_TAXONOMY_VERSION,
  REGIME_STAMP_SHAPE_VERSION,
} from './regimeStamp.js';

const mc = (overrides = {}) => ({
  regime: 'bull',
  regimeDetail: 'Price > 50SMA > 200SMA',
  mode: 'intraday',
  updatedAt: '2026-07-20T14:30:00.000Z',
  ...overrides,
});

describe('shouldStampRegime — write-once, if-absent, flag-gated', () => {
  it('stamps only when: flag on, field absent, marketContext loaded', () => {
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: mc(), enabled: true })).toBe(true);
  });

  it('flag off ⇒ never stamps (zero behavior change with the flag dark)', () => {
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: mc(), enabled: false })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: mc(), enabled: undefined })).toBe(false);
  });

  it('WRITE-ONCE: an already-stamped battle is never restamped (idempotent under retries)', () => {
    const stamped = { id: 'b1', regimeAtStart: buildRegimeAtStart(mc(), '2026-07-20T14:31:00.000Z') };
    expect(shouldStampRegime({ battle: stamped, marketContext: mc(), enabled: true })).toBe(false);
    // Second pass over the same battle object — still false (idempotence).
    expect(shouldStampRegime({ battle: stamped, marketContext: mc({ regime: 'bear' }), enabled: true })).toBe(false);
  });

  it('an explicit null field is still "present" — write-once means never overwrite, even a null', () => {
    expect(shouldStampRegime({ battle: { id: 'b1', regimeAtStart: null }, marketContext: mc(), enabled: true })).toBe(false);
  });

  it('missing marketContext doc ⇒ skip this pass (next tick retries; the write-once slot is not burned)', () => {
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: null, enabled: true })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: undefined, enabled: true })).toBe(false);
  });

  it('a doc that EXISTS but has no regime label ⇒ skip (never burn the write-once slot on an all-null stamp)', () => {
    // Partial upstream write: the doc object is truthy but regime is absent —
    // stamping would permanently record nulls (write-once refuses repair).
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: {}, enabled: true })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { updatedAt: 'x' }, enabled: true })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: '' }, enabled: true })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: 42 }, enabled: true })).toBe(false);
    // 'unknown' is a real upstream label — recorded verbatim, still stamps
    // (given a valid updatedAt; see the #4 case below).
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: 'unknown', updatedAt: 'x' }, enabled: true })).toBe(true);
  });

  it('#4: regime present but updatedAt absent ⇒ skip (never stamp observedAt permanently null on a write-once field)', () => {
    // Both mandatory provenance fields (regime AND updatedAt) must be present.
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: 'bull' }, enabled: true })).toBe(false);
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: 'bull', updatedAt: null }, enabled: true })).toBe(false);
    // A Firestore Timestamp OBJECT (what serverTimestamp reads back as) must PASS
    // the present-check — the guard is `== null`, not a string/type check.
    const ts = { seconds: 1784000000, nanoseconds: 0, toMillis: () => 1784000000000 };
    expect(shouldStampRegime({ battle: { id: 'b1' }, marketContext: { regime: 'bull', updatedAt: ts }, enabled: true })).toBe(true);
  });

  it('never throws on malformed input', () => {
    expect(() => shouldStampRegime()).not.toThrow();
    expect(shouldStampRegime()).toBe(false);
    expect(shouldStampRegime({ enabled: true })).toBe(false);
  });
});

describe('buildRegimeAtStart — Build Spec §5.3 shape', () => {
  it('carries exactly the spec shape with the canonical provenance literal', () => {
    const stamp = buildRegimeAtStart(mc(), '2026-07-20T14:31:00.000Z');
    expect(stamp).toEqual({
      regime: 'bull',
      source: REGIME_STAMP_SOURCE,
      observedAt: '2026-07-20T14:30:00.000Z',
      drbRegime: null, // no DRB read authorized in the tick (founder item 6)
      drbForDate: null,
      stampedAt: '2026-07-20T14:31:00.000Z',
      taxonomyVersion: REGIME_STAMP_TAXONOMY_VERSION,
      shapeVersion: REGIME_STAMP_SHAPE_VERSION, // #5 prior-ruling: disambiguates future null fields
    });
    expect(REGIME_STAMP_SOURCE).toBe('indexIntelligence/marketContext');
    expect(REGIME_STAMP_TAXONOMY_VERSION).toBe(1);
    expect(REGIME_STAMP_SHAPE_VERSION).toBe(1);
  });

  it('STALENESS IS RECORDED, NOT ADJUDICATED: a weekend-old observedAt still stamps', () => {
    // Friday-close doc stamped on a Sunday-dated pass — stamp anyway;
    // observedAt lets consumers judge freshness. The stamper stays dumb.
    const stale = buildRegimeAtStart(mc({ updatedAt: '2026-07-17T20:00:00.000Z' }), '2026-07-19T13:00:00.000Z');
    expect(stale.regime).toBe('bull');
    expect(stale.observedAt).toBe('2026-07-17T20:00:00.000Z');
    expect(stale.stampedAt).toBe('2026-07-19T13:00:00.000Z');
  });

  it("an upstream 'unknown' regime is recorded verbatim, never coerced", () => {
    expect(buildRegimeAtStart(mc({ regime: 'unknown' }), '2026-07-20T14:31:00.000Z').regime).toBe('unknown');
  });

  it('missing doc fields stay null — recorded, never fabricated', () => {
    const stamp = buildRegimeAtStart({}, '2026-07-20T14:31:00.000Z');
    expect(stamp.regime).toBeNull();
    expect(stamp.observedAt).toBeNull();
    expect(stamp.source).toBe(REGIME_STAMP_SOURCE);
  });

  it('a Firestore-Timestamp-like observedAt passes through untouched (no serialization)', () => {
    const ts = { seconds: 1784000000, nanoseconds: 0, toMillis: () => 1784000000000 };
    expect(buildRegimeAtStart(mc({ updatedAt: ts }), '2026-07-20T14:31:00.000Z').observedAt).toBe(ts);
  });
});
