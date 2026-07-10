// api/_utils/leanRevalidation.test.js
//
// Release 2 PR-a foundations — battle-creation lean revalidation (spec Phase 1
// item 7 / changelog #17; fail closed, never trust future UI). This file's
// REAL import of leanRevalidation.js (→ src/data/archetypeAdjustments.js) is
// the BUILD_RULES §4 dependency-surface guard — never mock it.

import { describe, it, expect } from 'vitest';
import { revalidateStandingLeans, LEAN_INVALIDATION_REASONS } from './leanRevalidation.js';
import { getCanonicalText } from '../../src/data/archetypeAdjustments.js';

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
