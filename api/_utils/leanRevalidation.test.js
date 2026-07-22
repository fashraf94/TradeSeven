// api/_utils/leanRevalidation.test.js
//
// Release 2 PR-a foundations — battle-creation lean revalidation (spec Phase 1
// item 7 / changelog #17; fail closed, never trust future UI). This file's
// REAL import of leanRevalidation.js (→ src/data/archetypeAdjustments.js) is
// the BUILD_RULES §4 dependency-surface guard — never mock it.

import { describe, it, expect, vi } from 'vitest';
import { revalidateStandingLeans, buildCustomizationSnapshot, LEAN_INVALIDATION_REASONS } from './leanRevalidation.js';
import { getCanonicalText } from '../../src/data/archetypeAdjustments.js';

describe('owner-writable at-rest hardening (/code-review Phase-5)', () => {
  it('a DUPLICATE same-id pin is omitted (first occurrence wins) and never eats a cap slot', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CP-04', version: 1, equippedAt: 't1' },
        { adjustmentId: 'CP-04', version: 1, equippedAt: 't2' }, // duplicate — loses
        { adjustmentId: 'CP-01', version: 1, equippedAt: 't3' }, // must still fit under the cap
      ],
      archetypeCodeId: 'guardian',
    });
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CP-04', 'CP-01']); // no double render, no stolen slot
    expect(invalidated).toEqual([
      { adjustmentId: 'CP-04', version: 1, reason: LEAN_INVALIDATION_REASONS.DUPLICATE_PIN },
    ]);
  });

  it('the snapshot dial is BOUNDED: strings sliced short, non-strings dropped (garbage stays visible to the clamp, never breaks battle creation)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const snap = (dials) => buildCustomizationSnapshot({ archetype: 'guardian', standingLeans: [], dials }, 't0');
    expect(snap({ tempo: 'aggressive' }).dials).toEqual({ tempo: 'aggressive' });   // legal value verbatim
    expect(snap({ tempo: 'warp' }).dials).toEqual({ tempo: 'warp' });               // short garbage stays VISIBLE (the clamp suppresses it)
    expect(snap({ tempo: 'x'.repeat(500_000) }).dials.tempo).toHaveLength(32);      // 1 MiB attack → 32 chars
    expect(snap({ tempo: { huge: 'object' } }).dials).toBeNull();                   // non-strings never enter the doc
    expect(snap(undefined).dials).toBeNull();
    logSpy.mockRestore();
  });
});

describe('revalidateStandingLeans', () => {
  it('passes a current-version, in-menu lean through with the RESOLVED current text (snapshot shape)', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [{ adjustmentId: 'CP-04', version: 1, equippedAt: 't' }],
      archetypeCodeId: 'guardian',
    });
    expect(invalidated).toEqual([]);
    expect(valid).toEqual([
      { adjustmentId: 'CP-04', version: 1, text: getCanonicalText('guardian', 'CP-04') },
    ]);
  });

  it('omits a cross-archetype lean (stale after an archetype change) with not_in_menu', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [{ adjustmentId: 'CP-04', version: 1 }],
      archetypeCodeId: 'degen',
    });
    expect(valid).toEqual([]);
    expect(invalidated).toEqual([
      { adjustmentId: 'CP-04', version: 1, reason: LEAN_INVALIDATION_REASONS.NOT_IN_MENU },
    ]);
  });

  it('omits a deprecated-version pin (text has moved on) with deprecated_version — never renders stale text', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [{ adjustmentId: 'CP-04', version: 0 }],
      archetypeCodeId: 'guardian',
    });
    expect(valid).toEqual([]);
    expect(invalidated).toEqual([
      { adjustmentId: 'CP-04', version: 0, reason: LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION },
    ]);
  });

  it('fails closed on an unknown archetype (everything invalidated, nothing snapshot-bound)', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [{ adjustmentId: 'CP-04', version: 1 }],
      archetypeCodeId: 'not_a_real_archetype',
    });
    expect(valid).toEqual([]);
    expect(invalidated[0].reason).toBe(LEAN_INVALIDATION_REASONS.NOT_IN_MENU);
  });

  it('flags malformed entries instead of silently dropping them', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [null, { adjustmentId: 'CP-04' }, { version: 1 }],
      archetypeCodeId: 'guardian',
    });
    expect(valid).toEqual([]);
    expect(invalidated).toHaveLength(3);
    expect(invalidated.every((i) => i.reason === LEAN_INVALIDATION_REASONS.MALFORMED)).toBe(true);
  });

  it('partitions mixed sets correctly (valid + stale + cross-menu in one pass)', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CP-04', version: 1 },
        { adjustmentId: 'CP-05', version: 99 },
        { adjustmentId: 'DV-01', version: 1 },
      ],
      archetypeCodeId: 'guardian',
    });
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CP-04']);
    expect(invalidated.map((i) => [i.adjustmentId, i.reason])).toEqual([
      ['CP-05', LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION],
      ['DV-01', LEAN_INVALIDATION_REASONS.NOT_IN_MENU],
    ]);
  });

  it('empty/absent input resolves to empty partitions', () => {
    expect(revalidateStandingLeans({ standingLeans: [], archetypeCodeId: 'guardian' })).toEqual({ valid: [], invalidated: [] });
    expect(revalidateStandingLeans({})).toEqual({ valid: [], invalidated: [] });
  });
});

