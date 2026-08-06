// src/utils/compositionDisplay.test.js
//
// Composition PR 2 — the D2 display boundary rows: greyed-with-reason for
// core_conflict (B7), HIDDEN for deferred (B1), fit-note + narrowed domain for
// tension — and the A23 display row: flag dark ⇒ the copy surface is
// byte-identical to legacy.

import { describe, it, expect } from 'vitest';
import { getCandidateDisplayState } from './compositionDisplay.js';
import { buildConflictBadge } from './compatSurfaceCopy.js';
import { getCandidateCompatCell } from '../data/archetypeCompatibilityCandidate.js';

describe('D2 — getCandidateDisplayState', () => {
  it('core_conflict → greyed with the one-line displayReason of record (B7)', () => {
    const s = getCandidateDisplayState('r-09', 'degen', { enabled: true });
    expect(s.greyed).toBe(true);
    expect(s.visible).toBe(true);
    expect(s.displayReason).toBe(getCandidateCompatCell('r-09', 'degen').displayReason);
  });
  it('deferred → HIDDEN (complete-but-non-offerable, B1 — never absence semantics)', () => {
    const s = getCandidateDisplayState('f-12', 'guardian', { enabled: true });
    expect(s).toEqual({ visible: false, greyed: false, displayReason: null, fitNote: null, narrowedParams: null, state: 'deferred' });
  });
  it('tension → offered with the fit note (verbatim advisory) + narrowed domain', () => {
    const s = getCandidateDisplayState('alloc-sector-cap', 'momentum_chaser', { enabled: true });
    expect(s.visible).toBe(true);
    expect(s.greyed).toBe(false);
    expect(s.fitNote).toBe(getCandidateCompatCell('alloc-sector-cap', 'momentum_chaser').advisory);
    // PR-3 binding restoration (A11): the domain is param-keyed to pct per the
    // ledger notation of record (R-61: {pct ∈ [40,80]}).
    expect(s.narrowedParams).toEqual({ pct: { min: 40, max: 80 } });
  });
  it('A23: flag dark ⇒ null (callers fall through to legacy untouched)', () => {
    expect(getCandidateDisplayState('r-09', 'degen', { enabled: false })).toBeNull();
    expect(getCandidateDisplayState('r-09', 'degen')).toBeNull(); // real flag default
  });
});

describe('A23 — the badge splice is byte-identical while dark', () => {
  it('buildConflictBadge with a templateId equals the legacy string while COMPOSITION_DISPLAY_ENABLED=false', () => {
    expect(buildConflictBadge({ archetype: 'degen', templateId: 'r-09' }))
      .toBe(buildConflictBadge({ archetype: 'degen' }));
  });
});
