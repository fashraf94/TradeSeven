// Phase 5.5 regression tests for applyDurationAuthority. Covers:
//   - Gemma-wins override when Haiku emitted a different valid duration
//   - Silent restore when Haiku output null (common case post-prompt-change)
//   - Haiku autonomy when Gemma had no recommendation (null thesis input)
//   - Invalid Gemma value ignored (off-grid → Haiku's view stands)
//   - Agreement is silent (no clutter when both sides say the same thing)
//   - Prompt smoke: buildSystemPrompt emits the new deference instruction

import { describe, it, expect, vi } from 'vitest';

// Stub transitive imports so compile-dimensions.js loads without live env.
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'test' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logCompilation: async () => {} }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: async () => ({ content: [{ type: 'text', text: '{}' }] }) }; },
}));

const {
  applyDurationAuthority,
  buildSystemPrompt,
} = await import('./compile-dimensions.js');

describe('applyDurationAuthority — Phase 5.5 override logic', () => {
  it('Gemma-wins override: Haiku emitted a different valid duration', () => {
    const notes = [];
    const result = applyDurationAuthority(5, 20, notes);
    expect(result).toBe(5);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Preserved Workshop duration recommendation \(5 days\); compile model suggested 20 days/);
  });

  it('silent restore: Haiku output null, Gemma had a valid value', () => {
    const notes = [];
    const result = applyDurationAuthority(10, null, notes);
    expect(result).toBe(10);
    expect(notes).toHaveLength(0);  // no user-visible override
  });

  it('Haiku autonomy: Gemma null → Haiku value stands', () => {
    const notes = [];
    const result = applyDurationAuthority(null, 20, notes);
    expect(result).toBe(20);
    expect(notes).toHaveLength(0);
  });

  it('invalid Gemma value ignored (off-grid treated as absent)', () => {
    const notes = [];
    const result = applyDurationAuthority(7, 20, notes);
    expect(result).toBe(20);
    expect(notes).toHaveLength(0);
  });

  it('invalid Gemma value ignored (wrong type treated as absent)', () => {
    const notes = [];
    const result = applyDurationAuthority('5', 20, notes);
    expect(result).toBe(20);
    expect(notes).toHaveLength(0);
  });

  it('agreement is silent: both sides emit the same duration', () => {
    const notes = [];
    const result = applyDurationAuthority(10, 10, notes);
    expect(result).toBe(10);
    expect(notes).toHaveLength(0);
  });

  it('Gemma null + Haiku null → null (no recommendation on either side)', () => {
    const notes = [];
    const result = applyDurationAuthority(null, null, notes);
    expect(result).toBeNull();
    expect(notes).toHaveLength(0);
  });

  it('every valid enum value round-trips when both sides agree', () => {
    for (const d of [5, 10, 15, 20]) {
      const notes = [];
      expect(applyDurationAuthority(d, d, notes)).toBe(d);
      expect(notes).toHaveLength(0);
    }
  });
});

describe('buildSystemPrompt — Phase 5.5 prompt deference section', () => {
  it('instructs Haiku to echo valid thesis recommendedDurationDays', () => {
    const prompt = buildSystemPrompt(20);
    // Key deference phrasing from SYSTEM_INSTRUCTIONS item 5
    expect(prompt).toMatch(/your output MUST set `recommendedDurationDays` to the same value/);
    expect(prompt).toContain("Workshop conversation's recommendation");
  });

  it('preserves the null/absent fallback path (Haiku assesses when Gemma had no opinion)', () => {
    const prompt = buildSystemPrompt(20);
    expect(prompt).toMatch(/null, absent, or any other value.*assess the thesis yourself/);
  });
});
