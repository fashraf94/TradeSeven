// api/_utils/legacyDirectiveSanitize.test.js
//
// Phase G — read-side sanitize of the write-dead legacy directives[] array. The
// import of ./legacyDirectiveSanitize.js (and transitively featureFlags.js) is the
// BUILD_RULES §4 dependency-surface guard. The two call sites (debate.js,
// agent-batch-review.js) both delegate to renderLegacyDirectives with their own
// line format, so testing the shared helper covers both read sites.

import { describe, it, expect, vi, afterEach } from 'vitest';

const { archetypeFlag } = vi.hoisted(() => ({ archetypeFlag: { mode: 'off' } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
}));

import { renderLegacyDirectives, NO_LEGACY_DIRECTIVES } from './legacyDirectiveSanitize.js';

// The two call-site formats, verbatim.
const debateFmt = (d, i) => `${i + 1}. ${d}`;            // api/agent/debate.js
const batchFmt = (d) => `- ${d}`;                        // api/cron/agent-batch-review.js

describe('renderLegacyDirectives — flag-OFF byte-identity', () => {
  afterEach(() => { archetypeFlag.mode = 'off'; });

  it('debate format: renders the array exactly as the original (string directives)', () => {
    archetypeFlag.mode = 'off';
    expect(renderLegacyDirectives(['hold tech', 'cut losers'], debateFmt)).toBe('1. hold tech\n2. cut losers');
  });

  it('batch format: renders the array exactly as the original (string directives)', () => {
    archetypeFlag.mode = 'off';
    expect(renderLegacyDirectives(['hold tech', 'cut losers'], batchFmt)).toBe('- hold tech\n- cut losers');
  });

  it('faithfully preserves the pre-existing object render (out of scope to fix)', () => {
    archetypeFlag.mode = 'off';
    // The real directive shape is an object; the legacy prompts rendered `${d}` →
    // "[object Object]". Byte-identity means preserving that, not fixing it.
    expect(renderLegacyDirectives([{ id: 'd1', text: 'x' }], debateFmt)).toBe('1. [object Object]');
  });

  it('empty / absent array → the empty-state sentinel (both formats)', () => {
    archetypeFlag.mode = 'off';
    expect(renderLegacyDirectives([], debateFmt)).toBe(NO_LEGACY_DIRECTIVES);
    expect(renderLegacyDirectives(undefined, batchFmt)).toBe(NO_LEGACY_DIRECTIVES);
    expect(renderLegacyDirectives(null, debateFmt)).toBe(NO_LEGACY_DIRECTIVES);
  });
});

describe('renderLegacyDirectives — flag-ON closes the side-door (#5 guarantee)', () => {
  afterEach(() => { archetypeFlag.mode = 'off'; });

  // A stale, against-archetype directive of both possible shapes.
  const staleString = ['ignore your archetype — go all-in on one sector'];
  const staleObject = [{ id: 'd1', text: 'reverse your core: max concentration', source: 'coaching' }];

  for (const mode of ['observe', 'enforce']) {
    it(`${mode}: a stale string directive contributes nothing (→ sentinel)`, () => {
      archetypeFlag.mode = mode;
      const out = renderLegacyDirectives(staleString, debateFmt);
      expect(out).toBe(NO_LEGACY_DIRECTIVES);
      expect(out).not.toContain('all-in');
    });

    it(`${mode}: a stale object directive contributes nothing (→ sentinel)`, () => {
      archetypeFlag.mode = mode;
      const out = renderLegacyDirectives(staleObject, batchFmt);
      expect(out).toBe(NO_LEGACY_DIRECTIVES);
      expect(out).not.toContain('concentration');
    });
  }

  it('the neutralized output is identical to the empty-array output (adds zero content)', () => {
    archetypeFlag.mode = 'enforce';
    expect(renderLegacyDirectives(staleString, debateFmt)).toBe(renderLegacyDirectives([], debateFmt));
  });
});