// ─── /code-review hardening: the shared pin rule + at-rest SET checks ───

import { validateLeanPin, STANDING_LEANS_CAP } from './leanRevalidation.js';

describe('validateLeanPin — the single validity authority the equip endpoint shares', () => {
  it('accepts a current in-menu pin; refuses cross-menu, stale, malformed with the shared reasons', () => {
    expect(validateLeanPin('guardian', 'CP-04', 1)).toEqual({ ok: true });
    expect(validateLeanPin('degen', 'CP-04', 1)).toEqual({ ok: false, reason: LEAN_INVALIDATION_REASONS.NOT_IN_MENU });
    expect(validateLeanPin('guardian', 'CP-04', 0)).toEqual({ ok: false, reason: LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION });
    expect(validateLeanPin('guardian', '', 1)).toEqual({ ok: false, reason: LEAN_INVALIDATION_REASONS.MALFORMED });
    expect(validateLeanPin('guardian', 'CP-04', '1')).toEqual({ ok: false, reason: LEAN_INVALIDATION_REASONS.MALFORMED });
  });
});

describe('at-rest SET checks (post-adjudication group changes; cap tightening)', () => {
  it('omits the LATER-equipped side of a conflict group added after both were legally equipped', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CP-05', version: 1, equippedAt: '2026-07-02T00:00:00Z' }, // later — loses
        { adjustmentId: 'CP-04', version: 1, equippedAt: '2026-07-01T00:00:00Z' }, // earlier — wins
      ],
      archetypeCodeId: 'guardian',
    });
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CP-04']);
    expect(invalidated).toEqual([
      { adjustmentId: 'CP-05', version: 1, reason: LEAN_INVALIDATION_REASONS.CONFLICTING_LEAN },
    ]);
  });

  it('a missing equippedAt stamp loses the conflict tie', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CP-05', version: 1 }, // unstamped — loses
        { adjustmentId: 'CP-04', version: 1, equippedAt: '2026-07-01T00:00:00Z' },
      ],
      archetypeCodeId: 'guardian',
    });
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CP-04']);
    expect(invalidated[0].reason).toBe(LEAN_INVALIDATION_REASONS.CONFLICTING_LEAN);
  });

  it('enforces the cap over at-rest data (earliest equips win) and keeps equip order in the snapshot shape', () => {
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: [
        { adjustmentId: 'CP-02', version: 1, equippedAt: '2026-07-03T00:00:00Z' }, // 3rd — over cap
        { adjustmentId: 'CP-01', version: 1, equippedAt: '2026-07-01T00:00:00Z' },
        { adjustmentId: 'CP-04', version: 1, equippedAt: '2026-07-02T00:00:00Z' },
      ],
      archetypeCodeId: 'guardian',
    });
    expect(STANDING_LEANS_CAP).toBe(2);
    // Snapshot order = original array order of the accepted set.
    expect(valid.map((l) => l.adjustmentId)).toEqual(['CP-01', 'CP-04']);
    expect(invalidated).toEqual([
      { adjustmentId: 'CP-02', version: 1, reason: LEAN_INVALIDATION_REASONS.OVER_CAP },
    ]);
  });
});

// ─── Ruling M6: the leanCap injection channel's closed vocabulary ───

import { isLegalLeanCap, acceptedStandingLeans, MASTERY_LEAN_CAP_MAX } from './leanRevalidation.js';

describe('acceptedStandingLeans — the M5 counting export (structural clamp, no entitlement)', () => {
  it('returns the kernel-accepted current-archetype set: cross-menu/stale/duplicate pins excluded, up to the structural max', () => {
    const accepted = acceptedStandingLeans({
      standingLeans: [
        { adjustmentId: 'SP-01', version: 1, equippedAt: 't1' }, // cross-menu — excluded
        { adjustmentId: 'CP-01', version: 1, equippedAt: 't2' },
        { adjustmentId: 'CP-02', version: 0, equippedAt: 't3' }, // stale — excluded
        { adjustmentId: 'CP-03', version: 1, equippedAt: 't4' },
        { adjustmentId: 'CP-06', version: 1, equippedAt: 't5' },
      ],
      archetypeCodeId: 'guardian',
    });
    // 3 accepted (< structural max 4) — no entitlement clamp applied here;
    // entitlement is the caller's check (equip-lean's leanCap).
    expect(accepted.map((l) => l.adjustmentId)).toEqual(['CP-01', 'CP-03', 'CP-06']);
  });
});

describe('leanCap injection vocabulary (ruling M6: [2..4] integers only; reject + log outside)', () => {
  const THREE = [
    { adjustmentId: 'CP-01', version: 1, equippedAt: '2026-07-01T00:00:00Z' },
    { adjustmentId: 'CP-04', version: 1, equippedAt: '2026-07-02T00:00:00Z' },
    { adjustmentId: 'CP-02', version: 1, equippedAt: '2026-07-03T00:00:00Z' },
  ];

  it('isLegalLeanCap pins the vocabulary to exactly [2..4] integers', () => {
    expect([0, 1, 5, 100, -1, 2.5, NaN, Infinity, '3', null, true].filter(isLegalLeanCap)).toEqual([]);
    expect([2, 3, 4].every(isLegalLeanCap)).toBe(true);
    expect(STANDING_LEANS_CAP).toBe(2);
    expect(MASTERY_LEAN_CAP_MAX).toBe(4);
  });

  it('an in-vocabulary injection (the §8 corrections channel) is honored', () => {
    const { valid } = revalidateStandingLeans({ standingLeans: THREE, archetypeCodeId: 'guardian', leanCap: 3 });
    expect(valid).toHaveLength(3);
  });

  it.each([
    ['a WIDER-than-structural cap', 100],
    ['a below-baseline cap', 1],
    ['zero', 0],
    ['a negative cap', -2],
    ['a non-integer', 2.5],
    ['a numeric string', '3'],
    ['null', null],
    ['NaN', NaN],
  ])('REJECTS %s: falls back to the BASELINE cap (never wider) and logs the attempt', (_label, injected) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { valid, invalidated } = revalidateStandingLeans({
      standingLeans: THREE,
      archetypeCodeId: 'guardian',
      leanCap: injected,
    });
    // Fail-closed: baseline (2), NOT the structural max — a malformed
    // injection must never grant above baseline (omission is recoverable,
    // an over-grant is not).
    expect(valid).toHaveLength(STANDING_LEANS_CAP);
    expect(invalidated).toEqual([
      expect.objectContaining({ adjustmentId: 'CP-02', reason: LEAN_INVALIDATION_REASONS.OVER_CAP }),
    ]);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('out-of-vocabulary leanCap injection'),
      expect.any(String),
    );
    errSpy.mockRestore();
  });

  it('undefined is NOT an injection: the shared per-call default resolves (no log)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { valid } = revalidateStandingLeans({ standingLeans: THREE, archetypeCodeId: 'guardian' });
    expect(valid).toHaveLength(STANDING_LEANS_CAP); // dark default = baseline
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
